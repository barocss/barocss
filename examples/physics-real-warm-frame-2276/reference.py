#!/usr/bin/env python3
"""Independent frozen input generation only. No engine/candidate imports or calls."""
from fractions import Fraction as F
from hashlib import sha256
from itertools import product
from pathlib import Path
import json
import math
import re
import struct
import sys

HOME = Path(__file__).resolve().parent
ROOT = HOME.parent.parent
LIMIT_BITS = 16384
LIMIT_BYTES = 1048576
GATE = F(1, 10**12)
EXPECTED = {
    'examples/physics-contact-wrench-producer-2276/evidence/build-01/source.mjs':
        'b873bef27d0676183c0dcfcab5d89920c52b63fad325bfe186e1a0cde8620380',
    'examples/physics-contact-wrench-producer-2276/evidence/build-01/result.json':
        'be31ab687cfd8e9de7417da041622a7ee6245abaa96442cdcbdac7a9a4d9c132',
    'examples/physics-contact-wrench-producer-2276/evidence/producer-01/summary.json':
        '30cad391ef29c31fb100cfb951b0d70de73105c13879b0b32e3f46e80c7b4c12',
}


def require(value, message):
    if not value:
        raise ValueError(message)


def exact(value):
    return F.from_float(value) if isinstance(value, float) else F(value)


def rat(value):
    value = F(value)
    require(max(value.numerator.bit_length(), value.denominator.bit_length()) <= LIMIT_BITS,
            'EXACT_INTEGER_BUDGET')
    return {'n': str(value.numerator), 'd': str(value.denominator)}


def rv(values):
    return [rat(v) for v in values]


def dot(a, b):
    return sum((x*y for x, y in zip(a, b)), F(0))


def add(a, b):
    return [x+y for x, y in zip(a, b)]


def sub(a, b):
    return [x-y for x, y in zip(a, b)]


def scale(a, s):
    return [x*s for x in a]


def cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def hamilton(a, b):
    av, bv = a[:3], b[:3]
    return add(add(scale(bv, a[3]), scale(av, b[3])), cross(av, bv)) + [a[3]*b[3]-dot(av, bv)]


def axes(q):
    norm2 = dot(q, q)
    require(norm2 > 0, 'ZERO_QUATERNION')
    conjugate = [-q[0], -q[1], -q[2], q[3]]
    result = []
    for k in range(3):
        v = [F(int(i == k)) for i in range(3)] + [F(0)]
        result.append(scale(hamilton(hamilton(q, v), conjugate)[:3], 1/norm2))
    for i in range(3):
        for j in range(3):
            require(dot(result[i], result[j]) == int(i == j), 'HAMILTON_ORTHONORMALITY')
    return result


def corners(center, half, basis):
    rows = []
    for signs in product((-1, 1), repeat=3):
        p = list(center)
        for k in range(3):
            p = add(p, scale(basis[k], signs[k]*half[k]))
        rows.append({'signs': signs, 'point': p})
    return rows


def word(value):
    return struct.pack('>d', value).hex()


def downward_positive(value):
    """Direct rational-to-binary64 boundary conversion, never a geometry search."""
    require(value > 0, 'POSITIVE_HEIGHT_REQUIRED')
    nearest = float(value)
    require(math.isfinite(nearest) and nearest > 0, 'FINITE_HEIGHT_REQUIRED')
    bits = struct.unpack('>Q', struct.pack('>d', nearest))[0]
    lowered = F.from_float(nearest) > value
    rounded = struct.unpack('>d', struct.pack('>Q', bits-int(lowered)))[0]
    above = struct.unpack('>d', struct.pack('>Q', struct.unpack('>Q', struct.pack('>d', rounded))[0]+1))[0]
    require(exact(rounded) <= value < exact(above), 'DIRECTED_ROUNDING_CERTIFICATE')
    return rounded, {'mode': 'toward-negative-infinity-positive-value',
                     'nearestEvenWord': word(nearest), 'selectedWord': word(rounded),
                     'nearestWasAboveExact': lowered, 'errorM': rat(exact(rounded)-value),
                     'successorWord': word(above)}


def encoded(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)+'\n').encode()


def pin(path):
    data = path.read_bytes()
    return {'bytes': len(data), 'sha256': sha256(data).hexdigest()}


