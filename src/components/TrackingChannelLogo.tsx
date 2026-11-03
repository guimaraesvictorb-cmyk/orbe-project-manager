import { Globe, CircleHelp } from 'lucide-react'
import { ClientAvatar } from './ClientAvatar'

export function TrackingChannelLogo({channel,clientId}:{channel:string;clientId?:string|null}) {
 const cls='h-10 w-16 shrink-0 object-contain'
 if(channel==='Origem não identificada')return <CircleHelp aria-label="Sem origem identificada" className="h-9 w-9 shrink-0 text-[var(--text-tertiary)]"/>
 if(channel==='Site'){
  return clientId?<ClientAvatar id={clientId} name="do cliente" className="h-10 w-16"/>:<Globe aria-label="Site" className="h-9 w-9 shrink-0 text-[var(--accent)]"/>
 }
 const brands:Record<string,{src:string;alt:string}>={Google:{src:'/brands/google-ads.svg',alt:'Google Ads'},Meta:{src:'/brands/meta.svg',alt:'Meta'},Instagram:{src:'/brands/instagram.png',alt:'Instagram'}}
 const brand=brands[channel]
 return brand?<img src={brand.src} alt={brand.alt} className={`${cls} ${channel==='Meta'?'rounded bg-white':''}`}/>:null
}
