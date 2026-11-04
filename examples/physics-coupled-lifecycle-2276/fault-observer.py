"""Independent actual post-apply prefix proof. No whole rolled-back interval PASS."""
from pathlib import Path
from fractions import Fraction as F
import json,sys,importlib.util,traceback
ROOT=Path(__file__).resolve().parents[2]
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);sys.modules[name]=m;spec.loader.exec_module(m);return m
reference=module('qualified_virtual_reference',ROOT/'examples/physics-coupled-contact-2276/reference.py')
physical=module('qualified_original_physical',ROOT/'examples/physics-coupled-contact-2276/physical-observer.py')
sys.path.insert(0,str(ROOT/'examples/physics-contact-wrench-producer-2276'))
from trace_decode import decode_packet

def need(ok,message):
    if not ok:raise ValueError(message)
def same(a,b):return json.dumps(a,sort_keys=True,separators=(',',':'))==json.dumps(b,sort_keys=True,separators=(',',':'))
def main(path,out):
    raw=decode_packet(json.loads(path.read_text()));packet=physical.decode(raw);maxima={};result=dict(status='NOT_COMPLETED',firstFailure=None,maxima=maxima,WorldCalls=0,candidateCalls=0,wholeFailedIntervalPhysicalQualification='NOT_APPLICABLE_NO_ACCEPTED_SUCCESSOR')
    def gate(key,value,limit=F(1,10**10)):
        value=abs(value);maxima[key]=max(maxima.get(key,0),float(value));need(value<=limit,key+' '+str(float(value)))
    def vectors(key,a,b,limit=F(1,10**10)):
        for i,(x,y) in enumerate(zip(a,b)):gate(key+str(i),x-y,limit)
    try:
        world=next(w for w in packet['trace']['worlds'] if w['id']==packet['worldId']);attempt=next(a for a in world['history'] if a['attempt']==packet['attemptId']);records=attempt['records'];plans=[e for e in records if e['kind']=='coupled-plan'];events=[e for e in records if e['kind']=='impulse-application'];buckets=[e for e in records if e['kind']=='producer-bucket-mutated-before-unknown'];queries=[e for e in records if e['kind']=='geometry-query'];need(len(plans)==len(events)==len(buckets)==len(queries)==1,'Actual exactly one prewarm target, query, nonzero apply and mutated bucket');plan=plans[0];e=events[0];bucket=buckets[0];query=queries[0];need(records.index(plan)<records.index(e)<records.index(bucket),'Real plan then application then bucket mutation');need(plan['result']['status']=='STATIC_TARGET' and e['eventKind']=='coupled-static' and e['branch']['targetApplied'] is True and e['branch']['slot']==1,'Real first coupled target slot');need(not any(x['kind']=='attempt-prepared' for x in records),'Failure precedes accepted prepare/commit')
        p=reference.vec(e['pointM']);before=e['bodyBBefore'];after=e['bodyBAfter'];com=reference.vec(before['positionM']);free=reference.vec(before['velocityMps']);omega=reference.vec(before['angularVelocityRadps']);need(before['kind']=='dynamic' and before['inverseMass']==1 and before['shape']['halfExtentsM']==[.5,.5,.5] and omega==[0,0,0],'Independent unit cube/free-spin profile');need(query['bodyB']==before,'Actual first application owns free query body');need(e['pointM']==query['result']['points'][0]['pointM'],'Actual query point owns impulse');native=physical.native(query['pair']['b']);axis=int(query['result']['feature']['axis']);n=native['axes'][axis];en=[F(x) for x in query['result']['exactNormalDirection']]
        if reference.dot(n,en)<0:n=reference.scale(n,F(-1))
        need(reference.dot(n,n)==1 and reference.cross(n,en)==[0,0,0],'Exact actual native axis');r=reference.solve(p,com,free,omega,n);need(r['status']=='STATIC_TARGET','Independent static feasibility');j=reference.vec(e['impulseOnBNs']);need(j==r['J'],'Actual world J equals independent virtual-column/Gaussian target');need(any(x!=0 for x in j),'Actual nonzero impulse');need(F(e['cacheBefore']['normalNs'])==0 and reference.vec(e['cacheBefore']['tangentNs'])==[0,0,0],'Actual cold cache');need(F(e['cacheAfter']['normalNs'])==r['N'] and reference.vec(e['cacheAfter']['tangentNs'])==r['T'],'Actual exact native N/T cache changed');gate('currentTangentPlane',reference.dot(r['T'],reference.vec(e['normal'])),F(1,10**12));need(reference.vec(e['branch']['worldImpulseNs'])==j,'Trace branch totalJ presentation');need([F(x) for x in plan['result']['certificate']['exactImpulseNs']]==r['J'],'Plan certificate independent target agreement')
        arm=reference.sub(p,com);vectors('actualLinearResponse',reference.sub(reference.vec(after['velocityMps']),free),j);vectors('actualSpinResponse',reference.sub(reference.vec(after['angularVelocityRadps']),omega),reference.scale(reference.cross(arm,j),F(6)));vectors('impulseReciprocity',reference.vec(e['impulseOnANs']),reference.scale(j,F(-1)));need(e['bodyABefore']==e['bodyAAfter'],'Static body state unchanged');need(before['positionM']==after['positionM'] and before['orientationXYZW']==after['orientationXYZW'],'Actual impulse preserves pose');need(before['velocityMps']!=after['velocityMps'] and before['angularVelocityRadps']!=after['angularVelocityRadps'],'Actual nonzero body velocity and spin mutation witnessed')
        def pointVelocity(body):return reference.add(reference.vec(body['velocityMps']),reference.cross(reference.vec(body['angularVelocityRadps']),reference.sub(p,reference.vec(body['positionM']))))
        def energy(body):return reference.dot(reference.vec(body['velocityMps']),reference.vec(body['velocityMps']))/2+reference.dot(reference.vec(body['angularVelocityRadps']),reference.vec(body['angularVelocityRadps']))/12
        vectors('actualPostApplyContactVelocity',pointVelocity(after),[F(0)]*3);work=reference.dot(j,reference.scale(reference.add(pointVelocity(before),pointVelocity(after)),F(1,2)));gate('actualMidpointWork',energy(after)-energy(before)-work)
        need(bucket['contributionNonzero'] is True,'Bucket actually nonzero');actual=bucket['bucket']
        for side,sign in [('onB',F(1)),('onA',F(-1))]:
            vectors('mutatedBucketLinear'+side,reference.vec(actual[side]['linearImpulseNs']),reference.scale(j,sign));vectors('mutatedBucketWorldMoment'+side,reference.vec(actual[side]['angularImpulseAboutWorldOriginNms']),reference.scale(reference.cross(p,j),sign))
        need(same(raw['before'],raw['after']) and same(raw['privateBefore'],raw['privateAfter']),'Actual accepted state/cache/cursor/time raw rollback')
        result.update(status='PASS_ACTUAL_COUPLED_POST_APPLY_FAULT_PREFIX',actualApplications=1,actualProducerBucketMutations=1,nativeN=reference.text(r['N']),nativeT=reference.text(r['T']),independentVirtualK=reference.text(r['K']),independentGaussianJ=reference.text(r['J']),acceptedRollback='RAW_STATE_PRIVATE_WORDS_EQUAL',diagnosticHistory='RETAINED_AND_COUNTS_WORK')
    except Exception as e:result['status']='FAIL_ACTUAL_COUPLED_POST_APPLY_FAULT_PREFIX';result['firstFailure']=dict(type=type(e).__name__,message=str(e),traceback=traceback.format_exc())
    with out.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(dict(status=result['status'],firstFailure=result['firstFailure'])));return int(result['firstFailure'] is not None)
if __name__=='__main__':sys.exit(main(Path(sys.argv[1]).resolve(),Path(sys.argv[2]).resolve()))
