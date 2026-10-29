import test from 'node:test'
import assert from 'node:assert/strict'
import {previousContactOrigin} from '../src/lib/conversationOrigin.ts'
const row=(id:string,at:string,contact='A',identified=false)=>({entity:'messages',entity_key:id,occurred_at:at,payload:{contact_id:contact,source_status:identified?'Identificada':'Não identificada'}})
test('returning messages show latest prior proof without changing their attribution',()=>{
 const message=row('now','2026-10-29T15:00:00Z')
 const earlier=row('earlier','2026-10-29T10:00:00Z','A',true)
 const latest=row('latest','2026-10-29T14:00:00Z','A',true)
 assert.equal(previousContactOrigin(message,[earlier,latest]),latest)
 assert.equal(message.payload.source_status,'Não identificada')
 assert.equal(previousContactOrigin(message,[row('future','2026-10-30T10:00:00Z','A',true),row('other','2026-10-29T10:00:00Z','B',true)]),null)
 assert.equal(previousContactOrigin({...message,payload:{...message.payload,source_status:'Identificada'}},[earlier]),null)
 assert.equal(previousContactOrigin({...message,occurred_at:'invalid'},[earlier]),null)
})
