"""Hash and archive existing files only. No compiler, reference, Physics or browser execution."""
from pathlib import Path
import json,hashlib,tarfile,io,math
ROOT=Path(__file__).resolve().parents[2]
HOME=Path(__file__).resolve().parent
CAP=16777216

def pin(p):
    b=p.read_bytes()
    return {'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def write(name,value):
    with (HOME/name).open('x') as f:json.dump(value,f,indent=2,ensure_ascii=False);f.write('\n')
def info(name,size):
    t=tarfile.TarInfo(name);t.size=size;t.mode=0o644;t.uid=t.gid=0;t.mtime=0
    return t

def length(rows):
    n=sum(len(info(x['member'],x['bytes']).tobuf(format=tarfile.PAX_FORMAT))+512*((x['bytes']+511)//512) for x in rows)+1024
    return 10240*((n+10239)//10240)
def split(rows,prefix):
    groups=[];current=[]
    for row in rows:
        if length(current+[row])>CAP:
            if not current:raise ValueError('Single member exceeds immutable tar cap '+row['member'])
            groups.append(current);current=[]
        current.append(row)
    if current:groups.append(current)
    return [(f'{prefix}-{i+1:02d}.tar',r) for i,r in enumerate(groups)]

author=HOME/'AUTHOR-FREEZE-03.json';frozen=json.loads(author.read_text());source=[]
for name,p in sorted(frozen['files'].items()):
    actual=pin(ROOT/name)
    if actual!=p:raise ValueError('Current AUTHOR03 frozen input drift '+name)
    source.append({'member':name,'sourcePath':name,**actual})
source.append({'member':str(author.relative_to(ROOT)),'sourcePath':str(author.relative_to(ROOT)),**pin(author)})
proofPaths=set()
for folder in [HOME/'output/build-01',HOME/'evidence',HOME/'recovery',ROOT/'output/playwright/coupled-viewer/desktop-01']:
    proofPaths.update(p for p in folder.rglob('*') if p.is_file())
for name in ['coupled-viewer-build-01','coupled-viewer-desktop-01','coupled-viewer-physics-audit-01']:
    proofPaths.update(p for p in (ROOT/'examples/physics-world-p5-2276/evidence'/name).rglob('*') if p.is_file())
for name in ['AUTHOR-FREEZE-01.json','AUTHOR-FREEZE-02.json','AUTHOR-FREEZE-03.json','AUTHOR-FREEZE-04.json','RESULTS.md','RESULTS.json','HANDOFF-RESULTS.md','package-evidence.py']:
    proofPaths.add(HOME/name)
proof=[{'member':str(p.relative_to(ROOT)),'sourcePath':str(p.relative_to(ROOT)),**pin(p)} for p in sorted(proofPaths)]
groups=split(source,'SOURCE')+split(proof,'PROOF')
plan={'status':'FORECAST_BEFORE_ARCHIVE_CREATION','perUncompressedTarLimitBytes':CAP,'archiveFormat':'PAX_UNCOMPRESSED_REGULAR_FILES_NO_HARDLINKS','sourceFrozenInputCount':len(frozen['files']),'sourceInputBytes':sum(x['bytes'] for x in source),'proofInputBytes':sum(x['bytes'] for x in proof),'parts':[{'file':n,'logicalMembers':len(rows),'contentBytes':sum(x['bytes'] for x in rows),'predictedActualTarBytes':length(rows)} for n,rows in groups]}
plan['aggregatePredictedTarBytes']=sum(x['predictedActualTarBytes'] for x in plan['parts']);write('ARCHIVE-FORECAST.json',plan)
archives=[]
for name,rows in groups:
    target=HOME/name
    if target.exists():raise ValueError('Archive destination exists '+name)
    with tarfile.open(target,'w',format=tarfile.PAX_FORMAT) as tar:
        for row in rows:
            data=(ROOT/row['sourcePath']).read_bytes()
            if {'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}!={k:row[k] for k in ['bytes','sha256']}:raise ValueError('Archive source drift')
            tar.addfile(info(row['member'],len(data)),io.BytesIO(data))
    actual=pin(target)
    if actual['bytes']!=length(rows) or actual['bytes']>CAP:raise ValueError('Actual uncompressed tar forecast/bound mismatch')
    archives.append({'file':name,**actual,'logicalMembers':len(rows),'members':rows})
write('EVIDENCE-ARCHIVE.json',{'status':'PACKAGED_EXISTING_SOURCE_AND_EXECUTED_PROOF','executedAuthorFreeze':{'path':str(author.relative_to(ROOT)),**pin(author)},'perUncompressedTarLimitBytes':CAP,'aggregateActualTarBytes':sum(x['bytes'] for x in archives),'aggregateLogicalMembers':sum(x['logicalMembers'] for x in archives),'archiveFormat':'PAX_UNCOMPRESSED_REGULAR_FILES_NO_HARDLINKS','authorshipBoundary':'AUTHOR03 executed. AUTHOR04 withdrawn proposal only. Current1840 source pins unchanged.','recoveryMaps':['recovery/author-03-build-01/index.json','recovery/author-04-proposal-withdrawn/index.json'],'archives':archives})
print(json.dumps({'status':'PACKAGED','parts':[{k:a[k] for k in ['file','bytes','sha256','logicalMembers']} for a in archives],'aggregateActualTarBytes':sum(x['bytes'] for x in archives)}))
