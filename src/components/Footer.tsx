import { OrbeMark } from "./OrbeMark";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border-subtle)] px-6 py-4">
      <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left */}
        <div className="flex items-center gap-2">
          <OrbeMark size={16} />
          <span className="font-display text-sm font-bold leading-none select-none text-[var(--text-primary)]" aria-label="Orbe">
            ORBE
          </span>
          <span className="text-[10px] tracking-widest uppercase text-[var(--text-secondary)]">
            Marketing ·{" "}
            <span style={{ color: "var(--accent)" }}>Operating System v1.0</span>
            {" "}· Documento Estratégico Interno
          </span>
        </div>

        {/* Right */}
        <p className="text-[10px] tracking-widest uppercase text-[var(--text-secondary)]">
          Metodologia Orbe ·{" "}
          <span style={{ color: "var(--accent)" }}>Não Distribuir</span>
        </p>
      </div>
    </footer>
  );
}
