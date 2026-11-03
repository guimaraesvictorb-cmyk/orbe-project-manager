import { useEffect, useState } from "react";
import {
  Sparkles, LayoutDashboard, CheckSquare, Users, DollarSign,
  TrendingUp, BookOpen, Building2, UserCircle, LogOut, ShieldCheck,
  ChevronRight, Settings, PenTool, Bot, MessageSquare, UserPlus, Trophy, Brain, Images,
  PanelLeftClose, PanelLeftOpen, MoreHorizontal, X,
} from "lucide-react";
import type { Profile } from "../lib/database.types";
import { getAllowedSections, isAdminOrCoordenador } from "../lib/permissions";
import { OrbeMark } from "./OrbeMark";

export type AppView =
  | "home" | "dashboard"
  | "tarefas" | "clientes"
  | "financeiro" | "roi-day"
  | "pipeline"
  | "processos" | "central"
  | "rastreamento"
  | "super-agente" | "copy-ia" | "relatorios"
  | "whatsapp"
  | "leads-capturados"
  | "campanhas" | "segundo-cerebro" | "criativos"
  | "profile" | "settings";

interface NavItem { view: AppView; label: string; icon: React.ReactNode; children?: NavItem[] }
interface NavGroup { label?: string; items: NavItem[]; compact?: boolean }

const NAV: NavGroup[] = [
  { label: "Pessoas e operação", items: [
    { view: "dashboard", label: "Visão geral", icon: <LayoutDashboard size={15} /> },
    { view: "tarefas", label: "Tarefas", icon: <CheckSquare size={15} /> },
    { view: "clientes", label: "Clientes", icon: <Users size={15} /> },
    { view: "financeiro", label: "Financeiro", icon: <DollarSign size={15} /> },
  ] },
  { label: "Ferramentas de IA", items: [
    { view: "home", label: "Orbe AI", icon: <Sparkles size={15} /> },
    { view: "segundo-cerebro", label: "Segundo cérebro", icon: <Brain size={15} /> },
    { view: "criativos", label: "Criativos", icon: <Images size={15} /> },
  ] },
  { label: "Comunicação", items: [
    { view: "whatsapp", label: "Relatórios no WhatsApp", icon: <MessageSquare size={15} /> },
    { view: "pipeline", label: "CRM · Oportunidades", icon: <TrendingUp size={15} /> },
    { view: "leads-capturados", label: "Leads do WhatsApp", icon: <UserPlus size={15} /> },
  ] },
  { label: "Mais ferramentas", compact: true, items: [
    { view: "super-agente", label: "Super Agente", icon: <Bot size={15} /> },
    { view: "copy-ia", label: "Copy IA", icon: <PenTool size={15} /> },
    { view: "roi-day", label: "ROI Day", icon: <Trophy size={15} /> },
    { view: "processos", label: "Processos", icon: <BookOpen size={15} /> },
    { view: "central", label: "Pessoas e Central Orbe", icon: <Building2 size={15} /> },
  ] },
];

function NavSection({ group, active, children }: { group: NavGroup; active: AppView; children: React.ReactNode }) {
  const label = <span className="app-nav-label text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--text-quaternary)" }}>{group.label}</span>;
  if (group.compact) {
    return (
      <details open={group.items.some(item => item.view === active)} className="group/nav">
        <summary aria-label={group.label} className="app-nav-more mb-1.5 cursor-pointer list-none px-2">
          <MoreHorizontal size={16} className="app-nav-compact-more" />
          {label}
          <ChevronRight size={11} className="app-nav-label float-right mt-1 text-[var(--text-tertiary)] transition-transform group-open/nav:rotate-90" />
        </summary>
        {children}
      </details>
    );
  }
  return <section aria-label={group.label}><p className="app-nav-section-heading mb-1.5 px-2">{label}</p>{children}</section>;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", coordenador: "Coord", gt: "GT", gp: "GP",
};

