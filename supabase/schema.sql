-- Orbe Operating System — Schema Completo
-- Rode este arquivo no Supabase SQL Editor:
-- https://supabase.com/dashboard/project/pkncvfssrbjjpgwstelo/sql/new

-- ─────────────────────────────────────────────
-- EXTENSÕES
-- ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────
create type user_role as enum ('admin', 'coordenador', 'gt', 'gp');
create type client_status as enum ('ativo', 'pausado', 'em_risco', 'offboarding', 'churned');
create type health_flag as enum ('green', 'yellow', 'red');
create type quarter_status as enum ('planejamento', 'ativo', 'encerrado');
create type task_status as enum ('backlog', 'em_andamento', 'em_revisao', 'concluido', 'cancelado');
create type task_priority as enum ('baixa', 'media', 'alta', 'urgente');
create type playbook_trigger as enum ('onboarding', 'quarter_start', 'month_close', 'manual');
create type payment_status as enum ('pendente', 'pago', 'atrasado', 'cancelado');
create type financial_type as enum ('mensalidade', 'bonus', 'ajuste', 'custo_fixo');
create type trigger_status as enum ('pending', 'completed', 'failed');

-- ─────────────────────────────────────────────
-- PROFILES (estende auth.users)
-- ─────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  avatar_url text,
  role user_role not null default 'gt',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger: cria profile automaticamente ao criar usuário no Auth
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'gt')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────────────────────────
-- CLIENTS
-- ─────────────────────────────────────────────
create table clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  segment text,
  status client_status not null default 'ativo',
  health_flag health_flag not null default 'green',
  monthly_investment numeric(12,2),
  monthly_fee numeric(12,2),
  contract_start date,
  contract_end date,
  website text,
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  notes text,
  data_source text not null default 'manual',
  meta_ads_account_id text,
  google_ads_account_id text,
  ga4_property_id text,
  external_id text,
  last_synced_at timestamptz,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index clients_status_idx on clients(status) where deleted_at is null;
create index clients_slug_idx on clients(slug);

-- ─────────────────────────────────────────────
-- CLIENT ASSIGNMENTS
-- ─────────────────────────────────────────────
create table client_assignments (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  cadeira text not null check (cadeira in ('gt', 'gp', 'coordenador')),
  is_active boolean not null default true,
  assigned_by uuid not null references profiles(id),
  assigned_at timestamptz not null default now(),
  unique(client_id, user_id)
);

create index assignments_client_idx on client_assignments(client_id);
create index assignments_user_idx on client_assignments(user_id);

