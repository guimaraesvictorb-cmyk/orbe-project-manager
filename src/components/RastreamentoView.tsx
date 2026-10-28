import { lazy, Suspense, useEffect, useState } from 'react'
import { ArrowLeft, Link2, MessageSquare, Search } from 'lucide-react'
import { useClients } from '../hooks/useClients'
import { supabase } from '../lib/supabase'
import type { TrackingConnection } from '../lib/whatsappTracking'
import { syncIsFresh } from '../lib/whatsappTracking'
import { systemNames, type TrackingSetup } from '../lib/whatsappSetup'
const WhatsAppTrackingView=lazy(()=>import('./WhatsAppTrackingView').then(m=>({default:m.WhatsAppTrackingView})))
const UTMLinkBuilder=lazy(()=>import('./UTMLinkBuilder').then(m=>({default:m.UTMLinkBuilder})))

export function RastreamentoView() {
  const {clients}=useClients()
  const [mode,setMode]=useState<'clients'|'utm'>('clients')
  const [selected,setSelected]=useState<string|null>(null)
  const [search,setSearch]=useState('')
  const [connections,setConnections]=useState<TrackingConnection[]>([])
  const [setups,setSetups]=useState<TrackingSetup[]>([])
  const [error,setError]=useState('')
  useEffect(()=>{let active=true;Promise.all([supabase.from('wa_tracking_connections').select('*'),supabase.from('wa_tracking_setups').select('*')]).then(([channels,plans])=>{if(active){setConnections(channels.data??[]);setSetups(plans.data??[]);if(channels.error||plans.error)setError('Não foi possível consultar as conexões. Atualize a página.')}});return()=>{active=false}},[selected])
  const visible=clients.filter(c=>c.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
  if(selected!==null) return <div className="min-w-0"><div className="m-6 mb-0 space-y-3"><button onClick={()=>setSelected(null)} className="flex items-center gap-2 text-sm text-[var(--accent)]"><ArrowLeft size={16}/>Todos os clientes</button><p className="text-xl font-semibold">{selected==='pilot'?'ORBE · piloto interno':clients.find(c=>c.id===selected)?.name}</p></div><Suspense fallback={<p className="p-6">Carregando…</p>}><WhatsAppTrackingView key={selected} clientId={selected==='pilot'?undefined:selected} pilotOnly={selected==='pilot'}/></Suspense></div>
  return <div className="p-4 md:p-6 space-y-6 min-w-0">
    <div><p className="text-xs uppercase tracking-widest text-[var(--accent)]">Central de rastreamento</p><h1 className="text-2xl font-bold">Rastreamento</h1><p className="text-sm text-[var(--text-tertiary)] mt-2">Escolha um cliente para acompanhar seus WhatsApps, leads e origens.</p></div>
    <div className="flex gap-3 border-b border-[var(--border)]"><button className={`flex gap-2 py-3 border-b-2 ${mode==='clients'?'border-[var(--accent)] text-[var(--accent)]':'border-transparent'}`} onClick={()=>setMode('clients')}><MessageSquare size={18}/>WhatsApp por cliente</button><button className={`flex gap-2 py-3 border-b-2 ${mode==='utm'?'border-[var(--accent)] text-[var(--accent)]':'border-transparent'}`} onClick={()=>setMode('utm')}><Link2 size={18}/>Gerador de UTMs</button></div>
    {mode==='utm'?<Suspense fallback={<p>Carregando…</p>}><UTMLinkBuilder/></Suspense>:<>
      {error&&<p role="alert" className="text-[var(--danger)]">{error}</p>}
      <div className="relative max-w-md"><Search size={16} className="absolute left-3 top-3 text-[var(--text-tertiary)]"/><input aria-label="Buscar cliente" placeholder="Buscar cliente" value={search} onChange={e=>setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]"/></div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {connections.some(c=>!c.client_id)&&!search&&<button onClick={()=>setSelected('pilot')} className="text-left rounded-xl p-5 border border-[var(--accent)] bg-[var(--accent-tint)]"><p className="text-xs text-[var(--accent)] uppercase tracking-widest">Piloto interno</p><h2 className="font-semibold mt-2">ORBE · teste validado</h2><p className="text-xs text-[var(--text-tertiary)] mt-2">Ver mensagens reais, cinco UTMs e criar links para o número de teste.</p><p className="text-sm text-[var(--accent)] mt-4">Abrir acompanhamento →</p></button>}
        {visible.map(client=>{const channel=connections.filter(c=>c.client_id===client.id);const setup=setups.find(s=>s.client_id===client.id);return <button key={client.id} onClick={()=>setSelected(client.id)} className="text-left rounded-xl p-5 border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--accent)] transition-colors"><h2 className="font-semibold">{client.name}</h2><p className={`text-xs mt-2 ${channel.some(c=>syncIsFresh(c.last_sync_at))?'text-[var(--accent)]':'text-[var(--text-tertiary)]'}`}>{channel.length?`${channel.length} número(s) cadastrado(s)`:'WhatsApp ainda não conectado'}</p>{setup&&<p className="text-xs text-[var(--text-tertiary)] mt-2">{systemNames[setup.system]}{!setup.traffic_active?' · Sem tráfego ativo':''}{setup.activation_status==='receiving'?' · Recebendo mensagens':setup.activation_status==='waiting_message'?' · Conectada, aguardando mensagem':setup.activation_status==='error'?' · Precisa de atenção':setup.activation_requested?' · Aguardando ativação':''}</p>}<p className="text-sm text-[var(--accent)] mt-4">{channel.length?'Ver rastreamento':'Configurar conexão'} →</p></button>})}
      </div>
      {visible.length===0&&<p className="text-sm text-[var(--text-tertiary)]">Nenhum cliente encontrado.</p>}
      <p className="text-xs text-[var(--text-tertiary)]">Cada cliente tem suas próprias conexões e registros. Mensagens sem evidência da origem permanecem como “Origem não identificada”.</p>
    </>}
  </div>
}
