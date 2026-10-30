import { useEffect, useState } from 'react'
import { Globe } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function TrackingChannelLogo({channel,clientId}:{channel:string;clientId?:string|null}) {
 const [logo,setLogo]=useState('')
 useEffect(()=>{let active=true;if(channel==='Site'&&clientId)void(async()=>{const {data}=await supabase.auth.getSession();if(!data.session)return;try{const r=await fetch(`/api/client-logo?client_id=${clientId}`,{headers:{Authorization:`Bearer ${data.session.access_token}`}});if(r.ok){const result=await r.json();if(active)setLogo(result.url)}}catch{/* Keep the site icon when the client has no logo. */}})();return()=>{active=false}},[channel,clientId])
 const cls='h-9 w-9 shrink-0'
 if(channel==='Site')return logo?<img src={logo} alt="Logo do cliente" className={`${cls} object-contain rounded-lg`}/>:<Globe aria-label="Site" className={`${cls} text-[var(--accent)]`}/>
 if(channel==='Google')return <svg role="img" aria-label="Google Ads" viewBox="0 0 48 48" className={cls}><path d="M27 7a8 8 0 0 1 11 3l9 16a8 8 0 0 1-14 8L24 18a8 8 0 0 1 3-11" fill="#4285F4"/><path d="M27 7a8 8 0 0 1 3 11L14 42A8 8 0 0 1 1 34L17 10a8 8 0 0 1 10-3" fill="#FBBC04"/><circle cx="8" cy="38" r="8" fill="#34A853"/></svg>
 if(channel==='Meta')return <svg role="img" aria-label="Meta Ads" viewBox="0 0 48 32" className={cls}><path d="M3 22C3 9 9 3 14 4c6 0 10 10 14 17 4 7 8 7 12 5 6-4 3-18-2-21-7-5-13 9-17 16-3 5-7 8-11 7-5 0-7-2-7-6Z" fill="none" stroke="#0866FF" strokeWidth="5" strokeLinecap="round"/></svg>
 return <svg role="img" aria-label="Instagram" viewBox="0 0 40 40" className={cls}><rect x="3" y="3" width="34" height="34" rx="10" fill="none" stroke="#C13584" strokeWidth="4"/><circle cx="20" cy="20" r="8" fill="none" stroke="#E1306C" strokeWidth="4"/><circle cx="30" cy="10" r="2.5" fill="#F77737"/></svg>
}
