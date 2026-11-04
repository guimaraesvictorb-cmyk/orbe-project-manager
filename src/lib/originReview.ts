// A contact's wording is useful context, but is never promoted to a verified
// click, campaign, platform or UTM by this helper.
export function messageOriginStatement(text:unknown) {
 const value=String(text??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').trim().toLowerCase()
 if(/^(?:ola[!,.\s]*)?vim do site\b/u.test(value))return 'Site, declarado pelo contato; clique e campanha não confirmados.'
 if(/^(?:ola[!,.\s]*)?vi o anuncio\b/u.test(value))return 'Anúncio, declarado pelo contato; plataforma e campanha não confirmadas.'
 return ''
}
import type {TrackingRecord} from './whatsappTracking'
export function recordedChannel(value:unknown) {
 const source=String(value??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim().replace(/[_-]+/gu,' ').replace(/\s+/gu,' ')
 if(['google','google ads','googleads','adwords'].includes(source))return 'Google'
 if(['meta','meta ads','facebook','facebook ads','fb'].includes(source))return 'Meta'
 if(['instagram','instagram ads','insta','ig','linktree'].includes(source))return 'Instagram'
 if(['site','website','site rayafit','site institucional'].includes(source))return 'Site'
 return 'Origem não identificada'
}
// Group by the actual channel, keeping evidence and costs separate. Generic CRM
// labels (organic, reactivation, events) do not identify one of these channels.
export function contactChannel(row:TrackingRecord) {
 const p=row.payload,current=recordedChannel(p.utm_source)
 if(current!=='Origem não identificada')return current
 if(p.gclid)return 'Google'
 if(p.fbclid)return 'Meta'
 const historyAt=Date.parse(String(p.origin_history_evidence_at))
 if(p.origin_history_status==='channel_found'&&p.origin_history_evidence_id&&Number.isFinite(historyAt)&&historyAt<=Date.parse(row.occurred_at)){
  const channel=recordedChannel(p.origin_history_channel)
  if(channel!=='Origem não identificada')return channel
 }
 const history=recoveredContactOrigin(row)
 if(!history||history.origin_return_context)return 'Origem não identificada'
 const historical=recordedChannel(history.utm_source)
 if(historical!=='Origem não identificada')return historical
 if(history.gclid)return 'Google'
 if(history.fbclid)return 'Meta'
 return recordedChannel(history.recorded_source_label)
}
// Display-only evidence. The original message UTMs, click IDs and timestamp
// remain untouched; a historical acquisition never becomes a new click.
export function recoveredContactOrigin(row:TrackingRecord):TrackingRecord['payload']|null {
 const p=row.payload
 if(p.source_status==='Identificada'||p.utm_source||p.gclid||p.fbclid)return null
 if(p.origin_return_kind==='service_resumption'&&p.origin_return_event_id){
  const sent=Date.parse(String(p.origin_return_sent_at)),at=Date.parse(row.occurred_at)
  if(String(p.text).trim().toLowerCase()==='continuar'&&Number.isFinite(sent)&&sent<at&&at-sent<=1800000)return {recorded_source_label:'Retomada de atendimento',origin_return_context:'true'}
 }
 for(const prefix of ['crm_origin_','crm_contact_origin_']){
  if(prefix==='crm_origin_'&&p.origin_review_status!=='historical')continue
  if(prefix==='crm_contact_origin_'&&p.origin_deep_status!=='historical_evidence')continue
  if(!p[prefix+'utm_source']&&!p[prefix+'gclid']&&!p[prefix+'fbclid']&&!p[prefix+'label'])continue
  const created=Date.parse(String(prefix==='crm_origin_'?p.crm_lead_created_at:p.crm_contact_origin_created_at))
  if(!Number.isFinite(created)||created>Date.parse(row.occurred_at))continue
  return {...Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid'].map(key=>[key,p[prefix+key]||''])),recorded_source_label:p[prefix+'label']||''}
 }
 return null
}
