import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Task, TaskRecurrence } from '../lib/database.types'

const RECURRENCE_DAYS: Record<Exclude<TaskRecurrence, 'nenhuma'>, number> = {
  diaria: 1,
  semanal: 7,
  quinzenal: 14,
  mensal: 30,
}

function nextDeadline(deadline: string | null, recurrence: TaskRecurrence): string | null {
  if (recurrence === 'nenhuma') return deadline
  const base = deadline ? new Date(deadline + 'T00:00:00') : new Date()
  base.setDate(base.getDate() + RECURRENCE_DAYS[recurrence])
  return base.toISOString().split('T')[0]
}

interface UseTasksOptions {
  clientId?: string
  quarterId?: string
  assigneeId?: string
}

export function useTasks(options: UseTasksOptions = {}) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('tasks')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (options.clientId) query = query.eq('client_id', options.clientId)
    if (options.quarterId) query = query.eq('quarter_id', options.quarterId)
    if (options.assigneeId) query = query.eq('assignee_id', options.assigneeId)

    const { data } = await query
    setTasks(data ?? [])
    setLoading(false)
  }, [options.clientId, options.quarterId, options.assigneeId])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  async function createTask(input: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'completed_at'>) {
    const { data, error } = await supabase.from('tasks').insert(input).select().single()
    if (error) return { error: error.message }
    setTasks((prev) => [data, ...prev])
    return { data }
  }

  async function updateTask(id: string, updates: Partial<Task>) {
    const extra: Partial<Task> = {}
    if (updates.status === 'concluido') extra.completed_at = new Date().toISOString()
    const { data, error } = await supabase.from('tasks').update({ ...updates, ...extra }).eq('id', id).select().single()
    if (error) return { error: error.message }
    setTasks((prev) => prev.map((t) => (t.id === id ? data : t)))

    if (updates.status === 'concluido' && data.recurrence !== 'nenhuma') {
      const {
        id: _id, created_at: _created_at, updated_at: _updated_at,
        completed_at: _completed_at, deleted_at: _deleted_at,
        ...rest
      } = data as Task
      void _id; void _created_at; void _updated_at; void _completed_at; void _deleted_at
      await createTask({
        ...rest,
        status: 'backlog',
        deadline: nextDeadline(data.deadline, data.recurrence),
      })
    }

    return { data }
  }

  async function deleteTask(id: string) {
    const { error } = await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) return { error: error.message }
    setTasks((prev) => prev.filter((t) => t.id !== id))
    return {}
  }

  return { tasks, loading, fetchTasks, createTask, updateTask, deleteTask }
}
