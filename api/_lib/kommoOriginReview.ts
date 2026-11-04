import {kommoRequest,leadOriginEvidence,unseal} from './kommo.js';
import {storage} from './trackingServer.js';
import type {KommoConfig} from './kommoEnrichment.js';

type Candidate={entity_key:string;occurred_at:string;payload:{kommo_lead_id:string;kommo_contact_id:string}};
// Uses the existing server-held credential. No secret or arbitrary CRM data leaves this boundary.
export async function reviewOrigins(cfg:KommoConfig,start:string|null=null,end:string|null=null) {
  const db=storage(),token=unseal(cfg.token_ciphertext,cfg.client_id);
  const candidates=await db<Candidate[]>('rest/v1/rpc/wa_kommo_origin_candidates',{method:'POST',body:JSON.stringify({p_connection:cfg.connection_id,p_start:start,p_end:end,p_limit:6})});
  const batch=candidates.slice(0,5),leads=new Map<string,Promise<unknown>>();
  for(const row of batch){
    const id=row.payload.kommo_lead_id;
    if(/^[1-9][0-9]{0,18}$/.test(id)&&!leads.has(id))leads.set(id,kommoRequest(cfg.account_origin,token,`/api/v4/leads/${id}?with=contacts`));
  }
  // Attach all rejection handlers before awaiting so one failed CRM read cannot become unhandled.
  const results=await Promise.allSettled([...leads.values()]);
  const fetched=new Map([...leads.keys()].map((id,i)=>[id,results[i]]));
  let reviewed=0,recovered=0,historical=0,missing=0,failed=0;
  for(const row of batch){
    const lead=row.payload.kommo_lead_id,contact=row.payload.kommo_contact_id,result=fetched.get(lead);
    if(!/^[1-9][0-9]{0,18}$/.test(contact)||result?.status!=='fulfilled'){failed++;continue;}
    let evidence;
    try{evidence=leadOriginEvidence(result.value,{account:cfg.account_id,lead,contact});}catch{failed++;continue;}
    if(!evidence){failed++;continue;}
    const saved=await db<string>('rest/v1/rpc/wa_kommo_review_origin',{method:'POST',body:JSON.stringify({p_connection:cfg.connection_id,p_account:cfg.account_id,p_message:row.entity_key,p_contact:contact,p_lead:lead,p_created:evidence.createdAt,p_fields:evidence.fields})});
    if(saved==='stale'){continue;}
    reviewed++;
    if(saved==='recovered')recovered++;else if(saved==='historical')historical++;else missing++;
  }
  return {reviewed,recovered,historical,missing,failed,has_more:candidates.length>5};
}
