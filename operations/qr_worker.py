#!/usr/bin/env python3
"""Scoped QR worker. No public management API; private local webhook + durable outbox.
Runs on the existing ORBE Docker network, separately from the personal pilot.
"""
import hashlib
import hmac
import json
import os
from pathlib import Path
import sqlite3
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, build_opener, HTTPRedirectHandler

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

def call(url, token, body=None, method=None):
    headers={'Content-Type':'application/json'}
    headers.update({'apikey':token} if url.startswith('http://evolution:8080/') else {'Authorization':'Bearer '+token})
    request=Request(url, data=None if body is None else json.dumps(body).encode(), headers=headers,method=method)
    with build_opener(NoRedirect()).open(request,timeout=15) as response:
        return json.load(response)

def sanitized_event(value, instance):
    """Strip global API key, URL, profile and irrelevant data before persisting."""
    if not isinstance(value,dict) or value.get('instance')!=instance or value.get('event')!='messages.upsert': return None
    data=value.get('data',{});key=data.get('key',{})
    if key.get('fromMe') is not False or key.get('participant') or key.get('participantAlt'): return None
    if data.get('isHistory') or data.get('isHistorySync') or data.get('type') in ('append','history','set'): return None
    jid=key.get('remoteJid','')
    if jid.endswith('@lid'): jid=key.get('remoteJidAlt','')
    import re
    if not re.fullmatch(r'[1-9][0-9]{9,14}@(s\.whatsapp\.net|c\.us)',jid): return None
    stamp=int(data.get('messageTimestamp',0))
    if stamp<time.time()-3600 or stamp>time.time()+120:return None
    content=data.get('message',{})
    for _ in range(3):
        wrapped=next((content.get(k) for k in ('ephemeralMessage','viewOnceMessage','viewOnceMessageV2','viewOnceMessageV2Extension') if k in content),None)
        if wrapped is None:break
        content=wrapped.get('message',{})
    clean={}
    if isinstance(content.get('conversation'),str):clean['conversation']=content['conversation'][:16000]
    elif isinstance(content.get('extendedTextMessage'),dict):clean['extendedTextMessage']={'text':str(content['extendedTextMessage'].get('text',''))[:16000]}
    else:
        for kind in ('image','video','audio','document','sticker','location','contact'):
            if isinstance(content.get(kind+'Message'),dict):clean[kind+'Message']={'caption':str(content[kind+'Message'].get('caption',''))[:16000]};break
    if any(k in content for k in ('protocolMessage','reactionMessage','pollUpdateMessage','editedMessage')):return None
    if not clean:return None
    return {'instance':instance,'event':'messages.upsert','data':{'key':{'fromMe':False,'remoteJid':jid,'id':str(key.get('id',''))[:200]},'messageTimestamp':stamp,'pushName':str(data.get('pushName',''))[:160],'message':clean}}

