import {useEffect,useState} from 'react'
import {LockKeyhole,ChevronDown,ChevronUp} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useAuth} from '../hooks/useAuth'
type Platform='meta'|'google'
type Verification={status:string;account_id:string;account_name?:string;checked_at?:string}
type Config={platform:Platform;account_id:string;status:string;has_refresh_token:boolean;expires_at:string|null;updated_at:string}
const input='mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] px-3 py-2 text-sm'
function SecretField({label,name,value,onChange,required=false}:{label:string;name:string;value:string;onChange:(v:string)=>void;required?:boolean}){
 const [focused,setFocused]=useState(false)
 return <label className="block text-sm">{label}<input aria-label={label} name={name} type="password" autoComplete="new-password" data-lpignore="true" data-1p-ignore="true" spellCheck={false} readOnly={!focused} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} value={value} onChange={e=>onChange(e.target.value)} required={required} minLength={required?10:undefined} maxLength={4096} className={input}/></label>
}
const blank={account_id:'',access_token:'',oauth_client_id:'',oauth_client_secret:'',refresh_token:'',developer_token:'',manager_id:'',expires_at:''}
const errors:Record<string,string>={meta_token_invalid:'A Meta recusou o token: ele expirou ou foi revogado.',meta_permission_denied:'O token não tem permissão para ler anúncios desta conta.',meta_account_mismatch:'A conta retornada não corresponde ao cadastro.',meta_unavailable:'A Meta não confirmou o acesso. Tente novamente em alguns minutos.',credentials_missing:'Cadastre a credencial desta plataforma primeiro.',admin_required:'Somente administradores podem cadastrar as credenciais.',forbidden:'Seu usuário não tem acesso a este cliente.',unauthorized:'Sua sessão expirou. Entre novamente.',invalid_account:'Confira o ID da conta. No Google Ads ele tem 10 dígitos.',invalid_credentials:'Confira os campos secretos. Cole somente a credencial, sem espaços extras.',invalid_oauth_client:'Use o ID do cliente OAuth do Google, terminado em apps.googleusercontent.com.',invalid_manager:'O ID da conta administradora deve ter 10 dígitos.',invalid_expiry:'Informe uma data de validade futura ou deixe em branco.',configuration_changed:'Outra pessoa atualizou esta configuração. Feche e abra o cadastro para conferir antes de substituir.'}
export function AdsCredentials({clientId}:{clientId:string}){
 const {profile}=useAuth(),[open,setOpen]=useState(false),[platform,setPlatform]=useState<Platform>('meta'),[form,setForm]=useState(blank),[configs,setConfigs]=useState<Config[]>([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[filename,setFilename]=useState(''),[oauthIdEditing,setOauthIdEditing]=useState(false),[verification,setVerification]=useState<Verification|null>(null)
 async function request(action:'status'|'save'|'verify',signal?:AbortSignal){
  const {data}=await supabase.auth.getSession();if(!data.session)throw new Error('Sua sessão expirou. Entre novamente.')
  const r=await fetch('/api/ads-credentials',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({action,client_id:clientId,platform,...(action==='save'?{...form,platform,expected_version:configs.find(c=>c.platform===platform)?.updated_at??null}:{})}),signal})
  const result=await r.json();if(!r.ok)throw new Error(errors[result.error]||'Não foi possível consultar ou salvar. Atualize a página e tente novamente.')
  return result as {configurations:Config[];verification?:Verification}
 }
 useEffect(()=>{if(!open||profile?.role!=='admin')return;let active=true;const controller=new AbortController();void request('status',controller.signal).then(result=>{if(active)setConfigs(result.configurations)}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Não foi possível consultar.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false;controller.abort()}
 // Opening the client reloads metadata only. Secret inputs never come from this request.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[clientId,open,profile?.role])
 if(profile?.role!=='admin')return null
 function clear(){setVerification(null);setOauthIdEditing(false);setForm(blank);setFilename('');setError('');setNotice('')}
 async function importClient(file:File){setError('');try{
  if(file.size>65536)throw new Error('Use o arquivo JSON do cliente OAuth, de até 64 KB.')
  let json;try{json=JSON.parse(await file.text())}catch{throw new Error('O arquivo não é um JSON válido. Exporte novamente o cliente OAuth do Google.')}
  const client=json?.installed??json?.web
  if(!client?.client_id||!client?.client_secret||json?.type==='service_account')throw new Error('Esse arquivo não é um cliente OAuth. Use o JSON do cliente OAuth do Google, não uma chave de conta de serviço.')
  if(typeof client.client_id!=='string'||typeof client.client_secret!=='string')throw new Error('Arquivo OAuth inválido.')
  setForm(f=>({...f,oauth_client_id:client.client_id,oauth_client_secret:client.client_secret}));setFilename(file.name)
 }catch(e){setError(e instanceof Error?e.message:'Não foi possível ler o JSON.')}
 }
 async function verify(){setBusy(true);setError('');setVerification(null);try{const result=await request('verify');setVerification(result.verification??null)}catch(e){setError(e instanceof Error?e.message:'Não foi possível verificar.')}finally{setBusy(false)}}
 async function save(event:React.FormEvent){event.preventDefault();setBusy(true);setVerification(null);setError('');setNotice('');try{const result=await request('save');setConfigs(result.configurations);setForm(blank);setFilename('');setNotice('Credenciais guardadas com criptografia. A conexão com os anúncios ainda não foi validada.')}catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar.')}finally{setBusy(false)}}
 const set=(key:keyof typeof blank,value:string)=>setForm(f=>({...f,[key]:value}))
 const current=configs.find(c=>c.platform===platform)
 return <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4" aria-label="Credenciais de anúncios">
  <button type="button" aria-expanded={open} onClick={()=>{clear();setLoading(!open);setOpen(!open)}} className="flex w-full items-center gap-2 text-sm font-medium text-[var(--accent)]"><LockKeyhole size={18}/>Credenciais de anúncios<span className="ml-auto">{open?<ChevronUp size={18}/>:<ChevronDown size={18}/>}</span></button>
  {open&&<div className="mt-4 space-y-4"><p className="text-sm text-[var(--text-secondary)]">Cadastro protegido deste cliente. Os segredos ficam criptografados no servidor e não são exibidos novamente. Somente administradores podem gerenciar este cadastro.</p>
   <div className="flex gap-3">{(['meta','google'] as const).map(p=><button key={p} type="button" aria-pressed={platform===p} disabled={busy} onClick={()=>{clear();setPlatform(p)}} className={`rounded-lg px-4 py-2 text-sm ${platform===p?'bg-[var(--accent-tint)] text-[var(--accent)]':'border border-[var(--border)]'}`}>{p==='meta'?'Meta Ads':'Google Ads'}</button>)}</div>
   {loading?<p role="status" className="text-sm">Consultando cadastro…</p>:<>
    {current&&<div className="rounded-lg border border-[var(--border)] p-3 text-sm"><p className="font-medium">Conta {current.account_id} · {current.status==='oauth_pending'?'OAuth pendente':'Credenciais guardadas · validação pendente'}</p><p className="mt-1 text-xs text-[var(--text-tertiary)]">Atualizado em {new Date(current.updated_at).toLocaleString('pt-BR')}. {current.expires_at?`Validade informada: ${new Date(current.expires_at).toLocaleDateString('pt-BR',{timeZone:'UTC'})}.`:''} Para substituir o segredo, preencha novamente os campos abaixo.</p></div>}
    {current&&<button type="button" disabled={busy} onClick={()=>void verify()} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--accent)] disabled:opacity-50">{busy?'Aguarde…':'Verificar acesso aos anúncios'}</button>}
    {verification&&<p role="status" className={`rounded-lg border border-[var(--border)] p-3 text-sm ${verification.status==='access_verified'?'text-[var(--success)]':'text-[var(--text-secondary)]'}`}>{verification.status==='access_verified'?`Acesso de leitura validado agora: ${verification.account_name||verification.account_id}. A importação de métricas ainda será configurada.`:verification.status==='oauth_pending'?'Google: credenciais salvas. Falta autorizar o acesso à conta; ainda não há token de renovação.':'Google: credenciais salvas. A validação da API ainda está pendente.'}</p>}
    <form onSubmit={save} autoComplete="off" className="max-w-2xl space-y-4"><fieldset disabled={busy} className="space-y-4">
     <label className="block text-sm">{platform==='meta'?'ID da conta de anúncios Meta':'ID da conta Google Ads'}<input aria-label="ID da conta de anúncios" autoComplete="off" value={form.account_id} onChange={e=>set('account_id',e.target.value)} placeholder={current?.account_id||(platform==='meta'?'Ex.: 2988254138081501':'Ex.: 352-808-1021')} required maxLength={30} className={input}/></label>
     {platform==='meta'?<><SecretField label="Token da Meta" name="orbe_meta_api_credential" value={form.access_token} onChange={v=>set('access_token',v)} required/><p className="text-xs text-[var(--text-tertiary)]">Use a credencial já autorizada para leitura de anúncios desta conta, com ads_read.</p><label className="block text-sm">Data de validade informada · opcional<input aria-label="Data de validade da Meta" type="date" value={form.expires_at} onChange={e=>set('expires_at',e.target.value)} className={input}/></label></>:<>
      <label className="block text-sm">Importar JSON do cliente OAuth · opcional<input aria-label="Importar cliente OAuth Google" type="file" accept="application/json,.json" disabled={busy} className="mt-2 block text-sm" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void importClient(file)}}/></label>{filename&&<p role="status" className="text-xs text-[var(--text-tertiary)]">Arquivo carregado: {filename}</p>}
      <label className="block text-sm">ID do cliente OAuth<input aria-label="ID do cliente OAuth" name="orbe_google_oauth_identifier" autoComplete="off" data-lpignore="true" data-1p-ignore="true" readOnly={!oauthIdEditing} onFocus={()=>setOauthIdEditing(true)} onBlur={()=>setOauthIdEditing(false)} value={form.oauth_client_id} onChange={e=>set('oauth_client_id',e.target.value)} required maxLength={256} className={input}/></label>
      <SecretField label="Segredo do cliente OAuth" name="orbe_google_oauth_credential" value={form.oauth_client_secret} onChange={v=>set('oauth_client_secret',v)} required/>
      <SecretField label="Token de renovação Google · se já tiver" name="orbe_google_refresh_credential" value={form.refresh_token} onChange={v=>set('refresh_token',v)}/>
      <p className="rounded-lg bg-[var(--accent-tint)] p-3 text-xs">O JSON identifica o aplicativo. Ele sozinho não autoriza consultar o Google Ads. Você pode guardá-lo agora; a autorização da conta e a validação da API continuam pendentes.</p>
      <details><summary className="cursor-pointer text-sm text-[var(--accent)]">Campos adicionais · se já fornecidos</summary><div className="mt-3 space-y-3"><label className="block text-sm">ID da conta administradora (MCC)<input aria-label="ID da MCC" value={form.manager_id} onChange={e=>set('manager_id',e.target.value)} maxLength={15} className={input}/></label><SecretField label="Developer token Google" name="orbe_google_developer_credential" value={form.developer_token} onChange={v=>set('developer_token',v)}/></div></details>
     </>}
     <button type="submit" disabled={busy} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm text-white disabled:opacity-50">{busy?'Guardando…':current?'Substituir credenciais protegidas':'Guardar credenciais protegidas'}</button>
    </fieldset></form>
   </>}
   {error&&<p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}{notice&&<p role="status" className="text-sm text-[var(--success)]">{notice}</p>}
  </div>}
 </section>
}
