import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
// Vercel emits .js; Node's source-only test runner resolves that one local dependency to .ts.
registerHooks({resolve(specifier,context,next){return next(specifier==='./kommo.js'&&context.parentURL?.endsWith('/api/_lib/evolution.ts')?'./kommo.ts':specifier,context)}});
const {evolutionMessage}=await import('../api/_lib/evolution.ts');
import {embed} from '../api/_lib/kommo.ts';
const instance='orbe-qr-test',ref='A'.repeat(32);
const event=()=>({event:'messages.upsert',instance,apikey:'NEVER_PERSIST',data:{key:{id:'message1',fromMe:false,remoteJid:'5511999999999@s.whatsapp.net'},messageTimestamp:Math.floor(Date.now()/1000),pushName:'Test',message:{conversation:embed('Olá!',ref)}}});
test('keeps reference while stripping marker and credentials',()=>{const m=evolutionMessage(event(),instance);assert.equal(m?.reference,ref);assert.equal(m?.text,'Olá!');assert.equal(m?.phone,'5511999999999');assert.equal(JSON.stringify(m).includes('NEVER_PERSIST'),false)});
test('rejects wrong tenant, outbound messages and unresolved LIDs',()=>{assert.equal(evolutionMessage(event(),'other'),null);const e=event();e.data.key.fromMe=true;assert.equal(evolutionMessage(e,instance),null);e.data.key.fromMe=false;e.data.key.remoteJid='123456789012345@lid';assert.equal(evolutionMessage(e,instance),null)});
test('rejects groups, history, service events, and future timestamps',()=>{const e=event();e.data.key.remoteJid='12345678901@g.us';assert.equal(evolutionMessage(e,instance),null);const h={...event(),data:{...event().data,isHistory:true}};assert.equal(evolutionMessage(h,instance),null);const s={...event(),data:{...event().data,message:{protocolMessage:{}}}};assert.equal(evolutionMessage(s,instance),null);const f=event();f.data.messageTimestamp+=1000;assert.equal(evolutionMessage(f,instance),null)});
