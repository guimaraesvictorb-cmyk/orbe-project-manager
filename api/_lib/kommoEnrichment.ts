import {contactIdentity,kommoRequest,unseal} from './kommo.js';
import {storage} from './trackingServer.js';
export type KommoConfig={connection_id:string;client_id:string;account_id:string;account_origin:string;token_ciphertext:string;webhook_ciphertext:string;enabled:boolean};
export async function enrich(connectionId:string,ids:string[]) {
  const db=storage();
  const configs=await db<KommoConfig[]>(`rest/v1/wa_kommo_credentials?connection_id=eq.${connectionId}&enabled=eq.true&limit=1`);
  if(!configs[0])return;
  const cfg=configs[0],token=unseal(cfg.token_ciphertext,cfg.client_id);
  for(const id of [...new Set(ids)].slice(0,10)) {
    if(!/^[1-9][0-9]{0,18}$/.test(id))continue;
    try {
      const contact=await kommoRequest(cfg.account_origin,token,`/api/v4/contacts/${id}`);
      const value=contactIdentity(contact);
      await db('rest/v1/rpc/wa_kommo_identity',{method:'POST',body:JSON.stringify({p_connection:connectionId,p_contact:id,p_name:value.name,p_phone:value.phone,p_phone_status:value.phone_status})});
    } catch {return;} // Message is already durable. Verification retries missing identities.
  }
}
