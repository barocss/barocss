from pathlib import Path
import json,hashlib
p=json.loads(Path('/tmp/d330/final-source/profile.json').read_text())
for e in p['files']+p.get('executedInputs',[]):
 b=Path(e['path']).read_bytes();assert len(b)==e['bytes'] and hashlib.sha256(b).hexdigest()==e['sha256'],e['path']
print('Frozen production3 and executed driver/fixture4 unchanged')
