import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Sparkles, Settings, X, Trash2, ChevronRight } from "lucide-react";
import type { Profile } from "../lib/database.types";
import type { AppView } from "./AppNav";

import { GROQ_STORAGE_KEY, GROQ_MODEL, GROQ_API_URL } from "../lib/groq";

const SYSTEM_PROMPT = `Você é o Orbe AI — assistente interno da Orbe Marketing, agência digital brasileira especializada em tráfego pago, gestão de redes sociais e performance.

Você está integrado ao Orbe Operating System (Orbe OS), a plataforma operacional interna da equipe. Seu papel é ajudar o time a navegar pela plataforma, encontrar informações, entender processos e executar tarefas com mais eficiência.

## Estrutura do Orbe OS (3 abas principais):

### 🎯 Processos (Metodologia Orbe)
9 fases da jornada do cliente — da prospecção ao pós-venda:
- F0: Prospecção — Identificação e qualificação de leads
- F1: Conexão — Primeiro contato e rapport
- F2: Diagnóstico — Levantamento de dores e necessidades
- F3: Estratégia — Montagem da proposta de valor
- F4: Proposta — Apresentação e negociação
- F5: Onboarding — Integração do novo cliente
- F6: Kick-Off — Início das operações
- F7: Operação Recorrente — Gestão contínua de campanhas
- F8: Retenção/Pós-Venda — Fidelização e expansão

### ⚙️ Operação
- **Pipeline operacional**: Fases F5-F8 com detalhes de cada etapa pós-venda
- **Gestão de Tarefas**: Criar, editar, priorizar e filtrar tarefas por fase, status e prazo
- **Carteira de Clientes**: Lista completa com status (ativo, onboarding, pausado), health flag (green/yellow/red), gestor responsável, plataformas e verba mensal

### 🏢 Central de Operação
Seções com sidebar de navegação:
- **P&P Central**: Pessoas & Performance
- **C.S**: Customer Success — Dossiê do Churn e Jornada do Cliente
- **Clientes**: Carteira de Clientes completa
- **OPS**: Central de Projetos, Processos/Rotinas, Links Úteis, Reuniões
- **Criativos**: Processos Criativos
- **Tech**: Central Tech OPS e Reuniões
- **Financeiro**: Processo de Remuneração, Adiantamento e Reembolso
- **Comercial**: Ferramentas, Links e Senhas, Cases

## Rotinas documentadas (Central > OPS > Processos):
1. **Designer** — gestão de criativos, briefings, revisões, entrega de peças
2. **Copywriter** — produção de copies, calendário editorial, revisão de textos
3. **GT (Gestor de Tráfego)** — campanhas pagas, otimização, relatórios de performance
4. **GP (Gestor de Projetos)** — coordenação entre áreas, acompanhamento de entregas
5. **Coordenador** — supervisão da equipe, reuniões, qualidade das entregas
6. **CS (Customer Success)** — relacionamento com clientes, NPS, churn prevention
7. **Gerente** — visão estratégica, metas, gestão financeira e de pessoas

## Como ajudar a navegar:
- Para **tarefas**: "Vá em Operação (aba do topo) e role para 'Gestão de Entregas'"
- Para **rotinas**: "Vá em Central > OPS > Processos e clique na rotina desejada"
- Para **clientes**: "Vá em Operação e role para 'Carteira de Clientes', ou Central > Clientes"
- Para **processos/metodologia**: "Vá em Processos (menu lateral)"

## Estilo de resposta:
- Português brasileiro, direto e objetivo
- Use markdown básico: **negrito** para ênfase, listas com hífens para múltiplos itens
- Máximo 3-4 parágrafos por resposta — seja conciso
- Quando indicar navegação, seja específico sobre o caminho exato
- Você conhece o time da Orbe e fala de forma próxima, profissional mas sem formalidade excessiva`;

const QUICK_ACTIONS = [
  { label: "Ver rotina do GP", prompt: "Me explica a rotina do Gestor de Projetos" },
  { label: "Processos do CS", prompt: "Como funciona o processo de Customer Success?" },
  { label: "Fases da operação", prompt: "Quais são as fases do pipeline operacional?" },
  { label: "Como criar uma tarefa?", prompt: "Como eu crio e gerencio tarefas na plataforma?" },
];

