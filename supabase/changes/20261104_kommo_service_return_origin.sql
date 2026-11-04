BEGIN;
-- A precise reply to the existing Rayafit continuation template proves a
-- service return. It does not prove the original acquisition or an ad click.
CREATE OR REPLACE FUNCTION public.wa_kommo_service_returns(p_connection uuid,p_start timestamptz DEFAULT NULL,p_end timestamptz DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SET search_path='' AS $$
DECLARE total integer;
BEGIN
 IF p_connection<>'1fd22072-6932-4122-941f-cb31c55efd66'::uuid OR NOT EXISTS(SELECT 1 FROM public.wa_kommo_credentials k JOIN public.wa_tracking_connections c ON c.id=k.connection_id WHERE k.connection_id=p_connection AND k.enabled AND c.enabled) THEN RETURN 0;END IF;
 PERFORM 1 FROM public.wa_tracking_connections WHERE id=p_connection FOR UPDATE;
 WITH firsts AS (
  SELECT DISTINCT ON (r.payload->>'contact_id') r.* FROM public.wa_tracking_records r
  WHERE r.connection_id=p_connection AND r.entity='messages'
  ORDER BY r.payload->>'contact_id',r.occurred_at,r.entity_key
 ), eligible AS (
  SELECT f.entity_key,e.event_id,e.occurred_at AS sent_at FROM firsts f
  JOIN LATERAL (SELECT * FROM public.wa_conversation_events ev WHERE ev.connection_id=p_connection AND ev.contact_id=f.payload->>'contact_id' AND ev.direction='outgoing' AND ev.occurred_at<f.occurred_at AND ev.occurred_at>=f.occurred_at-interval '30 minutes' ORDER BY ev.occurred_at DESC,ev.event_id LIMIT 1)e ON true
  WHERE f.payload->>'attribution_reason'='no_reference' AND f.payload->>'origin_return_kind' IS DISTINCT FROM 'service_resumption'
   AND lower(trim(f.payload->>'text'))='continuar' AND e.author_kind IN ('human','automatic')
   AND lower(regexp_replace(trim(e.message_text),'\s+',' ','g'))='olá, tudo bem? gostaria de continuar seu atendimento com a rayafit academia?'
   AND (p_start IS NULL OR f.occurred_at>=p_start) AND (p_end IS NULL OR f.occurred_at<p_end)
   AND coalesce(f.payload->>'utm_source','')='' AND coalesce(f.payload->>'gclid','')='' AND coalesce(f.payload->>'fbclid','')=''
   AND coalesce(f.payload->>'crm_origin_utm_source','')='' AND coalesce(f.payload->>'crm_origin_gclid','')='' AND coalesce(f.payload->>'crm_origin_fbclid','')=''
   AND coalesce(f.payload->>'crm_contact_origin_utm_source','')='' AND coalesce(f.payload->>'crm_contact_origin_label','')='' AND coalesce(f.payload->>'crm_contact_origin_gclid','')='' AND coalesce(f.payload->>'crm_contact_origin_fbclid','')=''
 ) UPDATE public.wa_tracking_records r SET payload=r.payload||jsonb_build_object('origin_return_kind','service_resumption','origin_return_event_id',e.event_id,'origin_return_sent_at',e.sent_at,'origin_return_checked_at',now()),revision=r.revision+1,synced_at=now()
 FROM eligible e WHERE r.connection_id=p_connection AND r.entity='messages' AND r.entity_key=e.entity_key AND r.payload->>'attribution_reason'='no_reference';
 GET DIAGNOSTICS total=ROW_COUNT;
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.wa_kommo_service_returns(uuid,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_kommo_service_returns(uuid,timestamptz,timestamptz) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
