import test from 'node:test'
import assert from 'node:assert/strict'
import {registerHooks} from 'node:module'
import {historicalContactOrigin} from '../src/lib/originReview.ts'
registerHooks({resolve(s,c,n){return n(c.parentURL?.includes('/api/')&&s.endsWith('.js')?s.replace(/\.js$/,'.ts'):s,c)}})
const {deepReviewOrigins,noteOriginHints}=await import('../api/_lib/kommoDeepOrigin.ts')
const {seal}=await import('../api/_lib/kommo.ts')
test('historical origins remove only evidenced contacts from unknowns without altering message attribution',()=>{
 const rows=Array.from({length:49},(_,i)=>({entity:'messages',entity_key:String(i),occurred_at:'2026-11-03T10:00:00Z',payload:{contact_id:String(i),source_status:'Não identificada',origin_review_status:i<37?'historical':'missing',crm_lead_created_at:'2026-09-01T10:00:00Z',crm_origin_utm_source:i<20?'meta':'',crm_origin_utm_campaign:i<20?'old_campaign':''}}));
 const before=JSON.stringify(rows);assert.equal(rows.filter(r=>historicalContactOrigin(r)).length,20);assert.equal(rows.filter(r=>!historicalContactOrigin(r)).length,29);assert.equal(JSON.stringify(rows),before);
 const row=rows[0];assert.equal(historicalContactOrigin({...row,payload:{...row.payload,source_status:'Identificada',utm_source:'google'}}),null);assert.equal(historicalContactOrigin({...row,payload:{...row.payload,crm_lead_created_at:'2026-11-04T10:00:00Z'}}),null);
 assert.equal(historicalContactOrigin({...rows[30],payload:{...rows[30].payload,origin_deep_status:'historical_evidence',crm_contact_origin_created_at:'2026-01-01T10:00:00Z',crm_contact_origin_utm_source:'google'}})?.utm_source,'google');
});
test('deep review binds contact, all related leads and notes before a revision-guarded write',async()=>{
 const oldFetch=globalThis.fetch,env={...process.env};process.env.VITE_SUPABASE_URL='https://db.example.test';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic';process.env.KOMMO_ENCRYPTION_KEY='a'.repeat(64);
 const cfg={client_id:'client',connection_id:'connection',account_id:'456',account_origin:'https://example.kommo.com',token_ciphertext:seal('PRIVATE_TOKEN','client'),webhook_ciphertext:'unused',enabled:true};
 let wrong=false,writes=0;const noteReads:string[]=[];
 globalThis.fetch=async(url,init)=>{
  const u=new URL(String(url));
  if(u.origin==='https://db.example.test'){
   if(u.pathname.endsWith('wa_kommo_deep_origin_candidates'))return new Response(JSON.stringify([{entity_key:'message',revision:7,occurred_at:'2026-11-03T10:00:00Z',payload:{kommo_contact_id:'123',kommo_lead_id:'987',source_status:'Não identificada'}}]));
   assert.equal(init?.method,'PATCH');assert.equal(u.searchParams.get('connection_id'),'eq.connection');assert.equal(u.searchParams.get('revision'),'eq.7');writes++;const body=JSON.parse(String(init.body));assert.equal(body.payload.crm_contact_origin_utm_source,'google');assert.equal(body.payload.source_status,'Não identificada');assert.equal(body.payload.utm_source,undefined);assert.equal(body.payload.origin_deep_notes_checked,3);assert.equal(body.payload.origin_deep_note_hints,1);assert.equal(JSON.stringify(body).includes('PRIVATE'),false);return new Response('[{}]');
  }
  assert.equal(u.origin,'https://example.kommo.com');assert.equal(init?.method,undefined);
  if(u.pathname==='/api/v4/contacts/123')return new Response(JSON.stringify({id:123,account_id:wrong?999:456,created_at:1735689600,custom_fields_values:[],_embedded:{leads:[{id:986},{id:987}]}}));
  if(u.pathname==='/api/v4/leads'){
   assert.deepEqual(new Set(u.searchParams.getAll('filter[id][]')),new Set(['987','986']));return new Response(JSON.stringify({_embedded:{leads:[986,987].map(id=>({id,account_id:456,created_at:1735689600,_embedded:{contacts:[{id:123}]},custom_fields_values:id===986?[{field_code:'UTM_SOURCE',values:[{value:'google'}]}]:[]}))}}));
  }
  assert.match(u.pathname,/\/(leads\/(986|987)|contacts\/123)\/notes$/);noteReads.push(u.pathname);const entity=Number(u.pathname.split('/').at(-2));return new Response(JSON.stringify({_embedded:{notes:[{id:1,account_id:456,entity_id:entity,params:{text:entity===986?'https://example.test/?utm_source=facebook':'PRIVATE_NOTE'}}]}}));
 };
 try{assert.deepEqual(await deepReviewOrigins(cfg,null,null),{reviewed:1,recovered:1,failed:0,has_more:false});assert.equal(writes,1);assert.equal(noteReads.length,3);wrong=true;const result=await deepReviewOrigins(cfg,null,null);assert.equal(result.failed,1);assert.equal(writes,1)}finally{globalThis.fetch=oldFetch;for(const key of ['VITE_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','KOMMO_ENCRYPTION_KEY']){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key]}}
});
test('UTM links in notes stay review hints and cross-account notes are rejected',()=>{
 const notes={_embedded:{notes:[{account_id:456,entity_id:123,params:{text:'https://example.test/?utm_source=meta'}}]}};
 assert.deepEqual(noteOriginHints(notes,'456','123'),{count:1,hints:1});assert.throws(()=>noteOriginHints(notes,'999','123'));assert.throws(()=>noteOriginHints(notes,'456','999'));
});
