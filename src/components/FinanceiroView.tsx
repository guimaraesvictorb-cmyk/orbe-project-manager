import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Plus, CheckCircle2, Clock, AlertCircle, XCircle, ChevronDown, Download, Bell, Users2, Pencil, Trash2 } from "lucide-react";
import { useFinancial } from "../hooks/useFinancial";
import { usePayables, usePayees } from "../hooks/usePayables";
import { useClients } from "../hooks/useClients";
import { useAuth } from "../hooks/useAuth";
import type { FinancialRecord, PaymentStatus, Payable, Payee, PayeeType } from "../lib/database.types";
import { Footer } from "./Footer";
import { exportToCSV } from "../lib/csvExport";
import { fmtCurrency0, todayLocal, currentMonthLocal } from "../lib/formatters";

const fmt = fmtCurrency0;
const currentMonth = currentMonthLocal;

const STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pago:      { label: "Pago",     color: "var(--success)", bg: "var(--success-tint)", icon: <CheckCircle2 size={12} /> },
  pendente:  { label: "Pendente", color: "var(--warning)", bg: "var(--warning-tint)", icon: <Clock size={12} /> },
  atrasado:  { label: "Atrasado", color: "var(--danger)", bg: "var(--danger-tint)", icon: <AlertCircle size={12} /> },
  cancelado: { label: "Cancelado",color: "var(--text-tertiary)",    bg: "var(--bg-surface-2)",    icon: <XCircle size={12} /> },
};

function daysUntil(dateStr: string): number {
  const today = new Date(todayLocal() + "T00:00:00");
  const due = new Date(dateStr + "T00:00:00");
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR");
}

