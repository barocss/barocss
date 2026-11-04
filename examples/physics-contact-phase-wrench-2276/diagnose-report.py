"""Files-only diagnosis; never invokes physics or the gate observer."""
from pathlib import Path
from fractions import Fraction as F
import hashlib,json,struct
HOME=Path(__file__).resolve().parent
folder=HOME/'evidence/phase-01'
def decode(x):
    if isinstance(x,dict):return struct.unpack('<d',bytes.fromhex(x['$f64le']))[0] if set(x)=={'$f64le'} else {k:decode(v) for k,v in x.items()}
    if isinstance(x,list):return list(map(decode,x))
    return x
def fv(x):return list(map(F,x))
def add(a,b):return [x+y for x,y in zip(a,b)]
def sub(a,b):return [x-y for x,y in zip(a,b)]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
pin=lambda p:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
paths=[folder/'A-step1-trace.json',folder/'A-step1-observer.json',HOME/'REPORT-DIAGNOSIS-CONTRACT.md',HOME/'diagnose-report.py']
pins={str(p.relative_to(HOME)):pin(p) for p in paths}
p=decode(json.loads(paths[0].read_text()));o=json.loads(paths[1].read_text());assert o['firstFailure']['message'].startswith('REPORT_VECTOR_NO_GO0:')
records=p['trace']['worlds'][0]['history'][0]['records'];events=[r for r in records if r['kind']=='impulse-application'];queries=[r for r in records if r['kind']=='geometry-query'];assert len(events)==168 and len(queries)==9
J=[F(0)]*3;M=[F(0)]*3;by_point={}
for e in events:
    j=fv(e['impulseOnBNs']);m=cross(fv(e['pointM']),j);J=add(J,j);M=add(M,m);row=by_point.setdefault(e['pointId'],{'applications':0,'J':[F(0)]*3,'M':[F(0)]*3});row['applications']+=1;row['J']=add(row['J'],j);row['M']=add(row['M'],m)
c=p['after']['contacts'];assert len(c)==1;c=c[0];reported=add([x*F(c['normalImpulseNs']) for x in fv(c['normalAtoB'])],fv(c['tangentImpulseOnBNs']));reported_m=cross(fv(c['pointM']),reported)
encode=lambda v:{'exact':list(map(str,v)),'approximate':list(map(float,v))}
last=next(q for q in reversed(queries) if not q['final']);active=[x['id'] for x in last['result']['points']]
result={'status':'DIAGNOSED_SAVED_REPORT_VECTOR_NO_GO','pins':pins,'counts':{'savedEvents':168,'savedQueries':9,'WorldCalls':0,'geometryCalls':0},'actualImpulseOnBNs':encode(J),'reportedImpulseOnBNs':encode(reported),'actualMinusReportedImpulseNs':encode(sub(J,reported)),'actualWorldOriginMomentOnBNms':encode(M),'reportedPointCrossReportedImpulseNms':encode(reported_m),'actualMinusReportedMomentNms':encode(sub(M,reported_m)),'byPoint':{k:{'applications':v['applications'],'impulse':encode(v['J']),'moment':encode(v['M']),'inLastForceQuery':k in active} for k,v in by_point.items()},'queryPointPopulations':[{'final':q['final'],'count':len(q['result']['points'])} for q in queries],'lastForceQueryPointIds':active,'retainedCache':p['privateAfter']['world']['persistentPoints'],'warmApplications':o['counts']['warmApplications'],'originalFirstFailure':o['firstFailure'],'laterGates':'NOT_RUN_BY_THIS_DIAGNOSTIC','publicPromotion':'BLOCKED','originalP4':'UNCHANGED_NO_GO'}
text=json.dumps(result,indent=2)+'\n';assert len(text.encode())<=1024**2
with (folder/'report-diagnosis.json').open('x') as f:f.write(text)
print(json.dumps({'status':result['status'],'actualImpulse':list(map(float,J)),'reportedImpulse':list(map(float,reported)),'actualMoment':list(map(float,M)),'lastActivePointIds':active}))
