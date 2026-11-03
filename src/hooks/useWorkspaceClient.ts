import { useEffect, useState } from 'react'
import { useClients } from './useClients'

export function useWorkspaceClient() {
  const { clients, loading } = useClients()
  const [clientId, setClientId] = useState(() => new URLSearchParams(window.location.hash.split('?')[1]).get('cliente') ?? '')
  useEffect(() => {
    const sync = () => setClientId(new URLSearchParams(window.location.hash.split('?')[1]).get('cliente') ?? '')
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  const selectClient = (id: string) => {
    const [section, query] = window.location.hash.split('?')
    const params = new URLSearchParams(query)
    params.delete('pastas')
    if (id) params.set('cliente', id); else params.delete('cliente')
    window.location.hash = `${section}${params.size ? `?${params}` : ''}`
    setClientId(id)
  }
  return { clients, loading, selected: clients.find(client => client.id === clientId), selectClient, clientId }
}
