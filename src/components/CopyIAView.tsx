import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useWorkspaceClient } from "../hooks/useWorkspaceClient";
import { WorkspaceClientPicker } from "./WorkspaceClientPicker";
import { Footer } from "./Footer";
import { safeSourceUrl } from "../lib/safeSourceUrl";
import {
  BRIEF_LABELS,
  COPY_PLATFORMS,
  type CopyBrief,
  type CopyBriefResponse,
  type CopyCatalog,
  type CopyOutput,
  type CopyPlatform,
  type CopySource,
} from "../../supabase/functions/orbe-ai-chat/copy-contract";

const input =
  "mt-1.5 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50";
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] px-3 py-2 text-xs font-medium hover:bg-[var(--bg-surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40";
const panel =
  "rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 sm:p-6";
async function call<T>(
  body: Record<string, unknown>,
  signal: AbortSignal,
  endpoint = "orbe-ai-chat",
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Entre novamente no Studio para continuar.");
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`,
    {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(
        endpoint === "orbe-ai-chat" ? { feature: "neuro_copy", ...body } : body,
      ),
    },
  );
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error || "Não foi possível concluir. Tente novamente.",
    );
  return result as T;
}
function Sources({ sources }: { sources: CopySource[] }) {
  const seen = new Set<string>();
  return (
    <details className="mt-4 text-xs text-[var(--text-tertiary)]">
      <summary className="cursor-pointer">
        Documentos consultados no Drive
      </summary>
      <ul className="mt-3 space-y-2">
        {sources
          .filter((s) => {
            const key = s.url || s.id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map((s) => (
            <li key={s.id} className="break-words">
              {s.url && safeSourceUrl(s.url) ? (
                <a
                  className="inline-flex items-start gap-1 text-[var(--accent)] underline"
                  href={safeSourceUrl(s.url)!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {s.title.replace(/ · parte \d+\/\d+$/, "")}
                  <ExternalLink size={12} className="shrink-0" />
                </a>
              ) : (
                s.title
              )}
            </li>
          ))}
      </ul>
    </details>
  );
}
function Warnings({ values }: { values: string[] }) {
  return values.length ? (
    <ul className="mt-4 list-disc space-y-1 rounded-xl bg-[var(--warning-tint)] py-3 pl-7 pr-3 text-xs leading-relaxed text-[var(--text-secondary)]">
      {values.map((v, i) => (
        <li key={i}>{v}</li>
      ))}
    </ul>
  ) : null;
}
function CopyWorkspace({ clientId }: { clientId: string }) {
  const [catalog, setCatalog] = useState<CopyCatalog | null>(null);
  const [campaignId, setCampaignId] = useState("");
  const [briefData, setBriefData] = useState<CopyBriefResponse | null>(null);
  const [brief, setBrief] = useState<CopyBrief | null>(null);
  const [offerChoice, setOfferChoice] = useState("");
  const [platform, setPlatform] = useState<CopyPlatform>("meta");
  const [tone, setTone] = useState("Profissional e próximo");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState("Carregando campanhas…");
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<
    (CopyOutput & { campaign: string }) | null
  >(null);
  const [copied, setCopied] = useState("");
  const [revision, setRevision] = useState(0);
  const request = useRef<AbortController | null>(null);
  const syncRequest = useRef<AbortController | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    void call<CopyCatalog>(
      { action: "catalog", client_id: clientId },
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setCatalog(data);
          setBusy("");
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError((err as Error).message);
          setBusy("");
        }
      });
    return () => {
      controller.abort();
      request.current?.abort();
      syncRequest.current?.abort();
    };
  }, [clientId, revision]);

  function resetReview() {
    setConfirmed(false);
    setResult(null);
    setCopied("");
  }
  async function chooseCampaign(id: string) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const version = ++generation.current;
    setCampaignId(id);
    setBrief(null);
    setBriefData(null);
    setOfferChoice("");
    resetReview();
    setError("");
    if (!id) {
      setBusy("");
      return;
    }
    setBusy("Lendo a campanha e preparando o briefing…");
    try {
      const data = await call<CopyBriefResponse>(
        { action: "brief", client_id: clientId, campaign_id: id },
        controller.signal,
      );
      if (controller.signal.aborted || version !== generation.current) return;
      setBriefData(data);
      setBrief(data.brief);
      if (data.offers.length === 1) {
        setOfferChoice("0");
        setBrief({
          ...data.brief,
          offer: data.offers[0].offer,
          product: data.offers[0].product || data.brief.product,
        });
      }
    } catch (err) {
      if (!controller.signal.aborted) setError((err as Error).message);
    } finally {
      if (!controller.signal.aborted && version === generation.current)
        setBusy("");
    }
  }
  function edit(key: keyof CopyBrief, value: string) {
    if (!brief) return;
    setBrief({ ...brief, [key]: value });
    resetReview();
  }
  async function generate() {
    if (!brief || !confirmed || busy) return;
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    const version = ++generation.current;
    setBusy("Neuro Copywriter está criando sua copy…");
    setError("");
    setResult(null);
    setCopied("");
    try {
      const data = await call<CopyOutput>(
        {
          action: "generate",
          client_id: clientId,
          campaign_id: campaignId,
          brief,
          platform,
          tone,
          confirmed,
        },
        controller.signal,
      );
      if (!controller.signal.aborted && version === generation.current)
        setResult({
          ...data,
          campaign:
            catalog?.campaigns.find((c) => c.id === campaignId)?.label ||
            campaignId,
        });
    } catch (err) {
      if (!controller.signal.aborted) setError((err as Error).message);
    } finally {
      if (!controller.signal.aborted && version === generation.current)
        setBusy("");
    }
  }
  async function syncDrive() {
    request.current?.abort();
    ++generation.current;
    setBusy("");
    setSyncing(true);
    setError("");
    setSyncStatus("Buscando alterações no Drive…");
    setCampaignId("");
    setBrief(null);
    setBriefData(null);
    resetReview();
    const controller = new AbortController();
    syncRequest.current = controller;
    try {
      for (let batch = 0; batch < 600; batch++) {
        const progress = await call<{
          complete: boolean;
          synced?: number;
          scanned?: number;
        }>(
          { client_id: clientId, batch: true },
          controller.signal,
          "orbe-drive-sync",
        );
        if (controller.signal.aborted) return;
        setSyncStatus(
          `${progress.synced ?? 0} documentos sincronizados · ${progress.scanned ?? 0} encontrados`,
        );
        if (progress.complete) {
          setSyncStatus("Drive atualizado.");
          setRevision((v) => v + 1);
          return;
        }
      }
      throw new Error(
        "A sincronização continua pendente. Clique novamente em Atualizar do Drive para retomar.",
      );
    } catch (err) {
      if (!controller.signal.aborted) {
        setError((err as Error).message);
        setSyncStatus(
          "Sincronização pendente. Você pode retomar pelo mesmo botão.",
        );
      }
    } finally {
      if (!controller.signal.aborted) setSyncing(false);
    }
  }
  function cancelSync() {
    syncRequest.current?.abort();
    setSyncing(false);
    setSyncStatus(
      "Atualização pausada. Clique em Atualizar do Drive para retomar.",
    );
    setRevision((v) => v + 1);
  }
  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
    } catch {
      setError(
        "O navegador não permitiu copiar. Selecione o texto e copie manualmente.",
      );
    }
  }
  const multipleOffers = (briefData?.offers.length ?? 0) > 1;
  const ready =
    !!brief?.product.trim() &&
    !!brief?.offer.trim() &&
    !!brief?.audience.trim() &&
    !!brief?.objective.trim() &&
    (!multipleOffers || !!offerChoice);
  return (
    <>
      <section className={panel} aria-label="Campanha do cliente">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold">
              1. Escolha a campanha
            </h2>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              Campanhas e documentos de campanha da pasta deste cliente,
              conforme seu acesso.
            </p>
          </div>
          <button
            type="button"
            className={button}
            disabled={syncing || !catalog?.configured}
            onClick={() => void syncDrive()}
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            Atualizar do Drive
          </button>
        </div>
        <label className="mt-5 block text-xs text-[var(--text-secondary)]">
          Campanha do Drive
          <select
            className={input}
            value={campaignId}
            disabled={!catalog || syncing}
            onChange={(e) => void chooseCampaign(e.target.value)}
          >
            <option value="">Selecione uma campanha</option>
            {catalog?.campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} · {c.documentCount} doc.
              </option>
            ))}
          </select>
        </label>
        {catalog?.syncedAt && (
          <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
            Base sincronizada em{" "}
            {new Date(catalog.syncedAt).toLocaleString("pt-BR")}. Ano não
            informado no Drive aparece como “a confirmar”.
          </p>
        )}
        {catalog && !catalog.configured && (
          <p role="status" className="mt-4 text-sm">
            Configure a pasta deste cliente em Clientes → Conhecimento e
            sincronize o Drive.
          </p>
        )}
        {catalog?.configured && !catalog.campaigns.length && (
          <p role="status" className="mt-4 text-sm">
            Nenhum documento de campanha acessível foi indexado. Atualize o
            Drive; documentos restritos continuam dependendo da sua permissão.
          </p>
        )}
        {syncStatus && (
          <p
            role="status"
            className="mt-3 text-xs text-[var(--text-secondary)]"
          >
            {syncStatus}
          </p>
        )}
        {syncing && (
          <button
            type="button"
            className={`${button} mt-3`}
            onClick={cancelSync}
          >
            Pausar atualização
          </button>
        )}
        {catalog?.campaigns.find((c) => c.id === campaignId) && (
          <p className="mt-3 break-words text-xs text-[var(--text-tertiary)]">
            Pasta/documento:{" "}
            {catalog.campaigns.find((c) => c.id === campaignId)!.path}
          </p>
        )}
      </section>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[var(--danger)] bg-[var(--danger-tint)] p-4 text-sm"
        >
          <p>{error}</p>
          {!brief && !busy && !syncing && (
            <button
              className={`${button} mt-3`}
              onClick={() =>
                campaignId
                  ? void chooseCampaign(campaignId)
                  : setRevision((v) => v + 1)
              }
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}
      {busy && (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"
        >
          <Loader2 size={17} className="animate-spin" />
          {busy}
        </p>
      )}
      {brief && briefData && (
        <section className={panel}>
          <h2 className="font-display text-lg font-semibold">
            2. Confira o briefing
          </h2>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            Preenchido pelo Neuro Copywriter a partir dos documentos. Corrija
            hipóteses e complete os campos pendentes antes de confirmar.
          </p>
          {!!briefData.offers.length && (
            <label className="mt-5 block text-xs text-[var(--text-secondary)]">
              {multipleOffers
                ? "Escolha uma oferta / unidade para esta copy"
                : "Oferta encontrada"}
              <select
                className={input}
                disabled={!!busy}
                value={offerChoice}
                onChange={(e) => {
                  const choice = e.target.value;
                  setOfferChoice(choice);
                  const offer = choice
                    ? briefData.offers[Number(choice)]
                    : null;
                  setBrief({
                    ...brief,
                    offer: offer?.offer || "",
                    product: offer?.product || "",
                  });
                  resetReview();
                }}
              >
                <option value="">Selecione a oferta</option>
                {briefData.offers.map((o, i) => (
                  <option key={i} value={String(i)}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {(
              Object.entries(BRIEF_LABELS) as Array<[keyof CopyBrief, string]>
            ).map(([key, label]) => (
              <label
                key={key}
                className={`block text-xs text-[var(--text-secondary)] ${key === "offer" ? "md:col-span-2" : ""}`}
              >
                {label}
                {["product", "offer", "objective", "audience"].includes(key) &&
                  " *"}
                <textarea
                  rows={key === "offer" ? 4 : 3}
                  maxLength={5000}
                  disabled={!!busy}
                  className={`${input} resize-y`}
                  value={brief[key]}
                  placeholder="Não identificado nas fontes — preencha ou confirme com o cliente."
                  onChange={(e) => edit(key, e.target.value)}
                />
              </label>
            ))}
          </div>
          <Warnings values={briefData.warnings} />
          <Sources sources={briefData.sources} />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-[var(--text-secondary)]">
              Plataforma
              <select
                className={input}
                disabled={!!busy}
                value={platform}
                onChange={(e) => {
                  setPlatform(e.target.value as CopyPlatform);
                  resetReview();
                }}
              >
                {Object.entries(COPY_PLATFORMS).map(([key, p]) => (
                  <option key={key} value={key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-[var(--text-secondary)]">
              Tom de voz
              <select
                className={input}
                disabled={!!busy}
                value={tone}
                onChange={(e) => {
                  setTone(e.target.value);
                  resetReview();
                }}
              >
                {[
                  "Profissional e próximo",
                  "Casual e acolhedor",
                  "Inspirador",
                  "Educativo",
                  "Urgente, somente com prazo real",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-6 flex items-start gap-3 text-xs leading-relaxed text-[var(--text-secondary)]">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
              checked={confirmed}
              disabled={!ready || !!busy}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Revisei produto, oferta, unidade, público e validade para esta
            campanha. Confirmo o briefing acima.
          </label>
          {!ready && (
            <p className="mt-2 text-xs text-[var(--text-tertiary)]">
              Preencha produto, oferta, objetivo e público-alvo
              {multipleOffers ? " e escolha a oferta/unidade" : ""} para
              confirmar.
            </p>
          )}
          <button
            type="button"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!ready || !confirmed || !!busy || syncing}
            onClick={() => void generate()}
          >
            <Sparkles size={16} />
            {result ? "Gerar outra versão" : "Gerar copy"}
          </button>
        </section>
      )}
      {result && (
        <section className={panel} aria-label="Copy gerada">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">
                {COPY_PLATFORMS[result.platform].label}
              </h2>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                {result.campaign} · Rascunho para revisão
              </p>
            </div>
            <button
              className={button}
              onClick={() =>
                void copy(
                  Object.entries(result.fields)
                    .map(([k, v]) => `${k}:\n${v}`)
                    .join("\n\n"),
                  "all",
                )
              }
            >
              {copied === "all" ? <Check size={14} /> : <Copy size={14} />}{" "}
              {copied === "all" ? "Copiado" : "Copiar tudo"}
            </button>
          </div>
          <div className="mt-5 space-y-5">
            {Object.entries(result.fields).map(([key, value]) => (
              <article
                key={key}
                className="rounded-xl bg-[var(--bg-surface-2)] p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold text-[var(--text-secondary)]">
                    {key}
                    {result.platform === "google" && (
                      <span className="ml-2 font-normal">
                        {[...value].length}/
                        {key.startsWith("Headline") ? 30 : 90}
                      </span>
                    )}
                  </h3>
                  <button
                    aria-label={`Copiar ${key}`}
                    className={button}
                    onClick={() => void copy(value, key)}
                  >
                    {copied === key ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {value}
                </p>
              </article>
            ))}
          </div>
          <Warnings values={result.warnings} />
          <Sources sources={result.sources} />
          <p className="mt-4 text-xs text-[var(--text-tertiary)]">
            A geração não publica anúncios nem envia mensagens.
          </p>
        </section>
      )}
    </>
  );
}
export function CopyIAView() {
  const { clients, selected, selectClient, clientId, loading } =
    useWorkspaceClient();
  return (
    <div className="flex min-h-full min-w-0 flex-col">
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-8">
        <header>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--accent-tint)] px-3 py-1.5 text-xs font-medium text-[var(--accent)]">
            <Sparkles size={14} />
            Neuro Copywriter · Anthropic
          </div>
          <h1 className="font-display text-2xl font-semibold">Copy IA</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-tertiary)]">
            A voz do cliente, a oferta da campanha e uma copy pensada para cada
            plataforma. Selecione o cliente para começar.
          </p>
        </header>
        <WorkspaceClientPicker
          clients={clients}
          selected={clientId}
          onChange={selectClient}
        />
        {selected ? (
          <CopyWorkspace key={selected.id} clientId={selected.id} />
        ) : (
          <p
            role="status"
            className={`${panel} text-sm text-[var(--text-tertiary)]`}
          >
            {loading
              ? "Carregando clientes…"
              : "Selecione um cliente para carregar as campanhas do Drive."}
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}
