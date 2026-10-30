import {useEffect,useRef,useState} from 'react'
import {CheckCircle2,QrCode,RefreshCw} from 'lucide-react'
import {supabase} from '../lib/supabase'
type State={status:string;qr?:string|null;expires_at?:string;destination?:string}
const labels:Record<string,string>={idle:'Pronto para gerar o QR',requested:'Preparando QR…',connecting:'Conectando ao WhatsApp…',qr:'Leia o QR com o WhatsApp do cliente',open:'Conexão ativa',close:'WhatsApp desconectado',expired:'QR expirado. Gere um novo.',offline:'Servidor de conexão indisponível. Tentando novamente…',not_prepared:'Conexão em preparação',wrong_number:'O aparelho lido usa outro número. Conecte o número cadastrado.',error:'Não foi possível conectar. Tente novamente.'}
export function QRActivation({clientId,destination,beforeConnect,onConnected}:{clientId:string;destination:string;beforeConnect:()=>Promise<boolean>;onConnected?:()=>void}){
 const [state,setState]=useState<State>({status:'loading'}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[now,setNow]=useState(()=>Date.now())
 const sequence=useRef(0),callback=useRef(onConnected),wasOpen=useRef(false)
 useEffect(()=>{callback.current=onConnected},[onConnected])
 async function request(action:'generate'|'status',signal?:AbortSignal){
  const {data}=await supabase.auth.getSession()
  if(!data.session)throw new Error('Sua sessão expirou. Entre novamente no Studio.')
  const response=await fetch('/api/whatsapp-qr',{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action,client_id:clientId}),signal})
  const result=await response.json()
  if(!response.ok)throw new Error(result.error==='setup_changed'?'O telefone mudou. Salve os dados e peça a preparação da nova conexão.':result.error==='worker_offline'?'Servidor de conexão indisponível. Aguarde e tente novamente.':'Não foi possível consultar o WhatsApp. Tentaremos novamente.')
  return result as State
 }
 useEffect(()=>{
  let active=true,timer:ReturnType<typeof setTimeout>;const controller=new AbortController()
  const poll=async()=>{const current=++sequence.current;try{const next=await request('status',controller.signal);if(active&&current===sequence.current){setState(next);setError('');if(next.status==='open'&&!wasOpen.current)callback.current?.();wasOpen.current=next.status==='open'}}catch(e){if(active){setState({status:'offline'});setError(e instanceof Error?e.message:'Falha na conexão.')}}finally{if(active)timer=setTimeout(poll,5000)}}
  void poll()
  return()=>{active=false;controller.abort();clearTimeout(timer);wasOpen.current=false}
  // Client ID identifies the server-side connection. Edited phone is saved before generation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[clientId])
 useEffect(()=>{if(state.status!=='qr')return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[state.status])
 const seconds=state.expires_at?Math.max(0,Math.ceil((Date.parse(state.expires_at)-now)/1000)):0
 const qr=state.status==='qr'&&seconds>0?state.qr:null
 async function generate(){setBusy(true);setError('');sequence.current++;try{if(!await beforeConnect())return;setState(await request('generate'))}catch(e){setError(e instanceof Error?e.message:'Não foi possível gerar o QR.')}finally{setBusy(false)}}
 return <section aria-label="Conexão por QR Code" className="rounded-xl border border-[var(--border)] p-4 space-y-4">
  <div className="flex items-center gap-2"><QrCode size={20}/><h3 className="font-semibold">Conectar por QR Code</h3></div>
  <p className="text-sm text-[var(--text-secondary)]">WhatsApp: {destination}. No celular, abra <strong>Aparelhos conectados → Conectar aparelho</strong> e leia o QR nesta tela.</p>
  <p role="status" className="flex items-center gap-2 text-sm"><span className={`h-2.5 w-2.5 rounded-full ${state.status==='open'?'bg-[var(--success)]':'bg-[var(--text-tertiary)]'}`}/>{labels[state.status]??'Consultando conexão…'}{state.status==='open'&&<CheckCircle2 size={16} className="text-[var(--success)]"/>}</p>
  {qr&&<div className="space-y-2"><img src={qr} alt="QR Code temporário para conectar o WhatsApp cadastrado" width={300} height={300} className="max-w-full rounded-lg bg-white p-3"/><p className="text-xs text-[var(--text-tertiary)]">Válido por até {seconds}s. O código será atualizado durante a tentativa.</p></div>}
  {state.status!=='open'&&<button type="button" onClick={generate} disabled={busy||state.status==='not_prepared'||state.status==='offline'||state.status==='loading'} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 bg-[var(--accent)] text-white text-sm disabled:opacity-50"><RefreshCw size={15}/>{busy?'Preparando…':qr?'Atualizar conexão':'Gerar QR Code'}</button>}
  {state.status==='open'&&<p className="text-xs text-[var(--text-tertiary)]">Aparelho confirmado. Envie uma mensagem de teste de outro WhatsApp para validar a chegada do lead.</p>}
  {error&&<p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
 </section>
}
