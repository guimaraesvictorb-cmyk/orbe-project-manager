export type EvoSecret={dns:string;token:string};
export const evoBinding=(client:string,slot:string)=>`evo:${client}:${slot}`;
export function evoCredentials(input:Record<string,unknown>):EvoSecret {
 const dns=typeof input.dns==='string'?input.dns.trim():'',token=typeof input.token==='string'?input.token.trim():'';
 // DNS is the Basic-auth username supplied by EVO, never a host or a URL.
 if(!/^[A-Za-z0-9_.-]{2,120}$/.test(dns)||token.length<16||token.length>4096||/[\s<>]/.test(token))throw new Error('invalid_credentials');
 return {dns,token};
}
export class EvoReadError extends Error {
 readonly endpoint:string; readonly httpStatus:number|null;
 constructor(message:string,endpoint:string,httpStatus:number|null){super(message);this.endpoint=endpoint;this.httpStatus=httpStatus}
}
const paths=new Set(['v1/configuration','v1/configuration/api-usage','v1/members/basic','v3/membermembership','v2/sales','v1/receivables']);
export async function evoGet(secret:EvoSecret,path:string,params:Record<string,string>={}){
 if(!paths.has(path))throw new Error('invalid_endpoint');
 const query=new URLSearchParams(params),url=`https://evo-integracao-api.w12app.com.br/api/${path}${query.size?'?'+query:''}`;
 let r:Response;try{r=await fetch(url,{headers:{Accept:'application/json',Authorization:`Basic ${Buffer.from(`${secret.dns}:${secret.token}`).toString('base64')}`},redirect:'error',signal:AbortSignal.timeout(12000)})}catch{throw new EvoReadError('evo_unavailable',path,null)}
 // Never expose provider response bodies: they may echo private fields or secrets.
 if(!r.ok){const code=r.status===401?'evo_access_denied':r.status===403?'evo_permission_denied':r.status===429?'evo_rate_limited':'evo_unavailable';throw new EvoReadError(code,path,r.status)}
 if(Number(r.headers.get('content-length'))>2_000_000)throw new Error('evo_response_too_large');
 const body=await r.text();if(Buffer.byteLength(body)>2_000_000)throw new Error('evo_response_too_large');
 try{return JSON.parse(body) as unknown}catch{throw new Error('evo_invalid_response')}
}
export function evoBranches(data:unknown){
 const list=Array.isArray(data)?data:[data];
 const branches=list.map(value=>{
  if(!value||typeof value!=='object')throw new Error('evo_invalid_response');
  const row=value as Record<string,unknown>,id=Number(row.idBranch),name=typeof row.name==='string'?row.name.trim():'';
  if(!Number.isSafeInteger(id)||id<=0||!name)throw new Error('evo_invalid_response');
  return {id,name:name.slice(0,150)};
 });
 if(!branches.length||branches.length>100)throw new Error('evo_invalid_response');
 return branches;
}
export async function verifyEvo(secret:EvoSecret){
 const branches=evoBranches(await evoGet(secret,'v1/configuration'));
 // Basic member lookup requires an identity filter. Obtain a real ID from one
 // membership first rather than treating an invalid unfiltered request as an outage.
 const checked:string[]=[];
 const memberships=await evoGet(secret,'v3/membermembership',{take:'1',skip:'0'});
 if(!Array.isArray(memberships))throw new EvoReadError('evo_invalid_response','v3/membermembership',200);
 checked.push('matriculas');
 const id=Number(memberships[0]?.idMember);
 if(!Number.isSafeInteger(id)||id<=0)throw new EvoReadError('evo_member_probe_pending','v3/membermembership',200);
 await evoGet(secret,'v1/members/basic',{idMember:String(id),take:'1',skip:'0'});checked.push('alunos');
 for(const [name,path] of [['vendas','v2/sales'],['recebimentos','v1/receivables']] as const){
  await evoGet(secret,path,{take:'1',skip:'0'});checked.push(name);
 }
 return {branches,checked,checked_at:new Date().toISOString()};
}
