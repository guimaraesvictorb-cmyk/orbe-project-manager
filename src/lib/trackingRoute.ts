import {useEffect,useState} from 'react'
import {dayBrt} from './biDashboard'
export type TrackingRoute={client:string|null;slug:string;area:'internal'|'client';tab:string;section:string;channel:string;unit:string;start:string;end:string;source:string;mode:'clients'|'utm';goalMonth:string;mediaTable:'campaigns'|'ads'}
const tabs=['overview','commercial','messages','leads','clicks','links','connections'];const sections=['executive','acquisition','goals'];const channels=['Google','Meta','Site','Instagram','Origem não identificada'];const units=['all','alecrim','ibes','itapua','unassigned'];
const dateValue=(value:string|null,fallback:string)=>value===''?'':value&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value?value:fallback
export function parseTrackingRoute(hash:string):TrackingRoute{const [path,search='']=hash.replace(/^#\/?/,'').split('?'),q=new URLSearchParams(search),id=q.get('cliente');return {client:id&&/^[a-f0-9-]{36}$/.test(id)?id:null,slug:path.split('/')[1]??'',area:q.get('visao')==='cliente'?'client':'internal',tab:tabs.includes(q.get('aba')??'')?q.get('aba')!:'overview',section:sections.includes(q.get('painel')??'')?q.get('painel')!:'executive',channel:channels.includes(q.get('canal')??'')?q.get('canal')!:'Meta',unit:units.includes(q.get('unidade')??'')?q.get('unidade')!:'all',start:dateValue(q.get('de'),dayBrt(new Date(Date.now()-29*86400000).toISOString())),end:dateValue(q.get('ate'),dayBrt(new Date().toISOString())),source:(q.get('origem')??'').slice(0,80),mode:q.get('modo')==='utm'?'utm':'clients',goalMonth:/^\d{4}-(0[1-9]|1[0-2])$/.test(q.get('mes')??'')?q.get('mes')!:(dateValue(q.get('ate'),dayBrt(new Date().toISOString()))||dayBrt(new Date().toISOString())).slice(0,7),mediaTable:q.get('nivel')==='ads'?'ads':'campaigns'}}
export function buildTrackingRoute(r:TrackingRoute){const q=new URLSearchParams();if(r.mode==='utm')q.set('modo','utm');if(r.client){q.set('cliente',r.client);if(r.area==='client')q.set('visao','cliente');else{q.set('aba',r.tab);if(r.tab==='overview'){q.set('painel',r.section);if(r.section==='acquisition'){q.set('canal',r.channel);q.set('nivel',r.mediaTable)}if(r.section==='goals')q.set('mes',r.goalMonth);q.set('unidade',r.unit)}q.set('de',r.start);q.set('ate',r.end);if(r.source)q.set('origem',r.source)}}return '#rastreamento'+(r.client&&r.slug?'/'+r.slug:'')+(q.size?'?'+q:'')}
export function updateTrackingRoute(patch:Partial<TrackingRoute>){
 const hash=window.location.hash
 const route={...parseTrackingRoute(hash),...patch}
 let next=buildTrackingRoute(route)
 if(/^#\/?clientes(?:[/?]|$)/.test(hash)){
  const q=new URLSearchParams(hash.split('?')[1]??'')
  const values=new URLSearchParams(next.split('?')[1]??'')
  for(const [key,value] of values)q.set(key,value)
  if(!route.source)q.delete('origem')
  q.set('cliente',route.client??'')
  q.set('area',patch.tab==='connections'?'connections':patch.tab?'tracking':q.get('area')??'tracking')
  next='#clientes/'+route.slug+'?'+q
 }
 if(next!==hash)window.location.hash=next
}
export const clientSlug=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
export function useTrackingRoute(){const [route,setRoute]=useState(()=>parseTrackingRoute(window.location.hash));useEffect(()=>{const change=()=>setRoute(parseTrackingRoute(window.location.hash));window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change)},[]);return route}