const SHORTCUTS = [
  { label: "Tarefas",   view: "tarefas"   as AppView },
  { label: "Clientes",  view: "clientes"  as AppView },
  { label: "Pipeline",  view: "pipeline"  as AppView },
  { label: "Processos", view: "processos" as AppView },
];

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function getGreeting(name: string): string {
  const h = new Date().getHours();
  const period = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  return `${period}, ${name}! Como posso te ajudar hoje?\n\nEstou aqui para te ajudar a navegar pelo Orbe OS — seja para encontrar uma rotina, entender uma fase do playbook, checar tarefas ou qualquer processo da plataforma.`;
}

function renderMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} style={{ color: "var(--text-primary)" }}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  const lines = message.content.split("\n");

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ backgroundColor: "var(--accent-tint)", border: "1px solid var(--accent-a33)" }}
        >
          <Sparkles size={13} style={{ color: "var(--accent)" }} aria-hidden="true" />
        </div>
      )}

      <div
        className="max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
        style={
          isUser
            ? { backgroundColor: "var(--bg-surface-2)", color: "#e5e5e5", border: "1px solid var(--border-strong)" }
            : { backgroundColor: "var(--bg-surface)", color: "#d4d4d4", border: "1px solid var(--border)" }
        }
      >
        {lines.map((line, i) => {
          const isBullet = line.trimStart().startsWith("- ");
          if (isBullet) {
            return (
              <div key={i} className="flex items-start gap-2 mt-1">
                <span style={{ color: "var(--accent)", marginTop: "0.35rem", flexShrink: 0 }}>▸</span>
                <span>{renderMarkdown(line.replace(/^(\s*)-\s/, ""))}</span>
              </div>
            );
          }
          return (
            <span key={i}>
              {renderMarkdown(line)}
              {i < lines.length - 1 && line !== "" && <br />}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: "var(--accent-tint)", border: "1px solid var(--accent-a33)" }}
      >
        <Sparkles size={13} style={{ color: "var(--accent)" }} />
      </div>
      <div
        className="rounded-2xl px-4 py-3 flex items-center gap-1"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: "var(--accent)",
              animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface HomeViewProps {
  profile: Profile | null;
  onNavigate: (view: AppView) => void;
}

export function HomeView({ profile, onNavigate }: HomeViewProps) {
  const firstName = profile?.display_name?.split(" ")[0] ?? "time";
  const [apiKey, setApiKey] = useState(() => (import.meta.env.VITE_GROQ_API_KEY as string | undefined) || localStorage.getItem(GROQ_STORAGE_KEY) || "");
  const [showSettings, setShowSettings] = useState(false);
  const [keyDraft, setKeyDraft] = useState(apiKey);
  const [messages, setMessages] = useState<Message[]>([
    { id: "greeting", role: "assistant", content: getGreeting(firstName) },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const saveApiKey = useCallback(() => {
    const trimmed = keyDraft.trim();
    localStorage.setItem(GROQ_STORAGE_KEY, trimmed);
    setApiKey(trimmed);
    setShowSettings(false);
  }, [keyDraft]);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([{ id: "greeting", role: "assistant", content: getGreeting(firstName) }]);
    setIsStreaming(false);
  }, [firstName]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      const userMsg: Message = { id: Date.now().toString(), role: "user", content: trimmed };
      const history = [...messages, userMsg];
      setMessages(history);
      setInput("");
      setIsStreaming(true);

      const assistantId = Date.now().toString() + "_a";
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch(GROQ_API_URL, {
          method: "POST",
          signal: ctrl.signal,
          headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            max_tokens: 1024,
            stream: true,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              ...history.map((m) => ({ role: m.role, content: m.content })),
            ],
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`API ${res.status}: ${errText}`);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content + delta } : m
                  )
                );
              }
            } catch {
              // ignore malformed SSE lines
            }
          }
        }
      } catch (err: unknown) {
        if ((err as Error).name === "AbortError") return;
        const errMsg =
          !apiKey
            ? "Nenhuma API key configurada. Clique em ⚙ para adicionar sua chave gratuita do Groq (console.groq.com)."
            : `Erro ao conectar com a IA: ${(err as Error).message}\n\nVerifique se sua chave Groq está correta nas configurações.`;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: errMsg } : m))
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [messages, isStreaming, apiKey]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const hasConversation = messages.length > 1;

  return (
    <div className="flex flex-col flex-1 min-h-0" style={{ backgroundColor: "#040404" }}>
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0"
        style={{ borderColor: "var(--bg-surface-2)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ backgroundColor: "var(--accent-tint)", border: "1px solid var(--accent-a44)" }}
          >
            <Sparkles size={12} style={{ color: "var(--accent)" }} />
          </div>
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--accent)" }}>
            Orbe AI
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: "var(--accent-tint)", color: "var(--text-tertiary)", border: "1px solid var(--border)" }}>
            llama 3.3 · groq
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Nav shortcuts */}
          <div className="hidden sm:flex items-center gap-1 mr-3">
            {SHORTCUTS.map((s) => (
              <button
                key={s.view}
                onClick={() => onNavigate(s.view)}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg transition-colors duration-150 focus:outline-none"
                style={{ color: "var(--text-tertiary)", backgroundColor: "transparent" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-surface-2)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)";
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                }}
              >
                {s.label}
                <ChevronRight size={10} />
              </button>
            ))}
          </div>

          {hasConversation && (
            <button
              onClick={clearChat}
              className="p-1.5 rounded-lg transition-colors duration-150 focus:outline-none"
              style={{ color: "var(--text-quaternary)" }}
              title="Limpar conversa"
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-quaternary)")}
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={() => { setKeyDraft(apiKey); setShowSettings(true); }}
            className="p-1.5 rounded-lg transition-colors duration-150 focus:outline-none"
            style={{ color: apiKey ? "var(--text-quaternary)" : "#DC2626" }}
            title="Configurar API key"
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = apiKey ? "var(--text-quaternary)" : "#DC2626")}
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* ── Messages ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 min-h-0">
        {/* No-api-key banner */}
        {!apiKey && (
          <div
            className="rounded-xl px-4 py-3 flex items-center justify-between gap-4"
            style={{ backgroundColor: "#1a0a0a", border: "1px solid #DC262633" }}
          >
            <p className="text-xs" style={{ color: "var(--danger)" }}>
              Configure sua chave gratuita do Groq para ativar o assistente. Crie em console.groq.com (sem cartão).
            </p>
            <button
              onClick={() => { setKeyDraft(""); setShowSettings(true); }}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 transition-all duration-150"
              style={{ backgroundColor: "#DC2626", color: "var(--text-primary)" }}
            >
              Configurar
            </button>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isStreaming && messages[messages.length - 1]?.content === "" && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ─────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 border-t px-6 py-4 space-y-3"
        style={{ borderColor: "var(--bg-surface-2)", backgroundColor: "#040404" }}
      >
        {/* Quick actions */}
        {!hasConversation && (
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.label}
                onClick={() => sendMessage(qa.prompt)}
                className="text-[11px] px-3 py-1.5 rounded-lg border transition-all duration-150 focus:outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-tertiary)", backgroundColor: "var(--bg-input)" }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = "var(--accent-a44)";
                  el.style.color = "var(--text-secondary)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = "var(--border)";
                  el.style.color = "var(--text-tertiary)";
                }}
              >
                {qa.label}
              </button>
            ))}
          </div>
        )}

        {/* Textarea + send */}
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte qualquer coisa sobre o Orbe OS..."
              rows={1}
              className="w-full resize-none rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors duration-150 leading-relaxed"
              style={{
                backgroundColor: "var(--bg-surface-2)",
                border: "1px solid var(--border-strong)",
                color: "#e5e5e5",
                maxHeight: "120px",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-a44)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 120) + "px";
              }}
              disabled={isStreaming}
            />
          </div>
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            style={{
              backgroundColor: input.trim() && !isStreaming ? "var(--accent)" : "var(--bg-surface-2)",
              color: input.trim() && !isStreaming ? "var(--bg-page)" : "var(--text-quaternary)",
              border: "1px solid var(--border)",
            }}
          >
            <Send size={15} />
          </button>
        </div>

        <p className="text-[10px] text-center" style={{ color: "var(--border-subtle)" }}>
          Enter para enviar · Shift+Enter para nova linha · Orbe AI pode cometer erros
        </p>
      </div>

      {/* ── Settings modal ─────────────────────────────────────────────────── */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-strong)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold text-sm">Configurar Orbe AI</h3>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                  Sua API key é salva localmente, nunca enviada a terceiros.
                </p>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "var(--text-tertiary)" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)")}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                Groq API Key (gratuito)
              </label>
              <input
                type="password"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveApiKey()}
                placeholder="gsk_..."
                autoFocus
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                style={{
                  backgroundColor: "var(--bg-input)",
                  border: "1px solid var(--border-strong)",
                  color: "#e5e5e5",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-a44)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
              />
              <p className="text-[10px]" style={{ color: "var(--text-quaternary)" }}>
                Gratuito em console.groq.com — sem cartão de crédito
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 border"
                style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}
              >
                Cancelar
              </button>
              <button
                onClick={saveApiKey}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150"
                style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--accent-hover)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--accent)")}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