class Worker:
    def __init__(self, config, global_key, db_path):
        self.config=config;self.global_key=global_key;self.lock=threading.Lock();self.db_path=db_path
        self.instance_key=hmac.new(config['token'].encode(),b'evolution-instance',hashlib.sha256).hexdigest()
        self.webhook_key=hmac.new(config['token'].encode(),b'evolution-webhook',hashlib.sha256).hexdigest()
        self.instance=None;self.session=None;self.last_status=None
        with self.db() as db: db.execute('CREATE TABLE IF NOT EXISTS outbox (id INTEGER PRIMARY KEY,event TEXT NOT NULL)')
    def db(self):return sqlite3.connect(self.db_path,timeout=10)
    def cloud(self,action,**values):return call('https://studio.agenciaorbe.co/api/whatsapp-qr',self.config['token'],{'action':action,**values})
    def evo(self,path,body=None,global_key=False):return call('http://evolution:8080'+path,self.global_key if global_key else self.instance_key,body)
    def webhook(self,enabled):
        self.evo('/webhook/set/'+self.instance,{'webhook':{'enabled':enabled,'url':'http://orbe-qr-worker:8090/events','headers':{'Authorization':'Bearer '+self.webhook_key},'byEvents':False,'base64':False,'events':['MESSAGES_UPSERT','CONNECTION_UPDATE']}})
    def state(self,status,**values):
        result=self.cloud('worker_state',request_id=self.session['request_id'],status=status,**values)
        if result.get('ok'):
            self.last_status=status
            if result.get('verified_at'):self.session['verified_at']=result['verified_at']
    def instances(self):return self.evo('/instance/fetchInstances?instanceName='+self.instance)
    def tick(self):
        self.session=self.cloud('worker_poll');self.instance=self.session['instance']
        if not self.instance.startswith('orbe-qr-'):raise ValueError('invalid_instance')
        request_id=self.session.get('request_id')
        if not request_id:return
        from datetime import datetime
        active=bool(self.session.get('expires_at')) and datetime.fromisoformat(self.session['expires_at'].replace('Z','+00:00')).timestamp()>time.time()
        if not active and not self.session.get('verified_at'):return
        rows=self.instances()
        if not rows:raise ValueError('instance_not_prepared')
        if len(rows)!=1 or rows[0].get('name')!=self.instance:raise ValueError('instance_binding')
        state=self.evo('/instance/connectionState/'+self.instance).get('instance',{}).get('state')
        if state=='open':
            number=str(rows[0].get('ownerJid','')).split('@')[0].split(':')[0]
            if number!=self.session['destination']:
                self.webhook(False)
                if self.session['status']=='requested':
                    self.evo('/instance/logout/'+self.instance,{},False)
                    self.state('connecting')
                else:self.state('wrong_number')
                return
            # Commit number verification before accepting any message events.
            self.state('open',number=number)
            if self.last_status=='open': self.webhook(True)
            self.flush()
        elif active:
            qr=self.evo('/instance/connect/'+self.instance)
            if qr.get('base64'):self.state('qr',qr=qr['base64'])
            else:self.state('connecting')
        else:
            self.state('close')
    def flush(self):
        with self.db() as db:rows=db.execute('SELECT id,event FROM outbox ORDER BY id LIMIT 30').fetchall()
        if not rows:return
        result=self.cloud('worker_messages',events=[json.loads(row[1]) for row in rows])
        if result.get('ok'):
            with self.db() as db:db.executemany('DELETE FROM outbox WHERE id=?',[(row[0],) for row in rows])
    def receive(self,value):
        if not self.session or not self.session.get('verified_at') or self.last_status!='open':return
        event=sanitized_event(value,self.instance)
        if event and self.session.get('capture_mode')=='pilot' and event['data']['key']['remoteJid'].split('@')[0] not in self.session.get('allowed_senders',[]):return
        if event:
            with self.db() as db:
                if db.execute('SELECT count(*) FROM outbox').fetchone()[0]>10000:raise ValueError('outbox_full')
                db.execute('INSERT INTO outbox(event) VALUES(?)',(json.dumps(event),))
    def run(self):
        while True:
            try:self.tick()
            except Exception:
                # Do not log bodies, API keys, QR contents or private contact data.
                print('ORBE_QR_RETRY',flush=True)
            time.sleep(5)

def main():
    os.umask(0o077)
    config=json.loads(Path('/private/qr-lk.json').read_text())
    worker=Worker(config,'','/data/outbox.sqlite3')
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def do_POST(self):
            try:
                if self.path!='/events' or not hmac.compare_digest(self.headers.get('Authorization',''),'Bearer '+worker.webhook_key):self.send_error(403);return
                size=int(self.headers.get('Content-Length','0'))
                if not 0<size<=524288:self.send_error(413);return
                value=json.loads(self.rfile.read(size));worker.receive(value)
                self.send_response(200);self.end_headers();self.wfile.write(b'{"ok":true}')
            except Exception:self.send_error(503)
    threading.Thread(target=worker.run,daemon=True).start()
    ThreadingHTTPServer(('0.0.0.0',8090),Handler).serve_forever()
if __name__=='__main__':main()
