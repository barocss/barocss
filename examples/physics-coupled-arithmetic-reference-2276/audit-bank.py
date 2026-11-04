#!/usr/bin/env python3
"""Independent analytic-factor and IEEE-cell audit. AUTHOR MUST NOT EXECUTE."""
from fractions import Fraction as F
from hashlib import sha256
from pathlib import Path
import json
import math
import re
import struct
import sys
import time

HOME = Path(__file__).resolve().parent
CAPS = {'seconds': 180, 'bytes': 16 * 1024 * 1024, 'bits': 16384, 'rationalOps': 262144}
DEFAULTS = {'bits': 16384, 'rationals': 4096, 'integerOps': 262144, 'gcdSteps': 262144,
            'subdivisions': 256, 'exponent': 128, 'initialExponent': 64}
START = None
OPS = 0
PEAK = 0
READ = 0


class NoGo(Exception):
    pass


def need(ok, reason):
    if not ok:
        raise NoGo(reason)


def deadline():
    need(START is None or time.monotonic() - START < CAPS['seconds'], 'AUDIT_TIME_CAP')


def integer(value):
    global PEAK
    if isinstance(value, str):
        need(len(value) <= 4096 and re.fullmatch(r'-?\d+', value), 'AUDIT_INTEGER_ENCODING')
        value = int(value)
    need(type(value) is int, 'AUDIT_INTEGER_TYPE')
    bits = abs(value).bit_length()
    need(bits <= CAPS['bits'], 'AUDIT_INTEGER_BITS')
    PEAK = max(PEAK, bits)
    return value


def product(a, b):
    a, b = integer(a), integer(b)
    need(not a or not b or abs(a).bit_length() + abs(b).bit_length() <= CAPS['bits'], 'AUDIT_PROPOSED_PRODUCT_BITS')
    return integer(a * b)


def shift(value, exponent):
    value = integer(value)
    need(type(exponent) is int and 0 <= exponent <= 2048 and
         abs(value).bit_length() + exponent <= CAPS['bits'], 'AUDIT_PROPOSED_SHIFT_BITS')
    return integer(value << exponent)


def q(value):
    global OPS
    OPS += 1
    need(OPS <= CAPS['rationalOps'], 'AUDIT_RATIONAL_WORK_CAP')
    deadline()
    if isinstance(value, F):
        result = value
    elif isinstance(value, str):
        need(len(value) <= 4096 and re.fullmatch(r'-?\d+(?:/\d+)?', value), 'AUDIT_RATIONAL_ENCODING')
        pieces = value.split('/')
        numerator = integer(pieces[0])
        denominator = integer(pieces[1]) if len(pieces) == 2 else 1
        need(denominator > 0, 'AUDIT_RATIONAL_DENOMINATOR')
        result = F(numerator, denominator)
    else:
        result = F(integer(value))
    integer(result.numerator)
    integer(result.denominator)
    return result


def add(a, b):
    a, b = q(a), q(b)
    numerator = integer(product(a.numerator, b.denominator) + product(b.numerator, a.denominator))
    return q(F(numerator, product(a.denominator, b.denominator)))


def mul(a, b):
    a, b = q(a), q(b)
    return q(F(product(a.numerator, b.numerator), product(a.denominator, b.denominator)))


def neg(a):
    a = q(a)
    return q(F(-a.numerator, a.denominator))


def sub(a, b):
    return add(a, neg(b))


def div(a, b):
    b = q(b)
    need(b != 0, 'AUDIT_ZERO_DIVISION')
    return mul(a, F(b.denominator, b.numerator))


def text(value):
    value = q(value)
    return str(value.numerator) + '/' + str(value.denominator)


def dyadic(numerator, exponent):
    numerator = integer(numerator)
    exponent = integer(exponent)
    return q(F(numerator, shift(1, -exponent))) if exponent < 0 else q(shift(numerator, exponent))


