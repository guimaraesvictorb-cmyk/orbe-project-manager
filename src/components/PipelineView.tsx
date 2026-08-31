import { useState, useEffect } from "react";
import { Plus, Phone, Mail, ChevronDown, X, ExternalLink, Calendar } from "lucide-react";
import { usePipeline } from "../hooks/usePipeline";
import { useAuth } from "../hooks/useAuth";
import type { Lead, PipelineStage } from "../lib/database.types";
import { Footer } from "./Footer";

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

const CONTRATO_META: Record<string, { label: string; color: string }> = {
  em_negociacao: { label: "Em negociação", color: "var(--warning)" },
  enviado:       { label: "Enviado",       color: "#2563EB" },
  assinado:      { label: "Assinado",      color: "var(--success)" },
  cancelado:     { label: "Cancelado",     color: "var(--danger)" },
};

function LeadCard({
  lead, stages, onMove, onClick,
}: {
  lead: Lead; stages: PipelineStage[];
  onMove: (leadId: string, stageId: string, oldStageId: string) => void;
  onClick: (lead: Lead) => void;
}) {
  const [showMove, setShowMove] = useState(false);

  return (
    <div
      className="rounded-xl border p-3 cursor-pointer transition-all duration-150 group"
      style={{ backgroundColor: "var(--bg-surface-2)", borderColor: "var(--border)" }}
      onClick={() => onClick(lead)}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-subtle)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-white leading-snug">{lead.name}</p>
        <button
          onClick={(e) => { e.stopPropagation(); setShowMove((p) => !p); }}
          className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: "var(--text-tertiary)" }}
        >
          <ChevronDown size={12} />
        </button>
      </div>

      {lead.contact_name && (
        <p className="text-[11px] mb-1" style={{ color: "var(--text-tertiary)" }}>{lead.contact_name}</p>
      )}

      {lead.tipo_servico && (
        <p className="text-[10px] mb-1.5 font-medium" style={{ color: "var(--text-tertiary)" }}>{lead.tipo_servico}</p>
      )}

      {(lead.valor_proposta ?? lead.potential_mrr) && (
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--accent)" }}>
          {fmt(lead.valor_proposta ?? lead.potential_mrr ?? 0)}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {lead.probability > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--border)", color: "var(--text-tertiary)" }}>
            {lead.probability}%
          </span>
        )}
        {lead.status_contrato && CONTRATO_META[lead.status_contrato] && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ color: CONTRATO_META[lead.status_contrato].color, backgroundColor: "var(--bg-surface-2)" }}
          >
            {CONTRATO_META[lead.status_contrato].label}
          </span>
        )}
        {lead.data_fechamento && (
          <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--text-quaternary)" }}>
            <Calendar size={9} />
            {new Date(lead.data_fechamento).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          </span>
        )}
      </div>

      {showMove && (
        <div
          className="mt-2 pt-2 border-t space-y-1"
          style={{ borderColor: "var(--border)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-quaternary)" }}>Mover para</p>
          {stages.map((s) => (
            <button
              key={s.id}
              onClick={() => { onMove(lead.id, s.id, lead.stage_id); setShowMove(false); }}
              disabled={s.id === lead.stage_id}
              className="w-full text-left text-[11px] px-2 py-1 rounded hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ color: s.id === lead.stage_id ? "var(--text-tertiary)" : "var(--text-secondary)" }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LeadModal({ lead, stages, onClose }: { lead: Lead; stages: PipelineStage[]; onClose: () => void }) {
  const stage = stages.find((s) => s.id === lead.stage_id);
  const contrato = lead.status_contrato ? CONTRATO_META[lead.status_contrato] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl border p-6 space-y-4 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: "var(--bg-surface-2)", borderColor: "var(--border)" }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white font-semibold text-base">{lead.name}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--accent)" }}>{stage?.name ?? "—"}</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-tertiary)" }}><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          {[
            { label: "Tipo de serviço", value: lead.tipo_servico },
            { label: "Segmento", value: lead.segment },
            { label: "MRR potencial", value: lead.potential_mrr ? fmt(lead.potential_mrr) : null, green: true },
            { label: "Valor da proposta", value: lead.valor_proposta ? fmt(lead.valor_proposta) : null, green: true },
            { label: "Probabilidade", value: lead.probability > 0 ? `${lead.probability}%` : null },
            { label: "Fechamento", value: lead.data_fechamento ? new Date(lead.data_fechamento).toLocaleDateString("pt-BR") : null },
            { label: "Fonte", value: lead.source },
          ].filter((r) => r.value).map(({ label, value, green }) => (
            <div key={label}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "var(--text-quaternary)" }}>{label}</p>
              <p style={{ color: green ? "var(--accent)" : "var(--text-secondary)" }} className="font-medium">{value}</p>
            </div>
          ))}
        </div>

        {contrato && (
          <div className="flex items-center gap-2 text-xs">
            <span style={{ color: "var(--text-tertiary)" }}>Contrato</span>
            <span className="font-bold px-2 py-0.5 rounded text-[10px]"
              style={{ backgroundColor: "var(--bg-surface-2)", color: contrato.color }}>{contrato.label}</span>
          </div>
        )}

        <div className="space-y-2 text-xs">
          {lead.contact_name && (
            <div className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
              <span style={{ color: "var(--text-tertiary)" }}>Contato</span>{lead.contact_name}
            </div>
          )}
          {lead.contact_email && (
            <div className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
              <Mail size={11} style={{ color: "var(--text-tertiary)" }} />{lead.contact_email}
            </div>
          )}
          {lead.contact_phone && (
            <div className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
              <Phone size={11} style={{ color: "var(--text-tertiary)" }} />{lead.contact_phone}
            </div>
          )}
          {lead.link_proposta && (
            <a
              href={lead.link_proposta}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 transition-colors hover:text-[var(--accent)]"
              style={{ color: "var(--text-tertiary)" }}
            >
              <ExternalLink size={11} />Ver proposta
            </a>
          )}
        </div>

        {lead.notes && (
          <div className="pt-3 border-t" style={{ borderColor: "var(--border)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-quaternary)" }}>Observações</p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-tertiary)" }}>{lead.notes}</p>
          </div>
        )}

        <button onClick={onClose} className="w-full py-2 rounded-xl text-xs border" style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>
          Fechar
        </button>
      </div>
    </div>
  );
}

