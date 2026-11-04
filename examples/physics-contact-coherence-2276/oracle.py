"""Independent physical Fraction/Hamilton fixed-pose certificates. No solver imports."""
from fractions import Fraction as F
import json
import math
import struct
import sys

LINE = 2 * 1024 * 1024
SI, GEOM = F.from_float(1e-10), F.from_float(1e-12)
operations, peak_bits = 0, 0


class Invalid(ValueError):
    pass


class Unproved(ValueError):
    pass


def need(ok, message):
    if not ok:
        raise Invalid(message)


def checked(value):
    global operations, peak_bits
    operations += 1
    bits = max(abs(value.numerator).bit_length(), value.denominator.bit_length())
    peak_bits = max(peak_bits, bits)
    if operations > 200000 or bits > 16384:
        raise Unproved('REFERENCE_WORK_OR_BIT_LIMIT')
    return value


def number(value):
    need(type(value) in (int, float) and math.isfinite(float(value)), 'finite JS Number')
    return float(value)


def q(value):
    return checked(F.from_float(number(value)))


def a(x, y):
    return checked(x + y)


def s(x, y):
    return checked(x - y)


def m(x, y):
    return checked(x * y)


def d(x, y):
    if y == 0:
        raise Unproved('ZERO_EXACT_PIVOT')
    return checked(x / y)


def vec(value, length=3):
    need(type(value) is list and len(value) == length, 'vector shape')
    return [q(x) for x in value]


def add(x, y):
    return [a(i, j) for i, j in zip(x, y)]


def sub(x, y):
    return [s(i, j) for i, j in zip(x, y)]


def scale(x, t):
    return [m(i, t) for i in x]


def dot(x, y):
    total = F(0)
    for i, j in zip(x, y):
        total = a(total, m(i, j))
    return total


def hamilton(x, y):
    w, u, v, z = x
    t, b, c, e = y
    return [s(s(s(m(w, t), m(u, b)), m(v, c)), m(z, e)),
            s(a(a(m(w, b), m(u, t)), m(v, e)), m(z, c)),
            a(s(a(m(w, c), m(v, t)), m(u, e)), m(z, b)),
            a(s(a(m(w, e), m(u, c)), m(v, b)), m(z, t))]


def commutator(x, y):
    left, right = hamilton([F(0)] + x, [F(0)] + y), hamilton([F(0)] + y, [F(0)] + x)
    result = [d(s(i, j), F(2)) for i, j in zip(left, right)]
    need(result[0] == 0, 'pure Hamilton commutator')
    return result[1:]


def rotate(body, value, inverse=False):
    x, y, z, w = vec(body['orientation'], 4)
    norm = dot([x, y, z, w], [x, y, z, w])
    need(norm > 0, 'nonzero physical quaternion')
    u, conjugate = [w, x, y, z], [w, -x, -y, -z]
    left, right = (conjugate, u) if inverse else (u, conjugate)
    result = hamilton(hamilton(left, [F(0)] + value), right)
    need(result[0] == 0, 'pure quaternion physical action')
    return [d(t, norm) for t in result[1:]]


def physical_tensor(body, inverse=True):
    local = vec(body['inverseInertiaLocal'])
    need(all(x > 0 for x in local), 'positive physical local inertia')
    columns = []
    for axis in range(3):
        basis = [F(int(k == axis)) for k in range(3)]
        local_value = rotate(body, basis, True)
        weighted = [m(x, t) if inverse else d(x, t) for x, t in zip(local_value, local)]
        columns.append(rotate(body, weighted))
    return [[columns[j][i] for j in range(3)] for i in range(3)]


def mv(matrix, vector):
    return [dot(row, vector) for row in matrix]


def word(value):
    return struct.pack('<d', number(value))


def words(value):
    if type(value) in (int, float):
        return word(value)
    if type(value) is list:
        return b''.join(words(x) for x in value)
    if type(value) is dict:
        return b''.join(words(x) for x in value.values())
    return b''


def same(x, y):
    return x == y and words(x) == words(y)


