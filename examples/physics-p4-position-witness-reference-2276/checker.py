#!/usr/bin/env python3
"""Independent all-row products only. AUTHOR MUST NOT EXECUTE numerical paths."""
from pathlib import Path
from hashlib import sha256
import copy
import json
import math
import struct
import sys
import time

HOME = Path(__file__).resolve().parent
ROOT = HOME.parents[1]
MAX_FILE = 2 * 1024 * 1024
MAX_EVIDENCE = 16 * 1024 * 1024
MAX_RETAINED = 64 * 1024 * 1024
KERNEL_METRICS = ('translationDifferenceM', 'objectiveDifferenceKgM2', 'certificateReportedDifference',
    'marginReportedDifferenceM', 'objectiveReportedDifferenceKgM2', 'primalViolationM',
    'negativeMultiplierKgM', 'complementarityKgM2', 'stationarityKgM', 'solutionReached', 'actualCertificateExact')
RESIDUAL_KEYS = ('primalViolationM', 'negativeMultiplierKgM', 'complementarityKgM2', 'stationarityKgM')
START = None
READ = 0


class Failure(Exception):
    pass


def need(ok, reason):
    if not ok:
        raise Failure(reason)


def deadline():
    need(START is None or time.monotonic() - START < 170, 'INDEPENDENT_CHECKER_170S_LIMIT')


