import { lazy, Suspense, useEffect, useState } from 'react'
import { ArrowLeft, Link2, MessageSquare, Search } from 'lucide-react'
import { useClients } from '../hooks/useClients'
import { supabase } from '../lib/supabase'
import type { TrackingConnection } from '../lib/whatsappTracking'
import { syncIsFresh } from '../lib/whatsappTracking'
import { useAuth } from '../contexts/AuthContext'
import { systemNames, type TrackingSetup } from '../lib/whatsappSetup'
const WhatsAppTrackingView=lazy(()=>import('./WhatsAppTrackingView').then(m=>({default:m.WhatsAppTrackingView})))
const UTMLinkBuilder=lazy(()=>import('./UTMLinkBuilder').then(m=>({default:m.UTMLinkBuilder})))

function ClientLogo({id,name}:{id:string;name:string}) {
  const {profile}=useAuth()
  const [url,setUrl]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  useEffect(()=>{let active=true;supabase.auth.getSession().then(async({data})=>{
    if(!data.session)return
    try{const r=await fetch(`/api/client-logo?client_id=${id}`,{headers:{Authorization:`Bearer ${data.session.access_token}`}});if(r.ok){const logo=await r.json();if(active)setUrl(logo.url)}}catch{/* Initials remain available when no logo is present. */}
  });return()=>{active=false}},[id])
  async function upload(file:File) {
    setError('')
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){setError('Use PNG, JPG ou WebP de até 5 MB.');return}
    setBusy(true)
    try {
      const bitmap=await createImageBitmap(file)
      const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Não foi possível abrir a imagem.')
      const ratio=Math.min(240/bitmap.width,240/bitmap.height)
      ctx.drawImage(bitmap,(256-bitmap.width*ratio)/2,(256-bitmap.height*ratio)/2,bitmap.width*ratio,bitmap.height*ratio);bitmap.close()
      const {data}=await supabase.auth.getSession();if(!data.session)throw new Error('Entre novamente.')
      const r=await fetch(`/api/client-logo?client_id=${id}`,{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({image:canvas.toDataURL('image/png')})})
      const result=await r.json();if(!r.ok)throw new Error(result.error)
      setUrl(result.url)
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar o logo.')}finally{setBusy(false)}
  }
  const rayafit=id==='589481f6-3a15-4c93-b384-5d33373c20e3'
  return <div className="mb-4 flex items-center gap-3">
    <div style={{backgroundColor:url?(rayafit||id==='14d33095-9db2-4f7f-b667-10110c52c919'?'#111827':'#ffffff'):undefined}} className="h-24 w-40 shrink-0 rounded-xl border border-[var(--border)] flex items-center justify-center overflow-hidden">{url?<img src={url} alt={`Logo ${name}`} onError={()=>setUrl('')} className="h-full w-full object-contain p-3"/>:<span aria-hidden="true" className="font-semibold text-[var(--text-tertiary)]">{name.split(' ').slice(0,2).map(n=>n[0]).join('')}</span>}</div>
    {profile?.role==='admin'&&<label className="text-xs text-[var(--accent)] cursor-pointer">{busy?'Salvando…':url?'Trocar logo':'+ Adicionar logo'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} className="sr-only" aria-label={`Logo de ${name}`} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void upload(f)}}/></label>}
    {error&&<p role="alert" className="text-xs text-[var(--danger)]">{error}</p>}
  </div>
}

