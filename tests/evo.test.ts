import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module'
registerHooks({resolve(s,c,n){return n(c.parentURL?.includes('/api/')&&['./_lib/trackingServer.js','./_lib/qrAccess.js','./_lib/kommo.js','./_lib/evo.js','./_lib/evoPreview.js','./evo.js','./trackingServer.js'].includes(s)?s.replace(/\.js$/,'.ts'):s,c)}})
const {evoCredentials,evoBinding,evoGet,evoBranches,verifyEvo}=await import('../api/_lib/evo.ts')
const {seal,unseal}=await import('../api/_lib/kommo.ts')
const {default:handler}=await import('../api/evo-connection.ts')
const client='589481f6-3a15-4c93-b384-5d33373c20e3',secret={dns:'synthetic-branch',token:'SYNTHETIC_NOT_REAL_EVO_TOKEN'}
test('rejects URL usernames, redacted placeholders and invalid secrets; seals each client and slot independently',()=>{
 for(const invalid of [{dns:'https://example.com'},{token:'<redacted>'},{token:'bad\nsecret'},{token:'short'}])assert.throws(()=>evoCredentials({...secret,...invalid}))
 const previous=process.env.KOMMO_ENCRYPTION_KEY;process.env.KOMMO_ENCRYPTION_KEY='a'.repeat(64)
 try{const cipher=seal(JSON.stringify(secret),evoBinding(client,'ibes'));assert.equal(cipher.includes(secret.token),false);assert.deepEqual(JSON.parse(unseal(cipher,evoBinding(client,'ibes'))),secret);for(const binding of [evoBinding(client,'alecrim'),evoBinding('another','ibes'),client])assert.throws(()=>unseal(cipher,binding))}finally{if(previous)process.env.KOMMO_ENCRYPTION_KEY=previous;else delete process.env.KOMMO_ENCRYPTION_KEY}
})
test('verification uses only fixed official GET endpoints, bounds probes and discards student data',async()=>{
 const original=globalThis.fetch,paths:string[]=[]
 globalThis.fetch=async(url,init)=>{const u=new URL(String(url));paths.push(u.pathname);assert.equal(u.origin,'https://evo-integracao-api.w12app.com.br');assert.equal(init?.method,undefined);assert.equal(init?.redirect,'error');assert.equal(u.searchParams.toString().includes(secret.token),false);assert.equal(new Headers(init?.headers).get('Authorization'),`Basic ${Buffer.from(secret.dns+':'+secret.token).toString('base64')}`);if(u.pathname.endsWith('/configuration'))return new Response(JSON.stringify([{idBranch:1,name:'Unidade sintética',cnpj:'PRIVATE'}]));assert.equal(u.searchParams.get('take'),'1');if(u.pathname.endsWith('/members/basic'))assert.equal(u.searchParams.get('idMember'),'987');if(u.pathname.endsWith('/receivables')){assert.match(u.searchParams.get('receivingDateStart')||'',/^\d{4}-\d{2}-\d{2}$/);assert.match(u.searchParams.get('receivingDateEnd')||'',/^\d{4}-\d{2}-\d{2}$/)}return new Response(JSON.stringify([{idMember:987,name:'PRIVATE_STUDENT',amount:500}]))}
 try{const result=await verifyEvo(secret);assert.equal(paths.length,5);assert.equal(result.checked.length,4);assert.equal(JSON.stringify(result).includes('PRIVATE'),false);assert.equal(result.branches[0]?.id,1);await assert.rejects(()=>evoGet(secret,'v1/receivables/pay'),{message:'invalid_endpoint'});assert.throws(()=>evoBranches([{idBranch:0,name:'Invalid'}]))}finally{globalThis.fetch=original}
})
test('provider errors never expose private response bodies',async()=>{
 const original=globalThis.fetch
 try{for(const [status,error] of [[401,'evo_access_denied'],[403,'evo_permission_denied'],[429,'evo_rate_limited'],[500,'evo_unavailable']] as const){globalThis.fetch=async()=>new Response(JSON.stringify({error:secret.token}),{status});await assert.rejects(()=>evoGet(secret,'v1/configuration'),{message:error})}}finally{globalThis.fetch=original}
})
test('API enforces client ACL, admin and financial access and exposes metadata only',async()=>{
 const before={url:process.env.VITE_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,crypto:process.env.KOMMO_ENCRYPTION_KEY,fetch:globalThis.fetch}
 process.env.VITE_SUPABASE_URL='https://synthetic.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test';process.env.KOMMO_ENCRYPTION_KEY='a'.repeat(64)
 let role='admin',finance=true,clientVisible=true,cipher='',actor='';const requested:string[]=[]
 globalThis.fetch=async(url,init)=>{const path=String(url);requested.push(path);let value:unknown=[]
 if(path.endsWith('/auth/v1/user'))value={id:'actor'}
 else if(path.includes('/profiles?'))value=[{role,is_active:true,can_view_financials:finance}]
 else if(path.includes('/clients?'))value=clientVisible?[{id:client}]:[]
 else if(path.includes('/client_assignments?'))value=[]
 else if(path.includes('/rpc/wa_evo_save')){const body=JSON.parse(String(init?.body));cipher=body.p_ciphertext;actor=body.p_actor;value=null}
 else if(path.includes('/wa_evo_credentials?'))value=[{slot:'ibes',branches:[],checked_at:null}]
 else throw new Error('unexpected_fetch')
 return new Response(JSON.stringify(value))}
 async function call(action='status',origin='https://studio.agenciaorbe.co'){const res={statusCode:0,body:'',setHeader(){},end(v:string){this.body=v}};await handler({method:'POST',headers:{origin,'content-type':'application/json',authorization:'Bearer synthetic.jwt.token'},body:{action,client_id:client,slot:'ibes',...secret,expires_at:'2030-11-01',actor_id:'forged'}} as never,res as never);return res}
 try{assert.equal((await call('save','https://evil.invalid')).statusCode,403);finance=false;assert.equal((await call('save')).statusCode,403);finance=true;role='gt';assert.equal((await call('save')).statusCode,403);role='admin';clientVisible=false;assert.equal((await call('save')).statusCode,403);assert.equal(cipher,'');clientVisible=true;const r=await call('save');assert.equal(r.statusCode,200);assert.equal(actor,'actor');assert.deepEqual(JSON.parse(unseal(cipher,evoBinding(client,'ibes'))),secret);assert.equal(r.body.includes(cipher),false);assert.equal(r.body.includes(secret.token),false);assert.ok(requested.filter(p=>p.includes('/wa_evo_credentials?')).every(p=>!p.includes('ciphertext')))}finally{globalThis.fetch=before.fetch;for(const [key,v] of Object.entries({VITE_SUPABASE_URL:before.url,SUPABASE_SERVICE_ROLE_KEY:before.key,KOMMO_ENCRYPTION_KEY:before.crypto})){if(v===undefined)delete process.env[key];else process.env[key]=v}}
})
test('no membership leaves member verification pending instead of inventing an identity',async()=>{
 const original=globalThis.fetch,seen:string[]=[]
 globalThis.fetch=async(url)=>{const path=new URL(String(url)).pathname;seen.push(path);return new Response(JSON.stringify(path.endsWith('/configuration')?[{idBranch:1,name:'Synthetic'}]:[]))}
 try{await assert.rejects(()=>verifyEvo(secret),{message:'evo_member_probe_pending',endpoint:'v3/membermembership',httpStatus:200});assert.equal(seen.some(p=>p.endsWith('/members/basic')),false)}finally{globalThis.fetch=original}
})

