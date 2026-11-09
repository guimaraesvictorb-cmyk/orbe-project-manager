import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Info, TriangleAlert, X } from "lucide-react";
import {
  analyticsSections,
  campaignKey,
  goalProgress,
  groupTrend,
  percentChange,
  selectedMetrics,
  unitLabels,
  outcomeTitle,
  type AnalyticsSection,
} from "../lib/clientAnalytics";
import { channelTitle } from "../lib/biDashboard";
import type {
  ClientDashboardData,
  ClientMetricSet,
  SharedMedia,
} from "../lib/sharedDashboard";
import { TrackingChannelLogo } from "./TrackingChannelLogo";

const panel = "rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]";
const num = (v: number) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const pct = (n: number, d: number) => (d ? `${num((n / d) * 100)}%` : "—");
const money = (v: number, currency = "BRL") =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(v);
const date = (v: string) =>
  new Date(`${v}T12:00:00Z`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
  });
type Detail = {
  label: string;
  value: string;
  source: string;
  definition: string;
  formula?: string;
  rows?: { label: string; value: string }[];
};
type MediaSet = Partial<Record<"Meta" | "Google", SharedMedia>>;
type Props = {
  data: ClientDashboardData;
  section: AnalyticsSection;
  channel: string;
  onChannel: (channel: string) => void;
  campaign?: string;
  onCampaign?: (key: string) => void;
  media?: MediaSet;
  onSection?: (section: AnalyticsSection) => void;
  onUnit?: (unit: string) => void;
};

