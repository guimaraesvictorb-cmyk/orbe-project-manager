import { useMemo } from 'react'
import { useClients } from './useClients'
import { useTasks } from './useTasks'
import { useFinancial } from './useFinancial'
import type { Client } from '../lib/database.types'

export interface HealthSuggestion {
  clientId: string
  suggestedFlag: Exclude<Client['health_flag'], 'green'>
  reason: string
}

// Only worth surfacing when a client still shows "green" but the underlying
// signals (overdue tasks, overdue payments) say otherwise — a client already
// marked yellow/red isn't being silently missed, so there's nothing to suggest.
export function useHealthSuggestions(): Record<string, HealthSuggestion> {
  const { clients } = useClients()
  const { tasks } = useTasks({})
  const { records } = useFinancial({})

  return useMemo(() => {
    const today = new Date(new Date().toDateString())
    const map: Record<string, HealthSuggestion> = {}

    for (const client of clients) {
      if (client.status !== 'ativo' || client.health_flag !== 'green') continue

      const overdueTasks = tasks.filter(
        (t) => t.client_id === client.id && t.deadline && new Date(t.deadline) < today &&
          t.status !== 'concluido' && t.status !== 'cancelado'
      )
      const overduePayments = records.filter((r) => r.client_id === client.id && r.status === 'atrasado')

      if (overduePayments.length > 0 || overdueTasks.length >= 3) {
        const parts: string[] = []
        if (overduePayments.length > 0) parts.push('pagamento atrasado')
        if (overdueTasks.length > 0) parts.push(`${overdueTasks.length} tarefas atrasadas`)
        map[client.id] = { clientId: client.id, suggestedFlag: 'red', reason: parts.join(' + ') }
      } else if (overdueTasks.length > 0) {
        map[client.id] = { clientId: client.id, suggestedFlag: 'yellow', reason: `${overdueTasks.length} tarefa${overdueTasks.length > 1 ? 's' : ''} atrasada${overdueTasks.length > 1 ? 's' : ''}` }
      }
    }

    return map
  }, [clients, tasks, records])
}
