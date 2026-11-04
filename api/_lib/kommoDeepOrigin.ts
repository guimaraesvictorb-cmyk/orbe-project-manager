import {crmOriginFields,kommoRequest,leadOriginEvidence,object,sourceFields,unseal} from './kommo.js';
import {storage} from './trackingServer.js';
import type {KommoConfig} from './kommoEnrichment.js';
type Row={entity_key:string;revision:number;occurred_at:string;payload:Record<string,string|number>};
const id=(value:unknown)=>/^[1-9][0-9]{0,18}$/.test(String(value??''));
const hasSource=(fields:Record<string,string>|null):fields is Record<string,string>=>!!(fields?.utm_source||fields?.gclid||fields?.fbclid);
type Evidence={fields:Record<string,string>;createdAt:string;lead:string;kind:string};

// Notes are inspected for explicit UTM-bearing links, but those links are only
// review hints: an agent can paste a campaign URL into any note after acquisition.
export function noteOriginHints(input:unknown,account:string,entity:string) {
 const root=input?object(input):{},embedded=root._embedded?object(root._embedded):{};
 let count=0,hints=0;
 for(const raw of Array.isArray(embedded.notes)?embedded.notes:[]){
  const note=object(raw);if(String(note.account_id)!==account||String(note.entity_id)!==entity)throw new Error('invalid_note_binding');
  count++;
  const params=note.params?object(note.params):{},text=typeof params.text==='string'?params.text:'';
  if(/(?:utm_source|gclid|fbclid)\s*=/iu.test(text))hints++;
 }
 return {count,hints};
}
export async function deepReviewOrigins(cfg:KommoConfig,start:string|null,end:string|null) {
 const db=storage(),token=unseal(cfg.token_ciphertext,cfg.client_id),deadline=Date.now()+45000;
 const rows=await db<Row[]>('rest/v1/rpc/wa_kommo_deep_origin_candidates',{method:'POST',body:JSON.stringify({p_connection:cfg.connection_id,p_start:start,p_end:end})});
 if(!rows[0])return {reviewed:0,recovered:0,failed:0,has_more:false};
 const row=rows[0],contact=String(row.payload.kommo_contact_id),lead=String(row.payload.kommo_lead_id);
 if(!id(contact)||!id(lead))return {reviewed:0,recovered:0,failed:1,has_more:rows.length>1};
 let nextRead=0;
 const read=async(path:string)=>{if(Date.now()>deadline-10000)throw new Error('review_incomplete');const delay=Math.max(0,nextRead-Date.now());nextRead=Math.max(nextRead,Date.now())+200;if(delay)await new Promise(resolve=>setTimeout(resolve,delay));return kommoRequest<unknown>(cfg.account_origin,token,path)};
 try{
  const c=object(await read(`/api/v4/contacts/${contact}?with=leads`));
  if(String(c.account_id)!==cfg.account_id||String(c.id)!==contact)throw new Error('invalid_contact_binding');
  const embedded=c._embedded?object(c._embedded):{},linked=Array.isArray(embedded.leads)?embedded.leads:[];
  const ids=[...new Set([lead,...linked.map(x=>String(object(x).id))])];
  if(ids.length>100||ids.some(x=>!id(x)))throw new Error('review_incomplete');
  const q=new URLSearchParams({with:'contacts,source',limit:'250'});for(const value of ids)q.append('filter[id][]',value);
  const response=object(await read(`/api/v4/leads?${q}`));
  if(response._links&&object(response._links).next)throw new Error('review_incomplete');
  const leadRows=Array.isArray(object(response._embedded??{}).leads)?object(response._embedded??{}).leads as unknown[]:[];
  const evidence:Evidence[]=[];let checked=0,currentBound=false;
  for(const raw of leadRows){
   const value=object(raw),key=String(value.id);if(!ids.includes(key))throw new Error('invalid_lead_binding');
   const origin=leadOriginEvidence(value,{account:cfg.account_id,lead:key,contact});if(!origin)throw new Error('invalid_lead_binding');
   checked++;if(key===lead)currentBound=true;
   if(Date.parse(origin.createdAt)<=Date.parse(row.occurred_at)&&hasSource(origin.fields))evidence.push({...origin,lead:key,kind:'linked_lead_fields'});
  }
  if(!currentBound)throw new Error('invalid_lead_binding');
  if(new Set(leadRows.map(raw=>String(object(raw).id))).size!==ids.length)throw new Error('review_incomplete');
  const fields=crmOriginFields(c.custom_fields_values),created=Number(c.created_at)*1000;
  if(hasSource(fields)&&Number.isFinite(created)&&created>=Date.parse('2020-01-01')&&created<=Date.parse(row.occurred_at))evidence.push({fields,createdAt:new Date(created).toISOString(),lead:'',kind:'contact_fields'});
  const notesFor=async(kind:'leads'|'contacts',key:string)=>{
   let count=0,hints=0;
   for(let page=1;page<=4;page++){
    const notes=await read(`/api/v4/${kind}/${key}/notes?limit=250&page=${page}&order[id]=asc`),value=noteOriginHints(notes,cfg.account_id,key);count+=value.count;hints+=value.hints;
    if(!notes||!object(object(notes)._links??{}).next)return {count,hints};
   }
   throw new Error('review_incomplete');
  };
  if(ids.length>10)throw new Error('review_incomplete');
  const targets:[('leads'|'contacts'),string][]=[['contacts',contact],...ids.map(key=>['leads',key] as ['leads',string])];
  const counts:{count:number;hints:number}[]=[];
  for(let i=0;i<targets.length;i+=2){
   const notes=await Promise.allSettled(targets.slice(i,i+2).map(([kind,key])=>notesFor(kind,key)));
   if(notes.some(r=>r.status==='rejected'))throw new Error('review_incomplete');
   for(const result of notes)if(result.status==='fulfilled')counts.push(result.value);
  }
  evidence.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.lead.localeCompare(b.lead));
  const best=evidence[0];
  const update:Record<string,string|number>={...row.payload,origin_deep_version:'1',origin_deep_checked_at:new Date().toISOString(),origin_deep_status:best?'historical_evidence':'not_found',origin_deep_leads_checked:checked,origin_deep_notes_checked:counts.reduce((n,r)=>n+r.count,0),origin_deep_note_hints:counts.reduce((n,r)=>n+r.hints,0)};
  if(best){update.crm_contact_origin_created_at=best.createdAt;update.crm_contact_origin_lead=best.lead;update.crm_contact_origin_kind=best.kind;for(const key of sourceFields)update['crm_contact_origin_'+key]=best.fields[key]??'';}
  const saved=await db<Row[]>(`rest/v1/wa_tracking_records?connection_id=eq.${cfg.connection_id}&entity=eq.messages&entity_key=eq.${encodeURIComponent(row.entity_key)}&revision=eq.${row.revision}`,{method:'PATCH',body:JSON.stringify({payload:update,revision:row.revision+1,synced_at:new Date().toISOString()})});
  return {reviewed:saved.length?1:0,recovered:saved.length&&best?1:0,failed:0,has_more:rows.length>1||!saved.length};
 }catch(error){const reason=error instanceof Error&&['invalid_contact_binding','invalid_lead_binding','invalid_note_binding','review_incomplete','kommo_permission_denied','kommo_token_invalid','kommo_unavailable','storage_unavailable'].includes(error.message)?error.message:'verification_failed';console.error('KOMMO_DEEP_ORIGIN',reason);return {reviewed:0,recovered:0,failed:1,has_more:rows.length>1,failure_reason:reason};}
}
