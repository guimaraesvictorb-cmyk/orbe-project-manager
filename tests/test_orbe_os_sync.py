import importlib.util
import json
import pathlib
import sqlite3
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('bridge', pathlib.Path(__file__).parents[1] / 'operations/orbe_os_sync.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class BridgeTests(unittest.TestCase):
    def test_replay_cursor_and_failure_preserve_source(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            db = root / 'tracker.sqlite3'
            with sqlite3.connect(db) as conn:
                conn.execute('CREATE TABLE outbox(id integer,entity text,entity_key text,record text,acked_at integer)')
                conn.execute('INSERT INTO outbox VALUES(1,?,?,?,99)', ('messages', 'm1', json.dumps({'instance':'pilot','text':'Olá|marker|'})))
            before = db.read_bytes()
            config = {'endpoint':bridge.ENDPOINT,'connection_id':'one','instance':'pilot','destination':'5511'}
            checkpoint = root / 'checkpoint.json'
            def fail(*args):
                raise RuntimeError('network')
            with self.assertRaises(RuntimeError):
                bridge.synchronize(config, checkpoint, db, lambda t:t, sender=fail)
            self.assertFalse(checkpoint.exists())
            def success(config, events, state):
                self.assertEqual(events[0]['record']['text'], 'Olá')
                self.assertEqual(events[0]['revision'], 1)
                return {'changed': 1}
            bridge.synchronize(config, checkpoint, db, lambda t:t.replace('|marker|',''), sender=success)
            self.assertEqual(bridge.private_json(checkpoint)['cursor'], 1)
            def heartbeat(config, events, state):
                self.assertEqual(events, [])
                return {'changed':0}
            bridge.synchronize(config, checkpoint, db, lambda t:t, sender=heartbeat)
            self.assertEqual(db.read_bytes(), before)
            config['connection_id']='other'
            with self.assertRaisesRegex(RuntimeError,'checkpoint_connection_mismatch'):
                bridge.synchronize(config, checkpoint, db, lambda t:t, sender=heartbeat)

    def test_cross_connection_blocked_before_send(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            db = root / 'tracker.sqlite3'
            with sqlite3.connect(db) as conn:
                conn.execute('CREATE TABLE outbox(id integer,entity text,entity_key text,record text)')
                conn.execute('INSERT INTO outbox VALUES(1,?,?,?)',('clicks','c1',json.dumps({'instance':'wrong','destination':'5511'})))
            config={'endpoint':bridge.ENDPOINT,'connection_id':'one','instance':'pilot','destination':'5511'}
            with self.assertRaisesRegex(RuntimeError,'record_connection_mismatch'):
                bridge.synchronize(config,root/'cursor.json',db,lambda t:t,sender=lambda *args:self.fail('Must not send'))

if __name__ == '__main__':
    unittest.main()
