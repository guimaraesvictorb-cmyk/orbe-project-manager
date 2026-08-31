import { useState } from "react";
import { Plus, CheckCircle2, Clock, AlertCircle, XCircle, ChevronDown } from "lucide-react";
import { useFinancial } from "../hooks/useFinancial";
import { useClients } from "../hooks/useClients";
import { useAuth } from "../hooks/useAuth";
import type { FinancialRecord, PaymentStatus } from "../lib/database.types";
import { Footer } from "./Footer";

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

const STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pago:      { label: "Pago",     color: "#22C55E", bg: "#0f2117", icon: <CheckCircle2 size={12} /> },
  pendente:  { label: "Pendente", color: "#F59E0B", bg: "#1a1200", icon: <Clock size={12} /> },
  atrasado:  { label: "Atrasado", color: "#EF4444", bg: "#2a0a0a", icon: <AlertCircle size={12} /> },
  cancelado: { label: "Cancelado",color: "#555",    bg: "#111",    icon: <XCircle size={12} /> },
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
          style={{ backgroundColor: "#111", borderColor: "#222" }}
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
      <div className="w-full max-w-md rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "#0d0d0d", borderColor: "#1a1a1a" }}>
        <h3 className="text-white font-semibold text-sm">Novo lançamento</h3>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "#555" }}>Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as FinancialRecord["type"] }))}
                className="w-full bg-black border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#7B61FF]"
                style={{ borderColor: "#262626" }}
              >
                <option value="mensalidade">Mensalidade</option>
                <option value="bonus">Bônus</option>
                <option value="ajuste">Ajuste</option>
                <option value="custo_fixo">Custo fixo</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "#555" }}>Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as PaymentStatus }))}
                className="w-full bg-black border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#7B61FF]"
                style={{ borderColor: "#262626" }}
              >
                {(Object.keys(STATUS_CONFIG) as PaymentStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "#555" }}>Cliente</label>
            <select
              value={form.client_id}
              onChange={(e) => handleClientChange(e.target.value)}
              className="w-full bg-black border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#7B61FF]"
              style={{ borderColor: "#262626" }}
            >
              <option value="">— sem cliente —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "#555" }}>Descrição</label>
            <input
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="ex: Mensalidade maio/2026"
              className="w-full bg-black border rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#333] focus:outline-none focus:border-[#7B61FF]"
              style={{ borderColor: "#262626" }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "#555" }}>Valor (R$)</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="0"
                className="w-full bg-black border rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#333] focus:outline-none focus:border-[#7B61FF]"
                style={{ borderColor: "#262626" }}
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "#555" }}>Vencimento</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                className="w-full bg-black border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#7B61FF]"
                style={{ borderColor: "#262626" }}
                required
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-xs border" style={{ borderColor: "#262626", color: "#A3A3A3" }}>
              Cancelar
            </button>
            <button type="submit" className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ backgroundColor: "#7B61FF", color: "#000" }}>
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
    if (status === "pago") updates.paid_date = new Date().toISOString().split("T")[0];
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

  return (
    <div className="flex flex-col min-h-0">
      <div className="max-w-screen-xl mx-auto w-full px-6 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "#7B61FF" }}>
              Financeiro
            </p>
            <h2 className="text-white font-bold text-lg leading-tight">MRR & pagamentos</h2>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-black border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#7B61FF]"
              style={{ borderColor: "#262626" }}
            />
            <button
              onClick={handleGenerateMensalidades}
              className="px-3 py-1.5 text-xs border rounded-lg transition-colors"
              style={{ borderColor: "#262626", color: "#A3A3A3" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#7B61FF"; (e.currentTarget as HTMLButtonElement).style.color = "#7B61FF"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#262626"; (e.currentTarget as HTMLButtonElement).style.color = "#A3A3A3"; }}
            >
              Gerar mensalidades
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg"
              style={{ backgroundColor: "#7B61FF", color: "#000" }}
            >
              <Plus size={13} />
              Novo lançamento
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total faturado", value: fmt(totalAmount), color: "#A3A3A3" },
            { label: "Recebido", value: fmt(totalPaid), color: "#7B61FF" },
            { label: "Pendente", value: fmt(totalPending), color: "#F59E0B" },
            { label: "Atrasado", value: fmt(totalOverdue), color: "#EF4444" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border p-4" style={{ backgroundColor: "#0a0a0a", borderColor: "#1a1a1a" }}>
              <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: "#555" }}>{label}</p>
              <p className="text-xl font-bold" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Records table */}
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "#0a0a0a", borderColor: "#1a1a1a" }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: "#1a1a1a" }}>
            <p className="text-xs font-semibold text-white">Lançamentos — {month}</p>
          </div>
          {loading ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm" style={{ color: "#555" }}>Carregando...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="px-5 py-10 text-center space-y-2">
              <p className="text-sm" style={{ color: "#555" }}>Nenhum lançamento neste mês</p>
              <button
                onClick={handleGenerateMensalidades}
                className="text-xs font-semibold"
                style={{ color: "#7B61FF" }}
              >
                Gerar mensalidades dos clientes ativos →
              </button>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                  {["Cliente", "Descrição", "Tipo", "Vencimento", "Valor", "Status"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-bold uppercase tracking-widest" style={{ color: "#444", fontSize: "10px" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #111" }}>
                    <td className="px-4 py-3 text-white font-medium">{r.client_id ? (clientMap[r.client_id] ?? "—") : "—"}</td>
                    <td className="px-4 py-3" style={{ color: "#A3A3A3" }}>{r.description ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ backgroundColor: "#1a1a1a", color: "#666" }}>
                        {r.type}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: "#A3A3A3" }}>
                      {new Date(r.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">{fmt(r.amount)}</td>
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
