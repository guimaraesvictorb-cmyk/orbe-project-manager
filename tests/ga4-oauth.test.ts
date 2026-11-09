import test from 'node:test'
import assert from 'node:assert/strict'
import {registerHooks} from 'node:module'
registerHooks({resolve(specifier,context,next){return next(context.parentURL?.includes('/api/')&&specifier.startsWith('.')&&specifier.endsWith('.js')?specifier.slice(0,-3)+'.ts':specifier,context)}})
const {default:handler}=await import('../api/ads-credentials.ts')
const {seal,unseal}=await import('../api/_lib/kommo.ts')
const {adsBinding}=await import('../api/_lib/adsCredentials.ts')
const client='589481f6-3a15-4c93-b384-5d33373c20e3',origin='https://studio.agenciaorbe.co',scope='https://www.googleapis.com/auth/analytics.readonly'
function response(){return {statusCode:0,body:'',headers:{} as Record<string,string>,setHeader(key:string,value:string){this.headers[key]=value},end(body=''){this.body=body}}}
test('GA4 OAuth checks admin and client access, binds the browser, encrypts its own token and rejects replay',async()=>{
 const before={fetch:globalThis.fetch,url:process.env.VITE_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,crypto:process.env.KOMMO_ENCRYPTION_KEY}
 process.env.VITE_SUPABASE_URL='https://synthetic.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='SYNTHETIC_SERVICE';process.env.KOMMO_ENCRYPTION_KEY='b'.repeat(64)
 const source=seal(JSON.stringify({client_id:'synthetic.apps.googleusercontent.com',client_secret:'SYNTHETIC_SECRET',refresh_token:'SYNTHETIC_ADS_REFRESH'}),adsBinding(client,'google'))
 let session:Record<string,string>|undefined,saved:Record<string,string>|undefined,consumed=false,role='admin',visible=true,providerCalls=0
 globalThis.fetch=async(url,init)=>{
  const target=new URL(String(url));let data:unknown=[]
  if(target.hostname==='oauth2.googleapis.com'){providerCalls++;const body=new URLSearchParams(String(init?.body));assert.equal(body.get('redirect_uri'),origin+'/api/google-ads-oauth');return new Response(JSON.stringify({refresh_token:'SYNTHETIC_ANALYTICS_REFRESH',scope}))}
  assert.equal(target.origin,'https://synthetic.invalid')
  if(target.pathname.endsWith('/auth/v1/user'))data={id:'actor'}
  else if(target.pathname.endsWith('/profiles'))data=[{is_active:true,role}]
  else if(target.pathname.endsWith('/clients'))data=visible?[{id:client,ga4_property_id:null}]:[]
  else if(target.pathname.endsWith('/wa_ads_credentials'))data=[{ciphertext:source,account_id:'1234567890',updated_at:'2026-11-09T10:00:00Z',has_refresh_token:true,status:'saved_unverified'}]
  else if(target.pathname.endsWith('/wa_ga4_oauth_sessions')){
   if(init?.method==='POST'){session=JSON.parse(String(init.body));consumed=false}
   else if(init?.method==='PATCH'){data=consumed?[]:[{state_hash:session?.state_hash}];consumed=true}
   else data=session&&!consumed&&target.searchParams.get('state_hash')==='eq.'+session.state_hash?[session]:[]
  }else if(target.pathname.endsWith('/wa_ga4_credentials')&&init?.method==='POST'){saved=JSON.parse(String(init.body));if(new Headers(init.headers).get('Prefer')?.includes('return=minimal'))return new Response(null,{status:201});data=[{client_id:client,updated_at:'2026-11-09T12:00:00Z'}]}
  else if(!['client_assignments','orbe_google_mcc','orbe_google_mcc_accounts','wa_ga4_credentials'].some(name=>target.pathname.endsWith('/'+name)))throw Error('Unexpected synthetic request '+target.pathname)
  return new Response(JSON.stringify(data))
 }
 async function start(requestOrigin=origin){const res=response();await handler({method:'POST',url:'/api/ads-credentials',headers:{origin:requestOrigin,'content-type':'application/json',authorization:'Bearer synthetic.jwt'},body:{action:'ga4_start',client_id:client}} as never,res as never);return res}
 async function callback(state:string,cookie:string){const res=response();await handler({method:'GET',url:'/api/google-ads-oauth?state='+state+'&code=SYNTHETIC_CODE',headers:{cookie}} as never,res as never);return res}
 try{
  assert.equal((await start('https://other.invalid')).statusCode,403)
  role='gt';assert.equal((await start()).statusCode,403);role='admin'
  visible=false;assert.equal((await start()).statusCode,403);visible=true
  const begin=await start();assert.equal(begin.statusCode,200)
  const url=new URL(JSON.parse(begin.body).authorization_url),state=url.searchParams.get('state')!,cookie=begin.headers['Set-Cookie'].split(';')[0]
  assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('code_challenge_method'),'S256')
  assert.equal(begin.body.includes('SYNTHETIC_SECRET'),false);assert.equal(JSON.stringify(session).includes(state),false)
  const wrong=await callback(state,'__Secure-orbe_ga4_oauth='+'x'.repeat(43));assert.match(wrong.headers.Location,/invalid_session/);assert.equal(providerCalls,0)
  const result=await callback(state,cookie);assert.match(result.headers.Location,/ga4_oauth=success/);assert.ok(saved)
  const secrets=JSON.parse(unseal(saved.ciphertext,'ga4:'+client));assert.equal(secrets.refresh_token,'SYNTHETIC_ANALYTICS_REFRESH');assert.equal(saved.ciphertext.includes('SYNTHETIC_ANALYTICS_REFRESH'),false);assert.equal(result.body.includes('SYNTHETIC_ANALYTICS_REFRESH'),false)
  assert.match((await callback(state,cookie)).headers.Location,/invalid_session/);assert.equal(providerCalls,1)
 }finally{globalThis.fetch=before.fetch;for(const [key,value] of [['VITE_SUPABASE_URL',before.url],['SUPABASE_SERVICE_ROLE_KEY',before.key],['KOMMO_ENCRYPTION_KEY',before.crypto]]){if(value===undefined)delete process.env[key!];else process.env[key!]=value}}
})
