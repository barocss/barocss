"""Fixed six-sample independent observer. No package/candidate imports or solver calls."""
from fractions import Fraction as F
from decimal import Decimal, localcontext
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
MODULES = {}
for name,path,sha in (
        ('C','examples/physics-coupled-cubes-floor-2276/trajectory-oracle.py','1a6258d7ca05061b29b37e590d9245fb80b87ad7b449614e69f4a265779a09dc'),
        ('A','examples/physics-anisotropic-inertia-2276/oracle.py','a2520ea1a77ff227850c715b3d9599e43f29651e8d78c6e0bda61fc3b0a61e7d')):
    source = ROOT/path
    if hashlib.sha256(source.read_bytes()).hexdigest() != sha:
        raise RuntimeError('immutable candidate-free observer pin '+path)
    spec = importlib.util.spec_from_file_location('gallery_pure_'+name,source)
    module = importlib.util.module_from_spec(spec);spec.loader.exec_module(module);MODULES[name] = module
C,A = MODULES['C'],MODULES['A']
q,vec,need = C.q,C.vector,C.require
SI,VFREE,GEO,TANGENT = F.from_float(1e-10),F.from_float(1e-11),F.from_float(1e-12),F.from_float(1e-12)
SPECS = {'projectile':(64,'rigid-discrete-v1',1/120), 'elastic-box':(64,'rigid-persistent-box-v1',1/120),
         'sphere-roll':(64,'rigid-discrete-v1',1/120),'sphere-ccd':(1,'rigid-discrete-v1',1/30),
         'principal-spin':(64,'rigid-persistent-box-v1',1/120),'coupled-two':(128,'rigid-persistent-box-v1',1/120)}


def sine_cosine(angle):
    with localcontext() as context:
        context.prec = 90
        x = Decimal(angle.numerator)/Decimal(angle.denominator)
        need(abs(x)<2,'fixed small-angle analytic domain')
        square = x*x
        sine,cosine,ts,tc = x,Decimal(1),x,Decimal(1)
        for k in range(1,40):
            ts *= -square/Decimal(2*k*(2*k+1));tc *= -square/Decimal((2*k-1)*2*k)
            sine += ts;cosine += tc
        return F(sine),F(cosine)


def normalized(values):
    with localcontext() as context:
        context.prec = 90
        exact = [Decimal.from_float(C.number(value)) for value in values]
        length = sum((x*x for x in exact),Decimal(0)).sqrt()
        need(length>0,'nonzero authored quaternion')
        return [F(x/length) for x in exact]