def restore(value, hexadecimal):
    need(type(hexadecimal) is str and len(hexadecimal) % 16 == 0 and
         len(hexadecimal) <= 65536 * 16 and all(c in '0123456789abcdef' for c in hexadecimal), 'word hex bound')
    raw = bytes.fromhex(hexadecimal)
    at, nodes = 0, 0

    def visit(item, depth):
        nonlocal at, nodes
        nodes += 1
        need(depth <= 32 and nodes <= 262144, 'numeric tree bound')
        if type(item) in (int, float):
            need(at + 8 <= len(raw), 'missing numeric word')
            actual = struct.unpack_from('<d', raw, at)[0]
            at += 8
            need(math.isfinite(actual) and actual == number(item), 'finite numeric word mismatch')
            return actual
        if type(item) is list:
            return [visit(x, depth + 1) for x in item]
        if type(item) is dict:
            return {key: visit(x, depth + 1) for key, x in item.items()}
        need(item is None or type(item) in (bool, str), 'JSON tree')
        return item

    result = visit(value, 0)
    need(at == len(raw), 'trailing numeric word')
    return result


def exact_certificate(rows, metric, free, bounds, proposed):
    """A proposed-support certificate, not a search or a candidate algorithm copy."""
    count = len(rows)
    support = [i for i, value in enumerate(proposed) if value > 0]
    gradients = [mv(metric, row) for row in rows]
    free_margin = [s(dot(row, free), bound) for row, bound in zip(rows, bounds)]
    matrix = [[dot(rows[i], gradients[j]) for j in support] + [-free_margin[i]] for i in support]
    pivots, pivot_row = [], 0
    for column in range(len(support)):
        chosen = next((k for k in range(pivot_row, len(matrix)) if matrix[k][column] != 0), None)
        if chosen is None:
            continue
        matrix[pivot_row], matrix[chosen] = matrix[chosen], matrix[pivot_row]
        divisor = matrix[pivot_row][column]
        matrix[pivot_row] = [d(x, divisor) for x in matrix[pivot_row]]
        for k in range(len(matrix)):
            if k != pivot_row and matrix[k][column] != 0:
                multiplier = matrix[k][column]
                matrix[k] = [s(x, m(multiplier, y)) for x, y in zip(matrix[k], matrix[pivot_row])]
        pivots.append(column)
        pivot_row += 1
    if any(all(x == 0 for x in row[:-1]) and row[-1] != 0 for row in matrix):
        raise Unproved('EXACT_ACTIVE_EQUATIONS_INCONSISTENT')
    dual_support = [proposed[i] for i in support]
    for k, column in enumerate(pivots):
        value = matrix[k][-1]
        for j in range(len(support)):
            if j not in pivots:
                value = s(value, m(matrix[k][j], dual_support[j]))
        dual_support[column] = value
    dual = [F(0)] * count
    for i, value in zip(support, dual_support):
        dual[i] = value
    if any(x < 0 for x in dual):
        raise Unproved('EXACT_DUAL_NEGATIVE')
    optimum = list(free)
    for gradient, multiplier in zip(gradients, dual):
        optimum = add(optimum, scale(gradient, multiplier))
    margins = [s(dot(row, optimum), bound) for row, bound in zip(rows, bounds)]
    if any(x < 0 for x in margins) or any(m(x, y) != 0 for x, y in zip(margins, dual)):
        raise Unproved('EXACT_ALL_ROW_KKT_NOT_PROVEN')
    return optimum, dual, margins, len(pivots)


