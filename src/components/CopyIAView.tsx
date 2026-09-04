import { useState } from "react";
import { Sparkles, Copy, Check, Loader2, RefreshCw } from "lucide-react";
import { GROQ_MODEL, GROQ_API_URL, getGroqApiKey } from "../lib/groq";
import { Footer } from "./Footer";

type Platform = "meta" | "google" | "instagram" | "whatsapp";
type Objective = "conversao" | "trafego" | "engajamento" | "awareness" | "leads";
type Tone = "profissional" | "casual" | "urgente" | "inspirador" | "educativo";

const PLATFORM_META: Record<Platform, { label: string; color: string; bg: string; fields: string[] }> = {
  meta: {
    label: "Meta Ads", color: "#1877F2", bg: "#0a0f1a",
    fields: ["Headline (título)", "Texto principal", "Descrição", "Call to Action"],
  },
  google: {
    label: "Google Ads", color: "#EA4335", bg: "#1a0a0a",
    fields: ["Headline 1", "Headline 2", "Headline 3", "Descrição 1", "Descrição 2"],
  },
  instagram: {
    label: "Instagram", color: "#E1306C", bg: "#1a0a10",
    fields: ["Legenda", "Stories copy", "CTA do stories"],
  },
  whatsapp: {
    label: "WhatsApp", color: "#25D366", bg: "#0a1a0e",
    fields: ["Mensagem de abordagem", "Follow-up", "Mensagem de conversão"],
  },
};

const OBJECTIVE_LABELS: Record<Objective, string> = {
  conversao: "Conversão / Venda", trafego: "Tráfego / Visitas",
  engajamento: "Engajamento", awareness: "Reconhecimento de marca", leads: "Geração de leads",
};

const TONE_LABELS: Record<Tone, string> = {
  profissional: "Profissional", casual: "Casual / Próximo",
  urgente: "Urgente / Escassez", inspirador: "Inspirador / Motivacional", educativo: "Educativo / Informativo",
};

interface CopyResult {
  platform: Platform;
  fields: Record<string, string>;
}

async function generateCopy(
  params: {
    platform: Platform;
    product: string;
    objective: Objective;
    tone: Tone;
    audience: string;
    differentials: string;
  },
  apiKey: string
): Promise<CopyResult> {
  const platMeta = PLATFORM_META[params.platform];
  const fieldsStr = platMeta.fields.map((f, i) => `${i + 1}. ${f}`).join("\n");

  const prompt = `Você é um especialista em copywriting para marketing digital brasileiro. Crie copy de alta conversão.

**Produto/Serviço:** ${params.product}
**Plataforma:** ${platMeta.label}
**Objetivo:** ${OBJECTIVE_LABELS[params.objective]}
**Tom de voz:** ${TONE_LABELS[params.tone]}
**Público-alvo:** ${params.audience || "Geral"}
${params.differentials ? `**Diferenciais:** ${params.differentials}` : ""}

Crie o seguinte copy para ${platMeta.label}:
${fieldsStr}

Responda APENAS em JSON válido, sem markdown, sem texto fora do JSON:
{
${platMeta.fields.map((f) => `  "${f}": "texto aqui"`).join(",\n")}
}

Regras:
- Português brasileiro natural e persuasivo
- ${params.platform === "google" ? "Headlines: máximo 30 caracteres cada. Descrições: máximo 90 caracteres cada." : ""}
- ${params.platform === "meta" ? "Texto principal: 2-3 parágrafos com gancho, benefício e CTA. Headline: até 40 chars." : ""}
- ${params.platform === "instagram" ? "Legenda: use emojis estratégicos, hashtags relevantes no final (5-10)." : ""}
- ${params.platform === "whatsapp" ? "Tom pessoal, sem spam, foco em iniciar conversa." : ""}`;

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
      temperature: 0.8,
    }),
  });

  if (!res.ok) throw new Error(`Erro ${res.status}`);
  const json = await res.json();
  const text: string = json.choices?.[0]?.message?.content ?? "{}";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Resposta inválida da IA");
  const parsed = JSON.parse(match[0]);
  return { platform: params.platform, fields: parsed };
}

