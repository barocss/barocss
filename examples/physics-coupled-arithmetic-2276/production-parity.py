"""Root-only existing packet byte parity. No candidate/decoder imports."""
import sys,json,hashlib
from pathlib import Path
home=Path(__file__).resolve().parent
assert len(sys.argv)==4
for x in sys.argv[1:]:assert x and len(x)<=48 and all(c.islower() or c.isdigit() or c=='-' for c in x)
a,b,out=[home/'evidence'/x for x in sys.argv[1:]];out.mkdir()
result={'status':'NOT_COMPLETED','WorldCalls':0,'candidateCalls':0,'normalization':'NONE','runtimeWorldPromotion':'BLOCKED_UNQUALIFIED_ARITHMETIC_BANKS'}
try:
 x=json.loads((a/'result.json').read_text());y=json.loads((b/'result.json').read_text())
 for z,g in [(x,'source'),(y,'native')]:
  assert z['status']=='PASS_PRODUCTION_REGRESSION_RAW_EQUAL_EFFICIENT' and z['graph']==g
  assert z['topLevelCalls']==13 and z['underlyingStaticCalls']==13 and z['WorldCalls']==0
 assert x['providerDigest']==y['providerDigest'] and x['bankPin']==y['bankPin'] and x['authorPin']==y['authorPin']
 assert x['completeEfficientPacketEquality']==y['completeEfficientPacketEquality']=='14_FULL_PACKETS_RAW_WORDS_CERTIFICATES_COUNTERS_EQUAL'
 names=sorted(p.name for p in a.glob('*-packet.json'));assert len(names)==11
 assert names==sorted(p.name for p in b.glob('*-packet.json'))
 rows=[]
 for name in ['bank.json','before-static-control.json','at-static-control.json']+names:
  left=(a/name).read_bytes();right=(b/name).read_bytes();assert left==right,name
  rows.append({'name':name,'bytes':len(left),'sha256':hashlib.sha256(left).hexdigest()})
 result.update(status='PASS_PRODUCTION_SOURCE_NATIVE_AND_EFFICIENT_RAW_PACKETS',providerDigest=x['providerDigest'],authorPin=x['authorPin'],productionSourceId=sys.argv[1],productionNativeId=sys.argv[2],packets=rows,completeEfficientPacketEquality='14_FULL_PACKETS_PER_GRAPH_RAW_WORDS_CERTIFICATES_COUNTERS_EQUAL')
except Exception as e:
 result.update(status='NO_GO_PURE_PARITY',firstFailure={'name':type(e).__name__,'message':str(e)})
(out/'result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));sys.exit(0 if result['status'].startswith('PASS_') else 1)
