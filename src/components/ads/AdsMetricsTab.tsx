import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react'
import { useClientAdsMetrics, type AdsMetric, type AdsMetricInput } from '../../hooks/useClientAdsMetrics'
import { useAuth } from '../../hooks/useAuth'
import { fmt, fmtCurrency, fmtPct } from '../../lib/formatters'

type Platform = 'meta' | 'google'

function Trend({ curr, prev }: { curr: number | null; prev: number | null }) {
  if (curr == null || prev == null || prev === 0) return null
  const pct = ((curr - prev) / prev) * 100
  const up = pct > 0
  const Icon = pct === 0 ? Minus : up ? TrendingUp : TrendingDown
  const color = pct === 0 ? 'var(--text-tertiary)' : up ? 'var(--accent)' : 'var(--danger)'
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold ml-1" style={{ color }}>
      <Icon size={10} />{Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function currentPeriod() {
  return new Date().toISOString().slice(0, 7)
}

const META_FIELDS = [
  { key: 'investimento',        label: 'Investimento (R$)',       type: 'currency' },
  { key: 'resultados',          label: 'Resultados',              type: 'number' },
  { key: 'custo_por_resultado', label: 'Custo por resultado (R$)', type: 'currency' },
  { key: 'impressoes',          label: 'Impressões',              type: 'number' },
  { key: 'alcance',             label: 'Alcance',                 type: 'number' },
  { key: 'cliques',             label: 'Cliques',                 type: 'number' },
  { key: 'ctr',                 label: 'CTR (%)',                 type: 'pct' },
] as const

const GOOGLE_FIELDS = [
  { key: 'investimento',         label: 'Investimento (R$)',         type: 'currency' },
  { key: 'impressoes',           label: 'Impressões',                type: 'number' },
  { key: 'cliques',              label: 'Cliques',                   type: 'number' },
  { key: 'ctr',                  label: 'CTR (%)',                   type: 'pct' },
  { key: 'cpc',                  label: 'CPC (R$)',                  type: 'currency' },
  { key: 'conversoes',           label: 'Conversões',                type: 'number' },
  { key: 'custo_por_conversao',  label: 'Custo por conversão (R$)', type: 'currency' },
  { key: 'roas',                 label: 'ROAS',                      type: 'number' },
] as const

type FieldKey = typeof META_FIELDS[number]['key'] | typeof GOOGLE_FIELDS[number]['key']

function MetricRow({ label, curr, prev, format }: { label: string; curr: number | null; prev: number | null; format: 'currency' | 'number' | 'pct' }) {
  const display = format === 'currency' ? fmtCurrency(curr) : format === 'pct' ? fmtPct(curr) : fmt(curr)
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid var(--bg-surface-2)' }}>
      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-sm font-semibold text-white">{display}</span>
        <Trend curr={curr} prev={prev} />
      </div>
    </div>
  )
}

function EntryForm({ platform, clientId, existing, onSave, onCancel }: {
  platform: Platform
  clientId: string
  existing?: AdsMetric
  onSave: (input: AdsMetricInput) => Promise<void>
  onCancel: () => void
}) {
  const { profile } = useAuth()
  const fields = platform === 'meta' ? META_FIELDS : GOOGLE_FIELDS
  const [period, setPeriod] = useState(existing?.period ?? currentPeriod())
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    fields.forEach(({ key }) => {
      const v = existing?.[key as FieldKey]
      init[key] = v != null ? String(v) : ''
    })
    return init
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    const input: AdsMetricInput = {
      client_id: clientId,
      platform,
      period,
      investimento: vals.investimento ? parseFloat(vals.investimento) : null,
      impressoes: vals.impressoes ? parseInt(vals.impressoes) : null,
      alcance: vals.alcance ? parseInt(vals.alcance) : null,
      cliques: vals.cliques ? parseInt(vals.cliques) : null,
      ctr: vals.ctr ? parseFloat(vals.ctr) : null,
      resultados: vals.resultados ? parseInt(vals.resultados) : null,
      custo_por_resultado: vals.custo_por_resultado ? parseFloat(vals.custo_por_resultado) : null,
      cpc: vals.cpc ? parseFloat(vals.cpc) : null,
      conversoes: vals.conversoes ? parseFloat(vals.conversoes) : null,
      custo_por_conversao: vals.custo_por_conversao ? parseFloat(vals.custo_por_conversao) : null,
      roas: vals.roas ? parseFloat(vals.roas) : null,
      synced_from_api: false,
      created_by: profile.id,
    }
    await onSave(input)
    setSaving(false)
  }

  const inputCls = 'w-full rounded-lg px-3 py-2 text-xs text-white placeholder-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent-a44)] transition-colors'
  const inputStyle = { backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-strong)' }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border p-4 space-y-3" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: 'var(--text-tertiary)' }}>Período (mês)</label>
        <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required className={inputCls} style={inputStyle} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</label>
            <input
              type="number" step="any" value={vals[key]}
              onChange={(e) => setVals((p) => ({ ...p, [key]: e.target.value }))}
              placeholder="0"
              className={inputCls} style={inputStyle}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 py-2 rounded-lg text-xs border" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-tertiary)' }}>
          Cancelar
        </button>
        <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)' }}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : null}
          {saving ? 'Salvando...' : 'Salvar métricas'}
        </button>
      </div>
    </form>
  )
}