class Exact:
    """Own integer pricing; no Fraction library, factorization or optimizer."""
    def __init__(self):
        self.counts = {'checkedArithmeticUnits': 0, 'gcdRemainders': 0, 'rationalConstructions': 0,
                       'peakReducedBits': 0, 'peakIntermediateBits': 0, 'matrixDotProducts': 0,
                       'fullRowChecks': 0, 'stationarityChecks': 0, 'rneCells': 0,
                       'factorizations': 0, 'coldQpCalls': 0}
        self.categories = {}

    def tick(self, name, count=1):
        deadline()
        self.counts['checkedArithmeticUnits'] += count
        self.categories[name] = self.categories.get(name, 0) + count
        need(self.counts['checkedArithmeticUnits'] <= 2000000, 'INDEPENDENT_ARITHMETIC_UNIT_LIMIT')

    def sign(self, value):
        self.tick('integerSign')
        return (value > 0) - (value < 0)

    def bits(self, value):
        self.tick('integerBitLength')
        return value.bit_length()

    def checked(self, value):
        size = self.bits(value)
        self.counts['peakIntermediateBits'] = max(self.counts['peakIntermediateBits'], size)
        need(size <= 16385, 'INDEPENDENT_INTERMEDIATE_BITS')
        return value

    def negint(self, value):
        self.tick('integerNegation')
        return self.checked(-value)

    def iadd(self, a, b):
        need(max(self.bits(a), self.bits(b)) + 1 <= 16385, 'INDEPENDENT_PROPOSED_SUM_BITS')
        self.tick('integerAddition')
        return self.checked(a + b)

    def product(self, a, b):
        if self.sign(a) and self.sign(b):
            need(self.bits(a) + self.bits(b) <= 16385, 'INDEPENDENT_PROPOSED_PRODUCT_BITS')
        self.tick('integerMultiplication')
        return self.checked(a * b)

    def shift(self, a, exponent):
        need(type(exponent) is int and 0 <= exponent <= 16385 and
             self.bits(a) + exponent <= 16385, 'INDEPENDENT_PROPOSED_SHIFT_BITS')
        self.tick('integerShift')
        return self.checked(a << exponent)

    def quotient(self, a, b):
        need(self.sign(b) != 0, 'INDEPENDENT_INTEGER_ZERO_DIVISOR')
        self.tick('integerDivision')
        return self.checked(a // b)

    def gcd(self, a, b):
        if self.sign(a) < 0:
            a = self.negint(a)
        if self.sign(b) < 0:
            b = self.negint(b)
        while self.sign(b):
            self.tick('integerRemainder')
            self.counts['gcdRemainders'] += 1
            a, b = b, a % b
        return a

    def make(self, n, d=1):
        self.checked(n)
        self.checked(d)
        need(self.sign(d) != 0, 'INDEPENDENT_RATIONAL_ZERO_DENOMINATOR')
        if self.sign(d) < 0:
            n, d = self.negint(n), self.negint(d)
        if self.sign(n) == 0:
            n, d = 0, 1
        else:
            common = self.gcd(n, d)
            n, d = self.quotient(n, common), self.quotient(d, common)
        size = max(self.bits(n), self.bits(d))
        need(size <= 8192, 'INDEPENDENT_REDUCED_RATIONAL_BITS')
        self.counts['peakReducedBits'] = max(self.counts['peakReducedBits'], size)
        self.counts['rationalConstructions'] += 1
        return n, d

    def parse(self, value):
        need(type(value) is str and value.count('/') == 1 and len(value) <= 4936, 'INDEPENDENT_EXACT_ENCODING')
        n, d = value.split('/')
        need(n.lstrip('-').isdigit() and d.isdigit() and len(n) <= 2468 and len(d) <= 2467,
             'INDEPENDENT_EXACT_DIGITS')
        self.tick('integerTextDigit', len(n.lstrip('-')) + len(d))
        self.tick('integerTextConversion', 2)
        result = self.make(int(n), int(d))
        need(self.text(result) == value, 'INDEPENDENT_EXACT_NOT_CANONICAL')
        return result

    def binary(self, value):
        need(type(value) in (int, float), 'INDEPENDENT_BINARY64_INPUT_TYPE')
        self.tick('binary64WordRead')
        raw = struct.unpack('>Q', struct.pack('>d', value))[0]
        return self.from_word(raw)

    def from_word(self, raw):
        self.tick('integerShift', 2)
        self.tick('integerMask', 2)
        exponent, mantissa = (raw >> 52) & 2047, raw & ((1 << 52) - 1)
        need(exponent != 2047, 'INDEPENDENT_NONFINITE_WORD')
        if exponent:
            mantissa = self.iadd(mantissa, 1 << 52)
        self.tick('integerShift')
        if raw >> 63:
            mantissa = self.negint(mantissa)
        power = self.iadd(exponent, -1075) if exponent else -1074
        return self.make(mantissa, self.shift(1, -power)) if power < 0 else self.make(self.shift(mantissa, power))

    def add(self, a, b):
        if self.sign(a[0]) == 0:
            return b
        if self.sign(b[0]) == 0:
            return a
        return self.make(self.iadd(self.product(a[0], b[1]), self.product(b[0], a[1])), self.product(a[1], b[1]))

    def neg(self, a):
        # Canonical reduction and denominator sign are preserved by negation.
        return self.negint(a[0]), a[1]

    def sub(self, a, b):
        return self.add(a, self.neg(b))

    def mul(self, a, b):
        if self.sign(a[0]) == 0 or self.sign(b[0]) == 0:
            return self.make(0)
        self.tick('canonicalRationalEquality')
        if a == (1, 1):
            return b
        self.tick('canonicalRationalEquality')
        if b == (1, 1):
            return a
        return self.make(self.product(a[0], b[0]), self.product(a[1], b[1]))

    def div(self, a, b):
        need(self.sign(b[0]) != 0, 'INDEPENDENT_RATIONAL_ZERO_DIVISOR')
        if self.sign(a[0]) == 0:
            return self.make(0)
        self.tick('canonicalRationalEquality')
        if b == (1, 1):
            return a
        return self.make(self.product(a[0], b[1]), self.product(a[1], b[0]))

    def cmp(self, a, b):
        left, right = self.product(a[0], b[1]), self.product(b[0], a[1])
        self.tick('integerComparison')
        return (left > right) - (left < right)

    def absolute(self, a):
        return self.neg(a) if self.sign(a[0]) < 0 else a

    def total(self, values):
        result = self.make(0)
        for value in values:
            result = self.add(result, value)
        return result

    def dot(self, a, b):
        need(len(a) == len(b), 'INDEPENDENT_DOT_SHAPE')
        self.counts['matrixDotProducts'] += 1
        return self.total(self.mul(x, y) for x, y in zip(a, b))

    def maximum(self, values):
        result = self.make(0)
        for value in values:
            if self.cmp(value, result) > 0:
                result = value
        return result

    def text(self, value):
        # Prepay a conservative decimal-digit bound before native formatting.
        # The structural sizes are <=8192 bits; 30103/100000 > log10(2).
        digits_n = self.bits(value[0]) * 30103 // 100000 + 1
        digits_d = self.bits(value[1]) * 30103 // 100000 + 1
        sign = self.sign(value[0])
        self.tick('boundedDecimalText', digits_n + digits_d + (1 if sign < 0 else 0) + 3)
        return str(value[0]) + '/' + str(value[1])

    def rne(self, exact, represented, label):
        self.tick('binary64WordRead')
        word = struct.unpack('>Q', struct.pack('>d', represented))[0]
        value = self.from_word(word)
        maximum, sign = 0x7fefffffffffffff, 1 << 63
        if word < sign:
            lower = self.from_word(self.iadd(word, -1)) if word else self.neg(self.make(1, self.shift(1, 1074)))
            upper = self.from_word(self.iadd(word, 1)) if word < maximum else self.make(self.shift(1, 1024))
        else:
            magnitude = self.iadd(word, -sign)
            lower = self.from_word(self.iadd(word, 1)) if magnitude < maximum else self.neg(self.make(self.shift(1, 1024)))
            upper = self.from_word(self.iadd(word, -1)) if magnitude else self.make(1, self.shift(1, 1074))
        two = self.make(2)
        left, right = self.div(self.add(lower, value), two), self.div(self.add(value, upper), two)
        self.tick('integerMask')
        even = word & 1 == 0
        need((self.cmp(exact, left) > 0 or self.cmp(exact, left) == 0 and even) and
             (self.cmp(exact, right) < 0 or self.cmp(exact, right) == 0 and even), 'INDEPENDENT_RNE_' + label)
        if exact[0] == 0:
            need(word == 0, 'INDEPENDENT_EXACT_ZERO_POSITIVE_WORD_' + label)
        self.counts['rneCells'] += 1


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)


def same(a, b, label):
    if type(a) in (int, float) and type(b) in (int, float):
        need(struct.pack('>d', a) == struct.pack('>d', b), 'RAW_FLOAT64_' + label)
    elif isinstance(a, dict) and isinstance(b, dict):
        need(set(a) == set(b), 'RAW_KEYS_' + label)
        for key in a:
            same(a[key], b[key], label + '/' + key)
    elif isinstance(a, list) and isinstance(b, list):
        need(len(a) == len(b), 'RAW_LENGTH_' + label)
        for i, (x, y) in enumerate(zip(a, b)):
            same(x, y, label + '/' + str(i))
    else:
        need(type(a) is type(b) and a == b, 'RAW_VALUE_' + label)


