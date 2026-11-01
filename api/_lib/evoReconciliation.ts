// Server-only reconciliation rules. Inputs must be normalized from verified EVO
// reads; a CRM win or a registration date is not an enrollment or a payment.
export type ReconciliationLead={id:string;phone:string;firstAt:string;channel:string};
export type ReconciliationMember={key:string;phones:string[];historyComplete:boolean;enrollments:{id:string;at:string;kind:'new'|'renewal'|'reactivation'|'transfer'|'trial'|'aggregator'|'unknown';confirmed:boolean}[]};
export type ReconciliationReceipt={id:string;memberKey:string;receivedAt:string;netCents:number;currency:'BRL';confirmed:boolean;kind:'cash'|'refund'|'credit'|'unknown'};
export type ReconciliationCoverage={leads:boolean;members:boolean;payments:boolean;allBranches:boolean};
export function brPhone(value:string){
 let digits=value.replace(/\D/g,'');if(digits.length===12||digits.length===13){if(!digits.startsWith('55'))return null;digits=digits.slice(2)}
 if(!/^[1-9][0-9][2-9][0-9]{7,8}$/.test(digits))return null;
 // The older eight-digit mobile format and its ninth-digit version are aliases.
 // Shared aliases across multiple members are rejected as ambiguous below.
 if(digits.length===10&&/[6-9]/.test(digits[2]!))digits=digits.slice(0,2)+'9'+digits.slice(2);
 if(digits.length===11&&digits[2]!=='9')return null;
 return '55'+digits;
}
const instant=(v:string)=>{const n=Date.parse(v);if(!Number.isFinite(n))throw new Error('invalid_timestamp');return n};
export function reconcileEvo(input:{leads:ReconciliationLead[];members:ReconciliationMember[];receipts:ReconciliationReceipt[];start:string;end:string;asOf:string;coverage:ReconciliationCoverage;spend:{cents:number;currency:'BRL';start:string;end:string;channels:('Google'|'Meta')[];complete:boolean}|null}){
 const start=instant(input.start),end=instant(input.end),asOf=instant(input.asOf);if(start>=end||end>asOf)throw new Error('invalid_period');
 const spend=input.spend;if(spend&&(!Number.isSafeInteger(spend.cents)||spend.cents<0||spend.currency!=='BRL'||!spend.channels.length||spend.channels.some(c=>!['Google','Meta'].includes(c))))throw new Error('invalid_spend');
 const memberKeys=new Set<string>(),index=new Map<string,ReconciliationMember[]>();
 for(const member of input.members){if(memberKeys.has(member.key))throw new Error('duplicate_member');memberKeys.add(member.key);for(const phone of new Set(member.phones.map(brPhone).filter((p):p is string=>!!p))){const list=index.get(phone)??[];list.push(member);index.set(phone,list)}}
 const contacts=new Map<string,ReconciliationLead>();let invalidPhones=0;
 for(const lead of input.leads){instant(lead.firstAt);const phone=brPhone(lead.phone);if(!phone){invalidPhones++;continue}const prior=contacts.get(phone);if(!prior||instant(lead.firstAt)<instant(prior.firstAt)||lead.firstAt===prior.firstAt&&lead.id<prior.id)contacts.set(phone,lead)}
 const matched=new Map<string,ReconciliationLead>();let ambiguous=0,unmatched=0;
 for(const [phone,lead] of contacts){const candidates=index.get(phone)??[];if(candidates.length!==1){if(candidates.length>1)ambiguous++;else unmatched++;continue}const member=candidates[0]!;const previous=matched.get(member.key);if(!previous||instant(lead.firstAt)<instant(previous.firstAt))matched.set(member.key,lead)}
 const receiptIds=new Map<string,string>(),receiptTotals=new Map<string,ReconciliationReceipt[]>();
 for(const receipt of input.receipts){if(!Number.isSafeInteger(receipt.netCents)||receipt.currency!=='BRL')throw new Error('invalid_receipt');const signature=JSON.stringify(receipt),prior=receiptIds.get(receipt.id);if(prior){if(prior!==signature)throw new Error('conflicting_receipt');continue}receiptIds.set(receipt.id,signature);const at=instant(receipt.receivedAt);if(receipt.confirmed&&at<=asOf&&['cash','refund'].includes(receipt.kind)){const list=receiptTotals.get(receipt.memberKey)??[];list.push(receipt);receiptTotals.set(receipt.memberKey,list)}}
 let newStudents=0,existing=0,pendingHistory=0,outsidePeriod=0,revenueCents=0;const channels:Record<string,number>=Object.create(null);
 for(const member of input.members){const lead=matched.get(member.key);if(!lead)continue;if(!member.historyComplete){pendingHistory++;continue}
 const enrollments=member.enrollments.filter(e=>e.confirmed&&e.kind!=='trial'&&e.kind!=='aggregator').sort((a,b)=>instant(a.at)-instant(b.at)||a.id.localeCompare(b.id));
 const first=enrollments[0];if(!first||first.kind==='unknown'){pendingHistory++;continue}const at=instant(first.at);
 if(first.kind!=='new'||at<instant(lead.firstAt)){existing++;continue}if(at<start||at>=end){outsidePeriod++;continue}
 newStudents++;channels[lead.channel]=(channels[lead.channel]??0)+1;revenueCents+=(receiptTotals.get(member.key)??[]).filter(r=>instant(r.receivedAt)>=at).reduce((sum,r)=>sum+r.netCents,0);
 }
 const complete=Object.values(input.coverage).every(Boolean)&&pendingHistory===0&&ambiguous===0&&invalidPhones===0;
 const cacChannels=[...new Set(spend?.channels??[])],paidNewStudents=cacChannels.reduce((n,c)=>n+(channels[c]??0),0);
 const cacReady=complete&&spend?.complete&&spend.start===input.start&&spend.end===input.end&&paidNewStudents>0;
 const ltvReady=complete&&newStudents>0;
 // Explicit aggregates only. No lead/member identities or phone numbers leave here.
 return {cohort:{start:input.start,end:input.end,as_of:input.asOf},new_students:newStudents,channels,existing,unmatched,ambiguous,invalid_phones:invalidPhones,pending_history:pendingHistory,outside_period:outsidePeriod,coverage_complete:complete,cac_media_channels:cacChannels,paid_new_students:paidNewStudents,cac_media_cents:cacReady?Math.round(spend!.cents/paidNewStudents):null,cac_status:cacReady?'ready':newStudents===0&&complete?'no_new_students':'incomplete',realized_revenue_cents:input.coverage.payments?revenueCents:null,realized_revenue_per_student_cents:ltvReady?Math.round(revenueCents/newStudents):null,ltv_status:ltvReady?'realized_cohort_revenue':'incomplete'};
}
