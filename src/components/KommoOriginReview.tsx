import {useEffect,useRef,useState} from 'react'
import {supabase} from '../lib/supabase'
import type {TrackingRecord} from '../lib/whatsappTracking'
import {contactChannel,messageOriginStatement} from '../lib/originReview'

const date=(value:string|number)=>new Date(String(value)).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'})
export function OriginReviewEvidence({payload:p}:{payload:TrackingRecord['payload']}){
 if(!p.origin_review_status)return null
 const source=String(p.crm_origin_utm_source||(p.crm_origin_gclid?'Google':p.crm_origin_fbclid?'Meta':''))
 const declared=messageOriginStatement(p.text)
 return <div className="mt-3 border-t border-[var(--border)] pt-3 text-xs space-y-1">
  <p className="font-medium">{p.origin_review_status==='recovered'?'Origem recuperada na Kommo':p.origin_review_status==='historical'?'Contato já existente na Kommo':'Revisado · origem não registrada na Kommo'}</p>
  <p className="text-[var(--text-tertiary)]">Cadastro do negócio: {date(p.crm_lead_created_at)}{p.origin_predates_capture==='true'?' · anterior à captura do Studio':''}</p>
  {source&&p.origin_review_status!=='recovered'&&<p>Origem do cadastro: {source}{p.crm_origin_utm_campaign?` · ${p.crm_origin_utm_campaign}`:''}. Esse histórico não confirma a origem desta conversa.</p>}
  {!source&&<p className="text-[var(--text-tertiary)]">Sem UTMs ou ID de clique no cadastro consultado.</p>}
  {p.crm_entry_channel&&<p className="text-[var(--text-tertiary)]">Canal de entrada na Kommo: {String(p.crm_entry_channel)}. O canal de atendimento não confirma a campanha de aquisição.</p>}
  {declared&&<p className="text-[var(--text-tertiary)]">Mensagem: {declared}</p>}
  {p.origin_return_kind==='service_resumption'&&<p>Retomada de atendimento no WhatsApp: convite enviado em {date(p.origin_return_sent_at)}, seguido da resposta “Continuar”. A origem de aquisição anterior permanece sem confirmação.</p>}
  {p.origin_deep_checked_at&&<p className="text-[var(--text-tertiary)]">Histórico completo conferido: {String(p.origin_deep_leads_checked)} negócio(s) vinculado(s) e {String(p.origin_deep_notes_checked)} nota(s). {p.origin_deep_status==='not_found'?'Origem de aquisição não registrada nesses cadastros.':''}</p>}
  {p.origin_deep_status==='historical_evidence'&&<p>Origem registrada no cadastro do contato: {String(p.crm_contact_origin_utm_source||p.crm_contact_origin_label||(p.crm_contact_origin_gclid?'Google':p.crm_contact_origin_fbclid?'Meta':'Não informada'))}{p.crm_contact_origin_utm_campaign?` · ${p.crm_contact_origin_utm_campaign}`:''}. Registro de {date(p.crm_contact_origin_created_at)}.</p>}
  {Number(p.origin_deep_note_hints)>0&&<p className="text-[var(--text-tertiary)]">{String(p.origin_deep_note_hints)} nota(s) com parâmetros de campanha para revisão manual; um link citado em nota não comprova um clique.</p>}
  {p.origin_history_checked_at&&<p className="text-[var(--text-tertiary)]">Histórico de conversas: {String(p.origin_history_events_checked)} eventos, {String(p.origin_history_talks_checked)} conversas e {String(p.origin_history_messages_checked)} mensagens consultadas.</p>}
  {p.origin_history_channel&&<p>Canal: {String(p.origin_history_channel)} · {p.origin_history_evidence_kind==='contact_declaration'?'informado pelo contato na mensagem':p.origin_history_evidence_kind==='instagram_conversation'?'conversa recebida no Instagram':'registrado no histórico do campo de origem'}. Não confirma um novo clique ou campanha.</p>}
  {p.origin_history_messages_access==='permission_required'&&<p className="text-[var(--text-tertiary)]">A Kommo não autorizou a leitura das mensagens antigas. A integração precisa da permissão “External chat history”.</p>}
  {p.origin_history_messages_access==='plan_required'&&<p className="text-[var(--text-tertiary)]">A Kommo exige um plano compatível para liberar as mensagens antigas pela API.</p>}
  {p.origin_history_messages_access==='history_unavailable'&&<p className="text-[var(--text-tertiary)]">A Kommo não disponibilizou as mensagens antigas desta conversa pela API.</p>}
  {p.origin_history_status==='conflicting_channels'&&<p>O histórico cita mais de um canal. A origem permanece sem definição para evitar atribuição incorreta.</p>}
  {p.origin_history_events_access==='unavailable'&&<p className="text-[var(--text-tertiary)]">A Kommo não disponibilizou o histórico de alterações de campos pela integração. A consulta dessas alterações permanece incompleta.</p>}
 </div>
}

