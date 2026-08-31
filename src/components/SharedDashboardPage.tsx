import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { FLAG_META, STATUS_META } from "../lib/clientMeta";
import { fmt, fmtInt } from "../lib/formatters";
import { Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface SharedMetric {
  id: string;
  platform: "meta" | "google";
  period: string;
  investimento: number | null;
  impressoes: number | null;
  alcance: number | null;
  cliques: number | null;
  ctr: number | null;
  resultados: number | null;
  custo_por_resultado: number | null;
  conversoes: number | null;
  roas: number | null;
}

interface SharedClient {
  id: string;
  name: string;
  segment: string | null;
  status: string;
  health_flag: string;
  monthly_investment: number | null;
  tipo_servico: string | null;
}


function Trend({ curr, prev }: { curr: number | null; prev: number | null }) {
  if (curr == null || prev == null || prev === 0) return <Minus size={12} style={{ color: "var(--text-tertiary)" }} />;
  const pct = ((curr - prev) / prev) * 100;
  if (Math.abs(pct) < 0.5) return <Minus size={12} style={{ color: "var(--text-tertiary)" }} />;
  if (pct > 0) return <span className="flex items-center gap-0.5 text-[10px]" style={{ color: "var(--accent)" }}><TrendingUp size={11} />{pct.toFixed(1)}%</span>;
  return <span className="flex items-center gap-0.5 text-[10px]" style={{ color: "var(--danger)" }}><TrendingDown size={11} />{Math.abs(pct).toFixed(1)}%</span>;
}

function PlatformSection({ metrics, platform }: { metrics: SharedMetric[]; platform: "meta" | "google" }) {
  const filtered = metrics.filter((m) => m.platform === platform).sort((a, b) => b.period.localeCompare(a.period));
  if (filtered.length === 0) return null;

  const color = platform === "meta" ? "#1877F2" : "#EA4335";
  const label = platform === "meta" ? "Meta Ads" : "Google Ads";

  return (
    <div>
      <h3 className="text-sm font-bold mb-3" style={{ color }}>{label}</h3>
      <div className="space-y-3">
        {filtered.map((m, i) => {
          const prev = filtered[i + 1];
          const period = new Date(`${m.period}-01`).toLocaleString("pt-BR", { month: "long", year: "numeric" });
          return (
            <div key={m.id} className="rounded-xl border p-4" style={{ backgroundColor: "var(--bg-surface-2)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-[var(--text-primary)] capitalize">{period}</p>
                <Trend curr={m.investimento} prev={prev?.investimento ?? null} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "var(--text-quaternary)" }}>Investimento</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{fmt(m.investimento, "R$ ")}</p>
                </div>
                {platform === "meta" ? (
                  <>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "var(--text-quaternary)" }}>Resultados</p>
                      <p className="text-sm font-bold text-[var(--text-primary)]">{fmtInt(m.resultados)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "var(--text-quaternary)" }}>Custo/resultado</p>
                      <p className="text-sm font-bold text-[var(--text-primary)]">{fmt(m.custo_por_resultado, "R$ ")}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "var(--text-quaternary)" }}>CTR</p>
                      <p className="text-sm font-bold text-[var(--text-primary)]">{m.ctr != null ? m.ctr + "%" : "—"}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "var(--text-quaternary)" }}>Cliques</p>
                      <p className="text-sm font-bold text-[var(--text-primary)]">{fmtInt(m.cliques)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "var(--text-quaternary)" }}>Conversões</p>
                      <p className="text-sm font-bold text-[var(--text-primary)]">{fmtInt(m.conversoes)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "var(--text-quaternary)" }}>ROAS</p>
                      <p className="text-sm font-bold text-[var(--text-primary)]">{m.roas ?? "—"}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SharedDashboardPage({ token }: { token: string }) {
  const [client, setClient] = useState<SharedClient | null>(null);
  const [metrics, setMetrics] = useState<SharedMetric[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc("get_client_by_share_token", { p_token: token }).then(({ data, error: err }) => {
      if (err || !data) { setError("Link inválido ou expirado."); setLoading(false); return; }
      if (data.error) { setError(data.error); setLoading(false); return; }
      setClient(data.client);
      setMetrics(data.metrics ?? []);
      setLoading(false);
    });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex flex-col items-center justify-center gap-3">
        <p className="text-[var(--text-primary)] font-semibold">Link inválido</p>
        <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>{error || "Este link não existe ou expirou."}</p>
      </div>
    );
  }

  const flag = FLAG_META[client.health_flag as keyof typeof FLAG_META] ?? { label: "—", color: "var(--text-tertiary)", bg: "var(--bg-surface-2)" };
  const status = STATUS_META[client.status as keyof typeof STATUS_META] ?? { label: "—", color: "var(--text-tertiary)" };

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] font-sans">
      {/* Header */}
      <div style={{ backgroundColor: "#050505", borderBottom: "1px solid var(--bg-surface-2)" }}>
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-xl font-bold leading-none" style={{ fontFamily: "Arial, sans-serif", letterSpacing: "-2px" }}>
              <span className="text-[var(--text-primary)]">Orbe</span>
            </div>
            <div>
              <p className="text-[var(--text-primary)] font-semibold text-xs leading-tight">Dashboard do Cliente</p>
              <p className="text-[10px]" style={{ color: "var(--text-quaternary)" }}>Orbe Marketing</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: flag.bg, color: flag.color }}>{flag.label}</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Client info */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{client.name}</h1>
          <div className="flex items-center gap-3 flex-wrap">
            {client.segment && <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{client.segment}</span>}
            {client.tipo_servico && <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>• {client.tipo_servico}</span>}
            <span className="text-xs font-semibold" style={{ color: status.color }}>{status.label}</span>
          </div>
        </div>

        {/* Metrics */}
        {metrics.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] py-16 text-center" style={{ backgroundColor: "var(--bg-surface)" }}>
            <p className="text-sm" style={{ color: "var(--text-quaternary)" }}>Nenhuma métrica disponível ainda</p>
          </div>
        ) : (
          <div className="space-y-8">
            <PlatformSection metrics={metrics} platform="meta" />
            <PlatformSection metrics={metrics} platform="google" />
          </div>
        )}

        <p className="text-center text-[10px]" style={{ color: "#222" }}>
          Gerado por Orbe Operating System • {new Date().toLocaleDateString("pt-BR")}
        </p>
      </div>
    </div>
  );
}
