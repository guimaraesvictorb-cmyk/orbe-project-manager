import type { Client } from "./database.types"

export const FLAG_META = {
  green:  { label: "Green",  color: "var(--success)", bg: "var(--success-tint)" },
  yellow: { label: "Yellow", color: "var(--warning)", bg: "var(--warning-tint)" },
  red:    { label: "Red",    color: "var(--danger)", bg: "var(--danger-tint)" },
} as const

export const STATUS_META: Record<Client["status"], { label: string; color: string }> = {
  ativo:       { label: "Ativo",       color: "var(--success)" },
  pausado:     { label: "Pausado",     color: "var(--warning)" },
  em_risco:    { label: "Em Risco",    color: "var(--danger)" },
  offboarding: { label: "Offboarding", color: "#8B5CF6" },
  churned:     { label: "Churned",     color: "#525252" },
}