function PeriodCard({ metric, prevMetric, platform, onDelete, onEdit }: {
  metric: AdsMetric
  prevMetric?: AdsMetric
  platform: Platform
  onDelete: () => void
  onEdit: () => void
}) {
  const [open, setOpen] = useState(false)
  const fields = platform === 'meta' ? META_FIELDS : GOOGLE_FIELDS
  const [month, year] = metric.period.split('-')
  const label = new Date(`${year}-${month}-01`).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2">
            {open ? <ChevronUp size={14} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />}
            <p className="text-sm font-semibold text-white capitalize">{label}</p>
          </button>
          {metric.investimento && (
            <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>{fmtCurrency(metric.investimento)}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="text-[11px] px-2 py-1 rounded transition-colors hover:text-white" style={{ color: 'var(--text-tertiary)' }}>Editar</button>
          <button onClick={onDelete} className="p-1.5 rounded transition-colors hover:text-red-500" style={{ color: 'var(--text-quaternary)' }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4">
          {fields.map(({ key, label, type }) => (
            <MetricRow
              key={key}
              label={label}
              curr={metric[key as FieldKey] as number | null}
              prev={prevMetric?.[key as FieldKey] as number | null}
              format={type}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface AdsMetricsTabProps {
  clientId: string
  platform: Platform
}

export function AdsMetricsTab({ clientId, platform }: AdsMetricsTabProps) {
  const { meta, google, loading, upsertMetric, deleteMetric } = useClientAdsMetrics(clientId)
  const { profile } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AdsMetric | null>(null)

  const data = platform === 'meta' ? meta : google
  const canEdit = profile?.role === 'admin' || profile?.role === 'coordenador' || profile?.role === 'gp'

  const platformLabel = platform === 'meta' ? 'Meta Ads' : 'Google Ads'
  const platformColor = platform === 'meta' ? '#1877F2' : '#EA4335'

  async function handleSave(input: AdsMetricInput) {
    await upsertMetric(input)
    setShowForm(false)
    setEditing(null)
  }

  if (loading) return (
    <div className="flex justify-center py-12">
      <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
    </div>
  )

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: platformColor + '22', color: platformColor }}>
            {platformLabel}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{data.length} {data.length === 1 ? 'período' : 'períodos'} registrados</span>
        </div>
        {canEdit && !showForm && !editing && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)' }}
          >
            <Plus size={12} />Adicionar mês
          </button>
        )}
      </div>

      {(showForm) && (
        <EntryForm
          platform={platform} clientId={clientId}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editing && (
        <EntryForm
          platform={platform} clientId={clientId} existing={editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {data.length === 0 && !showForm ? (
        <div className="rounded-xl border border-[var(--border)] py-16 text-center" style={{ backgroundColor: 'var(--bg-surface)' }}>
          <p className="text-sm font-semibold text-white mb-1">Nenhuma métrica registrada</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-quaternary)' }}>
            Adicione as métricas mensais do {platformLabel} para acompanhar a evolução
          </p>
          {canEdit && (
            <button onClick={() => setShowForm(true)} className="text-xs font-semibold px-4 py-2 rounded-lg"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)' }}>
              + Adicionar primeiro mês
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((m, i) => (
            <PeriodCard
              key={m.id} metric={m} prevMetric={data[i + 1]}
              platform={platform}
              onDelete={() => deleteMetric(m.id)}
              onEdit={() => { setEditing(m); setShowForm(false) }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
