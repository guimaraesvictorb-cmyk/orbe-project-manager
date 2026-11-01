BEGIN;
CREATE TABLE IF NOT EXISTS public.wa_bi_goals (
 connection_id uuid NOT NULL REFERENCES public.wa_tracking_connections(id),
 month date NOT NULL CHECK(extract(day FROM month)=1),
 unit text NOT NULL CHECK(unit IN ('all','alecrim','ibes','itapua')),
 target integer NOT NULL CHECK(target BETWEEN 1 AND 1000000),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(connection_id,month,unit)
);
ALTER TABLE public.wa_bi_goals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_bi_goals FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.wa_bi_goals TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.wa_bi_goals TO authenticated;
DROP POLICY IF EXISTS wa_bi_goals_read ON public.wa_bi_goals;
CREATE POLICY wa_bi_goals_read ON public.wa_bi_goals FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.wa_tracking_connections c WHERE c.id=connection_id));
DROP POLICY IF EXISTS wa_bi_goals_write ON public.wa_bi_goals;
CREATE POLICY wa_bi_goals_write ON public.wa_bi_goals FOR ALL TO authenticated USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin' AND p.is_active) AND EXISTS(SELECT 1 FROM public.wa_tracking_connections c WHERE c.id=connection_id)) WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin' AND p.is_active) AND EXISTS(SELECT 1 FROM public.wa_tracking_connections c WHERE c.id=connection_id));
COMMIT;
