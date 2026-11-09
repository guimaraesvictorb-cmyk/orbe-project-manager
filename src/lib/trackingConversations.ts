import type { TrackingRecord } from './whatsappTracking.ts'
export function groupConversations(records:TrackingRecord[]) {
 const groups=new Map<string,{id:string;name:string;phone:string;messages:TrackingRecord[];last:TrackingRecord}>()
 for(const row of records){const p=row.payload,id=String(p.contact_id||p.sender_id||p.phone||row.entity_key);let c=groups.get(id);if(!c){c={id,name:String(p.name||p.phone||'Sem nome'),phone:String(p.phone||''),messages:[],last:row};groups.set(id,c)}if(!c.messages.some(m=>m.entity_key===row.entity_key))c.messages.push(row);if(row.occurred_at>c.last.occurred_at)c.last=row;if(p.name)c.name=String(p.name)}
 return [...groups.values()].map(c=>({...c,messages:c.messages.sort((a,b)=>a.occurred_at.localeCompare(b.occurred_at)||a.entity_key.localeCompare(b.entity_key))})).sort((a,b)=>b.last.occurred_at.localeCompare(a.last.occurred_at)||a.id.localeCompare(b.id))
}

export type ConversationEvent = { contact_id: string; event_id: string; direction: string; author_name: string; message_text: string; occurred_at: string }
export type ConversationContext = { attendant_name: string; attendant_description: string; contacts: Record<string,{ role: string; evidence: string }> }
export type OriginKind = 'google'|'meta'|'site'|'test'|'other'|'unknown'
export function cleanConversationText(value: unknown) {
 return String(value||'').replace(/\u200B|\u200C|\u2060|\u2063|[\uFE00-\uFE0F]/gu,'').replace(/\s+/g,' ').trim()
}
export function originKind(payload: TrackingRecord['payload']): OriginKind {
 const source=String(payload.utm_source||'').trim().toLowerCase()
 if(/^(orbe_teste|orbe_test|qa|teste|test)$/.test(source))return 'test'
 if(/^(google|googleads|google_ads|adwords)$/.test(source))return 'google'
 if(/^(meta|facebook|instagram|fb|ig|facebook_ads|instagram_ads|meta_ads)$/.test(source))return 'meta'
 if(!source&&payload.gclid&&!payload.fbclid)return 'google'
 if(!source&&payload.fbclid&&!payload.gclid)return 'meta'
 if(/^(site|website|lk_site)$/.test(source))return 'site'
 return source?'other':'unknown'
}
export function conversationOrigins(messages: TrackingRecord[],evidence: TrackingRecord[]=[]) {
 const confirmed=messages.filter(r=>r.payload.source_status==='Identificada')
 const id=messages[0]?.payload.contact_id
 const latest=messages.reduce((a,r)=>r.occurred_at>a?r.occurred_at:a,'')
 // Earlier acquisitions remain explicitly historical; never attach a future click.
 const historical=confirmed.length?[]:evidence.filter(r=>id&&r.payload.contact_id===id&&r.payload.source_status==='Identificada'&&r.occurred_at<=latest)
 const rows=confirmed.length?confirmed:historical
 return {historical:!confirmed.length&&!!historical.length,rows:[...new Map(rows.map(r=>[[originKind(r.payload),r.payload.utm_source,r.payload.utm_campaign,r.payload.utm_content].join('|'),r])).values()]}
}
const topics:[string,RegExp][]=[
 ['faturamento e cobranças',/\b(faturamento|fatura|boleto|vencimento|vencimentos|cobrança|cobranças|nota fiscal|notas fiscais)\b/iu],
 ['óleo e lubrificantes',/\b(óleo|oleo|lubrificante|lubrificantes)\b/iu],
 ['peças e manutenção',/\b(peça|peças|pastilha|pastilhas|freio|freios|motor|suspensão|câmbio|revisão)\b/iu],
 ['vistoria e seguro',/\b(vistoria|sinistro|seguro|seguradora)\b/iu],
 ['agendamento',/\b(agendar|agendado|agendada|agendamento|horário|horarios)\b/iu],
 ['orçamento',/\b(orçamento|orcamento|cotação|cotacao)\b/iu],
 ['localização da oficina',/\b(endereço|endereco|localização|localizacao)\b/iu],
]
export function conversationBrief(texts: string[]) {
 const cleaned=texts.map(cleanConversationText).filter(Boolean)
 const found=topics.filter(([,pattern])=>cleaned.some(text=>pattern.test(text))).slice(0,3)
 const meaningful=cleaned.filter(t=>t.length>=24&&!/^(bom dia|boa tarde|boa noite|olá|ola|oi|obrigad[oa]|ok|perfeito|tudo bem)[!?.\s]*$/iu.test(t))
 const quote=meaningful.at(-1)||cleaned.at(-1)||''
 return {summary:found.length?`Conversa sobre ${found.map(([label])=>label).join(', ')}.`:quote?'Conversa sem tema específico identificado.':'Sem texto disponível para resumir.',quote:quote.length>180?`${quote.slice(0,177)}…`:quote}
}
