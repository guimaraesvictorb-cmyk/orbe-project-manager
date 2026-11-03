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
 def test_outgoing_envelope_keeps_direction_without_private_media(self):
  value=self.event();value['data']['key']['fromMe']=True
  clean=module.sanitized_event(value,'orbe-qr-lk-lucas');self.assertTrue(clean['data']['key']['fromMe']);self.assertNotIn('secret',json.dumps(clean))
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
class QRRecoveryTest(unittest.TestCase):
 def worker(self, folder, status='qr', active=False):
  from datetime import datetime, timezone, timedelta
  worker=module.Worker({'token':'synthetic'},'',str(Path(folder)/'queue.sqlite3'))
  session={'instance':'orbe-qr-test','destination':'','request_id':'request','expires_at':(datetime.now(timezone.utc)+timedelta(minutes=2 if active else -2)).isoformat(),'verified_at':None,'status':status}
  worker.cloud=lambda action,**values:session if action=='worker_poll' else {'ok':True,'verified_at':None}
  worker.instances=lambda:[{'name':'orbe-qr-test','ownerJid':'5511999999999@s.whatsapp.net'}]
  return worker
 def test_already_linked_device_recovers_after_qr_deadline(self):
  with tempfile.TemporaryDirectory() as folder:
   worker=self.worker(folder);states=[];hooks=[]
   worker.evo=lambda *a,**k:{'instance':{'state':'open'}}
   worker.state=lambda status,**values:(states.append(status),setattr(worker,'last_status',status))
   worker.webhook=lambda enabled:hooks.append(enabled);worker.flush=lambda:None
   worker.tick();self.assertEqual(states,['open']);self.assertEqual(hooks,[True])
 def test_expired_closed_device_does_not_generate_another_qr(self):
  with tempfile.TemporaryDirectory() as folder:
   worker=self.worker(folder);states=[]
   def evo(path,*a,**k):
    self.assertNotIn('/connect/',path);return {'instance':{'state':'close'}}
   worker.evo=evo;worker.state=lambda status,**values:states.append(status)
   worker.tick();self.assertEqual(states,['close'])
 def test_disconnect_targets_only_the_current_instance_before_acknowledging(self):
  with tempfile.TemporaryDirectory() as folder:
   worker=self.worker(folder,'disconnecting');calls=[];states=[]
   def evo(path,body=None,**kwargs):
    calls.append((path,kwargs.get('method')))
    return {'instance':{'state':'close' if any(method=='DELETE' for _,method in calls) else 'open'}}
   worker.evo=evo;worker.webhook=lambda enabled:self.assertFalse(enabled)
   worker.state=lambda status,**values:states.append(status)
   worker.flush=lambda:self.fail('must not flush after disconnect')
   worker.tick();self.assertIn(('/instance/logout/orbe-qr-test','DELETE'),calls);self.assertEqual(states,['close'])
 def test_failed_verification_cannot_enable_webhook(self):
  with tempfile.TemporaryDirectory() as folder:
   worker=self.worker(folder);worker.evo=lambda *a,**k:{'instance':{'state':'open'}}
   worker.state=lambda *a,**k:(_ for _ in ()).throw(ConnectionError())
   worker.webhook=lambda enabled:self.fail('unverified webhook enabled')
   with self.assertRaises(ConnectionError):worker.tick()

if __name__=='__main__':unittest.main()
