BEGIN;
CREATE TABLE IF NOT EXISTS public.wa_dashboard_links (
 client_id uuid PRIMARY KEY REFERENCES private.clients(id),
 token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 token_ciphertext text NOT NULL CHECK(length(token_ciphertext) BETWEEN 1 AND 1024),
 enabled boolean NOT NULL DEFAULT true,
 include_media boolean NOT NULL DEFAULT true,
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_dashboard_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_dashboard_links FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.wa_dashboard_links TO service_role;
COMMENT ON TABLE public.wa_dashboard_links IS 'Server-only client-scoped read-only dashboard links. Token hash for lookup; encrypted token for administrator recovery. No contact data is shared.';
COMMIT;
