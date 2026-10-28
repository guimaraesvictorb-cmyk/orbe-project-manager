export const UTM_FIELDS = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'] as const;
export type Connection = { id: string; instance: string; destination: string; enabled: boolean; capture_mode: string; allowed_senders: string[] };
export type TrackingEvent = { entity: 'leads'|'messages'|'clicks'; key: string; revision: number; occurred_at: string; record: Record<string, string|number> };
const columns = {
  clicks: ['reference','created_at','destination','instance','linked_sender_id',...UTM_FIELDS],
  messages: ['name','phone','text','received_at','source_status','instance','contact_id','message_id','type','source_ref','attribution_reason',...UTM_FIELDS],
  leads: ['name','phone','first_message','last_message','first_interaction','last_interaction','source_status','instance','contact_id','message_count',...UTM_FIELDS],
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_object');
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 256): string {
  if (typeof value !== 'string' || value.length > max || value.includes('\u0000')) throw new Error('invalid_text');
  return value;
}
export function validateBatch(body: unknown, connection: Connection) {
  const input = object(body);
  if (input.version !== 1 || !Array.isArray(input.events) || input.events.length > 100) throw new Error('invalid_batch');
  if (!['open','close','connecting','unknown'].includes(String(input.state))) throw new Error('invalid_state');
  const events: TrackingEvent[] = input.events.map((raw) => {
    const event = object(raw);
    if (!['leads','messages','clicks'].includes(String(event.entity))) throw new Error('invalid_entity');
    const entity = event.entity as TrackingEvent['entity'];
    const key = text(event.key,160);
    if (!key || !Number.isSafeInteger(event.revision) || Number(event.revision)<1) throw new Error('invalid_revision');
    const original = object(event.record);
    const record: TrackingEvent['record'] = {};
    for (const field of columns[entity]) {
      const value = original[field];
      if (field === 'message_count') {
        if (!Number.isSafeInteger(value) || Number(value)<1) throw new Error('invalid_count');
        record[field] = Number(value);
      } else {
        record[field] = text(value ?? '', ['text','first_message','last_message'].includes(field) ? 32768 : 256);
      }
    }
    if (record.instance !== connection.instance) throw new Error('wrong_instance');
    if (entity === 'clicks') {
      if (record.destination !== connection.destination || !/^[A-F0-9]{32}$/.test(String(record.reference)) || key !== record.reference) throw new Error('wrong_destination');
    } else {
      if (!/^[1-9][0-9]{9,14}$/.test(String(record.phone))) throw new Error('invalid_sender');
      if (connection.capture_mode === 'pilot' && !connection.allowed_senders.includes(String(record.phone))) throw new Error('sender_not_allowed');
      if (!record.contact_id || !['Identificada','Não identificada'].includes(String(record.source_status))) throw new Error('invalid_attribution');
      if (record.source_status === 'Não identificada' && UTM_FIELDS.some(f => record[f])) throw new Error('unproven_utm');
      if (entity === 'messages' && !record.message_id) throw new Error('missing_message_id');
    }
    const date = String(record[entity === 'messages' ? 'received_at' : entity === 'leads' ? 'first_interaction' : 'created_at']);
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(date) || !Number.isFinite(Date.parse(date))) throw new Error('invalid_date');
    return { entity, key, revision: Number(event.revision), occurred_at: date, record };
  });
  return { events, state: String(input.state) };
}
