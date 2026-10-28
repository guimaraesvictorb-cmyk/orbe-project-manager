BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE c uuid:='1fd22072-6932-4122-941f-cb31c55efd66'; ok boolean; n timestamptz:=now();
BEGIN
 INSERT INTO public.wa_tracking_records(connection_id,entity,entity_key,revision,occurred_at,payload)
 VALUES(c,'messages','__orbe_native_test_1',1,n,jsonb_build_object('contact_id','kommo:36071459:999999999','kommo_contact_id','999999999','kommo_lead_id','999999998','attribution_reason','no_reference','source_status','Não identificada','received_at',n,'text','Teste revertido')),
 (c,'messages','__orbe_native_test_2',1,n+interval '1 second',jsonb_build_object('contact_id','kommo:36071459:999999999','kommo_contact_id','999999999','kommo_lead_id','999999998','attribution_reason','no_reference','source_status','Não identificada','received_at',n,'text','Teste revertido'));
 IF public.wa_kommo_attribution(c,'999','__orbe_native_test_1','999999999','999999998',n,'{"utm_source":"ig"}') THEN RAISE EXCEPTION 'wrong_account'; END IF;
 IF public.wa_kommo_attribution(c,'36071459','__orbe_native_test_1','999999991','999999998',n,'{"utm_source":"ig"}') THEN RAISE EXCEPTION 'wrong_contact'; END IF;
 IF public.wa_kommo_attribution(c,'36071459','__orbe_native_test_1','999999999','999999997',n,'{"utm_source":"ig"}') THEN RAISE EXCEPTION 'wrong_lead'; END IF;
 IF public.wa_kommo_attribution(c,'36071459','__orbe_native_test_1','999999999','999999998',n-interval '1 day','{"utm_source":"ig"}') THEN RAISE EXCEPTION 'old_lead'; END IF;
 IF public.wa_kommo_attribution(c,'36071459','__orbe_native_test_2','999999999','999999998',n,'{"utm_source":"ig"}') THEN RAISE EXCEPTION 'later_message'; END IF;
 ok:=public.wa_kommo_attribution(c,'36071459','__orbe_native_test_1','999999999','999999998',n,'{"utm_source":"ig","utm_campaign":"rollback_test"}');
 IF NOT ok THEN RAISE EXCEPTION 'valid_rejected';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.wa_tracking_records WHERE connection_id=c AND entity='leads' AND entity_key='kommo:36071459:999999999' AND payload->>'attribution_reason'='kommo_lead_first_touch' AND payload->>'utm_campaign'='rollback_test') THEN RAISE EXCEPTION 'contact_not_rebuilt';END IF;
 IF public.wa_kommo_attribution(c,'36071459','__orbe_native_test_1','999999999','999999998',n,'{"utm_source":"fb"}') THEN RAISE EXCEPTION 'source_overwritten';END IF;
 UPDATE public.wa_tracking_records SET payload=payload||'{"attribution_reason":"reference_match"}'::jsonb WHERE connection_id=c AND entity='messages' AND entity_key='__orbe_native_test_1';
 IF public.wa_kommo_attribution(c,'36071459','__orbe_native_test_1','999999999','999999998',n,'{"utm_source":"fb"}') THEN RAISE EXCEPTION 'reference_overwritten';END IF;
 IF has_function_privilege('authenticated','public.wa_kommo_attribution(uuid,text,text,text,text,timestamptz,jsonb)','EXECUTE') OR has_function_privilege('anon','public.wa_kommo_attribution(uuid,text,text,text,text,timestamptz,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'rpc_exposed'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: account/contact/lead binding, first-message boundary, source protection, contact rebuild, service-only RPC. Test records rolled back.' AS verification;
