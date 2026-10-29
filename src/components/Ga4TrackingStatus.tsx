import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
type Stream={measurement_id:string;site_hostname:string;enabled:boolean}
type Delivery={id:string;measurement_id:string;status:string;last_error:string;received_at:string}
type State={streams:Stream[];recent:Delivery[]}
const field='w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] px-3 py-2 text-sm'
const labels:Record<string,string>={pending:'Aguardando envio',sending:'Enviando',submitted:'Enviado · conferir no GA4',uncertain:'Entrega incerta · revisar antes de reenviar',failed:'Não enviado'}
export function Ga4TrackingStatus({clientId,connectionId}:{clientId:string;connectionId:string}) {
 const [state,setState]=useState<State|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[editing,setEditing]=useState(false)
 const [form,setForm]=useState({site_hostname:'',measurement_id:'',api_secret:''})
 useEffect(()=>{
  const abort=new AbortController()
  void (async()=>{try{const {data}=await supabase.auth.getSession();if(!data.session)return;const response=await fetch('/api/ga4-tracking',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({client_id:clientId,connection_id:connectionId,action:'status'}),signal:abort.signal});const result=await response.json();if(!response.ok)throw Error(result.error);if(!abort.signal.aborted)setState(result)}catch{if(!abort.signal.aborted)setError('A integração GA4 ainda precisa ser configurada no servidor.')}})()
  return()=>abort.abort()
 },[clientId,connectionId])
 async function action(name:string,values:Record<string,string>={}) {
  setBusy(true);setError('')
  try{const {data}=await supabase.auth.getSession();if(!data.session)throw Error('Entre novamente no Orbe.');const response=await fetch('/api/ga4-tracking',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({client_id:clientId,connection_id:connectionId,action:name,...values})});const result=await response.json();if(!response.ok)throw Error(result.error);setState(result);if(name==='configure'){setForm({site_hostname:'',measurement_id:'',api_secret:''});setEditing(false)}}catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar.')}finally{setBusy(false)}
 }
 return <section className="border-t border-[var(--border)] pt-4 space-y-3" aria-label="GA4 — mensagens recebidas">
  <h3 className="font-medium">GA4 · mensagens recebidas</h3>
  <p className="text-xs text-[var(--text-tertiary)]">O clique no botão e a mensagem recebida são etapas diferentes. Enviamos a confirmação uma vez por link aberto, quando existe uma sessão válida do site. Nome, telefone e texto da conversa não são enviados.</p>
  {state?.streams.length===0&&<p className="text-sm">Nenhum site conectado ao envio de confirmações.</p>}
  {state?.streams.map(s=><div key={s.measurement_id} className="text-sm flex justify-between gap-3"><span>{s.site_hostname} · {s.measurement_id}<br/><span className="text-xs text-[var(--text-tertiary)]">{s.enabled?'Configurado · validação depende do evento aparecer no GA4':'Envio desativado'}</span></span>{s.enabled&&<button type="button" disabled={busy} onClick={()=>void action('disable',{measurement_id:s.measurement_id})}>Desativar</button>}</div>)}
  <div className="flex flex-wrap gap-4 text-sm text-[var(--accent)]"><button type="button" disabled={busy} onClick={()=>{setEditing(!editing);setForm({...form,api_secret:''})}}>{editing?'Fechar configuração':'Conectar site ao GA4'}</button><button type="button" disabled={busy} onClick={()=>void action('status')}>Atualizar</button>{state?.recent.some(r=>r.status==='pending')&&<button type="button" disabled={busy} onClick={()=>void action('process')}>Enviar pendentes</button>}</div>
  {editing&&<form className="space-y-3" onSubmit={e=>{e.preventDefault();void action('configure',form)}}>
   <label className="block text-xs">Domínio do site<input className={field} required maxLength={120} placeholder="planos.rayafit.com.br" value={form.site_hostname} onChange={e=>setForm({...form,site_hostname:e.target.value})}/></label>
   <label className="block text-xs">ID de medição do GA4<input className={field} required maxLength={20} placeholder="G-XXXXXXXXXX" value={form.measurement_id} onChange={e=>setForm({...form,measurement_id:e.target.value})}/></label>
   <label className="block text-xs">Chave do Measurement Protocol<input type="password" autoComplete="off" className={field} required maxLength={200} value={form.api_secret} onChange={e=>setForm({...form,api_secret:e.target.value})}/></label>
   <p className="text-xs text-[var(--text-tertiary)]">A chave será guardada criptografada no servidor. O site também precisa da conexão de sessão no Tag Manager.</p>
   <button disabled={busy} className="rounded-lg px-4 py-2 bg-[var(--accent)] text-white text-sm">{busy?'Salvando…':'Salvar conexão'}</button>
  </form>}
  {error&&<p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
  {state?.recent.length===0&&<p className="text-xs text-[var(--text-tertiary)]">Ainda não há confirmação de mensagem para enviar ao GA4.</p>}
  {!!state?.recent.length&&<ul className="space-y-2 text-xs">{state.recent.map(r=><li key={r.id}>{new Date(r.received_at).toLocaleString('pt-BR')} · {r.measurement_id} · {labels[r.status]||'Não confirmado'}</li>)}</ul>}
 </section>
}
