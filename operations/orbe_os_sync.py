"""Read-only SQLite outbox mirror. Independent of the Sheets delivery cursor."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import sys
import tempfile
import urllib.request

ROOT = Path('/opt/orbe/whatsapp')
ENDPOINT = 'https://studio.agenciaorbe.co/api/whatsapp-sync'


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise RuntimeError('redirect_not_allowed')


def private_json(path):
    stat = path.lstat()
    if path.is_symlink() or stat.st_mode & 0o077 or stat.st_uid != os.geteuid():
        raise RuntimeError('private_file_permissions')
    return json.loads(path.read_text())


def atomic_json(path, data):
    fd, temp = tempfile.mkstemp(dir=path.parent, prefix='.os-sync-')
    try:
        with os.fdopen(fd, 'w') as out:
            json.dump(data, out)
            out.flush()
            os.fsync(out.fileno())
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def read_batch(db_path, cursor, visible_text):
    events = []
    last = cursor
    size = 0
    with sqlite3.connect(f'file:{db_path}?mode=ro', uri=True, timeout=10) as db:
        for row in db.execute('SELECT id,entity,entity_key,record FROM outbox WHERE id>? ORDER BY id LIMIT 100', (cursor,)):
            event_id, entity, key, encoded = row
            record = json.loads(encoded)
            for field in ('text', 'first_message', 'last_message'):
                if field in record:
                    record[field] = visible_text(record[field])
            event = {'entity': entity, 'key': key, 'revision': event_id, 'record': record}
            event_size = len(json.dumps(event).encode()) + 2
            if event_size > 450000:
                raise RuntimeError('record_too_large')
            if size + event_size > 450000:
                break
            events.append(event)
            size += event_size
            last = event_id
    return events, last


def send_batch(config, events, state):
    if config['endpoint'] != ENDPOINT:
        raise RuntimeError('unexpected_endpoint')
    body = json.dumps({'version': 1, 'events': events, 'state': state}).encode()
    request = urllib.request.Request(ENDPOINT, data=body, headers={
        'Content-Type': 'application/json', 'Authorization': 'Bearer ' + config['token'],
    }, method='POST')
    with urllib.request.build_opener(NoRedirect).open(request, timeout=40) as response:
        result = json.loads(response.read(8192))
    if result.get('ok') is not True or result.get('accepted') != len(events):
        raise RuntimeError('batch_not_acknowledged')
    return result


def connection_state(config):
    # The instance credential stays on the VPS; it is never sent to Orbe OS.
    env = (ROOT / '.env').read_text()
    matches = re.findall(r'^ORBE_EVOLUTION_INSTANCE_KEY=(.*)$', env, re.M)
    if len(matches) != 1:
        return 'unknown'
    key = matches[0].strip().strip('\"\'')
    if not re.fullmatch(r'[A-Za-z0-9_-]+', config['instance']):
        raise RuntimeError('invalid_instance')
    request = urllib.request.Request('http://127.0.0.1:18080/instance/connectionState/' + config['instance'], headers={'apikey': key})
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            state = json.loads(response.read(8192)).get('instance', {}).get('state')
        return state if state in ('open', 'close', 'connecting') else 'unknown'
    except Exception:
        return 'unknown'


def synchronize(config, cursor_path, db_path, visible_text, sender=send_batch, state='unknown'):
    binding = hashlib.sha256((config['endpoint'] + config['connection_id']).encode()).hexdigest()
    checkpoint = private_json(cursor_path) if cursor_path.exists() else {'cursor': 0, 'binding': binding}
    if checkpoint.get('binding') != binding:
        raise RuntimeError('checkpoint_connection_mismatch')
    events, last = read_batch(db_path, checkpoint['cursor'], visible_text)
    for event in events:
        record = event['record']
        if record.get('instance') != config['instance'] or (event['entity'] == 'clicks' and record.get('destination') != config['destination']):
            raise RuntimeError('record_connection_mismatch')
    result = sender(config, events, state)
    # A failed request leaves the old cursor intact. Replays are safe at the receiver.
    atomic_json(cursor_path, {'binding': binding, 'cursor': last})
    return {'events': len(events), 'changed': result['changed'], 'cursor': last, 'state': state}


def main():
    os.umask(0o077)
    if os.geteuid() != 0 or Path.cwd() != ROOT:
        raise RuntimeError('run_from_orbe_root')
    private = ROOT / 'private'
    lock = os.open(private / 'orbe-os-sync.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        config = private_json(private / 'orbe-os-integration.json')
        sys.path.insert(0, str(ROOT / 'tracker'))
        from reference_codec import visible_text
        result = synchronize(config, private / 'orbe-os-checkpoint.json', ROOT / 'data/tracker/tracker.sqlite3', visible_text, state=connection_state(config))
        print(json.dumps(result))
    finally:
        os.close(lock)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # No request body, phone, credential, URL query or traceback in system logs.
        print('ORBE_OS_SYNC_FAILED ' + type(exc).__name__, file=sys.stderr)
        sys.exit(1)
