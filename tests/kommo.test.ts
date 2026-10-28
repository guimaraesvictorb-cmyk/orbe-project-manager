import test from 'node:test'
import assert from 'node:assert/strict'
import {kommoOrigin,parseWebhook,embed,references,visibleText,contactIdentity,seal,unseal,ensureKommoWebhook,leadAttribution} from '../api/_lib/kommo.ts'
const ref='D47162B59539C57FE8585270B0D7A664'
const binding={account:'456',lead:'987',contact:'123',messageAt:'2026-10-28T22:16:45Z'};
const nativeLead=()=>({account_id:456,id:987,created_at:1793225805,_embedded:{contacts:[{id:123}]},custom_fields_values:[{field_code:'UTM_SOURCE',field_name:'utm_source',values:[{value:'ig'}]},{field_code:'UTM_CAMPAIGN',field_name:'utm_campaign',values:[{value:'Rayafit Alecrim'}]}]});
test('native CRM acquisition fields require the exact account, lead, contact and creation window',()=>{
 assert.equal(leadAttribution(nativeLead(),binding)?.fields.utm_source,'ig');
 for(const b of [{...binding,account:'999'},{...binding,contact:'789'},{...binding,lead:'654'},{...binding,messageAt:'2026-10-29T22:16:45Z'}])assert.equal(leadAttribution(nativeLead(),b),null);
 const unlinked=nativeLead();unlinked._embedded.contacts=[];assert.equal(leadAttribution(unlinked,binding),null);
});
test('native attribution rejects unresolved macros and conflicts instead of guessing campaign origin',()=>{
 for(const value of ['{{campaign.name}}','bad\nsource','x'.repeat(257)]){const l=nativeLead();l.custom_fields_values[0].values=[{value}];assert.equal(leadAttribution(l,binding),null)}
 const conflicting=nativeLead();conflicting.custom_fields_values[0].values.push({value:'fb'});assert.equal(leadAttribution(conflicting,binding),null);
 const organic=nativeLead();organic.custom_fields_values=[{field_code:'',field_name:'Fonte',values:[{value:'Orgânico'}]}];assert.equal(leadAttribution(organic,binding),null);
});
test('custom UTM field names and click IDs are accepted without importing arbitrary CRM fields',()=>{
 const l=nativeLead();l.custom_fields_values[0].field_code='';l.custom_fields_values.push({field_code:'',field_name:'fbclid',values:[{value:'abc_DEF-123'}]},{field_code:'',field_name:'private_notes',values:[{value:'do not import'}]});
 const result=leadAttribution(l,binding);assert.equal(result?.fields.fbclid,'abc_DEF-123');assert.equal(result?.fields.private_notes,undefined);
 l.custom_fields_values[2].values[0].value='bad?token';assert.equal(leadAttribution(l,binding),null);
});
test('activation confirms a persisted webhook and reuses it without touching other subscriptions',async()=>{
  const original=globalThis.fetch,destination='https://studio.agenciaorbe.co/api/kommo-webhook?key=test';
  const hook={id:123,destination,disabled:false,settings:['add_message']};
  const unrelated={...hook,id:456,destination:'https://other.example/events'};
  const calls:RequestInit[]=[];
  try{
    globalThis.fetch=async(_url,init)=>{calls.push(init??{});return new Response(JSON.stringify(init?.method==='POST'?{_embedded:{webhooks:[hook]}}:{_embedded:{webhooks:[unrelated,hook]}}),{status:200})};
    assert.equal((await ensureKommoWebhook('https://example.kommo.com','test',destination,{_embedded:{webhooks:[unrelated]}})).id,123);
    assert.equal(calls.length,2);assert.equal(calls[0].method,'POST');assert.equal(calls[1].method,undefined);
    assert.deepEqual(JSON.parse(String(calls[0].body)),{destination,settings:['add_message']});
    calls.length=0;
    assert.equal((await ensureKommoWebhook('https://example.kommo.com','test',destination,{_embedded:{webhooks:[unrelated,hook]}})).id,123);
    assert.equal(calls.length,0);
    globalThis.fetch=async(_url,init)=>new Response(JSON.stringify(init?.method==='POST'?hook:{_embedded:{webhooks:[unrelated]}}),{status:200});
    await assert.rejects(ensureKommoWebhook('https://example.kommo.com','test',destination,null),/webhook_not_confirmed/);
  }finally{globalThis.fetch=original}
})
const message=()=>({id:'test-message-1',contact_id:'123',chat_id:'chat-1',talk_id:'20',entity_type:'lead',entity_id:'987',text:embed('Olá! Quero saber mais.',ref),created_at:String(Math.floor(Date.now()/1000)),message_type:'text',type:'incoming',author:{type:'external'},origin:'whatsapp'})
const nested=()=>({account:{id:'456',subdomain:'example'},message:{add:[message()]}})
function form(input:unknown){const result=new URLSearchParams();function walk(value:unknown,key:string){if(value&&typeof value==='object'){for(const [k,v] of Object.entries(value))walk(v,key?`${key}[${k}]`:k)}else result.append(key,String(value))}walk(input,'');return result.toString()}
test('Kommo credentials only go to an exact HTTPS account origin',()=>{assert.equal(kommoOrigin('https://example.kommo.com/'),'https://example.kommo.com');for(const bad of ['http://example.kommo.com','https://example.kommo.com.evil.test','https://example.kommo.com@evil.test','https://example.kommo.com/path','https://example.kommo.com?token=x','https://localhost','https://example.kommo.com:8443'])assert.throws(()=>kommoOrigin(bad))})
test('flat and structured CRM payloads preserve the original identity and invisible reference',()=>{for(const body of [nested(),form(nested()),Object.fromEntries(new URLSearchParams(form(nested())))]){const result=parseWebhook(body);assert.equal(result.account,'456');assert.equal(result.subdomain,'example');assert.equal(result.messages.length,1);assert.equal(result.messages[0].reference,ref);assert.equal(result.messages[0].text,'Olá! Quero saber mais.');assert.equal(result.messages[0].contact_id,'123')}})
test('outgoing, non-WhatsApp and internal-author events never become captured messages',()=>{for(const change of [{type:'outgoing'},{origin:'instagram'},{origin:'telegram'},{origin:'unknown'},{author:{type:'internal'}}]){const body=nested();Object.assign(body.message.add[0],change);assert.equal(parseWebhook(body).messages.length,0)}})
test('duplicate fields and ambiguous message roots are rejected',()=>{assert.throws(()=>parseWebhook(form(nested())+'&account%5Bid%5D=789'));assert.throws(()=>parseWebhook({...nested(),add:[message()]}))})
test('the parser rejects missing account binding, excessive message text and future timestamps',()=>{const b=nested();b.message.add[0].text='x'.repeat(16001);assert.throws(()=>parseWebhook(b));assert.throws(()=>parseWebhook({message:{add:[message()]}}));const future=nested();future.message.add[0].created_at=String(Math.floor(Date.now()/1000)+600);assert.throws(()=>parseWebhook(future))})
test('a pasted unrelated key or payload does not enter a normalized message',()=>{const b=nested();Object.assign(b.message.add[0],{api_key:'secret',attachment:{url:'https://example.test/private'},phone:'5511999999999'});const result=parseWebhook(b).messages[0];assert.equal('api_key' in result,false);assert.equal('phone' in result,false);assert.equal('attachment' in result,false)})
test('V2 codec keeps natural greetings and detects corruption or conflicting references',()=>{for(const greeting of ['Olá! Quero mais informações.','Olá','Oi 👋 tudo bem?']){const text=embed(greeting,ref);assert.deepEqual(references(text),[ref]);assert.equal(visibleText(text),greeting)}const text=embed('Olá! Tudo bem?',ref).replace(/\uFE02/,'\uFE03');assert.equal(references(text).length,0);const body=nested();body.message.add[0].text+=embed(' Outro', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');assert.equal(parseWebhook(body).messages[0].reference,'')})
test('multiple CRM phone numbers never imply a guessed WhatsApp sender',()=>{const c={name:'Teste',custom_fields_values:[{field_code:'PHONE',values:[{value:'+55 (11) 99999-9999'}]}]};assert.equal(contactIdentity(c).phone,'5511999999999');c.custom_fields_values[0].values.push({value:'+55 27 98888-8888'});assert.equal(contactIdentity(c).phone,'');assert.equal(contactIdentity(c).phone_status,'ambiguous');assert.equal(contactIdentity({name:'Teste'}).phone_status,'missing')})
test('encrypted credentials are bound to the client and reject tampering',()=>{const before=process.env.KOMMO_ENCRYPTION_KEY;process.env.KOMMO_ENCRYPTION_KEY='a'.repeat(64);try{const value=seal('private-token','client-a');assert.equal(value.includes('private-token'),false);assert.equal(unseal(value,'client-a'),'private-token');assert.throws(()=>unseal(value,'client-b'));const parts=value.split('.');parts[2]='B'+parts[2].slice(1);assert.throws(()=>unseal(parts.join('.'),'client-a'))}finally{if(before)process.env.KOMMO_ENCRYPTION_KEY=before;else delete process.env.KOMMO_ENCRYPTION_KEY}})