def read(path, pin=None):
    global READ
    deadline()
    size = path.stat().st_size
    need(size <= MAX_FILE and READ + size <= MAX_EVIDENCE, 'INDEPENDENT_INPUT_BYTE_LIMIT')
    data = path.read_bytes()
    READ += len(data)
    actual = {'bytes': len(data), 'sha256': sha256(data).hexdigest()}
    if pin is not None:
        need(actual == pin, 'INDEPENDENT_INPUT_PIN_' + str(path))
    return json.loads(data), actual


def runtime_layout(bank):
    global READ
    relative = bank['runtimeLayoutAuthority']
    layout, layout_pin = read(ROOT / relative, bank['sourcePins'][relative])
    need(layout['kind'] == 'ROOT_RUNTIME_OBJECT_LAYOUT_METADATA' and sys.version == layout['python'],
         'INDEPENDENT_PINNED_PYTHON_LAYOUT_VERSION')
    executable = Path(sys.executable).resolve()
    need(executable == Path(layout['executable']).resolve(), 'INDEPENDENT_PINNED_PYTHON_EXECUTABLE')
    size = executable.stat().st_size
    need(size <= MAX_FILE and READ + size <= MAX_EVIDENCE, 'INDEPENDENT_EXECUTABLE_AUTH_BYTE_BOUND')
    binary = executable.read_bytes()
    READ += len(binary)
    need({'bytes': len(binary), 'sha256': sha256(binary).hexdigest()} == layout['executablePin'],
         'INDEPENDENT_PINNED_PYTHON_BINARY')
    need(layout['sizes']['int8192Bits'] <= 1120 and layout['sizes']['int16385Bits'] <= 2212 and
         layout['sizes']['tuple2'] <= 56 and layout['sizes']['emptyAscii'] <= 41,
         'INDEPENDENT_EIGHT_MIB_SCRATCH_LAYOUT_BOUNDS')
    return layout_pin


def allocation(value, seen=None):
    if seen is None:
        seen = set()
    if id(value) in seen:
        return 0
    seen.add(id(value))
    size = sys.getsizeof(value)
    if isinstance(value, dict):
        size += sum(allocation(k, seen) + allocation(v, seen) for k, v in value.items())
    elif isinstance(value, (list, tuple)):
        size += sum(allocation(v, seen) for v in value)
    need(size <= MAX_RETAINED, 'INDEPENDENT_RETAINED_DATA_LIMIT')
    return size


