import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, Check, RefreshCw, MessageSquare, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { previousContactOrigin } from '../lib/conversationOrigin'
import { Ga4TrackingStatus } from './Ga4TrackingStatus'
import { campaignName, trackingChannel } from '../lib/trackingDashboard'
import { TrackingDashboard } from './TrackingDashboard'
import { Footer } from './Footer'
import { WhatsAppConnectionSetup } from './WhatsAppConnectionSetup'
import { KommoConnectionStatus } from './KommoConnectionStatus'
import { emptySummary, periodBounds, syncIsFresh, trackingUrl, utmFields } from '../lib/whatsappTracking'
import type { TrackingConnection, TrackingLink, TrackingRecord, TrackingSummary } from '../lib/whatsappTracking'

const inputClass='w-full rounded-lg border px-3 py-2 text-sm bg-[var(--bg-surface-2)] border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]'
const panelClass='rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]'
const muted='text-[var(--text-tertiary)]'
const tabs=[['overview','Dashboard'],['messages','Mensagens'],['leads','Contatos'],['clicks','Cliques'],['links','Criar links'],['connections','Conexão']] as const
type Tab=typeof tabs[number][0]
const date=(value:unknown)=>value ? new Date(String(value)).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}) : '—'
const phone=(value:unknown)=>String(value ?? '').replace(/^55(\d{2})(\d{5})(\d{4})$/,'($1) $2-$3')

