import {useEffect,useRef,useState} from 'react'
import {CheckCircle2,QrCode,RefreshCw,ExternalLink} from 'lucide-react'
import {supabase} from '../lib/supabase'
type State={status:string;qr?:string|null;expires_at?:string;destination?:string;connection_id?:string;last_received_at?:string;test_received_at?:string;capture_mode?:string;allowed_senders?:string[]}
const labels:Record<string,string>={session_expired:'Sua sessão expirou. Entre novamente no Studio.',access_denied:'Seu perfil não tem acesso a este cliente.',idle:'Pronto para gerar o QR',requested:'Preparando QR…',connecting:'Conectando ao WhatsApp…',qr:'Leia o QR com o WhatsApp do cliente',open:'Conexão ativa',close:'WhatsApp desconectado',expired:'QR expirado. Gere um novo.',offline:'Servidor de conexão indisponível. Tentando novamente…',not_prepared:'Conexão em preparação',wrong_number:'O aparelho lido usa outro número. Conecte o número cadastrado.',error:'Não foi possível conectar. Tente novamente.'}
export function QRActivation({clientId,beforeConnect,onConnected}:{clientId:string;destination?:string;beforeConnect:()=>Promise<boolean>;onConnected?:()=>void}){
 const [state,setState]=useState<State>({status:'loading'}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[now,setNow]=useState(()=>Date.now())
 const preparedId=useRef('')
 const sequence=useRef(0),callback=useRef(onConnected),wasOpen=useRef(false)
 useEffect(()=>{callback.current=onConnected},[onConnected])
 async function request(action:'generate'|'status',signal?:AbortSignal){
  const {data}=await supabase.auth.getSession()
  if(!data.session)throw new Error('Sua sessão expirou. Entre novamente no Studio.')
  const response=await fetch('/api/whatsapp-qr',{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action,client_id:clientId}),signal})
  const result=await response.json()
  if(!response.ok)throw new Error(result.error==='forbidden'?'Seu perfil não tem acesso a este cliente.':result.error==='unauthorized'?'Sua sessão expirou. Entre novamente no Studio.':result.error==='setup_changed'?'O telefone mudou. Salve os dados e peça a preparação da nova conexão.':result.error==='worker_offline'?'Servidor de conexão indisponível. Aguarde e tente novamente.':'Não foi possível consultar o WhatsApp. Tentaremos novamente.')
  return result as State
 }
 useEffect(()=>{
  let active=true,timer:ReturnType<typeof setTimeout>;const controller=new AbortController()
  const poll=async()=>{const current=++sequence.current;try{const next=await request('status',controller.signal);if(active&&current===sequence.current){setState(next);setError('');if(next.connection_id&&preparedId.current!==next.connection_id){preparedId.current=next.connection_id;callback.current?.()}else if(next.status==='open'&&!wasOpen.current)callback.current?.();wasOpen.current=next.status==='open'}}catch(e){if(active){setState({status:e instanceof Error&&e.message.includes('perfil')?'access_denied':e instanceof Error&&e.message.includes('sessão')?'session_expired':'offline'});setError(e instanceof Error?e.message:'Falha na conexão.')}}finally{if(active)timer=setTimeout(poll,5000)}}
  void poll()
  return()=>{active=false;controller.abort();clearTimeout(timer);wasOpen.current=false}
  // Client ID identifies the server-side connection. Edited phone is saved before generation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[clientId])
 useEffect(()=>{if(state.status!=='qr')return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[state.status])
 const testUrl=state.connection_id?`https://studio.agenciaorbe.co/api/wa-redirect?connection=${state.connection_id}&utm_source=orbe_teste&utm_medium=whatsapp&utm_campaign=validacao_conexao`:''
 const connectedNumber=state.destination?.replace(/^55(\d{2})(\d{5})(\d{4})$/,'($1) $2-$3')
 const seconds=state.expires_at?Math.max(0,Math.ceil((Date.parse(state.expires_at)-now)/1000)):0
 const qr=state.status==='qr'&&seconds>0?state.qr:null
 async function generate(){setBusy(true);setError('');sequence.current++;try{if(!await beforeConnect())return;setState(await request('generate'))}catch(e){setError(e instanceof Error?e.message:'Não foi possível gerar o QR.')}finally{setBusy(false)}}
 return <section aria-label="Conexão por QR Code" className="rounded-xl border border-[var(--border)] p-4 space-y-4">
  <div className="flex items-center gap-2"><QrCode size={20}/><h3 className="font-semibold">Conectar por QR Code</h3></div>
  <p className="text-sm text-[var(--text-secondary)]">No celular do cliente, abra <strong>Aparelhos conectados → Conectar aparelho</strong> e leia o QR nesta tela. O número será identificado automaticamente.</p>
  {connectedNumber&&<p className="text-sm font-medium">Número identificado: {connectedNumber}</p>}
  <p role="status" className="flex items-center gap-2 text-sm"><span className={`h-2.5 w-2.5 rounded-full ${state.status==='open'?'bg-[var(--success)]':'bg-[var(--text-tertiary)]'}`}/>{labels[state.status]??'Consultando conexão…'}{state.status==='open'&&<CheckCircle2 size={16} className="text-[var(--success)]"/>}</p>
  {qr&&<div className="space-y-2"><img src={qr} alt="QR Code temporário para conectar o WhatsApp cadastrado" width={300} height={300} className="max-w-full rounded-lg bg-white p-3"/><p className="text-xs text-[var(--text-tertiary)]">Válido por até {seconds}s. O código será atualizado durante a tentativa.</p></div>}
  {state.status!=='open'&&<button type="button" onClick={generate} disabled={busy||state.status==='access_denied'||state.status==='session_expired'||state.status==='offline'||state.status==='loading'} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 bg-[var(--accent)] text-white text-sm disabled:opacity-50"><RefreshCw size={15}/>{busy?'Preparando…':qr?'Atualizar conexão':'Gerar QR Code'}</button>}
  {state.status==='open'&&<div className="space-y-3 rounded-lg border border-[var(--border)] p-4"><h4 className="font-medium">Validar rastreamento</h4>{state.test_received_at?<p className="text-sm text-[var(--success)]">Mensagem de teste recebida com origem confirmada. Rastreamento validado.</p>:<><p className="text-sm text-[var(--text-secondary)]">Abra o link abaixo em outro WhatsApp e envie a mensagem sugerida. A confirmação aparecerá aqui automaticamente.</p>{state.capture_mode==='pilot'&&<p className="text-xs text-[var(--text-tertiary)]">Neste teste, use o remetente {state.allowed_senders?.join(', ')}.</p>}<a href={testUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-[var(--accent)]"><ExternalLink size={15}/>Abrir link de teste</a></>}</div>}
  {error&&<p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
 </section>
}
