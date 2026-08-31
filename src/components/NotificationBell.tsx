import { useState, useRef, useEffect } from "react";
import { Bell, Clock, AlertTriangle, X, Check } from "lucide-react";
import { useNotifications, type AppNotification } from "../hooks/useNotifications";

interface NotificationBellProps {
  onSelectTask: (id: string) => void;
  onSelectClient: (id: string) => void;
}

export function NotificationBell({ onSelectTask, onSelectClient }: NotificationBellProps) {
  const { notifications, dismiss, dismissAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleSelect(n: AppNotification) {
    if (n.type === "task_overdue") onSelectTask(n.targetId);
    else onSelectClient(n.targetId);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg transition-colors"
        style={{ color: "var(--text-secondary)" }}
        aria-label="Notificações"
      >
        <Bell size={18} />
        {notifications.length > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center text-[9px] font-bold rounded-full"
            style={{ width: 16, height: 16, backgroundColor: "var(--danger)", color: "#000" }}
          >
            {notifications.length > 9 ? "9+" : notifications.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded-2xl overflow-hidden z-50"
          style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-strong)" }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold text-[var(--text-primary)]">Notificações</p>
            {notifications.length > 0 && (
              <button onClick={dismissAll} className="text-[10px] font-medium flex items-center gap-1" style={{ color: "var(--text-tertiary)" }}>
                <Check size={11} />Marcar todas como vistas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs" style={{ color: "var(--text-tertiary)" }}>
                Tudo em dia por aqui.
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-2.5 px-4 py-3 transition-colors cursor-pointer"
                  style={{ borderBottom: "1px solid var(--border)" }}
                  onClick={() => handleSelect(n)}
                >
                  <span
                    className="flex-shrink-0 mt-0.5"
                    style={{ color: n.type === "task_overdue" ? "var(--danger)" : "var(--warning)" }}
                  >
                    {n.type === "task_overdue" ? <Clock size={14} /> : <AlertTriangle size={14} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">{n.title}</p>
                    <p className="text-[10px] truncate" style={{ color: "var(--text-tertiary)" }}>{n.subtitle}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                    className="flex-shrink-0 p-1 rounded"
                    style={{ color: "var(--text-quaternary)" }}
                    aria-label="Dispensar"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
