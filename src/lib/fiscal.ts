// Simples Nacional — Anexo III (base: set/2026, ver blueprint "Torre de Controle Financeira").
// Alíquotas/faixas mudam por lei; sempre confirmar com o contador antes de usar para
// calcular impostos de verdade — isto é uma estimativa gerencial, não um cálculo oficial.
export const ANEXO_III = [
  { limit: 180_000, aliquota: 0.06, deducao: 0 },
  { limit: 360_000, aliquota: 0.112, deducao: 9_360 },
  { limit: 720_000, aliquota: 0.135, deducao: 17_640 },
  { limit: 1_800_000, aliquota: 0.16, deducao: 35_640 },
  { limit: 3_600_000, aliquota: 0.21, deducao: 125_640 },
] as const;

export const FATOR_R_THRESHOLD = 0.28;

export function calcAliquotaEfetiva(rbt12: number) {
  const faixa = ANEXO_III.find((f) => rbt12 <= f.limit) ?? ANEXO_III[ANEXO_III.length - 1];
  const faixaIndex = ANEXO_III.indexOf(faixa);
  const efetiva = rbt12 > 0 ? (rbt12 * faixa.aliquota - faixa.deducao) / rbt12 : faixa.aliquota;
  return { faixa, faixaIndex, efetiva: Math.max(efetiva, 0) };
}

// DAS vence dia 20 do mês seguinte; se cair em fim de semana, empurra pro próximo dia útil.
// (Não considera feriados nacionais/municipais — a Receita pode prorrogar por outros motivos também.)
export function dasVencimento(competenciaYYYYMM: string): string {
  const [y, m] = competenciaYYYYMM.split("-").map(Number);
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  const d = new Date(nextYear, nextMonth - 1, 20);
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2);
  if (day === 0) d.setDate(d.getDate() + 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// Trailing-12-months window ending today, as [startYYYYMMDD, endYYYYMMDD].
export function trailing12Window(): [string, string] {
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 1);
  start.setDate(start.getDate() + 1);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return [fmt(start), fmt(end)];
}
