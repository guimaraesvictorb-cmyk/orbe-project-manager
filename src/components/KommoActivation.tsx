import { useState } from 'react'
import { ExternalLink, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

const errors:Record<string,string>={
  kommo_token_invalid:'A chave da Kommo não foi aceita ou expirou. Gere uma nova chave na integração ORBE.',
  kommo_permission_denied:'A integração precisa da autorização de um administrador da conta Kommo.',
  invalid_account:'Use o endereço da conta, como https://empresa.kommo.com, sem outros caminhos.',
  invalid_credentials_or_phone:'Confira a chave e informe o WhatsApp com 55, DDD e número.',
  encryption_not_configured:'A ativação ainda não está disponível no servidor. Seus dados não foram enviados à Kommo.',
  account_already_bound:'Este cliente já está vinculado a outra conta Kommo. Revise a conexão existente.',
  forbidden:'Você precisa ser responsável pela configuração deste cliente para ativar a conexão.',
}
export function KommoActivation({clientId,accountUrl,destination,beforeConnect,onConnected}:{clientId:string;accountUrl:string;destination:string;beforeConnect?:()=>Promise<boolean>;onConnected?:()=>void}) {
  const [token,setToken]=useState(''),[authorized,setAuthorized]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  let settings=''
  try {const url=new URL(accountUrl);if(url.protocol==='https:'&&/^[a-z0-9][a-z0-9-]*\.kommo\.com$/.test(url.hostname)&&!url.username&&!url.password&&!url.port)settings=url.origin+'/settings/widgets/'}catch{/* invalid account is explained by the form */}
  async function connect() {
    setError('');setNotice('')
    const number=destination.replace(/\D/g,'')
    if(!/^55[1-9][0-9]{9,10}$/.test(number)){setError('Informe o número do WhatsApp acima, incluindo 55 e DDD.');return}
    if(!token.trim()||!authorized){setError('Cole a chave da integração e confirme a autorização abaixo.');return}
    setBusy(true)
    try {
      if(beforeConnect&&!await beforeConnect())return
      const {data}=await supabase.auth.getSession()
      if(!data.session)throw new Error('Sua sessão expirou. Entre novamente no Orbe OS.')
      const response=await fetch('/api/kommo-connect',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({client_id:clientId,account_url:accountUrl,destination:number,access_token:token.trim(),authorize:true})})
      const result=await response.json()
      if(!response.ok)throw new Error(errors[result.error]??'Não foi possível concluir a conexão. Confira a chave, a conta e as permissões na Kommo.')
      setToken('');setAuthorized(false);setNotice('Kommo autorizada. Aguardando a primeira mensagem recebida para validar o rastreamento.');onConnected?.()
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível conectar.')}finally{setBusy(false)}
  }
  return <section className="rounded-xl border border-[var(--accent)] bg-[var(--accent-tint)] p-5 space-y-4">
    <div className="flex gap-2 items-center"><ShieldCheck size={20} className="text-[var(--accent)]"/><h3 className="font-semibold">Ativar conexão com a Kommo</h3></div>
    <p className="text-sm">A configuração já define o cliente. Para começar a receber as novas mensagens no Orbe OS, autorize a integração na conta Kommo.</p>
    <ol className="list-decimal pl-5 text-sm space-y-2"><li>Na Kommo, abra <strong>Configurações → Central de integrações → Criar integração</strong>.</li><li>Crie uma integração privada chamada <strong>ORBE OS · Rastreamento</strong>, com acesso aos dados do CRM. Deixe o endereço de redirecionamento vazio.</li><li>Em <strong>Chaves e escopos</strong>, gere uma chave de longa duração e cole no campo protegido abaixo.</li></ol>
    {settings&&<a href={settings} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent)]">Abrir integrações da Kommo<ExternalLink size={14}/></a>}
    <label className="block text-xs">Chave da integração Kommo<input type="password" autoComplete="off" maxLength={8192} value={token} onChange={e=>setToken(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 mt-1 text-sm" placeholder="Cole aqui a chave gerada na Kommo"/></label>
    <p className="text-xs text-[var(--text-tertiary)]">A chave fica criptografada no servidor e não aparece nos relatórios. Não cole a chave nas observações ou em mensagens de chat.</p>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={authorized} onChange={e=>setAuthorized(e.target.checked)} className="mt-1"/><span>Autorizo o Orbe OS a receber novas mensagens de WhatsApp desta conta Kommo e consultar os contatos para acompanhar leads e origens.</span></label>
    <p className="text-xs text-[var(--text-tertiary)]">O acompanhamento reúne os canais WhatsApp desta conta. O número acima é o destino dos links. O atendimento continua na Kommo; esta integração não envia mensagens nem importa o histórico.</p>
    <button type="button" disabled={busy||!authorized||!token.trim()} onClick={()=>void connect()} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--accent)] disabled:opacity-40">{busy?'Conectando à Kommo…':'Autorizar e conectar Kommo'}</button>
    {error&&<p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}{notice&&<p role="status" className="text-sm">{notice}</p>}
  </section>
}
