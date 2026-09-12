import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type {
  CompanySettings, ToolSubscription, CompanyInvestment,
  TeamCost, TeamAllocation, Contract, ProfitWithdrawal,
} from '../lib/database.types'

export function useCompanySettings() {
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('company_settings').select('*').eq('id', 'default').single()
    if (error) console.error('useCompanySettings.fetchSettings', error)
    setSettings(data ?? null)
    setLoading(false)
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  async function updateSettings(updates: Partial<CompanySettings>) {
    const { data, error } = await supabase.from('company_settings').update(updates).eq('id', 'default').select().single()
    if (error) { console.error('useCompanySettings.updateSettings', error); return { error: error.message } }
    setSettings(data)
    return { data }
  }

  return { settings, loading, updateSettings }
}

function makeCrudHook<T extends { id: string; deleted_at?: string | null }>(table: string, orderBy: string, ascending = false, hasSoftDelete = true) {
  return function useCrud() {
    const [items, setItems] = useState<T[]>([])
    const [loading, setLoading] = useState(true)

    const fetchItems = useCallback(async () => {
      setLoading(true)
      let query = supabase.from(table).select('*').order(orderBy, { ascending })
      if (hasSoftDelete) query = query.is('deleted_at', null)
      const { data, error } = await query
      if (error) console.error(`useCrud(${table}).fetchItems`, error)
      setItems((data as T[]) ?? [])
      setLoading(false)
    }, [])

    useEffect(() => { fetchItems() }, [fetchItems])

    async function createItem(input: Record<string, unknown>) {
      const { data, error } = await supabase.from(table).insert(input).select().single()
      if (error) { console.error(`useCrud(${table}).createItem`, error); return { error: error.message } }
      setItems((prev) => [data as T, ...prev])
      return { data }
    }

    async function updateItem(id: string, updates: Record<string, unknown>) {
      const { data, error } = await supabase.from(table).update(updates).eq('id', id).select().single()
      if (error) { console.error(`useCrud(${table}).updateItem`, error); return { error: error.message } }
      setItems((prev) => prev.map((i) => (i.id === id ? (data as T) : i)))
      return { data }
    }

    async function softDeleteItem(id: string) {
      const { error } = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) { console.error(`useCrud(${table}).softDeleteItem`, error); return { error: error.message } }
      setItems((prev) => prev.filter((i) => i.id !== id))
      return {}
    }

    async function hardDeleteItem(id: string) {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) { console.error(`useCrud(${table}).hardDeleteItem`, error); return { error: error.message } }
      setItems((prev) => prev.filter((i) => i.id !== id))
      return {}
    }

    return { items, loading, fetchItems, createItem, updateItem, softDeleteItem, hardDeleteItem }
  }
}

export const useToolsSubscriptions = makeCrudHook<ToolSubscription>('tools_subscriptions', 'name', true)
export const useCompanyInvestments = makeCrudHook<CompanyInvestment>('company_investments', 'invested_at', false)
export const useTeamCosts = makeCrudHook<TeamCost>('team_costs', 'person_name', true)
export const useContracts = makeCrudHook<Contract>('contracts', 'end_date', true)
export const useProfitWithdrawals = makeCrudHook<ProfitWithdrawal>('profit_withdrawals', 'withdrawal_date', false, false)

export function useTeamAllocations() {
  const [allocations, setAllocations] = useState<TeamAllocation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAllocations = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('team_allocations').select('*')
    if (error) console.error('useTeamAllocations.fetchAllocations', error)
    setAllocations(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAllocations() }, [fetchAllocations])

  async function createAllocation(input: Omit<TeamAllocation, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase.from('team_allocations').insert(input).select().single()
    if (error) { console.error('useTeamAllocations.createAllocation', error); return { error: error.message } }
    setAllocations((prev) => [...prev, data])
    return { data }
  }

  async function updateAllocation(id: string, updates: Partial<TeamAllocation>) {
    const { data, error } = await supabase.from('team_allocations').update(updates).eq('id', id).select().single()
    if (error) { console.error('useTeamAllocations.updateAllocation', error); return { error: error.message } }
    setAllocations((prev) => prev.map((a) => (a.id === id ? data : a)))
    return { data }
  }

  async function deleteAllocation(id: string) {
    const { error } = await supabase.from('team_allocations').delete().eq('id', id)
    if (error) { console.error('useTeamAllocations.deleteAllocation', error); return { error: error.message } }
    setAllocations((prev) => prev.filter((a) => a.id !== id))
    return {}
  }

  return { allocations, loading, fetchAllocations, createAllocation, updateAllocation, deleteAllocation }
}
