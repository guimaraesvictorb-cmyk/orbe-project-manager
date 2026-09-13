import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { useTeamCosts, useTeamAllocations, useToolsSubscriptions, useToolClients } from "../../hooks/useTorreControle";
import { useClients } from "../../hooks/useClients";
import { useAuth } from "../../hooks/useAuth";
import type { TeamCost } from "../../lib/database.types";
import { fmtCurrency0, fmtCurrency, fmtPct } from "../../lib/formatters";

const fmt = fmtCurrency0;

function TeamCostModal({ onClose, onSave, editing }: { onClose: () => void; onSave: (t: Omit<TeamCost, "id" | "created_at" | "updated_at" | "deleted_at" | "created_by" | "profile_id">) => void; editing: TeamCost | null }) {
  const [form, setForm] = useState({
    person_name: editing?.person_name ?? "",
    frente: editing?.frente ?? "",
    monthly_cost: editing?.monthly_cost != null ? String(editing.monthly_cost) : "",
    hours_available_month: editing?.hours_available_month != null ? String(editing.hours_available_month) : "160",
    is_active: editing?.is_active ?? true,
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.person_name || !form.monthly_cost) return;
    onSave({
      person_name: form.person_name,
      frente: form.frente || null,
      monthly_cost: parseFloat(form.monthly_cost),
      hours_available_month: parseFloat(form.hours_available_month) || 160,
      is_active: form.is_active,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
      <div className="w-full max-w-sm rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "var(--bg-surface-2)", borderColor: "var(--border)" }}>
        <h3 className="text-[var(--text-primary)] font-semibold text-sm">{editing ? "Editar" : "Nova"} pessoa</h3>
        <form onSubmit={submit} className="space-y-3">
          <input value={form.person_name} onChange={(e) => setForm((p) => ({ ...p, person_name: e.target.value }))} placeholder="Nome" className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} required />
          <input value={form.frente} onChange={(e) => setForm((p) => ({ ...p, frente: e.target.value }))} placeholder="Frente (ex: Tráfego, Design, Atendimento)" className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={form.monthly_cost} onChange={(e) => setForm((p) => ({ ...p, monthly_cost: e.target.value }))} placeholder="Custo mensal (R$)" className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} required />
            <input type="number" value={form.hours_available_month} onChange={(e) => setForm((p) => ({ ...p, hours_available_month: e.target.value }))} placeholder="Horas/mês" className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} />
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

export function RentabilidadeTab() {
  const { items: teamCosts, createItem: createTeamCost, updateItem: updateTeamCost, softDeleteItem: deleteTeamCost } = useTeamCosts();
  const { allocations, createAllocation, deleteAllocation } = useTeamAllocations();
  const { items: tools } = useToolsSubscriptions();
  const { clientIdsFor: toolClientIdsFor } = useToolClients();
  const { clients } = useClients();
  const { profile } = useAuth();
  const [showModal, setShowModal] = useState<null | "new" | TeamCost>(null);
  const [allocatingFor, setAllocatingFor] = useState<TeamCost | null>(null);
  const [newAllocClient, setNewAllocClient] = useState("");
  const [newAllocPct, setNewAllocPct] = useState("100");

  const activeClients = clients.filter((c) => c.status === "ativo");
  const activeClientIds = new Set(activeClients.map((c) => c.id));
  const activeTools = tools.filter((t) => t.is_active);

  // Custo fixo por cliente: ferramentas atreladas a um ou mais clientes são
  // rateadas só entre eles (quanto mais clientes usam, mais barato fica para
  // cada um); ferramentas sem cliente marcado ("gerais") são rateadas entre
  // todos os clientes ativos.
  const toolCostByClient = useMemo(() => {
    const byClient: Record<string, number> = {};
    for (const c of activeClients) byClient[c.id] = 0;
    let generalMonthly = 0;
    for (const t of activeTools) {
      const monthly = t.billing_cycle === "anual" ? t.amount / 12 : t.amount;
      const assigned = toolClientIdsFor(t.id).filter((id) => activeClientIds.has(id));
      if (assigned.length === 0) {
        generalMonthly += monthly;
      } else {
        const share = monthly / assigned.length;
        for (const id of assigned) byClient[id] = (byClient[id] ?? 0) + share;
      }
    }
    const generalPerClient = activeClients.length > 0 ? generalMonthly / activeClients.length : 0;
    for (const c of activeClients) byClient[c.id] = (byClient[c.id] ?? 0) + generalPerClient;
    return byClient;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClients, activeTools, toolClientIdsFor]);

  async function handleSaveTeamCost(t: Omit<TeamCost, "id" | "created_at" | "updated_at" | "deleted_at" | "created_by" | "profile_id">) {
    if (showModal && showModal !== "new") {
      await updateTeamCost(showModal.id, t);
    } else if (profile?.id) {
      await createTeamCost({ ...t, created_by: profile.id, profile_id: null });
    }
    setShowModal(null);
  }

  async function handleAddAllocation() {
    if (!allocatingFor || !newAllocClient || !newAllocPct) return;
    await createAllocation({ team_cost_id: allocatingFor.id, client_id: newAllocClient, alloc_pct: parseFloat(newAllocPct) });
    setNewAllocClient("");
    setNewAllocPct("100");
  }

  const clientMargins = useMemo(() => {
    return activeClients.map((c) => {
      const custoEquipe = allocations
        .filter((a) => a.client_id === c.id)
        .reduce((s, a) => {
          const tc = teamCosts.find((t) => t.id === a.team_cost_id);
          return s + (tc ? (tc.monthly_cost * a.alloc_pct) / 100 : 0);
        }, 0);
      const custoFixo = toolCostByClient[c.id] ?? 0;
      const receita = c.monthly_fee ?? 0;
      const custoTotal = custoEquipe + custoFixo;
      const margem = receita - custoTotal;
      return { client: c, receita, custoEquipe, custoFixo, margem, margemPct: receita > 0 ? (margem / receita) * 100 : 0 };
    }).sort((a, b) => b.margem - a.margem);
  }, [activeClients, allocations, teamCosts, toolCostByClient]);

  return (
    <div className="space-y-6">
      {/* Custo por pessoa */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs font-semibold text-[var(--text-primary)]">Custo por pessoa</p>
          <button onClick={() => setShowModal("new")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>
            <Plus size={13} />
            Nova pessoa
          </button>
        </div>
        {teamCosts.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>Nenhuma pessoa cadastrada ainda</p>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--bg-surface-2)" }}>
            {teamCosts.map((t) => {
              const custoHora = t.hours_available_month > 0 ? t.monthly_cost / t.hours_available_month : 0;
              const allocsForPerson = allocations.filter((a) => a.team_cost_id === t.id);
              const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));
              return (
                <div key={t.id} className="px-5 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">{t.person_name}</p>
                        {t.frente && (
                          <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--accent-tint)", color: "var(--accent)" }}>
                            {t.frente}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                        {fmt(t.monthly_cost)}/mês · {fmtCurrency(custoHora)}/hora ({t.hours_available_month}h)
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setAllocatingFor(t)} className="text-[11px] font-semibold" style={{ color: "var(--accent)" }}>Alocar</button>
                      <button onClick={() => setShowModal(t)} style={{ color: "var(--text-tertiary)" }}><Pencil size={13} /></button>
                      <button onClick={() => deleteTeamCost(t.id)} style={{ color: "var(--danger)" }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                  {allocsForPerson.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {allocsForPerson.map((a) => (
                        <span key={a.id} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "var(--accent-tint)", color: "var(--accent)" }}>
                          {a.client_id ? (clientMap[a.client_id] ?? "—") : "—"} · {a.alloc_pct}%
                          <button onClick={() => deleteAllocation(a.id)}><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rentabilidade por cliente */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs font-semibold text-[var(--text-primary)]">Rentabilidade por cliente</p>
        </div>
        {clientMargins.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>Nenhum cliente ativo</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Cliente", "Receita", "Custo equipe", "Custo fixo", "Margem", "Margem %"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 font-bold uppercase tracking-widest" style={{ color: "var(--text-quaternary)", fontSize: "10px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientMargins.map(({ client, receita, custoEquipe, custoFixo, margem, margemPct }) => (
                <tr key={client.id} style={{ borderBottom: "1px solid var(--bg-surface-2)" }}>
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{client.name}</td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{fmt(receita)}</td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{fmt(custoEquipe)}</td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{fmt(custoFixo)}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: margem >= 0 ? "var(--success)" : "var(--danger)" }}>{fmt(margem)}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: margem >= 0 ? "var(--success)" : "var(--danger)" }}>{fmtPct(margemPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        <p className="px-5 py-2.5 text-[10px] border-t" style={{ color: "var(--text-quaternary)", borderColor: "var(--border)" }}>
          Custo equipe = soma dos custos de pessoas alocadas × % de alocação. Custo fixo = ferramentas marcadas para este cliente (rateada entre quem usa) + parte das ferramentas gerais (sem cliente marcado, rateada entre todos). Não inclui taxa de utilização por falta de apontamento de horas na plataforma.
        </p>
      </div>

      {showModal && (
        <TeamCostModal onClose={() => setShowModal(null)} onSave={handleSaveTeamCost} editing={showModal === "new" ? null : showModal} />
      )}

      {allocatingFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
          <div className="w-full max-w-sm rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "var(--bg-surface-2)", borderColor: "var(--border)" }}>
            <h3 className="text-[var(--text-primary)] font-semibold text-sm">Alocar {allocatingFor.person_name}</h3>
            <div className="grid grid-cols-2 gap-3">
              <select value={newAllocClient} onChange={(e) => setNewAllocClient(e.target.value)} className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }}>
                <option value="">— cliente —</option>
                {activeClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="number" value={newAllocPct} onChange={(e) => setNewAllocPct(e.target.value)} placeholder="% do tempo" className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAllocatingFor(null)} className="flex-1 py-2 rounded-xl text-xs border" style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>Fechar</button>
              <button onClick={handleAddAllocation} className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>Adicionar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