def literal(value):
    if isinstance(value, list):
        return [literal(v) for v in value]
    if isinstance(value, dict):
        if set(value) == {'n', 'power2'}:
            return text(dyadic(value['n'], value['power2']))
        return {key: literal(v) for key, v in value.items()}
    return value


def request_of(value):
    value = literal(value)
    kind = value['kind']
    if kind == 'polynomial':
        value['coefficients'] = [text(v) for v in value['coefficients']]
        value['normalNumerator'] = [text(v) for v in value['normalNumerator']]
    elif kind == 'multiply':
        for key in ('left', 'right'):
            value[key] = [text(v) for v in value[key]]
    elif kind == 'round':
        value['value'] = text(value['value'])
    elif kind == 'presentation':
        value['interval'] = [text(v) for v in value['interval']]
    elif kind == 'operation' and value['operation'] == 'parse':
        value['values'] = [text(v) for v in value['values']]
    return value


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)


def wire(value):
    if type(value) is int:
        need(abs(value) < 2**53, 'AUDIT_LITERAL_TRANSPORT_INTEGER')
        return {'$f64le': struct.pack('<d', value).hex()}
    if isinstance(value, list):
        return [wire(v) for v in value]
    if isinstance(value, dict):
        return {key: wire(v) for key, v in value.items()}
    return value


def read_json(path):
    global READ
    deadline()
    size = path.stat().st_size
    need(size <= CAPS['bytes'] and READ + size <= CAPS['bytes'], 'AUDIT_READ_CAP')
    raw = path.read_bytes()
    READ += len(raw)
    return json.loads(raw), {'bytes': len(raw), 'sha256': sha256(raw).hexdigest()}


def raw_word(value):
    need(isinstance(value, dict) and set(value) == {'$f64le'} and
         re.fullmatch(r'[0-9a-f]{16}', value['$f64le']), 'AUDIT_LOSSLESS_NUMBER_REQUIRED')
    return bytes.fromhex(value['$f64le'])[::-1].hex()


def word_value(word):
    need(re.fullmatch(r'[0-9a-f]{16}', word), 'AUDIT_IEEE_WORD')
    raw = int(word, 16)
    exponent = (raw >> 52) & 2047
    mantissa = raw & ((1 << 52) - 1)
    need(exponent != 2047, 'AUDIT_NONFINITE_WORD')
    if exponent:
        mantissa += 1 << 52
    value = dyadic(mantissa, exponent - 1075 if exponent else -1074)
    return neg(value) if raw >> 63 else value


def number_integer(value):
    exact = word_value(raw_word(value))
    need(exact.denominator == 1, 'AUDIT_INTEGER_NUMBER_REQUIRED')
    return integer(exact.numerator)


def cell(word):
    raw = int(word, 16)
    value = word_value(word)
    maximum = 0x7fefffffffffffff
    sign = 1 << 63
    if raw < sign:
        lower = word_value(f'{raw - 1:016x}') if raw else neg(dyadic(1, -1074))
        upper = word_value(f'{raw + 1:016x}') if raw < maximum else dyadic(1, 1024)
    else:
        magnitude = raw - sign
        lower = word_value(f'{raw + 1:016x}') if magnitude < maximum else neg(dyadic(1, 1024))
        upper = word_value(f'{raw - 1:016x}') if magnitude else dyadic(1, -1074)
    return div(add(lower, value), 2), div(add(value, upper), 2), raw % 2 == 0


def prove_rne(value, word):
    value = q(value)
    lower, upper, even = cell(word)
    need((value > lower or value == lower and even) and
         (value < upper or value == upper and even), 'AUDIT_LITERAL_RNE_MIDPOINT_PROOF')
    if word_value(word) == 0:
        need((word.startswith('8') and value < 0) or (not word.startswith('8') and value >= 0),
             'AUDIT_LITERAL_ZERO_SIGN_PROOF')
    return {'lowerMidpoint': text(lower), 'upperMidpoint': text(upper), 'evenSignificand': even}


def trim(poly):
    while len(poly) > 1 and poly[-1] == 0:
        poly.pop()
    return poly


