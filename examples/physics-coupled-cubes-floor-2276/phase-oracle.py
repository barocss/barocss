"""Independent actual phase certificate. No candidate/package imports or World-shaped output."""
from fractions import Fraction
from pathlib import Path
import hashlib
import importlib.util
import json
import math
import struct
import sys

BASELINE_SHA = 'c9bd37d91bb97bf584ddc0a2bc80a0e60fb8cbf26d049b97f5668315e5839f66'
path = Path(__file__).with_name('oracle.py')
if hashlib.sha256(path.read_bytes()).hexdigest() != BASELINE_SHA:
    raise RuntimeError('IMMUTABLE_BASELINE_ORACLE_PIN')
spec = importlib.util.spec_from_file_location('immutable_coupled_baseline_reference', path)
B = importlib.util.module_from_spec(spec)
spec.loader.exec_module(B)


def body_words(body):
    return b''.join(struct.pack('<d', B.number(x)) for key in ['positionM', 'velocityMps', 'orientation', 'angularVelocityRadps'] for x in body[key])


def inverse3(matrix):
    cross0, cross1, cross2 = B.cross(matrix[1], matrix[2]), B.cross(matrix[2], matrix[0]), B.cross(matrix[0], matrix[1])
    determinant = B.dot(matrix[0], cross0)
    B.require(determinant > 0, 'positive actual world inertia determinant')
    return [[cross0[k]/determinant, cross1[k]/determinant, cross2[k]/determinant] for k in range(3)]


def mv(matrix, value):
    return [B.dot(row, value) for row in matrix]


def fvec(value):
    B.vector(value)
    return [B.number(x) for x in value]


def fsub(a, b):
    return [x-y for x, y in zip(a, b)]


