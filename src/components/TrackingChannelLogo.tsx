import { useEffect, useState } from 'react'
import { Globe, CircleHelp } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function TrackingChannelLogo({channel,clientId}:{channel:string;clientId?:string|null}) {
 const [logo,setLogo]=useState('')
 useEffect(()=>{let active=true;if(channel==='Site'&&clientId)void(async()=>{const {data}=await supabase.auth.getSession();if(!data.session)return;try{const r=await fetch(`/api/client-logo?client_id=${clientId}`,{headers:{Authorization:`Bearer ${data.session.access_token}`}});if(r.ok){const result=await r.json();if(active)setLogo(result.url)}}catch{/* Keep the site icon when the client has no logo. */}})();return()=>{active=false}},[channel,clientId])
 const cls='h-10 w-16 shrink-0 object-contain'
 if(channel==='Origem não identificada')return <CircleHelp aria-label="Sem origem identificada" className="h-9 w-9 shrink-0 text-[var(--text-tertiary)]"/>
 if(channel==='Site'){
  const rayafit=clientId==='589481f6-3a15-4c93-b384-5d33373c20e3'
  const url=rayafit?'/brands/rayafit.webp':logo
  return url?<img src={url} alt={rayafit?'Rayafit':'Logo do cliente'} className={`${cls} ${rayafit?'rounded bg-neutral-950 p-1':''}`}/>:<Globe aria-label="Site" className="h-9 w-9 shrink-0 text-[var(--accent)]"/>
 }
 const brands:Record<string,{src:string;alt:string}>={Google:{src:'/brands/google-ads.svg',alt:'Google Ads'},Meta:{src:'/brands/meta.svg',alt:'Meta'},Instagram:{src:'/brands/instagram.png',alt:'Instagram'}}
 const brand=brands[channel]
 return brand?<img src={brand.src} alt={brand.alt} className={`${cls} ${channel==='Meta'?'rounded bg-white':''}`}/>:null
}
