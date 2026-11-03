import { useRef, useState } from 'react'
import { Brain, Download, ExternalLink, Upload } from 'lucide-react'
import { WorkspaceClientPicker } from './WorkspaceClientPicker'
import { useWorkspaceClient } from '../hooks/useWorkspaceClient'
import { useClientKnowledge, type KnowledgeEntry } from '../hooks/useClientKnowledge'
import { useAuth } from '../hooks/useAuth'
import { isAdminOrCoordenador } from '../lib/permissions'
import { noteImportError, obsidianNoteUrl, type ObsidianNote } from '../lib/obsidianNotes'
import { safeSourceUrl } from '../lib/safeSourceUrl'
import { openClientWorkspace } from '../lib/clientWorkspace'
import { supabase } from '../lib/supabase'
import { AssistantMessage } from './AssistantMessage'
import { Footer } from './Footer'

function KnowledgeLibrary({ clientId, clientName }: {clientId:string;clientName:string}) {
 const {profile}=useAuth()
 const {validated,loading,refetch}=useClientKnowledge(clientId)
 const [query,setQuery]=useState('')
 const [source,setSource]=useState('all')
 const [vault,setVault]=useState(()=>localStorage.getItem(`orbe_obsidian_vault_${clientId}`)??'')
 const [notes,setNotes]=useState<ObsidianNote[]>([])
 const [skipped,setSkipped]=useState<string[]>([])
 const [message,setMessage]=useState('')
 const [busy,setBusy]=useState(false)
 const [opened,setOpened]=useState<{id:string;title:string;content:string}|null>(null)
 const [opening,setOpening]=useState(false)
 const request=useRef(0)
 const input=useRef<HTMLInputElement>(null)
 const canImport=isAdminOrCoordenador(profile)
 const documents=validated.filter(entry=>!/:chunk:[1-9]\d*$/.test(entry.source_ref??''))
 const filtered=documents.filter(entry=>(source==='all'||entry.source===source)&&entry.title.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))
 async function selectFiles(files: File[]) {
  setNotes([]);setSkipped([]);setMessage('');setBusy(true)
  const accepted:ObsidianNote[]=[], excluded:string[]=[]
  if(files.length>50) {setMessage('Selecione até 50 notas por lote.');setBusy(false);return}
  for(const file of files) {
   const path=file.webkitRelativePath||file.name
   if(file.size>200000){excluded.push(`${path}: acima de 200 KB`);continue}
   const content=await file.text(), reason=noteImportError(path,content)
   if(reason)excluded.push(`${path}: ${reason}`);else accepted.push({path,content})
  }
  setNotes(accepted);setSkipped(excluded);setBusy(false)
 }
 async function importNotes() {
  if(!notes.length||!vault.trim())return
  setBusy(true);setMessage('')
  const {data,error}=await supabase.rpc('import_obsidian_notes',{p_client_id:clientId,p_vault:vault.trim(),p_notes:notes})
  if(error)setMessage('Não foi possível importar. Confira sua permissão e remova notas restritas do lote.')
  else {localStorage.setItem(`orbe_obsidian_vault_${clientId}`,vault.trim());setMessage(`${data} nota(s) importada(s) para ${clientName}. O cofre original permanece sem alterações.`);setNotes([]);await refetch()}
  setBusy(false)
 }
 async function read(entry:KnowledgeEntry) {
  const current=++request.current;setOpening(true);setOpened(null);setMessage('')
  let data: {title:string;content:string}|null=null
  let error: unknown
  if(entry.source==='drive' && /^[\w-]+$/.test(entry.source_ref??'')) {
   const result=await supabase.from('client_knowledge').select('title,content,source_ref').eq('client_id',clientId).eq('source','drive').or(`source_ref.eq.${entry.source_ref},source_ref.like.${entry.source_ref}:chunk:*`)
   error=result.error
   const parts=(result.data??[]).sort((a,b)=>Number(a.source_ref?.split(':chunk:')[1]??0)-Number(b.source_ref?.split(':chunk:')[1]??0))
   if(parts.length)data={title:entry.title.replace(/ · parte 1\/\d+$/,''),content:parts.map(part=>part.content).join('\n\n')}
  } else {
   const result=await supabase.from('client_knowledge').select('title,content').eq('id',entry.id).eq('client_id',clientId).maybeSingle()
   data=result.data;error=result.error
  }
  if(current!==request.current)return
  if(error||!data)setMessage('A nota não está disponível para seu acesso.');else setOpened({id:entry.id,...data})
  setOpening(false)
 }
 function downloadNote() {
  if(!opened)return
  const file=new Blob([`# ${opened.title}\n\n${opened.content}\n`],{type:'text/markdown;charset=utf-8'})
  const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=opened.title.replace(/[\\/:*?"<>|]/g,'-').slice(0,180)+'.md';a.click();URL.revokeObjectURL(url)
 }
 return <div className="space-y-6">
  <div className="grid gap-3 sm:grid-cols-3">{[['Documentos disponíveis',documents.length],['Google Drive',documents.filter(entry=>entry.source==='drive').length],['Notas do Obsidian',documents.filter(entry=>entry.source==='obsidian').length]].map(([label,count])=><div key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"><p className="text-xs text-[var(--text-tertiary)]">{label}</p><p className="mt-2 text-2xl font-semibold">{loading?'—':count}</p></div>)}</div>
  <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-sm font-semibold">Obsidian</h2><p className="mt-2 max-w-2xl text-xs leading-relaxed text-[var(--text-tertiary)]">Importe notas Markdown do cofre para a base deste cliente. As notas ficam disponíveis para busca e para a IA do cliente. Importação manual: alterações futuras no Obsidian exigem nova importação; não há sincronização contínua ativa.</p></div><span className="h-fit rounded-full bg-[var(--bg-surface-2)] px-3 py-1 text-[10px] text-[var(--text-secondary)]">{documents.some(entry=>entry.source==='obsidian')?'Notas importadas':'Cofre ainda não importado'}</span></div>
   {canImport&&<div className="mt-4 space-y-3"><label className="block text-xs text-[var(--text-secondary)]">Nome do cofre<input aria-label="Nome do cofre Obsidian" value={vault} onChange={event=>setVault(event.target.value)} maxLength={100} placeholder="Nome exibido no Obsidian" className="mt-1 block w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-sm"/></label><div className="flex flex-wrap gap-3"><button disabled={busy} onClick={()=>input.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--accent)] disabled:opacity-50"><Upload size={14}/>Selecionar notas .md</button><input ref={input} className="sr-only" type="file" multiple accept=".md,text/markdown" aria-label="Notas Markdown do Obsidian" onChange={event=>{void selectFiles(Array.from(event.target.files??[]));event.target.value=''}}/>{notes.length>0&&<button disabled={busy||!vault.trim()} onClick={()=>void importNotes()} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--bg-page)] disabled:opacity-50">{busy?'Importando…':`Importar ${notes.length} nota(s) para ${clientName}`}</button>}</div>{notes.length>0&&<details><summary className="cursor-pointer text-xs text-[var(--text-secondary)]">Conferir notas selecionadas antes de importar</summary><ul className="mt-2 max-h-36 overflow-auto text-xs text-[var(--text-tertiary)]">{notes.map(note=><li key={note.path}>{note.path}</li>)}</ul></details>}{skipped.length>0&&<p className="text-xs text-[var(--warning)]">{skipped.length} arquivo(s) excluído(s) por formato, tamanho ou conteúdo restrito. Nenhum conteúdo desses arquivos foi enviado.</p>}</div>}
  </section>
  {message&&<p role="status" className="text-sm text-[var(--text-secondary)]">{message}</p>}
  <section className="space-y-4"><div className="flex flex-wrap items-center gap-3"><input aria-label="Buscar documentos do segundo cérebro" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar documentos por nome" className="min-w-52 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 py-3 text-sm"/><select aria-label="Fonte do conhecimento" value={source} onChange={event=>setSource(event.target.value)} className="rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 py-3 text-xs"><option value="all">Todas as fontes</option><option value="drive">Google Drive</option><option value="obsidian">Obsidian</option><option value="manual">Manual</option></select><button onClick={()=>openClientWorkspace(clientId,clientName,'ai')} className="rounded-xl bg-[var(--accent-tint)] px-4 py-3 text-xs font-semibold text-[var(--accent)]">Perguntar à IA do cliente →</button></div>
  <div className="grid items-start gap-4 xl:grid-cols-2"><div className="max-h-[600px] space-y-2 overflow-y-auto">{filtered.map(entry=><article key={entry.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"><button onClick={()=>void read(entry)} className="text-left text-sm font-medium hover:text-[var(--accent)]">{entry.title}</button><div className="mt-2 flex flex-wrap gap-3 text-[10px] text-[var(--text-tertiary)]"><span>{entry.source==='drive'?'Google Drive':entry.source==='obsidian'?'Obsidian':'Base do cliente'} · {new Date(entry.updated_at).toLocaleDateString('pt-BR')}</span>{entry.source_url&&safeSourceUrl(entry.source_url)&&<a href={safeSourceUrl(entry.source_url)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[var(--accent)]">Documento original<ExternalLink size={10}/></a>}{entry.source==='obsidian'&&vault.trim()&&entry.title.startsWith(`Obsidian / ${vault.trim()} / `)&&<a className="text-[var(--accent)]" href={obsidianNoteUrl(vault.trim(),entry.title.slice(`Obsidian / ${vault.trim()} / `.length))}>Abrir no Obsidian</a>}</div></article>)}{!filtered.length&&<p role="status" className="rounded-xl border border-dashed border-[var(--border)] p-6 text-sm text-[var(--text-tertiary)]">{loading?'Carregando documentos…':'Nenhum documento disponível para estes filtros.'}</p>}</div><div className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">{opening?<p role="status" className="text-sm text-[var(--text-tertiary)]">Abrindo documento…</p>:opened?<><div className="mb-4 flex items-start justify-between gap-3"><h2 className="break-words text-sm font-semibold">{opened.title}</h2><button onClick={downloadNote} aria-label="Baixar nota Markdown" className="shrink-0 text-[var(--accent)]"><Download size={16}/></button></div><div className="max-h-[560px] overflow-auto text-xs leading-relaxed text-[var(--text-secondary)]"><AssistantMessage text={opened.content}/></div></>:<p className="text-sm text-[var(--text-tertiary)]">Escolha um documento para ler ou exportar como Markdown.</p>}</div></div></section>
 </div>
}
export function SecondBrainView(){const {clients,clientId,selected,selectClient}=useWorkspaceClient();return <div className="flex min-h-full flex-col"><div className="mx-auto w-full max-w-6xl flex-1 space-y-7 px-4 py-8 sm:px-8"><header><Brain size={25} className="text-[var(--accent)]"/><h1 className="mt-4 font-display text-2xl font-semibold">Segundo cérebro</h1><p className="mt-2 text-sm text-[var(--text-tertiary)]">Documentos, decisões e conhecimento de cada projeto, com as permissões do cliente.</p></header><WorkspaceClientPicker clients={clients} selected={clientId} onChange={selectClient}/>{selected?<KnowledgeLibrary key={selected.id} clientId={selected.id} clientName={selected.name}/>:<p className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-sm text-[var(--text-tertiary)]">Selecione um cliente para consultar a base de conhecimento.</p>}</div><Footer/></div>}
