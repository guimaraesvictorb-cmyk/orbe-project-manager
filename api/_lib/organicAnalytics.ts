import {createHash,randomBytes,timingSafeEqual} from 'node:crypto'
import type {ServerResponse} from 'node:http'
import {answer,storage,type Request} from './trackingServer.js'
import {qrUser} from './qrAccess.js'
import {googleCredential} from './googleMcc.js'
import {object,ORBE_ORIGIN,seal,unseal} from './kommo.js'
import {analyticsScope,analyticsProperty,analyticsPeriod,ga4Properties,ga4Report} from './ga4Provider.js'
const callback=`${ORBE_ORIGIN}/api/google-ads-oauth`,cookieName='__Secure-orbe_ga4_oauth'
const digest=(value:string)=>createHash('sha256').update(value).digest('hex')
const binding=(client:string)=>`ga4:${client}`
const cookie=(proof:string,age=600)=>`${cookieName}=${proof}; Path=/api/google-ads-oauth; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`
type Db=ReturnType<typeof storage>
const errors=['unauthorized','forbidden','admin_required','invalid_property','invalid_period','google_credentials_missing','ga4_reauthorize','ga4_scope_required','ga4_api_disabled','ga4_permission_denied','ga4_unavailable','ga4_report_too_large','configuration_changed']
async function accessToken(db:Db,client:string){
 const rows=await db<{ciphertext:string}[]>(`rest/v1/wa_ga4_credentials?client_id=eq.${client}&select=ciphertext`)
 if(!rows[0])throw Error('ga4_reauthorize')
 const secrets=object(JSON.parse(unseal(rows[0].ciphertext,binding(client))))
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:String(secrets.client_id),client_secret:String(secrets.client_secret),refresh_token:String(secrets.refresh_token)})})
 const result=await response.json() as {access_token?:unknown};if(!response.ok||typeof result.access_token!=='string')throw Error('ga4_reauthorize');return result.access_token as string
}
export async function organicAnalytics(req:Request,res:ServerResponse){
 try{
  const input=object(req.body),client=String(input.client_id||''),{db,user}=await qrUser(req,client)
  const [profiles,clients,credentials]=await Promise.all([
   db<{role:string}[]>(`rest/v1/profiles?id=eq.${user.id}&select=role`),
   db<{ga4_property_id:string|null}[]>(`rest/v1/clients?id=eq.${client}&select=ga4_property_id`),
   db<{updated_at:string}[]>(`rest/v1/wa_ga4_credentials?client_id=eq.${client}&select=updated_at`),
  ])
  const property=clients[0]?.ga4_property_id||''
  if(input.action==='ga4_status')return answer(res,200,{authorized:!!credentials[0],property,updated_at:credentials[0]?.updated_at||null})
  if(input.action==='ga4_report'){
   if(!property)return answer(res,200,{status:'property_required'})
   const period=analyticsPeriod(input.start,input.end)
   return answer(res,200,await ga4Report(await accessToken(db,client),property,period))
  }
  if(profiles[0]?.role!=='admin')throw Error('admin_required')
  if(input.action==='ga4_start'){
   const credential=await googleCredential(db,client)
   if(credential.status!=='credentials'||typeof object(credential.secrets).client_id!=='string'||typeof object(credential.secrets).client_secret!=='string')throw Error('google_credentials_missing')
   const state='ga4_'+randomBytes(32).toString('base64url'),proof=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url'),hash=digest(state)
   await db('rest/v1/wa_ga4_oauth_sessions',{method:'POST',body:JSON.stringify({state_hash:hash,client_id:client,user_id:user.id,browser_hash:digest(proof),verifier_ciphertext:seal(verifier,`ga4-oauth:${hash}`),credential_version:credential.version,expires_at:new Date(Date.now()+600000).toISOString()})})
   const params=new URLSearchParams({client_id:String(object(credential.secrets).client_id),redirect_uri:callback,response_type:'code',scope:analyticsScope,access_type:'offline',prompt:'consent',state,code_challenge:digestBase64(verifier),code_challenge_method:'S256'})
   res.setHeader('Set-Cookie',cookie(proof));return answer(res,200,{authorization_url:`https://accounts.google.com/o/oauth2/v2/auth?${params}`})
  }
  if(input.action==='ga4_properties')return answer(res,200,{properties:await ga4Properties(await accessToken(db,client))})
  if(input.action==='ga4_select'){
   const id=analyticsProperty(input.property),properties=await ga4Properties(await accessToken(db,client))
   if(!properties.some(p=>p.id===id))throw Error('ga4_permission_denied')
   await db(`rest/v1/clients?id=eq.${client}`,{method:'PATCH',body:JSON.stringify({ga4_property_id:id})})
   return answer(res,200,{property:id})
  }
  return answer(res,400,{error:'invalid_action'})
 }catch(e){const code=e instanceof Error?e.message:'';return answer(res,['unauthorized','forbidden','admin_required'].includes(code)?403:code.startsWith('invalid_')?400:503,{error:errors.includes(code)?code:'ga4_unavailable'})}
}
const digestBase64=(value:string)=>createHash('sha256').update(value).digest('base64url')
function finish(res:ServerResponse,client:string|null,result:string){res.statusCode=303;res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Set-Cookie',cookie('',0));res.setHeader('Location',`${ORBE_ORIGIN}/#clientes?${new URLSearchParams({...(client?{cliente:client,area:'analytics'}:{}),ga4_oauth:result})}`);res.end()}
export async function organicAnalyticsCallback(req:Request,res:ServerResponse){
 let client:string|null=null
 try{
  const params=new URL(req.url||'',ORBE_ORIGIN).searchParams,state=params.get('state')||'',code=params.get('code')||''
  const proof=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1)||''
  if(!/^ga4_[A-Za-z0-9_-]{43}$/.test(state)||!/^[A-Za-z0-9_-]{43}$/.test(proof))return finish(res,null,'invalid_session')
  const db=storage(),hash=digest(state),rows=await db<{client_id:string;user_id:string;browser_hash:string;verifier_ciphertext:string;credential_version:string}[]>(`rest/v1/wa_ga4_oauth_sessions?state_hash=eq.${hash}&consumed_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=client_id,user_id,browser_hash,verifier_ciphertext,credential_version`),session=rows[0]
  if(!session||!timingSafeEqual(Buffer.from(digest(proof)),Buffer.from(session.browser_hash)))return finish(res,null,'invalid_session')
  client=session.client_id
  const profile=await db<{is_active:boolean;role:string}[]>(`rest/v1/profiles?id=eq.${session.user_id}&select=is_active,role`)
  const clients=await db<{id:string}[]>(`rest/v1/clients?id=eq.${client}&deleted_at=is.null&select=id`)
  if(clients.length!==1||!profile[0]?.is_active||profile[0].role!=='admin')return finish(res,client,'access_denied')
  const consumed=await db<{state_hash:string}[]>(`rest/v1/wa_ga4_oauth_sessions?state_hash=eq.${hash}&consumed_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`,{method:'PATCH',body:JSON.stringify({consumed_at:new Date().toISOString()})})
  if(consumed.length!==1)return finish(res,client,'invalid_session')
  if(params.has('error'))return finish(res,client,'cancelled')
  if(!code||code.length>4096)return finish(res,client,'invalid_session')
  const credential=await googleCredential(db,client)
  if(credential.status!=='credentials'||credential.version!==session.credential_version)return finish(res,client,'configuration_changed')
  const secrets=object(credential.secrets),response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:String(secrets.client_id),client_secret:String(secrets.client_secret),redirect_uri:callback,code,code_verifier:unseal(session.verifier_ciphertext,`ga4-oauth:${hash}`)})})
  const token=await response.json() as {refresh_token?:unknown;scope?:unknown}
  if(!response.ok||typeof token.refresh_token!=='string'||token.refresh_token.length<10||token.refresh_token.length>4096||!String(token.scope||'').split(' ').includes(analyticsScope))return finish(res,client,'authorization_failed')
  await db('rest/v1/wa_ga4_credentials?on_conflict=client_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({client_id:client,ciphertext:seal(JSON.stringify({client_id:secrets.client_id,client_secret:secrets.client_secret,refresh_token:token.refresh_token}),binding(client)),updated_at:new Date().toISOString(),updated_by:session.user_id})})
  return finish(res,client,'success')
 }catch{return finish(res,client,'authorization_failed')}
}
