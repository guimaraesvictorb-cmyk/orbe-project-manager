import { useState, useRef, useEffect, useMemo } from "react"
import {
  ArrowLeft, Globe, User, Phone, Mail, DollarSign, Tag,
  Plus, Check, Trash2, Brain, Send, Loader2, Sparkles,
  BookOpen, X, ListChecks, Calendar, Share2, Copy, Link,
  Pencil, Save, Hash, Users,
} from "lucide-react"
import type { Client, Profile } from "../lib/database.types"
import { supabase } from "../lib/supabase"
import { useClientKnowledge, type KnowledgeEntry } from "../hooks/useClientKnowledge"
import { useClientChecklist } from "../hooks/useClientChecklist"
import { useShareTokens } from "../hooks/useShareTokens"
import { useClientAssignments } from "../hooks/useClientAssignments"
import { isAdminOrCoordenador } from "../lib/permissions"
import { useAuth } from "../hooks/useAuth"
import { FLAG_META, STATUS_META } from "../lib/clientMeta"
import { getGroqApiKey, GROQ_MODEL, GROQ_API_URL } from "../lib/groq"
import { AdsMetricsTab } from "./ads/AdsMetricsTab"
import { CompiladoTab } from "./ads/CompiladoTab"
import { MetaAdsLiveTab } from "./ads/MetaAdsLiveTab"

const ROLE_LABELS: Record<string, string> = { gt: "Gestor de Tráfego", gp: "Gestor de Projetos" }

const SOURCE_META = {
  manual:       { label: "Manual", color: "#2563EB", bg: "#0a0f1a" },
  ai_suggested: { label: "IA",     color: "#8B5CF6", bg: "#0f0a1a" },
  web:          { label: "Web",    color: "var(--warning)", bg: "#1a1200" },
}

type Tab = "overview" | "checklist" | "meta" | "google" | "compilado" | "knowledge" | "ai"

interface ChatMessage { role: "user" | "assistant"; content: string }

function Field({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="grid grid-cols-[160px_1fr] items-start gap-4 py-3" style={{ borderBottom: "1px solid var(--bg-surface-2)" }}>
      <p className="text-xs pt-0.5" style={{ color: "var(--text-tertiary)" }}>{label}</p>
      <div className="text-sm text-[var(--text-primary)]">{value}</div>
    </div>
  )
}

