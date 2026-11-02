import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Names (file or folder) that mean "do not index, this is access data, raw
// personal data, or a credential dump" — checked before any content is read.
// Matching a folder name stops the walk from descending into it at all, so
// nothing inside an excluded folder is even listed.
const RESTRICTED_NAME_PATTERNS: RegExp[] = [
  /acesso/i,                 // "Planilha de Acessos"
  /senha/i, /password/i,
  /credencial/i, /credential/i,
  /\btoken\b/i, /\bsecret\b/i, /\bchave\b/i, /\blogin\b/i,
  /base de clientes/i,       // bulk customer records
  /\blead(s)?\b/i,           // raw lead sheets
  /p[úu]blico/i, /audi[êe]ncia/i, /audience/i, // raw audience/CSV exports
  /whatsapp/i,               // chat exports (personal conversations)
];

function isRestrictedName(name: string): boolean {
  return RESTRICTED_NAME_PATTERNS.some((p) => p.test(name));
}

// Content-level check for files that pass the name filter but may still
// carry an embedded secret (e.g. a key pasted into a notes doc) or bulk
// personal data (phone/e-mail lists). Only a boolean/generic reason is ever
// produced — the matched text itself is never stored, logged or returned.
const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /(senha|password|token|api[_ -]?key|secret|chave)\s*[:=]\s*\S{6,}/i,
];

function looksLikeSecret(content: string): boolean {
  return SECRET_PATTERNS.some((p) => p.test(content));
}

function looksLikeBulkPersonalData(content: string): boolean {
  const phoneMatches = content.match(/\b(\+?\d{2}[\s.-]?)?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}\b/g) ?? [];
  const emailMatches = content.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? [];
  return phoneMatches.length > 15 || emailMatches.length > 15;
}

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
    const files: DriveFile[] = [];
    const restrictedFolders: string[] = [];
    const visitedFolders = new Set<string>();
    async function walkFolder(parentId: string, path: string, depth: number): Promise<void> {
      if (depth > 8) throw new Error("A estrutura do Drive ultrapassa 8 níveis de pastas.");
      if (visitedFolders.has(parentId)) return;
      visitedFolders.add(parentId);
      let pageToken: string | undefined;
      for (let page = 0; page < 5; page++) {
        const query = new URLSearchParams({
          q: `'${parentId.replace(/'/g, "\\'")}' in parents and trashed = false`,
          fields: "nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime)",
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
          else files.push({ ...file, relativePath: nextPath });
          if (files.length > 500) throw new Error("A pasta tem mais de 500 arquivos. Divida o material em subpastas por assunto.");
        }
        pageToken = listed.nextPageToken;
        if (!pageToken) break;
      }
      if (pageToken) throw new Error("Uma pasta tem mais de 500 itens. Divida o material em subpastas por assunto.");
    }
    await walkFolder(folderId, "", 0);

    const records = [];
    const skipped: Array<{ file: string; reason: string }> = [];
    // File ids whose content just turned out to be a secret or bulk personal
    // data — any content indexed from an earlier, cleaner version of the
    // same file must be purged now, not kept around just because the file
    // id is still present in the folder (the generic "stale" check below
    // only catches files that disappeared or moved, not files that got
    // worse in place).
    const flaggedRefs = new Set<string>();
    let skippedCount = 0;
    for (let offset = 0; offset < files.length; offset += 8) {
      const chunk = await Promise.all(files.slice(offset, offset + 8).map(async (file) => ({ file, result: await readDriveFile(file, accessToken) })));
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
        records.push({
          client_id: clientId,
          title: file.relativePath ?? file.name,
          content: `Documento original: ${file.relativePath ?? file.name}\nAtualizado no Drive: ${file.modifiedTime ?? "data não informada"}\n\n${content.slice(0, 60000)}`,
          source: "drive",
          validated: true,
          created_by: user.id,
          source_ref: file.id,
          source_url: file.webViewLink ?? `https://drive.google.com/open?id=${encodeURIComponent(file.id)}`,
          source_folder_id: folderId,
        });
      }
    }
    for (const folderPath of restrictedFolders) {
      skippedCount++;
      if (skipped.length < 20) skipped.push({ file: `${folderPath}/*`, reason: "Restrito: pasta inteira excluída por nome (acesso/credencial/dado pessoal) — nenhum arquivo dentro foi lido." });
    }
    if (records.length) {
      const { error } = await supabase.from("client_knowledge").upsert(records, { onConflict: "client_id,source_ref" });
      if (error) throw new Error(`Falha ao salvar documentos sincronizados: ${error.message}`);
    }
    // Keep old indexed content if a file is temporarily unreadable or not
    // supported yet — but never for a file that just got flagged as a
    // secret or bulk personal data; that content comes out regardless of
    // what was indexed before.
    const currentRefs = new Set(files.map((file) => file.id));
    const { data: existingDriveEntries, error: existingError } = await supabase.from("client_knowledge").select("id,source_ref,source_folder_id").eq("client_id", clientId).eq("source", "drive");
    if (existingError) throw new Error(`Falha ao reconciliar documentos removidos: ${existingError.message}`);
    const staleIds = (existingDriveEntries ?? []).filter((entry) => entry.source_folder_id !== folderId || !currentRefs.has(entry.source_ref) || flaggedRefs.has(entry.source_ref)).map((entry) => entry.id);
    for (let offset = 0; offset < staleIds.length; offset += 100) {
      const { error } = await supabase.from("client_knowledge").delete().in("id", staleIds.slice(offset, offset + 100));
      if (error) throw new Error(`Falha ao remover documentos antigos da base: ${error.message}`);
    }
    return json({ synced: records.length, skipped, skipped_count: skippedCount, restricted_folders: restrictedFolders.length, used_legacy_credential: resolved.usedLegacy }, 200);
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});

