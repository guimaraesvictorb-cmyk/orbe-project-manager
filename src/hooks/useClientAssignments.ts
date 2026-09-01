import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { ClientAssignment } from '../lib/database.types'

export function useClientAssignments(clientId: string) {
  const [assignments, setAssignments] = useState<ClientAssignment[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAssignments = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    const { data } = await supabase
      .from('client_assignments')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
    setAssignments(data ?? [])
    setLoading(false)
  }, [clientId])

  useEffect(() => { fetchAssignments() }, [fetchAssignments])

  async function assign(userId: string, cadeira: string, assignedBy: string) {
    const { data, error } = await supabase
      .from('client_assignments')
      .upsert(
        { client_id: clientId, user_id: userId, cadeira, assigned_by: assignedBy, is_active: true },
        { onConflict: 'client_id,user_id' }
      )
      .select()
      .single()
    if (error) return { error: error.message }
    setAssignments((prev) => [...prev.filter((a) => a.user_id !== userId), data])
    return { data }
  }

  async function unassign(assignmentId: string) {
    const { error } = await supabase.from('client_assignments').update({ is_active: false }).eq('id', assignmentId)
    if (error) return { error: error.message }
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId))
    return {}
  }

  return { assignments, loading, assign, unassign }
}
