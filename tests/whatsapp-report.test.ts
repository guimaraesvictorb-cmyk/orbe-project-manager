import test from 'node:test'
import assert from 'node:assert/strict'
import {buildWhatsAppReport} from '../src/lib/whatsappReport.ts'
test('WhatsApp closing preserves currency and source gaps without implying clicks are sales',()=>{
 const text=buildWhatsAppReport('Cliente','2026-10-01','2026-10-31',[{platform:'meta',status:'ready',currency:'BRL',totals:{spend:10,impressions:100,clicks:5}},{platform:'google',status:'oauth_pending'}],{total:3,done:1},true)
 assert.match(text,/10,00/);assert.match(text,/autorização Google pendente/);assert.match(text,/Cliques não representam vendas/);assert.match(text,/01\/10\/2026 a 31\/10\/2026/);assert.doesNotMatch(text,/Mensalidade|honorário|0 conversões/)
})
