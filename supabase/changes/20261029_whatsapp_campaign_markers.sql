-- Reusable ad starter-message markers. No synthetic click IDs or click records.
BEGIN;
CREATE TABLE public.wa_campaign_markers (
 connection_id uuid NOT NULL REFERENCES public.wa_tracking_connections(id),
 reference text NOT NULL CHECK(reference ~ '^[A-F0-9]{32}$'),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160),
 utm_source text NOT NULL CHECK(length(utm_source) BETWEEN 1 AND 256),
 utm_medium text NOT NULL DEFAULT '' CHECK(length(utm_medium)<=256),
 utm_campaign text NOT NULL DEFAULT '' CHECK(length(utm_campaign)<=256),
 utm_content text NOT NULL DEFAULT '' CHECK(length(utm_content)<=256),
 utm_term text NOT NULL DEFAULT '' CHECK(length(utm_term)<=256),
 enabled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(connection_id,reference)
);
ALTER TABLE public.wa_campaign_markers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_campaign_markers FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.wa_campaign_markers TO service_role;
CREATE OR REPLACE FUNCTION public.wa_kommo_receive(p_hash text,p_account text,p_origin text,p_messages jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE cfg record; msg jsonb; click_row record; source jsonb; data jsonb; cid text; reason text; affected integer; total integer:=0; field text; contact_ids text[]:='{}';
BEGIN
 SELECT k.*,c.instance INTO cfg FROM public.wa_kommo_credentials k JOIN public.wa_tracking_connections c ON c.id=k.connection_id
 WHERE k.webhook_hash=p_hash AND k.account_id=p_account AND k.account_origin=p_origin AND k.enabled AND c.enabled FOR UPDATE OF c;
 IF NOT FOUND THEN RAISE EXCEPTION 'unauthorized';END IF;
 IF jsonb_typeof(p_messages)<>'array' OR jsonb_array_length(p_messages)>30 THEN RAISE EXCEPTION 'invalid_batch';END IF;
 FOR msg IN SELECT value FROM jsonb_array_elements(p_messages) LOOP
  IF (msg->>'created_at')::timestamptz<cfg.created_at-interval '5 minutes' THEN CONTINUE;END IF;
  IF EXISTS(SELECT 1 FROM public.wa_tracking_records WHERE connection_id=cfg.connection_id AND entity='messages' AND entity_key=msg->>'id') THEN CONTINUE;END IF;
  cid:='kommo:'||cfg.account_id||':'||(msg->>'contact_id');source:='{}';reason:='no_reference';
  IF msg->>'reference' ~ '^[A-F0-9]{32}$' THEN
   SELECT * INTO click_row FROM public.wa_tracking_records WHERE connection_id=cfg.connection_id AND entity='clicks' AND entity_key=msg->>'reference'
    AND occurred_at<=(msg->>'created_at')::timestamptz AND occurred_at>=(msg->>'created_at')::timestamptz-interval '30 days'
    AND coalesce(payload->>'linked_sender_id','') IN ('',cid) FOR UPDATE;
   IF FOUND THEN
    source:=click_row.payload;reason:='reference_match';
    UPDATE public.wa_tracking_records SET payload=payload||jsonb_build_object('linked_sender_id',cid),revision=revision+1,synced_at=now()
     WHERE connection_id=cfg.connection_id AND entity='clicks' AND entity_key=msg->>'reference';
   END IF;
  END IF;
  -- A reusable asset marker identifies the starter message, never a unique click.
  IF source='{}' AND msg->>'reference' ~ '^[A-F0-9]{32}$' THEN
   SELECT jsonb_build_object('utm_source',a.utm_source,'utm_medium',a.utm_medium,
    'utm_campaign',a.utm_campaign,'utm_content',a.utm_content,'utm_term',a.utm_term)
   INTO source FROM public.wa_campaign_markers a
   WHERE a.connection_id=cfg.connection_id AND a.reference=msg->>'reference' AND a.enabled
    AND a.created_at<=(msg->>'created_at')::timestamptz;
   IF FOUND THEN reason:='campaign_marker';ELSE source:='{}';END IF;
  END IF;
  data:=jsonb_build_object('contact_id',cid,'kommo_contact_id',msg->>'contact_id','kommo_lead_id',msg->>'lead_id','chat_id',msg->>'chat_id',
   'talk_id',msg->>'talk_id','message_id',msg->>'id','name','Contato Kommo','phone','','phone_status','pending','identity_checked',false,
   'text',msg->>'text','received_at',msg->>'created_at','type',msg->>'type','channel_origin',msg->>'origin','instance',cfg.instance,
   'source_ref',CASE WHEN source='{}' THEN '' ELSE msg->>'reference' END,
   'source_status',CASE WHEN source='{}' THEN 'Não identificada' ELSE 'Identificada' END,
   'attribution_reason',reason);
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

NOTIFY pgrst,'reload schema';
COMMIT;
