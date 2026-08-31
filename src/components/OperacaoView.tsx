import { useState, useMemo } from "react";
import { ChevronRight, CheckCircle2, TrendingDown } from "lucide-react";
import { OPERATIONAL_PHASES } from "../data/m5os";
import type { Phase } from "../data/m5os";
import { TasksView } from "./tasks/TasksView";
import { ClientesSection } from "./ClientesSection";
import { Footer } from "./Footer";
import { useClients } from "../hooks/useClients";

// Default to "Operação Recorrente" (F7)
const DEFAULT_PHASE_ID = 7;

function PipelineStep({
  phase,
  isActive,
  isLast,
  onClick,
}: {
  phase: Phase;
  isActive: boolean;
  isLast: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center flex-1 min-w-0">
      <button
        onClick={onClick}
        className="group flex-1 min-w-0 text-left rounded-xl p-4 transition-all duration-150 border focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B61FF]"
        style={{
          backgroundColor: isActive ? "#1A1230" : "#0a0a0a",
          borderColor: isActive ? "#7B61FF" : "#1a1a1a",
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.borderColor = "#7B61FF44";
            el.style.backgroundColor = "#0d0d0d";
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.borderColor = "#1a1a1a";
            el.style.backgroundColor = "#0a0a0a";
          }
        }}
        aria-pressed={isActive}
      >
        {/* Phase number */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[10px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded"
            style={
              isActive
                ? { backgroundColor: "#7B61FF", color: "#000" }
                : { backgroundColor: "#1a1a1a", color: "#555" }
            }
          >
            {phase.label}
          </span>
          {isActive && (
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: "#7B61FF" }}
              aria-hidden="true"
            />
          )}
        </div>

        {/* Phase name */}
        <p
          className="text-sm font-semibold leading-snug mb-1 transition-colors duration-150"
          style={{ color: isActive ? "#fff" : "#6B7280" }}
        >
          {phase.name}
        </p>

        {/* Meta */}
        <p className="text-[11px]" style={{ color: isActive ? "#7B61FF" : "#3a3a3a" }}>
          {phase.meta}
        </p>
      </button>

      {/* Connector arrow */}
      {!isLast && (
        <ChevronRight
          size={16}
          className="flex-shrink-0 mx-2"
          style={{ color: "#2a2a2a" }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function PhaseDetail({ phase }: { phase: Phase }) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ backgroundColor: "#0a0a0a", borderColor: "#1a1a1a" }}
    >
      {/* Detail header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b"
        style={{ borderBottomColor: "#1a1a1a" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded"
            style={{ backgroundColor: "#1A1230", color: "#7B61FF", border: "1px solid #7B61FF33" }}
          >
            {phase.label}
          </span>
          <div>
            <h3 className="text-white font-semibold text-sm leading-tight">{phase.name}</h3>
            <p className="text-[11px] mt-0.5" style={{ color: "#7B61FF" }}>{phase.meta}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => alert("Em breve")}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B61FF]"
            style={{ borderColor: "#262626", color: "#A3A3A3" }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = "#7B61FF";
              el.style.color = "#7B61FF";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = "#262626";
              el.style.color = "#A3A3A3";
            }}
          >
            Detalhar fase
          </button>
          <button
            onClick={() => alert("Em breve")}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 border focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B61FF]"
            style={{ borderColor: "#7B61FF", color: "#7B61FF" }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.backgroundColor = "#7B61FF";
              el.style.color = "#000";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.backgroundColor = "transparent";
              el.style.color = "#7B61FF";
            }}
          >
            Plano de IA
          </button>
        </div>
      </div>

      {/* Why quote */}
      <div
        className="mx-6 mt-4 mb-0 px-4 py-3 rounded-xl italic text-sm leading-relaxed"
        style={{
          borderLeft: "3px solid #7B61FF",
          backgroundColor: "#060f09",
          color: "#d4d4d4",
        }}
      >
        &ldquo;{phase.why}&rdquo;
      </div>

      {/* Items */}
      <ul className="px-6 py-4 space-y-2.5" role="list">
        {phase.items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <CheckCircle2
              size={14}
              className="flex-shrink-0 mt-0.5"
              style={{ color: "#7B61FF" }}
              aria-hidden="true"
            />
            <span className="text-sm text-white leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OperacaoView() {
  const [activePhaseId, setActivePhaseId] = useState<number>(DEFAULT_PHASE_ID);
  const activePhase =
    OPERATIONAL_PHASES.find((p) => p.id === activePhaseId) ?? OPERATIONAL_PHASES[2];
  const { clients } = useClients();
  const churned = useMemo(() => clients.filter((c) => c.status === "churned"), [clients]);
  const churnRevenueLost = useMemo(() => churned.reduce((s, c) => s + (c.monthly_fee ?? 0), 0), [churned]);

  return (
    <div className="flex flex-col min-h-0">
      <div className="max-w-screen-xl mx-auto w-full px-6 py-8 space-y-8">

        {/* ── Pipeline operacional ────────────────────────────────────────── */}
        <section aria-labelledby="pipeline-title">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p
                className="text-[10px] font-bold tracking-widest uppercase mb-0.5"
                style={{ color: "#7B61FF" }}
              >
                Pipeline Operacional
              </p>
              <h2
                id="pipeline-title"
                className="text-white font-bold text-lg leading-tight"
              >
                Jornada pós-venda do cliente
              </h2>
            </div>
            <p className="text-[#333] text-xs hidden sm:block">
              Selecione uma fase para ver o checklist
            </p>
          </div>

          {/* Steps */}
          <div className="flex items-stretch gap-0 mb-5">
            {OPERATIONAL_PHASES.map((phase, idx) => (
              <PipelineStep
                key={phase.id}
                phase={phase}
                isActive={phase.id === activePhaseId}
                isLast={idx === OPERATIONAL_PHASES.length - 1}
                onClick={() => setActivePhaseId(phase.id)}
              />
            ))}
          </div>

          {/* Detail */}
          <PhaseDetail phase={activePhase} />
        </section>

        {/* ── Churn banner ────────────────────────────────────────────────── */}
        {churned.length > 0 && (
          <div className="rounded-2xl border px-6 py-4 flex flex-wrap items-center gap-6" style={{ backgroundColor: "#0d0808", borderColor: "#EF444433" }}>
            <div className="flex items-center gap-3">
              <TrendingDown size={18} style={{ color: "#EF4444" }} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#EF4444" }}>Churn</p>
                <p className="text-white font-bold text-xl leading-tight">{churned.length}</p>
                <p className="text-[11px]" style={{ color: "#6B7280" }}>cliente{churned.length !== 1 ? "s" : ""} perdido{churned.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className="w-px h-10 hidden sm:block" style={{ backgroundColor: "#EF444433" }} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#EF4444" }}>Perda de Receita</p>
              <p className="text-white font-bold text-xl leading-tight">
                R$ {churnRevenueLost.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
              </p>
              <p className="text-[11px]" style={{ color: "#6B7280" }}>por mês</p>
            </div>
            <div className="w-px h-10 hidden sm:block" style={{ backgroundColor: "#EF444433" }} />
            <div className="flex flex-wrap gap-2">
              {churned.map((c) => (
                <span key={c.id} className="text-[11px] px-2.5 py-1 rounded-lg font-medium" style={{ backgroundColor: "#1a0808", color: "#EF4444", border: "1px solid #EF444422" }}>
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Divider ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px" style={{ backgroundColor: "#1a1a1a" }} />
          <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#333" }}>
            Gestão de entregas
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: "#1a1a1a" }} />
        </div>

        {/* ── Tarefas ─────────────────────────────────────────────────────── */}
        <TasksView />

        {/* ── Divider ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px" style={{ backgroundColor: "#1a1a1a" }} />
          <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#333" }}>
            Carteira de clientes
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: "#1a1a1a" }} />
        </div>

        {/* ── Clientes ────────────────────────────────────────────────────── */}
        <ClientesSection compact={false} />
      </div>

      <Footer />
    </div>
  );
}