const {evoPreviewPeriod,evoEnrollmentPreview}=await import('../api/_lib/evoPreview.ts')
test('enrollment preview bounds periods and returns plan aggregates without private student data',async()=>{
 assert.deepEqual(evoPreviewPeriod('2026-10-28','2026-11-01'),{start:'2026-10-28',end:'2026-11-01'});for(const period of [['2026-10-01','2026-11-02'],['2026-02-31','2026-03-01'],['2026-11-01','2026-10-01']])assert.throws(()=>evoPreviewPeriod(period[0],period[1]))
 const original=globalThis.fetch;let mode='normal';globalThis.fetch=async(url)=>{const u=new URL(String(url));assert.equal(u.searchParams.get('registerDateStart'),'2026-10-28T03:00:00Z');assert.equal(u.searchParams.get('registerDateEnd'),'2026-11-02T02:59:59.999Z');assert.equal(u.searchParams.get('take'),'25');assert.equal(u.searchParams.get('showVips'),'false');assert.equal(u.searchParams.get('contractType'),'1,3,4,5,6,7,8,9,10');assert.ok(['1','2'].includes(u.searchParams.get('statusMemberMembership')||''));assert.equal(u.searchParams.get('showAggregators'),'false');assert.equal(u.searchParams.get('showTransfers'),'false');const row={idMember:123,idMemberMemberShip:456,idBranch:mode==='wrong'?2:1,name:'PRIVATE_STUDENT',nameMembership:'Plano sintético',saleValue:999,cancelDate:null};return new Response(JSON.stringify(mode==='large'?Array.from({length:25},(_,i)=>({...row,idMemberMemberShip:456+i})):mode==='paginate'?(u.searchParams.get('skip')==='0'?Array.from({length:25},(_,i)=>({...row,idMemberMemberShip:456+i})):[{...row,idMemberMemberShip:481}]):[row,row]))}
 try{const result=await evoEnrollmentPreview(secret,'2026-10-28','2026-11-01',1);assert.equal(result.contracts,1);assert.equal(result.members,1);assert.equal(JSON.stringify(result).includes('PRIVATE_STUDENT'),false);assert.equal(JSON.stringify(result).includes('123'),false);mode='paginate';const paged=await evoEnrollmentPreview(secret,'2026-10-28','2026-11-01',1);assert.equal(paged.contracts,26);assert.equal(paged.pages,4);mode='wrong';await assert.rejects(()=>evoEnrollmentPreview(secret,'2026-10-28','2026-11-01',1),{message:'evo_overlapping_scope'});mode='large';await assert.rejects(()=>evoEnrollmentPreview(secret,'2026-10-28','2026-11-01',1),{message:'evo_preview_too_large'})}finally{globalThis.fetch=original}
})
