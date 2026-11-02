import test from 'node:test'
import assert from 'node:assert/strict'
import { buildClientWorkspace, parseClientWorkspace } from '../src/lib/clientWorkspace.ts'
import { inTimelinePeriod, previousMonth } from '../src/lib/clientTimeline.ts'
const raya = '589481f6-3a15-4c93-b384-5d33373c20e3'
const other = 'b1253dc9-1414-4c5f-9f13-3c34961960e0'
test('legacy tracking bookmarks retain their client and open the client workspace', () => {
  const old = `#rastreamento/rayafit?cliente=${raya}&aba=commercial&unidade=ibes&de=2026-10-01&ate=2026-10-31&origem=Meta`
  const parsed = parseClientWorkspace(old)
  assert.equal(parsed.clientId, raya)
  assert.equal(parsed.area, 'tracking')
  const next = parseClientWorkspace(buildClientWorkspace(raya, 'Rayafit', 'tracking', old))
  for (const key of ['aba','unidade','de','ate','origem']) assert.equal(next.params.get(key), parsed.params.get(key))
})
test('client switching preserves the chosen area and dates without carrying another client unit or source', () => {
  const hash = buildClientWorkspace(other, 'Colégio Octagon', 'strategy', `#clientes/rayafit?cliente=${raya}&unidade=ibes&origem=Meta&de=2026-10-01&ate=2026-10-31`)
  assert.ok(hash.startsWith('#clientes/colegio-octagon?'))
  const next = parseClientWorkspace(hash)
  assert.equal(next.clientId, other); assert.equal(next.area, 'strategy')
  assert.equal(next.params.get('unidade'), 'all'); assert.equal(next.params.get('origem'), null)
  assert.equal(next.params.get('de'), '2026-10-01')
})
test('connection navigation and browser restoration use independent workspace and tracking tabs', () => {
  const hash = buildClientWorkspace(raya, 'Rayafit', 'connections')
  const next = parseClientWorkspace(hash)
  assert.equal(next.area, 'connections'); assert.equal(next.params.get('aba'), 'connections')
  assert.equal(parseClientWorkspace('#clientes?cliente=not-an-id&area=invalid').clientId, null)
  assert.equal(parseClientWorkspace('#clientes?area=invalid').area, 'overview')
})
test('quarter history follows dates across year boundaries and preserves undated legacy records', () => {
  assert.equal(inTimelinePeriod('2026-03-31', 2026, '1'), true)
  assert.equal(inTimelinePeriod('2026-04-01', 2026, '1'), false)
  assert.equal(inTimelinePeriod('2027-01-01', 2026, '1'), false)
  assert.equal(inTimelinePeriod(null, 2026, '4'), false)
  assert.equal(inTimelinePeriod(null, 2027, 'legacy'), true)
  assert.equal(inTimelinePeriod(null, 2026, 'all'), false)
})

test('previous month crosses January and respects leap-year February', () => {
  assert.deepEqual(previousMonth(new Date(2027, 0, 15)), { start: '2026-12-01', end: '2026-12-31', month: '2026-12' })
  assert.deepEqual(previousMonth(new Date(2028, 2, 1)), { start: '2028-02-01', end: '2028-02-29', month: '2028-02' })
})
