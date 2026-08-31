import { CheckCircle2, UserPlus, DollarSign, Activity, Loader2 } from "lucide-react";
import { useActivityFeed, type ActivityType } from "../hooks/useActivityFeed";
import { timeAgo } from "../lib/formatters";

const TYPE_META: Record<ActivityType, { icon: React.ReactNode; label: string; color: string }> = {
  task_completed: { icon: <CheckCircle2 size={13} />, label: "concluiu a tarefa", color: "var(--success)" },
  client_created: { icon: <UserPlus size={13} />, label: "entrou na carteira", color: "var(--accent)" },
  payment_paid:   { icon: <DollarSign size={13} />, label: "pagamento recebido", color: "var(--success)" },
};

export function ActivityFeed() {
  const { items, loading } = useActivityFeed(15);

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Activity size={14} style={{ color: "var(--accent)" }} />
        <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "var(--accent)" }}>
          Atividade recente
        </p>
      </div>
      <div className="rounded-2xl border divide-y overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={18} className="animate-spin" style={{ color: "var(--accent)" }} />
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Nenhuma atividade ainda</p>
          </div>
        ) : (
          items.map((item) => {
            const meta = TYPE_META[item.type];
            return (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3" style={{ borderColor: "var(--border)" }}>
                <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--accent-a22)", color: meta.color }}>
                  {meta.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--text-primary)] truncate">
                    <span className="font-medium">{item.title}</span>
                  </p>
                  <p className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>
                    {meta.label} · {item.subtitle}
                  </p>
                </div>
                <span className="flex-shrink-0 text-[10px]" style={{ color: "var(--text-quaternary)" }}>
                  {timeAgo(item.timestamp)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