type DriveFile = { id: string; name: string; mimeType: string; webViewLink?: string; modifiedTime?: string; relativePath?: string };

async function readDriveFile(file: DriveFile, token: string): Promise<{ content: string; skipReason?: never } | { content: null; skipReason: string }> {
  const exportMime: Record<string, string> = {
    "application/vnd.google-apps.document": "text/plain",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.presentation": "text/plain",
  };
  const googleExport = exportMime[file.mimeType];
  let url: string;
  if (googleExport) {
    url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent(googleExport)}`;
  } else if (["text/plain", "text/markdown", "text/csv"].includes(file.mimeType)) {
    url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`;
  } else return { content: null, skipReason: `Formato ainda não suportado (${file.mimeType}).` };
  try {
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) return { content: null, skipReason: `O Drive retornou HTTP ${response.status} ao ler o arquivo.` };
    const content = (await response.text()).slice(0, 60000);
    if (!content.trim()) return { content: null, skipReason: "O arquivo não contém texto extraível." };
    return { content };
  } catch {
    return { content: null, skipReason: "Falha de rede ao ler o arquivo do Drive." };
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
async function resolveServiceAccount(primaryRaw: string | undefined, legacyRaw: string | undefined): Promise<{ token: string; usedLegacy: boolean } | null> {
  const primary = await tryServiceAccount(primaryRaw);
  if (primary) return { token: primary, usedLegacy: false };
  const legacy = await tryServiceAccount(legacyRaw);
  if (legacy) return { token: legacy, usedLegacy: true };
  return null;
}

async function tryServiceAccount(raw: string | undefined): Promise<string | null> {
  if (!raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  const sa = parsed as Partial<ServiceAccount>;
  if (typeof sa.client_email !== "string" || !/@[\w.-]+\.iam\.gserviceaccount\.com$/.test(sa.client_email)) return null;
  if (typeof sa.private_key !== "string" || !sa.private_key.includes("PRIVATE KEY")) return null;
  try {
    return await getDriveToken(sa as ServiceAccount);
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
