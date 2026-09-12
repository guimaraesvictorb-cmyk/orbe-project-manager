import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Payable, Payee } from '../lib/database.types'
import { todayLocal } from '../lib/formatters'

interface UsePayablesOptions {
  month?: string // 'YYYY-MM'
}

export function usePayables(options: UsePayablesOptions = {}) {
  const [records, setRecords] = useState<Payable[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('payables')
      .select('*')
      .is('deleted_at', null)
      .order('due_date', { ascending: false })

    if (options.month) {
      const start = `${options.month}-01`
      const end = `${options.month}-31`
      query = query.gte('due_date', start).lte('due_date', end)
    }

    const { data, error } = await query
    if (error) console.error('usePayables.fetchRecords', error)
    setRecords(data ?? [])
    setLoading(false)
  }, [options.month])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  async function createRecord(input: Omit<Payable, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>) {
    const { data, error } = await supabase.from('payables').insert(input).select().single()
    if (error) { console.error('usePayables.createRecord', error); return { error: error.message } }
    setRecords((prev) => [data, ...prev])
    return { data }
  }

  async function updateRecord(id: string, updates: Partial<Payable>) {
    const { data, error } = await supabase.from('payables').update(updates).eq('id', id).select().single()
    if (error) { console.error('usePayables.updateRecord', error); return { error: error.message } }
    setRecords((prev) => prev.map((r) => (r.id === id ? data : r)))
    return { data }
  }

  async function markAsPaid(id: string, paidDate?: string) {
    return updateRecord(id, { status: 'pago', paid_date: paidDate ?? todayLocal() })
  }

  const totalAmount = records.reduce((s, r) => s + r.amount, 0)
  const totalPaid = records.filter((r) => r.status === 'pago').reduce((s, r) => s + r.amount, 0)
  const totalPending = records.filter((r) => r.status === 'pendente').reduce((s, r) => s + r.amount, 0)
  const totalOverdue = records.filter((r) => r.status === 'atrasado').reduce((s, r) => s + r.amount, 0)

  return { records, loading, fetchRecords, createRecord, updateRecord, markAsPaid, totalAmount, totalPaid, totalPending, totalOverdue }
}

export function usePayees() {
  const [payees, setPayees] = useState<Payee[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPayees = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('payees')
      .select('*')
      .is('deleted_at', null)
      .order('name', { ascending: true })
    if (error) console.error('usePayees.fetchPayees', error)
    setPayees(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchPayees() }, [fetchPayees])

  async function createPayee(input: Omit<Payee, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>) {
    const { data, error } = await supabase.from('payees').insert(input).select().single()
    if (error) { console.error('usePayees.createPayee', error); return { error: error.message } }
    setPayees((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    return { data }
  }

  async function updatePayee(id: string, updates: Partial<Payee>) {
    const { data, error } = await supabase.from('payees').update(updates).eq('id', id).select().single()
    if (error) { console.error('usePayees.updatePayee', error); return { error: error.message } }
    setPayees((prev) => prev.map((p) => (p.id === id ? data : p)))
    return { data }
  }

  async function deletePayee(id: string) {
    const { error } = await supabase.from('payees').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) { console.error('usePayees.deletePayee', error); return { error: error.message } }
    setPayees((prev) => prev.filter((p) => p.id !== id))
    return {}
  }

  return { payees, loading, fetchPayees, createPayee, updatePayee, deletePayee }
}
