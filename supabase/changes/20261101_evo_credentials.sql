BEGIN;
CREATE TABLE IF NOT EXISTS public.wa_evo_credentials(
 client_id uuid NOT NULL REFERENCES private.clients(id),slot text NOT NULL CHECK(slot ~ '^[a-z0-9_-]{1,40}$'),
 ciphertext text NOT NULL CHECK(length(ciphertext) BETWEEN 1 AND 32768),expires_at timestamptz NOT NULL,
 branches jsonb NOT NULL DEFAULT '[]'::jsonb,checked_scopes jsonb NOT NULL DEFAULT '[]'::jsonb,checked_at timestamptz,
 updated_by uuid NOT NULL REFERENCES public.profiles(id),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(client_id,slot)
);
CREATE TABLE IF NOT EXISTS public.wa_evo_credential_audit(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,client_id uuid NOT NULL REFERENCES private.clients(id),slot text NOT NULL,
 actor_id uuid NOT NULL REFERENCES public.profiles(id),changed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.wa_evo_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_evo_credential_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_evo_credentials,public.wa_evo_credential_audit FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.wa_evo_credentials,public.wa_evo_credential_audit TO service_role;
REVOKE ALL ON SEQUENCE public.wa_evo_credential_audit_id_seq FROM PUBLIC,anon,authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.wa_evo_credential_audit_id_seq TO service_role;
CREATE OR REPLACE FUNCTION public.wa_evo_save(p_client uuid,p_slot text,p_ciphertext text,p_expiry timestamptz,p_actor uuid,p_expected timestamptz) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE previous timestamptz;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND is_active AND role='admin' AND can_view_financials) OR NOT EXISTS(SELECT 1 FROM public.clients WHERE id=p_client AND deleted_at IS NULL) THEN RAISE EXCEPTION 'forbidden';END IF;
 IF p_expiry<=clock_timestamp() THEN RAISE EXCEPTION 'invalid_expiry';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('evo:'||p_client::text||':'||p_slot,0));
 SELECT updated_at INTO previous FROM public.wa_evo_credentials WHERE client_id=p_client AND slot=p_slot FOR UPDATE;
 IF previous IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'configuration_changed';END IF;
 INSERT INTO public.wa_evo_credentials(client_id,slot,ciphertext,expires_at,updated_by) VALUES(p_client,p_slot,p_ciphertext,p_expiry,p_actor)
 ON CONFLICT(client_id,slot) DO UPDATE SET ciphertext=excluded.ciphertext,expires_at=excluded.expires_at,updated_by=excluded.updated_by,updated_at=clock_timestamp(),branches='[]'::jsonb,checked_scopes='[]'::jsonb,checked_at=NULL;
 INSERT INTO public.wa_evo_credential_audit(client_id,slot,actor_id) VALUES(p_client,p_slot,p_actor);
END $$;
REVOKE ALL ON FUNCTION public.wa_evo_save(uuid,text,text,timestamptz,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_evo_save(uuid,text,text,timestamptz,uuid,timestamptz) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
