import subprocess,time,json,hashlib,sys,os,shutil,datetime
from pathlib import Path
root=Path('/Users/user/.codex/worktrees/physics-signed-closure-world-1384/barocss')
out=Path('/tmp/physics-1399-parity-completion')
node='/Users/user/.nvm/versions/node/v22.22.0/bin/node'
assert shutil.disk_usage(out).free>(302+512)*1024**2
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
command=[node,str(root/'examples/physics-rigid-full-pair-position-world/parity-runner.mjs'),str(out)]
start=time.monotonic()
with (out/'consumer.stdout.log').open('xb') as stdout,(out/'consumer.stderr.log').open('xb') as stderr:
 process=subprocess.Popen(command,cwd=root,stdout=stdout,stderr=stderr,env={**os.environ,'PATH':str(Path(node).parent)+':'+os.environ['PATH']})
 started=dict(startedAtUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),pid=process.pid,controllerPid=os.getpid(),beforeHead=head,command=command,controllerSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),sourceFreezeSha256=hashlib.sha256((root/'examples/physics-rigid-full-pair-position-world/source-freeze.json').read_bytes()).hexdigest())
 print(json.dumps({'started':started}),flush=True)
 (out/'consumer.started.json').write_text(json.dumps(started,indent=2)+'\n')
 exitCode=process.wait()
receipt={**started,'exitCode':exitCode,'completedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsedSeconds':time.monotonic()-start}
for name in ['stdout','stderr']:
 data=(out/('consumer.'+name+'.log')).read_bytes();receipt[name+'Bytes']=len(data);receipt[name+'Sha256']=hashlib.sha256(data).hexdigest()
print(json.dumps({'completed':receipt}),flush=True)
print((out/'consumer.stdout.log').read_text()[:3500],flush=True)
print((out/'consumer.stderr.log').read_text()[:1500],flush=True)
(out/'consumer.receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
sys.exit(exitCode)
