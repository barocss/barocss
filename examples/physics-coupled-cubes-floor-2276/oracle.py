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
CASE = "coupled-120"
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


def project_two(free, rows, bounds, masses):
    """Closed-form four active sets of this fixed 2DOF chain; not a general solver."""
    require(0 <= len(rows) <= 2 and len(bounds) == len(rows), 'fixed reference row population')
    candidates = []
    for mask in range(1 << len(rows)):
        active = [i for i in range(len(rows)) if mask & (1 << i)]
        lam = [Fraction(0) for _ in rows]
        if len(active) == 1:
            i = active[0]
            gram = sum((rows[i][k]*rows[i][k]/masses[k] for k in range(2)), Fraction(0))
            lam[i] = (bounds[i]-dot(rows[i], free))/gram
        elif len(active) == 2:
            i, j = active
            g00 = sum((rows[i][k]*rows[i][k]/masses[k] for k in range(2)), Fraction(0))
            g01 = sum((rows[i][k]*rows[j][k]/masses[k] for k in range(2)), Fraction(0))
            g11 = sum((rows[j][k]*rows[j][k]/masses[k] for k in range(2)), Fraction(0))
            r0, r1 = bounds[i]-dot(rows[i], free), bounds[j]-dot(rows[j], free)
            determinant = g00*g11-g01*g01
            require(determinant > 0, 'independent fixed chain rows')
            lam[i], lam[j] = (r0*g11-r1*g01)/determinant, (r1*g00-r0*g01)/determinant
        target = [free[k]+sum((rows[i][k]*lam[i] for i in range(len(rows))), Fraction(0))/masses[k] for k in range(2)]
        if all(x >= 0 for x in lam) and all(dot(row, target) >= bound for row, bound in zip(rows, bounds)):
            objective = sum((masses[k]*(target[k]-free[k])**2/2 for k in range(2)), Fraction(0))
            candidates.append((objective, target, lam))
    require(candidates, 'fixed reference projection must have a feasible active set')
    best = min(candidates, key=lambda item: item[0])
    require(all(item[1] == best[1] for item in candidates if item[0] == best[0]), 'unique fixed strictly convex target')
    return best[1], best[2], best[0]


def ratio(value):
    return {'n': str(value.numerator), 'd': str(value.denominator)}


