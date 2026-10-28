"""Apply the narrow, reviewed click-ID change to the existing ORBE tracker."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import time

ROOT=Path('/opt/orbe/whatsapp')


def main():
    assert Path.cwd()==ROOT and os.geteuid()==0
    source=ROOT/'tracker/app.py'
    assert not source.is_symlink()
    original=source.read_text()
    assert 'CLICK_ID_FIELDS =' not in original, 'already_applied_or_changed'
    text=original
    for old,new in json.loads((ROOT/'operations/tracker-click-ids.patch.json').read_text()):
        assert text.count(old)==1, 'unexpected_source'
        text=text.replace(old,new,1)
    compile(text,str(source),'exec')
    containers=subprocess.check_output(['docker','ps','-q','--filter','label=com.docker.compose.project=orbe-whatsapp','--filter','label=com.docker.compose.service=tracker'],text=True).split()
    assert len(containers)==1, 'tracker_not_unique'
    container=containers[0]
    backup=ROOT/'backups'/('click-ids-'+str(int(time.time())))
    backup.mkdir(parents=True,mode=0o700)
    shutil.copy2(source,backup/'app.py')
    with sqlite3.connect(str(ROOT/'data/tracker/tracker.sqlite3')) as db:
        with sqlite3.connect(str(backup/'tracker.sqlite3')) as dest:db.backup(dest)
    (backup/'tracker.sqlite3').chmod(0o600)
    temp=source.with_suffix('.click-ids-new')
    temp.write_text(text);temp.chmod(0o644);temp.replace(source)
    try:
        subprocess.run(['docker','restart','-t','20',container],check=True,stdout=subprocess.DEVNULL,timeout=45)
        check="import urllib.request,json; r=json.load(urllib.request.urlopen('http://127.0.0.1:8080/healthz',timeout=5)); assert r['status']=='ok'"
        for attempt in range(4):
            try:
                result=subprocess.run(['docker','exec',container,'python','-c',check],capture_output=True,timeout=45)
            except subprocess.TimeoutExpired:
                continue
            if result.returncode==0:break
            time.sleep(1)
        else:raise RuntimeError('health_failed')
    except Exception:
        shutil.copy2(backup/'app.py',source)
        subprocess.run(['docker','restart','-t','20',container],check=True,stdout=subprocess.DEVNULL,timeout=45)
        raise
    print('CLICK_IDS_DEPLOYED',hashlib.sha256(text.encode()).hexdigest(),'backup='+str(backup))


if __name__=='__main__':main()
