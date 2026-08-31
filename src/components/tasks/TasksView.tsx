import { useState, useEffect } from "react";
import { Plus, Loader2, ChevronDown, LayoutList, Kanban, X } from "lucide-react";
import { useTasks } from "../../hooks/useTasks";
import { useClients } from "../../hooks/useClients";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import type { Task, Profile, Client } from "../../lib/database.types";

const STATUS_META: Record<Task["status"], { label: string; color: string; bg: string }> = {
  backlog:      { label: "Backlog",      color: "#525252", bg: "#111" },
  em_andamento: { label: "Em Andamento", color: "#3B82F6", bg: "#0d1630" },
  em_revisao:   { label: "Em Revisão",   color: "#F59E0B", bg: "#1a1200" },
  concluido:    { label: "Concluído",    color: "#7B61FF", bg: "#1A1230" },
  cancelado:    { label: "Cancelado",    color: "#EF4444", bg: "#1a0505" },
};

const PRIORITY_META: Record<Task["priority"], { label: string; color: string }> = {
  baixa:   { label: "Baixa",   color: "#525252" },
  media:   { label: "Média",   color: "#3B82F6" },
  alta:    { label: "Alta",    color: "#F59E0B" },
  urgente: { label: "Urgente", color: "#EF4444" },
};

