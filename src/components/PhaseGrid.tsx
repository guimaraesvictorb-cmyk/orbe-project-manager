import type { Phase } from "../data/m5os";
import { PhaseCard } from "./PhaseCard";

interface PhaseGridProps {
  phases: Phase[];
  activePhaseId: number;
  onPhaseSelect: (id: number) => void;
}

export function PhaseGrid({ phases, activePhaseId, onPhaseSelect }: PhaseGridProps) {
  if (phases.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-[var(--text-secondary)] text-sm">Nenhuma fase encontrada.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {phases.map((phase) => (
        <PhaseCard
          key={phase.id}
          phase={phase}
          isActive={phase.id === activePhaseId}
          onClick={() => onPhaseSelect(phase.id)}
        />
      ))}
    </div>
  );
}
