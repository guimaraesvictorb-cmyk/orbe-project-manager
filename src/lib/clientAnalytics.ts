import {
  isReportDate,
  shiftDay,
  todayBrt,
  type ReportPeriod,
} from "./reportPeriod.js";
import type {
  ClientDashboardData,
  ClientMetricSet,
} from "./sharedDashboard.js";

export type AnalyticsSection =
  "executive" | "marketing" | "commercial" | "goals";
export const analyticsSections = [
  {
    id: "executive",
    label: "Visão executiva",
    question: "Como estão os resultados e o que merece atenção?",
  },
  {
    id: "marketing",
    label: "Marketing e aquisição",
    question: "De onde vêm os contatos e como está o investimento?",
  },
  {
    id: "commercial",
    label: "Performance comercial",
    question: "Como estamos atendendo e convertendo as oportunidades?",
  },
  {
    id: "goals",
    label: "Metas e planejamento",
    question: "Qual é a distância até o objetivo do mês?",
  },
] as const;
export const unitLabels: Record<string, string> = {
  all: "Todas as unidades",
  alecrim: "Alecrim",
  ibes: "Ibes",
  itapua: "Itapuã",
  unassigned: "Sem unidade identificada",
};
export function comparisonPeriod(period: ReportPeriod): ReportPeriod {
  if (
    !isReportDate(period.start) ||
    !isReportDate(period.end) ||
    period.start > period.end
  )
    throw Error("invalid_period");
  const days =
    Math.round((Date.parse(period.end) - Date.parse(period.start)) / 86400000) +
    1;
  if (
    period.start.endsWith("-01") &&
    period.start.slice(0, 7) === period.end.slice(0, 7)
  ) {
    const last = shiftDay(period.start, -1),
      day = Math.min(Number(period.end.slice(8)), Number(last.slice(8)));
    return {
      start: `${last.slice(0, 7)}-01`,
      end: `${last.slice(0, 7)}-${String(day).padStart(2, "0")}`,
    };
  }
  return {
    start: shiftDay(period.start, -days),
    end: shiftDay(period.start, -1),
  };
}
export function campaignKey(channel: string, name: string) {
  return JSON.stringify([channel, name]);
}
export function selectedMetrics(
  data: ClientDashboardData,
  channel: string,
  campaign = "",
): ClientMetricSet {
  if (campaign) {
    const found = data.campaigns.find(
      (c) =>
        campaignKey(c.channel, c.name) === campaign &&
        (channel === "all" || c.channel === channel),
    );
    return found?.metrics ?? emptyMetrics();
  }
  if (channel !== "all") return data.segments?.[channel] ?? emptyMetrics();
  return {
    total: data.total,
    native:
      Object.values(data.native_channels ?? {}).reduce((n, v) => n + v, 0) -
      (data.native_channels?.["Origem não identificada"] ?? 0),
    ...data.funnel,
    daily: data.daily,
  };
}
export function emptyMetrics(): ClientMetricSet {
  return {
    total: 0,
    native: 0,
    answered: 0,
    won: 0,
    waiting: 0,
    partial: 0,
    late: 0,
    lost: 0,
    review: 0,
    daily: [],
  };
}
export function percentChange(current: number, previous: number) {
  return previous > 0
    ? Math.round(((current - previous) / previous) * 1000) / 10
    : null;
}
export function goalProgress(
  data: ClientDashboardData,
  unit = "all",
  now = new Date(),
) {
  const goals =
    unit === "all"
      ? data.goals.some((g) => g.unit === "all")
        ? data.goals.filter((g) => g.unit === "all")
        : data.goals.filter((g) => g.unit !== "all")
      : data.goals.filter((g) => g.unit === unit);
  const target = goals.reduce((sum, g) => sum + g.target, 0),
    actual = data.monthly_units[unit] ?? 0;
  const first = `${data.goal_month}-01`,
    last = new Date(
      Date.UTC(
        Number(data.goal_month.slice(0, 4)),
        Number(data.goal_month.slice(5, 7)),
        0,
      ),
    )
      .toISOString()
      .slice(0, 10);
  const today = todayBrt(now),
    asOf = today < first ? null : today > last ? last : today,
    elapsed = asOf ? Number(asOf.slice(8)) : 0,
    days = Number(last.slice(8)),
    remaining = Math.max(0, days - elapsed);
  const complete = !!data.coverage_start && data.coverage_start <= first;
  return {
    target,
    actual,
    elapsed,
    days,
    remaining,
    expected: (target * elapsed) / days,
    ratio: target ? actual / target : null,
    projection:
      target && elapsed && complete
        ? Math.round((actual / elapsed) * days)
        : null,
    needed: target && remaining ? Math.max(0, target - actual) / remaining : 0,
    complete,
    asOf,
  };
}
export function groupTrend(
  points: { day: string; value: number }[],
  weekly: boolean,
) {
  if (!weekly) return points;
  const out: { day: string; value: number }[] = [];
  for (let i = 0; i < points.length; i += 7)
    out.push({
      day: points[i]!.day,
      value: points.slice(i, i + 7).reduce((n, p) => n + p.value, 0),
    });
  return out;
}

export function outcomeTitle(event?: string) {
  const value = (event ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (value.includes("matricula")) return "Matrículas confirmadas";
  if (value.includes("servico")) return "Serviços fechados";
  if (value.includes("negocio") || value.includes("oportunidade"))
    return "Negócios ganhos";
  return "Vendas confirmadas";
}
