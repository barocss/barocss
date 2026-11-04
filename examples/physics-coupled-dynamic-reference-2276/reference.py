#!/usr/bin/env python3
"""Independent physical reference. AUTHOR MUST NOT EXECUTE.

No engine/candidate/old-reference imports. Read CONTRACT.md before root execution.
"""
from decimal import (Decimal, localcontext, ROUND_FLOOR, ROUND_CEILING,
                     Overflow, InvalidOperation, DivisionByZero)
from fractions import Fraction as F
from hashlib import sha256
from itertools import product
from pathlib import Path
import json
import math
import re
import struct
import sys
import time

HOME = Path(__file__).resolve().parent
INPUT = HOME.parent / 'physics-persistent-cone-design-2276/evidence/model-01'
CAPS = {'splits': 4096, 'terminalCells': 2048, 'depth': 128,
        'intervalSolves': 32768, 'exactSolves': 32768, 'fractionBits': 16384,
        'seconds': 180, 'outputBytes': 16 * 1024 * 1024}
PRECISIONS = (80, 120)
START = None
ACTIVE = None
PRECISION = 80


class NoGo(Exception):
    pass


class Pivot(NoGo):
    pass


class Pending(NoGo):
    """Only root-refinement-resolvable uncertainty; never hides another error."""


def need(value, reason):
    if not value:
        raise NoGo(reason)


def clock_check():
    if START is not None:
        need(time.monotonic() - START < CAPS['seconds'], 'REFERENCE_TIME_CAP')


class Budget:
    def __init__(self):
        self.used = {name: 0 for name in ('splits', 'terminalCells', 'intervalSolves', 'exactSolves')}
        self.max_depth = 0
        self.max_bits = 0
        self.pivot_refusals = 0

    def charge(self, name):
        clock_check()
        self.used[name] += 1
        need(self.used[name] <= CAPS[name], 'REFERENCE_CAP_' + name)

    def depth(self, value):
        self.max_depth = max(self.max_depth, value)
        need(value <= CAPS['depth'], 'REFERENCE_CAP_depth')

    def report(self):
        return dict(self.used, maxDepth=self.max_depth, maxFractionBits=self.max_bits,
                    zeroContainingPivotAttempts=self.pivot_refusals)


def q(value):
    clock_check()
    value = F.from_float(value) if isinstance(value, float) else F(value)
    bits = max(value.numerator.bit_length(), value.denominator.bit_length())
    need(bits <= CAPS['fractionBits'], 'REFERENCE_FRACTION_BITS')
    if ACTIVE is not None:
        ACTIVE.max_bits = max(ACTIVE.max_bits, bits)
    return value


def qm(a, b):
    a, b = q(a), q(b)
    need(a.numerator.bit_length() + b.numerator.bit_length() <= CAPS['fractionBits'] and
         a.denominator.bit_length() + b.denominator.bit_length() <= CAPS['fractionBits'],
         'REFERENCE_PROPOSED_PRODUCT_BITS')
    return q(a * b)


def qa(a, b):
    a, b = q(a), q(b)
    # Include both unreduced cross-products and the sum before Fraction reduces it.
    need(a.numerator.bit_length() + b.denominator.bit_length() <= CAPS['fractionBits'] and
         b.numerator.bit_length() + a.denominator.bit_length() <= CAPS['fractionBits'] and
         a.denominator.bit_length() + b.denominator.bit_length() <= CAPS['fractionBits'],
         'REFERENCE_PROPOSED_SUM_PRODUCT_BITS')
    an, bn = a.numerator * b.denominator, b.numerator * a.denominator
    den = a.denominator * b.denominator
    # Adding two already bounded products can use one extra temporary bit.
    # Reject that sum before constructing or storing a reduced Fraction.
    need(max(abs(an).bit_length(), abs(bn).bit_length(), abs(an + bn).bit_length(),
             den.bit_length()) <= CAPS['fractionBits'], 'REFERENCE_PROPOSED_SUM_BITS')
    return q(F(an + bn, den))


def qd(a, b):
    b = q(b)
    need(b != 0, 'REFERENCE_EXACT_ZERO_DIVISION')
    return qm(a, F(b.denominator, b.numerator))


def qs(a, b):
    return qa(a, -q(b))


def rat(value):
    value = q(value)
    return {'n': str(value.numerator), 'd': str(value.denominator)}


def rv(values):
    return [rat(x) for x in values]


def word(value):
    return struct.pack('>d', float(value)).hex()


def words(values):
    return [word(x) for x in values]


def dot(a, b):
    value = q(0)
    for x, y in zip(a, b):
        value = qa(value, qm(x, y))
    return value


def va(a, b):
    return [qa(x, y) for x, y in zip(a, b)]


def vs(a, b):
    return [qs(x, y) for x, y in zip(a, b)]


def vm(a, scale):
    return [qm(x, scale) for x in a]


def cross(a, b):
    return [qs(qm(a[1], b[2]), qm(a[2], b[1])),
            qs(qm(a[2], b[0]), qm(a[0], b[2])),
            qs(qm(a[0], b[1]), qm(a[1], b[0]))]


