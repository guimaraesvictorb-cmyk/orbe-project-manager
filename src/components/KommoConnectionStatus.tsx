import {useCallback,useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {KommoActivation} from './KommoActivation'
type State={account_url:string;destination:string;activation_status:string;activation_error:string;last_verified_at:string|null;last_webhook_at:string|null}
export function KommoConnectionStatus({clientId}:{clientId:string}) {
  const [state,setState]=useState<State|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reconnect,setReconnect]=useState(false)
  const load=useCallback(async()=>{const {data,error}=await supabase.from('wa_tracking_setups').select('account_url,destination,activation_status,activation_error,last_verified_at,last_webhook_at').eq('client_id',clientId).maybeSingle();if(!error)setState(data)},[clientId])
  useEffect(()=>{let active=true;const update=()=>{if(active)void load()};update();const timer=setInterval(update,30000);return()=>{active=false;clearInterval(timer)}},[load])
  async function verify(){setBusy(true);setError('');try{const {data}=await supabase.auth.getSession();if(!data.session)throw new Error('Entre novamente no Orbe OS.');const r=await fetch('/api/kommo-status',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({client_id:clientId})});const result=await r.json();if(!r.ok)throw new Error(result.error);await load()}catch(e){setError(e instanceof Error?e.message:'Não foi possível verificar.')}finally{setBusy(false)}}
  return <div className="space-y-4 border-t border-[var(--border)] pt-4">
    <p className="font-medium">{state?.activation_status==='receiving'?'Recebimento de mensagens validado':state?.activation_status==='error'?'A conexão precisa de atenção':'Kommo autorizada · aguardando a primeira mensagem'}</p>
    <p className="text-xs text-[var(--text-tertiary)]">Este acompanhamento reúne as mensagens recebidas pelos canais WhatsApp da conta Kommo. O telefone exibido vem do cadastro do contato; quando houver mais de um, ele permanece sem confirmação.</p>
    {state?.activation_error&&<p className="text-sm text-[var(--danger)]">{state.activation_error}</p>}
    <div className="flex gap-4 text-sm"><button type="button" disabled={busy} onClick={()=>void verify()} className="text-[var(--accent)] disabled:opacity-50">{busy?'Verificando…':'Verificar conexão'}</button><button type="button" className="text-[var(--text-tertiary)]" onClick={()=>setReconnect(!reconnect)}>{reconnect?'Fechar autorização':'Renovar autorização'}</button></div>
    {error&&<p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
    {reconnect&&state&&<KommoActivation clientId={clientId} accountUrl={state.account_url} destination={state.destination} onConnected={()=>{setReconnect(false);void load()}}/>}
  </div>
}
