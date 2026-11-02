"""Independent native geometry and complete finite-cell certificate observer.

Reads saved output only. No candidate, SAT, clipping or edge-solver imports.
"""
import hashlib
import itertools
import json
import math
import struct
import sys
from fractions import Fraction as F
from pathlib import Path


LIMIT2 = F(1, 10**24)
SURFACE = F(1, 10**9)
NORM = F(1, 10**12)


def need(value, message):
    if not value:
        raise ValueError(message)


def fv(values):return [F.from_float(float(x)) for x in values]
def add(a,b):return [x+y for x,y in zip(a,b)]
def sub(a,b):return [x-y for x,y in zip(a,b)]
def scale(a,s):return [x*s for x in a]
def dot(a,b):return sum((x*y for x,y in zip(a,b)),F(0))
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def square_distance(a,b):return dot(sub(a,b),sub(a,b))
def word(x):return struct.pack('>d',float(x)).hex()


def hamilton(a,b):
    return add(add(scale(b[:3],a[3]),scale(a[:3],b[3])),cross(a[:3],b[:3]))+[a[3]*b[3]-dot(a[:3],b[:3])]


def prepare(box):
    q=fv(box['orientationXYZW']);conjugate=[-q[0],-q[1],-q[2],q[3]];s=dot(q,q)
    need(s>0,'zero quaternion')
    axes=[]
    for i in range(3):
        v=[F(i==j) for j in range(3)]+[F(0)]
        axes.append([x/s for x in hamilton(hamilton(q,v),conjugate)[:3]])
    return dict(id=box['id'],centre=fv(box['positionM']),half=fv(box['halfExtentsM']),axes=axes,directions={})


def local(body,p):return [dot(axis,sub(p,body['centre'])) for axis in body['axes']]


def interval(body,p,n):
    key=tuple(n)
    if key not in body['directions']:body['directions'][key]=[dot(axis,n) for axis in body['axes']]
    lower=upper=None
    for x,v,h in zip(local(body,p),body['directions'][key],body['half']):
        if v==0:
            if abs(x)>h:return None
            continue
        lo,hi=sorted([(-h-x)/v,(h-x)/v])
        lower=lo if lower is None else max(lower,lo);upper=hi if upper is None else min(upper,hi)
    return None if lower is None or upper is None or lower>upper else (lower,upper)


def on_surface(body,p,exact):
    offsets=[abs(x)-h for x,h in zip(local(body,p),body['half'])]
    return all(x<=0 for x in offsets) and min(abs(x) for x in offsets)==0 if exact else max(offsets)<=SURFACE and min(abs(x) for x in offsets)<=SURFACE


def feasible(a,b,anchor,mid,af,bf,n,near_touch):
    if square_distance(anchor,mid)>LIMIT2:return False
    n2=dot(n,n)
    for endpoint in [af,bf]:
        delta=sub(endpoint,anchor);perpendicular=sub(delta,scale(n,dot(delta,n)/n2))
        if dot(perpendicular,perpendicular)>LIMIT2:return False
    ia,ib=interval(a,anchor,n),interval(b,anchor,n)
    if ia is None or ib is None:return False
    if square_distance(af,add(anchor,scale(n,ia[1])))>LIMIT2 or square_distance(bf,add(anchor,scale(n,ib[0])))>LIMIT2:return False
    return not near_touch or (ib[0]-ia[1])**2*n2<=LIMIT2


def all_words(packet,payload):
    for path,expected in packet['words'].items():
        value=payload
        for key in path.split('/')[1:]:value=value[int(key)] if isinstance(value,list) else value[key]
        need(word(value)==expected,'saved word mismatch '+path)


def separation_proof(a,b):
    delta=sub(b['centre'],a['centre'])
    for n in a['axes']+b['axes']+[cross(x,y) for x in a['axes'] for y in b['axes']]:
        n2=dot(n,n)
        if n2==0:continue
        radius=sum((sum((h*abs(dot(axis,n)) for h,axis in zip(body['half'],body['axes'])),F(0)) for body in [a,b]),F(0))
        margin=radius-abs(dot(delta,n))
        if margin<0 and margin*margin>LIMIT2*n2:return True
    return False


