import { useState, useMemo } from "react";
import { Loader2, Presentation, Download } from "lucide-react";
import { useClients } from "../hooks/useClients";
import { useAuth } from "../hooks/useAuth";
import { usePresentationTemplate, useClientPresentations } from "../hooks/usePresentationTemplate";
import { isAdminOrCoordenador } from "../lib/permissions";
import { WhatsAppReportComposer } from "./WhatsAppReportComposer";
import { Footer } from "./Footer";
import type { ClientPresentation } from "../lib/database.types";
import { currentMonthLocal } from "../lib/formatters";

// Baixa via blob em vez de só abrir a signed URL: a URL do storage é de
// outro domínio, e o atributo `download` do navegador é ignorado em links
// cross-origin — passando por um blob: URL (mesma origem), o nome do
// arquivo que a gente escolhe é respeitado.
async function triggerDownload(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

function sanitizeFilename(name: string) {
  return name.replace(/[/\\|:*?"<>]/g, "-").replace(/\s+/g, " ").trim();
}

function PresentationTemplateSection() {
  const { profile } = useAuth();
  const { clients } = useClients();
  const { downloadTemplateUrl } = usePresentationTemplate();
  const { items, loading: itemsLoading, createFromTemplate, downloadUrl } = useClientPresentations();

  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [genClientId, setGenClientId] = useState("");
  const [genPeriod, setGenPeriod] = useState(() => currentMonthLocal());
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const canGenerate = isAdminOrCoordenador(profile);
  const activeClients = useMemo(
    () => clients.filter((c) => c.status !== "churned").sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );
  const clientMap = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c.name])), [clients]);

  async function handleDownloadTemplate() {
    setDownloadingTemplate(true);
    const { url, error } = await downloadTemplateUrl();
    if (url) await triggerDownload(url, "ORBE_Modelo_Padrao_Apresentacao_Resultados.pptx");
    setDownloadingTemplate(false);
    if (error) alert(error);
  }

  async function handleGenerate() {
    const client = activeClients.find((c) => c.id === genClientId);
    if (!client || !profile) return;
    setGenerating(true);
    setGenError("");
    const { error } = await createFromTemplate(client, genPeriod, profile.id);
    setGenerating(false);
    if (error) setGenError(error);
  }

  async function handleDownloadCopy(p: ClientPresentation) {
    setDownloadingId(p.id);
    const { url, error } = await downloadUrl(p.storage_path);
    if (url) await triggerDownload(url, `${sanitizeFilename(p.title)}.pptx`);
    setDownloadingId(null);
    if (error) alert(error);
  }

  return (
    <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
      <div className="flex items-start gap-3">
        <div className="rounded-lg p-2" style={{ backgroundColor: "var(--accent-tint)" }}>
          <Presentation size={16} style={{ color: "var(--accent)" }} />
        </div>
        <div>
          <p className="text-xs font-semibold text-[var(--text-primary)]">Modelo de Apresentação de Resultados</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            Use este modelo para apresentar os resultados mensais. Adapte ao cliente e preserve uma cópia de cada fechamento.
          </p>
        </div>
      </div>

      <button
        onClick={handleDownloadTemplate}
        disabled={downloadingTemplate}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all disabled:opacity-40"
        style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}
      >
        {downloadingTemplate ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        Baixar modelo padrão
      </button>

      {canGenerate && (
        <div className="pt-3 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "var(--text-tertiary)" }}>Usar modelo pra um cliente</p>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={genClientId} onChange={(e) => setGenClientId(e.target.value)}
              className="rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none appearance-none min-w-[200px]"
              style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-strong)" }}
            >
              <option value="">Selecione um cliente...</option>
              {activeClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input
              type="month" value={genPeriod} onChange={(e) => setGenPeriod(e.target.value)}
              className="rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
              style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-strong)" }}
            />
            <button
              onClick={handleGenerate}
              disabled={!genClientId || generating}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all disabled:opacity-40"
              style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--accent)", border: "1px solid var(--accent-a44)" }}
            >
              {generating ? <Loader2 size={13} className="animate-spin" /> : <Presentation size={13} />}
              Usar modelo
            </button>
          </div>
          {genError && <p className="text-xs" style={{ color: "var(--danger)" }}>{genError}</p>}
        </div>
      )}

      {!itemsLoading && items.length > 0 && (
        <div className="pt-3 space-y-1.5" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: "var(--text-tertiary)" }}>Cópias geradas</p>
          {items.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 text-xs py-1">
              <div className="min-w-0">
                <p className="text-[var(--text-primary)] font-medium truncate">{p.title}</p>
                <p style={{ color: "var(--text-quaternary)" }}>{clientMap[p.client_id] ?? "—"} · {new Date(p.created_at).toLocaleDateString("pt-BR")}</p>
              </div>
              <button
                onClick={() => handleDownloadCopy(p)}
                disabled={downloadingId === p.id}
                className="flex items-center gap-1 text-[11px] font-semibold flex-shrink-0 disabled:opacity-40"
                style={{ color: "var(--accent)" }}
              >
                {downloadingId === p.id ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                Baixar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RelatoriosView({ embedded = false }: { embedded?: boolean }) {
 return <div className="flex min-h-full flex-col"><div className={`mx-auto w-full max-w-5xl flex-1 space-y-6 ${embedded ? '' : 'px-4 py-8 sm:px-8'}`}>
  {!embedded && <header><h1 className="font-display text-2xl font-semibold">Relatórios no WhatsApp</h1><p className="mt-2 text-sm text-[var(--text-tertiary)]">Prepare o fechamento por cliente e revise a mensagem antes de compartilhar.</p></header>}
  <WhatsAppReportComposer/>
  <details className="rounded-2xl border border-[var(--border)] p-4"><summary className="cursor-pointer text-xs text-[var(--text-secondary)]">Apresentações de resultados · histórico e modelo</summary><div className="mt-4"><PresentationTemplateSection/></div></details>
 </div>{!embedded&&<Footer/>}</div>
}
