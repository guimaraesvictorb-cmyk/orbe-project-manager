import type {ServerResponse} from 'node:http';
import {answer,storage,type Request} from './trackingServer.js';
import {object,seal,unseal} from './kommo.js';
import {adsBinding} from './adsCredentials.js';
import {googleMccInventory} from './googleMccInventory.js';
type Db=ReturnType<typeof storage>;
export type MccConfig={manager_id:string;credential_client_id:string|null;enabled:boolean;manager_name:string|null;checked_at:string|null;updated_at:string};
type Account={account_id:string;account_name:string;client_id:string|null;present:boolean;is_manager:boolean;currency:string|null;timezone:string|null;provider_status:string;updated_at:string;verified_version:string|null;verified_at:string|null};
type Stored={account_id:string;ciphertext:string;updated_at:string;has_refresh_token:boolean;status:string;expires_at:string|null};
export async function mccConfig(db:Db){return (await db<MccConfig[]>('rest/v1/orbe_google_mcc?id=eq.true&select=manager_id,credential_client_id,enabled,manager_name,checked_at,updated_at'))[0]??null;}
async function stored(db:Db,client:string){return (await db<Stored[]>(`rest/v1/wa_ads_credentials?client_id=eq.${client}&platform=eq.google&select=account_id,ciphertext,updated_at,has_refresh_token,status,expires_at`))[0]??null;}
export async function isMccCredentialSource(db:Db,client:string){const cfg=await mccConfig(db);return !!cfg&&cfg.credential_client_id===client;}

