import { useState, useEffect } from "react";
import "./index.css";
import { useAuth } from "./hooks/useAuth";
import { canAccessSection } from "./lib/permissions";
import { LoginPage } from "./components/LoginPage";
import { AppNav, type AppView } from "./components/AppNav";
import { HomeView } from "./components/HomeView";
import { DashboardView } from "./components/DashboardView";
import { TarefasView } from "./components/TarefasView";
import { ClientesView } from "./components/ClientesView";
import { FinanceiroView } from "./components/FinanceiroView";
import { PipelineView } from "./components/PipelineView";
import { PlaybookView } from "./components/PlaybookView";
import { CentralView } from "./components/central/CentralView";
import { ProfileView } from "./components/ProfileView";
import { SettingsView } from "./components/SettingsView";
import { RastreamentoView } from "./components/RastreamentoView";
import { SuperAgenteView } from "./components/SuperAgenteView";
import { CopyIAView } from "./components/CopyIAView";
import { RelatoriosView } from "./components/RelatoriosView";
import { WhatsAppView } from "./components/WhatsAppView";
import { IntegracoesView } from "./components/IntegracoesView";
import { LeadsCapturadosView } from "./components/LeadsCapturadosView";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Loader2, Menu } from "lucide-react";

const VIEW_KEY = "orbe_view";

function App() {
  const { user, profile, isAuthenticated, isLoading, logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [view, setView] = useState<AppView>(() => {
    const saved = localStorage.getItem(VIEW_KEY) as AppView | null;
    const valid: AppView[] = [
      "home","dashboard","tarefas","clientes","financeiro","pipeline","processos",
      "central","rastreamento","super-agente","copy-ia","relatorios","whatsapp",
      "integracoes","leads-capturados","profile","settings",
    ];
    return saved && valid.includes(saved) ? saved : "home";
  });

  function navigate(v: AppView) {
    localStorage.setItem(VIEW_KEY, v);
    setView(v);
  }

  useEffect(() => {
    if (!profile) return;
    if (view === "settings" && !(profile.role === "admin" || profile.role === "coordenador")) {
      navigate("home");
      return;
    }
    if (!canAccessSection(profile, view)) {
      navigate("home");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onSuccess={() => {}} />;
  }

  return (
    <ThemeProvider>
      <div className="flex h-screen bg-[var(--bg-page)] text-[var(--text-primary)] font-sans overflow-hidden">
        <AppNav
          active={view}
          onChange={navigate}
          profile={profile}
          onLogout={logout}
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
        />

        <div className="flex-1 flex flex-col min-h-0">
          {/* Mobile top bar */}
          <div
            className="lg:hidden flex-shrink-0 flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: "1px solid var(--bg-surface-2)" }}
          >
            <button
              onClick={() => setMobileNavOpen(true)}
              className="p-1.5 rounded-lg"
              style={{ color: "var(--text-secondary)" }}
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>
            <span className="text-sm font-semibold">Orbe</span>
          </div>

          <main className="flex-1 overflow-y-auto min-h-0">
          {view === "home"       && <HomeView profile={profile} onNavigate={navigate} />}
          {view === "dashboard"  && <DashboardView />}
          {view === "tarefas"    && <TarefasView />}
          {view === "clientes"   && <ClientesView />}
          {view === "financeiro" && <FinanceiroView />}
          {view === "pipeline"   && <PipelineView />}
          {view === "processos"     && <PlaybookView />}
          {view === "central"       && <CentralView />}
          {view === "rastreamento"  && <RastreamentoView />}
          {view === "super-agente" && <SuperAgenteView />}
          {view === "copy-ia"      && <CopyIAView />}
          {view === "relatorios"   && <RelatoriosView />}
          {view === "whatsapp"     && <WhatsAppView />}
          {view === "integracoes"      && <IntegracoesView />}
          {view === "leads-capturados" && <LeadsCapturadosView />}
          {view === "profile"    && <ProfileView profile={profile} userEmail={user?.email ?? ""} />}
          {view === "settings"   && <SettingsView profile={profile} />}
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