function StatusBadge({ status, onChange }: { status: Task["status"]; onChange: (s: Task["status"]) => void }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[status];
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded uppercase flex items-center gap-1"
        style={{ backgroundColor: meta.bg, color: meta.color, border: `1px solid ${meta.color}33` }}
      >
        {meta.label} <ChevronDown size={9} />
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-20 rounded-xl p-1 flex flex-col gap-0.5"
          style={{ backgroundColor: "#111", border: "1px solid #1e1e1e", minWidth: "130px" }}>
          {(Object.keys(STATUS_META) as Task["status"][]).map((s) => (
            <button key={s} onClick={(e) => { e.stopPropagation(); onChange(s); setOpen(false); }}
              className="text-left px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider"
              style={{ color: STATUS_META[s].color, backgroundColor: s === status ? STATUS_META[s].bg : "transparent" }}>
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskModal({ task, clients, profiles, onClose, onSave, onDelete, currentUserId }: {
  task: Task | null; clients: Client[]; profiles: Profile[];
  onClose: () => void; onSave: (d: Partial<Task>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>; currentUserId: string;
}) {
  const [form, setForm] = useState<Partial<Task>>(
    task ?? { status: "backlog", priority: "media", client_id: "", title: "", created_by: currentUserId, data_source: "manual" }
  );
  const [saving, setSaving] = useState(false);
  const inputStyle = { backgroundColor: "#080808", border: "1px solid #1e1e1e" };
  const inputCls = "w-full rounded-lg px-3 py-2 text-sm text-white placeholder-[#333] focus:outline-none transition-colors";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title?.trim() || !form.client_id) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ backgroundColor: "#0d0d0d", border: "1px solid #1e1e1e" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">{task ? "Editar Tarefa" : "Nova Tarefa"}</h3>
          <button onClick={onClose} style={{ color: "#555" }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input value={form.title ?? ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Título da tarefa *" required autoFocus className={inputCls} style={inputStyle}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#7B61FF44")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#555" }}>Cliente *</label>
              <select value={form.client_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
                required className={inputCls} style={{ ...inputStyle, appearance: "none" as const }}>
                <option value="">Selecionar...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#555" }}>Responsável</label>
              <select value={form.assignee_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, assignee_id: e.target.value || null }))}
                className={inputCls} style={{ ...inputStyle, appearance: "none" as const }}>
                <option value="">Ninguém</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#555" }}>Status</label>
              <select value={form.status ?? "backlog"} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Task["status"] }))}
                className={inputCls} style={{ ...inputStyle, appearance: "none" as const }}>
                {(Object.keys(STATUS_META) as Task["status"][]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#555" }}>Prioridade</label>
              <select value={form.priority ?? "media"} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Task["priority"] }))}
                className={inputCls} style={{ ...inputStyle, appearance: "none" as const }}>
                {(Object.keys(PRIORITY_META) as Task["priority"][]).map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#555" }}>Deadline</label>
              <input type="date" value={form.deadline ?? ""} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value || null }))}
                className={inputCls} style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#7B61FF44")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#555" }}>Repetir</label>
              <select value={form.recurrence ?? "nenhuma"} onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value as Task["recurrence"] }))}
                className={inputCls} style={{ ...inputStyle, appearance: "none" as const }}>
                <option value="nenhuma">Não repetir</option>
                <option value="diaria">Diariamente</option>
                <option value="semanal">Semanalmente</option>
                <option value="quinzenal">Quinzenalmente</option>
                <option value="mensal">Mensalmente</option>
              </select>
            </div>
          </div>
          <textarea value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value || null }))}
            placeholder="Descrição (opcional)" rows={3} className={`${inputCls} resize-none`} style={inputStyle}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#7B61FF44")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")} />
          <div className="flex gap-3 pt-1">
            {task && onDelete && (
              <button type="button" onClick={() => { onDelete(task.id); onClose(); }}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold border" style={{ borderColor: "#EF444433", color: "#EF4444" }}>
                Deletar
              </button>
            )}
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-semibold border" style={{ borderColor: "#1e1e1e", color: "#555" }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving || !form.title || !form.client_id}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
              style={{ backgroundColor: saving || !form.title || !form.client_id ? "#1A1230" : "#7B61FF", color: saving || !form.title || !form.client_id ? "#333" : "#000" }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : task ? "Salvar" : "Criar Tarefa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TasksView({ clientId }: { clientId?: string }) {
  const { tasks, loading, createTask, updateTask, deleteTask } = useTasks({ clientId });
  const { clients } = useClients();
  const { profile } = useAuth();
  const [view, setView] = useState<"list" | "kanban">("list");
  const [editing, setEditing] = useState<Task | null | "new">(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filterStatus, setFilterStatus] = useState<Task["status"] | "todos">("todos");
  const [filterDate, setFilterDate] = useState<"todas" | "hoje" | "semana" | "mes" | "atrasadas">("todas");

  useEffect(() => {
    supabase.from("profiles").select("*").eq("is_active", true).then(({ data }) => setProfiles(data ?? []));
  }, []);

  const filtered = tasks.filter((t) => {
    if (t.parent_task_id) return false;
    if (filterStatus !== "todos" && t.status !== filterStatus) return false;
    if (filterDate !== "todas") {
      const now = new Date()
      const todayStr = now.toDateString()
      const dl = t.deadline ? new Date(t.deadline + "T00:00:00") : null
      if (filterDate === "atrasadas") {
        if (!dl || dl >= new Date(todayStr) || t.status === "concluido" || t.status === "cancelado") return false
      } else if (filterDate === "hoje") {
        if (!dl || dl.toDateString() !== todayStr) return false
      } else if (filterDate === "semana") {
        const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay())
        const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6)
        if (!dl || dl < startOfWeek || dl > endOfWeek) return false
      } else if (filterDate === "mes") {
        if (!dl || dl.getMonth() !== now.getMonth() || dl.getFullYear() !== now.getFullYear()) return false
      }
    }
    return true;
  });

  const today = new Date(new Date().toDateString());
  const overdue = filtered.filter((t) => t.deadline && t.status !== "concluido" && t.status !== "cancelado" && new Date(t.deadline) < today).length;

  async function handleSave(data: Partial<Task>) {
    if (!profile) return;
    if (editing === "new") await createTask({ ...data, created_by: profile.id, data_source: "manual", sort_order: 0 } as never);
    else if (editing) await updateTask(editing.id, data);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <Loader2 size={20} className="animate-spin" style={{ color: "#7B61FF" }} />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "#7B61FF" }}>Gestão de Tarefas</p>
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: "#A3A3A3" }}>{filtered.length} tarefa{filtered.length !== 1 ? "s" : ""}</span>
            {overdue > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                style={{ backgroundColor: "#1a0505", color: "#EF4444", border: "1px solid #EF444433" }}>
                {overdue} atrasada{overdue !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[#1a1a1a] overflow-hidden">
            {([["list", LayoutList], ["kanban", Kanban]] as const).map(([v, Icon]) => (
              <button key={v} onClick={() => setView(v)} className="p-2 transition-colors"
                style={{ backgroundColor: view === v ? "#7B61FF" : "transparent", color: view === v ? "#000" : "#555" }}>
                <Icon size={14} />
              </button>
            ))}
          </div>
          <button onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ backgroundColor: "#7B61FF", color: "#000" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#6247E5")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#7B61FF")}>
            <Plus size={13} /> Nova Tarefa
          </button>
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {([["todos", "Todas", "#7B61FF", "#1A1230"], ...Object.entries(STATUS_META).map(([k, v]) => [k, v.label, v.color, v.bg])] as [string, string, string, string][]).map(([s, label, color, bg]) => (
          <button key={s} onClick={() => setFilterStatus(s as Task["status"] | "todos")}
            className="text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider transition-all"
            style={filterStatus === s ? { color, backgroundColor: bg, border: `1px solid ${color}44` } : { color: "#444", backgroundColor: "transparent", border: "1px solid transparent" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Date filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          ["todas",     "Todas as datas", "#555",    "transparent"],
          ["hoje",      "Hoje",           "#3B82F6", "#0d1630"],
          ["semana",    "Esta semana",    "#8B5CF6", "#130d1f"],
          ["mes",       "Este mês",       "#F59E0B", "#1a1200"],
          ["atrasadas", "Atrasadas",      "#EF4444", "#1a0505"],
        ] as [typeof filterDate, string, string, string][]).map(([v, label, color, bg]) => (
          <button key={v} onClick={() => setFilterDate(v)}
            className="text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider transition-all"
            style={filterDate === v ? { color, backgroundColor: bg, border: `1px solid ${color}44` } : { color: "#333", backgroundColor: "transparent", border: "1px solid transparent" }}>
            {label}
          </button>
        ))}
      </div>

      {/* List view */}
      {view === "list" && (
        <div className="rounded-xl border border-[#1a1a1a] overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-white font-semibold text-sm mb-1">Nenhuma tarefa</p>
              <p className="text-xs mb-4" style={{ color: "#444" }}>Crie a primeira tarefa para começar</p>
              <button onClick={() => setEditing("new")} className="text-xs font-semibold px-4 py-2 rounded-lg" style={{ backgroundColor: "#7B61FF", color: "#000" }}>
                + Nova Tarefa
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "#0d0d0d", borderBottom: "1px solid #1a1a1a" }}>
                  {["Tarefa", "Cliente", "Responsável", "Prioridade", "Deadline", "Status"].map((h) => (
                    <th key={h} className="text-left text-[10px] font-bold tracking-widest uppercase px-4 py-2.5" style={{ color: "#525252" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((task) => {
                  const client = clients.find((c) => c.id === task.client_id);
                  const assignee = profiles.find((p) => p.id === task.assignee_id);
                  const isOverdue = task.deadline && task.status !== "concluido" && task.status !== "cancelado" && new Date(task.deadline) < today;
                  return (
                    <tr key={task.id} className="border-b border-[#111] hover:bg-[#0d0d0d] transition-colors cursor-pointer" onClick={() => setEditing(task)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isOverdue && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                          <span className="text-sm text-white">{task.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {client && <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: "#111", color: "#A3A3A3" }}>{client.name}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#555" }}>{assignee?.display_name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-semibold" style={{ color: PRIORITY_META[task.priority].color }}>{PRIORITY_META[task.priority].label}</span>
                      </td>
                      <td className="px-4 py-3">
                        {task.deadline && <span className="text-xs" style={{ color: isOverdue ? "#EF4444" : "#555" }}>{new Date(task.deadline + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <StatusBadge status={task.status} onChange={(s) => updateTask(task.id, { status: s })} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Kanban view */}
      {view === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {(["backlog", "em_andamento", "em_revisao", "concluido"] as Task["status"][]).map((status) => {
            const col = filtered.filter((t) => t.status === status);
            const meta = STATUS_META[status];
            return (
              <div key={status} className="flex-1 min-w-[220px] max-w-[300px]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: meta.color }}>{meta.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: "#111", color: "#444" }}>{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((task) => {
                    const client = clients.find((c) => c.id === task.client_id);
                    const assignee = profiles.find((p) => p.id === task.assignee_id);
                    const isOverdue = task.deadline && task.status !== "concluido" && new Date(task.deadline) < today;
                    return (
                      <div key={task.id} className="rounded-xl p-3 border border-[#1a1a1a] cursor-pointer transition-all"
                        style={{ backgroundColor: "#0a0a0a" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = `${meta.color}44`)}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "#1a1a1a")}
                        onClick={() => setEditing(task)}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm text-white leading-snug">{task.title}</p>
                          {isOverdue && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />}
                        </div>
                        {client && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: "#111", color: "#555" }}>{client.name}</span>}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] font-semibold" style={{ color: PRIORITY_META[task.priority].color }}>{PRIORITY_META[task.priority].label}</span>
                          {task.deadline && <span className="text-[10px]" style={{ color: isOverdue ? "#EF4444" : "#444" }}>{new Date(task.deadline + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>}
                        </div>
                        {assignee && <p className="text-[10px] mt-1" style={{ color: "#444" }}>{assignee.display_name}</p>}
                      </div>
                    );
                  })}
                  {col.length === 0 && <div className="rounded-xl p-4 border border-dashed border-[#1a1a1a] text-center"><p className="text-[10px]" style={{ color: "#333" }}>Vazio</p></div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing !== null && (
        <TaskModal
          task={editing === "new" ? null : editing}
          clients={clientId ? clients.filter((c) => c.id === clientId) : clients}
          profiles={profiles}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          onDelete={async (id) => { await deleteTask(id); }}
          currentUserId={profile?.id ?? ""}
        />
      )}
    </div>
  );
}
