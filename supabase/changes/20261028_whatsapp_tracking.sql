-- Additive rollout: existing CRM, financial policies and Sheets are untouched.
BEGIN;

CREATE TABLE public.wa_tracking_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES private.clients(id),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  provider text NOT NULL CHECK (provider IN ('evolution', 'kommo', 'meta_cloud')),
  destination text NOT NULL CHECK (destination ~ '^[1-9][0-9]{9,14}$'),
  instance text NOT NULL,
  redirect_url text NOT NULL CHECK (redirect_url ~ '^https://'),
  capture_mode text NOT NULL DEFAULT 'pilot' CHECK (capture_mode IN ('pilot', 'client')),
  allowed_senders text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT false,
  connection_state text NOT NULL DEFAULT 'unknown' CHECK (connection_state IN ('open','close','connecting','unknown')),
  last_sync_at timestamptz,
  last_received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.wa_tracking_members (
  connection_id uuid REFERENCES public.wa_tracking_connections(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (connection_id,user_id)
);
CREATE TABLE public.wa_tracking_ingest_keys (
  connection_id uuid PRIMARY KEY REFERENCES public.wa_tracking_connections(id),
  token_hash text UNIQUE NOT NULL CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE public.wa_tracking_records (
  connection_id uuid NOT NULL REFERENCES public.wa_tracking_connections(id),
  entity text NOT NULL CHECK (entity IN ('leads','messages','clicks')),
  entity_key text NOT NULL CHECK (length(entity_key) BETWEEN 1 AND 160),
  revision bigint NOT NULL CHECK (revision > 0),
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (connection_id,entity,entity_key)
);
CREATE INDEX wa_tracking_records_period ON public.wa_tracking_records(connection_id,entity,occurred_at DESC);
CREATE INDEX wa_tracking_records_source ON public.wa_tracking_records(connection_id,(payload->>'utm_source'));
CREATE TABLE public.wa_tracking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.wa_tracking_connections(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 100),
  greeting text NOT NULL CHECK (length(greeting) BETWEEN 1 AND 500),
  utm_source text NOT NULL CHECK (length(utm_source) BETWEEN 1 AND 256),
  utm_medium text NOT NULL CHECK (length(utm_medium) BETWEEN 1 AND 256),
  utm_campaign text NOT NULL DEFAULT '' CHECK (length(utm_campaign) <= 256),
  utm_content text NOT NULL DEFAULT '' CHECK (length(utm_content) <= 256),
  utm_term text NOT NULL DEFAULT '' CHECK (length(utm_term) <= 256),
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_tracking_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_tracking_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_tracking_ingest_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_tracking_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_tracking_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_tracking_connections, public.wa_tracking_members,
  public.wa_tracking_ingest_keys, public.wa_tracking_records, public.wa_tracking_links FROM anon, authenticated;
GRANT SELECT ON public.wa_tracking_connections, public.wa_tracking_members,
  public.wa_tracking_records, public.wa_tracking_links TO authenticated;
GRANT INSERT ON public.wa_tracking_links TO authenticated;
GRANT UPDATE (archived) ON public.wa_tracking_links TO authenticated;
GRANT ALL ON public.wa_tracking_connections, public.wa_tracking_members,
  public.wa_tracking_ingest_keys, public.wa_tracking_records, public.wa_tracking_links TO service_role;

CREATE POLICY wa_members_self ON public.wa_tracking_members FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY wa_connections_authorized ON public.wa_tracking_connections FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.is_active)
    AND (owner_user_id = (SELECT auth.uid()) OR EXISTS (
      SELECT 1 FROM public.wa_tracking_members m WHERE m.connection_id = id AND m.user_id = (SELECT auth.uid())
    ))
  );
CREATE POLICY wa_records_authorized ON public.wa_tracking_records FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.wa_tracking_connections c WHERE c.id = connection_id));
CREATE POLICY wa_links_read ON public.wa_tracking_links FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.wa_tracking_connections c WHERE c.id = connection_id));
CREATE POLICY wa_links_create ON public.wa_tracking_links FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.wa_tracking_connections c WHERE c.id = connection_id AND c.enabled
  ));
