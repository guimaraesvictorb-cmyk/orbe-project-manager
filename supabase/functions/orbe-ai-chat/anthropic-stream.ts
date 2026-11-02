export function normalizeAnthropicStream(body: ReadableStream<Uint8Array>, headers: Record<string,string>) {
  const reader=body.getReader(),decoder=new TextDecoder(),encoder=new TextEncoder();let cancelled=false;
  return new Response(new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer='';
      const emit=(choice:unknown)=>{if(!cancelled)controller.enqueue(encoder.encode(`data: ${JSON.stringify({choices:[choice]})}\n\n`))};
      const line=(value:string)=>{
        if(!value.startsWith('data:'))return;
        try {
          const event=JSON.parse(value.slice(5).trim());
          if(event.type==='content_block_delta'&&event.delta?.type==='text_delta')emit({delta:{content:event.delta.text}});
          if(event.type==='message_delta'&&event.delta?.stop_reason)emit({delta:{},finish_reason:event.delta.stop_reason==='max_tokens'?'length':'stop'});
          if(event.type==='error') { emit({delta:{content:'\n\nA IA não conseguiu concluir esta resposta. Tente novamente.'}});emit({delta:{},finish_reason:'error'}); }
        } catch { /* Ignore incomplete/malformed provider frames, never expose their contents. */ }
      };
      try {
        while(!cancelled) {
          const {value,done}=await reader.read();if(done)break;
          buffer+=decoder.decode(value,{stream:true});
          const lines=buffer.split('\n');buffer=lines.pop()??'';for(const item of lines)line(item);
        }
        buffer+=decoder.decode();if(buffer.trim())line(buffer);
      } catch { if(!cancelled)emit({delta:{content:'\n\nA conexão com a IA foi interrompida. Tente novamente.'}}); }
      finally { if(!cancelled){controller.enqueue(encoder.encode('data: [DONE]\n\n'));controller.close();} }
    },
    async cancel(){cancelled=true;await reader.cancel();},
  }),{headers:{...headers,'content-type':'text/event-stream','cache-control':'no-cache'}});
}
