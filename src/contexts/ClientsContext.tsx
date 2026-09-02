import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Client } from '../lib/database.types'

const ONBOARDING_STEPS = [
  // Dia 1
  { title: "Assinatura do contrato e recebimento da primeira parcela", category: "Dia 1 — Acessos & Contratos", sort_order: 0 },
  { title: "Solicitar acesso ao BM, Gerenciador de Anúncios e páginas", category: "Dia 1 — Acessos & Contratos", sort_order: 1 },
  { title: "Solicitar acesso ao Google Ads, Tag Manager e Analytics", category: "Dia 1 — Acessos & Contratos", sort_order: 2 },
  { title: "Acesso ao CRM, planilhas e WhatsApp comercial", category: "Dia 1 — Acessos & Contratos", sort_order: 3 },
  { title: "Criar pasta compartilhada do cliente no Drive", category: "Dia 1 — Acessos & Contratos", sort_order: 4 },
  // Dia 2
  { title: "Reunião de briefing: produto, persona, oferta e diferenciais", category: "Dia 2 — Briefing Profundo", sort_order: 5 },
  { title: "Mapear a jornada de compra atual", category: "Dia 2 — Briefing Profundo", sort_order: 6 },
  { title: "Levantar histórico de campanhas, resultados e criativos", category: "Dia 2 — Briefing Profundo", sort_order: 7 },
  { title: "Definir metas: CPL, ROAS e faturamento", category: "Dia 2 — Briefing Profundo", sort_order: 8 },
  // Dia 3
  { title: "Auditoria de pixel, eventos e configurações", category: "Dia 3 — Diagnóstico & Estratégia", sort_order: 9 },
  { title: "Análise da concorrência", category: "Dia 3 — Diagnóstico & Estratégia", sort_order: 10 },
  { title: "Definição de estrutura de campanhas e públicos", category: "Dia 3 — Diagnóstico & Estratégia", sort_order: 11 },
  { title: "Aprovação da estratégia com o cliente", category: "Dia 3 — Diagnóstico & Estratégia", sort_order: 12 },
  // Dia 4
  { title: "Roteiros de 5 criativos", category: "Dia 4 — Criativos & Copy", sort_order: 13 },
  { title: "Briefing para designer/editor", category: "Dia 4 — Criativos & Copy", sort_order: 14 },
  { title: "Copy de anúncios e landing page", category: "Dia 4 — Criativos & Copy", sort_order: 15 },
  { title: "Aprovação dos criativos com o cliente", category: "Dia 4 — Criativos & Copy", sort_order: 16 },
  // Dia 5
  { title: "Instalação e validação de Pixel + Conversions API", category: "Dia 5 — Setup Técnico", sort_order: 17 },
  { title: "Configuração de UTMs", category: "Dia 5 — Setup Técnico", sort_order: 18 },
  { title: "Criação de públicos personalizados e lookalikes", category: "Dia 5 — Setup Técnico", sort_order: 19 },
  { title: "Montagem da estrutura de campanhas em pausa", category: "Dia 5 — Setup Técnico", sort_order: 20 },
  // Dia 6
  { title: "Checklist de QA: orçamento, públicos, criativos e links", category: "Dia 6 — Revisão Final", sort_order: 21 },
  { title: "Teste de fluxo: clique → landing page → conversão", category: "Dia 6 — Revisão Final", sort_order: 22 },
  { title: "Alinhamento da comunicação e frequência de relatórios", category: "Dia 6 — Revisão Final", sort_order: 23 },
  // Dia 7
  { title: "Ativação das campanhas", category: "Dia 7 — Lançamento", sort_order: 24 },
  { title: "Envio da mensagem de lançamento ao cliente", category: "Dia 7 — Lançamento", sort_order: 25 },
  { title: "Monitoramento intensivo nas primeiras 48h", category: "Dia 7 — Lançamento", sort_order: 26 },
  { title: "Agendamento da reunião semanal de acompanhamento", category: "Dia 7 — Lançamento", sort_order: 27 },
]

function onboardingDayOffset(category: string): number {
  const m = category.match(/Dia (\d+)/)
  return m ? parseInt(m[1], 10) : 1
}