export async function googleCredential(db:Db,client:string){
 const [cfg,mapped]=await Promise.all([mccConfig(db),db<Account[]>(`rest/v1/orbe_google_mcc_accounts?client_id=eq.${client}&select=account_id,account_name,client_id,present,is_manager,currency,timezone,provider_status,updated_at,verified_version,verified_at`)]);
 if(mapped.length>1)throw Error('google_account_mismatch');
 const link=mapped[0];
 if(link){
  if(!cfg?.enabled||!cfg.credential_client_id)return {status:'not_configured' as const};
  if(!link.present||link.is_manager)return {status:'mcc_account_unavailable' as const};
  const source=await stored(db,cfg.credential_client_id);if(!source)return {status:'not_configured' as const};
  const secrets={...object(JSON.parse(unseal(source.ciphertext,adsBinding(cfg.credential_client_id,'google')))),manager_id:cfg.manager_id};
  return {status:'credentials' as const,account_id:link.account_id,secrets,version:[source.updated_at,cfg.updated_at,link.updated_at].join('|'),has_refresh_token:source.has_refresh_token,expires_at:source.expires_at,credential_status:link.verified_version===[source.updated_at,cfg.updated_at,link.updated_at].join('|')&&link.verified_at?'access_verified':'saved_unverified',updated_at:source.updated_at,mcc_id:cfg.manager_id,source_client_id:cfg.credential_client_id,mapped:true};
 }
 const row=await stored(db,client);if(!row)return {status:'not_configured' as const};
 if(cfg?.credential_client_id===client&&!cfg.enabled)return {status:'not_configured' as const};
 const manager=cfg?.enabled&&cfg.credential_client_id===client?cfg.manager_id:null;
 const secrets={...object(JSON.parse(unseal(row.ciphertext,adsBinding(client,'google')))),...(manager?{manager_id:manager}:{})};
 return {status:'credentials' as const,account_id:row.account_id,secrets,version:[row.updated_at,manager?cfg?.updated_at:''].join('|'),has_refresh_token:row.has_refresh_token,expires_at:row.expires_at,credential_status:row.status,updated_at:row.updated_at,mcc_id:manager,source_client_id:client,mapped:false};
}
export async function googleMetadata(db:Db,client:string){
 const [cfg,links]=await Promise.all([mccConfig(db),db<Account[]>(`rest/v1/orbe_google_mcc_accounts?client_id=eq.${client}&select=account_id,present,is_manager,updated_at,verified_version,verified_at`)]);
 const link=links[0];if(!link&&cfg?.credential_client_id!==client)return null;
 const sourceId=link?cfg?.credential_client_id:client;
 const source=sourceId?(await db<Array<Omit<Stored,'ciphertext'>>>(`rest/v1/wa_ads_credentials?client_id=eq.${sourceId}&platform=eq.google&select=account_id,updated_at,has_refresh_token,status,expires_at`))[0]:null;
 const available=!!cfg?.enabled&&!!source&&(!link||link.present&&!link.is_manager),version=source&&cfg&&link?[source.updated_at,cfg.updated_at,link.updated_at].join('|'):null;
 const verified=link?!!link.verified_at&&link.verified_version===version:source?.status==='access_verified'&&Date.parse(source.updated_at)>=Date.parse(cfg?.updated_at??'');
 return {platform:'google',account_id:link?.account_id??source?.account_id??'',status:!available?'not_configured':!source?.has_refresh_token?'oauth_pending':verified?'access_verified':'saved_unverified',has_refresh_token:available&&!!source?.has_refresh_token,expires_at:source?.expires_at??null,updated_at:source?.updated_at??cfg?.updated_at??'',mcc_id:cfg?.manager_id,managed_by_mcc:true};
}
export async function markGoogleVerified(db:Db,client:string,version:string){
 const latest=await googleCredential(db,client);if(latest.status!=='credentials'||latest.version!==version)throw Error('configuration_changed');
 if(latest.mapped)await db(`rest/v1/orbe_google_mcc_accounts?client_id=eq.${client}&account_id=eq.${latest.account_id}`,{method:'PATCH',body:JSON.stringify({verified_version:version,verified_at:new Date().toISOString()})});
 else await db(`rest/v1/wa_ads_credentials?client_id=eq.${client}&platform=eq.google&updated_at=eq.${encodeURIComponent(latest.updated_at)}`,{method:'PATCH',body:JSON.stringify({status:'access_verified'})});
}
async function administrator(req:Request){
 const auth=req.headers.authorization??'';if(!/^Bearer [A-Za-z0-9_.-]+$/.test(auth))throw Error('unauthorized');
 const db=storage();let user:{id:string};try{user=await db('auth/v1/user',{},auth.slice(7))}catch{throw Error('unauthorized')}
 const profiles=await db<{role:string;is_active:boolean;can_view_financials:boolean}[]>(`rest/v1/profiles?id=eq.${user.id}&select=role,is_active,can_view_financials`);
 if(!profiles[0]?.is_active||profiles[0].role!=='admin'||!profiles[0].can_view_financials)throw Error('owner_required');return {db,user};
}
async function status(db:Db){
 const [config,accounts,sources]=await Promise.all([mccConfig(db),db<Account[]>('rest/v1/orbe_google_mcc_accounts?select=account_id,account_name,client_id,present,is_manager,currency,timezone,provider_status,updated_at,verified_version,verified_at&order=account_name'),db<Array<{client_id:string;account_id:string;has_refresh_token:boolean;updated_at:string}>>('rest/v1/wa_ads_credentials?platform=eq.google&select=client_id,account_id,has_refresh_token,updated_at')]);
 return {configuration:config,accounts,sources};
}
export async function googleMccAdmin(req:Request,res:ServerResponse){
 let stage='authorization';
 try{
  const {db,user}=await administrator(req),input=object(req.body),action=String(input.action);
  if(action==='mcc_status')return answer(res,200,await status(db));
  stage='read_configuration';const cfg=await mccConfig(db);
  if((cfg?.updated_at??null)!==(input.expected_version??null))return answer(res,409,{error:'configuration_changed'});
  if(action==='mcc_configure'){
   const manager=typeof input.manager_id==='string'?input.manager_id.replace(/-/g,''):'',source=String(input.credential_client_id??'');
   if(!/^[1-9]\d{9}$/.test(manager)||!/^[0-9a-f-]{36}$/.test(source))throw Error('invalid_configuration');
   stage='read_credential_metadata';const row=await stored(db,source);if(!row)throw Error('credentials_missing');
   stage='validate_protected_registration';
   const secrets=object(JSON.parse(unseal(row.ciphertext,adsBinding(source,'google'))));if(typeof secrets.client_id!=='string'||typeof secrets.client_secret!=='string')throw Error('credentials_missing');
   stage='write_configuration';await db('rest/v1/rpc/orbe_mcc_configure',{method:'POST',body:JSON.stringify({p_manager:manager,p_source:source,p_expected:input.expected_version??null,p_actor:user.id})});
  }else if(action==='mcc_inventory'){
   if(!cfg?.enabled||!cfg.credential_client_id)throw Error('credentials_missing');const source=await stored(db,cfg.credential_client_id);if(!source)throw Error('credentials_missing');
   const inventory=await googleMccInventory(cfg.manager_id,object(JSON.parse(unseal(source.ciphertext,adsBinding(cfg.credential_client_id,'google')))));
   if(inventory.status!=='ready')return answer(res,200,{...await status(db),inventory_status:inventory.status});
   await db('rest/v1/rpc/orbe_mcc_inventory',{method:'POST',body:JSON.stringify({p_manager:cfg.manager_id,p_name:inventory.manager_name,p_accounts:inventory.accounts,p_expected:cfg.updated_at,p_source_version:source.updated_at,p_actor:user.id})});
  }else if(action==='mcc_map'){
   const account=String(input.account_id??''),target=input.target_client_id?String(input.target_client_id):null;
   if(!/^\d{10}$/.test(account)||target&&!/^[0-9a-f-]{36}$/.test(target))throw Error('invalid_mapping');
   await db('rest/v1/rpc/orbe_mcc_map',{method:'POST',body:JSON.stringify({p_account:account,p_client:target,p_expected:cfg?.updated_at??null,p_actor:user.id})});
  }else if(action==='mcc_developer'){
   if(!cfg?.credential_client_id)throw Error('credentials_missing');const developer=String(input.developer_token??'');if(developer.length<10||developer.length>4096||/\s/.test(developer))throw Error('invalid_credentials');
   const row=await stored(db,cfg.credential_client_id);if(!row)throw Error('credentials_missing');
   const secrets=object(JSON.parse(unseal(row.ciphertext,adsBinding(cfg.credential_client_id,'google'))));
   await db('rest/v1/rpc/orbe_mcc_developer',{method:'POST',body:JSON.stringify({p_ciphertext:seal(JSON.stringify({...secrets,developer_token:developer}),adsBinding(cfg.credential_client_id,'google')),p_actor:user.id,p_expected:cfg.updated_at,p_source_version:row.updated_at})});
  }else if(action==='mcc_disable'){
   const updated=await db<Array<{id:boolean}>>(`rest/v1/orbe_google_mcc?id=eq.true&updated_at=eq.${encodeURIComponent(cfg?.updated_at??'')}`,{method:'PATCH',body:JSON.stringify({enabled:false,updated_at:new Date().toISOString(),updated_by:user.id})});if(updated.length!==1)throw Error('configuration_changed');
  }else return answer(res,400,{error:'invalid_action'});
  stage='read_saved_configuration';return answer(res,200,await status(db));
 }catch(cause){const code=cause instanceof Error?cause.message:'';const allowed=['unauthorized','owner_required','invalid_configuration','invalid_mapping','invalid_credentials','credentials_missing','configuration_changed','google_oauth_invalid','google_developer_token_denied','google_cloud_access_required','google_cloud_api_disabled','google_permission_denied','google_unavailable','google_not_manager','google_incomplete_inventory','google_inventory_too_large'];
  if(!allowed.includes(code)){const detail=cause instanceof Error?cause.cause:undefined,dbCode=detail&&typeof detail==='object'&&'code' in detail?detail.code:null;console.error('orbe_google_mcc_failure',{stage,code:code==='storage_unavailable'?'storage_unavailable':code==='encryption_not_configured'?'encryption_not_configured':'internal_error',database_code:typeof dbCode==='string'&&/^[A-Z0-9]{5,10}$/.test(dbCode)?dbCode:null})}
  return answer(res,code==='unauthorized'||code==='owner_required'?403:code.startsWith('invalid_')?400:503,{error:allowed.includes(code)?code:'mcc_unavailable'});}
}
