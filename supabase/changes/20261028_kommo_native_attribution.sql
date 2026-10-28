BEGIN;
-- Only the service can apply independently fetched CRM acquisition fields.
CREATE OR REPLACE FUNCTION public.wa_kommo_attribution(p_connection uuid,p_account text,p_message text,p_contact text,p_lead text,p_created timestamptz,p_fields jsonb)
RETURNS boolean LANGUAGE plpgsql SET search_path='' AS $$
DECLARE item record; field text; value text; source jsonb:='{}'; cid text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.wa_kommo_credentials k JOIN public.wa_tracking_connections c ON c.id=k.connection_id WHERE k.connection_id=p_connection AND k.account_id=p_account AND k.enabled AND c.enabled) THEN RETURN false;END IF;
 PERFORM 1 FROM public.wa_tracking_connections WHERE id=p_connection FOR UPDATE;
 SELECT * INTO item FROM public.wa_tracking_records WHERE connection_id=p_connection AND entity='messages' AND entity_key=p_message;
 IF NOT FOUND OR item.payload->>'attribution_reason'<>'no_reference'
  OR item.payload->>'kommo_contact_id'<>p_contact OR item.payload->>'kommo_lead_id'<>p_lead
  OR abs(extract(epoch FROM (item.occurred_at-p_created)))>600
  OR item.occurred_at<now()-interval '24 hours' THEN RETURN false;END IF;
 IF EXISTS(SELECT 1 FROM public.wa_tracking_records r WHERE r.connection_id=p_connection AND r.entity='messages' AND r.payload->>'kommo_lead_id'=p_lead AND (r.occurred_at,r.entity_key)<(item.occurred_at,item.entity_key)) THEN RETURN false;END IF;
 IF jsonb_typeof(p_fields)<>'object' THEN RAISE EXCEPTION 'invalid_source';END IF;
 FOREACH field IN ARRAY ARRAY['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid'] LOOP
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
REVOKE ALL ON FUNCTION public.wa_kommo_attribution(uuid,text,text,text,text,timestamptz,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_kommo_attribution(uuid,text,text,text,text,timestamptz,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.wa_kommo_rebuild_contact(p_connection uuid,p_contact text) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE first_row record; last_row record; source jsonb; identity jsonb; total bigint;
BEGIN
 SELECT * INTO first_row FROM public.wa_tracking_records WHERE connection_id=p_connection AND entity='messages' AND payload->>'contact_id'=p_contact ORDER BY occurred_at,entity_key LIMIT 1;
 IF NOT FOUND THEN RETURN;END IF;
 SELECT * INTO last_row FROM public.wa_tracking_records WHERE connection_id=p_connection AND entity='messages' AND payload->>'contact_id'=p_contact ORDER BY occurred_at DESC,entity_key DESC LIMIT 1;
 SELECT count(*) INTO total FROM public.wa_tracking_records WHERE connection_id=p_connection AND entity='messages' AND payload->>'contact_id'=p_contact;
 SELECT payload INTO source FROM public.wa_tracking_records WHERE connection_id=p_connection AND entity='messages' AND payload->>'contact_id'=p_contact AND payload->>'source_status'='Identificada' ORDER BY occurred_at,entity_key LIMIT 1;
 SELECT payload INTO identity FROM public.wa_tracking_records WHERE connection_id=p_connection AND entity='messages' AND payload->>'contact_id'=p_contact AND payload->>'identity_checked'='true' ORDER BY occurred_at DESC LIMIT 1;
 INSERT INTO public.wa_tracking_records(connection_id,entity,entity_key,revision,occurred_at,payload)
 VALUES(p_connection,'leads',p_contact,1,first_row.occurred_at,
 jsonb_build_object('contact_id',p_contact,'name',coalesce(identity->>'name','Contato Kommo'),'phone',coalesce(identity->>'phone',''),
  'phone_status',coalesce(identity->>'phone_status','pending'),'instance',first_row.payload->>'instance',
  'first_message',first_row.payload->>'text','last_message',last_row.payload->>'text','first_interaction',first_row.payload->>'received_at',
  'last_interaction',last_row.payload->>'received_at','message_count',total,'source_status',coalesce(source->>'source_status','Não identificada'),
  'attribution_reason',coalesce(source->>'attribution_reason','no_reference'),'utm_source',coalesce(source->>'utm_source',''),'utm_medium',coalesce(source->>'utm_medium',''),'utm_campaign',coalesce(source->>'utm_campaign',''),
  'utm_content',coalesce(source->>'utm_content',''),'utm_term',coalesce(source->>'utm_term',''),'gclid',coalesce(source->>'gclid',''),'fbclid',coalesce(source->>'fbclid','')))
 ON CONFLICT(connection_id,entity,entity_key) DO UPDATE SET payload=excluded.payload,occurred_at=excluded.occurred_at,
 revision=public.wa_tracking_records.revision+1,synced_at=now();
END $$;
REVOKE ALL ON FUNCTION public.wa_kommo_rebuild_contact(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_kommo_rebuild_contact(uuid,text) TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
