-- One agency manager connection, reusing the Google authorization already
-- encrypted in the Studio. Only server routes may access this registry.
CREATE TABLE IF NOT EXISTS public.orbe_google_mcc (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 manager_id text NOT NULL CHECK(manager_id ~ '^[1-9][0-9]{9}$'),
 credential_client_id uuid REFERENCES private.clients(id) ON DELETE SET NULL,
 enabled boolean NOT NULL DEFAULT true,
 manager_name text,
 checked_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid REFERENCES public.profiles(id)
);
CREATE TABLE IF NOT EXISTS public.orbe_google_mcc_accounts (
 account_id text PRIMARY KEY CHECK(account_id ~ '^[1-9][0-9]{9}$'),
 account_name text NOT NULL,
 is_manager boolean NOT NULL DEFAULT false,
 currency text,
 timezone text,
 provider_status text,
 present boolean NOT NULL DEFAULT true,
 client_id uuid UNIQUE REFERENCES private.clients(id) ON DELETE SET NULL,
 verified_version text,
 verified_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.orbe_google_mcc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orbe_google_mcc_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orbe_google_mcc,public.orbe_google_mcc_accounts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.orbe_google_mcc,public.orbe_google_mcc_accounts TO service_role;

CREATE OR REPLACE FUNCTION public.orbe_mcc_configure(p_manager text,p_source uuid,p_expected timestamptz,p_actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE previous public.orbe_google_mcc%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND is_active AND role='admin' AND can_view_financials) THEN RAISE EXCEPTION 'owner_required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('orbe_google_mcc'));
 SELECT * INTO previous FROM orbe_google_mcc WHERE id FOR UPDATE;
 IF previous.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'configuration_changed'; END IF;
 IF p_manager IS NULL OR p_manager !~ '^[1-9][0-9]{9}$' OR NOT EXISTS(SELECT 1 FROM wa_ads_credentials a JOIN public.clients c ON c.id=a.client_id WHERE a.client_id=p_source AND a.platform='google' AND c.deleted_at IS NULL) THEN RAISE EXCEPTION 'invalid_configuration'; END IF;
 INSERT INTO orbe_google_mcc(id,manager_id,credential_client_id,enabled,updated_by) VALUES(true,p_manager,p_source,true,p_actor)
 ON CONFLICT(id) DO UPDATE SET manager_id=p_manager,credential_client_id=p_source,enabled=true,manager_name=NULL,checked_at=NULL,updated_at=clock_timestamp(),updated_by=p_actor;
 IF previous.manager_id IS DISTINCT FROM p_manager THEN UPDATE orbe_google_mcc_accounts SET present=false,verified_at=NULL,verified_version=NULL,updated_at=clock_timestamp(); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.orbe_mcc_inventory(p_manager text,p_name text,p_accounts jsonb,p_expected timestamptz,p_source_version timestamptz,p_actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE config public.orbe_google_mcc%ROWTYPE; item jsonb; matched uuid; matches integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND is_active AND role='admin' AND can_view_financials) THEN RAISE EXCEPTION 'owner_required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('orbe_google_mcc'));
 SELECT * INTO config FROM orbe_google_mcc WHERE id FOR UPDATE;
 IF NOT FOUND OR config.updated_at IS DISTINCT FROM p_expected OR config.manager_id IS DISTINCT FROM p_manager OR NOT config.enabled OR NOT EXISTS(SELECT 1 FROM wa_ads_credentials WHERE client_id=config.credential_client_id AND platform='google' AND updated_at=p_source_version) THEN RAISE EXCEPTION 'configuration_changed'; END IF;
 IF p_accounts IS NULL OR jsonb_typeof(p_accounts)<>'array' OR jsonb_array_length(p_accounts)>5000 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_accounts) a WHERE (a->>'id') IS NULL OR (a->>'id')!~'^[1-9][0-9]{9}$') THEN RAISE EXCEPTION 'invalid_inventory'; END IF;
 UPDATE orbe_google_mcc_accounts SET present=false,verified_at=NULL,verified_version=NULL,updated_at=clock_timestamp();
 FOR item IN SELECT value FROM jsonb_array_elements(p_accounts) LOOP
  INSERT INTO orbe_google_mcc_accounts(account_id,account_name,is_manager,currency,timezone,provider_status,present)
  VALUES(item->>'id',left(coalesce(item->>'name',item->>'id'),240),coalesce((item->>'manager')::boolean,false),item->>'currency',item->>'timezone',item->>'status',true)
  ON CONFLICT(account_id) DO UPDATE SET account_name=EXCLUDED.account_name,is_manager=EXCLUDED.is_manager,currency=EXCLUDED.currency,timezone=EXCLUDED.timezone,provider_status=EXCLUDED.provider_status,present=true,updated_at=clock_timestamp();
 END LOOP;
 -- Deterministic matching only. Similar names never create a client binding.
 FOR item IN SELECT value FROM jsonb_array_elements(p_accounts) WHERE coalesce((value->>'manager')::boolean,false)=false LOOP
  SELECT count(*),(array_agg(c.id))[1] INTO matches,matched FROM public.clients c LEFT JOIN wa_ads_credentials a ON a.client_id=c.id AND a.platform='google' WHERE c.deleted_at IS NULL AND coalesce(nullif(replace(c.google_ads_account_id,'-',''),''),a.account_id)=item->>'id';
  IF matches=1 AND NOT EXISTS(SELECT 1 FROM orbe_google_mcc_accounts WHERE client_id=matched AND account_id<>item->>'id') THEN
   UPDATE orbe_google_mcc_accounts SET client_id=matched,updated_at=clock_timestamp() WHERE account_id=item->>'id' AND client_id IS NULL;
   IF EXISTS(SELECT 1 FROM orbe_google_mcc_accounts WHERE account_id=item->>'id' AND client_id=matched) THEN UPDATE private.clients SET google_ads_account_id=item->>'id' WHERE id=matched; END IF;
  END IF;
 END LOOP;
 UPDATE orbe_google_mcc SET manager_name=left(p_name,240),checked_at=clock_timestamp(),updated_at=clock_timestamp(),updated_by=p_actor WHERE id;
