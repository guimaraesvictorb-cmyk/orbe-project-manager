import type {ServerResponse} from 'node:http';
import {randomBytes} from 'node:crypto';
import {answer,storage,type Request} from './_lib/trackingServer.js';
import {qrUser} from './_lib/qrAccess.js';
import {ORBE_ORIGIN,object,scalar,seal,unseal} from './_lib/kommo.js';
import {reportPeriod} from './_lib/adsReport.js';
import {dashboardHash,dashboardBinding,dashboardLink,clientDashboardData,clientDashboardMedia,type DashboardLink} from './_lib/clientDashboard.js';
export default async function handler(req:Request,res:ServerResponse){
 res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');res.setHeader('Referrer-Policy','no-referrer');
 if(req.method!=='POST')return answer(res,405,{error:'method_not_allowed'});
 if(req.headers.origin!==ORBE_ORIGIN)return answer(res,403,{error:'forbidden'});
 if(!req.headers['content-type']?.startsWith('application/json'))return answer(res,415,{error:'json_required'});
 try{if(Buffer.byteLength(JSON.stringify(req.body)??'')>4096)return answer(res,413,{error:'too_large'});
 const input=object(req.body),action=String(input.action??'');
 if(['view','media'].includes(action)){
 const db=storage(),link=await dashboardLink(db,input.token),period=reportPeriod(input.start,input.end),unit=String(input.unit??'all');if(!['all','alecrim','ibes','itapua','unassigned'].includes(unit))return answer(res,400,{error:'invalid_unit'});
 const platform=String(input.platform??'meta');if(action==='media'&&!['meta','google'].includes(platform))return answer(res,400,{error:'invalid_platform'});
 const data=action==='view'?await clientDashboardData(db,link.client_id,period.since,period.until,unit):await clientDashboardMedia(db,link,period.since,period.until,platform);
 const latest=await dashboardLink(db,input.token);if(latest.client_id!==link.client_id||latest.updated_at!==link.updated_at)throw new Error('link_unavailable');
 return answer(res,200,data);
 }
 const client=scalar(input.client_id,36),{db,user}=await qrUser(req,client);
 const profiles=await db<{role:string;can_view_financials:boolean}[]>(`rest/v1/profiles?id=eq.${user.id}&select=role,can_view_financials`);if(profiles[0]?.role!=='admin'||!profiles[0]?.can_view_financials)return answer(res,403,{error:'owner_required'});
 if(action==='preview'){const period=reportPeriod(input.start,input.end);return answer(res,200,await clientDashboardData(db,client,period.since,period.until,'all'))}
 if(!['status','enable','disable'].includes(action))return answer(res,400,{error:'invalid_action'});
 let rows=await db<DashboardLink[]>(`rest/v1/wa_dashboard_links?client_id=eq.${client}&select=client_id,token_hash,token_ciphertext,enabled,include_media,updated_at`);
 if(action==='enable'&&!rows[0]){const token=randomBytes(32).toString('base64url');await db('rest/v1/wa_dashboard_links',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({client_id:client,token_hash:dashboardHash(token),token_ciphertext:seal(token,dashboardBinding(client)),created_by:user.id})});}
 else if(action==='enable'||action==='disable'){await db(`rest/v1/wa_dashboard_links?client_id=eq.${client}`,{method:'PATCH',body:JSON.stringify({enabled:action==='enable',updated_at:new Date().toISOString()})});}
 rows=await db<DashboardLink[]>(`rest/v1/wa_dashboard_links?client_id=eq.${client}&select=client_id,token_hash,token_ciphertext,enabled,include_media,updated_at`);
 const row=rows[0];return answer(res,200,{enabled:row?.enabled??false,url:row?`${ORBE_ORIGIN}/#/cliente/${unseal(row.token_ciphertext,dashboardBinding(client))}`:null});
 }catch(e){const code=e instanceof Error?e.message:'';return answer(res,['forbidden','unauthorized'].includes(code)?403:code==='link_unavailable'?404:code==='invalid_period'?400:503,{error:['forbidden','unauthorized','link_unavailable','invalid_period','report_too_large'].includes(code)?code:'dashboard_unavailable'});}
}
