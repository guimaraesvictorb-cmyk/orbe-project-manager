import test from 'node:test'
import assert from 'node:assert/strict'
import { noteImportError, obsidianNoteUrl } from '../src/lib/obsidianNotes.ts'
test('only bounded Markdown notes enter the client import',()=>{
 assert.equal(noteImportError('Campanhas/Novembro.md','Oferta aprovada. Matrícula confirmada no EVO.'),null)
 for(const path of ['.obsidian/config.md','../Outro cliente.md','Acessos/Conta.md','art.png'])assert.ok(noteImportError(path,'texto'))
 assert.ok(noteImportError('nota.md','x'.repeat(200001)));assert.ok(noteImportError('nota.md',''))
 assert.ok(noteImportError('nota.md','sk-ant-SYNTHETIC_NOT_A_REAL_KEY_FOR_TEST_ONLY'))
})
test('opening an Obsidian note encodes vault and file instead of accepting a supplied URL',()=>{
 const url=obsidianNoteUrl('Orbe & equipe','Campanhas/Black #1.md')
 assert.equal(url,'obsidian://open?vault=Orbe%20%26%20equipe&file=Campanhas%2FBlack%20%231')
})
