import { useEffect, useState } from 'react'
import { MessageSquare, Plus, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useClients } from '../hooks/useClients'
import { RelatoriosView } from './RelatoriosView'
import { Footer } from './Footer'

type Draft = { id: string; title: string; client_id: string | null; report_type: string; recipient: string; frequency: string; status: string }
const input = 'mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]'
const labels: Record<string, string> = { tasks: 'Atividades e prazos', performance: 'Resultados', balance: 'Alertas de investimento', daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal' }

export function WhatsAppView() {
 const { profile } = useAuth()
 const { clients } = useClients()
 const [section, setSection] = useState<'reports'|'settings'>('reports')
 const [phone, setPhone] = useState('')
 const [drafts, setDrafts] = useState<Draft[]>([])
 const [message, setMessage] = useState('')
 const [busy, setBusy] = useState(false)
 const [showForm, setShowForm] = useState(false)
 const [form, setForm] = useState({ title: '', client_id: '', recipient: '', report_type: 'tasks', frequency: 'weekly' })
 const canManage = !!profile && ['admin','coordenador'].includes(profile.role)
 useEffect(() => {
  let active = true
  void Promise.all([supabase.from('orbe_communications_settings').select('sender_phone').eq('id', true).maybeSingle(), supabase.from('orbe_communication_drafts').select('*').order('created_at', { ascending: false })]).then(([settings, reports]) => {
   if (!active) return
   if (settings.error || reports.error) setMessage('Não foi possível carregar as configurações de comunicação.')
   else { setPhone(settings.data?.sender_phone ?? ''); setDrafts(reports.data ?? []) }
  })
  return () => { active = false }
 }, [])
 async function savePhone() {
  if (!profile) return
  const value = phone.replace(/\D/g, '')
  if (!/^[1-9]\d{9,14}$/.test(value)) { setMessage('Informe o número da Orbe com país e DDD.'); return }
  setBusy(true)
  const { error } = await supabase.from('orbe_communications_settings').upsert({ id: true, sender_phone: value, updated_by: profile.id, updated_at: new Date().toISOString() })
  setBusy(false); setMessage(error ? 'Não foi possível salvar o número.' : 'Número salvo. O aparelho ainda precisa ser vinculado e validado para envio.')
 }
 async function saveDraft(event: React.FormEvent) {
  event.preventDefault()
  if (!profile) return
  const recipient = form.recipient.replace(/\D/g, '')
  if (!/^[1-9]\d{9,14}$/.test(recipient)) { setMessage('Informe o destinatário com país e DDD.'); return }
  setBusy(true)
  const { data, error } = await supabase.from('orbe_communication_drafts').insert({ ...form, client_id: form.client_id || null, recipient, status: 'draft', created_by: profile.id }).select().single()
  setBusy(false)
  if (error) { setMessage('Não foi possível salvar o rascunho. Confira sua permissão.'); return }
  setDrafts(previous => [data, ...previous]); setShowForm(false); setForm({ title: '', client_id: '', recipient: '', report_type: 'tasks', frequency: 'weekly' }); setMessage('Rascunho salvo. Nenhuma mensagem foi enviada e a frequência ainda não está ativa.')
 }
 return <div className="flex min-h-full flex-col"><div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-8"><header><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">Comunicação da agência</p><h1 className="mt-2 font-display text-2xl font-semibold text-[var(--text-primary)]">Relatórios no WhatsApp</h1><p className="mt-2 text-sm text-[var(--text-tertiary)]">Número da Orbe, relatórios e alertas para a equipe. Os canais de atendimento de cada cliente ficam em Clientes → Conexões.</p></header>
  <div className="flex gap-2" role="group" aria-label="Áreas da comunicação">{([{id:"reports",label:"Preparar relatório"},{id:"settings",label:"Número e automações"}] as const).map(item=><button key={item.id} aria-pressed={section===item.id} onClick={()=>setSection(item.id)} className={`rounded-xl border px-4 py-2 text-xs font-semibold ${section===item.id?"border-[var(--accent-a44)] bg-[var(--accent-tint)] text-[var(--accent)]":"border-[var(--border)] text-[var(--text-secondary)]"}`}>{item.label}</button>)}</div>
  {section==='reports'?<RelatoriosView embedded/>:<>
  <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"><div className="flex items-center gap-2"><MessageSquare size={19} className="text-[var(--accent)]"/><h2 className="text-sm font-semibold text-[var(--text-primary)]">WhatsApp da Orbe</h2><span className="ml-auto rounded-full bg-[var(--warning-tint)] px-3 py-1 text-[10px] text-[var(--warning)]">Vínculo de envio pendente</span></div><p className="mt-3 text-xs text-[var(--text-tertiary)]">Cadastre o número que será usado pela agência. A autenticação do aparelho e o serviço de envio precisam ser concluídos antes de ativar o agente.</p><div className="mt-4 flex flex-wrap items-end gap-3"><label className="min-w-56 flex-1 text-xs text-[var(--text-secondary)]">Número com país e DDD<input aria-label="WhatsApp da Orbe" type="tel" placeholder="55 11 99999-9999" disabled={!canManage} value={phone} onChange={event => setPhone(event.target.value)} className={input}/></label>{canManage && <button onClick={() => void savePhone()} disabled={busy} className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--bg-page)] disabled:opacity-50"><Save size={14}/>Salvar número</button>}</div></section>
  <section><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-[var(--text-primary)]">Relatórios e alertas</h2>{canManage && <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--accent)]"><Plus size={14}/>Novo rascunho</button>}</div>
   {showForm && <form onSubmit={saveDraft} className="mt-4 grid gap-3 rounded-2xl border border-[var(--accent-a44)] bg-[var(--bg-surface)] p-5 sm:grid-cols-2"><label className="text-xs text-[var(--text-secondary)]">Nome<input required maxLength={200} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className={input}/></label><label className="text-xs text-[var(--text-secondary)]">Cliente<select className={input} value={form.client_id} onChange={event => setForm({ ...form, client_id: event.target.value })}><option value="">Equipe Orbe · geral</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label className="text-xs text-[var(--text-secondary)]">Conteúdo<select className={input} value={form.report_type} onChange={event => setForm({ ...form, report_type: event.target.value })}><option value="tasks">Atividades e prazos</option>{profile?.can_view_financials && <><option value="performance">Resultados</option><option value="balance">Alertas de investimento</option></>}</select></label><label className="text-xs text-[var(--text-secondary)]">Destinatário<input required type="tel" value={form.recipient} onChange={event => setForm({ ...form, recipient: event.target.value })} className={input} placeholder="País + DDD + telefone"/></label><label className="text-xs text-[var(--text-secondary)]">Frequência planejada<select className={input} value={form.frequency} onChange={event => setForm({ ...form, frequency: event.target.value })}><option value="daily">Diário</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option></select></label><div className="flex items-end gap-3"><button disabled={busy} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--bg-page)] disabled:opacity-50">Salvar rascunho</button><button type="button" onClick={() => setShowForm(false)} className="px-3 py-2 text-xs text-[var(--text-tertiary)]">Cancelar</button></div></form>}
   {!drafts.length ? <div className="mt-4 rounded-2xl border border-dashed border-[var(--border-strong)] p-8 text-center"><p className="text-sm text-[var(--text-secondary)]">Nenhum relatório preparado</p><p className="mt-2 text-xs text-[var(--text-tertiary)]">Crie um rascunho com cliente, conteúdo, destinatário e frequência.</p></div> : <div className="mt-4 space-y-3">{drafts.map(draft => <article key={draft.id} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"><div className="flex justify-between gap-3"><h3 className="text-sm font-semibold text-[var(--text-primary)]">{draft.title}</h3><span className="text-[10px] text-[var(--text-tertiary)]">Rascunho · envio inativo</span></div><p className="mt-2 text-xs text-[var(--text-tertiary)]">{clients.find(client => client.id === draft.client_id)?.name ?? 'Equipe Orbe'} · {labels[draft.report_type]} · {labels[draft.frequency]}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">Destinatário: +{draft.recipient}</p></article>)}</div>}
  </section>{message && <p role="status" className="text-xs text-[var(--text-secondary)]">{message}</p>}
 </>}
 </div><Footer /></div>
}
