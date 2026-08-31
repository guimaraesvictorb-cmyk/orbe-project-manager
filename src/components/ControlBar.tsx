import { Search } from "lucide-react";

type FilterType = "todas" | "venda" | "operacao" | "saida";

interface ControlBarProps {
  search: string;
  onSearchChange: (val: string) => void;
  activeFilter: FilterType;
  onFilterChange: (f: FilterType) => void;
}

const FILTERS: { label: string; value: FilterType }[] = [
  { label: "Todas", value: "todas" },
  { label: "Venda", value: "venda" },
  { label: "Operação", value: "operacao" },
  { label: "Saída", value: "saida" },
];

export function ControlBar({
  search,
  onSearchChange,
  activeFilter,
  onFilterChange,
}: ControlBarProps) {
  return (
    <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
      <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar fase, ritual ou skill..."
            aria-label="Buscar fase, ritual ou skill"
            className="w-full bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] rounded-md pl-9 pr-4 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] transition-colors duration-150"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-shrink-0">
          {FILTERS.map((f) => {
            const isActive = activeFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => onFilterChange(f.value)}
                className="px-3 py-2 rounded-md text-xs font-medium tracking-wide transition-all duration-150 border focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                style={
                  isActive
                    ? {
                        backgroundColor: "var(--accent)",
                        color: "var(--bg-page)",
                        borderColor: "var(--accent)",
                      }
                    : {
                        backgroundColor: "transparent",
                        color: "var(--text-primary)",
                        borderColor: "var(--border-subtle)",
                      }
                }
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      "var(--border-subtle)";
                }}
                aria-pressed={isActive}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
