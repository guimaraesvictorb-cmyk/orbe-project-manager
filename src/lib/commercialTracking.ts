import type {TrackingRecord} from './whatsappTracking'
import {firstContacts,trackingChannel,campaignName} from './trackingDashboard'
export type ConversationEvent={event_id:string;contact_id:string;direction:'incoming'|'outgoing';author_kind:'external'|'human'|'automatic'|'unknown';author_name:string;message_text:string;occurred_at:string;captured_at:string}
export type CommercialOutcome={contact_id:string;status:'open'|'contacted'|'won'|'lost';evidence:string;updated_at:string;updated_by:string}
export type ServiceSettings={weekdays:number[];opens:number;closes:number;target_minutes:number;outbound_started_at:string;capture_ready_at:string|null}
export type ServiceState='waiting'|'late'|'answered'|'review'|'partial'|'won'|'lost'
// Business calendar uses Brasilia's current UTC-03 schedule. No machine-local timezone dependence.
export function businessMinutes(from:string,to:string,s:Pick<ServiceSettings,'weekdays'|'opens'|'closes'>){
 const begin=Date.parse(from),end=Date.parse(to);if(!Number.isFinite(begin)||!Number.isFinite(end)||end<=begin)return 0
 const offset=3*60*60000,day=86400000;let sum=0
 for(let d=Math.floor((begin-offset)/day)*day;d<=end-offset;d+=day){
  if(!s.weekdays.includes(new Date(d).getUTCDay()))continue
  const a=d+offset+s.opens*60000,b=d+offset+s.closes*60000
  sum+=Math.max(0,Math.min(end,b)-Math.max(begin,a))/60000
 }
 return Math.floor(sum)
}
export function saleSignal(events:ConversationEvent[]){
 for(const e of [...events].sort((a,b)=>b.occurred_at.localeCompare(a.occurred_at))){
  const sentences=e.message_text.split(/[.!?\n]+/)
  for(const sentence of sentences){
   if(/\b(não|nao|aguardando|pendente|quando|se|ainda)\b/i.test(sentence))continue
   if(/\b(pagamento (aprovado|confirmado|recebido)|matr[ií]cula (confirmada|realizada|conclu[ií]da)|contrato assinado|compra (confirmada|conclu[ií]da)|servi[çc]o contratado)\b/i.test(sentence))return {text:sentence.trim().slice(0,220),at:e.occurred_at}
  }
 }
 return null
}
export function commercialContacts(records:TrackingRecord[],events:ConversationEvent[],outcomes:CommercialOutcome[],settings:ServiceSettings,start:string|null,end:string|null,source='',now=new Date().toISOString(),connectionId=''){
 const grouped=new Map<string,ConversationEvent[]>();for(const e of events){const list=grouped.get(e.contact_id)??[];list.push(e);grouped.set(e.contact_id,list)}
 const results=new Map(outcomes.map(o=>[o.contact_id,o]))
 return firstContacts(records,start,end,source).map(first=>{
  const id=String(first.payload.contact_id||first.payload.sender_id),history=(grouped.get(id)??[]).sort((a,b)=>a.occurred_at.localeCompare(b.occurred_at)||a.event_id.localeCompare(b.event_id)),outcome=results.get(id)
  const incoming=history.filter(e=>e.direction==='incoming'),lastIn=incoming.at(-1)
  const human=history.filter(e=>e.direction==='outgoing'&&e.author_kind==='human').at(-1)?.occurred_at
  const manual=outcome?.status==='contacted'?outcome.updated_at:undefined
  const replied=[human,manual].filter((v):v is string=>!!v).sort().at(-1)
  const waiting=incoming.find(e=>(!replied||e.occurred_at>replied)&&!!settings.capture_ready_at&&e.occurred_at>=settings.capture_ready_at)
  const uncertain=lastIn&&history.some(e=>e.direction==='outgoing'&&e.author_kind==='unknown'&&e.occurred_at>=lastIn.occurred_at)
  let state:ServiceState='answered',minutes=0
  if(outcome?.status==='won'||outcome?.status==='lost')state=outcome.status
  else if(!settings.capture_ready_at||!lastIn||lastIn.occurred_at<settings.capture_ready_at)state='partial'
  else if(uncertain)state='review'
  else if(waiting){minutes=businessMinutes(waiting.occurred_at,now,settings);state=minutes>=settings.target_minutes?'late':'waiting'}
  const identity=[...records].reverse().find(r=>String(r.payload.contact_id||r.payload.sender_id)===id&&r.payload.phone)||first
  return {id,name:String(identity.payload.name||first.payload.name||'Sem nome'),phone:String(identity.payload.phone||''),channel:trackingChannel(first.payload),campaign:campaignName(first.payload,connectionId),firstAt:first.occurred_at,lastIn:lastIn?.occurred_at??first.occurred_at,state,minutes,signal:outcome?.status==='won'||outcome?.status==='lost'?null:saleSignal(history),outcome,history}
 })
}
