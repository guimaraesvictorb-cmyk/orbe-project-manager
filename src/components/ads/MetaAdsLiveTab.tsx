import { useState, useCallback, useEffect } from 'react'
import {
  RefreshCw, Loader2, AlertCircle, Info, Eye, EyeOff,
  ChevronDown, Search, Download, BarChart2, Target,
  Play, Pause, FileText, Users, Heart, DollarSign,
  MousePointer, Activity, MessageSquare, Percent,
  Calendar, TrendingUp, Settings, Check,
  Plus, Wallet,
} from 'lucide-react'
import type { Client } from '../../lib/database.types'
import { fmtCurrency, fmtPct, fmtInt } from '../../lib/formatters'

// ─── constants ───────────────────────────────────────────────────────────────

const META_STORAGE_KEY = 'orbe_meta_token'
const META_GRAPH = 'https://graph.facebook.com/v18.0'
const BLUE = '#1877F2'
const CARD_BG = '#0f1220'
const BORDER = '#1c2535'
const SECTION_BG = '#0b0e17'

// ─── types ───────────────────────────────────────────────────────────────────

interface AccountMetrics {
  spend: number; conversations: number; costPerConversation: number
  impressions: number; reach: number; clicks: number
  inlineLinkClicks: number; ctr: number; inlineLinkClickCtr: number
  cpm: number; cpc: number; cpcLink: number; frequency: number
  pageEngagement: number; results: number; costPerResult: number
}

interface CampaignRow {
  id: string; name: string; status: string; objective: string
  startTime: string; dailyBudget: number; lifetimeBudget: number
  spend: number; clicks: number; inlineLinkClicks: number
  ctr: number; inlineLinkClickCtr: number; cpm: number; cpc: number
  cpcLink: number; impressions: number; reach: number
  frequency: number; results: number; costPerResult: number
}

interface DailyPoint { date: string; spend: number; impressions: number; clicks: number }

// ─── date helpers ─────────────────────────────────────────────────────────────

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function today() { return isoDate(new Date()) }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

const PERIODS = [
  {
    label: 'Hoje',
    since: () => today(),
    until: () => today(),
  },
  {
    label: 'Ontem',
    since: () => isoDate(addDays(new Date(), -1)),
    until: () => isoDate(addDays(new Date(), -1)),
  },
  {
    label: 'Últimos 7 dias',
    since: () => isoDate(addDays(new Date(), -6)),
    until: () => today(),
  },
  {
    label: 'Últimos 30 dias',
    since: () => isoDate(addDays(new Date(), -29)),
    until: () => today(),
  },
  {
    label: 'Este mês',
    since: () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` },
    until: () => today(),
  },
  {
    label: 'Mês passado',
    since: () => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth() - 1, 1); return isoDate(s) },
    until: () => { const d = new Date(); const e = new Date(d.getFullYear(), d.getMonth(), 0); return isoDate(e) },
  },
]

function fmtBR(iso: string) {
  if (!iso) return '—'
  const [y, m, day] = iso.split('-')
  return `${day}/${m}/${y}`
}

function fmtBudget(daily: number, lifetime: number) {
  if (daily > 0) return fmtCurrency(daily / 100) + '/dia'
  if (lifetime > 0) return fmtCurrency(lifetime / 100) + ' total'
  return '—'
}

const OBJECTIVE_LABEL: Record<string, string> = {
  OUTCOME_LEADS: 'Leads', OUTCOME_SALES: 'Vendas', OUTCOME_TRAFFIC: 'Tráfego',
  OUTCOME_AWARENESS: 'Reconhecimento', OUTCOME_ENGAGEMENT: 'Engajamento',
  OUTCOME_APP_PROMOTION: 'App', OUTCOME_MESSAGES: 'Mensagens',
  LINK_CLICKS: 'Tráfego', CONVERSIONS: 'Conversões', BRAND_AWARENESS: 'Reconhecimento',
  REACH: 'Alcance', VIDEO_VIEWS: 'Visualizações', LEAD_GENERATION: 'Leads',
  MESSAGES: 'Mensagens', PAGE_LIKES: 'Curtidas', POST_ENGAGEMENT: 'Engajamento',
}

// ─── api ─────────────────────────────────────────────────────────────────────

async function metaGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${META_GRAPH}${path}`)
  url.searchParams.set('access_token', token)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString())
  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  return json
}

