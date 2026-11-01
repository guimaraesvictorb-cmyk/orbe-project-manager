import {brPhone} from './evoReconciliation.js';
import type {storage} from './trackingServer.js';
export type EvoCandidate={key:string;phones:string[];at:string|null};
export type EvoLeadSource={phone:string;at:string;source:string;status:string;gclid?:string;fbclid?:string};
export function evoSaleInstant(raw:unknown,zone:unknown,fallback?:string){
 if(typeof raw!=='string')return null;
 let value=raw;if(!/(Z|[+-]\d{2}:\d{2})$/.test(value)){const tz=typeof zone==='string'&&/^[+-]\d{2}:\d{2}$/.test(zone)?zone:fallback;if(!tz||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value))return null;value+=tz}
 const n=Date.parse(value);return Number.isFinite(n)?new Date(n).toISOString():null;
}
function channel(lead:EvoLeadSource){if(lead.status!=='Identificada')return 'Origem não identificada';const s=lead.source.toLowerCase();if(/instagram|linktree/.test(s))return 'Instagram';if(/google/.test(s)||lead.gclid)return 'Google';if(/meta|facebook/.test(s)||lead.fbclid)return 'Meta';if(/^(site|site_rayafit|website|site_institucional)$/.test(s))return 'Site';return 'Origem não identificada'}
export function attributeEvoCandidates(candidates:EvoCandidate[],leads:EvoLeadSource[],onMatch?:(candidate:EvoCandidate,source:string)=>void){
 const earliest=new Map<string,EvoLeadSource>();let missingLeadPhones=0;
 for(const lead of leads){const p=brPhone(lead.phone);if(!p||!Number.isFinite(Date.parse(lead.at))){missingLeadPhones++;continue}const previous=earliest.get(p);if(!previous||lead.at<previous.at)earliest.set(p,lead)}
 const unique=new Map<string,EvoCandidate>();for(const c of candidates){if(unique.has(c.key))throw new Error('duplicate_candidate');unique.set(c.key,c)}
 const owners=new Map<string,Set<string>>();for(const c of candidates)for(const phone of c.phones){const p=brPhone(phone);if(!p)continue;const ids=owners.get(p)??new Set<string>();ids.add(c.key);owners.set(p,ids)}
 let matched=0,unmatched=0,ambiguous=0,missingPhone=0,missingDate=0;const channels:Record<string,number>=Object.create(null);
 for(const c of unique.values()){
  if(!c.at||!Number.isFinite(Date.parse(c.at))){missingDate++;continue}const phones=[...new Set(c.phones.map(brPhone).filter((p):p is string=>!!p))];if(!phones.length){missingPhone++;continue}
  if(phones.some(p=>(owners.get(p)?.size??0)>1)){ambiguous++;continue}
  const options=phones.map(p=>earliest.get(p)).filter((p):p is EvoLeadSource=>!!p&&Date.parse(p.at)<=Date.parse(c.at!)).sort((a,b)=>a.at.localeCompare(b.at));
  if(!options[0]){unmatched++;continue}matched++;const source=channel(options[0]);onMatch?.(c,source);channels[source]=(channels[source]??0)+1;
 }
 return {matched,unmatched,ambiguous,missing_phone:missingPhone,missing_date:missingDate,missing_lead_phones:missingLeadPhones,channels};
}
export async function evoLeadSources(db:ReturnType<typeof storage>,client:string){
 const connections=await db<{id:string}[]>(`rest/v1/wa_tracking_connections?client_id=eq.${client}&select=id&order=id`),out:EvoLeadSource[]=[];
 for(const connection of connections){const seen=new Set<string>();let complete=false;
  for(let offset=0;offset<20000;offset+=1000){
   const rows=await db<{entity_key:string;occurred_at:string;phone:string|null;contact:string|null;sender:string|null;source:string|null;status:string|null;gclid:string|null;fbclid:string|null}[]>(`rest/v1/wa_tracking_records?connection_id=eq.${connection.id}&entity=eq.messages&select=entity_key,occurred_at,phone:payload->>phone,contact:payload->>contact_id,sender:payload->>sender_id,source:payload->>utm_source,status:payload->>source_status,gclid:payload->>gclid,fbclid:payload->>fbclid&order=occurred_at.asc,entity_key.asc&limit=1000&offset=${offset}`);
   for(const row of rows){const key=row.contact||row.sender||row.entity_key;if(seen.has(key))continue;seen.add(key);out.push({phone:row.phone||'',at:row.occurred_at,source:row.source||'',status:row.status||'',gclid:row.gclid||'',fbclid:row.fbclid||''})}
   if(rows.length<1000){complete=true;break}
  }if(!complete)throw new Error('evo_preview_too_large');
 }return out;
}
