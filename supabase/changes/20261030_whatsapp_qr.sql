-- QR control plane: server-only, independent of the ORBE pilot and official CRM.
BEGIN;
CREATE TABLE public.wa_qr_sessions (
 connection_id uuid PRIMARY KEY REFERENCES public.wa_tracking_connections(id),
 request_id uuid, requested_at timestamptz, expires_at timestamptz,
 qr_ciphertext text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'idle' CHECK(status IN ('idle','requested','connecting','qr','open','close','wrong_number','error')),
 worker_seen_at timestamptz, verified_at timestamptz,
 error_code text NOT NULL DEFAULT ''
);
ALTER TABLE public.wa_qr_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_qr_sessions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.wa_qr_sessions TO service_role;
CREATE UNIQUE INDEX wa_one_qr_client ON public.wa_tracking_connections(client_id) WHERE provider='evolution' AND client_id IS NOT NULL;
CREATE FUNCTION public.wa_qr_receive(p_connection uuid,p_messages jsonb) RETURNS integer
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE cfg record; msg jsonb; src jsonb; data jsonb; cid text; n integer:=0;
BEGIN
 SELECT c.*,q.verified_at INTO cfg FROM public.wa_tracking_connections c JOIN public.wa_qr_sessions q ON q.connection_id=c.id
 JOIN public.wa_tracking_setups s ON s.client_id=c.client_id
 WHERE c.id=p_connection AND c.provider='evolution' AND c.enabled AND q.verified_at IS NOT NULL
 AND s.traffic_active AND s.connection_method='qr' AND s.destination=c.destination FOR UPDATE OF c;
 IF NOT FOUND THEN RAISE EXCEPTION 'connection_not_verified';END IF;
 IF jsonb_typeof(p_messages)<>'array' OR jsonb_array_length(p_messages)>30 THEN RAISE EXCEPTION 'invalid_batch';END IF;
 FOR msg IN SELECT value FROM jsonb_array_elements(p_messages) LOOP
  IF (msg->>'created_at')::timestamptz<cfg.verified_at OR (msg->>'created_at')::timestamptz>now()+interval '2 minutes' THEN CONTINUE;END IF;
  IF cfg.capture_mode='pilot' AND NOT (msg->>'phone'=ANY(cfg.allowed_senders)) THEN CONTINUE;END IF;
  IF EXISTS(SELECT 1 FROM public.wa_tracking_records WHERE connection_id=p_connection AND entity='messages' AND entity_key=msg->>'id') THEN CONTINUE;END IF;
  cid:='evolution:'||p_connection||':'||(msg->>'phone');src:='{}';
  SELECT payload INTO src FROM public.wa_tracking_records WHERE connection_id=p_connection AND entity='clicks'
   AND entity_key=msg->>'reference' AND occurred_at<=(msg->>'created_at')::timestamptz
   AND occurred_at>=(msg->>'created_at')::timestamptz-interval '30 days'
   AND coalesce(payload->>'linked_sender_id','') IN ('',cid) FOR UPDATE;
  src:=coalesce(src,'{}');
  IF src<>'{}' THEN
   UPDATE public.wa_tracking_records SET payload=payload||jsonb_build_object('linked_sender_id',cid),revision=revision+1
    WHERE connection_id=p_connection AND entity='clicks' AND entity_key=msg->>'reference';
  END IF;
  data:=jsonb_build_object('contact_id',cid,'message_id',msg->>'id','phone',msg->>'phone','name',msg->>'name',
   'instance',cfg.instance,'text',msg->>'text','type',msg->>'type','received_at',msg->>'created_at','identity_checked',true,
   'source_ref',CASE WHEN src='{}' THEN '' ELSE msg->>'reference' END,
   'source_status',CASE WHEN src='{}' THEN 'Não identificada' ELSE 'Identificada' END,
   'attribution_reason',CASE WHEN src='{}' THEN 'no_reference' ELSE 'reference_match' END)
   ||jsonb_build_object('utm_source',coalesce(src->>'utm_source',''),'utm_medium',coalesce(src->>'utm_medium',''),
    'utm_campaign',coalesce(src->>'utm_campaign',''),'utm_content',coalesce(src->>'utm_content',''),
    'utm_term',coalesce(src->>'utm_term',''),'gclid',coalesce(src->>'gclid',''),'fbclid',coalesce(src->>'fbclid',''));
  INSERT INTO public.wa_tracking_records(connection_id,entity,entity_key,revision,occurred_at,payload)
   VALUES(p_connection,'messages',msg->>'id',1,(msg->>'created_at')::timestamptz,data);
  PERFORM public.wa_kommo_rebuild_contact(p_connection,cid);
  n:=n+1;
 END LOOP;
 IF n>0 THEN
  UPDATE public.wa_tracking_connections SET last_received_at=now() WHERE id=p_connection;
  UPDATE public.wa_tracking_setups SET activation_status='receiving',last_webhook_at=now() WHERE connection_id=p_connection;
 END IF;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.wa_qr_receive(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_qr_receive(uuid,jsonb) TO service_role;
COMMIT;
