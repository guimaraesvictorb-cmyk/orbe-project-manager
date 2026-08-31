import { useState, useEffect, useMemo } from "react";
import { useUTMCaptures, type UTMCapture } from "../hooks/useUTMCaptures";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import {
  Users, Trash2, ChevronRight, Search, Filter, Code,
  Copy, Check, Loader2, ArrowRight,
} from "lucide-react";
import { Footer } from "./Footer";

function utmColor(source: string | null) {
  if (!source) return "#555";
  const s = source.toLowerCase();
  if (s.includes("facebook") || s.includes("fb") || s.includes("meta")) return "#1877F2";
  if (s.includes("google")) return "#EA4335";
  if (s.includes("instagram")) return "#E1306C";
  if (s.includes("whatsapp")) return "#25D366";
  if (s.includes("organic") || s.includes("organico")) return "#7B61FF";
  return "#F59E0B";
}

function CaptureRow({ capture, onConvert, onDelete }: {
  capture: UTMCapture;
  onConvert: (capture: UTMCapture) => void;
  onDelete: (id: string) => void;
}) {
  const color = utmColor(capture.utm_source);
  const date = new Date(capture.captured_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b group" style={{ borderColor: "#111" }}>
      <div className="flex-1 min-w-0 grid grid-cols-[1fr_1fr_140px_100px] gap-3 items-center">
        <div className="min-w-0">
          <p className="text-xs font-medium text-white truncate">{capture.name ?? "—"}</p>
          <p className="text-[10px] truncate" style={{ color: "#444" }}>{capture.email ?? capture.phone ?? "sem contato"}</p>
        </div>
        <div className="min-w-0">
          {capture.utm_source && (
            <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: color + "22", color }}>
              {capture.utm_source}
            </span>
          )}
          {capture.utm_campaign && <p className="text-[10px] mt-0.5 truncate" style={{ color: "#444" }}>{capture.utm_campaign}</p>}
        </div>
        <div>
          <p className="text-[10px]" style={{ color: "#444" }}>{date}</p>
          {capture.lead_id && <p className="text-[10px] font-bold" style={{ color: "#7B61FF" }}>Convertido</p>}
        </div>
        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          {!capture.lead_id && (
            <button onClick={() => onConvert(capture)} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors"
              style={{ backgroundColor: "#1A1230", color: "#7B61FF", border: "1px solid #7B61FF33" }}>
              <ArrowRight size={10} />Pipeline
            </button>
          )}
          <button onClick={() => onDelete(capture.id)} className="p-1 rounded transition-colors" style={{ color: "#333" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#EF4444" }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#333" }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ConvertModal({ capture, onClose, onConverted }: {
  capture: UTMCapture;
  onClose: () => void;
  onConverted: () => void;
}) {
  const { profile } = useAuth();
  const [stages, setStages] = useState<Array<{ id: string; name: string }>>([]);
  const [stageId, setStageId] = useState("");
  const [converting, setConverting] = useState(false);
  const { convertToLead } = useUTMCaptures();

  useEffect(() => {
    supabase.from("pipeline_stages").select("id,name").order("sort_order").then(({ data }) => {
      setStages(data ?? []);
      if (data?.[0]) setStageId(data[0].id);
    });
  }, []);

  async function doConvert() {
    if (!stageId || !profile) return;
    setConverting(true);
    try {
      await convertToLead(capture, stageId, profile.id);
      onConverted();
      onClose();
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
      <div className="rounded-2xl border w-full max-w-sm" style={{ backgroundColor: "#0a0a0a", borderColor: "#1a1a1a" }}>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm font-semibold text-white">Mover para pipeline</p>
          <div>
            <p className="text-xs mb-1" style={{ color: "#555" }}>Lead: <strong className="text-white">{capture.name}</strong></p>
            {capture.utm_source && <p className="text-xs" style={{ color: "#555" }}>Fonte: {capture.utm_source} / {capture.utm_medium}</p>}
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: "#555" }}>Etapa inicial</label>
            <select value={stageId} onChange={(e) => setStageId(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-xs text-white appearance-none focus:outline-none"
              style={{ backgroundColor: "#0d0d0d", border: "1px solid #1e1e1e" }}>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2 rounded-xl text-xs border" style={{ borderColor: "#1e1e1e", color: "#555" }}>Cancelar</button>
            <button onClick={doConvert} disabled={converting || !stageId}
              className="flex-1 py-2 rounded-xl text-xs font-semibold disabled:opacity-40 flex items-center justify-center gap-1.5"
              style={{ backgroundColor: "#7B61FF", color: "#000" }}>
              {converting ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={12} />}Mover
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WebhookDocs() {
  const [copied, setCopied] = useState(false);
  const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/capture_lead_utm`;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const snippet = `// Integração com seu site/landing page
fetch("${url}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "apikey": "${anonKey}"
  },
  body: JSON.stringify({
    p_name: "Nome do Lead",
    p_email: "email@exemplo.com",
    p_phone: "11999999999",
    p_utm_source: new URLSearchParams(location.search).get("utm_source"),
    p_utm_medium: new URLSearchParams(location.search).get("utm_medium"),
    p_utm_campaign: new URLSearchParams(location.search).get("utm_campaign"),
    p_utm_content: new URLSearchParams(location.search).get("utm_content"),
    p_utm_term: new URLSearchParams(location.search).get("utm_term"),
    p_landing_page: location.href
  })
})`;

  function copy() {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "#0a0a0a", borderColor: "#1a1a1a" }}>
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "#111" }}>
        <div className="flex items-center gap-2">
          <Code size={14} style={{ color: "#7B61FF" }} />
          <p className="text-xs font-bold text-white">Código de integração para seu site</p>
        </div>
        <button onClick={copy} className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg" style={{ backgroundColor: "#111", color: copied ? "#7B61FF" : "#555" }}>
          {copied ? <Check size={11} /> : <Copy size={11} />}{copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
      <pre className="px-5 py-4 text-[11px] overflow-x-auto leading-relaxed" style={{ color: "#888", fontFamily: "monospace" }}>{snippet}</pre>
      <div className="px-5 py-3 border-t text-xs" style={{ borderColor: "#111", color: "#444" }}>
        Cole este código no submit do formulário da sua landing page. Os leads aparecerão automaticamente aqui com os dados UTM capturados.
      </div>
    </div>
  );
}

export function LeadsCapturadosView() {
  const { captures, loading, deleteCapture, refetch } = useUTMCaptures();
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [convertTarget, setConvertTarget] = useState<UTMCapture | null>(null);
  const [showCode, setShowCode] = useState(false);

  const sources = useMemo(() => {
    const set = new Set(captures.map((c) => c.utm_source).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [captures]);

  const filtered = useMemo(() =>
    captures.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch = !q || (c.name?.toLowerCase().includes(q) ?? false) || (c.email?.toLowerCase().includes(q) ?? false) || (c.utm_campaign?.toLowerCase().includes(q) ?? false);
      const matchSource = !filterSource || c.utm_source === filterSource;
      return matchSearch && matchSource;
    }),
    [captures, search, filterSource]
  );

  const converted = captures.filter((c) => c.lead_id).length;

  return (
    <div className="flex flex-col min-h-0">
      {convertTarget && (
        <ConvertModal
          capture={convertTarget}
          onClose={() => setConvertTarget(null)}
          onConverted={() => { refetch(); setConvertTarget(null); }}
        />
      )}

      <div className="max-w-screen-xl mx-auto w-full px-6 py-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "#7B61FF" }}>Geração de Leads</p>
            <h2 className="text-white font-bold text-lg leading-tight">Leads Capturados</h2>
            <p className="text-xs mt-1" style={{ color: "#555" }}>Leads capturados via formulários com rastreamento UTM completo.</p>
          </div>
          <button onClick={() => setShowCode(!showCode)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
            style={{ borderColor: "#1e1e1e", color: "#7B61FF" }}>
            <Code size={13} />Código de integração
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total capturados", value: captures.length },
            { label: "Convertidos", value: converted, color: "#7B61FF" },
            { label: "Aguardando", value: captures.length - converted, color: "#F59E0B" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border p-4" style={{ backgroundColor: "#0a0a0a", borderColor: "#1a1a1a" }}>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#444" }}>{s.label}</p>
              <p className="text-2xl font-bold" style={{ color: s.color ?? "#fff" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {showCode && <WebhookDocs />}

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#333" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar leads..." className="pl-8 pr-3 py-2 rounded-lg text-xs text-white focus:outline-none"
              style={{ backgroundColor: "#0d0d0d", border: "1px solid #1e1e1e", width: 220 }} />
          </div>
          {sources.length > 0 && (
            <div className="relative">
              <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#333" }} />
              <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}
                className="pl-8 pr-3 py-2 rounded-lg text-xs text-white appearance-none focus:outline-none"
                style={{ backgroundColor: "#0d0d0d", border: "1px solid #1e1e1e" }}>
                <option value="">Todas as fontes</option>
                {sources.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "#0a0a0a", borderColor: "#1a1a1a" }}>
          <div className="grid grid-cols-[1fr_1fr_140px_100px] gap-3 px-5 py-2 border-b" style={{ borderColor: "#111" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#333" }}>Nome / Contato</p>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#333" }}>Fonte UTM</p>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#333" }}>Data</p>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#333" }}>Ações</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin" style={{ color: "#7B61FF" }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Users size={24} className="mx-auto mb-3" style={{ color: "#222" }} />
              <p className="text-sm font-semibold text-white mb-1">Nenhum lead capturado ainda</p>
              <p className="text-xs" style={{ color: "#444" }}>
                Integre o código no seu site para capturar leads automaticamente com dados UTM
              </p>
            </div>
          ) : (
            filtered.map((c) => (
              <CaptureRow key={c.id} capture={c} onConvert={setConvertTarget} onDelete={deleteCapture} />
            ))
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
