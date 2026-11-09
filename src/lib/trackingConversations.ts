import type { TrackingRecord } from './whatsappTracking.ts'
export function groupConversations(records:TrackingRecord[]) {
 const groups=new Map<string,{id:string;name:string;phone:string;messages:TrackingRecord[];last:TrackingRecord}>()
 for(const row of records){const p=row.payload,id=String(p.contact_id||p.sender_id||p.phone||row.entity_key);let c=groups.get(id);if(!c){c={id,name:String(p.name||p.phone||'Sem nome'),phone:String(p.phone||''),messages:[],last:row};groups.set(id,c)}if(!c.messages.some(m=>m.entity_key===row.entity_key))c.messages.push(row);if(row.occurred_at>c.last.occurred_at)c.last=row;if(p.name)c.name=String(p.name)}
 return [...groups.values()].map(c=>({...c,messages:c.messages.sort((a,b)=>a.occurred_at.localeCompare(b.occurred_at)||a.entity_key.localeCompare(b.entity_key))})).sort((a,b)=>b.last.occurred_at.localeCompare(a.last.occurred_at)||a.id.localeCompare(b.id))
}
