import type { Phase } from "../data/m5os";

interface PhaseDetailProps {
  phase: Phase;
}

export function PhaseDetail({ phase }: PhaseDetailProps) {
  return (
    <div
      className="rounded-xl p-6 border"
      style={{ backgroundColor: "var(--bg-surface-2)", borderColor: "var(--border-subtle)" }}
    >
      {/* Top row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-5">
        <div>
          <p
            className="text-[10px] font-semibold tracking-widest uppercase mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {phase.label}
          </p>
          <h2 className="text-white text-xl font-bold leading-snug">
            {phase.name}
          </h2>
        </div>
        <p
          className="text-xs font-semibold tracking-wide sm:text-right flex-shrink-0"
          style={{ color: "var(--accent)" }}
        >
          {phase.meta}
        </p>
      </div>

      {/* Why block */}
      <blockquote
        className="mb-6 px-4 py-3 rounded-r-md italic text-sm leading-relaxed"
        style={{
          borderLeft: "3px solid var(--accent)",
          backgroundColor: "var(--bg-surface)",
          color: "#e5e5e5",
        }}
      >
        &ldquo;{phase.why}&rdquo;
      </blockquote>

      {/* Action items */}
      <ul className="space-y-3 mb-6" role="list">
        {phase.items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <span
              className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: "var(--accent)" }}
              aria-hidden="true"
            />
            <span className="text-sm text-white leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[var(--border-subtle)]">
        <button
          onClick={() => alert("Em breve")}
          className="px-4 py-2 rounded-md text-sm font-medium transition-all duration-150 border focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          style={{
            borderColor: "var(--accent)",
            color: "var(--accent)",
            backgroundColor: "transparent",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "var(--accent)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--bg-page)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
          }}
        >
          Detalhar essa fase
        </button>
        <button
          onClick={() => alert("Em breve")}
          className="px-4 py-2 rounded-md text-sm font-medium transition-all duration-150 border focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          style={{
            borderColor: "var(--accent)",
            color: "var(--accent)",
            backgroundColor: "transparent",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "var(--accent)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--bg-page)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
          }}
        >
          Plano de IA para essa fase
        </button>
      </div>
    </div>
  );
}
