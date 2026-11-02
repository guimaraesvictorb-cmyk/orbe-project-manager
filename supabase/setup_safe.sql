DO $$ BEGIN CREATE TYPE user_role AS ENUM ('admin','coordenador','gt','gp'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE client_status AS ENUM ('ativo','pausado','em_risco','offboarding','churned'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE health_flag AS ENUM ('green','yellow','red'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE task_status AS ENUM ('backlog','em_andamento','em_revisao','concluido','cancelado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE task_priority AS ENUM ('baixa','media','alta','urgente'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_status AS ENUM ('pendente','pago','atrasado','cancelado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE financial_type AS ENUM ('mensalidade','bonus','ajuste','custo_fixo'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE playbook_trigger AS ENUM ('onboarding','quarter_start','month_close','manual'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE quarter_status AS ENUM ('planejamento','ativo','encerrado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE trigger_status AS ENUM ('pending','completed','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  avatar_url   text,
  role         user_role NOT NULL DEFAULT 'gt',
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS can_view_financials boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles: self read" ON profiles;
DROP POLICY IF EXISTS "profiles: self update" ON profiles;
DROP POLICY IF EXISTS "profiles: admin/coord read all" ON profiles;
CREATE POLICY "profiles: self read" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles: self update" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles: admin/coord read all" ON profiles FOR SELECT USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','coordenador')));

CREATE TABLE IF NOT EXISTS clients (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  slug                  text NOT NULL UNIQUE,
  segment               text,
  status                client_status NOT NULL DEFAULT 'ativo',
  health_flag           health_flag NOT NULL DEFAULT 'green',
  monthly_investment    numeric(12,2),
  monthly_fee           numeric(12,2),
  contract_start        date,
  contract_end          date,
  website               text,
  primary_contact_name  text,
  primary_contact_email text,
  primary_contact_phone text,
  notes                 text,
  data_source           text NOT NULL DEFAULT 'manual',
  meta_ads_account_id   text,
  google_ads_account_id text,
  ga4_property_id       text,
  external_id           text,
  last_synced_at        timestamptz,
  created_by            uuid NOT NULL REFERENCES profiles(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clients: admin/coord all" ON clients;
DROP POLICY IF EXISTS "clients: gt/gp own" ON clients;
CREATE POLICY "clients: admin/coord all" ON clients FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','coordenador')));

CREATE TABLE IF NOT EXISTS client_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cadeira     text NOT NULL CHECK (cadeira IN ('gt','gp','coordenador')),
  is_active   boolean NOT NULL DEFAULT true,
  assigned_by uuid NOT NULL REFERENCES profiles(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, user_id)
);
ALTER TABLE client_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "assignments: admin/coord all" ON client_assignments;
DROP POLICY IF EXISTS "assignments: self read" ON client_assignments;
CREATE POLICY "assignments: admin/coord all" ON client_assignments FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','coordenador')));
CREATE POLICY "assignments: self read" ON client_assignments FOR SELECT USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  quarter_id      uuid,
  title           text NOT NULL,
  description     text,
  status          task_status NOT NULL DEFAULT 'backlog',
  priority        task_priority NOT NULL DEFAULT 'media',
  assignee_id     uuid REFERENCES profiles(id),
  deadline        date,
  estimated_hours numeric(5,2),
  actual_hours    numeric(5,2),
  sort_order      integer NOT NULL DEFAULT 0,
  data_source     text NOT NULL DEFAULT 'manual',
  created_by      uuid NOT NULL REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  deleted_at      timestamptz
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tasks: admin/coord all" ON tasks;
CREATE POLICY "tasks: admin/coord all" ON tasks FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','coordenador')));

CREATE TABLE IF NOT EXISTS financial_records (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid REFERENCES clients(id),
  type           financial_type NOT NULL,
  description    text,
  amount         numeric(12,2) NOT NULL,
  due_date       date NOT NULL,
  paid_date      date,
  status         payment_status NOT NULL DEFAULT 'pendente',
  payment_method text,
  invoice_number text,
  notes          text,
  data_source    text NOT NULL DEFAULT 'manual',
  created_by     uuid NOT NULL REFERENCES profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);
ALTER TABLE financial_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "financial: admin only" ON financial_records;
CREATE POLICY "financial: admin only" ON financial_records FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  color      text NOT NULL DEFAULT '#1FCE4A',
  sort_order integer NOT NULL DEFAULT 0,
  is_won     boolean NOT NULL DEFAULT false,
  is_lost    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pipeline_stages: all read" ON pipeline_stages;
CREATE POLICY "pipeline_stages: all read" ON pipeline_stages FOR SELECT USING (auth.uid() IS NOT NULL);
INSERT INTO pipeline_stages (name, color, sort_order, is_won, is_lost)
SELECT * FROM (VALUES
  ('Qualificação',     '#525252', 0, false, false),
  ('Call 1',           '#3B82F6', 1, false, false),
  ('Proposta Enviada', '#F59E0B', 2, false, false),
  ('Negociação',       '#8B5CF6', 3, false, false),
  ('Fechado',          '#1FCE4A', 4, true,  false),
  ('Perdido',          '#EF4444', 5, false, true)
) AS v(name, color, sort_order, is_won, is_lost)
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages);

CREATE TABLE IF NOT EXISTS leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  contact_name  text,
  contact_email text,
  contact_phone text,
  stage_id      uuid NOT NULL REFERENCES pipeline_stages(id),
  segment       text,
  potential_mrr numeric(12,2),
  probability   integer NOT NULL DEFAULT 50,
  source        text,
  owner_id      uuid REFERENCES profiles(id),
  notes         text,
  lost_reason   text,
  created_by    uuid NOT NULL REFERENCES profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads: admin/coord all" ON leads;
CREATE POLICY "leads: admin/coord all" ON leads FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','coordenador')));

CREATE TABLE IF NOT EXISTS client_knowledge (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title      text NOT NULL,
  content    text NOT NULL,
  source     text NOT NULL CHECK (source IN ('manual','ai_suggested','web','drive')) DEFAULT 'manual',
  source_ref text,
  source_url text,
  source_folder_id text,
  validated  boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS client_knowledge_source_unique ON client_knowledge(client_id, source_ref);
ALTER TABLE client_knowledge ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "knowledge: admin/coord all" ON client_knowledge;
CREATE POLICY "knowledge: admin/coord all" ON client_knowledge FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','coordenador')));

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN new.updated_at = now(); RETURN new; END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON clients;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON tasks;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON financial_records;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON financial_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON leads;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON client_knowledge;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON client_knowledge FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name, role)
  VALUES (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), 'gt')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

INSERT INTO profiles (id, email, display_name, role)
SELECT id, email,
  CASE email
    WHEN 'guimaraes.victorb@gmail.com' THEN 'Victor Guimarães'
    WHEN 'juliasilvasil96@gmail.com'   THEN 'Julia Silva'
  END,
  'admin'::user_role
FROM auth.users
WHERE email IN ('guimaraes.victorb@gmail.com','juliasilvasil96@gmail.com')
ON CONFLICT (id) DO UPDATE SET role = 'admin'::user_role, display_name = EXCLUDED.display_name;