export function RastreamentoView() {
  const {clients:allClients}=useClients()
  // Excluded from tracking at the owner's request; client records stay intact.
  const hiddenTrackingClients=new Set(['c719c21c-e530-440b-8526-e6dd2688e2e1','5058a2a7-68e3-4d40-a84e-78dcc8b23758','338243c3-8443-4dd4-bce1-b4011feeb52c'])
  const clients=allClients.filter(client=>!hiddenTrackingClients.has(client.id))
  const [mode,setMode]=useState<'clients'|'utm'>('clients')
  const [selected,setSelected]=useState<string|null>(null)
  const [search,setSearch]=useState('')
  const [connections,setConnections]=useState<TrackingConnection[]>([])
  const [setups,setSetups]=useState<TrackingSetup[]>([])
  const [error,setError]=useState('')
  useEffect(()=>{let active=true;const refresh=()=>Promise.all([supabase.from('wa_tracking_connections').select('*'),supabase.from('wa_tracking_setups').select('*')]).then(([channels,plans])=>{if(active){setConnections(channels.data??[]);setSetups(plans.data??[]);setError(channels.error||plans.error?'Não foi possível consultar as conexões. Atualize a página.':'')}});void refresh();const timer=window.setInterval(refresh,30000);return()=>{active=false;window.clearInterval(timer)}},[selected])
  const isConnected=(id:string)=>!error&&connections.some(c=>c.client_id===id&&c.enabled&&c.connection_state==='open'&&(c.provider==='kommo'?['receiving','waiting_message'].includes(setups.find(s=>s.client_id===id)?.activation_status??''):syncIsFresh(c.last_sync_at)))
  const visible=clients.filter(c=>c.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).sort((a,b)=>Number(isConnected(b.id))-Number(isConnected(a.id))||a.name.localeCompare(b.name,'pt-BR'))
  if(selected!==null) return <div className="min-w-0"><div className="m-6 mb-0 space-y-3"><button onClick={()=>setSelected(null)} className="flex items-center gap-2 text-sm text-[var(--accent)]"><ArrowLeft size={16}/>Todos os clientes</button><p className="text-xl font-semibold">{clients.find(c=>c.id===selected)?.name}</p></div><Suspense fallback={<p className="p-6">Carregando…</p>}><WhatsAppTrackingView key={selected} clientId={selected}/></Suspense></div>
  return <div className="p-4 md:p-6 space-y-6 min-w-0">
    <div><p className="text-xs uppercase tracking-widest text-[var(--accent)]">Central de rastreamento</p><h1 className="text-2xl font-bold">Rastreamento</h1><p className="text-sm text-[var(--text-tertiary)] mt-2">Escolha um cliente para acompanhar seus WhatsApps, leads e origens.</p></div>
    <div className="flex gap-3 border-b border-[var(--border)]"><button className={`flex gap-2 py-3 border-b-2 ${mode==='clients'?'border-[var(--accent)] text-[var(--accent)]':'border-transparent'}`} onClick={()=>setMode('clients')}><MessageSquare size={18}/>WhatsApp por cliente</button><button className={`flex gap-2 py-3 border-b-2 ${mode==='utm'?'border-[var(--accent)] text-[var(--accent)]':'border-transparent'}`} onClick={()=>setMode('utm')}><Link2 size={18}/>Gerador de UTMs</button></div>
    {mode==='utm'?<Suspense fallback={<p>Carregando…</p>}><UTMLinkBuilder/></Suspense>:<>
      {error&&<p role="alert" className="text-[var(--danger)]">{error}</p>}
      <div className="relative max-w-md"><Search size={16} className="absolute left-3 top-3 text-[var(--text-tertiary)]"/><input aria-label="Buscar cliente" placeholder="Buscar cliente" value={search} onChange={e=>setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]"/></div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visible.map(client=>{const channel=connections.filter(c=>c.client_id===client.id);const setup=setups.find(s=>s.client_id===client.id);const connected=isConnected(client.id);return <article key={client.id} className="text-left rounded-xl p-5 border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--accent)] transition-colors"><ClientLogo id={client.id} name={client.name}/><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{client.name}</h2>{connected&&<span className="inline-flex items-center gap-2 rounded-full bg-[var(--success-tint)] px-2.5 py-1 text-xs font-medium text-[var(--success)]"><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[var(--success)]"/>Conexão ativa</span>}</div><p className={`text-xs mt-2 ${channel.some(c=>syncIsFresh(c.last_sync_at))?'text-[var(--accent)]':'text-[var(--text-tertiary)]'}`}>{channel.some(c=>c.provider==='evolution')&&!connected?'Aguardando conexão do aparelho':channel.length?`${channel.length} número(s) integrado(s)`:'WhatsApp ainda não conectado'}</p>{setup&&<p className="text-xs text-[var(--text-tertiary)] mt-2">{systemNames[setup.system]}{!setup.traffic_active?' · Sem tráfego ativo':''}{setup.activation_status==='receiving'?' · Recebendo mensagens':setup.activation_status==='waiting_message'?' · Conectada, aguardando mensagem':setup.activation_status==='error'?' · Precisa de atenção':setup.activation_requested?' · Aguardando ativação':''}</p>}<button onClick={()=>setSelected(client.id)} className="text-sm text-[var(--accent)] mt-4">{channel.length?'Ver rastreamento':'Configurar conexão'} →</button></article>})}
      </div>
      {visible.length===0&&<p className="text-sm text-[var(--text-tertiary)]">Nenhum cliente encontrado.</p>}
      <p className="text-xs text-[var(--text-tertiary)]">Cada cliente tem suas próprias conexões e registros. Mensagens sem evidência da origem permanecem como “Origem não identificada”.</p>
    </>}
  </div>
}
