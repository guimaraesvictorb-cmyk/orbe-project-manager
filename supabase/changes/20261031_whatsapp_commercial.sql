BEGIN;
CREATE TABLE public.wa_conversation_events (
 connection_id uuid NOT NULL REFERENCES public.wa_tracking_connections(id),
 event_id text NOT NULL CHECK(length(event_id) BETWEEN 1 AND 200),
 contact_id text NOT NULL CHECK(length(contact_id) BETWEEN 1 AND 240),
 direction text NOT NULL CHECK(direction IN ('incoming','outgoing')),
 author_kind text NOT NULL CHECK(author_kind IN ('external','human','automatic','unknown')),
 author_name text NOT NULL DEFAULT '' CHECK(length(author_name)<=160),
 message_text text NOT NULL DEFAULT '' CHECK(length(message_text)<=16000),
 occurred_at timestamptz NOT NULL, captured_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(connection_id,event_id,direction)
);
CREATE INDEX wa_conversation_contact_time ON public.wa_conversation_events(connection_id,contact_id,occurred_at);
CREATE TABLE public.wa_service_settings (
 connection_id uuid PRIMARY KEY REFERENCES public.wa_tracking_connections(id),
 outbound_started_at timestamptz NOT NULL DEFAULT now(), capture_ready_at timestamptz,
 weekdays integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5] CHECK(cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ ARRAY[0,1,2,3,4,5,6]),
 opens integer NOT NULL DEFAULT 480 CHECK(opens BETWEEN 0 AND 1439),
 closes integer NOT NULL DEFAULT 1080 CHECK(closes BETWEEN 1 AND 1440),
 target_minutes integer NOT NULL DEFAULT 15 CHECK(target_minutes BETWEEN 1 AND 1440),
 CHECK(closes>opens)
);
CREATE TABLE public.wa_commercial_outcomes (
 connection_id uuid NOT NULL REFERENCES public.wa_tracking_connections(id),
 contact_id text NOT NULL CHECK(length(contact_id) BETWEEN 1 AND 240),
 status text NOT NULL CHECK(status IN ('open','contacted','won','lost')),
 evidence text NOT NULL CHECK(length(trim(evidence)) BETWEEN 3 AND 500),
 updated_by uuid NOT NULL REFERENCES public.profiles(id), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(connection_id,contact_id)
);
CREATE TABLE public.wa_commercial_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 connection_id uuid NOT NULL REFERENCES public.wa_tracking_connections(id), contact_id text NOT NULL,
 previous_status text, status text NOT NULL, evidence text NOT NULL,
 actor_id uuid NOT NULL REFERENCES public.profiles(id), changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_conversation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_service_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_commercial_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_commercial_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_conversation_events,public.wa_service_settings,public.wa_commercial_outcomes,public.wa_commercial_audit FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.wa_conversation_events,public.wa_service_settings,public.wa_commercial_outcomes,public.wa_commercial_audit TO service_role;
GRANT SELECT ON public.wa_conversation_events,public.wa_service_settings,public.wa_commercial_outcomes,public.wa_commercial_audit TO authenticated;
GRANT UPDATE(weekdays,opens,closes,target_minutes) ON public.wa_service_settings TO authenticated;
CREATE POLICY wa_conversation_read ON public.wa_conversation_events FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.wa_tracking_connections c WHERE c.id=connection_id));
CREATE POLICY wa_service_read ON public.wa_service_settings FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.wa_tracking_connections c WHERE c.id=connection_id));
CREATE POLICY wa_service_update ON public.wa_service_settings FOR UPDATE TO authenticated USING(EXISTS(SELECT 1 FROM public.wa_tracking_connections c WHERE c.id=connection_id)) WITH CHECK(EXISTS(SELECT 1 FROM public.wa_tracking_connections c WHERE c.id=connection_id));
CREATE POLICY wa_outcomes_read ON public.wa_commercial_outcomes FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.wa_tracking_connections c WHERE c.id=connection_id));
CREATE POLICY wa_commercial_audit_read ON public.wa_commercial_audit FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.wa_tracking_connections c WHERE c.id=connection_id));
-- Caller rights enforce existing connection RLS. Column grants prevent forged actor/time and immutable history.
GRANT INSERT(connection_id,contact_id,status,evidence),UPDATE(status,evidence) ON public.wa_commercial_outcomes TO authenticated;
CREATE POLICY wa_outcome_insert ON public.wa_commercial_outcomes FOR INSERT TO authenticated WITH CHECK(updated_by=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.wa_tracking_records r WHERE r.connection_id=wa_commercial_outcomes.connection_id AND r.entity='leads' AND r.entity_key=contact_id));
CREATE POLICY wa_outcome_update ON public.wa_commercial_outcomes FOR UPDATE TO authenticated USING(EXISTS(SELECT 1 FROM public.wa_tracking_connections c WHERE c.id=connection_id)) WITH CHECK(updated_by=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.wa_tracking_records r WHERE r.connection_id=wa_commercial_outcomes.connection_id AND r.entity='leads' AND r.entity_key=contact_id));
CREATE FUNCTION public.wa_stamp_outcome() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.updated_by:=auth.uid();NEW.updated_at:=now();RETURN NEW;END $$;
CREATE TRIGGER wa_outcome_stamp BEFORE INSERT OR UPDATE ON public.wa_commercial_outcomes FOR EACH ROW EXECUTE FUNCTION public.wa_stamp_outcome();
CREATE FUNCTION public.wa_audit_outcome() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN INSERT INTO public.wa_commercial_audit(connection_id,contact_id,previous_status,status,evidence,actor_id) VALUES(NEW.connection_id,NEW.contact_id,CASE WHEN TG_OP='UPDATE' THEN OLD.status ELSE NULL END,NEW.status,NEW.evidence,NEW.updated_by);RETURN NEW;END $$;
REVOKE ALL ON FUNCTION public.wa_audit_outcome(),public.wa_stamp_outcome() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER wa_outcome_audit AFTER INSERT OR UPDATE ON public.wa_commercial_outcomes FOR EACH ROW EXECUTE FUNCTION public.wa_audit_outcome();
CREATE FUNCTION public.wa_capture_incoming() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.entity='messages' AND coalesce(NEW.payload->>'contact_id','')<>'' THEN
  INSERT INTO public.wa_conversation_events(connection_id,event_id,contact_id,direction,author_kind,message_text,occurred_at)
  VALUES(NEW.connection_id,NEW.entity_key,NEW.payload->>'contact_id','incoming','external',left(coalesce(NEW.payload->>'text',''),16000),NEW.occurred_at) ON CONFLICT DO NOTHING;
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.wa_capture_incoming() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER wa_capture_incoming AFTER INSERT ON public.wa_tracking_records FOR EACH ROW EXECUTE FUNCTION public.wa_capture_incoming();
INSERT INTO public.wa_conversation_events(connection_id,event_id,contact_id,direction,author_kind,message_text,occurred_at)
 SELECT connection_id,entity_key,payload->>'contact_id','incoming','external',left(coalesce(payload->>'text',''),16000),occurred_at FROM public.wa_tracking_records WHERE entity='messages' AND coalesce(payload->>'contact_id','')<>'' ON CONFLICT DO NOTHING;
