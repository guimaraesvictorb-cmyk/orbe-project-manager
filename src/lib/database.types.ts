export type UserRole = 'admin' | 'coordenador' | 'gt' | 'gp'
export type ClientStatus = 'ativo' | 'pausado' | 'em_risco' | 'offboarding' | 'churned'
export type HealthFlag = 'green' | 'yellow' | 'red'
export type QuarterStatus = 'planejamento' | 'ativo' | 'encerrado'
export type TaskStatus = 'backlog' | 'em_andamento' | 'em_revisao' | 'concluido' | 'cancelado'
export type TaskPriority = 'baixa' | 'media' | 'alta' | 'urgente'
export type PlaybookTrigger = 'onboarding' | 'quarter_start' | 'month_close' | 'manual'
export type PaymentStatus = 'pendente' | 'pago' | 'atrasado' | 'cancelado'
export type FinancialType = 'mensalidade' | 'bonus' | 'ajuste' | 'custo_fixo'

export interface Profile {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  role: UserRole
  is_active: boolean
  theme: string
  custom_sections: string[] | null
  can_view_financials: boolean
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  name: string
  slug: string
  segment: string | null
  status: ClientStatus
  health_flag: HealthFlag
  monthly_investment: number | null
  monthly_fee: number | null
  contract_start: string | null
  contract_end: string | null
  website: string | null
  primary_contact_name: string | null
  primary_contact_email: string | null
  primary_contact_phone: string | null
  notes: string | null
  tipo_servico: string | null
  origem_lead: string | null
  proxima_reuniao: string | null
  data_source: string
  meta_ads_account_id: string | null
  google_ads_account_id: string | null
  ga4_property_id: string | null
  external_id: string | null
  last_synced_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ClientAssignment {
  id: string
  client_id: string
  user_id: string
  cadeira: string
  is_active: boolean
  assigned_by: string
  assigned_at: string
}

export interface ClientChecklist {
  id: string
  client_id: string
  title: string
  completed: boolean
  category: string | null
  sort_order: number
  completed_by: string | null
  completed_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface Quarter {
  id: string
  client_id: string
  name: string
  period_start: string
  period_end: string
  status: QuarterStatus
  objectives: string | null
  kpis: Array<{ name: string; target: number; unit: string }> | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface Playbook {
  id: string
  name: string
  description: string | null
  trigger_type: PlaybookTrigger
  cadeira: string | null
  version: number
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface PlaybookStep {
  id: string
  playbook_id: string
  title: string
  description: string | null
  assignee_role: string
  days_offset: number
  estimated_hours: number | null
  priority: TaskPriority
  parent_step_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface WorkflowTrigger {
  id: string
  playbook_id: string
  client_id: string
  quarter_id: string | null
  trigger_type: PlaybookTrigger
  trigger_date: string
  triggered_by: string
  tasks_generated: number
  status: 'pending' | 'completed' | 'failed'
  error_message: string | null
  created_at: string
}

export type TaskRecurrence = 'nenhuma' | 'diaria' | 'semanal' | 'quinzenal' | 'mensal'

export interface Task {
  id: string
  client_id: string
  quarter_id: string | null
  playbook_step_id: string | null
  workflow_trigger_id: string | null
  parent_task_id: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  assignee_id: string | null
  deadline: string | null
  estimated_hours: number | null
  actual_hours: number | null
  sort_order: number
  data_source: string
  external_id: string | null
  last_synced_at: string | null
  recurrence: TaskRecurrence
  created_by: string
  created_at: string
  updated_at: string
  completed_at: string | null
  deleted_at: string | null
}

export interface Comment {
  id: string
  entity_type: 'task' | 'client' | 'lead'
  entity_id: string
  author_id: string
  title: string | null
  content: string
  is_internal: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface FinancialRecord {
  id: string
  client_id: string | null
  type: FinancialType
  description: string | null
  amount: number
  due_date: string
  paid_date: string | null
  status: PaymentStatus
  payment_method: string | null
  invoice_number: string | null
  notes: string | null
  data_source: string
  external_id: string | null
  last_synced_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface PipelineStage {
  id: string
  name: string
  color: string
  sort_order: number
  is_won: boolean
  is_lost: boolean
  created_at: string
}

export interface Lead {
  id: string
  name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  stage_id: string
  segment: string | null
  potential_mrr: number | null
  probability: number
  source: string | null
  owner_id: string | null
  notes: string | null
  tipo_servico: string | null
  valor_proposta: number | null
  link_proposta: string | null
  data_fechamento: string | null
  status_contrato: string | null
  lost_reason: string | null
  converted_to_client_id: string | null
  data_source: string
  external_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface LeadActivity {
  id: string
  lead_id: string
  type: 'note' | 'call' | 'email' | 'meeting' | 'stage_change'
  content: string | null
  old_stage_id: string | null
  new_stage_id: string | null
  scheduled_at: string | null
  completed_at: string | null
  created_by: string
  created_at: string
}

export interface AdsMetric {
  id: string
  client_id: string
  platform: 'meta' | 'google'
  period: string
  investimento: number | null
  impressoes: number | null
  alcance: number | null
  cliques: number | null
  ctr: number | null
  resultados: number | null
  custo_por_resultado: number | null
  cpc: number | null
  conversoes: number | null
  custo_por_conversao: number | null
  roas: number | null
  synced_from_api: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface ShareToken {
  id: string
  client_id: string
  token: string
  label: string | null
  expires_at: string | null
  created_by: string | null
  created_at: string
}

export interface UTMCapture {
  id: string
  lead_id: string | null
  name: string | null
  email: string | null
  phone: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  landing_page: string | null
  ip_hash: string | null
  user_agent: string | null
  captured_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at' | 'updated_at'>; Update: Partial<Profile> }
      clients: { Row: Client; Insert: Omit<Client, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Client> }
      client_assignments: { Row: ClientAssignment; Insert: Omit<ClientAssignment, 'id'>; Update: Partial<ClientAssignment> }
      client_checklist: { Row: ClientChecklist; Insert: Omit<ClientChecklist, 'id' | 'created_at' | 'updated_at'>; Update: Partial<ClientChecklist> }
      client_ads_metrics: { Row: AdsMetric; Insert: Omit<AdsMetric, 'id' | 'created_at' | 'updated_at'>; Update: Partial<AdsMetric> }
      client_share_tokens: { Row: ShareToken; Insert: Omit<ShareToken, 'id' | 'created_at'>; Update: Partial<ShareToken> }
      utm_captures: { Row: UTMCapture; Insert: Omit<UTMCapture, 'id' | 'captured_at'>; Update: Partial<UTMCapture> }
      quarters: { Row: Quarter; Insert: Omit<Quarter, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Quarter> }
      playbooks: { Row: Playbook; Insert: Omit<Playbook, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Playbook> }
      playbook_steps: { Row: PlaybookStep; Insert: Omit<PlaybookStep, 'id' | 'created_at' | 'updated_at'>; Update: Partial<PlaybookStep> }
      workflow_triggers: { Row: WorkflowTrigger; Insert: Omit<WorkflowTrigger, 'id' | 'created_at'>; Update: Partial<WorkflowTrigger> }
      tasks: { Row: Task; Insert: Omit<Task, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Task> }
      comments: { Row: Comment; Insert: Omit<Comment, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Comment> }
      financial_records: { Row: FinancialRecord; Insert: Omit<FinancialRecord, 'id' | 'created_at' | 'updated_at'>; Update: Partial<FinancialRecord> }
      pipeline_stages: { Row: PipelineStage; Insert: Omit<PipelineStage, 'id' | 'created_at'>; Update: Partial<PipelineStage> }
      leads: { Row: Lead; Insert: Omit<Lead, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Lead> }
      lead_activities: { Row: LeadActivity; Insert: Omit<LeadActivity, 'id' | 'created_at'>; Update: Partial<LeadActivity> }
    }
  }
}
