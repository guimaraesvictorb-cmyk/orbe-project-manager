import { useState } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, ListChecks, Plus, X } from 'lucide-react'
import { useTasksContext } from '../contexts/TasksContext'
import { useAuth } from '../hooks/useAuth'
import { useQuarters } from '../hooks/useQuarters'
import type { ClientChecklist, Profile, TaskStatus } from '../lib/database.types'
import { inTimelinePeriod } from '../lib/clientTimeline'

type Row = { id: string; title: string; date: string | null; assignee: string | null; stage: string; completed: boolean; legacy: boolean; periodDate: string | null }
type Props = { clientId: string; items: ClientChecklist[]; members: Profile[]; canEdit: boolean; onToggle: (id: string) => Promise<unknown>; onUpdate: (id: string, patch: Pick<Partial<ClientChecklist>, 'due_date' | 'assignee_id'>) => Promise<{ error?: string }> }
const stages: Record<TaskStatus, string> = { backlog: 'A fazer', em_andamento: 'Em andamento', em_revisao: 'Em revisão', concluido: 'Concluído', cancelado: 'Cancelado' }
const input = 'rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--text-primary)]'
const iso = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

export function ClientChronogram({ clientId, items, members, canEdit, onToggle, onUpdate }: Props) {
  const { profile } = useAuth()
  const { allTasks, createTask, updateTask, loading } = useTasksContext()
  const { quarters } = useQuarters(clientId)
  const [year, setYear] = useState(new Date().getFullYear())
  const [quarter, setQuarter] = useState('all')
  const [mode, setMode] = useState<'list' | 'calendar'>('list')
  const [month, setMonth] = useState(new Date().getMonth())
  const [day, setDay] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [deadline, setDeadline] = useState('')
  const [assignee, setAssignee] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const tasks = allTasks.filter(task => task.client_id === clientId)
  const rows: Row[] = [
    ...tasks.map(task => ({ id: task.id, title: task.title, date: task.deadline, assignee: task.assignee_id, stage: stages[task.status], completed: task.status === 'concluido', legacy: false, periodDate: task.deadline ?? quarters.find(period => period.id === task.quarter_id)?.period_start ?? null })),
    ...items.map(item => ({ id: item.id, title: item.title, date: item.due_date, assignee: item.assignee_id, stage: item.category?.trim() || 'Etapas anteriores', completed: item.completed, legacy: true, periodDate: item.due_date })),
  ]
  const years = [...new Set([2026, 2027, new Date().getFullYear(), ...rows.flatMap(row => row.periodDate ? [Number(row.periodDate.slice(0, 4))] : []), ...quarters.map(period => Number(period.period_start.slice(0, 4)))])].sort()
  const visible = rows.filter(row => inTimelinePeriod(row.periodDate, year, quarter)).filter(row => !day || row.date === day)
  const groups = new Map<string, Row[]>()
  for (const row of visible) groups.set(row.stage, [...groups.get(row.stage) ?? [], row])
  const undated = rows.filter(row => !row.periodDate).length
  const done = visible.filter(row => row.completed).length
  const people = [...members]
  if (profile && !people.some(member => member.id === profile.id)) people.push(profile)

  async function addTask(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim() || !profile) return
    setBusy(true); setMessage('')
    const period = deadline ? quarters.find(item => item.period_start <= deadline && item.period_end >= deadline) : null
    const result = await createTask({ client_id: clientId, quarter_id: period?.id ?? null, title: title.trim(), description: null, status: 'backlog', priority: 'media', assignee_id: assignee || null, deadline: deadline || null, estimated_hours: null, actual_hours: null, sort_order: tasks.length, data_source: 'orbe', external_id: null, last_synced_at: null, recurrence: 'nenhuma', platform: null, created_by: profile.id, playbook_step_id: null, workflow_trigger_id: null, parent_task_id: null })
    setBusy(false)
    if (result.error) { setMessage(result.error); return }
    setTitle(''); setDeadline(''); setAssignee(''); setShowForm(false); setMessage('Atividade salva no cronograma e no To-do Orbe.')
  }
  async function toggle(row: Row) {
    setMessage('')
    const result = row.legacy ? await onToggle(row.id) : await updateTask(row.id, { status: row.completed ? 'backlog' : 'concluido', ...(row.completed ? { completed_at: null } : {}) })
    if (result && typeof result === 'object' && 'error' in result && result.error) setMessage(String(result.error))
  }
  async function changeDate(row: Row, value: string) {
    const result = row.legacy ? await onUpdate(row.id, { due_date: value || null }) : await updateTask(row.id, { deadline: value || null })
    if (result.error) setMessage(result.error)
  }
  function chooseQuarter(value: string) { setQuarter(value); setDay(''); if (/^[1-4]$/.test(value)) setMonth((Number(value) - 1) * 3) }
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return <section className="space-y-5" aria-label="Cronograma do cliente">
    <header className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">Execução por período</p><h2 className="mt-2 font-display text-xl font-semibold text-[var(--text-primary)]">Cronograma</h2><p className="mt-2 max-w-xl text-xs leading-relaxed text-[var(--text-tertiary)]">Tarefas conectadas ao To-do Orbe e histórico de etapas anteriores. Alterar uma tarefa atualiza a mesma atividade em toda a plataforma.</p></div>{canEdit && <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--bg-page)]"><Plus size={14}/>Nova atividade</button>}</div><div className="mt-5 flex flex-wrap items-center gap-3"><label className="text-[10px] text-[var(--text-tertiary)]">Ano<select aria-label="Ano do cronograma" value={year} onChange={event => { setYear(Number(event.target.value)); setDay('') }} className={`${input} ml-2`}>{years.map(value => <option key={value}>{value}</option>)}</select></label><div className="flex flex-wrap gap-1" role="group" aria-label="Período do cronograma">{[['all', 'Ano completo'], ['1', 'Quarter 1'], ['2', 'Quarter 2'], ['3', 'Quarter 3'], ['4', 'Quarter 4'], ['legacy', `Sem período · ${undated}`]].map(([value, label]) => <button key={value} aria-pressed={quarter === value} onClick={() => chooseQuarter(value)} className="rounded-lg border px-3 py-2 text-[11px] font-medium" style={{ borderColor: quarter === value ? 'var(--accent)' : 'var(--border)', color: quarter === value ? 'var(--accent)' : 'var(--text-tertiary)', backgroundColor: quarter === value ? 'var(--accent-tint)' : undefined }}>{label}</button>)}</div><div className="ml-auto flex gap-1">{([['list', ListChecks, 'Etapas'], ['calendar', CalendarDays, 'Calendário']] as const).map(([value, Icon, label]) => <button key={value} aria-pressed={mode === value} onClick={() => { setMode(value); setDay('') }} className={`${input} flex items-center gap-1.5`}><Icon size={13}/>{label}</button>)}</div></div><div className="mt-4 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]"><div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${visible.length ? done / visible.length * 100 : 0}%` }}/></div><span className="text-[10px] text-[var(--text-tertiary)]">{done}/{visible.length} concluídas</span></div></header>
    {quarters.length > 0 && <label className="block text-xs text-[var(--text-tertiary)]">Cronogramas anteriores<select aria-label="Cronogramas anteriores" className={`${input} ml-3`} value="" onChange={event => { const period = quarters.find(item => item.id === event.target.value); if (period) { setYear(Number(period.period_start.slice(0, 4))); chooseQuarter(String(Math.floor((Number(period.period_start.slice(5, 7)) - 1) / 3) + 1)) } }}><option value="">Selecionar histórico…</option>{quarters.map(period => <option key={period.id} value={period.id}>{period.name} · {period.period_start.slice(0, 4)}</option>)}</select></label>}
    {showForm && <form onSubmit={addTask} className="rounded-2xl border border-[var(--accent-a44)] bg-[var(--bg-surface)] p-5"><div className="flex justify-between"><h3 className="text-sm font-semibold text-[var(--text-primary)]">Nova atividade</h3><button type="button" aria-label="Fechar nova atividade" onClick={() => setShowForm(false)}><X size={16}/></button></div><label className="mt-4 block text-xs text-[var(--text-secondary)]">Atividade<input required value={title} onChange={event => setTitle(event.target.value)} className={`${input} mt-1 w-full`} placeholder="O que precisa ser feito?"/></label><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs text-[var(--text-secondary)]">Prazo<input type="date" value={deadline} onChange={event => setDeadline(event.target.value)} className={`${input} mt-1 block w-full`}/></label><label className="text-xs text-[var(--text-secondary)]">Responsável<select value={assignee} onChange={event => setAssignee(event.target.value)} className={`${input} mt-1 block w-full`}><option value="">Sem responsável</option>{people.map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label></div><p className="mt-3 text-[10px] text-[var(--text-tertiary)]">Sem prazo, a atividade fica em “Sem período”. O quarter segue o prazo ou o cronograma já associado à tarefa.</p><button disabled={busy} className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--bg-page)] disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar atividade'}</button></form>}
    {message && <p role="status" className="text-xs text-[var(--text-secondary)]">{message}</p>}
    {mode === 'calendar' && <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"><div className="mb-4 flex items-center justify-between"><button aria-label="Mês anterior" onClick={() => { const next = new Date(year, month - 1, 1); setYear(next.getFullYear()); setMonth(next.getMonth()); setDay('') }}><ChevronLeft size={18}/></button><h3 className="text-sm font-semibold capitalize text-[var(--text-primary)]">{new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3><button aria-label="Próximo mês" onClick={() => { const next = new Date(year, month + 1, 1); setYear(next.getFullYear()); setMonth(next.getMonth()); setDay('') }}><ChevronRight size={18}/></button></div><div className="grid grid-cols-7 gap-1 text-center">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(label => <span key={label} className="pb-2 text-[10px] text-[var(--text-tertiary)]">{label}</span>)}{Array.from({ length: firstWeekday }, (_, index) => <div key={`empty-${index}`}/>)}{Array.from({ length: daysInMonth }, (_, index) => { const date = iso(year, month, index + 1); const count = rows.filter(row => row.date === date).length; return <button key={date} aria-label={`${index + 1}: ${count} atividade(s)`} aria-pressed={day === date} onClick={() => setDay(day === date ? '' : date)} className="min-h-16 rounded-lg border p-1 text-xs" style={{ borderColor: day === date ? 'var(--accent)' : 'var(--border)', backgroundColor: day === date ? 'var(--accent-tint)' : undefined }}><span className="text-[var(--text-primary)]">{index + 1}</span>{count > 0 && <span className="mt-1 block text-[9px] font-semibold text-[var(--accent)]">{count} <span className="hidden sm:inline">atividade(s)</span></span>}</button>})}</div><p className="mt-3 text-[10px] text-[var(--text-tertiary)]">Atividades sem data aparecem em “Sem período”. Clique em um dia para ver as atividades.</p></div>}
    {day && <button className="text-xs text-[var(--accent)]" onClick={() => setDay('')}>Limpar dia selecionado · {day.split('-').reverse().join('/')}</button>}
    {loading && <p role="status" className="text-xs text-[var(--text-tertiary)]">Carregando tarefas…</p>}
    {!visible.length && !loading && <div className="rounded-2xl border border-dashed border-[var(--border-strong)] p-10 text-center"><h3 className="text-sm font-semibold text-[var(--text-primary)]">Nenhuma atividade neste período</h3><p className="mt-2 text-xs text-[var(--text-tertiary)]">Selecione outro quarter ou consulte os {undated} itens sem período definido.</p></div>}
    {[...groups].map(([stage, activities], index) => <section key={stage} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]"><header className="flex items-center justify-between bg-[var(--bg-surface-2)] px-4 py-3"><h3 className="text-xs font-semibold text-[var(--text-primary)]"><span className="mr-2 text-[var(--accent)]">{String(index + 1).padStart(2, '0')}</span>{stage}</h3><span className="text-[10px] text-[var(--text-tertiary)]">{activities.filter(row => row.completed).length}/{activities.length}</span></header><ul className="divide-y divide-[var(--border)]">{activities.map(row => <li key={`${row.legacy ? 'legacy' : 'task'}-${row.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3"><button onClick={() => void toggle(row)} aria-label={`${row.completed ? 'Reabrir' : 'Concluir'} atividade: ${row.title}`} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[var(--border-strong)]" style={{ backgroundColor: row.completed ? 'var(--accent)' : undefined }}>{row.completed && <Check size={12} className="text-[var(--bg-page)]"/>}</button><div className="min-w-36 flex-1"><p className={`text-xs text-[var(--text-primary)] ${row.completed ? 'line-through opacity-50' : ''}`}>{row.title}</p><p className="mt-1 text-[10px] text-[var(--text-tertiary)]">{row.legacy ? 'Etapa anterior' : 'To-do Orbe'} · {row.assignee ? people.find(person => person.id === row.assignee)?.display_name ?? 'Pessoa atribuída' : 'Sem responsável'}{!row.date && ' · Sem prazo'}</p></div>{canEdit ? <input aria-label={`Prazo de ${row.title}`} type="date" value={row.date ?? ''} onChange={event => void changeDate(row, event.target.value)} className={`${input} max-w-40`}/> : <span className="text-[10px] text-[var(--text-tertiary)]">{row.date ? row.date.split('-').reverse().join('/') : 'Sem prazo'}</span>}</li>)}</ul></section>)}
  </section>
}
