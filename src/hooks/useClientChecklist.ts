import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { ClientChecklist } from '../lib/database.types'

export function useClientChecklist(clientId: string) {
  const [items, setItems] = useState<ClientChecklist[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    setItems([])
    const { data, error } = await supabase
      .from('client_checklist')
      .select('*')
      .eq('client_id', clientId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) console.error('Failed to fetch client_checklist:', error.message)
    setItems(data ?? [])
    setLoading(false)
  }, [clientId])

  useEffect(() => { refetch() }, [refetch])

  async function addItem(title: string, category: string | null, createdBy: string) {
    const sortOrder = items.length
    const { data, error } = await supabase
      .from('client_checklist')
      .insert({ client_id: clientId, title, category, sort_order: sortOrder, completed: false, created_by: createdBy })
      .select()
      .single()
    if (error) return { error: error.message }
    setItems((prev) => [...prev, data])
    return { data }
  }

  async function toggleItem(id: string, userId: string) {
    const item = items.find((i) => i.id === id)
    if (!item) return
    const completed = !item.completed
    const patch = completed
      ? { completed: true, completed_by: userId, completed_at: new Date().toISOString() }
      : { completed: false, completed_by: null, completed_at: null }
    const { data, error } = await supabase
      .from('client_checklist')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) return { error: error.message }
    setItems((prev) => prev.map((i) => (i.id === id ? data : i)))
    return { data }
  }

  async function deleteItem(id: string) {
    const { error } = await supabase.from('client_checklist').delete().eq('id', id)
    if (error) return { error: error.message }
    setItems((prev) => prev.filter((i) => i.id !== id))
    return {}
  }

  const done = items.filter((i) => i.completed)
  const pending = items.filter((i) => !i.completed)

  return { items, done, pending, loading, refetch, addItem, toggleItem, deleteItem }
}
