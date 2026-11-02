#!/usr/bin/env python3
"""Authorized-only, independent full-KKT impulse reference. Python stdlib only."""
import argparse
import copy
from decimal import (Decimal, Context, localcontext, getcontext, ROUND_HALF_EVEN, Clamped,
                     InvalidOperation, DivisionByZero, Inexact, Rounded,
                     Subnormal, Overflow, Underflow, FloatOperation)
from fractions import Fraction
import hashlib
import hmac
import json
from pathlib import Path
import re
import signal
import sys
import time

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
PINS = {
    'CONTRACT.md': (13569, '7e11f247a8287d5713bdba8f18a3a36fba2abf3602a39cfcd5663461974a05a6'),
    'CASES.json': (31141, 'f2de2962270fc9fc4910844325d52eb7a2b373f9c3ac884455a53340b4d87d90'),
    'AUTHORING-FREEZE-01.json': (None, '77631e8fadcf0ab61e3f57e810ad81e14a029cad69a8961c683cc9ff546615f7'),
}
MIB = 1048576
WORK_MAX = 8 * MIB
EVIDENCE_MAX = 8 * MIB
RESERVED_EVIDENCE = 65536
STORED_BITS = 4096
PRODUCT_BITS = 8192
MAX_DECIMAL_DIGITS = 2048
SIGNALS = (Clamped, InvalidOperation, DivisionByZero, Inexact, Rounded,
           Subnormal, Overflow, Underflow, FloatOperation)
RATIONAL = re.compile(r'^-?(0|[1-9][0-9]*)(/[1-9][0-9]*)?$')
ENTITY = re.compile(r'^[A-Za-z][A-Za-z0-9._:-]{0,63}$')


class ReferenceFailure(RuntimeError):
    pass


def require(condition, message):
    if not condition:
        raise ReferenceFailure(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_bound(path, maximum=MIB):
    require(path.stat().st_size <= maximum, 'input byte bound: ' + str(path))
    with path.open('rb') as stream:
        data = stream.read(maximum + 1)
    require(len(data) <= maximum, 'input grew beyond bound')
    return data


def strict_json(data):
    def pairs(items):
        value = {}
        for key, item in items:
            require(key not in value, 'duplicate JSON field')
            value[key] = item
        return value
    def constant(value):
        raise ReferenceFailure('nonfinite JSON literal: ' + value)
    return json.loads(data, object_pairs_hook=pairs, parse_constant=constant)


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=True, allow_nan=False, separators=(',', ':')) + '\n').encode()


def raw_parts(text):
    require(type(text) is str and len(text) <= 128 and RATIONAL.fullmatch(text), 'invalid bounded rational spelling')
    parts = text.split('/')
    return parts[0], parts[1] if len(parts) == 2 else '1'


class Accounting:
    def __init__(self):
        self.counts = {'requestsAttempted': 0, 'requestsReturned': 0, 'acceptedReferences': 0,
                       'expectedRefusals': 0, 'idealFixturesConstructed': 0, 'rationalInputConversions': 0,
                       'exactKktAttempted': 0, 'exactKktReturned': 0,
                       'exactConditionAttempted': 0, 'exactConditionReturned': 0,
                       'decimal80Attempted': 0, 'decimal80Returned': 0,
                       'decimal120Attempted': 0, 'decimal120Returned': 0,
                       'fractionArithmetic': 0, 'fractionComparisons': 0, 'decimalArithmetic': 0,
                       'WorldCalls': 0, 'candidateCalls': 0, 'nativeFixtureConversions': 0}
        self.max_stored_bits = self.max_product_bits = self.max_sum_bits = 0
        self.max_decimal_digits = self.peak_work_sum = 0
        self.phase = 'authentication'
        self.case_id = None
        self.offending = None
        self.detail = None

    def working(self, *roots):
        # Conservative explicit allocation sum. Shared values can count twice;
        # this is task-owned working data, not interpreter/code-page RSS.
        nodes = 0
        def walk(value, depth=0):
            nonlocal nodes
            nodes += 1
            require(nodes <= 10000 and depth <= 16, 'working graph shape bound')
            size = sys.getsizeof(value)
            if type(value) is Fraction:
                return size + sys.getsizeof(value.numerator) + sys.getsizeof(value.denominator)
            if type(value) is dict:
                return size + sum(walk(key, depth + 1) + walk(item, depth + 1) for key, item in value.items())
            if type(value) in (list, tuple):
                return size + sum(walk(item, depth + 1) for item in value)
            require(type(value) in (str, int, bool, type(None), Decimal), 'unlisted working object type')
            return size
        measured = sum(walk(root) for root in roots)
        # Reserve fixed interpreter frames/iterators, operand temporaries and
        # bounded source/input/progress metadata inside this8MiB allowance.
        upper = measured + 262144
        self.peak_work_sum = max(self.peak_work_sum, upper)
        require(upper <= WORK_MAX, 'reference working-data8MiB bound')
        return upper


