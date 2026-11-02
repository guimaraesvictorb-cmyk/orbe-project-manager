import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isRestrictedName, looksLikeSecret, looksLikeBulkPersonalData } from "./content-filters.ts";
import { documentText, officeTypes, textTypes } from "./document-text.ts";

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

    const { client_id: clientId } = await req.json();
    if (typeof clientId !== "string") return json({ error: "Cliente inválido" }, 400);
    const [{ data: profile }, { data: client }, { data: driveConfig }] = await Promise.all([
      supabase.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle(),
      supabase.from("clients").select("id,name,deleted_at").eq("id", clientId).maybeSingle(),
      supabase.from("client_drive_config").select("folder_id").eq("client_id", clientId).maybeSingle(),
    ]);
    if (!profile?.is_active || !client || client.deleted_at || !driveConfig?.folder_id) return json({ error: "Cliente ou pasta não encontrados" }, 404);
    const elevated = ["admin", "coordenador"].includes(profile.role);
    if (!elevated) {
      const { data: assignment } = await supabase.from("client_assignments").select("id").eq("client_id", clientId).eq("user_id", user.id).eq("is_active", true).maybeSingle();
      if (!assignment) return json({ error: "Sem acesso a este cliente" }, 403);
    }

    // Prefer the correctly-named secret; fall back to a legacy one only if
    // its shape is a real Google service account AND it can actually mint a
    // drive.readonly token — this never reads/exposes either secret's value,
    // it only proves (or disproves) capability server-side.
    const resolved = await resolveServiceAccount(Deno.env.get("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON"), Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY"));
    if (!resolved) return json({ error: "Integração do Drive ainda não configurada no servidor (nenhuma credencial de serviço válida encontrada)." }, 503);
    const accessToken = resolved.token;
    const folderId = driveConfig.folder_id;
    // Drive files.list returns an empty list even for an inaccessible parent.
    // Confirm the folder itself before reporting an empty successful sync.
    const folderResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType&supportsAllDrives=true`, { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000) });
    if (folderResponse.status === 403 || folderResponse.status === 404) return json({ error: `O Studio ainda não tem acesso à pasta. Compartilhe esta pasta como leitor com ${resolved.email}.`, service_account_email: resolved.email, folder_id: folderId }, 403);
    if (!folderResponse.ok) return json({ error: 'Não foi possível confirmar o acesso à pasta no Google Drive.' }, 503);
    const folderMetadata = await folderResponse.json();
    if (folderMetadata.mimeType !== 'application/vnd.google-apps.folder') return json({ error: 'O vínculo precisa apontar para uma pasta do Google Drive.' }, 400);
    const files: DriveFile[] = [];
    const allFileRefs = new Set<string>();
    const skipped: Array<{ file: string; reason: string }> = [];
    let skippedCount = 0;
    const indexedFiles = new Set<string>();
    const skippedFormats: Record<string, number> = {};
    const restrictedFolders: string[] = [];
    const visitedFolders = new Set<string>();
    async function walkFolder(parentId: string, path: string, depth: number): Promise<void> {
      if (depth > 8) throw new Error("A estrutura do Drive ultrapassa 8 níveis de pastas.");
      if (visitedFolders.has(parentId)) return;
      visitedFolders.add(parentId);
      let pageToken: string | undefined;
      for (let page = 0; page < 50; page++) {
        const query = new URLSearchParams({
          q: `'${parentId.replace(/'/g, "\\'")}' in parents and trashed = false`,
          fields: "nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime,size)",
          pageSize: "100",
          orderBy: "name",
          supportsAllDrives: "true",
          includeItemsFromAllDrives: "true",
        });
        if (pageToken) query.set("pageToken", pageToken);
        const listed = await driveFetch(`https://www.googleapis.com/drive/v3/files?${query}`, accessToken);
        for (const file of (listed.files ?? []) as DriveFile[]) {
          const nextPath = path ? `${path}/${file.name}` : file.name;
          if (isRestrictedName(file.name)) {
            if (file.mimeType === "application/vnd.google-apps.folder") restrictedFolders.push(nextPath);
            continue; // never list, read or descend into restricted names
          }
          if (file.mimeType === "application/vnd.google-apps.folder") await walkFolder(file.id, nextPath, depth + 1);
          else {
            allFileRefs.add(file.id);
            if (!canReadFile(file)) {
              skippedCount++;
              skippedFormats[file.mimeType] = (skippedFormats[file.mimeType] ?? 0) + 1;
              if (!/^(image|video|audio)\//.test(file.mimeType) && skipped.length < 20) skipped.push({ file: nextPath, reason: `Formato sem extração de texto (${file.mimeType}).` });
              continue;
            }
            files.push({ ...file, relativePath: nextPath });
          }
          if (files.length > 500) throw new Error("A pasta tem mais de 500 arquivos. Divida o material em subpastas por assunto.");
        }
        pageToken = listed.nextPageToken;
        if (!pageToken) break;
      }
      if (pageToken) throw new Error("Uma pasta ultrapassa o limite de 5.000 itens para esta sincronização.");
    }
    await walkFolder(folderId, "", 0);

    const records: Record<string, unknown>[] = [];
    // File ids whose content just turned out to be a secret or bulk personal
    // data — any content indexed from an earlier, cleaner version of the
    // same file must be purged now, not kept around just because the file
    // id is still present in the folder (the generic "stale" check below
    // only catches files that disappeared or moved, not files that got
    // worse in place).
    const flaggedRefs = new Set<string>();
    for (let offset = 0; offset < files.length; offset += 2) {
      const chunk = await Promise.all(files.slice(offset, offset + 2).map(async (file) => ({ file, result: await readDriveFile(file, accessToken) })));
      for (const { file, result } of chunk) {
        if (!result.content) {
          skippedCount++;
          if (skipped.length < 20) skipped.push({ file: file.relativePath ?? file.name, reason: result.skipReason ?? "Motivo não informado." });
          continue;
        }
        const content = result.content;
        // Content-level check runs even for files whose name looked fine —
        // never store a snippet, never name the matched pattern.
        if (looksLikeSecret(content)) {
          skippedCount++;
          flaggedRefs.add(file.id);
          if (skipped.length < 20) skipped.push({ file: file.relativePath ?? file.name, reason: "Restrito: conteúdo contém padrão de credencial/segredo — não indexado." });
          continue;
        }
        if (looksLikeBulkPersonalData(content)) {
          skippedCount++;
          flaggedRefs.add(file.id);
          if (skipped.length < 20) skipped.push({ file: file.relativePath ?? file.name, reason: "Restrito: parece conter dado pessoal em massa (telefones/e-mails) — não indexado." });
          continue;
        }
        if (content.length > 500000) {
          skippedCount++;
          if (skipped.length < 20) skipped.push({ file: file.relativePath ?? file.name, reason: 'Documento acima de 500 mil caracteres; precisa ser dividido para indexação.' });
          continue;
        }
        const financial = /(R\s*[$]|\b(BRL|USD|EUR)\b|honor[áa]rio|retainer|financeir|contrat|mensalidade da ag[êe]ncia)/i.test(`${file.relativePath} ${content}`);
        const chunks = Array.from({ length: Math.ceil(content.length / 16000) }, (_, index) => content.slice(index * 16000, (index + 1) * 16000));
        indexedFiles.add(file.id);
        for (let index = 0; index < chunks.length; index++) records.push({
          client_id: clientId,
          title: `${file.relativePath ?? file.name}${chunks.length > 1 ? ` · parte ${index + 1}/${chunks.length}` : ''}`,
          content: `Documento original: ${file.relativePath ?? file.name}\nAtualizado no Drive: ${file.modifiedTime ?? 'data não informada'}\n\n${chunks[index]}`,
          source: 'drive', validated: true, financial_restricted: financial, created_by: user.id,
          source_ref: index ? `${file.id}:chunk:${index}` : file.id,
          source_url: file.webViewLink ?? `https://drive.google.com/open?id=${encodeURIComponent(file.id)}`,
          source_folder_id: folderId,
        });
        if (records.length > 1000) throw new Error('A pasta ultrapassa o limite de 1.000 trechos para uma sincronização. Selecione uma pasta de documentos menor.');
      }
    }
    for (const folderPath of restrictedFolders) {
      skippedCount++;
      if (skipped.length < 20) skipped.push({ file: `${folderPath}/*`, reason: "Restrito: pasta inteira excluída por nome (acesso/credencial/dado pessoal) — nenhum arquivo dentro foi lido." });
    }
    for (let offset = 0; offset < records.length; offset += 100) {
      const { error } = await supabase.from("client_knowledge").upsert(records.slice(offset, offset + 100), { onConflict: "client_id,source_ref" });
      if (error) throw new Error(`Falha ao salvar documentos sincronizados: ${error.message}`);
    }
    // Keep old indexed content if a file is temporarily unreadable or not
    // supported yet — but never for a file that just got flagged as a
    // secret or bulk personal data; that content comes out regardless of
    // what was indexed before.
    const existingDriveEntries: Array<{ id: string; source_ref: string; source_folder_id: string }> = [];
    for (let page = 0; page < 20; page++) {
      const { data, error } = await supabase.from('client_knowledge').select('id,source_ref,source_folder_id').eq('client_id', clientId).eq('source', 'drive').order('id').range(page * 1000, page * 1000 + 999);
      if (error) throw new Error('Falha ao reconciliar os documentos anteriores da base.');
      existingDriveEntries.push(...data ?? []);
      if (!data || data.length < 1000) break;
      if (page === 19) throw new Error('A base ultrapassa o limite de reconciliação desta sincronização.');
    }
    const indexedRefs = new Set(records.map(record => String(record.source_ref)));
    const staleIds = existingDriveEntries.filter(entry => {
      const base = entry.source_ref?.split(':chunk:')[0];
      return entry.source_folder_id !== folderId || !allFileRefs.has(base) || flaggedRefs.has(base) || (indexedFiles.has(base) && !indexedRefs.has(entry.source_ref));
    }).map(entry => entry.id);
    for (let offset = 0; offset < staleIds.length; offset += 100) {
      const { error } = await supabase.from("client_knowledge").delete().in("id", staleIds.slice(offset, offset + 100));
      if (error) throw new Error(`Falha ao remover documentos antigos da base: ${error.message}`);
    }
    const summary = { synced: indexedFiles.size, chunks: records.length, skipped, skipped_count: skippedCount, skipped_formats: skippedFormats, restricted_folders: restrictedFolders.length };
    await supabase.from('client_drive_config').update({ last_synced_at: new Date().toISOString(), sync_summary: summary }).eq('client_id', clientId);
    return json({ ...summary, used_legacy_credential: resolved.usedLegacy }, 200);
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});

type DriveFile = { id: string; name: string; mimeType: string; webViewLink?: string; modifiedTime?: string; size?: string; relativePath?: string };
function canReadFile(file: DriveFile) {
  return ['application/vnd.google-apps.document','application/vnd.google-apps.spreadsheet','application/vnd.google-apps.presentation','application/pdf',...textTypes,...officeTypes].includes(file.mimeType) || /\.(md|txt|csv|html?)$/i.test(file.name);
}

async function readDriveFile(file: DriveFile, token: string): Promise<{ content: string; skipReason?: never } | { content: null; skipReason: string }> {
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
    if (!response.ok) return { content: null, skipReason: `O Drive retornou HTTP ${response.status} ao ler o arquivo.` };
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
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  const result = await response.json();
  if (!response.ok) throw new Error(`Google Drive ${response.status}: ${JSON.stringify(result)}`);
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
