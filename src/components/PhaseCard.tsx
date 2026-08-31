import type { Phase } from "../data/m5os";

interface PhaseCardProps {
  phase: Phase;
  isActive: boolean;
  onClick: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  venda: "#7B61FF",
  operacao: "#A3A3A3",
  saida: "#A3A3A3",
};

export function PhaseCard({ phase, isActive, onClick }: PhaseCardProps) {
  return (
    <button
      onClick={onClick}
      className="relative w-full text-left rounded-xl p-4 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B61FF] group"
      style={{
        backgroundColor: isActive ? "#1A1A1A" : "#131313",
        border: `1px solid ${isActive ? "#7B61FF" : "#262626"}`,
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#7B61FF";
          (e.currentTarget as HTMLButtonElement).style.backgroundColor =
            "#1A1A1A";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#262626";
          (e.currentTarget as HTMLButtonElement).style.backgroundColor =
            "#131313";
        }
      }}
      aria-pressed={isActive}
      aria-label={`${phase.label}: ${phase.name}`}
    >
      {/* CORE badge */}
      {phase.highlight && (
        <span
          className="absolute top-3 right-3 text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded"
          style={{ backgroundColor: "#7B61FF", color: "#000000" }}
        >
          CORE
        </span>
      )}

      {/* Phase number */}
      <p
        className="text-[10px] font-semibold tracking-widest uppercase mb-2"
        style={{ color: "#A3A3A3" }}
      >
        {phase.label}
      </p>

      {/* Phase name */}
      <p className="text-white font-semibold text-sm leading-snug mb-2 pr-8">
        {phase.name}
      </p>

      {/* Meta */}
      <p
        className="text-[11px] leading-tight"
        style={{ color: "#A3A3A3" }}
      >
        {phase.meta}
      </p>

      {/* Category dot */}
      <div className="flex items-center gap-1.5 mt-3">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: CATEGORY_COLORS[phase.category] }}
        />
        <span className="text-[10px] uppercase tracking-wider" style={{ color: "#A3A3A3" }}>
          {phase.category === "operacao" ? "Operação" : phase.category === "saida" ? "Saída" : "Venda"}
        </span>
      </div>
    </button>
  );
}