def main():
    require(len(sys.argv) == 2 and re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', sys.argv[1]),
            'fresh evidence identifier required')
    out = HOME/'evidence'/sys.argv[1]
    out.parent.mkdir(exist_ok=True)
    out.mkdir()  # Refuse overwrite; preserve every prior result.
    report = {'format': 'physics-real-warm-frame-input-reference', 'version': 1,
              'status': 'INPUT_REFERENCE_NO_GO', 'generatedFiles': {}, 'sourcePins': {},
              'WorldCalls': 0, 'candidateCalls': 0, 'solverCalls': 0,
              'limits': {'exactIntegerBits': LIMIT_BITS, 'outputBytes': LIMIT_BYTES,
                         'floorCorners': 8, 'cubeCorners': 8, 'supportDirections': 15},
              'heightRule': 'correct-downward-rounding-before-first-World',
              'inputDefinition': {'revision': 'real-warm-frame-narrow-ledge-2276',
                                  'idealQuaternionXYZW': ['40/801', '0', '40/801', '799/801'],
                                  'floorHalfExtentsM': [0.2, 0.1, 0.05],
                                  'cubeHalfExtentsM': [0.5, 0.5, 0.5],
                                  'velocityMps': [0.5, 0, 0], 'angularVelocityRadps': [0, 0, 0.01],
                                  'gravityMps2': [0, -9.81, 0], 'fixedStepSeconds': 1/120},
              'admission': {'normalizesQuaternion': True,
                            'authority': 'actual admitted state; no simulated parser or height retuning'}}
    try:
        for name, expected in EXPECTED.items():
            actual = pin(ROOT/name)
            require(actual['sha256'] == expected, 'QUALIFIED_SOURCE_DRIFT: '+name)
            report['sourcePins'][name] = actual
        for name in ('CONTRACT.md', 'reference.py', 'README.md'):
            report['sourcePins'][str((HOME/name).relative_to(ROOT))] = pin(HOME/name)
        q_words = [float(F(40, 801)), 0.0, float(F(40, 801)), float(F(799, 801))]
        q = list(map(exact, q_words))
        basis = axes(q)
        n = basis[1]
        require(n[0] < 0 < n[1] and n[2] > 0, 'EXPECTED_NORMAL_SIGNS')
        floor_center = list(map(exact, [0, -0.1, 0]))
        floor_half = list(map(exact, [0.2, 0.1, 0.05]))
        cube_half = [F(1, 2)]*3
        identity = [[F(int(i == k)) for i in range(3)] for k in range(3)]
        floor = corners(floor_center, floor_half, identity)
        supports = [dot(n, row['point']) for row in floor]
        support = max(supports)
        winners = [i for i, value in enumerate(supports) if value == support]
        require(len(winners) == 1, 'SUPPORT_NOT_UNIQUE')
        winner = floor[winners[0]]
        require(winner['signs'] == (-1, 1, 1), 'UNEXPECTED_SUPPORT_CORNER')
        exact_height = (F(1, 2)+support)/n[1]
        height, rounding = downward_positive(exact_height)
        center = [F(0), exact(height), F(0)]
        gap = dot(n, sub(center, winner['point']))-F(1, 2)
        require(-GATE <= gap <= 0, 'INITIAL_NATIVE_PLANE_GATE')
        require(abs(exact(height)-exact_height) <= GATE, 'HEIGHT_ROUNDING_GATE')
        cube_point = add(winner['point'], scale(n, gap))
        local = [dot(axis, sub(cube_point, center)) for axis in basis]
        require(local[1] == -F(1, 2), 'BOTTOM_FACE_CERTIFICATE')
        require(abs(local[0]) < F(1, 2) and abs(local[2]) < F(1, 2), 'FINITE_FACE_INTERIOR')
        cube = corners(center, cube_half, basis)
        directions = identity+basis+[cross(a, b) for a in identity for b in basis]
        support_rows = []
        for index, direction in enumerate(directions):
            norm2 = dot(direction, direction)
            if norm2 == 0:
                support_rows.append({'axis': index, 'zero': True})
                continue
            if dot(direction, sub(center, floor_center)) < 0:
                direction = scale(direction, -1)
            upper = max(dot(direction, row['point']) for row in floor)
            lower = min(dot(direction, row['point']) for row in cube)
            overlap = upper-lower
            if index == 4:
                require(overlap == -gap, 'SELECTED_SUPPORT_GAP')
            else:
                require(overlap > 0 and overlap*overlap > gap*gap*norm2,
                        'FACE_NOT_STRICT_NATIVE_MINIMUM: '+str(index))
            support_rows.append({'axis': index, 'direction': rv(direction), 'normSquared': rat(norm2),
                                 'floorUpper': rat(upper), 'cubeLower': rat(lower), 'overlap': rat(overlap)})
        ideal_basis = axes([F(40, 801), F(0), F(40, 801), F(799, 801)])
        ideal_n = [F(-63920, 641601), F(635201, 641601), F(63920, 641601)]
        require(ideal_basis[1] == ideal_n, 'IDEAL_NORMAL_CHECK')
        ideal_height = (F(1, 2)+F(1, 5)*abs(ideal_n[0])+F(1, 20)*abs(ideal_n[2]))/ideal_n[1]
        require(ideal_height == F(673561, 1270402), 'IDEAL_HEIGHT_CHECK')
        require(abs(exact_height-ideal_height) <= GATE, 'IDEAL_ACTUAL_WORD_DIFFERENCE')
        velocity = list(map(exact, [0.5, 0, 0]))
        omega = list(map(exact, [0, 0, 0.01]))
        contact_velocity = add(velocity, cross(omega, sub(winner['point'], center)))
        normal_speed = dot(contact_velocity, n)
        tangent = sub(contact_velocity, scale(n, normal_speed))
        normal_rate = cross(omega, n)
        require(normal_speed < 0 and dot(tangent, tangent) > 0 and dot(normal_rate, normal_rate) > 0,
                'INITIAL_KINEMATIC_CANDIDATE')
        material = {'restitution': 0, 'friction': {'static': 1, 'dynamic': 0.7}}
        colliders = []
        for body_id, half in [('a-floor', [0.2, 0.1, 0.05]), ('z-cube', [0.5, 0.5, 0.5])]:
            colliders.append({'id': body_id+'.shape', 'bodyId': body_id,
                              'geometry': {'kind': 'box', 'halfExtentsM': half},
                              'local': {'positionM': [0, 0, 0], 'orientationXYZW': [0, 0, 0, 1]},
                              'material': material, 'sensor': False, 'ccd': False,
                              'filter': {'categoryBits': 1, 'maskBits': 65535}})
        model = {'format': 'barocss-physics-model', 'version': 1,
                 'revision': 'real-warm-frame-narrow-ledge-2276',
                 'frame': {'id': 'world', 'basis': 'right-handed-xyz', 'rotation': 'local-to-world-xyzw'},
                 'units': {'length': 'm', 'mass': 'kg', 'time': 's', 'angle': 'rad'},
                 'gravityMps2': [0, -9.81, 0],
                 'bodies': [{'id': 'a-floor', 'kind': 'static',
                             'initial': {'positionM': [0, -0.1, 0], 'orientationXYZW': [0, 0, 0, 1]}},
                            {'id': 'z-cube', 'kind': 'dynamic', 'massKg': 1,
                             'inertia': {'kind': 'primitive-com', 'about': 'com', 'frame': 'body-local'},
                             'initial': {'positionM': [0, height, 0], 'orientationXYZW': q_words,
                                         'velocityMps': [0.5, 0, 0], 'angularVelocityRadps': [0, 0, 0.01]}}],
                 'colliders': colliders, 'joints': [], 'cloths': [], 'fluids': [], 'sourceBindings': []}
        options = {'profile': 'rigid-persistent-box-v1', 'fixedStepSeconds': 1/120, 'broadPhase': 'direct'}
        report['geometry'] = {'quaternionWords': list(map(word, q_words)), 'quaternionNormSquared': rat(dot(q, q)),
                              'cubeAxes': list(map(rv, basis)), 'normal': rv(n),
                              'floorCorners': [{'signs': row['signs'], 'point': rv(row['point']),
                                                'normalSupport': rat(value)} for row, value in zip(floor, supports)],
                              'uniqueSupportIndex': winners[0], 'exactHeightM': rat(exact_height),
                              'selectedHeightM': height, 'rounding': rounding, 'signedPlaneGapM': rat(gap),
                              'nativeCubeEndpoint': rv(cube_point), 'cubeEndpointLocal': rv(local),
                              'supportIntervals': support_rows, 'idealHeightM': rat(ideal_height),
                              'actualMinusIdealHeightM': rat(exact_height-ideal_height)}
        report['initialKinematics'] = {'contactVelocityMps': rv(contact_velocity),
                                       'normalSpeedMps': rat(normal_speed), 'tangentSpeedSquared': rat(dot(tangent, tangent)),
                                       'normalRateSquared': rat(dot(normal_rate, normal_rate))}
        report['hypothesisOnly'] = {'nativeFeature': 'cube-local-Y face / SAT axis 4',
                                    'pointId': 'FACE:4:0', 'warmCoverage': 'NOT_RUN',
                                    'futureFeatureAndCacheAuthority': 'actual query/cache provenance only'}
        outputs = {'model.json': encoded(model), 'options.json': encoded(options)}
        require(sum(map(len, outputs.values()))+len(encoded(report)) < LIMIT_BYTES, 'REFERENCE_OUTPUT_BUDGET')
        for name, data in outputs.items():
            with (out/name).open('xb') as stream:
                stream.write(data)
            report['generatedFiles'][name] = {'bytes': len(data), 'sha256': sha256(data).hexdigest()}
        report['status'] = 'INPUT_REFERENCE_READY'
    except Exception as error:
        report['failure'] = {'type': type(error).__name__, 'message': str(error)}
    data = encoded(report)
    require(len(data)+sum(v['bytes'] for v in report['generatedFiles'].values()) <= LIMIT_BYTES,
            'FINAL_REFERENCE_OUTPUT_BUDGET')
    with (out/'reference.json').open('xb') as stream:
        stream.write(data)
    print(json.dumps({'status': report['status'], 'out': str(out), 'failure': report.get('failure')}))
    return 0 if report['status'] == 'INPUT_REFERENCE_READY' else 1


if __name__ == '__main__':
    sys.exit(main())
