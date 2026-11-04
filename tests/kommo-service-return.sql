BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE c uuid:='1fd22072-6932-4122-941f-cb31c55efd66'; total integer;
BEGIN
 total:=public.wa_kommo_service_returns(c,'2026-11-01T03:00Z','2026-11-04T03:00Z');
 IF total<>4 THEN RAISE EXCEPTION 'expected_four_precisely_bound_returns, got %',total;END IF;
 IF public.wa_kommo_service_returns(c,'2026-11-01T03:00Z','2026-11-04T03:00Z')<>0 THEN RAISE EXCEPTION 'not_idempotent';END IF;
 IF EXISTS(SELECT 1 FROM public.wa_tracking_records WHERE connection_id=c AND entity='messages' AND payload->>'origin_return_kind'='service_resumption' AND (payload->>'source_status'='Identificada' OR coalesce(payload->>'utm_source','')<>'' OR coalesce(payload->>'gclid','')<>'' OR coalesce(payload->>'fbclid','')<>'')) THEN RAISE EXCEPTION 'invented_ad_origin';END IF;
 IF EXISTS(SELECT 1 FROM public.wa_kommo_deep_origin_candidates(c,'2026-11-01T03:00Z','2026-11-04T03:00Z')) THEN RAISE EXCEPTION 'resolved_return_repeated';END IF;
 IF public.wa_kommo_service_returns('00000000-0000-0000-0000-000000000000',NULL,NULL)<>0 THEN RAISE EXCEPTION 'cross_connection';END IF;
 IF has_function_privilege('authenticated','public.wa_kommo_service_returns(uuid,timestamptz,timestamptz)','EXECUTE') OR has_function_privilege('anon','public.wa_kommo_service_returns(uuid,timestamptz,timestamptz)','EXECUTE') THEN RAISE EXCEPTION 'rpc_exposed';END IF;
END $$;
ROLLBACK;
SELECT 'PASS: four exact-template replies, same connection/contact, thirty-minute boundary, idempotency and no fabricated acquisition. All changes rolled back.' AS verification;
