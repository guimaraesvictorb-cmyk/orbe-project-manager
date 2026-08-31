import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type ActivityType = 'task_completed' | 'client_created' | 'payment_paid'

export interface ActivityItem {
  id: string
  type: ActivityType
  title: string
  subtitle: string
  timestamp: string
}

export function useActivityFeed(limit = 15) {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)

    const [tasksRes, clientsRes, paymentsRes] = await Promise.all([
      supabase.from('tasks').select('id,title,completed_at,client_id')
        .not('completed_at', 'is', null).is('deleted_at', null)
        .order('completed_at', { ascending: false }).limit(limit),
      supabase.from('clients').select('id,name,created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }).limit(limit),
      supabase.from('financial_records').select('id,amount,paid_date,client_id')
        .eq('status', 'pago').not('paid_date', 'is', null).is('deleted_at', null)
        .order('paid_date', { ascending: false }).limit(limit),
    ])

    const clientIds = new Set<string>()
    tasksRes.data?.forEach((t) => t.client_id && clientIds.add(t.client_id))
    paymentsRes.data?.forEach((p) => p.client_id && clientIds.add(p.client_id))

    const { data: clientRows } = clientIds.size
      ? await supabase.from('clients').select('id,name').in('id', Array.from(clientIds))
      : { data: [] as { id: string; name: string }[] }
    const nameById = new Map((clientRows ?? []).map((c) => [c.id, c.name]))

    const merged: ActivityItem[] = [
      ...(tasksRes.data ?? []).map((t) => ({
        id: `task-${t.id}`, type: 'task_completed' as const,
        title: t.title, subtitle: nameById.get(t.client_id) ?? 'Sem cliente',
        timestamp: t.completed_at as string,
      })),
      ...(clientsRes.data ?? []).map((c) => ({
        id: `client-${c.id}`, type: 'client_created' as const,
        title: c.name, subtitle: 'Novo cliente na carteira',
        timestamp: c.created_at,
      })),
      ...(paymentsRes.data ?? []).map((p) => ({
        id: `payment-${p.id}`, type: 'payment_paid' as const,
        title: `R$ ${Number(p.amount).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
        subtitle: nameById.get(p.client_id) ?? 'Sem cliente',
        timestamp: p.paid_date as string,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)

    setItems(merged)
    setLoading(false)
  }, [limit])

  useEffect(() => { load() }, [load])

  return { items, loading, refresh: load }
}
