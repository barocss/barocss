"""Root-only full retained clean physics/state/recording/capture packet byte parity."""
import sys,json,hashlib
from pathlib import Path
home=Path(__file__).resolve().parent
assert len(sys.argv)==4
for x in sys.argv[1:]:assert 0<len(x)<=48 and all(c.islower() or c.isdigit() or c=='-' for c in x)
a,b,out=[home/'evidence'/x for x in sys.argv[1:]];out.mkdir()
r={'status':'NOT_COMPLETED','WorldCalls':0,'normalization':'NONE','transactionWire':'NOT_RUN','promotion':'BLOCKED_REMAINING_GATES'}
try:
 left=json.loads((a/'summary.json').read_text());right=json.loads((b/'summary.json').read_text())
 for s,g in [(left,'source'),(right,'native')]:
  assert s['status']=='PASS_COUPLED_DYNAMIC_HOST_CLEAN_THREE_CASES' and s['graph']==g and s['firstFailure'] is None
  assert s['created']==s['attempts']==s['accepted']==3
  for k,v in {'worlds':3,'attempts':3,'applications':192,'queries':30,'queryPoints':27,'anchorChecks':729}.items():assert s['counts'][k]==v
  for values in s['controls'].values():assert all(v=='EXECUTED_PASS' for v in values.values())
 assert left['counts']==right['counts'] and left['controls']==right['controls']
 names=['frozen-inputs.json','capture-mutation-isolation.json']
 for case in ['before','at','after']:
  names += [case+'-'+suffix+'.json' for suffix in ['actual-inputs','initial-output','initial-trace','before','accepted-output','step-trace','capture','dispose-idempotence']]
 assert len(names)==26
 rows=[]
 for n in names:
  data=(a/n).read_bytes();assert data==(b/n).read_bytes(),n
  rows.append({'name':n,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
 r.update(status='PASS_COUPLED_DYNAMIC_HOST_CLEAN_SOURCE_NATIVE_FULL_RAW_PACKETS',packets=rows,perGraphCounts=left['counts'],perGraphAccepted=3,independentAudits='EACH_GRAPH_SEPARATELY_PASSED_UNCHANGED_GEOMETRY_PHYSICAL_CONE_AND_NEW_TARGET')
except Exception as e:r.update(status='NO_GO_DYNAMIC_HOST_CLEAN_PARITY',firstFailure={'name':type(e).__name__,'message':str(e)})
(out/'result.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r));sys.exit(0 if r['status'].startswith('PASS_') else 1)