def hamilton(a, b):
    return va(va(vm(b[:3], a[3]), vm(a[:3], b[3])), cross(a[:3], b[:3])) + [
        qs(qm(a[3], b[3]), dot(a[:3], b[:3]))]


def axes_from_actual_quaternion(quaternion):
    norm2 = dot(quaternion, quaternion)
    need(norm2 > 0, 'REFERENCE_ZERO_QUATERNION')
    conjugate = [-quaternion[0], -quaternion[1], -quaternion[2], quaternion[3]]
    axes = []
    for k in range(3):
        basis = [q(int(i == k)) for i in range(3)] + [q(0)]
        axes.append(vm(hamilton(hamilton(quaternion, basis), conjugate)[:3], qd(1, norm2)))
    for i in range(3):
        for j in range(3):
            need(dot(axes[i], axes[j]) == int(i == j), 'REFERENCE_NATIVE_ORTHONORMALITY')
    return axes


def vertices(center, half, axes):
    result = []
    for signs in product((-1, 1), repeat=3):
        point = list(center)
        for k in range(3):
            point = va(point, vm(axes[k], qm(signs[k], half[k])))
        result.append(point)
    return result


def exact_solve(matrix, rhs):
    ACTIVE.charge('exactSolves')
    rows = [list(row) + [v] for row, v in zip(matrix, rhs)]
    pivots = []
    for k in range(3):
        pivot = next((i for i in range(k, 3) if rows[i][k]), None)
        need(pivot is not None, 'REFERENCE_SINGULAR_EXACT_PHYSICAL_SYSTEM')
        rows[k], rows[pivot] = rows[pivot], rows[k]
        p = rows[k][k]
        pivots.append(rat(p))
        rows[k] = [qd(x, p) for x in rows[k]]
        for i in range(3):
            if i != k:
                factor = rows[i][k]
                rows[i] = [qs(x, qm(factor, y)) for x, y in zip(rows[i], rows[k])]
    return [row[3] for row in rows], pivots


def rounded(operation, mode):
    clock_check()
    with localcontext() as ctx:
        ctx.prec = PRECISION
        ctx.rounding = mode
        ctx.Emin, ctx.Emax = -999999, 999999
        for trap in (Overflow, InvalidOperation, DivisionByZero):
            ctx.traps[trap] = True
        result = operation()
    need(result.is_finite(), 'REFERENCE_NONFINITE_DECIMAL')
    return result


class I:
    __slots__ = ('lo', 'hi')

    def __init__(self, value=0, upper=None):
        if upper is not None:
            self.lo, self.hi = value, upper
        elif isinstance(value, I):
            self.lo, self.hi = value.lo, value.hi
        else:
            value = q(value)
            self.lo = rounded(lambda: Decimal(value.numerator) / Decimal(value.denominator), ROUND_FLOOR)
            self.hi = rounded(lambda: Decimal(value.numerator) / Decimal(value.denominator), ROUND_CEILING)
        need(self.lo <= self.hi, 'REFERENCE_INTERVAL_ORDER')

    @staticmethod
    def span(a, b):
        return I(I(a).lo, I(b).hi)

    def __add__(self, other):
        b = I(other)
        return I(rounded(lambda: self.lo + b.lo, ROUND_FLOOR),
                 rounded(lambda: self.hi + b.hi, ROUND_CEILING))

    __radd__ = __add__

    def __neg__(self):
        # Decimal unary minus rounds in the ambient context. copy_negate does not.
        return I(self.hi.copy_negate(), self.lo.copy_negate())

    def __sub__(self, other):
        return self + (-I(other))

    def __rsub__(self, other):
        return I(other) - self

    def __mul__(self, other):
        b = I(other)
        pairs = [(x, y) for x in (self.lo, self.hi) for y in (b.lo, b.hi)]
        lows = [rounded(lambda x=x, y=y: x * y, ROUND_FLOOR) for x, y in pairs]
        highs = [rounded(lambda x=x, y=y: x * y, ROUND_CEILING) for x, y in pairs]
        return I(min(lows), max(highs))

    __rmul__ = __mul__

    def __truediv__(self, other):
        b = I(other)
        if b.contains_zero():
            raise Pivot('REFERENCE_ZERO_CONTAINING_DIVISOR')
        pairs = [(x, y) for x in (self.lo, self.hi) for y in (b.lo, b.hi)]
        lows = [rounded(lambda x=x, y=y: x / y, ROUND_FLOOR) for x, y in pairs]
        highs = [rounded(lambda x=x, y=y: x / y, ROUND_CEILING) for x, y in pairs]
        return I(min(lows), max(highs))

    def square(self):
        if self.lo >= 0:
            return I(rounded(lambda: self.lo * self.lo, ROUND_FLOOR),
                     rounded(lambda: self.hi * self.hi, ROUND_CEILING))
        if self.hi <= 0:
            return (-self).square()
        high = max(rounded(lambda: self.lo * self.lo, ROUND_CEILING),
                   rounded(lambda: self.hi * self.hi, ROUND_CEILING))
        return I(Decimal(0), high)

    def sqrt(self):
        need(self.lo >= 0, 'REFERENCE_NEGATIVE_SQRT')
        if self.hi == 0:
            return I(0)
        with localcontext() as ctx:
            ctx.prec = PRECISION
            ctx.Emin, ctx.Emax = -999999, 999999
            low = self.lo.sqrt(context=ctx)
            high = self.hi.sqrt(context=ctx)
            if low != 0:
                low = low.next_minus(context=ctx)
            high = high.next_plus(context=ctx)
        # Exact integer/rational inequalities certify both sides, independently
        # of Decimal.sqrt's rounding behavior. No neighbor loop is permitted.
        need(qm(F(low), F(low)) <= q(F(self.lo)) and
             qm(F(high), F(high)) >= q(F(self.hi)), 'REFERENCE_SQRT_ENCLOSURE')
        return I(low, high)

    def contains_zero(self):
        return self.lo <= 0 <= self.hi

    def sign(self):
        return 1 if self.lo > 0 else -1 if self.hi < 0 else 0

    def abs_upper(self):
        return max(self.lo.copy_abs(), self.hi.copy_abs())

    def data(self):
        return {'lo': str(self.lo), 'hi': str(self.hi)}