def pmul(a, b):
    need(len(a) + len(b) <= 10, 'AUDIT_POLYNOMIAL_DEGREE_CAP')
    result = [q(0) for _ in range(len(a) + len(b) - 1)]
    for i, x in enumerate(a):
        for j, y in enumerate(b):
            result[i + j] = add(result[i + j], mul(x, y))
    return trim(result)


def derivative(poly):
    return trim([mul(poly[i], i) for i in range(1, len(poly))] or [q(0)])


def evaluate(poly, value):
    result = q(0)
    for coefficient in reversed(poly):
        result = add(mul(result, value), coefficient)
    return result


def primitive(poly):
    denominator = 1
    for value in poly:
        denominator = product(denominator // math.gcd(denominator, value.denominator), value.denominator)
    numbers = [product(value.numerator, denominator // value.denominator) for value in poly]
    content = 0
    for value in numbers:
        content = math.gcd(content, value)
    need(content > 0, 'AUDIT_ZERO_POLYNOMIAL')
    return trim([q(value // content) for value in numbers])


def remainder(a, b):
    result = list(a)
    need(b[-1] != 0, 'AUDIT_STURM_ZERO_DIVISOR')
    while len(result) >= len(b) and result != [0]:
        offset = len(result) - len(b)
        factor = div(result[-1], b[-1])
        for i, value in enumerate(b):
            result[offset + i] = sub(result[offset + i], mul(factor, value))
        trim(result)
    return result


def variations(chain, value, side):
    signs = []
    for poly in chain:
        current, order = poly, 0
        while True:
            evaluated = evaluate(current, value)
            if evaluated:
                sign = (evaluated > 0) - (evaluated < 0)
                signs.append(-sign if side == -1 and order % 2 else sign)
                break
            need(len(current) > 1, 'AUDIT_ZERO_STURM_MEMBER')
            current, order = derivative(current), order + 1
    return sum(a != b for a, b in zip(signs, signs[1:]))


def polynomial_truth(row, request):
    poly = trim([q(v) for v in request['coefficients']])
    if 'factors' in row:
        factor_poly = [q(row['scale'])]
        roots = []
        for factor in row['factors']:
            root, multiplicity = q(factor['root']), integer(factor['multiplicity'])
            need(1 <= multiplicity <= 4, 'AUDIT_LITERAL_FACTOR_MULTIPLICITY')
            roots.extend([root] * multiplicity)
            for _ in range(multiplicity):
                factor_poly = pmul(factor_poly, [neg(root), q(1)])
        need(factor_poly == poly, 'AUDIT_LITERAL_FACTOR_EXPANSION')
    else:
        roots = []
        need(poly == [q(1), q(0), q(1)] or poly == [q(1)] or 'lowerLimits' in request,
             'AUDIT_LITERAL_ANALYTIC_CASE')
    return poly, roots


def classified(row, request, actual, poly, analytic_roots):
    expected = row['expected']
    interior = sorted(root for root in analytic_roots if 0 < root < 1)
    need(interior == [q(v) for v in expected['interiorRoots']] and len(interior) == len(set(interior)),
         'AUDIT_KNOWN_SIMPLE_INTERIOR_ROOTS')
    primitive_poly = primitive(poly)
    need([q(integer(v)) for v in actual['polynomialAscending']] == primitive_poly, 'AUDIT_PRIMITIVE_POLYNOMIAL')
    chain = [[q(integer(v)) for v in member] for member in actual['sturmAscending']]
    need(2 <= len(chain) <= 5 and chain[0] == primitive_poly and chain[1] == derivative(primitive_poly),
         'AUDIT_STURM_DERIVATIVE')
    for i in range(2, len(chain)):
        wanted = primitive([neg(v) for v in remainder(chain[i - 2], chain[i - 1])])
        need(chain[i] == wanted and len(chain[i]) < len(chain[i - 1]), 'AUDIT_STURM_RECURRENCE')
    need(len(chain[-1]) == 1 and chain[-1][0] != 0, 'AUDIT_STURM_SIMPLE_ROOT_TERMINAL')
    need(variations(chain, q(0), 1) - variations(chain, q(1), -1) == len(interior), 'AUDIT_STURM_KNOWN_ROOT_POPULATION')
    roots = actual['roots']
    need(len(roots) == len(interior), 'AUDIT_EMITTED_KNOWN_ROOT_POPULATION')
    H = [q(v) for v in request['normalNumerator']]
    seen, positive, negative = [], [], []
    selected_index = number_integer(actual['selectedRoot'])
    need(0 <= selected_index < len(roots), 'AUDIT_SELECTED_ROOT_INDEX')
    selected_value = None
    for i, root in enumerate(roots):
        lo, hi = q(root['lower']), q(root['upper'])
        need(lo == hi and lo in interior and root['exactRationalRoot'] is True and
             number_integer(root['openRootCount']) == 0, 'AUDIT_EXACT_DYADIC_ROOT')
        h = evaluate(H, lo)
        need([q(v) for v in root['hRange']] == [h, h] and h != 0, 'AUDIT_EXACT_H_SIGN_PROOF')
        wanted = 'ADMISSIBLE' if h > 0 else 'NEGATIVE_NORMAL'
        need(root['disposition'] == wanted, 'AUDIT_ROOT_H_DISPOSITION')
        (positive if h > 0 else negative).append(lo)
        seen.append(lo)
        if i == selected_index:
            selected_value = lo
    need(sorted(seen) == interior and sorted(positive) == [q(v) for v in expected['positiveRoots']] and
         sorted(negative) == [q(v) for v in expected['negativeRoots']] and
         selected_value == q(expected['selectedRoot']), 'AUDIT_ANALYTIC_SELECTION')
    return {'knownInteriorRoots': [text(v) for v in interior], 'selectedRoot': text(selected_value),
            'rootOracle': 'LITERAL_FACTORS_NO_ROOT_SEARCH'}


def meters(actual, request, expected):
    if expected.get('context') == 'NOT_CREATED':
        need(actual.get('context') == 'NOT_CREATED' and actual.get('counts') is None and
             actual.get('limits') is None, 'AUDIT_INVALID_LIMIT_BEFORE_CONTEXT')
        lower = request['lowerLimits']
        need(any(key not in DEFAULTS or key == 'initialExponent' or type(value) is not int or
                 value < 0 or value > DEFAULTS[key] for key, value in lower.items()),
             'AUDIT_INVALID_LIMIT_LITERAL_PROOF')
        return {'context': 'NOT_CREATED', 'limitsActuallyRaised': False}
    need(actual.get('context') == 'CREATED', 'AUDIT_ACTUAL_CONTEXT_CREATED')
    limits = dict(DEFAULTS)
    for key, value in request.get('lowerLimits', {}).items():
        need(key in DEFAULTS and key != 'initialExponent' and type(value) is int and 0 <= value <= DEFAULTS[key],
             'AUDIT_LOWER_LIMIT_ONLY')
        limits[key] = value
    need({key: number_integer(value) for key, value in actual['limits'].items()} == limits,
         'AUDIT_FROZEN_EFFECTIVE_LIMITS')
    fields = {'rationalOps': 'rationals', 'integerOps': 'integerOps', 'gcdSteps': 'gcdSteps',
              'peakBits': 'bits', 'subdivisions': 'subdivisions', 'maxDyadicExponent': 'exponent'}
    counts = {key: number_integer(value) for key, value in actual['counts'].items()}
    need(set(counts) == set(fields), 'AUDIT_ACTUAL_METER_FIELDS')
    denied = {'DYNAMIC_RATIONAL_WORK_LIMIT': 'rationalOps', 'DYNAMIC_INTEGER_WORK_LIMIT': 'integerOps',
              'DYNAMIC_GCD_WORK_LIMIT': 'gcdSteps', 'DYNAMIC_EXACT_BIT_LIMIT': 'peakBits',
              'DYNAMIC_SUBDIVISION_LIMIT': 'subdivisions'}.get(expected.get('reason'))
    for key, limit in fields.items():
        need(counts[key] >= 0 and (counts[key] <= limits[limit] or
             key == denied and counts[key] == expected['meter'][key]), 'AUDIT_METER_BOUND_' + key)
    for key, exact in expected.get('meter', {}).items():
        need(counts[key] == exact, 'AUDIT_KNOWN_ATTEMPTED_METER_' + key)
    return {'context': 'CREATED', 'counts': counts, 'limits': limits, 'limitsActuallyRaised': False}


def refusal_truth(poly, roots, request):
    if len(poly) == 1:
        need(poly[0] != 0, 'AUDIT_NONZERO_CONSTANT_PROOF')
        return 'DYNAMIC_CONSTANT_POLYNOMIAL'
    if len(roots) != len(set(roots)):
        return 'DYNAMIC_MULTIPLE_ROOT_UNQUALIFIED'
    if q(0) in roots or q(1) in roots:
        return 'DYNAMIC_ENDPOINT_ROOT_UNQUALIFIED'
    inside = [root for root in roots if 0 < root < 1]
    if not inside:
        return 'DYNAMIC_NO_INTERIOR_ROOT'
    H = [q(v) for v in request['normalNumerator']]
    values = [evaluate(H, root) for root in inside]
    if any(value == 0 for value in values):
        return 'DYNAMIC_ZERO_NORMAL_ROOT'
    positive = sum(value > 0 for value in values)
    if positive == 0:
        return 'DYNAMIC_NO_ADMISSIBLE_ROOT'
    need(positive > 1, 'AUDIT_REFUSAL_ANALYTIC_ROOT_CLASS')
    return 'DYNAMIC_AMBIGUOUS_ADMISSIBLE_ROOTS'


def resource_truth(request, expected):
    reason = expected['reason']
    lower = request.get('lowerLimits', {})
    if reason == 'TEST_LIMIT_INVALID':
        need(lower == {'initialExponent': 0} or lower == {'integerOps': 262145},
             'AUDIT_FIXED_INVALID_LIMIT_PROBE')
    elif reason == 'DYNAMIC_RATIONAL_WORK_LIMIT':
        need(request['operation'] == 'initialize' and lower == {'rationals': 1} and
             expected['meter'] == {'rationalOps': 2}, 'AUDIT_TWO_INITIAL_RATIONALS')
    elif reason == 'DYNAMIC_INTEGER_WORK_LIMIT':
        need(request['operation'] == 'initialize' and lower == {'integerOps': 0} and
             expected['meter'] == {'integerOps': 2}, 'AUDIT_FIRST_TWO_UNIT_PRIMITIVE_TICK')
    elif reason == 'DYNAMIC_GCD_WORK_LIMIT':
        need(request['operation'] == 'initialize' and lower == {'gcdSteps': 0} and
             expected['meter'] == {'gcdSteps': 1}, 'AUDIT_INITIAL_GCD_ONE_REMAINDER')
    elif reason == 'DYNAMIC_EXACT_BIT_LIMIT':
        need(request['operation'] == 'parse' and request['values'] == ['8/1'] and
             lower == {'bits': 3} and integer(8).bit_length() == expected['meter']['peakBits'] == 4,
             'AUDIT_FOUR_BIT_PARSE_LITERAL')
    elif reason == 'DYNAMIC_PRODUCT_BIT_LIMIT':
        need(request['operation'] == 'multiply-integers' and request['values'] == ['3', '3'] and
             lower == {'bits': 3} and product(3, 3).bit_length() == 4 and expected['meter'] == {'peakBits': 2},
             'AUDIT_FOUR_BIT_PRODUCT_LITERAL')
    elif reason == 'DYNAMIC_SHIFT_BIT_LIMIT':
        need(request['operation'] == 'shift-integer' and request['values'] == ['1'] and request['shift'] == 3 and
             lower == {'bits': 3} and shift(1, 3).bit_length() == 4 and expected['meter'] == {'peakBits': 1},
             'AUDIT_FOUR_BIT_SHIFT_LITERAL')
    else:
        need(request['kind'] == 'polynomial' and request['coefficients'] == ['-1/1', '4/1'] and
             request['normalNumerator'] == ['1/1'], 'AUDIT_FIRST_HALF_POINT_RESOURCE_PROBE')
        if reason == 'DYNAMIC_SUBDIVISION_LIMIT':
            need(lower == {'subdivisions': 0} and expected['meter'] == {'subdivisions': 1},
                 'AUDIT_FIRST_SUBDIVISION_ATTEMPT')
        else:
            need(reason == 'DYNAMIC_DYADIC_EXPONENT_LIMIT' and lower == {'exponent': 0} and
                 expected['meter'] == {'subdivisions': 1, 'maxDyadicExponent': 0},
                 'AUDIT_FIRST_DYADIC_EXPONENT_ATTEMPT')


def audit(packet_path):
    packet, packet_pin = read_json(packet_path)
    bank, bank_pin = read_json(HOME / 'bank.json')
    need(bank['privateCalls'] == 52 and bank['privateCallCap'] == 64 and len(bank['cases']) == 52 and
         bank['defaults'] == DEFAULTS and len({row['id'] for row in bank['cases']}) == 52,
         'AUDIT_FROZEN_BANK_CENSUS_DEFAULTS')
    need(set(packet) == {'id', 'request', 'actual'}, 'AUDIT_PACKET_SCHEMA')
    matches = [row for row in bank['cases'] if row['id'] == packet['id']]
    need(len(matches) == 1, 'AUDIT_LITERAL_CASE_ID')
    row = matches[0]
    request = request_of(row['request'])
    need(canonical(packet['request']) == canonical(wire(request)), 'AUDIT_EXACT_LITERAL_REQUEST')
    actual, expected = packet['actual'], row['expected']
    need(actual['status'] == expected['status'], 'AUDIT_EXPECTED_STATUS_' + expected['status'] + '_GOT_' + str(actual['status']))
    if 'reason' in expected:
        need(actual.get('reason') == expected['reason'], 'AUDIT_EXACT_TYPED_REASON')
    if 'lowerLimits' in request:
        resource_truth(request, expected)
    report = {'id': row['id'], 'packetPin': packet_pin, 'bankPin': bank_pin,
              'expectedStatus': expected['status'], 'meter': meters(actual, request, expected)}
    kind = request['kind']
    if kind == 'polynomial':
        poly, roots = polynomial_truth(row, request)
        if expected['status'] == 'CLASSIFIED':
            report['analytic'] = classified(row, request, actual, poly, roots)
        else:
            if 'lowerLimits' not in request:
                need(refusal_truth(poly, roots, request) == expected['reason'], 'AUDIT_ANALYTIC_REFUSAL_TRUTH')
            report['analytic'] = {'literalPolynomial': [text(v) for v in poly],
                                  'knownFactors': row.get('factors'), 'expectedRefusal': expected['reason']}
    elif kind == 'multiply':
        result = pmul([q(v) for v in request['left']], [q(v) for v in request['right']])
        if expected['status'] == 'COMPLETED':
            need(actual.get('result') == expected['result'] == [text(v) for v in result], 'AUDIT_LITERAL_POLYNOMIAL_PRODUCT')
        else:
            need(len(result) - 1 > 4, 'AUDIT_DEGREE_REFUSAL_PROOF')
    elif kind == 'round':
        value = q(request['value'])
        if 'word' in expected:
            need(raw_word(actual['value']) == expected['word'], 'AUDIT_LITERAL_IEEE_WORD')
            report['roundingProof'] = prove_rne(value, expected['word'])
        else:
            boundary = dyadic('18014398509481983', 970)
            need(abs(value) >= boundary and ((value > 0) == (expected['overflow'] == 'positive')),
                 'AUDIT_EXACT_OVERFLOW_MIDPOINT_PROOF')
            report['overflowBoundary'] = text(boundary)
    elif kind == 'presentation':
        lo, hi = [q(v) for v in request['interval']]
        need(lo <= hi, 'AUDIT_LITERAL_PRESENTATION_ORDER')
        if 'word' in expected:
            word = expected['word']
            need(raw_word(actual['value']) == word, 'AUDIT_PRESENTATION_IEEE_WORD')
            lower, upper, _ = cell(word)
            need((lo == hi == 0 and word == '0000000000000000') or
                 lower < lo <= hi < upper, 'AUDIT_STRICT_PRESENTATION_CELL')
            if word_value(word) == 0:
                need((lo == hi == 0 and not word.startswith('8')) or
                     (hi < 0 if word.startswith('8') else lo > 0), 'AUDIT_PRESENTATION_ZERO_SIGN')
        else:
            need(actual.get('value') is None, 'AUDIT_PRESENTATION_REFUSAL_NULL')
            if row['id'] == 'present-zero-crossing-refusal':
                need(lo < 0 < hi, 'AUDIT_ZERO_CROSSING_AMBIGUITY')
            else:
                _, midpoint, _ = cell('3ff0000000000000')
                need(row['id'] == 'present-midpoint-boundary-refusal' and lo < hi == midpoint,
                     'AUDIT_STRICT_MIDPOINT_POLICY_REFUSAL')
    elif kind == 'operation':
        need(expected['status'] == 'UNRESOLVED', 'AUDIT_LITERAL_OPERATION_EXPECTATION')
        report['analytic'] = {'knownSmallOperands': request.get('values'), 'operation': request['operation'],
                              'lowerLimits': request['lowerLimits'], 'fixedAttempt': expected.get('meter')}
    else:
        raise NoGo('AUDIT_UNKNOWN_LITERAL_KIND')
    return report


def main():
    global START
    START = time.monotonic()
    need(len(sys.argv) == 3, 'AUDIT_EXPECTS_PACKET_OUTPUT')
    packet_path, output_path = [Path(v).resolve() for v in sys.argv[1:]]
    with output_path.open('xb') as stream:
        result = {'status': 'NO_GO_INDEPENDENT_ARITHMETIC_LITERAL_CASE', 'firstFailure': None,
                  'WorldCalls': 0, 'candidateCalls': 0, 'referenceGeneratorCalls': 0,
                  'productionCalls': 'SEPARATE_13_CALL_PROTOCOL_CAP16',
                  'privateCalls': 'ONE_SAVED_PACKET_AUDIT_WITHIN_SEPARATE_52_CALL_PROTOCOL_CAP64',
                  'runtimeWorldPromotion': 'NOT_QUALIFIED_BY_THIS_ARITHMETIC_CASE', 'caps': CAPS}
        try:
            result['audit'] = audit(packet_path)
            result['status'] = 'EXECUTED_PASS_INDEPENDENT_ARITHMETIC_LITERAL_CASE'
        except Exception as error:
            result['firstFailure'] = {'type': type(error).__name__, 'reason': str(error)}
        result.update(elapsedSeconds=time.monotonic() - START, rationalOps=OPS, peakBits=PEAK, readBytes=READ)
        raw = (canonical(result) + '\n').encode()
        if len(raw) > CAPS['bytes']:
            result = {'status': 'NO_GO_INDEPENDENT_ARITHMETIC_LITERAL_CASE',
                      'firstFailure': result['firstFailure'] or {'type': 'NoGo', 'reason': 'AUDIT_OUTPUT_CAP'},
                      'WorldCalls': 0, 'candidateCalls': 0, 'referenceGeneratorCalls': 0}
            raw = (canonical(result) + '\n').encode()
        stream.write(raw)
    print(canonical({'status': result['status'], 'firstFailure': result['firstFailure'],
                     'output': str(output_path), 'sha256': sha256(raw).hexdigest()}))
    return 0 if result['status'] == 'EXECUTED_PASS_INDEPENDENT_ARITHMETIC_LITERAL_CASE' else 1


if __name__ == '__main__':
    sys.exit(main())
