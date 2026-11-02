"""Verify immutable history and hash the scoped P2 delta."""
from pathlib import Path
import subprocess,json,hashlib
root=Path(__file__).resolve().parents[2];here=Path(__file__).resolve().parent
base='0c8b3be71f10bc9e39f8c8097eeaf0cfba8175ae'
def git(*args):return subprocess.check_output(['git',*args],cwd=root,stderr=subprocess.DEVNULL)
sha=lambda data:hashlib.sha256(data).hexdigest()
protected=['packages/barocss-physics/design/p0/','examples/physics-world-p0-2276/','examples/physics-world-p1a-2276/','examples/physics-world-p1b-2276/','examples/physics-contact-boundary-2276/','examples/physics-contact-solver-2276/','examples/physics-motion-nogo-2276/','examples/physics-motion-foundations-2276/evidence/']
assert not git('diff',base,'--name-only','--',*protected),'historical bytes changed'
new=git('ls-files','--others','--exclude-standard').decode().splitlines();assert not any(p.startswith(tuple(protected)) for p in new),'new historical file'
history=[]
for entry in git('ls-tree','-r','--full-tree',base,'--',*protected).decode().splitlines():
 fields,path=entry.split('\t',1);history.append({'path':path,'gitBlob':fields.split()[2]})
path='packages/barocss-physics/src/world.ts';prior=git('show',base+':'+path).decode();current=(root/path).read_text()
def kernel(source):return source[source.index('const next = bodies.map(copyBody)'):source.index('const state = publicState(next,')].encode()
assert kernel(prior)==kernel(current),'numerical candidate kernel changed'
rows=[]
for path in sorted(set(git('diff',base,'--name-only').decode().splitlines()+new)):
 if path.startswith('examples/physics-world-p2-2276/evidence/') or path=='examples/physics-world-p2-2276/final-manifest.json':continue
 p=root/path
 try:previous=sha(git('show',base+':'+path))
 except subprocess.CalledProcessError:previous=None
 rows.append({'path':path,'parentSha256':previous,'currentSha256':sha(p.read_bytes()) if p.exists() else None})
rootmeta=here/'evidence/public-emitted-05/package-root.metafile.json'
inputs=json.loads(rootmeta.read_text())['inputs']
assert not any('barocss-cad/' in key or 'barocss-viewer/' in key for key in inputs),'numerical root imports optional service'
result={'format':'barocss-physics-p2-final-audit','base':base,'branch':git('branch','--show-current').decode().strip(),'sourceFiles':rows,'unchangedHistoricalFiles':history,'candidateKernel':{'equal':True,'sha256':sha(kernel(current)),'bytes':len(kernel(current)),'boundary':'const next through pre-publicState only; ownership/admission/log/serialization outside slice'},'rootHasNoCadOrViewer':True,'publication':False}
(here/'final-manifest.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'sourceFiles':len(rows),'historicalFilesUnchanged':len(history),'candidateKernelEqual':True,'candidateKernelSha256':sha(kernel(current)),'rootCadViewerFree':True}))
