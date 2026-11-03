import { useEffect, useState } from 'react'
import { previousMonth } from '../lib/clientTimeline'
function readPeriod() {
 const params=new URLSearchParams(window.location.hash.split('?')[1]),fallback=previousMonth()
 return {start:params.get('de')||fallback.start,end:params.get('ate')||fallback.end}
}
export function useAdsPeriod() {
 const [period,setPeriod]=useState(readPeriod)
 useEffect(()=>{
  const sync=()=>{const next=readPeriod();setPeriod(previous=>previous.start===next.start&&previous.end===next.end?previous:next)}
  window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync)
 },[])
 function update(key:'start'|'end',value:string) {
  const next={...period,[key]:value},[section,search]=window.location.hash.split('?'),params=new URLSearchParams(search)
  for(const [name,date] of [['de',next.start],['ate',next.end]]) {if(date)params.set(name,date);else params.delete(name)}
  window.history.replaceState(null,'',`${section}?${params}`)
  setPeriod(next)
 }
 return {...period,setStart:(value:string)=>update('start',value),setEnd:(value:string)=>update('end',value)}
}
