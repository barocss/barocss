"""Independent bounded public-state reference. No candidate/package imports or solve."""
from fractions import Fraction
import json
import math
import struct
import sys

LINE_BYTES = 2 * 1024 * 1024
GRAPH_BYTES = 16 * 1024 * 1024
MAX_WORDS = 65536
MAX_NODES = 262144
MAX_DEPTH = 32
GATE = Fraction.from_float(1e-10)
TANGENT_GATE = Fraction.from_float(1e-12)
VELOCITY_GATE = Fraction.from_float(1e-11)
CASES = {"separated-60": (60, 128), "separated-120": (120, 256), "separated-240": (240, 512)}
GEOMETRY_GATE = Fraction.from_float(1e-12)


class Invalid(ValueError):
    pass


def require(ok, label):
    if not ok:
        raise Invalid(label)


def number(value):
    require(type(value) in (int, float), 'finite JS Number required')
    try:
        result = float(value)
    except (OverflowError, ValueError):
        raise Invalid('finite JS Number required') from None
    require(math.isfinite(result), 'finite JS Number required')
    return result


def q(value):
    return Fraction.from_float(number(value))


def integer(value):
    result = number(value)
    require(result.is_integer() and abs(result) <= 3600, 'bounded integer-valued JS Number')
    return int(result)


def vector(value, size=3):
    require(type(value) is list and len(value) == size, 'vector shape')
    return [q(x) for x in value]


def add(a, b):
    return [x + y for x, y in zip(a, b)]


def sub(a, b):
    return [x - y for x, y in zip(a, b)]


def scale(a, x):
    return [v * x for v in a]


def dot(a, b):
    return sum((x * y for x, y in zip(a, b)), Fraction(0))


def cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def word(value):
    return struct.pack('<d', number(value))


def restore_words(value, hexadecimal):
    """JSON numeric order, finite RNE-value agreement, actual signed-zero restoration."""
    require(type(hexadecimal) is str and len(hexadecimal) % 16 == 0,
            'numeric word hex shape')
    require(len(hexadecimal) <= MAX_WORDS * 16, 'numeric word count bound')
    require(all(c in '0123456789abcdef' for c in hexadecimal), 'lowercase numeric word hex')
    raw = bytes.fromhex(hexadecimal)
    offset, nodes = 0, 0

    def visit(item, depth):
        nonlocal offset, nodes
        nodes += 1
        require(depth <= MAX_DEPTH and nodes <= MAX_NODES, 'numeric tree bound')
        if type(item) in (int, float):
            require(offset + 8 <= len(raw), 'missing numeric word')
            restored = struct.unpack_from('<d', raw, offset)[0]
            offset += 8
            require(math.isfinite(restored) and restored == number(item), 'numeric word mismatch')
            return restored
        if item is None or type(item) in (bool, str):
            return item
        if type(item) is list:
            return [visit(x, depth + 1) for x in item]
        require(type(item) is dict and all(type(k) is str for k in item), 'JSON data required')
        return {k: visit(v, depth + 1) for k, v in item.items()}

    result = visit(value, 0)
    require(offset == len(raw), 'trailing numeric words')
    return result


def raw_body(body):
    return b''.join(word(x) for key, n in [('positionM', 3), ('velocityMps', 3),
                                          ('orientationXYZW', 4), ('angularVelocityRadps', 3)]
                    for x in body[key][:n])


def result(ok, violations, metrics=None, certificates=None, execution_failure=False):
    return {'ok': ok, 'resolved': not execution_failure, 'executionFailure': execution_failure,
            'status': 'VERIFIED' if ok else 'INVALID_INPUT' if execution_failure else 'PHYSICAL_NO_GO',
            'violations': violations, 'metrics': metrics or {}, 'certificates': certificates or {}}


def reported(value):
    try:
        converted = float(value)
    except OverflowError:
        return 'OUTSIDE_FINITE_BINARY64_REPORT_RANGE'
    return converted if math.isfinite(converted) else 'OUTSIDE_FINITE_BINARY64_REPORT_RANGE'


