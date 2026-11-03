import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import type {ServerResponse} from 'node:http';
import {answer,storage,type Request} from './trackingServer.js';
import {qrUser} from './qrAccess.js';
import {isMccCredentialSource} from './googleMcc.js';
import {adsBinding} from './adsCredentials.js';
import {object,ORBE_ORIGIN,seal,unseal} from './kommo.js';
const callback=`${ORBE_ORIGIN}/api/google-ads-oauth`,scope='https://www.googleapis.com/auth/adwords';
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const cookieName='__Secure-orbe_google_oauth';
const cookie=(value:string,age=600)=>`${cookieName}=${value}; Path=/api/google-ads-oauth; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`;
const binding=(client:string,state:string)=>`google-oauth:${client}:${state}`;
const safeEqual=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
type Credentials={account_id:string;ciphertext:string;updated_at:string};
type State={client_id:string;user_id:string;browser_hash:string;verifier_ciphertext:string;credential_version:string;expires_at:string};
function finish(res:ServerResponse,client:string|null,result:string){
 const params=new URLSearchParams({...(client?{cliente:client,area:'google'}:{}),google_oauth:result});
 res.statusCode=303;res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Set-Cookie',cookie('',0));res.setHeader('Location',`${ORBE_ORIGIN}/#clientes?${params}`);res.end();
}
export default async function handler(req:Request,res:ServerResponse){
 if(req.method==='POST'){
  if(req.headers.origin!==ORBE_ORIGIN)return answer(res,403,{error:'forbidden'});
  if(!req.headers['content-type']?.startsWith('application/json'))return answer(res,415,{error:'json_required'});
  try{
   if(Buffer.byteLength(JSON.stringify(req.body)??'')>2048)return answer(res,413,{error:'too_large'});
   const input=object(req.body),client=String(input.client_id??'');
   if(input.action!=='start')return answer(res,400,{error:'invalid_action'});
   const {db,user}=await qrUser(req,client);
   const profiles=await db<{role:string;can_view_financials:boolean}[]>(`rest/v1/profiles?id=eq.${user.id}&select=role,can_view_financials`);
   if(profiles[0]?.role!=='admin')return answer(res,403,{error:'admin_required'});
   if(!profiles[0]?.can_view_financials&&await isMccCredentialSource(db,client))return answer(res,403,{error:'owner_required'});
   const rows=await db<Credentials[]>(`rest/v1/wa_ads_credentials?client_id=eq.${client}&platform=eq.google&select=account_id,ciphertext,updated_at`);
   if(!rows[0])return answer(res,400,{error:'google_credentials_missing'});
   const secrets=object(JSON.parse(unseal(rows[0].ciphertext,adsBinding(client,'google'))));
   if(typeof secrets.client_id!=='string'||!secrets.client_id.endsWith('.apps.googleusercontent.com')||typeof secrets.client_secret!=='string')return answer(res,400,{error:'google_credentials_missing'});
   const state=randomBytes(32).toString('base64url'),proof=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url'),hash=digest(state);
   await db('rest/v1/wa_ads_oauth_sessions',{method:'POST',body:JSON.stringify({state_hash:hash,client_id:client,user_id:user.id,browser_hash:digest(proof),verifier_ciphertext:seal(verifier,binding(client,hash)),credential_version:rows[0].updated_at,expires_at:new Date(Date.now()+600000).toISOString()})});
   const params=new URLSearchParams({client_id:secrets.client_id,redirect_uri:callback,response_type:'code',scope,access_type:'offline',prompt:'consent',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
   res.setHeader('Set-Cookie',cookie(proof));
   return answer(res,200,{authorization_url:`https://accounts.google.com/o/oauth2/v2/auth?${params}`,redirect_uri:callback});
  }catch(error){const code=error instanceof Error?error.message:'';return answer(res,['unauthorized','forbidden'].includes(code)?403:503,{error:['unauthorized','forbidden'].includes(code)?code:'google_authorization_unavailable'});}
 }
 if(req.method!=='GET')return answer(res,405,{error:'method_not_allowed'});
 let client:string|null=null;
 try{
  const params=new URL(req.url??'',ORBE_ORIGIN).searchParams,state=params.get('state')??'',code=params.get('code')??'';
  const proof=String(req.headers.cookie??'').split(';').map(item=>item.trim()).find(item=>item.startsWith(`${cookieName}=`))?.slice(cookieName.length+1)??'';
  if(!/^[A-Za-z0-9_-]{43}$/.test(state)||!/^[A-Za-z0-9_-]{43}$/.test(proof))return finish(res,null,'invalid_session');
  const db=storage(),hash=digest(state);
  const sessions=await db<State[]>(`rest/v1/wa_ads_oauth_sessions?state_hash=eq.${hash}&consumed_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=client_id,user_id,browser_hash,verifier_ciphertext,credential_version,expires_at`);
  const session=sessions[0];
  if(!session||!safeEqual(digest(proof),session.browser_hash)||Date.parse(session.expires_at)<=Date.now())return finish(res,null,'invalid_session');
  client=session.client_id;
  const [profiles,clients]=await Promise.all([db<{is_active:boolean;role:string;can_view_financials:boolean}[]>(`rest/v1/profiles?id=eq.${session.user_id}&select=is_active,role,can_view_financials`),db<{id:string}[]>(`rest/v1/clients?id=eq.${client}&deleted_at=is.null&select=id`)]);
  if(!profiles[0]?.is_active||profiles[0].role!=='admin'||clients.length!==1)return finish(res,client,'access_denied');
  if(!profiles[0]?.can_view_financials&&await isMccCredentialSource(db,client))return finish(res,client,'access_denied');
  const consumed=await db<{state_hash:string}[]>(`rest/v1/wa_ads_oauth_sessions?state_hash=eq.${hash}&consumed_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`,{method:'PATCH',body:JSON.stringify({consumed_at:new Date().toISOString()})});
  if(consumed.length!==1)return finish(res,client,'invalid_session');
  if(params.has('error'))return finish(res,client,'cancelled');
  if(!code||code.length>4096)return finish(res,client,'invalid_session');
  const rows=await db<Credentials[]>(`rest/v1/wa_ads_credentials?client_id=eq.${client}&platform=eq.google&select=account_id,ciphertext,updated_at`),row=rows[0];
  if(!row||row.updated_at!==session.credential_version)return finish(res,client,'configuration_changed');
  const secrets=object(JSON.parse(unseal(row.ciphertext,adsBinding(client,'google'))));
  const token=await fetch('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:String(secrets.client_id),client_secret:String(secrets.client_secret),redirect_uri:callback,code,code_verifier:unseal(session.verifier_ciphertext,binding(client,hash))})});
  const result=await token.json() as {refresh_token?:unknown;scope?:unknown};
  if(!token.ok)return finish(res,client,'authorization_failed');
  if(typeof result.scope==='string'&&!result.scope.split(' ').includes(scope))return finish(res,client,'scope_missing');
  if(typeof result.refresh_token!=='string'||result.refresh_token.length<10||result.refresh_token.length>4096||/\s/.test(result.refresh_token))return finish(res,client,'offline_access_missing');
  await db('rest/v1/rpc/wa_ads_save',{method:'POST',body:JSON.stringify({p_client:client,p_platform:'google',p_account:row.account_id,p_ciphertext:seal(JSON.stringify({...secrets,refresh_token:result.refresh_token}),adsBinding(client,'google')),p_status:'saved_unverified',p_refresh:true,p_expiry:null,p_actor:session.user_id,p_expected:row.updated_at})});
  return finish(res,client,'success');
 }catch{return finish(res,client,'authorization_failed');}
}
