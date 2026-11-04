BEGIN;
-- Old messages remain eligible for evidence-based repair. The ten-minute lead
-- creation boundary, first-message rule and protected-source rule still apply.
CREATE OR REPLACE FUNCTION public.wa_kommo_attribution(p_connection uuid,p_account text,p_message text,p_contact text,p_lead text,p_created timestamptz,p_fields jsonb)
RETURNS boolean LANGUAGE plpgsql SET search_path='' AS $$
DECLARE item record; field text; value text; source jsonb:='{}'; cid text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.wa_kommo_credentials k JOIN public.wa_tracking_connections c ON c.id=k.connection_id WHERE k.connection_id=p_connection AND k.account_id=p_account AND k.enabled AND c.enabled) THEN RETURN false;END IF;
 PERFORM 1 FROM public.wa_tracking_connections WHERE id=p_connection FOR UPDATE;
 SELECT * INTO item FROM public.wa_tracking_records WHERE connection_id=p_connection AND entity='messages' AND entity_key=p_message;
 IF NOT FOUND OR item.payload->>'attribution_reason' IS DISTINCT FROM 'no_reference'
  OR item.payload->>'kommo_contact_id' IS DISTINCT FROM p_contact OR item.payload->>'kommo_lead_id' IS DISTINCT FROM p_lead
  OR p_created IS NULL OR abs(extract(epoch FROM (item.occurred_at-p_created)))>600 THEN RETURN false;END IF;
 IF EXISTS(SELECT 1 FROM public.wa_tracking_records r WHERE r.connection_id=p_connection AND r.entity='messages' AND r.payload->>'kommo_lead_id'=p_lead AND (r.occurred_at,r.entity_key)<(item.occurred_at,item.entity_key)) THEN RETURN false;END IF;
 IF jsonb_typeof(p_fields) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_source';END IF;
 FOREACH field IN ARRAY ARRAY['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid'] LOOP
  IF p_fields?field AND jsonb_typeof(p_fields->field)<>'string' THEN RAISE EXCEPTION 'invalid_source';END IF;
  value:=coalesce(p_fields->>field,'');
  IF length(value)>(CASE WHEN field IN ('gclid','fbclid') THEN 1024 ELSE 256 END) OR value ~ '[[:cntrl:]{}]' THEN RAISE EXCEPTION 'invalid_source';END IF;
  IF field IN ('gclid','fbclid') AND value<>'' AND value !~ '^[A-Za-z0-9_.~-]+$' THEN RAISE EXCEPTION 'invalid_source';END IF;
  source:=source||jsonb_build_object(field,value);
 END LOOP;
 IF coalesce(source->>'utm_source','')='' AND coalesce(source->>'gclid','')='' AND coalesce(source->>'fbclid','')='' THEN RETURN false;END IF;
 UPDATE public.wa_tracking_records SET payload=payload||source||jsonb_build_object('source_status','Identificada','attribution_reason','kommo_lead_first_touch','attribution_checked_at',now(),'kommo_lead_created_at',p_created),revision=revision+1,synced_at=now()
 WHERE connection_id=p_connection AND entity='messages' AND entity_key=p_message;
 cid:='kommo:'||p_account||':'||p_contact;
 PERFORM public.wa_kommo_rebuild_contact(p_connection,cid);
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.wa_kommo_origin_candidates(p_connection uuid,p_start timestamptz DEFAULT NULL,p_end timestamptz DEFAULT NULL,p_limit integer DEFAULT 6)
RETURNS SETOF public.wa_tracking_records LANGUAGE sql STABLE SET search_path='' AS $$
 WITH firsts AS (
  SELECT DISTINCT ON (r.payload->>'kommo_lead_id',r.payload->>'contact_id') r.* FROM public.wa_tracking_records r
  WHERE r.connection_id=p_connection AND r.entity='messages'
   AND EXISTS(SELECT 1 FROM public.wa_kommo_credentials k JOIN public.wa_tracking_connections c ON c.id=k.connection_id WHERE k.connection_id=p_connection AND k.enabled AND c.enabled)
  ORDER BY r.payload->>'kommo_lead_id',r.payload->>'contact_id',r.occurred_at,r.entity_key
 ) SELECT * FROM firsts
 WHERE payload->>'attribution_reason'='no_reference'
  AND (p_start IS NULL OR occurred_at>=p_start) AND (p_end IS NULL OR occurred_at<p_end)
  AND (payload->>'origin_review_checked_at' IS NULL OR (payload->>'origin_review_checked_at')::timestamptz<now()-interval '24 hours'
    OR (payload->>'origin_review_status'='missing' AND occurred_at>now()-interval '15 minutes' AND (payload->>'origin_review_checked_at')::timestamptz<now()-interval '7 seconds'))
 ORDER BY (payload->>'origin_review_checked_at' IS NULL) DESC,occurred_at,entity_key LIMIT greatest(1,least(coalesce(p_limit,6),6));
