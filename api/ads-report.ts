import type {ServerResponse} from 'node:http';
import {answer,type Request} from './_lib/trackingServer.js';
import {qrUser} from './_lib/qrAccess.js';
import {ORBE_ORIGIN,object,scalar,unseal} from './_lib/kommo.js';
import {adsBinding} from './_lib/adsCredentials.js';
import {reportPeriod,metaReport} from './_lib/adsReport.js';
import {googleAdsReport} from './_lib/googleAdsReport.js';
export default async function handler(req:Request,res:ServerResponse){
 if(req.method!=='POST')return answer(res,405,{error:'method_not_allowed'});
 if(req.headers.origin!==ORBE_ORIGIN)return answer(res,403,{error:'forbidden'});
 try{const input=object(req.body),client=scalar(input.client_id,36),{db,user}=await qrUser(req,client);
 const profiles=await db<{can_view_financials:boolean}[]>(`rest/v1/profiles?id=eq.${user.id}&select=can_view_financials`);
 // Spend and its derivatives must obey the same financial gate as the existing platform.
 if(!profiles[0]?.can_view_financials)return answer(res,403,{error:'financial_access_required'});
 const period=reportPeriod(input.start,input.end);
 if(!['meta','google'].includes(String(input.platform)))return answer(res,400,{error:'invalid_platform'});
 const platform=input.platform as 'meta'|'google';
 const rows=await db<{account_id:string;ciphertext:string;updated_at:string;status:string}[]>(`rest/v1/wa_ads_credentials?client_id=eq.${client}&platform=eq.${platform}&select=account_id,ciphertext,updated_at,status`);
 if(!rows[0])return answer(res,200,{status:'not_configured'});
 const row=rows[0],secrets=object(JSON.parse(unseal(row.ciphertext,adsBinding(client,platform))));
 const report=platform==='google'?await googleAdsReport(row.account_id,secrets,period):await metaReport(row.account_id,scalar(secrets.access_token,4096),period);
 if(report.status!=='ready')return answer(res,200,report);
 const latest=await db<{updated_at:string}[]>(`rest/v1/wa_ads_credentials?client_id=eq.${client}&platform=eq.${platform}&select=updated_at`);
 if(latest[0]?.updated_at!==row.updated_at)return answer(res,409,{error:'configuration_changed'});
 // The report call itself is proof the credential works — reflect that in
 // the badge instead of requiring a separate trip through Conexões. A
 // direct update (not the admin-only wa_ads_save RPC) because this report
 // endpoint is reachable by any financially-authorized user, not just admins.
 if(row.status!=='access_verified'){
  await db(`rest/v1/wa_ads_credentials?client_id=eq.${client}&platform=eq.${platform}&updated_at=eq.${encodeURIComponent(row.updated_at)}`,{method:'PATCH',body:JSON.stringify({status:'access_verified'})}).catch(()=>{});
 }
 return answer(res,200,report);
 }catch(e){const code=e instanceof Error?e.message:'';return answer(res,['unauthorized','forbidden'].includes(code)?403:code==='invalid_period'?400:503,{error:['invalid_period','meta_token_invalid','meta_permission_denied','report_too_large','meta_account_mismatch','google_oauth_invalid','google_developer_token_denied','google_permission_denied','google_account_mismatch'].includes(code)?code:'report_unavailable'});}
}