def verify(data):
    need(type(data) is dict and set(data) == {'caseId', 'input', 'candidate'}, 'exact phase request fields')
    need(data['caseId'] == 'actual-free-490-final-pose', 'fixed actual case')
    actual, result = data['input'], data['candidate']
    need(actual['acceptedStep'] == 489 and actual['nextStep'] == 490 and actual['context'] == {'jointCount': 0}, 'actual captured490 boundary')
    free, pairs = actual['freeBodies'], actual['pairs']
    need(type(free) is list and len(free) == 4 and len(pairs) == 6, 'actual four bodies six pairs')
    ids = [body['id'] for body in free]
    need(len(set(ids)) == 4, 'unique body order')
    diagnostics = result['diagnostics']
    need(same(diagnostics['integratedFreeBodies'], free) and same(diagnostics['pairs'], pairs), 'retained original FREE input words')
    need(diagnostics['normalSolverCalls'] == diagnostics['positionPhaseCalls'] == diagnostics['positionSolverCalls'] == 1,
         'one unchanged solve per phase')
    projected, normal_input, final = diagnostics['positionCandidateBodies'], diagnostics['normalInputBodies'], result['candidateBodies']
    need(same(projected, normal_input), 'explicit projected normal input')
    need(same(final, diagnostics['impulseAppliedBodies']), 'no pose change after normal application')
    need([body['id'] for body in final] == ids, 'complete final body order')
    violations, maxima = [], {}

    def gate(name, value, limit=SI, **context):
        residual = abs(value)
        maxima[name] = max(maxima.get(name, F(0)), residual)
        if residual > limit and len(violations) < 32:
            violations.append({'gate': name, 'residual': float(residual), 'limit': float(limit), **context})

    moving = [i for i, body in enumerate(free) if q(body['inverseMass']) > 0]
    need(len(moving) == 3, 'three actual dynamic cubes')
    offsets = {i: 6 * k for k, i in enumerate(moving)}
    size = 6 * len(moving)
    metric = [[F(0)] * size for _ in range(size)]
    inertias, world_inverse = {}, {}
    free_vector, final_vector = [], []
    for i, (old, body, after) in enumerate(zip(free, normal_input, final)):
        need(same({k: v for k, v in body.items() if k != 'positionM'},
                  {k: v for k, v in old.items() if k != 'positionM'}), 'position phase changes only position')
        need(same({k: v for k, v in after.items() if k not in ('velocityMps', 'angularVelocityRadps')},
                  {k: v for k, v in body.items() if k not in ('velocityMps', 'angularVelocityRadps')}), 'normal phase changes only motion')
        if i not in offsets:
            need(same(old, body) and same(body, after), 'static whole-body words retained')
            continue
        offset, invmass = offsets[i], q(body['inverseMass'])
        inv, tensor = physical_tensor(body), physical_tensor(body, False)
        world_inverse[i], inertias[i] = inv, tensor
        for axis in range(3):
            metric[offset + axis][offset + axis] = invmass
            for column in range(3):
                metric[offset + 3 + axis][offset + 3 + column] = inv[axis][column]
        free_vector += vec(body['velocityMps']) + vec(body['angularVelocityRadps'])
        final_vector += vec(after['velocityMps']) + vec(after['angularVelocityRadps'])
    problem, solved, applications = diagnostics['normalProblem'], diagnostics['normalResult'], diagnostics['applications']
    need(solved['ok'] is True and solved['status'] == 'SOLVED_NORMAL_ONLY', 'actual normal solver result')
    points, lambdas = problem['points'], vec(solved['normalImpulsesNs'], len(problem['points']))
    need(len(points) == len(applications) <= 32 and len(problem['bodies']) == 4, 'all point/application bounds')
    for i, body in enumerate(problem['bodies']):
        need(body['id'] == ids[i], 'normal body ID order')
        for key in ('positionM', 'velocityMps', 'angularVelocityRadps', 'inverseMass'):
            need(same(body[key], normal_input[i][key]), 'normal actual operand words ' + key)
        if i in offsets:
            for axis in range(3):
                for column in range(3):
                    gate('normalPhysicalInverseTensor', s(q(body['inverseInertiaWorld'][axis][column]), world_inverse[i][axis][column]))
    normal_patches, post_patches = diagnostics['normalGeometry'], diagnostics['postGeometry']
    need(len(normal_patches) == len(post_patches), 'same complete final contact patch set')
    for pre, post in zip(normal_patches, post_patches):
        need(pre['aIndex'] == post['aIndex'] and pre['bIndex'] == post['bIndex'] and
             same(pre['geometry'], post['geometry']), 'normal/final geometry full word identity')
    flattened = [(patch, point) for patch in normal_patches for point in patch['geometry']['points']]
    need(len(flattened) == len(points), 'all projected contact points retained')
    impulses = {i: [F(0)] * 3 for i in moving}
    torques = {i: [F(0)] * 3 for i in moving}
    pair_totals, pair_lambda = {}, {}
    rows = []
    for p, (point, application, lam, linked) in enumerate(zip(points, applications, lambdas, flattened)):
        patch, geometric_point = linked
        ai, bi = int(patch['aIndex']), int(patch['bIndex'])
        need(point['aId'] == ids[ai] and point['bId'] == ids[bi] and application['id'] == point['id'], 'normal point endpoints')
        need(same(point['pointM'], geometric_point['midpointM']) and
             same(point['normalAtoB'], patch['geometry']['planeNormalAtoB']), 'actual geometry row words')
        need(same(application['pointM'], point['pointM']) and same(application['normalAtoB'], point['normalAtoB']) and
             q(application['normalImpulseNs']) == lam and application['aIndex'] == ai and application['bIndex'] == bi, 'application row/lambda links')
        key = ids[ai] + '\0' + ids[bi]
        need(application['pairKey'] == key, 'actual application pair key')
        pair_lambda[key] = pair_lambda.get(key, 0.0) + number(application['normalImpulseNs'])
        if lam < 0:
            violations.append({'gate': 'nonnegativeRoundedLambda', 'pointIndex': p})
        normal, point_m = vec(point['normalAtoB']), vec(point['pointM'])
        gate('normalUnitSquared', s(dot(normal, normal), F(1)), GEOM)
        row = [F(0)] * size
        recorded = application['contribution']['applications']
        need(type(recorded) is list and len(recorded) == 1, 'one actual point application')
        for i, sign, side_name in ((ai, F(-1), 'onA'), (bi, F(1), 'onB')):
            arm = sub(point_m, vec(normal_input[i]['positionM']))
            angular_row = commutator(arm, normal)
            side = recorded[0][side_name]
            need(same(side['comM'], normal_input[i]['positionM']), 'actual application COM words')
            force = scale(normal, m(sign, lam))
            torque = commutator(arm, force)
            for actual_value, target in zip(vec(side['armM']), arm):
                gate('actualApplicationArmM', s(actual_value, target), GEOM, pointIndex=p)
            for actual_value, target in zip(vec(side['linearImpulseNs']), force):
                gate('actualPointImpulseNs', s(actual_value, target), SI, pointIndex=p)
            for actual_value, target in zip(vec(side['armTorqueNms']), torque):
                gate('actualPointTorqueNms', s(actual_value, target), SI, pointIndex=p)
            total = pair_totals.setdefault(key, {}).setdefault(i, {'linear': [F(0)] * 3, 'worldAngular': [F(0)] * 3})
            total['linear'] = add(total['linear'], vec(side['linearImpulseNs']))
            total['worldAngular'] = add(total['worldAngular'], add(commutator(vec(side['comM']), vec(side['linearImpulseNs'])), vec(side['armTorqueNms'])))
            if i in offsets:
                offset = offsets[i]
                row[offset:offset + 6] = scale(normal + angular_row, sign)
                impulses[i] = add(impulses[i], vec(side['linearImpulseNs']))
                torques[i] = add(torques[i], vec(side['armTorqueNms']))
        rows.append(row)
        speed = dot(row, final_vector)
        gate('fullPhysicalPrimalMps', max(F(0), -speed), SI, pointIndex=p)
        gate('fullPhysicalComplementarityJ', m(lam, speed), SI, pointIndex=p)
    need(same(result['pairContributions'], diagnostics['pairContributions']), 'returned actual contribution links')
    need(len(result['pairContributions']) == len(pair_totals), 'complete actual pair totals')
    seen_pairs = set()
    for pair in result['pairContributions']:
        key = pair['aId'] + '\0' + pair['bId']
        need(key in pair_totals and key not in seen_pairs, 'unique actual pair total')
        seen_pairs.add(key)
        for body_id, side_name in ((pair['aId'], 'onA'), (pair['bId'], 'onB')):
            total = pair_totals[key][ids.index(body_id)]
            for value, target in zip(vec(pair[side_name]['linearImpulseNs']), total['linear']):
                gate('completedPairLinearImpulseNs', s(value, target))
            for value, target in zip(vec(pair[side_name]['angularImpulseAboutWorldOriginNms']), total['worldAngular']):
                gate('completedPairWorldAngularImpulseNms', s(value, target))
    for i in moving:
        offset, body, after = offsets[i], normal_input[i], final[i]
        dv = sub(vec(after['velocityMps']), vec(body['velocityMps']))
        dw = sub(vec(after['angularVelocityRadps']), vec(body['angularVelocityRadps']))
        momentum = scale(dv, d(F(1), q(body['inverseMass'])))
        angular = mv(inertias[i], dw)
        for actual_value, target in zip(momentum, impulses[i]):
            gate('actualLinearMomentumNs', s(actual_value, target), SI, bodyId=ids[i])
        for actual_value, target in zip(angular, torques[i]):
            gate('actualAngularMomentumNms', s(actual_value, target), SI, bodyId=ids[i])
        reaction = [F(0)] * 6
        for row, lam in zip(rows, lambdas):
            reaction = add(reaction, scale(row[offset:offset + 6], lam))
        for actual_value, target in zip(momentum + angular, reaction):
            gate('fullPhysicalStationarity', s(actual_value, target), SI, bodyId=ids[i])
    optimum, dual, margins, rank = exact_certificate(rows, metric, free_vector, [F(0)] * len(rows), lambdas)
    for value, target in zip(final_vector, optimum):
        gate('exactGlobalOptimalVelocityDifference', s(value, target))
    objective = F(0)
    exact_objective = F(0)
    for i in moving:
        offset = offsets[i]
        change, exact_change = sub(final_vector[offset:offset + 6], free_vector[offset:offset + 6]), sub(optimum[offset:offset + 6], free_vector[offset:offset + 6])
        objective = a(objective, d(a(d(dot(change[:3], change[:3]), q(normal_input[i]['inverseMass'])), dot(change[3:], mv(inertias[i], change[3:]))), F(2)))
        exact_objective = a(exact_objective, d(a(d(dot(exact_change[:3], exact_change[:3]), q(normal_input[i]['inverseMass'])), dot(exact_change[3:], mv(inertias[i], exact_change[3:]))), F(2)))
    gate('exactGlobalProjectionObjectiveDifferenceJ', s(objective, exact_objective))
    position = diagnostics['positionAttempt']
    need(same(position['preBodies'], free) and same(position['hypotheticalBodies'], projected), 'position input/output phase words')
    stats = diagnostics['positionStats']
    need(stats['rows'] == stats['tests'] == stats['postPairTests'] == 6 and stats['solverCalls'] == stats['workingApplicationCount'] == 1,
         'all six pairs one position solve/application')
    pos_problem, pos_result = position['problem'], position['result']
    need(pos_result['ok'] is True and pos_result['status'] == 'SOLVED', 'original solved position status')
    pos_metric = [[F(0)] * 9 for _ in range(9)]
    pos_offsets = {i: 3 * k for k, i in enumerate(moving)}
    for i in moving:
        for axis in range(3):
            pos_metric[pos_offsets[i] + axis][pos_offsets[i] + axis] = q(free[i]['inverseMass'])
    pos_rows, bounds = [], []
    axes = {i: [rotate(body, [F(int(k == axis)) for k in range(3)]) for axis in range(3)]
            for i, body in enumerate(free)}

    def physical_overlap(a_index, b_index, direction, frames):
        radius = F(0)
        for i in (a_index, b_index):
            for extent, axis in zip(vec(frames[i]['shape']['halfExtentsM']), axes[i]):
                radius = a(radius, m(extent, abs(dot(axis, direction))))
        separation = abs(dot(sub(vec(frames[b_index]['positionM']), vec(frames[a_index]['positionM'])), direction))
        return s(radius, separation)

    for row in pos_problem['rows']:
        vector = [F(0)] * 9
        ai, bi = ids.index(row['aId']), ids.index(row['bId'])
        direction = vec(row['normal'])
        gate('positionPhysicalSupportBoundM', s(q(row['boundM']), physical_overlap(ai, bi, direction, free)), GEOM)
        for bid, sign in ((row['aId'], F(-1)), (row['bId'], F(1))):
            i = ids.index(bid)
            if i in pos_offsets:
                vector[pos_offsets[i]:pos_offsets[i] + 3] = scale(vec(row['normal']), sign)
        pos_rows.append(vector)
        bounds.append(q(row['boundM']))
    translations = pos_result['translations']
    need(len(translations) == 4 and [entry['id'] for entry in translations] == ids, 'all position translations')
    u = []
    for i in moving:
        nominal = vec(translations[i]['u'])
        u += nominal
        for axis in range(3):
            # Python binary64 addition independently checks the documented PRE+u boundary.
            need(word(projected[i]['positionM'][axis]) == word(number(free[i]['positionM'][axis]) + number(translations[i]['u'][axis])), 'position rounded PRE+u words')
    pos_lambda = vec(pos_result['lambdaKgM'], len(pos_rows))
    pos_optimum, pos_dual, pos_margins, pos_rank = exact_certificate(pos_rows, pos_metric, [F(0)] * 9, bounds, pos_lambda)
    for actual_value, target in zip(u, pos_optimum):
        gate('exactGlobalPositionDifferenceM', s(actual_value, target))
    for row, bound, lam in zip(pos_rows, bounds, pos_lambda):
        margin = s(dot(row, u), bound)
        gate('positionPrimalM', max(F(0), -margin), GEOM)
        gate('positionComplementarityKgM2', m(lam, margin), GEOM)
        if lam < 0:
            violations.append({'gate': 'positionNonnegativeLambda'})
    pos_reaction = [F(0)] * 9
    for row, lam in zip(pos_rows, pos_lambda):
        pos_reaction = add(pos_reaction, scale(row, lam))
    for i in moving:
        offset = pos_offsets[i]
        for axis in range(3):
            gate('positionStationarityKgM', s(d(u[offset + axis], q(free[i]['inverseMass'])), pos_reaction[offset + axis]), GEOM)
    # Independent OBB separating-axis theorem: inspect all physical edge/face axes,
    # not the candidate's selected SAT feature or production tie-breaking routine.
    for pair in pairs:
        ai, bi = (int(value) for value in pair)
        directions = axes[ai] + axes[bi] + [commutator(x, y) for x in axes[ai] for y in axes[bi]]
        separated = False
        for direction in directions:
            squared_norm = dot(direction, direction)
            if squared_norm == 0:
                continue
            overlap = physical_overlap(ai, bi, direction, final)
            if overlap <= 0 or m(overlap, overlap) <= m(m(GEOM, GEOM), squared_norm):
                separated = True
                break
        if not separated:
            violations.append({'gate': 'physicalAllPairNonpenetrationM', 'pair': [ids[ai], ids[bi]], 'limit': float(GEOM)})
    def geometric_point(point, a_index, b_index, geometry):
        normal = vec(geometry['planeNormalAtoB'])
        for i in (a_index, b_index):
            local = rotate(final[i], sub(vec(point), vec(final[i]['positionM'])), True)
            half = vec(final[i]['shape']['halfExtentsM'])
            for value, extent in zip(local, half):
                gate('physicalWitnessBoundsM', max(F(0), s(abs(value), extent)), GEOM)
            reference = geometry.get('reference')
            if geometry['family'] == 'face':
                need(type(reference) is dict, 'face selectors')
                is_reference = (i == a_index) == (reference['body'] == 'a')
                axis = int(reference['axis'] if is_reference else reference['incidentAxis'])
                side = q(reference['side'] if is_reference else reference['incidentSide'])
                gate('physicalWitnessFacePlaneM', s(local[axis], m(side, half[axis])), GEOM)
        va = add(vec(final[a_index]['velocityMps']), commutator(vec(final[a_index]['angularVelocityRadps']), sub(vec(point), vec(final[a_index]['positionM']))))
        vb = add(vec(final[b_index]['velocityMps']), commutator(vec(final[b_index]['angularVelocityRadps']), sub(vec(point), vec(final[b_index]['positionM']))))
        gate('freshPostPhysicalNormalFeasibilityMps', max(F(0), -dot(sub(vb, va), normal)))
    contacts = {(contact['aId'], contact['bId']): contact for contact in result['contacts']}
    need(len(contacts) == len(result['contacts']) == len(post_patches), 'all final contact summaries')
    penetration = {entry['pairKey']: entry['hit']['penetration'] if entry['hit'] else 0 for entry in position['initialDetections']}
    for patch in post_patches:
        ai, bi, geometry = int(patch['aIndex']), int(patch['bIndex']), patch['geometry']
        for point in geometry['points']:
            geometric_point(point['midpointM'], ai, bi, geometry)
        contact = contacts[(ids[ai], ids[bi])]
        need(word(contact['penetrationM']) == word(penetration[patch['pairKey']]), 'original FREE penetration summary words')
        need(word(contact['impulseNs']) == word(pair_lambda[patch['pairKey']]), 'retained-order actual impulse summary words')
        need(same(contact['normalAtoB'], geometry['planeNormalAtoB']) and all(x == 0 for x in vec(contact['tangentImpulseNs'])), 'honest frictionless summary')
        geometric_point(contact['pointM'], ai, bi, geometry)
    return {'ok': not violations, 'resolved': True, 'executionFailure': False,
            'status': 'FIXED_POSE_EXACT_KKT_AND_APPLIED_PHYSICS_CONFIRMED' if not violations else 'PHYSICAL_NO_GO',
            'violations': violations, 'metrics': {key: float(value) for key, value in maxima.items()},
            'certificate': {'exactNormalKKT': True, 'exactPositionKKT': True,
                            'normalSupportRank': rank, 'positionSupportRank': pos_rank,
                            'normalPoints': len(points), 'positionRows': len(pos_rows),
                            'physicalUniqueGlobalVelocityOptimum': True, 'samePoseApplication': True,
                            'roundedOutputIsExactOptimum': final_vector == optimum,
                            'independentTrajectoryTransitionsAdded': 0, 'restRecoveryClaim': False},
            'worldCalls': 0, 'candidateImports': 0, 'referenceOperations': operations, 'referencePeakBits': peak_bits}


def main():
    try:
        raw = sys.stdin.buffer.readline(LINE + 1)
        need(0 < len(raw) <= LINE and raw.endswith(b'\n') and sys.stdin.buffer.read(1) == b'', 'one bounded request and EOF')
        packet = json.loads(raw)
        need(packet['format'] == 'contact-coherence-private-v1', 'private wire format')
        reply = verify(restore(packet['data'], packet['numericWordsF64leHex']))
    except Unproved as error:
        reply = {'ok': False, 'resolved': False, 'executionFailure': False, 'status': 'EXACT_OPTIMUM_NOT_PROVEN',
                 'reason': str(error), 'violations': [], 'referenceOperations': operations, 'referencePeakBits': peak_bits}
    except (Invalid, KeyError, TypeError, ValueError, IndexError, OverflowError, ZeroDivisionError) as error:
        reply = {'ok': False, 'resolved': False, 'executionFailure': True, 'status': 'INVALID_INPUT', 'reason': str(error), 'violations': []}
    encoded = json.dumps(reply, separators=(',', ':'), allow_nan=False)
    need(len(encoded.encode()) <= 65536, '64KiB reply cap')
    print(encoded)


if __name__ == '__main__':
    main()
