import {evoGet,type EvoSecret} from './evo.js';
export async function evoMemberRevenue(secret:EvoSecret,branchId:number,memberId:number,from:string,asOf:string){
 const start=from.slice(0,10),end=new Date(Date.parse(asOf)-10800000).toISOString().slice(0,10),seen=new Map<number,string>();let cents=0,complete=false;
 for(let page=0;page<3;page++){
  const body=await evoGet(secret,'v1/receivables',{idBranch:String(branchId),memberId:String(memberId),receivingDateStart:start,receivingDateEnd:end,accountStatus:'1,2,3,4',take:'100',skip:String(page*100)});
  if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('evo_financial_shape');const root=body as Record<string,unknown>;
  const rows=Array.isArray(root.lista)?root.lista:Array.isArray(root.list)?root.list:null;if(!rows||rows.length>100)throw new Error('evo_financial_shape');
  for(const value of rows){
   if(!value||typeof value!=='object')throw new Error('evo_financial_shape');const row=value as Record<string,unknown>,id=Number(row.idReceivable),paid=Number(row.ammountPaid);
   if(!Number.isSafeInteger(id)||id<=0||!Number.isFinite(paid)||paid<0)throw new Error('evo_financial_review');
   const signature=JSON.stringify([paid,row.status,row.paymentType,row.receivingDate,row.cancellationDate,row.idMemberPayer,row.idBranchMember,row.idReceivableFrom,row.creditDetails]);const previous=seen.get(id);if(previous){if(previous!==signature)throw new Error('evo_financial_review');continue}seen.set(id,signature);if(paid===0)continue;
   if(Number(row.idBranchMember)!==branchId)throw new Error('evo_financial_scope');
   const responsible=Array.isArray(row.responsibles)?row.responsibles:[];
   if(Number(row.idMemberPayer)!==memberId&&!responsible.some(r=>r&&typeof r==='object'&&Number((r as Record<string,unknown>).idMember)===memberId))throw new Error('evo_financial_scope');
   const status=row.status&&typeof row.status==='object'?Number((row.status as Record<string,unknown>).id):0;
   const payment=row.paymentType&&typeof row.paymentType==='object'?Number((row.paymentType as Record<string,unknown>).id):0;
   if([11,15].includes(payment))continue; // Sale credits and gift cards are not new cash receipts.
   if(status!==2||row.cancellationDate||Number(row.idReceivableFrom)>0||Array.isArray(row.creditDetails)&&row.creditDetails.length)throw new Error('evo_financial_review');
   if(![1,2,3,4,5,6,7,8,9,12,13,18].includes(payment))throw new Error('evo_financial_review');
   const received=typeof row.receivingDate==='string'?row.receivingDate:'';if(!/^\d{4}-\d{2}-\d{2}/.test(received)||!Number.isFinite(Date.parse(received)))throw new Error('evo_financial_review');
   if(received.slice(0,10)<start||received.slice(0,10)>end)throw new Error('evo_financial_scope');
   if(/(Z|[+-]\d{2}:\d{2})$/.test(received)&&Date.parse(received)>Date.parse(asOf))continue;
   cents+=Math.round(paid*100);if(!Number.isSafeInteger(cents))throw new Error('evo_financial_review');
  }
  const total=Number(root.qtde);if(rows.length<100){if(Number.isFinite(total)&&total>page*100+rows.length)throw new Error('evo_financial_incomplete');complete=true;break}
 }
 if(!complete)throw new Error('evo_financial_incomplete');return cents;
}
