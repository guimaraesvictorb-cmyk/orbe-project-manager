import type { IncomingMessage,ServerResponse } from 'node:http';
export type Request=IncomingMessage&{body?:unknown};
export const answer=(res:ServerResponse,status:number,body:unknown)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body));};
export function storage() {
  const url=process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error('storage_unavailable');
  return async<T>(path:string,init:RequestInit={},bearer=key):Promise<T>=>{
    const r=await fetch(`${url}/${path}`,{...init,headers:{apikey:key,Authorization:`Bearer ${bearer}`,'Content-Type':'application/json',Prefer:'return=representation',...init.headers},signal:AbortSignal.timeout(10000)});
    if(!r.ok)throw new Error('storage_unavailable');
    return (r.status===204?null:await r.json()) as T;
  };
}
export async function owner(req:Request,clientId:string) {
  if(!/^[0-9a-f-]{36}$/.test(clientId))throw new Error('invalid_client');
  const auth=req.headers.authorization??'';if(!/^Bearer [A-Za-z0-9_.-]+$/.test(auth))throw new Error('unauthorized');
  const token=auth.slice(7),db=storage();
  const user=await db<{id:string}>('auth/v1/user',{},token);
  const rows=await db<{client_id:string;owner_user_id:string;traffic_active:boolean}[]>(`rest/v1/wa_tracking_setups?select=client_id,owner_user_id,traffic_active&client_id=eq.${clientId}`,{},token);
  if(rows.length!==1||rows[0].owner_user_id!==user.id||!rows[0].traffic_active)throw new Error('forbidden');
  return {db,user,token};
}
