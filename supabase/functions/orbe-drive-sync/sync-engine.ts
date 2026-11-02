import { isRestrictedName, looksLikeSecret, looksLikeBulkPersonalData } from './content-filters.ts';

export type DriveFile = { id: string; name: string; mimeType: string; webViewLink?: string; modifiedTime?: string; size?: string; relativePath?: string; capabilities?: { canListChildren?: boolean } };
type Folder = { id: string; path: string; pageToken?: string };
export type Summary = { synced: number; chunks: number; skipped_count: number; skipped: Array<{ file: string; reason: string }>; skipped_formats: Record<string, number>; restricted_folders: number };
export type SyncState = { folderId: string; phase: 'listing' | 'extracting' | 'reconciling' | 'complete'; folders: Folder[]; visited: string[]; files: DriveFile[]; allRefs: string[]; indexedRefs: string[]; indexedFiles: string[]; processed: number; scanned: number; summary: Summary };
export type ReadResult = { content: string | null; skipReason?: string; purge?: boolean };
type Dependencies = {
  list: (folder: Folder) => Promise<{ files: DriveFile[]; nextPageToken?: string }>;
  accepts: (file: DriveFile) => boolean;
  read: (file: DriveFile) => Promise<ReadResult>;
  save: (records: Record<string, unknown>[]) => Promise<void>;
  purge: (fileId: string) => Promise<void>;
};
export function newSyncState(folderId: string): SyncState {
  return { folderId, phase: 'listing', folders: [{ id: folderId, path: '' }], visited: [folderId], files: [], allRefs: [], indexedRefs: [], indexedFiles: [], processed: 0, scanned: 0, summary: { synced: 0, chunks: 0, skipped_count: 0, skipped: [], skipped_formats: {}, restricted_folders: 0 } };
}
function skip(state: SyncState, file: string, reason: string) {
  state.summary.skipped_count++;
  if (state.summary.skipped.length < 30) state.summary.skipped.push({ file, reason });
}
// One request advances a small, persisted portion. Folder traversal is iterative,
// so a deep archive cannot exhaust the stack or discard previous progress.
export async function advanceSync(state: SyncState, deps: Dependencies, clientId: string, actorId: string, budget = { pages: 8, files: 1, milliseconds: 18000 }) {
  const deadline = Date.now() + budget.milliseconds;
  const visited = new Set(state.visited), refs = new Set(state.allRefs);
  for (let page = 0; state.phase === 'listing' && page < budget.pages && Date.now() < deadline; page++) {
    const folder = state.folders[0];
    if (!folder) { state.phase = 'extracting'; break; }
    const result = await deps.list(folder);
    for (const file of result.files) {
      if (!/^[\w-]+$/.test(file.id) || typeof file.name !== 'string' || typeof file.mimeType !== 'string') throw new Error('O Drive retornou metadados incompatíveis.');
      state.scanned++;
      const path = folder.path ? `${folder.path}/${file.name}` : file.name;
      if (isRestrictedName(file.name)) {
        if (file.mimeType === 'application/vnd.google-apps.folder') state.summary.restricted_folders++;
        skip(state, path, 'Restrito: nome indica credenciais, acessos ou dados pessoais em massa.');
        continue;
      }
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        if (file.capabilities?.canListChildren === false) { skip(state, path, 'A conta do Studio não pode listar esta subpasta.'); continue; }
        if (!visited.has(file.id)) { visited.add(file.id); state.visited.push(file.id); state.folders.push({ id: file.id, path }); }
      } else if (!refs.has(file.id)) {
        refs.add(file.id); state.allRefs.push(file.id);
        if (deps.accepts(file)) state.files.push({ ...file, relativePath: path });
        else { state.summary.skipped_count++; state.summary.skipped_formats[file.mimeType] = (state.summary.skipped_formats[file.mimeType] ?? 0) + 1; }
      }
    }
    if (result.nextPageToken) folder.pageToken = result.nextPageToken;
    else state.folders.shift();
    if (!state.folders.length) state.phase = 'extracting';
    if (state.files.length > 10000 || state.visited.length > 20000 || state.allRefs.length > 200000) throw new Error('O inventário ultrapassou o limite desta base. Selecione uma pasta de documentos menor; o progresso anterior foi preservado.');
  }
  for (let count = 0; state.phase === 'extracting' && count < budget.files && Date.now() < deadline; count++) {
    const file = state.files[state.processed];
    if (!file) { state.phase = 'reconciling'; break; }
    const result = await deps.read(file), content = result.content?.trim() ?? '';
    const flagged = !!content && (looksLikeSecret(content) || looksLikeBulkPersonalData(content));
    if (flagged || result.purge) await deps.purge(file.id);
    if (flagged) skip(state, file.relativePath ?? file.name, 'Restrito: conteúdo contém padrão de credencial ou dados pessoais em massa.');
    else if (!content) skip(state, file.relativePath ?? file.name, result.skipReason ?? 'Arquivo sem texto extraível.');
    else if (content.length > 500000) skip(state, file.relativePath ?? file.name, 'Documento acima de 500 mil caracteres; divida o material para indexação.');
    else {
      const financial = /(R\s*[$]|\b(BRL|USD|EUR)\b|honor[áa]rio|retainer|financeir|contrat|mensalidade da ag[êe]ncia)/i.test(`${file.relativePath} ${content}`);
      const chunks = Array.from({ length: Math.ceil(content.length / 16000) }, (_, index) => content.slice(index * 16000, (index + 1) * 16000));
      const records = chunks.map((chunk, index) => ({ client_id: clientId, title: `${file.relativePath ?? file.name}${chunks.length > 1 ? ` · parte ${index + 1}/${chunks.length}` : ''}`, content: `Documento original: ${file.relativePath ?? file.name}\nAtualizado no Drive: ${file.modifiedTime ?? 'data não informada'}\n\n${chunk}`, source: 'drive', validated: true, financial_restricted: financial, created_by: actorId, source_ref: index ? `${file.id}:chunk:${index}` : file.id, source_url: file.webViewLink ?? `https://drive.google.com/open?id=${encodeURIComponent(file.id)}`, source_folder_id: state.folderId, updated_at: new Date().toISOString() }));
      await deps.save(records);
      state.indexedRefs.push(...records.map(record => record.source_ref));
      state.indexedFiles.push(file.id);
      state.summary.synced++; state.summary.chunks += records.length;
    }
    state.processed++;
    if (state.processed === state.files.length) state.phase = 'reconciling';
  }
  return state;
}
export function staleKnowledgeIds(state: SyncState, entries: Array<{ id: string; source_ref: string; source_folder_id: string }>) {
  if (state.phase !== 'reconciling' && state.phase !== 'complete') throw new Error('Não reconciliar um inventário parcial.');
  const refs = new Set(state.allRefs), indexed = new Set(state.indexedFiles), chunks = new Set(state.indexedRefs);
  return entries.filter(entry => { const base = entry.source_ref?.split(':chunk:')[0]; return entry.source_folder_id !== state.folderId || !refs.has(base) || indexed.has(base) && !chunks.has(entry.source_ref); }).map(entry => entry.id);
}
export function syncProgress(state: SyncState) {
  return { ...state.summary, complete: state.phase === 'complete', phase: state.phase, folders: state.visited.length, scanned: state.scanned, processed: state.processed, total: state.files.length };
}
