import { useState } from 'react'
import { Copy, Loader2, MessageSquare, RefreshCw } from 'lucide-react'
import { WorkspaceClientPicker } from './WorkspaceClientPicker'
import { useWorkspaceClient } from '../hooks/useWorkspaceClient'
import { useTasks } from '../hooks/useTasks'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { previousMonth } from '../lib/clientTimeline'
import { buildWhatsAppReport } from '../lib/whatsappReport'
import { AssistantMessage } from './AssistantMessage'

type Report = { status: string; currency?: string; totals?: {spend:number;impressions:number;clicks:number}; checked_at?:string }
export function WhatsAppReportComposer() {
 const {clients,clientId,selected,selectClient}=useWorkspaceClient()
 const {profile}=useAuth()
 const {tasks,loading:tasksLoading}=useTasks({clientId:selected?.id??'00000000-0000-0000-0000-000000000000'})
 const [month,setMonth]=useState(previousMonth().month)
 const [report,setReport]=useState<{clientId:string;month:string;text:string}|null>(null)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [copied,setCopied]=useState(false)
 const current=report?.clientId===clientId&&report.month===month?report:null
 async function generate() {
  if(!selected||!/^\d{4}-\d{2}$/.test(month))return
  setBusy(true);setError('');setReport(null);setCopied(false)
  try {
   const {data:{session}}=await supabase.auth.getSession()
   if(!session)throw new Error('Entre novamente para gerar o relatório.')
   const [year,number]=month.split('-').map(Number),start=`${month}-01`,end=`${month}-${new Date(year,number,0).getDate()}`
   const sources=profile?.can_view_financials?await Promise.all((['meta','google'] as const).map(async platform=>{
    try {
     const response=await fetch('/api/ads-report',{method:'POST',headers:{authorization:`Bearer ${session.access_token}`,'content-type':'application/json'},body:JSON.stringify({client_id:selected.id,platform,start,end})})
     const body=await response.json() as Report
     return {platform,...(response.ok?body:{status:'unavailable'})}
    }catch{return {platform,status:'unavailable'} as Report&{platform:string}}
   })):[]
   const periodTasks=tasks.filter(task=>task.deadline&&task.deadline>=start&&task.deadline<=end)
   const text=buildWhatsAppReport(selected.name,start,end,sources,{total:periodTasks.length,done:periodTasks.filter(task=>task.status==='concluido').length},!!profile?.can_view_financials)
   setReport({clientId:selected.id,month,text})
  }catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível gerar o relatório.')}
  finally{setBusy(false)}
 }
 return <section aria-label="Preparar relatório para WhatsApp" className="space-y-5"><div className="flex flex-wrap items-end gap-4"><WorkspaceClientPicker clients={clients} selected={clientId} onChange={selectClient}/><label className="text-xs text-[var(--text-secondary)]">Mês do relatório<input aria-label="Mês do relatório" type="month" value={month} onChange={event=>setMonth(event.target.value)} className="mt-1 block rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2.5 text-sm"/></label><button disabled={!selected||busy||!month||tasksLoading} onClick={()=>void generate()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-xs font-semibold text-[var(--bg-page)] disabled:opacity-50">{busy?<Loader2 size={14} className="animate-spin"/>:current?<RefreshCw size={14}/>:<MessageSquare size={14}/>} {busy?'Consultando fontes e preparando…':current?'Atualizar relatório':'Preparar mensagem'}</button></div>
 {error&&<p role="alert" className="text-sm text-[var(--warning)]">{error}</p>}
 {current?<div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[var(--text-tertiary)]">{selected?.name} · {month} · Rascunho para revisão</p><button className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--accent)]" onClick={async()=>{try{await navigator.clipboard.writeText(current.text);setCopied(true)}catch{setError('Não foi possível copiar. Selecione o texto para copiar manualmente.')}}}><Copy size={13}/>{copied?'Copiado':'Copiar para WhatsApp'}</button></div><textarea aria-label="Revisar mensagem do relatório" className="min-h-64 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] p-4 text-sm leading-relaxed" value={current.text} onChange={event=>setReport({...current,text:event.target.value})}/><details className="mt-3"><summary className="cursor-pointer text-xs text-[var(--text-tertiary)]">Visualizar mensagem formatada</summary><div className="mt-3 text-sm text-[var(--text-secondary)]"><AssistantMessage text={current.text}/></div></details><p className="mt-4 text-xs text-[var(--text-tertiary)]">Revise, copie e cole no WhatsApp. O envio automático depende do vínculo do número da Orbe e da ativação da automação.</p></div>:<div className="rounded-2xl border border-dashed border-[var(--border-strong)] p-8 text-sm text-[var(--text-tertiary)]">Selecione cliente e mês para consultar Meta e Google e preparar uma mensagem. Fontes pendentes aparecem como indisponíveis.</div>}
 </section>
}
