from pathlib import Path
import os,json,re,secrets,hashlib
root=Path('/opt/orbe/whatsapp');os.umask(0o077)
folder=root/'private/qr-broker';folder.mkdir(mode=0o700,exist_ok=True)
path=folder/'config.json'
if not path.exists():
 legacy=json.loads((root/'private/qr-lk/config.json').read_text())['token']
 path.write_text(json.dumps({'token':secrets.token_urlsafe(48),'legacy_tokens':{'c9503338-e251-42ee-8dfa-c0378fab7410':legacy}}));path.chmod(0o600)
e={m.group(1):m.group(2).strip().strip('\"\'') for m in re.finditer(r'^([A-Z_]+)=(.*)$',(root/'.env').read_text(),re.M)}
key_path=folder/'evolution-key';key_path.write_text(e['ORBE_EVOLUTION_API_KEY']);key_path.chmod(0o600)
(root/'data/qr-broker').mkdir(mode=0o700,exist_ok=True)
print('BROKER_HASH='+hashlib.sha256(json.loads(path.read_text())['token'].encode()).hexdigest())
