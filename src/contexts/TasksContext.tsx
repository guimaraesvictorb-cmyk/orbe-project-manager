import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
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

interface TasksContextValue {
  allTasks: Task[]
  loading: boolean
  fetchTasks: () => Promise<void>
  createTask: (input: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'completed_at'>) => Promise<{ data?: Task; error?: string }>
  updateTask: (id: string, updates: Partial<Task>) => Promise<{ data?: Task; error?: string }>
  deleteTask: (id: string) => Promise<{ error?: string }>
}

const TasksContext = createContext<TasksContextValue | null>(null)

export function TasksProvider({ children }: { children: ReactNode }) {
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    setAllTasks(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  async function createTask(input: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'completed_at'>) {
    const { data, error } = await supabase.from('tasks').insert(input).select().single()
    if (error) return { error: error.message }
    setAllTasks((prev) => [data, ...prev])
    return { data }
  }

  async function updateTask(id: string, updates: Partial<Task>) {
    const extra: Partial<Task> = {}
    if (updates.status === 'concluido') extra.completed_at = new Date().toISOString()
    const { data, error } = await supabase.from('tasks').update({ ...updates, ...extra }).eq('id', id).select().single()
    if (error) return { error: error.message }
    setAllTasks((prev) => prev.map((t) => (t.id === id ? data : t)))

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
    setAllTasks((prev) => prev.filter((t) => t.id !== id))
    return {}
  }

  return (
    <TasksContext.Provider value={{ allTasks, loading, fetchTasks, createTask, updateTask, deleteTask }}>
      {children}
    </TasksContext.Provider>
  )
}

export function useTasksContext() {
  const ctx = useContext(TasksContext)
  if (!ctx) throw new Error('useTasksContext must be used within a TasksProvider')
  return ctx
}
