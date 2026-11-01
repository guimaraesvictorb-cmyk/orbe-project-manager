BEGIN;
CREATE TABLE IF NOT EXISTS public.wa_evo_snapshots(
 client_id uuid NOT NULL REFERENCES private.clients(id),start_date date NOT NULL,end_date date NOT NULL,
 scope text NOT NULL CHECK(scope ~ '^[a-z0-9_-]{1,40}$'),credential_version text NOT NULL CHECK(credential_version ~ '^[a-f0-9]{64}$'),
 report jsonb NOT NULL CHECK(octet_length(report::text)<=131072),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_by uuid NOT NULL REFERENCES public.profiles(id),PRIMARY KEY(client_id,start_date,end_date,scope),CHECK(start_date<=end_date)
);
ALTER TABLE public.wa_evo_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_evo_snapshots FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.wa_evo_snapshots TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
