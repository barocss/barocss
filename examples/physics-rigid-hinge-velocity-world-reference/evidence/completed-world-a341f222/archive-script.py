from pathlib import Path
import gzip,hashlib,json,shutil
base=Path('/tmp/physics-1179-world-continuation-a341f222')
out=Path('/tmp/physics-1179-world-terminal-archive-a341f222')
manifest=json.loads((out/'source-archive.json').read_text())
entries=[]
for e in manifest['files']:
 p=base/'source-proof'/e['source']
 assert hashlib.sha256(p.read_bytes()).hexdigest()==e['sourceSha256']
 entries.append({'original':'run/source-proof/'+e['source'],'archive':'source-proof/'+e['archive'],**{k:v for k,v in e.items() if k not in ('source','archive')}})
inputs=[(p,'run/'+str(p.relative_to(base))) for p in sorted(base.rglob('*')) if p.is_file() and 'source-proof' not in p.relative_to(base).parts]
for folder,label in [(Path('/tmp/physics-1179-world-continuation-launch-a341f222'),'launch'),(Path('/tmp/physics-1179-world-continuation-gates-a341f222'),'syntax')]:
 inputs.extend((p,label+'/'+str(p.relative_to(folder))) for p in sorted(folder.rglob('*')) if p.is_file())
for p,name in inputs:
 data=p.read_bytes();rel=name+('.gz' if len(data)>1048576 else '')
 dest=out/rel;dest.parent.mkdir(parents=True,exist_ok=True)
 assert not dest.exists()
 dest.write_bytes(gzip.compress(data,compresslevel=6,mtime=0) if rel.endswith('.gz') else data)
 restored=gzip.decompress(dest.read_bytes()) if rel.endswith('.gz') else dest.read_bytes()
 assert restored==data
 entries.append({'original':name,'archive':rel,'sourceBytes':len(data),'sourceSha256':hashlib.sha256(data).hexdigest(),'archiveBytes':dest.stat().st_size,'archiveSha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'decompressedBytes':len(restored),'decompressedSha256':hashlib.sha256(restored).hexdigest(),'byteExact':True})
result={'consumerHead':'a341f2224ac4bd0b1167f4a9059ab32ab331aac2','sourceFreezeSha256':'f25d064ebb082e556202491000f545f41726eef3c8e426a1452a66814e6d7954','emittedLedgerSha256':'00d78b5e5cf8d60ae77efb69eb520e9578b436009cd5f3815f3a894a83e9cad7','runtimeBudgetSeparate':True,'graphCount':3,'allGraphDisposition':'HINGE2_WORLD_GO','entries':entries,'originalBytes':sum(e['sourceBytes'] for e in entries),'archiveBytes':sum(e['archiveBytes'] for e in entries)}
(out/'manifest.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='entries'}));print('entries',len(entries),'manifestSha256',hashlib.sha256((out/'manifest.json').read_bytes()).hexdigest())
