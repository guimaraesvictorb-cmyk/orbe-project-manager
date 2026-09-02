import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { FinancialRecord } from '../lib/database.types'
import { todayLocal } from '../lib/formatters'

interface UseFinancialOptions {
  clientId?: string
  month?: string // 'YYYY-MM'
}

export function useFinancial(options: UseFinancialOptions = {}) {
  const [records, setRecords] = useState<FinancialRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('financial_records')
      .select('*')
      .is('deleted_at', null)
      .order('due_date', { ascending: false })

    if (options.clientId) query = query.eq('client_id', options.clientId)
    if (options.month) {
      const start = `${options.month}-01`
      const end = `${options.month}-31`
      query = query.gte('due_date', start).lte('due_date', end)
    }

    const { data } = await query
    setRecords(data ?? [])
    setLoading(false)
  }, [options.clientId, options.month])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  async function createRecord(input: Omit<FinancialRecord, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>) {
    const { data, error } = await supabase.from('financial_records').insert(input).select().single()
    if (error) return { error: error.message }
    setRecords((prev) => [data, ...prev])
    return { data }
  }

  async function updateRecord(id: string, updates: Partial<FinancialRecord>) {
    const { data, error } = await supabase.from('financial_records').update(updates).eq('id', id).select().single()
    if (error) return { error: error.message }
    setRecords((prev) => prev.map((r) => (r.id === id ? data : r)))
    return { data }
  }

  async function markAsPaid(id: string, paidDate?: string) {
    return updateRecord(id, {
      status: 'pago',
      paid_date: paidDate ?? todayLocal(),
    })
  }

  const totalAmount = records.reduce((s, r) => s + r.amount, 0)
  const totalPaid = records.filter((r) => r.status === 'pago').reduce((s, r) => s + r.amount, 0)
  const totalPending = records.filter((r) => r.status === 'pendente').reduce((s, r) => s + r.amount, 0)
  const totalOverdue = records.filter((r) => r.status === 'atrasado').reduce((s, r) => s + r.amount, 0)

  return { records, loading, fetchRecords, createRecord, updateRecord, markAsPaid, totalAmount, totalPaid, totalPending, totalOverdue }
}
