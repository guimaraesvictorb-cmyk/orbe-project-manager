export function fmtCurrency(n: number | null | undefined) {
  if (n == null) return "—";
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
