from pathlib import Path
import json,hashlib,time,datetime,gzip
p=json.loads(Path('/tmp/d330/final-source/profile.json').read_text());states={};out=Path('/tmp/d330/source-watch');out.mkdir(exist_ok=True)
while True:
 for e in p['files']+p.get('executedInputs',[]):
  f=Path(e['path']);s=f.stat();stamp=(s.st_mtime_ns,s.st_size,s.st_ino)
  if states.get(e['path'])!=stamp:
   b=f.read_bytes();digest=hashlib.sha256(b).hexdigest();r={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'path':e['path'],'expected':e['sha256'],'actual':digest,'matches':digest==e['sha256'],'metadata':stamp}
   with (out/'events.jsonl').open('a') as log:log.write(json.dumps(r)+'\n')
   if not r['matches']:(out/(f.name+'.drift.gz')).write_bytes(gzip.compress(b))
   states[e['path']]=stamp
 time.sleep(.5)
