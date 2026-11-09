import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {useAuth} from '../hooks/useAuth'
const names:Record<string,string>={all:'Total do cliente',alecrim:'Alecrim',ibes:'Ibes',itapua:'Itapuã'}
export function ClientGoalsEditor({clientId,month,onSaved}:{clientId:string;month:string;onSaved:()=>void}){
 const {profile}=useAuth()
 const [connection,setConnection]=useState(''),[values,setValues]=useState<Record<string,string>>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false)
 const rayafit=clientId==='589481f6-3a15-4c93-b384-5d33373c20e3',units=rayafit?['alecrim','ibes','itapua']:['all']
 useEffect(()=>{let active=true;void(async()=>{setReady(false);try{
  const c=await supabase.from('wa_tracking_connections').select('id').eq('client_id',clientId).eq('enabled',true).order('created_at').limit(1)
  if(c.error||!c.data?.[0])throw Error('Conecte o WhatsApp do cliente antes de definir a meta de contatos.')
  const id=c.data[0].id
  const result=await supabase.from('wa_bi_goals').select('unit,target').eq('connection_id',id).eq('month',month+'-01')
  if(result.error)throw Error('Não foi possível consultar as metas.')
  if(active){setConnection(id);setValues(Object.fromEntries(result.data.map(g=>[g.unit,String(g.target)])));setError('');setReady(true)}
 }catch(e){if(active)setError(e instanceof Error?e.message:'Falha ao consultar as metas.')}})();return()=>{active=false}},[clientId,month])
 if(profile?.role!=='admin')return null
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{
  const goals=units.map(unit=>({unit,target:Number(values[unit]),connection_id:connection,month:month+'-01',updated_at:new Date().toISOString()}))
  if(goals.some(g=>!Number.isInteger(g.target)||g.target<1||g.target>1000000))throw Error('Informe metas inteiras maiores que zero para cada unidade.')
  if(rayafit)goals.push({...goals[0],unit:'all',target:goals.reduce((n,g)=>n+g.target,0)})
  const result=await supabase.from('wa_bi_goals').upsert(goals,{onConflict:'connection_id,month,unit'})
  if(result.error)throw Error('Não foi possível salvar as metas. Nenhuma confirmação foi recebida.')
  onSaved()
 }catch(e){setError(e instanceof Error?e.message:'Falha ao salvar.')}finally{setBusy(false)}}
 return <details className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"><summary className="cursor-pointer text-sm font-semibold text-[var(--accent)]">Definir metas de primeiros contatos · {month.split('-').reverse().join('/')}</summary><p className="mt-3 text-xs text-[var(--text-tertiary)]">Planejamento do mês completo. {rayafit?'O total é calculado pela soma das três unidades. ':''}Matrículas e vendas continuam dependendo da fonte oficial.</p>{error&&<p role="alert" className="mt-3 text-sm text-[var(--danger)]">{error}</p>}{ready&&<form onSubmit={save} className="mt-4 space-y-4"><div className="grid gap-3 sm:grid-cols-3">{units.map(unit=><label key={unit} className="text-xs">{names[unit]}<input aria-label={`Meta de ${names[unit]}`} required type="number" min={1} max={1000000} value={values[unit]||''} onChange={e=>setValues(v=>({...v,[unit]:e.target.value}))} className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] p-3"/></label>)}</div>{rayafit&&<p className="text-sm">Total planejado: <strong>{units.reduce((n,u)=>n+Number(values[u]||0),0)}</strong> primeiros contatos.</p>}<button disabled={busy} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm text-white disabled:opacity-50">{busy?'Salvando…':'Salvar metas do mês'}</button></form>}</details>
}
