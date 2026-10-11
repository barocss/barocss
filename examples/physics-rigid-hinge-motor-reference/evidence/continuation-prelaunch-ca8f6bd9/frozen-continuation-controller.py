from pathlib import Path
import subprocess,time,json,hashlib,os,sys,datetime,shutil
root=Path('/Users/user/.codex/worktrees/physics-hinge-motor-1179/barocss');out=Path('/tmp/physics-1179-hinge-motor-continuation');node='/Users/user/.nvm/versions/node/v22.22.0/bin/node';assert shutil.disk_usage(out).free>(64+8+2+512)*1024**2
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip();command=[node,str(root/'examples/physics-rigid-hinge-motor-reference/continuation-runner.mjs'),str(out)];start=time.monotonic()
with (out/'consumer.stdout.log').open('xb') as stdout,(out/'consumer.stderr.log').open('xb') as stderr:
 process=subprocess.Popen(command,cwd=root,stdout=stdout,stderr=stderr,env={**os.environ,'PATH':str(Path(node).parent)+':'+os.environ['PATH']})
 receipt=dict(startedAtUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),pid=process.pid,controllerPid=os.getpid(),beforeHead=head,argv=command,controllerSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),sourceFreezeSha256=hashlib.sha256((root/'examples/physics-rigid-hinge-motor-reference/source-freeze.json').read_bytes()).hexdigest())
 print(json.dumps(dict(started=receipt)),flush=True);(out/'consumer.started.json').write_text(json.dumps(receipt,indent=2)+'\n');code=process.wait()
receipt.update(exitCode=code,elapsedSeconds=time.monotonic()-start,completedAtUTC=datetime.datetime.now(datetime.timezone.utc).isoformat())
for side in ['stdout','stderr']:
 b=(out/('consumer.'+side+'.log')).read_bytes();receipt[side+'Bytes']=len(b);receipt[side+'Sha256']=hashlib.sha256(b).hexdigest()
print(json.dumps(dict(completed=receipt)),flush=True)
print((out/'consumer.stdout.log').read_text()[:4500],flush=True);print((out/'consumer.stderr.log').read_text()[:2200],flush=True)
(out/'consumer.receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');sys.exit(code)
