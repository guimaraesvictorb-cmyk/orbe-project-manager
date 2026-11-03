import { useState } from "react";
import {
  MAX_REPORT_DATE,
  MIN_REPORT_DATE,
  periodError,
  presetPeriod,
  type PeriodPreset,
  type ReportPeriod,
} from "../lib/reportPeriod";
const input =
  "mt-1 block w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
export function ReportPeriodPicker({
  start,
  end,
  onChange,
  maxDays,
}: ReportPeriod & {
  onChange: (period: ReportPeriod) => void;
  maxDays?: number;
}) {
  return (
    <PeriodDraft
      key={`${start}:${end}`}
      start={start}
      end={end}
      onChange={onChange}
      maxDays={maxDays}
    />
  );
}
function PeriodDraft({
  start,
  end,
  onChange,
  maxDays,
}: ReportPeriod & {
  onChange: (period: ReportPeriod) => void;
  maxDays?: number;
}) {
  const [draft, setDraft] = useState({ start, end }),
    [selected, setSelected] = useState<PeriodPreset>(() => {
      const presets: Exclude<PeriodPreset, "custom">[] = [
        "today",
        "yesterday",
        "last7",
        "last30",
        "month",
        "previousMonth",
        ...(maxDays ? [] : (["year"] as const)),
        "maximum",
      ];
      return (
        presets.find((p) => {
          const value = presetPeriod(p, new Date(), maxDays);
          return value.start === start && value.end === end;
        }) ?? "custom"
      );
    }),
    [error, setError] = useState("");
  function apply(value: ReportPeriod) {
    const problem = periodError(value, maxDays);
    setError(problem);
    if (!problem) onChange(value);
  }
  function choose(value: PeriodPreset) {
    setSelected(value);
    setError("");
    if (value === "custom") return;
    const range = presetPeriod(value, new Date(), maxDays);
    setDraft(range);
    apply(range);
  }
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-40 text-xs text-[var(--text-tertiary)]">
          Período
          <select
            aria-label="Atalho de período"
            className={input}
            value={selected}
            onChange={(e) => choose(e.target.value as PeriodPreset)}
          >
            <option value="custom">Personalizado</option>
            <option value="today">Hoje</option>
            <option value="yesterday">Ontem</option>
            <option value="last7">Últimos 7 dias</option>
            <option value="last30">Últimos 30 dias</option>
            <option value="month">Este mês</option>
            <option value="previousMonth">Mês passado</option>
            {!maxDays && <option value="year">Este ano</option>}
            <option value="maximum">
              {maxDays
                ? `Máximo por consulta (${maxDays} dias)`
                : "Máximo · todo o histórico"}
            </option>
          </select>
        </label>
        <label className="text-xs text-[var(--text-tertiary)]">
          De
          <input
            aria-label="Data inicial"
            type="date"
            min={MIN_REPORT_DATE}
            max={MAX_REPORT_DATE}
            className={input}
            value={draft.start}
            onChange={(e) => {
              setDraft({ ...draft, start: e.target.value });
              setSelected("custom");
              setError("");
            }}
          />
        </label>
        <label className="text-xs text-[var(--text-tertiary)]">
          Até
          <input
            aria-label="Data final"
            type="date"
            min={MIN_REPORT_DATE}
            max={MAX_REPORT_DATE}
            className={input}
            value={draft.end}
            onChange={(e) => {
              setDraft({ ...draft, end: e.target.value });
              setSelected("custom");
              setError("");
            }}
          />
        </label>
        <button
          type="button"
          className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-tint)]"
          onClick={() => apply(draft)}
        >
          Aplicar datas
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-[var(--danger)]">
          {error}
        </p>
      )}
      {!start && !end && !maxDays && (
        <p className="text-xs text-[var(--text-tertiary)]">
          Todo o histórico capturado no rastreamento. O período anterior à
          integração pode estar incompleto.
        </p>
      )}
    </div>
  );
}
