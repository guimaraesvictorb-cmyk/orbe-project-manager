export const utmFields = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'] as const
export type TrackingConnection = {
  id: string; client_id: string | null; name: string; provider: 'evolution'|'kommo'|'meta_cloud';
  destination: string; redirect_url: string; capture_mode: 'pilot'|'client'; enabled: boolean;
  connection_state: 'open'|'close'|'connecting'|'unknown'; last_sync_at: string|null;
  last_received_at: string|null; allowed_senders: string[];
}
export type TrackingRecord = { entity_key: string; entity: string; occurred_at: string; payload: Record<string,string|number> }
export type TrackingLink = { id: string; connection_id: string; label: string; greeting: string; created_at: string } & Record<typeof utmFields[number],string>
export type TrackingSummary = { clicks: number; contacts: number; messages: number; identified: number; unidentified: number; campaigns: {source:string; campaign:string; messages:number; contacts:number}[] }
export const emptySummary: TrackingSummary = {clicks:0,contacts:0,messages:0,identified:0,unidentified:0,campaigns:[]}
export function trackingUrl(connection: Pick<TrackingConnection,'redirect_url'>, form: Pick<TrackingLink,'greeting'|typeof utmFields[number]>) {
  const url=new URL(connection.redirect_url)
  if (url.protocol !== 'https:') throw new Error('Endereço de rastreamento inválido.')
  if (!form.greeting.trim() || form.greeting.length>500 || /\[ORBE:|[\uFE00-\uFE0F\u200B\u200C\u2060\u2063]/u.test(form.greeting)) throw new Error('Use uma saudação de até 500 caracteres, sem códigos de rastreamento.')
  url.searchParams.set('text',form.greeting)
  for (const key of utmFields) {
    if (form[key].length>256) throw new Error('Cada UTM pode ter até 256 caracteres.')
    url.searchParams.set(key,form[key])
  }
  if (!form.utm_source.trim() || !form.utm_medium.trim()) throw new Error('Preencha a origem e a mídia.')
  return url.toString()
}
export function syncIsFresh(lastSync: string|null, now=Date.now()) {
  return !!lastSync && Number.isFinite(Date.parse(lastSync)) && now-Date.parse(lastSync)<180000
}
export function periodBounds(start:string,end:string) {
  if (start && end && start>end) throw new Error('A data inicial deve vir antes da data final.')
  const startAt=start ? new Date(`${start}T00:00:00`) : null
  const endAt=end ? new Date(`${end}T00:00:00`) : null
  if (endAt) endAt.setDate(endAt.getDate()+1)
  return {start:startAt?.toISOString() ?? null,end:endAt?.toISOString() ?? null}
}