function CopyCard({ result, onRegenerate, loading }: { result: CopyResult; onRegenerate: () => void; loading: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);
  const platMeta = PLATFORM_META[result.platform];

  function copyField(key: string, value: string) {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  function copyAll() {
    const all = Object.entries(result.fields).map(([k, v]) => `${k}:\n${v}`).join("\n\n");
    navigator.clipboard.writeText(all);
    setCopied("all");
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--bg-surface-2)", backgroundColor: platMeta.bg }}>
        <span className="text-xs font-bold" style={{ color: platMeta.color }}>{platMeta.label}</span>
        <div className="flex items-center gap-2">
          <button onClick={copyAll} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg transition-colors"
            style={{ color: copied === "all" ? "var(--accent)" : "var(--text-tertiary)", backgroundColor: "var(--bg-surface-2)" }}>
            {copied === "all" ? <Check size={11} /> : <Copy size={11} />}
            {copied === "all" ? "Copiado!" : "Copiar tudo"}
          </button>
          <button onClick={onRegenerate} disabled={loading}
            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40"
            style={{ color: "var(--text-tertiary)", backgroundColor: "var(--bg-surface-2)" }}>
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
            Regerar
          </button>
        </div>
      </div>
      <div className="divide-y" style={{ borderColor: "var(--bg-surface-2)" }}>
        {Object.entries(result.fields).map(([key, value]) => (
          <div key={key} className="px-5 py-4 group">
            <div className="flex items-start justify-between gap-3 mb-1">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-quaternary)" }}>{key}</p>
              <button
                onClick={() => copyField(key, value)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all flex-shrink-0"
                style={{ color: copied === key ? "var(--accent)" : "var(--text-tertiary)" }}>
                {copied === key ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
            <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CopyIAView() {
  const [platform, setPlatform] = useState<Platform>("meta");
  const [form, setForm] = useState({ product: "", audience: "", differentials: "" });
  const [objective, setObjective] = useState<Objective>("conversao");
  const [tone, setTone] = useState<Tone>("profissional");
  const [results, setResults] = useState<CopyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const apiKey = getGroqApiKey();

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey || !form.product) return;
    setLoading(true);
    setError("");
    try {
      const result = await generateCopy({ platform, objective, tone, ...form }, apiKey);
      setResults((prev) => {
        const idx = prev.findIndex((r) => r.platform === platform);
        return idx >= 0 ? prev.map((r, i) => (i === idx ? result : r)) : [...prev, result];
      });
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function regenerate(p: Platform) {
    if (!apiKey || !form.product) return;
    setLoading(true);
    try {
      const result = await generateCopy({ platform: p, objective, tone, ...form }, apiKey);
      setResults((prev) => prev.map((r) => (r.platform === p ? result : r)));
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const sel = "rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none appearance-none cursor-pointer";
  const selStyle = { backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-strong)" };
  const inp = "w-full rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent-a44)] transition-colors";
  const inpStyle = { backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-strong)" };

  return (
    <div className="flex flex-col min-h-0">
      <div className="max-w-screen-xl mx-auto w-full px-6 py-8 space-y-8">
        <div>
          <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "var(--accent)" }}>Ferramentas de IA</p>
          <h2 className="text-[var(--text-primary)] font-bold text-lg leading-tight">Copy IA</h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>Gere copy de alta conversão para Meta Ads, Google Ads, Instagram e WhatsApp.</p>
        </div>

        {!apiKey && (
          <div className="rounded-xl px-4 py-3 text-xs" style={{ backgroundColor: "var(--danger-tint)", border: "1px solid #DC262633", color: "var(--danger)" }}>
            Configure sua chave Groq (gratuita) no Orbe AI ou no Super Agente para usar o Copy IA.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8">
          {/* Form */}
          <form onSubmit={handleGenerate} className="space-y-4">
            {/* Platform tabs */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-tertiary)" }}>Plataforma</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(Object.keys(PLATFORM_META) as Platform[]).map((p) => {
                  const meta = PLATFORM_META[p];
                  const active = platform === p;
                  return (
                    <button
                      type="button" key={p} onClick={() => setPlatform(p)}
                      className="px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all text-left"
                      style={{
                        borderColor: active ? meta.color + "66" : "var(--border)",
                        backgroundColor: active ? meta.bg : "var(--bg-surface)",
                        color: active ? meta.color : "var(--text-tertiary)",
                      }}>
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>Produto / Serviço *</label>
              <input value={form.product} onChange={(e) => setForm((p) => ({ ...p, product: e.target.value }))}
                placeholder="ex: Curso online de vendas, Clínica de estética..." required className={inp} style={inpStyle} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>Objetivo</label>
                <select value={objective} onChange={(e) => setObjective(e.target.value as Objective)} className={sel} style={selStyle}>
                  {(Object.entries(OBJECTIVE_LABELS) as [Objective, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>Tom de voz</label>
                <select value={tone} onChange={(e) => setTone(e.target.value as Tone)} className={sel} style={selStyle}>
                  {(Object.entries(TONE_LABELS) as [Tone, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>Público-alvo</label>
              <input value={form.audience} onChange={(e) => setForm((p) => ({ ...p, audience: e.target.value }))}
                placeholder="ex: Mulheres 25-45 anos, interessadas em..." className={inp} style={inpStyle} />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>Diferenciais / Oferta especial</label>
              <textarea value={form.differentials} onChange={(e) => setForm((p) => ({ ...p, differentials: e.target.value }))}
                placeholder="ex: 7 dias grátis, garantia de 30 dias, frete grátis..." rows={2}
                className={`${inp} resize-none`} style={inpStyle} />
            </div>

            {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}

            <button type="submit" disabled={loading || !apiKey || !form.product}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
              style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading ? "Gerando copy..." : `Gerar copy para ${PLATFORM_META[platform].label}`}
            </button>
          </form>

          {/* Results */}
          <div className="space-y-4">
            {results.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border)] py-20 flex flex-col items-center justify-center" style={{ backgroundColor: "var(--bg-surface)" }}>
                <Sparkles size={28} className="mb-3" style={{ color: "#222" }} />
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Nenhum copy gerado ainda</p>
                <p className="text-xs" style={{ color: "var(--text-quaternary)" }}>Preencha o formulário e clique em Gerar</p>
              </div>
            ) : (
              results.map((r) => (
                <CopyCard key={r.platform} result={r} loading={loading} onRegenerate={() => regenerate(r.platform)} />
              ))
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
