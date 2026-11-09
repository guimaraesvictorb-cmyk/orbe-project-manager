import {contactChannel,recoveredContactOrigin} from './originReview.ts'
import type { TrackingRecord } from './whatsappTracking.ts'
export function groupConversations(records:TrackingRecord[]) {
 const groups=new Map<string,{id:string;name:string;phone:string;messages:TrackingRecord[];last:TrackingRecord}>()
 for(const row of records){const p=row.payload,id=String(p.contact_id||p.sender_id||p.phone||row.entity_key);let c=groups.get(id);if(!c){c={id,name:String(p.name||p.phone||'Sem nome'),phone:String(p.phone||''),messages:[],last:row};groups.set(id,c)}if(!c.messages.some(m=>m.entity_key===row.entity_key))c.messages.push(row);if(row.occurred_at>c.last.occurred_at)c.last=row;if(p.name)c.name=String(p.name)}
 return [...groups.values()].map(c=>({...c,messages:c.messages.sort((a,b)=>a.occurred_at.localeCompare(b.occurred_at)||a.entity_key.localeCompare(b.entity_key))})).sort((a,b)=>b.last.occurred_at.localeCompare(a.last.occurred_at)||a.id.localeCompare(b.id))
}

export type ConversationEvent = { contact_id: string; event_id: string; direction: string; author_name: string; message_text: string; occurred_at: string }
export type ConversationContext = { attendant_name: string; attendant_description: string; contacts: Record<string,{ role: string; evidence: string }> }
export type OriginKind = 'google'|'meta'|'instagram'|'site'|'test'|'other'|'unknown'
export function cleanConversationText(value: unknown) {
 return String(value||'').replace(/\u200B|\u200C|\u2060|\u2063|[\uFE00-\uFE0F]/gu,'').replace(/\s+/g,' ').trim()
}
export function originKind(payload: TrackingRecord['payload']): OriginKind {
 const source=String(payload.utm_source||payload.display_channel||'').trim().toLowerCase()
 if(/^(orbe_teste|orbe_test|qa|teste|test)$/.test(source))return 'test'
 if(/^(google|googleads|google_ads|adwords)$/.test(source))return 'google'
 if(/^(instagram|instagram_ads|ig|insta|linktree)$/.test(source))return 'instagram'
 if(/^(meta|facebook|fb|facebook_ads|meta_ads)$/.test(source))return 'meta'
 if(!source&&payload.gclid&&!payload.fbclid)return 'google'
 if(!source&&payload.fbclid&&!payload.gclid)return 'meta'
 if(/^(site|website|lk_site|site_rayafit|site_institucional)$/.test(source))return 'site'
 return source?'other':'unknown'
}
export function conversationOrigins(messages: TrackingRecord[],evidence: TrackingRecord[]=[]) {
 const confirmed=messages.filter(r=>r.payload.source_status==='Identificada')
 const id=messages[0]?.payload.contact_id
 const latest=messages.reduce((a,r)=>r.occurred_at>a?r.occurred_at:a,'')
 // Earlier acquisitions remain explicitly historical; never attach a future click.
 const historical=confirmed.length?[]:evidence.filter(r=>id&&r.payload.contact_id===id&&r.payload.source_status==='Identificada'&&r.occurred_at<=latest)
 const recovered:TrackingRecord[]=confirmed.length?[]:messages.flatMap(row=>{
  const payload=recoveredContactOrigin(row)
  const historyProof=row.payload.origin_history_status==='channel_found'&&row.payload.origin_history_evidence_id&&Number.isFinite(Date.parse(String(row.payload.origin_history_evidence_at)))&&Date.parse(String(row.payload.origin_history_evidence_at))<=Date.parse(row.occurred_at)
  if((!payload||payload.origin_return_context)&&!historyProof)return []
  const channel=contactChannel(row)
  if(channel==='Origem não identificada')return []
  const at=historyProof?String(row.payload.origin_history_evidence_at):row.payload.origin_review_status==='historical'&&row.payload.crm_origin_utm_source?String(row.payload.crm_lead_created_at):String(row.payload.crm_contact_origin_created_at||row.payload.crm_lead_created_at||row.occurred_at)
  return [{...row,occurred_at:at,entity_key:row.entity_key+':historical',payload:{...payload,display_channel:channel,source_evidence:'Histórico comprovado na Kommo; não é um novo clique',source_status:'Histórica'}}]
 })
 const rows=confirmed.length?confirmed:[...historical,...recovered]
 return {historical:!confirmed.length&&!!rows.length,rows:[...new Map(rows.map(r=>[[originKind(r.payload),r.payload.utm_source,r.payload.utm_campaign,r.payload.utm_content].join('|'),r])).values()]}

}
const topics:[string,RegExp][]=[
 ['planos e valores',/(?<!\p{L})(plano|planos|mensalidade|mensalidades|valor|valores|pagamento|parcelado)(?!\p{L})/iu],
 ['matrícula e treinos',/(?<!\p{L})(matrícula|matricula|treino|treinar|musculação|academia|aulas)(?!\p{L})/iu],
 ['campanha Black Friday',/(?<!\p{L})(black friday|black)(?!\p{L})/iu],
 ['faturamento e cobranças',/(?<!\p{L})(faturamento|fatura|boleto|vencimento|vencimentos|cobrança|cobranças|nota fiscal|notas fiscais)(?!\p{L})/iu],
 ['óleo e lubrificantes',/(?<!\p{L})(óleo|oleo|lubrificante|lubrificantes)(?!\p{L})/iu],
 ['peças e manutenção',/(?<!\p{L})(peça|peças|pastilha|pastilhas|freio|freios|motor|suspensão|câmbio|revisão)(?!\p{L})/iu],
 ['vistoria e seguro',/(?<!\p{L})(vistoria|sinistro|seguro|seguradora)(?!\p{L})/iu],
 ['agendamento',/(?<!\p{L})(agendar|agendado|agendada|agendamento|horário|horarios)(?!\p{L})/iu],
 ['orçamento',/(?<!\p{L})(orçamento|orcamento|cotação|cotacao)(?!\p{L})/iu],
 ['localização e endereço',/(?<!\p{L})(endereço|endereco|localização|localizacao)(?!\p{L})/iu],
]
export function conversationBrief(texts: string[]) {
 const cleaned=texts.map(cleanConversationText).filter(Boolean)
 const found=topics.filter(([,pattern])=>cleaned.some(text=>pattern.test(text))).slice(0,3)
 const meaningful=cleaned.filter(t=>t.length>=24&&!/^(bom dia|boa tarde|boa noite|olá|ola|oi|obrigad[oa]|ok|perfeito|tudo bem)[!?.\s]*$/iu.test(t))
 const quote=meaningful.at(-1)||cleaned.at(-1)||''
 return {summary:found.length?`Conversa sobre ${found.map(([label])=>label).join(', ')}.`:quote?'Conversa sem tema específico identificado.':'Sem texto disponível para resumir.',quote:quote.length>180?`${quote.slice(0,177)}…`:quote}
}

export function contactJourney(messages: TrackingRecord[]) {
 if(messages.some(r=>r.payload.origin_conversation_fully_expanded==='true'&&r.payload.origin_conversation_initiator==='commercial'))return 'Ativação pelo comercial · início da conversa conferido'
 if(messages.some(r=>r.payload.origin_return_kind==='service_resumption'&&r.payload.origin_return_event_id))return 'Retomada de atendimento · convite registrado'
 if(messages.some(r=>r.payload.origin_conversation_fully_expanded==='true'&&r.payload.origin_conversation_initiator==='contact'))return 'Contato iniciou a conversa · histórico conferido'
 return ''
}
