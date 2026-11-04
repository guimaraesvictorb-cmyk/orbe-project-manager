BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE c uuid:='1fd22072-6932-4122-941f-cb31c55efd66'; n timestamptz:=now()-interval '3 days'; status text;
BEGIN
 INSERT INTO public.wa_tracking_records(connection_id,entity,entity_key,revision,occurred_at,payload)
 SELECT c,'messages','__orbe_review_'||i,1,n,jsonb_build_object('contact_id','kommo:36071459:99999999'||i,'kommo_contact_id','99999999'||i,'kommo_lead_id','99999998'||i,'attribution_reason','no_reference','source_status','Não identificada','received_at',n,'text','Rolled back test') FROM generate_series(1,3)i;
 status:=public.wa_kommo_review_origin(c,'999','__orbe_review_1','999999991','999999981',n,'{"utm_source":"google"}');
 IF status<>'stale' THEN RAISE EXCEPTION 'wrong_account';END IF;
 status:=public.wa_kommo_review_origin(c,'36071459','__orbe_review_1','999999999','999999981',n,'{"utm_source":"google"}');
 IF status<>'stale' THEN RAISE EXCEPTION 'wrong_contact';END IF;
 status:=public.wa_kommo_review_origin(c,'36071459','__orbe_review_1','999999991','999999981',n,'{"utm_source":"google","private_note":"ignore"}');
 IF status<>'recovered' THEN RAISE EXCEPTION 'old_message_not_recovered';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.wa_tracking_records WHERE connection_id=c AND entity='messages' AND entity_key='__orbe_review_1' AND payload->>'utm_source'='google' AND NOT payload?'private_note') THEN RAISE EXCEPTION 'wrong_source';END IF;
 status:=public.wa_kommo_review_origin(c,'36071459','__orbe_review_2','999999992','999999982',n-interval '30 days','{"utm_source":"fb","utm_campaign":"old_campaign","_crm_entry_channel":"WhatsApp"}');
 IF status<>'historical' THEN RAISE EXCEPTION 'old_lead_not_classified';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.wa_tracking_records WHERE connection_id=c AND entity='messages' AND entity_key='__orbe_review_2' AND payload->>'source_status'='Não identificada' AND payload->>'crm_origin_utm_source'='fb' AND coalesce(payload->>'utm_source','')='' AND payload->>'origin_predates_capture'='true') THEN RAISE EXCEPTION 'historical_source_leaked_into_current';END IF;
 status:=public.wa_kommo_review_origin(c,'36071459','__orbe_review_3','999999993','999999983',n,'{"_crm_entry_channel":"WhatsApp"}');
 IF status<>'missing' THEN RAISE EXCEPTION 'missing_origin_guessed';END IF;
 IF EXISTS(SELECT 1 FROM public.wa_kommo_origin_candidates(c,NULL,NULL,6) WHERE entity_key IN ('__orbe_review_2','__orbe_review_3')) THEN RAISE EXCEPTION 'reviewed_repeated';END IF;
 IF public.wa_kommo_review_origin(c,'36071459','__orbe_review_1','999999991','999999981',n,'{"utm_source":"fb"}')<>'stale' THEN RAISE EXCEPTION 'verified_overwritten';END IF;
 IF has_function_privilege('authenticated','public.wa_kommo_review_origin(uuid,text,text,text,text,timestamptz,jsonb)','EXECUTE') OR has_function_privilege('anon','public.wa_kommo_origin_candidates(uuid,timestamptz,timestamptz,integer)','EXECUTE') THEN RAISE EXCEPTION 'rpc_exposed';END IF;
END $$;
ROLLBACK;
SELECT 'PASS: old-message repair, historical separation, missing evidence, binding, source protection and privileges; all test data rolled back.' AS verification;
