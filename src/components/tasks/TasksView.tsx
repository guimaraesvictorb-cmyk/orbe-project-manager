import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Plus, Loader2, ChevronDown, LayoutList, Kanban, X, Trash2, Copy } from "lucide-react";
import { useTasks } from "../../hooks/useTasks";
import { useClients } from "../../hooks/useClients";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import type { Task, Profile, Client } from "../../lib/database.types";
import { CommentThread } from "../CommentThread";
import { todayLocal } from "../../lib/formatters";

const STATUS_META: Record<Task["status"], { label: string; color: string; bg: string }> = {
  backlog:      { label: "Backlog",      color: "#525252", bg: "var(--bg-surface-2)" },
  em_andamento: { label: "Em Andamento", color: "#3B82F6", bg: "#0d1630" },
  em_revisao:   { label: "Em Revisão",   color: "var(--warning)", bg: "#1a1200" },
  concluido:    { label: "Concluído",    color: "var(--success)", bg: "#0f2117" },
  cancelado:    { label: "Cancelado",    color: "var(--danger)", bg: "#1a0505" },
};

const PRIORITY_META: Record<Task["priority"], { label: string; color: string }> = {
  baixa:   { label: "Baixa",   color: "#525252" },
  media:   { label: "Média",   color: "#3B82F6" },
  alta:    { label: "Alta",    color: "var(--warning)" },
  urgente: { label: "Urgente", color: "var(--danger)" },
};

