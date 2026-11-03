import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){return n(s.startsWith('.')&&s.endsWith('.js')&&c.parentURL?.includes('/api/')?s.replace(/\.js$/,'.ts'):s,c)}});
const {default:handler}=await import('../api/whatsapp-qr.ts');
const client='14d33095-9db2-4f7f-b667-10110c52c919',connection='c9503338-e251-42ee-8dfa-c0378fab7410';
test('QR disconnect is scoped, stops capture, blocks stale open and clears the old binding only after worker acknowledgement',async()=>{
 const original={fetch:globalThis.fetch,url:process.env.VITE_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};
 process.env.VITE_SUPABASE_URL='https://storage.test';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-key';
 const writes:{url:string;body:Record<string,unknown>}[]=[];
 const session={connection_id:connection,request_id:'first-request',status:'open',verified_at:'2026-11-03T10:00:00Z',worker_seen_at:new Date().toISOString(),worker_id:'test-worker',expires_at:null};
 const conn={id:connection,client_id:client,destination:'5511999999999',provider:'evolution',instance:'orbe-qr-test',enabled:true,capture_mode:'client',allowed_senders:[]};
 globalThis.fetch=async(input,init)=>{
  const url=String(input),body=init?.body?JSON.parse(String(init.body)):null;
  let value:unknown;
  if(init?.method==='PATCH'){
   writes.push({url,body});if(url.includes('/wa_qr_sessions?'))Object.assign(session,body);
   value=url.includes('/wa_qr_sessions?')?[{...session}]:[];
  }else if(url.includes('/auth/v1/user'))value={id:'owner'};
  else if(url.includes('/profiles?'))value=[{role:'admin',is_active:true}];
  else if(url.includes('/clients?'))value=[{id:client}];
  else if(url.includes('/client_assignments?'))value=[];
  else if(url.includes('/rpc/wa_qr_prepare'))value=connection;
  else if(url.includes('/wa_tracking_connections?'))value=[conn];
  else if(url.includes('/wa_tracking_setups?'))value=[{traffic_active:true,destination:conn.destination,connection_method:'qr'}];
  else if(url.includes('/wa_qr_workers?'))value=[{id:'test-worker'}];
  else if(url.includes('/wa_qr_sessions?'))value=[{...session}];
  else throw new Error('unexpected request');
  return new Response(JSON.stringify(value),{status:200});
 };
 async function call(body:unknown,worker=false){const res={statusCode:0,body:'',setHeader(){},end(v:string){this.body=v}};await handler({method:'POST',headers:{origin:'https://studio.agenciaorbe.co','content-type':'application/json',authorization:'Bearer '+(worker?'a'.repeat(43):'synthetic.jwt')},body} as never,res as never);return res;}
 try{
  assert.equal((await call({action:'disconnect',client_id:client})).statusCode,200);
  assert.equal(session.status,'disconnecting');assert.equal(session.verified_at,'2026-11-03T10:00:00Z');
  assert.ok(writes.some(w=>w.url.includes('wa_tracking_connections?id=eq.'+connection)&&w.body.enabled===false));
  assert.equal((await call({action:'generate',client_id:client})).statusCode,409);
  assert.equal((await call({action:'worker_state',connection_id:connection,request_id:session.request_id,status:'open',number:conn.destination},true)).statusCode,409);
  assert.equal((await call({action:'worker_state',connection_id:connection,request_id:session.request_id,status:'close'},true)).statusCode,200);
  assert.equal(session.verified_at,null);assert.equal(session.status,'close');
  session.worker_seen_at='2020-01-01T00:00:00Z';
  assert.equal((await call({action:'disconnect',client_id:client})).statusCode,503);
 }finally{
  globalThis.fetch=original.fetch;
  if(original.url===undefined)delete process.env.VITE_SUPABASE_URL;else process.env.VITE_SUPABASE_URL=original.url;
  if(original.key===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=original.key;
 }
});