def verify(data):
    maxima, violations, step_index, body_id = {}, [], None, None
    certificate = {'scope': 'FIRST_BASELINE_FIXED_2DOF_INELASTIC_VERTICAL_CHAIN',
                   'stationaryEightCertificateReused': False, 'generalDynamicEight': False,
                   'candidateImports': 0, 'candidateSolves': 0,
                   'actualWorldCalls': 'CALLER_OWNED_NOT_INFERRED',
                   'projectionWorkBoundary': 'Public exact reconstruction includes unobserved free-position rounding'}

    def fail(name, **details):
        if len(violations) < 32:
            violations.append({'gate': name, 'stepIndex': step_index, 'bodyId': body_id, **details})

    def gate(name, value, limit=GATE):
        value = abs(value)
        maxima[name] = max(maxima.get(name, Fraction(0)), value)
        if value > limit:
            fail(name, residual=reported(value), limit=reported(limit))

    def metrics():
        return {key: reported(value) if isinstance(value, Fraction) else value for key, value in maxima.items()}

    try:
        require(type(data) is dict and set(data) == {'caseId', 'model', 'options', 'states'} and data['caseId'] == CASE, 'fixed prefix fields/ID')
        model, options, states = data['model'], data['options'], data['states']
        require(type(model) is dict and type(options) is dict, 'public model/options')
        require(options.get('profile') == 'rigid-persistent-box-v1' and options.get('broadPhase') == 'direct' and q(options.get('fixedStepSeconds')) == q(1/120), 'fixed existing profile/dt')
        h, gravity = q(1/120), vector(model.get('gravityMps2'))
        require(gravity == vector([0, -9.81, 0]), 'original gravity')
        require(model.get('format') == 'barocss-physics-model' and integer(model.get('version')) == 1 and model.get('units') == {'length': 'm', 'mass': 'kg', 'time': 's', 'angle': 'rad'}, 'public SI model')
        require(model.get('frame', {}).get('basis') == 'right-handed-xyz' and model.get('frame', {}).get('rotation') == 'local-to-world-xyzw', 'frame convention')
        require(all(model.get(k) == [] for k in ['joints', 'cloths', 'fluids', 'sourceBindings']), 'no extra domains')
        definitions, colliders = model.get('bodies'), model.get('colliders')
        require(type(definitions) is list and len(definitions) == 3 and type(colliders) is list and len(colliders) == 3, 'three fixed bodies/colliders')
        ids = [b.get('id') for b in definitions]
        require(all(type(x) is str and 0 < len(x) <= 64 for x in ids) and len(set(ids)) == 3, 'opaque unique IDs')
        authored = dict(zip(ids, definitions))
        dynamic = [b for b in definitions if b.get('kind') == 'dynamic']
        fixed = [b for b in definitions if b.get('kind') == 'static']
        require(len(dynamic) == 2 and len(fixed) == 1, 'two dynamics and one prescribed static')
        lower_def, upper_def = sorted(dynamic, key=lambda b: q(b['initial']['positionM'][1]))
        lower, upper, floor = lower_def['id'], upper_def['id'], fixed[0]['id']
        moving = [lower, upper]
        positions = {lower: [0, .5, 0], upper: [0, 1.75, 0], floor: [0, -.5, 0]}
        halves, by_collider, collider_ids = {}, {}, set()
        for c in colliders:
            bid = c.get('bodyId')
            require(bid in authored and bid not in by_collider and type(c.get('id')) is str and c['id'] not in collider_ids, 'one unique collider per body')
            collider_ids.add(c['id'])
            require(c.get('geometry', {}).get('kind') == 'box', 'box geometry')
            halves[bid] = vector(c['geometry'].get('halfExtentsM'))
            require(halves[bid] == vector([2, .5, 2] if bid == floor else [.5, .5, .5]), 'fixed finite extents')
            require(c.get('local') == {'positionM': [0, 0, 0], 'orientationXYZW': [0, 0, 0, 1]} and c.get('sensor') is False and c.get('ccd') is False and c.get('filter') == {'categoryBits': 1, 'maskBits': 65535}, 'unfiltered identity-local nonCCD')
            require(c.get('material') == {'restitution': 0, 'friction': {'static': 0, 'dynamic': 0}}, 'e0 friction0')
            by_collider[bid] = c
        for bid, b in authored.items():
            initial = b.get('initial', {})
            require(vector(initial.get('positionM')) == vector(positions[bid]) and vector(initial.get('orientationXYZW'), 4) == vector([0, 0, 0, 1], 4), 'literal initial pose')
            if bid in moving:
                require(q(b.get('massKg')) == 2 and b.get('inertia') == {'kind': 'primitive-com', 'about': 'com', 'frame': 'body-local'} and vector(initial.get('velocityMps')) == [0, 0, 0] and vector(initial.get('angularVelocityRadps')) == [0, 0, 0], 'mass2 primitiveCOM/rest')
        require(type(states) is list and 1 <= len(states) <= 33, 'complete prefix through at most32 transitions')
        require(type(states[0]) is dict and type(states[0].get('identity')) is dict, 'public initial identity')
        identity, maps = states[0]['identity'], []
        require(identity.get('profile') == options['profile'], 'same profile identity')
        for index, state in enumerate(states):
            step_index = index
            require(type(state) is dict and integer(state.get('stepIndex')) == index and q(state.get('timeSeconds')) == q(index*number(options['fixedStepSeconds'])), 'contiguous public clock')
            require(state.get('identity') == identity and all(state.get(k) == [] for k in ['joints', 'ccdHits', 'cloths', 'fluids']), 'identity/no extra domains')
            bodies = state.get('bodies')
            require(type(bodies) is list and len(bodies) == 3 and set(b.get('id') for b in bodies) == set(ids), 'complete public bodies')
            bs = {b['id']: b for b in bodies}
            require(type(state.get('contacts')) is list and len(state['contacts']) <= 3, 'bounded actual contact list')
            for bid, b in bs.items():
                body_id = bid
                require(b.get('kind') == authored[bid]['kind'] and b.get('sleeping') is False, 'kind/no sleep')
                for key in ['positionM', 'velocityMps', 'angularVelocityRadps']:
                    vector(b.get(key))
                orientation = vector(b.get('orientationXYZW'), 4)
                if bid == floor and index:
                    if raw_body(b) != raw_body(maps[0][floor]):
                        fail('prescribedStaticWordsChanged')
                if bid in moving:
                    for value in vector(b['angularVelocityRadps']):
                        gate('omegaRadps', value)
                    for value, expected in zip(orientation, [0, 0, 0, 1]):
                        gate('orientationComponent', value-expected)
                    for axis in [0, 2]:
                        gate('lateralPositionM', q(b['positionM'][axis]))
                        gate('lateralVelocityMps', q(b['velocityMps'][axis]))
            maps.append(bs)
        for bid in ids:
            require(vector(maps[0][bid]['positionM']) == vector(positions[bid]) and vector(maps[0][bid]['velocityMps']) == [0, 0, 0] and vector(maps[0][bid]['angularVelocityRadps']) == [0, 0, 0], 'actual initial state words')
        require(states[0]['contacts'] == [], 'initial public contacts convention')
        # Exact geometry-derived chain constants; no expected future pose enters World.
        floor_top = q(positions[floor][1])+halves[floor][1]
        bounds = [floor_top+halves[lower][1], halves[lower][1]+halves[upper][1]]
        rows = [[Fraction(1), Fraction(0)], [Fraction(-1), Fraction(1)]]
        masses = [Fraction(2), Fraction(2)]
        edge_rows = {frozenset([floor, lower]): 0, frozenset([lower, upper]): 1}
        first_observed = [None, None]
        first_reference_coupling = None
        last_reference = None
        projection_work_sum = Fraction(0)
        for index in range(1, len(states)):
            step_index, body_id = index, None
            before, after = maps[index-1], maps[index]
            vf = [q(before[bid]['velocityMps'][1])+gravity[1]*h for bid in moving]
            pf = [q(before[bid]['positionM'][1])+vf[k]*h for k, bid in enumerate(moving)]
            position_target, position_lam, position_cost = project_two(pf, rows, bounds, masses)
            active_rows = [i for i in range(2) if dot(rows[i], position_target) == bounds[i]]
            velocity_rows = [rows[i] for i in active_rows]
            velocity_target, selected_lam, velocity_cost = project_two(vf, velocity_rows, [Fraction(0)]*len(active_rows), masses)
            reference_lam = [Fraction(0), Fraction(0)]
            for row, value in zip(active_rows, selected_lam):
                reference_lam[row] = value
            if 1 in active_rows and first_reference_coupling is None:
                first_reference_coupling = index
            if 1 not in active_rows:
                body_id = upper
                closed_y = q(positions[upper][1])+gravity[1]*h*h*index*(index+1)/2
                gate('upperFreeClosedPositionM', q(after[upper]['positionM'][1])-closed_y)
                gate('upperFreeClosedVelocityMps', q(after[upper]['velocityMps'][1])-gravity[1]*index*h, VELOCITY_GATE)
                body_id = None
            observed_lam, observed_scale, touched = [Fraction(0), Fraction(0)], [Fraction(1), Fraction(1)], set()
            impulses = {bid: [Fraction(0)]*3 for bid in moving}
            torques = {bid: [Fraction(0)]*3 for bid in moving}
            for c in states[index]['contacts']:
                a, b = c.get('bodyAId'), c.get('bodyBId')
                require(a in ids and b in ids and a != b, 'contact body links')
                require(c.get('colliderAId') == by_collider[a]['id'] and c.get('colliderBId') == by_collider[b]['id'], 'contact collider links')
                edge = edge_rows.get(frozenset([a, b]))
                if edge is None:
                    fail('unexpectedContactEdge', bodyAId=a, bodyBId=b)
                    continue
                if edge in touched:
                    fail('duplicatePublicAggregateContact', row=edge)
                    continue
                touched.add(edge)
                if first_observed[edge] is None:
                    first_observed[edge] = index
                if edge not in active_rows:
                    fail('unexpectedNonbindingContact', row=edge)
                lam = q(c.get('normalImpulseNs'))
                if lam < 0:
                    fail('strictNonnegativeImpulse', row=edge, value=reported(lam))
                normal, point, tangent = vector(c.get('normalAtoB')), vector(c.get('pointM')), vector(c.get('tangentImpulseOnBNs'))
                penetration = q(c.get('penetrationM'))
                if not 0 <= penetration <= 10:
                    fail('reportedPenetrationRange', value=reported(penetration))
                low, high = (floor, lower) if edge == 0 else (lower, upper)
                expected_normal = [0, 1 if a == low else -1, 0]
                gate('geometryNormalSquared', dot(normal, normal)-1, GEOMETRY_GATE)
                for value, expected in zip(normal, expected_normal):
                    gate('geometryNormalDirection', value-expected, GEOMETRY_GATE)
                for value in tangent:
                    gate('tangentImpulseNs', value, TANGENT_GATE)
                for bid, face_side in [(low, 1), (high, -1)]:
                    body_id = bid
                    local = local_point(after[bid], point)
                    gate('geometryRepresentativeFacePlaneM', local[1]-face_side*halves[bid][1], GEOMETRY_GATE)
                    for axis in range(3):
                        gate('geometryRepresentativeBoundsM', max(Fraction(0), abs(local[axis])-halves[bid][axis]), GEOMETRY_GATE)
                body_id = None
                observed_lam[edge] = lam
                observed_scale[edge] = normal[1] if a == low else -normal[1]
                on_b = add(scale(normal, lam), tangent)
                for bid, impulse in [(a, scale(on_b, -1)), (b, on_b)]:
                    if bid in moving:
                        impulses[bid] = add(impulses[bid], impulse)
                        torques[bid] = add(torques[bid], cross(sub(point, vector(after[bid]['positionM'])), impulse))
            for row in range(2):
                if reference_lam[row] > 0 and row not in touched:
                    fail('missingRequiredContact', row=row)
                expected_lam = reference_lam[row]/observed_scale[row] if observed_scale[row] > 0 else reference_lam[row]
                gate('globalNormalMultiplierNs', observed_lam[row]-expected_lam)
            actual_v = [q(after[bid]['velocityMps'][1]) for bid in moving]
            actual_p = [q(after[bid]['positionM'][1]) for bid in moving]
            for k, bid in enumerate(moving):
                body_id = bid
                gate('globalVelocityProjectionMps', actual_v[k]-velocity_target[k])
                gate('globalPositionProjectionM', actual_p[k]-position_target[k])
                reaction = sum((rows[row][k]*observed_scale[row]*observed_lam[row] for row in range(2)), Fraction(0))
                gate('globalActualJStationarityNs', masses[k]*(actual_v[k]-vf[k])-reaction)
                delta_momentum = scale(sub(vector(after[bid]['velocityMps']), vector(before[bid]['velocityMps'])), masses[k])
                for value in sub(delta_momentum, add(scale(gravity, masses[k]*h), impulses[bid])):
                    gate('bodyMomentumNs', value)
                spin_change = scale(sub(vector(after[bid]['angularVelocityRadps']), vector(before[bid]['angularVelocityRadps'])), Fraction(1, 3))
                for value in sub(spin_change, torques[bid]):
                    gate('bodyAngularMomentumNms', value)
                reconstructed_work = -masses[k]*gravity[1]*(actual_p[k]-pf[k])
                projection_work_sum += reconstructed_work
                maxima['maxReconstructedProjectionPotentialWorkJ'] = max(maxima.get('maxReconstructedProjectionPotentialWorkJ', Fraction(0)), abs(reconstructed_work))
            body_id = None
            for row in range(2):
                position_margin = dot(rows[row], actual_p)-bounds[row]
                gate('globalPositionPrimalM', max(Fraction(0), -position_margin))
                if row in active_rows:
                    margin = observed_scale[row]*dot(rows[row], actual_v)
                    gate('globalNormalPrimalMps', max(Fraction(0), -margin))
                    gate('globalNormalComplementarityJ', observed_lam[row]*margin)
            actual_ke = sum((dot(vector(after[bid]['velocityMps']), vector(after[bid]['velocityMps']))+
                             dot(vector(after[bid]['angularVelocityRadps']), vector(after[bid]['angularVelocityRadps']))/6 for bid in moving), Fraction(0))
            reference_ke = dot(velocity_target, velocity_target)
            free_ke = dot(vf, vf)
            gate('globalNormalKineticEnergyJ', actual_ke-reference_ke)
            gate('globalNormalEnergyGrowthJ', max(Fraction(0), actual_ke-free_ke))
            last_reference = {'stepIndex': index, 'activeVelocityRows': active_rows,
                'freeVelocityY': [ratio(x) for x in vf], 'velocityTargetY': [ratio(x) for x in velocity_target],
                'idealAxisNormalImpulsesNs': [ratio(x) for x in reference_lam],
                'freePositionY': [ratio(x) for x in pf], 'positionTargetY': [ratio(x) for x in position_target],
                'positionDualRatios': [ratio(x) for x in position_lam],
                'massWeightedVelocityChangeObjective': reported(velocity_cost),
                'massWeightedPositionChangeObjective': reported(position_cost),
                'referenceGlobalKineticLossJ': reported(free_ke-reference_ke),
                'actualGlobalKineticLossJ': reported(free_ke-actual_ke)}
        certificate.update({'caseId': CASE, 'receivedStates': len(states), 'receivedTransitions': len(states)-1,
                            'firstObservedFloorContact': first_observed[0],
                            'firstObservedInterfaceContact': first_observed[1],
                            'firstReferenceCouplingStep': first_reference_coupling,
                            'lastReference': last_reference,
                            'reconstructedProjectionPotentialWorkSumJ': reported(projection_work_sum),
                            'actualPositionDualExposed': False, 'globalNormalExpectedZeroOnlyWhenProjectionProvesIt': True,
                            'continuousTOIOrRemainderClaim': False})
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
    line = sys.stdin.buffer.readline(LINE_BYTES+1)
    if not line:
        return
    try:
        require(len(line) <= LINE_BYTES and line.endswith(b'\n'), '2MiB complete prefix request')
        require(sys.stdin.buffer.read(1) == b'', 'exactly one prefix request per process')
        envelope = json.loads(line, object_pairs_hook=reject_duplicates,
                              parse_constant=lambda _: (_ for _ in ()).throw(Invalid('JSON nonfinite')))
        require(type(envelope) is dict and set(envelope) == {'format', 'data', 'numericWordsF64leHex'} and envelope['format'] == 'coupled-cubes-floor-prefix-v1', 'prefix envelope')
        reply = verify(restore_words(envelope['data'], envelope['numericWordsF64leHex']))
    except (Invalid, KeyError, TypeError, ValueError, OverflowError, RecursionError) as error:
        reply = result(False, [{'input': str(error)[:512]}], execution_failure=True)
    encoded = json.dumps(reply, allow_nan=False, separators=(',', ':'))+'\n'
    require(len(encoded.encode()) <= 65536, 'bounded reference reply')
    sys.stdout.write(encoded)
    sys.stdout.flush()


if __name__ == '__main__':
    main()
