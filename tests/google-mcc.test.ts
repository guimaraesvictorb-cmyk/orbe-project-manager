import test from 'node:test'
import assert from 'node:assert/strict'
import {registerHooks} from 'node:module'
registerHooks({resolve(specifier,context,next){return next(context.parentURL?.includes('/api/')&&specifier.endsWith('.js')?specifier.replace(/\.js$/,'.ts'):specifier,context)}})
const {googleCredential,googleMetadata,markGoogleVerified,googleMccAdmin}=await import('../api/_lib/googleMcc.ts')
const {seal}=await import('../api/_lib/kommo.ts'),{adsBinding}=await import('../api/_lib/adsCredentials.ts')
const source='11111111-1111-4111-8111-111111111111',client='22222222-2222-4222-8222-222222222222'
test('database diagnostics preserve error codes while discarding private provider details',async()=>{
 const {storage}=await import('../api/_lib/trackingServer.ts'),before={fetch:globalThis.fetch,url:process.env.VITE_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};process.env.VITE_SUPABASE_URL='https://synthetic.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='SYNTHETIC_SERVER'
 globalThis.fetch=async()=>new Response(JSON.stringify({code:'PGRST202',message:'SYNTHETIC_PRIVATE_VALUE',details:'SYNTHETIC_CREDENTIAL'}),{status:404})
 try{await assert.rejects(()=>storage()('rest/v1/rpc/synthetic'),error=>{assert.ok(error instanceof Error);assert.equal(error.message,'storage_unavailable');assert.deepEqual(error.cause,{status:404,code:'PGRST202'});assert.equal(JSON.stringify(error).includes('SYNTHETIC'),false);return true})}
 finally{globalThis.fetch=before.fetch;for(const [key,value]of Object.entries({VITE_SUPABASE_URL:before.url,SUPABASE_SERVICE_ROLE_KEY:before.key})){if(value===undefined)delete process.env[key];else process.env[key]=value}}
})
test('MCC resolves exactly the mapped account, invalidates configuration changes and never returns source secrets as metadata',async()=>{
 const old=process.env.KOMMO_ENCRYPTION_KEY;process.env.KOMMO_ENCRYPTION_KEY='a'.repeat(64)
 let enabled=true,present=true,version='configuration-1',ciphertext=seal(JSON.stringify({refresh_token:'SYNTHETIC_REFRESH_TOKEN',manager_id:'1231231231'}),adsBinding(source,'google'))
 const paths:string[]=[],patches:unknown[]=[]
 const db=async(path:string,init?:RequestInit)=>{paths.push(path)
  if(path.includes('/orbe_google_mcc?'))return [{manager_id:'9999999999',credential_client_id:source,enabled,updated_at:version}]
  if(path.includes('/orbe_google_mcc_accounts?')){if(init?.method==='PATCH'){patches.push(JSON.parse(String(init.body)));return []}return [{account_id:'1234567890',client_id:client,present,is_manager:false,updated_at:'mapping-1'}]}
  if(path.includes('/wa_ads_credentials?')){assert.ok(path.includes(`client_id=eq.${source}`));return [{account_id:'9876543210',ciphertext,updated_at:'credential-1',has_refresh_token:true,status:'saved_unverified'}]}
  throw Error('unexpected database request')
 }
 try{
  const resolved=await googleCredential(db as never,client);assert.equal(resolved.status,'credentials');if(resolved.status!=='credentials')throw Error('not resolved')
  assert.equal(resolved.account_id,'1234567890');assert.equal(resolved.secrets.manager_id,'9999999999');assert.ok(resolved.version.includes('mapping-1'))
  await markGoogleVerified(db as never,client,resolved.version);assert.equal(patches.length,1)
  version='configuration-2';await assert.rejects(()=>markGoogleVerified(db as never,client,resolved.version),/configuration_changed/);assert.equal(patches.length,1)
  ciphertext='CORRUPT_AND_MUST_NOT_BE_DECRYPTED_FOR_METADATA';paths.length=0
  const metadata=await googleMetadata(db as never,client);assert.equal(metadata?.account_id,'1234567890');assert.equal(metadata?.managed_by_mcc,true);assert.equal(paths.some(path=>path.includes('select=account_id,ciphertext')),false);assert.equal(JSON.stringify(metadata).includes(source),false)
  enabled=false;assert.equal((await googleCredential(db as never,client)).status,'not_configured');enabled=true;present=false;assert.equal((await googleCredential(db as never,client)).status,'mcc_account_unavailable')
 }finally{if(old===undefined)delete process.env.KOMMO_ENCRYPTION_KEY;else process.env.KOMMO_ENCRYPTION_KEY=old}
})
test('agency configuration requires an active financial administrator before accessing the registry',async()=>{
 const before={fetch:globalThis.fetch,url:process.env.VITE_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};process.env.VITE_SUPABASE_URL='https://synthetic.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='SYNTHETIC_SERVER'
 let active=true,role='admin',financial=false;const paths:string[]=[]
 globalThis.fetch=async(url)=>{const path=new URL(String(url)).pathname;paths.push(path);const value=path.endsWith('/auth/v1/user')?{id:'actor'}:path.endsWith('/profiles')?[{role,is_active:active,can_view_financials:financial}]:[];return new Response(JSON.stringify(value))}
 async function call(){const res={statusCode:0,body:'',setHeader(){},end(value:string){this.body=value}};await googleMccAdmin({headers:{authorization:'Bearer synthetic.jwt'},body:{action:'mcc_status'}} as never,res as never);return res}
 try{
  assert.equal((await call()).statusCode,403);assert.equal(paths.some(path=>path.includes('orbe_google_mcc')),false)
  financial=true;role='gt';assert.equal((await call()).statusCode,403);role='admin';active=false;assert.equal((await call()).statusCode,403);active=true
  const result=await call();assert.equal(result.statusCode,200);assert.deepEqual(JSON.parse(result.body),{configuration:null,accounts:[],sources:[]});assert.equal(paths.some(path=>path.includes('ciphertext')),false)
 }finally{globalThis.fetch=before.fetch;for(const [key,value]of Object.entries({VITE_SUPABASE_URL:before.url,SUPABASE_SERVICE_ROLE_KEY:before.key})){if(value===undefined)delete process.env[key];else process.env[key]=value}}
})
