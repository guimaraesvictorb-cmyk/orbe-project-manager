import type {ServerResponse} from 'node:http';
import {waitUntil} from '@vercel/functions';
import {answer,owner,type Request} from './_lib/trackingServer.js';
import {object,scalar,seal,ORBE_ORIGIN} from './_lib/kommo.js';
import {deliverAnalytics} from './_lib/ga4Delivery.js';
export default async function handler(req:Request,res:ServerResponse) {
 if(req.method!=='POST')return answer(res,405,{error:'method_not_allowed'});
 if(req.headers.origin&&req.headers.origin!==ORBE_ORIGIN)return answer(res,403,{error:'forbidden'});
 try {
  const body=object(req.body),client=scalar(body.client_id,36),{db}=await owner(req,client);
  const connections=await db<{id:string}[]>(`rest/v1/wa_tracking_connections?client_id=eq.${client}&provider=eq.kommo&enabled=eq.true&select=id`);
  const connection=scalar(body.connection_id,36);
  if(!connections.some(c=>c.id===connection))throw Error('forbidden');
  const action=scalar(body.action,20);
  if(action==='configure') {
   const measurement=scalar(body.measurement_id,20),hostname=scalar(body.site_hostname,120),secret=scalar(body.api_secret,200);
   if(!/^G-[A-Z0-9]{6,15}$/.test(measurement)||!/^([a-z0-9]+[.-])*[a-z0-9]+\.[a-z]{2,}$/.test(hostname)||!/^[A-Za-z0-9_-]{10,200}$/.test(secret))return answer(res,400,{error:'Confira o domínio, o ID de medição e a chave do GA4.'});
   await db('rest/v1/wa_ga4_streams?on_conflict=connection_id,measurement_id&select=measurement_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({connection_id:connection,measurement_id:measurement,site_hostname:hostname,secret_ciphertext:seal(secret,`ga4:${connection}:${measurement}`),enabled:true})});
  } else if(action==='disable') {
   const measurement=scalar(body.measurement_id,20);if(!/^G-[A-Z0-9]{6,15}$/.test(measurement))throw Error('invalid_measurement');
   await db(`rest/v1/wa_ga4_streams?connection_id=eq.${connection}&measurement_id=eq.${measurement}`,{method:'PATCH',body:JSON.stringify({enabled:false})});
  } else if(action==='process')waitUntil(deliverAnalytics(connection).catch(()=>{}));
  else if(action!=='status')throw Error('invalid_action');
  const streams=await db(`rest/v1/wa_ga4_streams?connection_id=eq.${connection}&select=measurement_id,site_hostname,enabled`);
  const recent=await db(`rest/v1/wa_ga4_outbox?connection_id=eq.${connection}&select=id,measurement_id,status,last_error,received_at,updated_at&order=received_at.desc&limit=20`);
  return answer(res,200,{streams,recent});
 }catch{return answer(res,400,{error:'Não foi possível acessar a integração GA4. Verifique sua autorização e a configuração do servidor.'});}
}
