import type { Client } from "./database.types"

export const FLAG_META = {
  green:  { label: "Green",  color: "#22C55E", bg: "#0f2117" },
  yellow: { label: "Yellow", color: "#F59E0B", bg: "#1a1200" },
  red:    { label: "Red",    color: "#EF4444", bg: "#1a0505" },
} as const

export const STATUS_META: Record<Client["status"], { label: string; color: string }> = {
  ativo:       { label: "Ativo",       color: "#22C55E" },
  pausado:     { label: "Pausado",     color: "#F59E0B" },
  em_risco:    { label: "Em Risco",    color: "#EF4444" },
  offboarding: { label: "Offboarding", color: "#8B5CF6" },
  churned:     { label: "Churned",     color: "#525252" },
}
