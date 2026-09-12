import { useMemo, useState } from "react";
import { useFinancial } from "../../hooks/useFinancial";
import { usePayables } from "../../hooks/usePayables";
import { useToolsSubscriptions, useTeamCosts, useCompanySettings } from "../../hooks/useTorreControle";
import { useClients } from "../../hooks/useClients";
import { fmtCurrency0, fmtPct, currentMonthLocal } from "../../lib/formatters";
import { calcAliquotaEfetiva, trailing12Window } from "../../lib/fiscal";

const fmt = fmtCurrency0;

function nextMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

export function VisaoGeralTab() {
  const { records: allReceivables } = useFinancial({});
  const { records: allPayables } = usePayables({});
  const { items: tools } = useToolsSubscriptions();
  const { items: teamCosts } = useTeamCosts();
  const { settings, updateSettings } = useCompanySettings();
  const { clients } = useClients();

  const [editingCash, setEditingCash] = useState(false);
  const [cashForm, setCashForm] = useState("");

  const month = currentMonthLocal();
  const activeClients = clients.filter((c) => c.status === "ativo");

  const fixedToolsMonthly = tools.filter((t) => t.is_active).reduce((s, t) => s + (t.billing_cycle === "anual" ? t.amount / 12 : t.amount), 0);
  const fixedTeamMonthly = teamCosts.filter((t) => t.is_active).reduce((s, t) => s + t.monthly_cost, 0);

  const { receitaMes, rbt12 } = useMemo(() => {
    const [start, end] = trailing12Window();
    const rbt12 = allReceivables.filter((r) => r.status === "pago" && r.paid_date && r.client_id && r.paid_date >= start && r.paid_date <= end).reduce((s, r) => s + r.amount, 0);
    const receitaMes = allReceivables.filter((r) => r.status === "pago" && r.client_id && r.due_date.startsWith(month)).reduce((s, r) => s + r.amount, 0);
    return { receitaMes, rbt12 };
  }, [allReceivables, month]);

  const { efetiva } = calcAliquotaEfetiva(rbt12);
  const impostos = receitaMes * efetiva;
  const lucro = receitaMes - fixedTeamMonthly - fixedToolsMonthly - impostos;
  const margemOperacional = receitaMes > 0 ? (lucro / receitaMes) * 100 : 0;
  const ticketMedio = activeClients.length > 0 ? receitaMes / activeClients.length : 0;
  const custoMedioColaborador = teamCosts.length > 0 ? fixedTeamMonthly / teamCosts.length : 0;
  const pctImpostos = receitaMes > 0 ? (impostos / receitaMes) * 100 : 0;

  const fluxo = useMemo(() => {
    return nextMonths(3).map((m) => {
      const entradas = allReceivables.filter((r) => (r.status === "pendente" || r.status === "atrasado") && r.due_date.startsWith(m)).reduce((s, r) => s + r.amount, 0);
      const saidas = allPayables.filter((p) => (p.status === "pendente" || p.status === "atrasado") && p.due_date.startsWith(m)).reduce((s, p) => s + p.amount, 0);
      return { month: m, entradas, saidas, saldo: entradas - saidas };
    });
  }, [allReceivables, allPayables]);

  const custoFixoMensal = fixedTeamMonthly + fixedToolsMonthly;
  const reservaMin = custoFixoMensal * 3;
  const reservaIdeal = custoFixoMensal * 6;
  const cashOk = (settings?.cash_balance ?? 0) >= reservaMin;

  function startEditCash() {
    setCashForm(String(settings?.cash_balance ?? 0));
    setEditingCash(true);
  }

  async function saveCash() {
    await updateSettings({ cash_balance: parseFloat(cashForm) || 0 });
    setEditingCash(false);
  }

  return (
    <div className="space-y-6">
      {/* DRE simplificado */}
      <div className="rounded-2xl border p-5 space-y-3" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <p className="text-xs font-semibold text-[var(--text-primary)]">DRE gerencial simplificado — {month}</p>
        <div className="space-y-1.5 text-xs">
          {[
            { label: "Receita (recebido de clientes)", value: receitaMes, sign: "" },
            { label: "− Custos diretos (equipe)", value: fixedTeamMonthly, sign: "-" },
            { label: "− Custos fixos (ferramentas)", value: fixedToolsMonthly, sign: "-" },
            { label: "− Impostos estimados", value: impostos, sign: "-" },
          ].map((row) => (
            <div key={row.label} className="flex justify-between py-1.5" style={{ borderBottom: "1px solid var(--bg-surface-2)" }}>
              <span style={{ color: "var(--text-secondary)" }}>{row.label}</span>
              <span className="font-semibold text-[var(--text-primary)]">{row.sign}{fmt(row.value)}</span>
            </div>
          ))}
          <div className="flex justify-between py-1.5 pt-2">
            <span className="font-bold text-[var(--text-primary)]">= Lucro do mês</span>
            <span className="font-bold" style={{ color: lucro >= 0 ? "var(--success)" : "var(--danger)" }}>{fmt(lucro)}</span>
          </div>
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Margem operacional", value: fmtPct(margemOperacional) },
          { label: "Ticket médio/cliente", value: fmt(ticketMedio) },
          { label: "Custo médio/colaborador", value: fmt(custoMedioColaborador) },
          { label: "% faturamento em impostos", value: fmtPct(pctImpostos) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border p-4" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: "var(--text-tertiary)" }}>{label}</p>
            <p className="text-lg font-bold text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </div>

      {/* Saldo de caixa vs reserva */}
      <div className="rounded-2xl border p-5 space-y-3" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-[var(--text-primary)]">Saldo de caixa x reserva mínima</p>
          {!editingCash && <button onClick={startEditCash} className="text-[11px] font-semibold" style={{ color: "var(--accent)" }}>Editar saldo</button>}
        </div>
        {editingCash ? (
          <div className="flex items-center gap-2">
            <input type="number" value={cashForm} onChange={(e) => setCashForm(e.target.value)} className="flex-1 bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} />
            <button onClick={saveCash} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>Salvar</button>
            <button onClick={() => setEditingCash(false)} className="px-3 py-1.5 rounded-lg text-xs border" style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>Cancelar</button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl p-3" style={{ backgroundColor: cashOk ? "var(--success-tint)" : "var(--danger-tint)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-quaternary)" }}>Saldo atual</p>
              <p className="text-base font-bold" style={{ color: cashOk ? "var(--success)" : "var(--danger)" }}>{fmt(settings?.cash_balance ?? 0)}</p>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-surface-2)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-quaternary)" }}>Reserva mín. (3m)</p>
              <p className="text-base font-bold text-[var(--text-primary)]">{fmt(reservaMin)}</p>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-surface-2)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-quaternary)" }}>Reserva ideal (6m)</p>
              <p className="text-base font-bold text-[var(--text-primary)]">{fmt(reservaIdeal)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Fluxo de caixa projetado */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs font-semibold text-[var(--text-primary)]">Fluxo de caixa projetado — próximos 3 meses</p>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Mês", "Entradas previstas", "Saídas previstas", "Saldo"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 font-bold uppercase tracking-widest" style={{ color: "var(--text-quaternary)", fontSize: "10px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fluxo.map((f) => (
              <tr key={f.month} style={{ borderBottom: "1px solid var(--bg-surface-2)" }}>
                <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{f.month}</td>
                <td className="px-4 py-3" style={{ color: "var(--success)" }}>{fmt(f.entradas)}</td>
                <td className="px-4 py-3" style={{ color: "var(--danger)" }}>{fmt(f.saidas)}</td>
                <td className="px-4 py-3 font-semibold" style={{ color: f.saldo >= 0 ? "var(--success)" : "var(--danger)" }}>{fmt(f.saldo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
