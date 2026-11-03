import {googleMccAdmin,googleMetadata,googleCredential,markGoogleVerified,isMccCredentialSource} from './_lib/googleMcc.js';
import googleAdsOAuth from './_lib/googleAdsOAuth.js';
import type {ServerResponse} from 'node:http';
import {answer,type Request} from './_lib/trackingServer.js';
import {qrUser} from './_lib/qrAccess.js';
import {object,ORBE_ORIGIN,scalar,seal,unseal} from './_lib/kommo.js';
import {adsBinding,normalizeAdsCredentials,verifyMetaAccess} from './_lib/adsCredentials.js';
import {googleAdsReport} from './_lib/googleAdsReport.js';
export default async function handler(req:Request,res:ServerResponse){
 const route=new URL(req.url??'/api/ads-credentials',ORBE_ORIGIN);
 if(route.pathname==='/api/google-ads-oauth'||route.searchParams.get('oauth')==='1')return googleAdsOAuth(req,res);
 if(req.method!=='POST')return answer(res,405,{error:'method_not_allowed'});
 if(req.headers.origin!==ORBE_ORIGIN)return answer(res,403,{error:'forbidden'});
 if(!req.headers['content-type']?.startsWith('application/json'))return answer(res,415,{error:'json_required'});
 try{
  if(Buffer.byteLength(JSON.stringify(req.body)??'')>32768)return answer(res,413,{error:'too_large'});
  const input=object(req.body);if(typeof input.action==='string'&&input.action.startsWith('mcc_'))return googleMccAdmin(req,res);
  const client=scalar(input.client_id,36),{db,user}=await qrUser(req,client);
  const profiles=await db<{role:string;can_view_financials:boolean}[]>(`rest/v1/profiles?id=eq.${user.id}&select=role,can_view_financials`);
  if(input.action==='status'){
   const configurations=await db<{platform:string;account_id:string;status:string;has_refresh_token:boolean;expires_at:string|null;updated_at:string}[]>(`rest/v1/wa_ads_credentials?client_id=eq.${client}&select=platform,account_id,status,has_refresh_token,expires_at,updated_at&order=platform`);
   const managed=await googleMetadata(db,client);return answer(res,200,{configurations:managed?[...configurations.filter(c=>c.platform!=='google'),managed]:configurations});
  }
  if(profiles[0]?.role!=='admin')return answer(res,403,{error:'admin_required'});
  if(['save','save_google_developer'].includes(String(input.action))&&(input.platform==='google'||input.action==='save_google_developer')&&!profiles[0]?.can_view_financials&&await isMccCredentialSource(db,client))return answer(res,403,{error:'financial_admin_required'});
  if(input.action==='save_google_developer'){
   const developer=scalar(input.developer_token,4096);
   if(developer.length<10||/\s/.test(developer))throw new Error('invalid_credentials');
   const rows=await db<{account_id:string;ciphertext:string;updated_at:string;has_refresh_token:boolean;expires_at:string|null}[]>(`rest/v1/wa_ads_credentials?client_id=eq.${client}&platform=eq.google&select=account_id,ciphertext,updated_at,has_refresh_token,expires_at`);
   const row=rows[0];if(!row)return answer(res,404,{error:'credentials_missing'});
   if(row.updated_at!==input.expected_version)return answer(res,409,{error:'configuration_changed'});
   const secrets=object(JSON.parse(unseal(row.ciphertext,adsBinding(client,'google'))));
   const manager=typeof input.manager_id==='string'?input.manager_id.replace(/-/g,''):'';
   if(manager&&!/^[1-9]\d{9}$/.test(manager))throw new Error('invalid_manager');
   const ciphertext=seal(JSON.stringify({...secrets,developer_token:developer,...(manager?{manager_id:manager}:{})}),adsBinding(client,'google'));
   await db('rest/v1/rpc/wa_ads_save',{method:'POST',body:JSON.stringify({p_client:client,p_platform:'google',p_account:row.account_id,p_ciphertext:ciphertext,p_status:row.has_refresh_token?'saved_unverified':'oauth_pending',p_refresh:row.has_refresh_token,p_expiry:row.expires_at,p_actor:user.id,p_expected:row.updated_at})});
   const configurations=await db(`rest/v1/wa_ads_credentials?client_id=eq.${client}&select=platform,account_id,status,has_refresh_token,expires_at,updated_at&order=platform`);
   return answer(res,200,{configurations});
  }
  if(input.action==='verify'){
   if(!['meta','google'].includes(String(input.platform)))return answer(res,400,{error:'invalid_platform'});
   const platform=input.platform as 'meta'|'google';
   if(platform==='google'){
    const credential=await googleCredential(db,client);if(credential.status!=='credentials')return answer(res,200,{verification:{status:credential.status}});
    const day=new Date(Date.now()-86400000).toISOString().slice(0,10),report=await googleAdsReport(credential.account_id,credential.secrets,{since:day,until:day});
    if(report.status!=='ready')return answer(res,200,{verification:{status:report.status,account_id:credential.account_id}});
    if(credential.mapped)await markGoogleVerified(db,client,credential.version);
    else await db('rest/v1/rpc/wa_ads_save',{method:'POST',body:JSON.stringify({p_client:client,p_platform:'google',p_account:credential.account_id,p_ciphertext:(await db<{ciphertext:string}[]>(`rest/v1/wa_ads_credentials?client_id=eq.${client}&platform=eq.google&select=ciphertext`))[0].ciphertext,p_status:'access_verified',p_refresh:credential.has_refresh_token,p_expiry:credential.expires_at,p_actor:user.id,p_expected:credential.updated_at})});
    return answer(res,200,{verification:{status:'access_verified',account_id:credential.account_id,account_name:report.account_name,checked_at:report.checked_at}});
   }
   const rows=await db<{account_id:string;ciphertext:string;updated_at:string;has_refresh_token:boolean;expires_at:string|null}[]>(`rest/v1/wa_ads_credentials?client_id=eq.${client}&platform=eq.${platform}&select=account_id,ciphertext,updated_at,has_refresh_token,expires_at`);
   const row=rows[0];if(!row)return answer(res,404,{error:'credentials_missing'});
   const secrets=object(JSON.parse(unseal(row.ciphertext,adsBinding(client,platform))));
   const verification=await verifyMetaAccess(row.account_id,scalar(secrets.access_token,4096));
   const latest=await db<{updated_at:string}[]>(`rest/v1/wa_ads_credentials?client_id=eq.${client}&platform=eq.${platform}&select=updated_at`);
   if(latest[0]?.updated_at!==row.updated_at)return answer(res,409,{error:'configuration_changed'});
   await db('rest/v1/rpc/wa_ads_save',{method:'POST',body:JSON.stringify({p_client:client,p_platform:platform,p_account:row.account_id,p_ciphertext:row.ciphertext,p_status:'access_verified',p_refresh:row.has_refresh_token,p_expiry:row.expires_at,p_actor:user.id,p_expected:row.updated_at})});
   return answer(res,200,{verification});
  }
  if(input.action==='save'){
   const value=normalizeAdsCredentials(input);
   const current=await db<{updated_at:string;account_id?:string;ciphertext?:string}[]>(`rest/v1/wa_ads_credentials?client_id=eq.${client}&platform=eq.${value.platform}&select=${value.platform==='google'?'updated_at,account_id,ciphertext':'updated_at'}`);
   if((current[0]?.updated_at??null)!==(input.expected_version??null))return answer(res,409,{error:'configuration_changed'});
   let secrets:Record<string,unknown>=value.secrets;
   // Replacing an OAuth app requires fresh authorization, but must not discard
   // the separately registered developer token or manager binding.
   if(value.platform==='google'&&current[0]?.account_id===value.account_id&&current[0].ciphertext){
    const previous=object(JSON.parse(unseal(current[0].ciphertext,adsBinding(client,'google'))));
    secrets={...secrets,developer_token:secrets.developer_token||previous.developer_token||'',manager_id:secrets.manager_id||previous.manager_id||''};
   }
   const cipher=seal(JSON.stringify(secrets),adsBinding(client,value.platform));
   await db('rest/v1/rpc/wa_ads_save',{method:'POST',body:JSON.stringify({p_client:client,p_platform:value.platform,p_account:value.account_id,p_ciphertext:cipher,p_status:value.status,p_refresh:value.has_refresh_token,p_expiry:value.expires_at,p_actor:user.id,p_expected:input.expected_version??null})});
  }else if(input.action!=='status')return answer(res,400,{error:'invalid_action'});
  const configurations=await db(`rest/v1/wa_ads_credentials?client_id=eq.${client}&select=platform,account_id,status,has_refresh_token,expires_at,updated_at&order=platform`);
  return answer(res,200,{configurations});
 }catch(error){const code=error instanceof Error?error.message:'';return answer(res,['unauthorized','forbidden'].includes(code)?403:code.startsWith('invalid_')?400:503,{error:['unauthorized','forbidden','invalid_platform','invalid_account','invalid_credentials','invalid_oauth_client','invalid_manager','invalid_expiry','meta_token_invalid','meta_permission_denied','meta_account_mismatch','meta_unavailable','google_oauth_invalid','google_developer_token_denied','google_permission_denied','google_unavailable','google_account_mismatch'].includes(code)?code:'save_unavailable'});}
}
