import {useCallback,useEffect,useState} from 'react'
import {Building2,RefreshCw,ShieldCheck} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useClients} from '../hooks/useClients'

type Config={manager_id:string;credential_client_id:string|null;enabled:boolean;manager_name:string|null;checked_at:string|null;updated_at:string}
type Account={account_id:string;account_name:string;client_id:string|null;present:boolean;is_manager:boolean;currency:string|null;provider_status:string}
type Source={client_id:string;account_id:string;has_refresh_token:boolean}
type Registry={configuration:Config|null;accounts:Account[];sources:Source[];inventory_status?:string}
const field='mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] px-3 py-2 text-sm'
const button='rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--accent)] disabled:opacity-50'
const errors:Record<string,string>={owner_required:'Esta integração é gerenciada por administradores com acesso financeiro.',configuration_changed:'A configuração mudou. Recarregue antes de continuar.',google_oauth_invalid:'A autorização Google precisa ser renovada.',google_cloud_access_required:'O projeto do Google Cloud ainda não tem acesso aprovado a contas reais. A autorização Google está guardada.',google_cloud_api_disabled:'Ative a Google Ads API no projeto que contém o aplicativo OAuth.',google_permission_denied:'A conta Google autorizada não tem acesso a esta MCC.',google_not_manager:'O ID informado não corresponde a uma conta administradora Google Ads.',google_incomplete_inventory:'O Google retornou uma lista incompleta. A lista anterior foi preservada.',invalid_configuration:'Confira o ID de dez dígitos da MCC e o cadastro selecionado.',credentials_missing:'Selecione um cadastro Google já protegido no Studio.',invalid_credentials:'Confira o cadastro Google protegido.',invalid_mapping:'Confira a conta e o cliente selecionados.'}
async function call(action:string,input:Record<string,unknown>={},signal?:AbortSignal):Promise<Registry>{
 const {data}=await supabase.auth.getSession();if(!data.session)throw Error('Sua sessão expirou. Entre novamente.')
 const response=await fetch('/api/ads-credentials',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({action,...input}),signal})
 const result=await response.json();if(!response.ok)throw Error(errors[result.error]??'Não foi possível consultar a MCC agora. Tente novamente.')
 return result
}
export function GoogleMccSettings(){
 const {clients}=useClients(),[registry,setRegistry]=useState<Registry|null>(null),[manager,setManager]=useState(''),[source,setSource]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const apply=useCallback((value:Registry)=>{setRegistry(value);setManager(value.configuration?.manager_id??'');setSource(value.configuration?.credential_client_id??value.sources[0]?.client_id??'')},[])
 useEffect(()=>{const controller=new AbortController();void call('mcc_status',{},controller.signal).then(apply).catch(cause=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Não foi possível consultar.')});return()=>controller.abort()},[apply])
 const cfg=registry?.configuration,selected=registry?.sources.find(item=>item.client_id===(cfg?.credential_client_id??source))
 async function run(action:string,input:Record<string,unknown>={},message='Configuração atualizada.'){
  setBusy(true);setError('');setNotice('')
  try{const value=await call(action,{...input,expected_version:cfg?.updated_at??null});apply(value);setNotice(value.inventory_status==='oauth_pending'?'Falta concluir a autorização na conta Google.':message);window.dispatchEvent(new Event('orbe-ads-updated'))}
  catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível concluir.')}
  finally{setBusy(false)}
 }
 async function authorize(){
  if(!cfg?.credential_client_id)return;setBusy(true);setError('')
  try{const {data}=await supabase.auth.getSession();if(!data.session)throw Error('Entre novamente para autorizar.')
   const response=await fetch('/api/google-ads-oauth',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({action:'start',client_id:cfg.credential_client_id})}),result=await response.json()
   if(!response.ok)throw Error(errors[result.error]??'Não foi possível iniciar a autorização Google.')
   const destination=new URL(result.authorization_url);if(destination.origin!=='https://accounts.google.com')throw Error('Destino de autorização inválido.')
   window.location.assign(destination.href)
  }catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível autorizar.');setBusy(false)}
 }
 return <section className="min-w-0 space-y-6" aria-label="Integração Google Ads da Orbe">
  <header><div className="mb-2 flex items-center gap-2 text-[var(--accent)]"><Building2 size={22}/><h2 className="text-lg font-semibold">Google Ads · MCC da Orbe</h2></div><p className="text-sm text-[var(--text-secondary)]">Uma autorização da agência, com cada conta de anúncios vinculada ao cliente correspondente.</p></header>
  {error&&<p role="alert" className="rounded-lg border border-[var(--border)] p-3 text-sm text-[var(--danger)]">{error} <button type="button" disabled={busy} className="underline" onClick={()=>void run('mcc_status',{},'Cadastro recarregado.')}>Recarregar</button></p>}
  {notice&&<p role="status" className="rounded-lg bg-[var(--accent-tint)] p-3 text-sm">{notice}</p>}
  {!registry&&!error?<p role="status">Consultando integração…</p>:registry&&<>
   <form onSubmit={event=>{event.preventDefault();void run('mcc_configure',{manager_id:manager,credential_client_id:source},'MCC cadastrada. Autorize o Google e consulte as contas para concluir.')}} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
    <fieldset disabled={busy} className="space-y-4"><label className="block text-sm">ID da conta administradora<input aria-label="ID da MCC da Orbe" value={manager} onChange={event=>setManager(event.target.value)} placeholder="000-000-0000" pattern="[0-9-]{10,12}" required maxLength={12} className={field}/></label>
     <label className="block text-sm">Cadastro Google protegido no Studio<select aria-label="Cadastro Google da MCC" value={source} onChange={event=>setSource(event.target.value)} required className={field}><option value="">Selecione o cadastro existente</option>{registry.sources.map(item=><option key={item.client_id} value={item.client_id}>{clients.find(client=>client.id===item.client_id)?.name??'Cliente cadastrado'} · {item.account_id}</option>)}</select></label>
     <p className="text-xs text-[var(--text-tertiary)]">O Studio reutiliza a autorização protegida desse cadastro. Você não precisa copiar chaves para cada cliente.</p>
     {!registry.sources.length&&<p className="text-sm">Cadastre primeiro o aplicativo Google em Clientes → cliente → Conexões → Credenciais de anúncios.</p>}
     <button type="submit" disabled={!source} className={button}>{busy?'Aguarde…':cfg?'Salvar MCC':'Cadastrar MCC'}</button>
    </fieldset>
   </form>
   {cfg&&<div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{cfg.manager_name??`MCC ${cfg.manager_id}`}</h3><p className="mt-1 text-sm text-[var(--text-secondary)]">{!cfg.enabled?'Conexão desativada':!selected?.has_refresh_token?'Autorização Google pendente':!cfg.checked_at?'Autorização guardada · consulta da MCC pendente':'Lista de contas consultada no Google'}</p>{cfg.checked_at&&<p className="mt-1 text-xs text-[var(--text-tertiary)]">Última consulta: {new Date(cfg.checked_at).toLocaleString('pt-BR')}</p>}</div><ShieldCheck size={22} className="text-[var(--accent)]"/></div>
    <p className="text-xs text-[var(--text-tertiary)]">O Google exige um escopo que inclui gerenciar anúncios. O Studio usa somente consultas e mantém os dados separados por cliente.</p>
    <div className="flex flex-wrap gap-2"><button type="button" disabled={busy||!cfg.enabled} onClick={()=>void authorize()} className={button}>{selected?.has_refresh_token?'Renovar autorização Google':'Autorizar Google pela MCC'}</button><button type="button" disabled={busy||!cfg.enabled} onClick={()=>void run('mcc_inventory',{},'Contas consultadas. Confira os vínculos abaixo.')} className={`${button} flex items-center gap-2`}><RefreshCw size={15} className={busy?'animate-spin':''}/>Consultar contas da MCC</button></div>
    <p className="text-xs text-[var(--text-tertiary)]">O acesso a contas reais depende da liberação do projeto no Google Cloud. O Studio valida essa liberação ao consultar a MCC.</p>
    {cfg.enabled&&<button type="button" disabled={busy} onClick={()=>void run('mcc_disable',{},'Conexão da MCC desativada. Salve o cadastro para reativar.')} className="text-xs text-[var(--text-tertiary)] underline">Desativar conexão da MCC</button>}
   </div>}
   {cfg&&<div className="space-y-3"><h3 className="font-semibold">Contas e clientes</h3><p className="text-xs text-[var(--text-secondary)]">Contas com o mesmo ID já cadastrado são vinculadas automaticamente. Os demais vínculos são escolhidos aqui.</p>{!registry.accounts.length?<p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-sm text-[var(--text-tertiary)]">Nenhuma lista foi sincronizada ainda. Autorize o Google e clique em Consultar contas da MCC.</p>:<div className="overflow-x-auto rounded-xl border border-[var(--border)]"><table className="w-full text-left text-sm"><thead className="bg-[var(--bg-surface-2)] text-xs text-[var(--text-tertiary)]"><tr><th className="p-3">Conta Google Ads</th><th className="p-3">Estado</th><th className="p-3">Cliente no Studio</th></tr></thead><tbody>{registry.accounts.filter(account=>!account.is_manager).map(account=><tr key={account.account_id} className="border-t border-[var(--border)]"><td className="p-3"><p>{account.account_name}</p><p className="mt-1 font-mono text-xs text-[var(--text-tertiary)]">{account.account_id} · {account.currency??'Moeda não informada'}</p></td><td className="p-3 text-xs text-[var(--text-secondary)]">{!account.present?'Fora da lista atual':account.provider_status==='ENABLED'?'Disponível':account.provider_status==='CANCELED'?'Encerrada':account.provider_status}</td><td className="min-w-48 p-3"><select aria-label={`Cliente da conta ${account.account_name}`} disabled={busy||!cfg.enabled||!account.present} value={account.client_id??''} onChange={event=>void run('mcc_map',{account_id:account.account_id,target_client_id:event.target.value||null},'Vínculo atualizado. Os relatórios consultam somente a conta deste cliente.')} className={field}><option value="">Sem vínculo</option>{clients.filter(client=>!registry.accounts.some(other=>other.client_id===client.id&&other.account_id!==account.account_id)).map(client=><option key={client.id} value={client.id}>{client.name}</option>)}</select></td></tr>)}</tbody></table></div>}</div>}
  </>}
 </section>
}
