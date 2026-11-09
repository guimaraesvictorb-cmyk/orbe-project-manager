import test from 'node:test'
import assert from 'node:assert/strict'
import {analyticsProperty,analyticsPeriod,analyticsScope,ga4Failure,ga4Report,ga4Request} from '../api/_lib/ga4Provider.ts'
test('GA4 accepts exact numeric property IDs and real bounded dates',()=>{
 assert.equal(analyticsProperty('properties/123456'),'123456')
 for(const property of ['1234/../../accounts','G-ABC','private@example.com'])assert.throws(()=>analyticsProperty(property))
 assert.deepEqual(analyticsPeriod('2026-11-01','2026-11-09'),{start:'2026-11-01',end:'2026-11-09'})
 for(const period of [['2026-02-30','2026-03-01'],['2026-11-09','2026-11-01'],['2024-01-01','2026-01-01']])assert.throws(()=>analyticsPeriod(...period))
 assert.equal(analyticsScope,'https://www.googleapis.com/auth/analytics.readonly')
})
test('GA4 reports total users from the total query, not the sum of overlapping channel users',async()=>{
 const before=globalThis.fetch;const requests:string[]=[]
 globalThis.fetch=async(url,options)=>{
  const target=new URL(String(url));requests.push(target.href)
  assert.equal(options?.redirect,'error');assert.match(String(options?.headers&&JSON.stringify(options.headers)),/Bearer SYNTHETIC_ACCESS/)
  if(target.hostname==='analyticsadmin.googleapis.com')return new Response(JSON.stringify({displayName:'Synthetic property',timeZone:'America/Sao_Paulo'}))
  const body=JSON.parse(String(options?.body));assert.deepEqual(body.metrics.map((m:{name:string})=>m.name),['sessions','totalUsers','screenPageViews','keyEvents'])
  const metrics=(values:number[])=>values.map(value=>({value:String(value)}))
  return new Response(JSON.stringify(body.dimensions?{rowCount:2,rows:[{dimensionValues:[{value:'Organic Search'},{value:'google'}],metricValues:metrics([12,10,30,2])},{dimensionValues:[{value:'Paid Social'},{value:'facebook'}],metricValues:metrics([8,10,20,1])}]}:{rows:[{metricValues:metrics([20,15,50,3])}]}))
 }
 try{const report=await ga4Report('SYNTHETIC_ACCESS','123456',{start:'2026-11-01',end:'2026-11-09'});assert.equal(report.totals.totalUsers,15);assert.equal(report.google_organic_sessions,12);assert.equal(report.totals.sessions,20);assert.equal(requests.length,3);assert.equal(JSON.stringify(report).includes('SYNTHETIC_ACCESS'),false);await assert.rejects(()=>ga4Request('SYNTHETIC_ACCESS','https://attacker.invalid/'))}finally{globalThis.fetch=before}
})
test('GA4 provider errors distinguish missing authorization, permissions and disabled APIs without leaking provider bodies',()=>{
 assert.equal(ga4Failure(403,{error:{details:[{reason:'SERVICE_DISABLED'}]}}).message,'ga4_api_disabled')
 assert.equal(ga4Failure(403,{error:{details:[{reason:'ACCESS_TOKEN_SCOPE_INSUFFICIENT'}]}}).message,'ga4_scope_required')
 assert.equal(ga4Failure(403,{error:{message:'private provider detail'}}).message,'ga4_permission_denied')
 assert.equal(ga4Failure(401,{}).message,'ga4_reauthorize')
})
