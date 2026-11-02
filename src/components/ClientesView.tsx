import { useState, useEffect } from 'react'
import { ClientesSection } from './ClientesSection'
import { ClientDetailView } from './ClientDetailView'
import { Footer } from './Footer'
import { useClients } from '../hooks/useClients'
import { openClientWorkspace, parseClientWorkspace } from '../lib/clientWorkspace'

export function ClientesView({ initialClientId, onConsumeInitial }: { initialClientId?: string; onConsumeInitial?: () => void }) {
  const [route, setRoute] = useState(() => parseClientWorkspace(window.location.hash))
  const { clients, loading, deleteClient, updateClient } = useClients()
  useEffect(() => {
    const sync = () => setRoute(parseClientWorkspace(window.location.hash))
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  useEffect(() => {
    const client = clients.find(item => item.id === initialClientId)
    if (client) { openClientWorkspace(client.id, client.name); onConsumeInitial?.() }
  }, [initialClientId, clients, onConsumeInitial])
  const selected = clients.find(client => client.id === route.clientId)
  if (loading) return <p role="status" className="p-8 text-sm text-[var(--text-tertiary)]">Carregando clientes…</p>
  if (selected) return <ClientDetailView key={selected.id} client={selected} onBack={() => { window.location.hash = '#clientes' }} onDelete={async () => { await deleteClient(selected.id); window.location.hash = '#clientes' }} onUpdate={updates => updateClient(selected.id, updates)} />
  return <div className="flex min-h-full flex-col">
    <div className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-8 sm:px-8">
      <header className="mb-7"><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">Operação Orbe</p><h1 className="mt-1 font-display text-2xl font-semibold text-[var(--text-primary)]">Clientes</h1><p className="mt-2 text-sm text-[var(--text-tertiary)]">Escolha uma conta para acessar planejamento, tarefas, resultados e conhecimento.</p></header>
      {route.clientId && <p role="alert" className="mb-4 text-sm text-[var(--warning)]">Esse cliente não está disponível para seu acesso.</p>}
      <ClientesSection compact={false} onSelectClient={client => openClientWorkspace(client.id, client.name)} />
    </div><Footer />
  </div>
}
