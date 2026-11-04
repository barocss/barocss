"""Package existing immutable data only. No Physics/compiler/browser/decoder calls."""
from pathlib import Path
import json,hashlib,tarfile,io,gzip
ROOT=Path(__file__).resolve().parents[2];HOME=Path(__file__).resolve().parent;CAP=16777216

def pinbytes(b):return {'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def pin(p):return pinbytes(p.read_bytes())
def put(name,x):
    with (HOME/name).open('x') as f:json.dump(x,f,indent=2,ensure_ascii=False);f.write('\n')
def ti(row):
    t=tarfile.TarInfo(row['member']);t.uid=t.gid=0;t.mtime=0;t.mode=0o644
    if row.get('hardlinkTarget'):t.type=tarfile.LNKTYPE;t.linkname=row['hardlinkTarget'];t.size=0
    else:t.size=row['bytes']
    return t
def charge(row):return len(ti(row).tobuf(format=tarfile.PAX_FORMAT))+(0 if row.get('hardlinkTarget') else 512*((row['bytes']+511)//512))
def rounded(n):return 10240*((n+1024+10239)//10240)
def parts(rows,prefix):
    result=[];current=[];seen={};used=0
    for original in rows:
        row=dict(original);key=(row['sha256'],row['bytes'])
        if key in seen:row['hardlinkTarget']=seen[key]
        size=charge(row)
        if rounded(used+size)>CAP:
            if not current:raise ValueError('Single logical file exceeds cap')
            result.append((f'{prefix}-{len(result)+1:02d}.tar',current,rounded(used)));current=[];seen={};used=0;row=dict(original);size=charge(row)
        if rounded(used+size)>CAP:raise ValueError('Single regular file exceeds cap')
        if key not in seen:seen[key]=row['member']
        current.append(row);used+=size
    if current:result.append((f'{prefix}-{len(result)+1:02d}.tar',current,rounded(used)))
    return result

author=HOME/'AUTHOR-FREEZE-01.json';frozen=json.loads(author.read_text());source=[]
for path,expected in sorted(frozen['files'].items()):
    actual=pin(ROOT/path)
    if actual!=expected:raise ValueError('Frozen source drift '+path)
    source.append({'member':path,'sourcePath':path,**actual})
authorPath=str(author.relative_to(ROOT));source.append({'member':authorPath,'sourcePath':authorPath,**pin(author)})
sourceParts=parts(source,'SOURCE')
recovery={'status':'ALL_FROZEN_WORKSPACE_INPUTS_MATCH','executedAuthor':{'path':authorPath,**pin(author)},'frozenWorkspaceInputs':len(frozen['files']),'installedToolMetadataPins':len(frozen['externalToolFiles']),'externalToolBinariesIncluded':False,'logicalRecovery':[{'archive':name,'logicalPath':row['sourcePath'],'archiveMember':row['member'],'bytes':row['bytes'],'sha256':row['sha256'],'hardlinkTarget':row.get('hardlinkTarget')} for name,rows,size in sourceParts for row in rows]}
put('SOURCE-RECOVERY.json',recovery)
proofPaths=set()
for folder in [HOME/'output/build-01',HOME/'evidence',ROOT/'output/playwright/coupled-lifecycle-viewer/desktop-01']:
    proofPaths.update(p for p in folder.rglob('*') if p.is_file())
for name in ['coupled-lifecycle-viewer-build-01','coupled-lifecycle-viewer-desktop-01','coupled-lifecycle-viewer-physics-audit-01']:
    proofPaths.update(p for p in (ROOT/'examples/physics-world-p5-2276/evidence'/name).rglob('*') if p.is_file())
for name in ['AUTHOR-FREEZE-01.json','RESULTS.md','RESULTS.json','HANDOFF-RESULTS.md','SOURCE-RECOVERY.json','package-evidence.py']:proofPaths.add(HOME/name)
proof=[{'member':str(p.relative_to(ROOT)),'sourcePath':str(p.relative_to(ROOT)),**pin(p)} for p in sorted(proofPaths)]
groups=sourceParts+parts(proof,'PROOF')
forecast={'status':'FORECAST_BEFORE_ARCHIVE_CREATION','perOriginalUncompressedTarCapBytes':CAP,'format':'PAX_TAR_STANDARD_BACKWARD_HARDLINKS_SAME_BYTES_SHA_ONLY','frozenWorkspaceInputCount':len(frozen['files']),'aggregateOriginalLogicalContentBytes':sum(r['bytes'] for n,rows,size in groups for r in rows),'parts':[{'file':name,'logicalMembers':len(rows),'hardlinkMembers':sum(bool(r.get('hardlinkTarget')) for r in rows),'logicalContentBytes':sum(r['bytes'] for r in rows),'storedRegularContentBytes':sum(r['bytes'] for r in rows if not r.get('hardlinkTarget')),'predictedActualTarBytes':size} for name,rows,size in groups],'aggregatePredictedUncompressedTarBytes':sum(size for name,rows,size in groups)}
put('ARCHIVE-FORECAST.json',forecast)
archives=[]
for name,rows,predicted in groups:
    target=HOME/name
    if target.exists():raise ValueError('No archive overwrite')
    with tarfile.open(target,'w',format=tarfile.PAX_FORMAT) as tar:
        for row in rows:
            data=(ROOT/row['sourcePath']).read_bytes()
            if pinbytes(data)!={k:row[k] for k in ['bytes','sha256']}:raise ValueError('Input drift before packaging')
            tar.addfile(ti(row),None if row.get('hardlinkTarget') else io.BytesIO(data))
    actual=pin(target)
    if actual['bytes']!=predicted or actual['bytes']>CAP:raise ValueError('Actual tar exceeds forecast or cap')
    archives.append({'file':name,**actual,'logicalMembers':len(rows),'members':rows})
index={'status':'SEALED_EXISTING_EXECUTED_LIFECYCLE_DESKTOP_PROOF','executedAuthor':{'file':authorPath,**pin(author)},'perOriginalUncompressedTarCapBytes':CAP,'aggregateActualUncompressedTarBytes':sum(a['bytes'] for a in archives),'aggregateLogicalMembers':sum(a['logicalMembers'] for a in archives),'logicalRecoveryMap':'SOURCE-RECOVERY.json','format':'PAX_TAR_STANDARD_BACKWARD_HARDLINKS_SAME_BYTES_SHA_ONLY','toolPolicy':'357 installed tool metadata pins only; no external tool binaries embedded.','newExecution':'PACKAGING_BYTE_IO_ONLY_NO_PHYSICS_OR_DECODER','archives':archives}
put('EVIDENCE-ARCHIVE.json',index);indexBytes=(HOME/'EVIDENCE-ARCHIVE.json').read_bytes();forecastBytes=(HOME/'ARCHIVE-FORECAST.json').read_bytes()
transport=[]
for archive in archives:
    raw=(HOME/archive['file']).read_bytes();target=HOME/(archive['file']+'.gz')
    with target.open('xb') as f:
        with gzip.GzipFile(filename='',fileobj=f,mode='wb',mtime=0,compresslevel=9) as out:out.write(raw)
    packed=target.read_bytes();restored=gzip.decompress(packed)
    if restored!=raw or pinbytes(restored)!={k:archive[k] for k in ['bytes','sha256']}:raise ValueError('Gzip changed exact original tar')
    expected={r['member']:r for r in archive['members']};seen=set()
    with tarfile.open(fileobj=io.BytesIO(restored),mode='r:') as tar:
        for member in tar.getmembers():
            if member.name not in expected or member.name in seen or not(member.isfile() or member.islnk()):raise ValueError('Unexpected logical member')
            row=expected[member.name]
            if member.islnk() and (member.linkname!=row.get('hardlinkTarget') or member.linkname not in seen):raise ValueError('Non-backward/nonstandard hardlink')
            data=tar.extractfile(member).read()
            if pinbytes(data)!={k:row[k] for k in ['bytes','sha256']}:raise ValueError('Logical member changed')
            seen.add(member.name)
    if seen!=set(expected):raise ValueError('Missing logical member')
    transport.append({'originalTar':{'file':archive['file'],**{k:archive[k] for k in ['bytes','sha256']}},'gzipTransport':{'file':target.name,**pinbytes(packed)},'verification':{'status':'PASS_EXACT_ORIGINAL_TAR_AND_ALL_LOGICAL_MEMBERS','logicalMembers':len(seen),'decompressedTar':pinbytes(restored)}})
if (HOME/'EVIDENCE-ARCHIVE.json').read_bytes()!=indexBytes or (HOME/'ARCHIVE-FORECAST.json').read_bytes()!=forecastBytes:raise ValueError('Original metadata drift')
put('GZIP-TRANSPORT-01.json',{'status':'PASS_GZIP_STORAGE_TRANSPORT_ONLY','originalArchiveIndex':{'file':'EVIDENCE-ARCHIVE.json',**pinbytes(indexBytes)},'originalForecast':{'file':'ARCHIVE-FORECAST.json',**pinbytes(forecastBytes)},'perOriginalUncompressedTarCapBytes':CAP,'aggregateOriginalUncompressedTarBytes':sum(x['originalTar']['bytes'] for x in transport),'aggregateStoredGzipBytes':sum(x['gzipTransport']['bytes'] for x in transport),'verifiedLogicalMembers':sum(x['verification']['logicalMembers'] for x in transport),'reconstruction':'Gzip decompress to exact original tar bytes and SHA/size, then verify every logical member with unchanged EVIDENCE-ARCHIVE.json and SOURCE-RECOVERY.json. Standard backward tar hardlinks refer only to equal-byte/sha earlier regular members.','policy':'16MiB is per uncompressed tar, not a single aggregate. Gzip is storage transport. Raw tars stay unchanged local; root owns Git writes. Serialized/cell/copy allowance is not RSS.','archives':transport,'WorldCalls':0,'compilerCalls':0,'browserCalls':0,'observerCalls':0,'decoderCalls':0})
print(json.dumps({'status':'SEALED_AND_ALL_MEMBERS_VERIFIED','archives':[{k:a[k] for k in ['file','bytes','sha256','logicalMembers']} for a in archives],'gzip':[x['gzipTransport'] for x in transport],'aggregateUncompressed':sum(a['bytes'] for a in archives),'aggregateGzip':sum(x['gzipTransport']['bytes'] for x in transport),'verifiedLogicalMembers':sum(a['logicalMembers'] for a in archives)}))
