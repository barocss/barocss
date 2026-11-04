"""Offline exact support/minimum experiment; no producer or reference imports."""
from dataclasses import dataclass
import math
import struct

MAX_OPS = 2_000_000
MAX_BITS = 16_384
PRECISIONS = (64, 128, 256, 512, 1024, 2048)
TEN24 = 1_000_000_000_000_000_000_000_000


class MicroFailure(Exception):
    pass


class Meter:
    def __init__(self):
        self.operations = 0
        self.peak_bits = 0
        self.axes = 0
        self.models = 0

    def tick(self):
        self.operations += 1
        if self.operations > MAX_OPS:
            raise MicroFailure('INTEGER_OPERATION_LIMIT')

    def checked(self, x):
        bits = abs(x).bit_length()
        self.peak_bits = max(self.peak_bits, bits)
        if bits > MAX_BITS:
            raise MicroFailure('INTEGER_BIT_LIMIT')
        return x

    def mul(self, a, b):
        self.tick()
        if a and b and abs(a).bit_length() + abs(b).bit_length() > MAX_BITS:
            raise MicroFailure('INTEGER_PRODUCT_PREBOUND')
        return self.checked(a * b)

    def add(self, a, b):
        self.tick()
        if max(abs(a).bit_length(), abs(b).bit_length()) + 1 > MAX_BITS:
            raise MicroFailure('INTEGER_SUM_PREBOUND')
        return self.checked(a + b)

    def sub(self, a, b):
        return self.add(a, -b)

    def shift(self, a, power):
        self.tick()
        if power < 0 or abs(a).bit_length() + power > MAX_BITS:
            raise MicroFailure('INTEGER_SHIFT_PREBOUND')
        return self.checked(a << power)

    def div(self, a, b):
        self.tick()
        if b <= 0:
            raise MicroFailure('NONPOSITIVE_DIVISOR')
        return self.checked(a // b)

    def compare(self, a, b):
        self.tick()
        return (a > b) - (a < b)

    def dot(self, a, b):
        result = 0
        for x, y in zip(a, b):
            result = self.add(result, self.mul(x, y))
        return result

    def cross(self, a, b):
        return tuple(self.sub(self.mul(a[i], b[j]), self.mul(a[j], b[i]))
                     for i, j in ((1, 2), (2, 0), (0, 1)))

    def sqrt_floor(self, value):
        if value <= 0:
            raise MicroFailure('NONPOSITIVE_RADICAND')
        current = self.shift(1, (value.bit_length() + 1) // 2)
        for _ in range(64):
            following = self.div(self.add(current, self.div(value, current)), 2)
            if self.compare(following, current) >= 0:
                if self.compare(self.mul(current, current), value) > 0:
                    raise MicroFailure('SQRT_CERTIFICATE')
                upper = self.add(current, 1)
                if self.compare(self.mul(upper, upper), value) <= 0:
                    raise MicroFailure('SQRT_CERTIFICATE')
                return current
            current = following
        raise MicroFailure('SQRT_ITERATION_LIMIT')

    def stats(self):
        return dict(integerOperations=self.operations, peakIntegerBits=self.peak_bits,
                    axisVisits=self.axes, conventionProblems=self.models)


def dyadic(value):
    if type(value) not in (int, float) or not math.isfinite(value):
        raise MicroFailure('NONFINITE_INPUT')
    numerator, denominator = float(value).as_integer_ratio()
    return numerator, denominator.bit_length() - 1


def vector(values, bound, length=3):
    if type(values) is not list or len(values) != length:
        raise MicroFailure('VECTOR_LAYOUT')
    if any(type(v) not in (int, float) or not math.isfinite(v) or abs(v) > bound for v in values):
        raise MicroFailure('VECTOR_BOUND')
    return tuple(float(v) for v in values)


@dataclass(frozen=True)
class Basis:
    columns: tuple
    denominator: int


@dataclass(frozen=True)
class Box:
    id: str
    kind: str
    center: tuple
    extents: tuple
    raw: Basis
    normalized: Basis


def prepare(body, m):
    if type(body) is not dict or type(body.get('id')) is not str or not body['id']:
        raise MicroFailure('BODY_ID')
    if body.get('kind') not in ('dynamic', 'static', 'kinematic'):
        raise MicroFailure('BODY_KIND')
    shape = body.get('shape')
    if type(shape) is not dict or shape.get('kind') != 'box':
        raise MicroFailure('BOX_REQUIRED')
    center = vector(body.get('positionM'), 10000)
    extents = vector(shape.get('halfExtentsM'), 1000)
    if any(x < .0001 for x in extents):
        raise MicroFailure('EXTENT_BOUND')
    quaternion = vector(body.get('orientation'), 1, 4)
    dyadics = [dyadic(x) for x in quaternion]
    power = max(d for _, d in dyadics)
    q = [m.shift(n, power - d) for n, d in dyadics]
    scale = m.shift(1, power)
    scale2 = m.mul(scale, scale)
    norm2 = m.dot(q, q)
    # The original observer's norm bound is the exact decimal1e-9.
    lower = m.mul(scale, 999999999)
    upper = m.mul(scale, 1000000001)
    scaled_norm = m.mul(norm2, 1000000000000000000)
    if norm2 == 0 or m.compare(scaled_norm, m.mul(lower, lower)) < 0 or m.compare(scaled_norm, m.mul(upper, upper)) > 0:
        raise MicroFailure('QUATERNION_NORM_BOUND')
    x, y, z, w = q

    def twice(a, b):
        return m.mul(2, m.mul(a, b))

    xy, xz, xw, yz, yw, zw = (twice(a, b) for a, b in ((x, y), (x, z), (x, w), (y, z), (y, w), (z, w)))
    xx, yy, zz = (m.mul(v, v) for v in (x, y, z))

    def basis(denominator):
        diagonal = [m.sub(denominator, m.mul(2, m.add(a, b))) for a, b in ((yy, zz), (xx, zz), (xx, yy))]
        rows = ((diagonal[0], m.sub(xy, zw), m.add(xz, yw)),
                (m.add(xy, zw), diagonal[1], m.sub(yz, xw)),
                (m.sub(xz, yw), m.add(yz, xw), diagonal[2]))
        return Basis(tuple(tuple(rows[j][i] for j in range(3)) for i in range(3)), denominator)

    return Box(body['id'], body['kind'], center, extents, basis(scale2), basis(norm2))


@dataclass(frozen=True)
class Margin:
    numerator: int
    denominator: int
    square: int
    axis: int


def compare_margin(a, b, m):
    sa = (a.numerator > 0) - (a.numerator < 0)
    sb = (b.numerator > 0) - (b.numerator < 0)
    if sa != sb:
        return m.compare(sa, sb)
    if sa == 0:
        m.tick()
        return 0
    left = m.mul(m.mul(m.mul(a.numerator, a.numerator), m.mul(b.denominator, b.denominator)), b.square)
    right = m.mul(m.mul(m.mul(b.numerator, b.numerator), m.mul(a.denominator, a.denominator)), a.square)
    return sa * m.compare(left, right)


def solve_model(a, b, normalized, m):
    m.models += 1
    ba = a.normalized if normalized else a.raw
    bb = b.normalized if normalized else b.raw
    inputs = a.center + b.center + a.extents + b.extents
    words = [dyadic(v) for v in inputs]
    power = max(d for _, d in words)
    lifted = [m.shift(n, power - d) for n, d in words]
    ca, cb, ha, hb = (lifted[i:i+3] for i in (0, 3, 6, 9))
    delta = [m.sub(y, x) for x, y in zip(ca, cb)]
    cross_den = m.mul(ba.denominator, bb.denominator)
    denominator = m.mul(m.shift(1, power), cross_den)
    axes = [(u, ba.denominator) for u in ba.columns] + [(u, bb.denominator) for u in bb.columns]
    axes += [(m.cross(u, v), cross_den) for u in ba.columns for v in bb.columns]
    minimum = None
    ties = []
    classifications = []
    for index, (axis, axis_denominator) in enumerate(axes):
        m.axes += 1
        square = m.dot(axis, axis)
        zero = square == 0
        near = not zero and index >= 6 and m.compare(m.mul(square, TEN24), m.mul(axis_denominator, axis_denominator)) < 0
        if zero:
            classifications.append(dict(axis=index, exactZero=True, nearParallel=False, marginSign=None))
            continue
        support_a = sum_support(ha, ba.columns, axis, m)
        support_b = sum_support(hb, bb.columns, axis, m)
        center = abs(m.dot(delta, axis))
        numerator = m.sub(m.add(m.mul(support_a, bb.denominator), m.mul(support_b, ba.denominator)), m.mul(center, cross_den))
        margin = Margin(numerator, denominator, square, index)
        sign = (numerator > 0) - (numerator < 0)
        classifications.append(dict(axis=index, exactZero=False, nearParallel=near, marginSign=sign))
        comparison = -1 if minimum is None else compare_margin(margin, minimum, m)
        if comparison < 0:
            minimum, ties = margin, [index]
        elif comparison == 0:
            ties.append(index)
    if minimum is None:
        raise MicroFailure('NO_NONZERO_AXIS')
    return minimum, dict(firstExactMinimum=minimum.axis, exactTiedMinima=ties, axes=classifications)


def sum_support(extents, columns, axis, m):
    result = 0
    for extent, column in zip(extents, columns):
        result = m.add(result, m.mul(extent, abs(m.dot(column, axis))))
    return result


def interval(value, precision, m):
    if value.numerator == 0:
        return (0, 0, precision)
    root = m.sqrt_floor(m.shift(value.square, 2 * precision))
    numerator = m.shift(abs(value.numerator), 2 * precision)
    low_den = m.mul(value.denominator, m.add(root, 1))
    high_den = m.mul(value.denominator, root)
    low = m.div(numerator, low_den)
    high = m.add(m.div(numerator, high_den), 1)
    return (low, high, precision) if value.numerator > 0 else (-high, -low, precision)


def dyadic_word(value, precision, m):
    if value == 0:
        return '0000000000000000'
    sign = -1 if value < 0 else 1
    numerator = abs(value)
    exponent = numerator.bit_length() - 1 - precision
    unit = max(-1074, exponent - 52)
    shift = precision + unit
    if shift <= 0:
        significand = m.shift(numerator, -shift)
    else:
        denominator = m.shift(1, shift)
        significand = m.div(numerator, denominator)
        remainder = m.sub(numerator, m.mul(significand, denominator))
        comparison = m.compare(m.mul(2, remainder), denominator)
        if comparison > 0 or comparison == 0 and significand & 1:
            significand = m.add(significand, 1)
    rounded = math.ldexp(float(significand), unit) * sign
    if not math.isfinite(rounded):
        raise MicroFailure('NONFINITE_OUTPUT')
    return struct.pack('<d', rounded).hex()


def own_rounding_cell_contains(low, high, precision, own_word, m):
    """Strict cell test using only the proposed word, never saved authority."""
    value = struct.unpack('<d', bytes.fromhex(own_word))[0]
    below = math.nextafter(value, -math.inf)
    above = math.nextafter(value, math.inf)
    if not math.isfinite(below) or not math.isfinite(above):
        return False

    def boundary(first, second):
        a, ap = dyadic(first)
        b, bp = dyadic(second)
        power = max(ap, bp)
        numerator = m.add(m.shift(a, power - ap), m.shift(b, power - bp))
        return numerator, power + 1

    lower, lower_power = boundary(below, value)
    upper, upper_power = boundary(value, above)
    lower_common = max(precision, lower_power)
    upper_common = max(precision, upper_power)
    lower_test = m.compare(m.shift(low, lower_common - precision),
                           m.shift(lower, lower_common - lower_power))
    upper_test = m.compare(m.shift(high, upper_common - precision),
                           m.shift(upper, upper_common - upper_power))
    return lower_test > 0 and upper_test < 0


def absolute_difference(a, b, m):
    if a[2] != b[2]:
        raise MicroFailure('INTERVAL_PRECISION')
    low, high = m.sub(a[0], b[1]), m.sub(a[1], b[0])
    if low <= 0 <= high:
        return 0, max(-low, high), a[2]
    return min(abs(low), abs(high)), max(abs(low), abs(high)), a[2]


def certified_fields(raw, normalized, m):
    equal_margins = compare_margin(raw, normalized, m) == 0
    for precision in PRECISIONS:
        ri, ni = interval(raw, precision, m), interval(normalized, precision, m)
        rd = (0, 0, precision) if raw.numerator <= 0 else (max(0, ri[0]), max(0, ri[1]), precision)
        nd = (0, 0, precision) if normalized.numerator <= 0 else (max(0, ni[0]), max(0, ni[1]), precision)
        intervals = dict(rawMarginM=ri, normalizedMarginM=ni, rawDepthM=rd, normalizedDepthM=nd,
                         rawNormalizedMarginDifferenceM=(0, 0, precision) if equal_margins else absolute_difference(ri, ni, m),
                         rawNormalizedDepthDifferenceM=(0, 0, precision) if equal_margins else absolute_difference(rd, nd, m))
        fields = {}
        for name, (low, high, power) in intervals.items():
            low_word, high_word = dyadic_word(low, power, m), dyadic_word(high, power, m)
            if low_word != high_word or not own_rounding_cell_contains(low, high, power, low_word, m):
                break
            fields[name] = dict(word=low_word, low=str(low), high=str(high), precision=power)
        else:
            return fields
    raise MicroFailure('ROUNDING_UNRESOLVED')


def evaluate_pair(a, b, m):
    raw, raw_report = solve_model(a, b, False, m)
    normalized, normalized_report = solve_model(a, b, True, m)
    return dict(pairKey=a.id + '\0' + b.id, raw=raw_report, normalized=normalized_report,
                fields=certified_fields(raw, normalized, m),
                fullCompactPairCompatible=False, featureWinnerExternallyQualified=False)
