import {evoSaleInstant,type EvoCandidate} from './evoAttribution.js';
import {evoGet,EvoReadError,type EvoSecret} from './evo.js';
export function evoPreviewPeriod(start:unknown,end:unknown){
 if(typeof start!=='string'||typeof end!=='string'||![start,end].every(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d)||start>end||Date.parse(end)-Date.parse(start)>30*86400000)throw new Error('invalid_period');
 return {start,end};
}
export async function evoEnrollmentPreview(secret:EvoSecret,start:string,end:string,branchId:number,onCandidate?:(c:EvoCandidate)=>void,timeZoneFallback?:string){
 const data:unknown[]=[];let pages=0;
 const dayAfter=(value:string,days:number)=>new Date(Date.parse(value+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
 async function readRange(since:string,until:string):Promise<unknown[]> {
  const found:unknown[]=[];
  for(let page=0;page<10;page++){
   if(++pages>120)throw new Error('evo_preview_too_large');
   const body=await evoGet(secret,'v2/sales',{idBranch:String(branchId),dateSaleStart:since,dateSaleEnd:until,onlyMembership:'true',atLeastMonthly:'true',showReceivables:'false',take:'100',skip:String(page*100)});
   const rows=Array.isArray(body)?body:body&&typeof body==='object'&&'idSale' in body?[body]:null;
   if(!rows||rows.length>100)throw new EvoReadError('evo_invalid_response','v2/sales',200);
   found.push(...rows);if(rows.length<100)return found;
  }
  if(since===until)throw new Error('evo_preview_too_large');
  const days=Math.round((Date.parse(until)-Date.parse(since))/86400000);
  const middle=dayAfter(since,Math.floor(days/2));
  // Discard the incomplete page set. Smaller complete ranges are deduplicated
  // by sale/contract IDs below, so interval boundaries cannot inflate totals.
  return [...await readRange(since,middle),...await readRange(dayAfter(middle,1),until)];
 }
 for(let since=start;since<=end;){const until=dayAfter(since,6)<end?dayAfter(since,6):end;data.push(...await readRange(since,until));since=dayAfter(until,1)}
 const members=new Set<number>(),sales=new Set<number>(),contracts=new Set<number>(),plans=new Map<string,{name:string;contracts:number;canceled:number}>();
 const firstMembers=new Set<number>(),renewals=new Set<number>();let unclassified=0;
 for(const value of data){
  if(!value||typeof value!=='object')throw new Error('evo_invalid_response');const r=value as Record<string,unknown>;
  if(Number(r.idBranch)!==branchId)throw new Error('evo_overlapping_scope');
  const id=Number(r.idMember),sale=Number(r.idSale);if(!Number.isSafeInteger(id)||id<=0||!Number.isSafeInteger(sale)||sale<=0||!Array.isArray(r.saleItens))throw new Error('evo_invalid_response');
  if(sales.has(sale))continue;sales.add(sale);members.add(id);
  const member=r.member&&typeof r.member==='object'?r.member as Record<string,unknown>:{},first=Number(member.idFirstMemberMembership);
  const renewal=r.registrationKind==='renewal'||member.registrationKind==='renewal'||Number(r.idSaleRecurrency)>0;
  if(renewal)renewals.add(sale);
  let classified=false;
  for(const item of r.saleItens){
   if(!item||typeof item!=='object')throw new Error('evo_invalid_response');const p=item as Record<string,unknown>,contract=Number(p.idMemberMembership);
   if(!Number.isSafeInteger(contract)||contract<=0)continue;
   if(p.additionalType||p.flReceiptOnly)continue;
   if(r.removed===false&&!renewal&&first>0&&contract===first&&!Number(p.idMembershipRenewed)&&!r.idSaleMigration){
    if(!firstMembers.has(id)){const contacts=Array.isArray(member.contacts)?member.contacts:[],phones=contacts.flatMap(c=>{if(!c||typeof c!=='object')return [];const text=(c as Record<string,unknown>).description;return typeof text==='string'&&/^[+()\d\s.-]+$/.test(text)?[text]:[]});onCandidate?.({key:`${branchId}:${id}`,phones,at:evoSaleInstant(r.saleDate,r.timeZone,timeZoneFallback)})}
    firstMembers.add(id);classified=true
   }
   if(contracts.has(contract))continue;contracts.add(contract);
   const name=typeof p.item==='string'?p.item.slice(0,160):typeof p.description==='string'?p.description.slice(0,160):'Plano não informado',group=plans.get(name)??{name,contracts:0,canceled:0};group.contracts++;if(r.removed)group.canceled++;plans.set(name,group);
  }
  if(!renewal&&!classified&&!r.removed)unclassified++;
 }
 return {pages,scope:'monthly_sales',contracts:contracts.size,members:members.size,sales:sales.size,first_memberships:firstMembers.size,renewals:renewals.size,unclassified,plans:[...plans.values()].sort((a,b)=>b.contracts-a.contracts)};
}
