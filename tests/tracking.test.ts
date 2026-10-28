import test from 'node:test'
import assert from 'node:assert/strict'
import {validateBatch} from '../api/_lib/tracking.ts'
import {trackingUrl,syncIsFresh,periodBounds} from '../src/lib/whatsappTracking.ts'
const connection={id:'test',instance:'test',destination:'5511999998888',enabled:true,capture_mode:'pilot',allowed_senders:['5511988887777']}
const record={name:'Teste',phone:'5511988887777',text:'Olá!',received_at:'2026-10-28T14:44:39Z',source_status:'Identificada',instance:'test',contact_id:'ct_test',message_id:'message_1',type:'text',utm_source:'google',utm_medium:'cpc',utm_campaign:'campanha',utm_content:'ola',utm_term:'teste'}
const batch=()=>({version:1,state:'open',events:[{entity:'messages',key:'msg_1',revision:4,record:{...record}}]})
test('preserves all five UTMs and timestamps from a received message',()=>{const result=validateBatch(batch(),connection);assert.equal(result.events[0].occurred_at,record.received_at);for(const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])assert.equal(result.events[0].record[k],record[k]);assert.equal(result.events[0].revision,4)})
test('rejects a sender outside the pilot, even with a valid instance',()=>{const b=batch();b.events[0].record.phone='5511977776666';assert.throws(()=>validateBatch(b,connection),/sender_not_allowed/)})
test('rejects cross-instance data',()=>{const b=batch();b.events[0].record.instance='another-client';assert.throws(()=>validateBatch(b,connection),/wrong_instance/)})
test('unknown origin cannot carry invented attribution',()=>{const b=batch();b.events[0].record.source_status='Não identificada';assert.throws(()=>validateBatch(b,connection),/unproven_utm/)})
test('heartbeat carries no fabricated lead',()=>assert.deepEqual(validateBatch({version:1,state:'unknown',events:[]},connection),{state:'unknown',events:[]}))
test('rejects an overlarge batch and unsafe revision',()=>{const b=batch();b.events=Array(101).fill(b.events[0]);assert.throws(()=>validateBatch(b,connection));const c=batch();c.events[0].revision=Infinity;assert.throws(()=>validateBatch(c,connection))})
test('payload excludes arbitrary credentials and fields',()=>{const b=batch();Object.assign(b.events[0].record,{apiKey:'must-not-store'});assert.equal(validateBatch(b,connection).events[0].record.apiKey,undefined)})
test('preserves supported click IDs without exposing unrelated fields',()=>{const b=batch();Object.assign(b.events[0].record,{gclid:'Google-123',fbclid:'Meta_456'});const r=validateBatch(b,connection).events[0].record;assert.equal(r.gclid,'Google-123');assert.equal(r.fbclid,'Meta_456')})
test('rejects malformed or excessive click IDs',()=>{for(const gclid of ['x'.repeat(1025),'not a valid id']){const b=batch();Object.assign(b.events[0].record,{gclid});assert.throws(()=>validateBatch(b,connection))}})
test('saved URL preserves custom greeting, accents and five UTMs',()=>{const form={greeting:'Olá, quero café & pão!',utm_source:'google',utm_medium:'cpc',utm_campaign:'campanha nova',utm_content:'cabeçalho',utm_term:'café'};const url=new URL(trackingUrl({redirect_url:'https://go.example.com/r'},form));assert.equal(url.searchParams.get('text'),form.greeting);for(const key of Object.keys(form).filter(k=>k!=='greeting'))assert.equal(url.searchParams.get(key),form[key])})
test('rejects a greeting with a pasted tracking marker',()=>assert.throws(()=>trackingUrl({redirect_url:'https://go.example.com/r'},{greeting:'Olá\uFE0C',utm_source:'g',utm_medium:'cpc',utm_campaign:'',utm_content:'',utm_term:''})))
test('old sync cannot appear healthy',()=>{assert.equal(syncIsFresh('2026-10-28T12:00:00Z',Date.parse('2026-10-28T12:04:00Z')),false);assert.equal(syncIsFresh(null),false)})
test('inclusive final day and reversed range',()=>{const b=periodBounds('2026-10-28','2026-10-28');assert.equal(Date.parse(b.end!)-Date.parse(b.start!),86400000);assert.throws(()=>periodBounds('2026-10-29','2026-10-28'))})
