import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Playbook, PlaybookStep, WorkflowTrigger } from '../lib/database.types'

export function usePlaybooks() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPlaybooks = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('playbooks')
      .select('*')
      .is('deleted_at', null)
      .order('name')
    setPlaybooks(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchPlaybooks() }, [fetchPlaybooks])

  async function createPlaybook(input: Omit<Playbook, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>) {
    const { data, error } = await supabase.from('playbooks').insert(input).select().single()
    if (error) return { error: error.message }
    setPlaybooks((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    return { data }
  }

  async function getSteps(playbookId: string): Promise<PlaybookStep[]> {
    const { data } = await supabase
      .from('playbook_steps')
      .select('*')
      .eq('playbook_id', playbookId)
      .order('sort_order')
    return data ?? []
  }

  async function addStep(step: Omit<PlaybookStep, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('playbook_steps').insert(step).select().single()
    if (error) return { error: error.message }
    return { data }
  }

  async function updateStep(id: string, updates: Partial<PlaybookStep>) {
    const { data, error } = await supabase.from('playbook_steps').update(updates).eq('id', id).select().single()
    if (error) return { error: error.message }
    return { data }
  }

  async function deleteStep(id: string) {
    const { error } = await supabase.from('playbook_steps').delete().eq('id', id)
    return { error: error?.message }
  }

  // Geração automática de tarefas a partir de um playbook
  async function generateTasks({
    playbookId,
    clientId,
    quarterId,
    triggerDate,
    triggeredBy,
  }: {
    playbookId: string
    clientId: string
    quarterId?: string
    triggerDate: Date
    triggeredBy: string
  }): Promise<{ tasksCreated: number; error?: string }> {
    // 1. Cria o workflow_trigger
    const { data: trigger, error: triggerError } = await supabase
      .from('workflow_triggers')
      .insert({
        playbook_id: playbookId,
        client_id: clientId,
        quarter_id: quarterId ?? null,
        trigger_type: 'manual',
        trigger_date: triggerDate.toISOString().split('T')[0],
        triggered_by: triggeredBy,
        status: 'pending',
        tasks_generated: 0,
      } as WorkflowTrigger)
      .select()
      .single()

    if (triggerError) return { tasksCreated: 0, error: triggerError.message }

    // 2. Busca os passos
    const steps = await getSteps(playbookId)
    if (steps.length === 0) return { tasksCreated: 0, error: 'Playbook sem passos configurados' }

    // 3. Busca os assignments do cliente para mapear roles → user_id
    const { data: assignments } = await supabase
      .from('client_assignments')
      .select('user_id, cadeira')
      .eq('client_id', clientId)
      .eq('is_active', true)

    const roleToUser: Record<string, string> = {}
    for (const a of assignments ?? []) roleToUser[a.cadeira] = a.user_id

    // 4. Processa passos raiz primeiro, depois sub-passos.
    // Root steps don't depend on each other, and sub-steps only depend on
    // their own parent's task id (not on siblings) — both batches can fire
    // their inserts concurrently instead of awaiting one row at a time.
    const rootSteps = steps.filter((s) => !s.parent_step_id)
    const stepIdToTaskId: Record<string, string> = {}
    let tasksCreated = 0

    const rootResults = await Promise.all(rootSteps.map(async (step) => {
      const deadline = new Date(triggerDate)
      deadline.setDate(deadline.getDate() + step.days_offset)

      const { data: task } = await supabase
        .from('tasks')
        .insert({
          client_id: clientId,
          quarter_id: quarterId ?? null,
          playbook_step_id: step.id,
          workflow_trigger_id: trigger.id,
          title: step.title,
          description: step.description,
          status: 'backlog',
          priority: step.priority,
          assignee_id: roleToUser[step.assignee_role] ?? null,
          deadline: deadline.toISOString().split('T')[0],
          estimated_hours: step.estimated_hours,
          data_source: 'manual',
          created_by: triggeredBy,
          sort_order: step.sort_order,
        } as never)
        .select()
        .single()

      return { step, task }
    }))

    for (const { step, task } of rootResults) {
      if (task) {
        stepIdToTaskId[step.id] = task.id
        tasksCreated++
      }
    }

    // Sub-tarefas
    const subSteps = steps.filter((s) => s.parent_step_id)
    await Promise.all(subSteps.map((step) => {
      const deadline = new Date(triggerDate)
      deadline.setDate(deadline.getDate() + step.days_offset)
      const parentTaskId = step.parent_step_id ? stepIdToTaskId[step.parent_step_id] : null

      return supabase.from('tasks').insert({
        client_id: clientId,
        quarter_id: quarterId ?? null,
        playbook_step_id: step.id,
        workflow_trigger_id: trigger.id,
        parent_task_id: parentTaskId,
        title: step.title,
        description: step.description,
        status: 'backlog',
        priority: step.priority,
        assignee_id: roleToUser[step.assignee_role] ?? null,
        deadline: deadline.toISOString().split('T')[0],
        estimated_hours: step.estimated_hours,
        data_source: 'manual',
        created_by: triggeredBy,
        sort_order: step.sort_order,
      } as never)
    }))
    tasksCreated += subSteps.length

    // 5. Atualiza o trigger com o resultado
    await supabase
      .from('workflow_triggers')
      .update({ status: 'completed', tasks_generated: tasksCreated })
      .eq('id', trigger.id)

    return { tasksCreated }
  }

  return { playbooks, loading, fetchPlaybooks, createPlaybook, getSteps, addStep, updateStep, deleteStep, generateTasks }
}
