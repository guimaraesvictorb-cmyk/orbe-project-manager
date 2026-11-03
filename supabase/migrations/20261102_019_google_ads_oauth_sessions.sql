CREATE TABLE IF NOT EXISTS public.wa_ads_oauth_sessions (
 state_hash text PRIMARY KEY CHECK (length(state_hash)=64),
 client_id uuid NOT NULL REFERENCES private.clients(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 browser_hash text NOT NULL,
 verifier_ciphertext text NOT NULL,
 credential_version timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_ads_oauth_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_ads_oauth_sessions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.wa_ads_oauth_sessions TO service_role;
