import {useEffect,useSyncExternalStore} from 'react';
import {supabase} from '../lib/supabase';
import {createClientLogoCache,type LogoEntry} from '../lib/clientLogoCache';
export const clientLogoCache=createClientLogoCache(async(user,ids)=>{
 const {data}=await supabase.auth.getSession();
 if(!data.session||data.session.user.id!==user)throw Error('session_changed');
 const response=await fetch(`/api/client-logo?client_ids=${ids.join(',')}`,{headers:{Authorization:`Bearer ${data.session.access_token}`}});
 if(!response.ok)throw Error('logos_unavailable');
 const result=await response.json() as {logos:Record<string,LogoEntry|null>};
 return result.logos;
});
supabase.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')clientLogoCache.clear();});
export function useClientLogo(user:string|undefined,id:string){
 const url=useSyncExternalStore(clientLogoCache.subscribe,()=>user?clientLogoCache.get(user,id):'',()=> '');
 useEffect(()=>{if(user&&id)void clientLogoCache.load(user,id);},[user,id,url]);
 return url;
}
