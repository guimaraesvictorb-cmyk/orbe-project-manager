import { useEffect, useRef, useState } from 'react'
import { Image, Video } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function DriveAssetPreview({clientId,path,fileId,video=false}:{clientId:string;path:string[];fileId:string;video?:boolean}) {
 const container=useRef<HTMLDivElement>(null)
 const [visible,setVisible]=useState(false)
 const [url,setUrl]=useState('')
 const pathKey=path.join(',')
 useEffect(()=>{
  if(!container.current)return
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect()}},{rootMargin:'100px'})
  observer.observe(container.current);return()=>observer.disconnect()
 },[])
 useEffect(()=>{
  if(!visible)return
  const controller=new AbortController();let objectUrl=''
  void supabase.auth.getSession().then(async({data:{session}})=>{
   if(!session||controller.signal.aborted)return
   try {
    const response=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/orbe-drive-sync`,{method:'POST',signal:controller.signal,headers:{authorization:`Bearer ${session.access_token}`,'content-type':'application/json'},body:JSON.stringify({client_id:clientId,action:'creative_preview',path:pathKey.split(','),file_id:fileId})})
    if(!response.ok)return
    const blob=await response.blob();if(controller.signal.aborted)return
    objectUrl=URL.createObjectURL(blob);setUrl(objectUrl)
   }catch{/* A missing preview never prevents opening the original in Drive. */}
  })
  return()=>{controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl)}
 },[clientId,pathKey,fileId,visible])
 const Icon=video?Video:Image
 return <div ref={container} className="mb-4 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-[var(--bg-surface-2)] text-[var(--text-tertiary)]">{url?<img src={url} alt="Prévia do criativo" className="h-full w-full object-contain" onError={()=>setUrl('')}/>:<Icon size={28}/>}</div>
}
