import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToolsSubscriptions, useToolClients } from "../../hooks/useTorreControle";
import { useClients } from "../../hooks/useClients";
import { useAuth } from "../../hooks/useAuth";
import type { ToolSubscription, ToolCategory, BillingCycle } from "../../lib/database.types";
import { fmtCurrency0, todayLocal } from "../../lib/formatters";

const fmt = fmtCurrency0;

const CATEGORY_LABELS: Record<ToolCategory, string> = {
  ia: "IA", design: "Design", agendamento: "Agendamento", hospedagem: "Hospedagem", produtividade: "Produtividade", outro: "Outro",
};

function monthlyEquivalent(t: ToolSubscription) {
  return t.billing_cycle === "anual" ? t.amount / 12 : t.amount;
}

function daysUntil(dateStr: string) {
  const today = new Date(todayLocal() + "T00:00:00");
  const due = new Date(dateStr + "T00:00:00");
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function ToolModal({
  onClose, onSave, editing, clients, initialClientIds,
}: {
  onClose: () => void;
  onSave: (t: Omit<ToolSubscription, "id" | "created_at" | "updated_at" | "deleted_at" | "created_by">, clientIds: string[]) => void;
  editing: ToolSubscription | null;
  clients: { id: string; name: string }[];
  initialClientIds: string[];
}) {
  const [form, setForm] = useState({
    name: editing?.name ?? "",
    category: (editing?.category ?? "produtividade") as ToolCategory,
    amount: editing?.amount != null ? String(editing.amount) : "",
    billing_cycle: (editing?.billing_cycle ?? "mensal") as BillingCycle,
    card_or_account: editing?.card_or_account ?? "",
    access_owner: editing?.access_owner ?? "",
    renewal_date: editing?.renewal_date ?? "",
    is_active: editing?.is_active ?? true,
  });
  const [clientIds, setClientIds] = useState<string[]>(initialClientIds);

  function toggleClient(id: string) {
    setClientIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.amount) return;
    onSave({
      name: form.name,
      category: form.category,
      amount: parseFloat(form.amount),
      billing_cycle: form.billing_cycle,
      card_or_account: form.card_or_account || null,
      access_owner: form.access_owner || null,
      renewal_date: form.renewal_date || null,
      is_active: form.is_active,
      notes: editing?.notes ?? null,
    }, clientIds);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "var(--bg-surface-2)", borderColor: "var(--border)" }}>
        <h3 className="text-[var(--text-primary)] font-semibold text-sm">{editing ? "Editar" : "Nova"} ferramenta</h3>
        <form onSubmit={submit} className="space-y-3">
          <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Nome" className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} required />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as ToolCategory }))} className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }}>
              {(Object.keys(CATEGORY_LABELS) as ToolCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
            <select value={form.billing_cycle} onChange={(e) => setForm((p) => ({ ...p, billing_cycle: e.target.value as BillingCycle }))} className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }}>
              <option value="mensal">Mensal</option>
              <option value="anual">Anual</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="Valor (R$)" className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} required />
            <input type="date" value={form.renewal_date} onChange={(e) => setForm((p) => ({ ...p, renewal_date: e.target.value }))} className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.card_or_account} onChange={(e) => setForm((p) => ({ ...p, card_or_account: e.target.value }))} placeholder="Cartão/conta" className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} />
            <input value={form.access_owner} onChange={(e) => setForm((p) => ({ ...p, access_owner: e.target.value }))} placeholder="Quem tem acesso" className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: "var(--text-tertiary)" }}>
              Clientes que usam ({clientIds.length || "geral, todos"})
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
          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
            Ativa
          </label>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-xs border" style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>Cancelar</button>
            <button type="submit" className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function FerramentasTab() {
  const { items: tools, createItem, updateItem, softDeleteItem } = useToolsSubscriptions();
  const { clientIdsFor, setClientIdsFor } = useToolClients();
  const { clients } = useClients();
  const { profile } = useAuth();
  const [showModal, setShowModal] = useState<null | "new" | ToolSubscription>(null);

  const activeClients = clients.filter((c) => c.status === "ativo");
  const clientMap = Object.fromEntries(activeClients.map((c) => [c.id, c.name]));
  const activeTools = tools.filter((t) => t.is_active);
  const totalMonthly = activeTools.reduce((s, t) => s + monthlyEquivalent(t), 0);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of activeTools) map[t.category] = (map[t.category] ?? 0) + monthlyEquivalent(t);
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [activeTools]);

  async function handleSave(t: Omit<ToolSubscription, "id" | "created_at" | "updated_at" | "deleted_at" | "created_by">, clientIds: string[]) {
    let toolId: string | undefined;
    if (showModal && showModal !== "new") {
      const { data } = await updateItem(showModal.id, t);
      toolId = data?.id;
    } else if (profile?.id) {
      const { data } = await createItem({ ...t, created_by: profile.id });
      toolId = data?.id;
    }
    if (toolId) await setClientIdsFor(toolId, clientIds);
    setShowModal(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="rounded-xl border px-4 py-3" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-quaternary)" }}>Custo mensal total (ativas)</p>
          <p className="text-xl font-bold" style={{ color: "var(--accent)" }}>{fmt(totalMonthly)}</p>
        </div>
        <button onClick={() => setShowModal("new")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>
          <Plus size={13} />
          Nova ferramenta
        </button>
      </div>

      {byCategory.length > 0 && (
        <div className="rounded-2xl border p-5 space-y-2" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
          <p className="text-xs font-semibold text-[var(--text-primary)] mb-2">Custo por categoria</p>
          {byCategory.map(([cat, amount]) => (
            <div key={cat} className="flex items-center gap-3">
              <span className="text-[11px] w-28 flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>{CATEGORY_LABELS[cat as ToolCategory]}</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-surface-2)" }}>
                <div className="h-full rounded-full" style={{ width: `${totalMonthly > 0 ? (amount / totalMonthly) * 100 : 0}%`, backgroundColor: "var(--accent)" }} />
              </div>
              <span className="text-[11px] font-semibold w-20 text-right" style={{ color: "var(--text-secondary)" }}>{fmt(amount)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
        {tools.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>Nenhuma ferramenta cadastrada</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Nome", "Categoria", "Valor", "Clientes", "Custo/cliente", "Renovação", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 font-bold uppercase tracking-widest" style={{ color: "var(--text-quaternary)", fontSize: "10px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tools.map((t) => {
                const soon = t.renewal_date ? daysUntil(t.renewal_date) : null;
                const ids = clientIdsFor(t.id);
                const names = ids.map((id) => clientMap[id]).filter(Boolean);
                const perClient = names.length > 0 ? monthlyEquivalent(t) / names.length : null;
                return (
                  <tr key={t.id} style={{ borderBottom: "1px solid var(--bg-surface-2)", opacity: t.is_active ? 1 : 0.5 }}>
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{t.name}</td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{CATEGORY_LABELS[t.category]}</td>
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{fmt(t.amount)}</td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                      {names.length > 0 ? names.join(", ") : <span style={{ color: "var(--text-quaternary)" }}>Geral</span>}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{perClient != null ? fmt(perClient) : "—"}</td>
                    <td className="px-4 py-3">
                      {t.renewal_date ? (
                        <span style={{ color: soon != null && soon <= 7 ? "var(--warning)" : "var(--text-secondary)" }}>
                          {new Date(t.renewal_date + "T12:00:00").toLocaleDateString("pt-BR")}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setShowModal(t)} style={{ color: "var(--text-tertiary)" }}><Pencil size={13} /></button>
                        <button onClick={() => softDeleteItem(t.id)} style={{ color: "var(--danger)" }}><Trash2 size={13} /></button>
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
        <ToolModal
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