def rotation(quaternion):
    """Exact quaternion rotation: no candidate rotation, SAT, clipping or contact code."""
    x, y, z, w = vector(quaternion, 4)
    norm = x*x + y*y + z*z + w*w
    require(norm > 0, 'nonzero actual quaternion')
    return [[1-2*(y*y+z*z)/norm, 2*(x*y-z*w)/norm, 2*(x*z+y*w)/norm],
            [2*(x*y+z*w)/norm, 1-2*(x*x+z*z)/norm, 2*(y*z-x*w)/norm],
            [2*(x*z-y*w)/norm, 2*(y*z+x*w)/norm, 1-2*(x*x+y*y)/norm]]


def local_point(body, point):
    matrix = rotation(body['orientationXYZW'])
    delta = sub(point, vector(body['positionM']))
    return [sum((matrix[i][j]*delta[i] for i in range(3)), Fraction(0)) for j in range(3)]


def projected_extent(body, half, axis):
    return sum((abs(c)*h for c, h in zip(rotation(body['orientationXYZW'])[axis], half)), Fraction(0))


def verify(data):
    maxima, violations, current_step, current_body = {}, [], None, None
    certificate = {'scope': 'TWO_SEPARATED_CUBES_INDEPENDENT_FINITE_FLOOR_CONTACTS',
                   'coupledDynamicChain': False, 'privateManifoldPointClaim': False,
                   'publicAggregatePointGeometryOnly': True, 'candidateImports': 0,
                   'candidateSolves': 0, 'actualWorldCalls': 'CALLER_OWNED_NOT_INFERRED',
                   'projectionWorkBoundary': 'Public-state exact reconstruction includes unobserved free-position rounding'}

    def gate(name, residual, limit=GATE):
        value = abs(residual)
        maxima[name] = max(maxima.get(name, Fraction(0)), value)
        if value > limit and len(violations) < 32:
            violations.append({'gate': name, 'stepIndex': current_step, 'bodyId': current_body,
                               'residual': reported(value), 'limit': reported(limit)})

    def metrics():
        return {k: reported(v) if isinstance(v, Fraction) else v for k, v in maxima.items()}

    try:
        require(type(data) is dict and set(data) == {'caseId', 'model', 'options', 'states'}, 'fixed case fields')
        case = data['caseId']
        require(type(case) is str and case in CASES, 'fixed separated case ID')
        hz, transitions = CASES[case]
        model, options, states = data['model'], data['options'], data['states']
        require(type(model) is dict and type(options) is dict, 'public model/options')
        require(options.get('profile') == 'rigid-persistent-box-v1' and options.get('broadPhase') == 'direct', 'existing persistent profile')
        h = q(options.get('fixedStepSeconds'))
        require(h == q(1/hz), 'actual represented timestep')
        require(model.get('format') == 'barocss-physics-model' and integer(model.get('version')) == 1, 'model format')
        require(model.get('units') == {'length': 'm', 'mass': 'kg', 'time': 's', 'angle': 'rad'}, 'SI units')
        require(model.get('frame', {}).get('basis') == 'right-handed-xyz' and model.get('frame', {}).get('rotation') == 'local-to-world-xyzw', 'frame conventions')
        require(all(model.get(k) == [] for k in ['joints', 'cloths', 'fluids', 'sourceBindings']), 'no extra domains/bindings')
        gravity = vector(model.get('gravityMps2'))
        require(gravity == vector([0, -9.81, 0]), 'original gravity')
        definitions, colliders = model.get('bodies'), model.get('colliders')
        require(type(definitions) is list and len(definitions) == 3 and type(colliders) is list and len(colliders) == 3, 'three bodies/colliders')
        ids = [b.get('id') for b in definitions]
        require(all(type(x) is str and 0 < len(x) <= 64 for x in ids) and len(set(ids)) == 3, 'opaque unique body IDs')
        authored = dict(zip(ids, definitions))
        dynamics = [b for b in definitions if b.get('kind') == 'dynamic']
        statics = [b for b in definitions if b.get('kind') == 'static']
        require(len(dynamics) == 2 and len(statics) == 1, 'two dynamic cubes and one static floor')
        floor = statics[0]['id']
        left, right = sorted(dynamics, key=lambda b: q(b['initial']['positionM'][0]))
        expected_positions = {left['id']: [-.75, .75, 0], right['id']: [.75, 1.25, 0], floor: [0, -.5, 0]}
        dynamic_ids = [left['id'], right['id']]
        by_collider, collider_ids, halves = {}, set(), {}
        for c in colliders:
            bid = c.get('bodyId')
            require(bid in authored and bid not in by_collider, 'one collider per actual body')
            require(type(c.get('id')) is str and c['id'] not in collider_ids, 'unique collider ID')
            collider_ids.add(c['id'])
            require(c.get('sensor') is False and c.get('ccd') is False and c.get('filter') == {'categoryBits': 1, 'maskBits': 65535}, 'unfiltered unsensed nonCCD')
            require(c.get('local') == {'positionM': [0, 0, 0], 'orientationXYZW': [0, 0, 0, 1]}, 'identity local collider')
            require(c.get('geometry', {}).get('kind') == 'box', 'box geometry')
            halves[bid] = vector(c['geometry'].get('halfExtentsM'))
            require(halves[bid] == vector([2, .5, 2] if bid == floor else [.5, .5, .5]), 'fixed finite box extents')
            require(c.get('material') == {'restitution': 0, 'friction': {'static': 0, 'dynamic': 0}}, 'zero restitution/friction')
            by_collider[bid] = c
        for bid, b in authored.items():
            initial = b.get('initial', {})
            require(vector(initial.get('positionM')) == vector(expected_positions[bid]), 'fixed authored initial position')
            require(vector(initial.get('orientationXYZW'), 4) == vector([0, 0, 0, 1], 4), 'identity initial rotation')
            if bid != floor:
                require(q(b.get('massKg')) == 2 and b.get('inertia') == {'kind': 'primitive-com', 'about': 'com', 'frame': 'body-local'}, 'primitiveCOM mass2')
                require(vector(initial.get('velocityMps')) == [0, 0, 0] and vector(initial.get('angularVelocityRadps')) == [0, 0, 0], 'zero initial motion')
        require(type(states) is list and len(states) == transitions+1, 'all actual fixed transitions')
        require(type(states[0]) is dict and type(states[0].get('identity')) is dict, 'initial public identity')
        identity, maps = states[0]['identity'], []
        require(identity.get('profile') == options['profile'], 'profile identity')
        for index, state in enumerate(states):
            current_step = index
            require(type(state) is dict and integer(state.get('stepIndex')) == index, 'contiguous step index')
            require(q(state.get('timeSeconds')) == q(index*number(options['fixedStepSeconds'])), 'public clock')
            require(state.get('identity') == identity, 'same graph/provider/model identity')
            require(all(state.get(k) == [] for k in ['joints', 'ccdHits', 'cloths', 'fluids']), 'no extra state domains')
            bodies = state.get('bodies')
            require(type(bodies) is list and len(bodies) == 3 and set(b.get('id') for b in bodies) == set(ids), 'complete state body IDs')
            bs = {b['id']: b for b in bodies}
            require(type(state.get('contacts')) is list and len(state['contacts']) <= 2, 'at most two independent floor pairs')
            for bid, b in bs.items():
                current_body = bid
                require(b.get('kind') == authored[bid]['kind'] and b.get('sleeping') is False, 'body kind/no sleep')
                for key in ['positionM', 'velocityMps', 'angularVelocityRadps']:
                    vector(b.get(key))
                orientation = vector(b.get('orientationXYZW'), 4)
                if bid == floor:
                    if index:
                        require(raw_body(b) == raw_body(maps[0][floor]), 'static floor raw words retained')
                else:
                    for value in vector(b['angularVelocityRadps']):
                        gate('omegaRadps', value)
                    for value, expected in zip(orientation, [0, 0, 0, 1]):
                        gate('orientationComponent', value-expected)
                    for axis in [0, 2]:
                        gate('lateralPositionM', q(b['positionM'][axis])-q(expected_positions[bid][axis]))
                        gate('lateralVelocityMps', q(b['velocityMps'][axis]))
            # A strict positive world-X projection gap separates the two actual OBBs.
            gap_x = q(bs[right['id']]['positionM'][0])-q(bs[left['id']]['positionM'][0])
            gap_x -= projected_extent(bs[left['id']], halves[left['id']], 0)+projected_extent(bs[right['id']], halves[right['id']], 0)
            if gap_x <= 0 and len(violations) < 32:
                violations.append({'gate': 'strictPositiveCubeSeparationM', 'stepIndex': index,
                                   'bodyId': None, 'gapM': reported(gap_x), 'strictPositive': True})
            gate('horizontalSeparationDriftM', gap_x-Fraction(1, 2))
            maxima['minimumHorizontalSeparationM'] = min(maxima.get('minimumHorizontalSeparationM', gap_x), gap_x)
            for bid in dynamic_ids:
                current_body = bid
                for axis in [0, 2]:
                    extent = projected_extent(bs[bid], halves[bid], axis)
                    floor_extent = projected_extent(bs[floor], halves[floor], axis)
                    offset_axis = abs(q(bs[bid]['positionM'][axis])-q(bs[floor]['positionM'][axis]))
                    gate('finiteFloorFootprintOverflowM', max(Fraction(0), offset_axis+extent-floor_extent), GEOMETRY_GATE)
            maps.append(bs)
        current_body = None
        require(states[0]['contacts'] == [], 'initial actual contact population is zero')
        for bid in ids:
            require(vector(maps[0][bid]['positionM']) == vector(expected_positions[bid]) and
                    vector(maps[0][bid]['orientationXYZW'], 4) == vector([0, 0, 0, 1], 4) and
                    vector(maps[0][bid]['velocityMps']) == [0, 0, 0] and vector(maps[0][bid]['angularVelocityRadps']) == [0, 0, 0], 'actual initial words/roles')
        first = {bid: None for bid in dynamic_ids}
        contact_counts = {bid: 0 for bid in dynamic_ids}
        projection_sums = {bid: Fraction(0) for bid in dynamic_ids}
        coexist = False
        sample_step = hz//10
        precontact_samples = []
        for index in range(1, len(states)):
            current_step = index
            before, after = maps[index-1], maps[index]
            free_v = {bid: add(vector(before[bid]['velocityMps']), scale(gravity, h)) for bid in dynamic_ids}
            free_p = {bid: add(vector(before[bid]['positionM']), scale(free_v[bid], h)) for bid in dynamic_ids}
            impulse = {bid: [Fraction(0)]*3 for bid in dynamic_ids}
            torque = {bid: [Fraction(0)]*3 for bid in dynamic_ids}
            touched = set()
            for c in states[index]['contacts']:
                a, b = c.get('bodyAId'), c.get('bodyBId')
                require(a in ids and b in ids and a != b and floor in (a, b), 'moving-moving contact is forbidden')
                bid = b if a == floor else a
                current_body = bid
                require(bid in dynamic_ids and bid not in touched, 'one public aggregate per floor pair')
                touched.add(bid)
                require(c.get('colliderAId') == by_collider[a]['id'] and c.get('colliderBId') == by_collider[b]['id'], 'contact collider links')
                normal, point, tangent = vector(c.get('normalAtoB')), vector(c.get('pointM')), vector(c.get('tangentImpulseOnBNs'))
                lam = q(c.get('normalImpulseNs'))
                require(lam >= 0 and 0 <= q(c.get('penetrationM')) <= 10, 'normal impulse and penetration range')
                expected_normal = [0, 1 if a == floor else -1, 0]
                gate('geometryNormalSquared', dot(normal, normal)-1, GEOMETRY_GATE)
                for value, expected in zip(normal, expected_normal):
                    gate('geometryNormalDirection', value-expected, GEOMETRY_GATE)
                for value in tangent:
                    gate('tangentImpulseNs', value, TANGENT_GATE)
                # Public representative point ONLY: independent inverse quaternion/face planes.
                floor_local = local_point(after[floor], point)
                cube_local = local_point(after[bid], point)
                gate('geometryFloorTopPlaneM', floor_local[1]-halves[floor][1], GEOMETRY_GATE)
                gate('geometryCubeBottomPlaneM', cube_local[1]+halves[bid][1], GEOMETRY_GATE)
                for local, half in [(floor_local, halves[floor]), (cube_local, halves[bid])]:
                    for axis in [0, 1, 2]:
                        gate('geometryRepresentativeBoundsM', max(Fraction(0), abs(local[axis])-half[axis]), GEOMETRY_GATE)
                on_b = add(scale(normal, lam), tangent)
                applied = on_b if b == bid else scale(on_b, -1)
                impulse[bid] = add(impulse[bid], applied)
                torque[bid] = add(torque[bid], cross(sub(point, vector(after[bid]['positionM'])), applied))
                closing = max(Fraction(0), -free_v[bid][1])
                gate('normalImpulseNs', lam-2*closing)
                gate('newtonE0VelocityMps', q(after[bid]['velocityMps'][1]))
                free_ke = dot(free_v[bid], free_v[bid])
                post_v, post_w = vector(after[bid]['velocityMps']), vector(after[bid]['angularVelocityRadps'])
                post_ke = dot(post_v, post_v)+dot(post_w, post_w)/6
                loss = closing*closing  # m/2=1, fixed floor, e0.
                gate('contactKineticEnergyJ', post_ke-free_ke+loss)
                contact_counts[bid] += 1
                if first[bid] is None:
                    require(index > 1, 'actual delayed contact required')
                    first[bid] = index
            coexist = coexist or len(touched) == 2
            for bid in dynamic_ids:
                current_body = bid
                delta_p = scale(sub(vector(after[bid]['velocityMps']), vector(before[bid]['velocityMps'])), Fraction(2))
                for value in sub(delta_p, add(scale(gravity, 2*h), impulse[bid])):
                    gate('bodyMomentumNs', value)
                spin_delta = scale(sub(vector(after[bid]['angularVelocityRadps']), vector(before[bid]['angularVelocityRadps'])), Fraction(1, 3))
                for value in sub(spin_delta, torque[bid]):
                    gate('bodyAngularMomentumNms', value)
                work = -2*dot(gravity, sub(vector(after[bid]['positionM']), free_p[bid]))
                projection_sums[bid] += work
                maxima['maxReconstructedProjectionPotentialWorkJ'] = max(maxima.get('maxReconstructedProjectionPotentialWorkJ', Fraction(0)), abs(work))
                bottom = q(after[bid]['positionM'][1])-projected_extent(after[bid], halves[bid], 1)
                floor_top = q(after[floor]['positionM'][1])+projected_extent(after[floor], halves[floor], 1)
                gap = bottom-floor_top
                gate('negativeFloorGapM', max(Fraction(0), -gap))
                if first[bid] is None:
                    p0 = vector(expected_positions[bid])
                    t = index*h
                    closed_p = add(p0, scale(gravity, h*h*index*(index+1)/2))
                    closed_v = scale(gravity, t)
                    for value in sub(vector(after[bid]['positionM']), closed_p):
                        gate('freeClosedFormPositionM', value)
                    for value in sub(vector(after[bid]['velocityMps']), closed_v):
                        gate('freeClosedFormVelocityMps', value, VELOCITY_GATE)
                else:
                    require(bid in touched, 'supported body needs its actual floor contact')
                    gate('supportedFloorGapM', gap)
                    for value in vector(after[bid]['velocityMps']):
                        gate('supportedVelocityMps', value)
                if index == sample_step:
                    require(first[bid] is None, 'matched T.1 samples must precede both contacts')
                    true_t = Fraction(1, 10)
                    continuous_y = q(expected_positions[bid][1])+gravity[1]*true_t*true_t/2
                    position_error = q(after[bid]['positionM'][1])-continuous_y
                    post_v = vector(after[bid]['velocityMps'])
                    energy = dot(post_v, post_v)-2*dot(gravity, vector(after[bid]['positionM']))
                    initial_energy = -2*dot(gravity, vector(expected_positions[bid]))
                    energy_error = energy-initial_energy
                    defect = -dot(gravity, gravity)*(index*h)*h
                    gate('precontactEnergyDefectRoundoffJ', energy_error-defect)
                    gate('precontactContinuousVelocityMps', q(after[bid]['velocityMps'][1])-gravity[1]*true_t, VELOCITY_GATE)
                    precontact_samples.append({'bodyId': bid, 'sampleStep': index, 'matchedContinuousSeconds': .1,
                        'actualClockSeconds': number(states[index]['timeSeconds']),
                        'positionErrorM': reported(abs(position_error)), 'signedPositionErrorM': reported(position_error),
                        'energyErrorJ': reported(abs(energy_error)), 'signedEnergyErrorJ': reported(energy_error),
                        'analyticFirstOrderEnergyDefectJ': reported(defect)})
                    maxima['precontactPositionErrorM'] = max(maxima.get('precontactPositionErrorM', Fraction(0)), abs(position_error))
                    maxima['precontactEnergyErrorJ'] = max(maxima.get('precontactEnergyErrorJ', Fraction(0)), abs(energy_error))
        current_body = None
        require(all(first[bid] is not None for bid in dynamic_ids), 'both actual floor impacts required')
        require(first[left['id']] < first[right['id']], 'separate actual floor impact times')
        require(coexist, 'later two independent floor contacts must coexist')
        require(len(precontact_samples) == 2, 'two complete matched precontact samples')
        contact_reports = []
        for bid in dynamic_ids:
            n = first[bid]
            initial_gap = q(expected_positions[bid][1])-Fraction(1, 2)
            squared_time = 2*initial_gap/-gravity[1]
            lo, hi = (n-1)*h, (n+1)*h
            if not lo*lo <= squared_time <= hi*hi and len(violations) < 32:
                violations.append({'gate': 'continuousContactTimeBracket', 'stepIndex': n,
                                   'bodyId': bid, 'squaredTime': reported(squared_time),
                                   'squaredBracket': [reported(lo*lo), reported(hi*hi)]})
            contact_reports.append({'bodyId': bid, 'firstContactStep': n, 'contactSteps': contact_counts[bid],
                'supportTransitionsIncludingFirst': transitions-n+1,
                'continuousContactSeconds': math.sqrt(float(squared_time)),
                'actualFirstContactSampleSeconds': float(n*h),
                'discreteSampleIntervalSeconds': [float((n-1)*h), float(n*h)],
                'gravityIntegratorComparisonBracketSeconds': [float(lo), float(hi)],
                'reconstructedProjectionPotentialWorkSumJ': reported(projection_sums[bid])})
        certificate.update({'caseId': case, 'receivedStates': len(states), 'receivedTransitions': transitions,
                            'independentFloorPairs': 2, 'twoFloorContactsCoexist': coexist,
                            'contacts': contact_reports, 'precontactSamples': precontact_samples,
                            'continuousEnergyConservedByIntegrator': False,
                            'contactTimeMeaning': 'Discrete end-step samples, not exact continuous TOI/remainder'})
        return result(not violations, violations, metrics(), certificate)
    except (Invalid, KeyError, TypeError, ValueError, OverflowError, ZeroDivisionError, IndexError) as error:
        return result(False, [{'input': str(error)[:512]}], metrics(), certificate, True)