INSERT INTO public.wa_service_settings(connection_id) SELECT id FROM public.wa_tracking_connections ON CONFLICT DO NOTHING;
CREATE FUNCTION public.wa_conversation_ingest(p_connection uuid,p_messages jsonb) RETURNS integer LANGUAGE plpgsql SET search_path='' AS $$
DECLARE cfg record;m jsonb;cid text;stamp timestamptz;n integer:=0;a integer;
BEGIN
 SELECT c.*,k.account_id,k.created_at AS kommo_since,q.verified_at INTO cfg FROM public.wa_tracking_connections c LEFT JOIN public.wa_kommo_credentials k ON k.connection_id=c.id AND k.enabled LEFT JOIN public.wa_qr_sessions q ON q.connection_id=c.id WHERE c.id=p_connection AND c.enabled FOR UPDATE OF c;
 IF NOT FOUND THEN RAISE EXCEPTION 'connection_unavailable';END IF;
 IF jsonb_typeof(p_messages)<>'array' OR jsonb_array_length(p_messages)>30 THEN RAISE EXCEPTION 'invalid_batch';END IF;
 INSERT INTO public.wa_service_settings(connection_id) VALUES(p_connection) ON CONFLICT DO NOTHING;
 FOR m IN SELECT value FROM jsonb_array_elements(p_messages) LOOP
  IF m->>'direction'<>'outgoing' THEN CONTINUE;END IF;
  stamp:=(m->>'created_at')::timestamptz;
  IF stamp>now()+interval '2 minutes' OR stamp<(SELECT outbound_started_at FROM public.wa_service_settings WHERE connection_id=p_connection) THEN CONTINUE;END IF;
  IF cfg.provider='kommo' AND cfg.account_id IS NOT NULL THEN
   IF m->>'contact_id' !~ '^[1-9][0-9]{0,18}$' OR stamp<cfg.kommo_since THEN CONTINUE;END IF;
   cid:='kommo:'||cfg.account_id||':'||(m->>'contact_id');
  ELSIF cfg.provider='evolution' AND cfg.verified_at IS NOT NULL THEN
   IF m->>'phone' !~ '^[1-9][0-9]{9,14}$' OR stamp<cfg.verified_at OR (cfg.capture_mode='pilot' AND NOT (m->>'phone'=ANY(cfg.allowed_senders))) THEN CONTINUE;END IF;
   cid:='evolution:'||p_connection||':'||(m->>'phone');
  ELSE RAISE EXCEPTION 'connection_unverified';END IF;
  INSERT INTO public.wa_conversation_events(connection_id,event_id,contact_id,direction,author_kind,author_name,message_text,occurred_at)
   VALUES(p_connection,m->>'id',cid,'outgoing',CASE WHEN m->>'author_kind' IN ('human','automatic') THEN m->>'author_kind' ELSE 'unknown' END,left(coalesce(m->>'author_name',''),160),left(coalesce(m->>'text',''),16000),stamp) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS a=ROW_COUNT;n:=n+a;
 END LOOP;RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.wa_conversation_ingest(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_conversation_ingest(uuid,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
