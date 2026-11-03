import { isRestrictedName } from './content-filters.ts';
type File = { id: string; name: string; mimeType: string; parents?: string[]; modifiedTime?: string; webViewLink?: string };
export class DriveBrowseError extends Error { status: number; constructor(message: string, status: number) { super(message); this.status=status; } }
const validId = /^[\w-]{10,256}$/;
const financialName = /R\s*[$]|\b(BRL|USD|EUR)\b|honor[áa]rio|retainer|financeir|contrat|mensalidade/i;
const folderMime = 'application/vnd.google-apps.folder';
export async function browseCreativeFolder(root: string, path: unknown, pageToken: unknown, get: (url: string) => Promise<unknown>, canViewFinancials = false) {
  if (!Array.isArray(path) || !path.length || path.length > 30 || path[0] !== root || path.some(id => typeof id !== 'string' || !validId.test(id)) || new Set(path).size !== path.length) throw new DriveBrowseError('Caminho de pasta inválido.',400);
  if (pageToken != null && (typeof pageToken !== 'string' || pageToken.length > 4096)) throw new DriveBrowseError('Página inválida.',400);
  const folders: File[] = [];
  // Verify every parent, not just the leaf: a caller cannot jump to another
  // client's folder or traverse a restricted ancestor using a hand-made path.
  for (let i=0;i<path.length;i++) {
    const folder = await get(`https://www.googleapis.com/drive/v3/files/${path[i]}?fields=id,name,mimeType,parents,trashed&supportsAllDrives=true`) as File & { trashed?: boolean };
    if (folder.id !== path[i] || folder.trashed || folder.mimeType !== folderMime || (isRestrictedName(folder.name) || !canViewFinancials && financialName.test(folder.name)) || i > 0 && !folder.parents?.includes(path[i-1])) throw new DriveBrowseError('Esta pasta não pertence ao acervo permitido do cliente.',403);
    folders.push(folder);
  }
  const query = new URLSearchParams({ q: `'${path.at(-1)}' in parents and trashed = false`,fields:'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink)',orderBy:'folder,name',pageSize:'100',supportsAllDrives:'true',includeItemsFromAllDrives:'true' });
  if (pageToken) query.set('pageToken',pageToken as string);
  const result = await get(`https://www.googleapis.com/drive/v3/files?${query}`) as { files?: File[]; nextPageToken?: string };
  return { folders: folders.map(({id,name})=>({id,name})), files: (result.files??[]).filter(file => validId.test(file.id) && !isRestrictedName(file.name) && (canViewFinancials || !financialName.test(file.name)) && (file.mimeType === folderMime || /^(image|video)\//.test(file.mimeType) || ['application/pdf','application/vnd.google-apps.presentation'].includes(file.mimeType))).map(file => ({ id:file.id,name:file.name,mimeType:file.mimeType,modifiedTime:file.modifiedTime,url:`https://drive.google.com/${file.mimeType===folderMime?'drive/folders/':'file/d/'}${file.id}${file.mimeType===folderMime?'':'/view'}` })), nextPageToken: result.nextPageToken ?? null };
}
