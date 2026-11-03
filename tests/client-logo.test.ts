import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createClientLogoCache} from '../src/lib/clientLogoCache.ts';
registerHooks({resolve(s,c,n){return n(s==='./_lib/trackingServer.js'&&c.parentURL?.endsWith('/api/client-logo.ts')?'./_lib/trackingServer.ts':s,c);}});
const {default:handler}=await import('../api/client-logo.ts');
const a='589481f6-3a15-4c93-b384-5d33373c20e3',b='14d33095-9db2-4f7f-b667-10110c52c919';
test('logos are batched once and cannot sign an unassigned client or return an unrelated storage path',async()=>{
 const old={fetch:globalThis.fetch,url:process.env.VITE_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};
 process.env.VITE_SUPABASE_URL='https://storage.test';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-service';
 const calls:string[]=[];
 globalThis.fetch=async(input,init)=>{
  const url=String(input);calls.push(url);let value:unknown;
  if(url.endsWith('/auth/v1/user'))value={id:'synthetic-user'};
  else if(url.includes('/rest/v1/clients?')){assert.equal(new Headers(init?.headers).get('authorization'),'Bearer synthetic-user-token');value=[{id:a}];}
  else if(url.endsWith('/object/sign/client-logos')){
   assert.deepEqual(JSON.parse(String(init?.body)).paths,[`${a}/logo.png`]);
   value=[{path:`${a}/logo.png`,signedURL:`/object/sign/client-logos/${a}/logo.png?token=synthetic-image-link`},{path:`${b}/logo.png`,signedURL:`/object/sign/client-logos/${b}/logo.png?token=unrelated`}];
  }else throw Error('unexpected request');
  return new Response(JSON.stringify(value),{status:200});
 };
 const res={statusCode:0,body:'',setHeader(){},end(value:string){this.body=value;}};
 try{
  await handler({method:'GET',url:`/api/client-logo?client_ids=${a},${b},${a}`,headers:{authorization:'Bearer synthetic-user-token'}} as never,res as never);
  assert.equal(res.statusCode,200);assert.equal(calls.length,3);
  const logos=JSON.parse(res.body).logos;assert.equal(Object.keys(logos).length,1);assert.equal(logos[b],undefined);assert.ok(logos[a].url.startsWith('https://storage.test/storage/v1/object/sign/'));assert.equal(res.body.includes('synthetic-user-token'),false);
 }finally{globalThis.fetch=old.fetch;for(const [k,v] of Object.entries({VITE_SUPABASE_URL:old.url,SUPABASE_SERVICE_ROLE_KEY:old.key})){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test('same-render logo requests coalesce, revisits reuse memory, and expiration refreshes instead of reusing a dead link',async()=>{
 let time=1000;const requests:{user:string;ids:string[]}[]=[];
 const cache=createClientLogoCache(async(user,ids)=>{requests.push({user,ids});return Object.fromEntries(ids.map(id=>[id,{url:`logo:${user}:${id}:${time}`,expires_at:time+1000}]));},()=>time);
 const first=cache.load('user-one',a),duplicate=cache.load('user-one',a),other=cache.load('user-one',b);
 assert.equal(first,duplicate);await Promise.all([first,other]);assert.equal(requests.length,1);assert.deepEqual(requests[0].ids,[a,b]);
 await cache.load('user-one',a);assert.equal(requests.length,1);
 time=2100;await cache.load('user-one',a);assert.equal(requests.length,2);assert.equal(cache.get('user-one',a),`logo:user-one:${a}:2100`);
 assert.equal(cache.get('user-two',a),'');await cache.load('user-two',a);assert.equal(requests.length,3);
});
test('upload wins over a late fetch and signing out cannot revive a previous user logo',async()=>{
 const resolves:((value:Record<string,{url:string;expires_at:number}|null>)=>void)[]=[];
 const cache=createClientLogoCache(()=>new Promise(resolve=>resolves.push(resolve)),()=>1000);
 const pending=cache.load('user',a);await Promise.resolve();cache.put('user',a,{url:'uploaded-logo',expires_at:10000});resolves[0]({[a]:{url:'old-logo',expires_at:10000}});await pending;await Promise.resolve();assert.equal(cache.get('user',a),'uploaded-logo');
 const second=cache.load('user',b);await Promise.resolve();cache.clear();resolves[1]({[b]:{url:'old-user-logo',expires_at:10000}});await second;await Promise.resolve();assert.equal(cache.get('user',b),'');assert.equal(cache.get('user',a),'');
});
