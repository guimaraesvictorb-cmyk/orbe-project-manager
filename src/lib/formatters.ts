export function fmtCurrency(n: number | null | undefined) {
  if (n == null) return "—";
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Whole-currency variant for KPI tiles/summaries (no cents), e.g. R$ 5.000
export function fmtCurrency0(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// Today's date as YYYY-MM-DD in the browser's local timezone.
// `new Date().toISOString()` converts to UTC first, which silently shifts
// the calendar day for anyone west of UTC (e.g. Brazil) in the evening.
export function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Current YYYY-MM in local time, same UTC-shift pitfall as todayLocal.
export function currentMonthLocal(): string {
  return todayLocal().slice(0, 7);
}

export function fmt(n: number | null | undefined, prefix = "") {
  if (n == null) return "—";
  return prefix + n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function fmtInt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR");
}

export function fmtPct(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toFixed(2) + "%";
}

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `há ${weeks} semana${weeks > 1 ? "s" : ""}`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
