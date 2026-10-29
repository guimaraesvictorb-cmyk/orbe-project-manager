import type { TrackingRecord } from './whatsappTracking'

// Context is deliberately separate from the source of this message: a previous
// acquisition does not prove that a returning contact clicked the same ad again.
export function previousContactOrigin(message:TrackingRecord,evidence:TrackingRecord[]) {
  if(message.entity!=='messages'||message.payload.source_status==='Identificada'||!message.payload.contact_id)return null
  const at=Date.parse(message.occurred_at)
  if(!Number.isFinite(at))return null
  return evidence.filter(row=>row.entity==='messages'&&row.entity_key!==message.entity_key&&
    row.payload.contact_id===message.payload.contact_id&&row.payload.source_status==='Identificada'&&
    Number.isFinite(Date.parse(row.occurred_at))&&Date.parse(row.occurred_at)<=at)
    .sort((a,b)=>Date.parse(b.occurred_at)-Date.parse(a.occurred_at)||b.entity_key.localeCompare(a.entity_key))[0]??null
}