class ExactArithmetic:
    def __init__(self, audit):
        self.audit = audit

    def checked(self, value):
        require(type(value) is Fraction, 'exact arithmetic type')
        bits = max(value.numerator.bit_length(), value.denominator.bit_length())
        self.audit.max_stored_bits = max(self.audit.max_stored_bits, bits)
        if bits > STORED_BITS:
            self.audit.offending = {'numeratorBits': value.numerator.bit_length(), 'denominatorBits': value.denominator.bit_length(),
                                    'numerator': str(value.numerator), 'denominator': str(value.denominator)}
            raise ReferenceFailure('Fraction stored4096-bit bound')
        return value

    def literal(self, text, authored=False):
        n, d = raw_parts(text)
        # At most128 decimal input characters precede integer/Fraction allocation.
        if authored:
            self.audit.counts['rationalInputConversions'] += 1
        return self.checked(Fraction(int(n), int(d)))

    def zero(self):
        return self.checked(Fraction(0, 1))

    def one(self):
        return self.checked(Fraction(1, 1))

    def product_bound(self, left, right):
        estimate = left.bit_length() + right.bit_length()
        self.audit.max_product_bits = max(self.audit.max_product_bits, estimate)
        require(estimate <= PRODUCT_BITS, 'Fraction intermediate product8192-bit bound')
        return estimate

    def operation(self, kind, left, right):
        self.checked(left); self.checked(right)
        self.audit.counts['fractionArithmetic'] += 1
        if kind in ('add', 'sub'):
            first = self.product_bound(left.numerator, right.denominator)
            second = self.product_bound(right.numerator, left.denominator)
            self.product_bound(left.denominator, right.denominator)
            sum_bound = max(first, second) + 1
            self.audit.max_sum_bits = max(self.audit.max_sum_bits, sum_bound)
            require(sum_bound <= PRODUCT_BITS + 1, 'Fraction intermediate sum bound')
            result = left + right if kind == 'add' else left - right
        elif kind == 'mul':
            self.product_bound(left.numerator, right.numerator)
            self.product_bound(left.denominator, right.denominator)
            result = left * right
        else:
            require(right.numerator != 0, 'unexpected exact division by zero')
            self.product_bound(left.numerator, right.denominator)
            self.product_bound(left.denominator, right.numerator)
            result = left / right
        return self.checked(result)

    def add(self, a, b): return self.operation('add', a, b)
    def sub(self, a, b): return self.operation('sub', a, b)
    def mul(self, a, b): return self.operation('mul', a, b)
    def div(self, a, b): return self.operation('div', a, b)

    def neg(self, value):
        self.checked(value); self.audit.counts['fractionArithmetic'] += 1
        return self.checked(-value)

    def absolute(self, value):
        return self.neg(value) if value.numerator < 0 else self.checked(value)

    def less(self, a, b):
        self.checked(a); self.checked(b)
        self.product_bound(a.numerator, b.denominator); self.product_bound(b.numerator, a.denominator)
        self.audit.counts['fractionComparisons'] += 1
        return a < b

    def dot(self, left, right):
        require(len(left) == len(right), 'dot dimensions')
        result = self.zero()
        for a, b in zip(left, right): result = self.add(result, self.mul(a, b))
        return result

    def cross(self, left, right):
        return [self.sub(self.mul(left[1], right[2]), self.mul(left[2], right[1])),
                self.sub(self.mul(left[2], right[0]), self.mul(left[0], right[2])),
                self.sub(self.mul(left[0], right[1]), self.mul(left[1], right[0]))]

    def matmul(self, left, right):
        require(left and right and len(left[0]) == len(right), 'matrix product dimensions')
        return [[self.dot(row, [right[k][column] for k in range(len(right))])
                 for column in range(len(right[0]))] for row in left]


def exact_record(value, names):
    return type(value) is dict and set(value) == set(names)


def scalar_shape(value):
    if type(value) is str:
        return len(value) <= 128 and RATIONAL.fullmatch(value) is not None
    return exact_record(value, ['ieee754F64LE']) and type(value['ieee754F64LE']) is str and re.fullmatch('[0-9a-f]{16}', value['ieee754F64LE']) is not None


def vector_shape(value, length=3):
    return type(value) is list and len(value) == length and all(scalar_shape(x) for x in value)


def classify(raw, f):
    if not exact_record(raw, ['clothContext', 'rigidContext', 'point', 'rigid']): return 'SCHEMA_INVALID', None
    cloth, rigid_owner, point, body = raw['clothContext'], raw['rigidContext'], raw['point'], raw['rigid']
    if not exact_record(cloth, ['id', 'vertexCount', 'pinnedVertexIndices']) or not exact_record(rigid_owner, ['bodyId']): return 'SCHEMA_INVALID', None
    if not exact_record(point, ['endpoint', 'positionM', 'velocityMps', 'massKg']): return 'SCHEMA_INVALID', None
    if not exact_record(body, ['endpoint', 'comPositionM', 'velocityMps', 'angularVelocityRadps', 'massKg', 'rotationBodyToWorld', 'principalInertiaKgM2']): return 'SCHEMA_INVALID', None
    pe, be = point['endpoint'], body['endpoint']
    if not exact_record(pe, ['kind', 'clothId', 'vertexIndex']) or pe['kind'] != 'cloth-vertex': return 'SCHEMA_INVALID', None
    if not exact_record(be, ['kind', 'bodyId', 'anchorLocalM']) or be['kind'] != 'rigid-anchor': return 'SCHEMA_INVALID', None
    for value in (cloth['id'], rigid_owner['bodyId'], pe['clothId'], be['bodyId']):
        if type(value) is not str or ENTITY.fullmatch(value) is None: return 'SCHEMA_INVALID', None
    if type(cloth['vertexCount']) is not int or not 1 <= cloth['vertexCount'] <= 289: return 'SCHEMA_INVALID', None
    if type(cloth['pinnedVertexIndices']) is not list or len(cloth['pinnedVertexIndices']) > 289: return 'SCHEMA_INVALID', None
    if any(type(x) is not int or not 0 <= x < cloth['vertexCount'] for x in cloth['pinnedVertexIndices']): return 'SCHEMA_INVALID', None
    if len(set(cloth['pinnedVertexIndices'])) != len(cloth['pinnedVertexIndices']): return 'SCHEMA_INVALID', None
    if type(pe['vertexIndex']) is not int: return 'SCHEMA_INVALID', None
    vectors = [point['positionM'], point['velocityMps'], body['comPositionM'], body['velocityMps'], body['angularVelocityRadps'], be['anchorLocalM'], body['principalInertiaKgM2']]
    rotation = body['rotationBodyToWorld']
    if not all(vector_shape(value) for value in vectors) or not scalar_shape(point['massKg']) or not scalar_shape(body['massKg']): return 'SCHEMA_INVALID', None
    if type(rotation) is not list or len(rotation) != 3 or not all(vector_shape(row) for row in rotation): return 'SCHEMA_INVALID', None
    leaves = [x for vector in vectors + rotation for x in vector] + [point['massKg'], body['massKg']]
    for value in leaves:
        if type(value) is dict:
            word = int.from_bytes(bytes.fromhex(value['ieee754F64LE']), 'little')
            return ('NONFINITE_STATE' if (word >> 52) & 2047 == 2047 else 'SCHEMA_INVALID'), None
    if cloth['id'] == rigid_owner['bodyId'] or pe['clothId'] != cloth['id'] or be['bodyId'] != rigid_owner['bodyId']: return 'ENDPOINT_OWNER_MISMATCH', None
    if not 0 <= pe['vertexIndex'] < cloth['vertexCount']: return 'ENDPOINT_INDEX_RANGE', None
    if pe['vertexIndex'] in cloth['pinnedVertexIndices']: return 'PINNED_ENDPOINT', None
    convert = lambda vector: [f.literal(value, True) for value in vector]
    state = {'xp': convert(point['positionM']), 'vp': convert(point['velocityMps']),
             'xb': convert(body['comPositionM']), 'vb': convert(body['velocityMps']),
             'omega': convert(body['angularVelocityRadps']), 'arm': convert(be['anchorLocalM']),
             'moments': convert(body['principalInertiaKgM2']), 'R': [convert(row) for row in rotation],
             'mp': f.literal(point['massKg'], True), 'mb': f.literal(body['massKg'], True)}
    low_mass, one, low_inertia, half = f.literal('1/1024'), f.one(), f.literal('1/4096'), f.literal('1/2')
    if f.less(state['mp'], low_mass) or f.less(one, state['mp']): return 'POINT_MASS_RANGE', None
    if f.less(state['mb'], low_mass) or f.less(one, state['mb']): return 'RIGID_MASS_RANGE', None
    if any(f.less(value, low_inertia) or f.less(one, value) for value in state['moments']): return 'INERTIA_RANGE', None
    for field, bound in (('xp', one), ('xb', one), ('vp', one), ('vb', one), ('omega', one), ('arm', half)):
        if any(f.less(bound, f.absolute(value)) for value in state[field]): return 'COMPONENT_RANGE', None
    moments = state['moments']
    for i in range(3):
        if f.less(f.add(moments[(i + 1) % 3], moments[(i + 2) % 3]), moments[i]): return 'NONPHYSICAL_INERTIA', None
    r = state['R']
    for i in range(3):
        for j in range(3):
            value = f.dot([r[k][i] for k in range(3)], [r[k][j] for k in range(3)])
            if value != (one if i == j else f.zero()): return 'NOT_PROPER_ROTATION', None
    if f.dot(r[0], f.cross(r[1], r[2])) != one: return 'NOT_PROPER_ROTATION', None
    world_arm = [f.dot(row, state['arm']) for row in r]
    if any(f.add(x, arm) != point_x for x, arm, point_x in zip(state['xb'], world_arm, state['xp'])): return 'ANCHOR_MISMATCH', None
    state['worldArm'] = world_arm
    return None, state