async function metaPatch(id: string, token: string, body: Record<string, string>) {
  const url = new URL(`${META_GRAPH}/${id}`)
  url.searchParams.set('access_token', token)
  const res = await fetch(url.toString(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  return json
}

// ─── action parsers ───────────────────────────────────────────────────────────

type MetaInsight = Record<string, unknown>

function getAction(ins: MetaInsight, type: string): number {
  const arr = (ins.actions as { action_type: string; value: string }[] | undefined) ?? []
  return parseFloat(arr.find(a => a.action_type === type)?.value ?? '0') || 0
}
function getCost(ins: MetaInsight, type: string): number {
  const arr = (ins.cost_per_action_type as { action_type: string; value: string }[] | undefined) ?? []
  return parseFloat(arr.find(a => a.action_type === type)?.value ?? '0') || 0
}
function n(v: unknown): number { return parseFloat(String(v ?? 0)) || 0 }

function parseAccountMetrics(ins: MetaInsight): AccountMetrics {
  const conversations = getAction(ins, 'onsite_conversion.messaging_conversation_started_7d')
    || getAction(ins, 'onsite_conversion.messaging_conversation_started_30d')
  const costPerConversation = getCost(ins, 'onsite_conversion.messaging_conversation_started_7d')
    || getCost(ins, 'onsite_conversion.messaging_conversation_started_30d')
  const leads = getAction(ins, 'lead') + getAction(ins, 'offsite_conversion.fb_pixel_lead')
  const purchases = getAction(ins, 'purchase') + getAction(ins, 'offsite_conversion.fb_pixel_purchase')
  const results = conversations || leads || purchases || 0
  const costPerResult = results > 0 ? n(ins.spend) / results : 0

  return {
    spend: n(ins.spend),
    conversations,
    costPerConversation,
    impressions: n(ins.impressions),
    reach: n(ins.reach),
    clicks: n(ins.clicks),
    inlineLinkClicks: n(ins.inline_link_clicks),
    ctr: n(ins.ctr),
    inlineLinkClickCtr: n(ins.inline_link_click_ctr),
    cpm: n(ins.cpm),
    cpc: n(ins.cpc),
    cpcLink: n(ins.cost_per_inline_link_click),
    frequency: n(ins.frequency),
    pageEngagement: getAction(ins, 'post_engagement') || getAction(ins, 'page_engagement'),
    results,
    costPerResult,
  }
}

function parseCampaign(
  c: { id: string; name: string; status: string; objective: string; start_time?: string; daily_budget?: string; lifetime_budget?: string },
  ins: MetaInsight | undefined,
): CampaignRow {
  const conversations = ins ? (getAction(ins, 'onsite_conversion.messaging_conversation_started_7d') || getAction(ins, 'onsite_conversion.messaging_conversation_started_30d')) : 0
  const leads = ins ? (getAction(ins, 'lead') + getAction(ins, 'offsite_conversion.fb_pixel_lead')) : 0
  const purchases = ins ? (getAction(ins, 'purchase') + getAction(ins, 'offsite_conversion.fb_pixel_purchase')) : 0
  const results = conversations || leads || purchases || 0
  const spend = ins ? n(ins.spend) : 0
  return {
    id: c.id, name: c.name, status: c.status, objective: c.objective,
    startTime: c.start_time ?? '',
    dailyBudget: n(c.daily_budget),
    lifetimeBudget: n(c.lifetime_budget),
    spend, clicks: ins ? n(ins.clicks) : 0,
    inlineLinkClicks: ins ? n(ins.inline_link_clicks) : 0,
    ctr: ins ? n(ins.ctr) : 0,
    inlineLinkClickCtr: ins ? n(ins.inline_link_click_ctr) : 0,
    cpm: ins ? n(ins.cpm) : 0,
    cpc: ins ? n(ins.cpc) : 0,
    cpcLink: ins ? n(ins.cost_per_inline_link_click) : 0,
    impressions: ins ? n(ins.impressions) : 0,
    reach: ins ? n(ins.reach) : 0,
    frequency: ins ? n(ins.frequency) : 0,
    results, costPerResult: results > 0 ? spend / results : 0,
  }
}

// ─── chart helper ─────────────────────────────────────────────────────────────

function buildPolyline(data: DailyPoint[], key: keyof DailyPoint, W: number, H: number): string {
  if (data.length < 2) return ''
  const vals = data.map(d => d[key] as number)
  const max = Math.max(...vals, 0.01)
  return data.map((d, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - ((d[key] as number) / max) * (H - 12)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiDef {
  key: keyof AccountMetrics
  label: string
  icon: React.ReactNode
  tip: string
  format: 'currency' | 'number' | 'decimal' | 'pct'
}

const KPI_DEFS: KpiDef[] = [
  { key: 'spend',                label: 'Investimento',               icon: <DollarSign size={13} />,    tip: 'Total investido no período',                    format: 'currency' },
  { key: 'conversations',        label: 'Conversas',                   icon: <MessageSquare size={13} />, tip: 'Conversas iniciadas via Messenger/WhatsApp',     format: 'number'   },
  { key: 'costPerConversation',  label: 'Custo por Conversa',          icon: <DollarSign size={13} />,    tip: 'Custo médio por conversa iniciada',              format: 'currency' },
  { key: 'impressions',          label: 'Impressões',                  icon: <Eye size={13} />,           tip: 'Número total de vezes que os anúncios foram exibidos', format: 'number' },
  { key: 'reach',                label: 'Alcance',                     icon: <Users size={13} />,         tip: 'Número de pessoas únicas alcançadas',            format: 'number'   },
  { key: 'clicks',               label: 'Cliques',                     icon: <MousePointer size={13} />,  tip: 'Total de cliques em todos os anúncios',          format: 'number'   },
  { key: 'inlineLinkClicks',     label: 'Total de cliques no link',    icon: <MousePointer size={13} />,  tip: 'Cliques em links dentro dos anúncios',           format: 'number'   },
  { key: 'ctr',                  label: 'CTR (Todos)',                 icon: <Percent size={13} />,       tip: 'Taxa de cliques em relação às impressões totais', format: 'pct'     },
  { key: 'inlineLinkClickCtr',   label: 'CTR (Cliques no link)',       icon: <Percent size={13} />,       tip: 'Taxa de cliques em links',                       format: 'pct'      },
  { key: 'cpm',                  label: 'CPM Médio',                   icon: <BarChart2 size={13} />,     tip: 'Custo médio por mil impressões',                 format: 'currency' },
  { key: 'cpc',                  label: 'CPC Médio',                   icon: <DollarSign size={13} />,    tip: 'Custo médio por clique',                         format: 'currency' },
  { key: 'cpcLink',              label: 'CPC Médio (No link)',         icon: <DollarSign size={13} />,    tip: 'Custo médio por clique em link',                 format: 'currency' },
  { key: 'frequency',            label: 'Frequência',                  icon: <Activity size={13} />,      tip: 'Média de vezes que cada pessoa viu o anúncio',  format: 'decimal'  },
  { key: 'pageEngagement',       label: 'Engajamento da página',       icon: <Heart size={13} />,         tip: 'Total de interações com a página',               format: 'number'   },
  { key: 'results',              label: 'Resultados',                  icon: <Target size={13} />,        tip: 'Total de conversões ou resultados do objetivo',  format: 'number'   },
  { key: 'costPerResult',        label: 'Custo por Resultado',         icon: <DollarSign size={13} />,    tip: 'Custo médio por resultado obtido',               format: 'currency' },
]

function fmtKpi(v: number, format: KpiDef['format']) {
  if (format === 'currency') return fmtCurrency(v)
  if (format === 'pct') return fmtPct(v)
  if (format === 'decimal') return v > 0 ? v.toFixed(2) : '0,00'
  return fmtInt(v)
}

function KpiCard({
  def, value, hidden, onToggle,
}: { def: KpiDef; value: number; hidden: boolean; onToggle: () => void }) {
  const [tip, setTip] = useState(false)
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2 relative"
      style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}` }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <span className="text-[11px] font-medium truncate" style={{ color: '#8892a4' }}>{def.label}</span>
          <button
            className="flex-shrink-0 relative"
            onMouseEnter={() => setTip(true)}
            onMouseLeave={() => setTip(false)}
          >
            <Info size={10} style={{ color: '#444' }} />
            {tip && (
              <div
                className="absolute left-0 top-5 z-50 rounded-lg px-2 py-1.5 text-[10px] w-48 leading-relaxed"
                style={{ backgroundColor: '#1a2030', border: `1px solid ${BORDER}`, color: '#aaa' }}
              >
                {def.tip}
              </div>
            )}
          </button>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onToggle} className="p-0.5" title={hidden ? 'Exibir' : 'Ocultar'}>
            {hidden
              ? <EyeOff size={11} style={{ color: '#444' }} />
              : <Eye size={11} style={{ color: '#444' }} />}
          </button>
          <span style={{ color: '#444' }}>{def.icon}</span>
        </div>
      </div>
      <div className="text-lg font-bold" style={{ color: hidden ? '#333' : '#fff' }}>
        {hidden ? '••••' : fmtKpi(value, def.format)}
      </div>
    </div>
  )
}

// ─── PerformanceChart ─────────────────────────────────────────────────────────

const CHART_METRICS = [
  { key: 'spend' as const, label: 'Investimento' },
  { key: 'impressions' as const, label: 'Impressões' },
  { key: 'clicks' as const, label: 'Cliques' },
]

function PerformanceChart({
  data, loading, onLoad,
}: { data: DailyPoint[]; loading: boolean; onLoad: () => void }) {
  const [metric, setMetric] = useState<'spend' | 'impressions' | 'clicks'>('spend')
  const W = 900, H = 160

  const polyline = buildPolyline(data, metric, W, H)
  const maxVal = Math.max(...data.map(d => d[metric]), 0)
  const closedPath = polyline ? `0,${H} ${polyline} ${W},${H}` : ''

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <span className="text-sm font-semibold text-white">Performance</span>
        {data.length > 0 && (
          <div className="flex items-center gap-1">
            {CHART_METRICS.map(m => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
                style={{
                  backgroundColor: metric === m.key ? BLUE : 'transparent',
                  color: metric === m.key ? '#fff' : '#6b7a8d',
                  border: `1px solid ${metric === m.key ? BLUE : BORDER}`,
                }}
              >
                {m.label}
              </button>
            ))}
            <button onClick={onLoad} disabled={loading} className="ml-2 p-1.5 rounded-lg" style={{ border: `1px solid ${BORDER}`, color: '#6b7a8d' }}>
              {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            </button>
          </div>
        )}
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <BarChart2 size={32} style={{ color: '#2a3040' }} />
          <p className="text-sm text-center" style={{ color: '#555' }}>
            Clique no botão abaixo para gerar o gráfico com os dados diários
          </p>
          <button
            onClick={onLoad}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60"
            style={{ backgroundColor: BLUE, color: '#fff' }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            Gerar Gráfico
          </button>
        </div>
      ) : (
        <div className="px-4 py-3">
          <div className="flex items-end justify-between mb-2">
            <span className="text-[10px]" style={{ color: '#444' }}>
              {CHART_METRICS.find(m => m.key === metric)?.label}
            </span>
            <span className="text-[10px]" style={{ color: '#444' }}>
              Máx: {metric === 'spend' ? fmtCurrency(maxVal) : fmtInt(maxVal)}
            </span>
          </div>
          <div className="w-full overflow-hidden rounded-lg" style={{ height: 160 }}>
            <svg width="100%" height="160" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BLUE} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
                </linearGradient>
              </defs>
              {closedPath && <polygon fill="url(#chartGrad)" points={closedPath} />}
              {polyline && <polyline fill="none" stroke={BLUE} strokeWidth="2" points={polyline} />}
            </svg>
          </div>
          <div className="flex justify-between mt-1">
            {data.length > 0 && (
              <>
                <span className="text-[9px]" style={{ color: '#444' }}>{fmtBR(data[0].date)}</span>
                <span className="text-[9px]" style={{ color: '#444' }}>{fmtBR(data[data.length - 1].date)}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CampaignTable ────────────────────────────────────────────────────────────

const TABLE_COLS = [
  { key: 'objective', label: 'Objetivo',             width: 100 },
  { key: 'name',      label: 'Campanha',             width: 220 },
  { key: 'status',    label: 'Status',               width: 90  },
  { key: 'startTime', label: 'Data Início',          width: 100 },
  { key: 'budget',    label: 'Orçamento',            width: 110 },
  { key: 'spend',     label: 'Gasto',                width: 100 },
  { key: 'cpc',       label: 'CPC (Todos)',          width: 100 },
  { key: 'ctr',       label: 'CTR (Todos)',          width: 100 },
  { key: 'cpcLink',   label: 'CPC (Link)',           width: 100 },
  { key: 'cpm',       label: 'CPM',                  width: 100 },
  { key: 'impressions', label: 'Impressões',         width: 100 },
  { key: 'reach',     label: 'Alcance',              width: 90  },
  { key: 'results',   label: 'Resultados',           width: 100 },
  { key: 'costPerResult', label: 'Custo/Resultado',  width: 110 },
] as const

type TableColKey = typeof TABLE_COLS[number]['key']

function CampaignTableSection({
  rows, loading, onToggle, toggling, period, onPeriodChange,
}: {
  rows: CampaignRow[]
  loading: boolean
  onToggle: (row: CampaignRow) => void
  toggling: Record<string, boolean>
  period: number
  onPeriodChange: (i: number) => void
}) {
  const [search, setSearch] = useState('')
  const [showPaused, setShowPaused] = useState(true)
  const [visibleCols, setVisibleCols] = useState<Set<TableColKey>>(
    new Set(['objective', 'name', 'status', 'startTime', 'budget', 'spend', 'cpc', 'ctr', 'cpcLink', 'cpm'])
  )
  const [showColPicker, setShowColPicker] = useState(false)
  const [showPeriod, setShowPeriod] = useState(false)

  const filtered = rows.filter(r => {
    if (!showPaused && r.status !== 'ACTIVE') return false
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const activeCols = TABLE_COLS.filter(c => visibleCols.has(c.key))

  function getCellValue(row: CampaignRow, key: TableColKey): React.ReactNode {
    if (key === 'objective') return <span className="text-[10px]" style={{ color: '#8892a4' }}>{OBJECTIVE_LABEL[row.objective] ?? row.objective ?? '—'}</span>
    if (key === 'name') return <span className="text-white font-medium text-xs truncate block" style={{ maxWidth: 210 }}>{row.name}</span>
    if (key === 'status') {
      const active = row.status === 'ACTIVE'
      return (
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active ? '#10b981' : '#555' }} />
          <span className="text-[10px]" style={{ color: active ? '#10b981' : '#6b7a8d' }}>{active ? 'Ativo' : 'Pausado'}</span>
        </div>
      )
    }
    if (key === 'startTime') return <span className="text-[10px]" style={{ color: '#6b7a8d' }}>{fmtBR(row.startTime?.slice(0, 10) ?? '')}</span>
    if (key === 'budget') return <span className="text-[10px]" style={{ color: '#aaa' }}>{fmtBudget(row.dailyBudget, row.lifetimeBudget)}</span>
    if (key === 'spend') return <span className="text-xs font-semibold text-white">{fmtCurrency(row.spend)}</span>
    if (key === 'cpc') return <span className="text-xs" style={{ color: '#aaa' }}>{row.cpc > 0 ? fmtCurrency(row.cpc) : '—'}</span>
    if (key === 'ctr') return <span className="text-xs" style={{ color: '#aaa' }}>{fmtPct(row.ctr)}</span>
    if (key === 'cpcLink') return <span className="text-xs" style={{ color: '#aaa' }}>{row.cpcLink > 0 ? fmtCurrency(row.cpcLink) : '—'}</span>
    if (key === 'cpm') return <span className="text-xs" style={{ color: '#aaa' }}>{row.cpm > 0 ? fmtCurrency(row.cpm) : '—'}</span>
    if (key === 'impressions') return <span className="text-xs" style={{ color: '#aaa' }}>{fmtInt(row.impressions)}</span>
    if (key === 'reach') return <span className="text-xs" style={{ color: '#aaa' }}>{fmtInt(row.reach)}</span>
    if (key === 'results') return <span className="text-xs" style={{ color: '#aaa' }}>{fmtInt(row.results)}</span>
    if (key === 'costPerResult') return <span className="text-xs" style={{ color: '#aaa' }}>{row.costPerResult > 0 ? fmtCurrency(row.costPerResult) : '—'}</span>
    return null
  }

  const totalSpend = filtered.reduce((s, r) => s + r.spend, 0)
  const totalCpc = filtered.reduce((s, r) => s + r.cpc, 0) / (filtered.filter(r => r.cpc > 0).length || 1)
  const totalCtr = filtered.reduce((s, r) => s + r.ctr, 0) / (filtered.length || 1)
  const totalCpcLink = filtered.reduce((s, r) => s + r.cpcLink, 0) / (filtered.filter(r => r.cpcLink > 0).length || 1)
  const totalCpm = filtered.reduce((s, r) => s + r.cpm, 0) / (filtered.filter(r => r.cpm > 0).length || 1)
  const totalImp = filtered.reduce((s, r) => s + r.impressions, 0)
  const totalReach = filtered.reduce((s, r) => s + r.reach, 0)
  const totalResults = filtered.reduce((s, r) => s + r.results, 0)
  const totalCpr = totalResults > 0 ? totalSpend / totalResults : 0

  function getTotalCell(key: TableColKey): React.ReactNode {
    if (key === 'name') return <span className="text-xs font-bold text-white">{filtered.length} campanhas</span>
    if (key === 'spend') return <span className="text-xs font-bold text-white">{fmtCurrency(totalSpend)}</span>
    if (key === 'cpc') return <span className="text-xs font-bold text-white">{totalCpc > 0 ? fmtCurrency(totalCpc) : '—'}</span>
    if (key === 'ctr') return <span className="text-xs font-bold text-white">{fmtPct(totalCtr)}</span>
    if (key === 'cpcLink') return <span className="text-xs font-bold text-white">{totalCpcLink > 0 ? fmtCurrency(totalCpcLink) : '—'}</span>
    if (key === 'cpm') return <span className="text-xs font-bold text-white">{totalCpm > 0 ? fmtCurrency(totalCpm) : '—'}</span>
    if (key === 'impressions') return <span className="text-xs font-bold text-white">{fmtInt(totalImp)}</span>
    if (key === 'reach') return <span className="text-xs font-bold text-white">{fmtInt(totalReach)}</span>
    if (key === 'results') return <span className="text-xs font-bold text-white">{fmtInt(totalResults)}</span>
    if (key === 'costPerResult') return <span className="text-xs font-bold text-white">{totalCpr > 0 ? fmtCurrency(totalCpr) : '—'}</span>
    return null
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}` }}>
      {/* toolbar */}
      <div className="flex items-center gap-2 px-3 py-2.5 flex-wrap" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg flex-1 min-w-40" style={{ backgroundColor: '#0a0d14', border: `1px solid ${BORDER}` }}>
          <Search size={11} style={{ color: '#444' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar campanha..."
            className="bg-transparent text-xs outline-none flex-1 text-white placeholder-gray-600"
          />
        </div>

        <button
          onClick={() => setShowPaused(v => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border transition-all"
          style={{ borderColor: showPaused ? `${BLUE}55` : BORDER, color: showPaused ? BLUE : '#6b7a8d', backgroundColor: showPaused ? `${BLUE}11` : 'transparent' }}
        >
          {showPaused && <Check size={9} />}
          Exibir pausadas
        </button>

        {/* period */}
        <div className="relative">
          <button
            onClick={() => setShowPeriod(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border"
            style={{ borderColor: BORDER, color: '#6b7a8d' }}
          >
            <Calendar size={11} />
            {PERIODS[period].label}
            <ChevronDown size={10} />
          </button>
          {showPeriod && (
            <div className="absolute right-0 top-8 z-30 rounded-xl py-1 w-44" style={{ backgroundColor: '#111827', border: `1px solid ${BORDER}` }}>
              {PERIODS.map((p, i) => (
                <button
                  key={p.label}
                  onClick={() => { onPeriodChange(i); setShowPeriod(false) }}
                  className="w-full text-left px-3 py-2 text-[11px] hover:bg-white/5 transition-colors flex items-center justify-between"
                  style={{ color: period === i ? BLUE : '#aaa' }}
                >
                  {p.label}
                  {period === i && <Check size={9} style={{ color: BLUE }} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* col picker */}
        <div className="relative">
          <button
            onClick={() => setShowColPicker(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border"
            style={{ borderColor: BORDER, color: '#6b7a8d' }}
          >
            <Settings size={11} />
            Organizar
          </button>
          {showColPicker && (
            <div
              className="absolute right-0 top-8 z-30 rounded-xl p-2 w-52"
              style={{ backgroundColor: '#111827', border: `1px solid ${BORDER}` }}
            >
              {TABLE_COLS.filter(c => c.key !== 'name').map(col => (
                <button
                  key={col.key}
                  onClick={() => {
                    setVisibleCols(prev => {
                      const next = new Set(prev)
                      next.has(col.key) ? next.delete(col.key) : next.add(col.key)
                      return next
                    })
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[11px] transition-colors hover:bg-white/5"
                  style={{ color: visibleCols.has(col.key) ? '#fff' : '#555' }}
                >
                  <div
                    className="w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: visibleCols.has(col.key) ? BLUE : '#333', backgroundColor: visibleCols.has(col.key) ? BLUE : 'transparent' }}
                  >
                    {visibleCols.has(col.key) && <Check size={8} style={{ color: '#fff' }} />}
                  </div>
                  {col.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading && <Loader2 size={12} className="animate-spin ml-auto" style={{ color: BLUE }} />}
      </div>

      {/* table */}
      <div className="overflow-auto">
        <table className="w-full" style={{ minWidth: activeCols.reduce((s, c) => s + c.width, 0) }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {activeCols.map(col => (
                <th
                  key={col.key}
                  className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest whitespace-nowrap"
                  style={{ color: '#444', width: col.width, minWidth: col.width }}
                >
                  {col.label}
                </th>
              ))}
              <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-right" style={{ color: '#444' }}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={activeCols.length + 1} className="text-center py-12 text-sm" style={{ color: '#444' }}>
                  {loading ? 'Carregando campanhas...' : 'Nenhuma campanha encontrada para o período'}
                </td>
              </tr>
            )}
            {filtered.map(row => (
              <tr
                key={row.id}
                style={{ borderBottom: `1px solid #0d0f18` }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0f1525')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {activeCols.map(col => (
                  <td key={col.key} className="px-3 py-2.5" style={{ width: col.width }}>
                    {getCellValue(row, col.key)}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right">
                  <button
                    onClick={() => onToggle(row)}
                    disabled={toggling[row.id]}
                    title={row.status === 'ACTIVE' ? 'Pausar' : 'Ativar'}
                    className="p-1 rounded-md transition-colors disabled:opacity-50"
                    style={{
                      color: row.status === 'ACTIVE' ? '#ef4444' : '#10b981',
                      border: `1px solid ${row.status === 'ACTIVE' ? '#ef444433' : '#10b98133'}`,
                    }}
                  >
                    {toggling[row.id]
                      ? <Loader2 size={11} className="animate-spin" />
                      : row.status === 'ACTIVE' ? <Pause size={11} /> : <Play size={11} />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: '#0a0d14' }}>
                {activeCols.map(col => (
                  <td key={col.key} className="px-3 py-2.5" style={{ width: col.width }}>
                    {getTotalCell(col.key)}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ─── ConversionFunnel ─────────────────────────────────────────────────────────

function ConversionFunnel({ metrics }: { metrics: AccountMetrics | null }) {
  const imp = metrics?.impressions ?? 0
  const clk = metrics?.clicks ?? 0
  const res = metrics?.results ?? 0
  const spend = metrics?.spend ?? 0

  const pct1 = imp > 0 ? (clk / imp) * 100 : 0
  const pct2 = clk > 0 ? (res / clk) * 100 : 0

  const steps = [
    { label: 'Impressões', value: imp, cost: spend, pct: null, width: '100%' },
    { label: 'Cliques', value: clk, cost: clk > 0 && metrics?.cpc ? clk * (metrics.cpc) : 0, pct: pct1, width: '75%' },
    { label: 'Resultados', value: res, cost: metrics ? res * (metrics.costPerResult ?? 0) : 0, pct: pct2, width: '50%' },
  ]

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <span className="text-sm font-semibold text-white">Funil de Conversão</span>
        <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px]" style={{ border: `1px solid ${BORDER}`, color: '#6b7a8d' }}>
          <Download size={11} /> Exportar PDF
        </button>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-white px-3 py-1 rounded-full" style={{ backgroundColor: '#111827', border: `1px solid ${BORDER}` }}>
            Todas as campanhas
          </span>
        </div>
        <div className="text-[11px] font-semibold text-white mb-1" style={{ color: BLUE }}>
          Valor Investido: {fmtCurrency(spend)}
        </div>
        <div className="flex flex-col items-center gap-0">
          {steps.map((step, i) => (
            <div key={step.label} className="w-full flex flex-col items-center">
              {step.pct !== null && (
                <div className="flex items-center gap-1 py-1.5">
                  <div className="h-px flex-1" style={{ width: 20, backgroundColor: '#1e2535' }} />
                  <span className="text-[10px] font-semibold" style={{ color: '#6b7a8d' }}>
                    {step.pct.toFixed(1)}% Conversão
                  </span>
                  <div className="h-px flex-1" style={{ width: 20, backgroundColor: '#1e2535' }} />
                </div>
              )}
              <div
                className="flex items-center justify-between px-4 py-3 rounded-lg"
                style={{
                  width: step.width,
                  backgroundColor: `${BLUE}${22 - i * 4}`,
                  border: `1px solid ${BLUE}44`,
                }}
              >
                <span className="text-sm font-bold text-white">{step.label}</span>
                <div className="text-right">
                  <div className="text-base font-bold text-white">{fmtInt(step.value)}</div>
                  <div className="text-[10px]" style={{ color: '#8892a4' }}>{fmtCurrency(step.cost)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button className="flex items-center gap-1 text-[11px] mt-2" style={{ color: BLUE }}>
          <Plus size={11} /> Adicionar etapa
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { client: Client }

export function MetaAdsLiveTab({ client }: Props) {
  const token = localStorage.getItem(META_STORAGE_KEY) ?? ''
  const accountId = client.meta_ads_account_id ?? ''

  const [periodIdx, setPeriodIdx] = useState(4) // "Este mês" default
  const [metrics, setMetrics] = useState<AccountMetrics | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [dailyData, setDailyData] = useState<DailyPoint[]>([])
  const [error, setError] = useState('')
  const [loadingMain, setLoadingMain] = useState(false)
  const [loadingChart, setLoadingChart] = useState(false)
  const [hiddenMetrics, setHiddenMetrics] = useState<Set<keyof AccountMetrics>>(new Set())
  const [toggling, setToggling] = useState<Record<string, boolean>>({})
  const [showPeriodMenu, setShowPeriodMenu] = useState(false)

  const { since, until } = { since: PERIODS[periodIdx].since(), until: PERIODS[periodIdx].until() }
  const dateLabel = `${fmtBR(since)} – ${fmtBR(until)}`

  const loadMain = useCallback(async () => {
    if (!token || !accountId) return
    setLoadingMain(true)
    setError('')
    try {
      const timeRange = JSON.stringify({ since, until })
      const [acctRes, campRes, insRes] = await Promise.all([
        metaGet(`/${accountId}/insights`, token, {
          fields: 'spend,impressions,reach,clicks,inline_link_clicks,ctr,inline_link_click_ctr,cpm,cpc,cost_per_inline_link_click,frequency,actions,cost_per_action_type,action_values,purchase_roas',
          time_range: timeRange,
        }),
        metaGet(`/${accountId}/campaigns`, token, {
          fields: 'id,name,status,objective,start_time,daily_budget,lifetime_budget',
          limit: '100',
        }),
        metaGet(`/${accountId}/insights`, token, {
          fields: 'campaign_id,spend,clicks,inline_link_clicks,ctr,inline_link_click_ctr,cpm,cpc,cost_per_inline_link_click,impressions,reach,frequency,actions,cost_per_action_type',
          time_range: timeRange,
          level: 'campaign',
          limit: '100',
        }),
      ])

      const insightMap: Record<string, MetaInsight> = {}
      for (const ins of (insRes.data ?? [])) insightMap[(ins as MetaInsight).campaign_id as string] = ins

      if (acctRes.data?.[0]) setMetrics(parseAccountMetrics(acctRes.data[0]))
      setCampaigns((campRes.data ?? []).map((c: Parameters<typeof parseCampaign>[0]) => parseCampaign(c, insightMap[c.id])))
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoadingMain(false)
    }
  }, [token, accountId, since, until])

  const loadChart = useCallback(async () => {
    if (!token || !accountId) return
    setLoadingChart(true)
    try {
      const res = await metaGet(`/${accountId}/insights`, token, {
        fields: 'date_start,spend,impressions,clicks',
        time_range: JSON.stringify({ since, until }),
        time_increment: '1',
        limit: '90',
      })
      setDailyData((res.data ?? []).map((d: { date_start: string; spend: string; impressions: string; clicks: string }) => ({
        date: d.date_start,
        spend: parseFloat(d.spend ?? '0') || 0,
        impressions: parseFloat(d.impressions ?? '0') || 0,
        clicks: parseFloat(d.clicks ?? '0') || 0,
      })))
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoadingChart(false)
    }
  }, [token, accountId, since, until])

  useEffect(() => { loadMain() }, [loadMain])

  async function toggleStatus(row: CampaignRow) {
    const newStatus = row.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    setToggling(t => ({ ...t, [row.id]: true }))
    try {
      await metaPatch(row.id, token, { status: newStatus })
      setCampaigns(prev => prev.map(c => c.id === row.id ? { ...c, status: newStatus } : c))
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setToggling(t => ({ ...t, [row.id]: false }))
    }
  }

  function toggleMetric(key: keyof AccountMetrics) {
    setHiddenMetrics(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // ── no config ──
  if (!token || !accountId) {
    return (
      <div className="rounded-xl py-16 text-center" style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}` }}>
        <AlertCircle size={28} className="mx-auto mb-4" style={{ color: '#333' }} />
        <p className="text-sm font-semibold text-white mb-2">Conta não conectada</p>
        <p className="text-xs" style={{ color: '#555' }}>
          {!token
            ? 'Configure o token Meta em Integrações → Meta Ads.'
            : 'Vincule uma conta de anúncios a este cliente.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4" style={{ backgroundColor: SECTION_BG }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: BLUE }}>
            M
          </div>
          <span className="text-base font-bold text-white">Meta Ads</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Account pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium" style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}`, color: '#8892a4' }}>
            {accountId}
            <ChevronDown size={10} />
          </div>

          {/* Date range */}
          <div className="relative">
            <button
              onClick={() => setShowPeriodMenu(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium"
              style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}`, color: '#8892a4' }}
            >
              <Calendar size={11} />
              {dateLabel}
              <ChevronDown size={10} />
            </button>
            {showPeriodMenu && (
              <div
                className="absolute right-0 top-9 z-50 rounded-xl py-1 w-48"
                style={{ backgroundColor: '#111827', border: `1px solid ${BORDER}` }}
              >
                {PERIODS.map((p, i) => (
                  <button
                    key={p.label}
                    onClick={() => { setPeriodIdx(i); setShowPeriodMenu(false); setDailyData([]) }}
                    className="w-full text-left px-3 py-2 text-[11px] hover:bg-white/5 transition-colors flex items-center justify-between"
                    style={{ color: periodIdx === i ? BLUE : '#aaa' }}
                  >
                    {p.label}
                    {periodIdx === i && <Check size={9} style={{ color: BLUE }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={loadMain}
            disabled={loadingMain}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] disabled:opacity-50"
            style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}`, color: '#6b7a8d' }}
          >
            {loadingMain ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            Atualizar
          </button>
        </div>
      </div>

      {/* PDF geral link */}
      <div className="flex items-center">
        <button className="flex items-center gap-1.5 text-[11px] hover:opacity-80 transition-opacity" style={{ color: BLUE }}>
          <Download size={11} />
          Baixar PDF da visão geral
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#1a0808', color: '#ef4444', border: '1px solid #ef444433' }}>
          <AlertCircle size={12} />{error}
          <button onClick={() => setError('')} className="ml-auto text-xs underline">Fechar</button>
        </div>
      )}

      {/* ── KPI Grid ── */}
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
        {KPI_DEFS.map(def => (
          <KpiCard
            key={def.key}
            def={def}
            value={metrics ? metrics[def.key] : 0}
            hidden={hiddenMetrics.has(def.key)}
            onToggle={() => toggleMetric(def.key)}
          />
        ))}
      </div>

      {/* ── Performance Chart ── */}
      <PerformanceChart data={dailyData} loading={loadingChart} onLoad={loadChart} />

      {/* ── Campaign Table ── */}
      <CampaignTableSection
        rows={campaigns}
        loading={loadingMain}
        onToggle={toggleStatus}
        toggling={toggling}
        period={periodIdx}
        onPeriodChange={(i) => { setPeriodIdx(i); setDailyData([]) }}
      />

      {/* ── PDF de Campanhas ── */}
      <div className="rounded-xl p-4" style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="font-semibold text-white text-sm mb-2">PDF de Campanhas</div>
        <p className="text-[11px] leading-relaxed mb-3" style={{ color: '#6b7a8d' }}>
          Personalize as métricas que deseja exportar das campanhas diretamente na tabela acima. Reorganize as métricas, filtre pela ordem desejada, oculte campanhas, oculte métricas desnecessárias para a elaboração do relatório na opção "Organizar" e salve essas configurações sempre que necessário, de forma simples e intuitiva.
        </p>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold"
            style={{ backgroundColor: BLUE, color: '#fff' }}
          >
            <Download size={11} /> Baixar PDF de campanhas
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium"
            style={{ border: `1px solid ${BORDER}`, color: '#6b7a8d' }}
          >
            <FileText size={11} /> Abrir como texto
          </button>
        </div>
      </div>

      {/* ── Melhores Anúncios ── */}
      <div className="rounded-xl p-4" style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold text-white text-sm">Melhores Anúncios</span>
          <span className="text-[11px]" style={{ color: '#6b7a8d' }}>{fmtBR(until)}</span>
        </div>
        <div className="flex flex-col items-center justify-center py-8 gap-4">
          <TrendingUp size={28} style={{ color: '#2a3040' }} />
          <p className="text-sm" style={{ color: '#555' }}>Clique para carregar e analisar todos os anúncios</p>
          <button
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: BLUE, color: '#fff' }}
          >
            Carregar anúncios
          </button>
        </div>
      </div>

      {/* ── Funil de Conversão ── */}
      <ConversionFunnel metrics={metrics} />

      {/* ── Dados Demográficos ── */}
      <div className="rounded-xl p-4" style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="font-semibold text-white text-sm mb-4">Dados Demográficos</div>
        <div className="flex flex-col items-center justify-center py-8 gap-4">
          <Users size={28} style={{ color: '#2a3040' }} />
          <p className="text-sm text-center" style={{ color: '#555' }}>
            Clique para buscar a distribuição por idade e gênero da conta no período selecionado
          </p>
          <button
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: BLUE, color: '#fff' }}
          >
            Carregar dados demográficos
          </button>
        </div>
      </div>

      {/* ── Meta de Investimento ── */}
      <div className="rounded-xl p-4" style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold text-white text-sm">Meta de Investimento</span>
          <span className="text-[11px]" style={{ color: '#6b7a8d' }}>
            {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[11px] px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${BORDER}`, color: '#6b7a8d' }}>Nível de Conta</span>
        </div>
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Target size={28} style={{ color: '#2a3040' }} />
          <p className="text-sm" style={{ color: '#555' }}>Selecione um item acima para visualizar ou definir metas</p>
        </div>
      </div>

      {/* ── Bottom Actions ── */}
      <div className="flex items-center gap-2 justify-end flex-wrap pb-2">
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-medium"
          style={{ border: `1px solid ${BORDER}`, color: '#6b7a8d' }}
        >
          <Settings size={11} /> Organizar seções
        </button>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-medium"
          style={{ border: `1px solid ${BORDER}`, color: '#6b7a8d' }}
        >
          <Wallet size={11} /> Verificar Saldo
        </button>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-semibold"
          style={{ backgroundColor: BLUE, color: '#fff' }}
        >
          <FileText size={11} /> PDF Avançado
        </button>
      </div>

      <p className="text-[10px] text-right pb-2" style={{ color: '#2a3040' }}>
        Meta Graph API v18.0 · {accountId}
      </p>
    </div>
  )
}
