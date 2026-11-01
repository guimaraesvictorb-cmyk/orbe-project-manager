import type {ServerResponse} from 'node:http';
import {randomBytes} from 'node:crypto';
import {answer,storage,type Request} from './_lib/trackingServer.js';
import {qrUser} from './_lib/qrAccess.js';
import {ORBE_ORIGIN,object,scalar,seal,unseal} from './_lib/kommo.js';
import {validSlug,hashAccessCode,checkAccessCode,sessionCookie,sessionAllowed,clearSessionCookie,attemptKey,accessSlug} from './_lib/dashboardAccess.js';
import {reportPeriod} from './_lib/adsReport.js';
import {dashboardHash,dashboardBinding,dashboardLink,clientDashboardData,clientDashboardMedia,type DashboardLink} from './_lib/clientDashboard.js';
export default async function handler(req:Request,res:ServerResponse){
 res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');res.setHeader('Referrer-Policy','no-referrer');
 if(req.method!=='POST')return answer(res,405,{error:'method_not_allowed'});
 if(req.headers.origin!==ORBE_ORIGIN)return answer(res,403,{error:'forbidden'});
 if(!req.headers['content-type']?.startsWith('application/json'))return answer(res,415,{error:'json_required'});
 try{if(Buffer.byteLength(JSON.stringify(req.body)??'')>4096)return answer(res,413,{error:'too_large'});
 const input=object(req.body),action=String(input.action??'');
 const version=(row:DashboardLink)=>row.updated_at+':'+row.token_hash;
 const slug=typeof input.slug==='string'?input.slug.toLowerCase():'';
 const bySlug=async(db:ReturnType<typeof storage>)=>{if(!validSlug(slug))throw new Error('access_denied');const links=await db<DashboardLink[]>(`rest/v1/wa_dashboard_links?public_slug=eq.${slug}&enabled=eq.true&select=client_id,enabled,include_media,updated_at,token_hash,public_slug,access_code_salt,access_code_hash`);if(links.length!==1||!links[0].access_code_hash||!links[0].access_code_salt)throw new Error('access_denied');return links[0]};
 if(action==='access_status'){try{const link=await bySlug(storage());return answer(res,200,{ready:true,authenticated:sessionAllowed(req,link.client_id,version(link))})}catch{return answer(res,200,{ready:false,authenticated:false})}}
 if(action==='lock'){res.setHeader('Set-Cookie',clearSessionCookie());return answer(res,200,{authenticated:false})}
 if(action==='unlock'){
  const db=storage();if(!validSlug(slug))return answer(res,401,{error:'access_denied'});
  let link:DashboardLink;try{link=await bySlug(db)}catch{return answer(res,401,{error:'access_denied'})}
  const allowed=await db<boolean>('rest/v1/rpc/wa_dashboard_access_attempt',{method:'POST',body:JSON.stringify({p_key:attemptKey(req,slug)})});if(!allowed)return answer(res,429,{error:'too_many_attempts'});
  if(!await checkAccessCode(input.code,link.access_code_salt!,link.access_code_hash!))return answer(res,401,{error:'access_denied'});
  res.setHeader('Set-Cookie',sessionCookie(link.client_id,version(link)));return answer(res,200,{authenticated:true});
 }
 if(['view','media'].includes(action)){
 const db=storage(),link=slug?await bySlug(db):await dashboardLink(db,input.token);if(slug&&!sessionAllowed(req,link.client_id,version(link)))return answer(res,401,{error:'access_denied'});const period=reportPeriod(input.start,input.end),unit=String(input.unit??'all');if(!['all','alecrim','ibes','itapua','unassigned'].includes(unit))return answer(res,400,{error:'invalid_unit'});
 const platform=String(input.platform??'meta');if(action==='media'&&!['meta','google'].includes(platform))return answer(res,400,{error:'invalid_platform'});
 const data=action==='view'?await clientDashboardData(db,link.client_id,period.since,period.until,unit):await clientDashboardMedia(db,link,period.since,period.until,platform);
 const latest=slug?await bySlug(db):await dashboardLink(db,input.token);if(latest.client_id!==link.client_id||latest.updated_at!==link.updated_at||latest.token_hash!==link.token_hash)throw new Error('link_unavailable');
 return answer(res,200,data);
 }
 const client=scalar(input.client_id,36),{db,user}=await qrUser(req,client);
 const profiles=await db<{role:string;can_view_financials:boolean}[]>(`rest/v1/profiles?id=eq.${user.id}&select=role,can_view_financials`);if(profiles[0]?.role!=='admin'||!profiles[0]?.can_view_financials)return answer(res,403,{error:'owner_required'});
 if(action==='preview'){const period=reportPeriod(input.start,input.end);return answer(res,200,await clientDashboardData(db,client,period.since,period.until,'all'))}
 if(!['status','enable','disable','set_code'].includes(action))return answer(res,400,{error:'invalid_action'});
 let rows=await db<DashboardLink[]>(`rest/v1/wa_dashboard_links?client_id=eq.${client}&select=client_id,token_hash,token_ciphertext,enabled,include_media,updated_at,public_slug,access_code_hash`);
 if(action==='set_code'){
  const code=await hashAccessCode(input.code),names=await db<{name:string}[]>(`rest/v1/clients?id=eq.${client}&select=name`);if(!names[0])throw new Error('forbidden');
  const proposed=rows[0]?.public_slug||accessSlug(names[0].name,client),collisions=await db<{client_id:string}[]>(`rest/v1/wa_dashboard_links?public_slug=eq.${proposed}&select=client_id`),publicSlug=collisions.some(r=>r.client_id!==client)?proposed+'-'+client.slice(0,8):proposed;
  const token=randomBytes(32).toString('base64url');const changed=await db<DashboardLink[]>('rest/v1/wa_dashboard_links',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({client_id:client,public_slug:publicSlug,access_code_salt:code.salt,access_code_hash:code.hash,token_hash:dashboardHash(token),token_ciphertext:seal(token,dashboardBinding(client)),enabled:true,created_by:user.id,updated_at:new Date().toISOString()})});
  res.setHeader('Set-Cookie',sessionCookie(client,version(changed[0])));
 }
 else if(action==='enable'&&!rows[0]?.access_code_hash)return answer(res,400,{error:'code_required'});
 else if(action==='enable'||action==='disable'){await db(`rest/v1/wa_dashboard_links?client_id=eq.${client}`,{method:'PATCH',body:JSON.stringify({enabled:action==='enable',updated_at:new Date().toISOString()})});}
 rows=await db<DashboardLink[]>(`rest/v1/wa_dashboard_links?client_id=eq.${client}&select=client_id,token_hash,token_ciphertext,enabled,include_media,updated_at,public_slug,access_code_hash`);
 const row=rows[0];return answer(res,200,{enabled:row?.enabled??false,protected:Boolean(row?.access_code_hash),short_url:row?.public_slug?`${ORBE_ORIGIN}/#/${row.public_slug}/VISAO-CLIENTE`:null,url:row?.access_code_hash&&row.public_slug?`${ORBE_ORIGIN}/#/${row.public_slug}/VISAO-CLIENTE`:row?`${ORBE_ORIGIN}/#/cliente/${unseal(row.token_ciphertext,dashboardBinding(client))}`:null});
 }catch(e){const code=e instanceof Error?e.message:'';return answer(res,['forbidden','unauthorized'].includes(code)?403:code==='access_denied'?401:code==='invalid_access_code'?400:code==='link_unavailable'?404:code==='invalid_period'?400:503,{error:['forbidden','unauthorized','link_unavailable','invalid_period','report_too_large','access_denied','invalid_access_code'].includes(code)?code:'dashboard_unavailable'});}
}
