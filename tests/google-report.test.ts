import test from 'node:test'
import assert from 'node:assert/strict'
import { googleAdsReport,googleAdsFailure } from '../api/_lib/googleAdsReport.ts'
const account = '1234567890'
const secret = { client_id: 'synthetic.apps.googleusercontent.com', client_secret: 'SYNTHETIC_CLIENT_SECRET', refresh_token: 'SYNTHETIC_REFRESH', developer_token: 'SYNTHETIC_DEVELOPER', manager_id: '9999999999' }
const period = { since: '2026-10-01', until: '2026-10-31' }
test('Google exposes exact missing prerequisites without requesting a provider or returning secrets', async () => {
  assert.deepEqual(await googleAdsReport(account, {}, period), { status: 'oauth_pending' })
})
test('Google report uses a fixed HTTPS host, headers for credentials, full pagination and micros conversion', async () => {
  const before = globalThis.fetch
  let pages = 0
  globalThis.fetch = async (url, init) => {
    const target = new URL(String(url))
    assert.ok(['oauth2.googleapis.com','googleads.googleapis.com'].includes(target.hostname))
    for (const value of Object.values(secret)) assert.equal(target.toString().includes(value), false)
    assert.equal(init?.redirect, 'error')
    if (target.hostname === 'oauth2.googleapis.com') return new Response(JSON.stringify({ access_token: 'SYNTHETIC_ACCESS' }))
    assert.equal(new Headers(init?.headers).has('developer-token'),false)
    assert.equal(new Headers(init?.headers).get('login-customer-id'), secret.manager_id)
    const body = JSON.parse(String(init?.body))
    assert.ok(body.query.startsWith('SELECT '))
    if (body.query.includes('FROM customer')) return new Response(JSON.stringify({ results: [{ customer: { id: account, descriptiveName: 'Test account', currencyCode: 'USD', timeZone: 'America/New_York' } }] }))
    pages++
    if (pages === 2) assert.equal(body.pageToken, 'fixed-cursor')
    return new Response(JSON.stringify({ results: [{ campaign: { id: String(pages), name: `Campaign ${pages}` }, segments: { date: '2026-10-01' }, metrics: { costMicros: '5500000', clicks: '4', impressions: '100', conversions: '2.5' } }], ...(pages === 1 ? { nextPageToken: 'fixed-cursor' } : {}) }))
  }
  try {
    const report = await googleAdsReport(account, secret, period)
    assert.equal(report.status, 'ready')
    if (report.status !== 'ready') throw new Error('report missing')
    assert.equal(report.currency, 'USD'); assert.equal(report.daily.length, 2)
    assert.equal(report.totals.spend, 11); assert.equal(report.totals.clicks, 8)
    assert.equal(report.totals.conversions, 5); assert.equal(report.totals.reach, null)
    assert.equal((await googleAdsReport(account,{...secret,developer_token:''},period)).status,'ready')
  } finally { globalThis.fetch = before }
})
test('OAuth and Ads errors discard provider bodies that may contain private values', async () => {
  const before = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'invalid_grant', message: secret.refresh_token }), { status: 400 })
  try { await assert.rejects(() => googleAdsReport(account, secret, period), { message: 'google_oauth_invalid' }) } finally { globalThis.fetch = before }
})

test('Cloud project readiness is distinct from account permission and never exposes raw errors',()=>{
 assert.equal(googleAdsFailure(403,{details:[{errors:[{errorCode:{authorizationError:'CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION'},message:'SYNTHETIC_PRIVATE_DETAIL'}]}]}).message,'google_cloud_access_required')
 assert.equal(googleAdsFailure(403,{details:[{reason:'SERVICE_DISABLED',metadata:{service:'googleads.googleapis.com'}}]}).message,'google_cloud_api_disabled')
 assert.equal(googleAdsFailure(403,{message:'SYNTHETIC_PRIVATE_DETAIL'}).message,'google_permission_denied')
})
