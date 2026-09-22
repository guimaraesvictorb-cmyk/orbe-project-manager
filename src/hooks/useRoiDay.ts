import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { RoiDayClient, RoiDayInvestment, RoiDayInvestmentTarget, RoiDayPlatform } from '../lib/database.types'

export function useRoiDay() {
  const [rows, setRows] = useState<RoiDayClient[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('roi_day_clients')
      .select('*')
      .order('period', { ascending: false })
      .order('name', { ascending: true })
    if (error) console.error('Failed to fetch roi_day_clients:', error.message)
    setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  async function addRow(name: string, period: string, createdBy: string, clientId?: string | null) {
    const { data, error } = await supabase
      .from('roi_day_clients')
      .insert({ name, period, created_by: createdBy, client_id: clientId ?? null })
      .select()
      .single()
    if (error) { console.error('Failed to add roi_day_clients row:', error.message); return { error: error.message } }
    setRows((prev) => [...prev, data])
    return { data }
  }

  // Starts a new month for a client by copying its most recent entry (static
  // facts like localização/stakeholder rarely change; the team then edits
  // the metrics that did).
  async function addMonthFromPrevious(prev: RoiDayClient, newPeriod: string, createdBy: string) {
    const { id, created_at, updated_at, ...rest } = prev
    void id; void created_at; void updated_at
    const { data, error } = await supabase
      .from('roi_day_clients')
      .insert({ ...rest, period: newPeriod, created_by: createdBy })
      .select()
      .single()
    if (error) { console.error('Failed to copy roi_day_clients row to new month:', error.message); return { error: error.message } }
    setRows((prevRows) => [...prevRows, data])
    return { data }
  }

  async function updateRow(id: string, patch: Partial<RoiDayClient>) {
    const { data, error } = await supabase
      .from('roi_day_clients')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) { console.error('Failed to update roi_day_clients row:', error.message); return { error: error.message } }
    setRows((prev) => prev.map((r) => (r.id === id ? data : r)))
    return { data }
  }

  async function deleteRow(id: string) {
    const { error } = await supabase.from('roi_day_clients').delete().eq('id', id)
    if (error) { console.error('Failed to delete roi_day_clients row:', error.message); return { error: error.message } }
    setRows((prev) => prev.filter((r) => r.id !== id))
    return {}
  }

  return { rows, loading, refetch, addRow, addMonthFromPrevious, updateRow, deleteRow }
}

// Investimento realizado por plataforma (Meta, Google, LinkedIn, TikTok...)
// para um mês de um cliente — o total soma automaticamente em
// roi_day_clients.inv_realizado (ver RoiDayView, que chama updateRow depois
// de cada mudança aqui) em vez de exigir digitar o total à mão.
export function useRoiDayInvestments() {
  const [investments, setInvestments] = useState<RoiDayInvestment[]>([])
  const [loading, setLoading] = useState(true)

  const fetchInvestments = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('roi_day_investments').select('*')
    if (error) console.error('Failed to fetch roi_day_investments:', error.message)
    setInvestments(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchInvestments() }, [fetchInvestments])

  function investmentsFor(roiDayClientId: string) {
    return investments.filter((i) => i.roi_day_client_id === roiDayClientId)
  }

  async function setInvestment(roiDayClientId: string, platform: RoiDayPlatform, amount: number) {
    if (amount <= 0) {
      const { error } = await supabase
        .from('roi_day_investments')
        .delete()
        .eq('roi_day_client_id', roiDayClientId)
        .eq('platform', platform)
      if (error) { console.error('Failed to delete roi_day_investments row:', error.message); return { error: error.message } }
      setInvestments((prev) => prev.filter((i) => !(i.roi_day_client_id === roiDayClientId && i.platform === platform)))
      return {}
    }
    const { data, error } = await supabase
      .from('roi_day_investments')
      .upsert({ roi_day_client_id: roiDayClientId, platform, amount }, { onConflict: 'roi_day_client_id,platform' })
      .select()
      .single()
    if (error) { console.error('Failed to upsert roi_day_investments row:', error.message); return { error: error.message } }
    setInvestments((prev) => {
      const idx = prev.findIndex((i) => i.roi_day_client_id === roiDayClientId && i.platform === platform)
      if (idx === -1) return [...prev, data]
      const next = [...prev]
      next[idx] = data
      return next
    })
    return { data }
  }

  return { investments, loading, fetchInvestments, investmentsFor, setInvestment }
}

// Espelha useRoiDayInvestments, só que pro lado da META por plataforma —
// junto com o realizado, forma a aba "Investimento por Cliente"; o total
// soma automaticamente em roi_day_clients.inv_meta.
export function useRoiDayInvestmentTargets() {
  const [targets, setTargets] = useState<RoiDayInvestmentTarget[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTargets = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('roi_day_investment_targets').select('*')
    if (error) console.error('Failed to fetch roi_day_investment_targets:', error.message)
    setTargets(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTargets() }, [fetchTargets])

  function targetsFor(roiDayClientId: string) {
    return targets.filter((t) => t.roi_day_client_id === roiDayClientId)
  }

  async function setTarget(roiDayClientId: string, platform: RoiDayPlatform, amount: number) {
    if (amount <= 0) {
      const { error } = await supabase
        .from('roi_day_investment_targets')
        .delete()
        .eq('roi_day_client_id', roiDayClientId)
        .eq('platform', platform)
      if (error) { console.error('Failed to delete roi_day_investment_targets row:', error.message); return { error: error.message } }
      setTargets((prev) => prev.filter((t) => !(t.roi_day_client_id === roiDayClientId && t.platform === platform)))
      return {}
    }
    const { data, error } = await supabase
      .from('roi_day_investment_targets')
      .upsert({ roi_day_client_id: roiDayClientId, platform, amount }, { onConflict: 'roi_day_client_id,platform' })
      .select()
      .single()
    if (error) { console.error('Failed to upsert roi_day_investment_targets row:', error.message); return { error: error.message } }
    setTargets((prev) => {
      const idx = prev.findIndex((t) => t.roi_day_client_id === roiDayClientId && t.platform === platform)
      if (idx === -1) return [...prev, data]
      const next = [...prev]
      next[idx] = data
      return next
    })
    return { data }
  }

  return { targets, loading, fetchTargets, targetsFor, setTarget }
}
