import {randomUUID} from 'node:crypto';
import type {ServerResponse} from 'node:http';
import {answer,storage,type Request} from './_lib/trackingServer.js';
import {digest,object,ORBE_ORIGIN,scalar,seal,unseal} from './_lib/kommo.js';
import {qrUser} from './_lib/qrAccess.js';
import {evolutionMessage} from './_lib/evolution.js';
type Conn={id:string;client_id:string;destination:string;instance:string;enabled:boolean;connection_state:string;last_received_at?:string;capture_mode:string;allowed_senders:string[]};
type Session={connection_id:string;request_id:string|null;expires_at:string|null;qr_ciphertext:string;status:string;worker_seen_at:string|null;verified_at:string|null;error_code:string;worker_id:string};
const recent=(value:string|null)=>!!value&&Date.now()-Date.parse(value)<45000;
export default async function handler(req:Request,res:ServerResponse){
 if(req.method!=='POST')return answer(res,405,{error:'method_not_allowed'});
 if(req.headers.origin&&req.headers.origin!==ORBE_ORIGIN)return answer(res,403,{error:'forbidden'});
 if(!req.headers['content-type']?.startsWith('application/json'))return answer(res,415,{error:'json_required'});
 try{
  if(Buffer.byteLength(JSON.stringify(req.body)??'')>524288)return answer(res,413,{error:'too_large'});
  const input=object(req.body),action=scalar(input.action,30),db=storage();
  if(action.startsWith('worker_')){
   const auth=req.headers.authorization??'';
   if(!/^Bearer [A-Za-z0-9_-]{43,128}$/.test(auth))return answer(res,403,{error:'unauthorized'});
   const hash=digest(auth.slice(7));
   const workers=await db<{id:string}[]>(`rest/v1/wa_qr_workers?token_hash=eq.${hash}&enabled=eq.true&select=id`);
   const broker=workers[0];
   if(action==='worker_list'){
    if(!broker)return answer(res,403,{error:'unauthorized'});
    await db(`rest/v1/wa_qr_workers?id=eq.${broker.id}`,{method:'PATCH',body:JSON.stringify({last_seen_at:new Date().toISOString()})});
    const sessions=await db<{connection_id:string}[]>(`rest/v1/wa_qr_sessions?worker_id=eq.${broker.id}&select=connection_id`);
    if(!sessions.length)return answer(res,200,{ok:true,jobs:[]});
    const jobs=await db<{id:string;instance:string}[]>(`rest/v1/wa_tracking_connections?id=in.(${sessions.map(s=>s.connection_id).join(',')})&provider=eq.evolution&select=id,instance`);
    return answer(res,200,{ok:true,jobs});
   }
   let connectionId='';
   if(broker){connectionId=scalar(input.connection_id,36);if(!/^[0-9a-f-]{36}$/.test(connectionId))return answer(res,403,{error:'forbidden'})}
   else{
    const keys=await db<{connection_id:string}[]>(`rest/v1/wa_tracking_ingest_keys?select=connection_id&token_hash=eq.${hash}&enabled=eq.true`);
    if(keys.length!==1)return answer(res,403,{error:'unauthorized'});
    connectionId=keys[0].connection_id;
   }
   const connections=await db<Conn[]>(`rest/v1/wa_tracking_connections?id=eq.${connectionId}&provider=eq.evolution&select=id,client_id,destination,instance,enabled,connection_state,last_received_at,capture_mode,allowed_senders`),conn=connections[0];
   if(!conn?.client_id)return answer(res,403,{error:'forbidden'});
   const setups=await db<{traffic_active:boolean;destination:string;connection_method:string}[]>(`rest/v1/wa_tracking_setups?client_id=eq.${conn.client_id}&select=traffic_active,destination,connection_method`);
   if(!setups[0]?.traffic_active||setups[0].destination!==conn.destination||setups[0].connection_method!=='qr')return answer(res,403,{error:'setup_changed'});
   const sessions=await db<Session[]>(`rest/v1/wa_qr_sessions?connection_id=eq.${conn.id}`),session=sessions[0];
   if(!session||broker&&session.worker_id!==broker.id)return answer(res,409,{error:'not_prepared'});
   if(action==='worker_poll'){
    await db(`rest/v1/wa_qr_sessions?connection_id=eq.${conn.id}`,{method:'PATCH',body:JSON.stringify({worker_seen_at:new Date().toISOString()})});
    return answer(res,200,{ok:true,connection_id:conn.id,instance:conn.instance,destination:conn.destination,request_id:session.request_id,expires_at:session.expires_at,status:session.status,verified_at:session.verified_at,capture_mode:conn.capture_mode,allowed_senders:conn.allowed_senders});
   }
   if(action==='worker_messages'){
    if(!Array.isArray(input.events)||input.events.length>30)return answer(res,400,{error:'invalid_batch'});
    const messages=input.events.map(raw=>{try{return evolutionMessage(raw,conn.instance)}catch{return null}}).filter(Boolean);
    const accepted=await db<number>('rest/v1/rpc/wa_qr_receive',{method:'POST',body:JSON.stringify({p_connection:conn.id,p_messages:messages})});
    return answer(res,200,{ok:true,accepted});
   }
   if(action!=='worker_state')return answer(res,400,{error:'invalid_action'});
   if(input.request_id!==session.request_id)return answer(res,409,{error:'stale_request'});
   const status=scalar(input.status,20),now=new Date().toISOString();
   if(!['qr','connecting','open','close','wrong_number','error'].includes(status))return answer(res,400,{error:'invalid_state'});
   let verified=session.verified_at;
   const number=status==='open'?scalar(input.number,15):'';
   if(status==='open'){
    if(session.verified_at&&number!==conn.destination)return answer(res,409,{error:'number_changed'});
    try{verified=await db<string>('rest/v1/rpc/wa_qr_verify',{method:'POST',body:JSON.stringify({p_connection:conn.id,p_number:number})})}catch{return answer(res,409,{error:'number_unavailable'})}
   }
   if(['qr','connecting'].includes(status)&&(!session.expires_at||Date.parse(session.expires_at)<=Date.now()))return answer(res,409,{error:'request_expired'});
   const qr=status==='qr'?scalar(input.qr,100000):'';
   if(qr&&!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(qr))return answer(res,400,{error:'invalid_qr'});
   const patch={status,qr_ciphertext:qr?seal(qr,conn.id):'',worker_seen_at:now,error_code:status==='error'?'provider_unavailable':status==='wrong_number'?'wrong_number':'',...(status==='open'?{verified_at:verified}:{})};
   const updated=await db<Session[]>(`rest/v1/wa_qr_sessions?connection_id=eq.${conn.id}&request_id=eq.${session.request_id}`,{method:'PATCH',body:JSON.stringify(patch)});
   if(!updated.length)return answer(res,409,{error:'stale_request'});
   await db(`rest/v1/wa_tracking_connections?id=eq.${conn.id}`,{method:'PATCH',body:JSON.stringify({enabled:status==='open',connection_state:status==='open'?'open':status==='close'?'close':'connecting',last_sync_at:now})});
   await db(`rest/v1/wa_tracking_setups?client_id=eq.${conn.client_id}`,{method:'PATCH',body:JSON.stringify({connection_id:conn.id,activation_status:status==='open'?(conn.last_received_at?'receiving':'waiting_message'):['wrong_number','error'].includes(status)?'error':'authorizing',activation_error:patch.error_code,last_verified_at:status==='open'?now:null})});
   return answer(res,200,{ok:true,verified_at:updated[0].verified_at,destination:status==='open'?number:conn.destination});
  }
  if(!['status','generate'].includes(action))return answer(res,400,{error:'invalid_action'});
  const clientId=scalar(input.client_id,36),access=await qrUser(req,clientId);
  const prepared=await db<string>('rest/v1/rpc/wa_qr_prepare',{method:'POST',body:JSON.stringify({p_client:clientId,p_user:access.user.id})});
  const connections=await db<Conn[]>(`rest/v1/wa_tracking_connections?id=eq.${prepared}&client_id=eq.${clientId}&provider=eq.evolution&select=id,client_id,destination,instance,enabled,connection_state,last_received_at,capture_mode,allowed_senders`),conn=connections[0];
  if(!conn)return answer(res,200,{ok:true,status:'not_prepared'});
  const setups=await db<{destination:string;connection_method:string}[]>(`rest/v1/wa_tracking_setups?client_id=eq.${clientId}&select=destination,connection_method`);
  if(setups[0]?.connection_method!=='qr'||setups[0].destination!==conn.destination)return answer(res,409,{error:'setup_changed'});
  let session=(await db<Session[]>(`rest/v1/wa_qr_sessions?connection_id=eq.${conn.id}`))[0];
  if(!session)return answer(res,200,{ok:true,status:'not_prepared'});
  if(action==='generate'){
   if(!recent(session.worker_seen_at))return answer(res,503,{error:'worker_offline'});
   if(session.status==='open'&&conn.enabled)return answer(res,200,{ok:true,status:'open',connection_id:conn.id,destination:conn.destination});
   if(!session.expires_at||Date.parse(session.expires_at)<=Date.now()||!['requested','connecting','qr'].includes(session.status)){
    const requested=new Date(),expires=new Date(requested.getTime()+180000);
    // Compare-and-set: repeated clicks and concurrent tabs share a single request.
    const condition=session.request_id?`request_id=eq.${session.request_id}`:'request_id=is.null';
    await db(`rest/v1/wa_qr_sessions?connection_id=eq.${conn.id}&${condition}`,{method:'PATCH',body:JSON.stringify({request_id:randomUUID(),requested_at:requested.toISOString(),expires_at:expires.toISOString(),status:'requested',qr_ciphertext:'',error_code:''})});
    session=(await db<Session[]>(`rest/v1/wa_qr_sessions?connection_id=eq.${conn.id}`))[0];
   }
  }
  const online=recent(session.worker_seen_at),expired=!session.expires_at||Date.parse(session.expires_at)<=Date.now();
  const status=!online?'offline':['requested','connecting','qr'].includes(session.status)&&expired?'expired':session.status;
  const test=conn.enabled?await db<{occurred_at:string}[]>(`rest/v1/wa_tracking_records?connection_id=eq.${conn.id}&entity=eq.messages&payload->>utm_source=eq.orbe_teste&payload->>utm_campaign=eq.validacao_conexao&payload->>source_status=eq.Identificada&select=occurred_at&order=occurred_at.desc&limit=1`):[];
  return answer(res,200,{ok:true,test_received_at:test[0]?.occurred_at??null,status,connection_id:conn.id,destination:session.verified_at?conn.destination:'',expires_at:session.expires_at,last_received_at:conn.last_received_at,capture_mode:conn.capture_mode,allowed_senders:conn.allowed_senders,
   qr:status==='qr'&&session.qr_ciphertext?unseal(session.qr_ciphertext,conn.id):null});
 }catch(error){const code=error instanceof Error?error.message:'';return answer(res,['unauthorized','forbidden'].includes(code)?403:503,{error:['unauthorized','forbidden'].includes(code)?code:'qr_temporarily_unavailable'});}
}
