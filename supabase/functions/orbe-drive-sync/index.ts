import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { advanceSync, newSyncState, staleKnowledgeIds, syncProgress, type DriveFile, type SyncState } from "./sync-engine.ts";
import { documentText, officeTypes, textTypes } from "./document-text.ts";

import { browseCreativeFolder, DriveBrowseError } from "./creative-browser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Não autorizado" }, 401);
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) return json({ error: "Sessão inválida" }, 401);

    if (req.method !== "POST") return json({ error: "Método inválido" }, 405);
    const { client_id: clientId, batch, action, path, page_token: pageToken } = await req.json();
    if (typeof clientId !== "string" || !/^[0-9a-f-]{36}$/.test(clientId)) return json({ error: "Cliente inválido" }, 400);
    const [{ data: profile }, { data: client }, { data: driveConfig }] = await Promise.all([
      supabase.from("profiles").select("role,is_active,can_view_financials").eq("id", user.id).maybeSingle(),
      supabase.from("clients").select("id,name,deleted_at").eq("id", clientId).maybeSingle(),
      supabase.from("client_drive_config").select("folder_id").eq("client_id", clientId).maybeSingle(),
    ]);
    if (!profile?.is_active || !client || client.deleted_at || !driveConfig?.folder_id) return json({ error: "Cliente ou pasta não encontrados" }, 404);
    const elevated = ["admin", "coordenador"].includes(profile.role);
    if (!elevated) {
      const { data: assignment } = await supabase.from("client_assignments").select("id").eq("client_id", clientId).eq("user_id", user.id).eq("is_active", true).maybeSingle();
      if (!assignment) return json({ error: "Sem acesso a este cliente" }, 403);
    }

    if (action === 'browse_creatives') {
      const resolved = await resolveServiceAccount(Deno.env.get('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON'),Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY'));
      if (!resolved) return json({ error: 'Integração do Drive sem credencial de serviço válida no servidor.' },503);
      try { return json(await browseCreativeFolder(driveConfig.folder_id,path,pageToken,url=>driveFetch(url,resolved.token),!!profile.can_view_financials)); }
      catch(error) { return json({ error: error instanceof DriveBrowseError ? error.message : 'Não foi possível abrir esta pasta no Drive. Confira o compartilhamento com o Studio.' },error instanceof DriveBrowseError ? error.status : 503); }
    }

    type Job = { client_id: string; job_id: string; folder_id: string; revision: number; lease_until: string; state: SyncState };
    const { data: existingJob, error: jobReadError } = await supabase.from('client_drive_sync_jobs').select('*').eq('client_id',clientId).maybeSingle();
    if (jobReadError) return json({ error: 'O controle da sincronização ainda não está disponível.' },503);
    if (action === 'status') return json(existingJob?.folder_id === driveConfig.folder_id ? syncProgress(existingJob.state) : { complete: false, phase: 'not_started', synced: 0 });
    if (batch !== true) return json({ error: 'Atualize a página do Studio para usar a sincronização com retomada.' },409);
    const folderId = driveConfig.folder_id;
    const resolved = await resolveServiceAccount(Deno.env.get('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON'),Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY'));
    if (!resolved) return json({ error: 'Integração do Drive sem credencial de serviço válida no servidor.' },503);
    const accessToken = resolved.token;
    const folderResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType&supportsAllDrives=true`, { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000) });
    if ([403,404].includes(folderResponse.status)) return json({ error: `O Studio ainda não tem acesso à pasta. Compartilhe como leitor com ${resolved.email}.` },403);
    if (!folderResponse.ok) return json({ error: 'Não foi possível confirmar o acesso à pasta no Drive.' },503);
    if ((await folderResponse.json()).mimeType !== 'application/vnd.google-apps.folder') return json({ error: 'O vínculo precisa apontar para uma pasta do Drive.' },400);
    let job = existingJob as Job | null;
    if (!job) {
      const { error } = await supabase.from('client_drive_sync_jobs').upsert({ client_id: clientId,folder_id: folderId,state: newSyncState(folderId) },{onConflict:'client_id',ignoreDuplicates:true});
      if (error) throw new Error('Não foi possível iniciar o progresso da sincronização.');
      const loaded = await supabase.from('client_drive_sync_jobs').select('*').eq('client_id',clientId).single();
      if (loaded.error) throw new Error('Não foi possível consultar o progresso da sincronização.');
      job = loaded.data as Job;
    }
    if (Date.parse(job.lease_until) > Date.now()) return json({ ...syncProgress(job.state), complete: false, busy: true },202);
    const state = job.folder_id !== folderId || job.state.phase === 'complete' ? newSyncState(folderId) : job.state;
    const revision = job.revision + 1;
    const claimed = await supabase.from('client_drive_sync_jobs').update({ revision,folder_id: folderId,state,lease_until:new Date(Date.now()+90000).toISOString(),updated_at:new Date().toISOString() }).eq('client_id',clientId).eq('revision',job.revision).lte('lease_until',new Date().toISOString()).select('client_id').maybeSingle();
    if (claimed.error) throw new Error('Não foi possível reservar o lote de leitura.');
    if (!claimed.data) return json({ ...syncProgress(state),complete:false,busy:true },202);
    try {
      await advanceSync(state,{
        accepts: canReadFile,
        list: async folder => {
          const query = new URLSearchParams({ q: `'${folder.id.replace(/'/g,"\\'")}' in parents and trashed = false`,fields:'nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime,size,capabilities(canListChildren))',pageSize:'100',orderBy:'name',supportsAllDrives:'true',includeItemsFromAllDrives:'true' });
          if (folder.pageToken) query.set('pageToken',folder.pageToken);
          return await driveFetch(`https://www.googleapis.com/drive/v3/files?${query}`,accessToken);
        },
        read: file => readDriveFile(file,accessToken),
        save: async records => { const { error } = await supabase.from('client_knowledge').upsert(records,{onConflict:'client_id,source_ref'}); if(error) throw new Error('Falha ao salvar um documento na base.'); },
        purge: async fileId => { const { error } = await supabase.from('client_knowledge').delete().eq('client_id',clientId).eq('source','drive').or(`source_ref.eq.${fileId},source_ref.like.${fileId}:chunk:*`); if(error) throw new Error('Falha ao remover um documento restrito da base.'); },
      },clientId,user.id);
      if (state.phase === 'reconciling') {
        const entries: Array<{id:string;source_ref:string;source_folder_id:string}> = [];
        for(let page=0;page<200;page++) {
          const { data,error } = await supabase.from('client_knowledge').select('id,source_ref,source_folder_id').eq('client_id',clientId).eq('source','drive').order('id').range(page*1000,page*1000+999);
          if(error) throw new Error('Falha ao conferir os documentos anteriores.');
          entries.push(...data??[]); if(!data||data.length<1000) break;
          if(page===199) throw new Error('A base ultrapassa o limite de reconciliação.');
        }
        const stale=staleKnowledgeIds(state,entries);
        for(let offset=0;offset<stale.length;offset+=100) { const {error}=await supabase.from('client_knowledge').delete().in('id',stale.slice(offset,offset+100));if(error)throw new Error('Falha ao reconciliar documentos removidos do Drive.'); }
        state.phase='complete';
      }
      const progress=syncProgress(state);
      const {error:checkpointError}=await supabase.from('client_drive_sync_jobs').update({state,lease_until:'1970-01-01T00:00:00Z',updated_at:new Date().toISOString()}).eq('client_id',clientId).eq('revision',revision);
      if(checkpointError)throw new Error('Não foi possível guardar o progresso para retomada.');
      const {error:summaryError}=await supabase.from('client_drive_config').update({sync_summary:progress,...(progress.complete?{last_synced_at:new Date().toISOString()}:{})}).eq('client_id',clientId).eq('folder_id',folderId);
      if(summaryError)throw new Error('Não foi possível atualizar o inventário da base.');
      return json(progress,progress.complete?200:202);
    } catch(error) {
      await supabase.from('client_drive_sync_jobs').update({state,lease_until:'1970-01-01T00:00:00Z',updated_at:new Date().toISOString()}).eq('client_id',clientId).eq('revision',revision);
      throw error;
    }
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});

