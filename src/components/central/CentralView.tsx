import { useState } from "react";
import {
  Users, Heart, Package, Palette, Cpu, DollarSign, TrendingUp,
  FolderOpen, List, Link2, Video, ChevronDown, ChevronRight,
  Users2, Lock,
} from "lucide-react";
import { ProcessosView } from "./ProcessosView";
import { ProcessosClienteView } from "./ProcessosClienteView";
import { ClientesSection } from "../ClientesSection";
import { Footer } from "../Footer";

type SectionId = "pp" | "cs" | "ops" | "criativos" | "tech" | "financeiro" | "comercial" | "clientes";
type ItemId =
  | "ops-projetos" | "ops-processos" | "ops-links" | "ops-reunioes"
  | "cs-churn" | "cs-jornada" | "cs-processos"
  | "pp-main"
  | "clientes-carteira";

interface SidebarItem {
  id: ItemId;
  label: string;
  icon?: React.ReactNode;
}

interface SidebarSection {
  id: SectionId;
  label: string;
  verified?: boolean;
  icon: React.ReactNode;
  color: string;
  items: SidebarItem[];
}

const SECTIONS: SidebarSection[] = [
  {
    id: "pp",
    label: "P&P Central",
    verified: true,
    icon: <Users size={14} />,
    color: "#8B5CF6",
    items: [{ id: "pp-main", label: "P&P", icon: <Users size={12} /> }],
  },
  {
    id: "cs",
    label: "C.S",
    verified: true,
    icon: <Heart size={14} />,
    color: "#EC4899",
    items: [
      { id: "cs-churn",     label: "Dossiê do Churn",       icon: <FolderOpen size={12} /> },
      { id: "cs-jornada",   label: "Jornada do Cliente",     icon: <List size={12} /> },
      { id: "cs-processos", label: "Processos de Cliente",   icon: <List size={12} /> },
    ],
  },
  {
    id: "clientes",
    label: "Clientes",
    icon: <Users2 size={14} />,
    color: "var(--accent)",
    items: [{ id: "clientes-carteira", label: "Carteira de Clientes", icon: <Users2 size={12} /> }],
  },
  {
    id: "ops",
    label: "OPS",
    icon: <Package size={14} />,
    color: "var(--warning)",
    items: [
      { id: "ops-projetos", label: "Central de Projetos", icon: <FolderOpen size={12} /> },
      { id: "ops-processos", label: "Processos", icon: <List size={12} /> },
      { id: "ops-links", label: "Links Úteis", icon: <Link2 size={12} /> },
      { id: "ops-reunioes", label: "Reuniões", icon: <Video size={12} /> },
    ],
  },
  {
    id: "criativos",
    label: "Criativos",
    verified: true,
    icon: <Palette size={14} />,
    color: "#06B6D4",
    items: [
      { id: "pp-main", label: "Processos Criativos", icon: <List size={12} /> },
    ] as SidebarItem[],
  },
  {
    id: "tech",
    label: "Tech",
    icon: <Cpu size={14} />,
    color: "#10B981",
    items: [
      { id: "ops-projetos", label: "Central Tech OPS", icon: <FolderOpen size={12} /> },
      { id: "ops-reunioes", label: "Reuniões", icon: <Video size={12} /> },
    ] as SidebarItem[],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    verified: true,
    icon: <DollarSign size={14} />,
    color: "var(--success)",
    items: [
      { id: "pp-main", label: "Processo de Remuneração", icon: <List size={12} /> },
      { id: "pp-main", label: "Adiantamento e Reembolso", icon: <List size={12} /> },
      { id: "ops-reunioes", label: "Reuniões", icon: <Video size={12} /> },
    ] as SidebarItem[],
  },
  {
    id: "comercial",
    label: "Comercial",
    verified: true,
    icon: <TrendingUp size={14} />,
    color: "#F97316",
    items: [
      { id: "pp-main", label: "Ferramentas", icon: <List size={12} /> },
      { id: "pp-main", label: "Links e Senhas", icon: <Link2 size={12} /> },
      { id: "pp-main", label: "Cases", icon: <FolderOpen size={12} /> },
    ] as SidebarItem[],
  },
];

