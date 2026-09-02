
import { Users, CheckSquare, DollarSign, TrendingUp, AlertTriangle, Clock, Trophy, MoonStar } from "lucide-react";
import { useClients } from "../hooks/useClients";
import { useTasks } from "../hooks/useTasks";
import { useFinancial } from "../hooks/useFinancial";
import { usePipeline } from "../hooks/usePipeline";
import { Footer } from "./Footer";
import { ActivityFeed } from "./ActivityFeed";
import { fmtCurrency0, todayLocal, currentMonthLocal } from "../lib/formatters";

const fmt = fmtCurrency0;

function StatCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-3"
      style={{ backgroundColor: "var(--bg-surface)", borderColor: accent ? "var(--accent-a33)" : "var(--border)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--text-tertiary)" }}>{label}</span>
        <span style={{ color: accent ? "var(--accent)" : "var(--text-quaternary)" }}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-[var(--text-primary)] leading-none">{value}</p>
      {sub && <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{sub}</p>}
    </div>
  );
}

const HEALTH_LABEL: Record<string, string> = { green: "Saudável", yellow: "Atenção", red: "Em risco" };
const HEALTH_COLOR: Record<string, string> = { green: "var(--success)", yellow: "var(--warning)", red: "var(--danger)" };

export function DashboardView() {
  const { clients } = useClients();
  const { tasks } = useTasks({});
  const { totalAmount, totalPaid, totalPending, totalOverdue } = useFinancial({
    month: currentMonthLocal(),
  });
  const { leads, totalPotentialMrr } = usePipeline();

  const today = todayLocal();

  const activeClients = clients.filter((c) => c.status === "ativo");
  const atRiskClients = clients.filter((c) => c.health_flag === "red" || c.health_flag === "yellow");
  const overdueTasks = tasks.filter(
    (t) => t.deadline && t.deadline < today && t.status !== "concluido" && t.status !== "cancelado"
  );
  const activeLeads = leads.filter((l) => !l.converted_to_client_id && !l.deleted_at);
  const mrr = activeClients.reduce((s, c) => s + (c.monthly_fee ?? 0), 0);

  const topByMrr = [...activeClients]
    .sort((a, b) => (b.monthly_fee ?? 0) - (a.monthly_fee ?? 0))
    .slice(0, 5);

  const STALE_DAYS = 14;
  const lastTaskMsByClient = tasks.reduce((map, t) => {
    const ms = new Date(t.updated_at).getTime();
    if (!map.has(t.client_id) || ms > map.get(t.client_id)!) map.set(t.client_id, ms);
    return map;
  }, new Map<string, number>());
  const staleClients = activeClients
    .map((c) => {
      const lastActivityMs = Math.max(lastTaskMsByClient.get(c.id) ?? 0, new Date(c.updated_at).getTime());
      return { client: c, daysSince: Math.floor((Date.now() - lastActivityMs) / 86400000) };
    })
    .filter((x) => x.daysSince > STALE_DAYS)
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 5);

  return (
    <div className="flex flex-col min-h-0">
      <div className="max-w-screen-xl mx-auto w-full px-6 py-8 space-y-8">

        {/* Header */}
        <div>
          <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "var(--accent)" }}>
            Dashboard
          </p>
          <h2 className="text-[var(--text-primary)] font-bold text-lg leading-tight">Visão geral da operação</h2>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Users size={16} />}
            label="Clientes ativos"
            value={activeClients.length}
            sub={`${atRiskClients.length} em atenção`}
            accent={activeClients.length > 0}
          />
          <StatCard
            icon={<DollarSign size={16} />}
            label="MRR atual"
            value={fmt(mrr)}
            sub="mensalidades ativas"
            accent
          />
          <StatCard
            icon={<CheckSquare size={16} />}
            label="Tarefas atrasadas"
            value={overdueTasks.length}
            sub="pendentes de entrega"
            accent={overdueTasks.length === 0}
          />
          <StatCard
            icon={<TrendingUp size={16} />}
            label="Leads no pipeline"
            value={activeLeads.length}
            sub={`${fmt(totalPotentialMrr)} potencial`}
          />
        </div>

        {/* Financial month summary */}
        <section>
          <p className="text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: "var(--text-tertiary)" }}>
            Financeiro — {new Date().toLocaleString("pt-BR", { month: "long", year: "numeric" })}
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total faturado", value: fmt(totalAmount), color: "var(--text-secondary)" },
              { label: "Recebido", value: fmt(totalPaid), color: "var(--accent)" },
              { label: "Pendente", value: fmt(totalPending), color: "var(--warning)" },
              { label: "Atrasado", value: fmt(totalOverdue), color: "var(--danger)" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-xl border p-4"
                style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
              >
                <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: "var(--text-tertiary)" }}>{label}</p>
                <p className="text-lg font-bold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Two columns: overdue tasks + clients at risk */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Overdue tasks */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Clock size={14} style={{ color: "var(--danger)" }} />
              <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "var(--danger)" }}>
                Tarefas atrasadas ({overdueTasks.length})
              </p>
            </div>
            <div
              className="rounded-2xl border divide-y overflow-hidden"
              style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
            >
              {overdueTasks.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Nenhuma tarefa atrasada</p>
                </div>
              ) : (
                overdueTasks.slice(0, 8).map((task) => {
                  const client = clients.find((c) => c.id === task.client_id);
                  const daysLate = Math.floor(
                    (Date.now() - new Date(task.deadline!).getTime()) / 86400000
                  );
                  return (
                    <div key={task.id} className="flex items-center justify-between px-4 py-3 gap-3" style={{ borderColor: "var(--border)" }}>
                      <div className="min-w-0">
                        <p className="text-sm text-[var(--text-primary)] truncate font-medium">{task.title}</p>
                        <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{client?.name ?? "—"}</p>
                      </div>
                      <span
                        className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded"
                        style={{ backgroundColor: "#2a0a0a", color: "var(--danger)" }}
                      >
                        {daysLate}d atraso
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Clients at risk */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={14} style={{ color: "var(--warning)" }} />
              <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "var(--warning)" }}>
                Clientes em atenção ({atRiskClients.length})
              </p>
            </div>
            <div
              className="rounded-2xl border divide-y overflow-hidden"
              style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
            >
              {atRiskClients.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Todos os clientes estão saudáveis</p>
                </div>
              ) : (
                atRiskClients.map((client) => (
                  <div key={client.id} className="flex items-center justify-between px-4 py-3 gap-3" style={{ borderColor: "var(--border)" }}>
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate font-medium">{client.name}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{client.segment ?? "—"}</p>
                    </div>
                    <span
                      className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: HEALTH_COLOR[client.health_flag] + "22",
                        color: HEALTH_COLOR[client.health_flag],
                      }}
                    >
                      {HEALTH_LABEL[client.health_flag]}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Two columns: top MRR + stale clients */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={14} style={{ color: "var(--accent)" }} />
              <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "var(--accent)" }}>
                Top 5 clientes por MRR
              </p>
            </div>
            <div className="rounded-2xl border divide-y overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
              {topByMrr.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Nenhum cliente com mensalidade cadastrada</p>
                </div>
              ) : (
                topByMrr.map((client, i) => (
                  <div key={client.id} className="flex items-center justify-between px-4 py-3 gap-3" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex-shrink-0 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--accent-a22)", color: "var(--accent)" }}>
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-[var(--text-primary)] truncate font-medium">{client.name}</p>
                        <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{client.segment ?? "—"}</p>
                      </div>
                    </div>
                    <span className="flex-shrink-0 text-sm font-bold" style={{ color: "var(--accent)" }}>
                      {fmt(client.monthly_fee ?? 0)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4">
              <MoonStar size={14} style={{ color: "var(--text-tertiary)" }} />
              <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "var(--text-tertiary)" }}>
                Sem atividade recente ({staleClients.length})
              </p>
            </div>
            <div className="rounded-2xl border divide-y overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
              {staleClients.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Todos os clientes ativos tiveram atividade recente</p>
                </div>
              ) : (
                staleClients.map(({ client, daysSince }) => (
                  <div key={client.id} className="flex items-center justify-between px-4 py-3 gap-3" style={{ borderColor: "var(--border)" }}>
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate font-medium">{client.name}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{client.segment ?? "—"}</p>
                    </div>
                    <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-secondary)" }}>
                      {daysSince}d parado
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <ActivityFeed />
      </div>

      <Footer />
    </div>
  );
}
