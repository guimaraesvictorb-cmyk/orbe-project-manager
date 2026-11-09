BEGIN;
CREATE TABLE public.wa_ga4_credentials (
 client_id uuid PRIMARY KEY REFERENCES private.clients(id) ON DELETE CASCADE,
 ciphertext text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid NOT NULL REFERENCES public.profiles(id)
);
CREATE TABLE public.wa_ga4_oauth_sessions (
 state_hash text PRIMARY KEY CHECK(length(state_hash)=64),
 client_id uuid NOT NULL REFERENCES private.clients(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id),browser_hash text NOT NULL CHECK(length(browser_hash)=64),
 verifier_ciphertext text NOT NULL,credential_version text NOT NULL,expires_at timestamptz NOT NULL,consumed_at timestamptz
);
ALTER TABLE public.wa_ga4_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_ga4_oauth_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_ga4_credentials,public.wa_ga4_oauth_sessions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.wa_ga4_credentials,public.wa_ga4_oauth_sessions TO service_role;
COMMIT;
