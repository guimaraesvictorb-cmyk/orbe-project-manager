BEGIN;
CREATE TABLE IF NOT EXISTS public.orbe_communications_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 sender_phone text NOT NULL DEFAULT '',
 updated_by uuid REFERENCES public.profiles(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.orbe_communication_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
 client_id uuid REFERENCES private.clients(id),
 report_type text NOT NULL CHECK (report_type IN ('tasks','performance','balance')),
 recipient text NOT NULL CHECK (length(recipient) BETWEEN 10 AND 16),
 frequency text NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily','weekly','monthly')),
 status text NOT NULL DEFAULT 'draft' CHECK (status = 'draft'),
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.orbe_communications_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orbe_communication_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agency communications administrators" ON public.orbe_communications_settings;
CREATE POLICY "agency communications administrators" ON public.orbe_communications_settings FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active AND p.role IN ('admin','coordenador')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active AND p.role IN ('admin','coordenador')));
DROP POLICY IF EXISTS "agency communication drafts administrators" ON public.orbe_communication_drafts;
CREATE POLICY "agency communication drafts administrators" ON public.orbe_communication_drafts FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active AND p.role IN ('admin','coordenador') AND (report_type='tasks' OR p.can_view_financials)))
WITH CHECK (created_by=auth.uid() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active AND p.role IN ('admin','coordenador') AND (report_type='tasks' OR p.can_view_financials)));
COMMIT;
