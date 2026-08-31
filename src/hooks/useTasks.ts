import { useMemo } from 'react'
import { useTasksContext } from '../contexts/TasksContext'

interface UseTasksOptions {
  clientId?: string
  quarterId?: string
  assigneeId?: string
}

export function useTasks(options: UseTasksOptions = {}) {
  const { allTasks, loading, fetchTasks, createTask, updateTask, deleteTask } = useTasksContext()

  const tasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (options.clientId && t.client_id !== options.clientId) return false
      if (options.quarterId && t.quarter_id !== options.quarterId) return false
      if (options.assigneeId && t.assignee_id !== options.assigneeId) return false
      return true
    })
  }, [allTasks, options.clientId, options.quarterId, options.assigneeId])

  return { tasks, loading, fetchTasks, createTask, updateTask, deleteTask }
}
