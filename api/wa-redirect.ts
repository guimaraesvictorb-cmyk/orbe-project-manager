import {randomBytes} from 'node:crypto';
import type {ServerResponse} from 'node:http';
import {answer,storage,type Request} from './_lib/trackingServer.js';
import {embed,sourceFields} from './_lib/kommo.js';
export default async function handler(req:Request,res:ServerResponse) {
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  if(req.method!=='GET')return answer(res,405,{error:'method_not_allowed'});
  try {
    const params=new URL(req.url??'','https://studio.agenciaorbe.co').searchParams;
    if([...new Set(params.keys())].some(k=>params.getAll(k).length!==1))return answer(res,400,{error:'duplicate_parameter'});
    const id=params.get('connection')??'';
    if(!/^[0-9a-f-]{36}$/.test(id))return answer(res,404,{error:'link_unavailable'});
    const greeting=params.get('text')||'Olá! Gostaria de mais informações.';
    if(!greeting.trim()||greeting.length>500||/[\uFE00-\uFE0F\u200B\u200C\u2060\u2063]|\[ORBE:/u.test(greeting))return answer(res,400,{error:'invalid_greeting'});
    const db=storage(),rows=await db<{id:string;destination:string;instance:string}[]>(`rest/v1/wa_tracking_connections?id=eq.${id}&enabled=eq.true&provider=eq.kommo&select=id,destination,instance&limit=1`);
    if(!rows[0])return answer(res,404,{error:'link_unavailable'});
    const reference=randomBytes(16).toString('hex').toUpperCase(),now=new Date().toISOString();
    const record:Record<string,string>={reference,created_at:now,instance:rows[0].instance,destination:rows[0].destination,linked_sender_id:''};
    for(const field of sourceFields){const value=params.get(field)??'';if(value.length>(field.endsWith('clid')?1024:256)||value.includes('\0')||(field.endsWith('clid')&&value&&!/^[A-Za-z0-9_.~-]+$/.test(value)))return answer(res,400,{error:'invalid_source'});record[field]=value;}
    await db('rest/v1/wa_tracking_records',{method:'POST',body:JSON.stringify({connection_id:id,entity:'clicks',entity_key:reference,revision:1,occurred_at:now,payload:record})});
    const target=new URL('https://api.whatsapp.com/send/');target.searchParams.set('phone',rows[0].destination);target.searchParams.set('text',embed(greeting,reference));
    res.statusCode=302;res.setHeader('Location',target.toString());res.end();
  }catch{return answer(res,503,{error:'link_temporarily_unavailable'});}
}
