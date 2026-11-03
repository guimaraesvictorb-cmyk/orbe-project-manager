BEGIN;
CREATE TABLE IF NOT EXISTS public.orbe_meta_agency (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 source_client_id uuid NOT NULL REFERENCES private.clients(id),
 enabled boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid NOT NULL REFERENCES auth.users(id)
);
CREATE TABLE IF NOT EXISTS public.orbe_meta_accounts (
 client_id uuid PRIMARY KEY REFERENCES private.clients(id),
 account_id text UNIQUE NOT NULL CHECK(account_id ~ '^[1-9][0-9]{5,24}$'),
 account_name text NOT NULL DEFAULT '',
 source_version timestamptz NOT NULL,
 configuration_version timestamptz NOT NULL,
 verified_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.orbe_meta_agency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orbe_meta_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orbe_meta_agency,public.orbe_meta_accounts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.orbe_meta_agency,public.orbe_meta_accounts TO service_role;
CREATE OR REPLACE FUNCTION public.orbe_meta_configure(p_source uuid,p_source_version timestamptz,p_expected timestamptz,p_actor uuid)
 RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE current_version timestamptz;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND is_active AND role='admin' AND can_view_financials) THEN RAISE EXCEPTION 'owner_required';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('orbe-meta-agency',0));
 SELECT updated_at INTO current_version FROM public.orbe_meta_agency WHERE id FOR UPDATE;
 IF current_version IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'configuration_changed';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.wa_ads_credentials c JOIN private.clients cl ON cl.id=c.client_id WHERE c.client_id=p_source AND c.platform='meta' AND c.updated_at=p_source_version AND cl.deleted_at IS NULL) THEN RAISE EXCEPTION 'credentials_missing';END IF;
 INSERT INTO public.orbe_meta_agency(id,source_client_id,updated_by) VALUES(true,p_source,p_actor)
 ON CONFLICT(id) DO UPDATE SET source_client_id=excluded.source_client_id,enabled=true,updated_by=p_actor,updated_at=clock_timestamp();
END $$;
CREATE OR REPLACE FUNCTION public.orbe_meta_map(p_client uuid,p_account text,p_name text,p_source_version timestamptz,p_expected timestamptz,p_link_expected timestamptz,p_actor uuid)
 RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE config public.orbe_meta_agency%ROWTYPE; link_version timestamptz;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND is_active AND role='admin' AND can_view_financials) THEN RAISE EXCEPTION 'owner_required';END IF;
 SELECT * INTO config FROM public.orbe_meta_agency WHERE id FOR UPDATE;
 IF NOT FOUND OR NOT config.enabled OR config.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'configuration_changed';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.wa_ads_credentials WHERE client_id=config.source_client_id AND platform='meta' AND updated_at=p_source_version) THEN RAISE EXCEPTION 'configuration_changed';END IF;
 SELECT updated_at INTO link_version FROM public.orbe_meta_accounts WHERE client_id=p_client FOR UPDATE;
 IF link_version IS DISTINCT FROM p_link_expected THEN RAISE EXCEPTION 'configuration_changed';END IF;
 IF NOT EXISTS(SELECT 1 FROM private.clients WHERE id=p_client AND deleted_at IS NULL) THEN RAISE EXCEPTION 'invalid_client';END IF;
 INSERT INTO public.orbe_meta_accounts(client_id,account_id,account_name,source_version,configuration_version)
 VALUES(p_client,p_account,left(p_name,200),p_source_version,config.updated_at)
 ON CONFLICT(client_id) DO UPDATE SET account_id=excluded.account_id,account_name=excluded.account_name,source_version=excluded.source_version,configuration_version=excluded.configuration_version,verified_at=clock_timestamp(),updated_at=clock_timestamp();
END $$;
REVOKE ALL ON FUNCTION public.orbe_meta_configure(uuid,timestamptz,timestamptz,uuid),public.orbe_meta_map(uuid,text,text,timestamptz,timestamptz,timestamptz,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.orbe_meta_configure(uuid,timestamptz,timestamptz,uuid),public.orbe_meta_map(uuid,text,text,timestamptz,timestamptz,timestamptz,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
