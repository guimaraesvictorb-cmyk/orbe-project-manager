import type {ServerResponse} from 'node:http';
import {answer,storage,type Request} from './_lib/trackingServer.js';
export default async function handler(req:Request,res:ServerResponse) {
  if(req.method!=='GET'&&req.method!=='POST')return answer(res,405,{error:'Método inválido.'});
  if(req.method==='POST'&&req.headers.origin!=='https://studio.agenciaorbe.co')return answer(res,403,{error:'Acesso negado.'});
  const id=new URL(req.url??'','https://studio.agenciaorbe.co').searchParams.get('client_id');
  if(!id||!/^[0-9a-f-]{36}$/.test(id))return answer(res,400,{error:'Cliente inválido.'});
  const auth=req.headers.authorization??'';
  if(!/^Bearer [A-Za-z0-9_.-]+$/.test(auth))return answer(res,401,{error:'Entre novamente.'});
  const db=storage(),token=auth.slice(7),path=`${id}/logo.png`;
  try {
    const user=await db<{id:string}>('auth/v1/user',{},token);
    const clients=await db<{id:string}[]>(`rest/v1/clients?id=eq.${id}&select=id`,{},token);
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
    return answer(res,200,{url:`${process.env.VITE_SUPABASE_URL}/storage/v1${signed.signedURL}`});
  }catch{return answer(res,req.method==='GET'?404:500,{error:req.method==='GET'?'Logo ainda não cadastrado.':'Não foi possível salvar o logo. Tente novamente.'});}
}
