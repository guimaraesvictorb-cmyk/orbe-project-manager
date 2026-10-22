import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { ClientPresentation } from '../lib/database.types'

const TEMPLATE_BUCKET = 'orbe-templates'
const TEMPLATE_PATH = 'modelo-padrao-apresentacao-resultados.pptx'
const PRESENTATIONS_BUCKET = 'orbe-presentations'

// Modelo padrão de apresentação de resultados (ORBE_Modelo_Generico_Logo_
// Corrigido.pptx) — guardado uma única vez em storage; o botão "Baixar
// modelo padrão" e o "Usar modelo" (que copia, sem editar, pro histórico do
// cliente) partem os dois daqui.
export function usePresentationTemplate() {
  async function downloadTemplateUrl() {
    const { data, error } = await supabase.storage.from(TEMPLATE_BUCKET).createSignedUrl(TEMPLATE_PATH, 60)
    if (error) return { error: error.message }
    return { url: data.signedUrl }
  }

  return { downloadTemplateUrl }
}

// Histórico de cópias do modelo geradas por cliente/mês — RLS do banco já
// restringe o que cada papel enxerga (admin/coordenador veem tudo, GT/GP só
// os clientes atribuídos a eles), então basta buscar sem filtro extra aqui.
export function useClientPresentations() {
  const [items, setItems] = useState<ClientPresentation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('client_presentations')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('useClientPresentations.fetchItems', error)
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  // Copia os bytes originais do modelo (sem reescrever o PPTX — zero risco
  // de corromper o arquivo) pra uma pasta por cliente, com um nome de
  // arquivo opaco; a identidade "ORBE | Cliente | Fechamento Mês/Ano" fica
  // só no título salvo no banco, que é o que aparece e o que vira o nome do
  // download. A página de guia interno e os números fictícios continuam no
  // arquivo — removê-los antes de apresentar pro cliente é o passo manual
  // descrito na orientação da tela.
  async function createFromTemplate(client: { id: string; name: string }, period: string, userId: string) {
    const [year, month] = period.split('-')
    const destPath = `${client.id}/${period}-${Date.now()}.pptx`
    const { error: copyError } = await supabase.storage
      .from(TEMPLATE_BUCKET)
      .copy(TEMPLATE_PATH, destPath, { destinationBucket: PRESENTATIONS_BUCKET })
    if (copyError) return { error: copyError.message }

    const monthLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    const title = `ORBE | ${client.name} | Fechamento ${monthLabel}`

    const { data, error } = await supabase
      .from('client_presentations')
      .insert({ client_id: client.id, period, storage_path: destPath, title, created_by: userId })
      .select()
      .single()
    if (error) return { error: error.message }
    setItems((prev) => [data, ...prev])
    return { data }
  }

  async function downloadUrl(storagePath: string) {
    const { data, error } = await supabase.storage.from(PRESENTATIONS_BUCKET).createSignedUrl(storagePath, 60)
    if (error) return { error: error.message }
    return { url: data.signedUrl }
  }

  return { items, loading, fetchItems, createFromTemplate, downloadUrl }
}
