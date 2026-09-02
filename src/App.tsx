import { useState, useEffect, lazy, Suspense } from "react";
import "./index.css";
import { useAuth } from "./hooks/useAuth";
import { canAccessSection, isAdminOrCoordenador } from "./lib/permissions";
import { LoginPage } from "./components/LoginPage";
import { AppNav, type AppView } from "./components/AppNav";
import { HomeView } from "./components/HomeView";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ClientsProvider } from "./contexts/ClientsContext";
import { TasksProvider } from "./contexts/TasksContext";
import { CommandPalette } from "./components/CommandPalette";
import { NotificationBell } from "./components/NotificationBell";
import { Loader2, Menu, Search } from "lucide-react";

// Every view below is loaded on demand — only the one you're actually looking
// at ships to the browser, instead of all ~16 in one bundle.
const DashboardView = lazy(() => import("./components/DashboardView").then((m) => ({ default: m.DashboardView })));
const TarefasView = lazy(() => import("./components/TarefasView").then((m) => ({ default: m.TarefasView })));
const ClientesView = lazy(() => import("./components/ClientesView").then((m) => ({ default: m.ClientesView })));
const FinanceiroView = lazy(() => import("./components/FinanceiroView").then((m) => ({ default: m.FinanceiroView })));
const PipelineView = lazy(() => import("./components/PipelineView").then((m) => ({ default: m.PipelineView })));
const PlaybookView = lazy(() => import("./components/PlaybookView").then((m) => ({ default: m.PlaybookView })));
const CentralView = lazy(() => import("./components/central/CentralView").then((m) => ({ default: m.CentralView })));
const ProfileView = lazy(() => import("./components/ProfileView").then((m) => ({ default: m.ProfileView })));
const SettingsView = lazy(() => import("./components/SettingsView").then((m) => ({ default: m.SettingsView })));
const RastreamentoView = lazy(() => import("./components/RastreamentoView").then((m) => ({ default: m.RastreamentoView })));
const SuperAgenteView = lazy(() => import("./components/SuperAgenteView").then((m) => ({ default: m.SuperAgenteView })));
const CopyIAView = lazy(() => import("./components/CopyIAView").then((m) => ({ default: m.CopyIAView })));
const RelatoriosView = lazy(() => import("./components/RelatoriosView").then((m) => ({ default: m.RelatoriosView })));
const WhatsAppView = lazy(() => import("./components/WhatsAppView").then((m) => ({ default: m.WhatsAppView })));
const IntegracoesView = lazy(() => import("./components/IntegracoesView").then((m) => ({ default: m.IntegracoesView })));
const LeadsCapturadosView = lazy(() => import("./components/LeadsCapturadosView").then((m) => ({ default: m.LeadsCapturadosView })));

const VIEW_KEY = "orbe_view";

function App() {
  const { user, profile, isAuthenticated, isLoading, logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingClientId, setPendingClientId] = useState<string | undefined>();
  const [pendingTaskId, setPendingTaskId] = useState<string | undefined>();
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
    if (view === "settings" && !isAdminOrCoordenador(profile)) {
      navigate("home");
      return;
    }
    if (!canAccessSection(profile, view)) {
      navigate("home");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
    <ClientsProvider>
    <TasksProvider>
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
          {/* Top bar */}
          <div
            className="no-print flex-shrink-0 flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: "1px solid var(--bg-surface-2)" }}
          >
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-1.5 rounded-lg"
              style={{ color: "var(--text-secondary)" }}
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>
            <span className="lg:hidden text-sm font-semibold">Orbe</span>
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex-1 lg:flex-none lg:w-72 flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent-a44)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)")}
            >
              <Search size={13} />
              <span className="flex-1 text-left">Buscar clientes ou tarefas...</span>
              <kbd className="hidden sm:inline text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-input)" }}>⌘K</kbd>
            </button>
            <NotificationBell
              onSelectTask={(id) => { setPendingTaskId(id); navigate("tarefas"); }}
              onSelectClient={(id) => { setPendingClientId(id); navigate("clientes"); }}
            />
          </div>

          <main className="flex-1 overflow-y-auto min-h-0">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
            </div>
          }>
          {view === "home"       && <HomeView profile={profile} onNavigate={navigate} />}
          {view === "dashboard"  && <DashboardView />}
          {view === "tarefas"    && <TarefasView initialTaskId={pendingTaskId} onConsumeInitial={() => setPendingTaskId(undefined)} />}
          {view === "clientes"   && <ClientesView initialClientId={pendingClientId} onConsumeInitial={() => setPendingClientId(undefined)} />}
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
          </Suspense>
          </main>
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelectClient={(id) => { setPendingClientId(id); navigate("clientes"); }}
        onSelectTask={(id) => { setPendingTaskId(id); navigate("tarefas"); }}
      />
    </TasksProvider>
    </ClientsProvider>
    </ThemeProvider>
  );
}

export default App;
