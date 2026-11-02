import { zipSync, strToU8 } from 'npm:fflate@0.8.3';
import { documentText, officeTypes } from './document-text.ts';
function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
Deno.test('HTML extracts readable text and removes executable markup', async () => {
  const result = await documentText('text/html', strToU8('<h1>Estratégia &amp; resultado</h1><script>DO_NOT_INDEX</script><p>Captação &#x2192; matrícula</p>'));
  assert(result.includes('Estratégia & resultado') && result.includes('Captação → matrícula'), 'HTML text missing');
  assert(!result.includes('DO_NOT_INDEX'), 'Script content entered knowledge');
});
Deno.test('DOCX and PPTX include body text and presentation notes without executing Office content', async () => {
  const docx = zipSync({ 'word/document.xml': strToU8('<w:document><w:p><w:r><w:t>Planejamento &amp; metas</w:t></w:r></w:p></w:document>') });
  assert((await documentText(officeTypes[0], docx)).includes('Planejamento & metas'), 'DOCX text missing');
  const pptx = zipSync({ 'ppt/slides/slide1.xml': strToU8('<a:p><a:t>Oferta aprovada</a:t></a:p>'), 'ppt/notesSlides/notesSlide1.xml': strToU8('<a:p><a:t>Validar execução</a:t></a:p>') });
  const result = await documentText(officeTypes[2], pptx);
  assert(result.includes('Oferta aprovada') && result.includes('Validar execução'), 'Presentation notes lost');
});
Deno.test('XLSX reads every worksheet, resolves real sheet names/shared strings and retains numeric zero', async () => {
  const bytes = zipSync({
    'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="Resumo" r:id="rId2"/><sheet name="Histórico" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>'),
    'xl/sharedStrings.xml': strToU8('<sst><si><t>Matrícula</t></si></sst>'),
    'xl/worksheets/sheet1.xml': strToU8('<worksheet><row><c t="s"><v>0</v></c><c><v>0</v></c></row></worksheet>'),
    'xl/worksheets/sheet2.xml': strToU8('<worksheet><row><c><v>123.45</v></c><c><f>1+2</f></c></row></worksheet>'),
  });
  const text = await documentText(officeTypes[1], bytes);
  assert(text.includes('Aba: Histórico') && text.includes('Aba: Resumo'), 'Worksheet names lost');
  assert(text.includes('Matrícula\t0') && text.includes('123.45'), 'Cell values lost');
  assert(text.includes('[fórmula sem valor armazenado]'), 'Uncalculated formula became an invented value');
});
Deno.test('PDF extracts its text layer in the serverless runtime', async () => {
  const stream = 'BT /F1 12 Tf 20 40 Td (Synthetic PDF knowledge) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  assert((await documentText('application/pdf', strToU8(pdf))).includes('Synthetic PDF knowledge'), 'PDF text missing');
});
