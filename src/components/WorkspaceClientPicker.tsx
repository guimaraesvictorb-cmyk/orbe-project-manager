import { useClients } from '../hooks/useClients'
import { ClientAvatar } from './ClientAvatar'

export function WorkspaceClientPicker({ clients, selected, onChange }: { clients: ReturnType<typeof useClients>['clients']; selected: string; onChange: (id: string) => void }) {
  const client = clients.find(item => item.id === selected)
  return <div className="flex flex-wrap items-center gap-3">{client && <ClientAvatar id={client.id} name={client.name} className="h-10 w-14"/>}<label className="block min-w-56 text-xs text-[var(--text-secondary)]">Cliente<select aria-label="Cliente do espaço de trabalho" value={selected} onChange={event => onChange(event.target.value)} className="mt-1 block w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-primary)]"><option value="">Selecione um cliente</option>{clients.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
}
