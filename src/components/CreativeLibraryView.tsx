import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ExternalLink, Folder, Image, Images, Loader2, RefreshCw, Search, Video, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { WorkspaceClientPicker } from './WorkspaceClientPicker'
import { useWorkspaceClient } from '../hooks/useWorkspaceClient'
import { Footer } from './Footer'
import { openClientWorkspace } from '../lib/clientWorkspace'
import { safeSourceUrl } from '../lib/safeSourceUrl'

type Asset = { id: string; name: string; mimeType: string; url: string; modifiedTime?: string }
type Result = { folders: Array<{id: string; name: string}>; files: Asset[]; nextPageToken: string | null }
const folderMime = 'application/vnd.google-apps.folder'

function CreativeBrowser({ clientId }: { clientId: string }) {
  const [root, setRoot] = useState<string | null>(null)
  const [path, setPath] = useState<string[]>([])
  const [result, setResult] = useState<Result>({ folders: [], files: [], nextPageToken: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('all')
  const [retry, setRetry] = useState(0)
  const request = useRef<AbortController | null>(null)
  useEffect(() => {
    let active = true
    void supabase.from('client_drive_config').select('folder_id').eq('client_id',clientId).maybeSingle().then(({data,error}) => {
      if (!active) return
      if (error) { setError('Não foi possível consultar a pasta do cliente.'); setLoading(false) }
      else if (!data) { setLoading(false); setRoot(null) }
      else { setRoot(data.folder_id); setPath([data.folder_id]) }
    })
    return () => { active = false; request.current?.abort() }
  }, [clientId])
  const load = useCallback(async (ids: string[], pageToken: string | null = null) => {
    request.current?.abort()
    const controller = new AbortController(); request.current = controller
    setLoading(true); setError('')
    if (!pageToken) setResult({ folders: [], files: [], nextPageToken: null })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Entre novamente para abrir o Drive.')
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/orbe-drive-sync`, { method: 'POST', signal: controller.signal, headers: { authorization: `Bearer ${session.access_token}`, 'content-type':'application/json' }, body: JSON.stringify({client_id:clientId, action:'browse_creatives',path:ids,page_token:pageToken}) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Não foi possível abrir a pasta.')
      if (!controller.signal.aborted) setResult(previous => ({ ...body, files: pageToken ? [...previous.files,...body.files] : body.files }))
    } catch(cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Falha ao consultar o Drive.') }
    finally { if (!controller.signal.aborted) setLoading(false) }
  }, [clientId])
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active && path.length) void load(path) }); return () => { active = false; request.current?.abort() } }, [path,retry,load])
  const files = result.files.filter(file => file.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')) && (kind==='all' || file.mimeType===folderMime || file.mimeType.startsWith(`${kind}/`)))
  function enter(id: string) { setQuery(''); setPath(previous => [...previous,id]) }
  if (!loading && !root && !error) return <section className="rounded-2xl border border-dashed border-[var(--border-strong)] p-8"><h2 className="font-semibold">Vincule o Drive deste cliente</h2><p className="mt-2 text-sm text-[var(--text-tertiary)]">A biblioteca usa somente a pasta configurada na base de conhecimento.</p><button className="mt-4 text-sm text-[var(--accent)]" onClick={() => openClientWorkspace(clientId,'cliente','knowledge')}>Configurar pasta →</button></section>
  return <section aria-label="Acervo de criativos" className="space-y-5">
    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]" aria-label="Caminho da pasta">
      {path.length>1 && <button aria-label="Voltar uma pasta" onClick={() => { setQuery(''); setPath(previous=>previous.slice(0,-1)) }} className="rounded-lg border border-[var(--border)] p-2"><ArrowLeft size={14}/></button>}
      {result.folders.map((folder,index)=><button key={folder.id} onClick={()=>{setQuery('');setPath(previous=>previous.slice(0,index+1))}} className="max-w-56 truncate rounded-lg px-2 py-2 hover:bg-[var(--bg-surface)]" aria-current={index===result.folders.length-1?'location':undefined}>{index?' / ':''}{folder.name}</button>)}
      {root && <a href={`https://drive.google.com/drive/folders/${path.at(-1)??root}`} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-[var(--accent)]">Abrir no Drive<ExternalLink size={12}/></a>}
    </div>
    <div className="flex flex-wrap gap-3"><label className="flex min-w-52 flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3"><Search size={15} className="text-[var(--text-tertiary)]"/><input aria-label="Buscar nesta pasta" placeholder="Buscar nome, mês ou campanha nesta pasta" className="w-full bg-transparent py-3 text-sm outline-none" value={query} onChange={event=>setQuery(event.target.value)}/></label><select aria-label="Tipo de criativo" value={kind} onChange={event=>setKind(event.target.value)} className="rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 text-xs"><option value="all">Todos os formatos</option><option value="image">Imagens</option><option value="video">Vídeos</option></select><button aria-label="Atualizar pasta" disabled={loading} onClick={()=>setRetry(value=>value+1)} className="rounded-xl border border-[var(--border)] px-3 text-[var(--text-secondary)] disabled:opacity-50"><RefreshCw size={16}/></button></div>
    {error && <p role="alert" className="rounded-xl border border-[var(--border)] p-4 text-sm text-[var(--warning)]">{error}<button onClick={()=>setRetry(value=>value+1)} className="ml-3 text-[var(--accent)]">Tentar novamente</button></p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{files.map(file => {
      const isFolder = file.mimeType===folderMime
      const Icon = isFolder?Folder:file.mimeType.startsWith('image/')?Image:file.mimeType.startsWith('video/')?Video:FileText
      const content = <><div className="mb-4 inline-flex rounded-xl bg-[var(--accent-tint)] p-3 text-[var(--accent)]"><Icon size={22}/></div><h3 className="break-words text-sm font-semibold">{file.name}</h3><p className="mt-2 text-xs text-[var(--text-tertiary)]">{isFolder?'Abrir pasta':file.mimeType.startsWith('video/')?'Vídeo · abrir no Drive':file.mimeType.startsWith('image/')?'Imagem · abrir no Drive':'Documento de criação · abrir no Drive'}</p>{!isFolder&&file.modifiedTime&&<p className="mt-2 text-[10px] text-[var(--text-quaternary)]">Arquivo atualizado em {new Date(file.modifiedTime).toLocaleDateString('pt-BR')}</p>}</>
      const style = 'rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 text-left transition hover:border-[var(--accent-a44)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]'
      return isFolder ? <button className={style} key={file.id} onClick={()=>enter(file.id)}>{content}</button> : safeSourceUrl(file.url) ? <a className={style} key={file.id} href={safeSourceUrl(file.url)!} target="_blank" rel="noopener noreferrer">{content}</a> : null
    })}</div>
    {loading&&<p role="status" className="flex items-center gap-2 py-4 text-sm text-[var(--text-tertiary)]"><Loader2 size={16} className="animate-spin"/>Lendo o acervo do Drive…</p>}
    {!loading&&!error&&!files.length&&<p className="rounded-2xl border border-dashed border-[var(--border-strong)] p-8 text-sm text-[var(--text-tertiary)]">{query?'Nenhum resultado nesta página da pasta. Limpe a busca ou carregue mais arquivos.':'Esta pasta não contém pastas ou formatos de criação visíveis. Volte uma pasta para explorar outro período.'}</p>}
    {result.nextPageToken&&<button disabled={loading} onClick={()=>void load(path,result.nextPageToken)} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--accent)] disabled:opacity-50">Carregar mais arquivos desta pasta</button>}
    <p className="text-[11px] leading-relaxed text-[var(--text-tertiary)]">Acervo em tempo real, somente leitura. Entre nas pastas de ano, mês ou campanha para acessar o histórico. A data de atualização do arquivo não define o mês da campanha. Arquivos de acesso e listas pessoais são excluídos.</p>
  </section>
}
export function CreativeLibraryView() {
  const {clients,selected,selectClient,clientId,loading} = useWorkspaceClient()
  return <div className="flex min-h-full flex-col"><div className="mx-auto w-full max-w-6xl flex-1 space-y-7 px-4 py-8 sm:px-8"><header><Images size={25} className="text-[var(--accent)]"/><h1 className="mt-4 font-display text-2xl font-semibold">Criativos</h1><p className="mt-2 text-sm text-[var(--text-tertiary)]">Imagens, vídeos e materiais de criação do Drive. Um acervo por cliente, com acesso aos meses anteriores.</p></header><WorkspaceClientPicker clients={clients} selected={clientId} onChange={selectClient}/>{selected?<CreativeBrowser key={selected.id} clientId={selected.id}/>:<p className="rounded-2xl border border-dashed border-[var(--border-strong)] p-8 text-sm text-[var(--text-tertiary)]">{loading?'Carregando clientes…':'Selecione um cliente para abrir seu acervo.'}</p>}</div><Footer/></div>
}