async function generateOnboardingTasks(clientId: string, createdBy: string) {
  const today = new Date()
  const rows = ONBOARDING_STEPS.map((step) => {
    const deadline = new Date(today)
    deadline.setDate(deadline.getDate() + onboardingDayOffset(step.category))
    return {
      client_id: clientId,
      title: step.title,
      description: step.category,
      status: 'backlog' as const,
      priority: 'media' as const,
      deadline: deadline.toISOString().split('T')[0],
      sort_order: step.sort_order,
      data_source: 'onboarding',
      created_by: createdBy,
    }
  })
  const { error } = await supabase.from('tasks').insert(rows)
  if (error) throw error
}

interface ClientsContextValue {
  clients: Client[]
  loading: boolean
  error: string | null
  fetchClients: () => Promise<void>
  createClient: (input: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'data_source'>) => Promise<{ data?: Client; error?: string }>
  updateClient: (id: string, updates: Partial<Client>) => Promise<{ data?: Client; error?: string }>
  deleteClient: (id: string) => Promise<{ error?: string }>
  fetchDeletedClients: () => Promise<Client[]>
  restoreClient: (id: string) => Promise<{ data?: Client; error?: string }>
  updateHealthFlag: (id: string, health_flag: Client['health_flag']) => Promise<{ data?: Client; error?: string }>
  updateStatus: (id: string, status: Client['status']) => Promise<{ data?: Client; error?: string }>
}

const ClientsContext = createContext<ClientsContextValue | null>(null)

export function ClientsProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchClients = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .is('deleted_at', null)
      .order('name')

    if (error) setError(error.message)
    else setClients(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchClients() }, [fetchClients])

  async function createClient(input: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'data_source'>) {
    const { data, error } = await supabase.from('clients').insert({ ...input, data_source: 'manual' }).select().single()
    if (error) return { error: error.message }
    setClients((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    // Auto-create onboarding checklist (fire-and-forget, don't block return, but don't swallow failures silently)
    supabase.from('client_checklist').insert(
      ONBOARDING_STEPS.map((step) => ({
        client_id: data.id,
        title: step.title,
        category: step.category,
        sort_order: step.sort_order,
        completed: false,
        created_by: input.created_by,
      }))
    ).then(({ error: checklistError }) => {
      if (checklistError) console.error('Failed to create onboarding checklist:', checklistError.message)
    })
    if (input.status === 'ativo') {
      generateOnboardingTasks(data.id, input.created_by).catch((err) =>
        console.error('Failed to generate onboarding tasks:', err)
      )
    }
    return { data }
  }

  async function updateClient(id: string, updates: Partial<Client>) {
    const { data, error } = await supabase.from('clients').update(updates).eq('id', id).select().single()
    if (error) return { error: error.message }
    setClients((prev) => prev.map((c) => (c.id === id ? data : c)))
    return { data }
  }

  async function deleteClient(id: string) {
    const { error } = await supabase.from('clients').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) return { error: error.message }
    setClients((prev) => prev.filter((c) => c.id !== id))
    return {}
  }

  async function fetchDeletedClients() {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    if (error) console.error('Failed to fetch deleted clients:', error.message)
    return data ?? []
  }

  async function restoreClient(id: string) {
    const { data, error } = await supabase.from('clients').update({ deleted_at: null }).eq('id', id).select().single()
    if (error) return { error: error.message }
    setClients((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    return { data }
  }

  async function updateHealthFlag(id: string, health_flag: Client['health_flag']) {
    return updateClient(id, { health_flag })
  }

  async function updateStatus(id: string, status: Client['status']) {
    const current = clients.find((c) => c.id === id)
    const result = await updateClient(id, { status })
    if (current && current.status !== 'ativo' && status === 'ativo') {
      try {
        const { count } = await supabase.from('tasks').select('id', { count: 'exact', head: true })
          .eq('client_id', id).eq('data_source', 'onboarding')
        if (!count) await generateOnboardingTasks(id, current.created_by)
      } catch (err) {
        console.error('Failed to generate onboarding tasks on status change:', err)
      }
    }
    return result
  }

  return (
    <ClientsContext.Provider value={{ clients, loading, error, fetchClients, createClient, updateClient, deleteClient, fetchDeletedClients, restoreClient, updateHealthFlag, updateStatus }}>
      {children}
    </ClientsContext.Provider>
  )
}

export function useClientsContext() {
  const ctx = useContext(ClientsContext)
  if (!ctx) throw new Error('useClientsContext must be used within a ClientsProvider')
  return ctx
}