function canReadFile(file: DriveFile) {
  return ['application/vnd.google-apps.document','application/vnd.google-apps.spreadsheet','application/vnd.google-apps.presentation','application/pdf',...textTypes,...officeTypes].includes(file.mimeType) || /\.(md|txt|csv|html?)$/i.test(file.name);
}

async function readDriveFile(file: DriveFile, token: string): Promise<{ content: string; skipReason?: never } | { content: null; skipReason: string; purge?: boolean }> {
  const exports: Record<string, string> = {
    'application/vnd.google-apps.document': 'text/plain',
    'application/vnd.google-apps.spreadsheet': officeTypes[1],
    'application/vnd.google-apps.presentation': 'text/plain',
  };
  const exportMime = exports[file.mimeType];
  const extension = file.name.split('.').pop()?.toLowerCase();
  const fallback: Record<string,string> = { md: 'text/markdown', txt: 'text/plain', csv: 'text/csv', html: 'text/html', htm: 'text/html' };
  const mime = exportMime || (textTypes.includes(file.mimeType) || officeTypes.includes(file.mimeType) || file.mimeType === 'application/pdf' ? file.mimeType : fallback[extension ?? '']);
  if (!mime) return { content: null, skipReason: `Formato sem extração de texto (${file.mimeType}).` };
  if (Number(file.size) > 12 * 1024 * 1024) return { content: null, skipReason: 'Arquivo acima do limite de 12 MB para extração.' };
  const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}`;
  const url = exportMime ? `${base}/export?mimeType=${encodeURIComponent(exportMime)}` : `${base}?alt=media`;
  try {
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) return { content: null, skipReason: `O Drive retornou HTTP ${response.status} ao ler o arquivo.`, purge: [403,404].includes(response.status) };
    if (!response.body) return { content: null, skipReason: 'Arquivo sem conteúdo retornado pelo Drive.' };
    const reader = response.body.getReader(), parts: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 12 * 1024 * 1024) { await reader.cancel(); return { content: null, skipReason: 'Arquivo acima do limite de 12 MB para extração.' }; }
      parts.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.length; }
    const content = (await documentText(mime, bytes)).replace(/\u0000/g, '').trim();
    return content ? { content } : { content: null, skipReason: 'O arquivo não contém texto extraível; imagens precisam de OCR.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const safe = ['PDF sem camada de texto; precisa de OCR.','PDF acima do limite de 250 páginas para extração.','Conteúdo Office acima do limite de extração.','Arquivo acima do limite de 12 MB para extração.'];
    return { content: null, skipReason: safe.includes(message) ? message : 'Falha ao extrair o texto; arquivo protegido, incompatível ou temporariamente indisponível.' };
  }
}

async function driveFetch(url: string, token: string) {
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` },signal:AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok) throw new Error(`O Drive não confirmou a listagem de uma pasta (HTTP ${response.status}). O progresso foi preservado.`);
  return result;
}

