import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { validateBatch, type Connection } from './_lib/tracking.js';

type Request = IncomingMessage & { body?: unknown };
export default async function handler(req: Request, res: ServerResponse) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json');
  const reply = (code: number, data: unknown) => { res.statusCode=code; res.end(JSON.stringify(data)); };
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return reply(405,{error:'method_not_allowed'}); }
  const auth=req.headers.authorization ?? '';
  if (!/^Bearer [A-Za-z0-9_-]{43,128}$/.test(auth)) return reply(401,{error:'unauthorized'});
  if (!req.headers['content-type']?.startsWith('application/json')) return reply(415,{error:'json_required'});
  const size=Number(req.headers['content-length']);
  if (!Number.isFinite(size) || size<1 || size>524288) return reply(413,{error:'invalid_body_size'});
  const url=process.env.VITE_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return reply(503,{error:'integration_unavailable'});
  const headers={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'};
  const request=async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const response=await fetch(`${url}/rest/v1/${path}`,{...init,headers,signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error('storage_unavailable');
    return await response.json() as T;
  };
  try {
    const hash=createHash('sha256').update(auth.slice(7)).digest('hex');
    const keys=await request<{connection_id:string}[]>(`wa_tracking_ingest_keys?select=connection_id&token_hash=eq.${hash}&enabled=eq.true&limit=1`);
    if (keys.length !== 1) return reply(401,{error:'unauthorized'});
    const rows=await request<Connection[]>(`wa_tracking_connections?select=id,instance,destination,enabled,capture_mode,allowed_senders&id=eq.${keys[0].connection_id}&enabled=eq.true&limit=1`);
    if (rows.length !== 1) return reply(403,{error:'connection_disabled'});
    let batch;
    try {
      const body=typeof req.body==='string' ? JSON.parse(req.body) : req.body;
      if (Buffer.byteLength(JSON.stringify(body) ?? '')>524288) return reply(413,{error:'invalid_body_size'});
      batch=validateBatch(body, rows[0] as Connection);
    } catch { return reply(400,{error:'invalid_batch'}); }
    const result=await request<{accepted:number;changed:number}>('rpc/wa_tracking_ingest',{method:'POST',body:JSON.stringify({p_connection_id:rows[0].id,p_events:batch.events,p_state:batch.state})});
    return reply(200,{ok:true,...result});
  } catch {
    // Deliberately omit request data and credentials from deployment logs.
    return reply(503,{error:'sync_temporarily_unavailable'});
  }
}
