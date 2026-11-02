"""Independent linear momentum/Newton constraints, generated before World calls."""
from fractions import Fraction as F
from pathlib import Path
import json

HOME=Path(__file__).resolve().parent
cases=[]
def add(name,kind,ea,eb,speed=2,reverse=False,swap=False):
    cases.append(dict(id=name,kind=kind,ea=ea,eb=eb,speed=speed,reverse=reverse,swap=swap))
for kind in ['fixed-sphere','fixed-cube','two-spheres']:
    add(kind+'-minimum',kind,.25,1)
    add(kind+'-materials',kind,1,.25)
    add(kind+'-orders',kind,.25,1,reverse=True,swap=True)
    add(kind+'-zero',kind,0,1)
    add(kind+'-elastic',kind,1,1)
add('threshold-below','fixed-sphere',.25,.75,.49999999999999994)
add('threshold-equal','fixed-sphere',.25,.75,.5)
add('threshold-above','fixed-sphere',.25,.75,.5000000000000001)
#18 rather than16 would violate the frozen work population. Keep the three
#two-body minimum/material/order cases and the two endpoint cases, but remove
#redundant fixed-cube material/order permutations before execution.
cases=[c for c in cases if c['id'] not in ['fixed-cube-materials','fixed-cube-orders']]
assert len(cases)==16
def solve(matrix,rhs):
    a=[list(map(F,row))+[F(b)] for row,b in zip(matrix,rhs)]
    for i in range(2):
        pivot=next(j for j in range(i,2) if a[j][i])
        a[i],a[pivot]=a[pivot],a[i]
        assert a[i][i]
        t=a[i][i];a[i]=[x/t for x in a[i]]
        for j in range(2):
            if i!=j:
                t=a[j][i];a[j]=[x-t*y for x,y in zip(a[j],a[i])]
    return [a[0][-1],a[1][-1]]
for c in cases:
    moving=c['kind']=='two-spheres';ma,mb=F(2),F(3)
    ua,ub=(F(c['speed'])/2,-F(c['speed'])/2) if moving else (-F(c['speed']),F(0))
    e=min(F(c['ea']),F(c['eb'])) if F(c['speed'])>F(1,2) else F(0)
    #Coordinate increases along line of centers for the two mobile bodies;
    #fixed-floor coordinate increases upward. These constraints contain no
    #effective-mass/impulse update from the production implementation.
    va,vb=solve([[ma,mb],[-1,1]],[ma*ua+mb*ub,e*(ua-ub)]) if moving else solve([[0,1],[1,-1]],[0,-e*(ua-ub)])
    energy=lambda a,b:ma*a*a/2+(mb*b*b/2 if moving else 0)
    values=dict(velocityA=va,velocityB=vb,impulseA=ma*(va-ua),energyBefore=energy(ua,ub),energyAfter=energy(va,vb))
    assert values['energyAfter']<=values['energyBefore']
    c['reference']={k:str(v) for k,v in values.items()}
target=HOME/'BANK-01.json'
with target.open('x') as f:json.dump({'method':'exact linear conservation plus Newton constraints','cases':cases,'WorldCalls':0},f,indent=2);f.write('\n')
print(json.dumps({'status':'PASS_INDEPENDENT_PRECOMPUTED_BANK','cases':len(cases),'WorldCalls':0}))
