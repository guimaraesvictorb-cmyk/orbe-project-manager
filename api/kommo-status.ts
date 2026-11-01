import type {ServerResponse} from 'node:http';
import {waitUntil} from '@vercel/functions';
import {answer,owner,type Request} from './_lib/trackingServer.js';
import {ensureKommoWebhook,type KommoWebhooks,kommoRequest,object,ORBE_ORIGIN,scalar,unseal} from './_lib/kommo.js';
import {enrich,type KommoConfig} from './_lib/kommoEnrichment.js';
export default async function handler(req:Request,res:ServerResponse) {
  if(req.method!=='POST')return answer(res,405,{error:'method_not_allowed'});
  if(req.headers.origin && req.headers.origin!==ORBE_ORIGIN)return answer(res,403,{error:'forbidden'});
  let phase='session';
  try {
    const client=scalar(object(req.body).client_id,36),{db}=await owner(req,client);
    phase='configuration';
    const configs=await db<KommoConfig[]>(`rest/v1/wa_kommo_credentials?client_id=eq.${client}&limit=1`);
    if(!configs[0])return answer(res,200,{status:'not_connected'});
    const cfg=configs[0],token=unseal(cfg.token_ciphertext,client);
    phase='read_events';
    const hooks=await kommoRequest<KommoWebhooks|null>(cfg.account_origin,token,'/api/v4/webhooks');
    const expected=`${ORBE_ORIGIN}/api/kommo-webhook?key=${unseal(cfg.webhook_ciphertext,client)}`;
    phase='subscribe_events';
    await ensureKommoWebhook(cfg.account_origin,token,expected,hooks);
    const installed=true;phase='coverage';
    await db('rest/v1/wa_service_settings?on_conflict=connection_id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates'},body:JSON.stringify({connection_id:cfg.connection_id})});
    await db(`rest/v1/wa_service_settings?connection_id=eq.${cfg.connection_id}&capture_ready_at=is.null`,{method:'PATCH',body:JSON.stringify({capture_ready_at:new Date().toISOString()})});
    phase='read_state';
    const states=await db<{last_received_at:string|null}[]>(`rest/v1/wa_tracking_connections?id=eq.${cfg.connection_id}&select=last_received_at`);
    const status=installed?(states[0]?.last_received_at?'receiving':'waiting_message'):'error';
    await db(`rest/v1/wa_tracking_setups?client_id=eq.${client}`,{method:'PATCH',body:JSON.stringify({activation_status:status,activation_error:installed?'':'A Kommo não está enviando os eventos. Reconecte a integração.',last_verified_at:new Date().toISOString()})});
    phase='pending';
    const pending=await db<{payload:{kommo_contact_id:string}}[]>(`rest/v1/wa_tracking_records?connection_id=eq.${cfg.connection_id}&entity=eq.messages&payload->>identity_checked=eq.false&select=payload&limit=10`);
    waitUntil(enrich(cfg.connection_id,pending.map(r=>r.payload.kommo_contact_id)).catch(()=>{}));
    return answer(res,200,{status});
  }catch(error){const code=error instanceof Error?error.message:'';const known=['forbidden','unauthorized','storage_unavailable','kommo_token_invalid','kommo_permission_denied','webhook_not_confirmed','kommo_unavailable'];const detail=known.includes(code)?code:'verification_failed';console.error('KOMMO_VERIFY',phase,detail);return answer(res,400,{error:`Não foi possível verificar a conexão (${phase}: ${detail}). O recebimento existente permanece configurado.`});}
}
