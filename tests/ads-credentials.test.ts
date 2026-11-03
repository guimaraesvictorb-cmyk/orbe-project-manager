import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module'
registerHooks({resolve(s,c,n){const allowed=['./_lib/googleMcc.js','./googleMcc.js','./googleMccInventory.js','./_lib/trackingServer.js','./_lib/qrAccess.js','./_lib/kommo.js','./_lib/adsCredentials.js','./_lib/googleAdsReport.js','./_lib/googleAdsOAuth.js','./trackingServer.js','./qrAccess.js','./kommo.js','./adsCredentials.js'];return n(allowed.includes(s)&&c.parentURL?.includes('/api/')?s.replace(/\.js$/,'.ts'):s,c)}})
const {normalizeAdsCredentials,adsBinding}=await import('../api/_lib/adsCredentials.ts')
const {seal,unseal}=await import('../api/_lib/kommo.ts')
const {default:handler}=await import('../api/ads-credentials.ts')
const client='589481f6-3a15-4c93-b384-5d33373c20e3'
const meta={platform:'meta',account_id:'act_2988254138081501',access_token:'SYNTHETIC_TOKEN_NOT_REAL_123456789'}
const google={platform:'google',account_id:'352-808-1021',oauth_client_id:'123456789-example.apps.googleusercontent.com',oauth_client_secret:'SYNTHETIC_SECRET_NOT_REAL'}
test('account-bound normalization whitelists secrets and marks unverified versus OAuth pending',()=>{
 const m=normalizeAdsCredentials({...meta,unrelated:'never persist'});assert.equal(m.account_id,'2988254138081501');assert.equal(m.status,'saved_unverified');assert.equal('unrelated' in m.secrets,false)
 const g=normalizeAdsCredentials(google);assert.equal(g.account_id,'3528081021');assert.equal(g.status,'oauth_pending');assert.equal(g.has_refresh_token,false)
 assert.equal(normalizeAdsCredentials({...google,refresh_token:'SYNTHETIC_REFRESH_NOT_REAL'}).status,'saved_unverified')
 for(const change of [{account_id:'bad?x=secret'},{account_id:'123'},{access_token:'bad\nsecret'}])assert.throws(()=>normalizeAdsCredentials({...meta,...change}))
 assert.throws(()=>normalizeAdsCredentials({...google,oauth_client_id:'service@example.iam.gserviceaccount.com'}))
 assert.throws(()=>normalizeAdsCredentials({...meta,expires_at:'2020-01-01'}));assert.throws(()=>normalizeAdsCredentials({...meta,expires_at:'2035-02-31'}))
})
test('encrypted credential cannot be decrypted under another client, platform or Kommo binding',()=>{
 const previous=process.env.KOMMO_ENCRYPTION_KEY;process.env.KOMMO_ENCRYPTION_KEY='a'.repeat(64)
 try{const cipher=seal(JSON.stringify(meta),adsBinding(client,'meta'));assert.equal(cipher.includes(meta.access_token),false);assert.equal(JSON.parse(unseal(cipher,adsBinding(client,'meta'))).access_token,meta.access_token);for(const binding of [adsBinding('other','meta'),adsBinding(client,'google'),client])assert.throws(()=>unseal(cipher,binding))}finally{if(previous)process.env.KOMMO_ENCRYPTION_KEY=previous;else delete process.env.KOMMO_ENCRYPTION_KEY}
})
test('API restricts administration, rejects other origins, encrypts writes and returns metadata only',async()=>{
 const before={url:process.env.VITE_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,crypto:process.env.KOMMO_ENCRYPTION_KEY,fetch:globalThis.fetch}
 process.env.VITE_SUPABASE_URL='https://synthetic.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test';process.env.KOMMO_ENCRYPTION_KEY='a'.repeat(64)
 let role='admin',stored=false,seenCipher='',forged=false;const paths:string[]=[]
 globalThis.fetch=async(url,init)=>{const path=String(url);paths.push(path);let value:unknown
  if(path.endsWith('/auth/v1/user'))value={id:'user'}
  else if(path.includes('/profiles?'))value=[{id:'user',role,is_active:true}]
  else if(path.includes('/clients?'))value=[{id:client}]
  else if(path.includes('/client_assignments?'))value=[]
  else if(path.includes('/rpc/wa_ads_save')){const body=JSON.parse(String(init?.body));seenCipher=body.p_ciphertext;forged=body.p_actor!=='user';stored=true;value=null}
  else if(path.includes('select=updated_at'))value=[]
  else if(path.includes('/wa_ads_credentials?'))value=stored?[{platform:'meta',account_id:'2988254138081501',status:'saved_unverified',updated_at:'2026-10-31T00:00:00Z'}]:[]
  else if(path.includes('/orbe_google_mcc'))value=[]
  else throw new Error('unexpected_path')
  return new Response(JSON.stringify(value),{status:200})
 }
 async function call(body:unknown,origin='https://studio.agenciaorbe.co'){const res={statusCode:0,body:'',setHeader(){},end(v:string){this.body=v}};await handler({method:'POST',headers:{origin,'content-type':'application/json',authorization:'Bearer synthetic.jwt.token'},body} as never,res as never);return res}
 try{
  assert.equal((await call({action:'save',client_id:client,...meta},'https://evil.invalid')).statusCode,403)
  role='gt';assert.equal((await call({action:'save',client_id:client,...meta})).statusCode,403);assert.equal(stored,false)
  role='admin';const r=await call({action:'save',client_id:client,...meta});assert.equal(r.statusCode,200);assert.equal(forged,false);assert.equal(r.body.includes(meta.access_token),false);assert.equal(r.body.includes(seenCipher),false);assert.equal(JSON.parse(unseal(seenCipher,adsBinding(client,'meta'))).access_token,meta.access_token)
  assert.ok(paths.filter(p=>p.includes('/wa_ads_credentials?')&&!p.includes('select=updated_at')).every(p=>!p.includes('ciphertext')&&!p.includes('select=*')))
 }finally{globalThis.fetch=before.fetch;for(const [key,v] of Object.entries({VITE_SUPABASE_URL:before.url,SUPABASE_SERVICE_ROLE_KEY:before.key,KOMMO_ENCRYPTION_KEY:before.crypto})){if(v===undefined)delete process.env[key];else process.env[key]=v}}
})
test('Meta validation binds account, reads campaigns and never leaks raw provider errors',async()=>{
 const {verifyMetaAccess}=await import('../api/_lib/adsCredentials.ts');const before=globalThis.fetch;const paths:string[]=[];let mode='ok';
 globalThis.fetch=async(url,init)=>{const path=String(url);paths.push(path);assert.equal(path.includes(meta.access_token),false);assert.equal(new Headers(init?.headers).get('Authorization'),`Bearer ${meta.access_token}`);assert.equal(init?.redirect,'error');
 if(mode==='invalid')return new Response(JSON.stringify({error:{code:190,message:meta.access_token}}),{status:400});
 if(path.includes('/campaigns'))return new Response(JSON.stringify({data:[]}));
 return new Response(JSON.stringify({account_id:mode==='mismatch'?'other':'2988254138081501',name:'Synthetic account'}));};
 try{assert.equal((await verifyMetaAccess('2988254138081501',meta.access_token)).status,'access_verified');assert.equal(paths.length,2);mode='mismatch';await assert.rejects(()=>verifyMetaAccess('2988254138081501',meta.access_token),{message:'meta_account_mismatch'});mode='invalid';await assert.rejects(()=>verifyMetaAccess('2988254138081501',meta.access_token),{message:'meta_token_invalid'});await assert.rejects(()=>verifyMetaAccess('../other',meta.access_token),{message:'invalid_credentials'});}finally{globalThis.fetch=before}
})

