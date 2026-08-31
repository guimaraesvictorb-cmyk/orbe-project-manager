import { useState } from "react";
import { ChevronRight, Lock } from "lucide-react";
import { ROUTINES } from "../../data/routines";
import type { Routine } from "../../data/routines";
import { RoutineDetail } from "./RoutineDetail";

function RoutineCard({
  routine,
  onClick,
}: {
  routine: Routine;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-xl p-4 border border-[#1a1a1a] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B61FF] flex items-start gap-4"
      style={{ backgroundColor: "#0a0a0a" }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.borderColor = routine.color + "55";
        el.style.backgroundColor = "#0d0d0d";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.borderColor = "#1a1a1a";
        el.style.backgroundColor = "#0a0a0a";
      }}
    >
      {/* Color swatch / role badge */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold transition-transform duration-150 group-hover:scale-105"
        style={{ backgroundColor: routine.color + "22", color: routine.color, border: `1px solid ${routine.color}44` }}
      >
        {routine.shortRole}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm leading-snug mb-1">
          Rotina do {routine.role}
        </p>
        <p className="text-xs leading-relaxed truncate" style={{ color: "#555" }}>
          {routine.description.slice(0, 80)}…
        </p>
        <div className="flex flex-wrap gap-1 mt-2">
          {routine.blocks.slice(0, 3).map((b, i) => (
            <span
              key={i}
              className="text-[9px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider"
              style={{ backgroundColor: b.freqColor + "18", color: b.freqColor }}
            >
              {b.frequency.split("mente")[0] || b.frequency}
            </span>
          ))}
          {routine.blocks.length > 3 && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider" style={{ color: "#444" }}>
              +{routine.blocks.length - 3}
            </span>
          )}
        </div>
      </div>

      <ChevronRight
        size={14}
        className="flex-shrink-0 mt-1 transition-transform duration-150 group-hover:translate-x-0.5"
        style={{ color: "#444" }}
        aria-hidden="true"
      />
    </button>
  );
}

function PlaceholderCard({ label }: { label: string }) {
  return (
    <div
      className="w-full rounded-xl p-4 border border-[#1a1a1a] flex items-center gap-4 opacity-50"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: "#1a1a1a" }}
      >
        <Lock size={14} style={{ color: "#444" }} aria-hidden="true" />
      </div>
      <div>
        <p className="text-white font-semibold text-sm">{label}</p>
        <p className="text-[11px] mt-0.5" style={{ color: "#444" }}>Em construção</p>
      </div>
    </div>
  );
}

export function ProcessosView() {
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);

  if (activeRoutine) {
    return (
      <RoutineDetail
        routine={activeRoutine}
        onBack={() => setActiveRoutine(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "#7B61FF" }}>
          OPS · Processos
        </p>
        <h2 className="text-white font-bold text-xl">Processos & Rotinas</h2>
        <p className="text-xs mt-1" style={{ color: "#555" }}>
          Documentação operacional da Orbe. Clique em uma rotina para ver o checklist completo.
        </p>
      </div>

      {/* Precificação placeholder */}
      <div>
        <p className="text-[10px] font-bold tracking-widest uppercase mb-3" style={{ color: "#555" }}>
          Precificação
        </p>
        <PlaceholderCard label="Processo de Precificação" />
      </div>

      {/* Rotinas */}
      <div>
        <p className="text-[10px] font-bold tracking-widest uppercase mb-3" style={{ color: "#555" }}>
          Rotinas por Função
        </p>
        <div className="space-y-2">
          {ROUTINES.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              onClick={() => setActiveRoutine(routine)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
