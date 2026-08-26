import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Sparkles, Settings, X, Trash2, Globe, Loader2, Search,
} from "lucide-react";
import { GROQ_MODEL, GROQ_API_URL, getGroqApiKey } from "../lib/groq";

const BRAVE_STORAGE_KEY = "orbe_brave_key";
const AGENT_STORAGE_KEY = "orbe_superagente_msgs";

function getBraveKey() {
  return localStorage.getItem(BRAVE_STORAGE_KEY) ?? "";
}

const SYSTEM_PROMPT = `Você é o Super Agente Orbe — um assistente de IA avançado da agência Orbe Marketing, especializada em tráfego pago (Meta Ads, Google Ads), gestão de redes sociais e performance digital no Brasil.

Você tem acesso à ferramenta de busca na internet (web_search) e deve usá-la sempre que o usuário pedir informações recentes, notícias do mercado, benchmarks, mudanças em plataformas de anúncio, tendências ou qualquer dado que você não tenha certeza.

## Sua expertise:
- **Meta Ads**: campanhas no Facebook/Instagram, pixel, CAPI, públicos, criativos, estrutura de campanha
- **Google Ads**: search, performance max, shopping, analytics, tracking
- **Analytics**: GA4, GTM, UTMs, atribuição, relatórios
- **Estratégia digital**: funil de vendas, otimização de campanha, CRO, copy persuasivo
- **Gestão de clientes**: briefing, onboarding, reuniões, relatórios, retenção

## Quando usar web_search:
- Preços e benchmarks de CPM, CPC, CPL atuais
- Notícias sobre mudanças de algoritmo do Meta ou Google
- Novidades em plataformas de anúncio (2024/2025)
- Dados de mercado, pesquisas recentes, estatísticas
- Qualquer informação que possa ter mudado nos últimos meses

## Tom:
Direto, técnico quando necessário, em português brasileiro. Você é um expert — dê recomendações claras, não apenas "depende". Quando buscar na web, sempre cite as fontes encontradas.`;

type Role = "user" | "assistant" | "tool";
interface Message {
  id: string;
  role: Role;
  content: string;
  toolName?: string;
  isSearching?: boolean;
}

function renderMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="text-white">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  const isSearch = msg.role === "tool";

  if (isSearch) {
    return (
      <div className="flex items-center gap-2 text-xs py-1" style={{ color: "#555" }}>
        <Globe size={12} style={{ color: "#1FCE4A" }} />
        <span>Buscando: <em style={{ color: "#888" }}>{msg.content}</em></span>
        {msg.isSearching && <Loader2 size={10} className="animate-spin" style={{ color: "#555" }} />}
      </div>
    );
  }

  const lines = msg.content.split("\n");
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ backgroundColor: "#0d1f14", border: "1px solid #1FCE4A33" }}>
          <Sparkles size={13} style={{ color: "#1FCE4A" }} />
        </div>
      )}
      <div
        className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
        style={isUser
          ? { backgroundColor: "#111", color: "#e5e5e5", border: "1px solid #1e1e1e" }
          : { backgroundColor: "#0a0a0a", color: "#d4d4d4", border: "1px solid #1a1a1a" }}
      >
        {lines.map((line, i) => {
          if (line.trimStart().startsWith("- ")) {
            return (
              <div key={i} className="flex items-start gap-2 mt-1">
                <span style={{ color: "#1FCE4A", marginTop: "0.35rem", flexShrink: 0 }}>▸</span>
                <span>{renderMarkdown(line.replace(/^(\s*)-\s/, ""))}</span>
              </div>
            );
          }
          return <span key={i}>{renderMarkdown(line)}{i < lines.length - 1 && line !== "" && <br />}</span>;
        })}
        {msg.content === "" && (
          <span className="inline-flex gap-1 items-center">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: "#1FCE4A", animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

async function braveSearch(query: string, apiKey: string): Promise<string> {
  if (!apiKey) return "Chave Brave Search não configurada.";
  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&search_lang=pt`,
      { headers: { Accept: "application/json", "X-Subscription-Token": apiKey } }
    );
    if (!res.ok) return `Erro na busca: ${res.status}`;
    const data = await res.json();
    const results = (data.web?.results ?? []).slice(0, 5);
    if (!results.length) return "Nenhum resultado encontrado.";
    return results
      .map((r: { title: string; description?: string; url: string }) =>
        `**${r.title}**\n${r.description ?? ""}\nFonte: ${r.url}`)
      .join("\n\n");
  } catch {
    return "Erro ao conectar com Brave Search.";
  }
}

export function SuperAgenteView() {
  const [messages, setMessages] = useState<Message[]>(() => {
    try { return JSON.parse(localStorage.getItem(AGENT_STORAGE_KEY) ?? "[]"); } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [groqDraft, setGroqDraft] = useState(getGroqApiKey());
  const [braveDraft, setBraveDraft] = useState(getBraveKey());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const groqKey = getGroqApiKey();
  const braveKey = getBraveKey();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify(messages.slice(-60)));
  }, [messages]);

  function saveSettings() {
    localStorage.setItem("orbe_groq_key", groqDraft.trim());
    localStorage.setItem(BRAVE_STORAGE_KEY, braveDraft.trim());
    setShowSettings(false);
  }

  const addMsg = useCallback((msg: Omit<Message, "id">) => {
    const m = { ...msg, id: Date.now().toString() + Math.random() };
    setMessages((p) => [...p, m]);
    return m.id;
  }, []);

  const updateMsg = useCallback((id: string, patch: Partial<Message>) => {
    setMessages((p) => p.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || running || !groqKey) return;
    setRunning(true);
    setInput("");

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text.trim() };
    setMessages((p) => [...p, userMsg]);

    const history = [...messages, userMsg].map((m) => ({
      role: m.role === "tool" ? "user" : m.role,
      content: m.role === "tool" ? `[Resultado da busca web]\n${m.content}` : m.content,
    }));

    try {
      let continueLoop = true;
      while (continueLoop) {
        const res = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${groqKey}` },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
            tools: [{
              type: "function",
              function: {
                name: "web_search",
                description: "Busca informações atuais na internet. Use para dados recentes, preços, notícias de plataformas, benchmarks ou qualquer informação que possa ter mudado.",
                parameters: {
                  type: "object",
                  properties: { query: { type: "string", description: "Termo de busca em português ou inglês" } },
                  required: ["query"],
                },
              },
            }],
            tool_choice: "auto",
            max_tokens: 2048,
          }),
        });

        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const json = await res.json();
        const choice = json.choices?.[0];

        if (choice.finish_reason === "tool_calls") {
          const calls = choice.message.tool_calls ?? [];
          history.push({ role: "assistant", content: JSON.stringify(choice.message) });

          for (const call of calls) {
            const args = JSON.parse(call.function.arguments ?? "{}");
            const query = args.query ?? "";

            const searchId = addMsg({ role: "tool", content: query, toolName: "web_search", isSearching: true });
            const result = await braveSearch(query, braveKey);
            updateMsg(searchId, { content: query, isSearching: false });

            history.push({
              role: "tool" as never,
              content: result,
            } as never);
          }
        } else {
          const content = choice.message?.content ?? "";
          const aId = addMsg({ role: "assistant", content: "" });

          // stream-like effect: add content in chunks
          const words = content.split(" ");
          let built = "";
          for (const word of words) {
            built += (built ? " " : "") + word;
            updateMsg(aId, { content: built });
            await new Promise((r) => setTimeout(r, 8));
          }
          continueLoop = false;
        }
      }
    } catch (err: unknown) {
      addMsg({ role: "assistant", content: `Erro: ${(err as Error).message}. Verifique sua chave Groq.` });
    } finally {
      setRunning(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [messages, running, groqKey, braveKey, addMsg, updateMsg]);

  const QUICK = [
    { label: "Benchmarks Meta Ads 2025", prompt: "Quais são os benchmarks de CPM, CTR e CPL para Meta Ads no Brasil em 2025? Busque dados atuais." },
    { label: "Estrutura de campanha de performance", prompt: "Me explica a estrutura ideal de campanha de performance no Meta Ads para e-commerce." },
    { label: "Novidades Google Ads", prompt: "Quais as principais novidades e mudanças do Google Ads nos últimos 3 meses?" },
    { label: "Copy para anúncio", prompt: "Crie 3 variações de copy para anúncio de tráfego pago vendendo um curso online de finanças." },
  ];

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: "#040404" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0" style={{ borderColor: "#111" }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: "#0d1f14", border: "1px solid #1FCE4A44" }}>
            <Sparkles size={12} style={{ color: "#1FCE4A" }} />
          </div>
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#1FCE4A" }}>Super Agente</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#0d1f14", color: "#555", border: "1px solid #1a1a1a" }}>
            llama 3.3 · groq
          </span>
          {braveKey && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#0a1a0d", color: "#1FCE4A", border: "1px solid #1FCE4A22" }}>
              <Globe size={9} /> busca web ativa
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button onClick={() => setMessages([])} className="p-1.5 rounded-lg transition-colors" style={{ color: "#333" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#888")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#333")}>
              <Trash2 size={14} />
            </button>
          )}
          <button onClick={() => { setGroqDraft(getGroqApiKey()); setBraveDraft(getBraveKey()); setShowSettings(true); }}
            className="p-1.5 rounded-lg transition-colors" style={{ color: groqKey ? "#333" : "#DC2626" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#888")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = groqKey ? "#333" : "#DC2626")}>
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 min-h-0">
        {!groqKey && (
          <div className="rounded-xl px-4 py-3 text-xs" style={{ backgroundColor: "#1a0a0a", border: "1px solid #DC262633", color: "#ef4444" }}>
            Configure sua chave Groq (gratuita em console.groq.com) clicando em ⚙ acima.
          </div>
        )}
        {!braveKey && groqKey && (
          <div className="rounded-xl px-4 py-3 text-xs flex items-center justify-between" style={{ backgroundColor: "#0a0d12", border: "1px solid #2563EB33" }}>
            <span style={{ color: "#A3A3A3" }}>
              Configure sua chave <strong>Brave Search</strong> (gratuita em brave.com/search/api) para ativar a busca na internet.
            </span>
            <button onClick={() => setShowSettings(true)} className="ml-4 flex-shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: "#2563EB", color: "#fff" }}>Configurar</button>
          </div>
        )}
        {messages.length === 0 && (
          <div className="py-8 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: "#0d1f14", border: "1px solid #1FCE4A22" }}>
              <Search size={20} style={{ color: "#1FCE4A" }} />
            </div>
            <p className="text-white font-semibold mb-1">Super Agente Orbe</p>
            <p className="text-xs" style={{ color: "#444" }}>IA com busca web em tempo real. Pergunte sobre campanhas, benchmarks, estratégias e muito mais.</p>
          </div>
        )}
        {messages.map((m) => <Bubble key={m.id} msg={m} />)}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t px-6 py-4 space-y-3" style={{ borderColor: "#111", backgroundColor: "#040404" }}>
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button key={q.label} onClick={() => send(q.prompt)}
                className="text-[11px] px-3 py-1.5 rounded-lg border transition-all"
                style={{ borderColor: "#1a1a1a", color: "#666", backgroundColor: "#080808" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1FCE4A44"; (e.currentTarget as HTMLButtonElement).style.color = "#A3A3A3"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1a1a1a"; (e.currentTarget as HTMLButtonElement).style.color = "#666"; }}>
                {q.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Pergunte qualquer coisa — o agente pode buscar na internet..."
            rows={1}
            disabled={running}
            className="flex-1 resize-none rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors leading-relaxed"
            style={{ backgroundColor: "#0d0d0d", border: "1px solid #1e1e1e", color: "#e5e5e5", maxHeight: "120px" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#1FCE4A44")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
            onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || running}
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-30"
            style={{ backgroundColor: input.trim() && !running ? "#1FCE4A" : "#111", color: input.trim() && !running ? "#000" : "#333", border: "1px solid #1a1a1a" }}>
            {running ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
        <p className="text-[10px] text-center" style={{ color: "#2a2a2a" }}>
          Enter para enviar · Shift+Enter para quebrar linha
        </p>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
          onClick={(e) => e.target === e.currentTarget && setShowSettings(false)}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ backgroundColor: "#0d0d0d", border: "1px solid #1e1e1e" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">Configurar Super Agente</h3>
              <button onClick={() => setShowSettings(false)} style={{ color: "#555" }}><X size={16} /></button>
            </div>
            {[
              { label: "Groq API Key (IA — gratuito em console.groq.com)", value: groqDraft, set: setGroqDraft, placeholder: "gsk_..." },
              { label: "Brave Search API Key (busca web — gratuito em brave.com/search/api)", value: braveDraft, set: setBraveDraft, placeholder: "BSA..." },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label} className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>{label}</label>
                <input
                  type="password" value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder}
                  className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                  style={{ backgroundColor: "#080808", border: "1px solid #1e1e1e", color: "#e5e5e5" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#1FCE4A44")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
                />
              </div>
            ))}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowSettings(false)} className="flex-1 py-2.5 rounded-xl text-xs font-semibold border" style={{ borderColor: "#1e1e1e", color: "#555" }}>Cancelar</button>
              <button onClick={saveSettings} className="flex-1 py-2.5 rounded-xl text-xs font-semibold" style={{ backgroundColor: "#1FCE4A", color: "#000" }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
