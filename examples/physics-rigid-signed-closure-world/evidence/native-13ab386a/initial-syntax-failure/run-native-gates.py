#!/usr/bin/env python3
"""Root-only one native gate sequence. Call after full source freeze is committed."""
from pathlib import Path
import hashlib,json,os,subprocess,sys,time
HERE=Path(__file__).resolve().parent
ROOT=HERE.parent.parent
OUT=Path(sys.argv[1]).resolve()
OUT.mkdir(parents=True,exist_ok=True)
NODE='/Users/user/.nvm/versions/node/v22.22.0/bin/node'
ENV=dict(os.environ,PATH='/Users/user/.nvm/versions/node/v22.22.0/bin:'+os.environ['PATH'],REPO_DEPS_ROOT='/Users/user/.barocss-ai/v3/integration')
freeze=json.loads((HERE/'source-freeze.json').read_text())
for row in freeze['sources']:
    data=(ROOT/row['path']).read_bytes()
    assert hashlib.sha256(data).hexdigest()==row['sha256'],row['path']
assert subprocess.check_output([NODE,'--version'],text=True).strip()==freeze['node']
def gate(name,args):
    before=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    start=time.monotonic()
    with (OUT/(name+'.stdout.log')).open('wb') as stdout,(OUT/(name+'.stderr.log')).open('wb') as stderr:
        p=subprocess.run(args,cwd=ROOT,env=ENV,stdout=stdout,stderr=stderr)
    files=[]
    for suffix in ['stdout.log','stderr.log']:
        data=(OUT/(name+'.'+suffix)).read_bytes();files.append({'path':name+'.'+suffix,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    receipt={'gate':name,'argv':args,'beforeHead':before,'measuredSource':freeze['measuredHead'],'elapsedSeconds':time.monotonic()-start,'exitCode':p.returncode,'artifacts':files,'sourceFreezeSha256':hashlib.sha256((HERE/'source-freeze.json').read_bytes()).hexdigest()}
    (OUT/(name+'.receipt.json')).write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps(receipt),flush=True)
    return p.returncode
if gate('build',[NODE,'examples/physics-rigid-engine-reference/build-local.mjs']):sys.exit(1)
if gate('types',[NODE,'/Users/user/.barocss-ai/v3/integration/node_modules/typescript/bin/tsc','-p',str(HERE/'tsconfig.json')]):sys.exit(2)
files=[]
for package in ['barocss-cad','barocss-physics']:
    for path in sorted((ROOT/'packages'/package/'dist').rglob('*')):
        if path.is_file():
            data=path.read_bytes();files.append({'path':str(path.relative_to(ROOT)),'actualPath':str(path),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
ledger={'beforeNumericalConsumer':True,'measuredSource':freeze['measuredHead'],'actualBuildHead':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'node':freeze['node'],'files':files,'fileCount':len(files),'sourceFreezeSha256':hashlib.sha256((HERE/'source-freeze.json').read_bytes()).hexdigest(),'buildReceiptSha256':hashlib.sha256((OUT/'build.receipt.json').read_bytes()).hexdigest(),'typesReceiptSha256':hashlib.sha256((OUT/'types.receipt.json').read_bytes()).hexdigest()}
(OUT/'emitted-pre-consumer.json').write_text(json.dumps(ledger,indent=2)+'\n')
print(json.dumps({'buildAndTypesPassed':True,'actualEmittedFiles':len(files),'emittedLedgerSha256':hashlib.sha256((OUT/'emitted-pre-consumer.json').read_bytes()).hexdigest(),'numericalConsumerExecuted':False}),flush=True)
# Root publishes actual emitted ledger before separately invoking runner.mjs.
