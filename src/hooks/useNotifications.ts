import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTasks } from './useTasks'
import { useClients } from './useClients'

export type NotificationType = 'task_overdue' | 'client_at_risk'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  subtitle: string
  targetId: string
}

const DISMISSED_KEY = 'orbe_dismissed_notifications'

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function saveDismissed(set: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(set)))
}

export function useNotifications() {
  const { tasks, loading: tasksLoading } = useTasks({})
  const { clients, loading: clientsLoading } = useClients()
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed())

  useEffect(() => { saveDismissed(dismissed) }, [dismissed])

  const clientNameById = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients])

  const all = useMemo<AppNotification[]>(() => {
    const today = new Date(new Date().toDateString())

    const overdue: AppNotification[] = tasks
      .filter((t) => t.deadline && t.status !== 'concluido' && t.status !== 'cancelado' && new Date(t.deadline) < today)
      .map((t) => ({
        id: `task_overdue-${t.id}`,
        type: 'task_overdue' as const,
        title: t.title,
        subtitle: clientNameById.get(t.client_id) ?? 'Sem cliente',
        targetId: t.id,
      }))

    const atRisk: AppNotification[] = clients
      .filter((c) => c.health_flag === 'red' || c.health_flag === 'yellow')
      .map((c) => ({
        id: `client_at_risk-${c.id}`,
        type: 'client_at_risk' as const,
        title: c.name,
        subtitle: c.health_flag === 'red' ? 'Cliente em risco' : 'Cliente precisa de atenção',
        targetId: c.id,
      }))

    return [...overdue, ...atRisk]
  }, [tasks, clients, clientNameById])

  // Drop dismissed ids that no longer correspond to an active notification
  // (task completed, client health restored) so localStorage doesn't grow forever.
  useEffect(() => {
    if (tasksLoading || clientsLoading) return
    const currentIds = new Set(all.map((n) => n.id))
    setDismissed((prev) => {
      const next = new Set(Array.from(prev).filter((id) => currentIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [all, tasksLoading, clientsLoading])

  const visible = all.filter((n) => !dismissed.has(n.id))

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set(prev).add(id))
  }, [])

  const dismissAll = useCallback(() => {
    setDismissed((prev) => {
      const next = new Set(prev)
      visible.forEach((n) => next.add(n.id))
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  return { notifications: visible, dismiss, dismissAll }
}