interface AppNavProps {
  active: AppView;
  onChange: (v: AppView) => void;
  profile: Profile | null;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const NAV_MODE_KEY = "orbe_nav_mode";

function initialCollapsed() {
  try {
    const saved = localStorage.getItem(NAV_MODE_KEY);
    if (saved) return saved === "collapsed";
  } catch { /* Navigation stays usable if browser storage is unavailable. */ }
  return /[?&]cliente=|^#\/?clientes\//.test(window.location.hash);
}

function rememberCollapsed(collapsed: boolean) {
  try { localStorage.setItem(NAV_MODE_KEY, collapsed ? "collapsed" : "expanded"); }
  catch { /* Persistence is optional; the current session still works. */ }
}

export function AppNav({ active, onChange, profile, onLogout, isOpen, onClose }: AppNavProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [hovered, setHovered] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const expanded = !collapsed || hovered || keyboardFocus;

  function collapse() {
    setCollapsed(true);
    setHovered(false);
    setKeyboardFocus(false);
    rememberCollapsed(true);
  }

  // Includes client selection, workspace tabs and browser back/forward, which
  // navigate without going through the main menu's onChange handler.
  useEffect(() => {
    function onNavigate() {
      setCollapsed(true);
      setHovered(false);
      setKeyboardFocus(false);
      rememberCollapsed(true);
    }
    window.addEventListener("hashchange", onNavigate);
    return () => window.removeEventListener("hashchange", onNavigate);
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    setHovered(false);
    setKeyboardFocus(false);
    rememberCollapsed(next);
  }

  const allowed = getAllowedSections(profile);
  const visibleNav = NAV
    .map((group) => ({
      ...group,
      items: group.items
        .map((item) => ({
          ...item,
          children: item.children?.filter((child) => allowed.includes(child.view)),
        }))
        .filter((item) => item.view === "home" || allowed.includes(item.view) || Boolean(item.children?.length)),
    }))
    .filter((group) => group.items.length > 0);

  function handleChange(v: AppView) {
    collapse();
    onChange(v);
    onClose();
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={onClose}
        />
      )}
      <div className="app-nav-shell no-print" data-collapsed={collapsed} data-expanded={expanded}>
      <aside
        aria-label="Menu principal"
        onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(true); }}
        onPointerLeave={() => setHovered(false)}
        onFocusCapture={(event) => {
          if (event.target.matches(":focus-visible")) setKeyboardFocus(true);
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setKeyboardFocus(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") { collapse(); onClose(); }
        }}
        className={`app-nav-panel flex flex-col h-screen fixed inset-y-0 left-0 z-40 lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          background: "linear-gradient(180deg, var(--bg-surface), var(--bg-page) 130%)",
          borderRight: "1px solid var(--border)",
          boxShadow: "16px 0 48px -28px var(--glow-strong)",
        }}
      >
      {/* The compact rail keeps every main destination reachable. */}
      <div className="app-nav-header relative flex-shrink-0" style={{ borderBottom: "1px solid var(--accent-a22)" }}>
      <button
        onClick={() => handleChange("dashboard")}
        className="app-nav-brand flex items-center gap-3 px-5 py-5 text-left focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
        aria-label="Ir para o Dashboard"
      >
        <OrbeMark size={32} className="flex-shrink-0" animated glow />
        <div className="app-nav-label">
          <p className="font-display font-bold text-base leading-none tracking-wide text-[var(--text-primary)]">ORBE</p>
          <p className="text-[10px] leading-tight mt-1" style={{ color: "var(--text-quaternary)" }}>Operating System</p>
        </div>
      </button>
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Manter menu lateral aberto" : "Recolher menu lateral"}
        aria-expanded={expanded}
        aria-controls="orbe-main-navigation"
        title={collapsed ? "Manter menu aberto" : "Recolher menu"}
        className="app-nav-toggle hidden lg:flex items-center justify-center rounded-lg hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)]"
      >
        {collapsed ? <PanelLeftOpen size={17} className="flex-shrink-0" /> : <PanelLeftClose size={17} className="flex-shrink-0" />}
        <span className="app-nav-label text-[11px] whitespace-nowrap">{collapsed ? "Manter aberto" : "Recolher menu"}</span>
      </button>
      <button type="button" onClick={onClose} aria-label="Fechar menu" className="app-nav-toggle app-nav-mobile-close flex lg:hidden items-center justify-center rounded-lg text-[var(--text-secondary)]"><X size={18} /></button>
      </div>

      {/* Navigation */}
      <nav id="orbe-main-navigation" aria-label="Navegação principal" className="flex-1 min-h-0 px-3 py-4 space-y-5 overflow-y-auto overflow-x-hidden">
        {visibleNav.map((group, gi) => (
          <NavSection key={gi} group={group} active={active}>
            <div className="space-y-0.5">
              {group.items.map(({ view, label, icon, children }) => {
                const isActive = active === view || view === "whatsapp" && active === "relatorios";
                return (
                  <div key={view}>
                    <button
                      onClick={() => handleChange(view)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs font-medium transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                      style={{
                        background: isActive ? "linear-gradient(135deg, var(--accent-tint), transparent)" : "transparent",
                        boxShadow: isActive ? "0 0 0 1px var(--accent-a33), 0 4px 16px -6px var(--glow-strong)" : "none",
                        color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
                        transform: isActive ? "translateX(1px)" : "none",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-surface-2)";
                          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)";
                        }
                      }}
                      aria-label={label}
                      title={label}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className="flex-shrink-0" style={{ color: isActive ? "var(--accent)" : "inherit", filter: isActive ? "drop-shadow(0 0 6px var(--accent-a44))" : "none" }}>{icon}</span>
                      <span className="app-nav-label whitespace-nowrap">{label}</span>
                      {isActive && (
                        <ChevronRight size={11} className="app-nav-label ml-auto flex-shrink-0" style={{ color: "var(--accent)" }} />
                      )}
                    </button>
                    {children?.length ? (
                      <div className="app-nav-label ml-5 mt-0.5 border-l border-[var(--border)] pl-2 space-y-0.5">
                        {children.map((child) => {
                          const childActive = active === child.view;
                          return (
                            <button
                              key={child.view}
                              onClick={() => handleChange(child.view)}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                              style={{
                                backgroundColor: childActive ? "var(--accent-tint)" : "transparent",
                                color: childActive ? "var(--accent)" : "var(--text-quaternary)",
                              }}
                              aria-current={childActive ? "page" : undefined}
                            >
                              {child.icon}
                              {child.label}
                              {childActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </NavSection>
        ))}
      </nav>

      {/* User section */}
      <div className="app-nav-account flex-shrink-0 px-3 pb-4 pt-3 space-y-0.5" style={{ borderTop: "1px solid var(--bg-surface-2)" }}>
        <button
          onClick={() => handleChange("profile")}
          aria-label={profile?.display_name ?? "Meu perfil"}
          title="Meu perfil"
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all duration-100 focus:outline-none"
          style={{
            backgroundColor: active === "profile" ? "var(--accent-tint)" : "transparent",
            color: active === "profile" ? "var(--text-primary)" : "var(--text-tertiary)",
          }}
          onMouseEnter={(e) => {
            if (active !== "profile") {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-surface-2)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
            }
          }}
          onMouseLeave={(e) => {
            if (active !== "profile") {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)";
            }
          }}
        >
          <UserCircle size={15} style={{ color: active === "profile" ? "var(--accent)" : "inherit", flexShrink: 0 }} />
          <div className="app-nav-label min-w-0 flex-1">
            <p className="text-xs font-medium leading-tight truncate" style={{ color: "inherit" }}>
              {profile?.display_name ?? "Meu perfil"}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              {profile?.role === "admin" && <ShieldCheck size={9} style={{ color: "var(--accent)" }} />}
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--text-quaternary)" }}>
                {ROLE_LABELS[profile?.role ?? ""] ?? profile?.role}
              </p>
            </div>
          </div>
          {active === "profile" && (
            <ChevronRight size={11} className="app-nav-label flex-shrink-0" style={{ color: "var(--accent)" }} />
          )}
        </button>

        {isAdminOrCoordenador(profile) && (
          <button
            onClick={() => handleChange("settings")}
            aria-label="Configurações"
            title="Configurações"
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs transition-all duration-100 focus:outline-none"
            style={{
              backgroundColor: active === "settings" ? "var(--accent-tint)" : "transparent",
              color: active === "settings" ? "var(--text-primary)" : "var(--text-tertiary)",
            }}
            onMouseEnter={(e) => {
              if (active !== "settings") {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-surface-2)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
              }
            }}
            onMouseLeave={(e) => {
              if (active !== "settings") {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)";
              }
            }}
          >
            <Settings size={13} style={{ color: active === "settings" ? "var(--accent)" : "inherit" }} />
            <span className="app-nav-label whitespace-nowrap">Configurações</span>
            {active === "settings" && (
              <ChevronRight size={11} className="app-nav-label ml-auto flex-shrink-0" style={{ color: "var(--accent)" }} />
            )}
          </button>
        )}

        <button
          onClick={onLogout}
          aria-label="Sair"
          title="Sair"
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs transition-all duration-100 focus:outline-none"
          style={{ color: "var(--text-quaternary)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)";
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "color-mix(in srgb, var(--danger) 12%, transparent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-quaternary)";
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
          }}
        >
          <LogOut size={13} className="flex-shrink-0" />
          <span className="app-nav-label">Sair</span>
        </button>
      </div>
      </aside>
      </div>
    </>
  );
}
