export const studioGoogleCallback='https://studio.agenciaorbe.co/api/google-ads-oauth'
export function parseWebOAuthClient(text:string) {
 let data
 try{data=JSON.parse(text)}catch{throw new Error('O arquivo não é um JSON válido. Exporte novamente o cliente OAuth do Google.')}
 if(data?.installed)throw new Error('Este JSON é de um aplicativo para computador. O Studio precisa de um cliente do tipo Aplicativo da Web, com a URL de retorno cadastrada.')
 const client=data?.web
 if(!client||data?.type==='service_account')throw new Error('Use o JSON de um cliente OAuth do tipo Aplicativo da Web, não uma chave de conta de serviço.')
 if(typeof client.client_id!=='string'||!/^[A-Za-z0-9._-]{5,220}\.apps\.googleusercontent\.com$/.test(client.client_id)||typeof client.client_secret!=='string'||client.client_secret.length<10||client.client_secret.length>4096||/\s/.test(client.client_secret))throw new Error('Arquivo OAuth inválido.')
 if(!Array.isArray(client.redirect_uris)||!client.redirect_uris.includes(studioGoogleCallback))throw new Error(`Cadastre esta URL de retorno no cliente Web e baixe o JSON novamente: ${studioGoogleCallback}`)
 return {clientId:client.client_id,clientSecret:client.client_secret}
}
