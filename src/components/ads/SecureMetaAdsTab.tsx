import { useCallback, useEffect, useMemo, useState } from "react"
import { BarChart3, Loader2, RefreshCw } from "lucide-react"
import { supabase } from "../../lib/supabase"

type Insight = { campaign_id: string; campaign_name: string; spend: number; impressions: number; clicks: number; link_clicks: number }
type Report = { status: "ready"; account_name: string; currency: string; period: { since: string; until: string }; totals: Insight & { reach: number; frequency: number }; daily: Insight[]; checked_at: string }

const today = () => new Date().toLocaleDateString("en-CA")
const before = (days: number) => { const date = new Date(); date.setDate(date.getDate() - days); return date.toLocaleDateString("en-CA") }
const money = (value: number, currency = "BRL") => value.toLocaleString("pt-BR", { style: "currency", currency: currency || "BRL", maximumFractionDigits: 0 })
const integer = (value: number) => Math.round(value).toLocaleString("pt-BR")

export function SecureMetaAdsTab({ clientId, onOpenConnections }: { clientId: string; onOpenConnections: () => void }) {
  const [start, setStart] = useState(before(29))
  const [end, setEnd] = useState(today())
  const [report, setReport] = useState<Report | null>(null)
  const [status, setStatus] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [requestId, setRequestId] = useState(0)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setStatus("")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch("/api/ads-report", {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ client_id: clientId, platform: "meta", start, end }),
      })
      const data = await response.json()
      if (!response.ok) {
        if (data.error === "financial_access_required") throw new Error("Seu perfil ainda não tem permissão para consultar métricas de investimento.")
        if (data.error === "meta_token_invalid") throw new Error("A credencial da Meta expirou ou foi revogada. Atualize-a em Conexões do cliente.")
        if (data.error === "meta_permission_denied") throw new Error("A credencial não tem permissão para ler esta conta Meta.")
        throw new Error(data.error === "invalid_period" ? "Selecione um período de até 92 dias." : "Não foi possível consultar o relatório da Meta.")
      }
      if (data.status === "not_configured") { setReport(null); setStatus("not_configured"); return }
      setReport(data as Report)
    } catch (error) {
      if ((error as Error).name !== "AbortError") { setReport(null); setStatus((error as Error).message || "Falha ao consultar os anúncios.") }
    } finally { setLoading(false) }
  }, [clientId, start, end])

  useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => load(controller.signal))
    return () => controller.abort()
  }, [load, requestId])

  const campaigns = useMemo(() => {
    const grouped = new Map<string, { name: string; spend: number; impressions: number; clicks: number; linkClicks: number }>()
    for (const row of report?.daily ?? []) {
      const key = row.campaign_id || row.campaign_name
      const current = grouped.get(key) ?? { name: row.campaign_name || "Campanha sem nome", spend: 0, impressions: 0, clicks: 0, linkClicks: 0 }
      current.spend += row.spend
      current.impressions += row.impressions
      current.clicks += row.clicks
      current.linkClicks += row.link_clicks
      grouped.set(key, current)
    }
    return Array.from(grouped.values()).sort((a, b) => b.spend - a.spend)
  }, [report])

  const card = "rounded-xl border p-4"
  const border = { borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }
  if (status === "not_configured") return <div className="rounded-2xl border p-8 text-center" style={border}><BarChart3 size={28} className="mx-auto" style={{ color: "var(--text-quaternary)" }}/><h3 className="mt-3 text-sm font-semibold text-[var(--text-primary)]">Conexão Meta ainda não cadastrada para este cliente</h3><p className="mx-auto mt-1 max-w-md text-xs" style={{ color: "var(--text-tertiary)" }}>Cadastre a conta e valide o acesso em Conexões do cliente. A credencial fica protegida no servidor.</p><button onClick={onOpenConnections} className="mt-4 rounded-lg px-4 py-2 text-xs font-semibold" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>Abrir conexões</button></div>

  return <section className="space-y-4" aria-label="Relatório Meta Ads">
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border p-4" style={border}>
      <div><p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#1877F2" }}>Conta segura · somente leitura</p><h3 className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{report?.account_name || "Meta Ads"}</h3><p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>Período máximo de 92 dias · dados obtidos diretamente da Meta.</p></div>
      <div className="flex flex-wrap items-end gap-2"><label className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>De<input aria-label="Data inicial do relatório Meta" type="date" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 block rounded-lg border px-2 py-1.5 text-xs text-[var(--text-primary)]" style={{ borderColor: "var(--border-strong)", backgroundColor: "var(--bg-input)" }}/></label><label className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Até<input aria-label="Data final do relatório Meta" type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 block rounded-lg border px-2 py-1.5 text-xs text-[var(--text-primary)]" style={{ borderColor: "var(--border-strong)", backgroundColor: "var(--bg-input)" }}/></label><button aria-label="Atualizar relatório Meta Ads" onClick={() => setRequestId((value) => value + 1)} disabled={loading} className="rounded-lg border p-2 disabled:opacity-50" style={{ borderColor: "var(--border-strong)", color: "var(--accent)" }}>{loading ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>}</button></div>
    </div>
    {status && status !== "not_configured" && <div role="alert" className="rounded-xl border p-4 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>{status}{status.includes("credencial") || status.includes("permissão") ? <button onClick={onOpenConnections} className="ml-2 font-semibold" style={{ color: "var(--accent)" }}>Abrir conexões</button> : null}</div>}
    {report && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Investimento", money(report.totals.spend, report.currency)], ["Impressões", integer(report.totals.impressions)], ["Cliques", integer(report.totals.clicks)], ["Alcance", integer(report.totals.reach)]].map(([label, value]) => <div key={label} className={card} style={border}><p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>{label}</p><p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{value}</p></div>)}</div>
      <div className="overflow-hidden rounded-xl border" style={border}><div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}><div><h4 className="text-xs font-semibold text-[var(--text-primary)]">Campanhas no período</h4><p className="mt-1 text-[10px]" style={{ color: "var(--text-tertiary)" }}>{start.split("-").reverse().join("/")} a {end.split("-").reverse().join("/")}</p></div><span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{campaigns.length} campanha(s)</span></div>{campaigns.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead style={{ color: "var(--text-tertiary)" }}><tr><th className="px-4 py-2 font-medium">Campanha</th><th className="px-4 py-2 font-medium">Investimento</th><th className="px-4 py-2 font-medium">Impressões</th><th className="px-4 py-2 font-medium">Cliques</th><th className="px-4 py-2 font-medium">CPC</th></tr></thead><tbody>{campaigns.map((campaign) => <tr key={campaign.name} className="border-t" style={{ borderColor: "var(--border)" }}><td className="max-w-xs truncate px-4 py-3 font-medium text-[var(--text-primary)]">{campaign.name}</td><td className="px-4 py-3 text-[var(--text-secondary)]">{money(campaign.spend, report.currency)}</td><td className="px-4 py-3 text-[var(--text-secondary)]">{integer(campaign.impressions)}</td><td className="px-4 py-3 text-[var(--text-secondary)]">{integer(campaign.clicks)}</td><td className="px-4 py-3 text-[var(--text-secondary)]">{campaign.clicks ? money(campaign.spend / campaign.clicks, report.currency) : "—"}</td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-xs" style={{ color: "var(--text-tertiary)" }}>Sem campanhas com dados para este período.</p>}</div>
      <p className="text-[10px]" style={{ color: "var(--text-quaternary)" }}>Atualizado em {new Date(report.checked_at).toLocaleString("pt-BR")}. CPC é calculado como investimento ÷ cliques. O relatório não altera campanhas.</p>
    </>}
    {!report && !status && <div className="rounded-xl border p-12 text-center" style={border}><Loader2 size={20} className="mx-auto animate-spin" style={{ color: "var(--accent)" }}/><p className="mt-3 text-xs" style={{ color: "var(--text-tertiary)" }}>Consultando a conta Meta…</p></div>}
  </section>
}
