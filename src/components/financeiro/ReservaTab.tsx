import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useCompanySettings, useProfitWithdrawals, useToolsSubscriptions, useTeamCosts } from "../../hooks/useTorreControle";
import { useAuth } from "../../hooks/useAuth";
import type { WithdrawalType } from "../../lib/database.types";
import { fmtCurrency0, todayLocal } from "../../lib/formatters";

const fmt = fmtCurrency0;

const TYPE_LABELS: Record<WithdrawalType, { label: string; color: string; bg: string }> = {
  pro_labore: { label: "Pró-labore", color: "var(--accent)", bg: "var(--accent-tint)" },
  distribuicao_lucro: { label: "Distribuição de lucro", color: "var(--success)", bg: "var(--success-tint)" },
  reserva: { label: "Reserva", color: "var(--warning)", bg: "var(--warning-tint)" },
};

const FASES = [
  { fase: "Agora — começando a separar", oQueFazer: "Abrir a conta-reserva e criar o hábito de transferir antes de gastar", pct: "3% a 5%" },
  { fase: "3 a 6 meses — ajustando", oQueFazer: "Aumentar aos poucos, revisando trimestralmente", pct: "8% a 12%" },
  { fase: "Regime de cruzeiro", oQueFazer: "Reserva formada; percentual alimenta reinvestimento e distribuição", pct: "10% a 20% do lucro líquido" },
];

const NIVEIS = [
  { nivel: "Mínimo de segurança", meses: "2 meses", cobre: "Não quebrar diante de um imprevisto imediato" },
  { nivel: "Referência geral PME", meses: "3 meses", cobre: "Primeira meta de qualquer negócio pequeno" },
  { nivel: "Recomendado p/ agência", meses: "6 a 9 meses", cobre: "Tempo médio pra fechar novos contratos" },
];