def audit(directory,home):
    counts={g:dict(cases=0,points=0,cells=0,cellMembers=0,exactCertificates=0,originalRows=0) for g in ['source','strict-nodenext']}
    rows=[];original_rows=[];cursor=None;failure=None
    maximum_movement2=F(0);original_raw={g:0 for g in counts}
    try:
        frozen=json.loads((directory/'frozen-inputs.json').read_text())
        for name,pin in frozen['sources'].items():
            data=(home/name).read_bytes();need(len(data)==pin['bytes'] and hashlib.sha256(data).hexdigest()==pin['sha256'],'frozen observer/source drift '+name)
        dependencies=json.loads((home/'dependencies.json').read_text())
        for name,pin in dependencies['pins'].items():
            data=(home.parent.parent/name).read_bytes();need(len(data)==pin['bytes'] and hashlib.sha256(data).hexdigest()==pin['sha256'],'immutable dependency drift '+name)
        bank=json.loads((home/'cases.json').read_text());need(len(bank['cases'])<=24,'case bound')
        need(bank==frozen['bank'],'frozen bank drift')
        for graph in counts:
            for index,c in enumerate(bank['cases']):
                cursor=dict(graph=graph,caseId=c['id']);prefix=graph+'-'+str(index).zfill(2)+'-'+c['id']
                ip=json.loads((directory/(prefix+'-input.json')).read_text());op=json.loads((directory/(prefix+'-output.json')).read_text())
                all_words(ip,ip['input']);all_words(op,op['result'])
                need(ip['input']['a']==c['a'] and ip['input']['b']==c['b'],'raw box input drift')
                r=op['result'];counts[graph]['cases']+=1
                need(r['status']!='UNRESOLVED','candidate refusal '+str(r.get('reason')))
                a,b=prepare(c['a']),prepare(c['b'])
                if r['status']=='MISS':need(separation_proof(a,b),'missing strict native separation certificate');continue
                need(r['status']=='HIT','invalid candidate status')
                en=[F(x) for x in r['exactNormalDirection']];n=fv(r['normal']);n2=dot(n,n)
                need(dot(en,en)>0 and abs(n2-1)<=NORM,'normal gate')
                unmatched=list(r['points'])
                for point in r['points']:
                    cursor.update(pointId=point['id']);counts[graph]['points']+=1
                    need(counts[graph]['points']<=96,'point bound')
                    pa,pb,mid=([F(x) for x in point['exact'][k]] for k in ['a','b','midpoint'])
                    need(mid==scale(add(pa,pb),F(1,2)) and cross(sub(pb,pa),en)==[0,0,0],'exact paired line')
                    need(on_surface(a,pa,True) and on_surface(b,pb,True),'exact native surface/12halfspace')
                    ia,ib=interval(a,mid,en),interval(b,mid,en)
                    need(ia is not None and ib is not None and add(mid,scale(en,ia[1]))==pa and add(mid,scale(en,ib[0]))==pb,'exact native line exits')
                    counts[graph]['exactCertificates']+=1
                    rounded=[float(x) if x else 0.0 for x in mid];af,bf=fv(point['aPointM']),fv(point['bPointM'])
                    need(all(word(x)==word(float(y)) for x,y in zip(point['aPointM'],pa)) and all(word(x)==word(float(y)) for x,y in zip(point['bPointM'],pb)),'endpoint nearest-even words')
                    need([word(x) for x in point['idealRoundedMidpoint']]==[word(x) for x in rounded],'ideal midpoint rounding')
                    need(square_distance(af,pa)<=LIMIT2 and square_distance(bf,pb)<=LIMIT2 and on_surface(a,af,False) and on_surface(b,bf,False),'fixed endpoint presentation gates')
                    near_touch=square_distance(pa,pb)<=LIMIT2;need(point['nearTouch'] is near_touch,'native near-touch classification')
                    grid=[[math.nextafter(x,-math.inf),x,math.nextafter(x,math.inf)] for x in rounded]
                    candidates=[];member_map={tuple(m['words']):m for m in point['cell']}
                    need(len(point['cell'])==27 and len(member_map)==27,'complete unique cell')
                    for values in itertools.product(*grid):
                        key=tuple(word(x) for x in values);need(key in member_map,'cell word not in frozen grid')
                        supplied=member_map[key];need(tuple(word(x) for x in supplied['anchor'])==key,'cell anchor/word mismatch')
                        p=fv(values);ok=feasible(a,b,p,mid,af,bf,n,near_touch)
                        need(supplied['feasible'] is ok,'cell feasibility mismatch')
                        if ok:candidates.append((square_distance(p,mid),':'.join(key),values))
                        counts[graph]['cellMembers']+=1;need(counts[graph]['cellMembers']<=2592,'cell operation bound')
                    need(candidates,'empty independent feasible cell')
                    score,key,chosen=min(candidates,key=lambda x:(x[0],x[1]))
                    need(tuple(word(x) for x in point['pointM'])==tuple(word(x) for x in chosen),'not nearest feasible cell anchor')
                    need(point['selectedWordKey']==key and F(point['selectedDistanceSquaredExact'])==score,'selected objective certificate')
                    anchor=fv(chosen);fa,fb=interval(a,anchor,n),interval(b,anchor,n)
                    if c.get('acceptedGapGateM'):need((fb[0]-fa[1])**2*n2<=LIMIT2,'accepted paired-gap gate')
                    counts[graph]['cells']+=1
                    rows.append(dict(graph=graph,caseId=c['id'],pointId=point['id'],feasibleMembers=len(candidates),
                                     selectedWordKey=key,selectedDistanceSquaredExact=str(score),
                                     nearestScope='FROZEN_27_MEMBER_CELL_ONLY',nativeCertificateVerified=True))
                if c.get('populationGroup')=='original-P4-32':
                    need(len(unmatched)==len(c['expectedOriginalPoints'])==4,'original point population changed')
                    for original in c['expectedOriginalPoints']:
                        saved=fv(original['pointM']);best=min(unmatched,key=lambda p:square_distance(fv(p['pointM']),saved));unmatched.remove(best)
                        movement2=square_distance(fv(best['pointM']),saved);maximum_movement2=max(maximum_movement2,movement2)
                        same_raw=[word(x) for x in best['pointM']]==[word(x) for x in original['pointM']]
                        original_raw[graph]+=int(same_raw)
                        original_rows.append(dict(graph=graph,caseId=c['id'],originalPointId=original['id'],
                                                  selectedPointId=best['id'],sameRawWords=same_raw,movementSquaredExact=str(movement2)))
                        counts[graph]['originalRows']+=1
            need(counts[graph]['originalRows']==32,'original32 not fully reached')
        status='PASS_INDEPENDENT_FINITE_CELL_GEOMETRY_ONLY'
    except Exception as error:
        status='NO_GO_INDEPENDENT_FINITE_CELL_GEOMETRY';failure=dict(cursor=cursor,type=type(error).__name__,message=str(error))
    return dict(status=status,counts=counts,firstFailure=failure,rows=rows,originalRows=original_rows,originalSameRawRows=original_raw,
                maximumOriginalMovementSquaredExact=str(maximum_movement2),maximumOriginalMovementM=math.sqrt(float(maximum_movement2)),
                WorldCalls=0,candidateCalls=0,globalNearest='NOT_CLAIMED',globalUnrepresentability='NOT_PROVED',
                oldSingleRoundedMidpointProtocol='UNCHANGED_NO_GO',productionIntegration='NOT_RUN',physicalDynamics='NOT_QUALIFIED',originalP4='UNCHANGED_NO_GO')


if __name__=='__main__':
    directory=Path(sys.argv[1]);home=Path(__file__).resolve().parent
    result=audit(directory,home);text=json.dumps(result,indent=2)+'\n'
    need(len(text.encode())<=16*1024**2,'observer evidence bound')
    with (directory/'independent-cell-geometry.json').open('x') as output:output.write(text)
    print(json.dumps({k:result[k] for k in ['status','counts','firstFailure','originalSameRawRows','maximumOriginalMovementM']}))
    sys.exit(0 if result['status'].startswith('PASS_') else 1)
