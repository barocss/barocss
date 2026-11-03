"""Private exact position-witness checker. No Fraction, solver, fixture or oracle import."""
import json
import math
from pathlib import Path
import struct
import sys
import time

PROTOCOL = 'p4-position-witness-kernel-v1'
LIMIT = 2_000_000
REDUCED_BITS = 8192
INTERMEDIATE_BITS = 16385
MAX_BYTES = 2 * 1024 * 1024
MAX_OWNED = 64 * 1024 * 1024
OUTER_ALLOWANCE = 24 * 1024 * 1024
PROOF_RESERVATION = 32 * 1024 * 1024
OUTPUT_RESERVATION = 8 * 1024 * 1024
PHASES = ('parse', 'prepare', 'factor', 'kkt', 'rne', 'compare')
PRICES = {name: 1 for name in ('READ_FIELD', 'READ_CHAR', 'WRITE_CHAR', 'READ_BYTE',
    'ADD', 'SUB', 'MUL', 'NEG', 'CMP', 'BIT_LENGTH', 'SHL', 'SHR', 'AND', 'OR',
    'QUOT', 'REM', 'F64_CAST', 'F64_PACK', 'F64_FROM_SMALL_INT', 'F64_SCALE_POW2',
    'F64_FINITE', 'F64_CMP', 'F64_ABS', 'F64_SUB', 'F64_HYPOT3')}
PRICES['DIVMOD'] = 2
RESIDUAL_KEYS = ('primalViolationM', 'negativeMultiplierKgM', 'complementarityKgM2', 'stationarityKgM')
RESULT_KEYS = {'ok', 'status', 'basisRows', 'basisRank', 'dynamicDof', 'counters', 'trace',
    'lastSafeIterate', 'translations', 'lambdaKgM', 'primalMarginsM', 'objectiveKgM2',
    'certificate', 'infeasibilityCertificate', 'reason', 'worldStepped'}
COUNTER_LIMITS = {'iterations':1024, 'activeChanges':1024, 'rankChecks':2048,
    'linearSolves':2048, 'constraintTests':262144, 'factorizations':2048,
    'blockRightHandSides':57344, 'exactIntegerOperations':1000000, 'exactPeakBits':16385}
ZERO = (0, 1)
ONE = (1, 1)


class ProofError(Exception):
    def __init__(self, reason, detail=None):
        super().__init__(reason)
        self.reason, self.detail = reason, detail


class Meter:
    __slots__ = ('phase', 'performed', 'attempted', 'phase_performed', 'phase_attempted',
        'operations', 'gcd_remainders', 'normalizations', 'factorizations', 'pivots',
        'all_rows', 'dof', 'witness_rows', 'peak_input', 'peak_reduced', 'peak_intermediate',
        'denied', 'deadline', 'since_check', 'model')

    def __init__(self, deadline=None):
        self.phase = 'parse'
        self.performed = self.attempted = self.gcd_remainders = self.normalizations = 0
        self.factorizations = self.pivots = self.all_rows = self.dof = self.witness_rows = 0
        self.peak_input = self.peak_reduced = self.peak_intermediate = 0
        self.phase_performed = dict.fromkeys(PHASES, 0)
        self.phase_attempted = dict.fromkeys(PHASES, 0)
        self.operations = dict.fromkeys(PRICES, 0)
        self.denied = None
        self.deadline = time.monotonic() + 170 if deadline is None else deadline
        self.since_check = 0
        self.model = None  # Own decoded data, only for separately labeled outer equivalence checks.

    def check_time(self):
        if time.monotonic() >= self.deadline:
            raise ProofError('PROOF_TIME_LIMIT')
        self.since_check = 0

    def use(self, operation, count=1):
        if count < 1 or count > 256 or operation not in PRICES:
            raise RuntimeError('Invalid fixed meter reservation')
        price = PRICES[operation] * count
        if self.since_check + price > 1024:
            self.check_time()
        self.attempted += price
        self.phase_attempted[self.phase] += price
        if self.attempted > LIMIT:
            self.denied = dict(phase=self.phase, operation=operation, price=price, attempted=self.attempted)
            raise ProofError('PROOF_PRIMITIVE_LIMIT')
        self.performed += price
        self.phase_performed[self.phase] += price
        self.operations[operation] += count
        self.since_check += price
        if self.since_check >= 1024:
            self.check_time()

    def chars(self, operation, value):
        for start in range(0, len(value), 256):
            self.use(operation, min(256, len(value) - start))

    def set_phase(self, phase):
        if phase not in PHASES:
            raise RuntimeError('Unknown proof phase')
        self.check_time()
        self.phase = phase

    def snapshot(self):
        return dict(pricing='p4-position-witness-primitives-v1', limit=LIMIT,
            performed=self.performed, attempted=self.attempted,
            phasePerformed=dict(self.phase_performed), phaseAttempted=dict(self.phase_attempted),
            operationCounts=dict(self.operations), gcdRemainders=self.gcd_remainders,
            normalizations=self.normalizations, factorizationAttempts=self.factorizations,
            pivots=self.pivots, allRows=self.all_rows, dynamicDof=self.dof,
            witnessRows=self.witness_rows, peakInputBits=self.peak_input,
            peakReducedBits=self.peak_reduced, peakIntermediateBits=self.peak_intermediate,
            denied=self.denied, resetCount=0)


