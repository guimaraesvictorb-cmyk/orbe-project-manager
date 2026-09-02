import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Quarter } from '../lib/database.types'

export function useQuarters(clientId?: string) {
  const [quarters, setQuarters] = useState<Quarter[]>([])
  const [loading, setLoading] = useState(true)

  const fetchQuarters = useCallback(async () => {
    if (!clientId) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('quarters')
      .select('*')
      .eq('client_id', clientId)
      .order('period_start', { ascending: false })
    if (error) console.error('Failed to fetch quarters:', error.message)
    setQuarters(data ?? [])
    setLoading(false)
  }, [clientId])

  useEffect(() => { fetchQuarters() }, [fetchQuarters])

  async function createQuarter(input: Omit<Quarter, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('quarters').insert(input).select().single()
    if (error) return { error: error.message }
    setQuarters((prev) => [data, ...prev])
    return { data }
  }

  async function updateQuarter(id: string, updates: Partial<Quarter>) {
    const { data, error } = await supabase.from('quarters').update(updates).eq('id', id).select().single()
    if (error) return { error: error.message }
    setQuarters((prev) => prev.map((q) => (q.id === id ? data : q)))
    return { data }
  }

  return { quarters, loading, fetchQuarters, createQuarter, updateQuarter }
}
