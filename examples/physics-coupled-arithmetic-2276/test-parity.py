"""Root-only raw bytes for separate 52-case test-entry campaigns. No arithmetic imports."""
import sys,json,hashlib
from pathlib import Path
home=Path(__file__).resolve().parent
assert len(sys.argv)==4
for x in sys.argv[1:]:assert x and len(x)<=48 and all(c.islower() or c.isdigit() or c=='-' for c in x)
a,b,out=[home/'evidence'/x for x in sys.argv[1:]];out.mkdir()
r={'status':'NOT_COMPLETED','WorldCalls':0,'testEntryCalls':0,'normalization':'NONE','runtimeWorldPromotion':'BLOCKED_ACTUAL_HOST_NOT_QUALIFIED'}
try:
 x=json.loads((a/'result.json').read_text());y=json.loads((b/'result.json').read_text())
 for z,g in [(x,'source'),(y,'native')]:
  assert z['status']=='PASS_PRIVATE_SHARED_ARITHMETIC_52_LITERAL_CASES' and z['graph']==g
  assert z['testEntryCalls']==52 and z['testEntryCallCap']==64 and z['productionCallsInThisProcess']==0 and z['WorldCalls']==0
  assert z['observedSameGraphProductionAndTestCalls']==65
 assert x['providerDigest']==y['providerDigest'] and x['authorPin']==y['authorPin'] and x['productionPrerequisite']==y['productionPrerequisite']
 names=sorted(p.name for p in a.glob('*-packet.json'));assert len(names)==52 and names==sorted(p.name for p in b.glob('*-packet.json'))
 rows=[]
 for name in ['bank.json']+names:
  left=(a/name).read_bytes();assert left==(b/name).read_bytes(),name
  rows.append({'name':name,'bytes':len(left),'sha256':hashlib.sha256(left).hexdigest()})
 r.update(status='PASS_PRIVATE_ARITHMETIC_52_SOURCE_NATIVE_RAW_PACKET_PARITY',packets=rows,observedCallsPerGraph={'production':13,'privateTests':52,'sum':65},censusBoundary='Separate production cap16 and private test cap64; sum65 is not a combined64cap',providerDigest=x['providerDigest'],authorPin=x['authorPin'])
except Exception as e:r.update(status='NO_GO_PRIVATE_ARITHMETIC_PARITY',firstFailure={'name':type(e).__name__,'message':str(e)})
(out/'result.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r));sys.exit(0 if r['status'].startswith('PASS_') else 1)