export function KommoOriginReview({clientId,start,end,rows,onReviewed}:{clientId:string;start:string;end:string;rows:TrackingRecord[];onReviewed:()=>void}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('')
 const scope=`${clientId}:${start}:${end}`,activeScope=useRef(scope)
 useEffect(()=>{activeScope.current=scope;return()=>{activeScope.current=''}},[scope])
 const historical=rows.filter(r=>r.payload.origin_review_status==='historical').length
 const reviewed=rows.filter(r=>r.payload.origin_review_status).length
 const withoutCurrent=rows.filter(r=>r.payload.source_status!=='Identificada')
 const restored=withoutCurrent.filter(r=>contactChannel(r)!=='Origem não identificada')
 const unknown=withoutCurrent.filter(r=>contactChannel(r)==='Origem não identificada')
 async function review(deep=false,history=false){
  const requestedScope=scope;setBusy(true);setNotice('Consultando os registros da Kommo…');setError('')
  let total=0
  try{
   const {data}=await supabase.auth.getSession();if(!data.session)throw new Error('Entre novamente para revisar as origens.')
   for(let batch=0;batch<40;batch++){
    if(activeScope.current!==requestedScope)return
    const response=await fetch('/api/kommo-status',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({client_id:clientId,action:history?'review_channel_history':deep?'review_origins_deep':'review_origins',start,end})})
    const result=await response.json() as {reviewed:number;recovered:number;failed:number;has_more:boolean;error?:string}
    if(!response.ok||typeof result.reviewed!=='number')throw new Error(result.error||'Não foi possível consultar a Kommo.')
    if(activeScope.current!==requestedScope)return
    total+=result.reviewed;setNotice(`${total} registros conferidos na Kommo.`)
    if(result.failed)throw new Error('Alguns registros não puderam ser confirmados na Kommo. Eles continuam sem atribuição; tente revisar novamente.')
    if(!result.has_more){setNotice(total?`${total} registros conferidos na Kommo.`:'A revisão está atualizada. Novas mensagens acionam consultas; os registros sem origem ficam disponíveis para nova revisão após 24 horas.');break}
    if(batch===39)setNotice('Lote revisado. Clique novamente para continuar os registros restantes.')
   }
  }catch(e){if(activeScope.current===requestedScope)setError(e instanceof Error?e.message:'Não foi possível revisar as origens.')}
  finally{if(activeScope.current===requestedScope){setBusy(false);onReviewed()}}
 }
 return <section aria-label="Revisão de origens da Kommo" className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
  <div className="flex justify-between items-start gap-4 flex-wrap"><div><h3 className="font-semibold">Revisão das origens</h3><p className="text-sm text-[var(--text-tertiary)] mt-2">{historical} contatos já existiam na Kommo antes desta conversa · {Math.max(0,unknown.length-unknown.filter(r=>r.payload.origin_review_status).length)} sem revisão neste período.</p></div><div className="flex flex-wrap gap-4"><button disabled={busy} onClick={()=>void review()} className="text-sm text-[var(--accent)] disabled:opacity-50">{busy?'Revisando…':'Investigar origens na Kommo'}</button><button disabled={busy} onClick={()=>void review(true)} className="text-sm text-[var(--accent)] disabled:opacity-50">Conferir cadastros e notas</button><button disabled={busy} onClick={()=>void review(false,true)} className="text-sm text-[var(--accent)] disabled:opacity-50">Cruzar conversas e eventos antigos</button></div></div>
  <p className="text-xs text-[var(--text-tertiary)]">A origem registrada no cadastro fica separada da origem da conversa atual. Um retorno de cliente não é contado como um novo clique. {reviewed} contatos com revisão registrada.</p>
  <div className="grid sm:grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-[var(--bg-surface-2)] p-3"><strong className="text-xl">{restored.length}</strong><p className="text-xs mt-1">Canal identificado na Kommo</p></div><div className="rounded-lg bg-[var(--bg-surface-2)] p-3"><strong className="text-xl">{unknown.length}</strong><p className="text-xs mt-1">Canal não informado</p></div></div>
  {notice&&<p role="status" className="text-sm text-[var(--accent)]">{notice}</p>}{error&&<p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
  {[{key:'restored',label:`Ver ${restored.length} contatos com canal identificado`,items:restored},{key:'unknown',label:`Ver ${unknown.length} contatos com canal não informado`,items:unknown}].filter(group=>group.items.length).map(group=><details key={group.key}><summary className="cursor-pointer text-sm text-[var(--accent)]">{group.label}</summary><div className="mt-4 max-h-96 overflow-auto"><table className="w-full text-sm"><thead className="text-left text-xs text-[var(--text-tertiary)]"><tr><th className="p-3">Contato / primeiro registro</th><th className="p-3">Diagnóstico e histórico</th></tr></thead><tbody>{group.items.map(r=><tr key={r.entity_key} className="border-t border-[var(--border)] align-top"><td className="p-3">{String(r.payload.name||'Contato Kommo')}<p className="text-xs text-[var(--text-tertiary)] mt-1">{date(r.occurred_at)}</p></td><td className="p-3"><OriginReviewEvidence payload={r.payload}/>{!r.payload.origin_review_status&&<span>Aguardando consulta à Kommo.</span>}</td></tr>)}</tbody></table></div></details>)}
 </section>
}
