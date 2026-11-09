import {test} from 'node:test'
import assert from 'node:assert/strict'
import {groupConversations,conversationOrigins,originKind,conversationBrief,cleanConversationText} from '../src/lib/trackingConversations.ts'
const row=(id:string,contact:string,at:string)=>({entity:'messages',entity_key:id,occurred_at:at,payload:{contact_id:contact,name:'Mesmo nome',text:id}})
test('one thread per identity regardless of order, duplicate delivery or shared name',()=>{const rows=[row('b','1','2026-11-09T11:00:00Z'),row('a','1','2026-11-08T11:00:00Z'),row('c','2','2026-11-09T12:00:00Z'),row('b','1','2026-11-09T11:00:00Z')];const grouped=groupConversations(rows);assert.equal(grouped.length,2);assert.equal(grouped[0].id,'2');assert.deepEqual(grouped[1].messages.map(m=>m.entity_key),['a','b']);assert.equal(grouped[1].last.entity_key,'b')})
test('missing identities do not merge unrelated people',()=>{const records=['a','b'].map(entity_key=>({entity:'messages',entity_key,occurred_at:'2026-11-09',payload:{text:'oi'}}));assert.equal(groupConversations(records).length,2)})

test('origins require identified messages and do not turn unknown returns into new acquisitions',()=>{
 const m=row('a','1','2026-11-09T11:00:00Z')
 m.payload={...m.payload,utm_source:'google'}
 assert.equal(conversationOrigins([m]).rows.length,0)
 const earlier={...row('b','1','2026-11-08T11:00:00Z'),payload:{contact_id:'1',source_status:'Identificada',utm_source:'meta',utm_campaign:'Black'}}
 const future={...earlier,occurred_at:'2026-11-10T11:00:00Z'}
 const other={...earlier,payload:{...earlier.payload,contact_id:'2'}}
 assert.equal(conversationOrigins([m],[future,other]).rows.length,0)
 const history=conversationOrigins([m],[earlier])
 assert.equal(history.historical,true)
 assert.equal(originKind(history.rows[0].payload),'meta')
 const confirmed={...earlier,occurred_at:m.occurred_at}
 assert.equal(conversationOrigins([confirmed],[earlier]).historical,false)
})
test('test clicks are never presented as paid media even when they include click IDs',()=>{
 assert.equal(originKind({utm_source:'orbe_teste',gclid:'example'}),'test')
 for(const source of ['meta','facebook','fb'])assert.equal(originKind({utm_source:source}),'meta')
 assert.equal(originKind({utm_source:'google'}),'google')
 assert.equal(originKind({utm_source:'site'}),'site')
 assert.equal(originKind({}),'unknown')
})
test('briefs strip tracking markers and do not infer a customer role or a completed sale',()=>{
 const brief=conversationBrief(['Bom dia','Podemos conferir o boleto e o vencimento?','obrigada'])
 assert.equal(brief.summary,'Conversa sobre faturamento e cobranças.')
 assert.equal(brief.quote,'Podemos conferir o boleto e o vencimento?')
 assert.equal(cleanConversationText('s\u200B\u200Cobre\uFE0F'),'sobre')
 assert.equal(conversationBrief(['Bom dia']).summary,'Conversa sem tema específico identificado.')
 assert.equal(conversationBrief([]).summary,'Sem texto disponível para resumir.')
})

test('an oil discussion does not imply that the contact supplies oil',()=>{assert.equal(conversationBrief(['Quero trocar o óleo do carro']).summary,'Conversa sobre óleo e lubrificantes.')})

test('Kommo historical UTMs are displayed as historical without changing native attribution',()=>{
 const m={...row('historical','person','2026-11-09T11:00:00Z'),payload:{contact_id:'person',source_status:'Não identificada',utm_source:'',origin_review_status:'historical',crm_lead_created_at:'2026-10-01T11:00:00Z',crm_origin_utm_source:'google',crm_origin_utm_campaign:'search',crm_origin_utm_medium:'cpc'}}
 const before=JSON.stringify(m);const origin=conversationOrigins([m]);assert.equal(origin.historical,true);assert.equal(origin.rows[0].payload.utm_campaign,'search');assert.equal(originKind(origin.rows[0].payload),'google');assert.equal(JSON.stringify(m),before)
 const invalid={...m,payload:{...m.payload,crm_lead_created_at:'2026-12-01T11:00:00Z'}};assert.equal(conversationOrigins([invalid]).rows.length,0)
})
test('a confirmed conversation-history channel can be shown without fabricating UTMs',()=>{
 const m={...row('h','person','2026-11-09T11:00:00Z'),payload:{contact_id:'person',origin_history_status:'channel_found',origin_history_evidence_id:'event-1',origin_history_evidence_at:'2026-11-01T11:00:00Z',origin_history_channel:'Meta'}}
 const origin=conversationOrigins([m]);assert.equal(origin.historical,true);assert.equal(originKind(origin.rows[0].payload),'meta');assert.equal(origin.rows[0].payload.utm_source,undefined)
})

test('previews describe gym plans without calling an academy a workshop',()=>{const brief=conversationBrief(['Quais os planos da academia? Onde fica o endereço?']);assert.match(brief.summary,/planos e valores/);assert.match(brief.summary,/matrícula e treinos/);assert.doesNotMatch(brief.summary,/oficina/)})
