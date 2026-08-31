import { NEXT_ACTIONS } from "../data/m5os";
import { ArrowRight } from "lucide-react";

export function ActionsSection() {
  return (
    <section aria-labelledby="actions-title">
      <h2
        id="actions-title"
        className="text-xs font-bold tracking-widest uppercase mb-4"
        style={{ color: "#7B61FF" }}
      >
        Próximas Ações
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {NEXT_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => alert("Em breve")}
            className="group flex items-center justify-between gap-3 rounded-xl px-4 py-4 text-left transition-all duration-150 border focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B61FF]"
            style={{
              backgroundColor: "#131313",
              borderColor: "#262626",
              color: "#ffffff",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = "#7B61FF";
              el.style.backgroundColor = "#1A1A1A";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = "#262626";
              el.style.backgroundColor = "#131313";
            }}
          >
            <span className="text-sm font-medium leading-snug">{action.label}</span>
            <ArrowRight
              size={14}
              className="flex-shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
              style={{ color: "#7B61FF" }}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </section>
  );
}