def f_zeros(rows, columns, f):
    return [[f.zero() for _ in range(columns)] for _ in range(rows)]


def transpose(matrix):
    return [list(column) for column in zip(*matrix)]


def f_rotated_diagonal(rotation, diagonal, f):
    physical_diagonal = f_zeros(3, 3, f)
    for i in range(3): physical_diagonal[i][i] = diagonal[i]
    return f.matmul(f.matmul(rotation, physical_diagonal), transpose(rotation))


def exact_physical_blocks(state, f):
    # Nine physical kinetic coordinates, not a condensed impulse matrix.
    mass = f_zeros(9, 9, f)
    for i in range(3): mass[i][i], mass[i + 3][i + 3] = state['mp'], state['mb']
    world_inertia = f_rotated_diagonal(state['R'], state['moments'], f)
    for i in range(3):
        for j in range(3): mass[i + 6][j + 6] = world_inertia[i][j]
    constraint = f_zeros(3, 9, f)
    for column in range(9):
        basis = [f.one() if i == column else f.zero() for i in range(9)]
        spin_velocity = f.cross(basis[6:9], state['worldArm'])
        for row in range(3): constraint[row][column] = f.sub(f.sub(basis[row], basis[row + 3]), spin_velocity[row])
    before = state['vp'] + state['vb'] + state['omega']
    rhs = [f.dot(row, before) for row in mass]
    augmented = [mass[i][:] + [constraint[j][i] for j in range(3)] + [rhs[i]] for i in range(9)]
    augmented += [row[:] + [f.zero(), f.zero(), f.zero(), f.zero()] for row in constraint]
    return mass, constraint, before, augmented


def exact_elimination(augmented, size, rhs_count, f):
    require((size, rhs_count) in ((12, 1), (3, 3)), 'unfrozen exact solve dimensions')
    require(len(augmented) == size and all(len(row) == size + rhs_count for row in augmented), 'exact augmented shape')
    work = [row[:] for row in augmented]
    for pivot in range(size):
        f.audit.detail = {'arithmetic': 'Fraction', 'matrixSize': size, 'pivot': pivot}
        chosen = next((row for row in range(pivot, size) if work[row][pivot].numerator != 0), None)
        require(chosen is not None, 'exact KKT/condition matrix is singular')
        work[pivot], work[chosen] = work[chosen], work[pivot]
        divisor = work[pivot][pivot]
        for column in range(size + rhs_count): work[pivot][column] = f.div(work[pivot][column], divisor)
        for row in range(size):
            if row == pivot: continue
            multiplier = work[row][pivot]
            if multiplier.numerator == 0: continue
            for column in range(size + rhs_count):
                f.audit.detail = {'arithmetic': 'Fraction', 'matrixSize': size, 'pivot': pivot, 'row': row, 'column': column}
                work[row][column] = f.sub(work[row][column], f.mul(multiplier, work[pivot][column]))
        f.audit.working(augmented, work)
    return [row[size:] for row in work]


