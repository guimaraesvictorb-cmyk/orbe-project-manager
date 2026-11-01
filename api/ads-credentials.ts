import type {ServerResponse} from 'node:http';
import {answer,type Request} from './_lib/trackingServer.js';
import {qrUser} from './_lib/qrAccess.js';
import {object,ORBE_ORIGIN,scalar,seal,unseal} from './_lib/kommo.js';
import {adsBinding,normalizeAdsCredentials,verifyMetaAccess} from './_lib/adsCredentials.js';
export default async function handler(req:Request,res:ServerResponse){
 if(req.method!=='POST')return answer(res,405,{error:'method_not_allowed'});
 if(req.headers.origin!==ORBE_ORIGIN)return answer(res,403,{error:'forbidden'});
 if(!req.headers['content-type']?.startsWith('application/json'))return answer(res,415,{error:'json_required'});
 try{
  if(Buffer.byteLength(JSON.stringify(req.body)??'')>32768)return answer(res,413,{error:'too_large'});
  const input=object(req.body),client=scalar(input.client_id,36),{db,user}=await qrUser(req,client);
  const profiles=await db<{role:string}[]>(`rest/v1/profiles?id=eq.${user.id}&select=role`);
  if(profiles[0]?.role!=='admin')return answer(res,403,{error:'admin_required'});
  if(input.action==='verify'){
   if(!['meta','google'].includes(String(input.platform)))return answer(res,400,{error:'invalid_platform'});
   const platform=input.platform as 'meta'|'google';
   const rows=await db<{account_id:string;ciphertext:string;updated_at:string;has_refresh_token:boolean}[]>(`rest/v1/wa_ads_credentials?client_id=eq.${client}&platform=eq.${platform}&select=account_id,ciphertext,updated_at,has_refresh_token`);
   const row=rows[0];if(!row)return answer(res,404,{error:'credentials_missing'});
   if(platform==='google')return answer(res,200,{verification:{status:row.has_refresh_token?'google_validation_pending':'oauth_pending',account_id:row.account_id}});
   const secrets=object(JSON.parse(unseal(row.ciphertext,adsBinding(client,platform))));
   const verification=await verifyMetaAccess(row.account_id,scalar(secrets.access_token,4096));
   const latest=await db<{updated_at:string}[]>(`rest/v1/wa_ads_credentials?client_id=eq.${client}&platform=eq.${platform}&select=updated_at`);
   if(latest[0]?.updated_at!==row.updated_at)return answer(res,409,{error:'configuration_changed'});
   return answer(res,200,{verification});
  }
  if(input.action==='save'){
   const value=normalizeAdsCredentials(input);
   const current=await db<{updated_at:string}[]>(`rest/v1/wa_ads_credentials?client_id=eq.${client}&platform=eq.${value.platform}&select=updated_at`);
   if((current[0]?.updated_at??null)!==(input.expected_version??null))return answer(res,409,{error:'configuration_changed'});
   const cipher=seal(JSON.stringify(value.secrets),adsBinding(client,value.platform));
   await db('rest/v1/rpc/wa_ads_save',{method:'POST',body:JSON.stringify({p_client:client,p_platform:value.platform,p_account:value.account_id,p_ciphertext:cipher,p_status:value.status,p_refresh:value.has_refresh_token,p_expiry:value.expires_at,p_actor:user.id,p_expected:input.expected_version??null})});
  }else if(input.action!=='status')return answer(res,400,{error:'invalid_action'});
  const configurations=await db(`rest/v1/wa_ads_credentials?client_id=eq.${client}&select=platform,account_id,status,has_refresh_token,expires_at,updated_at&order=platform`);
  return answer(res,200,{configurations});
 }catch(error){const code=error instanceof Error?error.message:'';return answer(res,['unauthorized','forbidden'].includes(code)?403:code.startsWith('invalid_')?400:503,{error:['unauthorized','forbidden','invalid_platform','invalid_account','invalid_credentials','invalid_oauth_client','invalid_manager','invalid_expiry','meta_token_invalid','meta_permission_denied','meta_account_mismatch','meta_unavailable'].includes(code)?code:'save_unavailable'});}
}
