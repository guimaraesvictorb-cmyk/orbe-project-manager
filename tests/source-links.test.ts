import test from 'node:test'
import assert from 'node:assert/strict'
import { safeSourceUrl } from '../src/lib/safeSourceUrl.ts'
test('source links retain canonical Drive references and never activate executable or credential-bearing addresses',()=>{
 assert.equal(safeSourceUrl('https://docs.google.com/document/d/example/edit'),'https://docs.google.com/document/d/example/edit')
 for(const value of ['javascript:alert(1)','data:text/html,<script>alert(1)</script>','file:///private/file','/relative','https://user:password@example.com/'])assert.equal(safeSourceUrl(value),null)
})