function StatusBadge({ status, onChange }: { status: Task["status"]; onChange: (s: Task["status"]) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const meta = STATUS_META[status];

  function openMenu() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left });
    setOpen(true);
  }

  // The status pill lives inside a table wrapped in an `overflow-hidden`
  // rounded container (for the rounded corners), which silently clips any
  // absolutely-positioned dropdown that would render outside its bounds —
  // the menu "opens" but is invisible. Portal it to <body> with fixed
  // positioning computed from the button instead, so it always escapes.
  useEffect(() => {
    if (!open) return;
    function close() { setOpen(false); }
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : openMenu(); }}
        className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded uppercase flex items-center gap-1"
        style={{ backgroundColor: meta.bg, color: meta.color, border: `1px solid ${meta.color}33` }}
      >
        {meta.label} <ChevronDown size={9} />
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div
            className="fixed z-50 rounded-xl p-1 flex flex-col gap-0.5"
            style={{ top: pos.top, left: pos.left, backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-strong)", minWidth: "130px", boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}
          >
            {(Object.keys(STATUS_META) as Task["status"][]).map((s) => (
              <button key={s} onClick={(e) => { e.stopPropagation(); onChange(s); setOpen(false); }}
                className="text-left px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                style={{ color: STATUS_META[s].color, backgroundColor: s === status ? STATUS_META[s].bg : "transparent" }}>
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

function TaskModal({ task, clients, profiles, onClose, onSave, onDelete, onDuplicate, currentUserId }: {
  task: Task | null; clients: Client[]; profiles: Profile[];
  onClose: () => void; onSave: (d: Partial<Task>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>; onDuplicate?: (task: Task) => Promise<void>; currentUserId: string;
}) {
  const [form, setForm] = useState<Partial<Task>>(
    task ?? { status: "backlog", priority: "media", client_id: "", title: "", created_by: currentUserId, data_source: "manual" }
  );
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const inputStyle = { backgroundColor: "var(--bg-input)", border: "1px solid var(--border-strong)" };
  const inputCls = "w-full rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-quaternary)] focus:outline-none transition-colors";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title?.trim() || !form.client_id) return;
    setSaving(true);
    // Belt-and-suspenders: recurrence needs a fixed anchor date no matter which
    // path set it (this dropdown, a duplicated task, an older row from before
    // this invariant existed).
    const hasRecurrence = form.recurrence && form.recurrence !== "nenhuma";
    await onSave(hasRecurrence && !form.deadline ? { ...form, deadline: todayLocal() } : form);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-strong)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-[var(--text-primary)] font-semibold text-sm">{task ? "Editar Tarefa" : "Nova Tarefa"}</h3>
          <button onClick={onClose} style={{ color: "var(--text-tertiary)" }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input value={form.title ?? ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Título da tarefa *" required autoFocus className={inputCls} style={inputStyle}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-a44)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Cliente *</label>
              <select value={form.client_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
                required className={inputCls} style={{ ...inputStyle, appearance: "none" as const }}>
                <option value="">Selecionar...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Responsável</label>
              <select value={form.assignee_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, assignee_id: e.target.value || null }))}
                className={inputCls} style={{ ...inputStyle, appearance: "none" as const }}>
                <option value="">Ninguém</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Status</label>
              <select value={form.status ?? "backlog"} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Task["status"] }))}
                className={inputCls} style={{ ...inputStyle, appearance: "none" as const }}>
                {(Object.keys(STATUS_META) as Task["status"][]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Prioridade</label>
              <select value={form.priority ?? "media"} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Task["priority"] }))}
                className={inputCls} style={{ ...inputStyle, appearance: "none" as const }}>
                {(Object.keys(PRIORITY_META) as Task["priority"][]).map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Deadline</label>
              <input type="date" value={form.deadline ?? ""} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value || null }))}
                className={inputCls} style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-a44)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Repetir</label>
              <select value={form.recurrence ?? "nenhuma"} onChange={(e) => {
                  const recurrence = e.target.value as Task["recurrence"];
                  setForm((f) => ({
                    ...f,
                    recurrence,
                    // A recorrência conta a partir do deadline — sem uma data aqui, não há "toda semana" fixo pra ancorar.
                    deadline: recurrence !== "nenhuma" && !f.deadline ? todayLocal() : f.deadline,
                  }));
                }}
                className={inputCls} style={{ ...inputStyle, appearance: "none" as const }}>
                <option value="nenhuma">Não repetir</option>
                <option value="diaria">Diariamente</option>
                <option value="semanal">Semanalmente</option>
                <option value="quinzenal">Quinzenalmente</option>
                <option value="mensal">Mensalmente</option>
              </select>
              {form.recurrence && form.recurrence !== "nenhuma" && (
                <p className="text-[10px]" style={{ color: "var(--text-quaternary)" }}>Repete sempre a partir do Deadline, não da data em que for concluída.</p>
              )}
            </div>
          </div>
          <textarea value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value || null }))}
            placeholder="Descrição (opcional)" rows={3} className={`${inputCls} resize-none`} style={inputStyle}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-a44)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")} />
          <div className="flex gap-3 pt-1">
            {task && onDelete && (
              <button type="button" onClick={() => { onDelete(task.id); onClose(); }}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold border" style={{ borderColor: "#EF444433", color: "var(--danger)" }}>
                Deletar
              </button>
            )}
            {task && onDuplicate && (
              <button type="button" disabled={duplicating} onClick={async () => { setDuplicating(true); await onDuplicate(task); setDuplicating(false); onClose(); }}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold border disabled:opacity-50 flex items-center gap-1.5" style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}>
                {duplicating ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />}
                Duplicar
              </button>
            )}
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-semibold border" style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving || !form.title || !form.client_id}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
              style={{ backgroundColor: saving || !form.title || !form.client_id ? "var(--accent-tint)" : "var(--accent)", color: saving || !form.title || !form.client_id ? "var(--text-quaternary)" : "var(--bg-page)" }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : task ? "Salvar" : "Criar Tarefa"}
            </button>
          </div>
        </form>

        {task && (
          <div className="pt-4 mt-1" style={{ borderTop: "1px solid var(--border-strong)" }}>
            <CommentThread entityType="task" entityId={task.id} currentUserId={currentUserId} profiles={profiles} />
          </div>
        )}
      </div>
    </div>
  );
}

