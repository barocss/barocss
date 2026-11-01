"""Archive only this slice's generated provider copies, verify bytes, then remove copies.
Raw commands/output remain directly readable. Existing archives are never overwritten.
"""
from pathlib import Path
import hashlib,json,tarfile,shutil
root=Path(__file__).resolve().parent/'evidence'
rows=[]
for run in sorted(root.iterdir()):
    if not run.is_dir(): continue
    for name in ['provider','stage']:
        source=run/name
        if not source.is_dir(): continue
        archive=run/(name+'.tar.gz')
        if archive.exists(): raise RuntimeError('archive already exists: '+str(archive))
        expected={str(p.relative_to(run)):hashlib.sha256(p.read_bytes()).hexdigest() for p in source.rglob('*') if p.is_file()}
        with tarfile.open(archive,'w:gz',compresslevel=1) as tf: tf.add(source,arcname=name)
        with tarfile.open(archive,'r:gz') as tf:
            actual={m.name:hashlib.sha256(tf.extractfile(m).read()).hexdigest() for m in tf.getmembers() if m.isfile()}
        if actual!=expected: raise RuntimeError('archive content differs')
        record={'run':run.name,'originalDirectory':name,'archive':archive.name,'files':len(expected),'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'verifiedFileHashes':expected}
        (run/(name+'-archive.json')).write_text(json.dumps(record,indent=2)+'\n')
        rows.append({k:v for k,v in record.items() if k!='verifiedFileHashes'})
        shutil.rmtree(source)
print(json.dumps(rows))
