type Ga4Response={accountSummaries?:{displayName?:string;propertySummaries?:{property:string;displayName?:string}[]}[];nextPageToken?:string;rows?:Row[];rowCount?:number;displayName?:string;timeZone?:string}
export const analyticsScope='https://www.googleapis.com/auth/analytics.readonly'
export function analyticsProperty(value:unknown){const id=String(value||'').replace(/^properties\//,'');if(!/^\d{4,20}$/.test(id))throw Error('invalid_property');return id}
export function analyticsPeriod(start:unknown,end:unknown){const valid=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;if(!valid(start)||!valid(end)||String(start)>String(end)||Date.parse(String(end))-Date.parse(String(start))>366*86400000)throw Error('invalid_period');return {start:String(start),end:String(end)}}
export function ga4Failure(status:number,body:unknown){const text=JSON.stringify(body);return Error(/SERVICE_DISABLED|API_NOT_ACTIVATED/.test(text)?'ga4_api_disabled':/ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficient authentication scopes/i.test(text)?'ga4_scope_required':status===401?'ga4_reauthorize':status===403?'ga4_permission_denied':'ga4_unavailable')}
export async function ga4Request(token:string,url:string,body?:unknown){
 if(!/^https:\/\/(analyticsadmin|analyticsdata)\.googleapis\.com\//.test(url))throw Error('invalid_provider')
 const response=await fetch(url,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})
 const data=await response.json() as Ga4Response;if(!response.ok)throw ga4Failure(response.status,data);return data
}
export async function ga4Properties(token:string){
 const result:{id:string;name:string;account:string}[]=[];let next=''
 for(let page=0;page<20;page++){
  const params=new URLSearchParams({pageSize:'200',...(next?{pageToken:next}:{})})
  const response=await ga4Request(token,`https://analyticsadmin.googleapis.com/v1beta/accountSummaries?${params}`)
  for(const account of response.accountSummaries||[])for(const property of account.propertySummaries||[])result.push({id:analyticsProperty(property.property),name:String(property.displayName||property.property).slice(0,200),account:String(account.displayName||'').slice(0,200)})
  if(!response.nextPageToken)return result
  next=String(response.nextPageToken)
 }
 throw Error('ga4_report_too_large')
}
type Row={dimensionValues?:{value?:string}[];metricValues?:{value?:string}[]}
export function ga4Metrics(row:Row|undefined){const names=['sessions','totalUsers','screenPageViews','keyEvents'] as const;return Object.fromEntries(names.map((name,i)=>{const value=Number(row?.metricValues?.[i]?.value||0);if(!Number.isFinite(value)||value<0)throw Error('invalid_provider_response');return [name,value]})) as Record<typeof names[number],number>}
export async function ga4Report(token:string,property:string,period:{start:string;end:string}){
 const id=analyticsProperty(property),base={dateRanges:[{startDate:period.start,endDate:period.end}],metrics:['sessions','totalUsers','screenPageViews','keyEvents'].map(name=>({name})),limit:'10000'}
 const [summary,breakdown,metadata]=await Promise.all([
  ga4Request(token,`https://analyticsdata.googleapis.com/v1beta/properties/${id}:runReport`,base),
  ga4Request(token,`https://analyticsdata.googleapis.com/v1beta/properties/${id}:runReport`,{...base,dimensions:[{name:'sessionDefaultChannelGroup'},{name:'sessionSource'}]}),
  ga4Request(token,`https://analyticsadmin.googleapis.com/v1beta/properties/${id}`),
 ])
 if(Number(breakdown.rowCount||0)>(breakdown.rows||[]).length)throw Error('ga4_report_too_large')
 const channels=(breakdown.rows||[]).map((row:Row)=>({channel:String(row.dimensionValues?.[0]?.value||''),source:String(row.dimensionValues?.[1]?.value||''),...ga4Metrics(row)}))
 return {status:'ready',property:id,name:String(metadata.displayName||id),timezone:String(metadata.timeZone||''),period,totals:ga4Metrics(summary.rows?.[0]),channels,google_organic_sessions:channels.filter((r:{channel:string;source:string})=>r.channel==='Organic Search'&&r.source==='google').reduce((n:number,r:{sessions:number})=>n+r.sessions,0),checked_at:new Date().toISOString()}
}
