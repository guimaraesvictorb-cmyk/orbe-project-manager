import test from 'node:test'
import assert from 'node:assert/strict'
import {registerHooks} from 'node:module'
registerHooks({resolve(s,c,n){return n(c.parentURL?.includes('/api/')&&s.endsWith('.js')?s.replace(/\.js$/,'.ts'):s,c)}})
const {reviewOrigins}=await import('../api/_lib/kommoOriginReview.ts')
const {seal}=await import('../api/_lib/kommo.ts')
test('origin review reads only bound leads, caps batches, deduplicates and never returns credentials',async()=>{
 const beforeFetch=globalThis.fetch,beforeEnv={...process.env};process.env.KOMMO_ENCRYPTION_KEY='a'.repeat(64);process.env.VITE_SUPABASE_URL='https://db.example.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-service';
 const cfg={connection_id:'conn',client_id:'client',account_id:'456',account_origin:'https://example.kommo.com',token_ciphertext:seal('PRIVATE_CRM_TOKEN','client'),webhook_ciphertext:'unused',enabled:true};
 let reads=0,writes=0;
 globalThis.fetch=async(url,init)=>{
  const u=new URL(String(url)),body=init?.body?JSON.parse(String(init.body)):{};
  if(u.origin==='https://example.kommo.com'){
   reads++;assert.equal(u.pathname,'/api/v4/leads/987');assert.equal(u.search,'?with=contacts,source');assert.equal(init?.method,undefined);
   return new Response(JSON.stringify({account_id:456,id:987,created_at:1793225805,_embedded:{contacts:[{id:123}]},custom_fields_values:[{field_code:'UTM_SOURCE',values:[{value:'google'}]}],name:'PRIVATE_NAME'}));
  }
  assert.equal(u.origin,'https://db.example.test');
  if(u.pathname.endsWith('/wa_kommo_origin_candidates'))return new Response(JSON.stringify(Array.from({length:6},(_,i)=>({entity_key:String(i),occurred_at:'2026-11-03T10:00:00Z',payload:{kommo_lead_id:'987',kommo_contact_id:i===4?'999':'123'}}))));
  assert.ok(u.pathname.endsWith('/wa_kommo_review_origin'));writes++;assert.equal(body.p_account,'456');assert.equal(body.p_connection,'conn');assert.equal(body.p_contact,'123');assert.deepEqual(body.p_fields,{utm_source:'google',_crm_entry_channel:''});assert.equal(JSON.stringify(body).includes('PRIVATE_'),false);
  return new Response(JSON.stringify('historical'));
 };
 try{const result=await reviewOrigins(cfg,'2026-11-01T03:00:00Z','2026-11-05T03:00:00Z');assert.equal(reads,1);assert.equal(writes,4);assert.deepEqual(result,{reviewed:4,recovered:0,historical:4,missing:0,failed:1,has_more:true});assert.equal(JSON.stringify(result).includes('PRIVATE_'),false)}finally{globalThis.fetch=beforeFetch;for(const key of ['KOMMO_ENCRYPTION_KEY','VITE_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY']){if(beforeEnv[key]===undefined)delete process.env[key];else process.env[key]=beforeEnv[key]}}
})
test('failed CRM reads never write an invented or guessed source',async()=>{
 const beforeFetch=globalThis.fetch,beforeEnv={...process.env};process.env.KOMMO_ENCRYPTION_KEY='a'.repeat(64);process.env.VITE_SUPABASE_URL='https://db.example.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-service';
 let writes=0;globalThis.fetch=async(url)=>{const u=new URL(String(url));if(u.origin==='https://example.kommo.com')return new Response('{}',{status:403});if(u.pathname.endsWith('/wa_kommo_origin_candidates'))return new Response(JSON.stringify([{entity_key:'one',payload:{kommo_lead_id:'987',kommo_contact_id:'123'}}]));writes++;return new Response('{}')};
 try{const r=await reviewOrigins({connection_id:'conn',client_id:'client',account_id:'456',account_origin:'https://example.kommo.com',token_ciphertext:seal('PRIVATE','client'),webhook_ciphertext:'unused',enabled:true});assert.equal(r.failed,1);assert.equal(r.reviewed,0);assert.equal(writes,0)}finally{globalThis.fetch=beforeFetch;for(const key of ['KOMMO_ENCRYPTION_KEY','VITE_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY']){if(beforeEnv[key]===undefined)delete process.env[key];else process.env[key]=beforeEnv[key]}}
})
