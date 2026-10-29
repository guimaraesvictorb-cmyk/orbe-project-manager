/** GA4 receives pseudonymous website session evidence only, never CRM identity/text. */
export type AnalyticsContext={measurement_id:string;client_id:string;session_id:string;observed_at:string};
export function analyticsContext(params:URLSearchParams,referer:string|undefined,allowed:{measurement_id:string;site_hostname:string}[],now=Date.now()):AnalyticsContext|null {
 const measurement_id=params.get('ga_measurement_id')||'',client_id=params.get('ga_client_id')||'',session_id=params.get('ga_session_id')||'';
 if(params.get('ga_consent')!=='granted'||!/^G-[A-Z0-9]{6,15}$/.test(measurement_id)||!/^\d{1,20}\.\d{1,20}$/.test(client_id)||!/^\d{10}$/.test(session_id))return null;
 let origin:URL;try{origin=new URL(referer||'')}catch{return null}
 if(origin.protocol!=='https:'||!allowed.some(c=>c.measurement_id===measurement_id&&c.site_hostname===origin.hostname))return null;
 const age=now-Number(session_id)*1000;
 if(age<0||age>24*3600000)return null;
 return {measurement_id,client_id,session_id,observed_at:new Date(now).toISOString()};
}
export type AnalyticsJob={id:string;connection_id:string;measurement_id:string;client_id:string;session_id:string;received_at:string;clicked_at:string};
export function analyticsPayload(job:AnalyticsJob,now=Date.now()) {
 if(!/^\d{1,20}\.\d{1,20}$/.test(job.client_id)||!/^\d{10}$/.test(job.session_id)||!/^G-[A-Z0-9]{6,15}$/.test(job.measurement_id))throw new Error('invalid_session');
 const at=Date.parse(job.received_at),click=Date.parse(job.clicked_at),start=Number(job.session_id)*1000;
 if(!Number.isFinite(at)||!Number.isFinite(click)||at<click||click<start||at>now||now-start>24*3600000)throw new Error('expired_session');
 return {client_id:job.client_id,timestamp_micros:at*1000,consent:{ad_user_data:'DENIED',ad_personalization:'DENIED'},events:[{name:'whatsapp_message_received',params:{session_id:Number(job.session_id),engagement_time_msec:1,event_id:job.id,channel:'whatsapp',evidence:'received_message'}}]};
}