def model(problem, r):
    need(set(problem) == {'bodies', 'rows'} and len(problem['bodies']) == 9 and len(problem['rows']) == 36,
         'INDEPENDENT_ORIGINAL_9_BODY_36_ROW_PROFILE')
    bodies, columns, inverse = problem['bodies'], {}, []
    need([b['id'] for b in bodies] == ['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'floor'], 'INDEPENDENT_ORIGINAL_BODY_ORDER')
    zero, one = r.make(0), r.make(1)
    for body in bodies:
        need(set(body) == {'id', 'inverseMass'}, 'INDEPENDENT_BODY_FIELDS')
        mass = r.binary(body['inverseMass'])
        need(mass == (zero if body['id'] == 'floor' else one), 'INDEPENDENT_ORIGINAL_UNIT_MASS')
        if mass != zero:
            columns[body['id']] = len(inverse)
            inverse.extend([mass] * 3)
    A, b = [], []
    for row in problem['rows']:
        need(set(row) == {'aId', 'bId', 'normal', 'boundM'} and row['aId'] != row['bId'] and
             row['aId'] in [x['id'] for x in bodies] and row['bId'] in [x['id'] for x in bodies] and
             len(row['normal']) == 3, 'INDEPENDENT_ROW_SHAPE')
        normal = [r.binary(v) for v in row['normal']]
        r.tick('nativeHypot3')
        native_norm = math.hypot(*row['normal'])
        r.tick('nativeSubtractAbsoluteCompare', 3)
        need(abs(native_norm - 1) <= 1e-12, 'INDEPENDENT_OLD_UNIT_NORMAL_GATE')
        bound = r.binary(row['boundM'])
        need(r.cmp(bound, r.make(-10)) >= 0 and r.cmp(bound, r.make(10)) <= 0, 'INDEPENDENT_OLD_BOUND_GATE')
        coefficients = [zero] * 24
        for body_id, sign in ((row['aId'], -1), (row['bId'], 1)):
            if body_id in columns:
                for axis in range(3):
                    coefficients[columns[body_id] + axis] = r.neg(normal[axis]) if sign < 0 else normal[axis]
        A.append(coefficients)
        b.append(bound)
    return {'A': A, 'b': b, 'inverse': inverse, 'columns': columns, 'bodies': bodies}


def full_products(m, u, lam, r):
    margins = [r.sub(r.dot(row, u), bound) for row, bound in zip(m['A'], m['b'])]
    stationary = [r.sub(r.div(u[j], m['inverse'][j]), r.total(r.mul(m['A'][i][j], lam[i]) for i in range(36))) for j in range(24)]
    complementarity = [r.mul(x, y) for x, y in zip(lam, margins)]
    objective = r.div(r.total(r.div(r.mul(x, x), inv) for x, inv in zip(u, m['inverse'])), r.make(2))
    r.counts['fullRowChecks'] += 36
    r.counts['stationarityChecks'] += 24
    residual = {'primalViolationM': r.maximum(r.neg(v) for v in margins),
                'negativeMultiplierKgM': r.maximum(r.neg(v) for v in lam),
                'complementarityKgM2': r.maximum(r.absolute(v) for v in complementarity),
                'stationarityKgM': r.maximum(r.absolute(v) for v in stationary)}
    return margins, stationary, complementarity, objective, residual


def translations(items, m, r, exact):
    need(len(items) == 9 and [v['id'] for v in items] == [v['id'] for v in m['bodies']], 'INDEPENDENT_TRANSLATION_BODY_ORDER')
    values, dynamic = [], []
    for item in items:
        need(set(item) == {'id', 'u'} and len(item['u']) == 3, 'INDEPENDENT_TRANSLATION_FIELDS')
        row = [(r.parse(v) if exact else r.binary(v)) for v in item['u']]
        values.append(row)
        if item['id'] in m['columns']:
            dynamic.extend(row)
        else:
            need(row == [r.make(0)] * 3, 'INDEPENDENT_STATIC_TRANSLATION_ZERO')
    return values, dynamic


def metric_proof(observed, cert, m, exact_u, exact_objective, r):
    _, native_u = translations(observed['translations'], m, r, False)
    native_lam = [r.binary(v) for v in observed['lambdaKgM']]
    need(len(native_lam) == 36, 'INDEPENDENT_NATIVE_MULTIPLIER_POPULATION')
    need(set(observed['certificate']) == set(RESIDUAL_KEYS) and
         all(r.cmp(r.binary(value), r.make(0)) >= 0 for value in observed['certificate'].values()),
         'INDEPENDENT_OLD_NATIVE_CERTIFICATE_SHAPE_NONNEGATIVE')
    need(all(value == r.make(0) for i, value in enumerate(native_lam) if i not in observed['basisRows']),
         'INDEPENDENT_OLD_NATIVE_NONBASIS_MULTIPLIER_ZERO')
    margins, _, _, objective, residual = full_products(m, native_u, native_lam, r)
    declared_obj = r.binary(observed['objectiveKgM2'])
    values = dict(residual)
    values.update(translationDifferenceM=r.maximum(r.absolute(r.sub(a, b)) for a, b in zip(native_u, exact_u)),
        objectiveDifferenceKgM2=r.absolute(r.sub(declared_obj, exact_objective)),
        certificateReportedDifference=r.maximum(r.absolute(r.sub(r.binary(observed['certificate'][key]), residual[key])) for key in RESIDUAL_KEYS),
        marginReportedDifferenceM=r.maximum(r.absolute(r.sub(r.binary(x), y)) for x, y in zip(observed['primalMarginsM'], margins)),
        objectiveReportedDifferenceKgM2=r.absolute(r.sub(declared_obj, objective)))
    for item in observed['translations']:
        r.tick('nativeHypot3')
        native_norm = math.hypot(*item['u'])
        r.tick('nativeComparison')
        need(native_norm <= 10, 'INDEPENDENT_OLD_TRANSLATION_TEN_METRES')
    gate = r.binary(1e-12)
    failed = [key for key, value in values.items() if r.cmp(value, gate) > 0]
    return values, residual, failed


def certify(certificate, observed, cold, problem, r, world=False):
    exact_keys = {'translationsExact', 'lambdaExactKgM', 'primalMarginsExactM', 'objectiveExactKgM2',
                  'stationarityExactKgM', 'complementarityExactKgM2', 'basisRows', 'basisRank', 'dynamicDof', 'certificateExact',
                  'translations', 'lambdaKgM', 'primalMarginsM', 'objectiveKgM2'}
    if not world:
        need(set(certificate) == exact_keys, 'INDEPENDENT_EXACT_CERTIFICATE_FIELDS')
    # Fixed-dimensional matrix/vector/operator scratch reservation, separate
    # from the measured retained input graph. No dense solve is allocated.
    need(allocation((certificate, observed, cold, problem)) + 8 * 1024 * 1024 <= MAX_RETAINED,
         'INDEPENDENT_PRODUCT_SCRATCH_PREALLOCATION')
    m = model(problem, r)
    for key in ('translationsExact', 'lambdaExactKgM', 'primalMarginsExactM', 'objectiveExactKgM2',
                'translations', 'lambdaKgM', 'primalMarginsM', 'objectiveKgM2', 'certificateExact'):
        same(certificate[key], cold['reference'][key], 'SAVED_EXACT_PRIMAL_DUAL_AND_WORDS/' + key)
    need(certificate['basisRows'] == observed['basisRows'] and certificate['basisRank'] == len(observed['basisRows']) and
         certificate['dynamicDof'] == 24, 'INDEPENDENT_OBSERVED_BASIS_PROVENANCE')
    S = observed['basisRows']
    need(all(type(v) is int and 0 <= v < 36 for v in S) and S == sorted(set(S)) and len(S) <= 24,
         'INDEPENDENT_SORTED_UNIQUE_WITNESS_INDEX')
    _, u = translations(certificate['translationsExact'], m, r, True)
    lam = [r.parse(v) for v in certificate['lambdaExactKgM']]
    need(len(lam) == 36 and all(value == r.make(0) for i, value in enumerate(lam) if i not in S), 'INDEPENDENT_FULL_MULTIPLIER_SUPPORT')
    margins, stationary, complementarity, objective, residual = full_products(m, u, lam, r)
    zero = r.make(0)
    need(all(r.cmp(v, zero) >= 0 for v in margins + lam) and
         all(v == zero for v in stationary + complementarity), 'INDEPENDENT_ALL_ROW_EXACT_KKT')
    if not world:
        need([r.text(v) for v in stationary] == certificate['stationarityExactKgM'] and
             [r.text(v) for v in complementarity] == certificate['complementarityExactKgM2'],
             'INDEPENDENT_DECLARED_STATIONARITY_COMPLEMENTARITY')
    need([r.text(v) for v in margins] == certificate['primalMarginsExactM'] and
         r.text(objective) == certificate['objectiveExactKgM2'] and
         {key: r.text(value) for key, value in residual.items()} == certificate['certificateExact'],
         'INDEPENDENT_DECLARED_MATRIX_PRODUCT_IDENTITIES')
    for exact_item, represented in zip(certificate['translationsExact'], certificate['translations']):
        for i, (exact, value) in enumerate(zip(exact_item['u'], represented['u'])):
            r.rne(r.parse(exact), value, 'translation-' + exact_item['id'] + '-' + str(i))
    for key, exact_values in (('lambdaKgM', lam), ('primalMarginsM', margins)):
        for i, (value, exact) in enumerate(zip(certificate[key], exact_values)):
            r.rne(exact, value, key + '-' + str(i))
    r.rne(objective, certificate['objectiveKgM2'], 'objective')
    values, native_residual, failed = metric_proof(observed, certificate, m, u, objective, r)
    return {'model': m, 'metrics': values, 'nativeResidual': native_residual, 'failed': failed,
            'proof': {'uniquePrimal': 'POSITIVE_MASS_HESSIAN_AND_EXACT_ALL_ROW_KKT',
                      'dualUniqueness': 'NOT_CLAIMED_RAW_SAVED_DUAL_EQUALITY_REQUIRED',
                      'rows': 36, 'stationaryComponents': 24, 'factorizations': 0,
                      'coldLpOrQpSolves': 0, 'objectiveExactKgM2': r.text(objective)}}


def request_binding(mode, case_id, request, original, control, r):
    base = original if mode == 'world' else {'op': 'kernel', 'problem': original['problem'], 'result': original['result']}
    if control is None:
        same(request, base, 'COMPLETE_ORIGINAL_REQUEST')
        return
    need(mode == 'kernel', 'CONTROLS_ARE_KERNEL_ONLY')
    actual = copy.deepcopy(request)
    change = control['mutation']
    if change['kind'] == 'duplicate-observed-index':
        expected = list(base['result']['basisRows'])
        expected[1] = 0
        need(actual['result']['basisRows'] == expected, 'FIXED_DUPLICATE_INDEX')
        actual['result']['basisRows'] = base['result']['basisRows']
    elif change['kind'] in ('add-observed-index', 'remove-observed-index'):
        S = list(base['result']['basisRows'])
        if change['kind'] == 'add-observed-index':
            S.append(1)
            S.sort()
        else:
            S.remove(7)
        need(actual['result']['basisRows'] == S and actual['result']['basisRank'] == change['basisRank'], 'FIXED_CHANGED_WITNESS')
        actual['result']['basisRows'], actual['result']['basisRank'] = base['result']['basisRows'], base['result']['basisRank']
    else:
        need(change['kind'] == 'replace-observed-component', 'FIXED_CONTROL_KIND')
        item = next(v for v in actual['result']['translations'] if v['id'] == 'b0')
        source = next(v for v in base['result']['translations'] if v['id'] == 'b0')
        need(r.binary(source['u'][1]) == r.parse(change['oldExactM']) and
             r.binary(item['u'][1]) == r.parse(change['newExactM']) and
             r.sub(r.binary(item['u'][1]), r.binary(source['u'][1])) == r.parse(change['deltaExactM']) and
             r.cmp(r.parse(change['deltaExactM']), r.binary(1e-12)) > 0, 'FIXED_EXACT_REPORTED_TRANSLATION_DELTA')
        item['u'][1] = source['u'][1]
    same(actual, base, 'ALL_UNCHANGED_CONTROL_FIELDS_AND_WORDS')


def control_truth(control, original, cold, r):
    m = model(original['problem'], r)
    zero = r.make(0)
    case_id = control['id']
    if case_id == 'control-duplicate-index':
        return 'EXACT_DUPLICATE_ZERO_INDEX_BEFORE_FACTORIZATION'
    if case_id == 'control-dependent-original-row1':
        need(all(m['A'][1][j] == r.add(m['A'][0][j], m['A'][8][j]) for j in range(24)) and
             m['b'][1] == r.parse('-1/2') and r.add(m['b'][0], m['b'][8]) == zero,
             'EXACT_DEPENDENT_ORIGINAL_ROWS_1_0_8')
        return 'A1_EQUALS_A0_PLUS_A8_GRAM_SINGULAR_RANK_FIRST'
    if case_id == 'control-omit-ground-row7':
        basis = [i for i in original['result']['basisRows'] if i != 7]
        need(basis == [0, 8, 15, 21, 26, 30, 33] and all(m['b'][i] == zero for i in basis), 'EXACT_ZERO_RHS_CUBE_CHAIN')
        edges = [(original['problem']['rows'][i]['aId'], original['problem']['rows'][i]['bId']) for i in basis]
        need(edges == [('b0','b1'),('b1','b2'),('b2','b3'),('b3','b4'),('b4','b5'),('b5','b6'),('b6','b7')],
             'CONNECTED_SEVEN_EDGE_INCIDENCE_TREE')
        need(m['b'][7] == r.parse(control['proof']['boundExactM']) and r.cmp(m['b'][7], zero) > 0 and
             cold['reference']['lambdaExactKgM'][7] == control['proof']['savedGroundLambdaExactKgM'] and
             all(item['u'][1] == control['proof']['boundExactM'] for item in cold['reference']['translationsExact'] if item['id'] != 'floor'),
             'SAVED_CERTIFICATE_NECESSARY_GROUND_ROW')
        need(r.text(r.neg(m['b'][7])) == control['proof']['violatedMarginExactM'], 'EXACT_OMITTED_GROUND_NEGATIVE_MARGIN')
        return 'ZERO_EQUALITY_MINIMUM_HAS_STRICTLY_NEGATIVE_FULL_ROW7_MARGIN'
    need(case_id == 'control-reported-translation', 'FIXED_CONTROL_ID')
    return 'FIXED_DYADIC_REPORTED_DELTA_EXCEEDS_OLD_GATE_AFTER_EXACT_KKT'


def metrics_reply(actual, proof, cold, control, r):
    need(set(actual) == set(KERNEL_METRICS), 'EXACT_KERNEL_METRIC_FIELDS')
    for key, value in proof['metrics'].items():
        r.rne(value, actual[key], 'native-metric-' + key)
    need(actual['solutionReached'] is True and actual['actualCertificateExact'] ==
         {key: r.text(value) for key, value in proof['nativeResidual'].items()}, 'EXACT_NATIVE_RESIDUAL_REPORT')
    if control is None:
        same(actual, {key: cold['metrics'][key] for key in KERNEL_METRICS}, 'COMPLETE_SAVED_KERNEL_PHYSICAL_METRICS')


def proof_counters(counters, request, certified, control):
    keys = {'pricing', 'limit', 'performed', 'attempted', 'phasePerformed', 'phaseAttempted',
            'operationCounts', 'gcdRemainders', 'normalizations', 'factorizationAttempts', 'pivots',
            'allRows', 'dynamicDof', 'witnessRows', 'peakInputBits', 'peakReducedBits',
            'peakIntermediateBits', 'denied', 'resetCount'}
    phases = {'parse', 'prepare', 'factor', 'kkt', 'rne', 'compare'}
    operations = {'READ_FIELD', 'READ_CHAR', 'WRITE_CHAR', 'READ_BYTE', 'ADD', 'SUB', 'MUL', 'NEG',
        'CMP', 'BIT_LENGTH', 'SHL', 'SHR', 'AND', 'OR', 'QUOT', 'REM', 'DIVMOD', 'F64_CAST',
        'F64_PACK', 'F64_FROM_SMALL_INT', 'F64_SCALE_POW2', 'F64_FINITE', 'F64_CMP', 'F64_ABS',
        'F64_SUB', 'F64_HYPOT3'}
    need(set(counters) == keys and counters['pricing'] == 'p4-position-witness-primitives-v1' and
         counters['limit'] == 2000000 and counters['resetCount'] == 0, 'FROZEN_CANDIDATE_PRICE_COUNTER_SCHEMA')
    need(set(counters['phasePerformed']) == set(counters['phaseAttempted']) == phases and
         set(counters['operationCounts']) == operations, 'FROZEN_PHASE_OPCODE_FIELDS')
    for value in list(counters['phasePerformed'].values()) + list(counters['phaseAttempted'].values()) + list(counters['operationCounts'].values()):
        need(type(value) is int and 0 <= value <= 2000000, 'BOUNDED_CANDIDATE_COUNTER_VALUE')
    need(type(counters['performed']) is int and 0 <= counters['performed'] <= 2000000 and
         type(counters['attempted']) is int and counters['attempted'] == counters['performed'] and
         counters['denied'] is None, 'NO_UNEXPECTED_PROOF_PRIMITIVE_REFUSAL')
    need(sum(counters['phasePerformed'].values()) == counters['performed'] and
         sum(counters['phaseAttempted'].values()) == counters['attempted'] and
         sum(value * (2 if tag == 'DIVMOD' else 1) for tag, value in counters['operationCounts'].items()) == counters['performed'],
         'EXACT_CANDIDATE_PRICE_AND_PHASE_TOTALS')
    for key, limit in (('gcdRemainders', 2000000), ('normalizations', 2000000), ('factorizationAttempts', 1),
                       ('pivots', 24), ('allRows', 36), ('dynamicDof', 24), ('witnessRows', 24),
                       ('peakInputBits', 8192), ('peakReducedBits', 8192), ('peakIntermediateBits', 16385)):
        need(type(counters[key]) is int and 0 <= counters[key] <= limit, 'CANDIDATE_COUNTER_BOUND_' + key)
    need(counters['gcdRemainders'] <= counters['operationCounts']['REM'], 'GCD_REMAINDERS_ARE_PRICED_SUBSET')
    need(counters['performed'] > 0 and counters['phasePerformed']['parse'] > 0 and
         counters['operationCounts']['READ_FIELD'] > 0, 'ACTUAL_PRICED_NATIVE_ADMISSION')
    if certified:
        need(counters['allRows'] == 36 and counters['dynamicDof'] == 24 and
             counters['witnessRows'] == len(request['result']['basisRows']) and counters['factorizationAttempts'] == 1,
             'COMPLETE_CERTIFIED_DIMENSIONS_AND_ONE_FACTORIZATION')
    elif control['id'] == 'control-duplicate-index':
        need(counters['factorizationAttempts'] == 0, 'DUPLICATE_REJECTION_BEFORE_FACTORIZATION')
    else:
        need(counters['factorizationAttempts'] == 1, 'FIXED_REJECTION_AFTER_ONE_REAL_FACTORIZATION')
    if counters['factorizationAttempts']:
        need(counters['phasePerformed']['factor'] > 0, 'ACTUAL_PRICED_FACTORIZATION_WORK')
    if certified or control is not None and control['id'] == 'control-omit-ground-row7':
        need(counters['phasePerformed']['kkt'] > 0, 'ACTUAL_PRICED_GLOBAL_KKT_WORK')
    return {'pricingVerified': True, 'sourceInstrumentationAuthority': 'SEPARATE_FROZEN_IMPLEMENTATION_REVIEW_REQUIRED',
            'performed': counters['performed'], 'attempted': counters['attempted'],
            'factorizationAttempts': counters['factorizationAttempts'], 'pivots': counters['pivots']}


def check(mode, case_id, request_path, reply_path, r):
    bank, bank_pin = read(HOME / 'bank.json')
    layout_pin = runtime_layout(bank)
    controls = {value['id']: value for value in bank['controls']}
    control = controls.get(case_id)
    frame_id = control['base'] if control else case_id
    frame = next(value for value in bank['frames'] if value['id'] == frame_id)
    # Selected exact authority files are authenticated before any proof parsing.
    original, original_pin = read(ROOT / frame['request'], bank['sourcePins'][frame['request']])
    cold, cold_pin = read(ROOT / frame['coldAuthority'], bank['sourcePins'][frame['coldAuthority']])
    request, request_pin = read(request_path)
    reply, reply_pin = read(reply_path)
    request_binding(mode, case_id, request, original, control, r)
    need(cold['ok'] is True and cold['resolved'] is True and cold['referenceStatus'] == 'SOLVED', 'AUTHENTICATED_COLD_AUTHORITY_SOLVED')
    retained = allocation((bank, original, cold, request, reply))
    report = {'caseId': case_id, 'mode': mode, 'bankPin': bank_pin, 'originalRequestPin': original_pin,
              'coldAuthorityPin': cold_pin, 'requestPin': request_pin, 'replyPin': reply_pin,
              'explicitRetainedBytes': retained, 'newColdQpCalls': 0, 'newGeometryCalls': 0, 'WorldCalls': 0}
    report['runtimeLayoutPin'] = layout_pin
    if control:
        report['fixedControlProof'] = control_truth(control, original, cold, r)
    if mode == 'kernel':
        kernel = reply
        need(set(kernel) == {'protocol', 'status', 'ok', 'resolved', 'reason', 'certificate', 'metrics', 'proofCounters', 'violations'} and
             kernel['protocol'] == 'p4-position-witness-kernel-v1', 'EXACT_NEW_KERNEL_PROTOCOL_ENVELOPE')
        certificate, metrics, counters = kernel['certificate'], kernel['metrics'], kernel['proofCounters']
        expected_status = control['expectedStatus'] if control else 'EXACT_KKT_CERTIFIED'
        need(kernel['status'] == expected_status, 'EXPECTED_STATUS_' + expected_status + '_GOT_' + str(kernel['status']))
        if control:
            need(kernel['reason'] == control['expectedReason'], 'FIXED_CONTROL_EXACT_REASON')
    else:
        need(control is None and reply['ok'] is True and reply['resolved'] is True and reply['referenceStatus'] == 'SOLVED',
             'FULL_WORLD_REFERENCE_SUCCESS')
        certificate = reply['reference']
        metrics = {key: reply['metrics'][key] for key in KERNEL_METRICS}
        counters = certificate['proofCounters']
        expected_status = 'EXACT_KKT_CERTIFIED'
    if expected_status == 'UNRESOLVED':
        need(kernel['ok'] is False and kernel['resolved'] is False and certificate is None and metrics is None and
             isinstance(kernel['violations'], list) and control['expectedReason'] in kernel['violations'],
             'FIXED_REFUSAL_NOT_POSITIVE_SOLUTION')
        report['expectedRejectionControl'] = True
    else:
        if mode == 'kernel':
            need(kernel['resolved'] is True and kernel['ok'] is (control is None), 'EXACT_CERTIFIED_OR_NATIVE_MISMATCH_ENVELOPE')
        proof = certify(certificate, request['result'], cold, request['problem'], r, world=mode == 'world')
        metrics_reply(metrics, proof, cold, control, r)
        if control:
            need('translationDifferenceM' in proof['failed'] and kernel['violations'], 'REPORTED_TRANSLATION_REJECTED_AFTER_KKT')
            report['expectedRejectionControl'] = True
        else:
            need(not proof['failed'], 'ALL_OLD_NATIVE_GATES_PASS')
            if mode == 'kernel':
                need(kernel['reason'] is None and kernel['violations'] == [], 'SUCCESSFUL_KERNEL_REASON_VIOLATIONS')
        report['proof'] = proof['proof']
    report['candidatePriceAudit'] = proof_counters(counters, request, expected_status != 'UNRESOLVED', control)
    if mode == 'world':
        need(control is None, 'NO_WORLD_WRAPPER_REJECTION_CONTROL')
        saved, v2_pin = read(ROOT / frame['positionV2Authority'], bank['sourcePins'][frame['positionV2Authority']])
        live = allocation((bank, original, cold, request, reply, saved, proof, r.counts, r.categories))
        copy_bound = allocation((reply, saved))
        need(live + copy_bound + 8 * 1024 * 1024 <= MAX_RETAINED, 'INDEPENDENT_WORLD_PAYLOAD_COPY_PREALLOCATION')
        actual_payload, saved_payload = copy.deepcopy(reply), copy.deepcopy(saved)
        need(actual_payload.pop('referenceProtocol') == 'p4-position-witness-v1' and
             saved_payload.pop('referenceProtocol') == 'p4-full-position-observer-v2', 'DECLARED_FULL_WORLD_PROTOCOL_CHANGE')
        need('counters' not in actual_payload['reference'], 'NO_FABRICATED_COLD_SEARCH_COUNTERS')
        actual_payload['reference'].pop('proofCounters')
        need(actual_payload['reference'].pop('arithmetic') == 'guarded exact witness; one fraction-free factorization; all-row KKT' and
             actual_payload['reference'].pop('proofAuthority') == 'exact-global-KKT-with-untrusted-native-basis', 'DECLARED_NEW_PROOF_AUTHORITY')
        provenance = actual_payload['reference'].pop('witnessProvenance')
        same(provenance, {'source': 'request.result.basisRows', 'trusted': False,
                          'usedAsSearchSeed': False, 'basisRows': request['result']['basisRows']}, 'EXACT_UNTRUSTED_WITNESS_PROVENANCE')
        saved_payload['reference'].pop('counters')
        need(saved_payload['reference'].pop('arithmetic') == 'guarded exact Fraction; cold elastic LP then primal QP', 'DECLARED_OLD_COLD_ARITHMETIC_PATH')
        same(actual_payload, saved_payload, 'COMPLETE_SAVED_V2_PHYSICAL_PAYLOAD_NO_NORMALIZATION')
        report['explicitRetainedBytes'] = allocation((bank, original, cold, request, reply, saved,
            proof, actual_payload, saved_payload, r.counts, r.categories))
        report['savedV2AuthorityPin'] = v2_pin
        report['completeWorldPhysicalPayload'] = 'ALL_RETAINED_FIELDS_AND_IEEE_WORDS_EXACT'
    report['candidateProofCounters'] = counters
    return report


def main():
    global START
    START = time.monotonic()
    need(len(sys.argv) == 6 and sys.argv[1] in ('kernel', 'world'), 'MODE_CASE_REQUEST_REPLY_OUTPUT_REQUIRED')
    mode, case_id = sys.argv[1:3]
    request_path, reply_path, output_path = [Path(value).resolve() for value in sys.argv[3:]]
    r = Exact()
    with output_path.open('xb') as stream:
        result = {'status': 'NO_GO_POSITION_WITNESS_INDEPENDENT_CASE', 'firstFailure': None,
                  'WorldCalls': 0, 'coldQpCalls': 0, 'factorizations': 0,
                  'same32ForceGeometryEquilibrium': 'AUTHENTICATED_REUSED_NOT_REEXECUTED',
                  'wholeP4': 'UNCHANGED_NO_GO', 'mode': mode}
        try:
            result['audit'] = check(mode, case_id, request_path, reply_path, r)
            result['status'] = 'EXECUTED_PASS_POSITION_WITNESS_' + ('KERNEL' if mode == 'kernel' else 'WORLD') + '_CASE'
        except Exception as error:
            result['firstFailure'] = {'type': type(error).__name__, 'reason': str(error)}
        result.update(elapsedSeconds=time.monotonic() - START, readBytes=READ,
                      independentCounters=r.counts, independentPrimitiveCategories=r.categories)
        data = (canonical(result) + '\n').encode()
        if len(data) > MAX_EVIDENCE:
            result = {'status': 'NO_GO_POSITION_WITNESS_INDEPENDENT_CASE',
                      'firstFailure': result['firstFailure'] or {'type': 'Failure', 'reason': 'INDEPENDENT_EVIDENCE_LIMIT'}}
            data = (canonical(result) + '\n').encode()
        stream.write(data)
    print(canonical({'status': result['status'], 'firstFailure': result['firstFailure'], 'output': str(output_path)}))
    return int(result['firstFailure'] is not None)


if __name__ == '__main__':
    sys.exit(main())
