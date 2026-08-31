import { useState, useEffect, useRef } from "react";
import { MessageSquare, Settings, X, Send, Loader2, Check, Users, Phone, AlertCircle, Wifi, RefreshCw } from "lucide-react";
import { useClients } from "../hooks/useClients";
import { Footer } from "./Footer";

const WA_URL_KEY = "orbe_evo_url";
const WA_KEY_KEY = "orbe_evo_key";
const WA_INST_KEY = "orbe_evo_instance";

function getConfig() {
  return {
    url: localStorage.getItem(WA_URL_KEY) ?? "",
    apiKey: localStorage.getItem(WA_KEY_KEY) ?? "",
    instance: localStorage.getItem(WA_INST_KEY) ?? "",
  };
}

const TEMPLATES = [
  {
    id: "followup",
    label: "Follow-up mensal",
    text: "Olá, {nome}! 👋\n\nPassando para compartilhar as métricas do mês de {mes}.\n\nEstamos com ótimos resultados e gostaríamos de alinhar os próximos passos. Quando podemos conversar?\n\nAtenciosamente,\nEquipe Orbe Marketing",
  },
  {
    id: "relatorio",
    label: "Envio de relatório",
    text: "Olá, {nome}! 📊\n\nSeu relatório do mês de {mes} está pronto!\n\nPode acessar pelo link: {link}\n\nQualquer dúvida, estou à disposição.\n\nAtenciosamente,\nEquipe Orbe Marketing",
  },
  {
    id: "reuniao",
    label: "Agendamento de reunião",
    text: "Olá, {nome}! 📅\n\nGostaria de agendar nossa reunião de alinhamento mensal. Você tem disponibilidade esta semana?\n\nPodemos fazer por videochamada em até 30 minutos.\n\nAtenciosamente,\nEquipe Orbe Marketing",
  },
  {
    id: "boas_vindas",
    label: "Boas-vindas ao cliente",
    text: "Olá, {nome}! 🎉\n\nSeja muito bem-vindo(a) à Orbe Marketing!\n\nEstamos muito animados para trabalhar juntos e alavancar os seus resultados.\n\nNos próximos dias entraremos em contato para alinhar o onboarding.\n\nAtenciosamente,\nEquipe Orbe Marketing",
  },
];

type ConnectStep = "form" | "qr" | "connected"

interface ConfigModalProps {
  onClose: () => void;
  onSave: () => void;
}

