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
    <div className="px-6 py-4 border-b border-[#262626]">
      <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar fase, ritual ou skill..."
            aria-label="Buscar fase, ritual ou skill"
            className="w-full bg-[#131313] border border-[#262626] rounded-md pl-9 pr-4 py-2 text-sm text-white placeholder-[#A3A3A3] focus:outline-none focus:border-[#7B61FF] transition-colors duration-150"
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
                className="px-3 py-2 rounded-md text-xs font-medium tracking-wide transition-all duration-150 border focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B61FF]"
                style={
                  isActive
                    ? {
                        backgroundColor: "#7B61FF",
                        color: "#000000",
                        borderColor: "#7B61FF",
                      }
                    : {
                        backgroundColor: "transparent",
                        color: "#ffffff",
                        borderColor: "#262626",
                      }
                }
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      "#7B61FF";
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      "#262626";
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