export function ReservaTab() {
  const { settings, updateSettings } = useCompanySettings();
  const { items: withdrawals, createItem, hardDeleteItem } = useProfitWithdrawals();
  const { items: tools } = useToolsSubscriptions();
  const { items: teamCosts } = useTeamCosts();
  const { profile } = useAuth();

  const [editingReserve, setEditingReserve] = useState(false);
  const [reserveForm, setReserveForm] = useState({ reserve_balance: "", reserve_pct_target: "" });
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [wForm, setWForm] = useState({ type: "pro_labore" as WithdrawalType, amount: "", withdrawal_date: todayLocal(), notes: "" });

  const fixedToolsMonthly = tools.filter((t) => t.is_active).reduce((s, t) => s + (t.billing_cycle === "anual" ? t.amount / 12 : t.amount), 0);
  const fixedTeamMonthly = teamCosts.filter((t) => t.is_active).reduce((s, t) => s + t.monthly_cost, 0);
  const custoFixoMensal = fixedToolsMonthly + fixedTeamMonthly;
  const mesesCobertura = custoFixoMensal > 0 ? (settings?.reserve_balance ?? 0) / custoFixoMensal : 0;

  function startEditReserve() {
    setReserveForm({ reserve_balance: String(settings?.reserve_balance ?? 0), reserve_pct_target: String(settings?.reserve_pct_target ?? 5) });
    setEditingReserve(true);
  }

  async function saveReserve() {
    await updateSettings({ reserve_balance: parseFloat(reserveForm.reserve_balance) || 0, reserve_pct_target: parseFloat(reserveForm.reserve_pct_target) || 0 });
    setEditingReserve(false);
  }

  async function saveWithdrawal() {
    if (!wForm.amount || !profile?.id) return;
    await createItem({ type: wForm.type, amount: parseFloat(wForm.amount), withdrawal_date: wForm.withdrawal_date, notes: wForm.notes || null, created_by: profile.id });
    setShowWithdrawalModal(false);
    setWForm({ type: "pro_labore", amount: "", withdrawal_date: todayLocal(), notes: "" });
  }

  const showRetentionWarning = wForm.type === "distribuicao_lucro" && parseFloat(wForm.amount || "0") > 50000;

  return (
    <div className="space-y-6">
      {/* Meses de cobertura */}
      <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-[var(--text-primary)]">Reserva de caixa</p>
          {!editingReserve && <button onClick={startEditReserve} className="text-[11px] font-semibold" style={{ color: "var(--accent)" }}>Editar</button>}
        </div>
        {editingReserve ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Saldo da reserva (R$)</label>
              <input type="number" value={reserveForm.reserve_balance} onChange={(e) => setReserveForm((p) => ({ ...p, reserve_balance: e.target.value }))} className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>% alvo da receita</label>
              <input type="number" value={reserveForm.reserve_pct_target} onChange={(e) => setReserveForm((p) => ({ ...p, reserve_pct_target: e.target.value }))} className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} />
            </div>
            <div className="col-span-2 flex gap-2">
              <button onClick={saveReserve} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>Salvar</button>
              <button onClick={() => setEditingReserve(false)} className="px-3 py-1.5 rounded-lg text-xs border" style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Saldo atual", value: fmt(settings?.reserve_balance ?? 0) },
              { label: "% alvo", value: `${settings?.reserve_pct_target ?? 0}%` },
              { label: "Custo fixo mensal", value: fmt(custoFixoMensal) },
              { label: "Meses de cobertura", value: mesesCobertura.toFixed(1), accent: true },
            ].map(({ label, value, accent }) => (
              <div key={label} className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-surface-2)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-quaternary)" }}>{label}</p>
                <p className="text-base font-bold" style={{ color: accent ? "var(--accent)" : "var(--text-primary)" }}>{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Referência de fases e níveis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
          <p className="text-xs font-semibold text-[var(--text-primary)] mb-3">Fases de separação</p>
          <div className="space-y-2">
            {FASES.map((f) => (
              <div key={f.fase} className="text-[11px] flex items-start justify-between gap-2">
                <div><p className="font-semibold text-[var(--text-primary)]">{f.fase}</p><p style={{ color: "var(--text-tertiary)" }}>{f.oQueFazer}</p></div>
                <span className="flex-shrink-0 font-bold" style={{ color: "var(--accent)" }}>{f.pct}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border p-5" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
          <p className="text-xs font-semibold text-[var(--text-primary)] mb-3">Níveis de reserva</p>
          <div className="space-y-2">
            {NIVEIS.map((n) => (
              <div key={n.nivel} className="text-[11px] flex items-start justify-between gap-2">
                <div><p className="font-semibold text-[var(--text-primary)]">{n.nivel}</p><p style={{ color: "var(--text-tertiary)" }}>{n.cobre}</p></div>
                <span className="flex-shrink-0 font-bold" style={{ color: "var(--accent)" }}>{n.meses}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Retiradas */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs font-semibold text-[var(--text-primary)]">Pró-labore, distribuição e reserva</p>
          <button onClick={() => setShowWithdrawalModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>
            <Plus size={13} />
            Registrar
          </button>
        </div>
        {withdrawals.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>Nenhum registro ainda</p>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--bg-surface-2)" }}>
            {withdrawals.map((w) => (
              <div key={w.id} className="flex items-center justify-between px-5 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded" style={{ backgroundColor: TYPE_LABELS[w.type].bg, color: TYPE_LABELS[w.type].color }}>
                    {TYPE_LABELS[w.type].label}
                  </span>
                  <span className="text-xs text-[var(--text-primary)]">{fmt(w.amount)}</span>
                  <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{new Date(w.withdrawal_date + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                </div>
                <button onClick={() => hardDeleteItem(w.id)} style={{ color: "var(--danger)" }}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showWithdrawalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
          <div className="w-full max-w-sm rounded-2xl border p-6 space-y-4" style={{ backgroundColor: "var(--bg-surface-2)", borderColor: "var(--border)" }}>
            <h3 className="text-[var(--text-primary)] font-semibold text-sm">Registrar retirada/transferência</h3>
            <select value={wForm.type} onChange={(e) => setWForm((p) => ({ ...p, type: e.target.value as WithdrawalType }))} className="w-full bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }}>
              {(Object.keys(TYPE_LABELS) as WithdrawalType[]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t].label}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" value={wForm.amount} onChange={(e) => setWForm((p) => ({ ...p, amount: e.target.value }))} placeholder="Valor (R$)" className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} />
              <input type="date" value={wForm.withdrawal_date} onChange={(e) => setWForm((p) => ({ ...p, withdrawal_date: e.target.value }))} className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} />
            </div>
            {showRetentionWarning && (
              <p className="text-[11px] p-2 rounded-lg" style={{ backgroundColor: "var(--warning-tint)", color: "var(--warning)" }}>
                Acima de R$ 50.000/mês, a distribuição de lucro perde a isenção e sofre retenção de 10% sobre o valor total.
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowWithdrawalModal(false)} className="flex-1 py-2 rounded-xl text-xs border" style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>Cancelar</button>
              <button onClick={saveWithdrawal} className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
