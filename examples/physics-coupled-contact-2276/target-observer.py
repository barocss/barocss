"""Independent actual-target-once/native cache observer. Never imports candidate math."""
from pathlib import Path
from fractions import Fraction as F
import json,sys,struct,importlib.util,traceback
import reference as independent
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'examples/physics-contact-wrench-producer-2276'))
from trace_decode import decode_packet
spec=importlib.util.spec_from_file_location('coupled_physical',Path(__file__).with_name('physical-observer.py'));physical=importlib.util.module_from_spec(spec);spec.loader.exec_module(physical)
def need(ok,message):
    if not ok:raise ValueError(message)
def same(a,b):return json.dumps(a,sort_keys=True,separators=(',',':'))==json.dumps(b,sort_keys=True,separators=(',',':'))
def main(path,out):
    raw=decode_packet(json.loads(path.read_text()));packet=physical.decode(raw);result=dict(status='NOT_COMPLETED',firstFailure=None,WorldCalls=0,candidateCalls=0,maxima={},rows=[])
    try:
        world=next(w for w in packet['trace']['worlds'] if w['id']==packet['worldId']);attempt=next(a for a in world['history'] if a['attempt']==packet['attemptId']);records=attempt['records'];queries=[e for e in records if e['kind']=='geometry-query'];plans=[e for e in records if e['kind']=='coupled-plan'];events=[e for e in records if e['kind']=='impulse-application'];need(len(plans)==1,'Exactly one real prewarm plan record');need(queries,'Actual force query');query=queries[0];plan=plans[0];point=query['result']['points'][0];need(len(query['result']['points'])==1 and query['result']['feature']['kind']=='FACE' and query['result']['feature']['owner']=='b','Actual single native dynamic face');need(records.index(plan)<next((i for i,e in enumerate(records) if e['kind']=='impulse-application'),len(records)),'Freeze before any application')
        b=query['bodyB'];need(b['kind']=='dynamic' and b['inverseMass']==1 and b['shape']['halfExtentsM']==[.5,.5,.5] and b['angularVelocityRadps']==[0,0,0],'Independent physical unit cube/free-spin admission');p=independent.vec(point['pointM']);com=independent.vec(b['positionM']);free=independent.vec(b['velocityMps']);omega=independent.vec(b['angularVelocityRadps']);axis=query['result']['feature']['axis'];native=physical.native(query['pair']['b']);n=native['axes'][int(axis)];provided=[F(v) for v in query['result']['exactNormalDirection']]
        if independent.dot(n,provided)<0:n=independent.scale(n,F(-1))
        need(independent.dot(n,n)==1 and independent.cross(n,provided)==[0,0,0] and independent.dot(n,provided)>0,'Independent exact native axis correspondence')
        for key in ['a','b','midpoint']:need([F(x) for x in point['exact'][key]]==p,'Exact native endpoint equals represented anchor')
        r=independent.solve(p,com,free,omega,n);certificate=plan['result']['certificate'];need([[F(x) for x in row] for row in certificate['physicalK']]==r['K'],'Virtual-unit-impulse physical matrix equals candidate certificate');need([F(x) for x in certificate['exactImpulseNs']]==r['J'],'Independent Gaussian exact target');need([F(x) for x in certificate['nativeUnitNormal']]==n,'Native certificate axis');need(F(certificate['exactNormalNs'])==r['N'] and [F(x) for x in certificate['exactTangentNs']]==r['T'] and F(certificate['exactConeMarginSquared'])==r['margin'],'Independent native N/T/static branch')
        inputs=plan['input'];need(independent.vec(inputs['pointM'])==p and independent.vec(inputs['comM'])==com and inputs['orientationXYZW']==b['orientationXYZW'] and independent.vec(inputs['freeVelocityMps'])==free and independent.vec(inputs['freeAngularVelocityRadps'])==omega,'Target input comes from actual prewarm query bodies');need(plan['hostStep']==1,'First host interval only')
        result['rows'].append(dict(independentVirtualK=independent.text(r['K']),independentGaussianJ=independent.text(r['J']),nativeN=independent.text(r['N']),nativeT=independent.text(r['T']),exactMargin=independent.text(r['margin']),applications=len(events)))
        if packet.get('rejected') is not None:
            need(packet['caseId']=='after' and r['status']=='COUPLED_DYNAMIC_REQUIRED' and plan['result']['status']=='COUPLED_DYNAMIC_REQUIRED','Exact outside-static refusal');need(not events and not any(e['kind'] in ['cache-init','pose-correction','attempt-prepared'] for e in records),'Refuse before any cache/application/correction/prepare');need(packet['rejected']['code']=='COUPLED_DYNAMIC_REQUIRED','Typed dynamic refusal')
            need(same(raw['before'],raw['after']) and same(raw['privateBefore'],raw['privateAfter']),'Accepted state/time/cache/raw private rollback');need(same(raw['recording'],raw['rejected']['beforeRecording']) and same(raw['rejected']['modelBefore'],raw['rejected']['modelAfter']),'Recording and model preserved');result['status']='PASS_EXPECTED_DYNAMIC_PROFILE_REFUSAL_BEFORE_APPLICATION';result['dynamicPhysicalQualification']='NOT_SUPPORTED_NO_GO_NOT_A_PHYSICAL_PASS'
        else:
            need(packet['caseId'] in ['before','at'] and r['status']=='STATIC_TARGET' and plan['result']['status']=='STATIC_TARGET','Actual static exact branch');need(len(events)==64,'Original64 actual apply slots');need(all(e['eventKind']=='coupled-static' for e in events),'No old scalar normal/tangent route')
            first=events[0];need(first['branch']['targetApplied'] is True and independent.vec(first['impulseOnBNs'])==r['J'],'Actual total world J applied once without public-normal reconstruction')
            for i,e in enumerate(events):
                need(e['branch']['slot']==i+1 and e['branch']['hostStep']==1 and e['branch']['targetApplied']==(i==0) and e['branch']['zeroSlot']==(i!=0),'Frozen slot bookkeeping');need(independent.vec(e['cacheAfter']['tangentNs'])==r['T'] and F(e['cacheAfter']['normalNs'])==r['N'],'Exact native N/T cache matches independent target');need([F(x) for x in e['branch']['nativeNormal']]==n,'Native cache provenance')
                plane=abs(independent.dot(independent.vec(e['cacheAfter']['tangentNs']),independent.vec(e['normal'])));result['maxima']['combinedCacheCurrentTangentPlaneNs']=max(result['maxima'].get('combinedCacheCurrentTangentPlaneNs',0),float(plane));need(plane<=F(1,10**12),'Combined event native cache current represented tangent plane gate')
                if i:need(independent.vec(e['impulseOnBNs'])==[0,0,0],'All63 later actual impulses exactly zero')
            rawWorld=next(w for w in raw['trace']['worlds'] if physical.decode(w['id'])==packet['worldId']);rawAttempt=next(a for a in rawWorld['history'] if physical.decode(a['attempt'])==packet['attemptId']);rawEvents=[e for e in rawAttempt['records'] if e['kind']=='impulse-application']
            for e in rawEvents[1:]:need(same(e['bodyABefore'],e['bodyAAfter']) and same(e['bodyBBefore'],e['bodyBAfter']),'Zero actual calls preserve all recorded body words')
            result['status']='PASS_INDEPENDENT_COUPLED_TARGET_ONCE_NATIVE_CACHE';result['actualTargetApplications']=1;result['actualZeroApplications']=63
    except Exception as e:result['status']='FAIL_INDEPENDENT_COUPLED_TARGET';result['firstFailure']=dict(type=type(e).__name__,message=str(e),traceback=traceback.format_exc())
    with out.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(dict(status=result['status'],firstFailure=result['firstFailure'])));return int(result['firstFailure'] is not None)
if __name__=='__main__':sys.exit(main(Path(sys.argv[1]).resolve(),Path(sys.argv[2]).resolve()))
