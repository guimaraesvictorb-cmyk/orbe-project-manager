BEGIN;
CREATE TABLE public.wa_ads_credentials(
 client_id uuid NOT NULL REFERENCES private.clients(id),platform text NOT NULL CHECK(platform IN ('meta','google')),
 account_id text NOT NULL CHECK(account_id ~ '^[1-9][0-9]{5,24}$'),
 ciphertext text NOT NULL CHECK(length(ciphertext) BETWEEN 1 AND 32768),
 status text NOT NULL CHECK(status IN ('saved_unverified','oauth_pending','access_verified')),
 has_refresh_token boolean NOT NULL DEFAULT false,expires_at timestamptz,
 updated_by uuid NOT NULL REFERENCES public.profiles(id),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(client_id,platform)
);
CREATE TABLE public.wa_ads_credential_audit(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,client_id uuid NOT NULL REFERENCES private.clients(id),
 platform text NOT NULL,account_id text NOT NULL,actor_id uuid NOT NULL REFERENCES public.profiles(id),changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.wa_ads_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_ads_credential_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_ads_credentials,public.wa_ads_credential_audit FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.wa_ads_credentials,public.wa_ads_credential_audit TO service_role;
REVOKE ALL ON SEQUENCE public.wa_ads_credential_audit_id_seq FROM PUBLIC,anon,authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.wa_ads_credential_audit_id_seq TO service_role;
CREATE FUNCTION public.wa_ads_save(p_client uuid,p_platform text,p_account text,p_ciphertext text,p_status text,p_refresh boolean,p_expiry timestamptz,p_actor uuid,p_expected timestamptz) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE previous timestamptz;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND is_active AND role='admin') OR NOT EXISTS(SELECT 1 FROM public.clients WHERE id=p_client AND deleted_at IS NULL) THEN RAISE EXCEPTION 'forbidden';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ads:'||p_client::text||':'||p_platform,0));
 SELECT updated_at INTO previous FROM public.wa_ads_credentials WHERE client_id=p_client AND platform=p_platform FOR UPDATE;
 IF previous IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'configuration_changed';END IF;
 INSERT INTO public.wa_ads_credentials(client_id,platform,account_id,ciphertext,status,has_refresh_token,expires_at,updated_by)
 VALUES(p_client,p_platform,p_account,p_ciphertext,p_status,p_refresh,p_expiry,p_actor)
 ON CONFLICT(client_id,platform) DO UPDATE SET account_id=excluded.account_id,ciphertext=excluded.ciphertext,status=excluded.status,has_refresh_token=excluded.has_refresh_token,expires_at=excluded.expires_at,updated_by=excluded.updated_by,updated_at=clock_timestamp();
 INSERT INTO public.wa_ads_credential_audit(client_id,platform,account_id,actor_id) VALUES(p_client,p_platform,p_account,p_actor);
END $$;
REVOKE ALL ON FUNCTION public.wa_ads_save(uuid,text,text,text,text,boolean,timestamptz,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_ads_save(uuid,text,text,text,text,boolean,timestamptz,uuid,timestamptz) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
