#!/usr/bin/env python3
"""One-time LK provisioning on ORBE VPS. Global key stays on this host only."""
from pathlib import Path
import hashlib,hmac,json,os,re,urllib.request,urllib.error
ROOT=Path('/opt/orbe/whatsapp')
os.umask(0o077)
config=json.loads((ROOT/'private/qr-lk/config.json').read_text())
values={m.group(1):m.group(2).strip().strip('\"\'') for m in re.finditer(r'^([A-Z_]+)=(.*)$',(ROOT/'.env').read_text(),re.M)}
key=values['ORBE_EVOLUTION_API_KEY'];instance='orbe-qr-lk-lucas'
instance_key=hmac.new(config['token'].encode(),b'evolution-instance',hashlib.sha256).hexdigest()
webhook_key=hmac.new(config['token'].encode(),b'evolution-webhook',hashlib.sha256).hexdigest()
def call(path,body=None,token=key):
 r=urllib.request.Request('http://127.0.0.1:18080'+path,data=None if body is None else json.dumps(body).encode(),headers={'apikey':token,'Content-Type':'application/json'})
 with urllib.request.urlopen(r,timeout=20) as res:return json.load(res)
try:rows=call('/instance/fetchInstances?instanceName='+instance)
except urllib.error.HTTPError as e:
 if e.code!=404:raise
 rows=[]
webhook={'enabled':False,'url':'http://orbe-qr-worker:8090/events','headers':{'Authorization':'Bearer '+webhook_key},'byEvents':False,'base64':False,'events':['MESSAGES_UPSERT','CONNECTION_UPDATE']}
if not rows:
 call('/instance/create',{'instanceName':instance,'integration':'WHATSAPP-BAILEYS','token':instance_key,'qrcode':False,'groupsIgnore':True,'alwaysOnline':False,'readMessages':False,'readStatus':False,'syncFullHistory':False,'rejectCall':False,'webhook':webhook})
 call('/webhook/set/'+instance,{'webhook':webhook},instance_key)
rows=call('/instance/fetchInstances?instanceName='+instance,token=instance_key)
assert len(rows)==1 and rows[0]['name']==instance
print('ORBE_LK_INSTANCE_PREPARED')
