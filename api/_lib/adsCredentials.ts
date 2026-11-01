export type AdsPlatform='meta'|'google';
export function adsBinding(client:string,platform:AdsPlatform){return `ads:${client}:${platform}`;}
const secret=(v:unknown,required=true)=>{if(!required&&(v===''||v===undefined))return '';if(typeof v!=='string'||v.length<10||v.length>4096||/\s/.test(v))throw new Error('invalid_credentials');return v;};
export function normalizeAdsCredentials(input:Record<string,unknown>){
 if(!['meta','google'].includes(String(input.platform)))throw new Error('invalid_platform');
 const platform=input.platform as AdsPlatform;
 const account=typeof input.account_id==='string'?input.account_id.replace(/-/g,'').replace(/^act_/,''):'';
 if(!/^[1-9][0-9]{5,24}$/.test(account))throw new Error('invalid_account');
 if(platform==='google'&&account.length!==10)throw new Error('invalid_account');
 if(platform==='meta'){
  const token=secret(input.access_token);let expires:string|null=null;
  if(input.expires_at){const date=String(input.expires_at);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T23:59:59Z'))||new Date(date+'T23:59:59Z').toISOString().slice(0,10)!==date||Date.parse(date+'T23:59:59Z')<=Date.now())throw new Error('invalid_expiry');expires=date+'T23:59:59Z';}
  return {platform,account_id:account,status:'saved_unverified',has_refresh_token:false,expires_at:expires,secrets:{access_token:token}};
 }
 const client=typeof input.oauth_client_id==='string'?input.oauth_client_id.trim():'';
 if(!/^[A-Za-z0-9._-]{5,220}\.apps\.googleusercontent\.com$/.test(client))throw new Error('invalid_oauth_client');
 const clientSecret=secret(input.oauth_client_secret),refresh=secret(input.refresh_token,false),developer=secret(input.developer_token,false);
 const manager=typeof input.manager_id==='string'?input.manager_id.replace(/-/g,''):'';
 if(manager&&!/^[1-9][0-9]{9}$/.test(manager))throw new Error('invalid_manager');
 return {platform,account_id:account,status:refresh?'saved_unverified':'oauth_pending',has_refresh_token:!!refresh,expires_at:null,secrets:{client_id:client,client_secret:clientSecret,refresh_token:refresh,developer_token:developer,manager_id:manager}};
}

// Provider errors are deliberately mapped; their raw bodies can contain credentials.
export async function verifyMetaAccess(account:string,token:string){
 if(!/^[1-9][0-9]{5,24}$/.test(account)||typeof token!=='string'||token.length<10||/\s/.test(token))throw new Error('invalid_credentials');
 async function get(path:string){
  const r=await fetch(`https://graph.facebook.com/v23.0/act_${account}${path}`,{headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(10000)});
  let body:{account_id?:unknown;name?:unknown;error?:{code?:number}};try{body=await r.json() as typeof body}catch{throw new Error('meta_unavailable')}
  if(!body||typeof body!=='object')throw new Error('meta_unavailable');
  if(!r.ok||body.error){const code=body.error?.code;throw new Error(code===190?'meta_token_invalid':[10,200,294].includes(code??0)?'meta_permission_denied':'meta_unavailable')}
  return body;
 }
 const details=await get('?fields=account_id,name,currency,account_status');
 if(String(details.account_id)!==account)throw new Error('meta_account_mismatch');
 // Account metadata alone does not prove campaign-reading permission.
 await get('/campaigns?fields=id&limit=1');
 return {status:'access_verified',account_id:account,account_name:typeof details.name==='string'?details.name.slice(0,200):'',checked_at:new Date().toISOString()};
}
