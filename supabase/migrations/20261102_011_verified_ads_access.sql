-- Preserve successful read-access checks as non-secret connection metadata.
ALTER TABLE public.wa_ads_credentials DROP CONSTRAINT IF EXISTS wa_ads_credentials_status_check;
ALTER TABLE public.wa_ads_credentials ADD CONSTRAINT wa_ads_credentials_status_check
  CHECK (status IN ('saved_unverified', 'oauth_pending', 'access_verified'));