-- ─────────────────────────────────────────────
-- QUARTERS
-- ─────────────────────────────────────────────
create table quarters (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  period_start date not null,
  period_end date not null,
  status quarter_status not null default 'planejamento',
  objectives text,
  kpis jsonb,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quarters_client_idx on quarters(client_id);

-- ─────────────────────────────────────────────
-- PLAYBOOKS
-- ─────────────────────────────────────────────
create table playbooks (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  trigger_type playbook_trigger not null,
  cadeira text,
  version integer not null default 1,
  is_active boolean not null default true,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ─────────────────────────────────────────────
-- PLAYBOOK STEPS
-- ─────────────────────────────────────────────
create table playbook_steps (
  id uuid primary key default uuid_generate_v4(),
  playbook_id uuid not null references playbooks(id) on delete cascade,
  title text not null,
  description text,
  assignee_role text not null check (assignee_role in ('gt', 'gp', 'coordenador', 'admin')),
  days_offset integer not null default 0,
  estimated_hours numeric(5,2),
  priority task_priority not null default 'media',
  parent_step_id uuid references playbook_steps(id),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- WORKFLOW TRIGGERS
-- ─────────────────────────────────────────────
create table workflow_triggers (
  id uuid primary key default uuid_generate_v4(),
  playbook_id uuid not null references playbooks(id),
  client_id uuid not null references clients(id),
  quarter_id uuid references quarters(id),
  trigger_type playbook_trigger not null,
  trigger_date date not null,
  triggered_by uuid not null references profiles(id),
  tasks_generated integer not null default 0,
  status trigger_status not null default 'pending',
  error_message text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- TASKS
-- ─────────────────────────────────────────────
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  quarter_id uuid references quarters(id),
  playbook_step_id uuid references playbook_steps(id),
  workflow_trigger_id uuid references workflow_triggers(id),
  parent_task_id uuid references tasks(id),
  title text not null,
  description text,
  status task_status not null default 'backlog',
  priority task_priority not null default 'media',
  assignee_id uuid references profiles(id),
  deadline date,
  estimated_hours numeric(5,2),
  actual_hours numeric(5,2),
  sort_order integer not null default 0,
  data_source text not null default 'manual',
  external_id text,
  last_synced_at timestamptz,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz
);

create index tasks_client_idx on tasks(client_id) where deleted_at is null;
create index tasks_assignee_idx on tasks(assignee_id) where deleted_at is null;
create index tasks_status_idx on tasks(status) where deleted_at is null;
create index tasks_deadline_idx on tasks(deadline) where deleted_at is null;
create index tasks_quarter_idx on tasks(quarter_id) where deleted_at is null;

-- ─────────────────────────────────────────────
-- COMMENTS
-- ─────────────────────────────────────────────
create table comments (
  id uuid primary key default uuid_generate_v4(),
  entity_type text not null check (entity_type in ('task', 'client', 'lead')),
  entity_id uuid not null,
  author_id uuid not null references profiles(id),
  content text not null,
  is_internal boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index comments_entity_idx on comments(entity_type, entity_id) where deleted_at is null;

-- ─────────────────────────────────────────────
-- FINANCIAL RECORDS
-- ─────────────────────────────────────────────
create table financial_records (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id),
  type financial_type not null,
  description text,
  amount numeric(12,2) not null,
  due_date date not null,
  paid_date date,
  status payment_status not null default 'pendente',
  payment_method text,
  invoice_number text,
  notes text,
  data_source text not null default 'manual',
  external_id text,
  last_synced_at timestamptz,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index financial_client_idx on financial_records(client_id) where deleted_at is null;
create index financial_due_date_idx on financial_records(due_date) where deleted_at is null;
create index financial_status_idx on financial_records(status) where deleted_at is null;

-- ─────────────────────────────────────────────
-- PIPELINE STAGES
-- ─────────────────────────────────────────────
create table pipeline_stages (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  color text not null default '#1FCE4A',
  sort_order integer not null default 0,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now()
);

-- Estágios padrão
insert into pipeline_stages (name, color, sort_order, is_won, is_lost) values
  ('Qualificação',    '#525252', 0, false, false),
  ('Call 1',          '#3B82F6', 1, false, false),
  ('Proposta Enviada','#F59E0B', 2, false, false),
  ('Negociação',      '#8B5CF6', 3, false, false),
  ('Fechado',         '#1FCE4A', 4, true,  false),
  ('Perdido',         '#EF4444', 5, false, true);

-- ─────────────────────────────────────────────
-- LEADS
-- ─────────────────────────────────────────────
create table leads (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  stage_id uuid not null references pipeline_stages(id),
  segment text,
  potential_mrr numeric(12,2),
  probability integer not null default 50 check (probability between 0 and 100),
  source text,
  owner_id uuid references profiles(id),
  notes text,
  lost_reason text,
  converted_to_client_id uuid references clients(id),
  data_source text not null default 'manual',
  external_id text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ─────────────────────────────────────────────
-- LEAD ACTIVITIES
-- ─────────────────────────────────────────────
create table lead_activities (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete cascade,
  type text not null check (type in ('note', 'call', 'email', 'meeting', 'stage_change')),
  content text,
  old_stage_id uuid references pipeline_stages(id),
  new_stage_id uuid references pipeline_stages(id),
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
alter table profiles enable row level security;
alter table clients enable row level security;
alter table client_assignments enable row level security;
alter table quarters enable row level security;
alter table playbooks enable row level security;
alter table playbook_steps enable row level security;
alter table workflow_triggers enable row level security;
alter table tasks enable row level security;
alter table comments enable row level security;
alter table financial_records enable row level security;
alter table pipeline_stages enable row level security;
alter table leads enable row level security;
alter table lead_activities enable row level security;

-- Política base: usuário autenticado vê e edita os próprios dados do profile
create policy "profiles: self read" on profiles for select using (auth.uid() = id);
create policy "profiles: self update" on profiles for update using (auth.uid() = id);

-- Admin e coordenador veem todos os profiles
create policy "profiles: admin/coord read all" on profiles for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'coordenador')));

-- Clientes: admin/coord veem todos; gt/gp veem só os seus
create policy "clients: admin/coord all" on clients for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'coordenador')));

