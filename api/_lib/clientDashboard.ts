import {createHash} from 'node:crypto';
import {storage} from './trackingServer.js';
import {dayBrt,unitOf,dailyLeads} from '../../src/lib/biDashboard.js';
import {campaignName,firstContacts,trackingChannel} from '../../src/lib/trackingDashboard.js';
import {commercialContacts,type CommercialOutcome,type ConversationEvent,type ServiceSettings} from '../../src/lib/commercialTracking.js';
import {contactChannel,recoveredContactOrigin} from '../../src/lib/originReview.js';
import {comparisonPeriod} from '../../src/lib/clientAnalytics.js';
import type {TrackingRecord} from '../../src/lib/whatsappTracking.js';
import {metaReport} from './adsReport.js';
import {googleCredential} from './googleMcc.js';
import {googleAdsReport} from './googleAdsReport.js';
import {adsBinding} from './adsCredentials.js';
import {object,unseal} from './kommo.js';
export const dashboardHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export const dashboardBinding=(client:string)=>`dashboard:${client}`;
export function validDashboardToken(value:unknown):value is string{return typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value)}
type Db=ReturnType<typeof storage>;
type Connection={id:string;name:string};
export type DashboardLink={client_id:string;token_hash:string;token_ciphertext:string;enabled:boolean;include_media:boolean;updated_at:string;public_slug?:string|null;access_code_hash?:string|null;access_code_salt?:string|null};
export async function dashboardLink(db:Db,token:unknown){
 if(!validDashboardToken(token))throw new Error('link_unavailable');
 const rows=await db<DashboardLink[]>(`rest/v1/wa_dashboard_links?token_hash=eq.${dashboardHash(token)}&enabled=eq.true&select=client_id,token_hash,token_ciphertext,enabled,include_media,updated_at,public_slug,access_code_hash`);
 if(rows.length!==1||rows[0].access_code_hash)throw new Error('link_unavailable');return rows[0];
}
async function all<T>(db:Db,table:string,connection:string,select:string,order:string,extra=''){
 const out:T[]=[];for(let offset=0;offset<20000;offset+=1000){const rows=await db<T[]>(`rest/v1/${table}?connection_id=eq.${connection}&select=${select}&order=${order}&limit=1000&offset=${offset}${extra}`);out.push(...rows);if(rows.length<1000)return out}throw new Error('report_too_large');
}
export function aggregateClientDashboard(sources:{connection:string;records:TrackingRecord[];events:ConversationEvent[];outcomes:CommercialOutcome[];settings:ServiceSettings|null}[],start:string,end:string,unit='all'){
 const channels:Record<string,number>=Object.create(null),nativeChannels:Record<string,number>=Object.create(null),units:Record<string,number>={alecrim:0,ibes:0,itapua:0,unassigned:0};
 const bucket=()=>({total:0,native:0,won:0,answered:0,waiting:0,late:0,lost:0,review:0,partial:0,rows:[] as TrackingRecord[]});
 const total=bucket(),segments=new Map<string,ReturnType<typeof bucket>>(),unitSegments=new Map<string,ReturnType<typeof bucket>>(),campaigns=new Map<string,{channel:string;name:string;leads:number;bucket:ReturnType<typeof bucket>}>();let coverage:string|null=null;
 const increment=(b:ReturnType<typeof bucket>,row:TrackingRecord,state:string)=>{b.total++;b.rows.push(row);if(trackingChannel(row.payload)!=='Origem não identificada')b.native++;if(state==='won')b.won++;if(['answered','won'].includes(state))b.answered++;if(['waiting','late'].includes(state))b.waiting++;if(state==='late')b.late++;if(state==='lost')b.lost++;if(state==='review')b.review++;if(state==='partial')b.partial++};
 for(const source of sources){
  const first=firstContacts(source.records,null,null),selected=firstContacts(source.records,`${start}T03:00:00.000Z`,new Date(Date.parse(`${end}T03:00:00Z`)+86400000).toISOString()).filter(r=>unit==='all'||unitOf(r.payload)===unit);
  if(first[0]&&(!coverage||first[0].occurred_at<coverage))coverage=first[0].occurred_at;
  const commercial=source.settings?commercialContacts(source.records,source.events,source.outcomes,source.settings,`${start}T03:00:00Z`,new Date(Date.parse(`${end}T03:00:00Z`)+86400000).toISOString(),'',new Date().toISOString(),source.connection):[];
  const statuses=new Map(commercial.map(r=>[r.id,r.state]));
  for(const row of selected){
   const native=trackingChannel(row.payload),verified=contactChannel(row),channel=verified==='Origem não identificada'?native:verified,history=recoveredContactOrigin(row),name=campaignName(history&&!history.origin_return_context?history:row.payload,source.connection),key=channel+'\0'+name,whichUnit=unitOf(row.payload),state=statuses.get(String(row.payload.contact_id||row.payload.sender_id))??'partial';
   channels[channel]=(channels[channel]??0)+1;nativeChannels[native]=(nativeChannels[native]??0)+1;units[whichUnit]++;
   const segment=segments.get(channel)??bucket(),unitSegment=unitSegments.get(whichUnit)??bucket(),campaign=campaigns.get(key)??{channel,name,leads:0,bucket:bucket()};campaign.leads++;
   for(const b of [total,segment,unitSegment,campaign.bucket])increment(b,row,state);
   segments.set(channel,segment);unitSegments.set(whichUnit,unitSegment);campaigns.set(key,campaign);
  }
 }
 const finish=(b:ReturnType<typeof bucket>)=>{const {rows,...metrics}=b;return {...metrics,daily:dailyLeads(rows,start,end)}};
 const {total:count,native:_native,daily,...funnel}=finish(total);void _native;
 // Whitelisted aggregates only. No identities, message content, CRM IDs or
 // attribution evidence are serialized into the client-facing response.
 return {total:count,identified:count-(channels['Origem não identificada']??0),channels,native_channels:nativeChannels,units,segments:Object.fromEntries([...segments].map(([key,b])=>[key,finish(b)])),unit_segments:Object.fromEntries([...unitSegments].map(([key,b])=>[key,finish(b)])),campaigns:[...campaigns.values()].map(c=>({channel:c.channel,name:c.name,leads:c.leads,metrics:finish(c.bucket)})).sort((a,b)=>b.leads-a.leads),daily,funnel,coverage_start:coverage?dayBrt(coverage):null};
}
export async function clientDashboardData(db:Db,client:string,start:string,end:string,unit:string){
 const [clients,connections,strategy]=await Promise.all([db<{name:string}[]>(`rest/v1/clients?id=eq.${client}&select=name`),db<Connection[]>(`rest/v1/wa_tracking_connections?client_id=eq.${client}&select=id,name&order=created_at`),db<{conversion_event:string|null}[]>(`rest/v1/client_marketing_strategy?client_id=eq.${client}&select=conversion_event`)]);if(clients.length!==1)throw new Error('link_unavailable');
 const sources=await Promise.all(connections.map(async c=>{const [records,events,outcomes,settings]=await Promise.all([all<TrackingRecord>(db,'wa_tracking_records',c.id,'entity_key,entity,occurred_at,payload','occurred_at.asc,entity_key.asc','&entity=eq.messages'),all<ConversationEvent>(db,'wa_conversation_events',c.id,'event_id,contact_id,direction,author_kind,author_name,message_text,occurred_at,captured_at','event_id.asc'),all<CommercialOutcome>(db,'wa_commercial_outcomes',c.id,'contact_id,status,evidence,updated_at,updated_by','contact_id.asc'),db<ServiceSettings[]>(`rest/v1/wa_service_settings?connection_id=eq.${c.id}&select=weekdays,opens,closes,target_minutes,outbound_started_at,capture_ready_at`)]);return {connection:c.id,records,events,outcomes,settings:settings[0]??null}}));
 const monthly_units:Record<string,number>={all:0,alecrim:0,ibes:0,itapua:0,unassigned:0};for(const source of sources)for(const row of firstContacts(source.records,null,null)){if(dayBrt(row.occurred_at).startsWith(end.slice(0,7))){monthly_units.all++;monthly_units[unitOf(row.payload)]++}}
 const goals=(await Promise.all(connections.map(c=>db<{unit:string;target:number}[]>(`rest/v1/wa_bi_goals?connection_id=eq.${c.id}&month=eq.${end.slice(0,7)}-01&select=unit,target`)))).flat();
 let logo='';try{const signed=await db<{signedURL:string}>(`storage/v1/object/sign/client-logos/${client}/logo.png`,{method:'POST',body:JSON.stringify({expiresIn:3600})});logo=`${process.env.VITE_SUPABASE_URL}/storage/v1${signed.signedURL}`}catch{/* Logo is optional. */}
 const previous=comparisonPeriod({start,end}),comparison=aggregateClientDashboard(sources,previous.start,previous.end,unit);
 return {client:{name:clients[0].name,logo,conversion_event:strategy[0]?.conversion_event||''},period:{start,end},unit,...aggregateClientDashboard(sources,start,end,unit),goals,goal_month:end.slice(0,7),monthly_units,comparison:{period:previous,unit,...comparison,coverage_complete:!!comparison.coverage_start&&previous.start>=comparison.coverage_start},updated_at:new Date().toISOString()};
}
const mediaCache=new Map<string,{expires:number;value:unknown}>();
export async function clientDashboardMedia(db:Db,link:DashboardLink,start:string,end:string,platform:string){
 if(!link.include_media)return {status:'not_shared'};
 if(!['meta','google'].includes(platform))throw new Error('invalid_platform');
 const selected=platform as 'meta'|'google';
 if(selected==='google'){
  const credential=await googleCredential(db,link.client_id);if(credential.status!=='credentials')return {status:credential.status};
  const key=[link.token_hash,link.updated_at,selected,credential.version,start,end].join(':');const cached=mediaCache.get(key);if(cached&&cached.expires>Date.now())return cached.value;
  const report=await googleAdsReport(credential.account_id,credential.secrets,{since:start,until:end});
  const latest=await googleCredential(db,link.client_id);if(latest.status!=='credentials'||latest.version!==credential.version)throw Error('configuration_changed');
  if(mediaCache.size>100)mediaCache.clear();mediaCache.set(key,{expires:Date.now()+120000,value:report});return report;
 }
 const rows=await db<{account_id:string;ciphertext:string;updated_at:string}[]>(`rest/v1/wa_ads_credentials?client_id=eq.${link.client_id}&platform=eq.${selected}&select=account_id,ciphertext,updated_at`);if(!rows[0])return {status:'not_configured'};
 const row=rows[0],key=[link.token_hash,link.updated_at,selected,row.updated_at,start,end].join(':');
 const cached=mediaCache.get(key);if(cached&&cached.expires>Date.now())return cached.value;
 const secrets=object(JSON.parse(unseal(row.ciphertext,adsBinding(link.client_id,selected))));
 const report=await metaReport(row.account_id,String(secrets.access_token??''),{since:start,until:end});
 // Cache only the explicitly shared media metrics, never credentials or contact records.
 if(mediaCache.size>100)mediaCache.clear();mediaCache.set(key,{expires:Date.now()+120000,value:report});return report;
}
