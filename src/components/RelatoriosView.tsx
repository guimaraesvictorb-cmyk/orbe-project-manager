import { useState, useMemo } from "react";
import { FileText, Sparkles, Loader2, Printer, RefreshCw, Presentation, Download } from "lucide-react";
import { useClients } from "../hooks/useClients";
import { useClientAdsMetrics } from "../hooks/useClientAdsMetrics";
import { useTasks } from "../hooks/useTasks";
import { useAuth } from "../hooks/useAuth";
import { usePresentationTemplate, useClientPresentations } from "../hooks/usePresentationTemplate";
import { isAdminOrCoordenador } from "../lib/permissions";
import { supabase } from "../lib/supabase";
import { FLAG_META, STATUS_META } from "../lib/clientMeta";
import { Footer } from "./Footer";
import type { Client, ClientPresentation } from "../lib/database.types";
import { fmtCurrency, todayLocal, currentMonthLocal } from "../lib/formatters";

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

function ReportContent({ html }: { html: string }) {
  return (
    <div
      className="prose prose-invert max-w-none text-sm leading-relaxed"
      style={{ color: "var(--text-secondary)" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function ClientReport({ client }: { client: Client }) {
  const { meta, google } = useClientAdsMetrics(client.id);
  const { tasks } = useTasks({ clientId: client.id });
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const today = todayLocal();
  const overdue = tasks.filter((t) => t.deadline && t.deadline < today && t.status !== "concluido" && t.status !== "cancelado");
  const open = tasks.filter((t) => !["concluido", "cancelado"].includes(t.status));
  const done = tasks.filter((t) => t.status === "concluido");

  const latestMeta = meta[0];
  const latestGoogle = google[0];
  const prevMeta = meta[1];
  const prevGoogle = google[1];

  const flag = FLAG_META[client.health_flag];
  const status = STATUS_META[client.status];

  const context = useMemo(() => {
    const lines = [
      `Cliente: ${client.name}`,
      `Segmento: ${client.segment ?? "não informado"}`,
      `Status: ${status.label}`,
      `Saúde: ${flag.label}`,
      `Mensalidade: ${fmtCurrency(client.monthly_fee)}`,
      `Tipo de serviço: ${client.tipo_servico ?? "não informado"}`,
      "",
      "Tarefas:",
      `- Abertas: ${open.length}`,
      `- Concluídas: ${done.length}`,
      `- Atrasadas: ${overdue.length}`,
      overdue.length > 0 ? `- Tarefas atrasadas: ${overdue.map((t) => t.title).join(", ")}` : "",
      "",
    ];

    if (latestMeta) {
      const period = new Date(`${latestMeta.period}-01`).toLocaleString("pt-BR", { month: "long", year: "numeric" });
      lines.push(`Meta Ads (${period}):`, `- Investimento: ${fmtCurrency(latestMeta.investimento)}`, `- Resultados: ${latestMeta.resultados ?? "—"}`, `- Custo/resultado: ${fmtCurrency(latestMeta.custo_por_resultado)}`, `- CTR: ${latestMeta.ctr != null ? latestMeta.ctr + "%" : "—"}`, "");
      if (prevMeta && latestMeta.investimento && prevMeta.investimento) {
        const var_ = (((latestMeta.investimento - prevMeta.investimento) / prevMeta.investimento) * 100).toFixed(1);
        lines.push(`- Variação investimento vs mês anterior: ${var_}%`, "");
      }
    }

    if (latestGoogle) {
      const period = new Date(`${latestGoogle.period}-01`).toLocaleString("pt-BR", { month: "long", year: "numeric" });
      lines.push(`Google Ads (${period}):`, `- Investimento: ${fmtCurrency(latestGoogle.investimento)}`, `- Cliques: ${latestGoogle.cliques ?? "—"}`, `- Conversões: ${latestGoogle.conversoes ?? "—"}`, `- ROAS: ${latestGoogle.roas ?? "—"}`, "");
    }

    return lines.filter((l) => l !== undefined).join("\n");
  }, [client, latestMeta, latestGoogle, prevMeta, prevGoogle, open.length, done.length, overdue]);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const prompt = `Você é um especialista em marketing digital e vai gerar um relatório mensal profissional para o cliente de uma agência.

Dados do cliente:
${context}

Gere um relatório mensal completo e profissional em HTML (apenas o corpo, sem <html>/<head>/<body>). Use:
- <h2> para título principal
- <h3> para seções
- <p> para parágrafos
- <ul><li> para listas
- <strong> para destaques
- <span style="color:var(--accent)"> para números positivos
- <span style="color:var(--danger)"> para alertas

O relatório deve ter:
1. Resumo executivo (2-3 frases)
2. Performance de anúncios (Meta e/ou Google se houver dados)
3. Status operacional (tarefas)
4. Pontos de atenção e recomendações
5. Próximos passos (3-5 ações)

Tom profissional, em português brasileiro. Seja específico com os dados fornecidos.`;

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/orbe-ai-chat`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }], max_tokens: 2048, temperature: 0.4, stream: false }),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();
      setReport(json.choices?.[0]?.message?.content ?? "");
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: flag.bg, color: flag.color }}>{flag.label}</span>
          <span className="text-[11px]" style={{ color: status.color }}>{status.label}</span>
          {client.monthly_fee && <span className="text-[11px]" style={{ color: "var(--accent)" }}>{fmtCurrency(client.monthly_fee)}/mês</span>}
        </div>
        <div className="flex items-center gap-2">
          {report && (
            <button onClick={() => window.print()} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)"; }}>
              <Printer size={12} />Imprimir
            </button>
          )}
          <button onClick={generate} disabled={loading}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
            style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>
            {loading ? <Loader2 size={12} className="animate-spin" /> : report ? <RefreshCw size={12} /> : <Sparkles size={12} />}
            {loading ? "Gerando..." : report ? "Regerar" : "Gerar relatório com IA"}
          </button>
        </div>
      </div>

      {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}

      {!report && !loading && (
        <div className="rounded-xl border border-[var(--border)] py-16 text-center" style={{ backgroundColor: "var(--bg-surface)" }}>
          <FileText size={28} className="mx-auto mb-3" style={{ color: "#222" }} />
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Relatório não gerado</p>
          <p className="text-xs" style={{ color: "var(--text-quaternary)" }}>
            Clique em "Gerar relatório com IA" para criar um relatório completo baseado nos dados do cliente
          </p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-3">
            <Loader2 size={24} className="animate-spin mx-auto" style={{ color: "var(--accent)" }} />
            <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Analisando dados e gerando relatório...</p>
          </div>
        </div>
      )}

      {report && !loading && (
        <div className="rounded-xl border p-6 print:p-0 print:border-0" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
          <ReportContent html={report} />
        </div>
      )}
    </div>
  );
}

export function RelatoriosView() {
  const { clients, loading } = useClients();
  const [selectedId, setSelectedId] = useState<string>("");

  const activeClients = useMemo(() => clients.filter((c) => c.status !== "churned"), [clients]);
  const selected = activeClients.find((c) => c.id === selectedId);

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 max-w-screen-xl mx-auto w-full px-6 py-8 space-y-6">
        <div>
          <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "var(--accent)" }}>Relatórios</p>
          <h2 className="text-[var(--text-primary)] font-bold text-lg leading-tight">Relatório de Cliente</h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            Selecione um cliente para gerar um relatório mensal completo com IA — inclui performance de anúncios, tarefas e recomendações.
          </p>
        </div>

        <PresentationTemplateSection />

        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>Cliente</label>
            <select
              value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
              className="rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none appearance-none min-w-[220px]"
              style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-strong)" }}
            >
              <option value="">Selecione um cliente...</option>
              {loading ? <option disabled>Carregando...</option> : activeClients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {selected && (
            <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              Período: <strong className="text-[var(--text-primary)]">{new Date().toLocaleString("pt-BR", { month: "long", year: "numeric" })}</strong>
            </div>
          )}
        </div>

        {selected ? (
          <ClientReport client={selected} />
        ) : (
          <div className="rounded-xl border border-[var(--border)] py-20 flex flex-col items-center" style={{ backgroundColor: "var(--bg-surface)" }}>
            <FileText size={32} className="mb-3" style={{ color: "#222" }} />
            <p className="text-sm font-semibold text-[var(--text-primary)]">Selecione um cliente acima</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-quaternary)" }}>O relatório será gerado com base nos dados cadastrados</p>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
