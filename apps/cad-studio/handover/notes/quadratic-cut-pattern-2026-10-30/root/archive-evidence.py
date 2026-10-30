from pathlib import Path
import gzip,hashlib,io,json,tarfile
for source in [Path('/tmp/d346-perf/baseline'),Path('/tmp/d346-kernel/pre-audit')]:
    archive=source.with_name(source.name+'.snapshot.tar.gz')
    entries=[]
    with archive.open('wb') as raw:
        with gzip.GzipFile(filename='',mode='wb',fileobj=raw,mtime=0) as zipped:
            with tarfile.open(fileobj=zipped,mode='w|') as tar:
                for path in sorted(source.rglob('*')):
                    if not path.is_file():continue
                    assert not path.is_symlink()
                    data=path.read_bytes();name=path.relative_to(source).as_posix()
                    info=tarfile.TarInfo(name);info.size=len(data);info.mode=0o644;info.mtime=0;info.uid=info.gid=0;info.uname=info.gname=''
                    tar.addfile(info,io.BytesIO(data));entries.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    with tarfile.open(archive,'r:gz') as tar:
        members={m.name:m for m in tar.getmembers()};assert set(members)=={e['path'] for e in entries}
        for e in entries:
            data=tar.extractfile(members[e['path']]).read();assert len(data)==e['bytes'] and hashlib.sha256(data).hexdigest()==e['sha256']
    record={'status':'BYTE_EXACT_ARCHIVE_VERIFIED','source':str(source),'archive':str(archive),'archiveBytes':archive.stat().st_size,'archiveSHA256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':entries,'scope':'All original files retained exactly in deterministic tar/gzip; uid/mode/time archive metadata normalized, contents unchanged.'}
    source.with_name(source.name+'.snapshot-manifest.json').write_text(json.dumps(record,indent=2)+'\n')
    print(json.dumps({k:record[k] for k in ['status','source','archiveBytes','archiveSHA256']}))
