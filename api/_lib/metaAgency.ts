import type {ServerResponse} from 'node:http';
import {answer,storage,type Request} from './trackingServer.js';
import {object,unseal,scalar} from './kommo.js';
import {adsBinding,verifyMetaAccess} from './adsCredentials.js';
type Db=ReturnType<typeof storage>;
type Config={source_client_id:string;enabled:boolean;updated_at:string};
type Link={client_id:string;account_id:string;account_name:string;source_version:string;configuration_version:string;verified_at:string;updated_at:string};
type Stored={account_id:string;ciphertext:string;updated_at:string;status:string;expires_at:string|null};
export async function metaAgencyConfig(db:Db){return (await db<Config[]>('rest/v1/orbe_meta_agency?id=eq.true&select=source_client_id,enabled,updated_at'))[0]??null;}
async function stored(db:Db,client:string){return (await db<Stored[]>(`rest/v1/wa_ads_credentials?client_id=eq.${client}&platform=eq.meta&select=account_id,ciphertext,updated_at,status,expires_at`))[0]??null;}
export async function metaCredential(db:Db,client:string){
 const [cfg,links]=await Promise.all([metaAgencyConfig(db),db<Link[]>(`rest/v1/orbe_meta_accounts?client_id=eq.${client}&select=client_id,account_id,account_name,source_version,configuration_version,verified_at,updated_at`)]);
 const link=links[0];if(links.length>1)throw Error('meta_account_mismatch');
 if(link&&!cfg?.enabled)return {status:'not_configured' as const};
 const sourceId=link?cfg!.source_client_id:client,row=await stored(db,sourceId);
 if(!row)return {status:'not_configured' as const};
 const secrets=object(JSON.parse(unseal(row.ciphertext,adsBinding(sourceId,'meta'))));
 return {status:'credentials' as const,account_id:link?.account_id??row.account_id,token:scalar(secrets.access_token,4096),sourceId,sourceVersion:row.updated_at,configurationVersion:link?cfg!.updated_at:null,linkVersion:link?.updated_at??null,mapped:!!link};
}
export async function metaMetadata(db:Db,client:string){
 const [cfg,links]=await Promise.all([metaAgencyConfig(db),db<Link[]>(`rest/v1/orbe_meta_accounts?client_id=eq.${client}&select=client_id,account_id,account_name,source_version,configuration_version,verified_at,updated_at`)]);
 const link=links[0];if(!link)return null;
 const row=cfg?(await db<Omit<Stored,'ciphertext'>[]>(`rest/v1/wa_ads_credentials?client_id=eq.${cfg.source_client_id}&platform=eq.meta&select=account_id,updated_at,status,expires_at`))[0]:null;
 const verified=!!row&&link.source_version===row.updated_at&&link.configuration_version===cfg?.updated_at;
 return {platform:'meta',account_id:link.account_id,status:!cfg?.enabled||!row?'not_configured':verified?'access_verified':'saved_unverified',has_refresh_token:false,expires_at:row?.expires_at??null,updated_at:link.updated_at,managed_by_agency:true};
}
export async function markMetaVerified(db:Db,client:string,credential:Awaited<ReturnType<typeof metaCredential>>){
 if(credential.status!=='credentials')throw Error('credentials_missing');
 const latest=await metaCredential(db,client);
 if(latest.status!=='credentials'||latest.account_id!==credential.account_id||latest.sourceVersion!==credential.sourceVersion||latest.configurationVersion!==credential.configurationVersion||latest.linkVersion!==credential.linkVersion)throw Error('configuration_changed');
 if(credential.mapped)await db(`rest/v1/orbe_meta_accounts?client_id=eq.${client}&updated_at=eq.${encodeURIComponent(credential.linkVersion!)}`,{method:'PATCH',body:JSON.stringify({source_version:credential.sourceVersion,configuration_version:credential.configurationVersion,verified_at:new Date().toISOString()})});
 else await db(`rest/v1/wa_ads_credentials?client_id=eq.${client}&platform=eq.meta&updated_at=eq.${encodeURIComponent(credential.sourceVersion)}`,{method:'PATCH',body:JSON.stringify({status:'access_verified'})});
}
async function administrator(req:Request){
 const auth=req.headers.authorization??'';if(!/^Bearer [A-Za-z0-9_.-]+$/.test(auth))throw Error('unauthorized');
 const db=storage();let user:{id:string};try{user=await db('auth/v1/user',{},auth.slice(7))}catch{throw Error('unauthorized')}
 const rows=await db<{is_active:boolean;role:string;can_view_financials:boolean}[]>(`rest/v1/profiles?id=eq.${user.id}&select=is_active,role,can_view_financials`);
 if(!rows[0]?.is_active||rows[0].role!=='admin'||!rows[0].can_view_financials)throw Error('owner_required');
 return {db,user};
}
async function registry(db:Db){
 const [configuration,accounts,sources]=await Promise.all([metaAgencyConfig(db),db<Link[]>('rest/v1/orbe_meta_accounts?select=client_id,account_id,account_name,source_version,configuration_version,verified_at,updated_at&order=account_name'),db<{client_id:string;account_id:string;status:string}[]>('rest/v1/wa_ads_credentials?platform=eq.meta&select=client_id,account_id,status')]);
 return {configuration,accounts,sources:sources.map(({client_id,account_id,status})=>({client_id,account_id,status}))};
}
export async function metaAgencyAdmin(req:Request,res:ServerResponse){
 try{
  const {db,user}=await administrator(req),input=object(req.body),action=String(input.action);
  if(action==='meta_agency_status')return answer(res,200,await registry(db));
  const cfg=await metaAgencyConfig(db);
  if((cfg?.updated_at??null)!==(input.expected_version??null))return answer(res,409,{error:'configuration_changed'});
  if(action==='meta_agency_configure'){
   const source=scalar(input.source_client_id,36);if(!/^[0-9a-f-]{36}$/.test(source))throw Error('invalid_client');
   const row=await stored(db,source);if(!row)throw Error('credentials_missing');
   const secrets=object(JSON.parse(unseal(row.ciphertext,adsBinding(source,'meta'))));
   await verifyMetaAccess(row.account_id,scalar(secrets.access_token,4096));
   await db('rest/v1/rpc/orbe_meta_configure',{method:'POST',body:JSON.stringify({p_source:source,p_source_version:row.updated_at,p_expected:cfg?.updated_at??null,p_actor:user.id})});
  }else if(action==='meta_agency_bind'){
   if(!cfg?.enabled)throw Error('credentials_missing');
   const client=scalar(input.client_id,36),account=scalar(input.account_id,30).replace(/^act_/,'');
   if(!/^[0-9a-f-]{36}$/.test(client)||!/^[1-9][0-9]{5,24}$/.test(account))throw Error('invalid_account');
   if((await db<{id:string}[]>(`rest/v1/clients?id=eq.${client}&deleted_at=is.null&select=id`)).length!==1)throw Error('invalid_client');
   const [row,links]=await Promise.all([stored(db,cfg.source_client_id),db<Link[]>(`rest/v1/orbe_meta_accounts?client_id=eq.${client}&select=updated_at`)]);if(!row)throw Error('credentials_missing');
   const secrets=object(JSON.parse(unseal(row.ciphertext,adsBinding(cfg.source_client_id,'meta'))));
   const verified=await verifyMetaAccess(account,scalar(secrets.access_token,4096));
   await db('rest/v1/rpc/orbe_meta_map',{method:'POST',body:JSON.stringify({p_client:client,p_account:account,p_name:verified.account_name,p_source_version:row.updated_at,p_expected:cfg.updated_at,p_link_expected:links[0]?.updated_at??null,p_actor:user.id})});
  }else if(action==='meta_agency_disable'){
   const changed=await db<{id:boolean}[]>(`rest/v1/orbe_meta_agency?id=eq.true&updated_at=eq.${encodeURIComponent(cfg?.updated_at??'')}`,{method:'PATCH',body:JSON.stringify({enabled:false,updated_at:new Date().toISOString(),updated_by:user.id})});
   if(changed.length!==1)throw Error('configuration_changed');
  }else return answer(res,400,{error:'invalid_action'});
  return answer(res,200,await registry(db));
 }catch(cause){const detail=cause instanceof Error?cause.cause:undefined;const duplicate=detail&&typeof detail==='object'&&'code' in detail&&detail.code==='23505';const code=duplicate?'account_already_linked':cause instanceof Error?cause.message:'',allowed=['account_already_linked','unauthorized','owner_required','invalid_client','invalid_account','credentials_missing','configuration_changed','meta_token_invalid','meta_permission_denied','meta_account_mismatch','meta_unavailable'];return answer(res,['unauthorized','owner_required'].includes(code)?403:code.startsWith('invalid_')?400:503,{error:allowed.includes(code)?code:'meta_agency_unavailable'});}
}
