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
        className="group flex-1 min-w-0 text-left rounded-xl p-4 transition-all duration-150 border focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        style={{
          backgroundColor: isActive ? "var(--accent-tint)" : "var(--bg-surface)",
          borderColor: isActive ? "var(--accent)" : "var(--border)",
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.borderColor = "var(--accent-a44)";
            el.style.backgroundColor = "var(--bg-surface-2)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.borderColor = "var(--border)";
            el.style.backgroundColor = "var(--bg-surface)";
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
                ? { backgroundColor: "var(--accent)", color: "var(--bg-page)" }
                : { backgroundColor: "var(--border)", color: "var(--text-tertiary)" }
            }
          >
            {phase.label}
          </span>
          {isActive && (
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: "var(--accent)" }}
              aria-hidden="true"
            />
          )}
        </div>

        {/* Phase name */}
        <p
          className="text-sm font-semibold leading-snug mb-1 transition-colors duration-150"
          style={{ color: isActive ? "var(--text-primary)" : "var(--text-secondary)" }}
        >
          {phase.name}
        </p>

        {/* Meta */}
        <p className="text-[11px]" style={{ color: isActive ? "var(--accent)" : "#3a3a3a" }}>
          {phase.meta}
        </p>
      </button>

      {/* Connector arrow */}
      {!isLast && (
        <ChevronRight
          size={16}
          className="flex-shrink-0 mx-2"
          style={{ color: "var(--border-subtle)" }}
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
      style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      {/* Detail header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b"
        style={{ borderBottomColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded"
            style={{ backgroundColor: "var(--accent-tint)", color: "var(--accent)", border: "1px solid var(--accent-a33)" }}
          >
            {phase.label}
          </span>
          <div>
            <h3 className="text-white font-semibold text-sm leading-tight">{phase.name}</h3>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--accent)" }}>{phase.meta}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => alert("Em breve")}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = "var(--accent)";
              el.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = "var(--border-subtle)";
              el.style.color = "var(--text-secondary)";
            }}
          >
            Detalhar fase
          </button>
          <button
            onClick={() => alert("Em breve")}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 border focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.backgroundColor = "var(--accent)";
              el.style.color = "var(--bg-page)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.backgroundColor = "transparent";
              el.style.color = "var(--accent)";
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
          borderLeft: "3px solid var(--accent)",
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
              style={{ color: "var(--accent)" }}
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
                style={{ color: "var(--accent)" }}
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
            <p className="text-[var(--text-quaternary)] text-xs hidden sm:block">
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
              <TrendingDown size={18} style={{ color: "var(--danger)" }} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--danger)" }}>Churn</p>
                <p className="text-white font-bold text-xl leading-tight">{churned.length}</p>
                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>cliente{churned.length !== 1 ? "s" : ""} perdido{churned.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className="w-px h-10 hidden sm:block" style={{ backgroundColor: "#EF444433" }} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--danger)" }}>Perda de Receita</p>
              <p className="text-white font-bold text-xl leading-tight">
                R$ {churnRevenueLost.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
              </p>
              <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>por mês</p>
            </div>
            <div className="w-px h-10 hidden sm:block" style={{ backgroundColor: "#EF444433" }} />
            <div className="flex flex-wrap gap-2">
              {churned.map((c) => (
                <span key={c.id} className="text-[11px] px-2.5 py-1 rounded-lg font-medium" style={{ backgroundColor: "#1a0808", color: "var(--danger)", border: "1px solid #EF444422" }}>
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Divider ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
          <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "var(--text-quaternary)" }}>
            Gestão de entregas
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
        </div>

        {/* ── Tarefas ─────────────────────────────────────────────────────── */}
        <TasksView />

        {/* ── Divider ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
          <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "var(--text-quaternary)" }}>
            Carteira de clientes
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
        </div>

        {/* ── Clientes ────────────────────────────────────────────────────── */}
        <ClientesSection compact={false} />
      </div>

      <Footer />
    </div>
  );
}
