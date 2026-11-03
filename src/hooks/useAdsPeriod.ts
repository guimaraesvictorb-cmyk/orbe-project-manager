import { useEffect, useState } from 'react'
import { previousMonth } from '../lib/clientTimeline'
import { normalizePeriod, periodError, type ReportPeriod } from '../lib/reportPeriod'
function readPeriod() {
 const params=new URLSearchParams(window.location.hash.split('?')[1]),fallback=previousMonth()
 return normalizePeriod({start:params.get('de')||fallback.start,end:params.get('ate')||fallback.end},fallback)
}
export function useAdsPeriod() {
 const [period,setPeriod]=useState(readPeriod)
 useEffect(()=>{
  const sync=()=>{const next=readPeriod();setPeriod(previous=>previous.start===next.start&&previous.end===next.end?previous:next)}
  window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync)
 },[])
 function setRange(next:ReportPeriod) {
  if(periodError(next,93))return
  const [section,search]=window.location.hash.split('?'),params=new URLSearchParams(search)
  params.set('de',next.start);params.set('ate',next.end)
  window.history.replaceState(null,'',`${section}?${params}`)
  setPeriod(next)
 }

 return {...period,setRange}
}
