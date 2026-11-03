import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {registerHooks} from 'node:module'
registerHooks({resolve(specifier,context,next){return next(context.parentURL?.includes('/api/')&&['./_lib/trackingServer.js','./_lib/qrAccess.js','./_lib/kommo.js','./_lib/adsCredentials.js','./trackingServer.js'].includes(specifier)?specifier.replace(/\.js$/,'.ts'):specifier,context)}})
const {default:handler}=await import('../api/google-ads-oauth.ts')
import {seal,unseal} from '../api/_lib/kommo.ts'
import {adsBinding} from '../api/_lib/adsCredentials.ts'
const client='589481f6-3a15-4c93-b384-5d33373c20e3'
const origin='https://studio.agenciaorbe.co'
const credentials={client_id:'synthetic.apps.googleusercontent.com',client_secret:'SYNTHETIC_CLIENT_SECRET',developer_token:'SYNTHETIC_DEVELOPER_TOKEN',manager_id:'9999999999'}
function response(){return {statusCode:0,body:'',headers:{} as Record<string,string>,setHeader(k:string,v:string){this.headers[k]=v},end(value=''){this.body=value}}}
test('Google OAuth binds browser, admin, client and credential version; tokens stay encrypted and codes cannot be replayed',async()=>{
 const before={fetch:globalThis.fetch,url:process.env.VITE_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,crypto:process.env.KOMMO_ENCRYPTION_KEY}
 process.env.VITE_SUPABASE_URL='https://synthetic.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='SYNTHETIC_SERVER_KEY';process.env.KOMMO_ENCRYPTION_KEY='a'.repeat(64)
 let session:Record<string,unknown>|null=null,saved:Record<string,unknown>|null=null,consumed=false,providerCalls=0,version='2026-11-02T00:00:00Z',active=true,role='admin',visible=true,lastChallenge=''
 const ciphertext=seal(JSON.stringify(credentials),adsBinding(client,'google'))
 globalThis.fetch=async(url,init)=>{
  const target=new URL(String(url));let value:unknown
  if(target.origin==='https://oauth2.googleapis.com'){
   providerCalls++;assert.equal(target.pathname,'/token');assert.equal(init?.redirect,'error')
   const body=new URLSearchParams(String(init?.body));assert.equal(body.get('client_secret'),credentials.client_secret)
   assert.equal(body.get('redirect_uri'),`${origin}/api/google-ads-oauth`)
   assert.equal(createHash('sha256').update(body.get('code_verifier')!).digest('base64url'),lastChallenge)
   return new Response(JSON.stringify({refresh_token:'SYNTHETIC_PRIVATE_REFRESH_TOKEN',scope:'https://www.googleapis.com/auth/adwords'}))
  }
  assert.equal(target.origin,'https://synthetic.invalid')
  if(target.pathname.endsWith('/auth/v1/user'))value={id:'actor'}
  else if(target.pathname.endsWith('/profiles'))value=[{role,is_active:active}]
  else if(target.pathname.endsWith('/clients'))value=visible?[{id:client}]:[]
  else if(target.pathname.endsWith('/client_assignments'))value=[]
  else if(target.pathname.endsWith('/wa_ads_credentials'))value=[{account_id:'1234567890',ciphertext,updated_at:version}]
  else if(target.pathname.endsWith('/wa_ads_oauth_sessions')){
   if(init?.method==='POST'){session=JSON.parse(String(init.body));consumed=false;value=[session]}
   else if(init?.method==='PATCH'){value=consumed?[]:[{state_hash:session?.state_hash}];consumed=true}
   else value=session&&!consumed&&target.searchParams.get('state_hash')===`eq.${session.state_hash}`?[session]:[]
  }else if(target.pathname.endsWith('/rpc/wa_ads_save')){saved=JSON.parse(String(init?.body));value=[]}
  else throw new Error('Unexpected synthetic request')
  return new Response(JSON.stringify(value))
 }
 async function start(requestOrigin=origin){const res=response();await handler({method:'POST',headers:{origin:requestOrigin,'content-type':'application/json',authorization:'Bearer synthetic.jwt.token'},body:{action:'start',client_id:client}} as never,res as never);return res}
 async function callback(state:string,cookie:string,extra='code=SYNTHETIC_CODE'){const res=response();await handler({method:'GET',url:`/api/google-ads-oauth?state=${state}&${extra}`,headers:{cookie}} as never,res as never);return res}
 try{
  assert.equal((await start('https://other.invalid')).statusCode,403);role='gt';assert.equal((await start()).statusCode,403);role='admin';visible=false;assert.equal((await start()).statusCode,403);visible=true
  const initial=await start();assert.equal(initial.statusCode,200)
  const url=new URL(JSON.parse(initial.body).authorization_url),state=url.searchParams.get('state')!,cookie=initial.headers['Set-Cookie'].split(';')[0];lastChallenge=url.searchParams.get('code_challenge')!
  assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('access_type'),'offline');assert.equal(url.searchParams.get('code_challenge_method'),'S256')
  for(const secret of [credentials.client_secret,credentials.developer_token,'SYNTHETIC_PRIVATE_REFRESH_TOKEN'])assert.equal(initial.body.includes(secret),false)
  assert.match(initial.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Lax/);assert.equal(JSON.stringify(session).includes(state),false)
  assert.match((await callback(state,'')).headers.Location,/invalid_session/);assert.equal(providerCalls,0)
  assert.match((await callback(state,`__Secure-orbe_google_oauth=${'x'.repeat(43)}`)).headers.Location,/invalid_session/);assert.equal(providerCalls,0)
  active=false;assert.match((await callback(state,cookie)).headers.Location,/access_denied/);active=true
  const result=await callback(state,cookie);assert.equal(result.statusCode,303);assert.match(result.headers.Location,/google_oauth=success/);assert.equal(providerCalls,1)
  assert.ok(saved);const record=saved as Record<string,unknown>;assert.equal(record.p_client,client);assert.equal(record.p_actor,'actor');assert.equal(record.p_expected,version)
  const clear=JSON.parse(unseal(String(record.p_ciphertext),adsBinding(client,'google')));assert.equal(clear.refresh_token,'SYNTHETIC_PRIVATE_REFRESH_TOKEN');assert.equal(clear.developer_token,credentials.developer_token)
  assert.equal(JSON.stringify(result).includes(clear.refresh_token),false);assert.equal(JSON.stringify(result).includes('SYNTHETIC_CODE'),false)
  assert.match((await callback(state,cookie)).headers.Location,/invalid_session/);assert.equal(providerCalls,1)
  const next=await start(),nextUrl=new URL(JSON.parse(next.body).authorization_url),nextCookie=next.headers['Set-Cookie'].split(';')[0];version='2026-11-02T01:00:00Z'
  assert.match((await callback(nextUrl.searchParams.get('state')!,nextCookie)).headers.Location,/configuration_changed/);assert.equal(providerCalls,1)
 }finally{globalThis.fetch=before.fetch;for(const [key,value]of Object.entries({VITE_SUPABASE_URL:before.url,SUPABASE_SERVICE_ROLE_KEY:before.key,KOMMO_ENCRYPTION_KEY:before.crypto})){if(value===undefined)delete process.env[key];else process.env[key]=value}}
})