def reject_duplicates(pairs):
    out = {}
    for key, value in pairs:
        require(key not in out, 'duplicate JSON key')
        out[key] = value
    return out


def main():
    total, requests = 0, 0
    while True:
        line = sys.stdin.buffer.readline(LINE_BYTES+1)
        if not line:
            return
        total += len(line)
        requests += 1
        try:
            require(len(line) <= LINE_BYTES and line.endswith(b'\n'), '2MiB complete JSONL request')
            require(total <= GRAPH_BYTES and requests <= 8, '16MiB/8 request graph bound')
            envelope = json.loads(line, object_pairs_hook=reject_duplicates,
                                  parse_constant=lambda _: (_ for _ in ()).throw(Invalid('JSON nonfinite')))
            require(type(envelope) is dict and set(envelope) == {'format', 'data', 'numericWordsF64leHex'} and
                    envelope['format'] == 'two-cubes-floor-case-v1', 'fixed case envelope')
            reply = verify(restore_words(envelope['data'], envelope['numericWordsF64leHex']))
        except (Invalid, KeyError, TypeError, ValueError, OverflowError, RecursionError) as error:
            reply = result(False, [{'input': str(error)[:512]}], execution_failure=True)
        encoded = json.dumps(reply, allow_nan=False, separators=(',', ':'))+'\n'
        require(len(encoded.encode()) <= 65536, 'bounded oracle reply')
        sys.stdout.write(encoded)
        sys.stdout.flush()
        if total > GRAPH_BYTES or requests >= 8 or len(line) > LINE_BYTES or not line.endswith(b'\n'):
            return


if __name__ == '__main__':
    main()