def idot(a, b):
    value = I(0)
    for x, y in zip(a, b):
        value = value + I(x) * I(y)
    return value


def interval_solve(matrix, rhs):
    ACTIVE.charge('intervalSolves')
    rows = [[I(x) for x in row] + [I(v)] for row, v in zip(matrix, rhs)]
    pivots = []
    for k in range(3):
        p = rows[k][k]
        if p.contains_zero():
            ACTIVE.pivot_refusals += 1
            raise Pivot('REFERENCE_INTERVAL_PIVOT_' + str(k))
        pivots.append(p.data())
        rows[k] = [x / p for x in rows[k]]
        for i in range(3):
            if i != k:
                factor = rows[i][k]
                rows[i] = [x - factor * y for x, y in zip(rows[i], rows[k])]
    return [row[3] for row in rows], pivots


def physical_system(K, u, s, interval):
    scalar = I if interval else q
    rows, rhs = [], []
    for i in range(3):
        if i == 0:
            rows.append([scalar(x) for x in K[0]])
            rhs.append(-scalar(u[0]))
        elif interval:
            rows.append([s * K[i][j] + (1 - s) * int(i == j) for j in range(3)])
            rhs.append(-s * u[i])
        else:
            rows.append([qa(qm(s, K[i][j]), qm(qs(1, s), int(i == j))) for j in range(3)])
            rhs.append(-qm(s, u[i]))
    return rows, rhs


def exact_point(K, u, qD, s):
    matrix, rhs = physical_system(K, u, s, False)
    x, _ = exact_solve(matrix, rhs)
    g = qs(qa(qm(x[1], x[1]), qm(x[2], x[2])), qm(qD, qm(x[0], x[0])))
    return (g > 0) - (g < 0), x, g


def interval_state(K, u, qD, a, b, derivative=True):
    s = I.span(a, b)
    matrix, rhs = physical_system(K, u, s, True)
    x, pivots = interval_solve(matrix, rhs)
    g = x[1].square() + x[2].square() - I(qD) * x[0].square()
    gp = None
    dpivots = []
    if derivative:
        prime_rhs = [I(0)]
        for i in (1, 2):
            prime_rhs.append(-I(u[i]) - idot([qs(K[i][j], int(i == j)) for j in range(3)], x))
        xp, dpivots = interval_solve(matrix, prime_rhs)
        gp = 2 * (x[1] * xp[1] + x[2] * xp[2] - I(qD) * x[0] * xp[0])
    return {'x': x, 'g': g, 'gp': gp, 'pivots': pivots, 'derivativePivots': dpivots}


def root_coverage(K, u, qD):
    stack = [(q(0), q(1), 0)]
    leaves = []
    crossings = []
    point_cache = {}

    def sign_at(s):
        if s not in point_cache:
            sign, _, value = exact_point(K, u, qD, s)
            need(sign != 0, 'REFERENCE_ENDPOINT_ROOT')
            point_cache[s] = (sign, rat(value))
        return point_cache[s]

    while stack:
        clock_check()
        a, b, depth = stack.pop()
        ACTIVE.depth(depth)
        record = {'a': rat(a), 'b': rat(b), 'depth': depth}
        solved = None
        try:
            solved = interval_state(K, u, qD, a, b)
        except Pivot:
            pass
        reason = None
        if solved is not None:
            record.update(g=solved['g'].data(), derivative=solved['gp'].data(),
                          pivots=solved['pivots'], derivativePivots=solved['derivativePivots'])
            if solved['g'].sign():
                reason = 'G_EXCLUDES_ZERO'
            elif solved['gp'].sign():
                sa, ga = sign_at(a)
                sb, gb = sign_at(b)
                record.update(endpointSigns=[sa, sb], endpointG=[ga, gb])
                if sa == sb:
                    reason = 'STRICT_DERIVATIVE_SAME_ENDPOINT_SIGN'
                else:
                    need((sb - sa) * solved['gp'].sign() > 0, 'REFERENCE_DERIVATIVE_SIGN_CONFLICT')
                    reason = 'UNIQUE_CROSSING'
                    crossings.append((a, b, depth, sa, sb))
        if reason:
            ACTIVE.charge('terminalCells')
            record['reason'] = reason
            leaves.append(record)
        else:
            need(depth < CAPS['depth'], 'REFERENCE_COVERAGE_DEPTH')
            ACTIVE.charge('splits')
            mid = qd(qa(a, b), 2)
            stack.append((mid, b, depth + 1))
            stack.append((a, mid, depth + 1))
    need(len(crossings) == 1, 'REFERENCE_PHYSICAL_ROOT_COUNT_' + str(len(crossings)))
    cursor = q(0)
    for leaf in leaves:
        a, b = (F(int(leaf[k]['n']), int(leaf[k]['d'])) for k in ('a', 'b'))
        need(a == cursor and a < b, 'REFERENCE_DOMAIN_COVERAGE_GAP')
        cursor = b
    need(cursor == 1, 'REFERENCE_DOMAIN_COVERAGE_INCOMPLETE')
    return crossings[0], leaves


