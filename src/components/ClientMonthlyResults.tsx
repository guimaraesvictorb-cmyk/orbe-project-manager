import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { previousMonth } from '../lib/clientTimeline'
type Metric = { status: string; amount_cents: number | null }
type Snapshot = { checked_at: string; coverage_start: string | null; attribution: { channels: Record<string, number> }; units: { branch: { name: string }; sales: number; first_memberships: number; renewals: number; unclassified: number }[]; cac_meta: Metric; cac_google?: Metric; ltv: Metric; ltv_channels?: Record<string, Metric> }
type Observation = { period_start: string; period_end: string; channel: string; confirmed_outcomes: number; attributed_spend_cents: number | null; cohort_customers: number | null; realized_revenue_cents: number | null }
type Reply = { status: string; preview?: Snapshot; error?: string }
const requests = new Map<string, { at: number; promise: Promise<Reply> }>()
const reasons: Record<string,string> = { history_partial: 'Histórico de origens não cobre todo o mês', no_confirmed_students: 'Sem novas matrículas conciliadas', no_attributed_students: 'Sem coorte atribuída identificada', unit_spend_pending: 'Investimento e unidades ainda sem o mesmo escopo', spend_pending: 'Investimento do canal ainda sem conciliação', incompatible_spend: 'Moeda ou período do investimento incompatível', financial_reconciliation_pending: 'Recebimentos ainda sem conciliação', budget_pending: 'Coorte aguarda conciliação financeira completa' }
const value = (metric?: Metric) => metric?.amount_cents == null ? 'Indisponível' : (metric.amount_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function ClientMonthlyResults({ clientId, source, observations, onConnections }: { clientId: string; source: string; observations: Observation[]; onConnections: () => void }) {
  const { profile } = useAuth()
  const period = previousMonth()
  const isEvo = /evo/i.test(source)
  const [reply, setReply] = useState<Reply | null>(null)
  const [loading, setLoading] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!profile?.can_view_financials || profile.role !== 'admin' || !isEvo) return
    let active = true
    const key = `${profile.id}:${clientId}:${period.month}`
    async function read() {
      if (!active) return
      setLoading(true)
      try {
        let entry = requests.get(key)
        if (!entry || revision > 0 || Date.now() - entry.at > 300000) {
          const promise = (async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) throw new Error('Sessão expirada')
            async function call(action: 'report' | 'preview') {
              const response = await fetch('/api/evo-connection', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session!.access_token}` }, body: JSON.stringify({ action, client_id: clientId, preview_scope: 'all', start: period.start, end: period.end }) })
              const body = await response.json() as Reply
              if (!response.ok) return { status: 'error', error: body.error } as Reply
              return body
            }
            if (revision > 0) return call('preview')
            const cached = await call('report')
            if (['missing','configuration_changed'].includes(cached.status) || cached.preview && Date.now() - Date.parse(cached.preview.checked_at) > 86400000) return call('preview')
            return cached
          })()
          entry = { at: Date.now(), promise }; requests.set(key, entry)
          if (requests.size > 32) requests.delete(requests.keys().next().value!)
        }
        const data = await entry.promise
        if (active) setReply(data)
      } catch { if (active) setReply({ status: 'error' }); requests.delete(key) }
      finally { if (active) setLoading(false) }
    }
    void Promise.resolve().then(read)
    return () => { active = false }
  }, [clientId, isEvo, period.month, period.start, period.end, profile?.id, profile?.role, profile?.can_view_financials, revision])
  if (!profile?.can_view_financials) return null
  const snapshot = reply?.preview
  const manual = observations.filter(row => row.period_start === period.start && row.period_end === period.end)
  return <section aria-label="Resultados do mês anterior" className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"><header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">Mês anterior · {period.month.split('-').reverse().join('/')}</p><h3 className="mt-2 text-base font-semibold text-[var(--text-primary)]">CAC e LTV por canal</h3><p className="mt-2 text-xs text-[var(--text-tertiary)]">Fonte oficial: {source || 'a confirmar'}. Metas, conversas e renovações mantêm seus próprios indicadores.</p></div>{isEvo && profile.role === 'admin' && <button disabled={loading} onClick={() => setRevision(number => number + 1)} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--accent)] disabled:opacity-50"><RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>{loading ? 'Conferindo mês…' : 'Atualizar mês'}</button>}</header>
    {loading && <p role="status" className="mt-4 text-xs text-[var(--text-tertiary)]">Conferindo todas as páginas do mês e as unidades conectadas ao EVO…</p>}
    {snapshot && <><div className="mt-4 grid gap-2 sm:grid-cols-3">{snapshot.units.map(unit => <div key={unit.branch.name} className="rounded-xl bg-[var(--bg-surface-2)] p-3"><p className="text-[10px] font-semibold text-[var(--text-primary)]">{unit.branch.name}</p><p className="mt-2 text-sm text-[var(--text-secondary)]">{unit.sales.toLocaleString('pt-BR')} registros de venda de planos</p><p className="mt-1 text-[10px] text-[var(--text-tertiary)]">{unit.first_memberships} primeiras matrículas identificadas · {unit.renewals} renovações · {unit.unclassified} para revisão</p></div>)}</div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-xs"><thead className="text-[var(--text-tertiary)]"><tr><th className="py-3">Canal</th><th>Matrículas conciliadas</th><th>CAC observado</th><th>LTV realizado da coorte</th></tr></thead><tbody>{(['Meta','Google'] as const).map(channel => { const cac = channel === 'Meta' ? snapshot.cac_meta : snapshot.cac_google; const ltv = snapshot.ltv_channels?.[channel]; return <tr key={channel} className="border-t border-[var(--border)] text-[var(--text-secondary)]"><td className="py-3 font-semibold">{channel} Ads</td><td>{snapshot.attribution.channels[channel] ?? 0} identificadas</td><td><p>{value(cac)}</p>{cac?.amount_cents == null && <p className="mt-1 max-w-48 text-[10px] text-[var(--text-tertiary)]">{reasons[cac?.status ?? ''] ?? 'Aguardando conciliação do canal'}</p>}</td><td><p>{value(ltv)}</p>{ltv?.amount_cents == null && <p className="mt-1 max-w-48 text-[10px] text-[var(--text-tertiary)]">{reasons[snapshot.ltv.status] ?? 'Aguardando coorte e recebimentos confirmados'}</p>}</td></tr> })}</tbody></table></div><p className="mt-3 text-[10px] text-[var(--text-tertiary)]">Conferido em {new Date(snapshot.checked_at).toLocaleString('pt-BR')}. “Identificadas” representa a conciliação disponível; não é o total de novas matrículas quando o histórico está incompleto. LTV realizado considera recebimentos da coorte identificada até a data da consulta.</p></>}
    {!snapshot && !loading && !manual.length && <div className="mt-4 rounded-xl border border-dashed border-[var(--border-strong)] p-4"><p className="text-xs text-[var(--text-secondary)]">Não há apuração confirmada para {period.month.split('-').reverse().join('/')}.</p><p className="mt-2 text-xs text-[var(--text-tertiary)]">{reply?.error === 'evo_preview_too_large' ? 'O volume do período exige uma consulta menor para concluir a conferência.' : isEvo ? 'Confira o vínculo do EVO e a cobertura das unidades.' : 'A integração da fonte oficial precisa fornecer novos clientes e recebimentos confirmados.'}</p><button onClick={onConnections} className="mt-3 text-xs font-semibold text-[var(--accent)]">Conferir fonte oficial →</button></div>}
    {manual.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">{manual.map(row => <div key={row.channel} className="rounded-xl bg-[var(--bg-surface-2)] p-4"><h4 className="text-xs font-semibold text-[var(--text-primary)]">{row.channel} · apuração confirmada</h4><p className="mt-2 text-xs text-[var(--text-secondary)]">CAC: {value({ status: 'manual', amount_cents: row.confirmed_outcomes > 0 && row.attributed_spend_cents != null ? Math.round(row.attributed_spend_cents / row.confirmed_outcomes) : null })}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">LTV realizado: {value({ status: 'manual', amount_cents: row.cohort_customers && row.realized_revenue_cents != null ? Math.round(row.realized_revenue_cents / row.cohort_customers) : null })}</p></div>)}</div>}
  </section>
}
