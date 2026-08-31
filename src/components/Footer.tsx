export function Footer() {
  return (
    <footer className="border-t border-[var(--border-subtle)] px-6 py-4">
      <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left */}
        <div className="flex items-center gap-3">
          <span
            className="text-sm font-bold leading-none select-none"
            style={{ fontFamily: "Arial, sans-serif", letterSpacing: "-2px" }}
            aria-label="Orbe"
          >
            <span className="text-[var(--text-primary)]">Orbe</span>
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