def rne_cell(value):
    # The proposed float is not authority. Exact midpoint membership is.
    mid = qd(qa(q(F(value.lo)), q(F(value.hi))), 2)
    proposed = float(mid)
    need(math.isfinite(proposed), 'REFERENCE_RNE_NONFINITE')
    lower = math.nextafter(proposed, -math.inf)
    upper = math.nextafter(proposed, math.inf)
    need(math.isfinite(lower) and math.isfinite(upper), 'REFERENCE_RNE_BOUNDARY')
    left = qd(qa(q(lower), q(proposed)), 2)
    right = qd(qa(q(proposed), q(upper)), 2)
    even = int(word(proposed), 16) % 2 == 0
    lo, hi = q(F(value.lo)), q(F(value.hi))
    fits = (lo > left or (lo == left and even)) and (hi < right or (hi == right and even))
    if not fits:
        raise Pending('REFERENCE_RNE_AMBIGUOUS')
    return {'word': word(proposed), 'value': proposed, 'even': even,
            'midpointLower': rat(left), 'midpointUpper': rat(right),
            'idealEnclosure': value.data()}


def enclosure_vector(values):
    return [v.data() for v in values]


def tolerance(value, limit, reason, refine=False):
    if value.abs_upper() > I(limit).lo:
        if refine:
            raise Pending(reason)
        raise NoGo(reason)


