import {object,references,scalar,visibleText} from './kommo.js';
/** Only a normalized, direct inbound message survives. Raw envelopes are never stored. */
export function evolutionMessage(raw:unknown,instance:string) {
 const envelope=object(raw);
 if(envelope.instance!==instance||envelope.event!=='messages.upsert')return null;
 const data=object(envelope.data),key=object(data.key);
 if(key.fromMe!==false||key.participant||key.participantAlt||data.isHistory||data.isHistorySync||['append','history','set'].includes(String(data.type)))return null;
 let jid=scalar(key.remoteJid,100);if(jid.endsWith('@lid'))jid=scalar(key.remoteJidAlt??'',100);
 if(!/^[1-9][0-9]{9,14}@(s\.whatsapp\.net|c\.us)$/.test(jid))return null;
 const id=scalar(key.id,200);if(!/^[A-Za-z0-9_.:-]{1,200}$/.test(id))return null;
 const stamp=Number(data.messageTimestamp);if(!Number.isSafeInteger(stamp)||stamp<1||stamp>Date.now()/1000+120)return null;
 let content=object(data.message);
 for(let i=0;i<3;i++){const w=['ephemeralMessage','viewOnceMessage','viewOnceMessageV2','viewOnceMessageV2Extension'].find(k=>content[k]);if(!w)break;content=object(object(content[w]).message);}
 if(['protocolMessage','reactionMessage','pollUpdateMessage','editedMessage'].some(k=>content[k]))return null;
 let text:unknown=content.conversation,type='text';
 if(text===undefined&&content.extendedTextMessage)text=object(content.extendedTextMessage).text??'';
 if(text===undefined)for(const kind of ['image','video','audio','document','sticker','location','contact'])if(content[`${kind}Message`]){text=object(content[`${kind}Message`]).caption??'';type=kind;break;}
 if(text===undefined)return null;
 const message=scalar(text,16000),refs=references(message);
 return {id,phone:jid.split('@')[0],name:scalar(data.pushName??'',160),text:visibleText(message),type,created_at:new Date(stamp*1000).toISOString(),reference:refs.length===1?refs[0]:''};
}
