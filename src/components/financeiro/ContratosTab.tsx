import { useState } from "react";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { useContracts } from "../../hooks/useTorreControle";
import { useClients } from "../../hooks/useClients";
import { usePayees } from "../../hooks/usePayables";
import { useAuth } from "../../hooks/useAuth";
import type { Contract, ContractPartyType, ContractStatus } from "../../lib/database.types";
import { fmtCurrency0, todayLocal } from "../../lib/formatters";

const fmt = fmtCurrency0;

const STATUS_LABELS: Record<ContractStatus, { label: string; color: string; bg: string }> = {
  vigente: { label: "Vigente", color: "var(--success)", bg: "var(--success-tint)" },
  em_renovacao: { label: "Em renovação", color: "var(--warning)", bg: "var(--warning-tint)" },
  encerrado: { label: "Encerrado", color: "var(--text-tertiary)", bg: "var(--bg-surface-2)" },
};

function daysUntil(dateStr: string) {
  const today = new Date(todayLocal() + "T00:00:00");
  const due = new Date(dateStr + "T00:00:00");
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function ContractModal({
  onClose, onSave, editing, clients, payees,
}: {
  onClose: () => void;
  onSave: (c: Omit<Contract, "id" | "created_at" | "updated_at" | "deleted_at" | "created_by">) => void;
  editing: Contract | null;
  clients: { id: string; name: string }[];
  payees: { id: string; name: string }[];
}) {
  const [form, setForm] = useState({
    party_type: (editing?.party_type ?? "cliente") as ContractPartyType,
    client_id: editing?.client_id ?? "",
    payee_id: editing?.payee_id ?? "",
    document_url: editing?.document_url ?? "",
    value: editing?.value != null ? String(editing.value) : "",
    start_date: editing?.start_date ?? "",
    end_date: editing?.end_date ?? "",
    readjustment_index: editing?.readjustment_index ?? "",
    status: (editing?.status ?? "vigente") as ContractStatus,
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      party_type: form.party_type,
      client_id: form.party_type === "cliente" ? (form.client_id || null) : null,
      payee_id: form.party_type === "fornecedor" ? (form.payee_id || null) : null,
      document_url: form.document_url || null,
      value: form.value ? parseFloat(form.value) : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      readjustment_index: form.readjustment_index || null,
      next_readjustment_date: editing?.next_readjustment_date ?? null,
      alert_days_before: editing?.alert_days_before ?? [60, 30],
      status: form.status,
      notes: editing?.notes ?? null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
      <div className="w-full max-w-md rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "var(--bg-surface-2)", borderColor: "var(--border)" }}>
        <h3 className="text-[var(--text-primary)] font-semibold text-sm">{editing ? "Editar" : "Novo"} contrato</h3>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={form.party_type} onChange={(e) => setForm((p) => ({ ...p, party_type: e.target.value as ContractPartyType }))} className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }}>
              <option value="cliente">Cliente</option>
              <option value="fornecedor">Fornecedor</option>
            </select>
            {form.party_type === "cliente" ? (
              <select value={form.client_id} onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))} className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }}>
                <option value="">— cliente —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : (
              <select value={form.payee_id} onChange={(e) => setForm((p) => ({ ...p, payee_id: e.target.value }))} className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }}>
                <option value="">— fornecedor —</option>
                {payees.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
          <input value={form.document_url} onChange={(e) => setForm((p) => ({ ...p, document_url: e.target.value }))} placeholder="Link do contrato (Drive, etc)" className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} placeholder="Valor (R$)" className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} />
            <input value={form.readjustment_index} onChange={(e) => setForm((p) => ({ ...p, readjustment_index: e.target.value }))} placeholder="Índice de reajuste" className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Início</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Vigência até</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} />
            </div>
          </div>
          <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as ContractStatus }))} className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }}>
            {(Object.keys(STATUS_LABELS) as ContractStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s].label}</option>)}
          </select>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-xs border" style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>Cancelar</button>
            <button type="submit" className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ContratosTab() {
  const { items: contracts, createItem, updateItem, softDeleteItem } = useContracts();
  const { clients } = useClients();
  const { payees } = usePayees();
  const { profile } = useAuth();
  const [showModal, setShowModal] = useState<null | "new" | Contract>(null);

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  const payeeMap = Object.fromEntries(payees.map((p) => [p.id, p.name]));

  async function handleSave(c: Omit<Contract, "id" | "created_at" | "updated_at" | "deleted_at" | "created_by">) {
    if (showModal && showModal !== "new") {
      await updateItem(showModal.id, c);
    } else if (profile?.id) {
      await createItem({ ...c, created_by: profile.id });
    }
    setShowModal(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={() => setShowModal("new")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>
          <Plus size={13} />
          Novo contrato
        </button>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
        {contracts.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>Nenhum contrato cadastrado</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Parte", "Valor", "Vigência", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 font-bold uppercase tracking-widest" style={{ color: "var(--text-quaternary)", fontSize: "10px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const name = c.party_type === "cliente" ? (c.client_id ? clientMap[c.client_id] : null) : (c.payee_id ? payeeMap[c.payee_id] : null);
                const soon = c.end_date ? daysUntil(c.end_date) : null;
                const alerting = soon != null && soon <= Math.max(...(c.alert_days_before.length ? c.alert_days_before : [60]));
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid var(--bg-surface-2)" }}>
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                      <div className="flex items-center gap-1.5">
                        {name ?? "—"}
                        {c.document_url && (
                          <a href={c.document_url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}><ExternalLink size={11} /></a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{c.value != null ? fmt(c.value) : "—"}</td>
                    <td className="px-4 py-3">
                      {c.end_date ? (
                        <span style={{ color: alerting ? "var(--warning)" : "var(--text-secondary)" }}>
                          até {new Date(c.end_date + "T12:00:00").toLocaleDateString("pt-BR")}
                          {alerting && soon != null && ` (${soon}d)`}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ backgroundColor: STATUS_LABELS[c.status].bg, color: STATUS_LABELS[c.status].color }}>
                        {STATUS_LABELS[c.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setShowModal(c)} style={{ color: "var(--text-tertiary)" }}><Pencil size={13} /></button>
                        <button onClick={() => softDeleteItem(c.id)} style={{ color: "var(--danger)" }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {showModal && (
        <ContractModal onClose={() => setShowModal(null)} onSave={handleSave} editing={showModal === "new" ? null : showModal} clients={clients} payees={payees} />
      )}
    </div>
  );
}