function KnowledgeCard({ entry, onValidate, onDelete }: {
  entry: KnowledgeEntry
  onValidate?: () => void
  onDelete: () => void
}) {
  const src = SOURCE_META[entry.source]
  return (
    <div className="rounded-xl p-4 border" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">{entry.title}</p>
            <span
              className="text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded"
              style={{ backgroundColor: src.bg, color: src.color }}
            >
              {src.label}
            </span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-tertiary)" }}>{entry.content}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onValidate && (
            <button
              onClick={onValidate}
              title="Validar"
              className="p-1.5 rounded-lg transition-colors hover:bg-[var(--accent-tint)]"
              style={{ color: "var(--accent)" }}
            >
              <Check size={14} />
            </button>
          )}
          <button
            onClick={onDelete}
            title="Excluir"
            className="p-1.5 rounded-lg transition-colors hover:text-red-500"
            style={{ color: "var(--text-quaternary)" }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function AddEntryModal({ onClose, onSave }: {
  onClose: () => void
  onSave: (title: string, content: string) => Promise<void>
}) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    setSaving(true)
    await onSave(title.trim(), content.trim())
    setSaving(false)
    onClose()
  }

  const inputCls = "w-full rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent-a44)] transition-colors"
  const inputStyle = { backgroundColor: "var(--bg-input)", border: "1px solid var(--border-strong)" }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-strong)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-[var(--text-primary)] font-semibold text-sm">Adicionar Informação</h3>
          <button onClick={onClose} style={{ color: "var(--text-tertiary)" }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Título</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Produto principal, Público-alvo..."
              required
              className={inputCls}
              style={inputStyle}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Conteúdo</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Descreva a informação com detalhes..."
              required
              rows={4}
              className={`${inputCls} resize-none`}
              style={inputStyle}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-semibold border" style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !content.trim()}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ClientAI({ client, validated }: { client: Client; validated: KnowledgeEntry[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  const systemPrompt = useMemo(() => {
    const knowledgeText = validated.length
      ? "\n\nBase de conhecimento validada:\n" + validated.map((e) => `- ${e.title}: ${e.content}`).join("\n")
      : ""
    return `Você é o assistente de IA dedicado ao cliente "${client.name}" da agência Orbe Marketing.
Responda SEMPRE em português brasileiro. Seja objetivo, profissional e focado em marketing digital.

Dados do cliente:
- Nome: ${client.name}
- Segmento: ${client.segment ?? "não informado"}
- Status: ${STATUS_META[client.status].label}
- Mensalidade: ${client.monthly_fee ? `R$ ${client.monthly_fee.toLocaleString("pt-BR")}` : "não informado"}
- Contato: ${client.primary_contact_name ?? "não informado"}
- Website: ${client.website ?? "não informado"}${knowledgeText}

Use APENAS as informações acima. Não invente dados. Se não souber algo sobre o cliente, diga que a informação não foi cadastrada.`
  }, [client, validated])

  const apiKey = useMemo(() => getGroqApiKey(), [])

  async function sendMessage(userMsg: string) {
    if (!userMsg.trim() || streaming || !apiKey) return
    setError("")

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: userMsg }]
    setMessages(newMessages)
    setInput("")
    setStreaming(true)

    abortRef.current = new AbortController()

    try {
      const res = await fetch(GROQ_API_URL, {
        method: "POST",
        signal: abortRef.current.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          stream: true,
          messages: [{ role: "system", content: systemPrompt }, ...newMessages],
        }),
      })

      if (!res.ok || !res.body) throw new Error(`Erro ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let assistantText = ""
      setMessages((prev) => [...prev, { role: "assistant", content: "" }])

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          const data = line.replace(/^data: /, "").trim()
          if (!data || data === "[DONE]") continue
          try {
            const delta = JSON.parse(data).choices?.[0]?.delta?.content ?? ""
            if (delta) {
              assistantText += delta
              setMessages((prev) => {
                const copy = [...prev]
                copy[copy.length - 1] = { role: "assistant", content: assistantText }
                return copy
              })
            }
          } catch { /* malformed SSE frame — skip */ }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        setError("Erro ao conectar com a IA. Tente novamente.")
        setMessages((prev) => prev.filter((_, i) => i < prev.length - 1 || prev[i].role !== "assistant" || prev[i].content))
      }
    } finally {
      setStreaming(false)
    }
  }

  if (!apiKey) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-xs">
          <Brain size={32} className="mx-auto mb-3" style={{ color: "var(--text-quaternary)" }} />
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">IA não configurada</p>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            Configure sua chave Groq no assistente principal (aba Home) para ativar a IA por cliente.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl mb-4" style={{ backgroundColor: "var(--accent-tint)", border: "1px solid var(--accent-tint)" }}>
        <BookOpen size={12} style={{ color: "var(--accent)" }} />
        <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          IA especializada em <span className="text-[var(--text-primary)] font-medium">{client.name}</span> —{" "}
          {validated.length} {validated.length === 1 ? "informação validada" : "informações validadas"}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1" style={{ minHeight: 0 }}>
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Brain size={28} className="mx-auto mb-3" style={{ color: "#222" }} />
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">IA do Cliente</p>
            <p className="text-xs" style={{ color: "var(--text-quaternary)" }}>
              Pergunte qualquer coisa sobre {client.name}. Uso apenas informações validadas.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="rounded-2xl px-4 py-3 text-sm max-w-[85%] leading-relaxed whitespace-pre-wrap"
              style={
                msg.role === "user"
                  ? { backgroundColor: "var(--accent-tint)", color: "var(--text-primary)", borderBottomRightRadius: 4 }
                  : { backgroundColor: "var(--bg-surface-2)", color: "#ddd", borderBottomLeftRadius: 4 }
              }
            >
              {msg.content || (streaming && i === messages.length - 1
                ? <span className="inline-flex gap-1 items-center">
                    <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                : null
              )}
            </div>
          </div>
        ))}
        {error && <p className="text-xs text-center" style={{ color: "var(--danger)" }}>{error}</p>}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); sendMessage(input) }}
        className="flex items-center gap-2 mt-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Pergunte sobre ${client.name}...`}
          disabled={streaming}
          className="flex-1 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent-a44)] transition-colors"
          style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-strong)" }}
        />
        <button
          type="submit"
          disabled={!input.trim() || streaming}
          className="p-3 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
          style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  )
}

