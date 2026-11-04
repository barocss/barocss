"""Independent virtual-unit-impulse columns + Gaussian reference; no candidate imports."""
from fractions import Fraction as F
from pathlib import Path
import json,hashlib,sys
ROOT=Path(__file__).resolve().parents[2];HOME=Path(__file__).resolve().parent

def need(ok,message):
    if not ok:raise ValueError(message)
def bounded(x):
    if isinstance(x,F):need(x.numerator.bit_length()<=16384 and x.denominator.bit_length()<=16384,'Exact16384bit bound')
    elif isinstance(x,(list,tuple)):
        for v in x:bounded(v)
    return x

def vec(v):return [F.from_float(float(x)) for x in v]
def add(a,b):return bounded([x+y for x,y in zip(a,b)])
def sub(a,b):return bounded([x-y for x,y in zip(a,b)])
def scale(a,s):return bounded([x*s for x in a])
def dot(a,b):return bounded(sum((x*y for x,y in zip(a,b)),F(0)))
def cross(a,b):return bounded([a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]])
def columns(point,com):
    arm=sub(point,com);cols=[]
    for axis in range(3):
        impulse=[F(i==axis) for i in range(3)]
        deltaVelocity=impulse;deltaOmega=scale(cross(arm,impulse),F(6))
        cols.append(add(deltaVelocity,cross(deltaOmega,arm)))
    return [[cols[j][i] for j in range(3)] for i in range(3)]
def gaussian(k,rhs):
    a=[row[:]+[v] for row,v in zip(k,rhs)]
    for col in range(3):
        pivot=next((i for i in range(col,3) if a[i][col]),None);need(pivot is not None,'Independent nonzero pivot');a[col],a[pivot]=a[pivot],a[col];den=a[col][col];a[col]=bounded([x/den for x in a[col]])
        for i in range(3):
            if i!=col:
                factor=a[i][col];a[i]=bounded([x-factor*y for x,y in zip(a[i],a[col])])
    return [a[i][3] for i in range(3)]
def solve(point,com,free,omega,n):
    k=columns(point,com);u=add(free,cross(omega,sub(point,com)));j=gaussian(k,scale(u,F(-1)));normal=dot(j,n);t=sub(j,scale(n,normal));margin=dot(t,t)-normal*normal
    need(add(u,[dot(row,j) for row in k])==[0,0,0],'Independent exact contact solve')
    return dict(K=k,freePoint=u,J=j,N=normal,T=t,margin=margin,status='STATIC_TARGET' if normal>=0 and margin<=0 else 'COUPLED_DYNAMIC_REQUIRED')
def text(x):
    if isinstance(x,F):return str(x.numerator)+'/'+str(x.denominator)
    if isinstance(x,list):return [text(v) for v in x]
    return x

def bank(out):
    need(out.parent==HOME/'evidence','Fresh reference output under own evidence only');out.parent.mkdir(exist_ok=True)
    author=json.loads((HOME/'AUTHOR-FREEZE-01.json').read_text())
    for name,pin in author['files'].items():
        b=(ROOT/name).read_bytes();need(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())==pin,'Frozen source/reference drift '+name)
    design=ROOT/'examples/physics-persistent-cone-design-2276/evidence/model-01';old=json.loads((design/'reference.json').read_text());geom=old['nativeGeometry'];readq=lambda x:F(int(x['n']),int(x['d']));point=[readq(x) for x in geom['nativePointM']];com=[readq(x) for x in geom['contactCenterM']];n=[readq(x) for x in geom['axes'][1]];cases=[]
    for case in old['cases']:
        model=json.loads((design/(case['id']+'-model.json')).read_text());body=next(b for b in model['bodies'] if b['kind']=='dynamic');free=body['initial']['velocityMps'];omega=body['initial']['angularVelocityRadps'];r=solve(point,com,vec(free),vec(omega),n)
        actual=dict(pointM=list(map(float,point)),nativePointExact=text(point),comM=list(map(float,com)),orientationXYZW=body['initial']['orientationXYZW'],freeVelocityMps=free,freeAngularVelocityRadps=omega,massKg=body['massKg'],halfExtentsM=[.5,.5,.5],muStaticA=1,muStaticB=1,nativeFaceAxis=1,nativeFaceSign=1,nativeNormalDirection=text(n))
        cases.append(dict(id=case['id'],input=actual,expectedStatus=r['status'],independentK=text(r['K']),exactImpulseNs=text(r['J']),exactNormalNs=text(r['N']),exactTangentNs=text(r['T']),exactConeMarginSquared=text(r['margin']),expectedWorldImpulseNs=list(map(float,r['J'])),expectedNormalNs=float(r['N']),expectedTangentNs=list(map(float,r['T']))))
    need([x['expectedStatus'] for x in cases]==['STATIC_TARGET','STATIC_TARGET','COUPLED_DYNAMIC_REQUIRED'],'Frozen exact branch bank')
    result=dict(status='READY_INDEPENDENT_VIRTUAL_IMPULSE_GAUSSIAN_BANK',cases=cases,WorldCalls=0,candidateCalls=0,derivation='Virtualunitimpulses COMspinresponse then Gaussian; no candidate K or adjugate')
    with out.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(dict(status=result['status'],cases=3,WorldCalls=0,candidateCalls=0)))
if __name__=='__main__':bank(Path(sys.argv[1]).resolve())
