from pathlib import Path
from fractions import Fraction as F
import importlib.util,json
base=Path('/tmp/d340-kernel');data=json.loads((base/'material-record.json').read_text())
spec=importlib.util.spec_from_file_location('independent_oracle','/tmp/d340-plan/oracle.py');oracle=importlib.util.module_from_spec(spec);spec.loader.exec_module(oracle)
def q(x):return F.from_float(x) if isinstance(x,float) else F(x)
def fromtext(t):return F(int(t['numerator']),int(t['denominator']))
def green(component):
 a=F(0);mx=F(0);my=F(0)
 for loop in component['trimLoops']:
  ring=[(F(20)+5*q(u),F(-11)+5*q(v)) for u,v in loop['uv']]
  for p,r in zip(ring,ring[1:]+ring[:1]):
   z=p[0]*r[1]-r[0]*p[1];a+=z;mx+=(p[0]+r[0])*z;my+=(p[1]+r[1])*z
 return (a/2,mx/(3*a),my/(3*a))
out={'boundary':data['boundary'],'results':{}}
for keep,result in data['results'].items():
 src=data['input'];expected=oracle.integrate([[q(u),q(v)] for u,v in src['uv']],{k:list(map(q,v)) for k,v in src['domain'].items()},src['axis'],q(src['parameter']),keep)
 comparisons=[]
 for side in ['lower','upper']:
  actual=[green(c) for c in result['components'] if c['side']==side]
  wanted=[(fromtext(e['areaWorld']),fromtext(e['centroidWorld'][0]),fromtext(e['centroidWorld'][1])) for e in expected[side]]
  actual.sort();wanted.sort();assert len(actual)==len(wanted)
  for a,b in zip(actual,wanted):
   gaps=[abs(float(x-y)) for x,y in zip(a,b)];assert all(g<=1e-7 for g in gaps)
   comparisons.append({'side':side,'expected':[oracle.text(x) for x in b],'actualStoredPolygon':[oracle.text(x) for x in a],'absoluteGaps':gaps})
 out['results'][keep]={'componentCounts':{k:len(v) for k,v in expected.items()},'comparisons':comparisons,'maximumWorldBoundaryBound':result['trimSplit']['maximumWorldBoundaryBound'],'status':'PASS_SCOPED_KERNEL_STORED_MATERIAL'}
(base/'independent-material.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({k:{'status':v['status'],'componentCounts':v['componentCounts'],'maximumGap':max(max(c['absoluteGaps']) for c in v['comparisons'])} for k,v in out['results'].items()}))
