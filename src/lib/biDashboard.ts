import type {TrackingRecord} from './whatsappTracking'
export const biChannels=['Google','Meta','Site','Instagram','Origem não identificada'] as const
export const channelTitle=(v:string)=>v==='Google'?'Google Ads':v==='Meta'?'Meta Ads':v==='Site'?'Site':v==='Origem não identificada'?'Sem origem':v
export function dayBrt(value:string){return new Date(Date.parse(value)-10800000).toISOString().slice(0,10)}
export function unitOf(p:TrackingRecord['payload']){const value=String(p.unit||p.unidade||p.utm_term||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();return /^(alecrim|ibes|itapua)$/.test(value)?value:'unassigned'}
export function dailyLeads(rows:TrackingRecord[],start:string,end:string){const values=new Map<string,number>();for(let d=Date.parse(start);d<=Date.parse(end);d+=86400000)values.set(new Date(d).toISOString().slice(0,10),0);for(const row of rows){const key=dayBrt(row.occurred_at);if(values.has(key))values.set(key,values.get(key)!+1)}return [...values].map(([day,value])=>({day,value}))}
export function ratio(n:number,d:number){return d>0?n/d:null}
