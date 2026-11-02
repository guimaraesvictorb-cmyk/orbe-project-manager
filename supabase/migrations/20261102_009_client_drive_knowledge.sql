-- Read-only Google Drive knowledge sources, scoped to one mapped folder per client.
CREATE TABLE IF NOT EXISTS public.client_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES private.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  validated boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_knowledge ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "knowledge: admin/coord all" ON public.client_knowledge;
CREATE POLICY "knowledge: admin/coord all" ON public.client_knowledge FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','coordenador')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','coordenador')));
DROP POLICY IF EXISTS "knowledge: gt/gp read validated" ON public.client_knowledge;
CREATE POLICY "knowledge: gt/gp read validated" ON public.client_knowledge FOR SELECT TO authenticated
  USING (validated = true AND client_id IN (SELECT client_id FROM public.client_assignments WHERE user_id = auth.uid() AND is_active = true));

ALTER TABLE client_knowledge ADD COLUMN IF NOT EXISTS source_ref text;
ALTER TABLE client_knowledge ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE client_knowledge ADD COLUMN IF NOT EXISTS source_folder_id text;

ALTER TABLE client_knowledge DROP CONSTRAINT IF EXISTS client_knowledge_source_check;
ALTER TABLE client_knowledge ADD CONSTRAINT client_knowledge_source_check
  CHECK (source IN ('manual', 'ai_suggested', 'web', 'drive'));

CREATE UNIQUE INDEX IF NOT EXISTS client_knowledge_source_unique
  ON client_knowledge (client_id, source_ref);

-- Keep Drive folder mapping out of public.clients, which is a protected view in production.
CREATE TABLE IF NOT EXISTS public.client_drive_config (
  client_id uuid PRIMARY KEY REFERENCES private.clients(id) ON DELETE CASCADE,
  folder_id text NOT NULL CHECK (length(folder_id) BETWEEN 10 AND 256),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_drive_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client drive config read assigned" ON public.client_drive_config;
CREATE POLICY "client drive config read assigned" ON public.client_drive_config FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','coordenador'))
  OR EXISTS (SELECT 1 FROM public.client_assignments a WHERE a.client_id = client_drive_config.client_id AND a.user_id = auth.uid() AND a.is_active = true)
);
DROP POLICY IF EXISTS "client drive config manage admin coordinator" ON public.client_drive_config;
CREATE POLICY "client drive config manage admin coordinator" ON public.client_drive_config FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','coordenador')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','coordenador')));
