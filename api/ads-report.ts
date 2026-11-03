import type {ServerResponse} from 'node:http';
import {answer,type Request} from './_lib/trackingServer.js';
import {qrUser} from './_lib/qrAccess.js';
import {ORBE_ORIGIN,object,scalar} from './_lib/kommo.js';
import {metaCredential,markMetaVerified} from './_lib/metaAgency.js';
import {reportPeriod,metaReport} from './_lib/adsReport.js';
import {googleCredential,markGoogleVerified} from './_lib/googleMcc.js';
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
 if(platform==='google'){
  const credential=await googleCredential(db,client);if(credential.status!=='credentials')return answer(res,200,{status:credential.status});
  const report=await googleAdsReport(credential.account_id,credential.secrets,period);if(report.status!=='ready')return answer(res,200,report);
  await markGoogleVerified(db,client,credential.version);return answer(res,200,report);
 }
 const credential=await metaCredential(db,client);
 if(credential.status!=='credentials')return answer(res,200,{status:credential.status});
 const report=await metaReport(credential.account_id,credential.token,period);
 if(report.status!=='ready')return answer(res,200,report);
 await markMetaVerified(db,client,credential);
 return answer(res,200,report);
 }catch(e){const code=e instanceof Error?e.message:'';return answer(res,['unauthorized','forbidden'].includes(code)?403:code==='invalid_period'?400:503,{error:['invalid_period','meta_token_invalid','meta_permission_denied','report_too_large','meta_account_mismatch','google_oauth_invalid','google_developer_token_denied','google_cloud_access_required','google_cloud_api_disabled','google_permission_denied','google_account_mismatch'].includes(code)?code:'report_unavailable'});}
}