def exact_condition(state, constraint, f):
    # Physical inverse mass blocks are independent of production effective-mass
    # assembly. Proper rational R makes this angular block the exact inverse.
    inverse_mass = f_zeros(9, 9, f)
    for i in range(3):
        inverse_mass[i][i] = f.div(f.one(), state['mp'])
        inverse_mass[i + 3][i + 3] = f.div(f.one(), state['mb'])
    inverse_spin = f_rotated_diagonal(state['R'], [f.div(f.one(), value) for value in state['moments']], f)
    for i in range(3):
        for j in range(3): inverse_mass[i + 6][j + 6] = inverse_spin[i][j]
    schur = f.matmul(f.matmul(constraint, inverse_mass), transpose(constraint))
    augmented = [row[:] + [f.one() if i == j else f.zero() for j in range(3)] for i, row in enumerate(schur)]
    f.audit.counts['exactConditionAttempted'] += 1
    require(f.audit.counts['exactConditionAttempted'] <= 13, 'condition factorization budget')
    inverse = exact_elimination(augmented, 3, 3, f)
    f.audit.counts['exactConditionReturned'] += 1
    product = f.matmul(schur, inverse)
    require(all(product[i][j] == (f.one() if i == j else f.zero()) for i in range(3) for j in range(3)), 'condition inverse residual')
    def norm(matrix):
        maximum = f.zero()
        for row in matrix:
            total = f.zero()
            for value in row: total = f.add(total, f.absolute(value))
            if f.less(maximum, total): maximum = total
        return maximum
    condition = f.mul(norm(schur), norm(inverse))
    require(not f.less(f.literal('4096'), condition), 'independent condition4096 gate')
    return {'matrix': schur, 'inverse': inverse, 'infinityCondition': condition}


def exact_observables(state, mass, constraint, before, after, multipliers, f):
    momentum_before = [f.dot(row, before) for row in mass]
    momentum_after = [f.dot(row, after) for row in mass]
    delta = [f.sub(a, b) for a, b in zip(after, before)]
    impulses = [f.dot(row, delta) for row in mass]
    half = f.literal('1/2')
    p_before = [f.add(momentum_before[i], momentum_before[i + 3]) for i in range(3)]
    p_after = [f.add(momentum_after[i], momentum_after[i + 3]) for i in range(3)]
    def angular(momentum):
        point_orbital = f.cross(state['xp'], momentum[:3])
        body_orbital = f.cross(state['xb'], momentum[3:6])
        return [f.add(f.add(point_orbital[i], body_orbital[i]), momentum[i + 6]) for i in range(3)]
    l_before, l_after = angular(momentum_before), angular(momentum_after)
    energy_before = f.mul(half, f.dot(before, momentum_before))
    energy_after = f.mul(half, f.dot(after, momentum_after))
    kinetic_change = f.sub(energy_after, energy_before)
    work = f.mul(half, f.dot([f.add(a, b) for a, b in zip(after, before)], impulses))
    objective = f.mul(half, f.dot(delta, impulses))
    relative_before = [f.dot(row, before) for row in constraint]
    relative_after = [f.dot(row, after) for row in constraint]
    torque_check = f.cross(state['worldArm'], impulses[:3])
    require(all(value.numerator == 0 for value in relative_after), 'exact attachment velocity residual')
    require(p_before == p_after and l_before == l_after, 'exact linear/angular momentum balance')
    require(kinetic_change == work and f.add(kinetic_change, objective).numerator == 0, 'exact work/kinetic projection identity')
    require(not f.less(objective, f.zero()), 'negative exact dissipation')
    require(all(f.add(impulses[i], impulses[i + 3]).numerator == 0 and
                f.add(impulses[i + 6], torque_check[i]).numerator == 0 for i in range(3)), 'exact reaction signs')
    return {'velocityPointMps': after[:3], 'velocityRigidMps': after[3:6], 'angularVelocityRigidRadps': after[6:9],
            'kktMultiplierNs': multipliers, 'impulseOnClothNs': impulses[:3],
            'linearImpulseOnRigidNs': impulses[3:6], 'angularImpulseOnRigidNms': impulses[6:9],
            'relativeVelocityBeforeMps': relative_before, 'relativeVelocityAfterMps': relative_after,
            'linearMomentumBeforeKgMps': p_before, 'linearMomentumAfterKgMps': p_after,
            'angularMomentumBeforeKgM2ps': l_before, 'angularMomentumAfterKgM2ps': l_after,
            'kineticEnergyBeforeJ': energy_before, 'kineticEnergyAfterJ': energy_after,
            'kineticChangeJ': kinetic_change, 'constraintImpulseWorkJ': work,
            'minimumMassMetricObjectiveJ': objective, 'dissipatedEnergyJ': f.neg(kinetic_change)}


class DecimalArithmetic:
    def __init__(self, audit): self.audit = audit

    def checked(self, value):
        require(type(value) is Decimal and value.is_finite(), 'nonfinite Decimal reference')
        digits = len(value.as_tuple().digits)
        self.audit.max_decimal_digits = max(self.audit.max_decimal_digits, digits)
        require(digits <= MAX_DECIMAL_DIGITS, 'Decimal coefficient working-data bound')
        return value

    def literal(self, text):
        n, d = raw_parts(text)
        return self.div(self.checked(Decimal(n)), self.checked(Decimal(d)))

    def from_fraction(self, value):
        require(value.numerator.bit_length() <= STORED_BITS and value.denominator.bit_length() <= STORED_BITS, 'Fraction conversion bound')
        return self.div(self.checked(Decimal(str(value.numerator))), self.checked(Decimal(str(value.denominator))))

    def zero(self): return self.checked(Decimal(0))
    def one(self): return self.checked(Decimal(1))
    def add(self, a, b):
        self.checked(a); self.checked(b); self.audit.counts['decimalArithmetic'] += 1
        return self.checked(a + b)
    def sub(self, a, b):
        self.checked(a); self.checked(b); self.audit.counts['decimalArithmetic'] += 1
        return self.checked(a - b)
    def mul(self, a, b):
        self.checked(a); self.checked(b); self.audit.counts['decimalArithmetic'] += 1
        return self.checked(a * b)
    def div(self, a, b):
        self.checked(a); self.checked(b); require(not b.is_zero(), 'unexpected Decimal zero divisor')
        self.audit.counts['decimalArithmetic'] += 1
        return self.checked(a / b)
    def neg(self, a):
        self.checked(a); self.audit.counts['decimalArithmetic'] += 1
        return self.checked(-a)
    def absolute(self, a):
        self.checked(a)
        return self.checked(a.copy_abs())
    def dot(self, a, b):
        require(len(a) == len(b), 'Decimal dot shape')
        result = self.zero()
        for index in range(len(a)): result = self.add(result, self.mul(a[index], b[index]))
        return result
    def cross(self, a, b):
        return [self.sub(self.mul(a[1], b[2]), self.mul(a[2], b[1])),
                self.sub(self.mul(a[2], b[0]), self.mul(a[0], b[2])),
                self.sub(self.mul(a[0], b[1]), self.mul(a[1], b[0]))]


