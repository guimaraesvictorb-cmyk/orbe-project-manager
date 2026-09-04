import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { RoiDayClient } from '../lib/database.types'

export function useRoiDay() {
  const [rows, setRows] = useState<RoiDayClient[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('roi_day_clients')
      .select('*')
      .order('fee', { ascending: false, nullsFirst: false })
    if (error) console.error('Failed to fetch roi_day_clients:', error.message)
    setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  async function addRow(name: string, createdBy: string) {
    const { data, error } = await supabase
      .from('roi_day_clients')
      .insert({ name, created_by: createdBy })
      .select()
      .single()
    if (error) return { error: error.message }
    setRows((prev) => [...prev, data])
    return { data }
  }

  async function updateRow(id: string, patch: Partial<RoiDayClient>) {
    const { data, error } = await supabase
      .from('roi_day_clients')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) return { error: error.message }
    setRows((prev) => prev.map((r) => (r.id === id ? data : r)))
    return { data }
  }

  async function deleteRow(id: string) {
    const { error } = await supabase.from('roi_day_clients').delete().eq('id', id)
    if (error) return { error: error.message }
    setRows((prev) => prev.filter((r) => r.id !== id))
    return {}
  }

  return { rows, loading, refetch, addRow, updateRow, deleteRow }
}
