"""Independent actual warm prefix check for deliberately aborted unknown attempt.
No complete-interval/accepted-output claim: failed attempt has no accepted successor.
"""
from fractions import Fraction as F
from pathlib import Path
import sys,json,struct
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'physics-contact-wrench-producer-2276'))
from trace_decode import decode_packet

def decode(x):
    if isinstance(x,dict) and set(x)=={'$f64le'}:return struct.unpack('<d',bytes.fromhex(x['$f64le']))[0]
    if isinstance(x,dict):return {k:decode(v) for k,v in x.items()}
    if isinstance(x,list):return [decode(v) for v in x]
    return x
def vec(x):return [F.from_float(float(v)) for v in x]
def dot(a,b):return sum((x*y for x,y in zip(a,b)),F(0))
def need(x,m):
    if not x:raise ValueError(m)
def check(packet):
    failure=None;maxima={};checks=0
    def gate(k,x,lim):
        x=abs(x);maxima[k]=max(maxima.get(k,F(0)),x);need(x<=lim,k+' exceeds unchanged gate')
    try:
        attempt=next(w for w in packet['trace']['worlds'] if w['id']==packet['worldId'])['history'][0];records=attempt['records'];mutations=[(i,e) for i,e in enumerate(records) if e['kind']=='producer-bucket-mutated-before-unknown'];need(len(mutations)==1,'One actual nonzero candidate bucket mutation');mi,mutation=mutations[0];need(mutation['contributionNonzero'] and mutation['bucket'],'Actual mutated producer bucket retained');events=[(i,e) for i,e in enumerate(records) if e['kind']=='impulse-application'];need(len(events)==1 and events[0][0]<mi,'Unknown marker immediately follows first actual nonzero contribution');_,e=events[0];need(e['eventKind']=='warm' and e['cacheOrigin']=='prior-step','Actual prior-step warm application');n,t=vec(e['normal']),vec(e['cacheBefore']['tangentNs']);need(t!=[0,0,0] and dot(n,n)>0,'Nonzero raw tangent and normal');need(vec(e['producingFrame']['normal'])!=n,'Real changed normal');prior=dict(packet['privateBefore']['world']['persistentPoints'])[e['key']];need(e['cacheBefore']==prior,'Raw accepted prior cache provenance');need(e['producingFrame']==packet['privateBefore']['accepted']['cacheFrames'][e['key']],'Actual accepted producing frame');gram=[v-u*dot(t,n)/dot(n,n) for v,u in zip(t,n)];need(dot(gram,n)==0 and dot(gram,gram)<=dot(t,t),'Exact Gram invariants');after=vec(e['cacheAfter']['tangentNs']);need(struct.pack('<d',e['cacheBefore']['normalNs'])==struct.pack('<d',e['cacheAfter']['normalNs']),'Normal cache words unchanged');j=vec(e['impulseOnBNs']);ja=vec(e['impulseOnANs']);need(any(j),'Actual nonzero impulse');normal=F.from_float(e['cacheBefore']['normalNs'])
        for i in range(3):
            gate('warmCacheAfterIndependentGram'+str(i),after[i]-gram[i],F(1,10**12));gate('warmAppliedVector'+str(i),j[i]-n[i]*normal-gram[i],F(1,10**10));gate('applicationReciprocity'+str(i),j[i]+ja[i],F(1,10**10));gate('mutatedBucketOnB'+str(i),vec(mutation['bucket']['onB']['linearImpulseNs'])[i]-j[i],F(1,10**10));checks+=1
        gate('currentTangentPlane',dot(after,n),F(1,10**12));need(packet['before']==packet['after'],'No accepted state change in aborted attempt')
    except Exception as error:failure=dict(type=type(error).__name__,message=str(error))
    return dict(status='EXECUTED_NO_GO_UNKNOWN_WARM_PREFIX' if failure else 'EXECUTED_PASS_UNKNOWN_WARM_PREFIX',firstFailure=failure,checkedComponents=checks,maxima={k:float(v) for k,v in maxima.items()},wholeFailedIntervalPhysicalQualification='NOT_APPLICABLE_NO_ACCEPTED_SUCCESSOR',WorldCalls=0,candidateCalls=0)
if __name__=='__main__':
    result=check(decode(decode_packet(json.loads(Path(sys.argv[1]).read_text()))))
    with Path(sys.argv[2]).open('x') as f:json.dump(result,f,separators=(',',':'));f.write('\n')
    print(json.dumps(dict(status=result['status'],firstFailure=result['firstFailure'])))
    if result['firstFailure']:sys.exit(1)
