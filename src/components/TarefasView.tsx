import { TasksView } from "./tasks/TasksView";
import { Footer } from "./Footer";

export function TarefasView() {
  return (
    <div className="flex flex-col min-h-0">
      <div className="max-w-screen-xl mx-auto w-full px-6 py-8">
        <div className="mb-6">
          <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "var(--accent)" }}>
            Operação
          </p>
          <h2 className="text-[var(--text-primary)] font-bold text-lg leading-tight">Gestão de tarefas</h2>
        </div>
        <TasksView />
      </div>
      <Footer />
    </div>
  );
}
