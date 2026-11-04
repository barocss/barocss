#!/usr/bin/env python3
"""Root-run independent packet audit. AUTHOR MUST NOT EXECUTE numerical paths."""
from fractions import Fraction as F
from decimal import Decimal
from hashlib import sha256
from itertools import permutations
from pathlib import Path
import json
import math
import re
import struct
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
GOLD_HASH = '0f710491f0063fd0b0e988ea915cd6342c5e013e695057d503a27a7d7ba7c943'
TRACE_HASHES = {
    'before': '6b2cd4977130f1241357f29f7adbd3b94a698f61241d17da8ef1ca63eb71dd93',
    'at': 'a7b93bf753f0992cadc229ed634622b23d9e444246fb62cf8bc9ee46b1652910',
    'after': 'b7f283db58d1b4d9c272d36a6cd373cdf83851d8963d851112690597487233b8'}
MODEL_HASHES = {
    'before': '8f9c34238b98216656789f1d49a4c88779d55c1af1927d1b51b5f87464edb132',
    'at': 'de76b4d60f43c50be503558c10cc8b2f2d20ae4846b942473c2bf25f3f533c36',
    'after': '17d1c9e777c73221d1cfe2b39b605ac2e8077a72dab07d439ee16af93ddda620'}
CAPS = {'seconds': 180, 'bytes': 16 * 1024 * 1024, 'bits': 16384,
        'rationalOps': 262144, 'dagNodes': 8192, 'depth': 64, 'fragments': 1000000}
START = None
OPS = 0
PEAK = 0
READ_BYTES = 0
IMPULSE = F(1, 10**12)
SPEED = F(1, 10**10)


class AuditFailure(Exception):
    pass


def need(ok, reason):
    if not ok:
        raise AuditFailure(reason)


def tick():
    global OPS
    OPS += 1
    need(OPS <= CAPS['rationalOps'], 'AUDIT_RATIONAL_WORK_CAP')
    need(START is None or time.monotonic() - START < CAPS['seconds'], 'AUDIT_TIME_CAP')


def integer(value):
    global PEAK
    if isinstance(value, str):
        need(len(value) <= 4096 and re.fullmatch(r'-?\d+', value), 'AUDIT_INTEGER_ENCODING')
        value = int(value)
    need(isinstance(value, int) and not isinstance(value, bool), 'AUDIT_INTEGER_TYPE')
    bits = abs(value).bit_length()
    need(bits <= CAPS['bits'], 'AUDIT_INTEGER_BITS')
    PEAK = max(PEAK, bits)
    return value


def iprod(a, b):
    a, b = integer(a), integer(b)
    need(not a or not b or abs(a).bit_length() + abs(b).bit_length() <= CAPS['bits'],
         'AUDIT_PROPOSED_PRODUCT_BITS')
    return integer(a * b)


def shift(a, count):
    a = integer(a)
    need(isinstance(count, int) and 0 <= count <= CAPS['bits'] and
         abs(a).bit_length() + count <= CAPS['bits'], 'AUDIT_PROPOSED_SHIFT_BITS')
    return integer(a << count)


def Q(value):
    tick()
    if isinstance(value, F):
        result = value
    elif isinstance(value, float):
        need(math.isfinite(value), 'AUDIT_NONFINITE_WORD')
        result = F.from_float(value)
    elif isinstance(value, dict):
        need(set(value) == {'n', 'd'}, 'AUDIT_RATIONAL_OBJECT')
        numerator, denominator = integer(value['n']), integer(value['d'])
        need(denominator > 0, 'AUDIT_RATIONAL_DENOMINATOR')
        result = F(numerator, denominator)
    elif isinstance(value, str):
        need(len(value) <= 4096, 'AUDIT_RATIONAL_TEXT_LENGTH')
        if '/' in value:
            need(re.fullmatch(r'-?\d+/\d+', value), 'AUDIT_RATIONAL_TEXT')
            numerator, denominator = map(integer, value.split('/'))
            need(denominator > 0, 'AUDIT_RATIONAL_DENOMINATOR')
            result = F(numerator, denominator)
            need(str(result.numerator) + '/' + str(result.denominator) == value,
                 'AUDIT_RATIONAL_NOT_REDUCED')
        else:
            need(len(value) <= 512, 'AUDIT_DECIMAL_LENGTH')
            dec = Decimal(value)
            need(dec.is_finite() and abs(dec.as_tuple().exponent) <= 1024, 'AUDIT_DECIMAL_EXPONENT')
            result = F(dec)
    else:
        result = F(integer(value))
    integer(result.numerator)
    integer(result.denominator)
    return result


def add(a, b):
    a, b = Q(a), Q(b)
    numerator = integer(iprod(a.numerator, b.denominator) + iprod(b.numerator, a.denominator))
    return Q(F(numerator, iprod(a.denominator, b.denominator)))


def mul(a, b):
    a, b = Q(a), Q(b)
    return Q(F(iprod(a.numerator, b.numerator), iprod(a.denominator, b.denominator)))


def neg(a):
    a = Q(a)
    return Q(F(-a.numerator, a.denominator))


def sub(a, b):
    return add(a, neg(b))


def div(a, b):
    b = Q(b)
    need(b != 0, 'AUDIT_ZERO_DIVISOR')
    return mul(a, F(b.denominator, b.numerator))


def dot(a, b):
    result = Q(0)
    need(len(a) == len(b), 'AUDIT_DOT_SHAPE')
    for x, y in zip(a, b):
        result = add(result, mul(x, y))
    return result


def va(a, b):
    return [add(x, y) for x, y in zip(a, b)]


def vs(a, b):
    return [sub(x, y) for x, y in zip(a, b)]


def vm(a, b):
    return [mul(x, b) for x in a]


def cross(a, b):
    return [sub(mul(a[1], b[2]), mul(a[2], b[1])),
            sub(mul(a[2], b[0]), mul(a[0], b[2])),
            sub(mul(a[0], b[1]), mul(a[1], b[0]))]


def vector(value, size=3):
    need(isinstance(value, list) and len(value) == size, 'AUDIT_VECTOR_SHAPE')
    return [Q(v) for v in value]


def rat(value):
    value = Q(value)
    return {'n': str(value.numerator), 'd': str(value.denominator)}


def rv(value):
    return [rat(x) for x in value]


def hamilton(a, b):
    return va(va(vm(a[:3], b[3]), vm(b[:3], a[3])), cross(a[:3], b[:3])) + [sub(mul(a[3], b[3]), dot(a[:3], b[:3]))]


