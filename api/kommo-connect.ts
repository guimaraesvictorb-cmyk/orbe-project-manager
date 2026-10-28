import {randomBytes} from 'node:crypto';
import {answer,owner,type Request} from './_lib/trackingServer.js';
import type {ServerResponse} from 'node:http';
import {decimal,digest,ensureKommoWebhook,kommoOrigin,kommoRequest,object,ORBE_ORIGIN,scalar,seal,unseal,type KommoWebhooks} from './_lib/kommo.js';
import type {KommoConfig} from './_lib/kommoEnrichment.js';
export default async function handler(req:Request,res:ServerResponse) {
  if(req.method!=='POST')return answer(res,405,{error:'method_not_allowed'});
  if(req.headers.origin && req.headers.origin!==ORBE_ORIGIN)return answer(res,403,{error:'forbidden'});
  if(!req.headers['content-type']?.startsWith('application/json'))return answer(res,415,{error:'json_required'});
  try {
    if(Buffer.byteLength(JSON.stringify(req.body))>16384)return answer(res,413,{error:'too_large'});
    const input=object(req.body),clientId=scalar(input.client_id,36);
    const {db,user}=await owner(req,clientId);
    if(input.authorize!==true)return answer(res,400,{error:'authorization_required'});
    const origin=kommoOrigin(input.account_url),token=scalar(input.access_token,8192),destination=scalar(input.destination,15);
    if(!/^[A-Za-z0-9_.-]{80,8192}$/.test(token)||!/^55[1-9][0-9]{9,10}$/.test(destination))return answer(res,400,{error:'invalid_credentials_or_phone'});
    const account=await kommoRequest<{id:number;name:string;subdomain:string}>(origin,token,'/api/v4/account');
    const accountId=decimal(account.id);
    if(`${account.subdomain}.kommo.com`!==new URL(origin).hostname)throw new Error('account_mismatch');
    // Check admin/webhook permission before creating any local connection.
    const hooks=await kommoRequest<KommoWebhooks|null>(origin,token,'/api/v4/webhooks');
    const previous=await db<KommoConfig[]>(`rest/v1/wa_kommo_credentials?client_id=eq.${clientId}&limit=1`);
    if(previous[0]&&(previous[0].account_origin!==origin||previous[0].account_id!==accountId))return answer(res,409,{error:'account_already_bound'});
    const secret=previous[0]?unseal(previous[0].webhook_ciphertext,clientId):randomBytes(32).toString('base64url');
    const id=await db<string>('rest/v1/rpc/wa_kommo_prepare',{method:'POST',body:JSON.stringify({p_client_id:clientId,p_owner:user.id,p_account_id:accountId,p_origin:origin,p_name:scalar(account.name,100),p_destination:destination,p_token:seal(token,clientId),p_webhook:seal(secret,clientId),p_hash:digest(secret)})});
    const destinationUrl=`${ORBE_ORIGIN}/api/kommo-webhook?key=${secret}`;
    const hook=await ensureKommoWebhook(origin,token,destinationUrl,hooks);
    await db('rest/v1/rpc/wa_kommo_enable',{method:'POST',body:JSON.stringify({p_connection:id,p_webhook_id:String(hook.id)})});
    return answer(res,200,{ok:true,connection_id:id,status:'waiting_message',account_name:account.name});
  }catch(error){
    const code=error instanceof Error?error.message:'connection_failed';
    const safe=['unauthorized','forbidden','invalid_account','kommo_token_invalid','kommo_permission_denied','kommo_unavailable','encryption_not_configured','account_mismatch','webhook_not_confirmed'].includes(code)?code:'connection_failed';
    // Never include credentials, callback URLs or upstream response bodies in logs or responses.
    return answer(res,['unauthorized','forbidden'].includes(safe)?403:400,{error:safe});
  }
}
