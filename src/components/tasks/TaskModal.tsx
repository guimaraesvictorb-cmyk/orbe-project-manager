import { useState, useEffect, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Task, TaskStatus, TaskPriority, OrbePhaseId, TaskType } from "../../data/tasks";
import { TASK_TYPES, ORBE_CLIENTS, PHASE_SHORT } from "../../data/tasks";

interface TaskModalProps {
  task: Task | null; // null = create mode
  onSave: (data: Omit<Task, "id" | "createdAt" | "updatedAt">) => void;
  onClose: () => void;
}

const EMPTY: Omit<Task, "id" | "createdAt" | "updatedAt"> = {
  title: "",
  client: ORBE_CLIENTS[0],
  responsible: "Victor Guimarães",
  phaseId: 6,
  type: "Otimização de Campanha",
  priority: "media",
  status: "ativa",
  dueDate: new Date().toISOString().split("T")[0],
  estimatedHours: 2,
  notes: "",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#A3A3A3] mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg px-3 py-2 text-sm text-white bg-[#0d0d0d] border border-[#333] focus:outline-none focus:border-[#1FCE4A] transition-colors duration-150";

const selectCls = inputCls + " appearance-none cursor-pointer";

export function TaskModal({ task, onSave, onClose }: TaskModalProps) {
  const [form, setForm] = useState<Omit<Task, "id" | "createdAt" | "updatedAt">>(
    task ? { ...task } : { ...EMPTY }
  );
  const [error, setError] = useState("");

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("O título é obrigatório.");
      return;
    }
    if (!form.client.trim()) {
      setError("Selecione um cliente.");
      return;
    }
    if (form.estimatedHours <= 0) {
      setError("Horas estimadas deve ser maior que 0.");
      return;
    }
    onSave(form);
  }

  const isEdit = !!task;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Editar tarefa" : "Nova tarefa"}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ backgroundColor: "#131313", border: "1px solid #262626" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderBottomColor: "#262626" }}
        >
          <div>
            <p className="text-[10px] font-semibold tracking-widest uppercase text-[#1FCE4A] mb-0.5">
              {isEdit ? "Editar Tarefa" : "Nova Tarefa"}
            </p>
            <h2 className="text-white font-bold text-base leading-tight">
              {isEdit ? form.title || "Sem título" : "Criar nova tarefa"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#A3A3A3] hover:text-white hover:bg-[#262626] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1FCE4A]"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-4"
        >
          {/* Title */}
          <Field label="Título *">
            <input
              type="text"
              className={inputCls}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Ex: [OTM] Otimização Meta Ads — Junho"
              autoFocus
            />
          </Field>

          {/* Row: Cliente + Responsável */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Cliente *">
              <select
                className={selectCls}
                value={form.client}
                onChange={(e) => set("client", e.target.value)}
              >
                {ORBE_CLIENTS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="Outro">Outro</option>
              </select>
            </Field>
            <Field label="Responsável">
              <input
                type="text"
                className={inputCls}
                value={form.responsible}
                onChange={(e) => set("responsible", e.target.value)}
                placeholder="Nome do responsável"
              />
            </Field>
          </div>

          {/* Row: Fase Orbe + Tipo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Fase Orbe">
              <select
                className={selectCls}
                value={form.phaseId}
                onChange={(e) => set("phaseId", Number(e.target.value) as OrbePhaseId)}
              >
                {(Object.entries(PHASE_SHORT) as [string, string][]).map(([id, name]) => (
                  <option key={id} value={id}>F{id} — {name}</option>
                ))}
              </select>
            </Field>
            <Field label="Tipo">
              <select
                className={selectCls}
                value={form.type}
                onChange={(e) => set("type", e.target.value as TaskType)}
              >
                {TASK_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Row: Prioridade + Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Prioridade">
              <select
                className={selectCls}
                value={form.priority}
                onChange={(e) => set("priority", e.target.value as TaskPriority)}
              >
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </Field>
            <Field label="Status">
              <select
                className={selectCls}
                value={form.status}
                onChange={(e) => set("status", e.target.value as TaskStatus)}
              >
                <option value="ativa">Ativa</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluida">Concluída</option>
                <option value="pausada">Pausada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </Field>
          </div>

          {/* Row: Data de Entrega + Horas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Data de Entrega">
              <input
                type="date"
                className={inputCls}
                value={form.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
              />
            </Field>
            <Field label="Horas Estimadas">
              <input
                type="number"
                min={0.5}
                step={0.5}
                className={inputCls}
                value={form.estimatedHours}
                onChange={(e) => set("estimatedHours", parseFloat(e.target.value) || 1)}
              />
            </Field>
          </div>

          {/* Notes */}
          <Field label="Observações">
            <textarea
              className={inputCls + " resize-none"}
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Contexto, links, decisões importantes..."
            />
          </Field>

          {/* Error */}
          {error && (
            <p className="text-red-400 text-xs">{error}</p>
          )}
        </form>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0"
          style={{ borderTopColor: "#262626" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[#A3A3A3] hover:text-white transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1FCE4A]"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler<HTMLButtonElement>}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1FCE4A]"
            style={{ backgroundColor: "#1FCE4A", color: "#000000" }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#17b83e")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1FCE4A")
            }
          >
            {isEdit ? "Salvar alterações" : "Criar tarefa"}
          </button>
        </div>
      </div>
    </div>
  );
}
