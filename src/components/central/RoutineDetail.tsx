import { ArrowLeft, Target, CheckSquare } from "lucide-react";
import type { Routine } from "../../data/routines";

interface RoutineDetailProps {
  routine: Routine;
  onBack: () => void;
}

const FREQ_ICON: Record<string, string> = {
  Diariamente: "D",
  Semanalmente: "S",
  Quinzenalmente: "Q",
  Mensalmente: "M",
  Trimestral: "T",
  "PDI Contínuo": "PDI",
  "Conforme necessidade": "∞",
};

export function RoutineDetail({ routine, onBack }: RoutineDetailProps) {
  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs text-[#555] hover:text-white transition-colors duration-150 mb-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B61FF] rounded"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          Voltar para Processos
        </button>

        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
            style={{ backgroundColor: routine.color + "33", border: `1px solid ${routine.color}55` }}
          >
            <span style={{ color: routine.color }}>{routine.shortRole}</span>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: routine.color }}>
              Rotina
            </p>
            <h2 className="text-white font-bold text-xl leading-tight">{routine.role}</h2>
            {routine.objective && (
              <p className="text-xs mt-1 leading-relaxed max-w-2xl" style={{ color: "#A3A3A3" }}>
                {routine.objective}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Description blockquote */}
      <div
        className="px-4 py-3 rounded-xl text-sm italic leading-relaxed"
        style={{ borderLeft: `3px solid ${routine.color}`, backgroundColor: "#060a06", color: "#d4d4d4" }}
      >
        {routine.description}
      </div>

      {/* Blocks */}
      <div className="space-y-5">
        {routine.blocks.map((block, bIdx) => (
          <div key={bIdx}>
            {/* Frequency header */}
            <div className="flex items-center gap-3 mb-3">
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                style={{ backgroundColor: block.freqColor + "22", color: block.freqColor, border: `1px solid ${block.freqColor}44` }}
              >
                {FREQ_ICON[block.frequency] ?? "•"}
              </span>
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: block.freqColor }}>
                {block.frequency}
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: block.freqColor + "22" }} />
            </div>

            {/* Items */}
            <ul className="space-y-2 pl-10" role="list">
              {block.items.map((item, iIdx) => (
                <li key={iIdx}>
                  <div className="flex items-start gap-2">
                    <CheckSquare
                      size={13}
                      className="flex-shrink-0 mt-0.5"
                      style={{ color: block.freqColor }}
                      aria-hidden="true"
                    />
                    <span className="text-sm text-white leading-snug">{item.text}</span>
                  </div>
                  {item.subItems && (
                    <ul className="mt-1.5 ml-5 space-y-1" role="list">
                      {item.subItems.map((sub, sIdx) => (
                        <li key={sIdx} className="flex items-start gap-2">
                          <span
                            className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0"
                            style={{ backgroundColor: "#444" }}
                            aria-hidden="true"
                          />
                          <span className="text-xs leading-relaxed" style={{ color: "#A3A3A3" }}>
                            {sub}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Goals table */}
      {routine.goals && routine.goals.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target size={14} style={{ color: "#7B61FF" }} aria-hidden="true" />
            <h3 className="text-xs font-bold tracking-widest uppercase" style={{ color: "#7B61FF" }}>
              Metas do {routine.shortRole}
            </h3>
          </div>
          <div className="rounded-xl overflow-hidden border border-[#1e1e1e]">
            <table className="w-full" role="table">
              <thead>
                <tr style={{ backgroundColor: "#0d0d0d", borderBottom: "1px solid #1e1e1e" }}>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold tracking-widest uppercase text-[#555]" scope="col">Indicador</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold tracking-widest uppercase text-[#555]" scope="col">Meta</th>
                </tr>
              </thead>
              <tbody>
                {routine.goals.map((goal, idx) => (
                  <tr
                    key={idx}
                    style={{
                      backgroundColor: idx % 2 === 0 ? "#080808" : "#0a0a0a",
                      borderBottom: idx < routine.goals!.length - 1 ? "1px solid #111" : "none",
                    }}
                  >
                    <td className="px-4 py-2.5 text-sm text-white">{goal.indicator}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-xs font-semibold" style={{ color: "#7B61FF" }}>
                        {goal.target}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notes */}
      {routine.notes && routine.notes.length > 0 && (
        <div
          className="rounded-xl p-4 space-y-2 border border-[#1e1e1e]"
          style={{ backgroundColor: "#080808" }}
        >
          <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: "#555" }}>
            Observações
          </p>
          {routine.notes.map((note, idx) => (
            <p key={idx} className="text-xs leading-relaxed" style={{ color: "#A3A3A3" }}>
              — {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