function Metric({
  label,
  value,
  detail,
  current,
  previous,
  inverse = false,
  onOpen,
}: {
  label: string;
  value: string;
  detail: string;
  current?: number;
  previous?: number;
  inverse?: boolean;
  onOpen: () => void;
}) {
  const change =
    current !== undefined && previous !== undefined
      ? percentChange(current, previous)
      : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Detalhar ${label}`}
      className="min-h-40 min-w-0 p-5 text-left transition-colors hover:bg-[var(--bg-surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          {label}
        </span>
        <Info size={14} className="shrink-0 text-[var(--text-tertiary)]" />
      </span>
      <strong className="mt-5 block font-display text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </strong>
      <span className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        {change !== null && (
          <span
            className={`rounded px-1.5 py-0.5 font-semibold ${change >= 0 !== inverse ? "bg-[var(--success-tint)] text-[var(--success)]" : "bg-[var(--danger-tint)] text-[var(--danger)]"}`}
          >
            {change >= 0 ? "↑" : "↓"} {num(Math.abs(change))}%
          </span>
        )}
        <span className="text-[var(--text-tertiary)]">{detail}</span>
      </span>
    </button>
  );
}
function MetricDialog({
  detail,
  onClose,
}: {
  detail: Detail;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="client-bi-detail-title"
      className="client-bi-dialog m-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-0 text-[var(--text-primary)] shadow-2xl backdrop:bg-black/50"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent)]">
              Indicador e origem
            </p>
            <h2
              id="client-bi-detail-title"
              className="mt-2 font-display text-xl font-semibold"
            >
              {detail.label}
            </h2>
          </div>
          <button
            autoFocus
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhamento"
            className="rounded-lg p-2 hover:bg-[var(--bg-surface-2)]"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-6 font-display text-4xl font-semibold tabular-nums">
          {detail.value}
        </p>
        <p className="mt-5 text-sm leading-relaxed text-[var(--text-secondary)]">
          {detail.definition}
        </p>
        {detail.formula && (
          <p className="mt-4 rounded-lg bg-[var(--bg-surface-2)] p-4 text-sm">
            {detail.formula}
          </p>
        )}
        <p className="mt-5 text-xs text-[var(--text-tertiary)]">
          Fonte: {detail.source}
        </p>
        {detail.rows && (
          <div className="mt-5 max-h-64 overflow-auto border-t border-[var(--border)]">
            {detail.rows.map((r, i) => (
              <div
                key={`${r.label}:${i}`}
                className="flex justify-between gap-4 border-b border-[var(--border)] py-3 text-sm"
              >
                <span className="min-w-0 text-[var(--text-secondary)]">
                  {r.label}
                </span>
                <strong className="shrink-0 tabular-nums">{r.value}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </dialog>
  );
}
function Trend({
  data,
  previous,
  onDay,
}: {
  data: ClientMetricSet;
  previous?: ClientMetricSet;
  onDay: (day: string, value: number) => void;
}) {
  const [weekly, setWeekly] = useState(false),
    points = groupTrend(data.daily, weekly),
    before = groupTrend(previous?.daily ?? [], weekly),
    max = Math.max(
      1,
      ...points.map((p) => p.value),
      ...before.map((p) => p.value),
    ),
    slot = 620 / Math.max(1, points.length),
    bar = Math.min(28, slot * (before.length ? 0.32 : 0.6));
  return (
    <section className={`${panel} min-w-0 overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
        <h2 className="text-sm font-semibold">
          Evolução dos primeiros contatos
        </h2>
        <div
          className="flex rounded-lg bg-[var(--bg-surface-2)] p-1"
          aria-label="Agrupamento do gráfico"
        >
          {[false, true].map((value) => (
            <button
              key={String(value)}
              type="button"
              aria-pressed={weekly === value}
              onClick={() => setWeekly(value)}
              className={`rounded-md px-3 py-1 text-xs ${weekly === value ? "bg-[var(--bg-surface)] font-semibold shadow-sm" : "text-[var(--text-tertiary)]"}`}
            >
              {value ? "Semana" : "Dia"}
            </button>
          ))}
        </div>
      </div>
      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--text-tertiary)]">
            <strong className="mr-2 text-lg text-[var(--text-primary)]">
              {num(data.total)}
            </strong>
            primeiros contatos no período
          </p>
          <div className="flex gap-4 text-[10px] text-[var(--text-tertiary)]">
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[var(--accent)]" />
              Período selecionado
            </span>
            {before.length > 0 && (
              <span>
                <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[var(--text-quaternary)]" />
                Comparação
              </span>
            )}
          </div>
        </div>
        <svg
          viewBox="0 0 680 240"
          role="img"
          aria-label="Evolução dos primeiros contatos por período"
          className="mt-4 h-56 w-full"
        >
          <title>
            Primeiros contatos por {weekly ? "semana" : "dia"}. Selecione uma
            barra para ver o valor.
          </title>
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line
                x1="38"
                x2="666"
                y1={200 - v * 165}
                y2={200 - v * 165}
                stroke="var(--border)"
              />
              <text
                x="28"
                y={204 - v * 165}
                textAnchor="end"
                fill="var(--text-tertiary)"
                fontSize="10"
              >
                {num(v * max)}
              </text>
            </g>
          ))}
          {points.map((p, i) => {
            const x = 40 + i * slot + slot / 2,
              h = (p.value / max) * 165,
              old = before[i];
            return (
              <g key={p.day}>
                {old && (
                  <rect
                    x={x - bar - 1}
                    y={200 - (old.value / max) * 165}
                    width={bar}
                    height={(old.value / max) * 165}
                    rx="2"
                    fill="var(--text-quaternary)"
                    opacity=".45"
                  >
                    <title>
                      {date(old.day)}: {old.value}
                    </title>
                  </rect>
                )}
                <rect
                  role="button"
                  tabIndex={0}
                  aria-label={`${weekly ? "Semana de " : ""}${date(p.day)}: ${p.value} contatos`}
                  onClick={() => onDay(p.day, p.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onDay(p.day, p.value);
                    }
                  }}
                  x={old ? x + 1 : x - bar / 2}
                  y={h ? 200 - h : 197}
                  width={bar}
                  height={Math.max(3, h)}
                  rx="2"
                  fill="var(--accent)"
                  opacity=".8"
                >
                  <title>
                    {date(p.day)}: {p.value}
                  </title>
                </rect>
                {(points.length <= 10 ||
                  i === 0 ||
                  i === points.length - 1) && (
                  <text
                    x={x}
                    y="224"
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--text-tertiary)"
                  >
                    {date(p.day)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {!points.length && (
          <p className="text-center text-xs text-[var(--text-tertiary)]">
            Sem dados para esta seleção.
          </p>
        )}
      </div>
    </section>
  );
}
function GoalCard({
  data,
  onOpen,
  onSection,
}: {
  data: ClientDashboardData;
  onOpen: () => void;
  onSection?: () => void;
}) {
  const g = goalProgress(data, data.unit),
    label = !g.target
      ? "Sem meta cadastrada"
      : g.actual >= g.target
        ? "Meta atingida"
        : !g.complete
          ? "Histórico parcial"
          : g.projection !== null && g.projection >= g.target
            ? "No ritmo"
            : "Atenção ao ritmo";
  return (
    <section className={`${panel} flex flex-col p-5`}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold leading-snug">
          Meta de primeiros contatos
        </h2>
        <span className="shrink-0 rounded-full bg-[var(--accent-tint)] px-2 py-1 text-[9px] font-semibold text-[var(--accent)]">
          {label}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
        {data.goal_month.split("-").reverse().join("/")} ·{" "}
        {unitLabels[data.unit] || data.unit}
      </p>
      <button
        type="button"
        onClick={onOpen}
        aria-label="Detalhar meta de primeiros contatos"
        className="mt-6 text-left"
      >
        <strong className="font-display text-4xl font-semibold">
          {g.ratio === null ? "—" : `${Math.round(g.ratio * 100)}%`}
        </strong>
        <span className="ml-3 text-xs text-[var(--text-secondary)]">
          {g.target ? `${g.actual} de ${g.target}` : "Definida pela equipe"}
        </span>
      </button>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="h-full rounded-full bg-[var(--accent)]"
          style={{ width: `${Math.min(100, (g.ratio ?? 0) * 100)}%` }}
        />
      </div>
      <p className="mt-3 text-[10px] text-[var(--text-tertiary)]">
        {g.target
          ? `Esperado pelo calendário: ${num(g.expected)}`
          : "A equipe pode cadastrar a meta no rastreamento."}
      </p>
      <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-5 border-t border-[var(--border)] pt-5">
        {[
          ["Projeção", g.projection === null ? "—" : num(g.projection)],
          [
            "Saldo restante",
            g.target ? num(Math.max(0, g.target - g.actual)) : "—",
          ],
          ["Ritmo necessário", g.target ? `${num(g.needed)}/dia` : "—"],
          ["Dias restantes", String(g.remaining)],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-[10px] text-[var(--text-tertiary)]">{label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[10px] leading-relaxed text-[var(--text-tertiary)]">
        Mês completo, todas as origens. Projeção pelo ritmo médio do mês;
        histórico parcial impede projeção.
      </p>
      {onSection && (
        <button
          type="button"
          onClick={onSection}
          className="mt-auto pt-5 text-left text-xs font-semibold text-[var(--accent)]"
        >
          Abrir metas e planejamento →
        </button>
      )}
    </section>
  );
}

export function ClientAnalyticsPanels({
  data,
  section,
  channel,
  onChannel,
  campaign = "",
  onCampaign,
  media = {},
  onSection,
  onUnit,
}: Props) {
  const [detail, setDetail] = useState<Detail | null>(null),
    [marketingTab, setMarketingTab] = useState<
      "channels" | "campaigns" | "media"
    >("channels");
  const m = selectedMetrics(data, channel, campaign),
    previousData = data.comparison?.coverage_complete
      ? { ...data, ...data.comparison }
      : undefined,
    previous = previousData
      ? selectedMetrics(previousData, channel, campaign)
      : undefined;
  const outcome = outcomeTitle(data.client.conversion_event);
  const scope = campaign
      ? "Campanha selecionada"
      : channel === "all"
        ? "Todas as origens"
        : channelTitle(channel),
    unknown = data.channels["Origem não identificada"] ?? 0;
  const open = (
    label: string,
    value: string,
    definition: string,
    source = "Rastreamento do Studio · primeiro contato observado por WhatsApp",
    formula?: string,
    rows?: Detail["rows"],
  ) => setDetail({ label, value, definition, source, formula, rows });
  const mediaEntries = Object.entries(media).filter(
    ([name, r]) =>
      r.status === "ready" &&
      r.totals &&
      (channel === "all" || name === channel),
  ) as [string, SharedMedia & { totals: NonNullable<SharedMedia["totals"]> }][];
  const currencies = new Set(mediaEntries.map(([, r]) => r.currency || "BRL")),
    currency = mediaEntries[0]?.[1].currency || "BRL",
    spend =
      currencies.size === 1
        ? mediaEntries.reduce((n, [, r]) => n + r.totals.spend, 0)
        : null;
  const mainKpis = (
    <div
      className={`${panel} grid overflow-hidden divide-y divide-[var(--border)] sm:grid-cols-2 xl:grid-cols-3 xl:divide-y-0 [&>button]:border-[var(--border)] [&>button]:sm:border-b [&>button]:sm:border-r`}
    >
      <Metric
        label="Primeiros contatos"
        value={num(m.total)}
        current={m.total}
        previous={previous?.total}
        detail="Primeiro registro no WhatsApp"
        onOpen={() =>
          open(
            "Primeiros contatos",
            num(m.total),
            "Cada contato é contado uma vez no histórico capturado, na data da primeira mensagem. Inclui retornos de clientes antigos; não significa novos cadastros na Kommo.",
            undefined,
            undefined,
            m.daily.map((p) => ({ label: date(p.day), value: num(p.value) })),
          )
        }
      />
      <Metric
        label="Atendimentos comprovados"
        value={num(m.answered)}
        current={m.answered}
        previous={previous?.answered}
        detail="Resposta ou confirmação da equipe"
        onOpen={() =>
          open(
            "Atendimentos comprovados",
            num(m.answered),
            "Contatos com resposta humana identificada ou atendimento confirmado pela equipe. Respostas automáticas não contam.",
            "Histórico de atendimento e confirmações no Studio",
          )
        }
      />
      <Metric
        label={outcome}
        value={num(m.won)}
        current={m.won}
        previous={previous?.won}
        detail="Confirmadas pela equipe no Studio"
        onOpen={() =>
          open(
            outcome,
            num(m.won),
            "Resultados que a equipe marcou como confirmados no Studio. Esta contagem não é uma consulta ao EVO, Bitrix ou e-commerce.",
            "Confirmações comerciais do Studio",
          )
        }
      />
      <Metric
        label="Conversão observável"
        value={pct(m.won, m.total)}
        detail="Primeiro contato → venda no Studio"
        onOpen={() =>
          open(
            "Conversão observável",
            pct(m.won, m.total),
            "Razão entre resultados confirmados no Studio e primeiros contatos do período. Histórico incompleto e resultados não registrados limitam esta leitura.",
            "Rastreamento e resultados confirmados",
            `${m.won} vendas ÷ ${m.total} contatos`,
          )
        }
      />
      <Metric
        label="Investimento em mídia"
        value={
          spend === null || data.unit !== "all" ? "—" : money(spend, currency)
        }
        detail={
          data.unit !== "all"
            ? "Sem rateio comprovado por unidade"
            : mediaEntries.length
              ? `${mediaEntries.map(([name]) => name).join(" + ")} · fontes disponíveis`
              : "Consulte as fontes de mídia"
        }
        onOpen={() =>
          open(
            "Investimento em mídia",
            spend === null || data.unit !== "all"
              ? "—"
              : money(spend, currency),
            "Soma apenas as plataformas com leitura disponível, na mesma moeda. Não inclui honorários, custos internos ou fontes sem dados. Filtros de canal e campanha do WhatsApp não alteram o investimento da conta.",
            "Plataformas de anúncios",
            undefined,
            mediaEntries.map(([name, r]) => ({
              label: name,
              value: money(r.totals.spend, r.currency),
            })),
          )
        }
      />
      <Metric
        label="Aguardando atendimento"
        value={num(m.waiting)}
        current={m.waiting}
        previous={previous?.waiting}
        inverse
        detail={`${m.late ?? 0} com prazo excedido`}
        onOpen={() =>
          open(
            "Aguardando atendimento",
            num(m.waiting),
            "Estado atual das conversas de contatos que entraram no período. Respostas automáticas não encerram a espera.",
            "Calendário de atendimento e mensagens do Studio",
          )
        }
      />
    </div>
  );
  const goalDetail = () => {
    const g = goalProgress(data, data.unit);
    open(
      "Meta de primeiros contatos",
      g.target ? `${g.actual} de ${g.target}` : "Sem meta cadastrada",
      "A meta usa o mês completo, na unidade selecionada, independentemente do canal ou campanha filtrados. A projeção é uma hipótese baseada na média diária e só é exibida com cobertura desde o início do mês.",
      "Metas cadastradas pela equipe no rastreamento",
      g.projection === null
        ? "Sem base completa para projetar."
        : `${g.actual} ÷ ${g.elapsed} dias × ${g.days} dias = ${g.projection} contatos projetados`,
    );
  };
  const campaignRows = data.campaigns.filter(
    (c) =>
      (channel === "all" || c.channel === channel) &&
      (!campaign || campaignKey(c.channel, c.name) === campaign),
  );
  const channelRows = Object.entries(data.channels).filter(([name])=>name!=="Origem não identificada")
    .filter(([c]) => channel === "all" || c === channel)
    .map(([c, n]) => [c, campaign ? m.total : n] as const);
  const alertRows = [
    ...(m.waiting
      ? [
          {
            title: `${m.waiting} contatos aguardam atendimento`,
            text: `${m.late ?? 0} estão além do prazo definido. Confira a fila comercial.`,
            section: "commercial" as const,
          },
        ]
      : []),
    ...(unknown
      ? [
          {
            title: `${unknown} contatos sem canal confirmado`,
            text: "A ausência de origem reduz a leitura de aquisição. Contatos antigos podem ter histórico parcial.",
            section: "marketing" as const,
          },
        ]
      : []),
    ...(!data.goals.length
      ? [
          {
            title: "Meta do mês ainda não cadastrada",
            text: "Defina o objetivo para acompanhar ritmo e atingimento.",
            section: "goals" as const,
          },
        ]
      : []),
  ].slice(0, 3);
  const unitTable =
    channel !== "all" || campaign ? (
      <p className="text-xs text-[var(--text-tertiary)]">
        Limpe os filtros de canal e campanha para comparar os resultados entre
        unidades.
      </p>
    ) : (
      <section className={`${panel} overflow-hidden`}>
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold">Resultado por unidade</h2>
          <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
            Clique na unidade para filtrar o painel. Resultados confirmados no
            Studio.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[var(--bg-surface-2)] text-left text-[var(--text-tertiary)]">
              <tr>
                {[
                  "Unidade",
                  "Primeiros contatos",
                  "Atendimentos",
                  outcome,
                  "Conversão observável",
                ].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-5 py-3 font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.unit_segments ?? {})
                .sort((a, b) => b[1].total - a[1].total)
                .map(([unit, v]) => (
                  <tr key={unit} className="border-t border-[var(--border)]">
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => onUnit?.(unit)}
                        className="whitespace-nowrap font-semibold text-[var(--accent)]"
                      >
                        {unitLabels[unit] || unit}
                      </button>
                    </td>
                    <td className="px-5 py-4">{v.total}</td>
                    <td className="px-5 py-4">{v.answered}</td>
                    <td className="px-5 py-4">{v.won}</td>
                    <td className="px-5 py-4">{pct(v.won, v.total)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!Object.keys(data.unit_segments ?? {}).length && (
            <p className="p-5 text-xs text-[var(--text-tertiary)]">
              Sem primeiros contatos para a seleção.
            </p>
          )}
        </div>
      </section>
    );
  return (
    <div
      className="space-y-5"
      aria-label={analyticsSections.find((s) => s.id === section)?.label}
    >
      {section === "executive" && (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(240px,1fr)_3fr]">
            <GoalCard
              data={data}
              onOpen={goalDetail}
              onSection={() => onSection?.("goals")}
            />
            {mainKpis}
          </div>
          <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
            <Trend
              data={m}
              previous={previous}
              onDay={(day, value) =>
                open(
                  "Primeiros contatos",
                  num(value),
                  `${scope} · ${date(day)}`,
                )
              }
            />
            <section className={`${panel} p-5`}>
              <h2 className="text-sm font-semibold">O que merece atenção</h2>
              {alertRows.length ? (
                alertRows.map((a) => (
                  <button
                    key={a.title}
                    type="button"
                    onClick={() => onSection?.(a.section)}
                    className="mt-4 block w-full rounded-lg border border-[var(--border)] p-4 text-left hover:bg-[var(--bg-surface-2)]"
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold">
                      <TriangleAlert
                        size={14}
                        className="text-[var(--warning)]"
                      />
                      {a.title}
                    </span>
                    <span className="mt-2 block text-[11px] leading-relaxed text-[var(--text-tertiary)]">
                      {a.text}
                    </span>
                    <span className="mt-3 block text-[11px] font-semibold text-[var(--accent)]">
                      Ver detalhes →
                    </span>
                  </button>
                ))
              ) : (
                <p className="mt-4 text-sm text-[var(--text-tertiary)]">
                  Sem alertas pelos indicadores disponíveis.
                </p>
              )}
            </section>
          </div>
          {unitTable}
        </>
      )}
      {section === "marketing" && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              [
                "Primeiros contatos",
                num(m.total),
                "Origem da mensagem e histórico comprovado",
              ],
              [
                "Canal identificado",
                pct(data.identified, data.total),
                "Cobertura das origens neste período",
              ],
              [
                "Mídia disponível",
                mediaEntries.map(([name]) => name).join(" + ") || "—",
                data.unit === "all"
                  ? "Investimento consultado nas plataformas"
                  : "Custos por unidade dependem de conciliação",
              ],
            ].map(([label, value, text]) => (
              <section key={label} className={`${panel} p-5`}>
                <p className="text-xs text-[var(--text-secondary)]">{label}</p>
                <p className="mt-4 text-3xl font-semibold">{value}</p>
                <p className="mt-3 text-[11px] text-[var(--text-tertiary)]">
                  {text}
                </p>
              </section>
            ))}
          </div>
          <section className={`${panel} overflow-hidden`}>
            <div className="flex flex-wrap items-center gap-4 border-b border-[var(--border)] px-5 py-4">
              <div
                className="flex rounded-lg bg-[var(--bg-surface-2)] p-1"
                role="tablist"
                aria-label="Detalhamento de marketing"
              >
                {[
                  ["channels", "Canais"],
                  ["campaigns", "Campanhas"],
                  ["media", "Mídia paga"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={marketingTab === id}
                    onClick={() => setMarketingTab(id as typeof marketingTab)}
                    className={`rounded-md px-3 py-1.5 text-xs ${marketingTab === id ? "bg-[var(--bg-surface)] font-semibold shadow-sm" : "text-[var(--text-tertiary)]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                WhatsApp e fontes de mídia com definições separadas
              </p>
            </div>
            <div className="overflow-x-auto">
              {marketingTab === "channels"&&unknown>0&&<div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--warning-tint)] px-5 py-4"><p className="text-xs"><strong>{unknown} registros com origem em apuração</strong> · incluídos no total; separados dos canais confirmados.</p><button type="button" onClick={()=>onChannel?.('Origem não identificada')} className="text-xs font-semibold text-[var(--accent)]">Conferir registros →</button></div>}
              {marketingTab === "channels" ? (
                <table className="w-full text-xs">
                  <thead className="bg-[var(--bg-surface-2)] text-left text-[var(--text-tertiary)]">
                    <tr>
                      {[
                        "Canal do contato",
                        "Primeiros contatos",
                        "Participação",
                        "Atendimentos",
                        "Vendas no Studio",
                        "Origem na própria mensagem",
                      ].map((h) => (
                        <th
                          key={h}
                          className="whitespace-nowrap px-5 py-3 font-medium"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {channelRows
                      .sort((a, b) => b[1] - a[1])
                      .map(([c, n]) => (
                        <tr key={c} className="border-t border-[var(--border)]">
                          <td className="px-5 py-4">
                            <button
                              type="button"
                              onClick={() => onChannel(c)}
                              className="flex items-center gap-3 whitespace-nowrap font-semibold text-[var(--accent)]"
                            >
                              <TrackingChannelLogo channel={c} />
                              {c === "Origem não identificada"
                                ? "Origem em apuração"
                                : channelTitle(c)}
                            </button>
                          </td>
                          <td className="px-5 py-4">{n}</td>
                          <td className="min-w-40 px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--border)]">
                                <span
                                  className="block h-full rounded-full bg-[var(--accent)]"
                                  style={{
                                    width: `${(n / Math.max(1, data.total)) * 100}%`,
                                  }}
                                />
                              </span>
                              {pct(n, data.total)}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            {campaign
                              ? m.answered
                              : (data.segments?.[c]?.answered ?? 0)}
                          </td>
                          <td className="px-5 py-4">
                            {campaign ? m.won : (data.segments?.[c]?.won ?? 0)}
                          </td>
                          <td className="px-5 py-4">
                            {campaign
                              ? m.native
                              : (data.segments?.[c]?.native ?? "—")}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              ) : marketingTab === "campaigns" ? (
                <table className="w-full text-xs">
                  <thead className="bg-[var(--bg-surface-2)] text-left text-[var(--text-tertiary)]">
                    <tr>
                      {[
                        "Canal",
                        "Campanha registrada",
                        "Primeiros contatos",
                        "Atendimentos",
                        "Vendas no Studio",
                      ].map((h) => (
                        <th key={h} className="px-5 py-3 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {campaignRows.map((c) => (
                      <tr
                        key={campaignKey(c.channel, c.name)}
                        className="border-t border-[var(--border)]"
                      >
                        <td className="whitespace-nowrap px-5 py-4">
                          {channelTitle(c.channel)}
                        </td>
                        <td className="min-w-56 px-5 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              onCampaign?.(campaignKey(c.channel, c.name))
                            }
                            className="text-left font-semibold text-[var(--accent)]"
                          >
                            {c.name}
                          </button>
                        </td>
                        <td className="px-5 py-4">{c.leads}</td>
                        <td className="px-5 py-4">
                          {c.metrics?.answered ?? 0}
                        </td>
                        <td className="px-5 py-4">{c.metrics?.won ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="space-y-5 p-5">
                  {(["Meta", "Google"] as const).map((platform) => {
                    const report = media[platform],
                      native = data.native_channels?.[platform],
                      ready = report?.status === "ready" && report.totals;
                    return (
                      <section
                        key={platform}
                        className="rounded-lg border border-[var(--border)] p-5"
                      >
                        <h3 className="text-sm font-semibold">
                          {channelTitle(platform)}
                        </h3>
                        {ready ? (
                          <>
                            <div className="mt-4 grid gap-5 sm:grid-cols-4">
                              {[
                                [
                                  "Investimento",
                                  money(report.totals!.spend, report.currency),
                                ],
                                ["Impressões", num(report.totals!.impressions)],
                                [
                                  "Cliques no link",
                                  num(report.totals!.link_clicks),
                                ],
                                [
                                  "CPL rastreado",
                                  data.unit === "all" && native
                                    ? money(
                                        report.totals!.spend / native,
                                        report.currency,
                                      )
                                    : "—",
                                ],
                              ].map(([label, value]) => (
                                <div key={label}>
                                  <p className="text-[11px] text-[var(--text-tertiary)]">
                                    {label}
                                  </p>
                                  <p className="mt-2 text-xl font-semibold">
                                    {value}
                                  </p>
                                </div>
                              ))}
                            </div>
                            <p className="mt-4 text-[11px] text-[var(--text-tertiary)]">
                              CPL usa {native ?? 0} conversas com origem na
                              própria mensagem. Históricos recuperados ficam
                              fora desse custo. O investimento é da conta
                              inteira e não acompanha o filtro de campanha do
                              WhatsApp.
                            </p>
                          </>
                        ) : (
                          <p className="mt-3 text-xs text-[var(--text-tertiary)]">
                            {!report
                              ? "Consultando indicadores…"
                              : report.status === "not_shared"
                                ? "Indicadores de mídia não compartilhados neste acesso."
                                : "A fonte ainda não forneceu indicadores para este período."}
                          </p>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="border-t border-[var(--border)] px-5 py-4 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
              Os canais incluem o histórico comprovado na Kommo. Isso não cria
              um novo clique de anúncio no período. Investimento e campanhas de
              mídia seguem a plataforma de anúncios; correspondências não
              comprovadas ficam sem atribuição.
            </p>
          </section>
        </>
      )}
      {section === "commercial" && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              [
                "Primeiros contatos",
                num(m.total),
                "Coorte definida pela primeira mensagem observada",
              ],
              [
                "Cobertura de atendimento",
                pct(m.answered, m.total),
                "Respostas identificadas e confirmações da equipe",
              ],
              [
                "Conversão observável",
                pct(m.won, m.total),
                "Vendas confirmadas no Studio ÷ primeiros contatos",
              ],
            ].map(([label, value, text]) => (
              <section key={label} className={`${panel} p-5`}>
                <p className="text-xs text-[var(--text-secondary)]">{label}</p>
                <p className="mt-4 text-3xl font-semibold">{value}</p>
                <p className="mt-3 text-[11px] text-[var(--text-tertiary)]">
                  {text}
                </p>
              </section>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className={`${panel} p-5`}>
              <h2 className="text-sm font-semibold">Funil observável</h2>
              <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
                Estado atual dos contatos que entraram no período. Não
                representa todas as etapas do CRM.
              </p>
              <div className="mt-6 space-y-5">
                {[
                  ["Primeiro contato", m.total],
                  ["Atendimento comprovado", m.answered],
                  ["Venda confirmada no Studio", m.won],
                ].map(([label, value]) => (
                  <button
                    type="button"
                    key={label}
                    onClick={() =>
                      open(
                        String(label),
                        num(Number(value)),
                        `Contagem da seleção: ${scope}. Os indicadores usam apenas o histórico capturado pelo Studio.`,
                      )
                    }
                    className="block w-full text-left"
                  >
                    <span className="flex justify-between gap-4 text-xs">
                      <span>{label}</span>
                      <strong>
                        {String(value)} · {pct(Number(value), m.total)}
                      </strong>
                    </span>
                    <span className="mt-2 block h-4 overflow-hidden rounded bg-[var(--bg-surface-2)]">
                      <span
                        className="block h-full rounded bg-[var(--accent)]"
                        style={{
                          width: `${(Number(value) / Math.max(1, m.total)) * 100}%`,
                        }}
                      />
                    </span>
                  </button>
                ))}
              </div>
            </section>
            <section className={`${panel} p-5`}>
              <h2 className="text-sm font-semibold">
                Fila e qualidade do acompanhamento
              </h2>
              <div className="mt-4 divide-y divide-[var(--border)]">
                {[
                  ["Aguardando resposta", m.waiting],
                  ["Com prazo excedido", m.late ?? 0],
                  ["Histórico parcial", m.partial],
                  ["Autoria a revisar", m.review ?? 0],
                  ["Resultados perdidos confirmados", m.lost ?? 0],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between gap-4 py-3 text-sm"
                  >
                    <span className="text-[var(--text-secondary)]">
                      {label}
                    </span>
                    <strong>{String(value)}</strong>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
                Prazo excedido é parte da fila aguardando resposta. Ausência de
                registro não prova ausência de atendimento. Vendas são
                confirmadas pela equipe; não são inferidas do texto.
              </p>
            </section>
          </div>
          {unitTable}
        </>
      )}
      {section === "goals" && (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_2fr]">
            <GoalCard data={data} onOpen={goalDetail} />
            <section className={`${panel} p-6`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent)]">
                Ciclo de acompanhamento
              </p>
              <h2 className="mt-3 font-display text-xl font-semibold">
                Primeiros contatos ·{" "}
                {data.goal_month.split("-").reverse().join("/")}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                Esta meta é de entrada no WhatsApp, definida pela equipe. Uma
                meta de matrícula, serviço fechado ou pedido aprovado exige o
                resultado confirmado na fonte correspondente.
              </p>
              <div className="mt-6 space-y-4 text-xs text-[var(--text-tertiary)]">
                <p>
                  • Realizado: primeiros contatos do mês completo, sem duplicar
                  as mensagens seguintes.
                </p>
                <p>
                  • Esperado: meta mensal distribuída pelos dias corridos do
                  mês.
                </p>
                <p>
                  • Projeção: média diária observada × dias do mês. Não inclui
                  sazonalidade nem campanhas futuras.
                </p>
                <p>
                  • Períodos anteriores ao início da captura impedem uma
                  projeção confiável.
                </p>
              </div>
            </section>
          </div>
          <section className={`${panel} overflow-hidden`}>
            <h2 className="px-5 py-4 text-sm font-semibold">
              Acompanhamento por unidade
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[var(--bg-surface-2)] text-left text-[var(--text-tertiary)]">
                  <tr>
                    {["Unidade", "Meta do mês", "Realizado", "Atingimento"].map(
                      (h) => (
                        <th key={h} className="px-5 py-3 font-medium">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {[...new Set(data.goals.map((g) => g.unit))].map((unit) => {
                    const g = goalProgress({ ...data, unit }, unit);
                    return (
                      <tr
                        key={unit}
                        className="border-t border-[var(--border)]"
                      >
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => onUnit?.(unit)}
                            className="font-semibold text-[var(--accent)]"
                          >
                            {unitLabels[unit] || unit}
                          </button>
                        </td>
                        <td className="px-5 py-4">{g.target}</td>
                        <td className="px-5 py-4">{g.actual}</td>
                        <td className="px-5 py-4">
                          {g.ratio === null
                            ? "—"
                            : `${Math.round(g.ratio * 100)}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!data.goals.length && (
                <p className="p-5 text-sm text-[var(--text-tertiary)]">
                  Nenhuma meta cadastrada neste ciclo. A equipe pode definir o
                  objetivo em Rastreamento → Metas e projeções.
                </p>
              )}
            </div>
          </section>
        </>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-[10px] leading-relaxed text-[var(--text-tertiary)]">
        <span>
          {scope} · WhatsApp: primeiro registro observado. Resultados
          comerciais: confirmações no Studio. Histórico anterior à integração
          pode estar incompleto.
        </span>
        <span className="flex items-center gap-1">
          <ArrowUpRight size={11} />{" "}
          {data.comparison?.coverage_complete
            ? "Comparação com período equivalente disponível"
            : "Sem histórico completo para comparar o período anterior"}
        </span>
      </div>
      {detail && (
        <MetricDialog detail={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}
