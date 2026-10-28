BEGIN;
ALTER TABLE public.wa_tracking_setups ADD COLUMN connection_id uuid REFERENCES public.wa_tracking_connections(id),
 ADD COLUMN activation_status text NOT NULL DEFAULT 'not_connected' CHECK(activation_status IN ('not_connected','authorizing','waiting_message','receiving','error')),
 ADD COLUMN activation_error text NOT NULL DEFAULT '', ADD COLUMN account_name text NOT NULL DEFAULT '',
 ADD COLUMN last_verified_at timestamptz, ADD COLUMN last_webhook_at timestamptz;
REVOKE INSERT ON public.wa_tracking_setups FROM authenticated;
GRANT INSERT(client_id,owner_user_id,connection_method,system,destination,account_url,notes,activation_requested,traffic_active,updated_at) ON public.wa_tracking_setups TO authenticated;
CREATE TABLE public.wa_kommo_credentials (
 connection_id uuid PRIMARY KEY REFERENCES public.wa_tracking_connections(id),
 client_id uuid NOT NULL UNIQUE REFERENCES private.clients(id),
 account_id text NOT NULL UNIQUE CHECK(account_id ~ '^[1-9][0-9]{0,18}$'),
 account_origin text NOT NULL UNIQUE CHECK(account_origin ~ '^https://[a-z0-9][a-z0-9-]*\.kommo\.com$'),
 token_ciphertext text NOT NULL, webhook_ciphertext text NOT NULL,
 webhook_hash text NOT NULL UNIQUE CHECK(webhook_hash ~ '^[a-f0-9]{64}$'),
 webhook_id text NOT NULL DEFAULT '', enabled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_kommo_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_kommo_credentials FROM anon,authenticated;
GRANT ALL ON public.wa_kommo_credentials TO service_role;
CREATE INDEX wa_records_contact ON public.wa_tracking_records(connection_id,entity,(payload->>'contact_id'));

CREATE FUNCTION public.wa_kommo_prepare(p_client_id uuid,p_owner uuid,p_account_id text,p_origin text,p_name text,p_destination text,
 p_token text,p_webhook text,p_hash text) RETURNS uuid LANGUAGE plpgsql SET search_path='' AS $$
DECLARE conn uuid; dest text;
BEGIN
 PERFORM 1 FROM public.wa_tracking_setups WHERE client_id=p_client_id AND owner_user_id=p_owner AND traffic_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden';END IF;
 SELECT connection_id INTO conn FROM public.wa_kommo_credentials WHERE client_id=p_client_id;
 IF conn IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM public.wa_kommo_credentials WHERE connection_id=conn AND account_id=p_account_id AND account_origin=p_origin) THEN RAISE EXCEPTION 'binding_changed';END IF;
  SELECT destination INTO dest FROM public.wa_tracking_connections WHERE id=conn;
  IF dest<>p_destination THEN RAISE EXCEPTION 'destination_changed';END IF;
  UPDATE public.wa_kommo_credentials SET token_ciphertext=p_token WHERE connection_id=conn;
 ELSE
  conn:=gen_random_uuid();
  INSERT INTO public.wa_tracking_connections(id,client_id,owner_user_id,name,provider,destination,instance,redirect_url,capture_mode,enabled,connection_state)
   VALUES(conn,p_client_id,p_owner,left(p_name,100),'kommo',p_destination,'kommo:'||p_account_id,
   'https://studio.agenciaorbe.co/api/wa-redirect?connection='||conn,'client',false,'connecting');
  INSERT INTO public.wa_kommo_credentials(connection_id,client_id,account_id,account_origin,token_ciphertext,webhook_ciphertext,webhook_hash)
   VALUES(conn,p_client_id,p_account_id,p_origin,p_token,p_webhook,p_hash);
 END IF;
 UPDATE public.wa_tracking_setups SET connection_id=conn,connection_method='kommo',system='kommo',destination=p_destination,
  account_url=p_origin,account_name=left(p_name,100),activation_requested=true,activation_status='authorizing',activation_error='',updated_at=now() WHERE client_id=p_client_id;
 RETURN conn;
