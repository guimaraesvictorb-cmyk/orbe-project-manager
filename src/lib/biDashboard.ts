import {isReportDate} from './reportPeriod.ts'
import type {TrackingRecord} from './whatsappTracking.js'
export const biChannels=['Google','Meta','Site','Instagram','Origem não identificada'] as const
export const channelTitle=(v:string)=>v==='Google'?'Google Ads':v==='Meta'?'Meta Ads':v==='Site'?'Site':v==='Origem não identificada'?'Sem origem':v
export function dayBrt(value:string){const stamp=Date.parse(value);return Number.isFinite(stamp)?new Date(stamp-10800000).toISOString().slice(0,10):''}
export function unitOf(p:TrackingRecord['payload']){const value=String(p.unit||p.unidade||p.utm_term||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();return /^(alecrim|ibes|itapua)$/.test(value)?value:'unassigned'}
export function dailyLeads(rows:TrackingRecord[],start:string,end:string){
 if(!isReportDate(start)||!isReportDate(end)||start>end)return []
 const values=new Map<string,number>(),monthly=(Date.parse(end)-Date.parse(start))/86400000>366
 if(monthly){
  const cursor=new Date(`${start.slice(0,7)}-01T00:00:00Z`)
  while(cursor.toISOString().slice(0,10)<=end){values.set(cursor.toISOString().slice(0,10),0);cursor.setUTCMonth(cursor.getUTCMonth()+1)}
 }else for(let d=Date.parse(start);d<=Date.parse(end);d+=86400000)values.set(new Date(d).toISOString().slice(0,10),0)
 for(const row of rows){const day=dayBrt(row.occurred_at);if(!day||day<start||day>end)continue;const key=monthly?`${day.slice(0,7)}-01`:day;if(values.has(key))values.set(key,values.get(key)!+1)}
 return [...values].map(([day,value])=>({day,value}))
}

export function ratio(n:number,d:number){return d>0?n/d:null}
