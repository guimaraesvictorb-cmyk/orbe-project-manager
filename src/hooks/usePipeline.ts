import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Lead, PipelineStage, LeadActivity } from '../lib/database.types'

export function usePipeline() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: leadsData, error: leadsError }, { data: stagesData, error: stagesError }] = await Promise.all([
      supabase.from('leads').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('pipeline_stages').select('*').order('sort_order'),
    ])
    if (leadsError) console.error('Failed to fetch leads:', leadsError.message)
    if (stagesError) console.error('Failed to fetch pipeline_stages:', stagesError.message)
    setLeads(leadsData ?? [])
    setStages(stagesData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function createLead(input: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>) {
    const { data, error } = await supabase.from('leads').insert(input).select().single()
    if (error) return { error: error.message }
    setLeads((prev) => [data, ...prev])
    return { data }
  }

  async function updateLead(id: string, updates: Partial<Lead>) {
    const { data, error } = await supabase.from('leads').update(updates).eq('id', id).select().single()
    if (error) return { error: error.message }
    setLeads((prev) => prev.map((l) => (l.id === id ? data : l)))
    return { data }
  }

  async function moveLeadToStage(leadId: string, newStageId: string, oldStageId: string, userId: string) {
    const result = await updateLead(leadId, { stage_id: newStageId })
    if (!result.error) {
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        type: 'stage_change',
        old_stage_id: oldStageId,
        new_stage_id: newStageId,
        created_by: userId,
      } as LeadActivity)
    }
    return result
  }

  async function addActivity(activity: Omit<LeadActivity, 'id' | 'created_at'>) {
    const { data, error } = await supabase.from('lead_activities').insert(activity).select().single()
    if (error) return { error: error.message }
    return { data }
  }

  async function getActivities(leadId: string): Promise<LeadActivity[]> {
    const { data, error } = await supabase
      .from('lead_activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
    if (error) console.error('Failed to fetch lead_activities:', error.message)
    return data ?? []
  }

  async function convertToClient(leadId: string, clientId: string) {
    return updateLead(leadId, { converted_to_client_id: clientId })
  }

  const totalPotentialMrr = leads
    .filter((l) => !l.converted_to_client_id)
    .reduce((s, l) => s + (l.potential_mrr ?? 0), 0)

  const weightedMrr = leads
    .filter((l) => !l.converted_to_client_id)
    .reduce((s, l) => s + ((l.potential_mrr ?? 0) * l.probability) / 100, 0)

  return { leads, stages, loading, fetchAll, createLead, updateLead, moveLeadToStage, addActivity, getActivities, convertToClient, totalPotentialMrr, weightedMrr }
}
