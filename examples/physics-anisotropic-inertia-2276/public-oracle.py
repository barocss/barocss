"""Exact precontact/free-principal-spin observer, independent of production integration."""
from decimal import Decimal, localcontext
from fractions import Fraction
import json
import math
import sys
from oracle import (Invalid, LINE_BYTES, GATE, require, number, rational, vector,
                    words, restore_words, rotated, tensor_action, dot, same_words)

GEOMETRY = Fraction.from_float(1e-12)
VELOCITY = Fraction.from_float(1e-11)
TANGENT = Fraction.from_float(1e-12)
SPECS = {'natural-120-64': (False, 120, 64),
         'principal-spin-120-64': (True, 120, 64),
         'natural-60': (False, 60, 6), 'natural-120': (False, 120, 12),
         'natural-240': (False, 240, 24),
         'principal-spin-60': (True, 60, 6), 'principal-spin-120': (True, 120, 12),
         'principal-spin-240': (True, 240, 24)}


def principal_quaternion(time):
    with localcontext() as context:
        context.prec = 90
        angle = Decimal(time.numerator) / Decimal(time.denominator) * Decimal(3) / Decimal(26)
        require(abs(angle) < Decimal('.1'), 'fixed small-angle reference domain')
        square = angle * angle
        sine = term_sine = angle
        cosine = term_cosine = Decimal(1)
        for order in range(1, 40):
            term_sine *= -square / Decimal((2*order)*(2*order+1))
            term_cosine *= -square / Decimal((2*order-1)*(2*order))
            sine += term_sine
            cosine += term_cosine
        root_two = Decimal(2).sqrt()
        return [Fraction(sine/root_two), Fraction(sine/root_two),
                Fraction(cosine/root_two), Fraction(cosine/root_two)]


def local_point(body, point):
    relative = [value-rational(center) for value, center in zip(point, body['positionM'])]
    return rotated(vector(body['orientationXYZW'], 4), relative, backwards=True)


def extent_y(body, half):
    orientation = vector(body['orientationXYZW'], 4)
    result = Fraction(0)
    for axis in range(3):
        basis = [Fraction(int(index == axis)) for index in range(3)]
        result += abs(rotated(orientation, basis)[1]) * half[axis]
    return result


def physical_inertia_action(body, impulse):
    return tensor_action(vector(body['orientationXYZW'], 4),
                         [Fraction(13,24), Fraction(5,12), Fraction(5,24)], impulse)