function ConfigModal({ onClose, onSave }: ConfigModalProps) {
  const cfg = getConfig();
  const [url, setUrl] = useState(cfg.url);
  const [key, setKey] = useState(cfg.apiKey);
  const [instance, setInstance] = useState(cfg.instance || "orbe-marketing");
  const [step, setStep] = useState<ConnectStep>("form");
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const base = url.replace(/\/$/, "");
  const headers = { apikey: key, "Content-Type": "application/json" };

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  useEffect(() => () => stopPolling(), []);

  async function checkState(): Promise<string> {
    try {
      const res = await fetch(`${base}/instance/connectionState/${instance}`, { headers });
      if (!res.ok) return "unknown";
      const data = await res.json();
      return data?.instance?.state ?? data?.state ?? "unknown";
    } catch {
      return "unknown";
    }
  }

  async function fetchQr() {
    try {
      const res = await fetch(`${base}/instance/connect/${instance}`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const b64 = data?.base64 ?? data?.qrcode?.base64 ?? "";
      if (b64) setQrCode(b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`);
    } catch { /* silent */ }
  }

  function saveAndClose() {
    stopPolling();
    localStorage.setItem(WA_URL_KEY, base);
    localStorage.setItem(WA_KEY_KEY, key);
    localStorage.setItem(WA_INST_KEY, instance);
    onSave();
    setStep("connected");
    setTimeout(() => { onClose(); }, 1800);
  }

  function startPolling() {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const state = await checkState();
      if (state === "open") { saveAndClose(); return; }
      // Refresh QR every 30s if still not connected
      await fetchQr();
    }, 5000);
  }

  async function connect() {
    if (!url || !key || !instance) return;
    setLoading(true);
    setError("");
    try {
      // 1. Check if already connected
      const state = await checkState();
      if (state === "open") { saveAndClose(); return; }

      // 2. Try to create instance (idempotent — ok if already exists)
      await fetch(`${base}/instance/create`, {
        method: "POST",
        headers,
        body: JSON.stringify({ instanceName: instance, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
      });

      // 3. Get QR code
      await fetchQr();
      setStep("qr");
      startPolling();
    } catch (e: unknown) {
      setError((e as Error).message || "Não foi possível conectar. Verifique a URL e a chave API.");
    } finally {
      setLoading(false);
    }
  }

  const inp = "w-full rounded-lg px-3 py-2 text-xs text-white placeholder-[#333] focus:outline-none";
  const inpStyle = { backgroundColor: "#0d0d0d", border: "1px solid #1e1e1e" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}>
      <div className="rounded-2xl border w-full max-w-md" style={{ backgroundColor: "#0a0a0a", borderColor: "#1a1a1a" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#1a1a1a" }}>
          <p className="text-sm font-semibold text-white">Conectar WhatsApp</p>
          <button onClick={() => { stopPolling(); onClose(); }}><X size={16} style={{ color: "#555" }} /></button>
        </div>

        {/* ── Step: form ── */}
        {step === "form" && (
          <div className="px-6 py-5 space-y-4">
            <div className="rounded-xl px-4 py-3 text-xs space-y-1" style={{ backgroundColor: "#0d1a0d", border: "1px solid #7B61FF22" }}>
              <p className="font-bold" style={{ color: "#7B61FF" }}>Pré-requisito: Evolution API no ar</p>
              <p style={{ color: "#777" }}>Acesse <strong className="text-white">evolution-api.com</strong> e faça deploy gratuito no Railway ou Render. Depois cole a URL e a chave abaixo.</p>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#555" }}>URL da API *</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://sua-evolution.railway.app"
                className={inp}
                style={inpStyle}
              />
              <p className="text-[10px] mt-1" style={{ color: "#333" }}>Não é e-mail — é a URL do seu servidor Evolution API</p>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#555" }}>Chave API (Global API Key) *</label>
              <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="sua-chave-secreta" type="password" className={inp} style={inpStyle} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#555" }}>Nome da instância *</label>
              <input value={instance} onChange={(e) => setInstance(e.target.value)} placeholder="orbe-marketing" className={inp} style={inpStyle} />
              <p className="text-[10px] mt-1" style={{ color: "#333" }}>Identificador da sua instância WhatsApp (sem espaços)</p>
            </div>
            {error && (
              <p className="text-xs flex items-center gap-1.5" style={{ color: "#EF4444" }}>
                <AlertCircle size={12} />{error}
              </p>
            )}
            <button
              onClick={connect}
              disabled={loading || !url || !key || !instance}
              className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
              style={{ backgroundColor: "#7B61FF", color: "#000" }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
              {loading ? "Conectando..." : "Conectar WhatsApp"}
            </button>
          </div>
        )}

        {/* ── Step: QR ── */}
        {step === "qr" && (
          <div className="px-6 py-6 flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#7B61FF" }}>
              <Loader2 size={12} className="animate-spin" />
              Aguardando leitura do QR Code...
            </div>
            {qrCode ? (
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: "#1e1e1e" }}>
                <img src={qrCode} alt="QR Code WhatsApp" className="w-56 h-56 object-contain" style={{ backgroundColor: "#fff" }} />
              </div>
            ) : (
              <div className="w-56 h-56 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#0d0d0d", border: "1px solid #1e1e1e" }}>
                <Loader2 size={24} className="animate-spin" style={{ color: "#333" }} />
              </div>
            )}
            <div className="text-xs space-y-1" style={{ color: "#555" }}>
              <p>1. Abra o WhatsApp no celular</p>
              <p>2. Vá em <strong className="text-white">Dispositivos conectados → Conectar dispositivo</strong></p>
              <p>3. Aponte a câmera para o QR Code acima</p>
            </div>
            <div className="flex gap-2 w-full">
              <button
                onClick={() => { stopPolling(); setStep("form"); setQrCode(""); }}
                className="flex-1 py-2 rounded-xl text-xs border"
                style={{ borderColor: "#1e1e1e", color: "#555" }}
              >
                Voltar
              </button>
              <button
                onClick={fetchQr}
                className="flex-1 py-2 rounded-xl text-xs flex items-center justify-center gap-1 border"
                style={{ borderColor: "#1e1e1e", color: "#555" }}
              >
                <RefreshCw size={11} /> Novo QR
              </button>
            </div>
          </div>
        )}

        {/* ── Step: connected ── */}
        {step === "connected" && (
          <div className="px-6 py-10 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "#0d1f0d", border: "1px solid #7B61FF44" }}>
              <Check size={26} style={{ color: "#7B61FF" }} />
            </div>
            <p className="text-sm font-bold text-white">WhatsApp conectado!</p>
            <p className="text-xs" style={{ color: "#555" }}>Configuração salva. Você já pode enviar mensagens.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function WhatsAppView() {
  const { clients } = useClients();
  const [showConfig, setShowConfig] = useState(false);
  const [, setConfigVersion] = useState(0);
  const [selectedPhone, setSelectedPhone] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id);
  const [customText, setCustomText] = useState(TEMPLATES[0].text);
  const [clientName, setClientName] = useState("");
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [error, setError] = useState("");

  const cfg = getConfig();
  const isConfigured = !!(cfg.url && cfg.apiKey && cfg.instance);

  const activeClients = clients.filter((c) => c.status !== "churned" && c.primary_contact_phone);

  useEffect(() => {
    const tpl = TEMPLATES.find((t) => t.id === selectedTemplate);
    if (tpl) setCustomText(tpl.text);
  }, [selectedTemplate]);

  function handleClientSelect(clientId: string) {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    setSelectedPhone(client.primary_contact_phone ?? "");
    setClientName(client.primary_contact_name ?? client.name);
  }

  function buildMessage() {
    const mes = new Date().toLocaleString("pt-BR", { month: "long", year: "numeric" });
    return customText
      .replace(/\{nome\}/g, clientName || "Cliente")
      .replace(/\{mes\}/g, mes)
      .replace(/\{link\}/g, window.location.origin);
  }

  async function send() {
    if (!selectedPhone || !isConfigured) return;
    setSending(true);
    setError("");
    setSentOk(false);
    try {
      const phone = selectedPhone.replace(/\D/g, "");
      const base = cfg.url.replace(/\/$/, "");
      const res = await fetch(`${base}/message/sendText/${cfg.instance}`, {
        method: "POST",
        headers: { "content-type": "application/json", apikey: cfg.apiKey },
        body: JSON.stringify({
          number: phone,
          text: buildMessage(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `Erro ${res.status}`);
      }
      setSentOk(true);
      setTimeout(() => setSentOk(false), 3000);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  const inp = "w-full rounded-lg px-3 py-2 text-xs text-white placeholder-[#333] focus:outline-none";
  const inpStyle = { backgroundColor: "#0d0d0d", border: "1px solid #1e1e1e" };

  return (
    <div className="flex flex-col min-h-0">
      {showConfig && <ConfigModal onClose={() => setShowConfig(false)} onSave={() => setConfigVersion((v) => v + 1)} />}
      <div className="max-w-screen-xl mx-auto w-full px-6 py-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "#7B61FF" }}>Comunicação</p>
            <h2 className="text-white font-bold text-lg leading-tight">WhatsApp</h2>
            <p className="text-xs mt-1" style={{ color: "#555" }}>Envie mensagens e templates para clientes via Evolution API.</p>
          </div>
          <button onClick={() => setShowConfig(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
            style={{ borderColor: "#1e1e1e", color: isConfigured ? "#7B61FF" : "#EF4444" }}>
            <Settings size={13} />
            {isConfigured ? "Configurado" : "Configurar API"}
          </button>
        </div>

        {!isConfigured && (
          <div className="rounded-xl px-4 py-4 text-xs" style={{ backgroundColor: "#1a0a0a", border: "1px solid #DC262633" }}>
            <p className="font-bold mb-1" style={{ color: "#ef4444" }}>Evolution API não configurada</p>
            <p style={{ color: "#555" }}>Clique em "Configurar API" para conectar seu WhatsApp Business. É gratuito via Railway ou Render.</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8">
          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#555" }}>
                <Users size={10} className="inline mr-1" />Selecionar cliente
              </label>
              <select onChange={(e) => handleClientSelect(e.target.value)} defaultValue=""
                className={inp + " appearance-none cursor-pointer"} style={inpStyle}>
                <option value="">Escolher cliente...</option>
                {activeClients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} — {c.primary_contact_phone}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#555" }}>
                <Phone size={10} className="inline mr-1" />Número (com DDD e código do país)
              </label>
              <input value={selectedPhone} onChange={(e) => setSelectedPhone(e.target.value)}
                placeholder="5511999999999" className={inp} style={inpStyle} />
              <p className="text-[10px] mt-0.5" style={{ color: "#333" }}>Ex: 5511999999999 (55 = Brasil)</p>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#555" }}>Template</label>
              <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}
                className={inp + " appearance-none cursor-pointer"} style={inpStyle}>
                {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                <option value="custom">Mensagem livre</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#555" }}>Nome do contato</label>
              <input value={clientName} onChange={(e) => setClientName(e.target.value)}
                placeholder="Nome para substituir {nome}" className={inp} style={inpStyle} />
            </div>

            {error && <p className="text-xs" style={{ color: "#EF4444" }}>{error}</p>}

            <button onClick={send} disabled={sending || !isConfigured || !selectedPhone}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
              style={{ backgroundColor: sentOk ? "#1A1230" : "#25D366", color: sentOk ? "#7B61FF" : "#000", border: sentOk ? "1px solid #7B61FF44" : "none" }}>
              {sending ? <Loader2 size={16} className="animate-spin" /> : sentOk ? <Check size={16} /> : <Send size={16} />}
              {sending ? "Enviando..." : sentOk ? "Enviado!" : "Enviar mensagem"}
            </button>
          </div>

          {/* Preview */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#555" }}>Preview da mensagem</p>
            <div className="rounded-2xl border" style={{ backgroundColor: "#0a0a0a", borderColor: "#1a1a1a" }}>
              <div className="px-4 py-2 border-b flex items-center gap-2" style={{ borderColor: "#111", backgroundColor: "#25D36611" }}>
                <MessageSquare size={13} style={{ color: "#25D366" }} />
                <span className="text-[11px] font-semibold" style={{ color: "#25D366" }}>WhatsApp</span>
              </div>
              <div className="px-5 py-4">
                <textarea
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  rows={12}
                  className="w-full text-xs text-white leading-relaxed bg-transparent focus:outline-none resize-none"
                  placeholder="Escreva sua mensagem aqui..."
                />
              </div>
              <div className="px-5 pb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#333" }}>Preview com variáveis substituídas:</p>
                <div className="rounded-xl p-3 text-xs leading-relaxed whitespace-pre-wrap" style={{ backgroundColor: "#111", color: "#d4d4d4" }}>
                  {buildMessage()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
