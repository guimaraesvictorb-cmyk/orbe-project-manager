type Secrets={client_id?:unknown;client_secret?:unknown;refresh_token?:unknown;developer_token?:unknown};
export type MccAccount={id:string;name:string;manager:boolean;currency:string|null;timezone:string|null;status:string;level:number};
const token=(value:unknown)=>typeof value==='string'&&value.length<=4096&&!/\s/.test(value)?value:'';
const id=(value:unknown)=>/^\d{10}$/.test(String(value??''))?String(value):null;

// The manager hierarchy is read through customer_client. All transitive
// descendants are returned; no campaign, user or account settings are changed.
// https://developers.google.com/google-ads/api/docs/account-management/get-account-hierarchy
export async function googleMccInventory(managerId:string,secrets:Secrets) {
 const deadline=Date.now()+45000;
 if(!/^[1-9]\d{9}$/.test(managerId))throw Error('invalid_manager');
 const refresh=token(secrets.refresh_token),developer=token(secrets.developer_token);
 if(!refresh)return {status:'oauth_pending' as const};
 if(!developer)return {status:'developer_token_required' as const};
 const client=token(secrets.client_id),clientSecret=token(secrets.client_secret);
 if(!client||!clientSecret)throw Error('invalid_credentials');
 const auth=await fetch('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:client,client_secret:clientSecret,refresh_token:refresh})});
 const oauth=await auth.json() as {access_token?:unknown;error?:string};
 if(!auth.ok||!token(oauth.access_token))throw Error(['invalid_grant','invalid_client'].includes(oauth.error??'')?'google_oauth_invalid':'google_unavailable');
 const version=/^v\d+$/.test(process.env.GOOGLE_ADS_API_VERSION??'')?process.env.GOOGLE_ADS_API_VERSION:'v26';
 const headers={Authorization:`Bearer ${token(oauth.access_token)}`,'developer-token':developer,'login-customer-id':managerId,'Content-Type':'application/json'};
 async function search(query:string) {
  const rows:Record<string,unknown>[]=[],seen=new Set<string>();let next:string|undefined;
  for(let page=0;page<20;page++) {
   if(Date.now()>deadline)throw Error('google_incomplete_inventory');
   const response=await fetch(`https://googleads.googleapis.com/${version}/customers/${managerId}/googleAds:search`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers,body:JSON.stringify({query,...(next?{pageToken:next}:{})})});
   const body=await response.json() as {results?:Record<string,unknown>[];nextPageToken?:unknown;error?:unknown};
   if(!response.ok||body.error){const code=JSON.stringify(body.error??{});throw Error(/DEVELOPER_TOKEN/.test(code)?'google_developer_token_denied':response.status===401?'google_oauth_invalid':response.status===403?'google_permission_denied':'google_unavailable')}
   if(body.results&&!Array.isArray(body.results))throw Error('google_unavailable');
   rows.push(...body.results??[]);if(rows.length>5000)throw Error('google_inventory_too_large');
   if(!body.nextPageToken)return rows;
   if(typeof body.nextPageToken!=='string'||body.nextPageToken.length>4096||seen.has(body.nextPageToken))throw Error('google_incomplete_inventory');
   next=body.nextPageToken;seen.add(next);
  }
  throw Error('google_incomplete_inventory');
 }
 const managers=await search('SELECT customer.id, customer.descriptive_name, customer.manager FROM customer LIMIT 1');
 const manager=managers[0]?.customer as Record<string,unknown>|undefined;
 if(id(manager?.id)!==managerId||manager?.manager!==true)throw Error('google_not_manager');
 const rows=await search('SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.currency_code, customer_client.time_zone, customer_client.status, customer_client.level FROM customer_client');
 const accounts=new Map<string,MccAccount>();
 for(const row of rows){const account=row.customerClient as Record<string,unknown>|undefined,accountId=id(account?.id);if(!account||!accountId)throw Error('google_incomplete_inventory');
  const value:MccAccount={id:accountId,name:String(account.descriptiveName??accountId).slice(0,240),manager:account.manager===true,currency:/^[A-Z]{3}$/.test(String(account.currencyCode??''))?String(account.currencyCode):null,timezone:typeof account.timeZone==='string'?account.timeZone.slice(0,100):null,status:String(account.status??'UNKNOWN').slice(0,30),level:Number.isSafeInteger(Number(account.level))?Number(account.level):0};
  if(accounts.has(accountId)&&JSON.stringify(accounts.get(accountId))!==JSON.stringify(value))throw Error('google_incomplete_inventory');accounts.set(accountId,value);
 }
 if(!accounts.size)throw Error('google_incomplete_inventory');
 return {status:'ready' as const,manager_id:managerId,manager_name:String(manager?.descriptiveName??managerId).slice(0,240),accounts:[...accounts.values()],checked_at:new Date().toISOString()};
}
export function exactMccMatches(accounts:MccAccount[],clients:Array<{id:string;google_ads_account_id?:string|null}>) {
 const used=new Set<string>();return accounts.filter(account=>!account.manager).map(account=>{
  const matches=clients.filter(client=>String(client.google_ads_account_id??'').replace(/-/g,'')===account.id);
  const selected=matches.length===1&&!used.has(matches[0].id)?matches[0].id:null;if(selected)used.add(selected);
  return {account_id:account.id,client_id:selected};
 });
}