def verify(data):
    violations = []
    maxima = {}
    step = None
    try:
        require(type(data) is dict and data.get('caseId') in SPECS, 'fixed case identity')
        spin, rate, count = SPECS[data['caseId']]
        model, options, states, commands = (data[key] for key in ('model','options','states','commands'))
        require(type(model) is dict and type(options) is dict, 'model/options objects')
        require(options == {'profile':'rigid-persistent-box-v1','fixedStepSeconds':1/rate,
                            'broadPhase':'direct'}, 'fixed public options')
        require(model.get('format') == 'barocss-physics-model' and model.get('version') == 1,
                'public model format')
        require(model.get('frame') == {'id':'world','basis':'right-handed-xyz',
                                       'rotation':'local-to-world-xyzw'}, 'SI frame')
        require(model.get('units') == {'length':'m','mass':'kg','time':'s','angle':'rad'}, 'SI units')
        require(all(model.get(key) == [] for key in ('joints','cloths','fluids','sourceBindings')),
                'no additional domains or sources')
        require(vector(model.get('gravityMps2')) == vector([0,-9.81,0]), 'original gravity')
        authored = model.get('bodies')
        colliders = model.get('colliders')
        require(type(authored) is list and len(authored) == 3 and
                set(body.get('id') for body in authored) == {'lower','upper','floor'}, 'fixed body population')
        authored = {body['id']:body for body in authored}
        require(type(colliders) is list and len(colliders) == 3, 'fixed collider population')
        by_collider = {}
        halves = {'lower':vector([.5,.5,.5]),'upper':vector([.25,.5,.75]),
                  'floor':vector([2,.5,2])}
        for collider in colliders:
            body_id = collider.get('bodyId')
            require(body_id in authored and body_id not in by_collider, 'one collider per body')
            require(type(collider.get('id')) is str, 'collider identity')
            require(collider.get('geometry',{}).get('kind') == 'box' and
                    vector(collider['geometry']['halfExtentsM']) == halves[body_id], 'fixed primitive extents')
            require(collider.get('local') == {'positionM':[0,0,0],'orientationXYZW':[0,0,0,1]} and
                    collider.get('sensor') is False and collider.get('ccd') is False and
                    collider.get('filter') == {'categoryBits':1,'maskBits':65535}, 'identity-local unfiltered boxes')
            require(collider.get('material') == {'restitution':0,'friction':{'static':0,'dynamic':0}},
                    'zero material coefficients')
            by_collider[body_id] = collider
        expected_q = ([0,0,math.sqrt(.5),math.sqrt(.5)] if spin
                      else [.1,.2,.3,math.sqrt(.86)])
        positions = {'lower':[0,.5,0],'upper':[0,5,0],'floor':[0,-.5,0]}
        for body_id, body in authored.items():
            require(body.get('kind') == ('static' if body_id == 'floor' else 'dynamic'), 'fixed body kind')
            initial = body.get('initial',{})
            require(vector(initial.get('positionM')) == vector(positions[body_id]), 'fixed initial position')
            require(vector(initial.get('orientationXYZW'),4) == vector(expected_q if body_id == 'upper'
                                                                        else [0,0,0,1],4), 'fixed initial orientation')
            if body_id != 'floor':
                require(rational(body.get('massKg')) == 2 and
                        body.get('inertia') == {'kind':'primitive-com','about':'com','frame':'body-local'},
                        'physical mass and primitive inertia')
                require(vector(initial.get('velocityMps')) == [0,0,0] and
                        vector(initial.get('angularVelocityRadps')) == [0,0,0], 'authored rest')
        require(type(states) is list and len(states) == count+1, 'complete fixed trajectory')
        require(type(commands) is list and len(commands) == count, 'complete command trace')
        for index, command in enumerate(commands):
            expected = ([{'kind':'angularImpulse','bodyId':'upper','angularImpulseNms':[0,.125,0]}]
                        if spin and index == 0 else [])
            require(command == expected, 'fixed actual commands')
        h = rational(options['fixedStepSeconds'])
        gravity = rational(model['gravityMps2'][1])
        identity = states[0].get('identity')
        require(type(identity) is dict and identity.get('profile') == options['profile'], 'public identity')
        maps = []

        def fail(name, **details):
            if len(violations) < 32:
                violations.append({'gate':name,'step':step,**details})

        def gate(name, value, limit=GATE):
            value = abs(value)
            maxima[name] = max(maxima.get(name,Fraction(0)),value)
            if value > limit:
                fail(name,residual=float(value),limit=float(limit))

        for index, state in enumerate(states):
            step = index
            require(type(state) is dict and rational(state.get('stepIndex')) == index and
                    rational(state.get('timeSeconds')) == rational(index*number(options['fixedStepSeconds'])),
                    'contiguous actual clock')
            require(state.get('identity') == identity and all(state.get(key) == []
                    for key in ('joints','ccdHits','cloths','fluids')), 'stable identity and domains')
            body_list = state.get('bodies')
            require(type(body_list) is list and len(body_list) == 3 and
                    set(body.get('id') for body in body_list) == set(authored), 'actual complete bodies')
            bodies = {body['id']:body for body in body_list}
            maps.append(bodies)
            zero_orientation = False
            for body_id, body in bodies.items():
                require(body.get('kind') == authored[body_id]['kind'] and body.get('sleeping') is False,
                        'actual body kind/awake')
                vector(body['positionM']); vector(body['velocityMps']); vector(body['angularVelocityRadps'])
                norm2 = dot(vector(body['orientationXYZW'],4),vector(body['orientationXYZW'],4))
                gate('actualOrientationUnit',norm2-1,GEOMETRY)
                if norm2 == 0:
                    fail('zeroActualOrientation',bodyId=body_id)
                    zero_orientation = True
            if zero_orientation:
                continue
            if index == 0:
                for body_id, body in bodies.items():
                    require(vector(body['positionM']) == vector(positions[body_id]) and
                            vector(body['velocityMps']) == [0,0,0] and
                            vector(body['angularVelocityRadps']) == [0,0,0], 'actual initial rest')
                require(state.get('contacts') == [], 'initial contact convention')
            floor, lower, upper = (bodies[key] for key in ('floor','lower','upper'))
            for key in ('positionM','velocityMps','orientationXYZW','angularVelocityRadps'):
                if not same_words(floor[key],maps[0]['floor'][key]):
                    fail('prescribedStaticWords',field=key)
            for value, expected in zip(vector(lower['positionM']),vector([0,.5,0])):
                gate('lowerPositionM',value-expected)
            for value in vector(lower['velocityMps'])+vector(lower['angularVelocityRadps']):
                gate('lowerRestMotion',value)
            for value, expected in zip(vector(lower['orientationXYZW'],4),vector([0,0,0,1],4)):
                gate('lowerOrientation',value-expected)
            expected_y = Fraction(5)+gravity*h*h*index*(index+1)/2
            for axis in (0,2):
                gate('upperLateralPositionM',rational(upper['positionM'][axis]))
                gate('upperLateralVelocityMps',rational(upper['velocityMps'][axis]))
            gate('upperKickDriftPositionM',rational(upper['positionM'][1])-expected_y)
            gate('upperFreeVelocityMps',rational(upper['velocityMps'][1])-gravity*h*index,VELOCITY)
            upper_q = vector(upper['orientationXYZW'],4)
            if spin and index:
                target_q = principal_quaternion(index*h)
                error = min(max(abs(a-b) for a,b in zip(upper_q,target_q)),
                            max(abs(a+b) for a,b in zip(upper_q,target_q)))
                gate('principalOrientationComponent',error)
                target_spin = [Fraction(0),Fraction(3,13),Fraction(0)]
            else:
                initial_q = vector(maps[0]['upper']['orientationXYZW'],4)
                gate('unforcedOrientationComponent',max(abs(a-b) for a,b in zip(upper_q,initial_q)))
                target_spin = [Fraction(0)]*3
            actual_spin = vector(upper['angularVelocityRadps'])
            for value, expected in zip(actual_spin,target_spin):
                gate('principalAngularVelocityRadps',value-expected)
            momentum = physical_inertia_action(upper,actual_spin)
            expected_momentum = [Fraction(0),Fraction(1,8),Fraction(0)] if spin and index else [Fraction(0)]*3
            for value, expected in zip(momentum,expected_momentum):
                gate('upperAngularMomentumNms',value-expected)
            gate('upperRotationalEnergyJ',dot(actual_spin,momentum)/2 -
                 (Fraction(3,208) if spin and index else Fraction(0)))
            # Circumscribed radius avoids borrowing native SAT/contact algorithms.
            radius2 = Fraction(7,8)
            lower_top = rational(lower['positionM'][1])+extent_y(lower,halves['lower'])
            floor_top = rational(floor['positionM'][1])+extent_y(floor,halves['floor'])
            for name, top in (('lower',lower_top),('floor',floor_top)):
                clearance = rational(upper['positionM'][1])-top
                if clearance <= 0 or clearance*clearance <= radius2:
                    fail('upperStrictEnclosingRadiusClearance',against=name)
            contacts = state.get('contacts')
            require(type(contacts) is list and len(contacts) <= 3, 'bounded contact array')
            support = []
            for contact in contacts:
                a,b = contact.get('bodyAId'),contact.get('bodyBId')
                require(a in authored and b in authored and a != b, 'contact endpoint schema')
                require(contact.get('colliderAId') == by_collider[a]['id'] and
                        contact.get('colliderBId') == by_collider[b]['id'], 'contact collider links')
                if {a,b} != {'lower','floor'}:
                    fail('unexpectedUpperContact',a=a,b=b)
                    continue
                support.append(contact)
                normal = vector(contact['normalAtoB'])
                expected_normal = vector([0,1 if b == 'lower' else -1,0])
                for value, expected in zip(normal,expected_normal):
                    gate('supportNormalDirection',value-expected)
                gate('normalUnit',dot(normal,normal)-1)
                impulse = rational(contact['normalImpulseNs'])
                if impulse < 0:
                    fail('nonnegativeSupportImpulse')
                gate('supportImpulseNs',impulse-(-2*gravity*h))
                for value in vector(contact['tangentImpulseOnBNs']):
                    gate('tangentImpulseNs',value,TANGENT)
                point = vector(contact['pointM'])
                for body_id in ('lower','floor'):
                    local = local_point(bodies[body_id],point)
                    side = -1 if body_id == 'lower' else 1
                    gate('geometryRepresentativeFacePlaneM',local[1]-side*halves[body_id][1],GEOMETRY)
                    for coordinate,half in zip(local,halves[body_id]):
                        gate('geometryRepresentativeFiniteBoundsM',max(Fraction(0),abs(coordinate)-half),GEOMETRY)
                if index:
                    old_v = vector(maps[index-1]['lower']['velocityMps'])
                    new_v = vector(lower['velocityMps'])
                    sign = Fraction(1 if b == 'lower' else -1)
                    for axis in range(3):
                        applied = sign*impulse*normal[axis]
                        residual = 2*(new_v[axis]-old_v[axis]-(gravity*h if axis == 1 else 0))-applied
                        gate('lowerMomentumNs',residual)
                    gate('supportComplementarityJ',impulse*rational(lower['velocityMps'][1]))
            if index and len(support) != 1:
                fail('oneRequiredLowerSupportContact',observed=len(support))
        final = maps[-1]['upper']
        time = count*h
        continuous_y = Fraction(5)+gravity*time*time/2
        position_error = abs(rational(final['positionM'][1])-continuous_y)
        velocity = vector(final['velocityMps'])
        # Translational kinetic plus gravitational potential; rotation is reported separately.
        energy_error = dot(velocity,velocity)-2*gravity*(rational(final['positionM'][1])-5)
        metrics = {key:float(value) for key,value in maxima.items()}
        metrics.update({'continuousPositionErrorM':float(position_error),
                        'continuousEnergyErrorJ':float(energy_error),
                        'matchedTimePositionErrorM':float(position_error) if count != 64 else None,
                        'matchedTimeEnergyErrorJ':float(abs(energy_error)) if count != 64 else None})
        return {'ok':not violations,'resolved':True,'executionFailure':False,
                'status':'ANISOTROPIC_PUBLIC_PRECONTACT_CONFIRMED' if not violations else 'PHYSICAL_NO_GO',
                'violations':violations,'metrics':metrics,
                'certificate':{'caseId':data['caseId'],'states':len(states),'transitions':count,
                               'firstPhysicalFailureStep':violations[0]['step'] if violations else None,
                               'scope':'specified upper precontact and principal-axis spin only',
                               'generalTiltedContact':False,'candidateImports':0,'worldCalls':0}}
    except (Invalid,KeyError,TypeError,IndexError,ValueError,ZeroDivisionError,OverflowError) as error:
        return {'ok':False,'resolved':False,'executionFailure':True,'status':'INVALID_INPUT',
                'violations':violations,'metrics':{},'certificate':{},'reason':str(error)}


def main():
    try:
        line = sys.stdin.buffer.readline(LINE_BYTES+1)
        require(0 < len(line) <= LINE_BYTES and line.endswith(b'\n'),'one bounded JSONL request')
        require(sys.stdin.buffer.read(1) == b'','one request then EOF')
        request = json.loads(line)
        require(request['format'] == 'anisotropic-inertia-public-v1','wire format')
        response = verify(restore_words(request['data'],request['numericWordsF64leHex']))
    except (Invalid,KeyError,TypeError,ValueError,OverflowError) as error:
        response = {'ok':False,'resolved':False,'executionFailure':True,'status':'INVALID_INPUT',
                    'violations':[],'metrics':{},'certificate':{},'reason':str(error)}
    encoded = json.dumps(response,separators=(',',':'),allow_nan=False)
    require(len(encoded.encode()) <= 65536,'reply byte bound')
    print(encoded)


if __name__ == '__main__':
    main()
