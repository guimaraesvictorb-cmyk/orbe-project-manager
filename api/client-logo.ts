import type {ServerResponse} from 'node:http';
import {answer,storage,type Request} from './_lib/trackingServer.js';
const uuid=/^[0-9a-f-]{36}$/;
export default async function handler(req:Request,res:ServerResponse) {
 if(req.method!=='GET'&&req.method!=='POST')return answer(res,405,{error:'Método inválido.'});
 if(req.method==='POST'&&req.headers.origin!=='https://studio.agenciaorbe.co')return answer(res,403,{error:'Acesso negado.'});
 const query=new URL(req.url??'','https://studio.agenciaorbe.co').searchParams;
 const batch=req.method==='GET'&&query.has('client_ids');
 const ids=[...new Set((batch?query.get('client_ids')??'':query.get('client_id')??'').split(','))];
 if(!ids.length||ids.length>30||ids.some(id=>!uuid.test(id)))return answer(res,400,{error:'Cliente inválido.'});
 const auth=req.headers.authorization??'';
 if(!/^Bearer [A-Za-z0-9_.-]+$/.test(auth))return answer(res,401,{error:'Entre novamente.'});
 const db=storage(),token=auth.slice(7);let authenticated=false;
 try {
  const user=await db<{id:string}>('auth/v1/user',{},token);authenticated=true;
  const clients=await db<{id:string}[]>(`rest/v1/clients?${batch?`id=in.(${ids.join(',')})`:`id=eq.${ids[0]}`}&select=id`,{},token);
  if(batch){
   if(!clients.length)return answer(res,200,{logos:{}});
   const signed=await db<{path:string;signedURL:string|null;error?:string|null}[]>('storage/v1/object/sign/client-logos',{method:'POST',body:JSON.stringify({expiresIn:3600,paths:clients.map(client=>`${client.id}/logo.png`)})});
   const allowed=new Set(clients.map(client=>client.id)),logos:Record<string,{url:string;expires_at:number}|null>={};
   for(const client of clients)logos[client.id]=null;
   for(const item of signed){
    const id=item.path?.split('/')[0];
    if(allowed.has(id)&&item.path===`${id}/logo.png`&&item.signedURL?.startsWith(`/object/sign/client-logos/${id}/logo.png?`))logos[id]={url:`${process.env.VITE_SUPABASE_URL}/storage/v1${item.signedURL}`,expires_at:Date.now()+3600000};
   }
   return answer(res,200,{logos});
  }
  const id=ids[0],path=`${id}/logo.png`;
  if(clients.length!==1)return answer(res,403,{error:'Acesso negado.'});
  if(req.method==='POST') {
   const profiles=await db<{role:string}[]>(`rest/v1/profiles?id=eq.${user.id}&select=role`,{},token);
   if(profiles[0]?.role!=='admin')return answer(res,403,{error:'Somente administradores podem alterar o logo.'});
   const data=(req.body as {image?:unknown})?.image;
   if(typeof data!=='string'||data.length>280000||!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(data))return answer(res,400,{error:'Use uma imagem PNG, JPG ou WebP de até 5 MB.'});
   const bytes=Buffer.from(data.split(',')[1],'base64');
   if(bytes.length>200000||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')return answer(res,400,{error:'Imagem inválida.'});
   await db(`storage/v1/object/client-logos/${path}`,{method:'POST',headers:{'Content-Type':'image/png','x-upsert':'true'},body:bytes});
  }
  const signed=await db<{signedURL:string}>(`storage/v1/object/sign/client-logos/${path}`,{method:'POST',body:JSON.stringify({expiresIn:3600})});
  return answer(res,200,{url:`${process.env.VITE_SUPABASE_URL}/storage/v1${signed.signedURL}`,expires_at:Date.now()+3600000});
 }catch{return answer(res,!authenticated?401:req.method==='GET'?503:500,{error:!authenticated?'Entre novamente.':req.method==='GET'?'Não foi possível carregar os logos agora.':'Não foi possível salvar o logo. Tente novamente.'});}
}
