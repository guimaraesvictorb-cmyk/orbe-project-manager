import type { Task } from "../../data/tasks";
import { isOverdue } from "../../data/tasks";

interface TaskStatsProps {
  tasks: Task[];
}

export function TaskStats({ tasks }: TaskStatsProps) {
  const total       = tasks.length;
  const ativas      = tasks.filter(t => t.status === "ativa").length;
  const andamento   = tasks.filter(t => t.status === "em_andamento").length;
  const concluidas  = tasks.filter(t => t.status === "concluida").length;
  const atrasadas   = tasks.filter(isOverdue).length;

  const items = [
    { label: "Total",         value: total,      color: "var(--text-secondary)" },
    { label: "Ativas",        value: ativas,     color: "var(--accent)" },
    { label: "Em andamento",  value: andamento,  color: "#60A5FA" },
    { label: "Concluídas",    value: concluidas, color: "var(--text-secondary)" },
    { label: "Atrasadas",     value: atrasadas,  color: atrasadas > 0 ? "var(--danger)" : "var(--text-quaternary)" },
  ];

  return (
    <div
      className="flex items-center rounded-xl overflow-hidden border border-[var(--border-strong)]"
      style={{ backgroundColor: "var(--bg-surface)" }}
      role="list"
      aria-label="Resumo de tarefas"
    >
      {items.map(({ label, value, color }) => (
        <div
          key={label}
          className="flex-1 flex flex-col items-center justify-center py-3 px-2"
          style={{ borderRight: "1px solid var(--border-strong)" }}
          role="listitem"
        >
          <span
            className="text-xl font-bold leading-none tabular-nums"
            style={{ color }}
          >
            {value}
          </span>
          <span className="text-[10px] text-[var(--text-quaternary)] mt-1 uppercase tracking-wider text-center leading-tight">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
