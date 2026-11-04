"""Reuse the unchanged independent authored-frame audit on fresh post-repair packets."""
import hashlib,importlib.util,json
from pathlib import Path
HOME=Path(__file__).resolve().parent
ROOT=HOME.parents[1]
BASE=ROOT/'examples/physics-anisotropic-inertia-2276'
p=BASE/'initial-frame-audit.py'
assert hashlib.sha256(p.read_bytes()).hexdigest()=='56d126c4211d059597b4afbae7026fbb923a94f2af6c093156e7c8efe6ba1109'
spec=importlib.util.spec_from_file_location('fixed_authored_frame',p);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
paid=BASE/'evidence/api-02';r=json.loads((paid/'result.json').read_text())
assert r['status']=='ANISOTROPIC_PUBLIC_SOURCE_NATIVE_EIGHT_CASES_CONFIRMED' and r['sourceIntegrity']=='PASS' and r['failure'] is None
out=HOME/'evidence/post-initial-01';out.mkdir();results=[];pins={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest()};failure=None
try:
 for graph in ('source','native'):
  for case in module.CASES:
   path=paid/(graph+'-'+case+'.json');raw=path.read_bytes();assert len(raw)<=2097152
   pins[str(path.relative_to(ROOT))]=hashlib.sha256(raw).hexdigest();answer=module.audit_packet(json.loads(raw))
   results.append({'graph':graph,'caseId':case,'reply':answer});assert answer['ok'] and answer['resolved'] and not answer['executionFailure'],answer
 assert len(results)==16 and sum(x['reply']['certificate']['initialQuaternionChecks'] for x in results)==48
except Exception as error: failure={'name':type(error).__name__,'message':str(error)}
finally:
 for path,pin in pins.items():assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==pin
 result={'status':'CONTACT_POST_REPAIR_INITIAL_FRAMES_CONFIRMED' if failure is None else 'FIRST_FAILURE','firstFailure':failure,'sourceIntegrity':'PASS','paidPacketAudits':len(results),'initialQuaternionChecks':sum(x['reply'].get('certificate',{}).get('initialQuaternionChecks',0) for x in results),'worldCalls':0,'candidateCalls':0,'compilerCalls':0,'results':results,'inputs':pins}
 (out/'result.json').write_text(json.dumps(result,indent=2)+'\n');print(result['status'])
if failure:raise SystemExit(1)
