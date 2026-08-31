import { LogOut, ShieldCheck } from "lucide-react";
import type { Profile } from "../lib/database.types";

interface HeaderProps {
  profile: Profile | null;
  onLogout: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  coordenador: "Coord",
  gt: "GT",
  gp: "GP",
};

export function Header({ profile, onLogout }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-50 bg-black border-b-2 px-6 py-4"
      style={{ borderBottomColor: "var(--accent)" }}
    >
      <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Logo + title */}
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="flex-shrink-0 text-2xl font-bold leading-none select-none"
            style={{ fontFamily: "Arial, sans-serif", letterSpacing: "-1px" }}
          >
            <span className="text-white">Orbe</span>
          </div>

          <div className="hidden sm:block w-px h-8 bg-[var(--border-subtle)]" />

          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight tracking-wide">
              Operating System
            </p>
            <p className="text-xs leading-tight mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Plataforma Operacional Orbe
            </p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <p className="hidden lg:block text-right text-xs leading-snug" style={{ color: "var(--text-secondary)" }}>
            Não vendemos anúncios.{" "}
            <span style={{ color: "var(--accent)" }}>Vendemos infraestrutura de crescimento.</span>
          </p>

          {profile && (
            <>
              <div className="hidden sm:block w-px h-6 bg-[var(--border-subtle)]" />
              <div className="flex items-center gap-2">
                {/* Role badge */}
                <span
                  className="hidden sm:flex items-center gap-1 text-[9px] font-bold tracking-widest px-2 py-1 rounded uppercase"
                  style={{ backgroundColor: "var(--accent-tint)", color: "var(--accent)", border: "1px solid var(--accent-a33)" }}
                >
                  {profile.role === "admin" && <ShieldCheck size={10} />}
                  {ROLE_LABELS[profile.role] ?? profile.role}
                </span>

                <span className="text-xs hidden md:block max-w-[140px] truncate" style={{ color: "var(--text-secondary)" }}>
                  {profile.display_name}
                </span>

                <button
                  onClick={onLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)", backgroundColor: "transparent" }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.borderColor = "var(--danger)";
                    el.style.color = "var(--danger)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.borderColor = "var(--border-subtle)";
                    el.style.color = "var(--text-secondary)";
                  }}
                >
                  <LogOut size={12} />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