interface ClientDetailViewProps {
  client: Client
  onBack: () => void
  onDelete?: () => Promise<void>
  onUpdate?: (updates: Partial<Client>) => Promise<{ data?: Client; error?: string }>
}

const OVERVIEW_FIELDS: Array<{ key: keyof Client; label: string; type: string; placeholder?: string }> = [
  { key: "primary_contact_name", label: "Contato", type: "text", placeholder: "Nome do contato" },
  { key: "primary_contact_email", label: "E-mail", type: "email", placeholder: "email@empresa.com" },
  { key: "primary_contact_phone", label: "Telefone", type: "text", placeholder: "(11) 99999-9999" },
  { key: "website", label: "Website", type: "text", placeholder: "https://..." },
  { key: "segment", label: "Segmento", type: "text", placeholder: "ecommerce, saas..." },
  { key: "tipo_servico", label: "Tipo de serviço", type: "text", placeholder: "Tráfego pago, Social..." },
  { key: "monthly_fee", label: "Mensalidade (R$)", type: "number" },
  { key: "monthly_investment", label: "Investimento em mídia (R$)", type: "number" },
  { key: "origem_lead", label: "Origem do lead", type: "text", placeholder: "Indicação, Instagram..." },
  { key: "proxima_reuniao", label: "Próxima reunião", type: "datetime-local" },
  { key: "contract_start", label: "Início do contrato", type: "date" },
  { key: "contract_end", label: "Fim do contrato", type: "date" },
  { key: "meta_ads_account_id", label: "ID conta Meta Ads", type: "text", placeholder: "act_..." },
  { key: "google_ads_account_id", label: "ID conta Google Ads", type: "text", placeholder: "XXX-XXX-XXXX" },
  { key: "ga4_property_id", label: "ID propriedade GA4", type: "text", placeholder: "properties/..." },
]

