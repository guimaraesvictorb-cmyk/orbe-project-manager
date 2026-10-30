import test from 'node:test'
import assert from 'node:assert/strict'
import {firstContacts,trackingChannel,campaignName} from '../src/lib/trackingDashboard.ts'
const row=(id:string,day:string,source:string)=>({entity:'messages',entity_key:id+day,occurred_at:`2026-10-${day}T12:00:00Z`,payload:{contact_id:id,utm_source:source}})
test('first contact is selected before period and source filters, later attribution never replaces it',()=>{
 const rows=[row('a','30','google'),row('a','28',''),row('b','30','linktree')]
 assert.equal(firstContacts(rows,'2026-10-29',null).length,1)
 assert.equal(firstContacts(rows,null,null,'google').length,0)
 assert.equal(firstContacts(rows,null,null,'instagram').length,1)
})
test('channels group Linktree with Instagram and campaign labels never fabricate names',()=>{
 assert.equal(trackingChannel({utm_source:'linktree'}),'Instagram')
 assert.equal(campaignName({utm_campaign:'123'}),'Nome da campanha não disponível')
 assert.equal(campaignName({utm_campaign:'123',campaign_name:'Pesquisa Ibes'}),'Pesquisa Ibes')
})
test('Google campaign names resolve for Rayafit only and retain raw campaign evidence',()=>{
 const connection='1fd22072-6932-4122-941f-cb31c55efd66'
 const payload={utm_source:'google',utm_campaign:'21948614114'}
 assert.equal(campaignName(payload,connection),'[LM]-[V4]-[ONGOING]-[SEARCH]-[LEADS]-[INSTITUCIONAL]')
 assert.equal(campaignName({utm_source:'google',utm_campaign:'23438636831'},connection),'[LM]-[V4]-[VISITA-P-MAX]')
 assert.equal(campaignName(payload,'other-client'),'Nome da campanha não disponível')
 assert.equal(campaignName({...payload,utm_source:'meta'},connection),'Nome da campanha não disponível')
 assert.equal(payload.utm_campaign,'21948614114')
})
