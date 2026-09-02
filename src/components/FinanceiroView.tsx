import { useState } from "react";
import { Plus, CheckCircle2, Clock, AlertCircle, XCircle, ChevronDown, Download } from "lucide-react";
import { useFinancial } from "../hooks/useFinancial";
import { useClients } from "../hooks/useClients";
import { useAuth } from "../hooks/useAuth";
import type { FinancialRecord, PaymentStatus } from "../lib/database.types";
import { Footer } from "./Footer";
import { exportToCSV } from "../lib/csvExport";
import { fmtCurrency0, todayLocal, currentMonthLocal } from "../lib/formatters";

const fmt = fmtCurrency0;
const currentMonth = currentMonthLocal;

const STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pago:      { label: "Pago",     color: "var(--success)", bg: "#0f2117", icon: <CheckCircle2 size={12} /> },
  pendente:  { label: "Pendente", color: "var(--warning)", bg: "#1a1200", icon: <Clock size={12} /> },
  atrasado:  { label: "Atrasado", color: "var(--danger)", bg: "#2a0a0a", icon: <AlertCircle size={12} /> },
  cancelado: { label: "Cancelado",color: "var(--text-tertiary)",    bg: "var(--bg-surface-2)",    icon: <XCircle size={12} /> },
};

function StatusDropdown({ record, onUpdate }: { record: FinancialRecord; onUpdate: (id: string, status: PaymentStatus) => void }) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CONFIG[record.status];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
        style={{ backgroundColor: cfg.bg, color: cfg.color }}
      >
        {cfg.icon}
        {cfg.label}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-20 rounded-xl border overflow-hidden shadow-xl min-w-[130px]"
          style={{ backgroundColor: "var(--bg-surface-2)", borderColor: "#222" }}
        >
          {(Object.keys(STATUS_CONFIG) as PaymentStatus[]).map((s) => {
            const c = STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => { onUpdate(record.id, s); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-left hover:bg-white/5"
                style={{ color: c.color }}
              >
                {c.icon}
                {c.label}
              </button>
            );
          })}
        </div>
      )}
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

export function FinanceiroView() {
  const [month, setMonth] = useState(currentMonth());
  const [showModal, setShowModal] = useState(false);
  const { records, loading, createRecord, updateRecord, totalAmount, totalPaid, totalPending, totalOverdue } = useFinancial({ month });
  const { clients } = useClients();
  const { profile } = useAuth();

  async function handleMarkStatus(id: string, status: PaymentStatus) {
    const updates: Partial<FinancialRecord> = { status };
    if (status === "pago") updates.paid_date = todayLocal();
    await updateRecord(id, updates);
  }

  async function handleSaveNew(r: Omit<FinancialRecord, "id" | "created_at" | "updated_at" | "deleted_at">) {
    await createRecord(r);
    setShowModal(false);
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
      <div className="max-w-screen-xl mx-auto w-full px-6 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "var(--accent)" }}>
              Financeiro
            </p>
            <h2 className="text-[var(--text-primary)] font-bold text-lg leading-tight">MRR & pagamentos</h2>
          </div>
          <div className="no-print flex items-center gap-2">
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
                      {new Date(r.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{fmt(r.amount)}</td>
                    <td className="px-4 py-3">
                      <StatusDropdown record={r} onUpdate={handleMarkStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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

      <Footer />
    </div>
  );
}
