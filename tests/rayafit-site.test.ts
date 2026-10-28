import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../integrations/rayafit/whatsapp-attribution.html',import.meta.url),'utf8').replace(/<\/?script>/g,'');
function run(query:string,hostname='planos.rayafit.com.br',saved:string|null=null) {
 const links=['https://wa.me/5527988417089?text=Olá%21%20Quero%20informações.','https://wa.me/5511999999999?text=Outro','https://evil.test/?phone=5527988417089'].map(href=>({tagName:'A',href,setAttribute(k:string,v:string){if(k==='href')this.href=v}}));
 let observed=false,mutation: (rows:unknown[])=>void=()=>{};
 const doc={nodeType:1,querySelectorAll:()=>links};
 const sessionStorage={getItem:()=>saved,setItem(_k:string,v:string){saved=v}};
 const context={URL,URLSearchParams,Date,JSON,window:{},location:{hostname,search:query,href:'https://'+hostname+'/'},sessionStorage,document:{documentElement:doc},MutationObserver:class{constructor(cb:(rows:unknown[])=>void){mutation=cb}observe(){observed=true}}};
 vm.runInNewContext(source,context);
 return {links,saved,observed,repeat(){vm.runInNewContext(source,context)},mutate(){mutation([{type:'attributes',target:links[0]}])}};
}
test('site bridge preserves the full campaign and click IDs, natural greeting and exact WhatsApp destination',()=>{
 const r=run('?utm_source=google&utm_medium=cpc&utm_campaign=21948614114&utm_content=123&utm_term=academia&gclid=GOOGLE_123&fbclid=META_123');
 const u=new URL(r.links[0].href);assert.equal(u.origin,'https://studio.agenciaorbe.co');assert.equal(u.searchParams.get('text'),'Olá! Quero informações.');assert.equal(u.searchParams.get('gclid'),'GOOGLE_123');assert.equal(u.searchParams.get('utm_term'),'academia');assert.equal(u.searchParams.get('connection'),'1fd22072-6932-4122-941f-cb31c55efd66');
 assert.match(r.links[1].href,/^https:\/\/wa.me\/5511999999999/);assert.match(r.links[2].href,/^https:\/\/evil.test/);
 const before=r.links[0].href;r.repeat();r.mutate();assert.equal(r.links[0].href,before);assert.equal(r.observed,true);
});
test('site bridge keeps recent session attribution but never fabricates paid attribution for untagged visits',()=>{
 const tagged=run('?utm_source=ig&utm_campaign=rayafit');assert.equal(new URL(run('',undefined,tagged.saved).links[0].href).searchParams.get('utm_source'),'ig');
 const expired=JSON.stringify({at:Date.now()-1800001,values:{utm_source:'google'}});
 const u=new URL(run('',undefined,expired).links[0].href);assert.equal(u.searchParams.get('utm_source'),'site_rayafit');assert.equal(u.searchParams.get('utm_medium'),'nao_informado');
});
test('site bridge ignores other sites, unresolved macros, duplicate params and malformed click IDs',()=>{
 assert.match(run('?utm_source=google','other.example').links[0].href,/^https:\/\/wa.me/);
 const u=new URL(run('?utm_source=ig&utm_source=fb&utm_campaign={{campaign.name}}&gclid=bad%3Fid').links[0].href);
 assert.equal(u.searchParams.get('gclid'),null);assert.equal(u.searchParams.get('utm_campaign'),null);assert.equal(u.searchParams.get('utm_source'),'site_rayafit');
});