def decimal_system(raw, d):
    # Separate Decimal builder. It reads original literals, not Fraction mass,
    # Jacobian, KKT coefficients or a condensed production matrix.
    point, body = raw['point'], raw['rigid']
    mp, mb = d.literal(point['massKg']), d.literal(body['massKg'])
    r = [[d.literal(x) for x in row] for row in body['rotationBodyToWorld']]
    diagonal = [d.literal(x) for x in body['principalInertiaKgM2']]
    local_arm = [d.literal(x) for x in body['endpoint']['anchorLocalM']]
    arm = [d.dot(row, local_arm) for row in r]
    tensor = []
    for i in range(3):
        row = []
        for j in range(3):
            value = d.zero()
            for k in range(3): value = d.add(value, d.mul(d.mul(r[i][k], diagonal[k]), r[j][k]))
            row.append(value)
        tensor.append(row)
    zero, one = d.zero(), d.one()
    rx, ry, rz = arm
    jacobian = [[one, zero, zero, d.neg(one), zero, zero, zero, d.neg(rz), ry],
                [zero, one, zero, zero, d.neg(one), zero, rz, zero, d.neg(rx)],
                [zero, zero, one, zero, zero, d.neg(one), d.neg(ry), rx, zero]]
    initial = [d.literal(x) for x in point['velocityMps'] + body['velocityMps'] + body['angularVelocityRadps']]
    matrix = [[d.zero() for _ in range(13)] for _ in range(12)]
    for i in range(9):
        for j in range(9):
            if i < 3 and i == j: matrix[i][j] = mp
            elif 3 <= i < 6 and i == j: matrix[i][j] = mb
            elif i >= 6 and j >= 6: matrix[i][j] = tensor[i - 6][j - 6]
        for j in range(3): matrix[i][j + 9] = jacobian[j][i]
        matrix[i][12] = d.dot(matrix[i][:9], initial)
    for i in range(3):
        for j in range(9): matrix[i + 9][j] = jacobian[i][j]
    return matrix, tensor, jacobian, initial, mp, mb, arm


def decimal_elimination(matrix, d):
    require(len(matrix) == 12 and all(len(row) == 13 for row in matrix), 'Decimal KKT dimensions')
    rows = [list(row) for row in matrix]
    for column in range(12):
        d.audit.detail = {'arithmetic': 'Decimal', 'matrixSize': 12, 'pivot': column}
        selected = column
        largest = d.absolute(rows[column][column])
        for index in range(column + 1, 12):
            magnitude = d.absolute(rows[index][column])
            if magnitude > largest: selected, largest = index, magnitude
        require(not largest.is_zero(), 'Decimal KKT singular')
        rows[column], rows[selected] = rows[selected], rows[column]
        pivot = rows[column][column]
        rows[column] = [d.div(cell, pivot) for cell in rows[column]]
        for index in range(12):
            if index == column: continue
            coefficient = rows[index][column]
            if coefficient.is_zero(): continue
            rows[index] = [d.sub(rows[index][j], d.mul(coefficient, rows[column][j])) for j in range(13)]
        d.audit.working(matrix, rows)
    return [row[12] for row in rows]


def decimal_observables(raw, tensor, jacobian, before, solution, mp, mb, d):
    after = solution[:9]
    def momenta(velocity):
        point = [d.mul(mp, x) for x in velocity[:3]]
        body = [d.mul(mb, x) for x in velocity[3:6]]
        spin = [d.dot(row, velocity[6:9]) for row in tensor]
        return point, body, spin
    p0, b0, s0 = momenta(before); p1, b1, s1 = momenta(after)
    jp = [d.sub(a, b) for a, b in zip(p1, p0)]
    jb = [d.sub(a, b) for a, b in zip(b1, b0)]
    js = [d.sub(a, b) for a, b in zip(s1, s0)]
    xp = [d.literal(x) for x in raw['point']['positionM']]
    xb = [d.literal(x) for x in raw['rigid']['comPositionM']]
    def angular(point, body, spin):
        pa, ba = d.cross(xp, point), d.cross(xb, body)
        return [d.add(d.add(pa[i], ba[i]), spin[i]) for i in range(3)]
    half = d.literal('1/2')
    e0 = d.mul(half, d.add(d.add(d.dot(before[:3], p0), d.dot(before[3:6], b0)), d.dot(before[6:9], s0)))
    e1 = d.mul(half, d.add(d.add(d.dot(after[:3], p1), d.dot(after[3:6], b1)), d.dot(after[6:9], s1)))
    impulses = jp + jb + js
    averages = [d.add(a, b) for a, b in zip(after, before)]
    changes = [d.sub(a, b) for a, b in zip(after, before)]
    return {'velocityPointMps': after[:3], 'velocityRigidMps': after[3:6], 'angularVelocityRigidRadps': after[6:9],
            'kktMultiplierNs': solution[9:12], 'impulseOnClothNs': jp, 'linearImpulseOnRigidNs': jb,
            'angularImpulseOnRigidNms': js,
            'relativeVelocityBeforeMps': [d.dot(row, before) for row in jacobian],
            'relativeVelocityAfterMps': [d.dot(row, after) for row in jacobian],
            'linearMomentumBeforeKgMps': [d.add(a, b) for a, b in zip(p0, b0)],
            'linearMomentumAfterKgMps': [d.add(a, b) for a, b in zip(p1, b1)],
            'angularMomentumBeforeKgM2ps': angular(p0, b0, s0), 'angularMomentumAfterKgM2ps': angular(p1, b1, s1),
            'kineticEnergyBeforeJ': e0, 'kineticEnergyAfterJ': e1, 'kineticChangeJ': d.sub(e1, e0),
            'constraintImpulseWorkJ': d.mul(half, d.dot(averages, impulses)),
            'minimumMassMetricObjectiveJ': d.mul(half, d.dot(changes, impulses)),
            'dissipatedEnergyJ': d.sub(e0, e1)}


