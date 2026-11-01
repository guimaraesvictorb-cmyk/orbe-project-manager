import {test} from 'node:test';import assert from 'node:assert/strict'
import {registerHooks} from 'node:module'
registerHooks({resolve(s,c,n){return n(s==='./trackingDashboard'&&c.parentURL?.endsWith('/commercialTracking.ts')?'./trackingDashboard.ts':s,c)}})
const {businessMinutes,commercialContacts,saleSignal}=await import('../src/lib/commercialTracking.ts')
const settings={weekdays:[1,2,3,4,5],opens:480,closes:1080,target_minutes:15,outbound_started_at:'2026-10-30T11:00:00Z',capture_ready_at:'2026-10-30T11:00:00Z'}
const record={entity:'messages',entity_key:'in',occurred_at:'2026-10-30T12:00:00Z',payload:{contact_id:'a',name:'Lead',utm_source:'google',utm_campaign:'Campanha'}}
const evt=(direction:'incoming'|'outgoing',at:string,author_kind:'external'|'human'|'automatic'|'unknown'='external',text='Olá')=>({event_id:direction+at,contact_id:'a',direction,author_kind,author_name:'',message_text:text,occurred_at:at,captured_at:at})
const evaluate=(events:ReturnType<typeof evt>[],outcomes:Parameters<typeof commercialContacts>[2]=[])=>commercialContacts([record],events,outcomes,settings,null,null,'','2026-10-30T13:00:00Z')[0]
test('business time excludes nights and weekends, includes only intersected minutes',()=>{
 assert.equal(businessMinutes('2026-10-30T20:50:00Z','2026-11-02T11:10:00Z',settings),20)
 assert.equal(businessMinutes('2026-10-31T12:00:00Z','2026-11-01T18:00:00Z',settings),0)
 assert.equal(businessMinutes('2026-10-30T12:00:00Z','2026-10-30T12:15:00Z',settings),15)
})
test('automatic messages never resolve a pending human response; human answers do',()=>{
 const incoming=evt('incoming',record.occurred_at)
 assert.equal(evaluate([incoming,evt('outgoing','2026-10-30T12:01:00Z','automatic')]).state,'late')
 assert.equal(evaluate([incoming,evt('outgoing','2026-10-30T12:02:00Z','human')]).state,'answered')
 assert.equal(evaluate([incoming,evt('outgoing','2026-10-30T12:02:00Z','unknown')]).state,'review')
})
test('new inbound reopens wait and historical incoming cannot imply unanswered',()=>{
 const e=[evt('incoming',record.occurred_at),evt('outgoing','2026-10-30T12:02:00Z','human'),evt('incoming','2026-10-30T12:50:00Z')]
 assert.equal(evaluate(e).state,'waiting');assert.equal(evaluate(e).minutes,10)
 assert.equal(commercialContacts([record],[evt('incoming','2026-10-29T12:00:00Z')],[],settings,null,null)[0].state,'partial')
 assert.equal(commercialContacts([record],e,[],{...settings,capture_ready_at:null},null,null)[0].state,'partial')
})
test('sale signals are suggestions only, with negation and intents excluded',()=>{
 assert.ok(saleSignal([evt('incoming',record.occurred_at,'external','Pagamento confirmado!')]))
 for(const text of ['Vou fechar amanhã','Pagamento não confirmado','Ainda aguardando pagamento confirmado','Se o pagamento aprovado chegar'])assert.equal(saleSignal([evt('incoming',record.occurred_at,'external',text)]),null)
 assert.notEqual(evaluate([evt('incoming',record.occurred_at,'external','Matrícula confirmada!')]).state,'won')
})
test('manual results are attached to one contact and keep original source cohort',()=>{
 const row=evaluate([evt('incoming',record.occurred_at)],[{contact_id:'a',status:'won',updated_by:'user',updated_at:'2026-10-30T12:20:00Z',evidence:'Conferido no CRM'}]);assert.equal(row.state,'won');assert.equal(row.channel,'Google');assert.equal(row.signal,null)
 assert.equal(commercialContacts([record],[],[],settings,'2026-10-31T00:00:00Z',null).length,0)
})

test('a new message never charges historical time from before response collection',()=>{const row=evaluate([evt('incoming','2026-10-29T12:00:00Z'),evt('incoming','2026-10-30T12:55:00Z')]);assert.equal(row.minutes,5);assert.equal(row.state,'waiting')});
