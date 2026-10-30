import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){return next(specifier==='./trackingServer.js'&&context.parentURL?.endsWith('/api/_lib/qrAccess.ts')?'./trackingServer.ts':specifier,context)}});
const {qrAccessAllowed,qrUser}=await import('../api/_lib/qrAccess.ts');
const client='14d33095-9db2-4f7f-b667-10110c52c919',user='f8231746-4c7c-47cb-9ce1-d7ef120ff29f';
test('active assigned staff can operate QR; inactive and unassigned staff cannot',()=>{
 assert.equal(qrAccessAllowed({is_active:true,role:'gt'},true),true);
 assert.equal(qrAccessAllowed({is_active:true,role:'gt'},false),false);
 assert.equal(qrAccessAllowed({is_active:false,role:'gt'},true),false);
 assert.equal(qrAccessAllowed({is_active:true,role:'admin'},false),true);
 assert.equal(qrAccessAllowed(undefined,true),false);
});
test('QR access requires a real session and client visibility, even with assignment',async()=>{
 const original=globalThis.fetch,priorUrl=process.env.VITE_SUPABASE_URL,priorKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 process.env.VITE_SUPABASE_URL='https://storage.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-service';
 let visible=true,assigned=true;const calls:{url:string;authorization:string}[]=[];
 globalThis.fetch=async(input,init)=>{
  const url=String(input);calls.push({url,authorization:String((init?.headers as Record<string,string>).Authorization)});
  const value=url.endsWith('/auth/v1/user')?{id:user}:url.includes('/profiles?')?[{is_active:true,role:'gt'}]:url.includes('/clients?')?(visible?[{id:client}]:[]):url.includes('/client_assignments?')?(assigned?[{user_id:user}]:[]):[];
  return new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
 };
 try{
  const req={headers:{authorization:'Bearer synthetic-session'}};
  assert.equal((await qrUser(req as never,client)).user.id,user);
  assert.ok(calls.some(c=>c.url.includes('/clients?')&&c.authorization==='Bearer synthetic-session'));
  assigned=false;await assert.rejects(()=>qrUser(req as never,client),/forbidden/);
  assigned=true;visible=false;await assert.rejects(()=>qrUser(req as never,client),/forbidden/);
  await assert.rejects(()=>qrUser({headers:{}} as never,client),/unauthorized/);
 }finally{globalThis.fetch=original;if(priorUrl===undefined)delete process.env.VITE_SUPABASE_URL;else process.env.VITE_SUPABASE_URL=priorUrl;if(priorKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=priorKey}
});