type ServiceAccount = { client_email: string; private_key: string };

// Tries the correctly-named secret first; only tries the legacy name if the
// first is absent/invalid, and only ever as proof-of-capability (mint a
// drive.readonly token) — never by reading or logging either value.
async function resolveServiceAccount(primaryRaw: string | undefined, legacyRaw: string | undefined): Promise<{ token: string; email: string; usedLegacy: boolean } | null> {
  const primary = await tryServiceAccount(primaryRaw);
  if (primary) return { ...primary, usedLegacy: false };
  const legacy = await tryServiceAccount(legacyRaw);
  if (legacy) return { ...legacy, usedLegacy: true };
  return null;
}

async function tryServiceAccount(raw: string | undefined): Promise<{ token: string; email: string } | null> {
  if (!raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  const sa = parsed as Partial<ServiceAccount>;
  if (typeof sa.client_email !== "string" || !/@[\w.-]+\.iam\.gserviceaccount\.com$/.test(sa.client_email)) return null;
  if (typeof sa.private_key !== "string" || !sa.private_key.includes("PRIVATE KEY")) return null;
  try {
    return { token: await getDriveToken(sa as ServiceAccount), email: sa.client_email };
  } catch {
    return null;
  }
}

async function getDriveToken(account: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const pem = account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const der = Uint8Array.from(atob(pem), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Google OAuth ${response.status}: ${JSON.stringify(result)}`);
  return result.access_token as string;
}

function base64url(value: string | ArrayBuffer) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "content-type": "application/json" } });
}
