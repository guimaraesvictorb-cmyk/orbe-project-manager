import { Loader2 } from 'lucide-react'
import { useClientAdsMetrics } from '../../hooks/useClientAdsMetrics'
import { fmt, fmtCurrency } from '../../lib/formatters'

interface CompiladoTabProps { clientId: string }

export function CompiladoTab({ clientId }: CompiladoTabProps) {
  const { meta, google, loading } = useClientAdsMetrics(clientId)

  if (loading) return (
    <div className="flex justify-center py-12">
      <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
    </div>
  )

  const allPeriods = [...new Set([...meta.map((m) => m.period), ...google.map((m) => m.period)])].sort().reverse()

  if (allPeriods.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] py-16 text-center max-w-2xl" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <p className="text-sm font-semibold text-white mb-1">Sem dados para compilar</p>
        <p className="text-xs" style={{ color: 'var(--text-quaternary)' }}>Adicione métricas nas abas Meta Ads e Google Ads primeiro</p>
      </div>
    )
  }

  const totalMeta = meta.reduce((s, m) => s + (m.investimento ?? 0), 0)
  const totalGoogle = google.reduce((s, m) => s + (m.investimento ?? 0), 0)
  const totalInvest = totalMeta + totalGoogle

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total investido', value: fmtCurrency(totalInvest), color: 'var(--accent)' },
          { label: 'Meta Ads', value: fmtCurrency(totalMeta), color: '#1877F2' },
          { label: 'Google Ads', value: fmtCurrency(totalGoogle), color: '#EA4335' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
            <p className="text-lg font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Period breakdown table */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-tertiary)' }}>Comparativo por mês</p>
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div
            className="grid px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest"
            style={{ gridTemplateColumns: '130px 1fr 1fr 1fr 1fr 1fr', backgroundColor: 'var(--bg-surface)', color: 'var(--text-quaternary)', borderBottom: '1px solid var(--bg-surface-2)' }}
          >
            <span>Mês</span>
            <span>Invest. Meta</span>
            <span>Invest. Google</span>
            <span>Total</span>
            <span>Cliques</span>
            <span>Impressões</span>
          </div>
          {allPeriods.map((period) => {
            const m = meta.find((x) => x.period === period)
            const g = google.find((x) => x.period === period)
            const totalP = (m?.investimento ?? 0) + (g?.investimento ?? 0)
            const cliques = (m?.cliques ?? 0) + (g?.cliques ?? 0)
            const impressoes = (m?.impressoes ?? 0) + (g?.impressoes ?? 0)
            const [y, mo] = period.split('-')
            const label = new Date(`${y}-${mo}-01`).toLocaleString('pt-BR', { month: 'short', year: '2-digit' })
            return (
              <div
                key={period}
                className="grid items-center px-4 py-3"
                style={{ gridTemplateColumns: '130px 1fr 1fr 1fr 1fr 1fr', borderBottom: '1px solid var(--bg-surface-2)' }}
              >
                <span className="text-xs font-semibold text-white capitalize">{label}</span>
                <span className="text-xs" style={{ color: '#1877F2' }}>{m ? fmtCurrency(m.investimento) : '—'}</span>
                <span className="text-xs" style={{ color: '#EA4335' }}>{g ? fmtCurrency(g.investimento) : '—'}</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{fmtCurrency(totalP || null)}</span>
                <span className="text-xs text-white">{cliques ? fmt(cliques) : '—'}</span>
                <span className="text-xs text-white">{impressoes ? fmt(impressoes) : '—'}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Platform allocation bar */}
      {totalInvest > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>Distribuição de investimento</p>
          <div className="h-3 rounded-full overflow-hidden flex" style={{ backgroundColor: 'var(--border)' }}>
            <div style={{ width: `${(totalMeta / totalInvest) * 100}%`, backgroundColor: '#1877F2' }} className="transition-all" />
            <div style={{ width: `${(totalGoogle / totalInvest) * 100}%`, backgroundColor: '#EA4335' }} className="transition-all" />
          </div>
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-[11px]" style={{ color: '#1877F2' }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#1877F2' }} />
              Meta {totalInvest > 0 ? ((totalMeta / totalInvest) * 100).toFixed(0) : 0}%
            </span>
            <span className="flex items-center gap-1.5 text-[11px]" style={{ color: '#EA4335' }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#EA4335' }} />
              Google {totalInvest > 0 ? ((totalGoogle / totalInvest) * 100).toFixed(0) : 0}%
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