const IMPLEMENTED: ItemId[] = ["ops-processos", "clientes-carteira", "cs-processos"];

function PlaceholderContent({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 space-y-3">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-strong)" }}
      >
        <Lock size={20} style={{ color: "var(--text-quaternary)" }} aria-hidden="true" />
      </div>
      <p className="text-white font-semibold">{label}</p>
      <p className="text-xs" style={{ color: "var(--text-quaternary)" }}>
        Em construção — em breve disponível
      </p>
    </div>
  );
}

export function CentralView() {
  const [openSections, setOpenSections] = useState<Set<SectionId>>(
    new Set(["ops", "clientes"])
  );
  const [activeItem, setActiveItem] = useState<ItemId>("ops-processos");
  const [activeItemLabel, setActiveItemLabel] = useState("Processos");

  function toggleSection(id: SectionId) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectItem(id: ItemId, label: string) {
    setActiveItem(id);
    setActiveItemLabel(label);
  }

  function renderContent() {
    if (activeItem === "ops-processos") return <ProcessosView />;
    if (activeItem === "clientes-carteira") return <ClientesSection />;
    if (activeItem === "cs-processos") return <ProcessosClienteView />;
    return <PlaceholderContent label={activeItemLabel} />;
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className="w-52 flex-shrink-0 border-r overflow-y-auto"
        style={{ borderColor: "var(--border)", backgroundColor: "#060606" }}
        aria-label="Central de Operação — navegação"
      >
        {/* Sidebar header */}
        <div className="px-4 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "var(--accent)" }}>
            Central de Operação
          </p>
        </div>

        <nav className="py-2">
          {SECTIONS.map((section) => {
            const isOpen = openSections.has(section.id);
            return (
              <div key={section.id}>
                {/* Section header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors duration-150 focus:outline-none group"
                  style={{ color: isOpen ? "var(--text-primary)" : "var(--text-secondary)" }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)")
                  }
                  onMouseLeave={(e) => {
                    if (!isOpen)
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
                  }}
                >
                  <span style={{ color: section.color }}>{section.icon}</span>
                  <span className="flex-1 text-xs font-semibold">
                    {section.label}
                    {section.verified && (
                      <span
                        className="ml-1.5 text-[8px] font-bold tracking-widest"
                        style={{ color: section.color }}
                      >
                        ✓
                      </span>
                    )}
                  </span>
                  {isOpen ? (
                    <ChevronDown size={12} style={{ color: "var(--text-quaternary)" }} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={12} style={{ color: "var(--text-quaternary)" }} aria-hidden="true" />
                  )}
                </button>

                {/* Items */}
                {isOpen && (
                  <div className="pb-1">
                    {section.items.map((item, idx) => {
                      const isActive = activeItem === item.id && activeItemLabel === item.label;
                      const isBuilt = IMPLEMENTED.includes(item.id);
                      return (
                        <button
                          key={`${item.id}-${idx}`}
                          onClick={() => selectItem(item.id, item.label)}
                          className="w-full flex items-center gap-2 pl-9 pr-4 py-2 text-left text-xs transition-all duration-150 focus:outline-none"
                          style={{
                            color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
                            backgroundColor: isActive ? "var(--bg-surface-2)" : "transparent",
                            borderLeft: isActive ? `2px solid ${section.color}` : "2px solid transparent",
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive)
                              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive)
                              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)";
                          }}
                        >
                          <span style={{ color: isActive ? section.color : "inherit" }}>
                            {item.icon}
                          </span>
                          <span className="flex-1">{item.label}</span>
                          {!isBuilt && (
                            <span
                              className="text-[8px] font-bold tracking-widest"
                              style={{ color: "var(--border-subtle)" }}
                            >
                              EM BREVE
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ── Content area ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        <main className="flex-1 px-8 py-8 max-w-5xl w-full">
          {renderContent()}
        </main>
        <Footer />
      </div>
    </div>
  );
}
