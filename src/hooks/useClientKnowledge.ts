import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface KnowledgeEntry {
  id: string
  client_id: string
  title: string
  content: string
  source: 'manual' | 'ai_suggested' | 'web'
  validated: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export function useClientKnowledge(clientId: string) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    setEntries([])
    const { data, error } = await supabase
      .from('client_knowledge')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    if (error) console.error('Failed to fetch client_knowledge:', error.message)
    setEntries(data ?? [])
    setLoading(false)
  }, [clientId])

  useEffect(() => { refetch() }, [refetch])

  async function addEntry(entry: Omit<KnowledgeEntry, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('client_knowledge').insert(entry).select().single()
    if (error) return { error: error.message }
    setEntries((prev) => [data, ...prev])
    return { data }
  }

  async function validateEntry(id: string) {
    const { data, error } = await supabase
      .from('client_knowledge').update({ validated: true }).eq('id', id).select().single()
    if (error) return { error: error.message }
    setEntries((prev) => prev.map((e) => e.id === id ? data : e))
    return { data }
  }

  async function deleteEntry(id: string) {
    const { error } = await supabase.from('client_knowledge').delete().eq('id', id)
    if (error) return { error: error.message }
    setEntries((prev) => prev.filter((e) => e.id !== id))
    return {}
  }

  const validated = entries.filter((e) => e.validated)
  const pending = entries.filter((e) => !e.validated)

  return { validated, pending, loading, refetch, addEntry, validateEntry, deleteEntry }
}
