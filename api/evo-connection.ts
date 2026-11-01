import type {ServerResponse} from 'node:http';
import {answer,type Request} from './_lib/trackingServer.js';
import {qrUser} from './_lib/qrAccess.js';
import {object,ORBE_ORIGIN,scalar,seal,unseal} from './_lib/kommo.js';
import {evoBinding,evoCredentials,verifyEvo} from './_lib/evo.js';
export default async function handler(req:Request,res:ServerResponse){
 if(req.method!=='POST')return answer(res,405,{error:'method_not_allowed'});
 if(req.headers.origin!==ORBE_ORIGIN)return answer(res,403,{error:'forbidden'});
 if(!req.headers['content-type']?.startsWith('application/json'))return answer(res,415,{error:'json_required'});
 try{
  if(Buffer.byteLength(JSON.stringify(req.body)??'')>16384)return answer(res,413,{error:'too_large'});
  const input=object(req.body),client=scalar(input.client_id,36),{db,user}=await qrUser(req,client);
  const profiles=await db<{role:string;can_view_financials:boolean}[]>(`rest/v1/profiles?id=eq.${user.id}&select=role,can_view_financials`);
  if(profiles[0]?.role!=='admin'||!profiles[0]?.can_view_financials)return answer(res,403,{error:'financial_admin_required'});
  const slot=scalar(input.slot,40)||'principal';if(!/^[a-z0-9_-]{1,40}$/.test(slot))throw new Error('invalid_slot');
  if(input.action==='save'){
   const secret=evoCredentials(input),expiry=scalar(input.expires_at,10);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(expiry)||!Number.isFinite(Date.parse(expiry))||new Date(expiry).toISOString().slice(0,10)!==expiry||Date.parse(expiry+'T23:59:59Z')<=Date.now())throw new Error('invalid_expiry');
   // Save atomically with version comparison, encrypted and client-bound. No token is returned.
   await db('rest/v1/rpc/wa_evo_save',{method:'POST',body:JSON.stringify({p_client:client,p_slot:slot,p_ciphertext:seal(JSON.stringify(secret),evoBinding(client,slot)),p_expiry:expiry+'T23:59:59Z',p_actor:user.id,p_expected:input.expected_version??null})});
  }else if(input.action==='verify'){
   const rows=await db<{ciphertext:string;updated_at:string;expires_at:string}[]>(`rest/v1/wa_evo_credentials?client_id=eq.${client}&slot=eq.${slot}&select=ciphertext,updated_at,expires_at`);
   const row=rows[0];if(!row)return answer(res,404,{error:'credentials_missing'});
   if(Date.parse(row.expires_at)<=Date.now())return answer(res,400,{error:'evo_expired'});
   const verification=await verifyEvo(evoCredentials(object(JSON.parse(unseal(row.ciphertext,evoBinding(client,slot))))));
   const updated=await db<{slot:string}[]>(`rest/v1/wa_evo_credentials?client_id=eq.${client}&slot=eq.${slot}&updated_at=eq.${encodeURIComponent(row.updated_at)}`,{method:'PATCH',body:JSON.stringify({branches:verification.branches,checked_scopes:verification.checked,checked_at:verification.checked_at})});
   if(!updated.length)return answer(res,409,{error:'configuration_changed'});
  }else if(input.action!=='status')return answer(res,400,{error:'invalid_action'});
  const configurations=await db(`rest/v1/wa_evo_credentials?client_id=eq.${client}&select=slot,expires_at,updated_at,branches,checked_scopes,checked_at&order=slot`);
  return answer(res,200,{configurations});
 }catch(e){const code=e instanceof Error?e.message:'';const allowed=['unauthorized','forbidden','invalid_credentials','invalid_slot','invalid_expiry','evo_expired','evo_access_denied','evo_permission_denied','evo_rate_limited','evo_unavailable','evo_invalid_response','evo_response_too_large'];return answer(res,['unauthorized','forbidden'].includes(code)?403:code.startsWith('invalid_')?400:503,{error:allowed.includes(code)?code:'evo_save_unavailable'});}
}
