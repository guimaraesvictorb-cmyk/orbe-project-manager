import type { TrackingRecord } from './whatsappTracking'
export function trackingChannel(p:TrackingRecord['payload']) {
 const source=String(p.utm_source||'').trim().toLowerCase()
 if(/instagram|linktree/.test(source))return 'Instagram'
 if(/google/.test(source)||p.gclid)return 'Google'
 if(/meta|facebook/.test(source)||p.fbclid)return 'Meta'
 return source||'Origem não identificada'
}
// Names observed in Rayafit's Google Ads table on 2026-10-30.
// Scope by connection: campaign IDs from other clients must never inherit these labels.
const rayafitGoogleCampaigns:Record<string,string>={
 '23438636831':'[LM]-[V4]-[VISITA-P-MAX]',
 '21948614114':'[LM]-[V4]-[ONGOING]-[SEARCH]-[LEADS]-[INSTITUCIONAL]',
 '22600869996':'[SEARCH]-[ONGOING]-[LEADS]-[DOR-NECESSIDADE]',
}
export function campaignName(p:TrackingRecord['payload'],connectionId?:string) {
 const name=String(p.campaign_name||p.utm_campaign_name||p.utm_campaign||'').trim()
 const mapped=connectionId==='1fd22072-6932-4122-941f-cb31c55efd66'&&trackingChannel(p)==='Google'?rayafitGoogleCampaigns[name]:undefined
 if(mapped)return mapped
 return !name?'Campanha não informada':/^\d+$/.test(name)?'Nome da campanha não disponível':name
}
export function firstContacts(records:TrackingRecord[],start:string|null,end:string|null,source='') {
 const first=new Map<string,TrackingRecord>()
 for(const row of [...records].sort((a,b)=>a.occurred_at.localeCompare(b.occurred_at)||a.entity_key.localeCompare(b.entity_key))){
  const id=String(row.payload.contact_id||row.payload.sender_id||'')
  if(id&&!first.has(id))first.set(id,row)
 }
 return [...first.values()].filter(r=>(!start||r.occurred_at>=start)&&(!end||r.occurred_at<end)&&(!source||trackingChannel(r.payload).toLowerCase()===trackingChannel({utm_source:source}).toLowerCase()))
}
