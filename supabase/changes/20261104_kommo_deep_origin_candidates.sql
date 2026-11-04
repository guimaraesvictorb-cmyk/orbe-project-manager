BEGIN;
CREATE OR REPLACE FUNCTION public.wa_kommo_deep_origin_candidates(p_connection uuid,p_start timestamptz DEFAULT NULL,p_end timestamptz DEFAULT NULL)
RETURNS SETOF public.wa_tracking_records LANGUAGE sql STABLE SET search_path='' AS $$
 WITH firsts AS (
 SELECT DISTINCT ON (r.payload->>'contact_id') r.* FROM public.wa_tracking_records r
 WHERE r.connection_id=p_connection AND r.entity='messages'
 AND EXISTS(SELECT 1 FROM public.wa_kommo_credentials k JOIN public.wa_tracking_connections c ON c.id=k.connection_id WHERE k.connection_id=p_connection AND k.enabled AND c.enabled)
 ORDER BY r.payload->>'contact_id',r.occurred_at,r.entity_key
 ) SELECT * FROM firsts
 WHERE payload->>'attribution_reason'='no_reference'
 AND coalesce(payload->>'crm_origin_utm_source','')='' AND coalesce(payload->>'crm_origin_gclid','')='' AND coalesce(payload->>'crm_origin_fbclid','')=''
 AND coalesce(payload->>'crm_contact_origin_utm_source','')='' AND coalesce(payload->>'crm_contact_origin_gclid','')='' AND coalesce(payload->>'crm_contact_origin_fbclid','')=''
 AND (p_start IS NULL OR occurred_at>=p_start) AND (p_end IS NULL OR occurred_at<p_end)
 AND (payload->>'origin_deep_version' IS DISTINCT FROM '1' OR (payload->>'origin_deep_checked_at')::timestamptz<now()-interval '24 hours')
 ORDER BY occurred_at,entity_key LIMIT 2;
$$;
REVOKE ALL ON FUNCTION public.wa_kommo_deep_origin_candidates(uuid,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_kommo_deep_origin_candidates(uuid,timestamptz,timestamptz) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
