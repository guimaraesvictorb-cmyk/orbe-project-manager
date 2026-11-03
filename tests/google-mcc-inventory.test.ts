import test from 'node:test'
import assert from 'node:assert/strict'
import {registerHooks} from 'node:module'
import type {MccAccount} from '../api/_lib/googleMccInventory.ts'
registerHooks({resolve(s,c,n){return n(c.parentURL?.includes('/api/')&&s.endsWith('.js')?s.replace(/\.js$/,'.ts'):s,c)}})
const {googleMccInventory,exactMccMatches}=await import('../api/_lib/googleMccInventory.ts')
const manager='9999999999',secrets={client_id:'synthetic.apps.googleusercontent.com',client_secret:'SYNTHETIC_CLIENT_SECRET',refresh_token:'SYNTHETIC_REFRESH',developer_token:'SYNTHETIC_DEVELOPER'}
test('MCC inventory uses one manager context, reads descendants and rejects partial or unsafe provider data',async()=>{
 const before=globalThis.fetch;let repeated=false,calls=0
 globalThis.fetch=async(url,init)=>{
  const target=new URL(String(url));if(target.origin==='https://oauth2.googleapis.com')return new Response(JSON.stringify({access_token:'SYNTHETIC_ACCESS'}))
  assert.equal(target.origin,'https://googleads.googleapis.com');assert.ok(target.pathname.includes(`/customers/${manager}/`));assert.equal((init?.headers as Record<string,string>)['login-customer-id'],manager)
  assert.equal(new Headers(init?.headers).has('developer-token'),false)
  const body=JSON.parse(String(init?.body));assert.match(body.query,/^SELECT /);calls++
  const value=body.query.includes('FROM customer LIMIT')?{results:[{customer:{id:manager,manager:true,descriptiveName:'Orbe MCC'}}]}:body.pageToken?{results:[{customerClient:{id:'1112223334',descriptiveName:'Octagon',currencyCode:'BRL',manager:false,level:2}}],...(repeated?{nextPageToken:'page-2'}:{})}:{results:[{customerClient:{id:'3528081021',descriptiveName:'Rayafit',currencyCode:'BRL',manager:false,level:1}}],nextPageToken:'page-2'}
  return new Response(JSON.stringify(value))
 }
 try{const result=await googleMccInventory(manager,{...secrets,developer_token:undefined});assert.equal(result.status,'ready');if(result.status==='ready')assert.equal(result.accounts.length,2);assert.equal(calls,3);assert.equal(JSON.stringify(result).includes('SYNTHETIC'),false);repeated=true;await assert.rejects(()=>googleMccInventory(manager,secrets),/incomplete/)}finally{globalThis.fetch=before}
})
test('client matching requires a unique exact account ID, never a similar client name',()=>{
 const account=(id:string,name:string)=>({id,name,manager:false,currency:'BRL',timezone:null,status:'ENABLED',level:1}) as MccAccount
 const result=exactMccMatches([account('3528081021','Misleading name'),account('1112223334','Rayafit')],[{id:'rayafit',google_ads_account_id:'352-808-1021'},{id:'other',google_ads_account_id:null}]);assert.deepEqual(result,[{account_id:'3528081021',client_id:'rayafit'},{account_id:'1112223334',client_id:null}])
 assert.equal(exactMccMatches([account('3528081021','Rayafit')],[{id:'one',google_ads_account_id:'3528081021'},{id:'two',google_ads_account_id:'3528081021'}])[0].client_id,null)
})
