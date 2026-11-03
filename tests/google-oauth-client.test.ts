import test from 'node:test'
import assert from 'node:assert/strict'
import {parseWebOAuthClient,studioGoogleCallback} from '../src/lib/googleOAuthClient.ts'
test('Studio only imports a web OAuth client bound to its exact callback',()=>{
 const web={client_id:'synthetic.apps.googleusercontent.com',client_secret:'SYNTHETIC_SECRET_NOT_REAL',redirect_uris:[studioGoogleCallback]}
 assert.equal(parseWebOAuthClient(JSON.stringify({web})).clientId,web.client_id)
 assert.throws(()=>parseWebOAuthClient(JSON.stringify({installed:web})),/computador/)
 assert.throws(()=>parseWebOAuthClient(JSON.stringify({web:{...web,redirect_uris:['https://another.example/callback']}})),/URL de retorno/)
 assert.throws(()=>parseWebOAuthClient(JSON.stringify({type:'service_account'})),/conta de serviço/)
})
