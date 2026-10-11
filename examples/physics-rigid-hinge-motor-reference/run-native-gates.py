#!/usr/bin/env python3
"""Root metadata controller. Execute only after complete actual-source freeze."""
from pathlib import Path
import hashlib,json,os,subprocess,sys,time,shutil
HERE=Path(__file__).resolve().parent
ROOT=HERE.parent.parent
OUT=Path(sys.argv[1]).resolve()
OUT.mkdir(parents=True,exist_ok=False)
NODE='/Users/user/.nvm/versions/node/v22.22.0/bin/node'
ENV=dict(os.environ,PATH=str(Path(NODE).parent)+':'+os.environ['PATH'],REPO_DEPS_ROOT='/Users/user/.barocss-ai/v3/integration')
freeze=json.loads((HERE/'source-freeze.json').read_text())
for row in freeze['sources']:
    data=(ROOT/row['path']).read_bytes()
    assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256'],row['path']
assert subprocess.check_output([NODE,'--version'],text=True).strip()==freeze['node']
assert shutil.disk_usage(OUT).free>(64+8+2+512)*1024**2
def gate(name,args):
    before=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    start=time.monotonic()
    with (OUT/(name+'.stdout.log')).open('xb') as stdout,(OUT/(name+'.stderr.log')).open('xb') as stderr:
        result=subprocess.run(args,cwd=ROOT,env=ENV,stdout=stdout,stderr=stderr)
    artifacts=[]
    for side in ['stdout','stderr']:
        namepath=name+'.'+side+'.log';data=(OUT/namepath).read_bytes();artifacts.append(dict(path=namepath,bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))
    receipt=dict(gate=name,argv=args,beforeHead=before,measuredSource=freeze['measuredHead'],elapsedSeconds=time.monotonic()-start,exitCode=result.returncode,artifacts=artifacts,sourceFreezeSha256=hashlib.sha256((HERE/'source-freeze.json').read_bytes()).hexdigest())
    print(json.dumps(receipt),flush=True)
    (OUT/(name+'.receipt.json')).write_text(json.dumps(receipt,indent=2)+'\n')
    return receipt
build=gate('build',[NODE,'examples/physics-rigid-engine-reference/build-local.mjs'])
if build['exitCode']:sys.exit(1)
types=gate('types',[NODE,'/Users/user/.barocss-ai/v3/integration/node_modules/typescript/bin/tsc','-p',str(HERE/'tsconfig.json')])
if types['exitCode']:sys.exit(2)
syntax=[]
for file in sorted(HERE.glob('*.mjs')):
    row=gate('syntax-'+file.stem,[NODE,'--check',str(file)]);syntax.append(row)
    if row['exitCode']:sys.exit(3)
row=gate('python-syntax',['python3','-m','py_compile',str(HERE/'reference.py')])
if row['exitCode']:sys.exit(4)
files=[]
for package in ['barocss-cad','barocss-physics']:
    own=ROOT/'packages'/package/'dist';rows=[]
    for path in sorted(own.rglob('*')):
        if path.is_file():
            data=path.read_bytes();rows.append(dict(path=str(path.relative_to(ROOT)),actualPath=str(path),bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))
    assert rows,package
    files+=rows
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
ledger=dict(beforeNumericalConsumer=True,consumerHead=head,measuredSource=freeze['measuredHead'],buildHead=build['beforeHead'],typesHead=types['beforeHead'],node=freeze['node'],sourceFreezeSha256=hashlib.sha256((HERE/'source-freeze.json').read_bytes()).hexdigest(),fileCount=len(files),files=files)
for name in ['build','types']:
    ledger[name+'ReceiptPath']=name+'.receipt.json';ledger[name+'ReceiptSha256']=hashlib.sha256((OUT/ledger[name+'ReceiptPath']).read_bytes()).hexdigest()
data=(json.dumps(ledger,indent=2)+'\n').encode();print(json.dumps(dict(actualEmittedFiles=len(files),emittedLedgerSha256=hashlib.sha256(data).hexdigest(),actualBuildHead=ledger['buildHead'],actualTypesHead=ledger['typesHead'],consumerHead=head,newNumericalCalls=0)),flush=True)
(OUT/'emitted-pre-consumer.json').write_bytes(data)
# Root must publish this actual ledger before separately invoking runner.mjs.
