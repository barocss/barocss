"""Fixed three-chain1024 horizon observer; unchanged analytic event/envelope equations, no engine imports."""
from decimal import Decimal, localcontext
from fractions import Fraction as F
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
PURE = [('two','examples/physics-coupled-cubes-floor-2276/oracle.py',
         'c9bd37d91bb97bf584ddc0a2bc80a0e60fb8cbf26d049b97f5668315e5839f66'),
        ('three','examples/physics-three-cubes-floor-2276/oracle.py',
         '87f5b8f44bbfcd5e3b669843d1fe185696bd8040d7e79e6cb723a2d673382dce')]
MODULES = {}
for name,relative,expected in PURE:
    path = ROOT/relative
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise RuntimeError('immutable pure reference source pin: '+relative)
    spec = importlib.util.spec_from_file_location('contact_window_pure_'+name,path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    MODULES[name] = module
P = MODULES['three']
Invalid,require,q,number,vector = P.Invalid,P.require,P.q,P.number,P.vector
dot,add,sub,scale = P.dot,P.add,P.sub,P.scale
SI,VELOCITY,GEOMETRY,TANGENT = F.from_float(1e-10),F.from_float(1e-11),F.from_float(1e-12),F.from_float(1e-12)
LINE = 2*1024*1024
SPECS = {family+'-'+str(rate):(family,rate,rate) for family in ('two','three') for rate in (60,120,240)}
SPECS.update({'long-two':('two',120,512),'long-three':('three',120,1024)})


def project(family,free,rows,bounds):
    if family == 'two':
        return MODULES['two'].project_two(free,rows,bounds,[F(2),F(2)])
    return P.project_three(free,rows,bounds)


def decimal(value):
    return Decimal(value.numerator)/Decimal(value.denominator)


def continuous_y(time,initial,rest,gravity):
    return max(rest,initial-gravity*time*time/2)


def verify(data):
    violations,maxima = [],{}
    step,body_id = None,None
    certificate = {'candidateImports':0,'candidateSolves':0,'worldCalls':0,
                   'scope':'fixed equal-mass aligned inelastic two/three cube chains',
                   'aggregateMeanIsForceCentroid':False,'generalAnisotropicContact':False,
                   'convergencePolicy':'FIRST_ORDER_POSITION_ENVELOPE_EVENT_QUANTIZATION_NO_RATIO',
                   'supportPolicy':'ROUNDING_FLOOR'}

    def fail(name,**details):
        violations.append({'gate':name,'stepIndex':step,'bodyId':body_id,**details})
        violations.sort(key=lambda entry:entry['stepIndex'] if entry['stepIndex'] is not None else -1)
        del violations[32:]

    def gate(name,value,limit=SI):
        value = abs(value)
        maxima[name] = max(maxima.get(name,F(0)),value)
        if value > limit:
            fail(name,residual=float(value),limit=float(limit))

    try:
        require(type(data) is dict and set(data) == {'caseId','model','options','startStep','endStep','states'},'window fields')
        require(data['caseId'] in SPECS,'fixed case ID')
        family,rate,total = SPECS[data['caseId']]
        size = 2 if family == 'two' else 3
        start,end = number(data['startStep']),number(data['endStep'])
        require(start.is_integer() and end.is_integer(),'integer window cursors')
        start,end = int(start),int(end)
        anchors = sorted(set([0,32,total]+list(range(128,total,128))))
        require(start in anchors and anchors.index(start)+1 < len(anchors) and
                end == anchors[anchors.index(start)+1] and 1 <= end-start <= 128,'preregistered window')
        model,options,states = data['model'],data['options'],data['states']
        require(options == {'profile':'rigid-persistent-box-v1','fixedStepSeconds':1/rate,'broadPhase':'direct'},'original direct profile/dt')
        h,g = q(options['fixedStepSeconds']),q(9.81)
        require(model.get('format') == 'barocss-physics-model' and model.get('version') == 1 and
                model.get('units') == {'length':'m','mass':'kg','time':'s','angle':'rad'},'SI model')
        require(model.get('frame') == {'id':'world','basis':'right-handed-xyz','rotation':'local-to-world-xyzw'},'frame')
        require(vector(model.get('gravityMps2')) == [0,-g,0] and all(model.get(key) == []
                for key in ('joints','cloths','fluids','sourceBindings')),'original gravity/no extra domains')
        definitions,colliders = model['bodies'],model['colliders']
        require(type(definitions) is list and len(definitions) == size+1 and
                type(colliders) is list and len(colliders) == size+1,'existing body population')
        ids = [body['id'] for body in definitions]
        require(all(type(value) is str for value in ids) and len(set(ids)) == size+1,'unique authored IDs')
        authored = dict(zip(ids,definitions))
        dynamic = [body for body in definitions if body['kind'] == 'dynamic']
        fixed = [body for body in definitions if body['kind'] == 'static']
        require(len(dynamic) == size and len(fixed) == 1,'fixed dynamic/static population')
        dynamic.sort(key=lambda body:q(body['initial']['positionM'][1]))
        moving,floor = [body['id'] for body in dynamic],fixed[0]['id']
        heights = [F(1,2),F(7,4)] if size == 2 else [F(1,2),F(3,2),F(11,4)]
        positions = {body:[F(0),height,F(0)] for body,height in zip(moving,heights)}
        positions[floor] = [F(0),F(-1,2),F(0)]
        half,by_collider = {},{}
        for collider in colliders:
            bid = collider['bodyId']
            require(bid in authored and bid not in by_collider,'one actual collider per body')
            expected_half = [2,.5,2] if bid == floor else [.5,.5,.5]
            require(collider['geometry'] == {'kind':'box','halfExtentsM':expected_half},'fixed extents')
            require(collider.get('material') == {'restitution':0,'friction':{'static':0,'dynamic':0}} and
                    collider.get('local') == {'positionM':[0,0,0],'orientationXYZW':[0,0,0,1]} and
                    collider.get('sensor') is False and collider.get('ccd') is False and
                    collider.get('filter') == {'categoryBits':1,'maskBits':65535},'original unfiltered identity-local material')
            half[bid],by_collider[bid] = vector(expected_half),collider
        for bid,body in authored.items():
            initial = body['initial']
            require(vector(initial['positionM']) == positions[bid] and
                    vector(initial['orientationXYZW'],4) == [0,0,0,1],'authored exact pose')
            if bid != floor:
                require(q(body['massKg']) == 2 and body['inertia'] == {'kind':'primitive-com','about':'com','frame':'body-local'} and
                        vector(initial['velocityMps']) == [0,0,0] and vector(initial['angularVelocityRadps']) == [0,0,0],
                        'mass2 primitiveCOM/rest')
        require(type(states) is list and len(states) == end-start+1,'full actual window')
        maps,identity = [],states[0]['identity']
        require(identity.get('profile') == options['profile'],'public profile identity')
        # These authored constants are only 0, -1/2 and 1: exact binary64 dyadics.
        static_words = b''.join(P.word(float(value)) for key in ('positionM','velocityMps','orientationXYZW','angularVelocityRadps')
                               for value in (positions[floor] if key == 'positionM' else [0,0,0,1] if key == 'orientationXYZW' else [0,0,0]))
        for local,state in enumerate(states):
            step = start+local
            require(type(state.get('bodies')) is list and len(state['bodies']) == size+1 and
                    set(body.get('id') for body in state['bodies']) == set(ids),'actual complete body schema')
            gate('observedStep',q(state['stepIndex'])-step,F(0))
            gate('observedClockSeconds',q(state['timeSeconds'])-q(step*number(options['fixedStepSeconds'])),F(0))
            if state['identity'] != identity or any(state.get(key) != [] for key in ('joints','ccdHits','cloths','fluids')):
                fail('identityOrDomainChanged')
            bodies = {body['id']:body for body in state['bodies']}
            maps.append(bodies)
            for bid,body in bodies.items():
                body_id = bid
                require(body['kind'] == authored[bid]['kind'] and body.get('sleeping') is False,'actual kind/awake schema')
                for key in ('positionM','velocityMps','angularVelocityRadps'):
                    vector(body[key])
                orientation = vector(body['orientationXYZW'],4)
                gate('authoredOrientationSquaredNorm',dot(orientation,orientation)-1,GEOMETRY)
                positive = max(abs(value-target) for value,target in zip(orientation,[0,0,0,1]))
                negative = max(abs(value+target) for value,target in zip(orientation,[0,0,0,1]))
                gate('authoredOrientationComponent',min(positive,negative))
                if bid == floor and P.raw_body(body) != static_words:
                    fail('prescribedStaticWordsChanged')
                if bid in moving:
                    for value in vector(body['angularVelocityRadps']):
                        gate('omegaRadps',value)
                    for axis in (0,2):
                        gate('lateralPositionM',q(body['positionM'][axis]))
                        gate('lateralVelocityMps',q(body['velocityMps'][axis]))
                if step == 0:
                    for value,target in zip(vector(body['positionM']),positions[bid]):
                        gate('actualInitialPositionM',value-target,F(0))
                    for value in vector(body['velocityMps'])+vector(body['angularVelocityRadps']):
                        gate('actualInitialMotion',value,F(0))
            body_id = None
            require(type(state.get('contacts')) is list and len(state['contacts']) <= size*(size+1)//2,'bounded contacts')
            if step == 0 and state['contacts']:
                fail('initialContactConvention')
        rows = [[F(int(column == 0)) for column in range(size)]]
        rows += [[F(-1 if column == row-1 else 1 if column == row else 0) for column in range(size)]
                 for row in range(1,size)]
        bounds = [F(1,2)]+[F(1)]*(size-1)
        chain = [floor]+moving
        edges = {frozenset((chain[i],chain[i+1])):i for i in range(size)}
        rest,upper_y0 = F(size)-F(1,2),heights[-1]
        impact_step = next(index for index in range(1,total+1) if g*h*h*index*(index+1)/2 >= F(1,4))
        with localcontext() as context:
            context.prec = 90
            toi_decimal = (decimal(F(1,2)/g)).sqrt()
            toi = F(toi_decimal)
        gate('discreteImpactTimeEnvelopeSeconds',max(F(0),abs(impact_step*h-toi)-h))
        upper_sum,projection_work = F(0),F(0)
        first_upper,samples = None,[]
        pre_position,pre_energy = None,None
        for local,bodies in enumerate(maps):
            step = start+local
            time = step*h
            top = bodies[moving[-1]]
            y,velocity = q(top['positionM'][1]),q(top['velocityMps'][1])
            discrete_y = max(rest,upper_y0-g*h*h*step*(step+1)/2)
            discrete_v = -g*time if step < impact_step else F(0)
            gate('upperDiscreteClosedPositionM',y-discrete_y)
            gate('upperDiscreteClosedVelocityMps',velocity-discrete_v,VELOCITY)
            target_y = continuous_y(time,upper_y0,rest,g)
            envelope = g*time*h/2
            error = abs(y-target_y)
            maxima['maxContinuousPositionErrorM'] = max(maxima.get('maxContinuousPositionErrorM',F(0)),error)
            maxima['maxContinuousPositionEnvelopeM'] = max(maxima.get('maxContinuousPositionEnvelopeM',F(0)),envelope)
            gate('continuousPositionEnvelopeExcessM',max(F(0),error-envelope))
            if abs(time-toi) > h:
                continuous_v = -g*time if time < toi else F(0)
                value = abs(velocity-continuous_v)
                maxima['maxAwayFromImpactVelocityErrorMps'] = max(maxima.get('maxAwayFromImpactVelocityErrorMps',F(0)),value)
                gate('awayFromImpactVelocityMps',value,VELOCITY)
            if step >= impact_step:
                maxima['maxSupportRoundoffPositionM'] = max(maxima.get('maxSupportRoundoffPositionM',F(0)),abs(y-rest))
            if step == rate//10:
                pre_position = abs(y-(upper_y0-g*time*time/2))
                pre_energy = abs(velocity*velocity+2*g*(y-upper_y0))
            samples.append({'step':step,'yM':float(y),'vY':float(velocity),'positionEnvelopeM':float(envelope)})
            if local == 0:
                continue
            before,after = maps[local-1],bodies
            vf = [q(before[bid]['velocityMps'][1])-g*h for bid in moving]
            pf = [q(before[bid]['positionM'][1])+vf[k]*h for k,bid in enumerate(moving)]
            position,position_dual,position_cost = project(family,pf,rows,bounds)
            active = [row for row in range(size) if dot(rows[row],position) == bounds[row]]
            target,selected,velocity_cost = project(family,vf,[rows[row] for row in active],[F(0)]*len(active))
            reference_lambda = [F(0)]*size
            for row,value in zip(active,selected):
                reference_lambda[row] = value
            impulses = {bid:[F(0)]*3 for bid in moving}
            observed,normal_scale,touched = [F(0)]*size,[F(1)]*size,set()
            for contact in states[local]['contacts']:
                a,b = contact.get('bodyAId'),contact.get('bodyBId')
                require(a in ids and b in ids and a != b and
                        contact.get('colliderAId') == by_collider[a]['id'] and
                        contact.get('colliderBId') == by_collider[b]['id'],'actual contact links')
                row = edges.get(frozenset((a,b)))
                if row is None:
                    fail('unexpectedContactEdge'); continue
                if row in touched:
                    fail('duplicateContactEdge'); continue
                touched.add(row)
                if row == size-1 and first_upper is None:
                    first_upper = step
                if row not in active:
                    fail('unexpectedNonbindingContact')
                normal,point,tangent = vector(contact['normalAtoB']),vector(contact['pointM']),vector(contact['tangentImpulseOnBNs'])
                impulse = q(contact['normalImpulseNs'])
                if impulse < 0:
                    fail('strictNonnegativeImpulse')
                low,high = chain[row],chain[row+1]
                direction = 1 if a == low else -1
                gate('geometryNormalSquared',dot(normal,normal)-1,GEOMETRY)
                for value,expected in zip(normal,[0,direction,0]):
                    gate('geometryNormalDirection',value-expected,GEOMETRY)
                for value in tangent:
                    gate('tangentImpulseNs',value,TANGENT)
                for bid,side in ((low,1),(high,-1)):
                    body_id = bid
                    orientation = vector(after[bid]['orientationXYZW'],4)
                    if dot(orientation,orientation) == 0:
                        fail('zeroObservedQuaternion'); continue
                    point_local = P.local_point(after[bid],point)
                    gate('geometryRepresentativeFacePlaneM',point_local[1]-side*half[bid][1],GEOMETRY)
                    for value,extent in zip(point_local,half[bid]):
                        gate('geometryRepresentativeBoundsM',max(F(0),abs(value)-extent),GEOMETRY)
                body_id = None
                observed[row],normal_scale[row] = impulse,direction*normal[1]
                on_b = add(scale(normal,impulse),tangent)
                for bid,value in ((a,scale(on_b,-1)),(b,on_b)):
                    if bid in impulses:
                        impulses[bid] = add(impulses[bid],value)
                if row == size-1:
                    upper_sum += impulse*normal_scale[row]
            for row in range(size):
                if reference_lambda[row] > 0 and row not in touched:
                    fail('missingRequiredContact',row=row)
                gate('globalNormalMultiplierNs',observed[row]*normal_scale[row]-reference_lambda[row])
            if (step >= impact_step) != (size-1 in touched):
                fail('closedDiscreteImpactContactPresence',expectedImpactStep=impact_step)
            actual_v,actual_p = [q(after[bid]['velocityMps'][1]) for bid in moving],[q(after[bid]['positionM'][1]) for bid in moving]
            for k,bid in enumerate(moving):
                body_id = bid
                gate('globalVelocityProjectionMps',actual_v[k]-target[k])
                gate('globalPositionProjectionM',actual_p[k]-position[k])
                reaction = sum((rows[row][k]*normal_scale[row]*observed[row] for row in range(size)),F(0))
                gate('globalActualJStationarityNs',2*(actual_v[k]-vf[k])-reaction)
                residual = sub(scale(sub(vector(after[bid]['velocityMps']),vector(before[bid]['velocityMps'])),F(2)),
                               add([F(0),-2*g*h,F(0)],impulses[bid]))
                for value in residual:
                    gate('bodyMomentumNs',value)
                projection_work += 2*g*(actual_p[k]-pf[k])
            body_id = None
            for row in range(size):
                gate('globalPositionPrimalM',max(F(0),bounds[row]-dot(rows[row],actual_p)))
                if row in active:
                    speed = normal_scale[row]*dot(rows[row],actual_v)
                    gate('globalNormalPrimalMps',max(F(0),-speed))
                    gate('globalNormalComplementarityJ',observed[row]*speed)
            actual_ke = F(0)
            for bid in moving:
                linear_ke = dot(vector(after[bid]['velocityMps']),vector(after[bid]['velocityMps']))
                rotational_ke = dot(vector(after[bid]['angularVelocityRadps']),vector(after[bid]['angularVelocityRadps']))/6
                actual_ke += linear_ke+rotational_ke
            gate('globalNormalKineticEnergyJ',actual_ke-dot(target,target))
            gate('globalNormalEnergyGrowthJ',max(F(0),actual_ke-dot(vf,vf)))
        step,body_id = end,None
        def cumulative(time):
            return F(0) if time < toi else 2*g*time
        # Fixed anchors must not straddle the ambiguous one-step impulse band at an endpoint.
        require(all(time == 0 or abs(time-toi) > h for time in (start*h,end*h)),'fixed endpoints outside impact band')
        continuous_impulse = cumulative(end*h)-cumulative(start*h)
        gate('maxContinuousImpulseWindowResidualNs',upper_sum-continuous_impulse)
        metrics = {key:float(value) for key,value in maxima.items()}
        metrics.update({'precontactPositionErrorM':None if pre_position is None else float(pre_position),
                        'precontactEnergyErrorJ':None if pre_energy is None else float(pre_energy),
                        'windowUpperImpulseNs':float(upper_sum),'continuousUpperImpulseWindowNs':float(continuous_impulse),
                        'reconstructedProjectionPotentialWorkJ':float(projection_work)})
        certificate.update({'caseId':data['caseId'],'startStep':start,'endStep':end,'transitions':end-start,
            'continuousTOISeconds':float(toi),'continuousInstantaneousImpactImpulseNs':float(2*g*toi),
            'discreteImpactStep':impact_step,'discreteImpactTimeSeconds':float(impact_step*h),
            'firstObservedUpperContactStep':first_upper,'upperSamples':samples,
            'firstPhysicalFailureStep':violations[0]['stepIndex'] if violations else None,
            'eventVelocityUniformOrderClaim':False,'privateAppliedWrenchClaim':False})
        return {'ok':not violations,'resolved':True,'executionFailure':False,
                'status':'CONTACT_WINDOW_CONFIRMED' if not violations else 'PHYSICAL_NO_GO',
                'violations':violations,'metrics':metrics,'certificate':certificate}
    except (Invalid,MODULES['two'].Invalid,KeyError,TypeError,ValueError,OverflowError,ZeroDivisionError,IndexError) as error:
        return {'ok':False,'resolved':False,'executionFailure':True,'status':'INVALID_INPUT',
                'reason':str(error),'violations':violations,'metrics':{},'certificate':certificate}


def main():
    try:
        raw = sys.stdin.buffer.readline(LINE+1)
        require(0 < len(raw) <= LINE and raw.endswith(b'\n') and sys.stdin.buffer.read(1) == b'','one bounded request+EOF')
        envelope = json.loads(raw,object_pairs_hook=P.reject_duplicates)
        require(envelope['format'] == 'contact-convergence-window-v1','window format')
        response = verify(P.restore_words(envelope['data'],envelope['numericWordsF64leHex']))
    except (Invalid,KeyError,TypeError,ValueError,OverflowError) as error:
        response = {'ok':False,'resolved':False,'executionFailure':True,'status':'INVALID_INPUT',
                    'reason':str(error),'violations':[],'metrics':{},'certificate':{}}
    encoded = json.dumps(response,separators=(',',':'),allow_nan=False)
    require(len(encoded.encode()) <= 65536,'64KiB reply cap')
    print(encoded)


if __name__ == '__main__':
    main()
