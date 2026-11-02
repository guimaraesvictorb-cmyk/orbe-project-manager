import { unzipSync, strFromU8 } from 'npm:fflate@0.8.3';
import { extractText, getDocumentProxy } from 'npm:unpdf@2.1.0';

export const officeTypes = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation'];
export const textTypes = ['text/plain','text/markdown','text/csv','text/html','application/xhtml+xml'];
export function decodeEntities(text: string) {
  const named: Record<string,string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…' };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (original, value: string) => {
    if (value[0] !== '#') return named[value.toLowerCase()] ?? original;
    const point = value[1].toLowerCase() === 'x' ? parseInt(value.slice(2),16) : Number(value.slice(1));
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
  });
}
export function markupText(text: string) {
  return decodeEntities(text.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<!--[\s\S]*?-->/g,'').replace(/<\/(?:p|div|h[1-6]|li|tr|w:p|a:p)>|<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'')).replace(/[\t ]+/g,' ').replace(/\n[\t ]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
export async function documentText(mime: string, bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength > 12 * 1024 * 1024) throw new Error('Arquivo acima do limite de 12 MB para extração.');
  if (textTypes.includes(mime)) { const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); return /html|xml/.test(mime) ? markupText(text) : text; }
  if (mime === 'application/pdf') {
    const pdf = await getDocumentProxy(bytes, { useSystemFonts: false, disableFontFace: true, useWorkerFetch: false, enableXfa: false });
    try {
      if (pdf.numPages > 250) throw new Error('PDF acima do limite de 250 páginas para extração.');
      const result = await extractText(pdf, { mergePages: true });
      if (!result.text.trim()) throw new Error('PDF sem camada de texto; precisa de OCR.');
      return result.text;
    } finally { await pdf.loadingTask.destroy(); }
  }
  if (!officeTypes.includes(mime)) throw new Error('Formato sem extrator de texto disponível.');
  let expanded = 0;
  const files = unzipSync(bytes, { filter(entry) {
    const useful = /^(word\/(document|footnotes|endnotes|header\d+|footer\d+)\.xml|ppt\/(slides\/slide\d+|notesSlides\/notesSlide\d+)\.xml|xl\/(sharedStrings\.xml|workbook\.xml|_rels\/workbook\.xml\.rels|worksheets\/[^/]+\.xml))$/.test(entry.name);
    if (!useful) return false;
    expanded += entry.originalSize;
    if (expanded > 24 * 1024 * 1024 || entry.originalSize > 12 * 1024 * 1024) throw new Error('Conteúdo Office acima do limite de extração.');
    return true;
  } });
  const xml = (path: string) => files[path] ? strFromU8(files[path]) : '';
  if (mime === officeTypes[1]) {
    const strings = [...xml('xl/sharedStrings.xml').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(match => markupText(match[1]));
    const attr = (tag: string, name: string) => decodeEntities(tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? '');
    const relations = new Map([...xml('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]+>/g)].map(match => [attr(match[0],'Id'), attr(match[0],'Target')]));
    const names = new Map([...xml('xl/workbook.xml').matchAll(/<sheet\b[^>]+>/g)].map(match => { const target = relations.get(attr(match[0],'r:id')) ?? ''; return [target.startsWith('/') ? target.slice(1) : `xl/${target}`, attr(match[0],'name')]; }));
    return Object.keys(files).filter(path => path.startsWith('xl/worksheets/')).sort().map(path => {
      const rows = [...xml(path).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(row => [...row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)].map(cell => {
        const value = cell[2].match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? '';
        if (/\bt="s"/.test(cell[1])) return /^\d+$/.test(value) ? strings[Number(value)] ?? '' : '';
        if (/\bt="inlineStr"/.test(cell[1])) return markupText(cell[2]);
        return value ? decodeEntities(value) : /<f\b/.test(cell[2]) ? '[fórmula sem valor armazenado]' : '';
      }).join('\t')).join('\n');
      return `Aba: ${names.get(path) || path}\n${rows}`;
    }).join('\n\n');
  }
  return Object.keys(files).sort((a,b) => a.localeCompare(b,undefined,{numeric:true})).map(path => `${path}\n${markupText(xml(path))}`).join('\n\n');
}
