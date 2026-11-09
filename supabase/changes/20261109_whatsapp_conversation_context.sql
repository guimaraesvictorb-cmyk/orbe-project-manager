-- Context supplied by the account owner. Native messages and attribution remain immutable.
BEGIN;
CREATE TABLE public.wa_tracking_context (
 connection_id uuid PRIMARY KEY REFERENCES public.wa_tracking_connections(id) ON DELETE CASCADE,
 attendant_name text NOT NULL DEFAULT '' CHECK(length(attendant_name)<=160),
 attendant_description text NOT NULL DEFAULT '' CHECK(length(attendant_description)<=240),
 contacts jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(contacts)='object'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_tracking_context ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_tracking_context FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.wa_tracking_context TO service_role;
GRANT SELECT ON public.wa_tracking_context TO authenticated;
CREATE POLICY wa_tracking_context_read ON public.wa_tracking_context FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.wa_tracking_connections c WHERE c.id=wa_tracking_context.connection_id));
COMMIT;
