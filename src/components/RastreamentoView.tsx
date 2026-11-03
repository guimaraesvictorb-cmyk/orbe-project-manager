import { lazy, Suspense, useEffect, useState } from 'react'
import { Link2, MessageSquare, Search } from 'lucide-react'
import { useClients } from '../hooks/useClients'
import {useTrackingRoute,updateTrackingRoute,clientSlug} from '../lib/trackingRoute'
import {ClientDashboardShare} from './ClientDashboardShare'
import { supabase } from '../lib/supabase'
import type { TrackingConnection } from '../lib/whatsappTracking'
import { syncIsFresh } from '../lib/whatsappTracking'
import {ClientAvatar} from './ClientAvatar'
import { systemNames, type TrackingSetup } from '../lib/whatsappSetup'
const WhatsAppTrackingView=lazy(()=>import('./WhatsAppTrackingView').then(m=>({default:m.WhatsAppTrackingView})))
const UTMLinkBuilder=lazy(()=>import('./UTMLinkBuilder').then(m=>({default:m.UTMLinkBuilder})))

function ClientLogo({id,name}:{id:string;name:string}) {
 return <div className="mb-4"><ClientAvatar id={id} name={name} className="h-24 w-40" editable/></div>
}

export function RastreamentoView() {
  const {clients:allClients}=useClients()
  // Excluded from tracking at the owner's request; client records stay intact.
  const hiddenTrackingClients=new Set(['c719c21c-e530-440b-8526-e6dd2688e2e1','5058a2a7-68e3-4d40-a84e-78dcc8b23758','338243c3-8443-4dd4-bce1-b4011feeb52c'])
  const clients=allClients.filter(client=>!hiddenTrackingClients.has(client.id))
  const route=useTrackingRoute(),mode=route.mode,selected=route.client
  const setMode=(mode:'clients'|'utm')=>updateTrackingRoute({mode})
  const setSelected=(id:string|null,tab:'overview'|'connections'='overview')=>updateTrackingRoute({client:id,slug:id?clientSlug(clients.find(c=>c.id===id)?.name||'cliente'):'',area:'internal',tab,section:'executive',unit:'all'})
  const toolTabs=[{id:'clients' as const,label:'WhatsApp por cliente',icon:<MessageSquare size={16}/>,mode:'clients' as const},{id:'utm' as const,label:'Gerador de UTMs',icon:<Link2 size={16}/>,mode:'utm' as const}]
  const toolTabListId='tracking-tools-tabs'
  function handleToolTabKeyDown(event:React.KeyboardEvent<HTMLButtonElement>,index:number){
    if(event.key!=='ArrowRight'&&event.key!=='ArrowLeft'&&event.key!=='Home'&&event.key!=='End')return
    event.preventDefault()
    const nextIndex=event.key==='Home'?0:event.key==='End'?toolTabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+toolTabs.length)%toolTabs.length
    const nextTab=toolTabs[nextIndex]
    setMode(nextTab.mode)
    document.getElementById(`${toolTabListId}-${nextTab.id}`)?.focus()
  }
  const [search,setSearch]=useState('')
  const [connections,setConnections]=useState<TrackingConnection[]>([])
  const [setups,setSetups]=useState<TrackingSetup[]>([])
  const [error,setError]=useState('')
  useEffect(()=>{let active=true;const refresh=()=>Promise.all([supabase.from('wa_tracking_connections').select('*'),supabase.from('wa_tracking_setups').select('*')]).then(([channels,plans])=>{if(active){setConnections(channels.data??[]);setSetups(plans.data??[]);setError(channels.error||plans.error?'Não foi possível consultar as conexões. Atualize a página.':'')}});void refresh();const timer=window.setInterval(refresh,30000);return()=>{active=false;window.clearInterval(timer)}},[selected])
  const isConnected=(id:string)=>!error&&connections.some(c=>c.client_id===id&&c.enabled&&c.connection_state==='open'&&(c.provider==='kommo'?['receiving','waiting_message'].includes(setups.find(s=>s.client_id===id)?.activation_status??''):syncIsFresh(c.last_sync_at)))
  const visible=clients.filter(c=>c.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).sort((a,b)=>Number(isConnected(b.id))-Number(isConnected(a.id))||a.name.localeCompare(b.name,'pt-BR'))
  if (selected !== null) {
    const selectedName = clients.find((client) => client.id === selected)?.name ?? "Cliente"
    const areas = [
      { id: "internal" as const, label: "Painel interno" },
      { id: "client" as const, label: "Visão do cliente" },
    ]
    const areaTabListId = `tracking-area-${selected}`

    function handleAreaKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") return
      event.preventDefault()
      const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? areas.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + areas.length) % areas.length
      const nextArea = areas[nextIndex]
      updateTrackingRoute({ area: nextArea.id })
      document.getElementById(`${areaTabListId}-${nextArea.id}`)?.focus()
    }

    return (
      <div className="min-w-0">
        <div className="px-4 pt-5 md:px-6 md:pt-6">
          <nav aria-label="Caminho da página" className="flex flex-wrap items-center gap-2 text-xs">
            <button onClick={() => { window.location.hash = "#clientes" }} className="text-[var(--text-tertiary)] transition-colors hover:text-[var(--accent)]">Clientes</button>
            <span aria-hidden="true" className="text-[var(--text-quaternary)]">/</span>
            <button onClick={() => setSelected(null)} className="text-[var(--text-tertiary)] transition-colors hover:text-[var(--accent)]">Central de rastreamento</button>
            <span aria-hidden="true" className="text-[var(--text-quaternary)]">/</span>
            <span className="text-[var(--accent)]">{selectedName}</span>
          </nav>
          <h1 className="mt-3 text-xl font-semibold text-[var(--text-primary)]">{selectedName}</h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">Acompanhe conexões, conversas, origem e oportunidades desta conta.</p>
        </div>

        <div className="mt-5 overflow-x-auto px-4 md:px-6" style={{ borderBottom: "1px solid var(--border)" }}>
          <div id={areaTabListId} className="flex w-max min-w-full gap-2" role="tablist" aria-label="Visão do rastreamento">
            {areas.map((area, index) => (
              <button
                key={area.id}
                id={`${areaTabListId}-${area.id}`}
                type="button"
                role="tab"
                aria-selected={route.area === area.id}
                aria-controls={`tracking-panel-${selected}`}
                tabIndex={route.area === area.id ? 0 : -1}
                onKeyDown={(event) => handleAreaKeyDown(event, index)}
                onClick={() => updateTrackingRoute({ area: area.id })}
                className={`min-h-11 shrink-0 border-b-2 px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] ${route.area === area.id ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"}`}
              >
                {area.label}
              </button>
            ))}
          </div>
        </div>

        <div id={`tracking-panel-${selected}`} role="tabpanel" aria-labelledby={`${areaTabListId}-${route.area}`} tabIndex={0} className="min-w-0 focus:outline-none">
          {route.area === "client" ? (
            <div className="p-4 md:p-6"><ClientDashboardShare key={selected} clientId={selected} /></div>
          ) : (
            <Suspense fallback={<p className="p-6 text-sm text-[var(--text-tertiary)]">Carregando rastreamento…</p>}>
              <WhatsAppTrackingView key={selected} clientId={selected} />
            </Suspense>
          )}
        </div>
      </div>
    )
  }
  return <div className="p-4 md:p-6 space-y-6 min-w-0">
    <div className="space-y-2">
      <nav aria-label="Caminho da página" className="flex items-center gap-2 text-xs">
        <button onClick={()=>{window.location.hash='#clientes'}} className="text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors">Clientes</button>
        <span aria-hidden="true" className="text-[var(--text-quaternary)]">/</span>
        <span className="text-[var(--accent)]">Central de rastreamento</span>
      </nav>
      <h1 className="text-2xl font-bold">Rastreamento dos clientes</h1>
      <p className="text-sm text-[var(--text-tertiary)]">Acompanhe conexões, WhatsApps, leads e origens. Para ver os dados de uma conta, selecione o cliente.</p>
    </div>
    <div className="overflow-x-auto border-b border-[var(--border)]">
      <div id={toolTabListId} className="flex w-max min-w-full gap-1" role="tablist" aria-label="Ferramentas de rastreamento">
        {toolTabs.map((item,index)=><button key={item.id} id={`${toolTabListId}-${item.id}`} type="button" role="tab" aria-selected={mode===item.mode} aria-controls="tracking-tools-panel" tabIndex={mode===item.mode?0:-1} onKeyDown={event=>handleToolTabKeyDown(event,index)} onClick={()=>setMode(item.mode)} className={`flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] ${mode===item.mode?'border-[var(--accent)] text-[var(--accent)]':'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}>{item.icon}{item.label}</button>)}
      </div>
    </div>
    <div id="tracking-tools-panel" role="tabpanel" aria-labelledby={`${toolTabListId}-${mode}`} tabIndex={0} className="min-w-0 space-y-4 focus:outline-none">
    {mode==='utm'?<Suspense fallback={<p>Carregando…</p>}><UTMLinkBuilder/></Suspense>:<>
      {error&&<p role="alert" className="text-[var(--danger)]">{error}</p>}
      <div className="relative max-w-md"><Search size={16} className="absolute left-3 top-3 text-[var(--text-tertiary)]"/><input aria-label="Buscar cliente por nome" placeholder="Buscar cliente" value={search} onChange={e=>setSearch(e.target.value)} className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-a44)]"/></div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visible.map(client=>{
          const channel=connections.filter(c=>c.client_id===client.id)
          const setup=setups.find(s=>s.client_id===client.id)
          const connected=isConnected(client.id)
          const needsAttention=setup?.activation_status==='error'
          const stateLabel=connected?'Conexão ativa':needsAttention?'Precisa de atenção':channel.length?'Conferir conexão':'Sem conexão'
          const ctaLabel=connected?'Ver rastreamento':channel.length||needsAttention?'Revisar conexão':'Configurar conexão'
          const stateClass=connected?'text-[var(--success)] bg-[var(--success-tint)]':needsAttention?'text-[var(--warning)] bg-[var(--warning-tint)]':'text-[var(--text-tertiary)] bg-[var(--bg-surface-2)]'
          return (
            <article key={client.id} className="flex min-w-0 flex-col rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 transition-colors hover:border-[var(--accent-a44)]">
              <ClientLogo id={client.id} name={client.name}/>
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <h2 className="min-w-0 truncate font-semibold text-[var(--text-primary)]">{client.name}</h2>
                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${stateClass}`}>
                  <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${connected?'bg-[var(--success)]':needsAttention?'bg-[var(--warning)]':'bg-[var(--text-quaternary)]'}`}/>{stateLabel}
                </span>
              </div>
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                {channel.some(c=>c.provider==='evolution')&&!connected?'Aguardando conexão do aparelho':channel.length?`${channel.length} número(s) integrado(s)`:'Nenhum número integrado'}
              </p>
              {setup&&<p className="mt-1 text-xs text-[var(--text-tertiary)]">{systemNames[setup.system]}{!setup.traffic_active?' · Sem tráfego ativo':''}{setup.activation_status==='receiving'?' · Recebendo mensagens':setup.activation_status==='waiting_message'?' · Conectada, aguardando mensagem':needsAttention?' · Verifique a configuração':setup.activation_requested?' · Aguardando ativação':''}</p>}
              <button onClick={()=>setSelected(client.id,connected?'overview':'connections')} className="mt-auto inline-flex min-h-10 items-center gap-1 pt-5 text-left text-sm font-medium text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">{ctaLabel}<span aria-hidden="true">→</span></button>
            </article>
          )
        })}
      </div>
      {visible.length===0&&<div className="rounded-xl border border-dashed border-[var(--border-strong)] p-8 text-center"><p className="text-sm font-medium text-[var(--text-primary)]">Nenhum cliente encontrado</p><p className="mt-1 text-xs text-[var(--text-tertiary)]">Tente outro nome ou limpe a busca para ver a carteira completa.</p></div>}
      <p className="text-xs text-[var(--text-tertiary)]">Cada cliente tem suas próprias conexões e registros. Mensagens sem evidência da origem permanecem como “Origem não identificada”.</p>
    </>}
    </div>
  </div>
}
