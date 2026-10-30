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
if __name__=='__main__':unittest.main()
