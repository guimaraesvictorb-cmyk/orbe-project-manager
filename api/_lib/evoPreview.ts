import {evoGet,EvoReadError,type EvoSecret} from './evo.js';
export function evoPreviewPeriod(start:unknown,end:unknown){
 if(typeof start!=='string'||typeof end!=='string'||![start,end].every(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d)||start>end||Date.parse(end)-Date.parse(start)>30*86400000)throw new Error('invalid_period');
 return {start,end};
}
export async function evoEnrollmentPreview(secret:EvoSecret,start:string,end:string,branchId:number){
 const data=await evoGet(secret,'v3/membermembership',{registerDateStart:start+'T03:00:00Z',registerDateEnd:new Date(Date.parse(end+'T03:00:00Z')+86400000-1).toISOString(),showTransfers:'true',showAggregators:'true',showVips:'true',take:'1000',skip:'0'});
 if(!Array.isArray(data))throw new EvoReadError('evo_invalid_response','v3/membermembership',200);
 // One bounded page per key; reaching the page limit withholds the summary.
 if(data.length===1000)throw new Error('evo_preview_too_large');
 const members=new Set<number>(),contracts=new Set<string>(),plans=new Map<string,{name:string;contracts:number;canceled:number}>();
 for(const value of data){if(!value||typeof value!=='object')throw new Error('evo_invalid_response');const r=value as Record<string,unknown>;if(Number(r.idBranch)!==branchId)throw new Error('evo_overlapping_scope');const id=Number(r.idMember),contract=String(r.idMemberMemberShip??'');if(!Number.isSafeInteger(id)||id<=0||!/^\d+$/.test(contract))throw new Error('evo_invalid_response');if(contracts.has(contract))continue;contracts.add(contract);members.add(id);const name=typeof r.nameMembership==='string'?r.nameMembership.slice(0,160):'Plano não informado',p=plans.get(name)??{name,contracts:0,canceled:0};p.contracts++;if(typeof r.cancelDate==='string'&&Date.parse(r.cancelDate)>0)p.canceled++;plans.set(name,p)}
 return {contracts:contracts.size,members:members.size,plans:[...plans.values()].sort((a,b)=>b.contracts-a.contracts)};
}
