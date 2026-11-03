import {createHash} from 'node:crypto';
import type {ServerResponse} from 'node:http';
import {answer,type Request} from './_lib/trackingServer.js';
import {qrUser} from './_lib/qrAccess.js';
import {object,ORBE_ORIGIN,scalar,seal,unseal} from './_lib/kommo.js';
import {evoMemberRevenue} from './_lib/evoRevenue.js';
import {metaReport} from './_lib/adsReport.js';
import {googleCredential} from './_lib/googleMcc.js';
import {googleAdsReport} from './_lib/googleAdsReport.js';
import {adsBinding} from './_lib/adsCredentials.js';
import {observedMetaCac} from './_lib/evoReconciliation.js';
import {attributeEvoCandidates,evoLeadSources,type EvoCandidate} from './_lib/evoAttribution.js';
import {evoPreviewPeriod,evoEnrollmentPreview} from './_lib/evoPreview.js';
import {EvoReadError,evoBinding,evoCredentials,verifyEvo} from './_lib/evo.js';
export default async function handler(req:Request,res:ServerResponse){
 if(req.method!=='POST')return answer(res,405,{error:'method_not_allowed'});
 if(req.headers.origin!==ORBE_ORIGIN)return answer(res,403,{error:'forbidden'});
 if(!req.headers['content-type']?.startsWith('application/json'))return answer(res,415,{error:'json_required'});
 try{
  if(Buffer.byteLength(JSON.stringify(req.body)??'')>16384)return answer(res,413,{error:'too_large'});
  const input=object(req.body),client=scalar(input.client_id,36),{db,user}=await qrUser(req,client);
  const profiles=await db<{role:string;can_view_financials:boolean}[]>(`rest/v1/profiles?id=eq.${user.id}&select=role,can_view_financials`);
  if(profiles[0]?.role!=='admin'||!profiles[0]?.can_view_financials)return answer(res,403,{error:'financial_admin_required'});
  const slot=scalar(input.slot??'principal',40)||'principal';if(!/^[a-z0-9_-]{1,40}$/.test(slot))throw new Error('invalid_slot');
  if(input.action==='preview'||input.action==='report'){
   const period=evoPreviewPeriod(input.start,input.end);
   const scope=typeof input.preview_scope==='string'?input.preview_scope:'all';if(!/^[a-z0-9_-]{1,40}$/.test(scope))throw new Error('invalid_slot');
   const configurations=await db<{slot:string;ciphertext?:string;updated_at:string;expires_at:string;branches:{id:number;name:string}[];checked_at:string|null}[]>(`rest/v1/wa_evo_credentials?client_id=eq.${client}${scope==='all'?'':`&slot=eq.${scope}`}&select=slot,updated_at,${input.action==='preview'?'ciphertext,':''}expires_at,branches,checked_at&order=slot`);
   if(!configurations.length)return input.action==='report'?answer(res,200,{status:'not_configured'}):answer(res,404,{error:'credentials_missing'});
   const version=createHash('sha256').update(JSON.stringify(configurations.map(c=>[c.slot,c.updated_at,c.checked_at,c.branches]))).digest('hex');
   if(input.action==='report'){
    const snapshots=await db<{report:unknown;credential_version:string}[]>(`rest/v1/wa_evo_snapshots?client_id=eq.${client}&start_date=eq.${period.start}&end_date=eq.${period.end}&scope=eq.${scope}&select=report,credential_version`);
    if(!snapshots[0])return answer(res,200,{status:'missing'});if(snapshots[0].credential_version!==version)return answer(res,200,{status:'configuration_changed'});
    return answer(res,200,{status:'ready',preview:snapshots[0].report});
   }
   const candidates:EvoCandidate[]=[];const used=new Set<number>();
   for(const row of configurations){
    if(!row.checked_at||Date.parse(row.expires_at)<=Date.now())return answer(res,400,{error:'evo_unverified_connection'});
    if(row.branches.length!==1||used.has(row.branches[0]!.id))return answer(res,400,{error:'evo_overlapping_scope'});
    used.add(row.branches[0]!.id);
   }
   const results=await Promise.all(configurations.map(async row=>{
    const secret=evoCredentials(object(JSON.parse(unseal(row.ciphertext!,evoBinding(client,row.slot)))));
    return {slot:row.slot,branch:row.branches[0],...await evoEnrollmentPreview(secret,period.start,period.end,row.branches[0]!.id,c=>candidates.push(c),client==='589481f6-3a15-4c93-b384-5d33373c20e3'?'-03:00':undefined)};
   }));
   const matched:EvoCandidate[]=[];const origins=new Map<string,string>();const leads=await evoLeadSources(db,client),attribution=attributeEvoCandidates(candidates,leads,(candidate,source)=>{if(['Google','Meta','Site','Instagram'].includes(source)){matched.push(candidate);origins.set(candidate.key,source)}}),coverageStart=leads.length?new Date(Math.min(...leads.map(l=>Date.parse(l.at)))-10800000).toISOString().slice(0,10):null;
   let cac=observedMetaCac({scope,start:period.start,coverageStart,students:attribution.channels.Meta??0,spendCents:null});
   if(cac.status==='spend_pending')try{
    const ads=await db<{account_id:string;ciphertext:string}[]>(`rest/v1/wa_ads_credentials?client_id=eq.${client}&platform=eq.meta&select=account_id,ciphertext`);
    if(ads[0]){const credentials=object(JSON.parse(unseal(ads[0].ciphertext,adsBinding(client,'meta'))));const media=await metaReport(ads[0].account_id,scalar(credentials.access_token,4096),{since:period.start,until:period.end});cac=observedMetaCac({scope,start:period.start,coverageStart,students:attribution.channels.Meta??0,spendCents:Math.round(media.totals.spend*100),currency:media.currency,timezone:media.timezone})}
   }catch{/* Enrollment results remain useful when the ads provider is unavailable. */}
   let googleCac=observedMetaCac({scope,start:period.start,coverageStart,students:attribution.channels.Google??0,spendCents:null});
   if(googleCac.status==='spend_pending')try{
    const ads=await googleCredential(db,client);
    if(ads.status==='credentials'){const media=await googleAdsReport(ads.account_id,ads.secrets,{since:period.start,until:period.end});if(media.status==='ready')googleCac=observedMetaCac({scope,start:period.start,coverageStart,students:attribution.channels.Google??0,spendCents:Math.round(media.totals.spend*100),currency:media.currency,timezone:media.timezone})}
   }catch{/* Missing Google authorization never becomes zero spend. */}
   const allBranchesCovered=client!=='589481f6-3a15-4c93-b384-5d33373c20e3'||['ibes','alecrim','itapua'].every(slot=>configurations.some(row=>row.slot===slot));
   if(!allBranchesCovered){cac={status:'unit_spend_pending',amount_cents:null};googleCac={status:'unit_spend_pending',amount_cents:null}}
   const checkedAt=new Date().toISOString();let ltv:{status:string;amount_cents:number|null;revenue_cents?:number;students?:number;as_of?:string}={status:!matched.length?'no_attributed_students':matched.length>8?'budget_pending':'financial_reconciliation_pending',amount_cents:null};
   const ltvChannels:Record<string,{status:string;amount_cents:number|null;students?:number}>={};
   if(matched.length>0&&matched.length<=8&&client==='589481f6-3a15-4c93-b384-5d33373c20e3')try{
    let revenue=0;const channelRevenue=new Map<string,{cents:number;students:number}>();
    for(const candidate of matched){const [branch,member]=candidate.key.split(':').map(Number),row=configurations.find(c=>c.branches[0]?.id===branch);if(!row||!candidate.at)throw new Error('evo_financial_scope');const credential=evoCredentials(object(JSON.parse(unseal(row.ciphertext!,evoBinding(client,row.slot)))));const cents=await evoMemberRevenue(credential,branch!,member!,candidate.at,checkedAt);revenue+=cents;const source=origins.get(candidate.key)!;const group=channelRevenue.get(source)??{cents:0,students:0};group.cents+=cents;group.students++;channelRevenue.set(source,group)}
    ltv={status:'realized_observed',amount_cents:Math.round(revenue/matched.length),revenue_cents:revenue,students:matched.length,as_of:checkedAt};
    for(const [source,group] of channelRevenue)ltvChannels[source]={status:'realized_observed',amount_cents:Math.round(group.cents/group.students),students:group.students};
   }catch{/* Credits, refunds or incomplete receipt data keep LTV explicitly pending. */}
   const preview={period,units:results,attribution,coverage_start:coverageStart,cac_meta:cac,cac_google:googleCac,ltv,ltv_channels:ltvChannels,checked_at:checkedAt};
   await db('rest/v1/wa_evo_snapshots?on_conflict=client_id,start_date,end_date,scope',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({client_id:client,start_date:period.start,end_date:period.end,scope,credential_version:version,report:preview,updated_at:preview.checked_at,updated_by:user.id})});
   return answer(res,200,{status:'ready',preview});
  }
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
 }catch(e){const code=e instanceof Error?e.message:'';const allowed=['unauthorized','forbidden','invalid_credentials','invalid_slot','invalid_expiry','invalid_period','evo_expired','evo_access_denied','evo_permission_denied','evo_rate_limited','evo_unavailable','evo_invalid_response','evo_response_too_large','evo_member_probe_pending','evo_preview_too_large'];return answer(res,['unauthorized','forbidden'].includes(code)?403:code.startsWith('invalid_')?400:503,{error:allowed.includes(code)?code:'evo_save_unavailable',...(e instanceof EvoReadError?{diagnostic:{endpoint:e.endpoint,http_status:e.httpStatus}}:{})});}
}
