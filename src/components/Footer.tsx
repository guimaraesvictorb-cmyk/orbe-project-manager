import { OrbeMark } from "./OrbeMark";

const BUILD_DATE = new Date(__BUILD_TIME__).toLocaleDateString("pt-BR");
const BUILD_TIME = new Date(__BUILD_TIME__).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
// Drops a trailing ".0" patch (1.0.0 -> 1.0) to match how versions are talked
// about day to day; a real patch release (1.2.3) still shows in full.
const DISPLAY_VERSION = __APP_VERSION__.replace(/\.0$/, "");

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
            Marketing · Documento Estratégico Interno
          </span>
        </div>

        {/* Center: version + last deploy */}
        <p className="text-[10px] tracking-widest uppercase text-[var(--text-secondary)]">
          <span style={{ color: "var(--accent)" }}>v{DISPLAY_VERSION}</span>
          {" "}· Atualizado em {BUILD_DATE} às {BUILD_TIME}
        </p>

        {/* Right */}
        <p className="text-[10px] tracking-widest uppercase text-[var(--text-secondary)]">
          Metodologia Orbe ·{" "}
          <span style={{ color: "var(--accent)" }}>Não Distribuir</span>
        </p>
      </div>
    </footer>
  );
}
