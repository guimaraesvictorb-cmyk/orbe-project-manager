import { useState } from "react";
import { Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { Task, TaskStatus } from "../../data/tasks";
import {
  isOverdue,
  STATUS_META,
  PRIORITY_META,
  PHASE_SHORT,
} from "../../data/tasks";

interface TaskTableProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

type SortKey = "title" | "client" | "dueDate" | "priority" | "status" | "estimatedHours";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
const STATUS_ORDER: Record<string, number> = {
  ativa: 0, em_andamento: 1, pausada: 2, concluida: 3, cancelada: 4,
};

function formatDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function SortIcon({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={12} className="text-[var(--text-quaternary)]" />;
  return dir === "asc"
    ? <ChevronUp size={12} style={{ color: "var(--accent)" }} />
    : <ChevronDown size={12} style={{ color: "var(--accent)" }} />;
}

// Inline status dropdown
function StatusBadge({
  task,
  onStatusChange,
}: {
  task: Task;
  onStatusChange: (id: string, s: TaskStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[task.status];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
        style={{
          backgroundColor: meta.bg,
          color: meta.color,
          border: `1px solid ${meta.color}33`,
        }}
        title="Clique para mudar o status"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {meta.label}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div
            className="absolute left-0 top-full mt-1 z-20 rounded-lg overflow-hidden shadow-xl w-36"
            style={{ backgroundColor: "var(--border)", border: "1px solid var(--text-quaternary)" }}
            role="listbox"
          >
            {(Object.entries(STATUS_META) as [TaskStatus, typeof STATUS_META[TaskStatus]][]).map(
              ([key, m]) => (
                <button
                  key={key}
                  role="option"
                  aria-selected={task.status === key}
                  onClick={() => {
                    onStatusChange(task.id, key);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium transition-colors duration-100 flex items-center gap-2"
                  style={{
                    color: task.status === key ? m.color : "var(--text-secondary)",
                    backgroundColor: task.status === key ? m.bg : "transparent",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.backgroundColor = m.bg)
                  }
                  onMouseLeave={(e) => {
                    if (task.status !== key)
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: m.color }}
                  />
                  {m.label}
                </button>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function TaskTable({ tasks, onEdit, onDelete, onStatusChange }: TaskTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("dueDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "title": cmp = a.title.localeCompare(b.title); break;
      case "client": cmp = a.client.localeCompare(b.client); break;
      case "dueDate": cmp = a.dueDate.localeCompare(b.dueDate); break;
      case "priority": cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]; break;
      case "status": cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]; break;
      case "estimatedHours": cmp = a.estimatedHours - b.estimatedHours; break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  if (tasks.length === 0) {
    return (
      <div
        className="rounded-xl border border-[var(--border-subtle)] py-16 text-center"
        style={{ backgroundColor: "var(--bg-surface-2)" }}
      >
        <p className="text-[var(--text-secondary)] text-sm">Nenhuma tarefa encontrada.</p>
        <p className="text-[var(--text-tertiary)] text-xs mt-1">
          Ajuste os filtros ou crie uma nova tarefa.
        </p>
      </div>
    );
  }

  const thCls =
    "px-3 py-3 text-left text-[10px] font-semibold tracking-widest uppercase text-[var(--text-secondary)] whitespace-nowrap select-none cursor-pointer hover:text-white transition-colors duration-150";

  function Th({ col, label }: { col: SortKey; label: string }) {
    return (
      <th className={thCls} onClick={() => toggleSort(col)} scope="col">
        <div className="flex items-center gap-1">
          {label}
          <SortIcon col={col} sortKey={sortKey} dir={sortDir} />
        </div>
      </th>
    );
  }

  return (
    <div
      className="rounded-xl border border-[var(--border-subtle)] overflow-hidden"
      style={{ backgroundColor: "var(--bg-surface-2)" }}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[900px]" role="table">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <Th col="title" label="Título" />
              <Th col="client" label="Cliente" />
              <th className={thCls} scope="col">Responsável</th>
              <th className={thCls} scope="col">Fase Orbe</th>
              <th className={thCls} scope="col">Tipo</th>
              <Th col="priority" label="Prioridade" />
              <Th col="status" label="Status" />
              <Th col="dueDate" label="Entrega" />
              <Th col="estimatedHours" label="Est." />
              <th className={thCls + " text-right"} scope="col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((task, idx) => {
              const overdue = isOverdue(task);
              const rowBg = idx % 2 === 0 ? "var(--bg-surface-2)" : "var(--bg-surface-2)";
              const priority = PRIORITY_META[task.priority];

              return (
                <tr
                  key={task.id}
                  style={{ backgroundColor: rowBg, borderBottom: "1px solid var(--border-strong)" }}
                  className="group transition-colors duration-100 hover:bg-[var(--border)]"
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = "var(--border)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = rowBg)
                  }
                >
                  {/* Title */}
                  <td className="px-3 py-3 max-w-[260px]">
                    <p
                      className="text-sm font-medium text-white leading-snug truncate"
                      title={task.title}
                    >
                      {overdue && (
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full mr-2 flex-shrink-0 align-middle mb-0.5"
                          style={{ backgroundColor: "var(--danger)" }}
                          title="Atrasada"
                          aria-label="Tarefa atrasada"
                        />
                      )}
                      {task.title}
                    </p>
                    {task.notes && (
                      <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 truncate" title={task.notes}>
                        {task.notes}
                      </p>
                    )}
                  </td>

                  {/* Cliente */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="text-xs text-[var(--text-secondary)]">{task.client}</span>
                  </td>

                  {/* Responsável */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="text-xs text-[var(--text-secondary)]">{task.responsible}</span>
                  </td>

                  {/* Fase Orbe */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider"
                      style={{
                        backgroundColor: "var(--accent-tint)",
                        color: "var(--accent)",
                        border: "1px solid var(--accent-a33)",
                      }}
                      title={PHASE_SHORT[task.phaseId]}
                    >
                      F{task.phaseId}
                    </span>
                  </td>

                  {/* Tipo */}
                  <td className="px-3 py-3 max-w-[140px]">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[10px] text-[var(--text-secondary)] truncate"
                      style={{ backgroundColor: "var(--border)", maxWidth: "130px" }}
                      title={task.type}
                    >
                      {task.type}
                    </span>
                  </td>

                  {/* Prioridade */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: priority.color }}
                    >
                      {priority.label}
                    </span>
                  </td>

                  {/* Status — inline dropdown */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <StatusBadge task={task} onStatusChange={onStatusChange} />
                  </td>

                  {/* Entrega */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span
                      className="text-xs font-medium"
                      style={{ color: overdue ? "var(--danger)" : "var(--text-secondary)" }}
                      title={overdue ? "Tarefa atrasada" : undefined}
                    >
                      {formatDate(task.dueDate)}
                      {overdue && " ⚠"}
                    </span>
                  </td>

                  {/* Est. horas */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="text-xs text-[var(--text-secondary)]">{task.estimatedHours}h</span>
                  </td>

                  {/* Ações */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(task)}
                        className="w-7 h-7 rounded flex items-center justify-center text-[var(--text-secondary)] hover:text-white hover:bg-[var(--border-subtle)] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                        aria-label={`Editar ${task.title}`}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Excluir "${task.title}"?`)) onDelete(task.id);
                        }}
                        className="w-7 h-7 rounded flex items-center justify-center text-[var(--text-secondary)] hover:text-red-400 hover:bg-[#1f0d0d] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                        aria-label={`Excluir ${task.title}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      <div
        className="px-4 py-2 border-t border-[var(--border-strong)]"
        style={{ backgroundColor: "var(--bg-surface-2)" }}
      >
        <p className="text-[11px] text-[var(--text-tertiary)]">
          Mostrando{" "}
          <span className="text-[var(--text-secondary)] font-medium">{tasks.length}</span>{" "}
          tarefa{tasks.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}
