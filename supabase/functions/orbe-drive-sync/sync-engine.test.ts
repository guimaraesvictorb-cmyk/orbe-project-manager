import { advanceSync, newSyncState, staleKnowledgeIds, syncProgress, type DriveFile, type SyncState } from './sync-engine.ts';
function assert(value: unknown, message = 'assertion failed'): asserts value { if (!value) throw new Error(message); }
const doc = (id: string, name = id): DriveFile => ({ id, name, mimeType: 'text/plain' });
const folder = (id: string, name = id): DriveFile => ({ id, name, mimeType: 'application/vnd.google-apps.folder' });
Deno.test('deep, paginated folders resume from a serialized checkpoint without reading another client export', async () => {
  let state = newSyncState('root'), reads = 0;
  const dependencies = {
    list: async (f: { id: string; pageToken?: string }) => {
      if (f.id === 'root' && !f.pageToken) return { files: [folder('f0'), folder('whole_drive','Takeout'),doc('first')],nextPageToken:'cursor' };
      if (f.id === 'root') { assert(f.pageToken === 'cursor'); return { files: [doc('second')] }; }
      const depth = Number(f.id.slice(1));
      return { files: depth < 14 ? [folder(`f${depth+1}`)] : [doc('deep')] };
    },
    accepts: () => true, read: async () => { reads++; return { content: 'Estratégia documentada e sem dado pessoal.' }; },
    save: async () => {}, purge: async () => {},
  };
  for (let i=0;state.phase!=='reconciling'&&i<30;i++) { await advanceSync(state,dependencies,'client','actor',{pages:2,files:1,milliseconds:1000}); state=JSON.parse(JSON.stringify(state)) as SyncState; }
  assert(state.phase === 'reconciling'); assert(reads === 3); assert(state.summary.synced === 3);
  assert(!state.visited.includes('whole_drive')); assert(state.visited.includes('f14'));
  assert(syncProgress(state).complete === false); assert(state.summary.restricted_folders === 1);
});
Deno.test('financial scope covers every chunk and secret/revoked files are purged without storing excerpts', async () => {
  const state=newSyncState('root'); state.phase='extracting';state.files=[doc('clean'),doc('secret'),doc('revoked')];
  const saved: Record<string,unknown>[] = [], purged: string[] = [];
  const dependencies={ list:async()=>({files:[]}),accepts:()=>true,read:async(file:DriveFile)=>file.id==='clean'?{content:'R$ 123 de investimento. '.repeat(1800)}:file.id==='secret'?{content:'sk-ant-SYNTHETIC_NOT_A_REAL_KEY_FOR_TEST_ONLY'}:{content:null,skipReason:'HTTP403',purge:true},save:async(rows:Record<string,unknown>[])=>{saved.push(...rows)},purge:async(id:string)=>{purged.push(id)} };
  await advanceSync(state,dependencies,'one-client','actor',{pages:0,files:3,milliseconds:1000});
  assert(saved.length>1); assert(saved.every(row=>row.client_id==='one-client'&&row.financial_restricted===true));
  assert(!JSON.stringify(saved).includes('SYNTHETIC')); assert(purged.join(',')==='secret,revoked');
  assert(state.summary.synced===1&&state.summary.skipped_count===2);
});
Deno.test('partial inventories cannot delete previous knowledge; completed reconciliation removes stale chunks only', () => {
  const state=newSyncState('newfolder');
  const entries=[{id:'removed',source_ref:'gone',source_folder_id:'newfolder'},{id:'oldfolder',source_ref:'still',source_folder_id:'oldfolder'},{id:'oldchunk',source_ref:'current:chunk:2',source_folder_id:'newfolder'},{id:'kept',source_ref:'current',source_folder_id:'newfolder'},{id:'transient',source_ref:'unreadable',source_folder_id:'newfolder'}];
  let blocked=false; try{staleKnowledgeIds(state,entries)}catch{blocked=true}assert(blocked);
  state.phase='reconciling';state.allRefs=['still','current','unreadable'];state.indexedFiles=['current'];state.indexedRefs=['current'];
  assert(staleKnowledgeIds(state,entries).sort().join(',')==='oldchunk,oldfolder,removed');
});
