-- Optional scheduling fields; existing checklist items remain valid.
ALTER TABLE public.client_checklist ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.client_checklist ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Periodic observed outcomes are entered from confirmed source data. No KPI is inferred from leads.
CREATE TABLE IF NOT EXISTS public.client_kpi_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES private.clients(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  channel text NOT NULL DEFAULT 'Todos os canais',
  conversion_event text NOT NULL,
  conversion_source text NOT NULL,
  confirmed_outcomes integer NOT NULL DEFAULT 0 CHECK (confirmed_outcomes >= 0),
  attributed_spend_cents bigint CHECK (attributed_spend_cents IS NULL OR attributed_spend_cents >= 0),
  cohort_customers integer CHECK (cohort_customers IS NULL OR cohort_customers >= 0),
  realized_revenue_cents bigint CHECK (realized_revenue_cents IS NULL OR realized_revenue_cents >= 0),
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start),
  UNIQUE (client_id, period_start, period_end, channel, conversion_event, conversion_source)
);
CREATE INDEX IF NOT EXISTS client_kpi_observations_period_idx ON public.client_kpi_observations(client_id, period_end DESC);
ALTER TABLE public.client_kpi_observations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client kpi read financial assigned" ON public.client_kpi_observations;
CREATE POLICY "client kpi read financial assigned" ON public.client_kpi_observations FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.can_view_financials = true)
  AND (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','coordenador'))
    OR EXISTS (SELECT 1 FROM public.client_assignments a WHERE a.client_id = client_kpi_observations.client_id AND a.user_id = auth.uid() AND a.is_active = true)
  )
);
DROP POLICY IF EXISTS "client kpi manage financial admin coordinator" ON public.client_kpi_observations;
CREATE POLICY "client kpi manage financial admin coordinator" ON public.client_kpi_observations FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.can_view_financials = true AND p.role IN ('admin','coordenador')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.can_view_financials = true AND p.role IN ('admin','coordenador')));

-- Registry of external source readiness. This table stores no API secrets and does not claim a live connection.
CREATE TABLE IF NOT EXISTS public.client_data_source_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES private.clients(id) ON DELETE CASCADE,
  system text NOT NULL CHECK (system IN ('bitrix','ecommerce','evo','meta_ads','google_ads')),
  state text NOT NULL DEFAULT 'not_configured' CHECK (state IN ('not_configured','awaiting_credentials','needs_validation','verified')),
  account_reference text,
  notes text,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, system)
);
ALTER TABLE public.client_data_source_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client data sources read assigned" ON public.client_data_source_status;
CREATE POLICY "client data sources read assigned" ON public.client_data_source_status FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','coordenador'))
  OR EXISTS (SELECT 1 FROM public.client_assignments a WHERE a.client_id = client_data_source_status.client_id AND a.user_id = auth.uid() AND a.is_active = true)
);
DROP POLICY IF EXISTS "client data sources manage admin coordinator" ON public.client_data_source_status;
CREATE POLICY "client data sources manage admin coordinator" ON public.client_data_source_status FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','coordenador')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','coordenador')));

-- Search only validated client knowledge; RLS still limits each caller to assigned clients.
DROP FUNCTION IF EXISTS public.search_client_knowledge(uuid,text,integer);
ALTER TABLE public.client_knowledge DROP COLUMN IF EXISTS search_vector;
ALTER TABLE public.client_knowledge ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(title,'') || ' ' || coalesce(content,''))) STORED;
CREATE INDEX IF NOT EXISTS client_knowledge_search_vector_idx ON public.client_knowledge USING gin(search_vector);
CREATE OR REPLACE FUNCTION public.search_client_knowledge(p_client_id uuid, p_query text, p_limit integer DEFAULT 5)
RETURNS TABLE(id uuid, title text, content text, source text, source_url text, rank real)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT k.id, k.title, k.content, k.source, k.source_url,
    ts_rank(k.search_vector, websearch_to_tsquery('portuguese', p_query)) AS rank
  FROM public.client_knowledge k
  WHERE k.client_id = p_client_id
    AND k.validated = true
    AND k.search_vector @@ websearch_to_tsquery('portuguese', p_query)
  ORDER BY rank DESC, k.updated_at DESC
  LIMIT LEAST(GREATEST(coalesce(p_limit, 5), 1), 10)
$$;
REVOKE ALL ON FUNCTION public.search_client_knowledge(uuid,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_client_knowledge(uuid,text,integer) TO authenticated;