def verify(data):
    failures,maxima = [],{}
    step,bid = None,None
    def fail(name,**details):
        failures.append({'stepIndex':step,'bodyId':bid,'gate':name,**details})
        failures.sort(key=lambda row:row['stepIndex'] if row['stepIndex'] is not None else -1)
        del failures[32:]
    def gate(name,error,limit=SI):
        value = abs(error);maxima[name] = max(maxima.get(name,F(0)),value)
        if value>limit:fail(name,residual=float(value),limit=float(limit))
    def attitude(body,target):
        actual = vec(body['orientationXYZW'],4)
        gate('orientationComponent',min(max(abs(a-b) for a,b in zip(actual,target)),max(abs(a+b) for a,b in zip(actual,target))))
    def response():
        return {'ok':not failures,'resolved':True,'executionFailure':False,
                'status':'GALLERY_SAMPLE_CONFIRMED' if not failures else 'PHYSICAL_NO_GO',
                'violations':failures,'metrics':{key:float(value) if isinstance(value,F) else value for key,value in maxima.items()},
                'certificate':{'caseId':data['caseId'],'scope':'fixed finite sample only','candidateImports':0,'worldCalls':0}}
    try:
        need(type(data) is dict and set(data)=={'caseId','model','options','commands','states'},'gallery fields')
        case = data['caseId'];need(case in SPECS,'fixed sample ID')
        count,profile,dt = SPECS[case];model,options,states = data['model'],data['options'],data['states']
        need(options=={'profile':profile,'fixedStepSeconds':dt,'broadPhase':'direct'},'fixed profile/options')
        need(model['format']=='barocss-physics-model' and model['version']==1 and model['revision']=='gallery-'+case and
             model['frame']=={'id':'world','basis':'right-handed-xyz','rotation':'local-to-world-xyzw'} and
             model['units']=={'length':'m','mass':'kg','time':'s','angle':'rad'},'authored SI model/frame')
        need(all(model[k]==[] for k in ('joints','cloths','fluids','sourceBindings')),'no extra domains')
        need(vec(model['gravityMps2'])==([0,0,0] if case=='sphere-ccd' else vec([0,-9.81,0])),'fixed gravity')
        need(len(states)==count+1 and len(data['commands'])==count,'complete fixed case')
        for i,commands in enumerate(data['commands']):
            expected = [{'kind':'angularImpulse','bodyId':'upper','angularImpulseNms':[0,.125,0]}] if case=='principal-spin' and i==0 else []
            need(commands==expected,'fixed command trace')
        definitions={b['id']:b for b in model['bodies']};colliders={c['bodyId']:c for c in model['colliders']}
        need(len(definitions)==len(model['bodies'])==len(colliders)==len(model['colliders']),'one unique collider per body')
        expected_ids = {'a-sphere','z-sphere'} if case=='sphere-ccd' else {'lower','upper','floor'} if case in ('principal-spin','coupled-two') else {'moving'} if case=='projectile' else {'moving','floor'}
        need(set(definitions)==expected_ids,'fixed body population')
        for body_id,definition in definitions.items():
            collider=colliders[body_id];need(collider['local']=={'positionM':[0,0,0],'orientationXYZW':[0,0,0,1]} and
                collider['sensor'] is False and collider['filter']=={'categoryBits':1,'maskBits':65535},'identity local unfiltered collider')
            mu=.2 if case=='sphere-roll' else 0;e=1 if case=='elastic-box' else 0
            need(collider['material']=={'restitution':e,'friction':{'static':mu,'dynamic':mu}} and
                 collider['ccd']==(case=='sphere-ccd' and body_id=='a-sphere'),'fixed material/CCD')
            if body_id!='floor':need(definition['kind']=='dynamic' and definition['inertia']=={'kind':'primitive-com','about':'com','frame':'body-local'},'primitive dynamic mass')
        for body_id,definition in definitions.items():
            if body_id=='floor':
                expected_shape={'kind':'box','halfExtentsM':[3,.25,2] if case=='sphere-roll' else [2,.5,2]}
                expected_position=[0,-.25 if case=='sphere-roll' else -.5,0];expected_velocity=[0,0,0];expected_q=[0,0,0,1]
                need(definition['kind']=='static','prescribed static floor')
            elif case=='sphere-ccd':
                expected_shape={'kind':'sphere','radiusM':.05};expected_position=[-.5 if body_id=='a-sphere' else .5,0,0]
                expected_velocity=[100 if body_id=='a-sphere' else -100,0,0];expected_q=[0,0,0,1]
                need(q(definition['massKg'])==1,'fixed sphere mass')
            elif case=='sphere-roll':
                expected_shape={'kind':'sphere','radiusM':.5};expected_position=[-1,.5,0];expected_velocity=[1,0,0];expected_q=[0,0,0,1]
                need(q(definition['massKg'])==1,'fixed rolling sphere mass')
            else:
                expected_shape={'kind':'box','halfExtentsM':[.25,.5,.75] if case=='principal-spin' and body_id=='upper' else [.5,.5,.5]}
                expected_position=([-1,3,0] if case=='projectile' else [0,.75,0] if case=='elastic-box' else
                    [0,5,0] if case=='principal-spin' and body_id=='upper' else [0,1.75,0] if body_id=='upper' else [0,.5,0])
                expected_velocity=[2,2,0] if case=='projectile' else [0,0,0]
                expected_q=[0,0,math.sqrt(.5),math.sqrt(.5)] if case=='principal-spin' and body_id=='upper' else [0,0,0,1]
                need(q(definition['massKg'])==2,'fixed box mass')
            need(colliders[body_id]['geometry']==expected_shape and vec(definition['initial']['positionM'])==vec(expected_position) and
                 vec(definition['initial']['orientationXYZW'],4)==vec(expected_q,4) and
                 vec(definition['initial'].get('velocityMps',[0,0,0]))==vec(expected_velocity) and
                 vec(definition['initial'].get('angularVelocityRadps',[0,0,0]))==[0,0,0],'fixed literal shape/initial motion')
        h,G = q(dt),q(9.81)
        maps=[];identity=states[0]['identity']
        for n,state in enumerate(states):
            step=n
            need(type(state['bodies']) is list and len(state['bodies'])==len(definitions) and set(b['id'] for b in state['bodies'])==set(definitions),'complete observed body schema')
            gate('clock',q(state['timeSeconds'])-q(n*dt),F(0));gate('cursor',q(state['stepIndex'])-n,F(0))
            if state['identity']!=identity:fail('identityChanged')
            if any(state[k]!=[] for k in ('joints','cloths','fluids')):fail('unexpectedDomain')
            bs={b['id']:b for b in state['bodies']};maps.append(bs)
            for bid,body in bs.items():
                for key in ('positionM','velocityMps','angularVelocityRadps'):vec(body[key])
                orientation=vec(body['orientationXYZW'],4);gate('orientationSquaredNorm',C.dot(orientation,orientation)-1,GEO)
                if body['kind']!=definitions[bid]['kind'] or body.get('sleeping') is not False:fail('kindOrSleepChanged')
                if n==0:
                    initial=definitions[bid]['initial']
                    for actual,target in zip(vec(body['positionM']),vec(initial['positionM'])):gate('authoredInitialPosition',actual-target,F(0))
                    for key in ('velocityMps','angularVelocityRadps'):
                        for actual,target in zip(vec(body[key]),vec(initial.get(key,[0,0,0]))):gate('authoredInitialMotion',actual-target,F(0))
                    attitude(body,normalized(initial['orientationXYZW']))
                if bid=='floor' and C.raw_body(body)!=C.raw_body(maps[0][bid]):fail('prescribedStaticWordsChanged')
        if failures:return response()
        if case=='coupled-two':
            result=C.verify({'caseId':'coupled-120','model':model,'options':options,'states':states})
            result['galleryCaseId']=case
            return result

        def point_geometry(state,moving_id,sphere=False):
            nonlocal bid
            contacts=state['contacts']
            for contact in contacts:
                a,b=contact['bodyAId'],contact['bodyBId']
                need({a,b}=={'floor',moving_id},'fixed support endpoints')
                normal,point=vec(contact['normalAtoB']),vec(contact['pointM'])
                for value,target in zip(normal,[0,1 if b==moving_id else -1,0]):gate('geometryNormalDirection',value-target,GEO)
                gate('geometryNormalSquared',C.dot(normal,normal)-1,GEO)
                for value in vec(contact['tangentImpulseOnBNs']):
                    if case!='sphere-roll':gate('tangentImpulseNs',value,TANGENT)
                gate('tangentPlaneNs',C.dot(normal,vec(contact['tangentImpulseOnBNs'])),TANGENT)
                floor=maps[step]['floor'];local=C.local_point(floor,point)
                extents=vec(colliders['floor']['geometry']['halfExtentsM'])
                gate('geometryFloorPlaneM',local[1]-extents[1],GEO)
                for value,extent in zip(local,extents):gate('geometryFloorBoundsM',max(F(0),abs(value)-extent),GEO)
                moving=maps[step][moving_id]
                if sphere:
                    radius=q(colliders[moving_id]['geometry']['radiusM']);delta=C.sub(point,vec(moving['positionM']));square=C.dot(delta,delta)
                    if square>(radius+GEO)**2 or square<(radius-GEO)**2:fail('geometrySphereSurfaceM')
                else:
                    local=C.local_point(moving,point);extent=vec(colliders[moving_id]['geometry']['halfExtentsM'])
                    gate('geometryMovingFacePlaneM',local[1]+extent[1],GEO)
                    for value,half in zip(local,extent):gate('geometryMovingBoundsM',max(F(0),abs(value)-half),GEO)
            return contacts

        if case=='sphere-ccd':
            step=1;bs=maps[1];hits=states[1]['ccdHits'];need(len(hits)==1,'one head-on hit')
            hit=hits[0];need(hit['bodyId']=='a-sphere' and hit['colliderId']==colliders['z-sphere']['id'],'CCD identity links')
            radii=[q(colliders[x]['geometry']['radiusM']) for x in ('a-sphere','z-sphere')]
            separation=q(1);entry_time=(separation-sum(radii))/q(200);fraction=entry_time/h
            gate('ccdTOI',q(hit['toiFraction'])-fraction,GEO)
            for value,target in zip(vec(hit['normalFixtureToBody']),[-1,0,0]):gate('ccdNormal',value-target,GEO)
            gate('ccdNormalSquared',C.dot(vec(hit['normalFixtureToBody']),vec(hit['normalFixtureToBody']))-1,GEO)
            received_time=q(hit['toiFraction'])*h
            gate('ccdUnbiasedContactDistanceM',abs(-1+q(200)*received_time)-sum(radii),GEO)
            for bid,x in (('a-sphere',-radii[0]),('z-sphere',radii[1])):
                body=bs[bid]
                for actual,target in zip(vec(body['positionM']),[x,0,0]):gate('ccdAcceptedPositionM',actual-target)
                for value in vec(body['velocityMps'])+vec(body['angularVelocityRadps']):gate('ccdInelasticRest',value)
            gate('ccdMomentumNs',q(bs['a-sphere']['velocityMps'][0])+q(bs['z-sphere']['velocityMps'][0]))
            gate('ccdImpulseNs',sum((q(c['normalImpulseNs']) for c in states[1]['contacts']),F(0))-100)
            maxima['remainingTimeIntegrated']=False;maxima['independentEntryTimeSeconds']=float(entry_time)
            return response()

        roll_cap=q(.2)*G*h;roll_total=F(2,7)
        roll_steps=(roll_total.numerator*roll_cap.denominator+roll_total.denominator*roll_cap.numerator-1)//(roll_total.denominator*roll_cap.numerator)
        def sum_prior_impulses(n):
            early=min(n,int(roll_steps));return roll_cap*early*(early-1)/2+max(0,n-early)*roll_total
        impact=next(n for n in range(1,65) if G*h*h*n*(n+1)/2>=F(1,4))
        for n,state in enumerate(states):
            step=n;bs=maps[n]
            if case=='projectile':
                bid='moving';body=bs[bid];time=n*h
                for actual,target in zip(vec(body['positionM']),[-1+2*time,3+2*time-G*h*h*n*(n+1)/2,0]):gate('projectilePositionM',actual-target)
                for actual,target in zip(vec(body['velocityMps']),[2,2-G*time,0]):gate('projectileVelocityMps',actual-target,VFREE)
                for value in vec(body['angularVelocityRadps']):gate('projectileSpin',value)
                attitude(body,[0,0,0,1])
                if state['contacts'] or state['ccdHits']:fail('unexpectedFreeContact')
            elif case=='elastic-box':
                bid='moving';body=bs[bid]
                if n<impact:y,vy=F(3,4)-G*h*h*n*(n+1)/2,-G*n*h
                else:
                    k=n-impact;y=F(1,2)+G*h*h*(impact*k-F(k*(k+1),2));vy=G*h*(impact-k)
                for actual,target in zip(vec(body['positionM']),[0,y,0]):gate('elasticDiscretePositionM',actual-target)
                for actual,target in zip(vec(body['velocityMps']),[0,vy,0]):gate('elasticVelocityMps',actual-target,VFREE)
                for value in vec(body['angularVelocityRadps']):gate('elasticSpin',value)
                attitude(body,[0,0,0,1]);contacts=point_geometry(state,bid)
                if n==impact:
                    if len(contacts)!=1:fail('oneElasticImpact')
                    gate('elasticImpulseNs',sum((q(c['normalImpulseNs']) for c in contacts),F(0))-4*G*impact*h)
                    gate('elasticImpactKineticLossJ',q(body['velocityMps'][1])**2-(G*impact*h)**2)
                elif contacts:fail('unexpectedElasticContact')
            elif case=='sphere-roll':
                bid='moving';body=bs[bid];impulse=min(n*roll_cap,roll_total);prior=sum_prior_impulses(n)
                vx,omega=1-impulse,-5*impulse
                for actual,target in zip(vec(body['positionM']),[-1+h*(n-prior),F(1,2),0]):gate('rollingPositionM',actual-target)
                for actual,target in zip(vec(body['velocityMps']),[vx,0,0]):gate('rollingVelocityMps',actual-target)
                for actual,target in zip(vec(body['angularVelocityRadps']),[0,0,omega]):gate('rollingOmegaRadps',actual-target)
                sine,cosine=sine_cosine(-5*h*prior/2);attitude(body,[0,0,sine,cosine])
                gate('rollingSlipMps',q(body['velocityMps'][0])+q(body['angularVelocityRadps'][2])/2-(1-F(7,2)*impulse))
                energy=q(body['velocityMps'][0])**2/2+q(body['angularVelocityRadps'][2])**2/20
                gate('rollingTransverseEnergyJ',energy-(F(1,2)-impulse+F(7,4)*impulse*impulse))
                contacts=point_geometry(state,bid,True)
                if n:
                    if len(contacts)!=1:fail('oneRollingSupport')
                    gate('rollingSupportImpulseNs',sum((q(c['normalImpulseNs']) for c in contacts),F(0))-G*h)
                    tangent=sum(((1 if c['bodyBId']==bid else -1)*q(c['tangentImpulseOnBNs'][0]) for c in contacts),F(0))
                    gate('rollingTangentImpulseNs',tangent+(impulse-min((n-1)*roll_cap,roll_total)))
                maxima['rollingStartsNoLaterThanStep']=int(roll_steps)
            elif case=='principal-spin':
                bid='upper';body=bs[bid];time=n*h
                for actual,target in zip(vec(body['positionM']),[0,5-G*h*h*n*(n+1)/2,0]):gate('principalFreePositionM',actual-target)
                for actual,target in zip(vec(body['velocityMps']),[0,-G*time,0]):gate('principalFreeVelocityMps',actual-target,VFREE)
                expected=[0,F(3,13),0] if n else [0,0,0]
                for actual,target in zip(vec(body['angularVelocityRadps']),expected):gate('principalOmega',actual-target)
                sine,cosine=sine_cosine(F(3,26)*time)
                with localcontext() as context:
                    context.prec=90;root2=F(Decimal(2).sqrt())
                attitude(body,[sine/root2,sine/root2,cosine/root2,cosine/root2])
                momentum=A.tensor_action(vec(body['orientationXYZW'],4),[F(13,24),F(5,12),F(5,24)],vec(body['angularVelocityRadps']))
                for value,target in zip(momentum,[0,F(1,8) if n else 0,0]):gate('principalAngularMomentumNms',value-target)
                gate('principalRotationalEnergyJ',C.dot(vec(body['angularVelocityRadps']),momentum)/2-(F(3,208) if n else 0))
                clearance=q(body['positionM'][1])-q(bs['lower']['positionM'][1])-F(1,2)
                if clearance<=0 or clearance*clearance<=F(7,8):fail('principalUpperNoContactClearance')
                if any('upper' in (c['bodyAId'],c['bodyBId']) for c in state['contacts']):fail('unexpectedUpperContact')
                bid='lower'
                for actual,target in zip(vec(bs[bid]['positionM']),[0,F(1,2),0]):gate('lowerSupportedPositionM',actual-target)
                for value in vec(bs[bid]['velocityMps'])+vec(bs[bid]['angularVelocityRadps']):gate('lowerSupportedMotion',value)
                attitude(bs[bid],[0,0,0,1]);contacts=point_geometry(state,'lower')
                if n:
                    if len(contacts)!=1:fail('oneLowerSupportContact')
                    gate('lowerSupportImpulseNs',sum((q(c['normalImpulseNs']) for c in contacts),F(0))-2*G*h)
        return response()
    except (C.Invalid,A.Invalid,KeyError,TypeError,ValueError,IndexError,OverflowError,ZeroDivisionError) as error:
        if failures:return response()
        return {'ok':False,'resolved':False,'executionFailure':True,'status':'INVALID_INPUT','violations':[],
                'metrics':{},'reason':str(error)}


def main():
    try:
        raw=sys.stdin.buffer.readline(2*1024*1024+1)
        need(0<len(raw)<=2*1024*1024 and raw.endswith(b'\n') and sys.stdin.buffer.read(1)==b'','one bounded gallery request+EOF')
        packet=json.loads(raw)
        need(packet['format']=='physics-gallery-v1','gallery wire format')
        result=verify(C.restore_words(packet['data'],packet['numericWordsF64leHex']))
    except (C.Invalid,A.Invalid,KeyError,TypeError,ValueError,OverflowError) as error:
        result={'ok':False,'resolved':False,'executionFailure':True,'violations':[],'metrics':{},'reason':str(error)}
    encoded=json.dumps(result,separators=(',',':'),allow_nan=False)
    need(len(encoded.encode())<=65536,'64KiB reply cap');print(encoded)


if __name__=='__main__':main()
