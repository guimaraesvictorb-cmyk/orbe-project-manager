import { useState } from "react";
import { ClientesSection } from "../ClientesSection";
import { ClientDetailView } from "../ClientDetailView";
import type { Client } from "../../lib/database.types";

export function ProcessosClienteView() {
  const [selected, setSelected] = useState<Client | null>(null);

  if (selected) {
    return <ClientDetailView client={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[var(--text-primary)] font-semibold text-base">Processos de Cliente</h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
          Selecione um cliente para ver e gerenciar checklists, base de conhecimento e IA dedicada.
        </p>
      </div>
      <ClientesSection compact onSelectClient={setSelected} />
    </div>
  );
}
