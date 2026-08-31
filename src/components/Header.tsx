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
      style={{ borderBottomColor: "#7B61FF" }}
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

          <div className="hidden sm:block w-px h-8 bg-[#262626]" />

          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight tracking-wide">
              Operating System
            </p>
            <p className="text-xs leading-tight mt-0.5" style={{ color: "#A3A3A3" }}>
              Plataforma Operacional Orbe
            </p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <p className="hidden lg:block text-right text-xs leading-snug" style={{ color: "#A3A3A3" }}>
            Não vendemos anúncios.{" "}
            <span style={{ color: "#7B61FF" }}>Vendemos infraestrutura de crescimento.</span>
          </p>

          {profile && (
            <>
              <div className="hidden sm:block w-px h-6 bg-[#262626]" />
              <div className="flex items-center gap-2">
                {/* Role badge */}
                <span
                  className="hidden sm:flex items-center gap-1 text-[9px] font-bold tracking-widest px-2 py-1 rounded uppercase"
                  style={{ backgroundColor: "#1A1230", color: "#7B61FF", border: "1px solid #7B61FF33" }}
                >
                  {profile.role === "admin" && <ShieldCheck size={10} />}
                  {ROLE_LABELS[profile.role] ?? profile.role}
                </span>

                <span className="text-xs hidden md:block max-w-[140px] truncate" style={{ color: "#A3A3A3" }}>
                  {profile.display_name}
                </span>

                <button
                  onClick={onLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B61FF]"
                  style={{ borderColor: "#262626", color: "#A3A3A3", backgroundColor: "transparent" }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.borderColor = "#ef4444";
                    el.style.color = "#ef4444";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.borderColor = "#262626";
                    el.style.color = "#A3A3A3";
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