def native_axes(quaternion):
    norm = dot(quaternion, quaternion)
    need(norm > 0, 'AUDIT_ZERO_QUATERNION')
    conjugate = [neg(v) for v in quaternion[:3]] + [quaternion[3]]
    axes = []
    for j in range(3):
        basis = [Q(int(i == j)) for i in range(3)] + [Q(0)]
        axes.append(vm(hamilton(hamilton(quaternion, basis), conjugate)[:3], div(1, norm)))
    for i in range(3):
        for j in range(3):
            need(dot(axes[i], axes[j]) == int(i == j), 'AUDIT_NATIVE_ORTHONORMALITY')
    return axes


def gaussian(matrix, rhs):
    rows = [list(row) + [v] for row, v in zip(matrix, rhs)]
    for k in range(3):
        pivot = next((i for i in range(k, 3) if rows[i][k]), None)
        need(pivot is not None, 'AUDIT_GAUSSIAN_SINGULAR')
        rows[k], rows[pivot] = rows[pivot], rows[k]
        p = rows[k][k]
        rows[k] = [div(x, p) for x in rows[k]]
        for i in range(3):
            if i != k:
                factor = rows[i][k]
                rows[i] = [sub(x, mul(factor, y)) for x, y in zip(rows[i], rows[k])]
    return [row[3] for row in rows]


def interval(value):
    if isinstance(value, dict):
        need(set(value) == {'lo', 'hi'}, 'AUDIT_INTERVAL_OBJECT')
        result = (Q(value['lo']), Q(value['hi']))
    else:
        need(isinstance(value, (tuple, list)) and len(value) == 2, 'AUDIT_INTERVAL_SHAPE')
        result = (Q(value[0]), Q(value[1]))
    need(result[0] <= result[1], 'AUDIT_INTERVAL_ORDER')
    return result


def singleton(value):
    value = Q(value)
    return (value, value)


def ia(a, b):
    return (add(a[0], b[0]), add(a[1], b[1]))


def ins(a, b):
    return (sub(a[0], b[1]), sub(a[1], b[0]))


def im(a, b):
    values = [mul(x, y) for x in a for y in b]
    return (min(values), max(values))


def idiv(a, b):
    need(not b[0] <= 0 <= b[1], 'AUDIT_INTERVAL_ZERO_DIVISOR')
    return im(a, (div(1, b[1]), div(1, b[0])))


