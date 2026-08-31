import { useState, useEffect, useRef, useMemo } from "react";
import { Search, Users, CheckSquare, CornerDownLeft } from "lucide-react";
import { useClients } from "../hooks/useClients";
import { useTasks } from "../hooks/useTasks";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelectClient: (id: string) => void;
  onSelectTask: (id: string) => void;
}

type Result =
  | { kind: "client"; id: string; title: string; subtitle: string }
  | { kind: "task"; id: string; title: string; subtitle: string };

export function CommandPalette({ open, onClose, onSelectClient, onSelectTask }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { clients } = useClients();
  const { tasks } = useTasks({});

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const clientResults: Result[] = clients
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((c) => ({ kind: "client", id: c.id, title: c.name, subtitle: c.segment ?? "Cliente" }));

    const clientNameById = new Map(clients.map((c) => [c.id, c.name]));
    const taskResults: Result[] = tasks
      .filter((t) => !t.parent_task_id && t.title.toLowerCase().includes(q))
      .slice(0, 6)
      .map((t) => ({ kind: "task", id: t.id, title: t.title, subtitle: clientNameById.get(t.client_id) ?? "Tarefa" }));

    return [...clientResults, ...taskResults];
  }, [query, clients, tasks]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function select(r: Result) {
    if (r.kind === "client") onSelectClient(r.id);
    else onSelectTask(r.id);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); return; }
    if (e.key === "Enter") { e.preventDefault(); if (results[activeIndex]) select(results[activeIndex]); }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-strong)" }}
      >
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: results.length > 0 ? "1px solid var(--border)" : "none" }}>
          <Search size={16} style={{ color: "var(--text-tertiary)" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar clientes ou tarefas..."
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-quaternary)] focus:outline-none"
          />
          <kbd className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-quaternary)" }}>
            ESC
          </kbd>
        </div>

        {query.trim() && results.length === 0 && (
          <p className="px-4 py-6 text-center text-xs" style={{ color: "var(--text-tertiary)" }}>
            Nada encontrado para "{query}"
          </p>
        )}

        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto py-1.5">
            {results.map((r, i) => (
              <button
                key={`${r.kind}-${r.id}`}
                onClick={() => select(r)}
                onMouseEnter={() => setActiveIndex(i)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                style={{ backgroundColor: i === activeIndex ? "var(--accent-tint)" : "transparent" }}
              >
                <span className="flex-shrink-0" style={{ color: i === activeIndex ? "var(--accent)" : "var(--text-tertiary)" }}>
                  {r.kind === "client" ? <Users size={14} /> : <CheckSquare size={14} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">{r.title}</p>
                  <p className="text-[10px] truncate" style={{ color: "var(--text-tertiary)" }}>{r.subtitle}</p>
                </div>
                {i === activeIndex && <CornerDownLeft size={12} className="flex-shrink-0" style={{ color: "var(--accent)" }} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
