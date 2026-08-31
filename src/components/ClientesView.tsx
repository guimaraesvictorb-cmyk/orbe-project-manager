import { useState } from "react"
import { ClientesSection } from "./ClientesSection"
import { ClientDetailView } from "./ClientDetailView"
import { Footer } from "./Footer"
import { useClients } from "../hooks/useClients"
import type { Client } from "../lib/database.types"

export function ClientesView() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const { deleteClient } = useClients()

  if (selectedClient) {
    return (
      <div className="flex flex-col min-h-0 h-full">
        <ClientDetailView
          client={selectedClient}
          onBack={() => setSelectedClient(null)}
          onDelete={async () => {
            await deleteClient(selectedClient.id)
            setSelectedClient(null)
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="max-w-screen-xl mx-auto w-full px-6 py-8">
        <div className="mb-6">
          <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "var(--accent)" }}>
            Operação
          </p>
          <h2 className="text-[var(--text-primary)] font-bold text-lg leading-tight">Carteira de clientes</h2>
        </div>
        <ClientesSection compact={false} onSelectClient={setSelectedClient} />
      </div>
      <Footer />
    </div>
  )
}
