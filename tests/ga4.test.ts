import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {analyticsContext, analyticsPayload} from '../api/_lib/ga4.ts';
const now=1793300000000;
const session=String(Math.floor(now/1000)-60);
const allowed=[{measurement_id:'G-W7XWP0QP8Q',site_hostname:'planos.rayafit.com.br'}];
function params(){return new URLSearchParams({ga_measurement_id:allowed[0].measurement_id,ga_client_id:'123.456',ga_session_id:session,ga_consent:'granted'});}
test('GA4 context requires consent, exact configured HTTPS site and recent existing session',()=>{
 assert.ok(analyticsContext(params(),'https://planos.rayafit.com.br/',allowed,now));
 for(const referer of [undefined,'http://planos.rayafit.com.br/','https://planos.rayafit.com.br.evil.test/'])assert.equal(analyticsContext(params(),referer,allowed,now),null);
 for(const [key,value] of [['ga_consent','denied'],['ga_client_id','email@example.com'],['ga_measurement_id','G-OTHER123'],['ga_session_id',String(Number(session)-86400)]]){
  const p=params();p.set(key,value);assert.equal(analyticsContext(p,'https://planos.rayafit.com.br/',allowed,now),null);
 }
});
test('received-message payload excludes CRM identity and rejects stale or impossible evidence',()=>{
 const job={id:'event-1',connection_id:'connection',measurement_id:allowed[0].measurement_id,client_id:'123.456',session_id:session,clicked_at:new Date(now-30000).toISOString(),received_at:new Date(now-10000).toISOString()};
 const payload=analyticsPayload(job,now);
 assert.equal(payload.events[0].name,'whatsapp_message_received');
 assert.equal(payload.events[0].params.event_id,'event-1');
 assert.deepEqual(Object.keys(payload).sort(),['client_id','consent','events','timestamp_micros']);
 assert.throws(()=>analyticsPayload({...job,received_at:new Date(now-40000).toISOString()},now));
 assert.throws(()=>analyticsPayload(job,now+86400000));
 assert.throws(()=>analyticsPayload({...job,client_id:'private@email.test'},now));
});
const source=readFileSync(new URL('../public/rayafit-ga4-bridge.js',import.meta.url),'utf8');
function bridge(hostname='planos.rayafit.com.br') {
 const links=['https://studio.agenciaorbe.co/api/wa-redirect?connection=1fd22072-6932-4122-941f-cb31c55efd66&utm_source=google','https://studio.agenciaorbe.co/api/wa-redirect?connection=other'].map(href=>({href,setAttribute(_key:string,value:string){this.href=value;}}));
 const callbacks:{key:string;callback:(value:string)=>void}[]=[];
 const window:{__orbeGa4Consent?:(granted:boolean)=>void;gtag:(a:string,b:string,key:string,callback:(value:string)=>void)=>void}={gtag(_a,_b,key,callback){callbacks.push({key,callback});}};
 let mutate=()=>{};
 vm.runInNewContext(source,{URL,window,location:{hostname,href:'https://'+hostname+'/'},document:{documentElement:{},querySelectorAll:()=>links},MutationObserver:class{constructor(cb:()=>void){mutate=cb;}observe(){}}});
 return {window,links,callbacks,mutate:()=>mutate(),resolve(){callbacks.forEach(c=>c.callback(c.key==='client_id'?'123.456':session));}};
}
test('bridge only adds existing GA IDs after explicit consent and removes them on withdrawal',()=>{
 const b=bridge();assert.equal(b.callbacks.length,0);
 b.window.__orbeGa4Consent!(true);b.resolve();
 let u=new URL(b.links[0].href);assert.equal(u.searchParams.get('ga_client_id'),'123.456');assert.equal(u.searchParams.get('utm_source'),'google');
 assert.equal(new URL(b.links[1].href).searchParams.get('ga_client_id'),null);
 b.window.__orbeGa4Consent!(false);b.mutate();u=new URL(b.links[0].href);assert.equal(u.searchParams.get('ga_client_id'),null);assert.equal(u.searchParams.get('ga_consent'),null);
});
test('late callbacks cannot restore IDs after consent withdrawal; unrelated sites are ignored',()=>{
 const b=bridge();b.window.__orbeGa4Consent!(true);b.window.__orbeGa4Consent!(false);b.resolve();b.mutate();
 assert.equal(new URL(b.links[0].href).searchParams.get('ga_client_id'),null);
 assert.equal(bridge('other.test').window.__orbeGa4Consent,undefined);
});
