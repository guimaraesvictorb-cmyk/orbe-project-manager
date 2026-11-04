import {decimal,kommoRequest,object,unseal} from './kommo.js';
import {recordedOriginLabel} from './kommoDeepOrigin.js';
import {recordedChannel} from '../../src/lib/originReview.js';
import {storage} from './trackingServer.js';
import type {KommoConfig} from './kommoEnrichment.js';
type Row={entity_key:string;revision:number;occurred_at:string;payload:Record<string,string|number>};
type Evidence={channel:string;kind:string;id:string;at:number};
export function declaredChannel(text:unknown){
 const value=String(text??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').trim().toLowerCase();
 const match=value.match(/^(?:ola[!,.\s]*)?(?:vim|cheguei|encontrei voces) (?:do|pelo|no|pelo anuncio (?:do|no)) (site(?: da rayafit)?|google(?: ads)?|instagram|facebook|meta)\b/u);
 return match?recordedChannel(match[1].startsWith('site')?'site':match[1]):'Origem não identificada';
}
const items=(response:unknown,key:string):Record<string,unknown>[]=>{
 if(!response)return [];
 const root=object(response),embedded=object(root._embedded??{});
 if(!Array.isArray(embedded[key]))throw new Error('history_invalid_response');
 return embedded[key].map(object);
};
export async function reviewChannelHistory(cfg:KommoConfig,start:string|null,end:string|null){
 const db=storage(),rows=await db<Row[]>('rest/v1/rpc/wa_kommo_channel_candidates',{method:'POST',body:JSON.stringify({p_connection:cfg.connection_id,p_start:start,p_end:end})});
 if(!rows[0])return {reviewed:0,recovered:0,failed:0,has_more:false};
 const row=rows[0],deadline=Date.now()+45000,token=unseal(cfg.token_ciphertext,cfg.client_id),contact=decimal(row.payload.kommo_contact_id),lead=decimal(row.payload.kommo_lead_id),at=Date.parse(row.occurred_at);
 let next=0,eventsChecked=0,messagesChecked=0,talksChecked=0,messagesAccess='available',eventsAccess='available',phase='start',httpStatus=0,validation='';
 const evidence:Evidence[]=[];
 const read=async(path:string)=>{if(Date.now()>deadline-10000)throw new Error('history_incomplete');const delay=Math.max(0,next-Date.now());next=Math.max(next,Date.now())+220;if(delay)await new Promise(r=>setTimeout(r,delay));phase=path.split('?')[0].replace(/\/\d+/gu,'/:id');httpStatus=0;validation='';try{return await kommoRequest<unknown>(cfg.account_origin,token,path)}catch(e){httpStatus=e instanceof Error&&'status' in e?Number(e.status):0;validation=e instanceof Error&&'validation' in e?String(e.validation):'';throw e}};
 const collect=async(path:string,key:string,max=8)=>{
  const result:Record<string,unknown>[]=[];
  for(let page=1;page<=max;page++){
   const response=await read(`${path}${path.includes('?')?'&':'?'}limit=100&page=${page}`);result.push(...items(response,key));
   if(!response||!object(object(response)._links??{}).next)return result;
  }
  throw new Error('history_incomplete');
 };
 try{
  // Only a contact's own explicit declaration is used. Outgoing sales copy and
  // arbitrary pasted URLs never establish an acquisition channel.
  const declared=declaredChannel(row.payload.text);
  if(declared!=='Origem não identificada')evidence.push({channel:declared,kind:'contact_declaration',id:row.entity_key,at});
  for(const [kind,key,entity] of [['contacts',contact,'contact'],['leads',lead,'lead']] as const){
   const current=object(await read(`/api/v4/${kind}/${key}${kind==='leads'?'?with=contacts':''}`));
   if(String(current.id)!==key||String(current.account_id)!==cfg.account_id)throw new Error('history_invalid_binding');
   if(kind==='leads'&&!items({_embedded:{contacts:object(current._embedded??{}).contacts}},'contacts').some(c=>String(c.id)===contact))throw new Error('history_invalid_binding');
   const fields=await collect(`/api/v4/${kind}/custom_fields`,'custom_fields',2),sourceFields=new Set<string>();
   for(const field of fields){
    const source=recordedOriginLabel([{field_name:field.name,values:[{value:'Google'}]}]);
    if(source||String(field.code??'').toUpperCase()==='UTM_SOURCE'||String(field.name??'').toLowerCase()==='utm_source')sourceFields.add(String(field.id));
   }
   const created=Number(current.created_at);
   const q=new URLSearchParams({'filter[entity]':entity,'filter[entity_id]':key,'filter[created_at][from]':String(Number.isSafeInteger(created)&&created>0?created:0),'filter[created_at][to]':String(Math.floor(at/1000))});
   let events:Record<string,unknown>[]=[];
   try{events=await collect(`/api/v4/events?${q}`,'events')}catch(e){
    if(httpStatus===400||httpStatus===403){eventsAccess='unavailable';console.error('KOMMO_CHANNEL_EVENTS_UNAVAILABLE',httpStatus,validation)}else throw e;
   }
   for(const event of events){
    if(String(event.account_id)!==cfg.account_id||String(event.entity_id)!==key||event.entity_type!==entity)throw new Error('history_invalid_binding');
    eventsChecked++;
    const time=Number(event.created_at)*1000;if(!Number.isFinite(time)||time>at)continue;
    if(event.type!=='custom_field_value_changed'&&!/^custom_field_\d+_value_changed$/u.test(String(event.type)))continue;
    for(const raw of [...(Array.isArray(event.value_after)?event.value_after:[]),...(Array.isArray(event.value_before)?event.value_before:[])]){
     const value=object(object(raw).custom_field_value??{});
     if(!sourceFields.has(String(value.field_id)))continue;
     const channel=recordedChannel(value.text);
     if(channel!=='Origem não identificada')evidence.push({channel,kind:'source_field_history',id:String(event.id),at:time});
    }
   }
  }
  const talks=await collect(`/api/v4/talks?${new URLSearchParams({'filter[contact_id][]':contact})}`,'talks',2);
  if(talks.length>10)throw new Error('history_incomplete');
  for(const talk of talks){
   if(String(talk.account_id)!==cfg.account_id||String(talk.contact_id)!==contact)throw new Error('history_invalid_binding');
   if(Number(talk.created_at)*1000>at)continue;
   const talkId=decimal(talk.talk_id);talksChecked++;
   try{
    const messages=await collect(`/api/v4/talks/${talkId}/messages?${new URLSearchParams({'filter[created_at][to]':String(Math.floor(at/1000))})}`,'messages');
    for(const msg of messages){
     if(String(msg.chat_id)!==String(talk.chat_id))throw new Error('history_invalid_binding');
     messagesChecked++;
     const time=Number(msg.created_at)*1000;if(!Number.isFinite(time)||time>at||msg.type!=='incoming'||object(msg.author??{}).type!=='external')continue;
     const channel=declaredChannel(msg.text);
     if(channel!=='Origem não identificada')evidence.push({channel,kind:'contact_declaration',id:String(msg.id),at:time});
     // A native Instagram conversation identifies that channel. WhatsApp alone
     // does not identify where the contact discovered the business.
     if(['instagram','instagram_business'].includes(String(msg.origin).toLowerCase()))evidence.push({channel:'Instagram',kind:'instagram_conversation',id:String(msg.id),at:time});
    }
   }catch(e){if(e instanceof Error&&e.message==='kommo_permission_denied'){messagesAccess='permission_required';break}if(httpStatus===402){messagesAccess='plan_required';break}if(httpStatus===404){messagesAccess='history_unavailable';break}throw e}
  }
  evidence.sort((a,b)=>a.at-b.at);
  const channels=new Set(evidence.map(e=>e.channel));
  const best=declared!=='Origem não identificada'?evidence.find(e=>e.id===row.entity_key):channels.size===1?evidence[0]:undefined;
  const payload={...row.payload,origin_history_version:'1',origin_history_checked_at:new Date().toISOString(),origin_history_status:best?'channel_found':channels.size>1?'conflicting_channels':'not_found',origin_history_events_checked:eventsChecked,origin_history_events_access:eventsAccess,origin_history_messages_checked:messagesChecked,origin_history_talks_checked:talksChecked,origin_history_messages_access:messagesAccess,origin_history_channel:best?.channel??'',origin_history_evidence_kind:best?.kind??'',origin_history_evidence_id:best?.id??'',origin_history_evidence_at:best?new Date(best.at).toISOString():''};
  const saved=await db<Row[]>(`rest/v1/wa_tracking_records?connection_id=eq.${cfg.connection_id}&entity=eq.messages&entity_key=eq.${encodeURIComponent(row.entity_key)}&revision=eq.${row.revision}`,{method:'PATCH',body:JSON.stringify({payload,revision:row.revision+1,synced_at:new Date().toISOString()})});
  return {reviewed:saved.length?1:0,recovered:saved.length&&best?1:0,failed:0,has_more:rows.length>1||!saved.length};
 }catch(e){const reason=e instanceof Error&&['history_incomplete','history_invalid_binding','history_invalid_response','kommo_permission_denied','kommo_token_invalid','kommo_unavailable'].includes(e.message)?e.message:'history_failed';console.error('KOMMO_CHANNEL_HISTORY',reason,phase,httpStatus,validation);return {reviewed:0,recovered:0,failed:1,has_more:rows.length>1,failure_reason:reason}}
}
