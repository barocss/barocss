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
CASE = "chain3-120"
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


def solve_small(matrix, rhs):
    """Exact elimination of at most3 equations, only for one literal active subset."""
    n = len(rhs)
    require(0 <= n <= 3 and len(matrix) == n and all(len(row) == n for row in matrix), 'literal Gram shape')
    table = [list(row)+[value] for row, value in zip(matrix, rhs)]
    for column in range(n):
        pivot = next((i for i in range(column, n) if table[i][column] != 0), None)
        require(pivot is not None, 'independent fixed chain Gram')
        table[column], table[pivot] = table[pivot], table[column]
        divisor = table[column][column]
        table[column] = [value/divisor for value in table[column]]
        for i in range(n):
            if i == column:
                continue
            factor = table[i][column]
            table[i] = [a-factor*b for a, b in zip(table[i], table[column])]
    return [table[i][-1] for i in range(n)]


def project_three(free, rows, bounds):
    """Eight fixed active subsets, M=diag(2,2,2); no candidate optimizer or search state."""
    require(len(free) == 3 and 0 <= len(rows) <= 3 and len(bounds) == len(rows), 'fixed3DOF reference')
    candidates = []
    for mask in range(1 << len(rows)):
        active = [i for i in range(len(rows)) if mask & (1 << i)]
        gram = [[dot(rows[i], rows[j])/2 for j in active] for i in active]
        rhs = [bounds[i]-dot(rows[i], free) for i in active]
        selected = solve_small(gram, rhs)
        lam = [Fraction(0)]*len(rows)
        for i, value in zip(active, selected):
            lam[i] = value
        target = [free[k]+sum((row[k]*value/2 for row, value in zip(rows, lam)), Fraction(0)) for k in range(3)]
        if all(value >= 0 for value in lam) and all(dot(row, target) >= bound for row, bound in zip(rows, bounds)):
            objective = sum(((a-b)**2 for a, b in zip(target, free)), Fraction(0))
            candidates.append((objective, target, lam))
    require(candidates, 'fixed chain feasible projection')
    best = min(candidates, key=lambda item: item[0])
    require(all(item[1] == best[1] for item in candidates if item[0] == best[0]), 'unique strictly convex global target')
    return best[1], best[2], best[0]


def ratio(value):
    return {'n': str(value.numerator), 'd': str(value.denominator)}