class Arithmetic:
    __slots__ = ('m',)

    def __init__(self, meter):
        self.m = meter

    def cmp_int(self, a, b):
        self.m.use('CMP')
        if a < b:
            return -1
        self.m.use('CMP')
        return 1 if a > b else 0

    def bits(self, a):
        self.m.use('BIT_LENGTH')
        return a.bit_length()

    def checked(self, a):
        size = self.bits(a)
        self.m.peak_intermediate = max(self.m.peak_intermediate, size)
        self.m.use('CMP')
        if size > INTERMEDIATE_BITS:
            raise ProofError('PROOF_INTERMEDIATE_BITS', 'retained integer bit bound')
        return a

    def prebound(self, size):
        self.m.use('CMP')
        if size > INTERMEDIATE_BITS:
            raise ProofError('PROOF_INTERMEDIATE_BITS', 'proposed bit bound=' + str(size))

    def add_i(self, a, b):
        self.prebound(max(self.bits(a), self.bits(b)) + 1)
        self.m.use('ADD')
        return self.checked(a + b)

    def sub_i(self, a, b):
        self.prebound(max(self.bits(a), self.bits(b)) + 1)
        self.m.use('SUB')
        return self.checked(a - b)

    def neg_i(self, a):
        self.checked(a)
        self.m.use('NEG')
        return self.checked(-a)

    def mul_i(self, a, b):
        if self.cmp_int(a, 0) == 0 or self.cmp_int(b, 0) == 0:
            return 0
        self.prebound(self.bits(a) + self.bits(b))
        self.m.use('MUL')
        return self.checked(a * b)

    def shl(self, a, power):
        if type(power) is not int or power < 0 or power > INTERMEDIATE_BITS:
            raise ProofError('PROOF_INTERMEDIATE_BITS', 'shift count')
        if self.cmp_int(a, 0) == 0:
            return 0
        self.prebound(self.bits(a) + power)
        self.m.use('SHL')
        return self.checked(a << power)

    def shr(self, a, power):
        self.checked(a)
        if type(power) is not int or power < 0 or power > INTERMEDIATE_BITS or self.cmp_int(a, 0) < 0:
            raise ProofError('PROOF_INPUT_INVALID', 'right-shift domain')
        self.m.use('SHR')
        return self.checked(a >> power)

    def bitop(self, op, a, b):
        self.checked(a); self.checked(b)
        if self.cmp_int(a, 0) < 0 or self.cmp_int(b, 0) < 0:
            raise ProofError('PROOF_INPUT_INVALID', 'bit operation domain')
        self.m.use(op)
        return self.checked(a & b if op == 'AND' else a | b)

    def divmod_i(self, a, b):
        self.checked(a); self.checked(b)
        if self.cmp_int(b, 0) == 0:
            raise ProofError('PROOF_DIVISION_BY_ZERO')
        self.m.use('DIVMOD')
        quotient, remainder = divmod(a, b)
        return self.checked(quotient), self.checked(remainder)

    def quot(self, a, b):
        self.checked(a); self.checked(b)
        if self.cmp_int(b, 0) == 0:
            raise ProofError('PROOF_DIVISION_BY_ZERO')
        self.m.use('QUOT')
        return self.checked(a // b)

    def rem(self, a, b):
        self.checked(a); self.checked(b)
        if self.cmp_int(b, 0) == 0:
            raise ProofError('PROOF_DIVISION_BY_ZERO')
        self.m.use('REM')
        return self.checked(a % b)

    def exact_div(self, a, b):
        quotient, remainder = self.divmod_i(a, b)
        if self.cmp_int(remainder, 0) != 0:
            raise ProofError('PROOF_EXACT_DIVISION_FAILED')
        return quotient

    def gcd(self, a, b):
        if self.cmp_int(a, 0) < 0:
            a = self.neg_i(a)
        if self.cmp_int(b, 0) < 0:
            b = self.neg_i(b)
        while self.cmp_int(b, 0) != 0:
            remainder = self.rem(a, b)
            self.m.gcd_remainders += 1
            a, b = b, remainder
        return a

    def reduced(self, n, d):
        self.checked(n); self.checked(d)
        if self.cmp_int(d, 0) <= 0:
            raise ProofError('PROOF_DIVISION_BY_ZERO')
        size = max(self.bits(n), self.bits(d))
        self.m.peak_reduced = max(self.m.peak_reduced, size)
        self.m.use('CMP')
        if size > REDUCED_BITS:
            raise ProofError('PROOF_REDUCED_BITS')
        return (n, d)

    def q(self, n, d=1):
        self.m.normalizations += 1
        self.checked(n); self.checked(d)
        if self.cmp_int(d, 0) == 0:
            raise ProofError('PROOF_DIVISION_BY_ZERO')
        if self.cmp_int(n, 0) == 0:
            return ZERO
        if self.cmp_int(d, 0) < 0:
            n, d = self.neg_i(n), self.neg_i(d)
        common = self.gcd(n, d)
        return self.reduced(self.quot(n, common), self.quot(d, common))

    def neg(self, a):
        return (self.neg_i(a[0]), a[1])

    def add(self, a, b):
        if self.cmp_int(a[0], 0) == 0:
            return b
        if self.cmp_int(b[0], 0) == 0:
            return a
        common = self.gcd(a[1], b[1])
        ad, bd = self.quot(a[1], common), self.quot(b[1], common)
        numerator = self.add_i(self.mul_i(a[0], bd), self.mul_i(b[0], ad))
        cancel = self.gcd(numerator, common)
        return self.reduced(self.quot(numerator, cancel), self.mul_i(ad, self.quot(b[1], cancel)))

    def sub(self, a, b):
        return self.add(a, self.neg(b))

    def mul(self, a, b):
        if self.cmp_int(a[0], 0) == 0 or self.cmp_int(b[0], 0) == 0:
            return ZERO
        g, h = self.gcd(a[0], b[1]), self.gcd(b[0], a[1])
        return self.reduced(self.mul_i(self.quot(a[0], g), self.quot(b[0], h)),
            self.mul_i(self.quot(a[1], h), self.quot(b[1], g)))

    def div(self, a, b):
        if self.cmp_int(b[0], 0) == 0:
            raise ProofError('PROOF_DIVISION_BY_ZERO')
        if self.cmp_int(a[0], 0) == 0:
            return ZERO
        g, h = self.gcd(a[0], b[0]), self.gcd(a[1], b[1])
        n = self.mul_i(self.quot(a[0], g), self.quot(b[1], h))
        d = self.mul_i(self.quot(a[1], h), self.quot(b[0], g))
        if self.cmp_int(d, 0) < 0:
            n, d = self.neg_i(n), self.neg_i(d)
        return self.reduced(n, d)

    def cmp(self, a, b):
        return self.cmp_int(self.mul_i(a[0], b[1]), self.mul_i(b[0], a[1]))

    def abs(self, a):
        return self.neg(a) if self.cmp_int(a[0], 0) < 0 else a

    def total(self, values):
        value = ZERO
        for item in values:
            value = self.add(value, item)
        return value

    def product_sum(self, products):
        """One final reduction of a bounded integer common-denominator sum."""
        terms, denominator, term_count = [], 1, 0
        for factors in products:
            term_count += 1
            need(term_count <= 36, 'PROOF_ALLOCATION_LIMIT', 'product-sum term bound')
            need(type(factors) is tuple and 1 <= len(factors) <= 4,
                'PROOF_ALLOCATION_LIMIT', 'product-sum factor bound')
            numerator, term_denominator = 1, 1
            for value in factors:
                if self.cmp_int(value[0], 0) == 0:
                    numerator = 0
                    break
                numerator = self.mul_i(numerator, value[0])
                term_denominator = self.mul_i(term_denominator, value[1])
            if self.cmp_int(numerator, 0) == 0:
                continue
            # Every raw product and LCM is checked before allocation by the
            # original integer wrappers. No per-product rational reduction.
            common = self.gcd(denominator, term_denominator)
            denominator = self.mul_i(self.exact_div(denominator, common), term_denominator)
            terms.append((numerator, term_denominator))
        numerator = 0
        for term_numerator, term_denominator in terms:
            scaled = self.mul_i(term_numerator, self.exact_div(denominator, term_denominator))
            numerator = self.add_i(numerator, scaled)
        return self.q(numerator, denominator)

    def dot(self, a, b):
        return self.product_sum((x, y) for x, y in zip(a, b))

    def maximum(self, values):
        result = ZERO
        for value in values:
            if self.cmp(value, result) > 0:
                result = value
        return result

    def finite(self, value):
        self.m.use('READ_FIELD')
        if type(value) not in (int, float):
            raise ProofError('PROOF_INPUT_INVALID', 'finite numerical field')
        self.m.use('F64_CAST')
        try:
            result = float(value)
        except (OverflowError, ValueError):
            raise ProofError('PROOF_INPUT_INVALID', 'binary64 conversion') from None
        self.m.use('F64_FINITE')
        if not math.isfinite(result):
            raise ProofError('PROOF_INPUT_INVALID', 'nonfinite number')
        return result

    def binary(self, value):
        value = self.finite(value)
        self.m.use('F64_PACK')
        data = struct.pack('>d', value)
        word = 0
        for byte in data:
            self.m.use('READ_BYTE')
            word = self.bitop('OR', self.shl(word, 8), byte)
        exponent = self.bitop('AND', self.shr(word, 52), 2047)
        mantissa = self.bitop('AND', word, 0xfffffffffffff)
        if self.cmp_int(exponent, 0) != 0:
            mantissa = self.bitop('OR', mantissa, 0x10000000000000)
        if self.cmp_int(self.shr(word, 63), 0) != 0:
            mantissa = self.neg_i(mantissa)
        power = exponent - 1075 if exponent else -1074  # Bounded exponent bookkeeping.
        result = self.q(mantissa, self.shl(1, -power)) if power < 0 else self.q(self.shl(mantissa, power))
        size = max(self.bits(result[0]), self.bits(result[1]))
        self.m.peak_input = max(self.m.peak_input, size)
        self.m.use('CMP')
        if size > REDUCED_BITS:
            raise ProofError('PROOF_INPUT_BITS')
        return result

    def numeric(self, value):
        n, d = value
        negative = self.cmp_int(n, 0) < 0
        if negative:
            n = self.neg_i(n)
        if self.cmp_int(n, 0) == 0:
            return 0.0
        exponent = self.bits(n) - self.bits(d)
        if (self.cmp_int(n, self.shl(d, exponent)) < 0 if exponent >= 0
                else self.cmp_int(self.shl(n, -exponent), d) < 0):
            exponent -= 1
        if exponent > 1023:
            raise ProofError('PROOF_NONFINITE_PRESENTATION')
        unit = max(-1074, exponent - 52)
        numerator = self.shl(n, -unit) if unit < 0 else n
        denominator = self.shl(d, unit) if unit > 0 else d
        significand, remainder = self.divmod_i(numerator, denominator)
        comparison = self.cmp_int(self.mul_i(remainder, 2), denominator)
        if comparison > 0 or comparison == 0 and self.cmp_int(self.bitop('AND', significand, 1), 0) != 0:
            significand = self.add_i(significand, 1)
        significand_bits = self.bits(significand)
        if significand_bits > 53 and self.cmp_int(significand, self.shl(1, 53)) != 0:
            raise ProofError('PROOF_NONFINITE_PRESENTATION', 'significand bound')
        self.m.use('F64_FROM_SMALL_INT')
        small = float(significand)
        self.m.use('F64_SCALE_POW2')
        try:
            number = math.ldexp(small, unit)
        except OverflowError:
            raise ProofError('PROOF_NONFINITE_PRESENTATION') from None
        self.m.use('F64_FINITE')
        if not math.isfinite(number):
            raise ProofError('PROOF_NONFINITE_PRESENTATION')
        # Applying the original integer sign to a finite presentation preserves -0.
        if negative:
            self.m.use('F64_SUB')
            number = -0.0 - number
        return number

    def integer_text(self, value):
        negative = self.cmp_int(value, 0) < 0
        if negative:
            value = self.neg_i(value)
        chunks = []
        while self.cmp_int(value, 0) != 0:
            value, remainder = self.divmod_i(value, 1_000_000_000)
            chunks.append(remainder)
        if not chunks:
            self.m.chars('WRITE_CHAR', '0')
            return '0'
        # Each conversion is bounded to at most9 digits; no large-int str call.
        text = str(chunks.pop())
        self.m.chars('WRITE_CHAR', text)
        for chunk in reversed(chunks):
            part = format(chunk, '09d')
            self.m.chars('WRITE_CHAR', part)
            text += part
        if negative:
            self.m.chars('WRITE_CHAR', '-')
            text = '-' + text
        return text

    def text(self, value):
        numerator = self.integer_text(value[0])
        denominator = self.integer_text(value[1])
        self.m.chars('WRITE_CHAR', '/')
        return numerator + '/' + denominator


def need(condition, reason='PROOF_INPUT_INVALID', detail=None):
    if not condition:
        raise ProofError(reason, detail)


def keys(value, expected):
    need(type(value) is dict and set(value) == set(expected))


def scan(value, r, depth=0, state=None):
    """Bounded scalar admission; no solution arithmetic or instructions from trace."""
    if state is None:
        state = [0]
    state[0] += 1
    need(state[0] <= 65536 and depth <= 32, 'PROOF_ALLOCATION_LIMIT', 'input tree')
    if value is None or type(value) is bool:
        r.m.use('READ_FIELD')
    elif type(value) in (int, float):
        r.finite(value)
    elif type(value) is str:
        need(len(value) <= 4096)
        r.m.chars('READ_CHAR', value)
    elif type(value) is list:
        need(len(value) <= 65536, 'PROOF_ALLOCATION_LIMIT')
        for child in value:
            scan(child, r, depth + 1, state)
    elif type(value) is dict:
        need(len(value) <= 65536, 'PROOF_ALLOCATION_LIMIT')
        for key, child in value.items():
            need(type(key) is str and len(key) <= 4096)
            r.m.chars('READ_CHAR', key)
            scan(child, r, depth + 1, state)
    else:
        raise ProofError('PROOF_INPUT_INVALID', 'nondata value')


def prepare(problem, observed, r):
    keys(problem, ('bodies', 'rows'))
    need(type(problem['bodies']) is list and len(problem['bodies']) == 9)
    need(type(problem['rows']) is list and len(problem['rows']) == 36)
    scan(problem, r); scan(observed, r)
    ids, inverse, columns, body_ids, static = set(), [], {}, [], 0
    for body in problem['bodies']:
        keys(body, ('id', 'inverseMass'))
        name = body['id']
        need(type(name) is str and 0 < len(name) <= 64 and name not in ids)
        ids.add(name); body_ids.append(name)
        mass_inverse = r.binary(body['inverseMass'])
        if r.cmp(mass_inverse, ZERO) == 0:
            static += 1
        else:
            need(r.cmp(mass_inverse, ONE) == 0)
            columns[name] = len(inverse)
            inverse.extend([mass_inverse] * 3)
    need(static == 1 and len(inverse) == 24)
    keys(observed, RESULT_KEYS)
    need(observed['status'] == 'SOLVED' and observed['ok'] is True and observed['worldStepped'] is False)
    need(observed['reason'] is None and observed['infeasibilityCertificate'] is None)
    witness = observed['basisRows']
    need(type(witness) is list and len(witness) <= 24, 'WITNESS_INDEX_INVALID')
    r.m.all_rows, r.m.dof, r.m.witness_rows = 36, 24, len(witness)
    previous = -1
    for index in witness:
        r.m.use('READ_FIELD')
        need(type(index) is int, 'WITNESS_INDEX_INVALID')
        need(r.cmp_int(index, previous) > 0 and r.cmp_int(index, 36) < 0, 'WITNESS_INDEX_INVALID')
        previous = index
    need(type(observed['basisRank']) is int and r.cmp_int(observed['basisRank'], len(witness)) == 0, 'WITNESS_INDEX_INVALID')
    need(type(observed['dynamicDof']) is int and r.cmp_int(observed['dynamicDof'], 24) == 0)
    keys(observed['counters'], COUNTER_LIMITS)
    for name, bound in COUNTER_LIMITS.items():
        value = observed['counters'][name]
        need(type(value) is int and r.cmp_int(value, 0) >= 0 and r.cmp_int(value, bound) <= 0)
    need(type(observed['trace']) is list and len(observed['trace']) <= observed['counters']['iterations'] + 1)
    def metadata_indexes(values):
        need(type(values) is list and len(values) <= 36)
        before = -1
        for value in values:
            r.m.use('READ_FIELD')
            need(type(value) is int and r.cmp_int(value, before) > 0 and r.cmp_int(value, 36) < 0)
            before = value
    for record in observed['trace']:
        keys(record, ('iteration', 'enteringRow', 'basisBefore', 'basisAfter', 'action',
            'blocker', 'stepKgM', 'schurInverseKg', 'condition', 'exactDependent'))
        need(type(record['iteration']) is int and r.cmp_int(record['iteration'], 0) >= 0 and r.cmp_int(record['iteration'], 1024) <= 0)
        for name in ('enteringRow', 'blocker'):
            value = record[name]
            need(value is None or type(value) is int and r.cmp_int(value, 0) >= 0 and r.cmp_int(value, 36) < 0)
        metadata_indexes(record['basisBefore']); metadata_indexes(record['basisAfter'])
        need(record['action'] in ('add', 'drop', 'dependent-drop', 'infeasible', 'unsafe', 'work-limit'))
        need(record['exactDependent'] is None or type(record['exactDependent']) is bool)
        for name in ('stepKgM', 'schurInverseKg', 'condition'):
            if record[name] is not None:
                r.finite(record[name])
    safe = observed['lastSafeIterate']
    keys(safe, ('uDynamic', 'lambdaKgM', 'pendingRow', 'pendingLambdaKgM', 'basisRows'))
    need(type(safe['uDynamic']) is list and len(safe['uDynamic']) == 24)
    need(type(safe['lambdaKgM']) is list and len(safe['lambdaKgM']) == 36)
    metadata_indexes(safe['basisRows'])
    if safe['pendingRow'] is not None:
        need(type(safe['pendingRow']) is int and r.cmp_int(safe['pendingRow'], 0) >= 0 and r.cmp_int(safe['pendingRow'], 36) < 0)
    r.finite(safe['pendingLambdaKgM'])
    need(type(observed['translations']) is list and len(observed['translations']) == 9)
    for body, item in zip(body_ids, observed['translations']):
        keys(item, ('id', 'u'))
        need(item['id'] == body and type(item['u']) is list and len(item['u']) == 3)
    for name in ('lambdaKgM', 'primalMarginsM'):
        need(type(observed[name]) is list and len(observed[name]) == 36)
    keys(observed['certificate'], RESIDUAL_KEYS)
    for value in observed['certificate'].values():
        number = r.finite(value); r.m.use('F64_CMP'); need(number >= 0)
    number = r.finite(observed['objectiveKgM2']); r.m.use('F64_CMP'); need(number >= 0)
    r.m.set_phase('prepare')
    a, b, seen_pairs = [], [], set()
    for row in problem['rows']:
        keys(row, ('aId', 'bId', 'normal', 'boundM'))
        ai, bi = row['aId'], row['bId']
        need(ai in ids and bi in ids and ai != bi)
        pair = tuple(sorted((ai, bi)))
        need(pair not in seen_pairs)
        seen_pairs.add(pair)
        need(type(row['normal']) is list and len(row['normal']) == 3)
        normal_f = [r.finite(x) for x in row['normal']]
        r.m.use('F64_HYPOT3'); length = math.hypot(*normal_f)
        r.m.use('F64_SUB'); delta = length - 1.0
        r.m.use('F64_ABS'); delta = abs(delta)
        r.m.use('F64_CMP'); need(delta <= 1e-12)
        normal = [r.binary(x) for x in normal_f]
        bound_f = r.finite(row['boundM'])
        r.m.use('F64_CMP'); need(bound_f >= -10)
        r.m.use('F64_CMP'); need(bound_f <= 10)
        coefficients = [ZERO] * 24
        for name, negative in ((ai, True), (bi, False)):
            if name in columns:
                for axis in range(3):
                    coefficients[columns[name] + axis] = r.neg(normal[axis]) if negative else normal[axis]
        a.append(coefficients); b.append(r.binary(bound_f))
    model = dict(a=a, b=b, inverse=inverse, columns=columns, body_ids=body_ids,
        witness=list(witness), d=24, m=36)
    r.m.model = model
    return model


def reconstruct(model, r):
    indexes, a, b, inverse = model['witness'], model['a'], model['b'], model['inverse']
    size = len(indexes)
    if not size:
        return [ZERO] * 24, [ZERO] * 36
    gram = [[r.total(r.mul(r.mul(a[i][k], inverse[k]), a[j][k]) for k in range(24))
        for j in indexes] for i in indexes]
    r.m.set_phase('factor')
    r.m.factorizations += 1
    table = []
    for row, index in zip(gram, indexes):
        values = row + [b[index]]
        denominator = 1
        for value in values:
            denominator = r.mul_i(r.quot(denominator, r.gcd(denominator, value[1])), value[1])
        table.append([r.mul_i(value[0], r.exact_div(denominator, value[1])) for value in values])
    previous = 1
    for k in range(size):
        r.m.pivots += 1
        pivot = table[k][k]
        direction = r.cmp_int(pivot, 0)
        if direction == 0:
            raise ProofError('WITNESS_BASIS_DEPENDENT')
        if direction < 0:
            raise ProofError('WITNESS_GRAM_NOT_POSITIVE')
        for i in range(k + 1, size):
            leading = table[i][k]
            for j in range(k + 1, size + 1):
                numerator = r.sub_i(r.mul_i(pivot, table[i][j]), r.mul_i(leading, table[k][j]))
                table[i][j] = r.exact_div(numerator, previous)
            table[i][k] = 0
        previous = pivot
    local = [ZERO] * size
    for i in range(size - 1, -1, -1):
        denominator = 1
        for value in local[i + 1:]:
            denominator = r.mul_i(r.quot(denominator, r.gcd(denominator, value[1])), value[1])
        numerator = r.mul_i(table[i][size], denominator)
        for j in range(i + 1, size):
            term = r.mul_i(r.mul_i(table[i][j], local[j][0]), r.exact_div(denominator, local[j][1]))
            numerator = r.sub_i(numerator, term)
        local[i] = r.q(numerator, r.mul_i(table[i][i], denominator))
    lam = [ZERO] * 36
    for index, value in zip(indexes, local):
        lam[index] = value
    u = [r.mul(inverse[j], r.total(r.mul(a[i][j], lam[i]) for i in indexes)) for j in range(24)]
    return u, lam


def kkt(model, u, lam, r, exact):
    a, b, inv = model['a'], model['b'], model['inverse']
    margins = [r.sub(r.dot(row, u), bound) for row, bound in zip(a, b)]
    if exact and any(r.cmp(value, ZERO) < 0 for value in margins):
        raise ProofError('WITNESS_PRIMAL_INFEASIBLE')
    if exact and any(r.cmp(value, ZERO) < 0 for value in lam):
        raise ProofError('WITNESS_DUAL_NEGATIVE')
    stationary = [r.sub(r.div(u[j], inv[j]), r.product_sum((a[i][j], lam[i]) for i in range(36))) for j in range(24)]
    if exact and any(r.cmp(value, ZERO) != 0 for value in stationary):
        raise ProofError('WITNESS_STATIONARITY_NONZERO')
    complementarity = [r.mul(x, y) for x, y in zip(lam, margins)]
    if exact and any(r.cmp(value, ZERO) != 0 for value in complementarity):
        raise ProofError('WITNESS_COMPLEMENTARITY_NONZERO')
    objective = r.product_sum((x, x, (mass[1], mass[0]), (1, 2)) for x, mass in zip(u, inv))
    return margins, stationary, complementarity, objective


def native_compare(model, observed, u, lam, objective, r):
    r.m.set_phase('compare')
    dynamic, all_native = [], []
    for item in observed['translations']:
        numbers = [r.finite(x) for x in item['u']]
        vector = [r.binary(x) for x in numbers]
        all_native.extend(vector)
        if item['id'] in model['columns']:
            dynamic.extend(vector)
        else:
            for value in numbers:
                r.m.use('F64_PACK')
                need(struct.pack('>d', value) == b'\0' * 8)
        r.m.use('F64_HYPOT3'); length = math.hypot(*numbers)
        r.m.use('F64_CMP'); need(length <= 10)
    native_lam = [r.binary(x) for x in observed['lambdaKgM']]
    full, stationary, comp, obj = kkt(model, dynamic, native_lam, r, False)
    residual = dict(primalViolationM=r.maximum(r.neg(x) for x in full),
        negativeMultiplierKgM=r.maximum(r.neg(x) for x in native_lam),
        complementarityKgM2=r.maximum(r.abs(x) for x in comp),
        stationarityKgM=r.maximum(r.abs(x) for x in stationary))
    actual_u = []
    for name in model['body_ids']:
        actual_u.extend(u[model['columns'][name]:model['columns'][name] + 3] if name in model['columns'] else [ZERO] * 3)
    measures = dict(translationDifferenceM=r.maximum(r.abs(r.sub(v, e)) for v, e in zip(all_native, actual_u)),
        objectiveDifferenceKgM2=r.abs(r.sub(r.binary(observed['objectiveKgM2']), objective)),
        certificateReportedDifference=r.maximum(r.abs(r.sub(r.binary(observed['certificate'][key]), value)) for key, value in residual.items()),
        marginReportedDifferenceM=r.maximum(r.abs(r.sub(r.binary(x), value)) for x, value in zip(observed['primalMarginsM'], full)),
        objectiveReportedDifferenceKgM2=r.abs(r.sub(r.binary(observed['objectiveKgM2']), obj)))
    gate = r.binary(1e-12)
    violations = []
    for key, value in {**residual, **measures}.items():
        if r.cmp(value, gate) > 0:
            violations.append(key + ' exceeds frozen 1e-12 in stated units')
    for i, value in enumerate(native_lam):
        if i not in model['witness'] and r.cmp(value, ZERO) != 0:
            violations.append('nonbasis native multiplier is not exact zero')
    r.m.set_phase('rne')
    metrics = {name:r.numeric(value) for name, value in measures.items()}
    metrics.update({name:r.numeric(value) for name, value in residual.items()})
    metrics['solutionReached'] = True
    metrics['actualCertificateExact'] = {name:r.text(value) for name, value in residual.items()}
    return metrics, violations


def certify_position_witness(problem, observed_result, meter=None):
    meter = Meter() if meter is None else meter
    r = Arithmetic(meter)
    try:
        meter.check_time()
        if explicit_size((problem, observed_result), OUTER_ALLOWANCE) + PROOF_RESERVATION + OUTPUT_RESERVATION > MAX_OWNED:
            raise ProofError('PROOF_ALLOCATION_LIMIT', 'proof preallocation')
        model = prepare(problem, observed_result, r)
        u, lam = reconstruct(model, r)
        meter.set_phase('kkt')
        margins, stationary, comp, objective = kkt(model, u, lam, r, True)
        # All-row exact proof precedes every reported multiplier/solution comparison.
        metrics, violations = native_compare(model, observed_result, u, lam, objective, r)
        meter.set_phase('rne')
        translations_exact, translations = [], []
        for name in model['body_ids']:
            vector = u[model['columns'][name]:model['columns'][name]+3] if name in model['columns'] else [ZERO] * 3
            translations_exact.append(dict(id=name, u=[r.text(x) for x in vector]))
            translations.append(dict(id=name, u=[r.numeric(x) for x in vector]))
        certificate = dict(translationsExact=translations_exact,
            lambdaExactKgM=[r.text(x) for x in lam], primalMarginsExactM=[r.text(x) for x in margins],
            objectiveExactKgM2=r.text(objective), stationarityExactKgM=[r.text(x) for x in stationary],
            complementarityExactKgM2=[r.text(x) for x in comp], basisRows=list(model['witness']),
            basisRank=len(model['witness']), dynamicDof=24,
            certificateExact={key:r.text(ZERO) for key in RESIDUAL_KEYS}, translations=translations,
            lambdaKgM=[r.numeric(x) for x in lam], primalMarginsM=[r.numeric(x) for x in margins],
            objectiveKgM2=r.numeric(objective))
        return dict(protocol=PROTOCOL, status='OBSERVED_RESULT_MISMATCH' if violations else 'EXACT_KKT_CERTIFIED',
            ok=not violations, resolved=True, reason='OBSERVED_RESULT_MISMATCH' if violations else None,
            certificate=certificate, metrics=metrics, proofCounters=meter.snapshot(), violations=violations)
    except ProofError as error:
        return dict(protocol=PROTOCOL, status='UNRESOLVED', ok=False, resolved=False,
            reason=error.reason, certificate=None, metrics=None, proofCounters=meter.snapshot(),
            violations=[error.reason] + ([] if error.detail is None else [error.detail]))


def explicit_size(value, limit):
    """Bounded builtin-data ownership preflight, not proof coefficient arithmetic."""
    seen, stack, total, cells = set(), [(value, 0)], 0, 0
    while stack:
        item, depth = stack.pop(); cells += 1
        if cells > 65536 or depth > 32:
            raise ProofError('PROOF_ALLOCATION_LIMIT', 'ownership tree')
        if id(item) in seen:
            continue
        seen.add(id(item)); total += sys.getsizeof(item)
        if total > limit:
            raise ProofError('PROOF_ALLOCATION_LIMIT', 'ownership bytes')
        if type(item) is dict:
            for key, child in item.items():
                stack.append((key, depth + 1)); stack.append((child, depth + 1))
        elif type(item) in (list, tuple):
            for child in item:
                stack.append((child, depth + 1))
        elif type(item) not in (str, int, float, bool, type(None)):
            raise ProofError('PROOF_INPUT_INVALID', 'ownership data type')
    return total


def load_request(path):
    path = Path(path)
    size = path.stat().st_size
    if size > MAX_BYTES or size * 128 + 65536 > OUTER_ALLOWANCE:
        raise ValueError('REQUEST_PREALLOCATION_LIMIT')
    data = path.read_bytes()
    return json.loads(data)


def write_reply(path, reply):
    # Proof retained output is bounded separately; serializer has an8MiB reservation.
    encoder = json.JSONEncoder(separators=(',', ':'), allow_nan=False)
    path = Path(path)
    count = 0
    with path.open('xb') as stream:
        for part in encoder.iterencode(reply):
            data = part.encode()
            if count + len(data) + 1 > MAX_BYTES:
                raise ValueError('REPLY_LIMIT')
            stream.write(data); count += len(data)
        stream.write(b'\n')
    return count + 1


def main(argv):
    if len(argv) != 3 or argv[0] != 'kernel':
        raise ValueError('candidate.py kernel REQUEST_FILE REPLY_FILE')
    started = time.monotonic()
    request = load_request(argv[1])
    need(type(request) is dict and request.get('op') == 'kernel')
    need(set(request) <= {'op', 'scope', 'problem', 'result'} and 'problem' in request and 'result' in request)
    reply = certify_position_witness(request['problem'], request['result'], Meter(started + 170))
    count = write_reply(argv[2], reply)
    print(json.dumps(dict(status='SERIALIZED_TYPED_KERNEL_REPLY', resultStatus=reply['status'], replyBytes=count)))
    return 0  # Expected typed rejection controls are successfully serialized replies.


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