test('Google verification performs a live read and persists verified metadata without returning investments or secrets',async()=>{
 const before={url:process.env.VITE_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,crypto:process.env.KOMMO_ENCRYPTION_KEY,fetch:globalThis.fetch}
 process.env.VITE_SUPABASE_URL='https://synthetic.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test';process.env.KOMMO_ENCRYPTION_KEY='a'.repeat(64)
 const secrets={client_id:'synthetic.apps.googleusercontent.com',client_secret:'SYNTHETIC_CLIENT_SECRET',refresh_token:'SYNTHETIC_REFRESH_TOKEN',developer_token:'SYNTHETIC_DEVELOPER_TOKEN'},ciphertext=seal(JSON.stringify(secrets),adsBinding(client,'google'))
 let verified=false,lastSave:Record<string,unknown>|null=null
 globalThis.fetch=async(url,init)=>{
  const target=new URL(String(url));let value:unknown
  if(target.origin==='https://oauth2.googleapis.com')value={access_token:'SYNTHETIC_ACCESS_TOKEN'}
  else if(target.origin==='https://googleads.googleapis.com'){
   const query=JSON.parse(String(init?.body)).query
   value={results:query.includes('FROM customer')?[{customer:{id:'3528081021',descriptiveName:'Synthetic Google account',currencyCode:'BRL',timeZone:'America/Sao_Paulo'}}]:[{campaign:{id:'1',name:'Synthetic campaign'},segments:{date:'2026-11-01'},metrics:{costMicros:'123450000',clicks:'2',impressions:'10'}}]}
  }else if(target.pathname.endsWith('/auth/v1/user'))value={id:'actor'}
  else if(target.pathname.endsWith('/profiles'))value=[{role:'admin',is_active:true,can_view_financials:false}]
  else if(target.pathname.endsWith('/clients'))value=[{id:client}]
  else if(target.pathname.endsWith('/client_assignments'))value=[]
  else if(target.pathname.endsWith('/wa_ads_credentials'))value=target.searchParams.get('select')?.includes('ciphertext')?[{account_id:'3528081021',ciphertext,has_refresh_token:true,expires_at:null,updated_at:'2026-11-02T00:00:00Z'}]:[{platform:'google',account_id:'3528081021',status:'saved_unverified',has_refresh_token:true,expires_at:null,updated_at:'2026-11-02T00:00:00Z'}]
  else if(target.pathname.endsWith('/rpc/wa_ads_save')){const body=JSON.parse(String(init?.body));lastSave=body;verified=body.p_status==='access_verified';value=[]}
  else if(target.pathname.includes('/orbe_google_mcc'))value=[]
  else throw new Error('unexpected verification request')
  return new Response(JSON.stringify(value))
 }
 try{
  const res={statusCode:0,body:'',setHeader(){},end(value:string){this.body=value}}
  await handler({method:'POST',headers:{origin:'https://studio.agenciaorbe.co','content-type':'application/json',authorization:'Bearer synthetic.jwt.token'},body:{action:'verify',client_id:client,platform:'google'}} as never,res as never)
  assert.equal(res.statusCode,200);assert.equal(JSON.parse(res.body).verification.status,'access_verified');assert.equal(verified,true)
  for(const secret of [...Object.values(secrets),ciphertext,'123450000','spend','totals'])assert.equal(res.body.includes(secret),false)
  const partial={...res,statusCode:0,body:''}
  await handler({method:'POST',headers:{origin:'https://studio.agenciaorbe.co','content-type':'application/json',authorization:'Bearer synthetic.jwt.token'},body:{action:'save_google_developer',client_id:client,developer_token:'SYNTHETIC_REPLACEMENT_DEVELOPER',expected_version:'2026-11-02T00:00:00Z'}} as never,partial as never)
  assert.equal(partial.statusCode,200);assert.ok(lastSave)
  const preserved=JSON.parse(unseal(String((lastSave as Record<string,unknown>).p_ciphertext),adsBinding(client,'google')))
  assert.equal(preserved.refresh_token,secrets.refresh_token);assert.equal(preserved.client_secret,secrets.client_secret);assert.equal(preserved.developer_token,'SYNTHETIC_REPLACEMENT_DEVELOPER')
  assert.equal(partial.body.includes(secrets.refresh_token),false);assert.equal(partial.body.includes('SYNTHETIC_REPLACEMENT_DEVELOPER'),false)
  const replaced={...res,statusCode:0,body:''}
  await handler({method:'POST',headers:{origin:'https://studio.agenciaorbe.co','content-type':'application/json',authorization:'Bearer synthetic.jwt.token'},body:{action:'save',client_id:client,platform:'google',account_id:'3528081021',oauth_client_id:'newweb.apps.googleusercontent.com',oauth_client_secret:'NEW_SYNTHETIC_CLIENT_SECRET',expected_version:'2026-11-02T00:00:00Z'}} as never,replaced as never)
  assert.equal(replaced.statusCode,200)
  const rotated=JSON.parse(unseal(String((lastSave as Record<string,unknown>).p_ciphertext),adsBinding(client,'google')))
  assert.equal(rotated.developer_token,secrets.developer_token);assert.equal(rotated.client_id,'newweb.apps.googleusercontent.com');assert.equal(rotated.refresh_token,'');assert.equal((lastSave as Record<string,unknown>).p_status,'oauth_pending');assert.equal(replaced.body.includes('NEW_SYNTHETIC_CLIENT_SECRET'),false)


 }finally{globalThis.fetch=before.fetch;for(const [key,value]of Object.entries({VITE_SUPABASE_URL:before.url,SUPABASE_SERVICE_ROLE_KEY:before.key,KOMMO_ENCRYPTION_KEY:before.crypto})){if(value===undefined)delete process.env[key];else process.env[key]=value}}
})
