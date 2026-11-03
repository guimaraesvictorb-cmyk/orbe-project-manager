import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){return n(s.startsWith('.')&&s.endsWith('.js')&&c.parentURL?.includes('/api/')?s.replace(/\.js$/,'.ts'):s,c)}});
const {metaCredential,metaMetadata,markMetaVerified,metaAgencyAdmin}=await import('../api/_lib/metaAgency.ts');
const {seal}=await import('../api/_lib/kommo.ts');
const source='589481f6-3a15-4c93-b384-5d33373c20e3',target='14d33095-9db2-4f7f-b667-10110c52c919';
const sourceVersion='2026-11-03T10:00:00+00:00',configVersion='2026-11-03T11:00:00+00:00',linkVersion='2026-11-03T12:00:00+00:00';
const token='synthetic-meta-agency-token';
test('mapped Meta reports use the target account and source-bound secret; disabled and rotated sources fail closed',async()=>{
 const original=process.env.KOMMO_ENCRYPTION_KEY;process.env.KOMMO_ENCRYPTION_KEY='b'.repeat(64);
 try{
  let enabled=true,version=sourceVersion;
  const calls:string[]=[];
  const cipher=seal(JSON.stringify({access_token:token}),`ads:${source}:meta`);
  const db=async(path:string)=>{
   calls.push(path);
   if(path.includes('/orbe_meta_agency?'))return [{source_client_id:source,enabled,updated_at:configVersion}];
   if(path.includes('/orbe_meta_accounts?'))return [{client_id:target,account_id:'987654321',account_name:'Target account',source_version:sourceVersion,configuration_version:configVersion,verified_at:linkVersion,updated_at:linkVersion}];
   if(path.includes('/wa_ads_credentials?')){assert.ok(path.includes('client_id=eq.'+source));return [{account_id:'123456789',ciphertext:cipher,updated_at:version,status:'access_verified',expires_at:null}];}
   throw Error('unexpected path');
  };
  const credential=await metaCredential(db as never,target);
  assert.equal(credential.status,'credentials');if(credential.status!=='credentials')throw Error('missing credential');
  assert.equal(credential.account_id,'987654321');assert.equal(credential.token,token);
  const metadata=await metaMetadata(db as never,target);
  assert.equal(metadata?.status,'access_verified');assert.equal(JSON.stringify(metadata).includes(token),false);assert.equal(JSON.stringify(metadata).includes(cipher),false);
  version='2026-11-03T13:00:00+00:00';
  assert.equal((await metaMetadata(db as never,target))?.status,'saved_unverified');
  await assert.rejects(()=>markMetaVerified(db as never,target,credential),/configuration_changed/);
  enabled=false;assert.deepEqual(await metaCredential(db as never,target),{status:'not_configured'});
 }finally{if(original===undefined)delete process.env.KOMMO_ENCRYPTION_KEY;else process.env.KOMMO_ENCRYPTION_KEY=original;}
});
test('agency mapping requires an active financial admin and a live target-account read before any write',async()=>{
 const original={fetch:globalThis.fetch,url:process.env.VITE_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,crypto:process.env.KOMMO_ENCRYPTION_KEY};
 process.env.VITE_SUPABASE_URL='https://storage.test';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-service';process.env.KOMMO_ENCRYPTION_KEY='b'.repeat(64);
 const cipher=seal(JSON.stringify({access_token:token}),`ads:${source}:meta`);
 let role='gt',financial=true,permission=true;const writes:Record<string,unknown>[]=[];const graph:string[]=[];
 globalThis.fetch=async(input,init)=>{
  const url=String(input);let value:unknown;
  if(url.startsWith('https://graph.facebook.com/')){
   graph.push(url);assert.equal(new Headers(init?.headers).get('authorization'),'Bearer '+token);assert.equal(url.includes(token),false);
   if(!permission)return new Response(JSON.stringify({error:{code:200,message:'private provider diagnostic'}}),{status:403});
   value=url.includes('/campaigns?')?{data:[]}:{account_id:'987654321',name:'Target account'};
  }else if(url.endsWith('/auth/v1/user'))value={id:'actor'};
  else if(url.includes('/profiles?'))value=[{role,is_active:true,can_view_financials:financial}];
  else if(url.includes('/orbe_meta_agency?'))value=[{source_client_id:source,enabled:true,updated_at:configVersion}];
  else if(url.includes('/wa_ads_credentials?'))value=[{client_id:source,account_id:'123456789',ciphertext:cipher,updated_at:sourceVersion}];
  else if(url.includes('/orbe_meta_accounts?'))value=[];
  else if(url.includes('/clients?'))value=[{id:target}];
  else if(url.includes('/rpc/orbe_meta_map')){writes.push(JSON.parse(String(init?.body)));value=null;}
  else throw Error('unexpected path');
  return new Response(JSON.stringify(value),{status:200});
 };
 async function call(){const res={statusCode:0,body:'',setHeader(){},end(value:string){this.body=value;}};await metaAgencyAdmin({headers:{authorization:'Bearer synthetic.jwt'},body:{action:'meta_agency_bind',client_id:target,account_id:'act_987654321',expected_version:configVersion}} as never,res as never);return res;}
 try{
  assert.equal((await call()).statusCode,403);assert.equal(writes.length,0);
  role='admin';financial=false;assert.equal((await call()).statusCode,403);assert.equal(writes.length,0);
  financial=true;permission=false;const denied=await call();assert.equal(denied.statusCode,503);assert.equal(JSON.parse(denied.body).error,'meta_permission_denied');assert.equal(denied.body.includes('private provider'),false);assert.equal(writes.length,0);
  permission=true;const allowed=await call();assert.equal(allowed.statusCode,200);assert.equal(writes.length,1);
  assert.equal(writes[0].p_client,target);assert.equal(writes[0].p_account,'987654321');assert.equal(writes[0].p_source_version,sourceVersion);assert.equal(writes[0].p_expected,configVersion);assert.equal(writes[0].p_link_expected,null);
  assert.ok(graph.some(url=>url.includes('/act_987654321/campaigns?')));assert.equal(allowed.body.includes(token),false);assert.equal(allowed.body.includes(cipher),false);
 }finally{globalThis.fetch=original.fetch;for(const [name,value] of Object.entries({VITE_SUPABASE_URL:original.url,SUPABASE_SERVICE_ROLE_KEY:original.key,KOMMO_ENCRYPTION_KEY:original.crypto})){if(value===undefined)delete process.env[name];else process.env[name]=value;}}
});
