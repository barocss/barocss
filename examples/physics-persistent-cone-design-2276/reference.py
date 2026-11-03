#!/usr/bin/env python3
"""Draft fixed P03 model reference. Standard-library exact algebra; no engine imports.
Author must not execute this source. Root execution needs a separate frozen handoff.
"""
from fractions import Fraction as F
from decimal import Decimal, localcontext
from itertools import product
from hashlib import sha256
from pathlib import Path
import json
import math
import re
import struct
import sys

HOME = Path(__file__).resolve().parent
BIT_LIMIT = 16384
BYTE_LIMIT = 1048576


def need(value, message):
    if not value:
        raise ValueError(message)


def word(value):
    return struct.pack('>d', value).hex()


def exact(value):
    return F.from_float(value) if isinstance(value, float) else F(value)


def rat(value):
    value = F(value)
    need(max(value.numerator.bit_length(), value.denominator.bit_length()) <= BIT_LIMIT,
         'EXACT_INTEGER_BUDGET')
    return {'n': str(value.numerator), 'd': str(value.denominator)}


def rv(value):
    return [rat(x) for x in value]


def dot(a, b):
    return sum((x*y for x, y in zip(a, b)), F(0))


def add(a, b):
    return [x+y for x, y in zip(a, b)]


def sub(a, b):
    return [x-y for x, y in zip(a, b)]


def scale(a, value):
    return [x*value for x in a]


def cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def multiply(a, b):
    return add(add(scale(b[:3], a[3]), scale(a[:3], b[3])), cross(a[:3], b[:3]))+[a[3]*b[3]-dot(a[:3], b[:3])]


def hamilton_axes(q):
    norm2 = dot(q, q)
    need(norm2 > 0, 'QUATERNION_ZERO')
    conjugate = [-q[0], -q[1], -q[2], q[3]]
    axes = []
    for k in range(3):
        v = [F(int(i == k)) for i in range(3)]+[F(0)]
        axes.append(scale(multiply(multiply(q, v), conjugate)[:3], 1/norm2))
    return axes


def corners(center, half, axes):
    result = []
    for signs in product((-1, 1), repeat=3):
        p = list(center)
        for k in range(3):
            p = add(p, scale(axes[k], signs[k]*half[k]))
        result.append({'signs': signs, 'point': p})
    return result


def solve3(matrix, rhs):
    """Exact elimination on the physical 3x3 map, not a contact solver loop."""
    rows = [list(row)+[value] for row, value in zip(matrix, rhs)]
    for k in range(3):
        pivot = next((j for j in range(k, 3) if rows[j][k] != 0), None)
        need(pivot is not None, 'SINGULAR_PHYSICAL_K')
        rows[k], rows[pivot] = rows[pivot], rows[k]
        factor = rows[k][k]
        rows[k] = [value/factor for value in rows[k]]
        for j in range(3):
            if j != k:
                factor = rows[j][k]
                rows[j] = [x-factor*y for x, y in zip(rows[j], rows[k])]
    return [row[3] for row in rows]


def encoded(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)+'\n').encode()


def model(case_id, position, orientation, velocity):
    material = {'restitution': 0, 'friction': {'static': 1, 'dynamic': 0.7}}
    colliders = []
    for body, half in [('a-floor', [0.25, 0.125, 0.0625]), ('z-cube', [0.5, 0.5, 0.5])]:
        colliders.append({'id': body+'.shape', 'bodyId': body, 'geometry': {'kind': 'box', 'halfExtentsM': half},
                          'local': {'positionM': [0, 0, 0], 'orientationXYZW': [0, 0, 0, 1]},
                          'material': material, 'sensor': False, 'ccd': False,
                          'filter': {'categoryBits': 1, 'maskBits': 65535}})
    return {'format': 'barocss-physics-model', 'version': 1, 'revision': 'persistent-cone-2276-'+case_id,
            'frame': {'id': 'world', 'basis': 'right-handed-xyz', 'rotation': 'local-to-world-xyzw'},
            'units': {'length': 'm', 'mass': 'kg', 'time': 's', 'angle': 'rad'}, 'gravityMps2': [0, 0, 0],
            'bodies': [{'id': 'a-floor', 'kind': 'static', 'initial': {'positionM': [0, -0.125, 0], 'orientationXYZW': [0, 0, 0, 1]}},
                       {'id': 'z-cube', 'kind': 'dynamic', 'massKg': 1,
                        'inertia': {'kind': 'primitive-com', 'about': 'com', 'frame': 'body-local'},
                        'initial': {'positionM': position, 'orientationXYZW': orientation,
                                    'velocityMps': velocity, 'angularVelocityRadps': [0, 0, 0]}}],
            'colliders': colliders, 'joints': [], 'cloths': [], 'fluids': [], 'sourceBindings': []}