export function ClientDetailView({ client, onBack, onDelete, onUpdate }: ClientDetailViewProps) {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>("overview")
  const [editingOverview, setEditingOverview] = useState(false)
  const [overviewForm, setOverviewForm] = useState<Partial<Client>>({})
  const [savingOverview, setSavingOverview] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAddChecklist, setShowAddChecklist] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [newItemTitle, setNewItemTitle] = useState("")
  const [newItemCategory, setNewItemCategory] = useState("")
  const [suggesting, setSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState("")
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [teamMembers, setTeamMembers] = useState<Profile[]>([])
  const { assignments, assign, unassign } = useClientAssignments(client.id)
  const { validated, pending, addEntry, validateEntry, deleteEntry } = useClientKnowledge(client.id)
  const { items, done, toggleItem, addItem, deleteItem } = useClientChecklist(client.id)
  const { tokens, createToken, deleteToken } = useShareTokens(client.id)

  useEffect(() => {
    supabase.from("profiles").select("*").in("role", ["gt", "gp"]).eq("is_active", true)
      .then(({ data }) => setTeamMembers(data ?? []))
  }, [])

  function copyShareLink(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}?share=${token}`)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  async function toggleAssignment(member: Profile) {
    const existing = assignments.find((a) => a.user_id === member.id)
    if (existing) await unassign(existing.id)
    else if (profile) await assign(member.id, member.role, profile.id)
  }

  const flag = FLAG_META[client.health_flag]
  const status = STATUS_META[client.status]
  const canEdit = isAdminOrCoordenador(profile)

  function startEditOverview() {
    setOverviewForm({ ...client, notes: client.notes ?? "" })
    setEditingOverview(true)
  }

  async function saveOverview() {
    if (!onUpdate) return
    setSavingOverview(true)
    const { monthly_fee, monthly_investment, ...rest } = overviewForm
    const feeStr = monthly_fee as unknown as string | number | null | undefined
    const investStr = monthly_investment as unknown as string | number | null | undefined
    await onUpdate({
      ...rest,
      monthly_fee: feeStr === "" || feeStr == null ? null : Number(feeStr),
      monthly_investment: investStr === "" || investStr == null ? null : Number(investStr),
    })
    setSavingOverview(false)
    setEditingOverview(false)
  }

  async function handleAddManual(title: string, content: string) {
    await addEntry({ client_id: client.id, title, content, source: "manual", validated: true, created_by: profile?.id ?? null })
  }

  async function handleAISuggest() {
    const apiKey = getGroqApiKey()
    if (!apiKey || suggesting) return
    setSuggesting(true)
    setSuggestError("")

    try {
      const res = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: "system",
              content: `Especialista em marketing digital. Dado um cliente de agência, sugira 3 informações relevantes para criar estratégias. Responda APENAS em JSON: [{"title": "...", "content": "..."}]. Nenhum texto fora do JSON.`,
            },
            {
              role: "user",
              content: `Cliente: ${client.name}\nSegmento: ${client.segment ?? "não informado"}\nWebsite: ${client.website ?? "não informado"}`,
            },
          ],
        }),
      })

      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const json = await res.json()
      const text: string = json.choices?.[0]?.message?.content ?? "[]"
      const match = text.match(/\[[\s\S]*\]/)
      if (!match) throw new Error("Resposta inválida da IA")

      const suggestions: Array<{ title: string; content: string }> = JSON.parse(match[0])
      await Promise.all(
        suggestions
          .filter((s) => s.title && s.content)
          .map((s) => addEntry({ client_id: client.id, title: s.title, content: s.content, source: "ai_suggested", validated: false, created_by: profile?.id ?? null }))
      )
    } catch (err: unknown) {
      setSuggestError((err as Error).message || "Erro ao gerar sugestões")
    } finally {
      setSuggesting(false)
    }
  }

  async function handleAddChecklistItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItemTitle.trim() || !profile) return
    await addItem(newItemTitle.trim(), newItemCategory || null, profile.id)
    setNewItemTitle("")
    setNewItemCategory("")
    setShowAddChecklist(false)
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "overview",   label: "Visão Geral" },
    { id: "checklist",  label: `Checklist${items.length ? ` (${done.length}/${items.length})` : ""}` },
    { id: "meta",       label: "Meta Ads" },
    { id: "google",     label: "Google Ads" },
    { id: "compilado",  label: "Compilado" },
    { id: "knowledge",  label: `Conhecimento${pending.length ? ` (${pending.length})` : ""}` },
    { id: "ai",         label: "IA" },
  ]

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--bg-page)" }}>
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
          <div className="rounded-2xl border w-full max-w-md" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Links de acesso do cliente</p>
              <button onClick={() => setShowShareModal(false)}><X size={16} style={{ color: "var(--text-tertiary)" }} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Gere um link para o cliente visualizar suas métricas de anúncios sem precisar fazer login.</p>
              <button onClick={() => createToken("Link do cliente")}
                className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>
                <Link size={13} />Gerar novo link
              </button>
              {tokens.length === 0 && (
                <p className="text-center text-xs py-4" style={{ color: "var(--text-quaternary)" }}>Nenhum link gerado ainda</p>
              )}
              {tokens.map((t) => (
                <div key={t.id} className="rounded-xl border p-3 flex items-center gap-3" style={{ borderColor: "var(--border)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">{t.label ?? "Link"}</p>
                    <p className="text-[10px] truncate" style={{ color: "var(--text-quaternary)" }}>{window.location.origin}?share={t.token}</p>
                    {t.expires_at && <p className="text-[10px]" style={{ color: "var(--danger)" }}>Expira: {new Date(t.expires_at).toLocaleDateString("pt-BR")}</p>}
                  </div>
                  <button onClick={() => copyShareLink(t.token)} className="p-1.5 rounded-lg transition-colors" style={{ color: copiedToken === t.token ? "var(--accent)" : "var(--text-tertiary)" }}>
                    {copiedToken === t.token ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button onClick={() => deleteToken(t.id)} className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-quaternary)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)" }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-quaternary)" }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-4 px-8 py-5" style={{ borderBottom: "1px solid var(--bg-surface-2)" }}>
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]"
          style={{ color: "var(--text-tertiary)" }}
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-primary)] text-sm font-bold flex-shrink-0"
            style={{ backgroundColor: "var(--accent-a22)", border: "1px solid var(--accent-a33)" }}
          >
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-[var(--text-primary)] font-semibold text-base leading-tight truncate">{client.name}</h1>
            {client.segment && <p className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>{client.segment}</p>}
          </div>
          <span
            className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded flex-shrink-0"
            style={{ backgroundColor: flag.bg, color: flag.color, border: `1px solid ${flag.color}33` }}
          >
            {flag.label}
          </span>
          <span className="text-[11px] font-medium flex-shrink-0" style={{ color: status.color }}>
            {status.label}
          </span>
          <button onClick={() => setShowShareModal(true)} className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors flex-shrink-0"
            style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent-a44)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)"; }}>
            <Share2 size={12} />Compartilhar
          </button>
          {canEdit && onDelete && (
            <button onClick={() => setConfirmingDelete(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors flex-shrink-0"
              style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#ef444444"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)"; }}>
              <Trash2 size={12} />Excluir cliente
            </button>
          )}
        </div>
      </div>

      {confirmingDelete && (
        <div className="flex items-center justify-between gap-3 px-8 py-3 flex-wrap" style={{ backgroundColor: "var(--danger-tint)", borderBottom: "1px solid #EF444422" }}>
          <p className="text-xs" style={{ color: "var(--danger)" }}>
            Excluir <strong>{client.name}</strong>? O cliente sai da carteira ativa, mas o histórico é preservado.
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setConfirmingDelete(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border"
              style={{ borderColor: "#333", color: "var(--text-secondary)" }}
            >
              <X size={11} />Cancelar
            </button>
            <button
              onClick={async () => { setDeleting(true); await onDelete?.(); }}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
              style={{ backgroundColor: "var(--danger)", color: "#000" }}
            >
              {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              Confirmar exclusão
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center px-8" style={{ borderBottom: "1px solid var(--bg-surface-2)" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-3 text-xs font-medium transition-colors relative"
            style={{ color: tab === t.id ? "var(--text-primary)" : "var(--text-tertiary)" }}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ backgroundColor: "var(--accent)" }} />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6" style={{ minHeight: 0 }}>

        {tab === "overview" && (
          <div className="max-w-2xl">
            {canEdit && (
              <div className="rounded-xl border p-4 mb-5" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Users size={12} style={{ color: "var(--text-tertiary)" }} />
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Equipe do cliente</p>
                </div>
                {teamMembers.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--text-quaternary)" }}>Nenhum GT/GP cadastrado ainda.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {teamMembers.map((member) => {
                      const isAssigned = assignments.some((a) => a.user_id === member.id)
                      return (
                        <button
                          key={member.id}
                          onClick={() => toggleAssignment(member)}
                          className="text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors"
                          style={{
                            backgroundColor: isAssigned ? "var(--accent-tint)" : "transparent",
                            color: isAssigned ? "var(--accent)" : "var(--text-quaternary)",
                            borderColor: isAssigned ? "var(--accent-a33)" : "var(--border-strong)",
                          }}
                        >
                          {isAssigned && <Check size={9} className="inline mr-1" />}
                          {member.display_name} · {ROLE_LABELS[member.role] ?? member.role}
                        </button>
                      )
                    })}
                  </div>
                )}
                <p className="text-[10px] mt-2" style={{ color: "var(--text-quaternary)" }}>
                  Só quem estiver marcado aqui vê esse cliente e suas tarefas (Admin/Coordenador sempre veem tudo).
                </p>
              </div>
            )}

            {canEdit && onUpdate && (
              <div className="flex justify-end mb-4">
                {editingOverview ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditingOverview(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border" style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}>
                      <X size={12} />Cancelar
                    </button>
                    <button onClick={saveOverview} disabled={savingOverview} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>
                      {savingOverview ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      Salvar
                    </button>
                  </div>
                ) : (
                  <button onClick={startEditOverview} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors" style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent-a44)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)"; }}>
                    <Pencil size={12} />Editar informações
                  </button>
                )}
              </div>
            )}

            {editingOverview ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {OVERVIEW_FIELDS.map((f) => (
                    <div key={f.key} className={f.type === "datetime-local" || f.key === "meta_ads_account_id" || f.key === "google_ads_account_id" || f.key === "ga4_property_id" ? "col-span-2 sm:col-span-1" : ""}>
                      <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>{f.label}</label>
                      <input
                        type={f.type}
                        value={(overviewForm[f.key] as string | number | null | undefined) ?? ""}
                        onChange={(e) => setOverviewForm((form) => ({ ...form, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-quaternary)] focus:outline-none transition-colors"
                        style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-strong)" }}
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>Observações</label>
                  <textarea
                    value={overviewForm.notes ?? ""}
                    onChange={(e) => setOverviewForm((form) => ({ ...form, notes: e.target.value }))}
                    rows={4}
                    placeholder="Notas internas sobre o cliente..."
                    className="w-full rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-quaternary)] focus:outline-none transition-colors resize-none"
                    style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-strong)" }}
                  />
                </div>
              </div>
            ) : (
              <>
                <Field label={<><User size={11} className="inline mr-1" />Contato</>}         value={client.primary_contact_name} />
                <Field label={<><Mail size={11} className="inline mr-1" />E-mail</>}           value={client.primary_contact_email && <a href={`mailto:${client.primary_contact_email}`} style={{ color: "var(--accent)" }}>{client.primary_contact_email}</a>} />
                <Field label={<><Phone size={11} className="inline mr-1" />Telefone</>}        value={client.primary_contact_phone} />
                <Field label={<><Globe size={11} className="inline mr-1" />Website</>}         value={client.website && <a href={client.website} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>{client.website.replace(/^https?:\/\//, "")}</a>} />
                <Field label={<><Tag size={11} className="inline mr-1" />Segmento</>}          value={client.segment} />
                <Field label={<><DollarSign size={11} className="inline mr-1" />Mensalidade</>} value={client.monthly_fee && <span style={{ color: "var(--accent)" }} className="font-medium">R$ {client.monthly_fee.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>} />
                <Field label={<><DollarSign size={11} className="inline mr-1" />Investimento em mídia</>} value={client.monthly_investment && <span className="font-medium">R$ {client.monthly_investment.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>} />
                <Field label={<><Tag size={11} className="inline mr-1" />Tipo de serviço</>}   value={client.tipo_servico} />
                <Field label="Origem do lead"      value={client.origem_lead} />
                <Field label={<><Calendar size={11} className="inline mr-1" />Próxima reunião</>} value={client.proxima_reuniao && new Date(client.proxima_reuniao).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} />
                <Field label="Início do contrato" value={client.contract_start && new Date(client.contract_start).toLocaleDateString("pt-BR")} />
                <Field label="Fim do contrato" value={client.contract_end && new Date(client.contract_end).toLocaleDateString("pt-BR")} />
                <Field label={<><Hash size={11} className="inline mr-1" />ID conta Meta Ads</>} value={client.meta_ads_account_id} />
                <Field label={<><Hash size={11} className="inline mr-1" />ID conta Google Ads</>} value={client.google_ads_account_id} />
                <Field label={<><Hash size={11} className="inline mr-1" />ID propriedade GA4</>} value={client.ga4_property_id} />
                {client.notes && (
                  <div className="py-4" style={{ borderBottom: "1px solid var(--bg-surface-2)" }}>
                    <p className="text-xs mb-2" style={{ color: "var(--text-tertiary)" }}>Observações</p>
                    <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{client.notes}</p>
                  </div>
                )}
                {!client.primary_contact_name && !client.website && !client.segment && !client.monthly_fee && !client.notes && (
                  <div className="text-center py-12">
                    <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Nenhum dado adicional</p>
                    <p className="text-xs" style={{ color: "var(--text-quaternary)" }}>{canEdit ? "Clique em \"Editar informações\" para preencher." : "As informações do cliente aparecerão aqui"}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "checklist" && (
          <div className="max-w-2xl space-y-4">
            {/* Progress bar */}
            {items.length > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  <span>{done.length} de {items.length} concluídos</span>
                  <span>{Math.round((done.length / items.length) * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${(done.length / items.length) * 100}%`, backgroundColor: "var(--accent)" }}
                  />
                </div>
              </div>
            )}

            {/* Add item form */}
            {canEdit && !showAddChecklist && (
              <button
                onClick={() => setShowAddChecklist(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg"
                style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}
              >
                <Plus size={13} />
                Adicionar item
              </button>
            )}

            {showAddChecklist && (
              <form onSubmit={handleAddChecklistItem} className="flex gap-2 items-end">
                <div className="flex-1 space-y-2">
                  <input
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    placeholder="Título do item..."
                    required
                    autoFocus
                    className="w-full rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent-a44)] transition-colors"
                    style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-strong)" }}
                  />
                  <input
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    placeholder="Categoria (opcional)"
                    className="w-full rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent-a44)] transition-colors"
                    style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-strong)" }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <button type="submit" className="px-3 py-2 rounded-lg text-xs font-semibold" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>
                    Salvar
                  </button>
                  <button type="button" onClick={() => setShowAddChecklist(false)} className="px-3 py-2 rounded-lg text-xs border" style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}>
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {/* Items list */}
            {items.length === 0 ? (
              <div className="rounded-xl border border-[var(--border)] py-16 text-center" style={{ backgroundColor: "var(--bg-surface)" }}>
                <ListChecks size={28} className="mx-auto mb-3" style={{ color: "#222" }} />
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Checklist vazio</p>
                <p className="text-xs" style={{ color: "var(--text-quaternary)" }}>Adicione itens para acompanhar o progresso do cliente</p>
              </div>
            ) : (
              <div className="space-y-1">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl group"
                    style={{ backgroundColor: item.completed ? "var(--bg-input)" : "var(--bg-surface-2)" }}
                  >
                    <button
                      onClick={() => profile && toggleItem(item.id, profile.id)}
                      className="w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-all"
                      style={{
                        backgroundColor: item.completed ? "var(--accent)" : "transparent",
                        borderColor: item.completed ? "var(--accent)" : "var(--border-subtle)",
                      }}
                    >
                      {item.completed && <Check size={11} color="var(--bg-page)" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: item.completed ? "var(--text-quaternary)" : "var(--text-primary)", textDecoration: item.completed ? "line-through" : "none" }}>
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.category && (
                          <span className="text-[10px] font-medium" style={{ color: "var(--text-tertiary)" }}>{item.category}</span>
                        )}
                        {item.completed_at && (
                          <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--text-quaternary)" }}>
                            <Calendar size={9} />
                            {new Date(item.completed_at).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all hover:text-red-500"
                        style={{ color: "var(--text-quaternary)" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "meta"      && <MetaAdsLiveTab client={client} />}
        {tab === "google"    && <AdsMetricsTab clientId={client.id} platform="google" />}
        {tab === "compilado" && <CompiladoTab clientId={client.id} />}

        {tab === "knowledge" && (
          <div className="max-w-2xl space-y-6">
            {canEdit && (
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold"
                  style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}
                >
                  <Plus size={13} />
                  Adicionar informação
                </button>
                <button
                  onClick={handleAISuggest}
                  disabled={suggesting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50"
                  style={{ borderColor: "#8B5CF633", color: "#8B5CF6", backgroundColor: "var(--accent-tint)" }}
                >
                  {suggesting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {suggesting ? "Gerando sugestões..." : "Sugerir com IA"}
                </button>
                {suggestError && <p className="text-xs w-full" style={{ color: "var(--danger)" }}>{suggestError}</p>}
              </div>
            )}

            {pending.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#8B5CF6" }}>
                  Aguardando validação ({pending.length})
                </p>
                <div className="space-y-3">
                  {pending.map((entry) => (
                    <KnowledgeCard
                      key={entry.id}
                      entry={entry}
                      onValidate={canEdit ? () => validateEntry(entry.id) : undefined}
                      onDelete={() => deleteEntry(entry.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              {validated.length > 0 && (
                <>
                  <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--accent)" }}>
                    Validado ({validated.length})
                  </p>
                  <div className="space-y-3">
                    {validated.map((entry) => (
                      <KnowledgeCard key={entry.id} entry={entry} onDelete={() => deleteEntry(entry.id)} />
                    ))}
                  </div>
                </>
              )}
              {validated.length === 0 && pending.length === 0 && (
                <div className="text-center py-16 rounded-xl border border-[var(--border)]" style={{ backgroundColor: "var(--bg-surface)" }}>
                  <BookOpen size={28} className="mx-auto mb-3" style={{ color: "#222" }} />
                  <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Base de conhecimento vazia</p>
                  <p className="text-xs mb-4" style={{ color: "var(--text-quaternary)" }}>
                    Adicione informações manualmente ou use a IA para sugerir conteúdo relevante
                  </p>
                  {canEdit && (
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="text-xs font-semibold px-4 py-2 rounded-lg"
                      style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}
                    >
                      + Adicionar primeira informação
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "ai" && (
          <div className="max-w-2xl flex flex-col" style={{ height: "calc(100vh - 220px)" }}>
            <ClientAI client={client} validated={validated} />
          </div>
        )}
      </div>

      {showAddModal && (
        <AddEntryModal onClose={() => setShowAddModal(false)} onSave={handleAddManual} />
      )}
    </div>
  )
}