$$;

CREATE OR REPLACE FUNCTION public.wa_kommo_review_origin(p_connection uuid,p_account text,p_message text,p_contact text,p_lead text,p_created timestamptz,p_fields jsonb)
RETURNS text LANGUAGE plpgsql SET search_path='' AS $$
DECLARE item record; cfg record; field text; value text; review jsonb; status text; capture timestamptz;
BEGIN
 SELECT c.created_at,s.capture_ready_at INTO cfg FROM public.wa_tracking_connections c
 JOIN public.wa_kommo_credentials k ON k.connection_id=c.id
 LEFT JOIN public.wa_service_settings s ON s.connection_id=c.id
 WHERE c.id=p_connection AND k.account_id=p_account AND k.enabled AND c.enabled FOR UPDATE OF c;
 IF NOT FOUND THEN RETURN 'stale';END IF;
 capture:=coalesce(cfg.capture_ready_at,cfg.created_at);
 SELECT * INTO item FROM public.wa_tracking_records WHERE connection_id=p_connection AND entity='messages' AND entity_key=p_message FOR UPDATE;
 IF NOT FOUND OR item.payload->>'attribution_reason' IS DISTINCT FROM 'no_reference'
  OR item.payload->>'kommo_contact_id' IS DISTINCT FROM p_contact OR item.payload->>'kommo_lead_id' IS DISTINCT FROM p_lead
  OR p_created IS NULL OR p_created<'2020-01-01'::timestamptz OR p_created>now()+interval '5 minutes' THEN RETURN 'stale';END IF;
 IF EXISTS(SELECT 1 FROM public.wa_tracking_records r WHERE r.connection_id=p_connection AND r.entity='messages' AND r.payload->>'kommo_lead_id'=p_lead AND r.payload->>'contact_id'=item.payload->>'contact_id' AND (r.occurred_at,r.entity_key)<(item.occurred_at,item.entity_key)) THEN RETURN 'stale';END IF;
 IF jsonb_typeof(p_fields) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_source';END IF;
 review:=jsonb_build_object('origin_review_checked_at',now(),'crm_lead_created_at',p_created,'origin_predates_capture',CASE WHEN p_created<capture THEN 'true' ELSE 'false' END);
 FOREACH field IN ARRAY ARRAY['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid'] LOOP
  IF p_fields?field AND jsonb_typeof(p_fields->field)<>'string' THEN RAISE EXCEPTION 'invalid_source';END IF;
  value:=coalesce(p_fields->>field,'');
  IF length(value)>(CASE WHEN field IN ('gclid','fbclid') THEN 1024 ELSE 256 END) OR value ~ '[[:cntrl:]{}]' THEN RAISE EXCEPTION 'invalid_source';END IF;
  IF field IN ('gclid','fbclid') AND value<>'' AND value !~ '^[A-Za-z0-9_.~-]+$' THEN RAISE EXCEPTION 'invalid_source';END IF;
  review:=review||jsonb_build_object('crm_origin_'||field,value);
 END LOOP;
 IF public.wa_kommo_attribution(p_connection,p_account,p_message,p_contact,p_lead,p_created,p_fields) THEN status:='recovered';
 ELSIF p_created<item.occurred_at-interval '10 minutes' THEN status:='historical';
 ELSE status:='missing';END IF;
 UPDATE public.wa_tracking_records SET payload=payload||review||jsonb_build_object('origin_review_status',status),revision=revision+1,synced_at=now()
 WHERE connection_id=p_connection AND entity='messages' AND entity_key=p_message;
 -- Rebuild retains the original contact's source; historical CRM fields never
 -- become the UTM of a new conversation or a synthetic click.
 PERFORM public.wa_kommo_rebuild_contact(p_connection,item.payload->>'contact_id');
 RETURN status;
END $$;
REVOKE ALL ON FUNCTION public.wa_kommo_attribution(uuid,text,text,text,text,timestamptz,jsonb),public.wa_kommo_origin_candidates(uuid,timestamptz,timestamptz,integer),public.wa_kommo_review_origin(uuid,text,text,text,text,timestamptz,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_kommo_attribution(uuid,text,text,text,text,timestamptz,jsonb),public.wa_kommo_origin_candidates(uuid,timestamptz,timestamptz,integer),public.wa_kommo_review_origin(uuid,text,text,text,text,timestamptz,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
