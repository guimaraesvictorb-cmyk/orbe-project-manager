export type Insight={campaign_id:string;campaign_name:string;date_start:string;spend:number;impressions:number;clicks:number;link_clicks:number}
export function reportPeriod(start:unknown,end:unknown){
 const valid=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v).toISOString().slice(0,10)===v;
 if(!valid(start)||!valid(end)||String(start)>String(end)||(Date.parse(String(end))-Date.parse(String(start)))/86400000>92)throw new Error('invalid_period');
 return {since:String(start),until:String(end)};
}
export function insight(input:Record<string,unknown>):Insight{
 const n=(key:string)=>{const v=Number(input[key]??0);if(!Number.isFinite(v)||v<0)throw new Error('invalid_provider_response');return v};
 return {campaign_id:String(input.campaign_id??''),campaign_name:String(input.campaign_name??'').slice(0,250),date_start:String(input.date_start??''),spend:n('spend'),impressions:n('impressions'),clicks:n('clicks'),link_clicks:n('inline_link_clicks')};
}
export async function metaReport(account:string,token:string,period:{since:string;until:string}){
 if(!/^[1-9][0-9]{5,24}$/.test(account)||!token||/\s/.test(token))throw new Error('invalid_credentials');
 const base=`https://graph.facebook.com/v23.0/act_${account}`;
 async function get(path:string){const r=await fetch(base+path,{headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(12000)});const b=await r.json() as Record<string,unknown>;if(!r.ok||b.error){const code=(b.error as {code?:number})?.code;throw new Error(code===190?'meta_token_invalid':[10,200,294].includes(code??0)?'meta_permission_denied':'meta_unavailable')}return b}
 const fields='spend,impressions,clicks,inline_link_clicks';
 async function read(daily:boolean){const q=new URLSearchParams({fields:daily?`campaign_id,campaign_name,date_start,${fields}`:`${fields},reach,frequency`,time_range:JSON.stringify(period),level:daily?'campaign':'account',limit:'1000'});if(daily)q.set('time_increment','1');const rows:Record<string,unknown>[]=[];for(let page=0;page<5;page++){const b=await get('/insights?'+q);if(!Array.isArray(b.data))throw new Error('invalid_provider_response');rows.push(...b.data);const paging=b.paging as {next?:string;cursors?:{after?:string}}|undefined;if(!paging?.next)return rows;const after=paging.cursors?.after;if(!after||after.length>2048)throw new Error('report_too_large');q.set('after',after)}throw new Error('report_too_large')}
 const [accountInfo,summary,daily]=await Promise.all([get('?fields=account_id,name,currency,timezone_name'),read(false),read(true)]);
 if(String(accountInfo.account_id)!==account)throw new Error('meta_account_mismatch');
 const totals=insight(summary[0]??{});const reach=Number(summary[0]?.reach??0),frequency=Number(summary[0]?.frequency??0);
 return {status:'ready',account_name:String(accountInfo.name??'').slice(0,200),currency:String(accountInfo.currency??''),timezone:String(accountInfo.timezone_name??''),period,totals:{...totals,reach,frequency},daily:daily.map(insight),checked_at:new Date().toISOString()};
}