function StatusDropdown({ status, onUpdate }: { status: PaymentStatus; onUpdate: (status: PaymentStatus) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const cfg = STATUS_CONFIG[status];

  function openMenu() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left });
    setOpen(true);
  }

  // Same fix as the task status pill: this row lives inside a table wrapped
  // in an `overflow-hidden` rounded container, which silently clips an
  // absolutely-positioned dropdown. Portal it to <body> with fixed
  // positioning instead, so it always escapes.
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
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
        style={{ backgroundColor: cfg.bg, color: cfg.color }}
      >
        {cfg.icon}
        {cfg.label}
        <ChevronDown size={10} />
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div
            className="fixed z-50 rounded-xl border overflow-hidden shadow-xl min-w-[130px]"
            style={{ top: pos.top, left: pos.left, backgroundColor: "var(--bg-surface-2)", borderColor: "var(--border-strong)", boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}
          >
            {(Object.keys(STATUS_CONFIG) as PaymentStatus[]).map((s) => {
              const c = STATUS_CONFIG[s];
              return (
                <button
                  key={s}
                  onClick={(e) => { e.stopPropagation(); onUpdate(s); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-left hover:bg-[var(--accent-tint)]"
                  style={{ color: c.color }}
                >
                  {c.icon}
                  {c.label}
                </button>
              );
            })}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

function Tabs({ tab, setTab, alertCount }: { tab: string; setTab: (t: "recebimentos" | "pagamentos" | "alertas") => void; alertCount: number }) {
  const items: { id: "recebimentos" | "pagamentos" | "alertas"; label: string; badge?: number }[] = [
    { id: "recebimentos", label: "Contas a receber" },
    { id: "pagamentos", label: "Contas a pagar" },
    { id: "alertas", label: "Alertas", badge: alertCount },
  ];
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl border w-fit" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-surface)" }}>
      {items.map((it) => {
        const isActive = tab === it.id;
        return (
          <button
            key={it.id}
            onClick={() => setTab(it.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{
              backgroundColor: isActive ? "var(--accent-tint)" : "transparent",
              color: isActive ? "var(--accent)" : "var(--text-tertiary)",
            }}
          >
            {it.label}
            {!!it.badge && (
              <span
                className="flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 min-w-[16px] h-4"
                style={{ backgroundColor: "var(--danger)", color: "#fff" }}
              >
                {it.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function NewRecordModal({
  onClose,
  onSave,
  clients,
  userId,
  defaultMonth,
}: {
  onClose: () => void;
  onSave: (r: Omit<FinancialRecord, "id" | "created_at" | "updated_at" | "deleted_at">) => void;
  clients: { id: string; name: string; monthly_fee: number | null }[];
  userId: string;
  defaultMonth: string;
}) {
  const [form, setForm] = useState({
    client_id: "",
    type: "mensalidade" as FinancialRecord["type"],
    description: "",
    amount: "",
    due_date: `${defaultMonth}-10`,
    status: "pendente" as PaymentStatus,
  });

  function handleClientChange(id: string) {
    const c = clients.find((cl) => cl.id === id);
    setForm((p) => ({ ...p, client_id: id, amount: String(c?.monthly_fee ?? "") }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || !form.due_date) return;
    onSave({
      client_id: form.client_id || null,
      type: form.type,
      description: form.description || null,
      amount: parseFloat(form.amount),
      due_date: form.due_date,
      paid_date: null,
      status: form.status,
      payment_method: null,
      invoice_number: null,
      notes: null,
      data_source: "manual",
      external_id: null,
      last_synced_at: null,
      created_by: userId,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
      <div className="w-full max-w-md rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "var(--bg-surface-2)", borderColor: "var(--border)" }}>
        <h3 className="text-[var(--text-primary)] font-semibold text-sm">Novo lançamento</h3>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as FinancialRecord["type"] }))}
                className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <option value="mensalidade">Mensalidade</option>
                <option value="bonus">Bônus</option>
                <option value="ajuste">Ajuste</option>
                <option value="custo_fixo">Custo fixo</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as PaymentStatus }))}
                className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                {(Object.keys(STATUS_CONFIG) as PaymentStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Cliente</label>
            <select
              value={form.client_id}
              onChange={(e) => handleClientChange(e.target.value)}
              className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <option value="">— sem cliente —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Descrição</label>
            <input
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="ex: Mensalidade maio/2026"
              className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)]"
              style={{ borderColor: "var(--border-subtle)" }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Valor (R$)</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="0"
                className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)]"
                style={{ borderColor: "var(--border-subtle)" }}
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Vencimento</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                style={{ borderColor: "var(--border-subtle)" }}
                required
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-xs border" style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>
              Cancelar
            </button>
            <button type="submit" className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PayeeModal({
  onClose,
  onSave,
  editing,
}: {
  onClose: () => void;
  onSave: (p: Omit<Payee, "id" | "created_at" | "updated_at" | "deleted_at" | "created_by">) => void;
  editing: Payee | null;
}) {
  const [form, setForm] = useState({
    name: editing?.name ?? "",
    type: (editing?.type ?? "equipe") as PayeeType,
    payment_method: editing?.payment_method ?? "",
    pix_key: editing?.pix_key ?? "",
    contact_name: editing?.contact_name ?? "",
    contact_email: editing?.contact_email ?? "",
    contact_phone: editing?.contact_phone ?? "",
    invoice_wait_days: editing?.invoice_wait_days != null ? String(editing.invoice_wait_days) : "",
    payment_offset_days: editing?.payment_offset_days != null ? String(editing.payment_offset_days) : "",
    default_amount: editing?.default_amount != null ? String(editing.default_amount) : "",
    is_active: editing?.is_active ?? true,
    notes: editing?.notes ?? "",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) return;
    onSave({
      name: form.name,
      type: form.type,
      payment_method: form.payment_method || null,
      pix_key: form.pix_key || null,
      bank_details: editing?.bank_details ?? null,
      contact_name: form.contact_name || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      invoice_wait_days: form.invoice_wait_days ? parseInt(form.invoice_wait_days, 10) : null,
      payment_offset_days: form.payment_offset_days ? parseInt(form.payment_offset_days, 10) : null,
      default_amount: form.default_amount ? parseFloat(form.default_amount) : null,
      is_active: form.is_active,
      notes: form.notes || null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
      <div className="w-full max-w-md rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "var(--bg-surface-2)", borderColor: "var(--border)" }}>
        <h3 className="text-[var(--text-primary)] font-semibold text-sm">{editing ? "Editar" : "Novo"} beneficiário</h3>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Nome</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                style={{ borderColor: "var(--border-subtle)" }}
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as PayeeType }))}
                className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <option value="equipe">Equipe</option>
                <option value="fornecedor">Fornecedor</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Forma de pagamento</label>
              <input
                value={form.payment_method}
                onChange={(e) => setForm((p) => ({ ...p, payment_method: e.target.value }))}
                placeholder="PIX, boleto..."
                className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)]"
                style={{ borderColor: "var(--border-subtle)" }}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Chave PIX</label>
              <input
                value={form.pix_key}
                onChange={(e) => setForm((p) => ({ ...p, pix_key: e.target.value }))}
                className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                style={{ borderColor: "var(--border-subtle)" }}
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Contato</label>
            <input
              value={form.contact_name}
              onChange={(e) => setForm((p) => ({ ...p, contact_name: e.target.value }))}
              placeholder="Nome do responsável"
              className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)] mb-2"
              style={{ borderColor: "var(--border-subtle)" }}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                value={form.contact_email}
                onChange={(e) => setForm((p) => ({ ...p, contact_email: e.target.value }))}
                placeholder="E-mail"
                className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)]"
                style={{ borderColor: "var(--border-subtle)" }}
              />
              <input
                value={form.contact_phone}
                onChange={(e) => setForm((p) => ({ ...p, contact_phone: e.target.value }))}
                placeholder="Telefone"
                className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)]"
                style={{ borderColor: "var(--border-subtle)" }}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Valor padrão</label>
              <input
                type="number"
                value={form.default_amount}
                onChange={(e) => setForm((p) => ({ ...p, default_amount: e.target.value }))}
                className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                style={{ borderColor: "var(--border-subtle)" }}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Prazo p/ nota (dias)</label>
              <input
                type="number"
                value={form.invoice_wait_days}
                onChange={(e) => setForm((p) => ({ ...p, invoice_wait_days: e.target.value }))}
                className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                style={{ borderColor: "var(--border-subtle)" }}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Pagar em (dias após nota)</label>
              <input
                type="number"
                value={form.payment_offset_days}
                onChange={(e) => setForm((p) => ({ ...p, payment_offset_days: e.target.value }))}
                className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                style={{ borderColor: "var(--border-subtle)" }}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-xs border" style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>
              Cancelar
            </button>
            <button type="submit" className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PayeesManagerModal({
  onClose,
  payees,
  onNew,
  onEdit,
  onDeactivate,
}: {
  onClose: () => void;
  payees: Payee[];
  onNew: () => void;
  onEdit: (p: Payee) => void;
  onDeactivate: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
      <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl border p-6" style={{ backgroundColor: "var(--bg-surface-2)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[var(--text-primary)] font-semibold text-sm">Equipe e fornecedores</h3>
          <button onClick={onNew} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>
            <Plus size={13} />
            Novo
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {payees.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: "var(--text-tertiary)" }}>Nenhum cadastro ainda.</p>
          ) : payees.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border" style={{ borderColor: "var(--border-subtle)", opacity: p.is_active ? 1 : 0.5 }}>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{p.name}</p>
                <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "var(--text-quaternary)" }}>
                  {p.type === "equipe" ? "Equipe" : "Fornecedor"}
                  {p.default_amount != null && ` · ${fmt(p.default_amount)}`}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => onEdit(p)} className="p-1.5 rounded-lg" style={{ color: "var(--text-tertiary)" }}>
                  <Pencil size={13} />
                </button>
                <button onClick={() => onDeactivate(p.id)} className="p-1.5 rounded-lg" style={{ color: "var(--danger)" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 py-2 rounded-xl text-xs border" style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>
          Fechar
        </button>
      </div>
    </div>
  );
}

