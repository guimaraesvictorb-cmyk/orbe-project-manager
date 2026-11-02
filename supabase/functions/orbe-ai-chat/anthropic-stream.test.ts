import {normalizeAnthropicStream} from './anthropic-stream.ts';
function assert(value:unknown):asserts value{if(!value)throw new Error('assertion failed');}
Deno.test('stream preserves split UTF8 and its final unterminated frame and reports output truncation',async()=>{
 const encoded=new TextEncoder().encode('data: '+JSON.stringify({type:'content_block_delta',delta:{type:'text_delta',text:'Matrícula — fonte'}})+'\n\ndata: '+JSON.stringify({type:'message_delta',delta:{stop_reason:'max_tokens'}}));
 const input=new ReadableStream<Uint8Array>({start(c){for(let i=0;i<encoded.length;i+=3)c.enqueue(encoded.slice(i,i+3));c.close();}});
 const text=await normalizeAnthropicStream(input,{}).text();assert(text.includes('Matrícula — fonte'));assert(text.includes('"finish_reason":"length"'));assert(text.includes('[DONE]'));
});
Deno.test('provider error contents never enter the client stream',async()=>{
 const input=new ReadableStream<Uint8Array>({start(c){c.enqueue(new TextEncoder().encode('data: '+JSON.stringify({type:'error',error:{message:'SYNTHETIC_PRIVATE_PROVIDER_BODY'}})+'\n'));c.close();}});
 const text=await normalizeAnthropicStream(input,{}).text();assert(!text.includes('SYNTHETIC_PRIVATE'));assert(text.includes('não conseguiu concluir'));assert(text.includes('"finish_reason":"error"'));
});