export function WhatsAppTrackingView({clientId,embedded=false,pilotOnly=false}:{clientId?:string;embedded?:boolean;pilotOnly?:boolean}) {
  const {profile}=useAuth()
  const [connections,setConnections]=useState<TrackingConnection[]>([])
  const [connectionId,setConnectionId]=useState('')
  const [tab,setTab]=useState<Tab>('overview')
  const [start,setStart]=useState(''); const [end,setEnd]=useState(''); const [source,setSource]=useState('')
  const [summary,setSummary]=useState<TrackingSummary>(emptySummary)
  const [originEvidence,setOriginEvidence]=useState<TrackingRecord[]>([])
  const [records,setRecords]=useState<TrackingRecord[]>([]); const [total,setTotal]=useState(0); const [page,setPage]=useState(0)
  const [links,setLinks]=useState<TrackingLink[]>([])
  const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [saving,setSaving]=useState(false)
  const [notice,setNotice]=useState(''); const [copied,setCopied]=useState('')
  const sequence=useRef(0)
  const [form,setForm]=useState({label:'',greeting:'Olá! Gostaria de mais informações.',utm_source:'',utm_medium:'',utm_campaign:'',utm_content:'',utm_term:''})
  const connection=connections.find(c=>c.id===connectionId)

  const refresh=useCallback(async()=>{
    const request=++sequence.current
    try {
      const bounds=periodBounds(start,end)
      let cq=supabase.from('wa_tracking_connections').select('*').order('created_at')
      if (clientId) cq=cq.eq('client_id',clientId)
      if (pilotOnly) cq=cq.is('client_id',null)
      const cr=await cq
      if(cr.error) throw cr.error
      if(request!==sequence.current)return
      setError('')
      const available=(cr.data as TrackingConnection[]).filter(c=>c.provider!=='kommo'||c.enabled)
      setConnections(available)
      const id=available.find(c=>c.id===connectionId)?.id ?? available[0]?.id ?? ''
      if(id!==connectionId) {setConnectionId(id);return}
      if(!id) {setSummary(emptySummary);setRecords([]);setLinks([]);setTotal(0);return}
      const entity=['messages','leads','clicks'].includes(tab)?tab:'messages'
      let query=supabase.from('wa_tracking_records').select('*',{count:'exact'}).eq('connection_id',id).eq('entity',entity)
        .order('occurred_at',{ascending:false}).order('entity_key').range(page*50,page*50+49)
      if(bounds.start)query=query.gte('occurred_at',bounds.start)
      if(bounds.end)query=query.lt('occurred_at',bounds.end)
      if(source.trim())query=query.eq('payload->>utm_source',source.trim())
      const [sr,rr,lr]=await Promise.all([
        supabase.rpc('wa_tracking_summary',{p_connection_id:id,p_start:bounds.start,p_end:bounds.end,p_source:source.trim()||null}),
        query,
        supabase.from('wa_tracking_links').select('*').eq('connection_id',id).eq('archived',false).order('created_at',{ascending:false}).limit(100),
      ])
      if(sr.error||rr.error||lr.error)throw sr.error||rr.error||lr.error
      if(request!==sequence.current)return
      const pageRows=rr.data as TrackingRecord[]
      const contactIds=[...new Set(pageRows.map(r=>String(r.payload.contact_id||'')).filter(Boolean))]
      let evidence:TrackingRecord[]=[]
      if(entity==='messages'&&contactIds.length){
        const newest=pageRows.reduce((a,r)=>r.occurred_at>a?r.occurred_at:a,'')
        const origins=await supabase.from('wa_tracking_records').select('entity,entity_key,occurred_at,payload')
          .eq('connection_id',id).eq('entity','messages').eq('payload->>source_status','Identificada')
          .in('payload->>contact_id',contactIds).lte('occurred_at',newest).order('occurred_at',{ascending:false}).limit(1000)
        if(origins.error)throw origins.error
        evidence=origins.data as TrackingRecord[]
      }
      if(request!==sequence.current)return
      setOriginEvidence(evidence)
      setSummary(sr.data as TrackingSummary);setRecords(rr.data as TrackingRecord[]);setTotal(rr.count??0);setLinks(lr.data as TrackingLink[])
    } catch {if(request===sequence.current)setError(start&&end&&start>end?'A data inicial deve vir antes da data final.':'Não foi possível atualizar os dados. Tente novamente.')} finally {if(request===sequence.current)setLoading(false)}
  },[clientId,pilotOnly,connectionId,start,end,source,tab,page])
  useEffect(()=>{
    // This effect synchronizes remote data; refresh also reports invalid date input.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
    const timer=setInterval(()=>{if(!document.hidden)void refresh()},30000)
    const invalidate=()=>{sequence.current+=1}
    return()=>{invalidate();clearInterval(timer)}
  },[refresh])
  const changeFilter=(fn:(v:string)=>void,value:string)=>{setLoading(true);setPage(0);fn(value)}
  async function copy(url:string,id:string) {try{await navigator.clipboard.writeText(url);setCopied(id);setNotice('Link copiado.')}catch{setError('Não foi possível copiar. Selecione o endereço e copie manualmente.')}}
  async function saveLink(event:React.FormEvent) {
    event.preventDefault();if(!connection||!profile)return
    setSaving(true);setError('');setNotice('')
    try {
      trackingUrl(connection,form)
      if(!form.label.trim())throw new Error('Dê um nome para o link.')
      const r=await supabase.from('wa_tracking_links').insert({...form,label:form.label.trim(),connection_id:connection.id,created_by:profile.id}).select().single()
      if(r.error)throw new Error('Não foi possível salvar o link. Tente novamente.')
      setNotice('Link salvo no Orbe OS. Ele já pode ser copiado.');await refresh()
    } catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar.')}finally{setSaving(false)}
  }
  const fresh=syncIsFresh(connection?.last_sync_at??null)
  return <div className="flex flex-col min-h-full min-w-0">
    <div className={`flex-1 w-full min-w-0 space-y-6 ${embedded?'py-4':'max-w-screen-2xl mx-auto px-4 md:px-6 py-8'}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div><p className="text-xs uppercase tracking-widest text-[var(--accent)]">Origens e conversas</p><h1 className="text-xl font-bold text-[var(--text-primary)]">WhatsApp e UTMs</h1><p className={`text-sm mt-1 ${muted}`}>Acompanhe as mensagens recebidas e a campanha que trouxe cada contato.</p></div>
        <button onClick={()=>void refresh()} disabled={loading} className="flex items-center gap-2 text-sm text-[var(--accent)] disabled:opacity-50"><RefreshCw size={16} className={loading?'animate-spin':''}/>Atualizar</button>
      </div>
      {error&&<div role="alert" className="rounded-xl p-4 text-sm bg-[var(--danger-tint)] text-[var(--danger)] flex gap-2"><AlertCircle size={18}/>{error}</div>}
      {notice&&<div role="status" className="text-sm text-[var(--accent)]">{notice}</div>}
      {connections.length===0&&!loading&&!error?<>{clientId?<WhatsAppConnectionSetup clientId={clientId} onConnected={()=>void refresh()}/>:<div className={`${panelClass} p-8 text-center`}><MessageSquare className="mx-auto mb-3 text-[var(--accent)]"/><h2 className="font-semibold">Nenhum WhatsApp conectado</h2></div>}</>:<>
        <div className={`${panelClass} p-4 flex flex-wrap items-center gap-4`}>
          <label className="min-w-0 flex-1 max-w-md text-xs">Conexão<select aria-label="Conexão" className={`${inputClass} mt-1`} value={connectionId} onChange={e=>changeFilter(setConnectionId,e.target.value)}>{connections.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <div className="text-sm"><p className={fresh?'text-[var(--accent)]':muted}>{connection?.provider==='kommo'?(connection.last_received_at?'Mensagens recebidas pela Kommo':'Aguardando primeira mensagem da Kommo'):(fresh?'Sincronização ativa':'Aguardando sincronização')}</p><p className={`text-xs mt-1 ${muted}`}>Última atualização: {date(connection?.last_sync_at)}</p></div>
          {connection?.capture_mode==='pilot'&&<span className="text-xs px-3 py-2 rounded-lg bg-[var(--accent-tint)] text-[var(--accent)]">Piloto · somente remetente autorizado</span>}
        </div>
        <div className="flex gap-1 border-b border-[var(--border)] overflow-x-auto" role="tablist" aria-label="Acompanhamento WhatsApp">{tabs.map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} onClick={()=>{setTab(id);setPage(0);setNotice('')}} className={`whitespace-nowrap px-4 py-3 text-sm border-b-2 ${tab===id?'border-[var(--accent)] text-[var(--accent)]':'border-transparent text-[var(--text-tertiary)]'}`}>{label}</button>)}</div>
        {!['links','connections'].includes(tab)&&<div className="flex flex-wrap gap-3 items-end">
          <label className="text-xs">De<input aria-label="Data inicial" type="date" className={`${inputClass} mt-1`} value={start} onChange={e=>changeFilter(setStart,e.target.value)}/></label>
          <label className="text-xs">Até<input aria-label="Data final" type="date" className={`${inputClass} mt-1`} value={end} onChange={e=>changeFilter(setEnd,e.target.value)}/></label>
          <label className="text-xs">Origem<input aria-label="Filtrar origem" placeholder="Todas as origens" className={`${inputClass} mt-1`} value={source} onChange={e=>changeFilter(setSource,e.target.value)}/></label>
          {(start||end||source)&&<button className="text-sm text-[var(--accent)] py-2" onClick={()=>{setStart('');setEnd('');setSource('');setPage(0)}}>Limpar filtros</button>}
        </div>}
        {tab==='overview'&&<>
          <TrackingDashboard key={`${connectionId}:${start}:${end}:${source}`} revision={summary.messages} source={source.trim()} connectionId={connectionId} start={periodBounds(start,end).start} end={periodBounds(start,end).end}/>
          <h2 className="font-semibold">Atividade de conversas no período</h2>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">{[['Cliques',summary.clicks],['Contatos que enviaram mensagem',summary.contacts],['Mensagens recebidas',summary.messages],['Mensagens com origem',summary.identified]].map(([label,value])=><div className={`${panelClass} p-5`} key={String(label)}><p className={`text-xs ${muted}`}>{label}</p><p className="text-3xl font-semibold mt-2">{value}</p></div>)}</div>
          <p className={`text-xs ${muted}`}>{summary.unidentified} mensagem(ns) sem origem identificada no período. Abrir o link registra um clique; o contato aparece após enviar uma mensagem.</p>
          <div className={`${panelClass} overflow-hidden`}><h2 className="font-semibold p-5 border-b border-[var(--border)]">Mensagens por campanha</h2>{summary.campaigns.length===0?<p className={`p-6 text-sm ${muted}`}>Nenhuma mensagem neste período.</p>:<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className={`text-left ${muted}`}><th className="p-4">Origem</th><th className="p-4">Campanha</th><th className="p-4">Contatos</th><th className="p-4">Mensagens</th></tr></thead><tbody>{summary.campaigns.map(c=><tr key={`${c.source}\0${c.campaign}`} className="border-t border-[var(--border)]"><td className="p-4">{trackingChannel({utm_source:c.source})}</td><td className="p-4 break-words">{campaignName({utm_campaign:c.campaign,utm_source:c.source},connectionId)}</td><td className="p-4">{c.contacts}</td><td className="p-4">{c.messages}</td></tr>)}</tbody></table></div>}</div>
        </>}
        {['messages','leads','clicks'].includes(tab)&&<div className={`${panelClass} overflow-hidden`}>
          <div className="p-4 flex justify-between text-sm"><span>{total} {tab==='messages'?'mensagens':tab==='leads'?'contatos':'cliques'}</span>{loading&&<span className={muted}>Atualizando…</span>}</div>
          {tab==='messages'&&<p className={`px-4 pb-4 text-xs ${muted}`}>Quando uma mensagem não traz origem, mostramos o histórico já comprovado do contato, se houver. Esse histórico não é contado como um novo clique ou uma nova conversão da campanha. O filtro de origem considera apenas a origem confirmada da própria mensagem.</p>}
          {tab==='leads'&&<p className={`px-4 pb-4 text-xs ${muted}`}>O período filtra a primeira interação. As UTMs do contato representam sua primeira origem identificada; cada mensagem mantém a própria origem.</p>}
          {records.length===0?<p className={`p-6 text-sm ${muted}`}>Nenhum registro para os filtros selecionados.</p>:<div className="overflow-x-auto"><table className="w-full text-sm min-w-[850px]"><thead className={`text-left ${muted}`}><tr><th className="p-4">{tab==='clicks'?'Data do clique':'Contato'}</th><th className="p-4">{tab==='leads'?'Última mensagem':tab==='clicks'?'Mensagem recebida':'Mensagem'}</th><th className="p-4">Origem / campanha</th><th className="p-4">UTMs e IDs de clique</th></tr></thead><tbody>{records.map(row=>{const p=row.payload;const prior=previousContactOrigin(row,originEvidence);return <tr key={row.entity_key} className="border-t border-[var(--border)] align-top"><td className="p-4"><p className="font-medium">{tab==='clicks'?date(row.occurred_at):String(p.name||'Sem nome')}</p>{tab!=='clicks'&&<><p className={`text-xs ${muted}`}>{p.phone?phone(p.phone):'Telefone não confirmado'}</p><p className={`text-xs mt-1 ${muted}`}>{date(row.occurred_at)}</p></>}</td><td className="p-4 max-w-sm"><p className="whitespace-pre-wrap break-words">{tab==='clicks'?(p.linked_sender_id?'Sim':'Ainda não'):String(tab==='leads'?p.last_message:p.text)}</p>
          {tab==='leads'&&<p className={`text-xs mt-2 ${muted}`}>{p.message_count} mensagem(ns) · última em {date(p.last_interaction)}</p>}</td><td className="p-4"><p className="font-medium">{String(p.utm_source||(p.gclid?'Google · clique':p.fbclid?'Meta · clique':'Sem origem'))}</p><p className={`text-xs mt-1 ${muted}`}>{campaignName(p,connectionId)}</p>{tab!=='clicks'&&<p className={`text-xs mt-2 ${p.source_status==='Identificada'?'text-[var(--accent)]':muted}`}>{p.attribution_reason==='campaign_marker'?'Identificada · marcador da mensagem do anúncio (sem ID de clique)':p.attribution_reason==='kommo_lead_first_touch'?'Identificada · origem do lead na Kommo':String(p.source_status)}</p>}{prior&&<div className="mt-3 border-t border-[var(--border)] pt-3 text-xs"><p className="font-medium">Origem anterior do contato: {String(prior.payload.utm_source||'Clique identificado')}</p><p className={muted}>{campaignName(prior.payload,connectionId)} · {date(prior.occurred_at)}</p>{prior.payload.utm_content&&<p className={`mt-1 ${muted}`}>{String(prior.payload.utm_content)}</p>}<p className={`mt-1 ${muted}`}>Histórico comprovado; a origem desta nova mensagem não foi confirmada.</p></div>}</td><td className="p-4"><dl className="text-xs space-y-1">{[...utmFields,'gclid','fbclid'].map(k=><div key={k} className="flex gap-2"><dt className={`${muted} w-16 shrink-0`}>{k.replace('utm_','')}</dt><dd className="break-all">{String(p[k]||'—')}</dd></div>)}</dl></td></tr>})}</tbody></table></div>}
          <div className="p-4 flex justify-end items-center gap-4 border-t border-[var(--border)] text-sm"><button disabled={page===0||loading} className="disabled:opacity-30" onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page+1}</span><button disabled={(page+1)*50>=total||loading} className="disabled:opacity-30" onClick={()=>setPage(p=>p+1)}>Próxima</button></div>
        </div>}
        {tab==='links'&&connection&&<div className="grid lg:grid-cols-2 gap-6">
          <form onSubmit={saveLink} className={`${panelClass} p-5 space-y-4`}><h2 className="font-semibold">Novo link para WhatsApp</h2><p className={`text-xs ${muted}`}>Destino: {phone(connection.destination)}. O identificador é inserido automaticamente no texto quando alguém abre o link.</p>
            <label className="block text-xs">Nome do link<input required maxLength={100} className={`${inputClass} mt-1`} value={form.label} onChange={e=>setForm({...form,label:e.target.value})} placeholder="Google · campanha de outubro"/></label>
            <label className="block text-xs">Mensagem de saudação<textarea required maxLength={500} rows={3} className={`${inputClass} mt-1`} value={form.greeting} onChange={e=>setForm({...form,greeting:e.target.value})}/></label>
            <div className="grid sm:grid-cols-2 gap-3">{utmFields.map(k=><label key={k} className="block text-xs">{k}<input required={k==='utm_source'||k==='utm_medium'} maxLength={256} className={`${inputClass} mt-1`} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}</div>
            <button type="submit" disabled={saving||!connection.enabled} className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold disabled:opacity-40">{saving?'Salvando…':'Salvar link'}</button>
            <p className={`text-xs ${muted}`}>GCLID e FBCLID são capturados quando chegam no endereço acessado; não use códigos fixos no gerador. Em páginas e LPs, os botões precisam repassar esses parâmetros. Anúncios que abrem o WhatsApp diretamente exigem a integração do canal.</p>
          </form>
          <div className="space-y-3"><h2 className="font-semibold">Links salvos</h2>{links.length===0&&<p className={`text-sm ${muted}`}>Seus links ficam salvos na plataforma e disponíveis em outros computadores.</p>}{links.map(link=>{let url='';try{url=trackingUrl(connection,link)}catch{return null}return <div key={link.id} className={`${panelClass} p-4 space-y-3`}><div className="flex justify-between gap-3"><h3 className="font-medium">{link.label}</h3><button aria-label={`Copiar ${link.label}`} onClick={()=>void copy(url,link.id)} className="text-[var(--accent)]">{copied===link.id?<Check size={17}/>:<Copy size={17}/>}</button></div><p className={`text-xs ${muted}`}>{link.utm_source} · {link.utm_campaign||'Sem campanha'}</p><p className="text-sm whitespace-pre-wrap">{link.greeting}</p><textarea aria-label={`Endereço de ${link.label}`} readOnly value={url} rows={3} className={`${inputClass} text-xs`}/></div>})}</div>
        </div>}
        {tab==='connections'&&connection&&<div className={`${panelClass} p-6 space-y-4 max-w-2xl`}><h2 className="font-semibold">{connection.name}</h2><dl className="grid grid-cols-2 gap-4 text-sm"><dt className={muted}>Canal</dt><dd>{connection.provider==='evolution'?'WhatsApp por aparelho vinculado':connection.provider==='kommo'?'API oficial via Kommo':'API oficial Meta'}</dd><dt className={muted}>{connection.provider==='kommo'?'Destino dos links':'Número conectado'}</dt><dd>{phone(connection.destination)}</dd><dt className={muted}>Estado do WhatsApp</dt><dd>{connection.provider==='kommo'?(connection.last_received_at?'Evento recebido':'Aguardando evento real'):!fresh?'Sem confirmação recente':({open:'Conectado',close:'Desconectado',connecting:'Conectando',unknown:'Não confirmado'}[connection.connection_state])}</dd><dt className={muted}>Última mensagem</dt><dd>{date(connection.last_received_at)}</dd><dt className={muted}>Última sincronização</dt><dd>{date(connection.last_sync_at)}</dd></dl>{connection.provider==='kommo'&&connection.client_id&&<><KommoConnectionStatus clientId={connection.client_id}/><Ga4TrackingStatus key={connection.id} clientId={connection.client_id} connectionId={connection.id}/></>} {connection.capture_mode==='pilot'&&<p className={`text-sm ${muted}`}>Este piloto registra somente mensagens de {connection.allowed_senders.map(phone).join(', ')}. Outros clientes e números ainda não estão conectados.</p>}<p className={`text-xs ${muted}`}>As credenciais ficam protegidas no servidor. Se o texto de identificação for removido antes do envio, a mensagem será registrada sem origem.</p></div>}
      </>}
    </div>{!embedded&&<Footer/>}
  </div>
}
