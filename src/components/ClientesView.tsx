import { useState, useEffect } from "react"
import { Link2 } from "lucide-react"
import { ClientesSection } from "./ClientesSection"
import { ClientDetailView } from "./ClientDetailView"
import { Footer } from "./Footer"
import { useClients } from "../hooks/useClients"

export function ClientesView({ initialClientId, onConsumeInitial }: { initialClientId?: string; onConsumeInitial?: () => void }) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(initialClientId ?? null)
  const { clients, deleteClient, updateClient } = useClients()
  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null

  useEffect(() => {
    if (initialClientId && selectedClient?.id === initialClientId) onConsumeInitial?.()
  }, [initialClientId, selectedClient?.id, onConsumeInitial])

  if (selectedClient) {
    return (
      <div className="flex flex-col min-h-0 h-full">
        <ClientDetailView
          client={selectedClient}
          onBack={() => setSelectedClientId(null)}
          onDelete={async () => {
            await deleteClient(selectedClient.id)
            setSelectedClientId(null)
          }}
          onUpdate={async (updates) => {
            const result = await updateClient(selectedClient.id, updates)
            return result
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 max-w-screen-xl mx-auto w-full px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "var(--accent)" }}>
              Operação
            </p>
            <h2 className="text-[var(--text-primary)] font-bold text-lg leading-tight">Clientes</h2>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">Acesse a carteira e as ferramentas de cada conta em um só lugar.</p>
          </div>
          <button
            type="button"
            onClick={() => { window.location.hash = "#rastreamento" }}
            className="inline-flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-semibold transition-colors hover:border-[var(--accent-a44)] hover:text-[var(--accent)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
            style={{ borderColor: "var(--border-strong)", color: "var(--text-secondary)" }}
          >
            <Link2 size={14} />
            Central de rastreamento
          </button>
        </div>
        <ClientesSection compact={false} onSelectClient={(client) => setSelectedClientId(client.id)} />
      </div>
      <Footer />
    </div>
  )
}