def main():
    need(len(sys.argv) == 2 and re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', sys.argv[1]), 'fresh output ID required')
    out = HOME/'evidence'/sys.argv[1]
    out.parent.mkdir(exist_ok=True)
    out.mkdir()
    report = {'format': 'physics-persistent-cone-input-reference', 'version': 1,
              'status': 'INPUT_REFERENCE_NO_GO', 'WorldCalls': 0, 'candidateCalls': 0,
              'engineSolverCalls': 0, 'exactLinearSolves': 0, 'generatedFiles': {}, 'cases': [],
              'prerequisites': 'ROOT_FREEZE_REPLAY_NATIVE_NOT_IMPLIED'}
    pending = {}
    try:
        approximations = []
        for precision in (80, 120):
            with localcontext() as context:
                context.prec = precision
                approximations.append(float(Decimal(1)/Decimal(258).sqrt()))
        need(word(approximations[0]) == word(approximations[1]), 'QUATERNION_80_120_WORD_DISAGREEMENT')
        a = approximations[0]
        qwords = [a, 0.0, a, 16*a]
        q = list(map(exact, qwords))
        need(q[0] == q[2] and q[3] == 16*q[0] and abs(dot(q, q)-1) <= F(1, 10**12), 'QUATERNION_RATIO_NORM')
        axes = hamilton_axes(q)
        t, n, s = [[F(x, 129) for x in values] for values in ([128, 16, 1], [-16, 127, 16], [1, -16, 128])]
        need(axes == [t, n, s], 'NATIVE_HAMILTON_AXES')
        for i in range(3):
            for j in range(3):
                need(dot(axes[i], axes[j]) == int(i == j), 'ORTHONORMAL_NATIVE_AXES')
        center = [F(0), F(1, 2), F(3, 8)]
        point = [F(-1, 4), F(0), F(1, 16)]
        arm = sub(center, point)
        need([dot(axis, arm) for axis in axes] == [F(5, 16), F(1, 2), F(1, 4)], 'FINITE_FACE_WITNESS')
        identity = [[F(int(i == k)) for i in range(3)] for k in range(3)]
        floor = corners([F(0), F(-1, 8), F(0)], [F(1, 4), F(1, 8), F(1, 16)], identity)
        cube = corners(center, [F(1, 2)]*3, axes)
        supports = [dot(n, row['point']) for row in floor]
        winners = [i for i, value in enumerate(supports) if value == max(supports)]
        need(len(winners) == 1 and floor[winners[0]]['point'] == point, 'UNIQUE_FLOOR_CORNER')
        geometry = []
        for index, direction in enumerate(identity+axes+[cross(x, y) for x in identity for y in axes]):
            norm2 = dot(direction, direction)
            if norm2 == 0:
                geometry.append({'axis': index, 'zero': True})
                continue
            if dot(direction, sub(center, [F(0), F(-1, 8), F(0)])) < 0:
                direction = scale(direction, -1)
            overlap = max(dot(direction, row['point']) for row in floor)-min(dot(direction, row['point']) for row in cube)
            need(overlap == 0 if index == 4 else overlap > 0, 'EXACT_FACE_SUPPORT_AXIS_'+str(index))
            geometry.append({'axis': index, 'direction': rv(direction), 'normSquared': rat(norm2), 'overlap': rat(overlap)})
        r2 = dot(arm, arm)
        k = [[F(int(i == j))+6*(r2*int(i == j)-arm[i]*arm[j]) for j in range(3)] for i in range(3)]
        expected_k = [[F(value, 128) for value in row] for row in ([395, -96, -60], [-96, 251, -120], [-60, -120, 368])]
        need(k == expected_k, 'PHYSICAL_K_SECOND_FORM')
        kn = [dot(row, n) for row in k]
        knn, knt, kns = dot(n, kn), dot(t, kn), dot(s, kn)
        normal_denominator_margin = knn*knn-exact(0.7)**2*(knt*knt+kns*kns)
        need((knn, knt, kns) == (F(251, 128), F(-15, 16), F(-3, 4)) and normal_denominator_margin > 0,
             'DYNAMIC_ACTIVE_NORMAL_DENOMINATOR')
        dt = 1/120
        target_words = list(map(word, map(float, center)))
        options = {'profile': 'rigid-persistent-box-v1', 'fixedStepSeconds': dt, 'broadPhase': 'direct'}
        for case_id, factor, expected_sign, expected_mod in [('before', 1-F(1, 2**20), -1, 34), ('at', F(1), 0, 68), ('after', 1+F(1, 2**20), 1, 102)]:
            normal_load = F(129, 1024)
            desired = add(scale(n, normal_load), scale(t, normal_load*factor))
            velocity = [-dot(row, desired) for row in k]
            stored_v = list(map(float, velocity))
            need(list(map(exact, stored_v)) == velocity, 'VELOCITY_MUST_BE_EXACT_DYADIC_'+case_id)
            need(all(math.isfinite(x) for x in stored_v), 'FINITE_VELOCITY')
            drift = [float(exact(v)*exact(dt)) for v in stored_v]
            c0 = [float(c-exact(d)) for c, d in zip(center, drift)]
            reconstructed = [float(exact(c)+exact(d)) for c, d in zip(c0, drift)]
            need(list(map(word, reconstructed)) == target_words, 'NO_REPAIR_DRIFT_TARGET_'+case_id)
            y_units = exact(abs(drift[1]))*2**62
            need(y_units.denominator == 1 and y_units.numerator % 512 == expected_mod, 'Y_DRIFT_MODULAR_CERTIFICATE_'+case_id)
            stick = solve3(k, scale(list(map(exact, stored_v)), -1))
            report['exactLinearSolves'] += 1
            need(stick == desired, 'INDEPENDENT_STICK_SOLUTION_'+case_id)
            load = dot(stick, n)
            tangent = sub(stick, scale(n, load))
            margin = dot(tangent, tangent)-load*load
            sign = (margin > 0)-(margin < 0)
            need(load > 0 and sign == expected_sign, 'ACTUAL_WORD_STATIC_CONE_CLASS_'+case_id)
            initial_native_gap = dot(n, sub(list(map(exact, c0)), point))-F(1, 2)
            need(initial_native_gap > 0, 'INITIAL_CONSTRUCTOR_MUST_BE_SEPARATED_'+case_id)
            need(dot(list(map(exact, stored_v)), n) < 0, 'INITIAL_CONTACT_MUST_BE_CLOSING_'+case_id)
            pending[case_id+'-model.json'] = encoded(model(case_id, c0, qwords, stored_v))
            report['cases'].append({'id': case_id, 'factor': rat(factor), 'desiredImpulseExactNs': rv(desired),
                                    'storedVelocityMps': stored_v, 'storedVelocityWords': list(map(word, stored_v)),
                                    'driftM': drift, 'driftWords': list(map(word, drift)), 'initialPositionM': c0,
                                    'initialPositionWords': list(map(word, c0)), 'reconstructedContactPositionWords': list(map(word, reconstructed)),
                                    'yDriftSignificandModulo512': expected_mod, 'initialNativeGapM': rat(initial_native_gap),
                                    'initialContactVelocityInNTS': rv([dot(list(map(exact, stored_v)), axis) for axis in (n, t, s)]),
                                    'independentlySolvedStickImpulseNs': rv(stick), 'staticConeSquaredMargin': rat(margin),
                                    'expectedConstitutiveBranch': 'STATIC_STICK' if sign <= 0 else 'DYNAMIC_SLIP',
                                    'dynamicExpectedImpulse': 'NOT_SUPPLIED_PHYSICAL_RESIDUALS_REQUIRED' if sign > 0 else None})
        pending['options.json'] = encoded(options)
        report['nativeGeometry'] = {'quaternionWords': list(map(word, qwords)), 'quaternionNormSquared': rat(dot(q, q)),
                                    'axes': list(map(rv, axes)), 'contactCenterM': rv(center), 'nativePointM': rv(point),
                                    'rM': rv(arm), 'supportIntervals': geometry, 'uniqueFloorCornerIndex': winners[0],
                                    'floorCornerSupports': [rat(value) for value in supports], 'physicalK': list(map(rv, k)),
                                    'activeNormalDenominatorSquaredMargin': rat(normal_denominator_margin)}
        report['actualAdmissionRequired'] = {'quaternionRatios': 'qx=qz; qw=16*qx; qy=0',
                                             'firstQueryCenter': target_words, 'nativePoint': list(map(word, map(float, point))),
                                             'noInputRetuning': True}
        need(sum(map(len, pending.values()))+len(encoded(report)) < BYTE_LIMIT, 'REFERENCE_OUTPUT_BUDGET')
        for name, data in pending.items():
            with (out/name).open('xb') as stream:
                stream.write(data)
            report['generatedFiles'][name] = {'bytes': len(data), 'sha256': sha256(data).hexdigest()}
        report['status'] = 'INPUT_REFERENCE_READY'
    except Exception as error:
        report['failure'] = {'type': type(error).__name__, 'message': str(error)}
    data = encoded(report)
    need(len(data)+sum(v['bytes'] for v in report['generatedFiles'].values()) <= BYTE_LIMIT, 'FINAL_OUTPUT_BUDGET')
    with (out/'reference.json').open('xb') as stream:
        stream.write(data)
    print(json.dumps({'status': report['status'], 'out': str(out), 'failure': report.get('failure')}))
    return 0 if report['status'] == 'INPUT_REFERENCE_READY' else 1


if __name__ == '__main__':
    sys.exit(main())
