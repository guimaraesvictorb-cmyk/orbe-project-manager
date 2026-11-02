import { ArrowUpRight, BookOpen, CalendarDays, Target, Workflow } from 'lucide-react'
import { useTasksContext } from '../contexts/TasksContext'
import type { ClientChecklist } from '../lib/database.types'
import type { ClientArea } from '../lib/clientWorkspace'

type Strategy = { icp: string; conversionEvent: string; conversionSource: string; channels: string; top: string; middle: string; bottom: string }
type Offer = { id: string; name: string; status: string; source_url: string | null }
type Props = { clientId: string; strategy: Strategy; offers: Offer[]; knowledgeCount: number; checklist: ClientChecklist[]; driveLinked: boolean; ads: { meta: { label: string }; google: { label: string } }; onNavigate: (area: ClientArea) => void }
const statuses: Record<string, string> = { planned: 'Planejada', approved: 'Aprovada', live: 'Veiculada', completed: 'Concluída', paused: 'Pausada' }

export function ClientOverview({ clientId, strategy, offers, knowledgeCount, checklist, driveLinked, ads, onNavigate }: Props) {
  const { allTasks } = useTasksContext()
  const tasks = allTasks.filter(task => task.client_id === clientId)
  const pending = tasks.filter(task => !['concluido', 'cancelado'].includes(task.status))
  const upcoming = [...pending].sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999')).slice(0, 4)
  const cards = [
    { label: 'Atividades em aberto', value: pending.length, area: 'checklist' as const, icon: CalendarDays, detail: 'Mesmas tarefas do To-do Orbe' },
    { label: 'Etapas anteriores', value: `${checklist.filter(item => item.completed).length}/${checklist.length}`, area: 'checklist' as const, icon: Workflow, detail: 'Histórico preservado no cronograma' },
    { label: 'Documentos na base', value: knowledgeCount, area: 'knowledge' as const, icon: BookOpen, detail: driveLinked ? 'Pasta do Drive vinculada' : 'Drive ainda sem vínculo' },
    { label: 'Ofertas registradas', value: offers.length, area: 'strategy' as const, icon: Target, detail: 'Condições, fontes e aprendizados' },
  ]
  return <div className="space-y-6">
    <div className="rounded-2xl border border-[var(--accent-a22)] bg-[var(--accent-tint)] p-5 sm:p-6">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">Direção da conta</p>
      <h2 className="mt-2 font-display text-xl font-semibold text-[var(--text-primary)]">{strategy.conversionEvent || 'Defina o resultado que importa'}</h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">Fonte oficial: {strategy.conversionSource || 'a confirmar'}</p>
      <div className="mt-4 flex flex-wrap gap-2">{strategy.channels.split(',').map(channel => channel.trim()).filter(Boolean).map(channel => <span key={channel} className="rounded-full border border-[var(--accent-a22)] bg-[var(--bg-surface)] px-3 py-1 text-xs text-[var(--text-secondary)]">{channel}</span>)}</div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(card => <button key={card.label} onClick={() => onNavigate(card.area)} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 text-left transition hover:border-[var(--accent-a44)]"><div className="flex items-center justify-between text-[var(--text-tertiary)]"><card.icon size={17}/><ArrowUpRight size={14}/></div><p className="mt-4 text-2xl font-semibold text-[var(--text-primary)]">{card.value}</p><p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">{card.label}</p><p className="mt-2 text-[10px] text-[var(--text-tertiary)]">{card.detail}</p></button>)}</div>
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"><div className="flex justify-between gap-3"><h3 className="text-sm font-semibold text-[var(--text-primary)]">Próximas atividades</h3><button onClick={() => onNavigate('checklist')} className="text-xs text-[var(--accent)]">Abrir cronograma →</button></div>{upcoming.length ? <ul className="mt-4 divide-y divide-[var(--border)]">{upcoming.map(task => <li key={task.id} className="flex items-start justify-between gap-4 py-3"><span className="text-xs text-[var(--text-secondary)]">{task.title}</span><span className="shrink-0 text-[10px] text-[var(--text-tertiary)]">{task.deadline ? new Date(`${task.deadline}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem prazo'}</span></li>)}</ul> : <p className="mt-4 text-sm text-[var(--text-tertiary)]">Nenhuma tarefa em aberto. O cronograma mantém também os itens anteriores.</p>}</section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"><h3 className="text-sm font-semibold text-[var(--text-primary)]">Público e posicionamento</h3><p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">{strategy.icp || 'O ICP ainda precisa ser confirmado com as fontes do cliente.'}</p><button onClick={() => onNavigate('strategy')} className="mt-4 text-xs font-semibold text-[var(--accent)]">Ver estratégia e fontes →</button></section>
    </div>
    <section><h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Funil de crescimento</h3><div className="grid gap-3 lg:grid-cols-3">{[['Topo', strategy.top], ['Meio', strategy.middle], ['Fundo', strategy.bottom]].map(([label, value], index) => <div key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">0{index + 1} · {label}</p><p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)]">{value || 'Estratégia a confirmar'}</p></div>)}</div></section>
    <div className="grid gap-4 xl:grid-cols-2"><section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"><h3 className="text-sm font-semibold text-[var(--text-primary)]">Ofertas recentes</h3>{offers.length ? offers.slice(0, 3).map(offer => <div key={offer.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3"><span className="text-xs text-[var(--text-secondary)]">{offer.name}</span><span className="rounded-full bg-[var(--bg-surface-2)] px-2 py-1 text-[10px] text-[var(--text-tertiary)]">{statuses[offer.status] ?? 'Status a confirmar'}</span></div>) : <p className="mt-3 text-xs text-[var(--text-tertiary)]">Sem oferta registrada nas fontes consultadas.</p>}<button onClick={() => onNavigate('strategy')} className="mt-4 text-xs text-[var(--accent)]">Ver histórico →</button></section><section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"><h3 className="text-sm font-semibold text-[var(--text-primary)]">Conexões e conhecimento</h3><div className="mt-4 flex flex-wrap gap-2">{[`Meta · ${ads.meta.label}`, `Google · ${ads.google.label}`, `Drive · ${driveLinked ? 'vinculado' : 'sem vínculo'}`].map(text => <span key={text} className="rounded-lg bg-[var(--bg-surface-2)] px-3 py-2 text-xs text-[var(--text-secondary)]">{text}</span>)}</div><button onClick={() => onNavigate('connections')} className="mt-4 text-xs text-[var(--accent)]">Conferir fontes e integrações →</button></section></div>
  </div>
}
