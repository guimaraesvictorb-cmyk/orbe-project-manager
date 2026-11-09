import { useEffect, useId, useRef, useState } from "react";
import {
  BarChart3,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  Eye,
  LogOut,
  Megaphone,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  Target,
  Users,
  Maximize2,
  X,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { supabase } from "../lib/supabase";
import {
  analyticsSections,
  campaignKey,
  type AnalyticsSection,
  unitLabels,
} from "../lib/clientAnalytics";
import { biChannels, channelTitle } from "../lib/biDashboard";
import { presetPeriod, type ReportPeriod } from "../lib/reportPeriod";
import type { ClientDashboardData, SharedMedia } from "../lib/sharedDashboard";
import { ReportPeriodPicker } from "./ReportPeriodPicker";
import { ClientAnalyticsPanels } from "./ClientAnalyticsPanels";
import {ClientGoalsEditor} from "./ClientGoalsEditor";
import { OrbeMark } from "./OrbeMark";

const icons = {
  executive: ChartNoAxesCombined,
  marketing: Megaphone,
  commercial: Users,
  goals: Target,
};
const field =
  "mt-1 block min-h-9 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
type Props = {
  token?: string;
  slug?: string;
  clientId?: string;
  embedded?: boolean;
  onAccessExpired?: () => void;
  onLock?: () => void;
  onOpenTracking?: (period: ReportPeriod, unit: string) => void;
  initialPeriod?: ReportPeriod;
  initialUnit?: string;
  initialSection?: AnalyticsSection;
};
export function ClientAnalyticsWorkspace({
  token,
  slug,
  clientId,
  embedded = false,
  onAccessExpired,
  onLock,
  onOpenTracking,
  initialPeriod,
  initialUnit,
  initialSection,
}: Props) {
  const { theme, toggleTheme } = useTheme(),
    prefix = useId(),
    [section, setSection] = useState<AnalyticsSection>(
      initialSection ?? "executive",
    ),
    [collapsed, setCollapsed] = useState(false),
    [preview, setPreview] = useState(false),
    [period, setPeriod] = useState<ReportPeriod>(
      () => initialPeriod ?? presetPeriod("month"),
    ),
    [unit, setUnit] = useState(initialUnit ?? "all"),
    [channel, setChannel] = useState("all"),
    [campaign, setCampaign] = useState(""),
    [revision, setRevision] = useState(0),
    [snapshot, setSnapshot] = useState<{
      key: string;
      data?: ClientDashboardData;
      error?: string;
    }>(),
    [mediaState, setMediaState] = useState<{
      key: string;
      data: Partial<Record<"Meta" | "Google", SharedMedia>>;
    }>();
  const identity = clientId || slug || token || "",
    key = JSON.stringify([identity, period.start, period.end, unit, revision]),
    current = snapshot?.key === key ? snapshot : undefined,
    mediaKey = JSON.stringify([identity, period.start, period.end, revision]),
    media = mediaState?.key === mediaKey ? mediaState.data : {},
    needsMedia = section === "executive" || section === "marketing";
  const data = current?.data,
    active = analyticsSections.find((s) => s.id === section)!,
    isWorkspace = !!clientId;
  useEffect(() => {
    if (embedded) return;
    const previousTitle = document.title;
    document.title = "BI do cliente · ORBE Studio";
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex,nofollow,noarchive";
    document.head.append(robots);
    return () => {
      robots.remove();
      document.title = previousTitle;
    };
  }, [embedded]);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (clientId) {
          const { data } = await supabase.auth.getSession();
          if (!data.session)
            throw Error("Sua sessão expirou. Entre novamente.");
          headers.Authorization = `Bearer ${data.session.access_token}`;
        }
        if (controller.signal.aborted) return;
        const r = await fetch("/api/client-dashboard", {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: clientId ? "workspace_view" : "view",
            ...(clientId
              ? { client_id: clientId }
              : slug
                ? { slug }
                : { token }),
            ...period,
            unit,
          }),
          signal: controller.signal,
        });
        if (r.status === 401 && onAccessExpired) {
          onAccessExpired();
          return;
        }
        const body = await r.json();
        if (!r.ok)
          throw Error(
            r.status === 404
              ? "Este painel está indisponível. Solicite o endereço atualizado à equipe."
              : r.status === 403
                ? "Seu acesso a este cliente não está disponível."
                : body.error === "invalid_period"
                  ? "Escolha um período válido de até 93 dias."
                  : "Não foi possível atualizar os indicadores. Tente novamente.",
          );
        if (!controller.signal.aborted) setSnapshot({ key, data: body });
      } catch (e) {
        if (!controller.signal.aborted)
          setSnapshot({
            key,
            error:
              e instanceof Error && !(e instanceof SyntaxError)
                ? e.message
                : "Não foi possível carregar o BI.",
          });
      }
    })();
    return () => controller.abort();
  }, [key, clientId, slug, token, period, unit, onAccessExpired]);
  useEffect(() => {
    if (!data || !needsMedia || mediaState?.key === mediaKey) return;
    const controller = new AbortController();
    void (async () => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (clientId) {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      const reports = await Promise.allSettled(
        (["Meta", "Google"] as const).map(async (platform) => {
          const r = await fetch("/api/client-dashboard", {
            method: "POST",
            headers,
            body: JSON.stringify({
              action: clientId ? "workspace_media" : "media",
              ...(clientId
                ? { client_id: clientId }
                : slug
                  ? { slug }
                  : { token }),
              ...period,
              platform: platform.toLowerCase(),
            }),
            signal: controller.signal,
          });
          if (r.status === 401 && onAccessExpired) {
            onAccessExpired();
            return { status: "unavailable" };
          }
          const body = await r.json();
          return r.ok ? (body as SharedMedia) : { status: "unavailable" };
        }),
      );
      if (!controller.signal.aborted)
        setMediaState({
          key: mediaKey,
          data: {
            Meta:
              reports[0].status === "fulfilled"
                ? reports[0].value
                : { status: "unavailable" },
            Google:
              reports[1].status === "fulfilled"
                ? reports[1].value
                : { status: "unavailable" },
          },
        });
    })().catch(() => {
      if (!controller.signal.aborted)
        setMediaState({
          key: mediaKey,
          data: {
            Meta: { status: "unavailable" },
            Google: { status: "unavailable" },
          },
        });
    });
    return () => controller.abort();
  }, [
    data,
    needsMedia,
    mediaKey,
    mediaState?.key,
    clientId,
    slug,
    token,
    period,
    onAccessExpired,
  ]);
  function chooseChannel(value: string) {
    setChannel(value);
    setCampaign("");
  }
  function chooseUnit(value: string) {
    setUnit(value);
    setCampaign("");
  }
  function choosePeriod(value: ReportPeriod) {
    setPeriod(value);
    setCampaign("");
  }
  const visibleCampaigns =
      data?.campaigns.filter(
        (c) => channel === "all" || c.channel === channel,
      ) ?? [],
    channels = [
      ...new Set([...biChannels, ...Object.keys(data?.channels ?? {})]),
    ],
    hasUnits =
      unit !== "all" ||
      Object.entries(data?.units ?? {}).some(
        ([key, value]) => key !== "unassigned" && value > 0,
      );
  const side = (
    <aside
      className={`client-bi-sidebar flex flex-col bg-[var(--bi-nav-bg)] text-[var(--bi-nav-text)] ${embedded ? "hidden" : collapsed ? "w-16 lg:w-20" : "w-16 lg:w-60"} shrink-0 transition-[width] duration-200`}
      aria-label="Navegação do BI do cliente"
    >
      <div className="flex min-h-20 items-center gap-3 border-b border-white/10 px-4 py-5">
        {data?.client.logo ? (
          <img
            src={data.client.logo}
            alt={data.client.name}
            decoding="async"
            className="h-9 w-9 shrink-0 rounded-lg bg-white/10 object-contain p-1"
          />
        ) : (
          <BarChart3 size={25} className="shrink-0" />
        )}
        {!collapsed && (
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-sm font-semibold">
              {data?.client.name || "Seu negócio"}
            </p>
            <p className="mt-0.5 text-[9px] uppercase tracking-[.2em] opacity-70">
              Analytics · ORBE
            </p>
          </div>
        )}
      </div>
      <nav className="space-y-1 px-2 py-4" aria-label="Visões do cliente">
        {analyticsSections.map((s) => {
          const Icon = icons[s.id];
          return (
            <button
              type="button"
              key={s.id}
              title={s.label}
              aria-label={s.label}
              aria-current={section === s.id ? "page" : undefined}
              onClick={() => setSection(s.id)}
              className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-xs transition-colors ${section === s.id ? "bg-white/15 font-semibold" : "opacity-75 hover:bg-white/10 hover:opacity-100"}`}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && (
                <span className="hidden lg:inline">{s.label}</span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto space-y-2 border-t border-white/10 p-3">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expandir menu do BI" : "Recolher menu do BI"}
          className="hidden min-h-10 w-full items-center gap-3 rounded-lg px-2 text-xs opacity-75 hover:bg-white/10 lg:flex"
        >
          {collapsed ? (
            <ChevronRight size={17} />
          ) : (
            <>
              <ChevronLeft size={17} />
              <span>Recolher menu</span>
            </>
          )}
        </button>
        <div className="flex items-center gap-3 px-2 py-2">
          <OrbeMark size={20} />
          {!collapsed && (
            <span className="hidden text-[10px] opacity-70 lg:block">
              Inteligência para decisões
            </span>
          )}
        </div>
      </div>
    </aside>
  );
  return (
    <div
      className={`client-bi text-[var(--text-primary)] ${embedded ? "overflow-hidden rounded-2xl border border-[var(--border)]" : "flex min-h-screen bg-[var(--bi-canvas)]"}`}
    >
      {side}
      <div
        className={`min-w-0 flex-1 ${embedded ? "bg-[var(--bi-canvas)]" : ""}`}
      >
        <header className="border-b border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-5 sm:px-6">
            <div className="flex items-start gap-3">
              <span className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                0{analyticsSections.findIndex((s) => s.id === section) + 1}
              </span>
              <div>
                <h1 className="font-display text-lg font-semibold">
                  {active.label}
                  {embedded && (
                    <span className="ml-3 text-xs font-normal text-[var(--text-tertiary)]">
                      BI do cliente
                    </span>
                  )}
                </h1>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {active.question}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {embedded && clientId && (
                <button
                  type="button"
                  onClick={() => setPreview(true)}
                  aria-label="Abrir BI do cliente em tela cheia"
                  title="Prévia em tela cheia"
                  className="rounded-lg border border-[var(--border)] p-2 text-[var(--text-secondary)]"
                >
                  <Maximize2 size={16} />
                </button>
              )}
              <span className="hidden items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-[10px] text-[var(--text-secondary)] sm:flex">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${data ? "bg-[var(--success)]" : "bg-[var(--text-tertiary)]"}`}
                />
                {data
                  ? `Atualizado às ${new Date(data.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}`
                  : "Consultando indicadores"}
              </span>
              <button
                type="button"
                onClick={() => setRevision((v) => v + 1)}
                aria-label="Atualizar indicadores do cliente"
                className="rounded-lg border border-[var(--border)] p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)]"
              >
                <RefreshCw
                  size={16}
                  className={!current ? "animate-spin" : ""}
                />
              </button>
              {!embedded && (
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={
                    theme === "dark" ? "Usar tema claro" : "Usar tema escuro"
                  }
                  className="rounded-lg p-2 text-[var(--text-secondary)]"
                >
                  {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                </button>
              )}
              {onLock && (
                <button
                  type="button"
                  onClick={onLock}
                  aria-label="Encerrar acesso ao painel"
                  className="rounded-lg p-2 text-[var(--text-secondary)]"
                >
                  <LogOut size={17} />
                </button>
              )}
            </div>
          </div>
          {embedded && (
            <nav
              aria-label="Visões de inteligência do cliente"
              className="flex gap-1 overflow-x-auto border-t border-[var(--border)] px-4 py-2 sm:px-6"
            >
              {analyticsSections.map((s) => {
                const Icon = icons[s.id];
                return (
                  <button
                    type="button"
                    key={s.id}
                    aria-pressed={section === s.id}
                    onClick={() => setSection(s.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-xs ${section === s.id ? "bg-[var(--accent-tint)] font-semibold text-[var(--accent)]" : "text-[var(--text-tertiary)] hover:bg-[var(--bg-surface-2)]"}`}
                  >
                    <Icon size={14} />
                    {s.label}
                  </button>
                );
              })}
            </nav>
          )}
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3 px-4 pb-4 sm:px-6">
            <ReportPeriodPicker
              {...period}
              maxDays={93}
              onChange={choosePeriod}
            />
            {hasUnits && (
              <label
                htmlFor={`${prefix}-unit`}
                className="min-w-36 text-[10px] text-[var(--text-tertiary)]"
              >
                Unidade
                <select
                  id={`${prefix}-unit`}
                  aria-label="Unidade do BI"
                  value={unit}
                  onChange={(e) => chooseUnit(e.target.value)}
                  className={field}
                >
                  {Object.entries(unitLabels).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {section !== "goals" && (
              <>
                <label
                  htmlFor={`${prefix}-channel`}
                  className="min-w-36 text-[10px] text-[var(--text-tertiary)]"
                >
                  Canal
                  <select
                    id={`${prefix}-channel`}
                    aria-label="Canal do BI"
                    value={channel}
                    onChange={(e) => chooseChannel(e.target.value)}
                    className={field}
                  >
                    <option value="all">Todos os canais</option>
                    {channels.map((c) => (
                      <option key={c} value={c}>
                        {c === "Origem não identificada"
                          ? "Origem em apuração"
                          : channelTitle(c)}
                      </option>
                    ))}
                  </select>
                </label>
                <label
                  htmlFor={`${prefix}-campaign`}
                  className="min-w-36 max-w-72 text-[10px] text-[var(--text-tertiary)]"
                >
                  Campanha
                  <select
                    id={`${prefix}-campaign`}
                    aria-label="Campanha do BI"
                    value={campaign}
                    onChange={(e) => setCampaign(e.target.value)}
                    className={field}
                  >
                    <option value="">Todas as campanhas</option>
                    {visibleCampaigns.map((c) => (
                      <option
                        key={campaignKey(c.channel, c.name)}
                        value={campaignKey(c.channel, c.name)}
                      >
                        {c.name} · {channelTitle(c.channel)}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {(unit !== "all" || channel !== "all" || campaign) && (
              <button
                type="button"
                onClick={() => {
                  setUnit("all");
                  setChannel("all");
                  setCampaign("");
                }}
                className="min-h-9 text-xs font-semibold text-[var(--accent)]"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </header>
        <main className="space-y-5 p-4 sm:p-6">
          {embedded&&clientId&&section==="goals"&&<ClientGoalsEditor key={`${clientId}:${data?.goal_month||period.end.slice(0,7)}`} clientId={clientId} month={data?.goal_month||period.end.slice(0,7)} onSaved={()=>setRevision(v=>v+1)}/>}
          {!current ? (
            <div
              role="status"
              className="min-h-80 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6"
            >
              <p className="text-sm text-[var(--text-tertiary)]">
                Carregando os indicadores deste cliente…
              </p>
              <div className="mt-6 grid animate-pulse gap-4 sm:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div
                    key={n}
                    className="h-32 rounded-lg bg-[var(--bg-surface-2)]"
                  />
                ))}
              </div>
            </div>
          ) : current.error ? (
            <section
              role="alert"
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6"
            >
              <h2 className="font-semibold">
                Não foi possível abrir os indicadores
              </h2>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                {current.error}
              </p>
              <button
                type="button"
                onClick={() => setRevision((v) => v + 1)}
                className="mt-5 text-sm font-semibold text-[var(--accent)]"
              >
                Tentar novamente
              </button>
            </section>
          ) : (
            data && (
              <ClientAnalyticsPanels
                key={`${key}:${channel}:${campaign}`}
                data={data}
                section={section}
                channel={channel}
                onChannel={chooseChannel}
                campaign={campaign}
                onCampaign={setCampaign}
                media={media}
                onSection={setSection}
                onUnit={chooseUnit}
              />
            )
          )}
          <footer className="flex flex-wrap items-center justify-between gap-3 text-[10px] text-[var(--text-tertiary)]">
            <span className="flex items-center gap-2">
              {isWorkspace ? (
                <BarChart3 size={13} />
              ) : (
                <ShieldCheck size={13} />
              )}{" "}
              {isWorkspace
                ? "Indicadores da conta · equipe Orbe"
                : "Acesso protegido · somente visualização"}
            </span>
            {onOpenTracking ? (
              <button
                type="button"
                onClick={() => onOpenTracking(period, unit)}
                className="font-semibold text-[var(--accent)]"
              >
                Abrir rastreamento e registros →
              </button>
            ) : (
              <span className="flex items-center gap-2">
                <Eye size={13} /> ORBE Studio · BI do cliente
              </span>
            )}
          </footer>
        </main>
      </div>
      {preview && clientId && (
        <AnalyticsPreview
          clientId={clientId}
          period={period}
          unit={unit}
          section={section}
          onClose={() => setPreview(false)}
        />
      )}
    </div>
  );
}

function AnalyticsPreview({
  clientId,
  period,
  unit,
  section,
  onClose,
}: {
  clientId: string;
  period: ReportPeriod;
  unit: string;
  section: AnalyticsSection;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label="Prévia do BI do cliente"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="client-bi-preview fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none border-0 bg-[var(--bi-canvas)] p-0 text-[var(--text-primary)]"
    >
      <div className="flex h-11 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--bg-surface)] px-5">
        <p className="text-[10px] text-[var(--text-tertiary)]">
          Prévia interna · No link do cliente, a mídia segue as permissões de
          compartilhamento.
        </p>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          aria-label="Fechar prévia do BI"
          className="flex shrink-0 items-center gap-2 text-xs text-[var(--text-secondary)]"
        >
          <X size={15} />
          Fechar prévia
        </button>
      </div>
      <ClientAnalyticsWorkspace
        clientId={clientId}
        initialPeriod={period}
        initialUnit={unit}
        initialSection={section}
      />
    </dialog>
  );
}
