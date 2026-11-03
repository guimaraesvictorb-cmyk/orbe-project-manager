import { useCallback, useEffect, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useClientAdsMetrics } from '../../hooks/useClientAdsMetrics'
import { useAdsPeriod } from '../../hooks/useAdsPeriod'
import { exportToCSV } from '../../lib/csvExport'

type Report = { status: string; account_name?: string; currency?: string; totals?: { spend: number; impressions: number; clicks: number }; checked_at?: string; error?: string }
type Source = { platform: 'meta' | 'google'; data: Report }
const label = (platform: string) => platform === 'meta' ? 'Meta Ads' : 'Google Ads'
const money = (value: number, currency?: string) => /^[A-Z]{3}$/.test(currency ?? '') ? value.toLocaleString('pt-BR', { style: 'currency', currency }) : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · moeda não informada`
const reason = (data: Report) => data.status === 'not_configured' ? 'Conta não cadastrada' : data.status === 'oauth_pending' ? 'Autorização Google pendente' : data.status === 'developer_token_required' ? 'Developer token pendente' : data.error === 'financial_access_required' ? 'Perfil sem permissão financeira' : 'Consulta indisponível · confira a conexão'

export function CompiladoTab({ clientId, onOpenConnections, onVerified }: { clientId: string; onOpenConnections?: () => void; onVerified?: () => void }) {
  const { profile } = useAuth()
  if (!profile?.can_view_financials) return <p className="p-6 text-sm text-[var(--text-tertiary)]">Seu perfil não tem permissão para consultar investimentos.</p>
  return <LiveCompilado key={clientId} clientId={clientId} onOpenConnections={onOpenConnections} onVerified={onVerified}/>
}
function LiveCompilado({ clientId, onOpenConnections, onVerified }: { clientId: string; onOpenConnections?: () => void; onVerified?: () => void }) {
  const {start,end,setStart,setEnd}=useAdsPeriod()
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const manual = useClientAdsMetrics(clientId)
  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true); setError(''); setSources([])
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Entre novamente para consultar os relatórios.')
      const results = await Promise.all((['meta','google'] as const).map(async platform => {
        try {
          const response = await fetch('/api/ads-report', { method: 'POST', signal, headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ client_id: clientId, platform, start, end }) })
          const data = await response.json() as Report
          return { platform, data: response.ok ? data : { status: 'error', error: data.error } }
        } catch { return { platform, data: { status: 'error' } } }
      }))
      if (signal.aborted) return
      setSources(results)
      if (results.some(source => source.data.status === 'ready')) onVerified?.()
    } catch (cause) { if (!signal.aborted) setError(cause instanceof Error ? cause.message : 'Não foi possível consultar os dados.') }
    finally { if (!signal.aborted) setLoading(false) }
  }, [clientId, start, end, onVerified])
  useEffect(() => { const controller = new AbortController(); void Promise.resolve().then(() => load(controller.signal)); return () => controller.abort() }, [load, revision])
  const ready = sources.filter(source => source.data.status === 'ready' && source.data.totals)
  const currencies = [...new Set(ready.map(source => source.data.currency).filter((currency): currency is string => /^[A-Z]{3}$/.test(currency ?? '')))]
  const input = 'mt-1 block rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--text-primary)]'
  return <section className="space-y-5" aria-label="Compilado de mídia">
    <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"><div><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">Resultados por canal</p><h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Compilado</h2><p className="mt-2 text-xs text-[var(--text-tertiary)]">Contas, investimento e tráfego consultados diretamente nas plataformas. Totais agrupados por moeda.</p></div><div className="flex flex-wrap items-end gap-2"><label className="text-[10px] text-[var(--text-tertiary)]">De<input aria-label="Início do compilado" type="date" value={start} onChange={event => setStart(event.target.value)} className={input}/></label><label className="text-[10px] text-[var(--text-tertiary)]">Até<input aria-label="Fim do compilado" type="date" value={end} onChange={event => setEnd(event.target.value)} className={input}/></label><button aria-label="Atualizar compilado" onClick={() => setRevision(value => value + 1)} disabled={loading} className={`${input} disabled:opacity-50`}><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/></button><button disabled={!ready.length} onClick={() => exportToCSV('compilado.csv', ready.map(source => ({ Plataforma: label(source.platform), Conta: source.data.account_name ?? '', Moeda: source.data.currency ?? '', Investimento: source.data.totals!.spend, Impressoes: source.data.totals!.impressions, Cliques: source.data.totals!.clicks, De: start, Ate: end })))} className={`${input} flex items-center gap-2 disabled:opacity-50`}><Download size={14}/>CSV</button></div></header>
    {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
    {loading ? <p role="status" className="text-sm text-[var(--text-tertiary)]">Consultando os canais…</p> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{currencies.map(currency => <div key={currency} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"><p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">Investimento · {currency}</p><p className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">{money(ready.filter(source => source.data.currency === currency).reduce((sum, source) => sum + source.data.totals!.spend, 0), currency)}</p><p className="mt-2 text-[10px] text-[var(--text-tertiary)]">{ready.filter(source => source.data.currency === currency).map(source => label(source.platform)).join(' + ')}</p></div>)}</div>
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]"><table className="w-full min-w-[650px] text-left text-xs"><thead className="bg-[var(--bg-surface-2)] text-[var(--text-tertiary)]"><tr>{['Canal / conta','Moeda','Investimento','Impressões','Cliques','CPC'].map(text => <th key={text} className="px-4 py-3 font-semibold">{text}</th>)}</tr></thead><tbody>{sources.map(source => <tr key={source.platform} className="border-t border-[var(--border)] text-[var(--text-secondary)]"><td className="px-4 py-4"><strong className="text-[var(--text-primary)]">{label(source.platform)}</strong><p className="mt-1 text-[10px] text-[var(--text-tertiary)]">{source.data.status === 'ready' ? source.data.account_name : reason(source.data)}</p></td><td className="px-4">{source.data.currency ?? '—'}</td><td className="px-4">{source.data.totals ? money(source.data.totals.spend, source.data.currency) : '—'}</td><td className="px-4">{source.data.totals?.impressions.toLocaleString('pt-BR') ?? '—'}</td><td className="px-4">{source.data.totals?.clicks.toLocaleString('pt-BR') ?? '—'}</td><td className="px-4">{source.data.totals?.clicks ? money(source.data.totals.spend / source.data.totals.clicks, source.data.currency) : '—'}</td></tr>)}</tbody></table></div>
      {ready.length < 2 && <div className="rounded-xl border border-[var(--border)] p-4 text-xs text-[var(--text-tertiary)]">O compilado contém {ready.length} de 2 fontes disponíveis para consulta. Valores ausentes ficam sem total. {onOpenConnections && <button onClick={onOpenConnections} className="ml-2 font-semibold text-[var(--accent)]">Conferir conexões →</button>}</div>}
      <p className="text-[10px] text-[var(--text-tertiary)]">Cliques e impressões são contagens por plataforma. Vendas e CAC dependem da fonte oficial e da conciliação das origens de cada cliente.</p>
    </>}
    {(manual.meta.length > 0 || manual.google.length > 0) && <details className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"><summary className="cursor-pointer text-xs font-semibold text-[var(--text-primary)]">Histórico informado manualmente</summary><div className="mt-4 space-y-2">{[...manual.meta.map(row => ({ ...row, platform: 'Meta' })), ...manual.google.map(row => ({ ...row, platform: 'Google' }))].map((row, index) => <p key={index} className="text-xs text-[var(--text-tertiary)]">{row.period} · {row.platform} · investimento informado: {row.investimento?.toLocaleString('pt-BR') ?? '—'} · moeda não registrada no histórico</p>)}</div></details>}
  </section>
}