function NewLeadModal({
  stages, onClose, onSave, userId,
}: {
  stages: PipelineStage[]; onClose: () => void;
  onSave: (lead: Omit<Lead, "id" | "created_at" | "updated_at" | "deleted_at">) => void;
  userId: string;
}) {
  const firstStage = stages.find((s) => !s.is_won && !s.is_lost) ?? stages[0];
  const [form, setForm] = useState({
    name: "", contact_name: "", contact_email: "", contact_phone: "",
    segment: "", tipo_servico: "", potential_mrr: "", valor_proposta: "",
    link_proposta: "", probability: "50", source: "", notes: "",
    stage_id: firstStage?.id ?? "",
    data_fechamento: "", status_contrato: "",
  });

  useEffect(() => {
    if (stages.length > 0 && !form.stage_id) {
      const first = stages.find((s) => !s.is_won && !s.is_lost) ?? stages[0]
      if (first) setForm((p) => ({ ...p, stage_id: first.id }))
    }
  }, [stages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.stage_id) return;
    onSave({
      name: form.name,
      contact_name: form.contact_name || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      stage_id: form.stage_id,
      segment: form.segment || null,
      tipo_servico: form.tipo_servico || null,
      potential_mrr: form.potential_mrr ? parseFloat(form.potential_mrr) : null,
      valor_proposta: form.valor_proposta ? parseFloat(form.valor_proposta) : null,
      link_proposta: form.link_proposta || null,
      data_fechamento: form.data_fechamento || null,
      status_contrato: form.status_contrato || null,
      probability: parseInt(form.probability),
      source: form.source || null,
      owner_id: null,
      notes: form.notes || null,
      lost_reason: null,
      converted_to_client_id: null,
      data_source: "manual",
      external_id: null,
      created_by: userId,
    });
  }

  const inp = (label: string, key: keyof typeof form, type = "text", placeholder = "") => (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>{label}</label>
      <input
        type={type} value={form[key]}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full bg-black border rounded-lg px-3 py-2 text-xs text-white placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)]"
        style={{ borderColor: "var(--border-subtle)" }}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl border p-6 space-y-3 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: "var(--bg-surface-2)", borderColor: "var(--border)" }}>
        <h3 className="text-white font-semibold text-sm">Novo lead</h3>
        <form onSubmit={submit} className="space-y-3">
          {inp("Nome da empresa *", "name", "text", "ex: Empresa XYZ")}

          <div className="grid grid-cols-2 gap-3">
            {inp("Contato", "contact_name", "text", "Nome do responsável")}
            {inp("Segmento", "segment", "text", "ex: E-commerce")}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {inp("Email", "contact_email", "email", "email@empresa.com")}
            {inp("Telefone", "contact_phone", "text", "(11) 99999-9999")}
          </div>

          {inp("Tipo de serviço", "tipo_servico", "text", "ex: Tráfego pago, Social media...")}

          <div className="grid grid-cols-2 gap-3">
            {inp("MRR potencial (R$)", "potential_mrr", "number", "0")}
            {inp("Valor da proposta (R$)", "valor_proposta", "number", "0")}
          </div>

          {inp("Link da proposta", "link_proposta", "url", "https://...")}

          <div className="grid grid-cols-2 gap-3">
            {inp("Probabilidade (%)", "probability", "number", "50")}
            {inp("Data de fechamento", "data_fechamento", "date")}
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Status do contrato</label>
            <select
              value={form.status_contrato}
              onChange={(e) => setForm((p) => ({ ...p, status_contrato: e.target.value }))}
              className="w-full bg-black border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--accent)]"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <option value="">Nenhum</option>
              <option value="em_negociacao">Em negociação</option>
              <option value="enviado">Enviado</option>
              <option value="assinado">Assinado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Etapa</label>
            <select
              value={form.stage_id}
              onChange={(e) => setForm((p) => ({ ...p, stage_id: e.target.value }))}
              className="w-full bg-black border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--accent)]"
              style={{ borderColor: "var(--border-subtle)" }}
              required
            >
              {stages.filter((s) => !s.is_won && !s.is_lost).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {inp("Fonte", "source", "text", "ex: Indicação, Instagram...")}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-tertiary)" }}>Observações</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              placeholder="Contexto do lead..."
              className="w-full bg-black border rounded-lg px-3 py-2 text-xs text-white placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)] resize-none"
              style={{ borderColor: "var(--border-subtle)" }}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-xs border" style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>
              Cancelar
            </button>
            <button type="submit" className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}>
              Salvar lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PipelineView() {
  const { leads, stages, loading, createLead, moveLeadToStage, totalPotentialMrr, weightedMrr } = usePipeline();
  const { profile } = useAuth();
  const [showNew, setShowNew] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const activeLeads = leads.filter((l) => !l.converted_to_client_id);
  const activeStages = stages.filter((s) => !s.is_lost);

  async function handleMove(leadId: string, stageId: string, oldStageId: string) {
    if (!profile?.id) return;
    await moveLeadToStage(leadId, stageId, oldStageId, profile.id);
  }

  async function handleCreateLead(input: Omit<Lead, "id" | "created_at" | "updated_at" | "deleted_at">) {
    await createLead(input);
    setShowNew(false);
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="max-w-screen-xl mx-auto w-full px-6 py-8 space-y-6">

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "var(--accent)" }}>
              Pipeline comercial
            </p>
            <h2 className="text-white font-bold text-lg leading-tight">Gestão de leads</h2>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg flex-shrink-0"
            style={{ backgroundColor: "var(--accent)", color: "var(--bg-page)" }}
          >
            <Plus size={13} />
            Novo lead
          </button>
        </div>

        <div className="flex gap-6 text-xs flex-wrap">
          <div>
            <span style={{ color: "var(--text-tertiary)" }}>Leads ativos</span>
            <span className="ml-2 font-bold text-white">{activeLeads.length}</span>
          </div>
          <div>
            <span style={{ color: "var(--text-tertiary)" }}>MRR potencial</span>
            <span className="ml-2 font-bold" style={{ color: "var(--accent)" }}>{fmt(totalPotentialMrr)}</span>
          </div>
          <div>
            <span style={{ color: "var(--text-tertiary)" }}>MRR ponderado</span>
            <span className="ml-2 font-bold text-white">{fmt(weightedMrr)}</span>
          </div>
        </div>

        {loading ? (
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Carregando...</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {activeStages.map((stage) => {
              const stageLeads = activeLeads.filter((l) => l.stage_id === stage.id);
              const stageMrr = stageLeads.reduce((s, l) => s + (l.valor_proposta ?? l.potential_mrr ?? 0), 0);
              return (
                <div key={stage.id} className="flex-shrink-0 w-64">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                      <span className="text-xs font-semibold text-white">{stage.name}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--border)", color: "var(--text-tertiary)" }}>
                        {stageLeads.length}
                      </span>
                    </div>
                    {stageMrr > 0 && (
                      <span className="text-[10px]" style={{ color: "var(--accent)" }}>{fmt(stageMrr)}</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {stageLeads.map((lead) => (
                      <LeadCard key={lead.id} lead={lead} stages={stages} onMove={handleMove} onClick={setSelectedLead} />
                    ))}
                    {stageLeads.length === 0 && (
                      <div className="rounded-xl border border-dashed p-4 text-center" style={{ borderColor: "var(--border)" }}>
                        <p className="text-[11px]" style={{ color: "var(--text-quaternary)" }}>Sem leads</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showNew && (
        <NewLeadModal
          stages={stages}
          onClose={() => setShowNew(false)}
          onSave={handleCreateLead}
          userId={profile?.id ?? ""}
        />
      )}

      {selectedLead && (
        <LeadModal lead={selectedLead} stages={stages} onClose={() => setSelectedLead(null)} />
      )}

      <Footer />
    </div>
  );
}
