BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE c uuid:='1fd22072-6932-4122-941f-cb31c55efd66'; total integer;
BEGIN
 INSERT INTO public.wa_tracking_records(connection_id,entity,entity_key,revision,occurred_at,payload)
 SELECT c,'messages','__deep_origin_'||i,1,'2021-01-01T12:00Z',jsonb_build_object('contact_id','__deep_'||i,'attribution_reason','no_reference','crm_origin_utm_source',CASE WHEN i=2 THEN 'meta' ELSE '' END) FROM generate_series(1,2)i;
 SELECT count(*) INTO total FROM public.wa_kommo_deep_origin_candidates(c,'2021-01-01','2021-01-02');
 IF total<>1 THEN RAISE EXCEPTION 'known_history_or_period_not_filtered';END IF;
 IF EXISTS(SELECT 1 FROM public.wa_kommo_deep_origin_candidates('00000000-0000-0000-0000-000000000000','2021-01-01','2021-01-02')) THEN RAISE EXCEPTION 'cross_connection';END IF;
 IF has_function_privilege('authenticated','public.wa_kommo_deep_origin_candidates(uuid,timestamptz,timestamptz)','EXECUTE') OR has_function_privilege('anon','public.wa_kommo_deep_origin_candidates(uuid,timestamptz,timestamptz)','EXECUTE') THEN RAISE EXCEPTION 'rpc_exposed';END IF;
END $$;
ROLLBACK;
SELECT 'PASS: deep candidates skip known origins, obey connection and period, and remain service-only; fixtures rolled back.' AS verification;
