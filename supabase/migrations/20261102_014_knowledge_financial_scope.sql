BEGIN;
ALTER TABLE public.client_knowledge ADD COLUMN IF NOT EXISTS financial_restricted boolean NOT NULL DEFAULT false;
-- Existing raw Drive material has not been reviewed for agency fees.
UPDATE public.client_knowledge SET financial_restricted = true WHERE source = 'drive';

CREATE OR REPLACE FUNCTION public.classify_knowledge_financial_scope() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.financial_restricted := coalesce(NEW.financial_restricted, false) OR
    (coalesce(NEW.title,'') || ' ' || coalesce(NEW.content,'')) ~* '(R[$]|\m(BRL|USD|EUR)\M|honor[áa]rio|retainer|financeir|valor do contrato|mensalidade da ag[êe]ncia)';
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS knowledge_financial_scope ON public.client_knowledge;
CREATE TRIGGER knowledge_financial_scope BEFORE INSERT OR UPDATE ON public.client_knowledge
FOR EACH ROW EXECUTE FUNCTION public.classify_knowledge_financial_scope();
-- A restrictive policy also protects searches through the SECURITY INVOKER RPC.
DROP POLICY IF EXISTS "knowledge financial restriction" ON public.client_knowledge;
CREATE POLICY "knowledge financial restriction" ON public.client_knowledge AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active AND (NOT financial_restricted OR p.can_view_financials)))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active AND (NOT financial_restricted OR p.can_view_financials)));

DROP POLICY IF EXISTS "offers financial restriction" ON public.client_offer_history;
CREATE POLICY "offers financial restriction" ON public.client_offer_history AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active AND (spend_cents IS NULL OR p.can_view_financials)))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active AND (spend_cents IS NULL OR p.can_view_financials)));

ALTER TABLE public.client_drive_config ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
ALTER TABLE public.client_drive_config ADD COLUMN IF NOT EXISTS sync_summary jsonb;
COMMIT;