END $$;

CREATE OR REPLACE FUNCTION public.orbe_mcc_map(p_account text,p_client uuid,p_expected timestamptz,p_actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE config public.orbe_google_mcc%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND is_active AND role='admin' AND can_view_financials) THEN RAISE EXCEPTION 'owner_required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('orbe_google_mcc'));
 SELECT * INTO config FROM orbe_google_mcc WHERE id FOR UPDATE;
 IF NOT FOUND OR config.updated_at IS DISTINCT FROM p_expected OR NOT config.enabled THEN RAISE EXCEPTION 'configuration_changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM orbe_google_mcc_accounts WHERE account_id=p_account AND present AND NOT is_manager) OR p_client IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients WHERE id=p_client AND deleted_at IS NULL) THEN RAISE EXCEPTION 'invalid_mapping'; END IF;
 IF p_client IS NOT NULL THEN UPDATE orbe_google_mcc_accounts SET client_id=NULL,verified_at=NULL,verified_version=NULL,updated_at=clock_timestamp() WHERE client_id=p_client AND account_id<>p_account; END IF;
 UPDATE orbe_google_mcc_accounts SET client_id=p_client,verified_at=NULL,verified_version=NULL,updated_at=clock_timestamp() WHERE account_id=p_account;
 IF p_client IS NOT NULL THEN UPDATE private.clients SET google_ads_account_id=p_account WHERE id=p_client; END IF;
 UPDATE orbe_google_mcc SET updated_at=clock_timestamp(),updated_by=p_actor WHERE id;
END $$;
REVOKE ALL ON FUNCTION public.orbe_mcc_configure(text,uuid,timestamptz,uuid),public.orbe_mcc_inventory(text,text,jsonb,timestamptz,timestamptz,uuid),public.orbe_mcc_map(text,uuid,timestamptz,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.orbe_mcc_configure(text,uuid,timestamptz,uuid),public.orbe_mcc_inventory(text,text,jsonb,timestamptz,timestamptz,uuid),public.orbe_mcc_map(text,uuid,timestamptz,uuid) TO service_role;

-- Preserve OAuth material while guarding both the agency configuration and
-- credential version in one transaction.
CREATE OR REPLACE FUNCTION public.orbe_mcc_developer(p_expected timestamptz,p_source_version timestamptz,p_ciphertext text,p_actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE config public.orbe_google_mcc%ROWTYPE; source public.wa_ads_credentials%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND is_active AND role='admin' AND can_view_financials) THEN RAISE EXCEPTION 'owner_required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('orbe_google_mcc'));
 SELECT * INTO config FROM orbe_google_mcc WHERE id FOR UPDATE;
 IF NOT FOUND OR config.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'configuration_changed'; END IF;
 SELECT * INTO source FROM wa_ads_credentials WHERE client_id=config.credential_client_id AND platform='google';
 IF NOT FOUND OR source.updated_at IS DISTINCT FROM p_source_version THEN RAISE EXCEPTION 'configuration_changed'; END IF;
 PERFORM wa_ads_save(config.credential_client_id,'google',source.account_id,p_ciphertext,CASE WHEN source.has_refresh_token THEN 'saved_unverified' ELSE 'oauth_pending' END,source.has_refresh_token,source.expires_at,p_actor,p_source_version);
END $$;
REVOKE ALL ON FUNCTION public.orbe_mcc_developer(timestamptz,timestamptz,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.orbe_mcc_developer(timestamptz,timestamptz,text,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