def decimal_context(precision):
    result = Context(prec=precision, rounding=ROUND_HALF_EVEN, Emin=-999999, Emax=999999, capitals=1, clamp=0)
    for item in SIGNALS:
        result.flags[item] = False
        result.traps[item] = item in (InvalidOperation, DivisionByZero, Overflow, FloatOperation)
    return result


def context_report(context):
    return {'prec': context.prec, 'rounding': context.rounding, 'Emin': context.Emin, 'Emax': context.Emax,
            'capitals': context.capitals, 'clamp': context.clamp, 'signals': [x.__name__ for x in SIGNALS],
            'traps': [bool(context.traps[x]) for x in SIGNALS], 'flags': [bool(context.flags[x]) for x in SIGNALS]}


def decimal_reference(raw, precision, audit):
    prefix = 'decimal' + str(precision)
    audit.phase = prefix
    with localcontext(decimal_context(precision)) as context:
        d = DecimalArithmetic(audit)
        system, tensor, jacobian, before, mp, mb, arm = decimal_system(raw, d)
        audit.working(system, tensor, jacobian, before, raw)
        audit.counts[prefix + 'Attempted'] += 1
        require(audit.counts[prefix + 'Attempted'] <= 13, 'Decimal solve budget')
        solution = decimal_elimination(system, d)
        audit.counts[prefix + 'Returned'] += 1
        residual = [d.sub(d.dot(row[:12], solution), row[12]) for row in system]
        values = decimal_observables(raw, tensor, jacobian, before, solution, mp, mb, d)
        audit.working(system, tensor, jacobian, before, values, residual, raw)
        return {'values': values, 'kktAugmented': system, 'kktResidual': residual,
                'worldArmM': arm, 'context': context_report(context)}


def numeric_leaves(value, path='$'):
    if type(value) in (Fraction, Decimal):
        yield path, value
    elif type(value) is list:
        for i, item in enumerate(value): yield from numeric_leaves(item, path + '/' + str(i))
    elif type(value) is dict:
        for key, item in value.items(): yield from numeric_leaves(item, path + '/' + key)
    else:
        raise ReferenceFailure('unexpected numeric comparison tree')


def decimal_crosschecks(exact_values, low, high, low_residual, high_residual, audit):
    # Conversion of exact output n/d is not a third solve or adaptive precision.
    with localcontext(decimal_context(120)):
        d = DecimalArithmetic(audit)
        exact_rows, low_rows, high_rows = list(numeric_leaves(exact_values)), list(numeric_leaves(low)), list(numeric_leaves(high))
        require([x[0] for x in exact_rows] == [x[0] for x in low_rows] == [x[0] for x in high_rows], 'Decimal comparison tree shape')
        low_limit = d.literal('1/' + '1' + '0' * 60)
        high_limit = d.literal('1/' + '1' + '0' * 100)
        worst_low = worst_high = d.zero()
        for (path, exact), (_, lower), (_, higher) in zip(exact_rows, low_rows, high_rows):
            reference = d.from_fraction(exact)
            scale = max(d.one(), d.absolute(reference))
            err_low = d.div(d.absolute(d.sub(lower, higher)), scale)
            err_high = d.div(d.absolute(d.sub(higher, reference)), scale)
            require(err_low <= low_limit, 'Decimal80/120 gate at ' + path)
            require(err_high <= high_limit, 'Decimal120/Fraction gate at ' + path)
            worst_low, worst_high = max(worst_low, err_low), max(worst_high, err_high)
        require(all(d.absolute(x) <= low_limit for x in low_residual), 'Decimal80 full KKT residual gate')
        require(all(d.absolute(x) <= high_limit for x in high_residual), 'Decimal120 full KKT residual gate')
        return {'maxScaled80vs120': worst_low, 'maxScaled120vsFraction': worst_high,
                'limit80vs120': low_limit, 'limit120vsFraction': high_limit,
                'comparisonContext': context_report(getcontext())}


def encode_numbers(value):
    if type(value) is Fraction:
        return {'numerator': str(value.numerator), 'denominator': str(value.denominator)}
    if type(value) is Decimal:
        require(value.is_finite(), 'cannot serialize nonfinite Decimal reference')
        return {'decimal': str(value), 'sign': value.as_tuple().sign,
                'exponent': value.as_tuple().exponent, 'digits': ''.join(str(x) for x in value.as_tuple().digits)}
    if type(value) is list: return [encode_numbers(x) for x in value]
    if type(value) is dict: return {key: encode_numbers(x) for key, x in value.items()}
    return value


def instantiate(case, recipes, audit):
    raw = copy.deepcopy(recipes['literalBases'][case['base']])
    for patch in case['patches']:
        require(type(patch['path']) is list and 1 <= len(patch['path']) <= 4, 'patch path bound')
        owner = raw
        for part in patch['path'][:-1]:
            require(type(owner) is dict and part in owner, 'patch must target existing plain path')
            owner = owner[part]
        require(type(owner) is dict and patch['path'][-1] in owner, 'unknown patch field')
        owner[patch['path'][-1]] = copy.deepcopy(patch['value'])
    audit.counts['idealFixturesConstructed'] += 1
    audit.working(raw)
    return raw