function NewPayableModal({
  onClose,
  onSave,
  payees,
  userId,
  defaultMonth,
}: {
  onClose: () => void;
  onSave: (p: Omit<Payable, "id" | "created_at" | "updated_at" | "deleted_at">) => void;
  payees: Payee[];
  userId: string;
  defaultMonth: string;
}) {
  const [form, setForm] = useState({
    payee_id: "",
    description: "",
    amount: "",
    due_date: `${defaultMonth}-05`,
    status: "pendente" as PaymentStatus,
  });

  function handlePayeeChange(id: string) {
    const p = payees.find((pl) => pl.id === id);
    setForm((prev) => ({ ...prev, payee_id: id, amount: p?.default_amount != null ? String(p.default_amount) : prev.amount }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || !form.due_date) return;
    onSave({
      payee_id: form.payee_id || null,
      description: form.description || null,
      amount: parseFloat(form.amount),
      due_date: form.due_date,
      invoice_received_date: null,
      paid_date: null,
      status: form.status,
      payment_method: null,
      notes: null,
      created_by: userId,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
      <div className="w-full max-w-md rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "var(--bg-surface-2)", borderColor: "var(--border)" }}>
        <h3 className="text-[var(--text-primary)] font-semibold text-sm">Novo pagamento</h3>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Beneficiário</label>
            <select
              value={form.payee_id}
              onChange={(e) => handlePayeeChange(e.target.value)}
              className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <option value="">— selecionar —</option>
              {payees.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Descrição</label>
            <input
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="ex: Pagamento setembro/2026"
              className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)]"
              style={{ borderColor: "var(--border-subtle)" }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Valor (R$)</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)]"
                style={{ borderColor: "var(--border-subtle)" }}
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Vencimento</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                style={{ borderColor: "var(--border-subtle)" }}
                required
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-xs border" style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>
              Cancelar
            </button>
            <button type="submit" className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function generateMensalidades(clients: { id: string; monthly_fee: number | null }[], month: string, userId: string) {
  return clients
    .filter((c) => c.monthly_fee && c.monthly_fee > 0)
    .map((c) => ({
      client_id: c.id,
      type: "mensalidade" as const,
      description: `Mensalidade ${month}`,
      amount: c.monthly_fee!,
      due_date: `${month}-10`,
      paid_date: null,
      status: "pendente" as PaymentStatus,
      payment_method: null,
      invoice_number: null,
      notes: null,
      data_source: "manual" as const,
      external_id: null,
      last_synced_at: null,
      created_by: userId,
    }));
}

type AlertItem = {
  kind: "receber" | "pagar";
  id: string;
  label: string;
  amount: number;
  due_date: string;
  status: PaymentStatus;
  days: number;
};

export function FinanceiroView() {
  const [tab, setTab] = useState<"recebimentos" | "pagamentos" | "alertas">("recebimentos");
  const [month, setMonth] = useState(currentMonth());
  const [showModal, setShowModal] = useState(false);
  const [showPayableModal, setShowPayableModal] = useState(false);
  const [showPayeesManager, setShowPayeesManager] = useState(false);
  const [editingPayee, setEditingPayee] = useState<Payee | null | "new">(null);

  const { records, loading, createRecord, updateRecord, totalAmount, totalPaid, totalPending, totalOverdue } = useFinancial({ month });
  const { records: payables, loading: payablesLoading, createRecord: createPayable, updateRecord: updatePayable, totalAmount: payTotal, totalPaid: payPaid, totalPending: payPending, totalOverdue: payOverdue } = usePayables({ month });
  const { records: allReceivables } = useFinancial({});
  const { records: allPayables } = usePayables({});
  const { payees, createPayee, updatePayee, deletePayee } = usePayees();
  const { clients } = useClients();
  const { profile } = useAuth();

  const payeeMap = Object.fromEntries(payees.map((p) => [p.id, p.name]));

  const alerts: AlertItem[] = useMemo(() => {
    const clientMapLocal = Object.fromEntries(clients.map((c) => [c.id, c.name]));
    const fromReceivables: AlertItem[] = allReceivables
      .filter((r) => r.status === "pendente" || r.status === "atrasado")
      .map((r) => ({
        kind: "receber" as const,
        id: r.id,
        label: (r.client_id ? clientMapLocal[r.client_id] : null) ?? r.description ?? "—",
        amount: r.amount,
        due_date: r.due_date,
        status: r.status,
        days: daysUntil(r.due_date),
      }));
    const fromPayables: AlertItem[] = allPayables
      .filter((p) => p.status === "pendente" || p.status === "atrasado")
      .map((p) => ({
        kind: "pagar" as const,
        id: p.id,
        label: (p.payee_id ? payeeMap[p.payee_id] : null) ?? p.description ?? "—",
        amount: p.amount,
        due_date: p.due_date,
        status: p.status,
        days: daysUntil(p.due_date),
      }));
    return [...fromReceivables, ...fromPayables]
      .filter((a) => a.days <= 7)
      .sort((a, b) => a.days - b.days);
  }, [allReceivables, allPayables, clients, payeeMap]);

  async function handleMarkStatus(id: string, status: PaymentStatus) {
    const updates: Partial<FinancialRecord> = { status };
    if (status === "pago") updates.paid_date = todayLocal();
    await updateRecord(id, updates);
  }

  async function handleMarkPayableStatus(id: string, status: PaymentStatus) {
    const updates: Partial<Payable> = { status };
    if (status === "pago") updates.paid_date = todayLocal();
    await updatePayable(id, updates);
  }

  async function handleSaveNew(r: Omit<FinancialRecord, "id" | "created_at" | "updated_at" | "deleted_at">) {
    await createRecord(r);
    setShowModal(false);
  }

  async function handleSaveNewPayable(p: Omit<Payable, "id" | "created_at" | "updated_at" | "deleted_at">) {
    await createPayable(p);
    setShowPayableModal(false);
  }

  async function handleSavePayee(p: Omit<Payee, "id" | "created_at" | "updated_at" | "deleted_at" | "created_by">) {
    if (editingPayee && editingPayee !== "new") {
      await updatePayee(editingPayee.id, p);
    } else if (profile?.id) {
      await createPayee({ ...p, created_by: profile.id });
    }
    setEditingPayee(null);
  }

  async function handleGenerateMensalidades() {
    if (!profile?.id) return;
    const existing = records.filter((r) => r.type === "mensalidade").map((r) => r.client_id);
    const toCreate = generateMensalidades(clients.filter((c) => c.status === "ativo"), month, profile.id).filter(
      (r) => !existing.includes(r.client_id)
    );
    for (const r of toCreate) await createRecord(r);
  }

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));

  function handleExport() {
    exportToCSV(`financeiro-${month}.csv`, records.map((r) => ({
      Cliente: (r.client_id ? clientMap[r.client_id] : null) ?? "—",
      Tipo: r.type,
      Descrição: r.description ?? "",
      Valor: r.amount,
      Vencimento: r.due_date,
      Pagamento: r.paid_date ?? "",
      Status: r.status,
      "Método": r.payment_method ?? "",
      "Nota fiscal": r.invoice_number ?? "",
    })));
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="max-w-screen-xl mx-auto w-full px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "var(--accent)" }}>
              Financeiro
            </p>
            <h2 className="text-[var(--text-primary)] font-bold text-lg leading-tight">Contas a receber, a pagar e alertas</h2>
          </div>
          <Tabs tab={tab} setTab={setTab} alertCount={alerts.length} />
        </div>

        {tab === "recebimentos" && (
          <>
            <div className="no-print flex items-center gap-2 flex-wrap justify-end">
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="bg-[var(--bg-page)] border rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                style={{ borderColor: "var(--border-subtle)" }}
              />
              <button
                onClick={handleGenerateMensalidades}
                className="px-3 py-1.5 text-xs border rounded-lg transition-colors"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-subtle)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}
              >
                Gerar mensalidades
              </button>
              <button
                onClick={handleExport}
                disabled={records.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-colors disabled:opacity-40"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-subtle)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}
              >
                <Download size={13} />
                Exportar CSV
              </button>
              <button
                onClick={() => window.print()}
                disabled={records.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-colors disabled:opacity-40"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-subtle)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}
              >
                Exportar PDF
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg"
                style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}
              >
                <Plus size={13} />
                Novo lançamento
              </button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Total faturado", value: fmt(totalAmount), color: "var(--text-secondary)" },
                { label: "Recebido", value: fmt(totalPaid), color: "var(--accent)" },
                { label: "Pendente", value: fmt(totalPending), color: "var(--warning)" },
                { label: "Atrasado", value: fmt(totalOverdue), color: "var(--danger)" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl border p-4" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
                  <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: "var(--text-tertiary)" }}>{label}</p>
                  <p className="text-xl font-bold" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Records table */}
            <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
              <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs font-semibold text-[var(--text-primary)]">Lançamentos — {month}</p>
              </div>
              {loading ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Carregando...</p>
                </div>
              ) : records.length === 0 ? (
                <div className="px-5 py-10 text-center space-y-2">
                  <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Nenhum lançamento neste mês</p>
                  <button
                    onClick={handleGenerateMensalidades}
                    className="text-xs font-semibold"
                    style={{ color: "var(--accent)" }}
                  >
                    Gerar mensalidades dos clientes ativos →
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["Cliente", "Descrição", "Tipo", "Vencimento", "Valor", "Status"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 font-bold uppercase tracking-widest" style={{ color: "var(--text-quaternary)", fontSize: "10px" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id} style={{ borderBottom: "1px solid var(--bg-surface-2)" }}>
                        <td className="px-4 py-3 text-[var(--text-primary)] font-medium">{r.client_id ? (clientMap[r.client_id] ?? "—") : "—"}</td>
                        <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{r.description ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ backgroundColor: "var(--border)", color: "var(--text-tertiary)" }}>
                            {r.type}
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                          {fmtDate(r.due_date)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{fmt(r.amount)}</td>
                        <td className="px-4 py-3">
                          <StatusDropdown status={r.status} onUpdate={(s) => handleMarkStatus(r.id, s)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </>
        )}

        {tab === "pagamentos" && (
          <>
            <div className="no-print flex items-center gap-2 flex-wrap justify-end">
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="bg-[var(--bg-page)] border rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                style={{ borderColor: "var(--border-subtle)" }}
              />
              <button
                onClick={() => setShowPayeesManager(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-colors"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
              >
                <Users2 size={13} />
                Equipe/fornecedores
              </button>
              <button
                onClick={() => setShowPayableModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg"
                style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}
              >
                <Plus size={13} />
                Novo pagamento
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Total do mês", value: fmt(payTotal), color: "var(--text-secondary)" },
                { label: "Pago", value: fmt(payPaid), color: "var(--accent)" },
                { label: "Pendente", value: fmt(payPending), color: "var(--warning)" },
                { label: "Atrasado", value: fmt(payOverdue), color: "var(--danger)" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl border p-4" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
                  <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: "var(--text-tertiary)" }}>{label}</p>
                  <p className="text-xl font-bold" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
              <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs font-semibold text-[var(--text-primary)]">Pagamentos — {month}</p>
              </div>
              {payablesLoading ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Carregando...</p>
                </div>
              ) : payables.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Nenhum pagamento neste mês</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["Beneficiário", "Descrição", "Vencimento", "Valor", "Status"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 font-bold uppercase tracking-widest" style={{ color: "var(--text-quaternary)", fontSize: "10px" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payables.map((p) => (
                      <tr key={p.id} style={{ borderBottom: "1px solid var(--bg-surface-2)" }}>
                        <td className="px-4 py-3 text-[var(--text-primary)] font-medium">{p.payee_id ? (payeeMap[p.payee_id] ?? "—") : "—"}</td>
                        <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{p.description ?? "—"}</td>
                        <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{fmtDate(p.due_date)}</td>
                        <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{fmt(p.amount)}</td>
                        <td className="px-4 py-3">
                          <StatusDropdown status={p.status} onUpdate={(s) => handleMarkPayableStatus(p.id, s)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </>
        )}

        {tab === "alertas" && (
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
            <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
              <Bell size={14} style={{ color: "var(--accent)" }} />
              <p className="text-xs font-semibold text-[var(--text-primary)]">Vencendo em até 7 dias ou já atrasado</p>
            </div>
            {alerts.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Nenhum alerta no momento 🎉</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--bg-surface-2)" }}>
                {alerts.map((a) => {
                  const overdue = a.days < 0;
                  const dueToday = a.days === 0;
                  return (
                    <div key={`${a.kind}-${a.id}`} className="flex items-center justify-between gap-3 px-5 py-3" style={{ borderColor: "var(--bg-surface-2)" }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold uppercase flex-shrink-0"
                          style={{
                            backgroundColor: a.kind === "receber" ? "var(--success-tint)" : "var(--info-tint)",
                            color: a.kind === "receber" ? "var(--success)" : "var(--accent)",
                          }}
                        >
                          {a.kind === "receber" ? "A receber" : "A pagar"}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{a.label}</p>
                          <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{fmtDate(a.due_date)} · {fmt(a.amount)}</p>
                        </div>
                      </div>
                      <span
                        className="text-[11px] font-bold px-2 py-1 rounded-lg flex-shrink-0"
                        style={{
                          color: overdue ? "var(--danger)" : dueToday ? "var(--warning)" : "var(--text-tertiary)",
                          backgroundColor: overdue ? "var(--danger-tint)" : dueToday ? "var(--warning-tint)" : "var(--bg-surface-2)",
                        }}
                      >
                        {overdue ? `${Math.abs(a.days)}d atrasado` : dueToday ? "Vence hoje" : `em ${a.days}d`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && profile && (
        <NewRecordModal
          onClose={() => setShowModal(false)}
          onSave={handleSaveNew}
          clients={clients}
          userId={profile.id}
          defaultMonth={month}
        />
      )}

      {showPayableModal && profile && (
        <NewPayableModal
          onClose={() => setShowPayableModal(false)}
          onSave={handleSaveNewPayable}
          payees={payees}
          userId={profile.id}
          defaultMonth={month}
        />
      )}

      {showPayeesManager && (
        <PayeesManagerModal
          onClose={() => setShowPayeesManager(false)}
          payees={payees}
          onNew={() => setEditingPayee("new")}
          onEdit={(p) => setEditingPayee(p)}
          onDeactivate={(id) => deletePayee(id)}
        />
      )}

      {editingPayee && (
        <PayeeModal
          onClose={() => setEditingPayee(null)}
          onSave={handleSavePayee}
          editing={editingPayee === "new" ? null : editingPayee}
        />
      )}

      <Footer />
    </div>
  );
}
