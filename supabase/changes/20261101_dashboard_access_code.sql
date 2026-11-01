BEGIN;
ALTER TABLE public.wa_dashboard_links ADD COLUMN IF NOT EXISTS public_slug text UNIQUE CHECK(public_slug ~ '^[a-z0-9][a-z0-9-]{1,79}$');
ALTER TABLE public.wa_dashboard_links ADD COLUMN IF NOT EXISTS access_code_salt text;
ALTER TABLE public.wa_dashboard_links ADD COLUMN IF NOT EXISTS access_code_hash text CHECK(access_code_hash ~ '^[a-f0-9]{128}$');
UPDATE public.wa_dashboard_links SET public_slug='rayafit' WHERE client_id='589481f6-3a15-4c93-b384-5d33373c20e3' AND public_slug IS NULL;
CREATE TABLE IF NOT EXISTS public.wa_dashboard_access_attempts (
 key text PRIMARY KEY CHECK(key ~ '^[a-f0-9]{64}$'),
 window_start timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 1
);
ALTER TABLE public.wa_dashboard_access_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_dashboard_access_attempts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.wa_dashboard_access_attempts TO service_role;
CREATE OR REPLACE FUNCTION public.wa_dashboard_access_attempt(p_key text) RETURNS boolean LANGUAGE plpgsql SET search_path='' AS $$
DECLARE n integer;
BEGIN
 INSERT INTO public.wa_dashboard_access_attempts(key) VALUES(p_key)
 ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN public.wa_dashboard_access_attempts.window_start < now()-interval '5 minutes' THEN 1 ELSE public.wa_dashboard_access_attempts.attempts+1 END,window_start=CASE WHEN public.wa_dashboard_access_attempts.window_start < now()-interval '5 minutes' THEN now() ELSE public.wa_dashboard_access_attempts.window_start END
 RETURNING attempts INTO n;
 RETURN n<=10;
END $$;
REVOKE ALL ON FUNCTION public.wa_dashboard_access_attempt(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_dashboard_access_attempt(text) TO service_role;
COMMIT;