END $$;
REVOKE ALL ON FUNCTION public.wa_kommo_prepare(uuid,uuid,text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_kommo_prepare(uuid,uuid,text,text,text,text,text,text,text) TO service_role;

CREATE FUNCTION public.wa_kommo_enable(p_connection uuid,p_webhook_id text) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 UPDATE public.wa_kommo_credentials SET enabled=true,webhook_id=p_webhook_id WHERE connection_id=p_connection;
 IF NOT FOUND THEN RAISE EXCEPTION 'connection_missing';END IF;
 UPDATE public.wa_tracking_connections SET enabled=true,connection_state='connecting',last_sync_at=now() WHERE id=p_connection;
 UPDATE public.wa_tracking_setups SET activation_status=CASE WHEN EXISTS(SELECT 1 FROM public.wa_tracking_records WHERE connection_id=p_connection AND entity='messages') THEN 'receiving' ELSE 'waiting_message' END,
  activation_error='',last_verified_at=now() WHERE connection_id=p_connection;
END $$;
REVOKE ALL ON FUNCTION public.wa_kommo_enable(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_kommo_enable(uuid,text) TO service_role;

-- First origin belongs to the contact; each message keeps its own evidence.
CREATE FUNCTION public.wa_kommo_rebuild_contact(p_connection uuid,p_contact text) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
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
  'utm_source',coalesce(source->>'utm_source',''),'utm_medium',coalesce(source->>'utm_medium',''),'utm_campaign',coalesce(source->>'utm_campaign',''),
  'utm_content',coalesce(source->>'utm_content',''),'utm_term',coalesce(source->>'utm_term',''),'gclid',coalesce(source->>'gclid',''),'fbclid',coalesce(source->>'fbclid','')))
 ON CONFLICT(connection_id,entity,entity_key) DO UPDATE SET payload=excluded.payload,occurred_at=excluded.occurred_at,
 revision=public.wa_tracking_records.revision+1,synced_at=now();
