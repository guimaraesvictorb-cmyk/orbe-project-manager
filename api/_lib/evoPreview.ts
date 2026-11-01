import {evoGet,EvoReadError,type EvoSecret} from './evo.js';
export function evoPreviewPeriod(start:unknown,end:unknown){
 if(typeof start!=='string'||typeof end!=='string'||![start,end].every(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d)||start>end||Date.parse(end)-Date.parse(start)>30*86400000)throw new Error('invalid_period');
 return {start,end};
}
export async function evoEnrollmentPreview(secret:EvoSecret,start:string,end:string,branchId:number){
 const data:unknown[]=[];let complete=false,pages=0;
 // EVO documents a maximum page size of 25. Never assume a requested 1000
 // is honored, and never mix the special VIP/aggregator/transfer filters here.
 for(let page=0;page<10;page++){
  const rows=await evoGet(secret,'v3/membermembership',{registerDateStart:start+'T03:00:00Z',registerDateEnd:new Date(Date.parse(end+'T03:00:00Z')+86400000-1).toISOString(),showTransfers:'false',showAggregators:'false',showVips:'false',contractType:'1,3,4,5,6,7,8,9,10',take:'25',skip:String(page*25)});
  pages++;
  if(!Array.isArray(rows))throw new EvoReadError('evo_invalid_response','v3/membermembership',200);
  if(rows.length>25)throw new EvoReadError('evo_invalid_response','v3/membermembership',200);
  data.push(...rows);if(rows.length<25){complete=true;break}
 }
 if(!complete)throw new Error('evo_preview_too_large');
 const members=new Set<number>(),contracts=new Set<string>(),plans=new Map<string,{name:string;contracts:number;canceled:number}>();
 for(const value of data){if(!value||typeof value!=='object')throw new Error('evo_invalid_response');const r=value as Record<string,unknown>;if(Number(r.idBranch)!==branchId)throw new Error('evo_overlapping_scope');const id=Number(r.idMember),contract=String(r.idMemberMemberShip??'');if(!Number.isSafeInteger(id)||id<=0||!/^\d+$/.test(contract))throw new Error('evo_invalid_response');if(contracts.has(contract))continue;contracts.add(contract);members.add(id);const name=typeof r.nameMembership==='string'?r.nameMembership.slice(0,160):'Plano não informado',p=plans.get(name)??{name,contracts:0,canceled:0};p.contracts++;if(typeof r.cancelDate==='string'&&Date.parse(r.cancelDate)>0)p.canceled++;plans.set(name,p)}
 return {pages,scope:'regular',contracts:contracts.size,members:members.size,plans:[...plans.values()].sort((a,b)=>b.contracts-a.contracts)};
}
