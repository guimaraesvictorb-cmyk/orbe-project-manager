import { useMemo, useState } from "react";
import { Trophy, Plus, Trash2, Loader2 } from "lucide-react";
import { useRoiDay } from "../hooks/useRoiDay";
import { useAuth } from "../hooks/useAuth";
import type { RoiDayClient } from "../lib/database.types";
import { fmtCurrency0, fmtInt, fmtPct } from "../lib/formatters";

const ROI_STATUS_OPTIONS = ["Ativo", "Onboarding", "Transição", "Aviso Prévio", "Churn"];

const ROI_STATUS_COLOR: Record<string, string> = {
  Ativo: "var(--success)",
  Onboarding: "var(--accent)",
  "Transição": "var(--warning)",
  "Aviso Prévio": "var(--warning)",
  Churn: "var(--danger)",
};

function monthsSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const start = new Date(dateStr + "T00:00:00");
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

function parseNumInput(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

type ColType = "text" | "money" | "int" | "pct" | "date";

function EditableCell({ value, type, onCommit, placeholder }: {
  value: string | number | null;
  type: ColType;
  onCommit: (v: string | number | null) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? "" : String(value));

  function startEdit() {
    setDraft(value == null ? "" : String(value));
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    if (type === "text" || type === "date") {
      onCommit(draft.trim() === "" ? null : draft.trim());
    } else {
      onCommit(parseNumInput(draft));
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        type={type === "date" ? "date" : type === "text" ? "text" : "text"}
        inputMode={type === "text" || type === "date" ? undefined : "decimal"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder={placeholder}
        className="w-full min-w-[90px] rounded px-1.5 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
        style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--accent-a44)" }}
      />
    );
  }

  let display: string;
  if (value == null) display = "—";
  else if (type === "money") display = fmtCurrency0(Number(value));
  else if (type === "pct") display = fmtPct(Number(value));
  else if (type === "int") display = fmtInt(Number(value));
  else display = String(value);

  return (
    <button
      onClick={startEdit}
      className="w-full min-w-[90px] text-left px-1.5 py-1 rounded text-xs hover:bg-[var(--bg-surface-2)] transition-colors truncate"
      style={{ color: value == null ? "var(--text-quaternary)" : "var(--text-secondary)" }}
    >
      {display}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left text-[9px] font-bold tracking-widest uppercase px-2 py-2 whitespace-nowrap" style={{ color: "var(--text-tertiary)" }}>
      {children}
    </th>
  );
}

export function RoiDayView() {
  const { profile } = useAuth();
  const { rows, loading, addRow, updateRow, deleteRow } = useRoiDay();
  const [adding, setAdding] = useState(false);

  const totals = useMemo(() => {
    const sum = (k: keyof RoiDayClient) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    return {
      fee: sum("fee"), inv_meta: sum("inv_meta"), inv_realizado: sum("inv_realizado"),
      fat_meta: sum("fat_meta"), fat_realizado: sum("fat_realizado"), gmv_mes: sum("gmv_mes"),
      leads: sum("leads"), mql: sum("mql"), sql_count: sum("sql_count"), vendas: sum("vendas"),
    };
  }, [rows]);

  const nps = useMemo(() => {
    const ativos = rows.filter((r) => r.roi_status === "Ativo");
    const respostas = ativos.filter((r) => r.nps != null);
    return {
      clientes: ativos.length,
      respostas: respostas.length,
      aguardando: ativos.length - respostas.length,
      taxa: ativos.length > 0 ? (respostas.length / ativos.length) * 100 : 0,
    };
  }, [rows]);

  async function handleAdd() {
    if (!profile) return;
    setAdding(true);
    await addRow("Novo cliente", profile.id);
    setAdding(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto w-full px-6 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "var(--accent)" }}>Operação</p>
          <h2 className="text-[var(--text-primary)] font-bold text-lg leading-tight flex items-center gap-2">
            <Trophy size={18} style={{ color: "var(--accent)" }} />
            ROI Day
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>Fee, investimento, faturamento e funil por cliente — clique numa célula pra editar.</p>
        </div>
        <button
          onClick={handleAdd}
          disabled={adding}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}
        >
          {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Nova linha
        </button>
      </div>

      {/* NPS summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Clientes ativos (NPS)", value: fmtInt(nps.clientes) },
          { label: "Respostas", value: fmtInt(nps.respostas) },
          { label: "Aguardando", value: fmtInt(nps.aguardando) },
          { label: "Taxa de resposta", value: fmtPct(nps.taxa) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border p-3" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
            <p className="text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: "var(--text-tertiary)" }}>{label}</p>
            <p className="text-base font-bold text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-auto" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <table className="text-xs" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr style={{ backgroundColor: "var(--bg-surface-2)", borderBottom: "1px solid var(--border)" }}>
              <th className="sticky left-0 z-10 text-left text-[9px] font-bold tracking-widest uppercase px-2 py-2 whitespace-nowrap" style={{ color: "var(--text-tertiary)", backgroundColor: "var(--bg-surface-2)" }}>Cliente</th>
              <Th>Status</Th>
              <Th>NPS</Th>
              <Th>FEE</Th>
              <Th>Inv. Meta</Th>
              <Th>Inv. Realizado</Th>
              <Th>% Meta Inv.</Th>
              <Th>Fat. Meta</Th>
              <Th>Fat. Realizado</Th>
              <Th>% Meta Fat.</Th>
              <Th>GMV Mês</Th>
              <Th>Leads</Th>
              <Th>CPL</Th>
              <Th>MQL</Th>
              <Th>CPMQL</Th>
              <Th>SQL</Th>
              <Th>CPSQL</Th>
              <Th>Vendas</Th>
              <Th>CPV</Th>
              <Th>ROAS</Th>
              <Th>ROI</Th>
              <Th>MC%</Th>
              <Th>MMF</Th>
              <Th>Data entrada</Th>
              <Th>LT (meses)</Th>
              <Th>Localização</Th>
              <Th>Stakeholder</Th>
              <Th>Offboarding</Th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const invPct = r.inv_meta ? ((r.inv_realizado ?? 0) / r.inv_meta) * 100 : null;
              const fatPct = r.fat_meta ? ((r.fat_realizado ?? 0) / r.fat_meta) * 100 : null;
              const roas = r.inv_realizado ? (r.fat_realizado ?? 0) / r.inv_realizado : null;
              const roi = r.inv_realizado ? (((r.fat_realizado ?? 0) - r.inv_realizado) / r.inv_realizado) * 100 : null;
              const lt = monthsSince(r.data_entrada);
              return (
                <tr key={r.id} className="group hover:bg-[var(--bg-surface-2)] transition-colors" style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="sticky left-0 z-10" style={{ backgroundColor: "var(--bg-surface)" }}>
                    <EditableCell value={r.name} type="text" onCommit={(v) => updateRow(r.id, { name: (v as string) ?? r.name })} />
                  </td>
                  <td>
                    <select
                      value={r.roi_status ?? ""}
                      onChange={(e) => updateRow(r.id, { roi_status: e.target.value || null })}
                      className="text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-1 focus:outline-none"
                      style={{ backgroundColor: "transparent", color: ROI_STATUS_COLOR[r.roi_status ?? ""] ?? "var(--text-tertiary)", border: "1px solid var(--border)" }}
                    >
                      <option value="">—</option>
                      {ROI_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td><EditableCell value={r.nps} type="int" onCommit={(v) => updateRow(r.id, { nps: v as number | null })} /></td>
                  <td><EditableCell value={r.fee} type="money" onCommit={(v) => updateRow(r.id, { fee: v as number | null })} /></td>
                  <td><EditableCell value={r.inv_meta} type="money" onCommit={(v) => updateRow(r.id, { inv_meta: v as number | null })} /></td>
                  <td><EditableCell value={r.inv_realizado} type="money" onCommit={(v) => updateRow(r.id, { inv_realizado: v as number | null })} /></td>
                  <td className="px-1.5 py-1" style={{ color: "var(--text-quaternary)" }}>{invPct == null ? "—" : fmtPct(invPct)}</td>
                  <td><EditableCell value={r.fat_meta} type="money" onCommit={(v) => updateRow(r.id, { fat_meta: v as number | null })} /></td>
                  <td><EditableCell value={r.fat_realizado} type="money" onCommit={(v) => updateRow(r.id, { fat_realizado: v as number | null })} /></td>
                  <td className="px-1.5 py-1" style={{ color: "var(--text-quaternary)" }}>{fatPct == null ? "—" : fmtPct(fatPct)}</td>
                  <td><EditableCell value={r.gmv_mes} type="money" onCommit={(v) => updateRow(r.id, { gmv_mes: v as number | null })} /></td>
                  <td><EditableCell value={r.leads} type="int" onCommit={(v) => updateRow(r.id, { leads: v as number | null })} /></td>
                  <td><EditableCell value={r.cpl} type="money" onCommit={(v) => updateRow(r.id, { cpl: v as number | null })} /></td>
                  <td><EditableCell value={r.mql} type="int" onCommit={(v) => updateRow(r.id, { mql: v as number | null })} /></td>
                  <td><EditableCell value={r.cpmql} type="money" onCommit={(v) => updateRow(r.id, { cpmql: v as number | null })} /></td>
                  <td><EditableCell value={r.sql_count} type="int" onCommit={(v) => updateRow(r.id, { sql_count: v as number | null })} /></td>
                  <td><EditableCell value={r.cpsql} type="money" onCommit={(v) => updateRow(r.id, { cpsql: v as number | null })} /></td>
                  <td><EditableCell value={r.vendas} type="int" onCommit={(v) => updateRow(r.id, { vendas: v as number | null })} /></td>
                  <td><EditableCell value={r.cpv} type="money" onCommit={(v) => updateRow(r.id, { cpv: v as number | null })} /></td>
                  <td className="px-1.5 py-1 font-semibold" style={{ color: roas == null ? "var(--text-quaternary)" : "var(--accent)" }}>{roas == null ? "—" : roas.toFixed(2) + "x"}</td>
                  <td className="px-1.5 py-1 font-semibold" style={{ color: roi == null ? "var(--text-quaternary)" : roi >= 0 ? "var(--success)" : "var(--danger)" }}>{roi == null ? "—" : fmtPct(roi)}</td>
                  <td><EditableCell value={r.mc_pct} type="pct" onCommit={(v) => updateRow(r.id, { mc_pct: v as number | null })} /></td>
                  <td><EditableCell value={r.mmf} type="money" onCommit={(v) => updateRow(r.id, { mmf: v as number | null })} /></td>
                  <td><EditableCell value={r.data_entrada} type="date" onCommit={(v) => updateRow(r.id, { data_entrada: v as string | null })} /></td>
                  <td className="px-1.5 py-1" style={{ color: "var(--text-quaternary)" }}>{lt == null ? "—" : lt}</td>
                  <td><EditableCell value={r.localizacao} type="text" onCommit={(v) => updateRow(r.id, { localizacao: v as string | null })} /></td>
                  <td><EditableCell value={r.stakeholder} type="text" onCommit={(v) => updateRow(r.id, { stakeholder: v as string | null })} /></td>
                  <td><EditableCell value={r.offboarding_date} type="date" onCommit={(v) => updateRow(r.id, { offboarding_date: v as string | null })} /></td>
                  <td className="px-2">
                    <button onClick={() => { if (confirm(`Remover "${r.name}" do ROI Day?`)) deleteRow(r.id); }} className="p-1 opacity-0 group-hover:opacity-100" style={{ color: "var(--text-quaternary)" }} aria-label="Remover">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: "var(--bg-surface-2)", borderTop: "2px solid var(--border-strong)" }}>
              <td className="sticky left-0 z-10 px-2 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-primary)" }}>Total ({rows.length})</td>
              <td /><td />
              <td className="px-1.5 py-2 text-xs font-bold" style={{ color: "var(--accent)" }}>{fmtCurrency0(totals.fee)}</td>
              <td className="px-1.5 py-2 text-xs font-bold">{fmtCurrency0(totals.inv_meta)}</td>
              <td className="px-1.5 py-2 text-xs font-bold">{fmtCurrency0(totals.inv_realizado)}</td>
              <td />
              <td className="px-1.5 py-2 text-xs font-bold">{fmtCurrency0(totals.fat_meta)}</td>
              <td className="px-1.5 py-2 text-xs font-bold">{fmtCurrency0(totals.fat_realizado)}</td>
              <td />
              <td className="px-1.5 py-2 text-xs font-bold">{fmtCurrency0(totals.gmv_mes)}</td>
              <td className="px-1.5 py-2 text-xs font-bold">{fmtInt(totals.leads)}</td>
              <td />
              <td className="px-1.5 py-2 text-xs font-bold">{fmtInt(totals.mql)}</td>
              <td />
              <td className="px-1.5 py-2 text-xs font-bold">{fmtInt(totals.sql_count)}</td>
              <td />
              <td className="px-1.5 py-2 text-xs font-bold">{fmtInt(totals.vendas)}</td>
              <td colSpan={9} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
