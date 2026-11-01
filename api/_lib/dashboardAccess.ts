import {randomBytes,scrypt,timingSafeEqual,createHmac} from 'node:crypto';
import {seal,unseal} from './kommo.js';
import type {Request} from './trackingServer.js';
export const accessCookie='orbe_dashboard_access';
export const validSlug=(value:unknown):value is string=>typeof value==='string'&&/^[a-z0-9][a-z0-9-]{1,79}$/.test(value);
export function validAccessCode(value:unknown):value is string{return typeof value==='string'&&value.length>=8&&value.length<=64&&!/[\s\p{C}]/u.test(value)}
async function derive(code:string,salt:string){return new Promise<Buffer>((resolve,reject)=>scrypt(code,salt,64,{N:16384,r:8,p:1,maxmem:33554432},(e,b)=>e?reject(e):resolve(b)))}
export async function hashAccessCode(value:unknown){if(!validAccessCode(value))throw new Error('invalid_access_code');const salt=randomBytes(16).toString('base64url');return {salt,hash:(await derive(value,salt)).toString('hex')}}
export async function checkAccessCode(value:unknown,salt:string,hash:string){if(!validAccessCode(value)||!/^[a-f0-9]{128}$/.test(hash))return false;const got=await derive(value,salt);return timingSafeEqual(got,Buffer.from(hash,'hex'))}
export function sessionCookie(client:string,version:string){const value=seal(JSON.stringify({client,version,expiry:Date.now()+28800000}),'dashboard-access-session');return `${accessCookie}=${value}; Path=/api/client-dashboard; Max-Age=28800; HttpOnly; Secure; SameSite=Strict`}
export function clearSessionCookie(){return `${accessCookie}=; Path=/api/client-dashboard; Max-Age=0; HttpOnly; Secure; SameSite=Strict`}
export function sessionAllowed(req:Request,client:string,version:string){const cookie=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith(accessCookie+'='))?.slice(accessCookie.length+1);if(!cookie)return false;try{const value=JSON.parse(unseal(cookie,'dashboard-access-session'));return value.client===client&&value.version===version&&Number.isFinite(value.expiry)&&value.expiry>Date.now()}catch{return false}}
export function attemptKey(req:Request,slug:string){const forwarded=req.headers['x-vercel-forwarded-for']??req.headers['x-forwarded-for']??req.socket?.remoteAddress??'unknown',ip=(Array.isArray(forwarded)?forwarded[0]:forwarded).split(',')[0].trim().slice(0,100);return createHmac('sha256',process.env.KOMMO_ENCRYPTION_KEY??'').update('dashboard-attempt:'+slug+':'+ip).digest('hex')}
export function accessSlug(name:string,client:string){const base=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);return base.length>=2?base:'cliente-'+client.slice(0,8)}