def fcross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def verify(data):
    violations, maxima, owner = [], {}, None
    certificate = {'scope': 'CAPTURED_FREE_PRIVATE_CANDIDATE_NOT_PUBLIC_WORLD_ACCEPTED',
                   'publicWorldStep27Claim': False, 'perPointWrenchChecked': True,
                   'aggregateMeanIsForceCentroid': False, 'candidateImports': 0, 'candidateSolves': 0}

    def fail(name, **details):
        if len(violations) < 32:
            violations.append({'gate': name, 'bodyId': owner, **details})

    def gate(name, residual, limit=B.GATE):
        value = abs(residual)
        maxima[name] = max(maxima.get(name, Fraction(0)), value)
        if value > limit:
            fail(name, residual=B.reported(value), limit=B.reported(limit))

    try:
        B.require(type(data) is dict and set(data) == {'beforeBodies', 'freeBodies', 'pairs', 'context', 'candidate'}, 'phase fields')
        before, free, pairs, result = data['beforeBodies'], data['freeBodies'], data['pairs'], data['candidate']
        B.require(data['context'] == {'jointCount': 0}, 'no joints context')
        B.require(type(before) is list and type(free) is list and len(before) == len(free) == 3, 'actual captured three-body phase')
        ids = [body.get('id') for body in free]
        B.require(len(set(ids)) == 3 and all(type(x) is str for x in ids), 'unique actual phase IDs')
        by_id, old = {body['id']: body for body in free}, {body['id']: body for body in before}
        B.require(set(old) == set(ids), 'BEFORE/FREE body links')
        dynamic = [body for body in free if body.get('kind') == 'dynamic']
        fixed = [body for body in free if body.get('kind') == 'static']
        B.require(len(dynamic) == 2 and len(fixed) == 1, 'fixed diagnostic population')
        floor = fixed[0]['id']
        lower, upper = [body['id'] for body in sorted(dynamic, key=lambda body: B.q(body['positionM'][1]))]
        moving, h, g = [lower, upper], B.q(1/120), B.vector([0, -9.81, 0])
        B.require(type(pairs) is list and len(pairs) == 3, 'all three eligible position pairs')
        expected_pairs = sorted(([i, j] if ids[i] < ids[j] else [j, i] for i in range(3) for j in range(i+1, 3)), key=lambda pair: (ids[pair[0]], ids[pair[1]]))
        B.require([[B.integer(x) for x in pair] for pair in pairs] == expected_pairs, 'complete original sorted pair list')
        for bid, body in by_id.items():
            owner = bid
            B.require(body['shape']['kind'] == 'box' and B.q(body['restitution']) == 0 and B.q(body['frictionStatic']) == 0 and B.q(body['frictionDynamic']) == 0, 'actual zeroe/friction box')
            B.vector(body['positionM']); B.vector(body['velocityMps']); B.vector(body['angularVelocityRadps']); B.vector(body['orientation'], 4)
            if bid == floor:
                B.require(B.q(body['inverseMass']) == 0 and body_words(body) == body_words(old[bid]), 'prescribed static FREE words')
            else:
                B.require(B.q(body['inverseMass']) == Fraction(1, 2) and B.vector(body['shape']['halfExtentsM']) == B.vector([.5, .5, .5]) and B.vector(body['inverseInertiaLocal']) == B.vector([3, 3, 3]), 'actual mass2 primitive cube inertia3')
                for axis in range(3):
                    gate('capturedFreeVelocityMps', B.q(body['velocityMps'][axis])-B.q(old[bid]['velocityMps'][axis])-g[axis]*h, B.VELOCITY_GATE)
                    gate('capturedFreePositionM', B.q(body['positionM'][axis])-B.q(old[bid]['positionM'][axis])-B.q(body['velocityMps'][axis])*h)
        owner = None
        B.require(type(result) is dict and type(result.get('diagnostics')) is dict, 'complete returned private candidate')
        diagnostics = result['diagnostics']
        B.require(diagnostics['normalSolverCalls'] == 1 and diagnostics['positionPhaseCalls'] == 1 and diagnostics['positionSolverCalls'] == 1, 'one cold solve per phase')
        B.require(diagnostics['freeBodies'] == free and diagnostics['pairs'] == pairs and
                  all(body_words(a) == body_words(b) for a, b in zip(diagnostics['freeBodies'], free)), 'actual phase diagnostic links')
        velocity, final = diagnostics['velocityBodies'], result['candidateBodies']
        B.require(type(velocity) is list and type(final) is list and [x['id'] for x in velocity] == ids and [x['id'] for x in final] == ids, 'complete candidate body order')
        vmap, fmap = {b['id']: b for b in velocity}, {b['id']: b for b in final}
        problem, solved, applications = diagnostics['normalProblem'], diagnostics['normalResult'], diagnostics['applications']
        B.require(solved['ok'] is True and solved['status'] == 'SOLVED_NORMAL_ONLY' and type(solved['stats']) is dict, 'honest original normal solver result')
        B.require([b['id'] for b in problem['bodies']] == ids and len(problem['points']) == len(solved['normalImpulsesNs']) == len(applications), 'point/normal result populations')
        tensors, physical_inertia = {}, {}
        for i, bid in enumerate(ids):
            body = problem['bodies'][i]
            B.require(B.vector(body['positionM']) == B.vector(by_id[bid]['positionM']) and B.vector(body['velocityMps']) == B.vector(by_id[bid]['velocityMps']) and B.vector(body['angularVelocityRadps']) == B.vector(by_id[bid]['angularVelocityRadps']), 'normal actual body operands')
            tensors[bid] = [B.vector(row) for row in body['inverseInertiaWorld']]
            if bid in moving:
                # Exact physical tensor from normalized actual quaternion: scalar isotropic I3.
                for r in range(3):
                    for c in range(3):
                        gate('actualWorldInverseInertia', tensors[bid][r][c]-(3 if r == c else 0))
                physical_inertia[bid] = inverse3(tensors[bid])
        forces = {bid: [Fraction(0)]*3 for bid in moving}
        torques = {bid: [Fraction(0)]*3 for bid in moving}
        j_forces = {bid: [Fraction(0)]*3 for bid in moving}
        j_torques = {bid: [Fraction(0)]*3 for bid in moving}
        pair_impulses, point_ids, pair_totals = {}, set(), {}
        for i, (point, application) in enumerate(zip(problem['points'], applications)):
            a, b, normal, position = point['aId'], point['bId'], fvec(point['normalAtoB']), fvec(point['pointM'])
            B.require(a in by_id and b in by_id and a != b and application['id'] == point['id'] and point['id'] not in point_ids, 'actual unique point links')
            point_ids.add(point['id'])
            lam = B.q(solved['normalImpulsesNs'][i])
            B.require(B.q(application['normalImpulseNs']) == lam and application['aIndex'] == ids.index(a) and application['bIndex'] == ids.index(b), 'actual point lambda/index links')
            B.require(fvec(application['pointM']) == position and fvec(application['normalAtoB']) == normal, 'actual application point/normal')
            if lam < 0:
                fail('strictNonnegativePointImpulse', pointId=point['id'])
            key = a+'\0'+b
            B.require(application['pairKey'] == key, 'actual pair key')
            pair_impulses[key] = pair_impulses.get(key, Fraction(0))+lam
            recorded = application['contribution']['applications']
            B.require(type(recorded) is list and len(recorded) == 1, 'one per-point application contribution')
            impulse_b = [x*float(lam) for x in normal]
            relative = []
            for bid, sign, side in [(a, -1, recorded[0]['onA']), (b, 1, recorded[0]['onB'])]:
                owner = bid
                arm_float = fsub(position, fvec(by_id[bid]['positionM']))
                expected_impulse = [sign*x for x in impulse_b]
                torque_float = [sign*x for x in fcross(arm_float, impulse_b)]
                for key_name, expected in [('comM', fvec(by_id[bid]['positionM'])), ('armM', arm_float), ('linearImpulseNs', expected_impulse), ('armTorqueNms', torque_float)]:
                    B.require(b''.join(B.word(x) for x in side[key_name]) == b''.join(B.word(x) for x in expected), 'actual recorded operand words: '+key_name)
                totals = pair_totals.setdefault(key, {}).setdefault(bid, {'linear': [Fraction(0)]*3, 'worldAngular': [Fraction(0)]*3})
                totals['linear'] = B.add(totals['linear'], B.vector(side['linearImpulseNs']))
                totals['worldAngular'] = B.add(totals['worldAngular'], B.add(
                    B.cross(B.vector(side['comM']), B.vector(side['linearImpulseNs'])), B.vector(side['armTorqueNms'])))
                if bid in moving:
                    forces[bid] = B.add(forces[bid], B.vector(side['linearImpulseNs']))
                    torques[bid] = B.add(torques[bid], B.vector(side['armTorqueNms']))
                    j_forces[bid] = B.add(j_forces[bid], B.scale([B.q(x) for x in normal], sign*lam))
                    j_torques[bid] = B.add(j_torques[bid], B.scale([B.q(x) for x in fcross(arm_float, normal)], sign*lam))
                vp = B.add(B.vector(vmap[bid]['velocityMps']), B.cross(B.vector(vmap[bid]['angularVelocityRadps']), [B.q(x) for x in arm_float]))
                relative.append(vp)
            speed = B.dot(B.sub(relative[1], relative[0]), [B.q(x) for x in normal])
            gate('fullPointNormalPrimalMps', max(Fraction(0), -speed))
            gate('fullPointNormalComplementarityJ', lam*speed)
        B.require(len(result['pairContributions']) == len(pair_totals), 'all actual pair contributions retained')
        B.require(set(total['aId']+'\0'+total['bId'] for total in result['pairContributions']) == set(pair_totals),
                  'unique complete actual pair contribution identities')
        for total in result['pairContributions']:
            key = total['aId']+'\0'+total['bId']
            B.require(key in pair_totals, 'actual completed pair identity')
            for bid, side_name in [(total['aId'], 'onA'), (total['bId'], 'onB')]:
                for value in B.sub(B.vector(total[side_name]['linearImpulseNs']), pair_totals[key][bid]['linear']):
                    gate('completedPairLinearImpulseNs', value)
                for value in B.sub(B.vector(total[side_name]['angularImpulseAboutWorldOriginNms']), pair_totals[key][bid]['worldAngular']):
                    gate('completedPairWorldAngularImpulseNms', value)
        for bid in moving:
            owner = bid
            dv = B.sub(B.vector(vmap[bid]['velocityMps']), B.vector(by_id[bid]['velocityMps']))
            dw = B.sub(B.vector(vmap[bid]['angularVelocityRadps']), B.vector(by_id[bid]['angularVelocityRadps']))
            for value in B.sub(B.scale(dv, Fraction(2)), forces[bid]):
                gate('actualPointLinearMomentumNs', value)
            for value in B.sub(mv(physical_inertia[bid], dw), torques[bid]):
                gate('actualPointAngularMomentumNms', value)
            for value in B.sub(B.scale(dv, Fraction(2)), j_forces[bid]):
                gate('fullJLinearStationarityNs', value)
            for value in B.sub(mv(physical_inertia[bid], dw), j_torques[bid]):
                gate('fullJAngularStationarityNms', value)
            for value in B.vector(vmap[bid]['angularVelocityRadps']):
                gate('omegaRadps', value)
            B.require(B.vector(final[ids.index(bid)]['velocityMps']) == B.vector(vmap[bid]['velocityMps']) and B.vector(final[ids.index(bid)]['angularVelocityRadps']) == B.vector(vmap[bid]['angularVelocityRadps']), 'position phase does not replace velocities')
        owner = None
        rows, masses = [[Fraction(1), Fraction(0)], [Fraction(-1), Fraction(1)]], [Fraction(2), Fraction(2)]
        floor_top = B.q(by_id[floor]['positionM'][1])+B.q(by_id[floor]['shape']['halfExtentsM'][1])
        bounds = [floor_top+Fraction(1, 2), Fraction(1)]
        vf, pf = [B.q(by_id[bid]['velocityMps'][1]) for bid in moving], [B.q(by_id[bid]['positionM'][1]) for bid in moving]
        pt, pl, pc = B.project_two(pf, rows, bounds, masses)
        active = [i for i in range(2) if B.dot(rows[i], pt) == bounds[i]]
        vt, vl, vc = B.project_two(vf, [rows[i] for i in active], [Fraction(0)]*len(active), masses)
        for k, bid in enumerate(moving):
            owner = bid
            gate('globalClosedVelocityMps', B.q(vmap[bid]['velocityMps'][1])-vt[k])
            gate('globalClosedPositionM', B.q(fmap[bid]['positionM'][1])-pt[k])
            for axis in [0, 2]:
                gate('globalLateralPositionM', B.q(fmap[bid]['positionM'][axis])-B.q(by_id[bid]['positionM'][axis]))
                gate('globalLateralVelocityMps', B.q(fmap[bid]['velocityMps'][axis]))
        owner = None
        actual_ke = sum((B.dot(B.vector(vmap[bid]['velocityMps']), B.vector(vmap[bid]['velocityMps']))+
                         B.dot(B.vector(vmap[bid]['angularVelocityRadps']), B.vector(vmap[bid]['angularVelocityRadps']))/6 for bid in moving), Fraction(0))
        gate('globalProjectionEnergyJ', actual_ke-B.dot(vt, vt))
        attempt, stats = diagnostics['positionAttempt'], diagnostics['positionStats']
        B.require(len(attempt['problem']['rows']) == 3 and len(attempt['rowSources']) == 3 and stats['tests'] == stats['rows'] == stats['postPairTests'] == 3 and stats['solverCalls'] == stats['workingApplicationCount'] == 1, 'one complete all-three-pair position phase')
        B.require(attempt['result']['status'] == 'SOLVED' and attempt['result']['ok'] is True, 'original position solve status')
        B.require(all(body_words(a) == body_words(b) for a, b in zip(attempt['preBodies'], velocity)) and all(body_words(a) == body_words(b) for a, b in zip(attempt['hypotheticalBodies'], final)), 'actual position phase frame links')
        allowed = {frozenset([floor, lower]): (floor, lower), frozenset([lower, upper]): (lower, upper)}
        seen = set()
        for c in result['contacts']:
            a, b = c['aId'], c['bId']
            pair = allowed.get(frozenset([a, b]))
            if pair is None or frozenset([a, b]) in seen:
                fail('unexpectedOrDuplicatePostContact')
                continue
            seen.add(frozenset([a, b]))
            expected_sum = 0.0
            for application in applications:
                if application['pairKey'] == a+'\0'+b:
                    expected_sum += B.number(application['normalImpulseNs'])
            B.require(B.word(c['impulseNs']) == B.word(expected_sum), 'retained-order pair impulse summary words')
            for value in B.vector(c['tangentImpulseNs']):
                gate('tangentImpulseNs', value, B.TANGENT_GATE)
            for bid, side in [(pair[0], 1), (pair[1], -1)]:
                owner = bid
                view = {'positionM': fmap[bid]['positionM'], 'orientationXYZW': fmap[bid]['orientation']}
                local = B.local_point(view, B.vector(c['pointM']))
                half = B.vector(fmap[bid]['shape']['halfExtentsM'])
                gate('postRepresentativeFaceM', local[1]-side*half[1], B.GEOMETRY_GATE)
                for axis in range(3):
                    gate('postRepresentativeBoundsM', max(Fraction(0), abs(local[axis])-half[axis]), B.GEOMETRY_GATE)
        for edge in allowed:
            if sum((value for key, value in pair_impulses.items() if frozenset(key.split('\0')) == edge), Fraction(0)) > 0 and edge not in seen:
                fail('missingAppliedPostWitness')
        if body_words(fmap[floor]) != body_words(by_id[floor]):
            fail('prescribedStaticCandidateChanged')
        certificate.update({'actualNormalPoints': len(problem['points']), 'actualApplications': len(applications),
                            'actualPositionRows': 3, 'closedActiveVelocityRows': active,
                            'referenceVelocityTargetY': [B.ratio(x) for x in vt],
                            'referencePositionTargetY': [B.ratio(x) for x in pt],
                            'referenceGlobalKineticLossJ': B.reported(B.dot(vf, vf)-B.dot(vt, vt)),
                            'referencePositionObjectiveKgM2': B.reported(pc)})
        return B.result(not violations, violations, {key: B.reported(value) for key, value in maxima.items()}, certificate)
    except (B.Invalid, KeyError, TypeError, ValueError, IndexError, OverflowError, ZeroDivisionError) as error:
        return B.result(False, [{'input': str(error)[:512]}], {key: B.reported(value) for key, value in maxima.items()}, certificate, True)


def main():
    line = sys.stdin.buffer.readline(B.LINE_BYTES+1)
    try:
        B.require(line and len(line) <= B.LINE_BYTES and line.endswith(b'\n') and sys.stdin.buffer.read(1) == b'', 'one complete2MiB phase line+EOF')
        envelope = json.loads(line, object_pairs_hook=B.reject_duplicates, parse_constant=lambda _: (_ for _ in ()).throw(B.Invalid('JSON nonfinite')))
        B.require(type(envelope) is dict and set(envelope) == {'format', 'data', 'numericWordsF64leHex'} and envelope['format'] == 'frictionless-island-phase-v1', 'phase envelope')
        reply = verify(B.restore_words(envelope['data'], envelope['numericWordsF64leHex']))
    except (B.Invalid, KeyError, TypeError, ValueError, OverflowError, RecursionError) as error:
        reply = B.result(False, [{'input': str(error)[:512]}], execution_failure=True)
    encoded = json.dumps(reply, allow_nan=False, separators=(',', ':'))+'\n'
    B.require(len(encoded.encode()) <= 65536, 'bounded phase reply')
    sys.stdout.write(encoded)


if __name__ == '__main__':
    main()
