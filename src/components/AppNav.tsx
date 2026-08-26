import {
  Sparkles, LayoutDashboard, CheckSquare, Users, DollarSign,
  TrendingUp, BookOpen, Building2, UserCircle, LogOut, ShieldCheck,
  ChevronRight, Settings, Link2, PenTool, FileText, Bot, MessageSquare, Plug, UserPlus,
} from "lucide-react";
import type { Profile } from "../lib/database.types";

export type AppView =
  | "home" | "dashboard"
  | "tarefas" | "clientes"
  | "financeiro"
  | "pipeline"
  | "processos" | "central"
  | "rastreamento"
  | "super-agente" | "copy-ia" | "relatorios"
  | "whatsapp" | "integracoes"
  | "leads-capturados"
  | "profile" | "settings";

interface NavItem { view: AppView; label: string; icon: React.ReactNode }
interface NavGroup { label?: string; items: NavItem[] }

const NAV: NavGroup[] = [
  {
    items: [
      { view: "home",      label: "Orbe AI",     icon: <Sparkles size={15} /> },
      { view: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={15} /> },
    ],
  },
  {
    label: "Operação",
    items: [
      { view: "tarefas",  label: "Tarefas",  icon: <CheckSquare size={15} /> },
      { view: "clientes", label: "Clientes", icon: <Users size={15} /> },
    ],
  },
  {
    items: [
      { view: "financeiro", label: "Financeiro", icon: <DollarSign size={15} /> },
    ],
  },
  {
    label: "Comercial",
    items: [
      { view: "pipeline",         label: "Oportunidades",   icon: <TrendingUp size={15} /> },
      { view: "leads-capturados", label: "Leads Capturados", icon: <UserPlus size={15} /> },
    ],
  },
  {
    items: [
      { view: "processos",    label: "Processos",    icon: <BookOpen size={15} /> },
      { view: "central",      label: "Central",      icon: <Building2 size={15} /> },
      { view: "rastreamento", label: "Rastreamento", icon: <Link2 size={15} /> },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { view: "whatsapp",    label: "WhatsApp",    icon: <MessageSquare size={15} /> },
      { view: "integracoes", label: "Integrações", icon: <Plug size={15} /> },
    ],
  },
  {
    label: "Ferramentas IA",
    items: [
      { view: "super-agente", label: "Super Agente", icon: <Bot size={15} /> },
      { view: "copy-ia",      label: "Copy IA",      icon: <PenTool size={15} /> },
      { view: "relatorios",   label: "Relatórios",   icon: <FileText size={15} /> },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", coordenador: "Coord", gt: "GT", gp: "GP",
};

interface AppNavProps {
  active: AppView;
  onChange: (v: AppView) => void;
  profile: Profile | null;
  onLogout: () => void;
}

export function AppNav({ active, onChange, profile, onLogout }: AppNavProps) {
  return (
    <aside
      className="flex flex-col flex-shrink-0 h-screen overflow-y-auto"
      style={{ width: 260, backgroundColor: "#050505", borderRight: "1px solid #111" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 flex-shrink-0" style={{ borderBottom: "1px solid #111" }}>
        <div
          className="text-xl font-bold leading-none select-none flex-shrink-0"
          style={{ fontFamily: "Arial, sans-serif", letterSpacing: "-2px" }}
        >
          <span className="text-white">M</span>
          <span style={{ color: "#1FCE4A" }}>5</span>
        </div>
        <div>
          <p className="text-white font-semibold text-xs leading-tight">Operating System</p>
          <p className="text-[10px] leading-tight" style={{ color: "#444" }}>Plataforma Orbe</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAV.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="text-[9px] font-bold tracking-widest uppercase px-2 mb-1.5" style={{ color: "#333" }}>
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ view, label, icon }) => {
                const isActive = active === view;
                return (
                  <button
                    key={view}
                    onClick={() => onChange(view)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs font-medium transition-all duration-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#1FCE4A]"
                    style={{
                      backgroundColor: isActive ? "#0d1f14" : "transparent",
                      color: isActive ? "#fff" : "#555",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#0a0a0a";
                        (e.currentTarget as HTMLButtonElement).style.color = "#A3A3A3";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                        (e.currentTarget as HTMLButtonElement).style.color = "#555";
                      }
                    }}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span style={{ color: isActive ? "#1FCE4A" : "inherit" }}>{icon}</span>
                    {label}
                    {isActive && (
                      <ChevronRight size={11} className="ml-auto flex-shrink-0" style={{ color: "#1FCE4A" }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="flex-shrink-0 px-3 pb-4 pt-3 space-y-0.5" style={{ borderTop: "1px solid #111" }}>
        <button
          onClick={() => onChange("profile")}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all duration-100 focus:outline-none"
          style={{
            backgroundColor: active === "profile" ? "#0d1f14" : "transparent",
            color: active === "profile" ? "#fff" : "#555",
          }}
          onMouseEnter={(e) => {
            if (active !== "profile") {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#0a0a0a";
              (e.currentTarget as HTMLButtonElement).style.color = "#A3A3A3";
            }
          }}
          onMouseLeave={(e) => {
            if (active !== "profile") {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "#555";
            }
          }}
        >
          <UserCircle size={15} style={{ color: active === "profile" ? "#1FCE4A" : "inherit", flexShrink: 0 }} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium leading-tight truncate" style={{ color: "inherit" }}>
              {profile?.display_name ?? "Meu perfil"}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              {profile?.role === "admin" && <ShieldCheck size={9} style={{ color: "#1FCE4A" }} />}
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#333" }}>
                {ROLE_LABELS[profile?.role ?? ""] ?? profile?.role}
              </p>
            </div>
          </div>
          {active === "profile" && (
            <ChevronRight size={11} className="flex-shrink-0" style={{ color: "#1FCE4A" }} />
          )}
        </button>

        {(profile?.role === "admin" || profile?.role === "coordenador") && (
          <button
            onClick={() => onChange("settings")}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs transition-all duration-100 focus:outline-none"
            style={{
              backgroundColor: active === "settings" ? "#0d1f14" : "transparent",
              color: active === "settings" ? "#fff" : "#555",
            }}
            onMouseEnter={(e) => {
              if (active !== "settings") {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#0a0a0a";
                (e.currentTarget as HTMLButtonElement).style.color = "#A3A3A3";
              }
            }}
            onMouseLeave={(e) => {
              if (active !== "settings") {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "#555";
              }
            }}
          >
            <Settings size={13} style={{ color: active === "settings" ? "#1FCE4A" : "inherit" }} />
            Configurações
            {active === "settings" && (
              <ChevronRight size={11} className="ml-auto flex-shrink-0" style={{ color: "#1FCE4A" }} />
            )}
          </button>
        )}

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs transition-all duration-100 focus:outline-none"
          style={{ color: "#333" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#ef4444";
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1a0505";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#333";
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
          }}
        >
          <LogOut size={13} />
          Sair
        </button>
      </div>
    </aside>
  );
}
