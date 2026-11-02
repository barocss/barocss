"""Exact scalar face-event bank. No candidate imports or World calls."""
from fractions import Fraction as F
from pathlib import Path
import json
HOME=Path(__file__).resolve().parent
payload=json.loads((HOME/'CASES-02.json').read_text())
physical=payload['physical']
assert len(payload['cases'])==20
references=[]
for case in payload['cases']:
    if case['kind']!='finite':
        references.append(dict(id=case['id'],kind=case['kind'],expectedError=case.get('expectedError','INVALID_COMMAND')))
        continue
    center=list(map(F,case.get('fixtureCenter',[0,0,0])))
    start=[F(x)-y for x,y in zip(case['start'],center)]
    travel=[F(x)*F(physical['dt']) for x in case['velocity']]
    half=[F(a)+F(b) for a,b in zip(physical['halfExtentsM'],physical['fixedHalfExtentsM'])]
    def at(t): return [a+b*t for a,b in zip(start,travel)]
    def inside(point): return all(-h<=x<=h for x,h in zip(point,half))
    # Each feasible trajectory interval has an endpoint among the physical face
    # crossing events. Enumerating closed events also retains singleton grazes.
    events={F(0),F(1)}
    for a,b,h in zip(start,travel,half):
        if b:
            for face in [-h,h]:
                event=(face-a)/b
                if 0<=event<=1: events.add(event)
    feasible=[t for t in sorted(events) if inside(at(t))]
    owned=inside(start)
    classification='OWNED' if owned else 'HIT' if feasible else 'MISS'
    entry=feasible[0] if classification=='HIT' else None
    position=[F(x)+v for x,v in zip(case['start'],travel)]
    velocity=list(map(F,case['velocity']))
    normal=[F(0)]*3
    contact=False
    if entry is not None:
        hit=at(entry)
        axes=[i for i,(x,h) in enumerate(zip(hit,half)) if abs(x)==h and travel[i]*x<0]
        assert len(axes)==1,'Only centered single-face impacts are frozen'
        axis=axes[0];normal[axis]=F(1) if hit[axis]>0 else F(-1)
        position=[x+y for x,y in zip(hit,center)];velocity[axis]=F(0);contact=True
    elif owned and inside([x-y for x,y in zip(position,center)]):
        # These ownership cases have exactly one nearest physical separation face.
        axis=1;side=F(1) if position[axis]-center[axis]>=0 else F(-1)
        position[axis]=center[axis]+side*half[axis]
        normal[axis]=side
        if velocity[axis]*side<0: velocity[axis]=F(0)
        contact=True
    impulse=[F(physical['massKg'])*(a-F(b)) for a,b in zip(velocity,case['velocity'])]
    encode=lambda values:[str(x) for x in values]
    references.append(dict(id=case['id'],kind='finite',classification=classification,toi=None if entry is None else str(entry),normal=encode(normal),acceptedPositionM=encode(position),velocityMps=encode(velocity),impulseOnMovingNs=encode(impulse),energyJ=str(F(physical['massKg'])/2*sum(v*v for v in velocity)),contactExpected=contact,faceEvents=encode(sorted(events))))
for case,reference in zip(payload['cases'],references):
    if 'equivalentTo' in case:
        reference['equivalentTo']=case['equivalentTo']
        reference['orientationProof']='Unit Hamilton rotation matrix is quadratic: R(q)=R(-q); both represented identity signs leave every vector unchanged'
target=HOME/'BANK-02.json'
with target.open('x') as f:
    json.dump(dict(method='exact represented scalar face events and six physical halfspaces; Newton e0 normal momentum',physical=physical,cases=references,WorldCalls=0,candidateCalls=0),f,indent=2)
    f.write('\n')
print(json.dumps(dict(status='PASS_PRECOMPUTED_ANALYTIC_BANK',cases=len(references),WorldCalls=0,candidateCalls=0)))
