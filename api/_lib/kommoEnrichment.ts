import {contactIdentity,kommoRequest,leadAttribution,unseal} from './kommo.js';
import {storage} from './trackingServer.js';
export type KommoConfig={connection_id:string;client_id:string;account_id:string;account_origin:string;token_ciphertext:string;webhook_ciphertext:string;enabled:boolean};
export async function enrich(connectionId:string,ids:string[],retry=true) {
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
    } catch {continue;} // Message is already durable. Verification retries missing identities.
  }
  const since=new Date(Date.now()-86400000).toISOString();
  type Pending={entity_key:string;occurred_at:string;payload:{kommo_lead_id:string;kommo_contact_id:string}};
  const pending=await db<Pending[]>(`rest/v1/wa_tracking_records?connection_id=eq.${connectionId}&entity=eq.messages&payload->>attribution_reason=eq.no_reference&occurred_at=gte.${since}&select=entity_key,occurred_at,payload&order=occurred_at.desc&limit=20`);
  const leads=new Map<string,unknown>();
  for(const row of pending) {
    const leadId=row.payload.kommo_lead_id,contact=row.payload.kommo_contact_id;
    if(!/^[1-9][0-9]{0,18}$/.test(leadId)||!/^[1-9][0-9]{0,18}$/.test(contact))continue;
    try {
      if(!leads.has(leadId)) {
        if(leads.size>=10)break;
        leads.set(leadId,await kommoRequest(cfg.account_origin,token,`/api/v4/leads/${leadId}?with=contacts`));
      }
      const attribution=leadAttribution(leads.get(leadId),{account:cfg.account_id,lead:leadId,contact,messageAt:row.occurred_at});
      if(attribution)await db('rest/v1/rpc/wa_kommo_attribution',{method:'POST',body:JSON.stringify({p_connection:connectionId,p_account:cfg.account_id,p_message:row.entity_key,p_contact:contact,p_lead:leadId,p_created:attribution.createdAt,p_fields:attribution.fields})});
    } catch {continue;}
  }
  // Native ad metadata can arrive just after the message webhook. Retry once;
  // subsequent incoming events and the connection check also retry pending rows.
  if(retry&&pending.length){await new Promise(resolve=>setTimeout(resolve,8000));await enrich(connectionId,[],false);}
}
