import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useCompanyInvestments, useInvestmentClients } from "../../hooks/useTorreControle";
import { useClients } from "../../hooks/useClients";
import { useAuth } from "../../hooks/useAuth";
import type { CompanyInvestment, InvestmentCategory, InvestmentStatus } from "../../lib/database.types";
import { fmtCurrency0, todayLocal } from "../../lib/formatters";

const fmt = fmtCurrency0;

const CATEGORY_LABELS: Record<InvestmentCategory, string> = {
  site: "Site", infraestrutura: "Infraestrutura", equipamento: "Equipamento", ferramenta: "Ferramenta maior", capacitacao: "Capacitação", outro: "Outro",
};

function InvestmentModal({
  onClose, onSave, editing, clients, initialClientIds,
}: {
  onClose: () => void;
  onSave: (i: Omit<CompanyInvestment, "id" | "created_at" | "updated_at" | "deleted_at" | "created_by">, clientIds: string[]) => void;
  editing: CompanyInvestment | null;
  clients: { id: string; name: string }[];
  initialClientIds: string[];
}) {
  const [form, setForm] = useState({
    title: editing?.title ?? "",
    category: (editing?.category ?? "ferramenta") as InvestmentCategory,
    amount: editing?.amount != null ? String(editing.amount) : "",
    invested_at: editing?.invested_at ?? todayLocal(),
    motivo: editing?.motivo ?? "",
    expected_return: editing?.expected_return ?? "",
    expected_return_date: editing?.expected_return_date ?? "",
    status: (editing?.status ?? "planejado") as InvestmentStatus,
  });
  const [clientIds, setClientIds] = useState<string[]>(initialClientIds);

  function toggleClient(id: string) {
    setClientIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.amount) return;
    onSave({
      title: form.title,
      category: form.category,
      amount: parseFloat(form.amount),
      invested_at: form.invested_at,
      motivo: form.motivo || null,
      expected_return: form.expected_return || null,
      expected_return_date: form.expected_return_date || null,
      status: form.status,
    }, clientIds);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
      <div className="w-full max-w-md rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "var(--bg-surface-2)", borderColor: "var(--border)" }}>
        <h3 className="text-[var(--text-primary)] font-semibold text-sm">{editing ? "Editar" : "Novo"} investimento</h3>
        <form onSubmit={submit} className="space-y-3">
          <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Título" className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} required />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as InvestmentCategory }))} className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }}>
              {(Object.keys(CATEGORY_LABELS) as InvestmentCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as InvestmentStatus }))} className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }}>
              <option value="planejado">Planejado</option>
              <option value="realizado">Realizado</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="Valor (R$)" className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} required />
            <input type="date" value={form.invested_at} onChange={(e) => setForm((p) => ({ ...p, invested_at: e.target.value }))} className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} required />
          </div>
          <input value={form.motivo} onChange={(e) => setForm((p) => ({ ...p, motivo: e.target.value }))} placeholder="Motivo" className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.expected_return} onChange={(e) => setForm((p) => ({ ...p, expected_return: e.target.value }))} placeholder="Retorno esperado" className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} />
            <input type="date" value={form.expected_return_date} onChange={(e) => setForm((p) => ({ ...p, expected_return_date: e.target.value }))} className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: "var(--text-tertiary)" }}>
              Clientes relacionados ({clientIds.length || "geral, todos"})
            </label>
            <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto p-2 rounded-lg border" style={{ borderColor: "var(--border-subtle)" }}>
              {clients.map((c) => (
                <label key={c.id} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  <input type="checkbox" checked={clientIds.includes(c.id)} onChange={() => toggleClient(c.id)} />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-xs border" style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>Cancelar</button>
            <button type="submit" className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function InvestimentosTab() {
  const { items: investments, createItem, updateItem, softDeleteItem } = useCompanyInvestments();
  const { clientIdsFor, setClientIdsFor } = useInvestmentClients();
  const { clients } = useClients();
  const { profile } = useAuth();
  const [showModal, setShowModal] = useState<null | "new" | CompanyInvestment>(null);

  const activeClients = clients.filter((c) => c.status === "ativo");
  const clientMap = Object.fromEntries(activeClients.map((c) => [c.id, c.name]));
  const totalPlanejado = investments.filter((i) => i.status === "planejado").reduce((s, i) => s + i.amount, 0);
  const totalRealizado = investments.filter((i) => i.status === "realizado").reduce((s, i) => s + i.amount, 0);

  async function handleSave(i: Omit<CompanyInvestment, "id" | "created_at" | "updated_at" | "deleted_at" | "created_by">, clientIds: string[]) {
    let investmentId: string | undefined;
    if (showModal && showModal !== "new") {
      const { data } = await updateItem(showModal.id, i);
      investmentId = data?.id;
    } else if (profile?.id) {
      const { data } = await createItem({ ...i, created_by: profile.id });
      investmentId = data?.id;
    }
    if (investmentId) await setClientIdsFor(investmentId, clientIds);
    setShowModal(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border px-4 py-3" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-quaternary)" }}>Planejado</p>
            <p className="text-lg font-bold" style={{ color: "var(--warning)" }}>{fmt(totalPlanejado)}</p>
          </div>
          <div className="rounded-xl border px-4 py-3" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-quaternary)" }}>Realizado</p>
            <p className="text-lg font-bold" style={{ color: "var(--accent)" }}>{fmt(totalRealizado)}</p>
          </div>
        </div>
        <button onClick={() => setShowModal("new")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>
          <Plus size={13} />
          Novo investimento
        </button>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
        {investments.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>Nenhum investimento registrado</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Título", "Categoria", "Valor", "Clientes", "Data", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 font-bold uppercase tracking-widest" style={{ color: "var(--text-quaternary)", fontSize: "10px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {investments.map((i) => (
                <tr key={i.id} style={{ borderBottom: "1px solid var(--bg-surface-2)" }}>
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{i.title}</td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{CATEGORY_LABELS[i.category]}</td>
                  <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{fmt(i.amount)}</td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                    {(() => {
                      const names = clientIdsFor(i.id).map((id) => clientMap[id]).filter(Boolean);
                      return names.length > 0 ? names.join(", ") : <span style={{ color: "var(--text-quaternary)" }}>Geral</span>;
                    })()}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{new Date(i.invested_at + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ backgroundColor: i.status === "realizado" ? "var(--success-tint)" : "var(--warning-tint)", color: i.status === "realizado" ? "var(--success)" : "var(--warning)" }}>
                      {i.status === "realizado" ? "Realizado" : "Planejado"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setShowModal(i)} style={{ color: "var(--text-tertiary)" }}><Pencil size={13} /></button>
                      <button onClick={() => softDeleteItem(i.id)} style={{ color: "var(--danger)" }}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {showModal && (
        <InvestmentModal
          onClose={() => setShowModal(null)}
          onSave={handleSave}
          editing={showModal === "new" ? null : showModal}
          clients={activeClients}
          initialClientIds={showModal === "new" ? [] : clientIdsFor(showModal.id)}
        />
      )}
    </div>
  );
}