export function TasksView({ clientId, initialTaskId, onConsumeInitial }: { clientId?: string; initialTaskId?: string; onConsumeInitial?: () => void }) {
  const { tasks, loading, createTask, updateTask, deleteTask } = useTasks({ clientId });
  const { clients } = useClients();
  const { profile } = useAuth();
  const [view, setView] = useState<"list" | "kanban">("list");
  const [editing, setEditing] = useState<Task | null | "new">(null);
  const [dragOverStatus, setDragOverStatus] = useState<Task["status"] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    if (!initialTaskId || loading) return;
    const match = tasks.find((t) => t.id === initialTaskId);
    if (match) {
      setEditing(match);
      onConsumeInitial?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTaskId, loading]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filterStatus, setFilterStatus] = useState<Task["status"] | "todos">("todos");
  const [filterDate, setFilterDate] = useState<"todas" | "hoje" | "semana" | "mes" | "atrasadas">("todas");
  const [filterAssignee, setFilterAssignee] = useState<string>("todos");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    supabase.from("profiles").select("*").eq("is_active", true).then(({ data }) => setProfiles(data ?? []));
  }, []);

  const filtered = tasks.filter((t) => {
    if (t.parent_task_id) return false;
    if (filterStatus !== "todos" && t.status !== filterStatus) return false;
    if (filterAssignee === "eu" && t.assignee_id !== profile?.id) return false;
    if (filterAssignee !== "todos" && filterAssignee !== "eu" && t.assignee_id !== filterAssignee) return false;
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

  async function handleDuplicate(task: Task) {
    if (!profile) return;
    await createTask({
      client_id: task.client_id,
      quarter_id: task.quarter_id,
      playbook_step_id: task.playbook_step_id,
      workflow_trigger_id: task.workflow_trigger_id,
      parent_task_id: null,
      title: `${task.title} (cópia)`,
      description: task.description,
      status: "backlog",
      priority: task.priority,
      assignee_id: task.assignee_id,
      deadline: task.recurrence !== "nenhuma" && !task.deadline ? todayLocal() : task.deadline,
      estimated_hours: task.estimated_hours,
      actual_hours: null,
      sort_order: task.sort_order,
      data_source: "manual",
      external_id: null,
      last_synced_at: null,
      recurrence: task.recurrence,
      created_by: profile.id,
    });
  }

  const completedCount = tasks.filter((t) => t.status === "concluido").length;

  async function clearCompleted() {
    setClearing(true);
    const completed = tasks.filter((t) => t.status === "concluido");
    await Promise.all(completed.map((t) => deleteTask(t.id)));
    setClearing(false);
    setConfirmingClear(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "var(--accent)" }}>Gestão de Tarefas</p>
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{filtered.length} tarefa{filtered.length !== 1 ? "s" : ""}</span>
            {overdue > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                style={{ backgroundColor: "var(--danger-tint)", color: "var(--danger)", border: "1px solid #EF444433" }}>
                {overdue} atrasada{overdue !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
            {([["list", LayoutList], ["kanban", Kanban]] as const).map(([v, Icon]) => (
              <button key={v} onClick={() => setView(v)} className="p-2 transition-colors"
                style={{ backgroundColor: view === v ? "var(--accent)" : "transparent", color: view === v ? "var(--bg-page)" : "var(--text-tertiary)" }}>
                <Icon size={14} />
              </button>
            ))}
          </div>
          {completedCount > 0 && (
            <button onClick={() => setConfirmingClear(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors"
              style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#ef444444"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)"; }}>
              <Trash2 size={13} /> Limpar concluídas ({completedCount})
            </button>
          )}
          <button onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--accent-hover)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--accent)")}>
            <Plus size={13} /> Nova Tarefa
          </button>
        </div>
      </div>

      {confirmingClear && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl flex-wrap" style={{ backgroundColor: "var(--danger-tint)", border: "1px solid #EF444422" }}>
          <p className="text-xs" style={{ color: "var(--danger)" }}>
            Excluir as {completedCount} tarefas concluídas? Essa ação não pode ser desfeita.
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setConfirmingClear(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border" style={{ borderColor: "#333", color: "var(--text-secondary)" }}>
              <X size={11} />Cancelar
            </button>
            <button onClick={clearCompleted} disabled={clearing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ backgroundColor: "var(--danger)", color: "#000" }}>
              {clearing ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              Confirmar exclusão
            </button>
          </div>
        </div>
      )}

      {/* Status filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {([["todos", "Todas", "var(--accent)", "var(--accent-tint)"], ...Object.entries(STATUS_META).map(([k, v]) => [k, v.label, v.color, v.bg])] as [string, string, string, string][]).map(([s, label, color, bg]) => (
          <button key={s} onClick={() => setFilterStatus(s as Task["status"] | "todos")}
            className="text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider transition-all"
            style={filterStatus === s ? { color, backgroundColor: bg, border: `1px solid ${color}44` } : { color: "var(--text-quaternary)", backgroundColor: "transparent", border: "1px solid transparent" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Date filter chips + assignee filter */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {([
            ["todas",     "Todas as datas", "var(--text-tertiary)",    "transparent"],
            ["hoje",      "Hoje",           "#3B82F6", "#0d1630"],
            ["semana",    "Esta semana",    "#8B5CF6", "#130d1f"],
            ["mes",       "Este mês",       "var(--warning)", "#1a1200"],
            ["atrasadas", "Atrasadas",      "var(--danger)", "#1a0505"],
          ] as [typeof filterDate, string, string, string][]).map(([v, label, color, bg]) => (
            <button key={v} onClick={() => setFilterDate(v)}
              className="text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider transition-all"
              style={filterDate === v ? { color, backgroundColor: bg, border: `1px solid ${color}44` } : { color: "var(--text-quaternary)", backgroundColor: "transparent", border: "1px solid transparent" }}>
              {label}
            </button>
          ))}
        </div>
        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          className="rounded-lg px-2.5 py-1.5 text-[11px] text-[var(--text-primary)] border appearance-none cursor-pointer focus:outline-none"
          style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border-strong)" }}
        >
          <option value="todos">Todos os responsáveis</option>
          {profile && <option value="eu">Minhas tarefas</option>}
          {profiles.filter((p) => p.id !== profile?.id).map((p) => (
            <option key={p.id} value={p.id}>{p.display_name}</option>
          ))}
        </select>
      </div>

      {/* List view */}
      {view === "list" && (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[var(--text-primary)] font-semibold text-sm mb-1">Nenhuma tarefa</p>
              <p className="text-xs mb-4" style={{ color: "var(--text-quaternary)" }}>Crie a primeira tarefa para começar</p>
              <button onClick={() => setEditing("new")} className="text-xs font-semibold px-4 py-2 rounded-lg" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>
                + Nova Tarefa
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "var(--bg-surface-2)", borderBottom: "1px solid var(--border)" }}>
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
                    <tr key={task.id} className="border-b border-[var(--bg-surface-2)] hover:bg-[var(--bg-surface-2)] transition-colors cursor-pointer" onClick={() => setEditing(task)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isOverdue && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                          <span className="text-sm text-[var(--text-primary)]">{task.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {client && <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-secondary)" }}>{client.name}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--text-tertiary)" }}>{assignee?.display_name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-semibold" style={{ color: PRIORITY_META[task.priority].color }}>{PRIORITY_META[task.priority].label}</span>
                      </td>
                      <td className="px-4 py-3">
                        {task.deadline && <span className="text-xs" style={{ color: isOverdue ? "var(--danger)" : "var(--text-tertiary)" }}>{new Date(task.deadline + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
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
            const isDragOver = dragOverStatus === status;
            return (
              <div
                key={status}
                className="flex-1 min-w-[220px] max-w-[300px] rounded-xl transition-colors"
                style={{ backgroundColor: isDragOver ? "var(--accent-a22)" : "transparent", outline: isDragOver ? "2px dashed var(--accent-a44)" : "none", outlineOffset: 4 }}
                onDragOver={(e) => { e.preventDefault(); setDragOverStatus(status); }}
                onDragLeave={() => setDragOverStatus((s) => (s === status ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  const taskId = e.dataTransfer.getData("text/plain");
                  if (taskId) updateTask(taskId, { status });
                  setDragOverStatus(null);
                  setDraggingId(null);
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: meta.color }}>{meta.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-quaternary)" }}>{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((task) => {
                    const client = clients.find((c) => c.id === task.client_id);
                    const assignee = profiles.find((p) => p.id === task.assignee_id);
                    const isOverdue = task.deadline && task.status !== "concluido" && new Date(task.deadline) < today;
                    return (
                      <div key={task.id} className="rounded-xl p-3 border border-[var(--border)] cursor-grab active:cursor-grabbing transition-all"
                        style={{ backgroundColor: "var(--bg-surface)", opacity: draggingId === task.id ? 0.4 : 1 }}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData("text/plain", task.id); setDraggingId(task.id); }}
                        onDragEnd={() => { setDraggingId(null); setDragOverStatus(null); }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = `${meta.color}44`)}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)")}
                        onClick={() => setEditing(task)}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm text-[var(--text-primary)] leading-snug">{task.title}</p>
                          {isOverdue && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />}
                        </div>
                        {client && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-tertiary)" }}>{client.name}</span>}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] font-semibold" style={{ color: PRIORITY_META[task.priority].color }}>{PRIORITY_META[task.priority].label}</span>
                          {task.deadline && <span className="text-[10px]" style={{ color: isOverdue ? "var(--danger)" : "var(--text-quaternary)" }}>{new Date(task.deadline + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>}
                        </div>
                        {assignee && <p className="text-[10px] mt-1" style={{ color: "var(--text-quaternary)" }}>{assignee.display_name}</p>}
                      </div>
                    );
                  })}
                  {col.length === 0 && <div className="rounded-xl p-4 border border-dashed border-[var(--border)] text-center"><p className="text-[10px]" style={{ color: "var(--text-quaternary)" }}>{isDragOver ? "Solte aqui" : "Vazio"}</p></div>}
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
          onDuplicate={handleDuplicate}
          currentUserId={profile?.id ?? ""}
        />
      )}
    </div>
  );
}