def physical_certificate(case, state, dynamic):
    frame, Kworld, u, qD = case['frame'], case['Kworld'], case['velocity'], case['qD']
    x = state['x']
    J = [idot([frame[k][j] for k in range(3)], x) for j in range(3)]
    T = [idot([frame[k][j] for k in (1, 2)], x[1:]) for j in range(3)]
    final = [I(u[i]) + idot(Kworld[i], J) for i in range(3)]
    native_final = [idot(axis, final) for axis in frame]
    work = idot(J, [I(u[i]) + final[i] for i in range(3)]) / 2
    need(x[0].lo > 0, 'REFERENCE_NONPOSITIVE_LOAD')
    need(native_final[0].contains_zero(), 'REFERENCE_IDEAL_NORMAL_ZERO_NOT_ENCLOSED')
    tolerance(native_final[0], F(1, 10**10), 'REFERENCE_IDEAL_NORMAL_WIDTH', True)
    if dynamic:
        slip = (native_final[1].square() + native_final[2].square()).sqrt()
        if slip.lo <= I(F(1, 10**10)).hi:
            raise Pending('REFERENCE_POSITIVE_SLIP_UNPROVED')
        mu = I(qD).sqrt()
        cone = (x[1].square() + x[2].square()).sqrt() - mu * x[0]
        opposition = [x[i] + mu * x[0] * native_final[i] / slip for i in (1, 2)]
        tolerance(cone, F(1, 10**12), 'REFERENCE_IDEAL_CONE_WIDTH', True)
        for residual in opposition:
            tolerance(residual, F(1, 10**12), 'REFERENCE_IDEAL_OPPOSITION_WIDTH', True)
    else:
        slip = (native_final[1].square() + native_final[2].square()).sqrt()
        cone, opposition = None, []
    if work.hi > 0:
        raise Pending('REFERENCE_IDEAL_PASSIVITY_UNPROVED')
    presentation = {'worldJ': [rne_cell(v) for v in J], 'nativeNTS': [rne_cell(v) for v in x],
                    'worldT': [rne_cell(v) for v in T]}
    pj = [q(v['value']) for v in presentation['worldJ']]
    pn = q(presentation['nativeNTS'][0]['value'])
    pt = [q(v['value']) for v in presentation['worldT']]
    represented_final = va(u, [dot(row, pj) for row in Kworld])
    represented_native = [dot(axis, represented_final) for axis in frame]
    represented_work = qd(dot(pj, va(u, represented_final)), 2)
    need(represented_work <= 0, 'REFERENCE_PRESENTED_PASSIVITY')
    for j, ideal in zip(pj, J):
        tolerance(I(j) - ideal, F(1, 10**12), 'REFERENCE_WORLD_J_ERROR', True)
    for entry, ideal in zip(presentation['nativeNTS'], x):
        tolerance(I(q(entry['value'])) - ideal, F(1, 10**12), 'REFERENCE_NATIVE_CACHE_ERROR', True)
    for component, ideal in zip(pt, T):
        tolerance(I(component) - ideal, F(1, 10**12), 'REFERENCE_WORLD_T_CACHE_ERROR', True)
    cache_reconstruction = va(vm(frame[0], pn), pt)
    for actual, reconstructed in zip(pj, cache_reconstruction):
        tolerance(I(qs(actual, reconstructed)), F(1, 10**12), 'REFERENCE_CACHE_WORLD_J_BINDING')
    tolerance(I(represented_native[0]), F(1, 10**10), 'REFERENCE_PRESENTED_NORMAL_SPEED')
    tolerance(I(dot(frame[0], pt)), F(1, 10**12), 'REFERENCE_PRESENTED_TANGENT_PLANE')
    # Cross-check final velocity from COM linear and angular responses, independently
    # of multiplying the stored Kworld matrix by the presented impulse.
    omega = vm(cross(case['arm'], pj), 6)
    direct_final = va(va(u, pj), cross(omega, case['arm']))
    need(direct_final == represented_final, 'REFERENCE_COM_SPIN_MATRIX_DISAGREEMENT')
    represented_cone = None
    represented_opposition = []
    if dynamic:
        represented_slip = (I(represented_native[1]).square() + I(represented_native[2]).square()).sqrt()
        need(represented_slip.lo > I(F(1, 10**10)).hi, 'REFERENCE_PRESENTED_SLIP')
        represented_cone = I(dot(pt, pt)).sqrt() - I(qD).sqrt() * pn
        tolerance(represented_cone, F(1, 10**12), 'REFERENCE_PRESENTED_CONE')
        world_slip = vs(represented_final, vm(frame[0], represented_native[0]))
        represented_opposition = [I(pt[i]) + I(qD).sqrt() * pn * I(world_slip[i]) / represented_slip for i in range(3)]
        for value in represented_opposition:
            tolerance(value, F(1, 10**12), 'REFERENCE_PRESENTED_OPPOSITION')
    return {'idealNativeNTS': enclosure_vector(x), 'idealWorldJ': enclosure_vector(J),
            'idealWorldT': enclosure_vector(T), 'idealFinalWorldVelocity': enclosure_vector(final),
            'idealFinalNativeVelocity': enclosure_vector(native_final), 'idealSlip': slip.data(),
            'idealConeMagnitudeResidual': cone.data() if cone else None,
            'idealOppositionResidual': enclosure_vector(opposition), 'idealMidpointWork': work.data(),
            'presentation': presentation, 'representedFinalWorldVelocity': rv(represented_final),
            'representedFinalNativeVelocity': rv(represented_native),
            'representedCOMSpin': rv(omega), 'representedMidpointWork': rat(represented_work),
            'representedConeMagnitudeResidual': represented_cone.data() if represented_cone else None,
            'representedOppositionResidual': enclosure_vector(represented_opposition)}


def dynamic_reference(case):
    outputs = []
    global PRECISION
    for PRECISION in PRECISIONS:
        bracket, leaves = root_coverage(case['K'], case['nativeVelocity'], case['qD'])
        a, b, depth, sa, sb = bracket
        refinements = []
        while True:
            ACTIVE.depth(depth)
            solved = interval_state(case['K'], case['nativeVelocity'], case['qD'], a, b)
            try:
                certificate = physical_certificate(case, solved, True)
                break
            except Pending as uncertainty:
                need(depth < CAPS['depth'], 'REFERENCE_PRESENTATION_DEPTH_' + str(uncertainty))
                ACTIVE.charge('splits')
                ACTIVE.charge('terminalCells')
                mid = qd(qa(a, b), 2)
                sm, _, gm = exact_point(case['K'], case['nativeVelocity'], case['qD'], mid)
                need(sm != 0, 'REFERENCE_REFINEMENT_ENDPOINT_ROOT')
                refinements.append({'a': rat(a), 'b': rat(b), 'mid': rat(mid),
                                    'midSign': sm, 'midG': rat(gm), 'reason': str(uncertainty)})
                if sm == sa:
                    a = mid
                elif sm == sb:
                    b = mid
                else:
                    raise NoGo('REFERENCE_REFINEMENT_SIGN')
                depth += 1
        # Recheck derivative on final bracket. The complete-domain proof already
        # established strict monotonicity on its containing crossing cell.
        need(solved['gp'].sign() != 0, 'REFERENCE_FINAL_DERIVATIVE')
        outputs.append({'precision': PRECISION, 'root': {'lo': rat(a), 'hi': rat(b),
                       'depth': depth, 'endpointSigns': [sa, sb], 'g': solved['g'].data(),
                       'derivative': solved['gp'].data(), 'pivots': solved['pivots'],
                       'derivativePivots': solved['derivativePivots']},
                       'coverage': leaves, 'refinements': refinements, 'physical': certificate})
    first, second = outputs
    froot, sroot = first['root'], second['root']
    fraction = lambda r: F(int(r['n']), int(r['d']))
    need(max(fraction(froot['lo']), fraction(sroot['lo'])) <=
         min(fraction(froot['hi']), fraction(sroot['hi'])), 'REFERENCE_80_120_ROOT_DISAGREEMENT')
    for key in ('worldJ', 'nativeNTS', 'worldT'):
        need([v['word'] for v in first['physical']['presentation'][key]] ==
             [v['word'] for v in second['physical']['presentation'][key]],
             'REFERENCE_80_120_WORD_DISAGREEMENT_' + key)
    return outputs


