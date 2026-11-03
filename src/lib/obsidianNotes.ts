import { isRestrictedName, looksLikeSecret, looksLikeBulkPersonalData } from '../../supabase/functions/orbe-drive-sync/content-filters.ts'
export type ObsidianNote = { path: string; content: string }
export function noteImportError(path: string, content: string): string | null {
  if (!path.endsWith('.md') || path.length>400 || path.split(/[\\/]/).some(part=>part.startsWith('.')||part==='..'||isRestrictedName(part))) return 'Nome ou caminho excluído da base.'
  if (!content.trim()) return 'Nota vazia.'
  if (new TextEncoder().encode(content).length>200000) return 'Nota acima de 200 KB.'
  if (looksLikeSecret(content)||looksLikeBulkPersonalData(content)) return 'Conteúdo restrito: credenciais ou dados pessoais em massa.'
  return null
}
export function obsidianNoteUrl(vault: string, path: string) {
  return `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(path.replace(/\.md$/,''))}`
}