END $$;
REVOKE ALL ON FUNCTION public.wa_kommo_rebuild_contact(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_kommo_rebuild_contact(uuid,text) TO service_role;

CREATE FUNCTION public.wa_kommo_receive(p_hash text,p_account text,p_origin text,p_messages jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE cfg record; msg jsonb; click_row record; source jsonb; data jsonb; cid text; affected integer; total integer:=0; field text; contact_ids text[]:='{}';
BEGIN
 SELECT k.*,c.instance INTO cfg FROM public.wa_kommo_credentials k JOIN public.wa_tracking_connections c ON c.id=k.connection_id
 WHERE k.webhook_hash=p_hash AND k.account_id=p_account AND k.account_origin=p_origin AND k.enabled AND c.enabled FOR UPDATE OF c;
 IF NOT FOUND THEN RAISE EXCEPTION 'unauthorized';END IF;
 IF jsonb_typeof(p_messages)<>'array' OR jsonb_array_length(p_messages)>30 THEN RAISE EXCEPTION 'invalid_batch';END IF;
 FOR msg IN SELECT value FROM jsonb_array_elements(p_messages) LOOP
  IF (msg->>'created_at')::timestamptz<cfg.created_at-interval '5 minutes' THEN CONTINUE;END IF;
  IF EXISTS(SELECT 1 FROM public.wa_tracking_records WHERE connection_id=cfg.connection_id AND entity='messages' AND entity_key=msg->>'id') THEN CONTINUE;END IF;
  cid:='kommo:'||cfg.account_id||':'||(msg->>'contact_id');source:='{}';
  IF msg->>'reference' ~ '^[A-F0-9]{32}$' THEN
   SELECT * INTO click_row FROM public.wa_tracking_records WHERE connection_id=cfg.connection_id AND entity='clicks' AND entity_key=msg->>'reference'
    AND occurred_at<=(msg->>'created_at')::timestamptz AND occurred_at>=(msg->>'created_at')::timestamptz-interval '30 days'
    AND coalesce(payload->>'linked_sender_id','') IN ('',cid) FOR UPDATE;
   IF FOUND THEN
    source:=click_row.payload;
    UPDATE public.wa_tracking_records SET payload=payload||jsonb_build_object('linked_sender_id',cid),revision=revision+1,synced_at=now()
     WHERE connection_id=cfg.connection_id AND entity='clicks' AND entity_key=msg->>'reference';
   END IF;
  END IF;
  data:=jsonb_build_object('contact_id',cid,'kommo_contact_id',msg->>'contact_id','kommo_lead_id',msg->>'lead_id','chat_id',msg->>'chat_id',
   'talk_id',msg->>'talk_id','message_id',msg->>'id','name','Contato Kommo','phone','','phone_status','pending','identity_checked',false,
   'text',msg->>'text','received_at',msg->>'created_at','type',msg->>'type','channel_origin',msg->>'origin','instance',cfg.instance,
   'source_ref',CASE WHEN source='{}' THEN '' ELSE msg->>'reference' END,
   'source_status',CASE WHEN source='{}' THEN 'Não identificada' ELSE 'Identificada' END,
   'attribution_reason',CASE WHEN source='{}' THEN 'no_reference' ELSE 'reference_match' END);
  FOREACH field IN ARRAY ARRAY['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid'] LOOP
   data:=data||jsonb_build_object(field,coalesce(source->>field,''));
  END LOOP;
  INSERT INTO public.wa_tracking_records(connection_id,entity,entity_key,revision,occurred_at,payload)
   VALUES(cfg.connection_id,'messages',msg->>'id',1,(msg->>'created_at')::timestamptz,data) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS affected=ROW_COUNT;total:=total+affected;
  IF affected>0 THEN PERFORM public.wa_kommo_rebuild_contact(cfg.connection_id,cid);END IF;
  IF NOT (msg->>'contact_id'=ANY(contact_ids)) THEN contact_ids:=array_append(contact_ids,msg->>'contact_id');END IF;
 END LOOP;
 UPDATE public.wa_tracking_connections SET last_sync_at=now(),connection_state=CASE WHEN jsonb_array_length(p_messages)>0 THEN 'open' ELSE connection_state END,
  last_received_at=(SELECT max(occurred_at) FROM public.wa_tracking_records WHERE connection_id=cfg.connection_id AND entity='messages') WHERE id=cfg.connection_id;
 UPDATE public.wa_tracking_setups SET last_webhook_at=now(),activation_status=CASE WHEN total>0 THEN 'receiving' ELSE activation_status END,
  activation_error='' WHERE connection_id=cfg.connection_id;
 RETURN jsonb_build_object('accepted',total,'connection_id',cfg.connection_id,'contact_ids',to_jsonb(contact_ids));
END $$;
REVOKE ALL ON FUNCTION public.wa_kommo_receive(text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_kommo_receive(text,text,text,jsonb) TO service_role;

CREATE FUNCTION public.wa_kommo_identity(p_connection uuid,p_contact text,p_name text,p_phone text,p_phone_status text) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE cid text; aid text;
BEGIN
 SELECT account_id INTO aid FROM public.wa_kommo_credentials WHERE connection_id=p_connection AND enabled;
 IF aid IS NULL THEN RETURN;END IF;
 PERFORM 1 FROM public.wa_tracking_connections WHERE id=p_connection FOR UPDATE;
 cid:='kommo:'||aid||':'||p_contact;
 UPDATE public.wa_tracking_records SET payload=payload||jsonb_build_object('name',left(p_name,160),'phone',p_phone,'phone_status',p_phone_status,'identity_checked',true),revision=revision+1,synced_at=now()
 WHERE connection_id=p_connection AND entity='messages' AND payload->>'contact_id'=cid;
 PERFORM public.wa_kommo_rebuild_contact(p_connection,cid);
END $$;
REVOKE ALL ON FUNCTION public.wa_kommo_identity(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_kommo_identity(uuid,text,text,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