def prepare_case(model, options):
    bodies = {b['id']: b for b in model['bodies']}
    shapes = {c['bodyId']: c for c in model['colliders']}
    cube, floor = bodies['z-cube'], bodies['a-floor']
    need(cube['kind'] == 'dynamic' and floor['kind'] == 'static' and
         cube['massKg'] == 1 and cube['inertia'] == {
             'about': 'com', 'frame': 'body-local', 'kind': 'primitive-com'} and
         model['gravityMps2'] == [0, 0, 0] and
         cube['initial']['angularVelocityRadps'] == [0, 0, 0] and
         not any(model[key] for key in ('joints', 'cloths', 'fluids', 'sourceBindings')),
         'REFERENCE_PROFILE')
    for shape in shapes.values():
        need(shape['local']['positionM'] == [0, 0, 0] and
             shape['local']['orientationXYZW'] == [0, 0, 0, 1] and
             shape['material']['restitution'] == 0 and not shape['sensor'], 'REFERENCE_LOCAL_SHAPE_PROFILE')
    cube_axes = axes_from_actual_quaternion(list(map(q, cube['initial']['orientationXYZW'])))
    floor_axes = axes_from_actual_quaternion(list(map(q, floor['initial']['orientationXYZW'])))
    t, n, s = cube_axes
    expected_axes = [[F(v, 129) for v in row] for row in ([128, 16, 1], [-16, 127, 16], [1, -16, 128])]
    need(cube_axes == expected_axes, 'REFERENCE_ACTUAL_NATIVE_AXES')
    center = [q(0), F(1, 2), F(3, 8)]
    floor_center = list(map(q, floor['initial']['positionM']))
    floor_points = vertices(floor_center, list(map(q, shapes['a-floor']['geometry']['halfExtentsM'])), floor_axes)
    cube_half = list(map(q, shapes['z-cube']['geometry']['halfExtentsM']))
    need(cube_half == [F(1, 2)] * 3 and
         shapes['z-cube']['geometry']['kind'] == 'box' and
         shapes['a-floor']['geometry']['kind'] == 'box', 'REFERENCE_UNIT_CUBE')
    # Derive all three principal moments from the actual mass and side lengths.
    # A scalar inverse inertia is valid only after this exact equality check.
    mass = q(cube['massKg'])
    inertia = [qd(qm(mass, qa(qm(cube_half[j], cube_half[j]),
                                  qm(cube_half[k], cube_half[k]))), 3)
               for j, k in ((1, 2), (0, 2), (0, 1))]
    need(inertia == [F(1, 6)] * 3, 'REFERENCE_ACTUAL_UNIFORM_CUBE_INERTIA')
    inverse_inertia = qd(1, inertia[0])
    cube_points = vertices(center, cube_half, cube_axes)
    supports = [dot(n, p) for p in floor_points]
    winners = [i for i, value in enumerate(supports) if value == max(supports)]
    need(len(winners) == 1, 'REFERENCE_NONUNIQUE_FLOOR_SUPPORT')
    point = floor_points[winners[0]]
    need(point == [F(-1, 4), F(0), F(1, 16)], 'REFERENCE_ACTUAL_NATIVE_POINT')
    arm = vs(point, center)
    local = [dot(axis, arm) for axis in cube_axes]
    need(local[1] == -cube_half[1] and abs(local[0]) < cube_half[0] and abs(local[2]) < cube_half[2],
         'REFERENCE_FINITE_FACE_POINT')
    sat = []
    directions = floor_axes + cube_axes + [cross(a, b) for a in floor_axes for b in cube_axes]
    for i, direction in enumerate(directions):
        norm2 = dot(direction, direction)
        need(norm2 > 0, 'REFERENCE_DEGENERATE_SAT_AXIS')
        if dot(direction, vs(center, floor_center)) < 0:
            direction = vm(direction, -1)
        overlap = qs(max(dot(direction, p) for p in floor_points), min(dot(direction, p) for p in cube_points))
        need(overlap == 0 if i == 4 else overlap > 0, 'REFERENCE_SAT_TOUCH_' + str(i))
        sat.append({'axis': i, 'direction': rv(direction), 'normSquared': rat(norm2), 'overlap': rat(overlap)})
    # Original binary64 drift, then exact addition followed by binary64 rounding.
    # This is a reference to the fixed input line, not a geometry correction.
    initial = cube['initial']
    drift = [float(qm(q(v), q(options['fixedStepSeconds']))) for v in initial['velocityMps']]
    reconstructed = [float(qa(q(p), q(d))) for p, d in zip(initial['positionM'], drift)]
    need(words(reconstructed) == words(center), 'REFERENCE_FIXED_LINE_TOUCH_WORDS')
    gap = qs(dot(n, vs(list(map(q, initial['positionM'])), point)), cube_half[1])
    need(gap > 0, 'REFERENCE_INITIAL_SEPARATION')
    columns, virtual = [], []
    for j in range(3):
        impulse = [q(int(i == j)) for i in range(3)]
        omega = vm(cross(arm, impulse), inverse_inertia)
        response = va(impulse, cross(omega, arm))
        columns.append(response)
        virtual.append({'impulse': rv(impulse), 'COMDeltaVelocity': rv(impulse),
                        'COMDeltaSpin': rv(omega), 'contactDeltaVelocity': rv(response)})
    Kworld = [[columns[j][i] for j in range(3)] for i in range(3)]
    frame = [n, t, s]
    K = [[dot(a, [dot(row, b) for row in Kworld]) for b in frame] for a in frame]
    velocity = list(map(q, initial['velocityMps']))
    native_velocity = [dot(a, velocity) for a in frame]
    need(native_velocity[0] < 0, 'REFERENCE_NOT_CLOSING')
    stick_world, static_pivots = exact_solve(Kworld, vm(velocity, -1))
    stick = [dot(a, stick_world) for a in frame]
    native_stick, native_pivots = exact_solve(K, vm(native_velocity, -1))
    need(native_stick == stick, 'REFERENCE_CARTESIAN_NATIVE_GAUSSIAN_DISAGREEMENT')
    need(stick[0] > 0, 'REFERENCE_STATIC_NONPOSITIVE_LOAD')
    static_q = qm(q(shapes['a-floor']['material']['friction']['static']), q(shapes['z-cube']['material']['friction']['static']))
    margin = qs(qa(qm(stick[1], stick[1]), qm(stick[2], stick[2])), qm(static_q, qm(stick[0], stick[0])))
    dynamic_a = q(shapes['a-floor']['material']['friction']['dynamic'])
    dynamic_b = q(shapes['z-cube']['material']['friction']['dynamic'])
    need(dynamic_a == dynamic_b and dynamic_a > 0, 'REFERENCE_DYNAMIC_MATERIAL')
    qD = qm(dynamic_a, dynamic_b)
    normal_feasibility = qs(qm(K[0][0], K[0][0]), qm(qD, qa(qm(K[0][1], K[0][1]), qm(K[0][2], K[0][2]))))
    need(K[0][0] > 0 and normal_feasibility > 0, 'REFERENCE_ACTIVE_NORMAL_FEASIBILITY')
    return {'frame': frame, 'Kworld': Kworld, 'K': K, 'velocity': velocity,
            'nativeVelocity': native_velocity, 'qD': qD, 'arm': arm, 'stick': stick,
            'stickWorld': stick_world, 'margin': margin,
            'geometry': {'quaternionWords': words(initial['orientationXYZW']),
                         'quaternionNormSquared': rat(dot(list(map(q, initial['orientationXYZW'])), list(map(q, initial['orientationXYZW'])))),
                         'axisOrder': ['t', 'n', 's'], 'axes': [rv(a) for a in cube_axes],
                         'nativeFrameOrder': ['n', 't', 's'], 'nativePointM': rv(point),
                         'contactCOMM': rv(center), 'contactArmPointMinusCOM': rv(arm),
                         'nativeLocalPoint': rv(local), 'uniqueFloorVertexIndex': winners[0],
                         'floorSupports': rv(supports), 'supportIntervals': sat,
                         'originalDriftWords': words(drift), 'fixedTouchCOMWords': words(reconstructed),
                         'initialGap': rat(gap)},
            'physical': {'virtualColumns': virtual, 'worldK': [rv(row) for row in Kworld],
                         'nativeK': [rv(row) for row in K], 'nativeFreeVelocity': rv(native_velocity),
                         'staticWorldJ': rv(stick_world), 'staticNativeNTS': rv(stick),
                         'staticGaussianPivots': static_pivots,
                         'nativeStaticGaussianPivots': native_pivots,
                         'actualPrincipalInertia': rv(inertia), 'inverseUniformInertia': rat(inverse_inertia),
                         'staticMargin': rat(margin),
                         'qD': rat(qD), 'dynamicMaterialWords': [word(dynamic_a), word(dynamic_b)],
                         'activeNormalFeasibilityMargin': rat(normal_feasibility)}}


