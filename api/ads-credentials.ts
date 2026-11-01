import type {ServerResponse} from 'node:http';
import {answer,type Request} from './_lib/trackingServer.js';
import {qrUser} from './_lib/qrAccess.js';
import {object,ORBE_ORIGIN,scalar,seal} from './_lib/kommo.js';
import {adsBinding,normalizeAdsCredentials} from './_lib/adsCredentials.js';
export default async function handler(req:Request,res:ServerResponse){
 if(req.method!=='POST')return answer(res,405,{error:'method_not_allowed'});
 if(req.headers.origin!==ORBE_ORIGIN)return answer(res,403,{error:'forbidden'});
 if(!req.headers['content-type']?.startsWith('application/json'))return answer(res,415,{error:'json_required'});
 try{
  if(Buffer.byteLength(JSON.stringify(req.body)??'')>32768)return answer(res,413,{error:'too_large'});
  const input=object(req.body),client=scalar(input.client_id,36),{db,user}=await qrUser(req,client);
  const profiles=await db<{role:string}[]>(`rest/v1/profiles?id=eq.${user.id}&select=role`);
  if(profiles[0]?.role!=='admin')return answer(res,403,{error:'admin_required'});
  if(input.action==='save'){
   const value=normalizeAdsCredentials(input);
   const current=await db<{updated_at:string}[]>(`rest/v1/wa_ads_credentials?client_id=eq.${client}&platform=eq.${value.platform}&select=updated_at`);
   if((current[0]?.updated_at??null)!==(input.expected_version??null))return answer(res,409,{error:'configuration_changed'});
   const cipher=seal(JSON.stringify(value.secrets),adsBinding(client,value.platform));
   await db('rest/v1/rpc/wa_ads_save',{method:'POST',body:JSON.stringify({p_client:client,p_platform:value.platform,p_account:value.account_id,p_ciphertext:cipher,p_status:value.status,p_refresh:value.has_refresh_token,p_expiry:value.expires_at,p_actor:user.id,p_expected:input.expected_version??null})});
  }else if(input.action!=='status')return answer(res,400,{error:'invalid_action'});
  const configurations=await db(`rest/v1/wa_ads_credentials?client_id=eq.${client}&select=platform,account_id,status,has_refresh_token,expires_at,updated_at&order=platform`);
  return answer(res,200,{configurations});
 }catch(error){const code=error instanceof Error?error.message:'';return answer(res,['unauthorized','forbidden'].includes(code)?403:code.startsWith('invalid_')?400:503,{error:['unauthorized','forbidden','invalid_platform','invalid_account','invalid_credentials','invalid_oauth_client','invalid_manager','invalid_expiry'].includes(code)?code:'save_unavailable'});}
}