def check_case_relations(case_id, values, f):
    zero = f.zero()
    if case_id in ('01-centered', '02-off-com-parallel'):
        require(all(value.numerator == 0 for value in values['angularImpulseOnRigidNms']), 'parallel/centered torque control')
    if case_id == '01-centered':
        require(any(value.numerator != 0 for value in values['impulseOnClothNs']) and
                any(value.numerator != 0 for value in values['linearImpulseOnRigidNs']), 'centered nonzero linear reaction control')
    if case_id == '02-off-com-parallel': require(f.less(values['impulseOnClothNs'][0], zero), 'parallel impulse sign')
    if case_id == '03-off-com-transverse':
        require(f.less(values['impulseOnClothNs'][1], zero) and f.less(zero, values['angularImpulseOnRigidNms'][2]), 'off-COM reaction sign control')
    if case_id in ('05-compatible-moving-state', '12-negative-zero-input', '13-positive-zero-input'):
        require(all(value.numerator == 0 for value in values['relativeVelocityBeforeMps']) and
                all(value.numerator == 0 for value in values['impulseOnClothNs']) and
                values['dissipatedEnergyJ'].numerator == 0, 'compatible velocity zero-impulse control')


def accepted_reference(raw, state, case, audit):
    f = ExactArithmetic(audit)
    audit.phase = 'independent-full-physical-blocks'
    mass, constraint, before, system = exact_physical_blocks(state, f)
    audit.working(raw, state, mass, constraint, before, system)
    audit.phase = 'exact-12x12-kkt'
    audit.counts['exactKktAttempted'] += 1
    require(audit.counts['exactKktAttempted'] <= 13, 'exact KKT budget')
    columns = exact_elimination(system, 12, 1, f)
    solution = [row[0] for row in columns]
    audit.counts['exactKktReturned'] += 1
    residual = [f.sub(f.dot(row[:12], solution), row[12]) for row in system]
    require(all(value.numerator == 0 for value in residual), 'exact full KKT residual')
    values = exact_observables(state, mass, constraint, before, solution[:9], solution[9:12], f)
    check_case_relations(case['id'], values, f)
    audit.phase = 'independent-condition-only'
    condition = exact_condition(state, constraint, f)
    low = decimal_reference(raw, 80, audit)
    high = decimal_reference(raw, 120, audit)
    audit.phase = 'crosscheck-reference-values'
    comparison = decimal_crosschecks(values, low['values'], high['values'], low['kktResidual'], high['kktResidual'], audit)
    audit.working(raw, state, system, values, condition, low, high, comparison)
    return {'fraction': {'values': values, 'kktAugmented': system, 'kktResidual': residual,
                         'massMatrix9x9': mass, 'constraint3x9': constraint, 'worldArmM': state['worldArm'],
                         'conditionOnly': condition}, 'decimal80': low, 'decimal120': high, 'crosschecks': comparison}


def authenticate(freeze_path, token):
    raw = read_bound(freeze_path)
    require(re.fullmatch('[0-9a-f]{64}', token) and hmac.compare_digest(sha(raw), token), 'explicit parent execution token differs')
    freeze = strict_json(raw)
    require(freeze.get('status') == 'PARENT_AUTHORIZED_IMPULSE_ORACLE_EXECUTION' and
            freeze.get('runtimeAuthorized') is True and freeze.get('p5Closed') is True, 'authoring is not numerical execution authorization')
    needed = set(PINS) | {'oracle.py'}
    require(type(freeze.get('inputs')) is dict and needed <= set(freeze['inputs']), 'complete frozen oracle inputs required')
    require(set(freeze['inputs']) <= needed | {'ORACLE-AUTHOR-READY.json'}, 'unknown frozen oracle input path')
    observed = {}
    for name in freeze['inputs']:
        path = HERE / name; pin = freeze['inputs'][name]; data = read_bound(path)
        require(type(pin.get('bytes')) is int and len(data) == pin['bytes'] and sha(data) == pin['sha256'], 'execution input byte/hash mismatch: ' + name)
        if name in PINS:
            count, digest = PINS[name]
            require(sha(data) == digest and (count is None or count == len(data)), 'immutable authoring input changed: ' + name)
        observed[name] = {'bytes': len(data), 'sha256': sha(data)}
    cases = strict_json(read_bound(HERE / 'CASES.json'))
    require(len(cases['acceptedCases']) == 13 and len(cases['refusalCases']) == 10 and len(cases['faultCases']) == 2, 'frozen population differs')
    require(cases['aggregateCeilings']['referenceRequests'] == 23 and cases['aggregateCeilings']['exactKktFactorizations12x12'] == 13 and
            cases['aggregateCeilings']['exactConditionFactorizations3x3'] == 13 and cases['aggregateCeilings']['decimalKkt80'] == 13 and
            cases['aggregateCeilings']['decimalKkt120'] == 13, 'reference budget mismatch')
    return cases, {'freezePath': str(freeze_path), 'freezeSha256': token, 'inputs': observed,
                   'p5ClosedParentAttestation': True, 'runtimeAuthorizedParentAttestation': True,
                   'pythonExecutable': str(Path(sys.executable).resolve()), 'pythonVersion': sys.version,
                   'projectNumericalImports': 0}


