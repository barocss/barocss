from pathlib import Path
import json,hashlib
p=json.loads(Path('/tmp/d331/final-source/profile.json').read_text())
for e in p['files']:
 b=Path(e['path']).read_bytes();assert len(b)==e['bytes'] and hashlib.sha256(b).hexdigest()==e['sha256'],e['path']
print('Frozen drawing sources and selected browser inputs unchanged')
