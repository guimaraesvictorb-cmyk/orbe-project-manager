import test from 'node:test'
import assert from 'node:assert/strict'
import { isRestrictedName, looksLikeSecret, looksLikeBulkPersonalData } from '../supabase/functions/orbe-drive-sync/content-filters.ts'

// Regression case: a legitimate marketing doc (name gives no indication of
// a credential) had a real token pasted as "Token <UUID>" — a space, no
// colon or equals sign. The original regex only matched ":"/"=" and missed
// it. These tests never assert on, print or store the matched text itself.
test('catches "Token <value>" separated by a space, not just ":"/"="', () => {
  assert.equal(looksLikeSecret('Roteiro da campanha.\nToken 3fa85f64-5717-4562-b3fc-2c963f66afa6\nRestante do documento normal.'), true)
})

test('still catches the colon/equals forms', () => {
  assert.equal(looksLikeSecret('api_key: AKIAABCDEFGHIJKLMNOP'), true)
  assert.equal(looksLikeSecret('senha=minhaSenhaForte123'), true)
})

test('does not flag ordinary prose that happens to contain these words', () => {
  assert.equal(looksLikeSecret('O token de acesso do cliente expira em 30 dias.'), false)
  assert.equal(looksLikeSecret('Lembrar de pedir a senha ao administrador na reunião.'), false)
})

test('catches a private key header on its own line inside a longer, multi-line document', () => {
  const content = [
    'Relatório de configuração do servidor',
    '',
    'Ambiente: produção',
    '-----BEGIN PRIVATE KEY-----',
    'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...',
    '-----END PRIVATE KEY-----',
    '',
    'Fim do documento.',
  ].join('\n')
  assert.equal(looksLikeSecret(content), true)
})

test('catches a Google service account JSON blob pasted into a doc', () => {
  const serviceAccountJson = JSON.stringify({
    type: 'service_account',
    project_id: 'orbe-example',
    private_key_id: 'abc123',
    private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKc=\n-----END PRIVATE KEY-----\n',
    client_email: 'drive-sync@orbe-example.iam.gserviceaccount.com',
  })
  assert.equal(looksLikeSecret(serviceAccountJson), true)
})

test('AWS-style access key id is caught even without a keyword nearby', () => {
  assert.equal(looksLikeSecret('Credenciais antigas, ignorar: AKIAIOSFODNN7EXAMPLE'), true)
})

test('a JWT-shaped string is caught', () => {
  assert.equal(looksLikeSecret('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'), true)
})

test('clean business content is never flagged', () => {
  assert.equal(looksLikeSecret('Resumo da reunião de 30/10: aprovado o investimento de R$5.000 na campanha de novembro.'), false)
})

test('restricted names: folders and files', () => {
  assert.equal(isRestrictedName('Planilha de Acessos - Evidence'), true)
  assert.equal(isRestrictedName('Base de Clientes'), true)
  assert.equal(isRestrictedName('LEADS - Outubro'), true)
  assert.equal(isRestrictedName('Conversa do WhatsApp com +55 11 99999-9999.txt'), true)
  assert.equal(isRestrictedName('Relatório mensal de performance'), false)
  assert.equal(isRestrictedName('Briefing campanha Black Friday'), false)
})

test('bulk personal data: many phone/e-mail rows trip the threshold, a couple of examples in a doc do not', () => {
  const bulkCsv = Array.from({ length: 20 }, (_, i) => `cliente${i},(11) 9${8000 + i}-0000,cliente${i}@example.com`).join('\n')
  assert.equal(looksLikeBulkPersonalData(bulkCsv), true)
  const normalDoc = 'Contato principal: (11) 98888-0000, contato@empresa.com. Falar antes das 18h.'
  assert.equal(looksLikeBulkPersonalData(normalDoc), false)
})