CREATE POLICY wa_links_archive ON public.wa_tracking_links FOR UPDATE TO authenticated
  USING (created_by = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.wa_tracking_connections c WHERE c.id = connection_id
  )) WITH CHECK (created_by = (SELECT auth.uid()));

-- Service-only transaction. Retried or older revisions cannot duplicate/regress records.
CREATE FUNCTION public.wa_tracking_ingest(p_connection_id uuid, p_events jsonb, p_state text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE item jsonb; affected integer; total integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.wa_tracking_connections WHERE id=p_connection_id AND enabled) THEN
    RAISE EXCEPTION 'connection_disabled';
  END IF;
  IF jsonb_typeof(p_events) <> 'array' OR jsonb_array_length(p_events) > 100 THEN
    RAISE EXCEPTION 'invalid_batch';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_events) LOOP
    INSERT INTO public.wa_tracking_records(connection_id,entity,entity_key,revision,occurred_at,payload)
    VALUES (p_connection_id,item->>'entity',item->>'key',(item->>'revision')::bigint,
      (item->>'occurred_at')::timestamptz,item->'record')
    ON CONFLICT (connection_id,entity,entity_key) DO UPDATE SET
      revision=excluded.revision, occurred_at=excluded.occurred_at,
      payload=excluded.payload, synced_at=now()
    WHERE excluded.revision > wa_tracking_records.revision;
    GET DIAGNOSTICS affected = ROW_COUNT;
    total := total + affected;
  END LOOP;
  UPDATE public.wa_tracking_connections SET last_sync_at=now(), connection_state=p_state,
    last_received_at=(SELECT max(occurred_at) FROM public.wa_tracking_records
      WHERE connection_id=p_connection_id AND entity='messages')
    WHERE id=p_connection_id;
  RETURN jsonb_build_object('accepted',jsonb_array_length(p_events),'changed',total);
END $$;
REVOKE ALL ON FUNCTION public.wa_tracking_ingest(uuid,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_tracking_ingest(uuid,jsonb,text) TO service_role;

-- Invoker rights: aggregate only rows the signed-in user can read through RLS.
CREATE FUNCTION public.wa_tracking_summary(p_connection_id uuid, p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL, p_source text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  WITH filtered AS (
    SELECT entity,payload FROM public.wa_tracking_records
    WHERE connection_id=p_connection_id AND (p_start IS NULL OR occurred_at>=p_start)
      AND (p_end IS NULL OR occurred_at<p_end)
      AND (p_source IS NULL OR payload->>'utm_source'=p_source)
  ), campaigns AS (
    SELECT coalesce(nullif(payload->>'utm_source',''),'Sem origem') AS source,
      coalesce(nullif(payload->>'utm_campaign',''),'Sem campanha') AS campaign,
      count(*) AS messages, count(DISTINCT payload->>'contact_id') AS contacts
    FROM filtered WHERE entity='messages' GROUP BY 1,2
  ) SELECT jsonb_build_object(
    'clicks',(SELECT count(*) FROM filtered WHERE entity='clicks'),
    'contacts',(SELECT count(DISTINCT payload->>'contact_id') FROM filtered WHERE entity='messages'),
    'messages',(SELECT count(*) FROM filtered WHERE entity='messages'),
    'identified',(SELECT count(*) FROM filtered WHERE entity='messages' AND payload->>'source_status'='Identificada'),
    'unidentified',(SELECT count(*) FROM filtered WHERE entity='messages' AND payload->>'source_status'<>'Identificada'),
    'campaigns',coalesce((SELECT jsonb_agg(c ORDER BY c.messages DESC) FROM campaigns c),'[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.wa_tracking_summary(uuid,timestamptz,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.wa_tracking_summary(uuid,timestamptz,timestamptz,text) TO authenticated,service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
