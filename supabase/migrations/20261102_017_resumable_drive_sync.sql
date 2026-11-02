-- Server-owned checkpoint: raw folder inventories are never exposed by the Data API.
CREATE TABLE IF NOT EXISTS public.client_drive_sync_jobs (
 client_id uuid PRIMARY KEY REFERENCES private.clients(id) ON DELETE CASCADE,
 job_id uuid NOT NULL DEFAULT gen_random_uuid(),
 folder_id text NOT NULL,
 revision integer NOT NULL DEFAULT 0,
 lease_until timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z',
 state jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_drive_sync_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_drive_sync_jobs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.client_drive_sync_jobs TO service_role;
