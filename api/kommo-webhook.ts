import type {ServerResponse} from 'node:http';
import {waitUntil} from '@vercel/functions';
import {answer,storage,type Request} from './_lib/trackingServer.js';
import {digest,parseWebhook} from './_lib/kommo.js';
import {deliverAnalytics} from './_lib/ga4Delivery.js';
import {enrich} from './_lib/kommoEnrichment.js';
export default async function handler(req:Request,res:ServerResponse) {
  if(req.method!=='POST')return answer(res,405,{error:'method_not_allowed'});
  const url=new URL(req.url??'','https://studio.agenciaorbe.co'),keys=url.searchParams.getAll('key');
  if(keys.length!==1||!/^[A-Za-z0-9_-]{43}$/.test(keys[0]))return answer(res,401,{error:'unauthorized'});
  if(!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded'))return answer(res,415,{error:'form_required'});
  if(Number(req.headers['content-length']??0)>131072)return answer(res,413,{error:'too_large'});
  let batch;
  try {batch=parseWebhook(req.body);}catch{return answer(res,400,{error:'invalid_event'});}
  try {
    const result=await storage()<{accepted:number;connection_id:string;contact_ids:string[]}>('rest/v1/rpc/wa_kommo_receive',{method:'POST',body:JSON.stringify({p_hash:digest(keys[0]),p_account:batch.account,p_origin:`https://${batch.subdomain}.kommo.com`,p_messages:batch.messages})});
    waitUntil(deliverAnalytics(result.connection_id).catch(()=>{}));
    if(result.contact_ids.length)waitUntil(enrich(result.connection_id,result.contact_ids).catch(()=>{}));
    return answer(res,200,{ok:true,accepted:result.accepted});
  }catch{return answer(res,503,{error:'delivery_not_stored'});}
}
