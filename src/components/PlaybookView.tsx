import { useState, useCallback, useRef } from "react";
import { PHASES } from "../data/m5os";
import { ControlBar } from "./ControlBar";
import { PhaseGrid } from "./PhaseGrid";
import { PhaseDetail } from "./PhaseDetail";
import { RitualSection } from "./RitualSection";
import { StackSection } from "./StackSection";
import { ActionsSection } from "./ActionsSection";
import { Footer } from "./Footer";

type FilterType = "todas" | "venda" | "operacao" | "saida";

export function PlaybookView() {
  const [activePhaseId, setActivePhaseId] = useState<number>(2);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("todas");
  const detailRef = useRef<HTMLDivElement>(null);

  const handlePhaseSelect = useCallback((id: number) => {
    setActivePhaseId(id);
    setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, []);

  const filteredPhases = PHASES.filter((phase) => {
    const matchesFilter =
      activeFilter === "todas" || phase.category === activeFilter;
    if (!matchesFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      phase.name.toLowerCase().includes(q) ||
      phase.label.toLowerCase().includes(q) ||
      phase.meta.toLowerCase().includes(q) ||
      phase.items.some((item) => item.toLowerCase().includes(q))
    );
  });

  const activePhase = PHASES.find((p) => p.id === activePhaseId) ?? PHASES[2];

  return (
    <div className="flex flex-col">
      <ControlBar
        search={search}
        onSearchChange={setSearch}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      <main className="max-w-screen-xl mx-auto w-full px-6 py-8 space-y-8">
        <section aria-label="Fases do cliente">
          <PhaseGrid
            phases={filteredPhases}
            activePhaseId={activePhaseId}
            onPhaseSelect={handlePhaseSelect}
          />
        </section>

        <div ref={detailRef} style={{ scrollMarginTop: "120px" }}>
          <PhaseDetail phase={activePhase} />
        </div>

        <div className="border-t border-[var(--border-subtle)]" />
        <RitualSection />

        <div className="border-t border-[var(--border-subtle)]" />
        <StackSection />

        <div className="border-t border-[var(--border-subtle)]" />
        <ActionsSection />
      </main>

      <Footer />
    </div>
  );
}
