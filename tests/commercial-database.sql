BEGIN;
SELECT public.wa_qr_prepare('14d33095-9db2-4f7f-b667-10110c52c919','f8231746-4c7c-47cb-9ce1-d7ef120ff29f');
UPDATE public.wa_tracking_connections SET enabled=true WHERE id='c9503338-e251-42ee-8dfa-c0378fab7410';
UPDATE public.wa_qr_sessions SET verified_at=now()-interval '1 hour' WHERE connection_id='c9503338-e251-42ee-8dfa-c0378fab7410';
UPDATE public.wa_service_settings SET outbound_started_at=now()-interval '1 hour',capture_ready_at=now()-interval '1 hour' WHERE connection_id='c9503338-e251-42ee-8dfa-c0378fab7410';
INSERT INTO public.wa_tracking_records(connection_id,entity,entity_key,revision,occurred_at,payload)
 VALUES('c9503338-e251-42ee-8dfa-c0378fab7410','messages','commercial-test-inbound',1,now(),jsonb_build_object('contact_id','commercial-synthetic-contact','text','Teste isolado','name','Teste reversível'));
INSERT INTO public.wa_tracking_records(connection_id,entity,entity_key,revision,occurred_at,payload)
 VALUES('c9503338-e251-42ee-8dfa-c0378fab7410','leads','commercial-synthetic-contact',1,now(),'{"contact_id":"commercial-synthetic-contact"}');
DO $$ DECLARE n int; before_count int; batch jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.wa_conversation_events WHERE event_id='commercial-test-inbound' AND direction='incoming') THEN RAISE EXCEPTION 'inbound trigger missing';END IF;
 SELECT count(*) INTO before_count FROM public.wa_tracking_records WHERE connection_id='c9503338-e251-42ee-8dfa-c0378fab7410' AND entity='messages';
 batch:=jsonb_build_array(jsonb_build_object('id','commercial-test-outbound','phone','5511996073333','text','Resposta de teste','created_at',now(),'direction','outgoing','author_kind','unknown'));
 n:=public.wa_conversation_ingest('c9503338-e251-42ee-8dfa-c0378fab7410',batch);IF n<>1 THEN RAISE EXCEPTION 'outbound not persisted';END IF;
 n:=public.wa_conversation_ingest('c9503338-e251-42ee-8dfa-c0378fab7410',batch);IF n<>0 THEN RAISE EXCEPTION 'replayed response duplicated';END IF;
 IF before_count<>(SELECT count(*) FROM public.wa_tracking_records WHERE connection_id='c9503338-e251-42ee-8dfa-c0378fab7410' AND entity='messages') THEN RAISE EXCEPTION 'response counted as lead';END IF;
 n:=public.wa_conversation_ingest('c9503338-e251-42ee-8dfa-c0378fab7410',jsonb_build_array(jsonb_build_object('id','commercial-forbidden','phone','5511888888888','text','Não coletar','created_at',now(),'direction','outgoing')));IF n<>0 THEN RAISE EXCEPTION 'pilot sender restriction escaped';END IF;
 IF has_function_privilege('authenticated','public.wa_conversation_ingest(uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'client can forge events';END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','f8231746-4c7c-47cb-9ce1-d7ef120ff29f',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.wa_conversation_events WHERE connection_id<>'c9503338-e251-42ee-8dfa-c0378fab7410') THEN RAISE EXCEPTION 'other client visible';END IF;
 BEGIN
  INSERT INTO public.wa_commercial_outcomes(connection_id,contact_id,status,evidence) VALUES('1fd22072-6932-4122-941f-cb31c55efd66','other-contact','won','Teste isolado');
  RAISE EXCEPTION 'cross-client write allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
  INSERT INTO public.wa_commercial_outcomes(connection_id,contact_id,status,evidence) VALUES('c9503338-e251-42ee-8dfa-c0378fab7410','missing-contact','won','Teste isolado');
  RAISE EXCEPTION 'missing lead accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 INSERT INTO public.wa_commercial_outcomes(connection_id,contact_id,status,evidence) VALUES('c9503338-e251-42ee-8dfa-c0378fab7410','commercial-synthetic-contact','won','Teste com reversão integral');
 IF NOT EXISTS(SELECT 1 FROM public.wa_commercial_outcomes WHERE contact_id='commercial-synthetic-contact' AND updated_by=auth.uid()) THEN RAISE EXCEPTION 'actor not stamped';END IF;
 UPDATE public.wa_commercial_outcomes SET status='open',evidence='Teste de reabertura' WHERE contact_id='commercial-synthetic-contact' AND connection_id='c9503338-e251-42ee-8dfa-c0378fab7410';
 IF (SELECT count(*) FROM public.wa_commercial_audit WHERE contact_id='commercial-synthetic-contact')<>2 THEN RAISE EXCEPTION 'audit missing';END IF;
 BEGIN
  UPDATE public.wa_commercial_outcomes SET updated_by='0d7bbe99-8f3f-4990-82ef-a0e7ffd6ce6c' WHERE contact_id='commercial-synthetic-contact';
  RAISE EXCEPTION 'forged actor allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
  DELETE FROM public.wa_commercial_audit WHERE contact_id='commercial-synthetic-contact';
  RAISE EXCEPTION 'audit deletion allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
UPDATE public.client_assignments SET is_active=false WHERE client_id='14d33095-9db2-4f7f-b667-10110c52c919' AND user_id='f8231746-4c7c-47cb-9ce1-d7ef120ff29f';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.wa_commercial_outcomes WHERE contact_id='commercial-synthetic-contact') OR EXISTS(SELECT 1 FROM public.wa_conversation_events) THEN RAISE EXCEPTION 'revoked user retained access';END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'commercial ingestion, deduplication, pilot filter, audit and client isolation verified; all test changes rolled back' AS validation;
