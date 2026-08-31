import { AI_STACK } from "../data/m5os";
import { Sparkles } from "lucide-react";

export function StackSection() {
  return (
    <section aria-labelledby="stack-title">
      <h2
        id="stack-title"
        className="text-xs font-bold tracking-widest uppercase mb-4"
        style={{ color: "#7B61FF" }}
      >
        Stack de IA Orbe
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {AI_STACK.map((skill) => (
          <div
            key={skill.name}
            className="relative rounded-xl p-4 transition-all duration-150"
            style={{
              backgroundColor: "#131313",
              border: `1px solid ${skill.isNew ? "#7B61FF" : "#262626"}`,
            }}
          >
            {/* NEW badge */}
            {skill.isNew && (
              <span
                className="absolute top-3 right-3 text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded flex items-center gap-1"
                style={{ backgroundColor: "#7B61FF", color: "#000000" }}
              >
                <Sparkles size={8} aria-hidden="true" />
                NEW
              </span>
            )}

            <p className="text-white font-semibold text-sm leading-snug mb-1 pr-12">
              {skill.name}
            </p>
            <p className="text-[#A3A3A3] text-xs leading-relaxed">
              {skill.phases}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
