import { isRestrictedName } from './content-filters.ts';
type File = { id: string; name: string; mimeType: string; parents?: string[]; modifiedTime?: string; webViewLink?: string };
export class DriveBrowseError extends Error { status: number; constructor(message: string, status: number) { super(message); this.status=status; } }
const validId = /^[\w-]{10,256}$/;
const financialName = /R\s*[$]|\b(BRL|USD|EUR)\b|honor[áa]rio|retainer|financeir|contrat|mensalidade/i;
const folderMime = 'application/vnd.google-apps.folder';
export async function validateCreativePath(root: string, path: unknown, get: (url: string) => Promise<unknown>, canViewFinancials = false) {
  if (!Array.isArray(path) || !path.length || path.length > 30 || path[0] !== root || path.some(id => typeof id !== 'string' || !validId.test(id)) || new Set(path).size !== path.length) throw new DriveBrowseError('Caminho de pasta inválido.',400);
  const folders: File[] = [];
  // Verify every parent, not just the leaf: a caller cannot jump to another
  // client's folder or traverse a restricted ancestor using a hand-made path.
  for (let i=0;i<path.length;i++) {
    const folder = await get(`https://www.googleapis.com/drive/v3/files/${path[i]}?fields=id,name,mimeType,parents,trashed&supportsAllDrives=true`) as File & { trashed?: boolean };
    if (folder.id !== path[i] || folder.trashed || folder.mimeType !== folderMime || (isRestrictedName(folder.name) || !canViewFinancials && financialName.test(folder.name)) || i > 0 && !folder.parents?.includes(path[i-1])) throw new DriveBrowseError('Esta pasta não pertence ao acervo permitido do cliente.',403);
    folders.push(folder);
  }
  return folders;
}
export async function browseCreativeFolder(root: string, path: unknown, pageToken: unknown, get: (url: string) => Promise<unknown>, canViewFinancials = false) {
  const folders = await validateCreativePath(root,path,get,canViewFinancials);
  if (pageToken != null && (typeof pageToken !== 'string' || pageToken.length > 4096)) throw new DriveBrowseError('Página inválida.',400);
  const query = new URLSearchParams({ q: `'${folders.at(-1)!.id}' in parents and trashed = false`,fields:'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink)',orderBy:'folder,name',pageSize:'100',supportsAllDrives:'true',includeItemsFromAllDrives:'true' });
  if (pageToken) query.set('pageToken',pageToken as string);
  const result = await get(`https://www.googleapis.com/drive/v3/files?${query}`) as { files?: File[]; nextPageToken?: string };
  return { folders: folders.map(({id,name})=>({id,name})), files: (result.files??[]).filter(file => validId.test(file.id) && !isRestrictedName(file.name) && (canViewFinancials || !financialName.test(file.name)) && (file.mimeType === folderMime || /^(image|video)\//.test(file.mimeType) || ['application/pdf','application/vnd.google-apps.presentation'].includes(file.mimeType))).map(file => ({ id:file.id,name:file.name,mimeType:file.mimeType,modifiedTime:file.modifiedTime,url:`https://drive.google.com/${file.mimeType===folderMime?'drive/folders/':'file/d/'}${file.id}${file.mimeType===folderMime?'':'/view'}` })), nextPageToken: result.nextPageToken ?? null };
}

// Private thumbnails must be fetched with credentials by a proxy, not exposed
// as short-lived bearer links to the browser. Google Drive file metadata docs:
// https://developers.google.com/workspace/drive/api/guides/file-metadata
export async function creativePreview(root:string,path:unknown,fileId:unknown,get:(url:string)=>Promise<unknown>,fetchThumbnail:(url:string)=>Promise<Response>,canViewFinancials=false) {
 const folders=await validateCreativePath(root,path,get,canViewFinancials);
 if(typeof fileId!=='string'||!validId.test(fileId))throw new DriveBrowseError('Arquivo inválido.',400);
 const file=await get(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,parents,trashed,thumbnailLink&supportsAllDrives=true`) as File&{trashed?:boolean;thumbnailLink?:string};
 if(file.id!==fileId||file.trashed||!file.parents?.includes(folders.at(-1)!.id)||isRestrictedName(file.name)||!canViewFinancials&&financialName.test(file.name)||!/^(image|video)\//.test(file.mimeType))throw new DriveBrowseError('Arquivo fora do acervo permitido.',403);
 if(!file.thumbnailLink)throw new DriveBrowseError('Prévia indisponível.',404);
 const address=new URL(file.thumbnailLink);
 if(address.protocol!=='https:'||address.username||address.password||!(address.hostname==='googleusercontent.com'||address.hostname.endsWith('.googleusercontent.com')))throw new DriveBrowseError('Origem da prévia inválida.',503);
 const response=await fetchThumbnail(address.href.replace(/=s\d+$/, '=s640'));
 const type=response.headers.get('content-type')?.split(';')[0]??'';
 if(!response.ok||!['image/png','image/jpeg','image/webp','image/gif'].includes(type)||!response.body)throw new DriveBrowseError('Prévia indisponível.',404);
 const parts:Uint8Array[]=[];let size=0;const reader=response.body.getReader();
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024){await reader.cancel();throw new DriveBrowseError('Prévia acima do limite.',413)}parts.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
 return {bytes,type};
}
