import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const ORBE_ORIGIN = 'https://studio.agenciaorbe.co';
export const sourceFields = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid'] as const;
export function kommoOrigin(input: unknown) {
  if (typeof input !== 'string') throw new Error('invalid_account');
  const u = new URL(input);
  if (u.protocol !== 'https:' || !/^[a-z0-9][a-z0-9-]{0,62}\.kommo\.com$/.test(u.hostname) || u.port || u.username || u.password || u.search || u.hash || u.pathname !== '/') throw new Error('invalid_account');
  return u.origin;
}
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
function encryptionKey() {
  const key = process.env.KOMMO_ENCRYPTION_KEY ?? '';
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('encryption_not_configured');
  return Buffer.from(key,'hex');
}
export function seal(value: string, binding: string) {
  const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
  cipher.setAAD(Buffer.from(binding));
  const body=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return [iv,cipher.getAuthTag(),body].map(b=>b.toString('base64url')).join('.');
}
export function unseal(value: string, binding: string) {
  const parts=value.split('.'); if(parts.length!==3)throw new Error('invalid_ciphertext');
  const [iv,tag,body]=parts.map(p=>Buffer.from(p,'base64url'));
  const cipher=createDecipheriv('aes-256-gcm',encryptionKey(),iv);
  cipher.setAAD(Buffer.from(binding));cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(body),cipher.final()]).toString('utf8');
}
export function object(input: unknown): Record<string,unknown> {
  if(!input || typeof input!=='object' || Array.isArray(input))throw new Error('invalid_object');
  return input as Record<string,unknown>;
}
export function scalar(input: unknown,max=256) {
  if(typeof input!=='string'||input.length>max||input.includes('\0'))throw new Error('invalid_text');
  return input;
}
export function decimal(input: unknown) {
  const value=String(input??''); if(!/^[1-9][0-9]{0,18}$/.test(value))throw new Error('invalid_id');return value;
}
export async function kommoRequest<T>(origin: string,token: string,path: string,init: RequestInit={}) {
  if(!path.startsWith('/api/v4/'))throw new Error('invalid_path');
  const response=await fetch(kommoOrigin(origin)+path,{...init,redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json'},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error(response.status===401?'kommo_token_invalid':response.status===403?'kommo_permission_denied':'kommo_unavailable');
  return (response.status===204?null:await response.json()) as T;
}
export type KommoMessage={id:string;contact_id:string;chat_id:string;talk_id:string;lead_id:string;text:string;created_at:string;type:string;origin:string;reference:string};
// Whitelist-only form parsing. No generic bracket expansion / prototype assignment.
export function parseWebhook(body: unknown) {
  let entries: [string,string][];
  if(typeof body==='string') {
    if(Buffer.byteLength(body)>131072)throw new Error('too_large');
    entries=[...new URLSearchParams(body)];
  } else {
    const root=object(body);
    entries=[];
    // Accept both flat Node querystring keys and structured urlencoded parsers.
    const flatten=(key:string,value:unknown,depth:number)=>{
      if(depth>6||entries.length>1500)throw new Error('too_many_fields');
      if(typeof value==='string'||typeof value==='number'){entries.push([key,scalar(String(value),32768)]);return;}
      if(!value||typeof value!=='object')throw new Error('invalid_field');
      for(const [k,v] of Object.entries(value)){if(!/^[A-Za-z0-9_]+$/.test(k))throw new Error('invalid_field');flatten(`${key}[${k}]`,v,depth+1);}
    };
    for(const [k,v] of Object.entries(root)){if(['account','message','add'].includes(k))flatten(k,v,0);else if(k.startsWith('account[')||k.startsWith('message[')||k.startsWith('add['))entries.push([k,scalar(v,32768)]);}
  }
  if(entries.length>1500)throw new Error('too_many_fields');
  const fields=new Map<string,string>();
  for(const [key,value] of entries){if(fields.has(key))throw new Error('duplicate_field');fields.set(key,scalar(value,32768));}
  const account=decimal(fields.get('account[id]'));
  const subdomain=scalar(fields.get('account[subdomain]'),64);
  if(!/^[a-z0-9][a-z0-9-]*$/.test(subdomain))throw new Error('invalid_account');
  const indexes=new Set<string>();
  for(const key of fields.keys()) {const m=/^(?:message\[add\]|add)\[(\d{1,2})\]\[id\]$/.exec(key);if(m)indexes.add(m[1]);}
  if(indexes.size>30)throw new Error('too_many_messages');
  const messages:KommoMessage[]=[];
  for(const index of indexes){
    if(fields.has(`message[add][${index}][id]`)&&fields.has(`add[${index}][id]`))throw new Error('ambiguous_message');
    const prefix=fields.has(`message[add][${index}][id]`)?`message[add][${index}]`:`add[${index}]`;
    const field=(k:string)=>fields.get(`${prefix}[${k}]`)??'';
    if(field('type')!=='incoming'||(field('author][type') && field('author][type')!=='external'))continue;
    const origin=scalar(field('origin'),128);
    // Unknown channels are deliberately ignored, never relabelled WhatsApp.
    if(!['whatsapp','waba','whatsapp_business','whatsapp_cloud_api','com.amocrm.waba','com.amocrm.whatsapp_cloud_api','com.amocrm.amocrmwa'].includes(origin))continue;
    const id=scalar(field('id'),160);if(!/^[A-Za-z0-9_.:-]+$/.test(id))throw new Error('invalid_message_id');
    const stamp=Number(field('created_at'));
    if(!Number.isSafeInteger(stamp)||stamp<1577836800||stamp*1000>Date.now()+300000)throw new Error('invalid_date');
    const text=scalar(field('text'),16000), refs=references(text);
    messages.push({id,contact_id:decimal(field('contact_id')),chat_id:scalar(field('chat_id'),160),talk_id:field('talk_id')?decimal(field('talk_id')):'',lead_id:field('entity_type')==='lead'||field('element_type')==='2'?decimal(field('entity_id')||field('element_id')):'',text:visibleText(text),created_at:new Date(stamp*1000).toISOString(),type:scalar(field('message_type')||'text',64),origin,reference:refs.length===1?refs[0]:''});
  }
  return {account,subdomain,messages};
}
function crc32(bytes: Buffer) {let crc=0xffffffff;for(const b of bytes){crc^=b;for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
const frame=/\uFE0C\uFE0B\uFE0A\uFE09([\uFE00-\uFE0F]{42})\uFE09\uFE0A\uFE0B\uFE0C/gu;
function decode(symbols:string) {const b=Buffer.from([...symbols].map(c=>(c.charCodeAt(0)-0xfe00).toString(16)).join(''),'hex');return b[0]===2&&crc32(b.subarray(0,17))===b.readUInt32BE(17)?b.subarray(1,17).toString('hex').toUpperCase():null;}
export function references(text:string) {const found=new Set<string>();for(const m of text.matchAll(frame)){const id=decode(m[1]);if(id)found.add(id);}for(const m of text.matchAll(/\[ORBE:([A-F0-9]{32})\]/g))found.add(m[1]);return [...found];}
export function visibleText(text:string) {return text.replace(frame,(full,symbols)=>decode(symbols)?'':full);}
export function embed(greeting:string,reference:string) {
  if(!/^[A-F0-9]{32}$/.test(reference))throw new Error('invalid_reference');
  const bytes=Buffer.alloc(21);bytes[0]=2;Buffer.from(reference,'hex').copy(bytes,1);bytes.writeUInt32BE(crc32(bytes.subarray(0,17)),17);
  const marker='\uFE0C\uFE0B\uFE0A\uFE09'+[...bytes.toString('hex')].map(n=>String.fromCharCode(0xfe00+parseInt(n,16))).join('')+'\uFE09\uFE0A\uFE0B\uFE0C';
  const index=greeting.search(/\s/u);return index>0?greeting.slice(0,index)+marker+greeting.slice(index):greeting+marker;
}
export function contactIdentity(contact:unknown) {
  const c=object(contact), fields=Array.isArray(c.custom_fields_values)?c.custom_fields_values:[];
  const phones=new Set<string>();
  for(const raw of fields){const f=object(raw);if(f.field_code!=='PHONE'||!Array.isArray(f.values))continue;for(const v of f.values){const n=String(object(v).value??'').replace(/\D/g,'');if(/^[1-9][0-9]{9,14}$/.test(n))phones.add(n);}}
  return {name:typeof c.name==='string'?c.name.slice(0,160):'',phone:phones.size===1?[...phones][0]:'',phone_status:phones.size===1?'crm_contact':phones.size>1?'ambiguous':'missing'};
}
