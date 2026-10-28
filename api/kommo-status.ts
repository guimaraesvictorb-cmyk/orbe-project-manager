import type {ServerResponse} from 'node:http';
import {waitUntil} from '@vercel/functions';
import {answer,owner,type Request} from './_lib/trackingServer.js';
import {kommoRequest,object,ORBE_ORIGIN,scalar,unseal} from './_lib/kommo.js';
import {enrich,type KommoConfig} from './_lib/kommoEnrichment.js';
export default async function handler(req:Request,res:ServerResponse) {
  if(req.method!=='POST')return answer(res,405,{error:'method_not_allowed'});
  if(req.headers.origin && req.headers.origin!==ORBE_ORIGIN)return answer(res,403,{error:'forbidden'});
  try {
    const client=scalar(object(req.body).client_id,36),{db}=await owner(req,client);
    const configs=await db<KommoConfig[]>(`rest/v1/wa_kommo_credentials?client_id=eq.${client}&limit=1`);
    if(!configs[0])return answer(res,200,{status:'not_connected'});
    const cfg=configs[0],token=unseal(cfg.token_ciphertext,client);
    const hooks=await kommoRequest<{_embedded?:{webhooks?:{destination:string;disabled:boolean;settings:string[]}[]}}|null>(cfg.account_origin,token,'/api/v4/webhooks');
    const expected=`${ORBE_ORIGIN}/api/kommo-webhook?key=${unseal(cfg.webhook_ciphertext,client)}`;
    const installed=hooks?._embedded?.webhooks?.some(h=>h.destination===expected&&!h.disabled&&h.settings.includes('add_message'));
    const states=await db<{last_received_at:string|null}[]>(`rest/v1/wa_tracking_connections?id=eq.${cfg.connection_id}&select=last_received_at`);
    const status=installed?(states[0]?.last_received_at?'receiving':'waiting_message'):'error';
    await db(`rest/v1/wa_tracking_setups?client_id=eq.${client}`,{method:'PATCH',body:JSON.stringify({activation_status:status,activation_error:installed?'':'A Kommo não está enviando os eventos. Reconecte a integração.',last_verified_at:new Date().toISOString()})});
    const pending=await db<{payload:{kommo_contact_id:string}}[]>(`rest/v1/wa_tracking_records?connection_id=eq.${cfg.connection_id}&entity=eq.messages&payload->>identity_checked=eq.false&select=payload&limit=10`);
    if(pending.length)waitUntil(enrich(cfg.connection_id,pending.map(r=>r.payload.kommo_contact_id)).catch(()=>{}));
    return answer(res,200,{status});
  }catch{return answer(res,400,{error:'Não foi possível confirmar a autorização da Kommo. Verifique a chave e as permissões da integração.'});}
}
