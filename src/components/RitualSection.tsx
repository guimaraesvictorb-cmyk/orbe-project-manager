import { RITUAIS } from "../data/m5os";

export function RitualSection() {
  return (
    <section aria-labelledby="rituais-title">
      <h2
        id="rituais-title"
        className="text-xs font-bold tracking-widest uppercase mb-4"
        style={{ color: "var(--accent)" }}
      >
        Rituais Recorrentes
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {RITUAIS.map((ritual) => (
          <div
            key={ritual.name}
            className="rounded-lg p-3 transition-all duration-150"
            style={{
              backgroundColor: "var(--bg-surface-2)",
              borderTop: "1px solid var(--border-subtle)",
              borderRight: "1px solid var(--border-subtle)",
              borderBottom: "1px solid var(--border-subtle)",
              borderLeft: "3px solid var(--accent)",
            }}
          >
            <p className="text-white font-semibold text-sm leading-snug mb-1">
              {ritual.name}
            </p>
            <p
              className="text-[10px] font-semibold tracking-widest uppercase mb-2"
              style={{ color: "var(--accent)" }}
            >
              {ritual.when}
            </p>
            <p className="text-[var(--text-secondary)] text-xs leading-relaxed">
              {ritual.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
