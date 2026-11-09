import { useEffect, useMemo, useState } from 'react'
import { Globe, HelpCircle, Camera, Search, TestTubeDiagonal, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { TrackingRecord } from '../lib/whatsappTracking'
import { utmFields } from '../lib/whatsappTracking'
import { campaignName } from '../lib/trackingDashboard'
import { cleanConversationText, contactJourney, conversationBrief, conversationOrigins, groupConversations, originKind } from '../lib/trackingConversations'
import type { ConversationContext, ConversationEvent, OriginKind } from '../lib/trackingConversations'

const date=(v:string)=>new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'})
const shortDate=(v:string)=>new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'})
const originLabels:Record<OriginKind,string>={google:'Google',meta:'Meta',instagram:'Instagram',site:'Site',test:'Teste',other:'Outra origem',unknown:'Origem não identificada'}
function OriginIcon({kind}:{kind:OriginKind}) {
 if(kind==='google')return <svg aria-hidden="true" viewBox="0 0 24 24" className="w-4 h-4 shrink-0"><path fill="currentColor" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02 6.1 6.1 0 1 1 1.74-9.7l2.9-2.9A10 10 0 1 0 22 12c0 .08-.4.15-.4.23Z"/></svg>
 if(kind==='meta')return <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-4 shrink-0"><path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" d="M12 12C9 6 7 5 5 7c-3 3-5 11 0 11 3 0 5-7 7-10 2-3 4-3 6 0 3 4 4 10 0 10-3 0-4-3-6-6Z"/></svg>
 if(kind==='instagram')return <Camera size={15}/>
 if(kind==='site')return <Globe size={15}/>
 if(kind==='test')return <TestTubeDiagonal size={15}/>
 return <HelpCircle size={15}/>
}
function OriginBadge({row,historical=false}:{row?:TrackingRecord;historical?:boolean}) {
 const kind=row?originKind(row.payload):'unknown'
 return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ${kind==='unknown'?'bg-[var(--bg-surface-2)] text-[var(--text-tertiary)]':'bg-[var(--accent-tint)] text-[var(--accent)]'}`}><OriginIcon kind={kind}/>{kind==='other'?String(row?.payload.utm_source):originLabels[kind]}{historical?' · histórico':''}</span>
}
function Avatar({name}:{name:string}) {
 const initial=Array.from(name.replace(/[^\p{L}\p{N}\s]/gu,'').trim())[0]?.toUpperCase()||'?'
 return <span aria-hidden="true" className="flex w-11 h-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent-tint)] text-[var(--accent)] text-lg font-semibold">{initial}</span>
}
export function TrackingConversations({connectionId,records,originEvidence=[],refreshRevision=0}:{connectionId:string;records:TrackingRecord[];originEvidence?:TrackingRecord[];refreshRevision?:number}) {
 const [selected,setSelected]=useState(''),[search,setSearch]=useState(''),[page,setPage]=useState(0)
 const [history,setHistory]=useState<{key:string;events:ConversationEvent[];context:ConversationContext|null;error:string}>({key:'',events:[],context:null,error:''})
 const conversations=useMemo(()=>groupConversations(records),[records])
 const visibleIds=conversations.filter(c=>!search||`${c.name} ${c.phone}`.toLowerCase().includes(search.toLowerCase())).slice(page*25,(page+1)*25).map(c=>c.id)
 const contactsKey=JSON.stringify([...new Set([...visibleIds,...(selected?[selected]:[])])].sort())
 const revision=conversations.map(c=>`${c.id}:${c.last.occurred_at}:${c.messages.length}`).sort().join('|')
 const requestKey=`${connectionId}:${contactsKey}:${revision}:${refreshRevision}`
 useEffect(()=>{
  let active=true
  void(async()=>{
   try {
    const ids=JSON.parse(contactsKey) as string[]
    const events:ConversationEvent[]=[]
    const contextResult=await supabase.from('wa_tracking_context').select('attendant_name,attendant_description,contacts').eq('connection_id',connectionId).maybeSingle()
    // Failure is visible: never silently lose user-confirmed roles.
    if(contextResult.error)throw contextResult.error
    for(let i=0;i<ids.length;i+=50)for(let offset=0;;offset+=500){
     const result=await supabase.from('wa_conversation_events').select('contact_id,event_id,direction,author_name,message_text,occurred_at').eq('connection_id',connectionId).in('contact_id',ids.slice(i,i+50)).order('occurred_at').order('event_id').order('direction').range(offset,offset+499)
     if(result.error)throw result.error
     if(!active)return
     events.push(...result.data)
     if(result.data.length<500)break
    }
    if(active)setHistory({key:requestKey,events,context:contextResult.data as ConversationContext|null,error:''})
   }catch{if(active)setHistory({key:requestKey,events:[],context:null,error:'Não foi possível carregar o histórico e o contexto. Exibindo somente mensagens recebidas no período.'})}
  })()
  return()=>{active=false}
 },[connectionId,contactsKey,requestKey])
 const loading=history.key!==requestKey
 const eventsByContact=useMemo(()=>{const map=new Map<string,ConversationEvent[]>();if(history.key!==requestKey)return map;for(const event of history.events){const list=map.get(event.contact_id)||[];list.push(event);map.set(event.contact_id,list)}return map},[history,requestKey])
 const context=loading?null:history.context
 const cards=conversations.map(c=>{
  const events=eventsByContact.get(c.id)||[]
  const brief=conversationBrief(events.length?events.map(e=>e.message_text):c.messages.map(m=>String(m.payload.text||'')))
  const role=context?.contacts[c.id]
  return {...c,events,brief,role,journey:contactJourney(c.messages),origins:conversationOrigins(c.messages,originEvidence)}
 })
 const filtered=cards.filter(c=>`${c.name} ${c.phone} ${c.role?.role||''} ${c.brief.summary}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
 const current=cards.find(c=>c.id===selected)
 const safePage=Math.min(page,Math.max(0,Math.ceil(filtered.length/25)-1))
 const currentEvents=current?.events.length?current.events:current?.messages.map(r=>({contact_id:current.id,event_id:r.entity_key,direction:'incoming',author_name:'',message_text:String(r.payload.text||''),occurred_at:r.occurred_at}))||[]
 return <section aria-label="Conversas" className="border-t border-[var(--border)]">
  <div className="px-4 py-3 flex flex-wrap justify-between gap-2 text-xs text-[var(--text-tertiary)]"><p>{conversations.length} conversas · resumos pelos textos disponíveis{loading?' · carregando histórico…':''}</p>{context?.attendant_name&&<p>Atendimento: <strong className="text-[var(--text-primary)]">{context.attendant_name}</strong> · {context.attendant_description}</p>}</div>
  {!loading&&history.error&&<p role="alert" className="px-4 pb-3 text-sm text-[var(--danger)]">{history.error}</p>}
  <div className="grid lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.4fr)] min-w-0">
   <div className="min-w-0 border-r border-[var(--border)]">
    <label className="m-3 flex items-center gap-2 rounded-xl bg-[var(--bg-surface-2)] p-3 text-[var(--text-tertiary)]"><Search size={16}/><input aria-label="Buscar conversa" placeholder="Buscar nome, telefone ou assunto" value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}} className="bg-transparent outline-none w-full min-w-0 text-sm text-[var(--text-primary)]"/></label>
    <div className="max-h-[70vh] overflow-y-auto">{filtered.slice(safePage*25,(safePage+1)*25).map(c=><button key={c.id} aria-label={`Abrir conversa de ${c.name}`} aria-pressed={selected===c.id} onClick={()=>setSelected(c.id)} className={`w-full flex gap-3 text-left p-4 border-b border-[var(--border)] transition-colors hover:bg-[var(--bg-surface-2)] ${selected===c.id?'bg-[var(--accent-tint)]':''}`}>
     <Avatar name={c.name}/><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="font-semibold text-sm truncate">{c.name}</p><time className="shrink-0 text-[10px] text-[var(--text-tertiary)]">{shortDate(c.last.occurred_at)}</time></div>
      <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{c.role?.role||'Relação a confirmar'}</p>
      <p className="mt-2 text-sm line-clamp-2">{c.brief.summary}</p>
      <p className="mt-1 text-xs text-[var(--text-tertiary)] line-clamp-2">{c.brief.quote?`“${c.brief.quote}”`:'Mensagem sem texto'}</p>
      {c.journey&&<p className="text-[10px] mt-1 text-[var(--text-tertiary)]">{c.journey}</p>}<div className="flex flex-wrap gap-1 mt-2">{c.origins.rows.length?c.origins.rows.map(r=><OriginBadge key={r.entity_key} row={r} historical={c.origins.historical}/>):<OriginBadge/>}</div>
     </div></button>)}{!filtered.length&&<p className="p-5 text-sm">Nenhuma conversa encontrada.</p>}</div>
    <div className="p-3 flex justify-between gap-2 text-xs text-[var(--text-tertiary)]"><button disabled={!safePage} className="disabled:opacity-30" onClick={()=>setPage(p=>Math.max(0,p-1))}>Anterior</button><span>Página {safePage+1}</span><button disabled={(safePage+1)*25>=filtered.length} className="disabled:opacity-30" onClick={()=>setPage(safePage+1)}>Próxima</button></div>
   </div>
   <div className="min-w-0 bg-[var(--bg-surface-2)]">{current?<>
    <header className="p-4 bg-[var(--bg-surface)] border-b border-[var(--border)] flex gap-3 items-center"><Avatar name={current.name}/><div className="flex-1 min-w-0"><h2 className="font-semibold">{current.name}</h2><p className="text-xs text-[var(--text-tertiary)]">{current.role?.role||'Relação a confirmar'} · {current.phone}</p>{current.role&&<p className="text-[10px] text-[var(--text-tertiary)]">{current.role.evidence}</p>}</div><button aria-label="Fechar conversa" onClick={()=>setSelected('')} className="p-2 rounded-lg hover:bg-[var(--bg-surface-2)]"><X size={18}/></button></header>
    <div className="p-4 space-y-3"><div className="p-3 rounded-xl bg-[var(--bg-surface)]"><p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Resumo da conversa</p><p className="text-sm mt-1">{current.brief.summary}</p>{current.journey&&<p className="text-xs mt-2 text-[var(--accent)]">{current.journey}</p>}<p className="text-xs mt-1 text-[var(--text-tertiary)]">Temas encontrados no texto; não confirma profissão, compra ou conclusão.</p></div>
     <details className="rounded-xl p-3 bg-[var(--bg-surface)]" open><summary className="cursor-pointer text-sm font-medium">Origem e UTMs <span className="ml-2 inline-flex gap-1 align-middle">{current.origins.rows.length?current.origins.rows.map(r=><OriginBadge key={r.entity_key} row={r} historical={current.origins.historical}/>):<OriginBadge/>}</span></summary>
      {!current.origins.rows.length?<p className="text-xs mt-3 text-[var(--text-tertiary)]">Nenhuma UTM comprovada para esta conversa. Cliques sem mensagem vinculada ficam na aba Cliques.</p>:<div className="mt-3 space-y-3">{current.origins.historical&&<p className="text-xs text-[var(--text-tertiary)]">Origem comprovada no histórico da Kommo. As UTMs abaixo são daquele registro; não representam um novo clique ou a origem do retorno atual.</p>}{current.origins.rows.map(r=><div key={r.entity_key} className="border-t border-[var(--border)] pt-2"><p className="text-xs font-medium">{campaignName(r.payload,connectionId)} · {date(r.occurred_at)}</p><dl className="grid sm:grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs">{[...utmFields,'gclid','fbclid'].map(field=><div key={field} className="flex gap-2 min-w-0"><dt className="shrink-0 text-[var(--text-tertiary)]">{field}</dt><dd className="break-all">{String(r.payload[field]||'—')}</dd></div>)}</dl></div>)}</div>}
     </details>
    </div>
    <div aria-label={`Histórico de ${current.name}`} className="px-4 pb-4 max-h-[52vh] overflow-y-auto space-y-3">{loading?<p role="status" className="text-sm">Carregando conversa…</p>:currentEvents.map(e=><div key={`${e.direction}:${e.event_id}`} className={`rounded-2xl p-3 text-sm max-w-[90%] shadow-sm ${e.direction==='outgoing'?'ml-auto bg-[var(--accent-tint)] rounded-tr-sm':'bg-[var(--bg-surface)] rounded-tl-sm'}`}><p className="text-[10px] mb-1 font-medium text-[var(--text-tertiary)]">{e.direction==='incoming'?current.name:e.author_name||context?.attendant_name||'Atendimento'} · {date(e.occurred_at)}</p><p className="whitespace-pre-wrap break-words">{cleanConversationText(e.message_text)||'Mensagem sem texto'}</p></div>)}{!loading&&!current.events.length&&<p className="text-xs text-[var(--text-tertiary)]">Somente mensagens recebidas no período; respostas não disponíveis.</p>}</div>
   </>:<div className="min-h-[420px] flex flex-col items-center justify-center p-8 text-center text-[var(--text-tertiary)]"><p className="font-semibold text-lg text-[var(--text-primary)]">Suas conversas, em um só lugar</p><p className="mt-2 text-sm max-w-sm">Escolha um contato para ver a conversa, o resumo e a origem comprovada.</p><p className="mt-4 text-xs max-w-sm">Os ícones mostram a origem da mensagem. A relação do contato com a empresa aparece separada.</p></div>}</div>
  </div>
 </section>
}
