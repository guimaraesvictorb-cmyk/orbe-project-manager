BEGIN;
CREATE TABLE public.wa_tracking_setups (
  client_id uuid PRIMARY KEY REFERENCES private.clients(id),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id),
  connection_method text NOT NULL DEFAULT 'undecided' CHECK (connection_method IN ('undecided','qr','kommo','official')),
  system text NOT NULL DEFAULT 'none' CHECK (system IN ('none','sheets','kommo','bitrix','vtex','rd_station')),
  destination text NOT NULL DEFAULT '' CHECK (destination='' OR destination ~ '^[1-9][0-9]{9,14}$'),
  account_url text NOT NULL DEFAULT '' CHECK (length(account_url)<=500 AND (account_url='' OR account_url ~ '^https://')),
  notes text NOT NULL DEFAULT '' CHECK (length(notes)<=1000),
  activation_requested boolean NOT NULL DEFAULT false,
  traffic_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_tracking_setups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_tracking_setups FROM anon,authenticated;
GRANT SELECT,INSERT ON public.wa_tracking_setups TO authenticated;
GRANT UPDATE(connection_method,system,destination,account_url,notes,activation_requested,updated_at) ON public.wa_tracking_setups TO authenticated;
GRANT ALL ON public.wa_tracking_setups TO service_role;
CREATE POLICY wa_setup_owner_read ON public.wa_tracking_setups FOR SELECT TO authenticated USING
 (owner_user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active));
CREATE POLICY wa_setup_owner_create ON public.wa_tracking_setups FOR INSERT TO authenticated WITH CHECK
 (owner_user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.clients c WHERE c.id=client_id)
 AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active));
CREATE POLICY wa_setup_owner_edit ON public.wa_tracking_setups FOR UPDATE TO authenticated USING
 (owner_user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_active))
 WITH CHECK (owner_user_id=(SELECT auth.uid()));
NOTIFY pgrst,'reload schema';
COMMIT;
