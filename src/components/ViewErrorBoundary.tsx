import { Component, type ReactNode } from "react";
export class ViewErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div
          role="alert"
          className="m-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6"
        >
          <h2 className="font-display text-lg font-semibold">
            Não foi possível abrir esta visão
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Volte à visão geral para continuar usando o Studio.
          </p>
          <a
            className="mt-4 inline-block rounded-lg bg-[var(--accent-tint)] px-4 py-2 text-sm font-medium text-[var(--accent)]"
            href="#dashboard"
          >
            Voltar à visão geral
          </a>
        </div>
      );
    return this.props.children;
  }
}
