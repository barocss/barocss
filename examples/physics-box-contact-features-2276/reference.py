"""Independent Hamilton-quaternion/line-slab native geometry observer.
Imports no candidate arithmetic or SAT/clipping/finite-segment implementation.
Exact certificates and represented midpoint/normal presentation are separate.
"""
import json
import math
import sys
from pathlib import Path
from fractions import Fraction as F


def fv(v):return [F.from_float(x) for x in v]
def add(a,b):return [x+y for x,y in zip(a,b)]
def sub(a,b):return [x-y for x,y in zip(a,b)]
def scale(a,b):return [x*b for x in a]
def dot(a,b):return sum((x*y for x,y in zip(a,b)),F(0))
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]


def multiply(a,b):
    v=add(add(scale(b[:3],a[3]),scale(a[:3],b[3])),cross(a[:3],b[:3]))
    return v+[a[3]*b[3]-dot(a[:3],b[:3])]


def rotate(box,value,inverse=False):
    q=fv(box['orientationXYZW']);conj=[-q[0],-q[1],-q[2],q[3]];S=dot(q,q)
    left,right=(conj,q) if inverse else (q,conj)
    return [x/S for x in multiply(multiply(left,value+[F(0)]),right)[:3]]


def local(box,p):return rotate(box,sub(p,fv(box['positionM'])),True)


def native_interval(box,p,n):
    start=local(box,p);direction=rotate(box,n,True);lower=upper=None
    for x,v,h in zip(start,direction,fv(box['halfExtentsM'])):
        if v==0:
            if abs(x)>h:return None
            continue
        a,b=(-h-x)/v,(h-x)/v;lo,hi=min(a,b),max(a,b)
        lower=lo if lower is None else max(lower,lo);upper=hi if upper is None else min(upper,hi)
    if lower is None or upper is None or lower>upper:return None
    return lower,upper


def audit(directory,bank):
    cases=json.loads(bank.read_text())['cases'];maxima={k:F(0) for k in ['surface','normalLine','midpoint','floatLineWitness','acceptedGap','numericNormal']};counts={'cases':0,'points':0,'exactCertificates':0,'floatPresentations':0};cursor=None
    def gate(k,squared,limit):
        maxima[k]=max(maxima[k],squared);assert squared<=F(limit)**2,(k,math.sqrt(float(squared)),limit)
    try:
        for graph in ['source','strict-nodenext']:
            for index,c in enumerate(cases):
                cursor={'graph':graph,'case':c['id']}
                prefix=graph+'-'+str(index).zfill(2)+'-'+c['id'];packet=json.loads((directory/(prefix+'-output.json')).read_text());r=packet['result'];counts['cases']+=1
                assert r['status']!='UNRESOLVED',r.get('reason')
                if r['status']=='MISS':
                    # Independent exact separating-plane evidence, no normalized sqrt.
                    axes=[]
                    for box in [c['a'],c['b']]:
                        axes.append([rotate(box,[F(i==j) for j in range(3)]) for i in range(3)])
                    delta=sub(fv(c['b']['positionM']),fv(c['a']['positionM']));separated=False
                    for n in axes[0]+axes[1]+[cross(a,b) for a in axes[0] for b in axes[1]]:
                        if dot(n,n)==0:continue
                        support=sum((sum((h*abs(dot(axis,n)) for h,axis in zip(fv(box['halfExtentsM']),basis)),F(0)) for box,basis in zip([c['a'],c['b']],axes)),F(0))
                        margin=support-abs(dot(delta,n))
                        if margin<0 and margin*margin>F('1e-24')*dot(n,n):separated=True
                    assert separated,'no strict independent separation certificate';continue
                exact_n=[F(x) for x in r['exactNormalDirection']];assert dot(exact_n,exact_n)>0
                numeric_n=fv(r['normal']);gate('numericNormal',(dot(numeric_n,numeric_n)-1)**2,'1e-12')
                for p in r['points']:
                    pa,pb,mid=([F(x) for x in p['exact'][key]] for key in ['a','b','midpoint']);counts['points']+=1
                    assert mid==scale(add(pa,pb),F(1,2));assert cross(sub(pb,pa),exact_n)==[0,0,0]
                    for box,point in [(c['a'],pa),(c['b'],pb)]:
                        slacks=[h-abs(x) for h,x in zip(fv(box['halfExtentsM']),local(box,point))]
                        assert min(slacks)==0 and all(v>=0 for v in slacks),'exact endpoint off native surface'
                    ia,ib=native_interval(c['a'],mid,exact_n),native_interval(c['b'],mid,exact_n)
                    assert ia is not None and ib is not None
                    assert add(mid,scale(exact_n,ia[1]))==pa and add(mid,scale(exact_n,ib[0]))==pb,'exact paired line exits'
                    counts['exactCertificates']+=1
                    af,bf,mf=map(fv,[p['aPointM'],p['bPointM'],p['pointM']])
                    for a,b in [(af,pa),(bf,pb),(mf,mid)]:gate('midpoint',dot(sub(a,b),sub(a,b)),'1e-12')
                    for box,point in [(c['a'],af),(c['b'],bf)]:
                        offsets=[abs(x)-h for x,h in zip(local(box,point),fv(box['halfExtentsM']))]
                        gate('surface',min(abs(x) for x in offsets)**2,'1e-9');gate('surface',max(F(0),*offsets)**2,'1e-9')
                    n2=dot(numeric_n,numeric_n)
                    for endpoint in [af,bf]:
                        delta=sub(endpoint,mf);t=dot(delta,numeric_n)/n2;perp=sub(delta,scale(numeric_n,t));gate('normalLine',dot(perp,perp),'1e-12')
                    fa,fb=native_interval(c['a'],mf,numeric_n),native_interval(c['b'],mf,numeric_n)
                    assert fa is not None and fb is not None,'rounded midpoint line misses native box'
                    for endpoint,t in [(af,fa[1]),(bf,fb[0])]:
                        residual=sub(endpoint,add(mf,scale(numeric_n,t)));gate('floatLineWitness',dot(residual,residual),'1e-12')
                    if c.get('acceptedGapGateM'):gate('acceptedGap',(fb[0]-fa[1])**2*n2,'1e-12')
                    counts['floatPresentations']+=1
        return {'status':'PASS_INDEPENDENT_PRIVATE_BOX_GEOMETRY','counts':counts,'maximaM':{k:math.sqrt(float(v)) for k,v in maxima.items()},'WorldCalls':0,'candidateCalls':0,'productionIntegration':'NOT_RUN'}
    except Exception as error:
        return {'status':'NO_GO_INDEPENDENT_PRIVATE_BOX_GEOMETRY','counts':counts,'firstFailure':{'cursor':cursor,'message':str(error)},'maximaM':{k:math.sqrt(float(v)) for k,v in maxima.items()},'WorldCalls':0,'candidateCalls':0,'productionIntegration':'NOT_RUN'}


if __name__=='__main__':
    directory=Path(sys.argv[1]);result=audit(directory,Path(sys.argv[2]))
    with (directory/'independent-geometry.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(result));sys.exit(0 if result['status'].startswith('PASS_') else 1)