def run(run_id, freeze_path, token):
    require(re.fullmatch('[a-z0-9][a-z0-9-]{0,95}', run_id), 'invalid fresh reference run ID')
    started = time.monotonic_ns()
    def deadline(_signum, _frame):
        raise ReferenceFailure('170s private impulse reference deadline')
    previous = signal.signal(signal.SIGALRM, deadline); signal.setitimer(signal.ITIMER_REAL, 170)
    try:
        recipes, provenance = authenticate(freeze_path, token)
        out = HERE / 'evidence' / run_id
        out.mkdir(parents=True, exist_ok=False)
    except BaseException:
        signal.setitimer(signal.ITIMER_REAL, 0); signal.signal(signal.SIGALRM, previous)
        raise
    audit = Accounting(); stored = 0
    summary = {'workId': 'physics-cloth-rigid-impulse-2276', 'runId': run_id, 'status': 'IN_PROGRESS',
               'provenance': provenance, 'counts': audit.counts, 'replies': [], 'firstFailure': None,
               'candidateExecution': 'NOT_RUN_BY_ORACLE', 'WorldCalls': 0,
               'signedZeroAuthority': 'raw ideal spellings retained; Fraction numerical zero predicts no native zero sign',
               'nativeRounding': 'ideal rational reference; no native fixture conversion or binary64 output authority is manufactured'}
    def write(name, value, reserved=False):
        nonlocal stored
        data = json_bytes(value)
        require(len(data) <= MIB, 'one reference artifact1MiB bound')
        limit = EVIDENCE_MAX if reserved else EVIDENCE_MAX - RESERVED_EVIDENCE
        require(stored + len(data) + 8192 <= limit, 'reference evidence8MiB bound')
        with (out / name).open('xb') as stream: stream.write(data)
        stored += len(data)
        return {'path': name, 'bytes': len(data), 'sha256': sha(data)}
    def progress():
        data = json_bytes({'status': summary['status'], 'counts': audit.counts,
                           'caseId': audit.case_id, 'phase': audit.phase, 'firstFailure': summary['firstFailure']})
        require(len(data) <= 8192 and stored + len(data) <= EVIDENCE_MAX, 'bounded progress receipt')
        (out / 'progress.json').write_bytes(data)
    try:
        zero_solution = None
        for case in recipes['acceptedCases'] + recipes['refusalCases']:
            before_counts = dict(audit.counts)
            audit.case_id = case['id']; audit.phase = 'request-preflight'
            audit.counts['requestsAttempted'] += 1
            require(audit.counts['requestsAttempted'] <= 23, 'reference request budget23')
            progress()
            raw = instantiate(case, recipes, audit)
            before_raw = json_bytes(raw)
            write(case['id'] + '.ideal-input.json', raw)
            reason, state = classify(raw, ExactArithmetic(audit))
            if case['expected'] == 'private-input-error':
                require(reason == case['reason'], 'reference refusal classification differs: ' + str(reason))
                require(all(audit.counts[name] == before_counts[name] for name in
                            ('exactKktAttempted', 'exactConditionAttempted', 'decimal80Attempted', 'decimal120Attempted')),
                        'refused reference performed a factorization')
                audit.counts['expectedRefusals'] += 1
                reply = {'status': 'EXPECTED_REFUSAL', 'caseId': case['id'], 'code': 'INVALID_INPUT', 'reason': reason,
                         'rawIdealInput': raw, 'referenceSolves': 0}
            else:
                require(reason is None, 'normal literal plant refused: ' + str(reason))
                result = accepted_reference(raw, state, case, audit)
                if case['id'] == '12-negative-zero-input': zero_solution = copy.deepcopy(result['fraction']['values'])
                if case['id'] == '13-positive-zero-input':
                    require(zero_solution == result['fraction']['values'], 'signed-zero physical equivalence differs')
                audit.counts['acceptedReferences'] += 1
                reply = {'status': 'ACCEPTED_REFERENCE', 'caseId': case['id'], 'rawIdealInput': raw,
                         'reference': encode_numbers(result), 'equationModel': 'independent12x12 full kinetic KKT',
                         'nativeZeroSigns': 'NOT_PREDICTED_BY_FRACTION', 'nativeRounding': summary['nativeRounding']}
            require(json_bytes(raw) == before_raw, 'reference mutated literal input')
            audit.phase = 'write-complete-reply'
            reply['provenance'] = provenance
            reply['rawIdealInputSha256'] = sha(before_raw)
            reply['units'] = recipes['reference']['units']
            reply['reactionSigns'] = recipes['reference']['signs']
            reply['angularMomentumOriginM'] = recipes['reference']['originM']
            reply['countDeltaBeforeReplyCommit'] = {key: audit.counts[key] - before_counts[key] for key in audit.counts}
            audit.working(raw, reply)
            summary['replies'].append(write(case['id'] + '.reply.json', reply))
            audit.counts['requestsReturned'] += 1
            progress()
        require(audit.counts['requestsAttempted'] == audit.counts['requestsReturned'] == 23 and
                audit.counts['acceptedReferences'] == 13 and audit.counts['expectedRefusals'] == 10,
                'incomplete reference request population')
        for prefix in ('exactKkt', 'exactCondition', 'decimal80', 'decimal120'):
            require(audit.counts[prefix + 'Attempted'] == audit.counts[prefix + 'Returned'] == 13, 'incomplete factorization ledger: ' + prefix)
        authenticate(freeze_path, token)
        summary['status'] = 'PASS_INDEPENDENT_IMPULSE_ORACLE'
    except BaseException as error:
        summary['status'] = 'FAIL'
        summary['firstFailure'] = {'type': type(error).__name__, 'message': str(error)[:4096], 'caseId': audit.case_id,
                                   'phase': audit.phase, 'counts': dict(audit.counts), 'offending': audit.offending}
        summary['firstFailure']['detail'] = audit.detail
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0); signal.signal(signal.SIGALRM, previous)
        summary['elapsedWallNs'] = time.monotonic_ns() - started
        summary['workingData'] = {'peakConservativeAllocationSumPlusReserveBytes': audit.peak_work_sum,
                                  'limitBytes': WORK_MAX, 'RSSClaim': False,
                                  'maxStoredFractionBits': audit.max_stored_bits,
                                  'maxEstimatedIntermediateProductBits': audit.max_product_bits,
                                  'maxEstimatedIntermediateSumBits': audit.max_sum_bits,
                                  'maxDecimalCoefficientDigits': audit.max_decimal_digits}
        summary['exactFactorizations'] = audit.counts['exactKktAttempted'] + audit.counts['exactConditionAttempted']
        summary['decimalFactorizations'] = audit.counts['decimal80Attempted'] + audit.counts['decimal120Attempted']
        summary['chargedEvidenceBytesBeforeSummary'] = stored
        progress(); write('summary.json', summary, reserved=True)
    print(json.dumps({'status': summary['status'], 'runId': run_id, 'counts': audit.counts,
                      'firstFailure': summary['firstFailure']}, separators=(',', ':')))
    return 0 if summary['status'] == 'PASS_INDEPENDENT_IMPULSE_ORACLE' else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-id', required=True)
    parser.add_argument('--freeze', type=Path, required=True)
    parser.add_argument('--token', required=True)
    arguments = parser.parse_args()
    sys.exit(run(arguments.run_id, arguments.freeze.resolve(), arguments.token))
