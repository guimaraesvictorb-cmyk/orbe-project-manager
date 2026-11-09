import {test} from 'node:test'
import assert from 'node:assert/strict'
import {groupConversations} from '../src/lib/trackingConversations.ts'
const row=(id:string,contact:string,at:string)=>({entity:'messages',entity_key:id,occurred_at:at,payload:{contact_id:contact,name:'Mesmo nome',text:id}})
test('one thread per identity regardless of order, duplicate delivery or shared name',()=>{const rows=[row('b','1','2026-11-09T11:00:00Z'),row('a','1','2026-11-08T11:00:00Z'),row('c','2','2026-11-09T12:00:00Z'),row('b','1','2026-11-09T11:00:00Z')];const grouped=groupConversations(rows);assert.equal(grouped.length,2);assert.equal(grouped[0].id,'2');assert.deepEqual(grouped[1].messages.map(m=>m.entity_key),['a','b']);assert.equal(grouped[1].last.entity_key,'b')})
test('missing identities do not merge unrelated people',()=>{const records=['a','b'].map(entity_key=>({entity:'messages',entity_key,occurred_at:'2026-11-09',payload:{text:'oi'}}));assert.equal(groupConversations(records).length,2)})
