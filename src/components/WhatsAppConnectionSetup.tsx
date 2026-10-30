import { useEffect, useState } from 'react'
import { QrCode, Workflow, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { systemNames, type TrackingSetup } from '../lib/whatsappSetup'
import { KommoActivation } from './KommoActivation'
import { QRActivation } from './QRActivation'
const input='w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] px-3 py-2 text-sm mt-1'
const methods=[
  {id:'qr' as const,title:'QR Code',icon:QrCode,text:'WhatsApp por aparelho vinculado, como no piloto ORBE. Conexão não oficial.'},
  {id:'kommo' as const,title:'Kommo',icon:Workflow,text:'Para clientes que já atendem pelo WhatsApp oficial dentro da Kommo.'},
  {id:'official' as const,title:'Outra API oficial',icon:ShieldCheck,text:'Para WhatsApp oficial conectado diretamente ou por outro fornecedor.'},
]

export function WhatsAppConnectionSetup({clientId,onConnected}:{clientId:string;onConnected?:()=>void}) {
  const {profile}=useAuth()
  const [setup,setSetup]=useState<TrackingSetup|null>(null)
  const [exists,setExists]=useState(false)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  useEffect(()=>{
    let active=true
    supabase.from('wa_tracking_setups').select('*').eq('client_id',clientId).maybeSingle().then(({data,error})=>{
      if(!active)return
      if(error){setError('Não foi possível carregar a configuração.');setLoading(false);return}
      setExists(!!data)
      setSetup(data??{client_id:clientId,owner_user_id:profile?.id??'',connection_method:'undecided',system:'none',destination:'',account_url:'',notes:'',activation_requested:false,traffic_active:true})
      setLoading(false)
    })
    return()=>{active=false}
  },[clientId,profile?.id])
  async function save(event?:React.FormEvent):Promise<boolean> {
    event?.preventDefault()
    if(!setup||!profile)return false
    setSaving(true);setError('');setNotice('')
    try {
      if(setup.connection_method==='undecided')throw new Error('Escolha como conectar o WhatsApp.')
      const destination=setup.destination.replace(/\D/g,'')
      if(destination&&!/^[1-9][0-9]{9,14}$/.test(destination))throw new Error('Informe o telefone com código do país e DDD.')
      if(setup.account_url){const url=new URL(setup.account_url);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('Use apenas o endereço HTTPS da conta, sem senhas, chaves ou parâmetros.')}
      const values={connection_method:setup.connection_method,system:setup.system,destination,account_url:setup.account_url,notes:setup.notes,activation_requested:true,updated_at:new Date().toISOString()}
      const result=exists?await supabase.from('wa_tracking_setups').update(values).eq('client_id',clientId):await supabase.from('wa_tracking_setups').insert({...values,client_id:clientId,owner_user_id:profile.id})
      if(result.error)throw new Error('Não foi possível salvar. Verifique seu acesso a este cliente.')
      setExists(true);setSetup({...setup,...values});setNotice(setup.connection_method==='kommo'?'Dados salvos. Continue em “Ativar conexão com a Kommo” abaixo.':setup.connection_method==='qr'?'Dados salvos. Gere o QR no painel abaixo.':'Configuração salva. A conexão ainda precisa ser ativada e validada.')
      return true
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar.');return false}finally{setSaving(false)}
  }
  if(loading)return <p className="text-sm text-[var(--text-tertiary)]">Carregando configuração…</p>
  if(!setup)return <p role="alert">{error}</p>
  if(setup.connection_method==='qr')return <section className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 md:p-6"><div><h2 className="font-semibold text-lg">Conectar WhatsApp</h2><p className="text-sm text-[var(--text-tertiary)] mt-1">Conexão por aparelho vinculado (não oficial). O número aparece após a leitura do QR.</p></div><div className="flex flex-wrap gap-3">{methods.map(({id,title})=><button key={id} type="button" aria-pressed={setup.connection_method===id} onClick={()=>setSetup({...setup,connection_method:id})} className={`rounded-lg px-3 py-2 text-sm border ${setup.connection_method===id?'border-[var(--accent)] text-[var(--accent)]':'border-[var(--border)]'}`}>{title}</button>)}</div><QRActivation key={clientId} clientId={clientId} beforeConnect={async()=>true} onConnected={onConnected}/></section>
  return <form onSubmit={save} className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 md:p-6">
    <div><h2 className="font-semibold text-lg">Conectar WhatsApp</h2><p className="text-sm text-[var(--text-tertiary)] mt-1">Escolha o caminho de conexão e o sistema usado pelo cliente.</p></div>
    {!setup.traffic_active&&<p className="text-sm text-[var(--text-tertiary)]">Tráfego ainda não iniciado. Esta configuração não ativa a coleta.</p>}
    <div className="grid md:grid-cols-3 gap-3" role="group" aria-label="Forma de conexão">{methods.map(({id,title,icon:Icon,text})=><button type="button" key={id} aria-pressed={setup.connection_method===id} onClick={()=>{setSetup({...setup,connection_method:id});setNotice('')}} className={`text-left rounded-xl p-4 border ${setup.connection_method===id?'border-[var(--accent)] bg-[var(--accent-tint)]':'border-[var(--border)]'}`}><Icon size={22} className="text-[var(--accent)]"/><h3 className="font-semibold mt-3">{title}</h3><p className="text-xs text-[var(--text-tertiary)] mt-2">{text}</p></button>)}</div>
    <div className="grid md:grid-cols-2 gap-4">
      <label className="text-xs">CRM ou sistema de acompanhamento<select className={input} value={setup.system} onChange={e=>setSetup({...setup,system:e.target.value as TrackingSetup['system']})}>{Object.entries(systemNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
      <label className="text-xs">Número do WhatsApp, com país e DDD<input type="tel" placeholder="55 11 99999-9999" maxLength={24} className={input} value={setup.destination} onChange={e=>setSetup({...setup,destination:e.target.value})}/></label>
      {setup.connection_method==='kommo'&&<label className="text-xs md:col-span-2">Endereço da conta Kommo<input type="url" placeholder="https://empresa.kommo.com" maxLength={500} className={input} value={setup.account_url} onChange={e=>setSetup({...setup,account_url:e.target.value})}/></label>}
      <label className="text-xs md:col-span-2">Observações<textarea rows={2} maxLength={1000} className={input} value={setup.notes} onChange={e=>setSetup({...setup,notes:e.target.value})}/></label>
    </div>
    <p className="text-xs text-[var(--text-tertiary)]">Salvar registra os dados do cliente. {setup.connection_method==='kommo'?'Para ativar, conclua a autorização no painel abaixo.':'A conexão por outra API ainda precisa de preparação.'} Não coloque senhas ou chaves nas observações.</p>
    <div className="flex items-center flex-wrap gap-4"><button disabled={saving} className="rounded-lg px-4 py-2 bg-[var(--accent)] text-white text-sm disabled:opacity-50">{saving?'Salvando…':'Salvar configuração'}</button><span className="text-xs text-[var(--text-tertiary)]">{setup.activation_requested?'Aguardando ativação':'Ainda não conectado'}</span></div>
    {error&&<p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}{notice&&<p role="status" className="text-sm text-[var(--accent)]">{notice}</p>}
    {setup.connection_method==='kommo'&&setup.traffic_active&&<KommoActivation clientId={clientId} accountUrl={setup.account_url} destination={setup.destination} beforeConnect={()=>save()} onConnected={onConnected}/>}
  </form>
}
