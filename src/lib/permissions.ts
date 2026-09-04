import type { Profile } from "./database.types"

export const SECTION_ACCESS: Record<string, string[]> = {
  admin:      ["dashboard","tarefas","clientes","financeiro","roi-day","pipeline","processos","central","rastreamento","super-agente","copy-ia","relatorios","whatsapp","integracoes","leads-capturados"],
  coordenador:["dashboard","tarefas","clientes","financeiro","roi-day","pipeline","processos","central","rastreamento","super-agente","copy-ia","relatorios","whatsapp","integracoes","leads-capturados"],
  gp:         ["dashboard","tarefas","clientes","pipeline","processos","central","super-agente","copy-ia","relatorios"],
  gt:         ["dashboard","tarefas","clientes","pipeline","processos","central","super-agente","copy-ia","relatorios","integracoes"],
}

export const SECTION_LABELS: Record<string, string> = {
  dashboard: "Dashboard", tarefas: "Tarefas", clientes: "Clientes",
  financeiro: "Financeiro", "roi-day": "ROI Day", pipeline: "Oportunidades", processos: "Processos",
  central: "Central", rastreamento: "Rastreamento", "super-agente": "Super Agente",
  "copy-ia": "Copy IA", relatorios: "Relatórios", whatsapp: "WhatsApp",
  integracoes: "Integrações", "leads-capturados": "Leads Capturados",
}

// Sections that need can_view_financials regardless of role or custom overrides.
const FINANCIAL_ONLY_SECTIONS = ["financeiro", "roi-day"]

// Sections always available regardless of role or custom overrides.
export const ALWAYS_ALLOWED = ["home", "profile", "settings"] as const

export function getAllowedSections(profile: Pick<Profile, "role" | "custom_sections" | "can_view_financials"> | null | undefined): string[] {
  if (!profile) return []
  const base = profile.custom_sections ?? SECTION_ACCESS[profile.role] ?? []
  // Financeiro and ROI Day show client fees/investment/revenue — restricted
  // to specifically-flagged users regardless of role, not just admin/coord.
  return profile.can_view_financials ? base : base.filter((s) => !FINANCIAL_ONLY_SECTIONS.includes(s))
}

export function canAccessSection(profile: Pick<Profile, "role" | "custom_sections" | "can_view_financials"> | null | undefined, section: string): boolean {
  if ((ALWAYS_ALLOWED as readonly string[]).includes(section)) return true
  return getAllowedSections(profile).includes(section)
}

export function isAdminOrCoordenador(profile: Pick<Profile, "role"> | null | undefined): boolean {
  return profile?.role === "admin" || profile?.role === "coordenador"
}