def verify(data):
    maxima, violations, step_index, body_id = {}, [], None, None
    certificate = {'scope': 'FIXED_THREE_CUBE_VERTICAL_INELASTIC_CHAIN', 'candidateImports': 0,
                   'candidateSolves': 0, 'generalDynamicEight': False, 'privateManifoldPointClaim': False,
                   'actualWorldCalls': 'CALLER_OWNED_NOT_INFERRED',
                   'projectionWorkBoundary': 'Public-state reconstruction includes unobserved free-position rounding',
                   'aggregateMeanIsForceCentroid': False}

    def fail(name, **details):
        violations.append({'gate': name, 'stepIndex': step_index, 'bodyId': body_id, **details})
        # Keep the earliest32 observations even when schema-read checks preceded the math pass.
        violations.sort(key=lambda item: item['stepIndex'] if item['stepIndex'] is not None else -1)
        del violations[32:]

    def gate(name, residual, limit=GATE):
        value = abs(residual)
        maxima[name] = max(maxima.get(name, Fraction(0)), value)
        if value > limit:
            fail(name, residual=reported(value), limit=reported(limit))

    def metrics():
        return {key: reported(value) if isinstance(value, Fraction) else value for key, value in maxima.items()}

    try:
        require(type(data) is dict and set(data) == {'caseId', 'model', 'options', 'states'} and data['caseId'] == CASE, 'fixed case fields/ID')
        model, options, states = data['model'], data['options'], data['states']
        require(type(model) is dict and type(options) is dict, 'public model/options')
        require(options.get('profile') == 'rigid-persistent-box-v1' and options.get('broadPhase') == 'direct' and q(options.get('fixedStepSeconds')) == q(1/120), 'existing direct fixed120 profile')
        h, gravity = q(options['fixedStepSeconds']), vector(model.get('gravityMps2'))
        require(gravity == vector([0, -9.81, 0]), 'original gravity')
        require(model.get('format') == 'barocss-physics-model' and integer(model.get('version')) == 1 and model.get('units') == {'length': 'm', 'mass': 'kg', 'time': 's', 'angle': 'rad'}, 'public SI model')
        require(model.get('frame', {}).get('basis') == 'right-handed-xyz' and model.get('frame', {}).get('rotation') == 'local-to-world-xyzw', 'frame convention')
        require(all(model.get(key) == [] for key in ['joints', 'cloths', 'fluids', 'sourceBindings']), 'no extra domains/bindings')
        definitions, colliders = model.get('bodies'), model.get('colliders')
        require(type(definitions) is list and len(definitions) == 4 and type(colliders) is list and len(colliders) == 4, 'existing four-body cap')
        ids = [body.get('id') for body in definitions]
        require(all(type(bid) is str and 0 < len(bid) <= 64 for bid in ids) and len(set(ids)) == 4, 'opaque unique body IDs')
        authored = dict(zip(ids, definitions))
        dynamic, static = [b for b in definitions if b.get('kind') == 'dynamic'], [b for b in definitions if b.get('kind') == 'static']
        require(len(dynamic) == 3 and len(static) == 1, 'three cubes and prescribed static floor')
        moving = [body['id'] for body in sorted(dynamic, key=lambda body: q(body['initial']['positionM'][1]))]
        floor = static[0]['id']
        initial_positions = {bid: [0, y, 0] for bid, y in zip(moving, [.5, 1.5, 2.75])}
        initial_positions[floor] = [0, -.5, 0]
        by_collider, halves, collider_ids = {}, {}, set()
        for c in colliders:
            bid = c.get('bodyId')
            require(bid in authored and bid not in by_collider and type(c.get('id')) is str and c['id'] not in collider_ids, 'one unique collider per body')
            collider_ids.add(c['id'])
            require(c.get('geometry', {}).get('kind') == 'box', 'box geometry')
            halves[bid] = vector(c['geometry'].get('halfExtentsM'))
            require(halves[bid] == vector([2, .5, 2] if bid == floor else [.5, .5, .5]), 'literal finite extents')
            require(c.get('local') == {'positionM': [0, 0, 0], 'orientationXYZW': [0, 0, 0, 1]} and c.get('sensor') is False and c.get('ccd') is False and c.get('filter') == {'categoryBits': 1, 'maskBits': 65535}, 'identity-local nonCCD unsensed unfiltered')
            require(c.get('material') == {'restitution': 0, 'friction': {'static': 0, 'dynamic': 0}}, 'e0 friction0')
            by_collider[bid] = c
        for bid, definition in authored.items():
            initial = definition.get('initial', {})
            require(vector(initial.get('positionM')) == vector(initial_positions[bid]) and vector(initial.get('orientationXYZW'), 4) == vector([0, 0, 0, 1], 4), 'fixed authored pose')
            if bid in moving:
                require(q(definition.get('massKg')) == 2 and definition.get('inertia') == {'kind': 'primitive-com', 'about': 'com', 'frame': 'body-local'} and vector(initial.get('velocityMps')) == [0, 0, 0] and vector(initial.get('angularVelocityRadps')) == [0, 0, 0], 'mass2 primitive/rest')
        require(type(states) is list and 1 <= len(states) <= 257, 'prefix or whole trajectory population')
        require(type(states[0]) is dict and type(states[0].get('identity')) is dict, 'public initial identity')
        identity, maps = states[0]['identity'], []
        require(identity.get('profile') == options['profile'], 'public profile identity')
        for index, state in enumerate(states):
            step_index = index
            require(type(state) is dict and type(state.get('bodies')) is list and len(state['bodies']) == 4, 'public state shape')
            require(set(b.get('id') for b in state['bodies']) == set(ids), 'complete observed body IDs')
            require(type(state.get('contacts')) is list and len(state['contacts']) <= 6, 'at most six eligible public pair records')
            require(type(state.get('stepIndex')) in (int, float), 'numeric observed index')
            gate('observedStepIndex', q(state['stepIndex'])-index, Fraction(0))
            gate('observedClockSeconds', q(state.get('timeSeconds'))-q(index*number(options['fixedStepSeconds'])), Fraction(0))
            if state.get('identity') != identity:
                fail('observedIdentityChanged')
            if any(state.get(key) != [] for key in ['joints', 'ccdHits', 'cloths', 'fluids']):
                fail('unexpectedStateDomain')
            bs = {body['id']: body for body in state['bodies']}
            for bid, body in bs.items():
                body_id = bid
                for key in ['positionM', 'velocityMps', 'angularVelocityRadps']:
                    vector(body.get(key))
                orientation = vector(body.get('orientationXYZW'), 4)
                if body.get('kind') != authored[bid]['kind'] or body.get('sleeping') is not False:
                    fail('observedKindOrSleepingChanged')
                if bid == floor and index and raw_body(body) != raw_body(maps[0][floor]):
                    fail('prescribedStaticWordsChanged')
                if bid in moving:
                    for value in vector(body['angularVelocityRadps']):
                        gate('omegaRadps', value)
                    for value, expected in zip(orientation, [0, 0, 0, 1]):
                        gate('orientationComponent', value-expected)
                    for axis in [0, 2]:
                        gate('lateralPositionM', q(body['positionM'][axis]))
                        gate('lateralVelocityMps', q(body['velocityMps'][axis]))
            maps.append(bs)
        body_id, step_index = None, 0
        if states[0]['contacts']:
            fail('initialPublicContactsConvention')
        for bid in ids:
            body_id = bid
            for value in sub(vector(maps[0][bid]['positionM']), vector(initial_positions[bid])):
                gate('actualInitialPositionM', value, Fraction(0))
            for value in vector(maps[0][bid]['velocityMps'])+vector(maps[0][bid]['angularVelocityRadps']):
                gate('actualInitialMotion', value, Fraction(0))
        rows = [[Fraction(1), Fraction(0), Fraction(0)],
                [Fraction(-1), Fraction(1), Fraction(0)],
                [Fraction(0), Fraction(-1), Fraction(1)]]
        bounds = [q(initial_positions[floor][1])+halves[floor][1]+halves[moving[0]][1],
                  halves[moving[0]][1]+halves[moving[1]][1], halves[moving[1]][1]+halves[moving[2]][1]]
        chain = [floor]+moving
        edges = {frozenset([chain[i], chain[i+1]]): i for i in range(3)}
        first_observed, first_reference = [None]*3, [None]*3
        last_reference, projection_work = None, Fraction(0)
        for index in range(1, len(states)):
            step_index, body_id = index, None
            before, after = maps[index-1], maps[index]
            vf = [q(before[bid]['velocityMps'][1])+gravity[1]*h for bid in moving]
            pf = [q(before[bid]['positionM'][1])+vf[k]*h for k, bid in enumerate(moving)]
            position_target, position_lam, position_cost = project_three(pf, rows, bounds)
            active = [i for i in range(3) if dot(rows[i], position_target) == bounds[i]]
            velocity_target, selected_lam, velocity_cost = project_three(vf, [rows[i] for i in active], [Fraction(0)]*len(active))
            reference_lam = [Fraction(0)]*3
            for row, value in zip(active, selected_lam):
                reference_lam[row] = value
                if first_reference[row] is None:
                    first_reference[row] = index
            if 2 not in active:
                body_id = moving[2]
                expected_y = q(initial_positions[moving[2]][1])+gravity[1]*h*h*index*(index+1)/2
                gate('upperFreeClosedPositionM', q(after[moving[2]]['positionM'][1])-expected_y)
                gate('upperFreeClosedVelocityMps', q(after[moving[2]]['velocityMps'][1])-gravity[1]*index*h, VELOCITY_GATE)
                body_id = None
            observed_lam, observed_scale = [Fraction(0)]*3, [Fraction(1)]*3
            impulses, touched = {bid: [Fraction(0)]*3 for bid in moving}, set()
            for contact in states[index]['contacts']:
                a, b = contact.get('bodyAId'), contact.get('bodyBId')
                require(a in ids and b in ids and a != b, 'contact endpoints')
                require(contact.get('colliderAId') == by_collider[a]['id'] and contact.get('colliderBId') == by_collider[b]['id'], 'contact collider schema')
                edge = edges.get(frozenset([a, b]))
                if edge is None:
                    fail('unexpectedContactEdge', bodyAId=a, bodyBId=b)
                    continue
                if edge in touched:
                    fail('duplicatePublicAggregateContact', row=edge)
                    continue
                touched.add(edge)
                if first_observed[edge] is None:
                    first_observed[edge] = index
                if edge not in active:
                    fail('unexpectedNonbindingContact', row=edge)
                normal, point, tangent = vector(contact.get('normalAtoB')), vector(contact.get('pointM')), vector(contact.get('tangentImpulseOnBNs'))
                lam = q(contact.get('normalImpulseNs'))
                if lam < 0:
                    fail('strictNonnegativeImpulse', row=edge, value=reported(lam))
                penetration = q(contact.get('penetrationM'))
                if not 0 <= penetration <= 10:
                    fail('reportedFreePenetrationRange', value=reported(penetration))
                low, high = chain[edge], chain[edge+1]
                expected_normal = [0, 1 if a == low else -1, 0]
                gate('geometryNormalSquared', dot(normal, normal)-1, GEOMETRY_GATE)
                for value, expected in zip(normal, expected_normal):
                    gate('geometryNormalDirection', value-expected, GEOMETRY_GATE)
                for value in tangent:
                    gate('tangentImpulseNs', value, TANGENT_GATE)
                for bid, side in [(low, 1), (high, -1)]:
                    body_id = bid
                    quaternion = vector(after[bid]['orientationXYZW'], 4)
                    if dot(quaternion, quaternion) == 0:
                        fail('geometryObservedQuaternionZeroNorm')
                        continue
                    local = local_point(after[bid], point)
                    gate('geometryRepresentativeFacePlaneM', local[1]-side*halves[bid][1], GEOMETRY_GATE)
                    for axis in range(3):
                        gate('geometryRepresentativeBoundsM', max(Fraction(0), abs(local[axis])-halves[bid][axis]), GEOMETRY_GATE)
                body_id = None
                observed_lam[edge], observed_scale[edge] = lam, normal[1] if a == low else -normal[1]
                on_b = add(scale(normal, lam), tangent)
                for bid, impulse in [(a, scale(on_b, -1)), (b, on_b)]:
                    if bid in moving:
                        impulses[bid] = add(impulses[bid], impulse)
            for row in range(3):
                if reference_lam[row] > 0 and row not in touched:
                    fail('missingRequiredContact', row=row)
                expected_lam = reference_lam[row]/observed_scale[row] if observed_scale[row] > 0 else reference_lam[row]
                gate('globalNormalMultiplierNs', observed_lam[row]-expected_lam)
            actual_v, actual_p = [q(after[bid]['velocityMps'][1]) for bid in moving], [q(after[bid]['positionM'][1]) for bid in moving]
            for k, bid in enumerate(moving):
                body_id = bid
                gate('globalVelocityProjectionMps', actual_v[k]-velocity_target[k])
                gate('globalPositionProjectionM', actual_p[k]-position_target[k])
                reaction = sum((rows[row][k]*observed_scale[row]*observed_lam[row] for row in range(3)), Fraction(0))
                gate('globalActualJStationarityNs', 2*(actual_v[k]-vf[k])-reaction)
                for value in sub(scale(sub(vector(after[bid]['velocityMps']), vector(before[bid]['velocityMps'])), Fraction(2)),
                                 add(scale(gravity, 2*h), impulses[bid])):
                    gate('bodyMomentumNs', value)
                # Public aggregate point is not a force centroid: no fabricated point-torque sum.
                work = -2*gravity[1]*(actual_p[k]-pf[k])
                projection_work += work
                maxima['maxReconstructedProjectionPotentialWorkJ'] = max(maxima.get('maxReconstructedProjectionPotentialWorkJ', Fraction(0)), abs(work))
            body_id = None
            for row in range(3):
                gate('globalPositionPrimalM', max(Fraction(0), bounds[row]-dot(rows[row], actual_p)))
                if row in active:
                    margin = observed_scale[row]*dot(rows[row], actual_v)
                    gate('globalNormalPrimalMps', max(Fraction(0), -margin))
                    gate('globalNormalComplementarityJ', observed_lam[row]*margin)
            actual_ke = sum((dot(vector(after[bid]['velocityMps']), vector(after[bid]['velocityMps']))+
                             dot(vector(after[bid]['angularVelocityRadps']), vector(after[bid]['angularVelocityRadps']))/6 for bid in moving), Fraction(0))
            reference_ke, free_ke = dot(velocity_target, velocity_target), dot(vf, vf)
            gate('globalNormalKineticEnergyJ', actual_ke-reference_ke)
            gate('globalNormalEnergyGrowthJ', max(Fraction(0), actual_ke-free_ke))
            last_reference = {'stepIndex': index, 'activeVelocityRows': active,
                'freeVelocityY': [ratio(x) for x in vf], 'velocityTargetY': [ratio(x) for x in velocity_target],
                'idealAxisNormalImpulsesNs': [ratio(x) for x in reference_lam],
                'freePositionY': [ratio(x) for x in pf], 'positionTargetY': [ratio(x) for x in position_target],
                'positionDualRatios': [ratio(x) for x in position_lam],
                'massWeightedVelocityChangeObjective': reported(velocity_cost),
                'massWeightedPositionChangeObjective': reported(position_cost),
                'referenceGlobalKineticLossJ': reported(free_ke-reference_ke), 'actualGlobalKineticLossJ': reported(free_ke-actual_ke)}
        certificate.update({'caseId': CASE, 'receivedStates': len(states), 'receivedTransitions': len(states)-1,
            'referenceVerticalDof': 3, 'activeSubsetsAtMost': 8, 'gramDimensionAtMost': 3,
            'firstPhysicalFailureStep': violations[0]['stepIndex'] if violations else None,
            'firstObservedContacts': first_observed, 'firstReferenceContacts': first_reference,
            'couplingObserved': first_observed[2] is not None, 'lastReference': last_reference,
            'reconstructedProjectionPotentialWorkSumJ': reported(projection_work),
            'angularEvidence': 'Observed omega/orientation/rotational energy only; public mean is not applied wrench',
            'actualPositionDualExposed': False, 'continuousTOIOrRemainderClaim': False})
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
        require(len(line) <= LINE_BYTES and line.endswith(b'\n') and sys.stdin.buffer.read(1) == b'', 'one complete2MiB case line+EOF')
        envelope = json.loads(line, object_pairs_hook=reject_duplicates,
                              parse_constant=lambda _: (_ for _ in ()).throw(Invalid('JSON nonfinite')))
        require(type(envelope) is dict and set(envelope) == {'format', 'data', 'numericWordsF64leHex'} and envelope['format'] == 'three-cubes-floor-case-v1', 'case envelope')
        reply = verify(restore_words(envelope['data'], envelope['numericWordsF64leHex']))
    except (Invalid, KeyError, TypeError, ValueError, OverflowError, RecursionError) as error:
        reply = result(False, [{'input': str(error)[:512]}], execution_failure=True)
    encoded = json.dumps(reply, allow_nan=False, separators=(',', ':'))+'\n'
    require(len(encoded.encode()) <= 65536, 'bounded reference reply')
    sys.stdout.write(encoded)


if __name__ == '__main__':
    main()
