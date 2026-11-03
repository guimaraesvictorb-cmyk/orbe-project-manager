export const clientAreas = ['overview','checklist','tracking','meta','google','compilado','strategy','knowledge','ai','connections','analytics'] as const
export type ClientArea = typeof clientAreas[number]
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
export function parseClientWorkspace(hash: string) {
  const [path, search = ''] = hash.replace(/^#\/?/, '').split('?')
  const params = new URLSearchParams(search)
  const value = params.get('cliente') ?? ''
  const requested = params.get('area')
  const area: ClientArea = path.startsWith('rastreamento') ? 'tracking' : clientAreas.includes(requested as ClientArea) ? requested as ClientArea : 'overview'
  return { clientId: uuid.test(value) ? value : null, area, params }
}
export function buildClientWorkspace(clientId: string, name: string, area: ClientArea = 'overview', currentHash = '') {
  const current = parseClientWorkspace(currentHash)
  const params = current.params
  if (current.clientId !== clientId) { params.delete('origem'); params.set('unidade', 'all') }
  params.set('cliente', clientId)
  params.set('area', area)
  params.delete('visao')
  if (area === 'connections') params.set('aba', 'connections')
  if (area === 'tracking' && current.area === 'connections') params.set('aba', 'overview')
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const section = currentHash.replace(/^#\/?/, '').startsWith('campanhas') && ['meta','google','compilado','analytics'].includes(area) ? 'campanhas' : 'clientes'
  return `#${section}/${slug}?${params}`
}
export function openClientWorkspace(clientId: string, name: string, area: ClientArea = 'overview') {
  window.location.hash = buildClientWorkspace(clientId, name, area, window.location.hash)
}
