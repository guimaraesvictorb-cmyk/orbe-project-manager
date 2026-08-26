import { useState, useMemo } from "react";
import { ExternalLink, Plus, Search, Loader2, X, Check, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";
import { useClients } from "../hooks/useClients";
import { useAuth } from "../hooks/useAuth";
import type { Client } from "../lib/database.types";
import { FLAG_META, STATUS_META } from "../lib/clientMeta";

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

const AVATAR_COLORS = ["#7C3AED","#2563EB","#059669","#D97706","#DC2626","#0891B2","#B45309","#16A34A"];
function avatarColor(id: string) {
  const n = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function ClientCard({ client, onHealthChange, onStatusChange, onSelect }: { client: Client; onHealthChange: (id: string, flag: Client["health_flag"]) => void; onStatusChange: (id: string, status: Client["status"]) => void; onSelect: (client: Client) => void }) {
  const flag = FLAG_META[client.health_flag];
  const statusMeta = STATUS_META[client.status];
  const [changingFlag, setChangingFlag] = useState(false);

  return (
    <div
      className="rounded-xl p-4 border border-[#1a1a1a] transition-all duration-150 flex flex-col gap-3 cursor-pointer"
      style={{ backgroundColor: "#0a0a0a" }}
      onClick={() => onSelect(client)}
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "#1FCE4A33")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "#1a1a1a")}
    >
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
          style={{ backgroundColor: avatarColor(client.id) }}
        >
          {initials(client.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-white font-semibold text-sm leading-snug truncate">{client.name}</p>
            {/* Health flag — clicável */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setChangingFlag((v) => !v); }}
                className="flex-shrink-0 text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded uppercase"
                style={{ backgroundColor: flag.bg, color: flag.color, border: `1px solid ${flag.color}33` }}
              >
                {flag.label}
              </button>
              {changingFlag && (
                <div
                  className="absolute right-0 top-6 z-10 rounded-xl p-1 flex flex-col gap-0.5"
                  style={{ backgroundColor: "#111", border: "1px solid #1e1e1e", minWidth: "90px" }}
                >
                  {(["green", "yellow", "red"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={(e) => { e.stopPropagation(); onHealthChange(client.id, f); setChangingFlag(false); }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-left"
                      style={{ color: FLAG_META[f].color }}
                    >
                      {f === client.health_flag && <Check size={10} />}
                      {FLAG_META[f].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: "#555" }}>{client.segment ?? "—"}</p>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1.5 text-[11px]">
        {client.primary_contact_name && (
          <div className="flex justify-between">
            <span style={{ color: "#555" }}>Contato</span>
            <span className="text-white truncate ml-2">{client.primary_contact_name}</span>
          </div>
        )}
        {client.monthly_fee && (
          <div className="flex justify-between">
            <span style={{ color: "#555" }}>Mensalidade</span>
            <span style={{ color: "#1FCE4A" }} className="font-medium">
              R$ {client.monthly_fee.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
            </span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span style={{ color: "#555" }}>Status</span>
          <span style={{ color: statusMeta.color }} className="font-medium">{statusMeta.label}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-auto">
        {client.website ? (
          <a
            href={client.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[11px] transition-colors duration-150"
            style={{ color: "#444" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#1FCE4A")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#444")}
          >
            <ExternalLink size={11} />
            <span className="truncate">{client.website.replace(/^https?:\/\//, "")}</span>
          </a>
        ) : <span />}

        {client.status !== "churned" && (
          <button
            onClick={(e) => { e.stopPropagation(); onStatusChange(client.id, "churned"); }}
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-all"
            style={{ color: "#6B7280", backgroundColor: "transparent" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1a0808"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#6B7280"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
            title="Marcar como churn"
          >
            <TrendingDown size={11} />
            Churn
          </button>
        )}
      </div>
    </div>
  );
}

// Modal de criação de cliente
function NewClientModal({ onClose, onSave }: { onClose: () => void; onSave: (data: Partial<Client>) => Promise<string | undefined> }) {
  const [form, setForm] = useState({
    name: "", segment: "", monthly_fee: "", monthly_investment: "",
    primary_contact_name: "", primary_contact_email: "", primary_contact_phone: "",
    website: "", tipo_servico: "", origem_lead: "", proxima_reuniao: "",
    contract_start: "", contract_end: "", notes: "", status: "ativo",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  function makeSlug(name: string) {
    const base = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return `${base}-${Date.now().toString(36)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      const err = await onSave({
        name: form.name,
        slug: makeSlug(form.name),
        segment: form.segment || null,
        monthly_fee: form.monthly_fee ? parseFloat(form.monthly_fee) : null,
        monthly_investment: form.monthly_investment ? parseFloat(form.monthly_investment) : null,
        primary_contact_name: form.primary_contact_name || null,
        primary_contact_email: form.primary_contact_email || null,
        primary_contact_phone: form.primary_contact_phone || null,
        website: form.website || null,
        tipo_servico: form.tipo_servico || null,
        origem_lead: form.origem_lead || null,
        proxima_reuniao: form.proxima_reuniao || null,
        contract_start: form.contract_start || null,
        contract_end: form.contract_end || null,
        notes: form.notes || null,
        status: form.status as Client["status"],
        health_flag: "green",
      });
      if (err) { setSaveError(err); return; }
      onClose();
    } catch (ex: unknown) {
      setSaveError((ex as Error).message ?? "Erro desconhecido");
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full rounded-lg px-3 py-2 text-sm text-white placeholder-[#333] focus:outline-none transition-colors";
  const inpStyle = { backgroundColor: "#080808", border: "1px solid #1e1e1e" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-4 overflow-y-auto max-h-[90vh]" style={{ backgroundColor: "#0d0d0d", border: "1px solid #1e1e1e" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">Novo Cliente</h3>
          <button onClick={onClose} style={{ color: "#555" }}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Identificação */}
          <p className="text-[10px] font-bold uppercase tracking-widest pt-1" style={{ color: "#1FCE4A" }}>Identificação</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Nome da empresa *</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Loja ABC" required className={inp} style={inpStyle} onFocus={(e) => (e.currentTarget.style.borderColor = "#1FCE4A44")} onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Segmento</label>
              <input type="text" value={form.segment} onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))} placeholder="ecommerce, saas..." className={inp} style={inpStyle} onFocus={(e) => (e.currentTarget.style.borderColor = "#1FCE4A44")} onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Tipo de serviço</label>
              <input type="text" value={form.tipo_servico} onChange={(e) => setForm((f) => ({ ...f, tipo_servico: e.target.value }))} placeholder="Tráfego pago, Social..." className={inp} style={inpStyle} onFocus={(e) => (e.currentTarget.style.borderColor = "#1FCE4A44")} onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Status</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={inp + " appearance-none cursor-pointer"} style={inpStyle}>
                <option value="ativo">Ativo</option>
                <option value="em_risco">Em Risco</option>
                <option value="pausado">Pausado</option>
                <option value="offboarding">Offboarding</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Website</label>
              <input type="text" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://..." className={inp} style={inpStyle} onFocus={(e) => (e.currentTarget.style.borderColor = "#1FCE4A44")} onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")} />
            </div>
          </div>

          {/* Financeiro */}
          <p className="text-[10px] font-bold uppercase tracking-widest pt-1" style={{ color: "#1FCE4A" }}>Financeiro</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Mensalidade (R$)</label>
              <input type="number" step="any" value={form.monthly_fee} onChange={(e) => setForm((f) => ({ ...f, monthly_fee: e.target.value }))} placeholder="5000" className={inp} style={inpStyle} onFocus={(e) => (e.currentTarget.style.borderColor = "#1FCE4A44")} onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Investimento em mídia (R$)</label>
              <input type="number" step="any" value={form.monthly_investment} onChange={(e) => setForm((f) => ({ ...f, monthly_investment: e.target.value }))} placeholder="3000" className={inp} style={inpStyle} onFocus={(e) => (e.currentTarget.style.borderColor = "#1FCE4A44")} onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Início do contrato</label>
              <input type="date" value={form.contract_start} onChange={(e) => setForm((f) => ({ ...f, contract_start: e.target.value }))} className={inp} style={inpStyle} onFocus={(e) => (e.currentTarget.style.borderColor = "#1FCE4A44")} onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Fim do contrato</label>
              <input type="date" value={form.contract_end} onChange={(e) => setForm((f) => ({ ...f, contract_end: e.target.value }))} className={inp} style={inpStyle} onFocus={(e) => (e.currentTarget.style.borderColor = "#1FCE4A44")} onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")} />
            </div>
          </div>

          {/* Contato */}
          <p className="text-[10px] font-bold uppercase tracking-widest pt-1" style={{ color: "#1FCE4A" }}>Contato</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Nome do responsável</label>
              <input type="text" value={form.primary_contact_name} onChange={(e) => setForm((f) => ({ ...f, primary_contact_name: e.target.value }))} placeholder="Nome do contato" className={inp} style={inpStyle} onFocus={(e) => (e.currentTarget.style.borderColor = "#1FCE4A44")} onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>E-mail</label>
              <input type="email" value={form.primary_contact_email} onChange={(e) => setForm((f) => ({ ...f, primary_contact_email: e.target.value }))} placeholder="email@empresa.com" className={inp} style={inpStyle} onFocus={(e) => (e.currentTarget.style.borderColor = "#1FCE4A44")} onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Telefone / WhatsApp</label>
              <input type="text" value={form.primary_contact_phone} onChange={(e) => setForm((f) => ({ ...f, primary_contact_phone: e.target.value }))} placeholder="(11) 99999-9999" className={inp} style={inpStyle} onFocus={(e) => (e.currentTarget.style.borderColor = "#1FCE4A44")} onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")} />
            </div>
          </div>

          {/* Outros */}
          <p className="text-[10px] font-bold uppercase tracking-widest pt-1" style={{ color: "#1FCE4A" }}>Outros</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Origem do lead</label>
              <input type="text" value={form.origem_lead} onChange={(e) => setForm((f) => ({ ...f, origem_lead: e.target.value }))} placeholder="Indicação, Instagram..." className={inp} style={inpStyle} onFocus={(e) => (e.currentTarget.style.borderColor = "#1FCE4A44")} onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Próxima reunião</label>
              <input type="datetime-local" value={form.proxima_reuniao} onChange={(e) => setForm((f) => ({ ...f, proxima_reuniao: e.target.value }))} className={inp} style={inpStyle} onFocus={(e) => (e.currentTarget.style.borderColor = "#1FCE4A44")} onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")} />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#555" }}>Observações</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Notas internas sobre o cliente..." rows={3} className={inp + " resize-none"} style={inpStyle} onFocus={(e) => (e.currentTarget.style.borderColor = "#1FCE4A44")} onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")} />
            </div>
          </div>

          {saveError && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ backgroundColor: "#1a0808", color: "#EF4444", border: "1px solid #EF444433" }}>
              Erro ao salvar: {saveError}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-semibold border" style={{ borderColor: "#1e1e1e", color: "#555" }}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !form.name}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all"
              style={{ backgroundColor: saving || !form.name ? "#0d1f14" : "#1FCE4A", color: saving || !form.name ? "#333" : "#000" }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : "Criar Cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ClientesSectionProps {
  compact?: boolean;
  onSelectClient?: (client: Client) => void;
}

export function ClientesSection({ compact = false, onSelectClient }: ClientesSectionProps) {
  const { clients, loading, createClient, updateHealthFlag, updateStatus } = useClients();
  const { user, isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterFlag, setFilterFlag] = useState("todos");
  const [showNewModal, setShowNewModal] = useState(false);
  const [showChurned, setShowChurned] = useState(false);

  const activeClients = useMemo(() => clients.filter((c) => c.status !== "churned"), [clients]);
  const churnedClients = useMemo(() => clients.filter((c) => c.status === "churned"), [clients]);
  const churnRevenueLost = useMemo(() => churnedClients.reduce((sum, c) => sum + (c.monthly_fee ?? 0), 0), [churnedClients]);

  const filtered = useMemo(() => activeClients.filter((c) => {
    if (filterStatus !== "todos" && c.status !== filterStatus) return false;
    if (filterFlag !== "todos" && c.health_flag !== filterFlag) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || (c.segment ?? "").toLowerCase().includes(q) || (c.primary_contact_name ?? "").toLowerCase().includes(q);
    }
    return true;
  }), [activeClients, filterStatus, filterFlag, search]);

  const selectCls = "bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none transition-colors appearance-none cursor-pointer";

  async function handleCreate(data: Partial<Client>): Promise<string | undefined> {
    if (!user) return "Usuário não autenticado";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await createClient({ ...data, created_by: user.id } as any);
    return result?.error;
  }

  const ativos = useMemo(() => activeClients.filter((c) => c.status === "ativo").length, [activeClients]);
  const emRisco = useMemo(() => activeClients.filter((c) => c.health_flag === "red").length, [activeClients]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 size={20} className="animate-spin" style={{ color: "#1FCE4A" }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!compact && (
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-white text-base font-semibold">Carteira de Clientes</h2>
            <p className="text-xs mt-0.5" style={{ color: "#555" }}>
              {ativos} ativos · {emRisco} em risco
            </p>
          </div>
          {isAuthenticated && (
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150"
              style={{ backgroundColor: "#1FCE4A", color: "#000" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#17b83e")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1FCE4A")}
            >
              <Plus size={13} />
              Novo Cliente
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#555" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, segmento..."
            className="w-full bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-[#444] focus:outline-none focus:border-[#1FCE4A44] transition-colors"
          />
        </div>
        <select className={selectCls} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="em_risco">Em Risco</option>
          <option value="pausado">Pausado</option>
          <option value="offboarding">Offboarding</option>
        </select>
        <select className={selectCls} value={filterFlag} onChange={(e) => setFilterFlag(e.target.value)}>
          <option value="todos">Todos os flags</option>
          <option value="green">Green</option>
          <option value="yellow">Yellow</option>
          <option value="red">Red</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[#1a1a1a] py-16 text-center" style={{ backgroundColor: "#0a0a0a" }}>
          <p className="text-white font-semibold text-sm mb-1">Nenhum cliente encontrado</p>
          <p className="text-xs mb-4" style={{ color: "#444" }}>
            {activeClients.length === 0 ? "Adicione o primeiro cliente da Orbe" : "Tente ajustar os filtros"}
          </p>
          {activeClients.length === 0 && isAuthenticated && (
            <button
              onClick={() => setShowNewModal(true)}
              className="text-xs font-semibold px-4 py-2 rounded-lg"
              style={{ backgroundColor: "#1FCE4A", color: "#000" }}
            >
              + Adicionar Cliente
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((client) => (
            <ClientCard key={client.id} client={client} onHealthChange={updateHealthFlag} onStatusChange={updateStatus} onSelect={(c) => onSelectClient?.(c)} />
          ))}
        </div>
      )}

      <p className="text-[11px]" style={{ color: "#333" }}>
        Mostrando {filtered.length} de {activeClients.length} cliente{activeClients.length !== 1 ? "s" : ""}
      </p>

      {/* Churned section */}
      {churnedClients.length > 0 && (
        <div className="rounded-xl border border-[#1a1a1a] overflow-hidden" style={{ backgroundColor: "#0a0a0a" }}>
          <button
            onClick={() => setShowChurned((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 transition-colors"
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#0f0f0f")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent")}
          >
            <div className="flex items-center gap-3">
              <TrendingDown size={14} style={{ color: "#EF4444" }} />
              <span className="text-sm font-semibold" style={{ color: "#EF4444" }}>
                Churn — {churnedClients.length} cliente{churnedClients.length !== 1 ? "s" : ""}
              </span>
              {churnRevenueLost > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-md" style={{ backgroundColor: "#1a0808", color: "#EF4444" }}>
                  − R$ {churnRevenueLost.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}/mês
                </span>
              )}
            </div>
            {showChurned ? <ChevronUp size={14} style={{ color: "#555" }} /> : <ChevronDown size={14} style={{ color: "#555" }} />}
          </button>

          {showChurned && (
            <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 border-t border-[#1a1a1a] pt-4">
              {churnedClients.map((client) => (
                <div key={client.id} className="opacity-60">
                  <ClientCard client={client} onHealthChange={updateHealthFlag} onStatusChange={updateStatus} onSelect={(c) => onSelectClient?.(c)} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showNewModal && (
        <NewClientModal onClose={() => setShowNewModal(false)} onSave={handleCreate} />
      )}
    </div>
  );
}
