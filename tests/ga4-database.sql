-- Run after schema creation in a transaction, before commit.
DO $$
DECLARE c uuid:='1fd22072-6932-4122-941f-cb31c55efd66'; r text:=gen_random_uuid()::text; n integer; p jsonb;
BEGIN
 IF has_table_privilege('anon','public.wa_ga4_streams','SELECT') OR has_table_privilege('authenticated','public.wa_ga4_outbox','SELECT') THEN RAISE EXCEPTION 'access exposed';END IF;
 INSERT INTO public.wa_ga4_streams(connection_id,measurement_id,site_hostname,secret_ciphertext,enabled) VALUES(c,'G-TEST123456','test.invalid','not-a-real-secret',true);
 INSERT INTO public.wa_tracking_records(connection_id,entity,entity_key,revision,occurred_at,payload) VALUES(c,'clicks',r,1,now()-interval '30 seconds',jsonb_build_object('linked_sender_id','test-contact','ga_context',jsonb_build_object('measurement_id','G-TEST123456','client_id','123.456','session_id',floor(extract(epoch from now()-interval '1 minute'))::bigint::text)));
 p:=jsonb_build_object('attribution_reason','reference_match','source_ref',r,'contact_id','test-contact');
 INSERT INTO public.wa_tracking_records(connection_id,entity,entity_key,revision,occurred_at,payload) VALUES(c,'messages',r||'-1',1,now(),p),(c,'messages',r||'-2',1,now(),p),(c,'messages',r||'-wrong',1,now(),p||jsonb_build_object('contact_id','other'));
 SELECT count(*) INTO n FROM public.wa_ga4_outbox WHERE connection_id=c AND source_ref=r;
 IF n<>1 THEN RAISE EXCEPTION 'deduplication or match failed: %',n;END IF;
 SELECT count(*) INTO n FROM public.wa_ga4_claim(c);IF n<>1 THEN RAISE EXCEPTION 'claim failed';END IF;
 SELECT count(*) INTO n FROM public.wa_ga4_claim(c);IF n<>0 THEN RAISE EXCEPTION 'reclaimed sending';END IF;
 UPDATE public.wa_ga4_outbox SET updated_at=now()-interval '6 minutes' WHERE source_ref=r;
 PERFORM public.wa_ga4_claim(c);
 IF NOT EXISTS(SELECT 1 FROM public.wa_ga4_outbox WHERE source_ref=r AND status='uncertain') THEN RAISE EXCEPTION 'ambiguous send retried';END IF;
 DELETE FROM public.wa_ga4_outbox WHERE source_ref=r;
 UPDATE public.wa_ga4_streams SET enabled=false WHERE connection_id=c;
 INSERT INTO public.wa_tracking_records(connection_id,entity,entity_key,revision,occurred_at,payload) VALUES(c,'messages',r||'-disabled',1,now(),p);
 IF EXISTS(SELECT 1 FROM public.wa_ga4_outbox WHERE source_ref=r) THEN RAISE EXCEPTION 'disabled stream queued';END IF;
 UPDATE public.wa_ga4_streams SET enabled=true WHERE connection_id=c;
 INSERT INTO public.wa_tracking_records(connection_id,entity,entity_key,revision,occurred_at,payload) VALUES(c,'messages',r||'-no-reason',1,now(),p-'attribution_reason');
 IF EXISTS(SELECT 1 FROM public.wa_ga4_outbox WHERE source_ref=r) THEN RAISE EXCEPTION 'missing reason queued';END IF;
END $$;
SELECT 'PASS: matching, deduplication, permissions, claim, ambiguous delivery, disabled stream, missing reason' AS validation;
ROLLBACK;