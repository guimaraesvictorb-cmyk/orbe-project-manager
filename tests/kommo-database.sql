-- Run in the ORBE project. Every synthetic record is rolled back.
BEGIN;
DO $$
DECLARE client uuid; owner_id uuid; conn uuid; first_result jsonb; result jsonb; payload jsonb; messages jsonb; caught boolean:=false;
BEGIN
 SELECT client_id,owner_user_id INTO STRICT client,owner_id FROM public.wa_tracking_setups WHERE account_url LIKE 'https://fabriciopimentel.kommo.com%';
 IF has_table_privilege('authenticated','public.wa_kommo_credentials','SELECT') OR has_table_privilege('anon','public.wa_kommo_credentials','SELECT') THEN RAISE EXCEPTION 'credential exposure';END IF;
 IF has_function_privilege('authenticated','public.wa_kommo_receive(text,text,text,jsonb)','EXECUTE') OR has_function_privilege('anon','public.wa_kommo_prepare(uuid,uuid,text,text,text,text,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'function exposure';END IF;
 IF has_column_privilege('authenticated','public.wa_tracking_setups','activation_status','INSERT') THEN RAISE EXCEPTION 'client can forge activation';END IF;
 conn:=public.wa_kommo_prepare(client,owner_id,'999999999','https://orbe-validation.kommo.com','Teste técnico','5527988417089','encrypted-fixture','encrypted-fixture',repeat('a',64));
 PERFORM public.wa_kommo_enable(conn,'1234');
 IF (SELECT activation_status FROM public.wa_tracking_setups WHERE client_id=client)<>'waiting_message' THEN RAISE EXCEPTION 'premature success';END IF;
 INSERT INTO public.wa_tracking_records(connection_id,entity,entity_key,revision,occurred_at,payload) VALUES(conn,'clicks',repeat('A',32),1,now()-interval '1 minute',jsonb_build_object('reference',repeat('A',32),'linked_sender_id','','utm_source','google','utm_medium','cpc','utm_campaign','teste','gclid','TEST-GCLID'));
 messages:=jsonb_build_array(jsonb_build_object('id','validation-1','contact_id','123','lead_id','456','chat_id','chat-123','talk_id','456','text','Olá!','created_at',to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),'type','text','origin','whatsapp','reference',repeat('A',32)));
 first_result:=public.wa_kommo_receive(repeat('a',64),'999999999','https://orbe-validation.kommo.com',messages);
 IF first_result->>'accepted'<>'1' THEN RAISE EXCEPTION 'not received';END IF;
 result:=public.wa_kommo_receive(repeat('a',64),'999999999','https://orbe-validation.kommo.com',messages);
 IF result->>'accepted'<>'0' THEN RAISE EXCEPTION 'duplicate message';END IF;
 SELECT r.payload INTO payload FROM public.wa_tracking_records r WHERE connection_id=conn AND entity='messages';
 IF payload->>'utm_source'<>'google' OR payload->>'gclid'<>'TEST-GCLID' OR payload->>'source_status'<>'Identificada' THEN RAISE EXCEPTION 'lost attribution';END IF;
 SELECT r.payload INTO payload FROM public.wa_tracking_records r WHERE connection_id=conn AND entity='leads';
 IF payload->>'message_count'<>'1' THEN RAISE EXCEPTION 'duplicate lead count';END IF;
 PERFORM public.wa_kommo_identity(conn,'123','Contato de teste','5511999998888','crm_contact');
 SELECT r.payload INTO payload FROM public.wa_tracking_records r WHERE connection_id=conn AND entity='messages';
 IF payload->>'phone'<>'5511999998888' OR payload->>'identity_checked'<>'true' THEN RAISE EXCEPTION 'identity not updated';END IF;
 messages:=jsonb_set(messages,'{0,id}','"validation-2"');messages:=jsonb_set(messages,'{0,contact_id}','"999"');
 PERFORM public.wa_kommo_receive(repeat('a',64),'999999999','https://orbe-validation.kommo.com',messages);
 SELECT r.payload INTO payload FROM public.wa_tracking_records r WHERE connection_id=conn AND entity='messages' AND entity_key='validation-2';
 IF payload->>'source_status'<>'Não identificada' OR payload->>'utm_source'<>'' THEN RAISE EXCEPTION 'cross-contact attribution';END IF;
 BEGIN PERFORM public.wa_kommo_receive(repeat('a',64),'888888888','https://orbe-validation.kommo.com',messages);EXCEPTION WHEN OTHERS THEN caught:=true;END;
 IF NOT caught THEN RAISE EXCEPTION 'cross-account acceptance';END IF;
END $$;
ROLLBACK;
SELECT 'PASS: credentials restricted; activation awaits event; reference matched; replay deduplicated; contact isolated; wrong account rejected; all test data rolled back' AS result;
