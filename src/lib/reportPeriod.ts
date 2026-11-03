export type ReportPeriod = { start: string; end: string };
export type PeriodPreset =
  | "custom"
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "month"
  | "previousMonth"
  | "year"
  | "maximum";
export const MIN_REPORT_DATE = "2000-01-01";
export const MAX_REPORT_DATE = "2100-12-31";
export const isReportDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  value >= MIN_REPORT_DATE &&
  value <= MAX_REPORT_DATE &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export function todayBrt(now = new Date()) {
  return new Date(now.getTime() - 3 * 3600000).toISOString().slice(0, 10);
}
export function shiftDay(day: string, count: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + count * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function periodError(period: ReportPeriod, maxDays?: number): string {
  if (!period.start && !period.end && !maxDays) return "";
  if (
    (!period.start && maxDays) ||
    (!period.end && maxDays) ||
    (period.start && !isReportDate(period.start)) ||
    (period.end && !isReportDate(period.end))
  )
    return "Preencha datas válidas entre 2000 e 2100.";
  if (period.start && period.end && period.start > period.end)
    return "A data inicial deve vir antes da data final.";
  if (
    maxDays &&
    (Date.parse(period.end) - Date.parse(period.start)) / 86400000 >= maxDays
  )
    return `Esta fonte permite até ${maxDays} dias por consulta.`;
  return "";
}
export function presetPeriod(
  preset: Exclude<PeriodPreset, "custom">,
  now = new Date(),
  maxDays?: number,
): ReportPeriod {
  const today = todayBrt(now),
    first = `${today.slice(0, 7)}-01`;
  switch (preset) {
    case "today":
      return { start: today, end: today };
    case "yesterday":
      return { start: shiftDay(today, -1), end: shiftDay(today, -1) };
    case "last7":
      return { start: shiftDay(today, -6), end: today };
    case "last30":
      return { start: shiftDay(today, -29), end: today };
    case "month":
      return { start: first, end: today };
    case "previousMonth": {
      const end = shiftDay(first, -1);
      return { start: `${end.slice(0, 7)}-01`, end };
    }
    case "year":
      return { start: `${today.slice(0, 4)}-01-01`, end: today };
    case "maximum":
      return maxDays
        ? { start: shiftDay(today, 1 - maxDays), end: today }
        : { start: "", end: "" };
  }
}
export function normalizePeriod(
  period: ReportPeriod,
  fallback: ReportPeriod,
): ReportPeriod {
  const next = {
    start:
      period.start === "" || isReportDate(period.start)
        ? period.start
        : fallback.start,
    end:
      period.end === "" || isReportDate(period.end) ? period.end : fallback.end,
  };
  return periodError(next) ? fallback : next;
}
