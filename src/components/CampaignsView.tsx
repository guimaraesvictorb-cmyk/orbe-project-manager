import { useEffect, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { useClients } from '../hooks/useClients'
import { ClientAvatar } from './ClientAvatar'
import { ClientDetailView } from './ClientDetailView'
import { Footer } from './Footer'
import { buildClientWorkspace, parseClientWorkspace } from '../lib/clientWorkspace'

export function CampaignsView() {
  const { clients, loading } = useClients()
  const [route, setRoute] = useState(() => parseClientWorkspace(window.location.hash))
  useEffect(() => {
    const sync = () => setRoute(parseClientWorkspace(window.location.hash))
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  const selected = clients.find(client => client.id === route.clientId)
  useEffect(() => {
    if (selected && !['compilado','meta','google','analytics'].includes(route.area)) {
      window.location.hash = buildClientWorkspace(selected.id, selected.name, 'compilado', window.location.hash)
    }
  }, [selected, route.area])
  if (loading) return <p role="status" className="p-8 text-sm text-[var(--text-tertiary)]">Carregando campanhas…</p>
  if (selected && ['compilado','meta','google','analytics'].includes(route.area)) return <ClientDetailView key={selected.id} campaignsOnly client={selected} onBack={() => { window.location.hash = '#campanhas' }} />
  return <div className="flex min-h-full flex-col"><div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">
    <header className="mb-8"><Megaphone size={24} className="text-[var(--accent)]"/><h1 className="mt-4 font-display text-2xl font-semibold">Campanhas</h1><p className="mt-2 text-sm text-[var(--text-tertiary)]">Escolha um cliente. Tráfego pago, orgânico e analytics ficam juntos, com os dados e conexões do projeto.</p></header>
    {route.clientId && !selected && <p role="alert" className="mb-4 text-sm text-[var(--warning)]">Esse cliente não está disponível para seu acesso.</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{clients.filter(client => client.status !== 'churned').map(client => <button key={client.id} onClick={() => { window.location.hash = buildClientWorkspace(client.id, client.name, 'compilado', '#campanhas') }} className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 text-left transition hover:border-[var(--accent-a44)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"><ClientAvatar id={client.id} name={client.name}/><div className="min-w-0"><h2 className="truncate text-sm font-semibold">{client.name}</h2><p className="mt-1 text-xs text-[var(--text-tertiary)]">Tráfego pago · Orgânico e Analytics</p></div></button>)}</div>
  </div><Footer/></div>
}
