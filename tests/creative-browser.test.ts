import test from 'node:test'
import assert from 'node:assert/strict'
import { browseCreativeFolder } from '../supabase/functions/orbe-drive-sync/creative-browser.ts'
const root='rootfolder0001',child='childfolder001',other='otherfolder001'
const folder=(id:string,name:string,parents:string[]=[])=>({id,name,parents,mimeType:'application/vnd.google-apps.folder'})
test('creative browsing verifies every parent and canonicalizes file links without proxying media',async()=>{
 const result=await browseCreativeFolder(root,[root,child],null,async url=>url.includes('/files?')?{files:[{id:'imagefile00001',name:'Novembro.png',mimeType:'image/png',webViewLink:'https://evil.example/x'},{id:'secretfile0001',name:'Senhas.png',mimeType:'image/png'},{id:'financial0001',name:'Contrato R$ 2000.pdf',mimeType:'application/pdf'}],nextPageToken:'next'}:url.includes(`/files/${root}`)?folder(root,'Rayafit'):folder(child,'2026 - Novembro',[root]))
 assert.equal(result.files.length,1);assert.equal(result.files[0].url,'https://drive.google.com/file/d/imagefile00001/view');assert.equal(result.nextPageToken,'next')
})
test('a modified path cannot read another client, follow shortcuts, or traverse restricted ancestors',async()=>{
 await assert.rejects(()=>browseCreativeFolder(root,[other],null,async()=>{throw Error('should not call')}),/inválido/)
 await assert.rejects(()=>browseCreativeFolder(root,[root,child],null,async url=>url.includes(root)?folder(root,'Rayafit'):folder(child,'Campanhas',[other])),/permitido/)
 await assert.rejects(()=>browseCreativeFolder(root,[root,child],null,async url=>url.includes(root)?folder(root,'Rayafit'):folder(child,'Acessos',[root])),/permitido/)
 await assert.rejects(()=>browseCreativeFolder(root,[root,root],null,async()=>({})),/inválido/)
})
test('financial folder metadata requires explicit financial permission',async()=>{
 await assert.rejects(()=>browseCreativeFolder(root,[root],null,async()=>folder(root,'Financeiro')),/permitido/)
 const result=await browseCreativeFolder(root,[root],null,async url=>url.includes('/files?')?{files:[]}:folder(root,'Financeiro'),true)
 assert.equal(result.folders[0].name,'Financeiro')
})
