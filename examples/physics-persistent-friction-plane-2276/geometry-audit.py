"""Independent rational line/box witness check on saved accepted API outputs.
Uses exact unit-quaternion rational matrix; no producer/SAT/clipping imports.
"""
import json
import sys
from fractions import Fraction as F
from pathlib import Path


def vec(values):return [F.from_float(x) for x in values]
def dot(a,b):return sum((x*y for x,y in zip(a,b)),F(0))


def interval(body,half,p,n):
    x,y,z,w=vec(body['orientationXYZW']);S=x*x+y*y+z*z+w*w
    R=[[w*w+x*x-y*y-z*z,2*(x*y-z*w),2*(x*z+y*w)],
       [2*(x*y+z*w),w*w-x*x+y*y-z*z,2*(y*z-x*w)],
       [2*(x*z-y*w),2*(y*z+x*w),w*w-x*x-y*y+z*z]]
    R=[[v/S for v in row] for row in R]
    delta=[v-c for v,c in zip(p,vec(body['positionM']))];lower=upper=None
    for i,h in enumerate(vec(half)):
        axis=[R[j][i] for j in range(3)];origin,speed=dot(axis,delta),dot(axis,n)
        if speed==0:
            if abs(origin)>h:return None
            continue
        a,b=(-h-origin)/speed,(h-origin)/speed
        lo,hi=min(a,b),max(a,b);lower=lo if lower is None else max(lower,lo);upper=hi if upper is None else min(upper,hi)
    if lower is None or upper is None or lower>upper:return None
    return lower,upper


directory=Path(sys.argv[1]);data=json.loads((directory/'result.json').read_text());shapes={c['bodyId']:c['geometry']['halfExtentsM'] for c in data['model']['colliders']};rows=[]
for state in data['states'][1:]:
    bodies={b['id']:b for b in state['bodies']}
    for c in state['contacts']:
        p,n=vec(c['pointM']),vec(c['normalAtoB']);a=interval(bodies[c['bodyAId']],shapes[c['bodyAId']],p,n);b=interval(bodies[c['bodyBId']],shapes[c['bodyBId']],p,n)
        gap=None if a is None or b is None else b[0]-a[1]
        passed=gap is not None and gap*gap*dot(n,n)<=F('1e-24')
        rows.append({'step':state['stepIndex'],'lineHitsBoth':a is not None and b is not None,'pairedTimeGapExact':None if gap is None else str(gap),'approxDistanceM':None if gap is None else float(abs(gap)),'pairedWitnessGateM':'1e-12','pass':passed})
result={'status':'NO_GO_PUBLIC_PAIRED_CONTACT_WITNESS' if any(not r['pass'] for r in rows) else 'PASS_SAVED_PUBLIC_PAIRED_WITNESS','model':'exact unit-quaternion/native box dimensions; accepted public point/normal','rows':rows,'WorldCalls':0,'candidateGeometryCalls':0,'scope':'published aggregate point only; not every hidden manifold point'}
with (directory/'independent-line-audit.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps(result))
