import importlib.util,json,tempfile,unittest,time
from pathlib import Path
spec=importlib.util.spec_from_file_location('qr_worker',Path(__file__).parents[1]/'operations/qr_worker.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class QRWorkerTest(unittest.TestCase):
 def event(self):return {'event':'messages.upsert','instance':'orbe-qr-lk-lucas','apikey':'private','data':{'key':{'id':'A1','fromMe':False,'remoteJid':'5511999999999@s.whatsapp.net'},'messageTimestamp':int(time.time()),'message':{'imageMessage':{'caption':'hello','url':'private-file','mediaKey':'secret'}}}}
 def test_minimizes_sensitive_envelope_before_durable_storage(self):
  value=module.sanitized_event(self.event(),'orbe-qr-lk-lucas');self.assertNotIn('private',json.dumps(value));self.assertNotIn('secret',json.dumps(value));self.assertEqual(value['data']['message']['imageMessage'],{'caption':'hello'})
 def test_rejects_unrelated_tenant_history_and_unresolved_lid(self):
  self.assertIsNone(module.sanitized_event(self.event(),'other'))
  value=self.event();value['data']['isHistory']=True;self.assertIsNone(module.sanitized_event(value,'orbe-qr-lk-lucas'))
  value=self.event();value['data']['key']['remoteJid']='123456789012345@lid';self.assertIsNone(module.sanitized_event(value,'orbe-qr-lk-lucas'))
 def test_failed_delivery_retains_outbox_and_ack_removes_it(self):
  with tempfile.TemporaryDirectory() as tmp:
   worker=module.Worker({'token':'test-token'},'',str(Path(tmp)/'outbox.sqlite3'))
   with worker.db() as db:db.execute('INSERT INTO outbox(event) VALUES(?)',(json.dumps(self.event()),))
   worker.cloud=lambda *a,**k: (_ for _ in ()).throw(ConnectionError())
   with self.assertRaises(ConnectionError):worker.flush()
   with worker.db() as db:self.assertEqual(db.execute('SELECT count(*) FROM outbox').fetchone()[0],1)
   worker.cloud=lambda *a,**k:{'ok':True}
   worker.flush()
   with worker.db() as db:self.assertEqual(db.execute('SELECT count(*) FROM outbox').fetchone()[0],0)
 def test_first_pairing_discovers_number_without_preregistration(self):
  with tempfile.TemporaryDirectory() as tmp:
   worker=module.Worker({'token':'synthetic'},'',str(Path(tmp)/'queue.sqlite3'))
   from datetime import datetime,timezone,timedelta
   session={'instance':'orbe-qr-test','destination':'','request_id':'request','expires_at':(datetime.now(timezone.utc)+timedelta(minutes=2)).isoformat(),'verified_at':None,'status':'qr'}
   calls=[]
   def cloud(action,**values):
    calls.append((action,values))
    return session if action=='worker_poll' else {'ok':True,'verified_at':'2026-10-30T20:00:00Z','destination':'5511999999999'}
   worker.cloud=cloud;worker.instances=lambda:[{'name':'orbe-qr-test','ownerJid':'5511999999999@s.whatsapp.net'}]
   worker.evo=lambda *a,**k:{'instance':{'state':'open'}}
   hooks=[];worker.webhook=lambda enabled:hooks.append(enabled);worker.flush=lambda:None
   worker.tick()
   self.assertEqual(worker.session['destination'],'5511999999999');self.assertEqual(hooks,[True])
   self.assertTrue(any(a=='worker_state' and v.get('number')=='5511999999999' for a,v in calls))
if __name__=='__main__':unittest.main()
