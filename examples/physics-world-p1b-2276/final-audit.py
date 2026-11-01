"""Hash the final owned source delta and resolve bounded migration dispositions."""
from pathlib import Path
import hashlib,json,subprocess
root=Path(__file__).resolve().parents[2]; here=Path(__file__).resolve().parent
base='0be1dffb8b7dce2be2571990d895c7e8301f9349'
sha=lambda b:hashlib.sha256(b).hexdigest()
def git(*args):return subprocess.check_output(['git',*args],cwd=root,stderr=subprocess.DEVNULL)
changed=git('diff',base,'--name-only').decode().splitlines()
new=git('ls-files','--others','--exclude-standard').decode().splitlines()
rows=[]
for path in sorted(set(changed+new)):
 if path.startswith('examples/physics-world-p1b-2276/evidence/') or path=='examples/physics-world-p1b-2276/final-manifest.json':continue
 p=root/path
 try:parent=sha(git('show',base+':'+path))
 except subprocess.CalledProcessError:parent=None
 rows.append({'path':path,'parentSha256':parent,'currentSha256':sha(p.read_bytes()) if p.exists() else None})
old=(root/'packages/barocss-physics/design/p0/types.ts').read_text().splitlines()[1:]
newtypes=(root/'packages/barocss-physics/src/types.ts').read_text().splitlines()[1:1+len(old)]
assert old==newtypes,'P0 type body drift'
solver=(root/'packages/barocss-physics/src/world.ts').read_text()
prior=git('show',base+':packages/barocss-physics/src/world.ts').decode()
def phase(s):return s[s.index('const actions = parseCommands'):s.index('const state = publicState')].encode()
assert phase(solver)==phase(prior)
historical=[]
for path in git('ls-tree','-r','--name-only',base).decode().splitlines():
 if path.startswith(('packages/barocss-physics/design/p0/','examples/physics-world-p0-2276/','examples/physics-world-p1a-2276/','examples/physics-contact-boundary-2276/','examples/physics-contact-solver-2276/','examples/physics-motion-nogo-2276/')):
  p=root/path
  assert p.exists() and p.read_bytes()==git('show',base+':'+path),'historical change: '+path
  historical.append({'path':path,'sha256':sha(p.read_bytes())})
ledger=json.loads((here/'migration-remaining.json').read_text())
dispositions=[]
for row in ledger['entries']:
 p=root/row['path'];action=row['action']
 if row['path']=='examples/physics-scene/app.js':action='migrated-current-model-options-API; hosts-03 compile; server-01 HTTP; DOM NOT_RUN'
 elif 'historical-original-control' in action:action='parent-disposition: historical-only whole checkpoint0be; not current runtime/API path; no shim or fallback'
 dispositions.append({'path':row['path'],'action':action,'currentSha256':sha(p.read_bytes())})
result={'format':'barocss-physics-p1b-final-audit','version':1,'base':base,'branch':git('branch','--show-current').decode().strip(),'sourceFiles':rows,'p0TypeBodyExact':True,'solverPhase':{'equal':True,'sha256':sha(phase(solver)),'bytes':len(phase(solver))},'unchangedHistoricalFiles':historical,'remainingCallerDispositions':dispositions,'bounds':'bounded AST inventory; computed imports/eval/external consumers NOT_PROVEN; no current config caller left among classified groups','publication':False}
(here/'final-manifest.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'sourceFiles':len(rows),'unchangedHistoricalFiles':len(historical),'callerDispositions':len(dispositions),'p0TypeBodyExact':True,'solverPhaseEqual':True}))
