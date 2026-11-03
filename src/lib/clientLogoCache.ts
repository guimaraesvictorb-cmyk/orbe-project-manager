export type LogoEntry={url:string;expires_at:number};
type Loader=(user:string,ids:string[])=>Promise<Record<string,LogoEntry|null>>;
type Job={user:string;id:string;started:boolean;promise:Promise<void>;done:()=>void};
// Memory is scoped by signed-in user. Signed image URLs never become public
// assets or durable application credentials, and all entries clear on logout.
export function createClientLogoCache(load:Loader,now=Date.now){
 const entries=new Map<string,LogoEntry>(),pending=new Map<string,Job>(),listeners=new Set<()=>void>();
 const key=(user:string,id:string)=>`${user}:${id}`;
 const notify=()=>listeners.forEach(listener=>listener());
 function put(user:string,id:string,value:LogoEntry|null){
  entries.set(key(user,id),value?{url:value.url,expires_at:Math.min(value.expires_at,now()+50*60*1000)}:{url:'',expires_at:now()+5*60*1000});
  const job=pending.get(key(user,id));if(job){pending.delete(key(user,id));job.done();}
  notify();
 }
 function flush(){
  const groups=new Map<string,Job[]>();
  for(const job of pending.values())if(!job.started){job.started=true;const list=groups.get(job.user)??[];list.push(job);groups.set(job.user,list);}
  for(const [user,jobs] of groups)for(let offset=0;offset<jobs.length;offset+=30){
   const batch=jobs.slice(offset,offset+30);
   void load(user,batch.map(job=>job.id)).then(values=>{
    for(const job of batch)if(pending.get(key(user,job.id))===job)put(user,job.id,values[job.id]??null);
   }).catch(()=>{
    for(const job of batch)if(pending.get(key(user,job.id))===job){pending.delete(key(user,job.id));job.done();}
   });
  }
 }
 return {
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
  get(user:string,id:string){const entry=entries.get(key(user,id));return entry&&entry.expires_at>now()?entry.url:'';},
  load(user:string,id:string){
   if(!user||!id)return Promise.resolve();
   const idKey=key(user,id),existing=entries.get(idKey);if(existing&&existing.expires_at>now())return Promise.resolve();
   const prior=pending.get(idKey);if(prior)return prior.promise;
   let done=()=>{};const promise=new Promise<void>(resolve=>{done=resolve;});
   pending.set(idKey,{user,id,started:false,promise,done});queueMicrotask(flush);return promise;
  },
  put,
  clear(){entries.clear();for(const job of pending.values())job.done();pending.clear();notify();},
 };
}
