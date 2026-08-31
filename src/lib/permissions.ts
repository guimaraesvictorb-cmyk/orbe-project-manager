import type { Profile } from "./database.types"

export const SECTION_ACCESS: Record<string, string[]> = {
  admin:      ["dashboard","tarefas","clientes","financeiro","pipeline","processos","central","rastreamento","super-agente","copy-ia","relatorios","whatsapp","integracoes","leads-capturados"],
  coordenador:["dashboard","tarefas","clientes","financeiro","pipeline","processos","central","rastreamento","super-agente","copy-ia","relatorios","whatsapp","integracoes","leads-capturados"],
  gp:         ["dashboard","tarefas","clientes","pipeline","processos","central","super-agente","copy-ia","relatorios"],
  gt:         ["dashboard","tarefas","clientes","pipeline","processos","central","super-agente","copy-ia","relatorios","integracoes"],
}

export const SECTION_LABELS: Record<string, string> = {
  dashboard: "Dashboard", tarefas: "Tarefas", clientes: "Clientes",
  financeiro: "Financeiro", pipeline: "Oportunidades", processos: "Processos",
  central: "Central", rastreamento: "Rastreamento", "super-agente": "Super Agente",
  "copy-ia": "Copy IA", relatorios: "Relatórios", whatsapp: "WhatsApp",
  integracoes: "Integrações", "leads-capturados": "Leads Capturados",
}

// Sections always available regardless of role or custom overrides.
export const ALWAYS_ALLOWED = ["home", "profile", "settings"] as const

export function getAllowedSections(profile: Pick<Profile, "role" | "custom_sections"> | null | undefined): string[] {
  if (!profile) return []
  return profile.custom_sections ?? SECTION_ACCESS[profile.role] ?? []
}

export function canAccessSection(profile: Pick<Profile, "role" | "custom_sections"> | null | undefined, section: string): boolean {
  if ((ALWAYS_ALLOWED as readonly string[]).includes(section)) return true
  return getAllowedSections(profile).includes(section)
}
