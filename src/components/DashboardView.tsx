
import { Users, CheckSquare, DollarSign, TrendingUp, AlertTriangle, Clock } from "lucide-react";
import { useClients } from "../hooks/useClients";
import { useTasks } from "../hooks/useTasks";
import { useFinancial } from "../hooks/useFinancial";
import { usePipeline } from "../hooks/usePipeline";
import { Footer } from "./Footer";

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

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
      style={{ backgroundColor: "#0a0a0a", borderColor: accent ? "#7B61FF33" : "#1a1a1a" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#555" }}>{label}</span>
        <span style={{ color: accent ? "#7B61FF" : "#333" }}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-white leading-none">{value}</p>
      {sub && <p className="text-xs" style={{ color: "#555" }}>{sub}</p>}
    </div>
  );
}

const HEALTH_LABEL: Record<string, string> = { green: "Saudável", yellow: "Atenção", red: "Em risco" };
const HEALTH_COLOR: Record<string, string> = { green: "#7B61FF", yellow: "#F59E0B", red: "#EF4444" };

export function DashboardView() {
  const { clients } = useClients();
  const { tasks } = useTasks({});
  const { totalAmount, totalPaid, totalPending, totalOverdue } = useFinancial({
    month: new Date().toISOString().slice(0, 7),
  });
  const { leads, totalPotentialMrr } = usePipeline();

  const today = new Date().toISOString().split("T")[0];

  const activeClients = clients.filter((c) => c.status === "ativo");
  const atRiskClients = clients.filter((c) => c.health_flag === "red" || c.health_flag === "yellow");
  const overdueTasks = tasks.filter(
    (t) => t.deadline && t.deadline < today && t.status !== "concluido" && t.status !== "cancelado"
  );
  const activeLeads = leads.filter((l) => !l.converted_to_client_id && !l.deleted_at);
  const mrr = activeClients.reduce((s, c) => s + (c.monthly_fee ?? 0), 0);

  return (
    <div className="flex flex-col min-h-0">
      <div className="max-w-screen-xl mx-auto w-full px-6 py-8 space-y-8">

        {/* Header */}
        <div>
          <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "#7B61FF" }}>
            Dashboard
          </p>
          <h2 className="text-white font-bold text-lg leading-tight">Visão geral da operação</h2>
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
          <p className="text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: "#555" }}>
            Financeiro — {new Date().toLocaleString("pt-BR", { month: "long", year: "numeric" })}
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total faturado", value: fmt(totalAmount), color: "#A3A3A3" },
              { label: "Recebido", value: fmt(totalPaid), color: "#7B61FF" },
              { label: "Pendente", value: fmt(totalPending), color: "#F59E0B" },
              { label: "Atrasado", value: fmt(totalOverdue), color: "#EF4444" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-xl border p-4"
                style={{ backgroundColor: "#0a0a0a", borderColor: "#1a1a1a" }}
              >
                <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: "#555" }}>{label}</p>
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
              <Clock size={14} style={{ color: "#EF4444" }} />
              <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#EF4444" }}>
                Tarefas atrasadas ({overdueTasks.length})
              </p>
            </div>
            <div
              className="rounded-2xl border divide-y overflow-hidden"
              style={{ backgroundColor: "#0a0a0a", borderColor: "#1a1a1a" }}
            >
              {overdueTasks.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm" style={{ color: "#555" }}>Nenhuma tarefa atrasada</p>
                </div>
              ) : (
                overdueTasks.slice(0, 8).map((task) => {
                  const client = clients.find((c) => c.id === task.client_id);
                  const daysLate = Math.floor(
                    (Date.now() - new Date(task.deadline!).getTime()) / 86400000
                  );
                  return (
                    <div key={task.id} className="flex items-center justify-between px-4 py-3 gap-3" style={{ borderColor: "#1a1a1a" }}>
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate font-medium">{task.title}</p>
                        <p className="text-[11px]" style={{ color: "#555" }}>{client?.name ?? "—"}</p>
                      </div>
                      <span
                        className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded"
                        style={{ backgroundColor: "#2a0a0a", color: "#EF4444" }}
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
              <AlertTriangle size={14} style={{ color: "#F59E0B" }} />
              <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#F59E0B" }}>
                Clientes em atenção ({atRiskClients.length})
              </p>
            </div>
            <div
              className="rounded-2xl border divide-y overflow-hidden"
              style={{ backgroundColor: "#0a0a0a", borderColor: "#1a1a1a" }}
            >
              {atRiskClients.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm" style={{ color: "#555" }}>Todos os clientes estão saudáveis</p>
                </div>
              ) : (
                atRiskClients.map((client) => (
                  <div key={client.id} className="flex items-center justify-between px-4 py-3 gap-3" style={{ borderColor: "#1a1a1a" }}>
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate font-medium">{client.name}</p>
                      <p className="text-[11px]" style={{ color: "#555" }}>{client.segment ?? "—"}</p>
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
      </div>

      <Footer />
    </div>
  );
}