create policy "clients: gt/gp own" on clients for select
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role in ('gt', 'gp')
    ) and
    id in (
      select client_id from client_assignments where user_id = auth.uid() and is_active = true
    )
  );

-- Tarefas: mesmo padrão
create policy "tasks: admin/coord all" on tasks for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'coordenador')));

create policy "tasks: gt/gp own clients" on tasks for all
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('gt', 'gp')) and
    client_id in (
      select client_id from client_assignments where user_id = auth.uid() and is_active = true
    )
  );

-- Quarters: mesmo padrão
create policy "quarters: admin/coord all" on quarters for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'coordenador')));

create policy "quarters: gt/gp own clients" on quarters for select
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('gt', 'gp')) and
    client_id in (
      select client_id from client_assignments where user_id = auth.uid() and is_active = true
    )
  );

-- Assignments: admin/coord gerenciam
create policy "assignments: admin/coord all" on client_assignments for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'coordenador')));

create policy "assignments: self read" on client_assignments for select
  using (user_id = auth.uid());

-- Playbooks: todos autenticados leem, admin/coord editam
create policy "playbooks: authenticated read" on playbooks for select using (auth.uid() is not null);
create policy "playbooks: admin/coord write" on playbooks for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'coordenador')));

create policy "playbook_steps: authenticated read" on playbook_steps for select using (auth.uid() is not null);
create policy "playbook_steps: admin/coord write" on playbook_steps for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'coordenador')));

-- Financeiro: apenas admin
create policy "financial: admin only" on financial_records for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Pipeline: admin/coord
create policy "pipeline_stages: all read" on pipeline_stages for select using (auth.uid() is not null);
create policy "leads: admin/coord all" on leads for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'coordenador')));

-- Comments: usuário autenticado nos seus contextos
create policy "comments: authenticated" on comments for all using (auth.uid() is not null);

-- Workflow triggers: admin/coord
create policy "workflow_triggers: admin/coord all" on workflow_triggers for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'coordenador')));

-- Lead activities: admin/coord
create policy "lead_activities: admin/coord all" on lead_activities for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'coordenador')));

-- ─────────────────────────────────────────────
-- UPDATED_AT AUTOMÁTICO
-- ─────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on profiles for each row execute function set_updated_at();
create trigger set_updated_at before update on clients for each row execute function set_updated_at();
create trigger set_updated_at before update on quarters for each row execute function set_updated_at();
create trigger set_updated_at before update on playbooks for each row execute function set_updated_at();
create trigger set_updated_at before update on playbook_steps for each row execute function set_updated_at();
create trigger set_updated_at before update on tasks for each row execute function set_updated_at();
create trigger set_updated_at before update on comments for each row execute function set_updated_at();
create trigger set_updated_at before update on financial_records for each row execute function set_updated_at();
create trigger set_updated_at before update on leads for each row execute function set_updated_at();

-- ─────────────────────────────────────────────
-- CLIENT KNOWLEDGE BASE
-- ─────────────────────────────────────────────
create table if not exists client_knowledge (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  title       text not null,
  content     text not null,
  source      text not null check (source in ('manual', 'ai_suggested', 'web')) default 'manual',
  validated   boolean not null default false,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table client_knowledge enable row level security;

-- Admin/coord: acesso total
create policy "knowledge: admin/coord all" on client_knowledge for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'coordenador')));

-- GT/GP: lê apenas conhecimento validado dos seus clientes
create policy "knowledge: gt/gp read validated" on client_knowledge for select
  using (
    validated = true and
    client_id in (
      select client_id from client_assignments where user_id = auth.uid() and is_active = true
    )
  );

create trigger set_updated_at before update on client_knowledge for each row execute function set_updated_at();
