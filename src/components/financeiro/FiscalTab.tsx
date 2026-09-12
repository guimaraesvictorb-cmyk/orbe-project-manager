import { useMemo, useState } from "react";
import { useFinancial } from "../../hooks/useFinancial";
import { usePayables, usePayees } from "../../hooks/usePayables";
import { useCompanySettings } from "../../hooks/useTorreControle";
import { fmtCurrency0, fmtPct, currentMonthLocal } from "../../lib/formatters";
import { calcAliquotaEfetiva, dasVencimento, trailing12Window, FATOR_R_THRESHOLD, ANEXO_III } from "../../lib/fiscal";

const fmt = fmtCurrency0;

export function FiscalTab() {
  const { records: allReceivables } = useFinancial({});
  const { records: allPayables } = usePayables({});
  const { payees } = usePayees();
  const { settings, updateSettings } = useCompanySettings();
  const [editingSettings, setEditingSettings] = useState(false);
  const [form, setForm] = useState({ cnae: "", nbs_code: "", regime: "" });

  const month = currentMonthLocal();
  const equipePayeeIds = new Set(payees.filter((p) => p.type === "equipe").map((p) => p.id));

  const { rbt12, folha12, receitaMes } = useMemo(() => {
    const [start, end] = trailing12Window();
    const rbt12 = allReceivables
      .filter((r) => r.status === "pago" && r.paid_date && r.client_id && r.paid_date >= start && r.paid_date <= end)
      .reduce((s, r) => s + r.amount, 0);
    const folha12 = allPayables
      .filter((p) => p.status === "pago" && p.paid_date && p.payee_id && equipePayeeIds.has(p.payee_id) && p.paid_date >= start && p.paid_date <= end)
      .reduce((s, p) => s + p.amount, 0);
    const receitaMes = allReceivables
      .filter((r) => r.status === "pago" && r.client_id && r.due_date.startsWith(month))
      .reduce((s, r) => s + r.amount, 0);
    return { rbt12, folha12, receitaMes };
  }, [allReceivables, allPayables, equipePayeeIds, month]);

  const { faixa, faixaIndex, efetiva } = calcAliquotaEfetiva(rbt12);
  const dasEstimado = receitaMes * efetiva;
  const fatorR = rbt12 > 0 ? folha12 / rbt12 : 0;
  const fatorROk = fatorR >= FATOR_R_THRESHOLD;
  const vencimento = dasVencimento(month);

  function startEdit() {
    setForm({ cnae: settings?.cnae ?? "", nbs_code: settings?.nbs_code ?? "", regime: settings?.regime ?? "" });
    setEditingSettings(true);
  }

  async function saveSettings() {
    await updateSettings({ cnae: form.cnae || null, nbs_code: form.nbs_code || null, regime: form.regime || null });
    setEditingSettings(false);
  }

  const notasPendentes = allReceivables.filter((r) => r.due_date.startsWith(month) && r.invoice_status !== "enviada" && r.client_id);

  return (
    <div className="space-y-6">
      {/* DAS simulator */}
      <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <p className="text-xs font-semibold text-[var(--text-primary)]">Simulador de DAS — {month}</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "RBT12 (faturamento 12m)", value: fmt(rbt12) },
            { label: "Alíquota nominal", value: `${(faixa.aliquota * 100).toFixed(2)}%` },
            { label: "Alíquota efetiva", value: fmtPct(efetiva * 100) },
            { label: "DAS estimado (mês)", value: fmt(dasEstimado), accent: true },
          ].map(({ label, value, accent }) => (
            <div key={label} className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-surface-2)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-quaternary)" }}>{label}</p>
              <p className="text-base font-bold" style={{ color: accent ? "var(--accent)" : "var(--text-primary)" }}>{value}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          Faixa {faixaIndex + 1} de {ANEXO_III.length} do Anexo III · Vencimento do DAS: <strong style={{ color: "var(--text-secondary)" }}>{new Date(vencimento + "T12:00:00").toLocaleDateString("pt-BR")}</strong>
        </p>
        <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-quaternary)" }}>
          Estimativa gerencial (alíquota efetiva × faturamento do mês). 2026 é ano de transição da Reforma Tributária (CBS/IBS em fase de teste) — confirme com seu contador antes de usar para pagar imposto de verdade.
        </p>
      </div>

      {/* Fator R */}
      <div className="rounded-2xl border p-5 space-y-3" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <p className="text-xs font-semibold text-[var(--text-primary)]">Painel do Fator R</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-surface-2)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-quaternary)" }}>Folha (equipe, 12m)</p>
            <p className="text-base font-bold text-[var(--text-primary)]">{fmt(folha12)}</p>
          </div>
          <div className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-surface-2)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-quaternary)" }}>Fator R</p>
            <p className="text-base font-bold" style={{ color: fatorROk ? "var(--success)" : "var(--danger)" }}>{fmtPct(fatorR * 100)}</p>
          </div>
          <div className="rounded-xl p-3 flex flex-col justify-center" style={{ backgroundColor: fatorROk ? "var(--success-tint)" : "var(--danger-tint)" }}>
            <p className="text-xs font-bold" style={{ color: fatorROk ? "var(--success)" : "var(--danger)" }}>
              {fatorROk ? "Anexo III ✓" : "Cairia p/ Anexo V"}
            </p>
            <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Limite: 28% (folha ÷ RBT12)</p>
          </div>
        </div>
      </div>

      {/* Registro fiscal */}
      <div className="rounded-2xl border p-5 space-y-3" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-[var(--text-primary)]">Enquadramento fiscal</p>
          {!editingSettings && (
            <button onClick={startEdit} className="text-[11px] font-semibold" style={{ color: "var(--accent)" }}>Editar</button>
          )}
        </div>
        {editingSettings ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input value={form.cnae} onChange={(e) => setForm((p) => ({ ...p, cnae: e.target.value }))} placeholder="CNAE" className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} />
            <input value={form.nbs_code} onChange={(e) => setForm((p) => ({ ...p, nbs_code: e.target.value }))} placeholder="Código NBS" className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} />
            <input value={form.regime} onChange={(e) => setForm((p) => ({ ...p, regime: e.target.value }))} placeholder="Regime (Simples Nacional...)" className="bg-[var(--bg-page)] border rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border-subtle)" }} />
            <div className="flex gap-2 sm:col-span-3">
              <button onClick={saveSettings} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>Salvar</button>
              <button onClick={() => setEditingSettings(false)} className="px-3 py-1.5 rounded-lg text-xs border" style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div><span style={{ color: "var(--text-quaternary)" }}>CNAE: </span><span className="text-[var(--text-primary)]">{settings?.cnae ?? "—"}</span></div>
            <div><span style={{ color: "var(--text-quaternary)" }}>NBS: </span><span className="text-[var(--text-primary)]">{settings?.nbs_code ?? "—"}</span></div>
            <div><span style={{ color: "var(--text-quaternary)" }}>Regime: </span><span className="text-[var(--text-primary)]">{settings?.regime ?? "—"}</span></div>
          </div>
        )}
      </div>

      {/* Emissão de notas do mês */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs font-semibold text-[var(--text-primary)]">Notas fiscais pendentes de envio — {month}</p>
        </div>
        {notasPendentes.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>Tudo emitido e enviado 🎉</p>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--bg-surface-2)" }}>
            {notasPendentes.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-2.5">
                <p className="text-xs text-[var(--text-primary)]">{r.description ?? "—"}</p>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded" style={{ backgroundColor: "var(--warning-tint)", color: "var(--warning)" }}>
                  {r.invoice_status === "a_emitir" ? "A emitir" : "Emitida"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
