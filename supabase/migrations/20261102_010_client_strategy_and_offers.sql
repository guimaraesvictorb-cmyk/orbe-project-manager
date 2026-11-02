CREATE TABLE IF NOT EXISTS client_marketing_strategy (
  client_id uuid PRIMARY KEY REFERENCES private.clients(id) ON DELETE CASCADE,
  icp text,
  average_ticket_cents bigint CHECK (average_ticket_cents IS NULL OR average_ticket_cents >= 0),
  target_cac_cents bigint CHECK (target_cac_cents IS NULL OR target_cac_cents >= 0),
  target_ltv_cents bigint CHECK (target_ltv_cents IS NULL OR target_ltv_cents >= 0),
  conversion_event text,
  conversion_source text,
  funnel_top text,
  funnel_middle text,
  funnel_bottom text,
  primary_channels text[] NOT NULL DEFAULT '{}',
  updated_by uuid REFERENCES profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_offer_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid NOT NULL REFERENCES private.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text,
  audience text,
  starts_on date,
  ends_on date,
  price_cents bigint,
  spend_cents bigint,
  conversions integer,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (price_cents IS NULL OR price_cents >= 0),
  CHECK (spend_cents IS NULL OR spend_cents >= 0),
  CHECK (conversions IS NULL OR conversions >= 0),
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);
CREATE INDEX IF NOT EXISTS client_offer_history_client_dates_idx ON client_offer_history(client_id, starts_on DESC, created_at DESC);

ALTER TABLE client_marketing_strategy ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_offer_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "strategy read assigned clients" ON client_marketing_strategy;
CREATE POLICY "strategy read assigned clients" ON client_marketing_strategy FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','coordenador'))
  OR EXISTS (SELECT 1 FROM client_assignments a WHERE a.client_id = client_marketing_strategy.client_id AND a.user_id = auth.uid() AND a.is_active = true)
);
DROP POLICY IF EXISTS "strategy manage admin coordinator" ON client_marketing_strategy;
CREATE POLICY "strategy manage admin coordinator" ON client_marketing_strategy FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','coordenador')))
WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','coordenador')));

DROP POLICY IF EXISTS "offer history read assigned clients" ON client_offer_history;
CREATE POLICY "offer history read assigned clients" ON client_offer_history FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','coordenador'))
  OR EXISTS (SELECT 1 FROM client_assignments a WHERE a.client_id = client_offer_history.client_id AND a.user_id = auth.uid() AND a.is_active = true)
);
DROP POLICY IF EXISTS "offer history manage admin coordinator" ON client_offer_history;
CREATE POLICY "offer history manage admin coordinator" ON client_offer_history FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','coordenador')))
WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','coordenador')));
