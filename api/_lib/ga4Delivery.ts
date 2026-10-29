import {storage} from './trackingServer.js';
import {unseal} from './kommo.js';
import {analyticsPayload,type AnalyticsJob} from './ga4.js';
/** Claim before sending; ambiguous network failures require review, never blind resend. */
export async function deliverAnalytics(connectionId:string) {
 const db=storage();
 const jobs=await db<AnalyticsJob[]>('rest/v1/rpc/wa_ga4_claim',{method:'POST',body:JSON.stringify({p_connection:connectionId})});
 for(const job of jobs) {
  let status='failed',error='configuration_unavailable';
  try {
   const configs=await db<{secret_ciphertext:string}[]>(`rest/v1/wa_ga4_streams?connection_id=eq.${connectionId}&measurement_id=eq.${job.measurement_id}&enabled=eq.true&select=secret_ciphertext&limit=1`);
   if(!configs[0])throw Error('configuration_unavailable');
   const payload=analyticsPayload(job);
   const secret=unseal(configs[0].secret_ciphertext,`ga4:${connectionId}:${job.measurement_id}`);
   const url=new URL('https://www.google-analytics.com/mp/collect');url.searchParams.set('measurement_id',job.measurement_id);url.searchParams.set('api_secret',secret);
   status='uncertain';error='delivery_unknown';
   const response=await fetch(url,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});
   if(response.ok){status='submitted';error=''}else{status='failed';error=`http_${response.status}`;}
  } catch(e) {if(status!=='uncertain')error=e instanceof Error&&e.message==='expired_session'?'expired_session':'configuration_unavailable';}
  await db(`rest/v1/wa_ga4_outbox?id=eq.${job.id}&status=eq.sending`,{method:'PATCH',body:JSON.stringify({status,last_error:error,updated_at:new Date().toISOString()})});
 }
}
