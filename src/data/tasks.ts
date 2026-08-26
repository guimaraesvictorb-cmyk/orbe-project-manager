export type TaskStatus =
  | "ativa"
  | "em_andamento"
  | "concluida"
  | "pausada"
  | "cancelada";

export type TaskPriority = "alta" | "media" | "baixa";
export type OrbePhaseId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const TASK_TYPES = [
  "Otimização de Campanha",
  "Configuração",
  "Criativo",
  "Estratégia",
  "Relatório C.O.R.E",
  "Reunião / Call",
  "Landing Page",
  "Copy",
  "Análise de Dados",
  "Onboarding",
  "Outro",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const ORBE_CLIENTS = [
  "Sabor & Arte",
  "FitVida Academia",
  "TechHome E-commerce",
  "DentCare Clínica",
  "ModoLux Fashion",
  "Investcorp",
  "NovaBuild Construtora",
];

export const PHASE_SHORT: Record<OrbePhaseId, string> = {
  0: "Pré-Venda",
  1: "Call 1",
  2: "Radiografia",
  3: "Call 2",
  4: "Proposta",
  5: "Onboarding",
  6: "Kick-Off",
  7: "Operação",
  8: "Offboarding",
};

export interface Task {
  id: string;
  title: string;
  client: string;
  responsible: string;
  phaseId: OrbePhaseId;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string; // YYYY-MM-DD
  estimatedHours: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  return "task_" + Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED: Task[] = [
  {
    id: "task_d001",
    title: "[OTM] Otimização Meta Ads — Ciclo Maio",
    client: "FitVida Academia",
    responsible: "Victor Guimarães",
    phaseId: 7,
    type: "Otimização de Campanha",
    priority: "alta",
    status: "ativa",
    dueDate: isoDate(3),
    estimatedHours: 2,
    notes: "Focar em lookalike e ajuste de CPL. Meta: CPL < R$18",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "task_d002",
    title: "[CORE] Relatório C.O.R.E Quinzenal",
    client: "DentCare Clínica",
    responsible: "Victor Guimarães",
    phaseId: 7,
    type: "Relatório C.O.R.E",
    priority: "alta",
    status: "em_andamento",
    dueDate: isoDate(4),
    estimatedHours: 3,
    notes: "PDF + ata. Destaque: CTR subiu 23% vs. mês anterior.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "task_d003",
    title: "[RAD] Radiografia de mercado — 7 dias",
    client: "ModoLux Fashion",
    responsible: "Victor Guimarães",
    phaseId: 2,
    type: "Estratégia",
    priority: "alta",
    status: "ativa",
    dueDate: isoDate(7),
    estimatedHours: 8,
    notes: "Players nacionais + mockup de LP e funil completo",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "task_d004",
    title: "[ONBOARD] Kit boas-vindas + briefing pré-kick-off",
    client: "NovaBuild Construtora",
    responsible: "Victor Guimarães",
    phaseId: 5,
    type: "Onboarding",
    priority: "alta",
    status: "ativa",
    dueDate: isoDate(2),
    estimatedHours: 2,
    notes: "E-mail + PDF cronograma. Questionário de briefing anexo.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "task_d005",
    title: "[LP] Landing page de captação — versão A",
    client: "Sabor & Arte",
    responsible: "Victor Guimarães",
    phaseId: 6,
    type: "Landing Page",
    priority: "media",
    status: "ativa",
    dueDate: isoDate(8),
    estimatedHours: 5,
    notes: "Template aprovado na Call 2. CTA: agendar degustação.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "task_d006",
    title: "[OTM] Google Ads — Campanha de Pesquisa",
    client: "TechHome E-commerce",
    responsible: "Victor Guimarães",
    phaseId: 7,
    type: "Otimização de Campanha",
    priority: "media",
    status: "concluida",
    dueDate: isoDate(-2),
    estimatedHours: 2,
    notes: "ROAS entregue: 4.2x. Acima da meta de 3.5x.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "task_d007",
    title: "[PROP] Proposta comercial — 3 pacotes",
    client: "NovaBuild Construtora",
    responsible: "Victor Guimarães",
    phaseId: 4,
    type: "Estratégia",
    priority: "alta",
    status: "ativa",
    dueDate: isoDate(-1),
    estimatedHours: 2,
    notes: "Anchor + Ideal + Premium. Follow-up em 48h agendado.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "task_d008",
    title: "[KICK] Setup completo de acessos",
    client: "Investcorp",
    responsible: "Victor Guimarães",
    phaseId: 6,
    type: "Configuração",
    priority: "media",
    status: "concluida",
    dueDate: isoDate(-5),
    estimatedHours: 3,
    notes: "BM, Meta Ads, GA4, GTM e CRM: todos configurados.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "task_d009",
    title: "[COPY] Textos criativos — Semana 3",
    client: "ModoLux Fashion",
    responsible: "Victor Guimarães",
    phaseId: 7,
    type: "Copy",
    priority: "baixa",
    status: "pausada",
    dueDate: isoDate(14),
    estimatedHours: 4,
    notes: "Aguardando aprovação do briefing de tom de voz.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ─── localStorage CRUD ────────────────────────────────────────────────────────

// v2 forces fresh seed with the updated phase numbering (Onboarding added)
const STORAGE_KEY = "orbe_tasks_v2";

function load(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      save(SEED);
      return [...SEED];
    }
    return JSON.parse(raw) as Task[];
  } catch {
    return [...SEED];
  }
}

function save(tasks: Task[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export function getAllTasks(): Task[] {
  return load();
}

export function createTask(
  data: Omit<Task, "id" | "createdAt" | "updatedAt">
): Task {
  const now = new Date().toISOString();
  const task: Task = { ...data, id: generateId(), createdAt: now, updatedAt: now };
  save([...load(), task]);
  return task;
}

export function updateTask(
  id: string,
  data: Partial<Omit<Task, "id" | "createdAt">>
): Task | null {
  const tasks = load();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  tasks[idx] = { ...tasks[idx], ...data, updatedAt: new Date().toISOString() };
  save(tasks);
  return tasks[idx];
}

export function deleteTask(id: string): boolean {
  const tasks = load();
  const next = tasks.filter((t) => t.id !== id);
  if (next.length === tasks.length) return false;
  save(next);
  return true;
}

// ─── Derived / display helpers ────────────────────────────────────────────────

export function isOverdue(task: Task): boolean {
  if (task.status === "concluida" || task.status === "cancelada") return false;
  return task.dueDate < new Date().toISOString().split("T")[0];
}

export const STATUS_META: Record<
  TaskStatus,
  { label: string; bg: string; color: string; dot: string }
> = {
  ativa:        { label: "Ativa",        bg: "#071a0e", color: "#1FCE4A", dot: "#1FCE4A" },
  em_andamento: { label: "Em andamento", bg: "#071422", color: "#60A5FA", dot: "#60A5FA" },
  concluida:    { label: "Concluída",    bg: "#111",    color: "#6B7280", dot: "#6B7280" },
  pausada:      { label: "Pausada",      bg: "#1a1200", color: "#F59E0B", dot: "#F59E0B" },
  cancelada:    { label: "Cancelada",    bg: "#180808", color: "#EF4444", dot: "#EF4444" },
};

export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; color: string; bg: string }
> = {
  alta:  { label: "Alta",  color: "#EF4444", bg: "#1f0808" },
  media: { label: "Média", color: "#F59E0B", bg: "#1a1100" },
  baixa: { label: "Baixa", color: "#6B7280", bg: "#111" },
};

export const MONTH_NAMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