def sqrt_exact(value):
    value = Q(value)
    need(value >= 0, 'AUDIT_NEGATIVE_SQRT')
    scaled = shift(value.numerator, 256)
    root = integer(math.isqrt(scaled // value.denominator))
    den = shift(1, 128)
    lo = Q(F(root, den))
    hi = lo if iprod(iprod(root, root), value.denominator) == scaled else Q(F(integer(root + 1), den))
    need(mul(lo, lo) <= value <= mul(hi, hi), 'AUDIT_SQRT_CERTIFICATE')
    return lo, hi


def intersect(a, b, reason):
    need(max(a[0], b[0]) <= min(a[1], b[1]), reason)


def contains(outer, inner, reason):
    need(outer[0] <= inner[0] and inner[1] <= outer[1], reason)


def gate(value, tolerance, reason):
    need(-tolerance <= value[0] <= value[1] <= tolerance, reason)


def interval_data(value):
    return [rat(value[0]), rat(value[1])]


def read_json(path, expected=None):
    global READ_BYTES
    size = path.stat().st_size
    need(size <= CAPS['bytes'] and READ_BYTES + size <= CAPS['bytes'], 'AUDIT_READ_BYTE_CAP')
    raw = path.read_bytes()
    READ_BYTES += len(raw)
    if expected is not None:
        need(sha256(raw).hexdigest() == expected, 'AUDIT_INPUT_HASH_' + path.name)
    return json.loads(raw), {'bytes': len(raw), 'sha256': sha256(raw).hexdigest()}


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)


def fingerprint(value):
    digest, size, count = sha256(), 0, 0
    encoder = json.JSONEncoder(ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)
    for fragment in encoder.iterencode(value):
        raw = fragment.encode()
        size += len(raw)
        count += 1
        need(size <= CAPS['bytes'] and count <= CAPS['fragments'], 'AUDIT_EXPANDED_CANONICAL_CAP')
        digest.update(raw)
    return digest.hexdigest(), size


def trace_dag(packet):
    need(packet.get('format') == 'physics-lossless-trace-dag-v1', 'AUDIT_TRACE_DAG_FORMAT')
    pool = packet['objects']
    need(isinstance(pool, dict) and len(pool) <= CAPS['dagNodes'], 'AUDIT_TRACE_DAG_NODES')
    cache, active = {}, set()

    def expand(value, depth=0):
        need(depth <= CAPS['depth'], 'AUDIT_TRACE_DAG_DEPTH')
        if isinstance(value, list):
            return [expand(v, depth + 1) for v in value]
        if isinstance(value, dict):
            if set(value) == {'$node'}:
                key = value['$node']
                if key in cache:
                    return cache[key]
                need(key in pool and key not in active, 'AUDIT_TRACE_DAG_REFERENCE')
                active.add(key)
                result = expand(pool[key], depth + 1)
                active.remove(key)
                need(fingerprint(result)[0] == key, 'AUDIT_TRACE_NODE_HASH')
                cache[key] = result
                return result
            return {k: expand(v, depth + 1) for k, v in value.items()}
        return value

    expanded = expand(packet['root'])
    digest, size = fingerprint(expanded)
    need(digest == packet['expandedCanonicalSha256'] and size == packet['expandedCanonicalBytes'] and
         set(cache) == set(pool), 'AUDIT_TRACE_EXPANDED_HASH')
    return expanded


def decode(value):
    if isinstance(value, list):
        return [decode(v) for v in value]
    if isinstance(value, dict):
        if set(value) == {'$f64le'}:
            text = value['$f64le']
            need(isinstance(text, str) and re.fullmatch('[0-9a-f]{16}', text), 'AUDIT_WORD_ENCODING')
            result = struct.unpack('<d', bytes.fromhex(text))[0]
            need(math.isfinite(result), 'AUDIT_NONFINITE_PACKET_WORD')
            return result
        return {k: decode(v) for k, v in value.items()}
    need(not isinstance(value, (int, float)) or isinstance(value, bool), 'AUDIT_UNWRAPPED_PACKET_NUMBER')
    return value


def encoded_number(value):
    return {'$f64le': struct.pack('<d', value).hex()}


def be_word(value):
    return struct.pack('>d', value).hex()


def collect(value, kind):
    result = []
    if isinstance(value, dict):
        if value.get('kind') == kind:
            result.append(value)
        for child in value.values():
            result.extend(collect(child, kind))
    elif isinstance(value, list):
        for child in value:
            result.extend(collect(child, kind))
    return result


def provenance(packet_path, packet, gold_case):
    case_id = packet['id']
    bank, bank_pin = read_json(packet_path.parent / 'bank.json')
    need(bank['status'] == 'READY_ACTUAL_INPUT_WORDS_ONLY' and
         [row['id'] for row in bank['cases']] == ['before', 'at', 'after'], 'AUDIT_ACTUAL_INPUT_BANK')
    row = next(item for item in bank['cases'] if item['id'] == case_id)
    need(canonical(row['input']) == canonical(packet['input']), 'AUDIT_PACKET_BANK_RAW_WORD_BINDING')
    suffix = '-refused-trace.json' if case_id == 'after' else '-step-trace.json'
    relative_trace = 'examples/physics-coupled-contact-2276/evidence/source-01/' + case_id + suffix
    relative_model = 'examples/physics-persistent-cone-design-2276/evidence/model-01/' + case_id + '-model.json'
    need(row['sourcePacket'] == relative_trace and row['sourceModel'] == relative_model,
         'AUDIT_FIXED_PROVENANCE_PATHS')
    dag, trace_pin = read_json(ROOT / relative_trace, TRACE_HASHES[case_id])
    model, model_pin = read_json(ROOT / relative_model, MODEL_HASHES[case_id])
    need(bank['sourcePins'][relative_trace] == trace_pin and bank['sourcePins'][relative_model] == model_pin,
         'AUDIT_BANK_SOURCE_PINS')
    raw_trace = trace_dag(dag)
    plans = collect(raw_trace['trace'], 'coupled-plan')
    queries = [q for q in collect(raw_trace['trace'], 'geometry-query')
               if q.get('owner') == 'step' and q.get('result', {}).get('status') == 'HIT']
    need(len(plans) == 1 and queries, 'AUDIT_ONE_ACTUAL_PREWARM_PLAN')
    plan, query = plans[0], queries[0]
    need(canonical(query['result']['normal']) == canonical(plan['geometry']['normal']),
         'AUDIT_ACTUAL_QUERY_NORMAL_BINDING')
    materials = {c['bodyId']: c['material']['friction']['dynamic'] for c in model['colliders']}
    expected_input = dict(plan['input'], muDynamicA=encoded_number(materials['a-floor']),
                          muDynamicB=encoded_number(materials['z-cube']), reportedNormal=query['result']['normal'])
    need(canonical(expected_input) == canonical(packet['input']), 'AUDIT_ACTUAL_PREWARM_INPUT_WORDS')
    decoded_trace = decode(raw_trace)
    plan, query = decode(plan), decode(query)
    world = next(w for w in decoded_trace['trace']['worlds'] if w['id'] == decoded_trace['worldId'])
    attempt = next(a for a in world['history'] if a['attempt'] == decoded_trace['attemptId'])
    records = attempt['records']
    plan_index = next(i for i, record in enumerate(records) if record['kind'] == 'coupled-plan')
    first_apply = next((i for i, record in enumerate(records) if record['kind'] == 'impulse-application'), len(records))
    need(plan_index < first_apply and plan['hostStep'] == 1, 'AUDIT_PLAN_BEFORE_FIRST_APPLICATION')
    need(decoded_trace['before']['contacts'] == [] and
         decoded_trace['privateBefore']['world']['persistentPoints'] == [] and
         decoded_trace['privateBefore']['accepted']['cacheFrames'] == {}, 'AUDIT_ORIGINAL_COLD_CONTACT')
    feature = query['result']['feature']
    need(feature['kind'] == 'FACE' and feature['owner'] == 'b' and len(query['result']['points']) == 1,
         'AUDIT_SINGLE_NATIVE_DYNAMIC_FACE')
    point, b, a = query['result']['points'][0], query['bodyB'], query['bodyA']
    inp = decode(packet['input'])
    need(a['kind'] == 'static' and b['kind'] == 'dynamic' and b['inverseMass'] == 1 and
         b['shape']['halfExtentsM'] == [.5, .5, .5], 'AUDIT_ACTUAL_QUERY_PROFILE')
    for ikey, source in (('pointM', point['pointM']), ('comM', b['positionM']),
                         ('orientationXYZW', b['orientationXYZW']), ('freeVelocityMps', b['velocityMps']),
                         ('freeAngularVelocityRadps', b['angularVelocityRadps'])):
        need(inp[ikey] == source, 'AUDIT_QUERY_BODY_INPUT_' + ikey)
    need(inp['nativeFaceAxis'] == feature['axis'], 'AUDIT_NATIVE_FACE_AXIS_METADATA')
    for key in ('a', 'b', 'midpoint'):
        need(vector(point['exact'][key]) == vector(inp['pointM']), 'AUDIT_NATIVE_EXACT_ENDPOINT_' + key)
    need(vector(inp['nativePointExact']) == vector(inp['pointM']), 'AUDIT_NATIVE_POINT_PRESENTATION')
    need(vector(inp['comM']) == vector(gold_case['geometry']['contactCOMM']) and
         vector(inp['pointM']) == vector(gold_case['geometry']['nativePointM']), 'AUDIT_GOLD_FIXED_TOUCH_GEOMETRY')
    return inp, model, {'bank': bank_pin, 'trace': trace_pin, 'model': model_pin,
                        'hostStep': 1, 'planRecordIndex': plan_index, 'firstApplicationRecordIndex': first_apply}


def physical_input(inp, model, gold_case):
    need(inp['massKg'] == 1 and inp['halfExtentsM'] == [.5, .5, .5] and
         inp['freeAngularVelocityRadps'] == [0, 0, 0] and inp['muStaticA'] == inp['muStaticB'] == 1,
         'AUDIT_PHYSICAL_INPUT_PROFILE')
    cube = next(b for b in model['bodies'] if b['id'] == 'z-cube')
    shape = next(c for c in model['colliders'] if c['bodyId'] == 'z-cube')
    need(cube['inertia'] == {'about': 'com', 'frame': 'body-local', 'kind': 'primitive-com'} and
         shape['geometry']['kind'] == 'box', 'AUDIT_ACTUAL_INERTIA_PROFILE')
    half = vector(shape['geometry']['halfExtentsM'])
    moments = [div(mul(Q(cube['massKg']), add(mul(half[j], half[j]), mul(half[k], half[k]))), 3)
               for j, k in ((1, 2), (0, 2), (0, 1))]
    need(moments == [F(1, 6)] * 3, 'AUDIT_ACTUAL_UNIT_CUBE_INERTIA')
    inverse_inertia = div(1, moments[0])
    axes = native_axes(vector(inp['orientationXYZW'], 4))
    axis, direction = inp['nativeFaceAxis'], inp['nativeFaceSign']
    need(axis in (0, 1, 2) and direction in (-1, 1), 'AUDIT_NATIVE_FACE_METADATA')
    axis = int(axis)
    n = vm(axes[axis], Q(direction))
    supplied = vector(inp['nativeNormalDirection'])
    need(cross(n, supplied) == [0, 0, 0] and dot(n, supplied) > 0, 'AUDIT_NATIVE_NORMAL_CORRESPONDENCE')
    need(axes == [vector(a) for a in gold_case['geometry']['axes']], 'AUDIT_ACTUAL_HAMILTON_GOLD_AXES')
    frame = [n] + [a for i, a in enumerate(axes) if i != axis]
    point, com = vector(inp['pointM']), vector(inp['comM'])
    arm = vs(point, com)
    need(dot(n, arm) == -F(1, 2) and
         all(abs(dot(a, arm)) < F(1, 2) for i, a in enumerate(axes) if i != axis),
         'AUDIT_NATIVE_FINITE_TOUCH_FACE')
    velocity = va(vector(inp['freeVelocityMps']), cross(vector(inp['freeAngularVelocityRadps']), arm))
    columns = []
    for j in range(3):
        e = [Q(int(i == j)) for i in range(3)]
        omega = vm(cross(arm, e), inverse_inertia)
        response = va(e, cross(omega, arm))
        columns.append(response)
        virtual = gold_case['physical']['virtualColumns'][j]
        need(vector(virtual['impulse']) == e and vector(virtual['COMDeltaVelocity']) == e and
             vector(virtual['COMDeltaSpin']) == omega and vector(virtual['contactDeltaVelocity']) == response,
             'AUDIT_GOLD_VIRTUAL_UNIT_IMPULSE_' + str(j))
    K = [[columns[j][i] for j in range(3)] for i in range(3)]
    nativeK = [[dot(a, [dot(row, b) for row in K]) for b in frame] for a in frame]
    need(K == [vector(row) for row in gold_case['physical']['worldK']] and
         nativeK == [vector(row) for row in gold_case['physical']['nativeK']], 'AUDIT_VIRTUAL_K_GOLD')
    free_native = [dot(a, velocity) for a in frame]
    need(free_native == vector(gold_case['physical']['nativeFreeVelocity']), 'AUDIT_ACTUAL_FREE_VELOCITY_GOLD')
    staticJ = gaussian(K, vm(velocity, -1))
    staticN = dot(n, staticJ)
    staticT = vs(staticJ, vm(n, staticN))
    margin = sub(dot(staticT, staticT), mul(staticN, staticN))
    need(staticN > 0 and staticJ == vector(gold_case['physical']['staticWorldJ']) and
         margin == Q(gold_case['physical']['staticMargin']), 'AUDIT_STATIC_GAUSSIAN_GOLD')
    mu = Q(inp['muDynamicA'])
    need(mu == Q(inp['muDynamicB']) and be_word(inp['muDynamicA']) == '3fe6666666666666',
         'AUDIT_DYNAMIC_MATERIAL_WORD')
    qD = mul(mu, Q(inp['muDynamicB']))
    need(qD == Q(gold_case['physical']['qD']), 'AUDIT_EXACT_DYNAMIC_Q')
    public_normal = vector(inp['reportedNormal'])
    for given, exact in zip(public_normal, n):
        gate(singleton(sub(given, exact)), IMPULSE, 'AUDIT_REPORTED_NATIVE_NORMAL_CORRESPONDENCE')
    need(free_native[0] < 0 and nativeK[0][0] > 0 and
         sub(mul(nativeK[0][0], nativeK[0][0]),
             mul(qD, dot(nativeK[0][1:], nativeK[0][1:]))) > 0,
         'AUDIT_CLOSING_ACTIVE_NORMAL_DENOMINATOR')
    return {'point': point, 'com': com, 'arm': arm, 'axes': axes, 'frame': frame,
            'K': K, 'nativeK': nativeK, 'free': velocity, 'nativeFree': free_native,
            'staticJ': staticJ, 'staticN': staticN, 'staticT': staticT, 'margin': margin,
            'mu': mu, 'qD': qD, 'inverseInertia': inverse_inertia,
            'publicNormal': public_normal}


def meter(counts, dynamic=False):
    required = {'rationalOps': 4096, 'gcdSteps': 262144, 'peakBits': 16384}
    if dynamic:
        required.update(integerOps=262144, subdivisions=256, maxDyadicExponent=128)
    need(isinstance(counts, dict) and set(counts) == set(required), 'AUDIT_METER_FIELDS')
    for key, maximum in required.items():
        value = counts[key]
        need(isinstance(value, float) and value.is_integer() and 0 <= value <= maximum,
             'AUDIT_METER_' + key)


def static_certificate(certificate, p):
    expected_vectors = {'nativePointM': p['point'], 'armM': p['arm'],
                        'freePointVelocityMps': p['free'], 'nativeUnitNormal': p['frame'][0],
                        'exactImpulseNs': p['staticJ'], 'exactTangentNs': p['staticT'],
                        'exactContactResidual': [Q(0)] * 3}
    for key, expected in expected_vectors.items():
        need(vector(certificate[key]) == expected, 'AUDIT_STATIC_CERT_' + key)
    need([vector(row) for row in certificate['physicalK']] == p['K'], 'AUDIT_STATIC_CERT_K')
    need(Q(certificate['exactNormalNs']) == p['staticN'] and
         Q(certificate['exactConeMarginSquared']) == p['margin'], 'AUDIT_STATIC_CERT_N_MARGIN')
    K = p['K']
    minors = [K[0][0], sub(mul(K[0][0], K[1][1]), mul(K[0][1], K[1][0])), determinant(K)]
    need(vector(certificate['principalMinors']) == minors and all(v > 0 for v in minors),
         'AUDIT_STATIC_CERT_SPD_MINORS')
    meter(certificate['counts'])


def gold_proof(gold_case):
    need(gold_case['status'] == 'REFERENCE_READY' and
         [r['precision'] for r in gold_case['reference']] == [80, 120], 'AUDIT_GOLD_PRECISION_PAIR')
    if gold_case['id'] != 'after':
        return
    for proof in gold_case['reference']:
        cursor, roots = Q(0), []
        for cell in proof['coverage']:
            a, b = Q(cell['a']), Q(cell['b'])
            need(a == cursor and a < b, 'AUDIT_GOLD_COVERAGE_PARTITION')
            g = interval(cell['g'])
            derivative = interval(cell['derivative'])
            reason = cell['reason']
            if reason == 'G_EXCLUDES_ZERO':
                need(g[1] < 0 or g[0] > 0, 'AUDIT_GOLD_EXCLUSION')
            else:
                need(derivative[1] < 0 or derivative[0] > 0, 'AUDIT_GOLD_STRICT_DERIVATIVE')
                signs = cell['endpointSigns']
                values = [Q(v) for v in cell['endpointG']]
                need(signs == [(v > 0) - (v < 0) for v in values] and 0 not in signs,
                     'AUDIT_GOLD_ENDPOINT_SIGNS')
                if reason == 'UNIQUE_CROSSING':
                    need(signs[0] != signs[1], 'AUDIT_GOLD_CROSSING')
                    roots.append((a, b))
                else:
                    need(reason == 'STRICT_DERIVATIVE_SAME_ENDPOINT_SIGN' and signs[0] == signs[1],
                         'AUDIT_GOLD_MONOTONE_EXCLUSION')
            cursor = b
        need(cursor == 1 and len(roots) == 1, 'AUDIT_GOLD_COMPLETE_UNIQUE_PHYSICAL_ROOT')
        root = (Q(proof['root']['lo']), Q(proof['root']['hi']))
        contains(roots[0], root, 'AUDIT_GOLD_REFINED_ROOT_BINDING')
        need(0 < root[0] < root[1] < 1 and
             interval(proof['physical']['idealNativeNTS'][0])[0] > 0 and
             interval(proof['physical']['idealSlip'])[0] > SPEED, 'AUDIT_GOLD_PHYSICAL_ADMISSIBILITY')


def rne_membership(value, enclosure):
    lower = math.nextafter(value, -math.inf)
    upper = math.nextafter(value, math.inf)
    need(math.isfinite(lower) and math.isfinite(upper), 'AUDIT_RNE_FINITE_CELL')
    left, right = div(add(Q(lower), Q(value)), 2), div(add(Q(value), Q(upper)), 2)
    even = int(be_word(value), 16) % 2 == 0
    need((enclosure[0] > left or enclosure[0] == left and even) and
         (enclosure[1] < right or enclosure[1] == right and even), 'AUDIT_RNE_CELL_MEMBERSHIP')
    if value == 0 and enclosure != (F(0), F(0)):
        need((be_word(value).startswith('8') and enclosure[1] < 0) or
             (not be_word(value).startswith('8') and enclosure[0] > 0), 'AUDIT_RNE_ZERO_SIGN')


def gold_words(actual, gold_case):
    fields = {'worldImpulseNs': 'worldJ', 'tangentNs': 'worldT', 'normalNs': 'nativeNTS'}
    for proof in gold_case['reference']:
        presentation = proof['physical']['presentation']
        for field, key in fields.items():
            values = [actual[field]] if field == 'normalNs' else actual[field]
            gold = presentation[key][:1] if field == 'normalNs' else presentation[key]
            need(len(values) == len(gold) and
                 [be_word(v) for v in values] == [v['word'] for v in gold], 'AUDIT_GOLD_RNE_WORDS_' + field)
            for value, cell in zip(values, gold):
                enclosure = interval(cell['idealEnclosure'])
                rne_membership(value, enclosure)
                need(Q(cell['midpointLower']) == div(add(Q(math.nextafter(value, -math.inf)), Q(value)), 2) and
                     Q(cell['midpointUpper']) == div(add(Q(value), Q(math.nextafter(value, math.inf))), 2),
                     'AUDIT_GOLD_RNE_MIDPOINTS')


def trim(poly):
    while len(poly) > 1 and poly[-1] == 0:
        poly.pop()
    return poly


def padd(a, b):
    return trim([add(a[i] if i < len(a) else 0, b[i] if i < len(b) else 0)
                 for i in range(max(len(a), len(b)))])


def pneg(a):
    return [neg(v) for v in a]


def psub(a, b):
    return padd(a, pneg(b))


def pmul(a, b):
    need(len(a) + len(b) - 2 <= 6, 'AUDIT_TEMP_POLYNOMIAL_DEGREE')
    result = [Q(0) for _ in range(len(a) + len(b) - 1)]
    for i, x in enumerate(a):
        for j, y in enumerate(b):
            result[i + j] = add(result[i + j], mul(x, y))
    return trim(result)


def pscale(a, value):
    return trim([mul(x, value) for x in a])


def parity(perm):
    return -1 if sum(perm[i] > perm[j] for i in range(3) for j in range(i + 1, 3)) % 2 else 1


def detpoly(matrix):
    result = [Q(0)]
    for perm in permutations(range(3)):
        term = [Q(parity(perm))]
        for i in range(3):
            term = pmul(term, matrix[i][perm[i]])
        result = padd(result, term)
    return trim(result)


def determinant(matrix):
    result = detpoly([[[v] for v in row] for row in matrix])
    need(len(result) == 1, 'AUDIT_SCALAR_DETERMINANT')
    return result[0]


def primitive(poly):
    denominator = 1
    for value in poly:
        denominator = iprod(denominator // math.gcd(denominator, value.denominator), value.denominator)
    values = [iprod(v.numerator, denominator // v.denominator) for v in poly]
    content = 0
    for value in values:
        content = math.gcd(content, value)
    need(content > 0, 'AUDIT_ZERO_PHYSICAL_POLYNOMIAL')
    return trim([Q(F(v // content)) for v in values])


def pvalue(poly, x):
    result = Q(0)
    for value in reversed(poly):
        result = add(mul(result, x), value)
    return result


def pinterval(poly, x):
    result = singleton(poly[-1])
    for value in reversed(poly[:-1]):
        result = ia(im(result, x), singleton(value))
    return result


def derivative(poly):
    return trim([mul(poly[i], i) for i in range(1, len(poly))] or [Q(0)])


def remainder(a, b):
    out = list(a)
    need(b[-1] != 0, 'AUDIT_ZERO_POLYNOMIAL_DIVISOR')
    while len(out) >= len(b) and out != [0]:
        offset, factor = len(out) - len(b), div(out[-1], b[-1])
        for i, coefficient in enumerate(b):
            out[offset + i] = sub(out[offset + i], mul(factor, coefficient))
        trim(out)
    return out


def side_sign(poly, x, side):
    order, current = 0, poly
    while True:
        value = pvalue(current, x)
        if value:
            sign = (value > 0) - (value < 0)
            return -sign if side == -1 and order % 2 else sign
        need(len(current) > 1, 'AUDIT_ZERO_STURM_MEMBER')
        current, order = derivative(current), order + 1


def variation(chain, x, side):
    signs = [side_sign(poly, x, side) for poly in chain]
    return sum(a != b for a, b in zip(signs, signs[1:]))


def open_count(chain, a, b):
    result = variation(chain, a, 1) - variation(chain, b, -1)
    need(0 <= result <= 4, 'AUDIT_STURM_OPEN_COUNT')
    return result


def physical_polynomials(p):
    K, u = p['nativeK'], p['nativeFree']
    matrix, rhs = [], []
    for i in range(3):
        if i == 0:
            matrix.append([[v] for v in K[0]])
            rhs.append([neg(u[0])])
        else:
            matrix.append([[Q(int(i == j)), sub(K[i][j], int(i == j))] for j in range(3)])
            rhs.append([Q(0), neg(u[i])])
    denominator = detpoly(matrix)
    numerators = []
    for j in range(3):
        replaced = [[list(rhs[i]) if column == j else list(matrix[i][column])
                     for column in range(3)] for i in range(3)]
        numerators.append(detpoly(replaced))
    polynomial = psub(padd(pmul(numerators[1], numerators[1]), pmul(numerators[2], numerators[2])),
                      pscale(pmul(numerators[0], numerators[0]), p['qD']))
    result = primitive(polynomial)
    need(2 <= len(result) <= 5, 'AUDIT_PHYSICAL_POLYNOMIAL_DEGREE')
    return result, denominator, numerators


def algebra(certificate, p, gold_case):
    polynomial, denominator, numerators = physical_polynomials(p)
    claimed = [Q(integer(v)) for v in certificate['polynomialAscending']]
    need(claimed == polynomial, 'AUDIT_FULL_PHYSICAL_POLYNOMIAL_IDENTITY')
    chain = [[Q(integer(v)) for v in member] for member in certificate['sturmAscending']]
    need(2 <= len(chain) <= 5 and chain[0] == polynomial and chain[1] == derivative(polynomial),
         'AUDIT_STURM_INITIAL_MEMBERS')
    for i in range(2, len(chain)):
        actual = chain[i]
        negative_remainder = pneg(remainder(chain[i - 2], chain[i - 1]))
        need(actual == primitive(negative_remainder) and len(actual) < len(chain[i - 1]),
             'AUDIT_STURM_POSITIVE_PRIMITIVE_RECURRENCE')
    need(len(chain[-1]) == 1 and chain[-1][0] != 0, 'AUDIT_STURM_SQUARE_FREE_TERMINAL')
    need(pvalue(polynomial, Q(0)) < 0 and pvalue(polynomial, Q(1)) > 0,
         'AUDIT_POLYNOMIAL_ENDPOINT_SIGNS')
    total = open_count(chain, Q(0), Q(1))
    roots = certificate['roots']
    need(1 <= len(roots) <= 4 and len(roots) == total, 'AUDIT_ALL_INTERIOR_ROOT_POPULATION')
    verified, admissible = [], []
    for index, root in enumerate(roots):
        a, b = Q(root['lower']), Q(root['upper'])
        need(0 < a <= b < 1, 'AUDIT_ROOT_INTERIOR_BOUNDS')
        exact = root['exactRationalRoot']
        need(isinstance(exact, bool), 'AUDIT_EXACT_ROOT_FLAG')
        if exact:
            need(a == b and pvalue(polynomial, a) == 0 and root['openRootCount'] == 0,
                 'AUDIT_EXACT_RATIONAL_ROOT')
        else:
            need(a < b and pvalue(polynomial, a) != 0 and pvalue(polynomial, b) != 0 and
                 open_count(chain, a, b) == 1 and root['openRootCount'] == 1,
                 'AUDIT_ROOT_INTERVAL_COUNT')
        h = pinterval(numerators[0], (a, b))
        contains(interval(root['hRange']), h, 'AUDIT_CRAMER_NORMAL_NUMERATOR_ENCLOSURE')
        if root['disposition'] == 'ADMISSIBLE':
            need(h[0] > 0, 'AUDIT_POSITIVE_NORMAL_ROOT')
            admissible.append(index)
        else:
            need(root['disposition'] == 'NEGATIVE_NORMAL' and h[1] < 0, 'AUDIT_NEGATIVE_NORMAL_ROOT')
        verified.append((a, b))
    ordered = sorted(verified)
    need(all(a[1] < b[0] for a, b in zip(ordered, ordered[1:])), 'AUDIT_ROOT_INTERVAL_DISJOINTNESS')
    need(len(admissible) == 1 and certificate['selectedRoot'] == admissible[0], 'AUDIT_UNIQUE_ADMISSIBLE_ROOT')
    selected = admissible[0]
    parameter = interval(certificate['idealParameter'])
    need(parameter == verified[selected], 'AUDIT_SELECTED_ROOT_PARAMETER_BINDING')
    for proof in gold_case['reference']:
        intersect(parameter, (Q(proof['root']['lo']), Q(proof['root']['hi'])),
                  'AUDIT_INDEPENDENT_GAUSSIAN_ROOT_INTERSECTION')
    # Denominator positivity follows independently from positive-definite K and
    # the nonnegative physical tangential penalty. Check its local enclosure too.
    need(pinterval(denominator, parameter)[0] > 0, 'AUDIT_FULL_PHYSICAL_DENOMINATOR_POSITIVE')
    return {'interiorRootCount': total, 'admissibleRootCount': len(admissible),
            'selectedRoot': selected, 'parameter': interval_data(parameter),
            'physicalPolynomialAscending': [str(v.numerator) for v in polynomial],
            'validation': 'FULL_3X3_CRAMER_POLYNOMIAL_AND_CERTIFICATE_RECURRENCE_ONLY'}


def dynamic_certificate(c, p, actual, gold_case):
    static_certificate(c['staticPriority'], p)
    need(p['margin'] > 0 and p['staticN'] > 0, 'AUDIT_EXACT_DYNAMIC_PRIORITY')
    frame, K = p['frame'], p['nativeK']
    need(vector(c['nativeUnitNormal']) == frame[0] and
         [vector(a) for a in c['nativeTangentAxes']] == frame[1:], 'AUDIT_DYNAMIC_NATIVE_FRAME')
    need(Q(c['effectiveDynamicCoefficient']) == p['mu'] and Q(c['dynamicCoefficientSquared']) == p['qD'],
         'AUDIT_DYNAMIC_COEFFICIENT')
    need(Q(c['k']) == K[0][0] and vector(c['c'], 2) == K[0][1:] and
         [vector(row, 2) for row in c['dBlock']] == [row[1:] for row in K[1:]], 'AUDIT_DYNAMIC_BLOCKS')
    A = [[sub(K[i][j], div(mul(K[0][i], K[0][j]), K[0][0])) for j in (1, 2)] for i in (1, 2)]
    b = [sub(p['nativeFree'][i], div(mul(K[0][i], p['nativeFree'][0]), K[0][0])) for i in (1, 2)]
    need([vector(row, 2) for row in c['schurA']] == A and vector(c['schurB'], 2) == b,
         'AUDIT_DECLARED_SCHUR_IDENTITY')
    algebra_report = algebra(c, p, gold_case)
    candidate_intervals = {'idealNormalNs': [interval(c['idealNormalNs'])],
                           'idealWorldImpulseNs': [interval(v) for v in c['idealWorldImpulseNs']],
                           'idealTangentNs': [interval(v) for v in c['idealTangentNs']],
                           'idealSlipMps': [interval(v) for v in c['idealSlipMps']]}
    for proof in gold_case['reference']:
        phys = proof['physical']
        targets = {'idealNormalNs': [phys['idealNativeNTS'][0]],
                   'idealWorldImpulseNs': phys['idealWorldJ'], 'idealTangentNs': phys['idealWorldT'],
                   'idealSlipMps': phys['idealFinalNativeVelocity'][1:]}
        for key, targets_for_key in targets.items():
            need(len(candidate_intervals[key]) == len(targets_for_key), 'AUDIT_IDEAL_INTERVAL_SHAPE_' + key)
            for candidate, target in zip(candidate_intervals[key], targets_for_key):
                intersect(candidate, interval(target), 'AUDIT_IDEAL_GOLD_INTERSECTION_' + key)
    for value, ideal in zip(actual['worldImpulseNs'], candidate_intervals['idealWorldImpulseNs']):
        rne_membership(value, ideal)
    rne_membership(actual['normalNs'], candidate_intervals['idealNormalNs'][0])
    for value, ideal in zip(actual['tangentNs'], candidate_intervals['idealTangentNs']):
        rne_membership(value, ideal)
    error_fields = (('worldPresentationErrorNs', actual['worldImpulseNs'], candidate_intervals['idealWorldImpulseNs']),
                    ('cacheTangentPresentationErrorNs', actual['tangentNs'], candidate_intervals['idealTangentNs']))
    for key, values, ideals in error_fields:
        need([interval(v) for v in c[key]] == [ins(singleton(Q(v)), i) for v, i in zip(values, ideals)],
             'AUDIT_PRESENTATION_ERROR_IDENTITY_' + key)
        for value in c[key]:
            gate(interval(value), IMPULSE, 'AUDIT_PRESENTATION_ERROR_GATE_' + key)
    need(interval(c['cacheNormalPresentationErrorNs']) ==
         ins(singleton(Q(actual['normalNs'])), candidate_intervals['idealNormalNs'][0]),
         'AUDIT_CACHE_NORMAL_ERROR_IDENTITY')
    gate(interval(c['cacheNormalPresentationErrorNs']), IMPULSE, 'AUDIT_CACHE_NORMAL_ERROR_GATE')
    meter(c['staticCounts'])
    meter(c['dynamicCounts'], True)
    need(c['staticCounts'] == c['staticPriority']['counts'] and
         c['cumulativeRationalOps'] == c['staticCounts']['rationalOps'] + c['dynamicCounts']['rationalOps'] and
         c['cumulativeGcdSteps'] == c['staticCounts']['gcdSteps'] + c['dynamicCounts']['gcdSteps'],
         'AUDIT_DYNAMIC_CUMULATIVE_METERS')
    return algebra_report


def represented(actual, p, dynamic, certificate=None):
    J, cacheT, cacheN = vector(actual['worldImpulseNs']), vector(actual['tangentNs']), Q(actual['normalNs'])
    n, K, free = p['frame'][0], p['K'], p['free']
    N = dot(n, J)
    T = vs(J, vm(n, N))
    final = va(free, [dot(row, J) for row in K])
    normal_speed = dot(n, final)
    tangent_speed = vs(final, vm(n, normal_speed))
    need(N > 0 and cacheN > 0, 'AUDIT_REPRESENTED_POSITIVE_NORMAL')
    gate(singleton(normal_speed), SPEED, 'AUDIT_REPRESENTED_ZERO_NORMAL_SPEED')
    gate(singleton(dot(cacheT, n)), IMPULSE, 'AUDIT_NATIVE_CACHE_PLANE')
    gate(singleton(dot(cacheT, p['publicNormal'])), IMPULSE, 'AUDIT_PUBLIC_CACHE_PLANE')
    gate(singleton(sub(cacheN, N)), IMPULSE, 'AUDIT_CACHE_NORMAL_AGREEMENT')
    for x, y in zip(cacheT, T):
        gate(singleton(sub(x, y)), IMPULSE, 'AUDIT_CACHE_TANGENT_AGREEMENT')
    omega = vm(cross(p['arm'], J), p['inverseInertia'])
    direct = va(va(free, J), cross(omega, p['arm']))
    need(direct == final, 'AUDIT_COM_SPIN_CONTACT_VELOCITY')
    delta_p = J  # Actual admitted mass is exactly one.
    angular_delta = vm(omega, div(1, p['inverseInertia']))
    need(delta_p == J and angular_delta == cross(p['arm'], J), 'AUDIT_LINEAR_COM_ANGULAR_MOMENTUM')
    origin_delta = va(cross(p['com'], delta_p), angular_delta)
    need(origin_delta == cross(p['point'], J), 'AUDIT_ORIGIN_ANGULAR_MOMENTUM')
    work = div(dot(J, va(free, final)), 2)
    need(work <= 0, 'AUDIT_MIDPOINT_IMPULSE_WORK_PASSIVITY')
    residuals = {'normalSpeedMps': singleton(normal_speed),
                 'cacheNormalAgreementNs': singleton(sub(cacheN, N)),
                 'cachePublicTangentPlaneNs': singleton(dot(cacheT, p['publicNormal'])),
                 'workJ': singleton(work)}
    if dynamic:
        slip = sqrt_exact(dot(tangent_speed, tangent_speed))
        need(slip[0] > SPEED, 'AUDIT_DYNAMIC_POSITIVE_SLIP')
        cone = ins(sqrt_exact(dot(T, T)), singleton(mul(p['mu'], N)))
        gate(cone, IMPULSE, 'AUDIT_DYNAMIC_CONE_MAGNITUDE')
        residuals['coneMagnitudeNs'] = cone
        for i in range(3):
            opposition = ia(singleton(T[i]), idiv(singleton(mul(mul(p['mu'], N), tangent_speed[i])), slip))
            gate(opposition, IMPULSE, 'AUDIT_DYNAMIC_OPPOSITION_' + str(i))
            residuals['antiparallelNs' + str(i)] = opposition
            residuals['cacheTangentAgreementNs' + str(i)] = singleton(sub(cacheT[i], T[i]))
        need(Q(certificate['representedNormalNs']) == N and
             vector(certificate['representedTangentNs']) == T and
             vector(certificate['representedContactVelocityMps']) == final,
             'AUDIT_DECLARED_REPRESENTED_PHYSICS')
        need(set(certificate['residualBounds']) == set(residuals), 'AUDIT_RESIDUAL_BOUND_FIELDS')
        for key, residual in residuals.items():
            contains(interval(certificate['residualBounds'][key]), residual,
                     'AUDIT_RESIDUAL_BOUND_CONTAINS_INDEPENDENT_' + key)
    else:
        need(J == p['staticJ'] and cacheN == p['staticN'] and cacheT == p['staticT'],
             'AUDIT_STATIC_EXACT_PRESENTATION')
        gate(singleton(dot(tangent_speed, tangent_speed)), mul(SPEED, SPEED), 'AUDIT_STATIC_ZERO_TANGENT_SPEED')
        slip = sqrt_exact(dot(tangent_speed, tangent_speed))
    return {'normalLoad': rat(N), 'worldJ': rv(J), 'worldT': rv(T),
            'finalContactVelocity': rv(final), 'COMSpin': rv(omega),
            'normalSpeed': rat(normal_speed), 'slip': interval_data(slip),
            'midpointWork': rat(work), 'residuals': {k: interval_data(v) for k, v in residuals.items()},
            'momentumAndOriginMoment': 'EXACT_PHYSICAL_IDENTITIES',
            'runtimeApplication': 'NOT_RUN_PURE_TARGET_ONLY'}


def audit(packet_path, reference_path):
    packet, packet_pin = read_json(packet_path)
    need(set(packet) <= {'id', 'input', 'actual', 'staticControl'} and
         {'id', 'input', 'actual'} <= set(packet), 'AUDIT_PACKET_FIELDS')
    case_id = packet['id']
    need(case_id in ('before', 'at', 'after'), 'AUDIT_ORIGINAL_CASE_ID')
    gold, gold_pin = read_json(reference_path, GOLD_HASH)
    need(gold['status'] == 'REFERENCE_READY' and gold['candidateCalls'] == gold['WorldCalls'] == 0,
         'AUDIT_FROZEN_INDEPENDENT_REFERENCE_READY')
    gold_case = next(row for row in gold['cases'] if row['id'] == case_id)
    gold_proof(gold_case)
    inp, model, provenance_report = provenance(packet_path, packet, gold_case)
    actual = decode(packet['actual'])
    expected_status = 'DYNAMIC_TARGET' if case_id == 'after' else 'STATIC_TARGET'
    need(actual.get('status') == expected_status,
         'AUDIT_ORIGINAL_' + case_id + '_REQUIRES_' + expected_status + '_GOT_' +
         str(actual.get('status')) + '_' + str(actual.get('reason', '')))
    physical = physical_input(inp, model, gold_case)
    gold_words(actual, gold_case)
    report = {'id': case_id, 'packetPin': packet_pin, 'goldReferencePin': gold_pin,
              'provenance': provenance_report, 'staticMargin': rat(physical['margin']),
              'independentWorldK': [rv(row) for row in physical['K']],
              'independentNativeFrame': [rv(row) for row in physical['frame']]}
    if case_id != 'after':
        need(physical['margin'] <= 0, 'AUDIT_STATIC_PRIORITY_INCLUDING_EQUALITY')
        if 'staticControl' in packet:
            control = packet['staticControl']
        else:
            saved, control_pin = read_json(packet_path.parent / (case_id + '-static-control.json'))
            need(saved['id'] == case_id and canonical(saved['input']) == canonical(packet['input']),
                 'AUDIT_SAME_INPUT_DIRECT_STATIC_CONTROL')
            control = saved['actual']
            report['staticControlPin'] = control_pin
        for key in ('status', 'worldImpulseNs', 'normalNs', 'tangentNs', 'certificate'):
            need(canonical(packet['actual'][key]) == canonical(control[key]),
                 'AUDIT_UNCHANGED_STATIC_RAW_' + key)
        static_certificate(actual['certificate'], physical)
        meter(actual['dynamicAdmissionCounts'], True)
        sc, dc = actual['certificate']['counts'], actual['dynamicAdmissionCounts']
        need(actual['cumulativeRationalOps'] == sc['rationalOps'] + dc['rationalOps'] and
             actual['cumulativeGcdSteps'] == sc['gcdSteps'] + dc['gcdSteps'], 'AUDIT_STATIC_ADMISSION_METERS_SEPARATE')
        report['staticCertificateRawEquality'] = 'ENTIRE_ORIGINAL_CERTIFICATE_UNCHANGED'
        report['physical'] = represented(actual, physical, False)
    else:
        certificate = actual['certificate']
        report['algebra'] = dynamic_certificate(certificate, physical, actual, gold_case)
        report['physical'] = represented(actual, physical, True, certificate)
    return report


def main():
    global START
    START = time.monotonic()
    need(len(sys.argv) == 4, 'AUDIT_EXPECTS_PACKET_REFERENCE_OUTPUT')
    packet_path, reference_path, output_path = [Path(v).resolve() for v in sys.argv[1:]]
    # Reserve the final path before reading or auditing. Never overwrite evidence.
    with output_path.open('xb') as stream:
        result = {'status': 'NO_GO_PURE_COUPLED_PHYSICAL_INPUT', 'candidateCalls': 0,
                  'WorldCalls': 0, 'referenceGeneratorCalls': 0,
                  'firstFailure': None, 'caps': CAPS,
                  'scope': 'ONE_ORIGINAL_PURE_TARGET_INPUT_ONLY',
                  'runtimeWorldPromotion': 'BLOCKED_UNQUALIFIED_ARITHMETIC_BANKS_AND_RUNTIME',
                  'generalArithmeticControls': 'NOT_RUN'}
        try:
            result['audit'] = audit(packet_path, reference_path)
            result['status'] = 'EXECUTED_PASS_PURE_COUPLED_PHYSICAL_INPUT'
        except Exception as error:
            result['firstFailure'] = {'type': type(error).__name__, 'reason': str(error)}
        result.update(elapsedSeconds=time.monotonic() - START, rationalOps=OPS,
                      peakBits=PEAK, readBytes=READ_BYTES)
        raw = (canonical(result) + '\n').encode()
        if len(raw) > CAPS['bytes']:
            result = {'status': 'NO_GO_PURE_COUPLED_PHYSICAL_INPUT',
                      'firstFailure': result['firstFailure'] or {'type': 'AuditFailure', 'reason': 'AUDIT_OUTPUT_CAP'},
                      'WorldCalls': 0, 'candidateCalls': 0, 'referenceGeneratorCalls': 0}
            raw = (canonical(result) + '\n').encode()
        stream.write(raw)
    print(canonical({'status': result['status'], 'firstFailure': result['firstFailure'],
                     'output': str(output_path), 'sha256': sha256(raw).hexdigest()}))
    return 0 if result['status'] == 'EXECUTED_PASS_PURE_COUPLED_PHYSICAL_INPUT' else 1


if __name__ == '__main__':
    sys.exit(main())
