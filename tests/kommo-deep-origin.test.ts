import test from 'node:test'
import assert from 'node:assert/strict'
import {registerHooks} from 'node:module'
import {contactChannel,recoveredContactOrigin} from '../src/lib/originReview.ts'
registerHooks({resolve(s,c,n){return n(c.parentURL?.includes('/api/')&&s.endsWith('.js')?s.replace(/\.js$/,'.ts'):s,c)}})
const {deepReviewOrigins,noteOriginHints,recordedOriginLabel}=await import('../api/_lib/kommoDeepOrigin.ts')
const {seal}=await import('../api/_lib/kommo.ts')
test('historical origins remove only evidenced contacts from unknowns without altering message attribution',()=>{
 const rows=Array.from({length:49},(_,i)=>({entity:'messages',entity_key:String(i),occurred_at:'2026-11-03T10:00:00Z',payload:{contact_id:String(i),source_status:'Não identificada',origin_review_status:i<37?'historical':'missing',crm_lead_created_at:'2026-09-01T10:00:00Z',crm_origin_utm_source:i<20?'meta':'',crm_origin_utm_campaign:i<20?'old_campaign':''}}));
 const before=JSON.stringify(rows);assert.equal(rows.filter(r=>recoveredContactOrigin(r)).length,20);assert.equal(rows.filter(r=>!recoveredContactOrigin(r)).length,29);assert.equal(JSON.stringify(rows),before);
 const row=rows[0];assert.equal(recoveredContactOrigin({...row,payload:{...row.payload,source_status:'Identificada',utm_source:'google'}}),null);assert.equal(recoveredContactOrigin({...row,payload:{...row.payload,crm_lead_created_at:'2026-11-04T10:00:00Z'}}),null);
 assert.equal(recoveredContactOrigin({...rows[30],payload:{...rows[30].payload,origin_deep_status:'historical_evidence',crm_contact_origin_created_at:'2026-01-01T10:00:00Z',crm_contact_origin_utm_source:'google'}})?.utm_source,'google');
});
test('deep review binds contact, all related leads and notes before a revision-guarded write',async()=>{
 const oldFetch=globalThis.fetch,env={...process.env};process.env.VITE_SUPABASE_URL='https://db.example.test';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic';process.env.KOMMO_ENCRYPTION_KEY='a'.repeat(64);
 const cfg={client_id:'client',connection_id:'connection',account_id:'456',account_origin:'https://example.kommo.com',token_ciphertext:seal('PRIVATE_TOKEN','client'),webhook_ciphertext:'unused',enabled:true};
 let wrong=false,writes=0;const noteReads:string[]=[];
 globalThis.fetch=async(url,init)=>{
  const u=new URL(String(url));
  if(u.origin==='https://db.example.test'){
   if(u.pathname.endsWith('wa_kommo_service_returns'))return new Response('0');
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
test('explicit CRM origin fields remain labels and ambiguous or generic channels are not invented origins',()=>{
 const field=(value:unknown)=>({field_name:'Como nos conheceu?',values:[{value}]});
 assert.equal(recordedOriginLabel([field('Indicação')]),'Indicação');
 for(const value of ['WhatsApp','Import','Outros','Não sei','Não identificado','{{source}}',123])assert.equal(recordedOriginLabel([field(value)]),'');
 assert.equal(recordedOriginLabel([field('Google'),field('Indicação')]),'');
 assert.equal(recordedOriginLabel([{field_name:'Nome',values:[{value:'Meta'}]}]),'');
});
test('a recorded service return requires the exact reply and a preceding invitation within thirty minutes',()=>{
 const row={entity:'messages',entity_key:'one',occurred_at:'2026-11-03T16:00:00Z',payload:{source_status:'Não identificada',text:'Continuar',origin_return_kind:'service_resumption',origin_return_event_id:'verified-event',origin_return_sent_at:'2026-11-03T15:38:00Z'}};
 assert.equal(recoveredContactOrigin(row)?.recorded_source_label,'Retomada de atendimento');
 assert.equal(recoveredContactOrigin({...row,payload:{...row.payload,text:'Olá'}}),null);
 assert.equal(recoveredContactOrigin({...row,payload:{...row.payload,origin_return_sent_at:'2026-11-03T15:00:00Z'}}),null);
 assert.equal(recoveredContactOrigin({...row,payload:{...row.payload,origin_return_sent_at:'2026-11-03T16:01:00Z'}}),null);
});
test('CRM origins join the four real channels; generic classifications never imply a website or ad platform',()=>{
 const make=(source:string)=>({entity:'messages',entity_key:'one',occurred_at:'2026-11-03T16:00:00Z',payload:{source_status:'Não identificada',origin_deep_status:'historical_evidence',crm_contact_origin_created_at:'2026-09-01T00:00:00Z',crm_contact_origin_label:source}});
 assert.equal(contactChannel(make('Meta')),'Meta');assert.equal(contactChannel(make('Instagram')),'Instagram');assert.equal(contactChannel(make('Google Ads')),'Google');assert.equal(contactChannel(make('Site')),'Site');
 for(const source of ['Orgânico','Reativação','Evento','Prospecção ativa','Retomada de atendimento'])assert.equal(contactChannel(make(source)),'Origem não identificada');
 const old={...make(''),payload:{source_status:'Não identificada',origin_review_status:'historical',crm_lead_created_at:'2026-09-01T00:00:00Z',crm_origin_utm_source:'meta'}};
 assert.equal(contactChannel(old),'Meta');assert.equal(contactChannel({...old,payload:{...old.payload,utm_source:'google',source_status:'Identificada'}}),'Google');
 const originals=[...Array.from({length:20},()=>old),...Array.from({length:7},()=>make('Meta')),...Array.from({length:4},()=>make('Instagram')),...Array.from({length:18},()=>make('Orgânico'))];
 const before=JSON.stringify(originals),counts=new Map<string,number>();for(const r of originals){const c=contactChannel(r);counts.set(c,(counts.get(c)??0)+1)}assert.equal(counts.get('Meta'),27);assert.equal(counts.get('Instagram'),4);assert.equal(counts.get('Origem não identificada'),18);assert.equal(JSON.stringify(originals),before);
});
const {declaredChannel,reviewChannelHistory}=await import('../api/_lib/kommoChannelHistory.ts');
test('specific contact declarations identify channels without guessing from generic ad or service replies',()=>{
 for(const [text,channel] of [['Olá, vim do site da Rayafit. Meu nome é João.','Site'],['Vim pelo Google','Google'],['Olá! Vim pelo anúncio do Instagram','Instagram']])assert.equal(declaredChannel(text),channel);
 for(const text of ['Continuar','Vi o anúncio','Não vim do Google','Você veio pelo Instagram?','Instagram: siga nossa página','Vim por indicação'])assert.equal(declaredChannel(text),'Origem não identificada');
 const row={entity:'messages',entity_key:'one',occurred_at:'2026-11-03T16:00:00Z',payload:{origin_history_status:'channel_found',origin_history_channel:'Site',origin_history_evidence_id:'one',origin_history_evidence_at:'2026-11-03T16:00:00Z'}};
 assert.equal(contactChannel(row),'Site');assert.equal(contactChannel({...row,payload:{...row.payload,origin_history_evidence_at:'2026-11-04T16:00:00Z'}}),'Origem não identificada');assert.equal(contactChannel({...row,payload:{...row.payload,utm_source:'google'}}),'Google');
});
test('channel history uses scoped events and reports denied message access without inventing UTMs',async()=>{
 const oldFetch=globalThis.fetch,env={...process.env};process.env.VITE_SUPABASE_URL='https://db.example.test';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic';process.env.KOMMO_ENCRYPTION_KEY='a'.repeat(64);
 const cfg={client_id:'client',connection_id:'connection',account_id:'456',account_origin:'https://example.kommo.com',token_ciphertext:seal('PRIVATE_TOKEN','client'),webhook_ciphertext:'unused',enabled:true};
 let wrong=false,writes=0;
 globalThis.fetch=async(url,init)=>{
  const u=new URL(String(url));
  if(u.origin==='https://db.example.test'){
   if(u.pathname.endsWith('wa_kommo_channel_candidates'))return new Response(JSON.stringify([{entity_key:'message',revision:7,occurred_at:'2026-11-03T10:00:00Z',payload:{kommo_contact_id:'123',kommo_lead_id:'987',text:'Continuar',source_status:'Não identificada'}}]));
   assert.equal(init?.method,'PATCH');assert.equal(u.searchParams.get('connection_id'),'eq.connection');assert.equal(u.searchParams.get('revision'),'eq.7');writes++;
   const body=JSON.parse(String(init.body));assert.equal(body.payload.origin_history_channel,'Google');assert.equal(body.payload.origin_history_messages_access,'permission_required');assert.equal(body.payload.origin_history_events_checked,2);assert.equal(body.payload.utm_source,undefined);assert.equal(JSON.stringify(body).includes('PRIVATE'),false);return new Response('[{}]');
  }
  assert.equal(u.origin,'https://example.kommo.com');assert.equal(init?.method,undefined);
  if(u.pathname.endsWith('/custom_fields'))return new Response(JSON.stringify({_embedded:{custom_fields:[{id:55,name:'Origem'}]}}));
  if(u.pathname==='/api/v4/contacts/123')return new Response(JSON.stringify({id:123,account_id:wrong?999:456}));
  if(u.pathname==='/api/v4/leads/987')return new Response(JSON.stringify({id:987,account_id:456,_embedded:{contacts:[{id:123}]}}));
  if(u.pathname==='/api/v4/events')return new Response(JSON.stringify({_embedded:{events:[{id:'event',account_id:456,entity_id:Number(u.searchParams.get('filter[entity_id]')),entity_type:u.searchParams.get('filter[entity]'),type:'custom_field_value_changed',created_at:1735689600,value_after:[{custom_field_value:{field_id:55,text:'Google'}}]}]}}));
  if(u.pathname==='/api/v4/talks')return new Response(JSON.stringify({_embedded:{talks:[{talk_id:12,account_id:456,contact_id:123,chat_id:'chat',created_at:1735689600}]}}));
  assert.equal(u.pathname,'/api/v4/talks/12/messages');return new Response('{}',{status:403});
 };
 try{const r=await reviewChannelHistory(cfg,null,null);assert.equal(r.reviewed,1);assert.equal(r.recovered,1);assert.equal(writes,1);wrong=true;assert.equal((await reviewChannelHistory(cfg,null,null)).failed,1);assert.equal(writes,1)}finally{globalThis.fetch=oldFetch;for(const key of ['VITE_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','KOMMO_ENCRYPTION_KEY']){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key]}}
});