def encoded(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False) + '\n').encode()


def main():
    global START, ACTIVE, PRECISION
    START = time.monotonic()
    need(len(sys.argv) == 2 and re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', sys.argv[1]), 'REFERENCE_FRESH_OUTPUT_ID_REQUIRED')
    out = HOME / 'evidence' / sys.argv[1]
    out.parent.mkdir(exist_ok=True)
    out.mkdir()  # Existing receipt names always fail before any work/output.
    report = {'format': 'physics-coupled-dynamic-independent-reference-01',
              'status': 'REFERENCE_NO_GO', 'candidateCalls': 0, 'WorldCalls': 0,
              'engineSolverCalls': 0, 'caps': CAPS, 'precisions': list(PRECISIONS),
              'proofBoundary': 'REFERENCE_ONLY_NOT_ENGINE_QUALIFICATION',
              'cases': [{'id': c, 'status': 'NOT_RUN'} for c in ('before', 'at', 'after')]}
    try:
        bank_data = (HOME / 'bank.json').read_bytes()
        bank = json.loads(bank_data)
        report['bankSha256'] = sha256(bank_data).hexdigest()
        report['sourceSha256'] = sha256(Path(__file__).read_bytes()).hexdigest()
        report['contractSha256'] = sha256((HOME / 'CONTRACT.md').read_bytes()).hexdigest()
        authenticated = {}
        for name, expected in bank['inputs'].items():
            raw = (INPUT / name).read_bytes()
            need(sha256(raw).hexdigest() == expected, 'REFERENCE_INPUT_HASH_' + name)
            authenticated[name] = json.loads(raw)
        options = authenticated['options.json']
        need(word(options['fixedStepSeconds']) == bank['dtWord'] and
             options['profile'] == 'rigid-persistent-box-v1' and options['broadPhase'] == 'direct',
             'REFERENCE_OPTIONS_WORDS')
        # Authenticate the entire finite bank before the first physical solve.
        for case_id in bank['order']:
            model = authenticated[case_id + '-model.json']
            cube = next(b for b in model['bodies'] if b['id'] == 'z-cube')
            pinned = bank['cases'][case_id]
            need(words(cube['initial']['velocityMps']) == pinned['velocityWords'] and
                 words(cube['initial']['positionM']) == pinned['positionWords'] and
                 words(cube['initial']['orientationXYZW']) == bank['orientationWords'],
                 'REFERENCE_ACTUAL_WORD_BANK_' + case_id)
            for shape in model['colliders']:
                need(word(shape['material']['friction']['dynamic']) == bank['dynamicFrictionWord'],
                     'REFERENCE_FRICTION_WORD_' + case_id)
        report['authenticatedInputHashes'] = bank['inputs']
        for index, case_id in enumerate(bank['order']):
            ACTIVE = Budget()
            entry = report['cases'][index]
            entry['status'] = 'REFERENCE_NO_GO'
            try:
                case = prepare_case(authenticated[case_id + '-model.json'], options)
                sign = (case['margin'] > 0) - (case['margin'] < 0)
                need(sign == bank['cases'][case_id]['staticMarginSign'], 'REFERENCE_STATIC_PRIORITY_' + case_id)
                entry.update(geometry=case['geometry'], physical=case['physical'], staticMarginSign=sign,
                             branch='STATIC_STICK' if sign <= 0 else 'DYNAMIC_SLIP')
                if sign <= 0:
                    results = []
                    for PRECISION in PRECISIONS:
                        state = {'x': [I(x) for x in case['stick']]}
                        results.append({'precision': PRECISION, 'physical': physical_certificate(case, state, False)})
                    for key in ('worldJ', 'nativeNTS', 'worldT'):
                        need([v['word'] for v in results[0]['physical']['presentation'][key]] ==
                             [v['word'] for v in results[1]['physical']['presentation'][key]],
                             'REFERENCE_STATIC_80_120_WORD_DISAGREEMENT')
                    entry['reference'] = results
                else:
                    entry['reference'] = dynamic_reference(case)
                entry['status'] = 'REFERENCE_READY'
            finally:
                entry['budget'] = ACTIVE.report()
        report['status'] = 'REFERENCE_READY'
    except Exception as error:
        report['failure'] = {'type': type(error).__name__, 'reason': str(error)}
    report['elapsedSeconds'] = time.monotonic() - START
    ACTIVE = None
    data = encoded(report)
    if len(data) + len((HOME / 'bank.json').read_bytes()) > CAPS['outputBytes']:
        # A size refusal must itself leave a bounded typed receipt. Never emit
        # a truncated JSON document or retain a READY status without its proof.
        report = {key: value for key, value in report.items() if key != 'cases'} | {
            'status': 'REFERENCE_NO_GO',
            'failure': report.get('failure', {'type': 'NoGo', 'reason': 'REFERENCE_OUTPUT_BYTES'}),
            'outputBudgetFailure': 'REFERENCE_OUTPUT_BYTES',
            'omittedCertificateBytes': len(data),
            'cases': [{'id': entry['id'], 'status': 'REFERENCE_NO_GO_CERTIFICATE_OMITTED'
                       if entry['status'] == 'REFERENCE_READY' else entry['status'],
                       'budget': entry.get('budget')} for entry in report['cases']]}
        data = encoded(report)
        need(len(data) < CAPS['outputBytes'], 'REFERENCE_REFUSAL_RECEIPT_BYTES')
    with (out / 'reference.json').open('xb') as stream:
        stream.write(data)
    print(json.dumps({'status': report['status'], 'output': str(out / 'reference.json'),
                      'bytes': len(data), 'sha256': sha256(data).hexdigest(),
                      'failure': report.get('failure')}))
    return 0 if report['status'] == 'REFERENCE_READY' else 1


if __name__ == '__main__':
    sys.exit(main())
