"""Independent bounded square-order oracle; no quotient/isqrt floor algorithm."""
from support import decimal, require

PRECISIONS = (64, 128, 256, 512, 1024, 2048)
MAX_FINITE = 0x7fefffffffffffff


class Work:
    def __init__(self):
        self.operations = 0

    def tick(self):
        self.operations += 1
        require(self.operations <= 2000000, 'REFERENCE_WORK_CAP')

    def mul(self, a, b):
        self.tick()
        require(abs(a).bit_length() + abs(b).bit_length() <= 16384,
                'REFERENCE_PRODUCT_PREBOUND')
        return a * b

    def shift(self, a, count):
        self.tick()
        require(type(count) is int and 0 <= count <= 16383 and
                abs(a).bit_length() + count <= 16384, 'REFERENCE_SHIFT_PREBOUND')
        return a << count

    def add(self, a, b):
        self.tick()
        require(max(abs(a).bit_length(), abs(b).bit_length()) + 1 <= 16384,
                'REFERENCE_SUM_PREBOUND')
        return a + b

    def cmp(self, a, b):
        self.tick()
        return (a > b) - (a < b)


def literal(desc, work, depth=0):
    require(depth <= 8 and isinstance(desc, dict) and len(desc) == 1, 'LITERAL_SCHEMA')
    kind, value = next(iter(desc.items()))
    if kind == 'int':
        return decimal(value)
    if kind == 'pow2':
        require(type(value) is int and 0 <= value <= 8192, 'LITERAL_POWER')
        return work.shift(1, value)
    require(kind in ('add', 'sub', 'mul') and isinstance(value, list) and len(value) == 2,
            'LITERAL_OPERATION')
    a, b = (literal(item, work, depth + 1) for item in value)
    if kind == 'mul':
        return work.mul(a, b)
    return work.add(a, b if kind == 'add' else -b)


def request_from_case(case, work):
    return {'numerator': str(literal(case['N'], work)),
            'denominator': str(literal(case['D'], work)),
            'square': str(literal(case['S'], work)), 'precision': case['p']}


def problem(request):
    n = decimal(request['numerator'])
    d = decimal(request['denominator'], nonnegative=True)
    s = decimal(request['square'], nonnegative=True)
    require(type(request['precision']) is int and request['precision'] in PRECISIONS,
            'REFERENCE_PRECISION')
    return n, d, s, request['precision']


def square_terms(n, d, s, p, work):
    require(d > 0 and s > 0, 'REFERENCE_DOMAIN')
    c = work.shift(work.mul(abs(n), abs(n)), 2 * p)
    b = work.mul(work.mul(d, d), s)
    return c, b


def floor_grid(request, work):
    n, d, s, p = problem(request)
    require(d > 0 and s > 0, 'REFERENCE_DOMAIN')
    if n == 0:
        return {'low': '0', 'high': '0', 'precision': p}, True
    c, b = square_terms(n, d, s, p, work)
    # For integer d,s>=1, |x|2^p <= |n|2^p. No quotient or isqrt is used.
    low, high = 0, work.add(work.shift(abs(n), p), 1)
    iterations = 0
    while high - low > 1:
        iterations += 1
        require(iterations <= 4096, 'REFERENCE_GRID_SEARCH_CAP')
        middle = work.add(low, high) // 2
        square = work.mul(work.mul(middle, middle), b)
        if work.cmp(square, c) <= 0:
            low = middle
        else:
            high = middle
    lower_square = work.mul(work.mul(low, low), b)
    upper_square = work.mul(work.mul(high, high), b)
    require(work.cmp(lower_square, c) <= 0 and work.cmp(c, upper_square) < 0,
            'REFERENCE_GRID_CERTIFICATE')
    exact = lower_square == c
    upper = low if exact else high
    if n < 0:
        low, upper = -upper, -low
    return {'low': str(low), 'high': str(upper), 'precision': p}, exact


def dyadic(word, work):
    require(type(word) is int and 0 <= word <= MAX_FINITE, 'REFERENCE_FINITE_WORD')
    exponent, fraction = (word >> 52) & 2047, word & ((1 << 52) - 1)
    n = fraction if exponent == 0 else (1 << 52) + fraction
    power = -1074 if exponent == 0 else exponent - 1075
    if n == 0:
        return 0, 1
    if power >= 0:
        return work.shift(n, power), 1
    d = work.shift(1, -power)
    while n % 2 == 0 and d > 1:
        work.tick()
        n //= 2
        d //= 2
    return n, d


def midpoint(left, right, work):
    ln, ld = dyadic(left, work)
    rn, rd = dyadic(right, work)
    denominator = max(ld, rd)
    numerator = work.add(work.mul(ln, denominator // ld), work.mul(rn, denominator // rd))
    denominator = work.shift(denominator, 1)
    while numerator and numerator % 2 == 0 and denominator > 1:
        work.tick()
        numerator //= 2
        denominator //= 2
    return numerator, denominator


def compare_magnitude(n, d, s, value, work):
    a, b = value
    require(a >= 0 and b > 0 and d > 0 and s > 0, 'REFERENCE_COMPARE_DOMAIN')
    left = work.mul(work.mul(abs(n), abs(n)), work.mul(b, b))
    right = work.mul(work.mul(work.mul(d, d), s), work.mul(a, a))
    return work.cmp(left, right)


def compare_ratios(a, b, work):
    return work.cmp(work.mul(a[0], b[1]), work.mul(b[0], a[1]))


def text_ratio(ratio):
    return str(ratio[0]) + '/' + str(ratio[1])


def rne_reference(request, interval, work):
    n, d, s, p = problem(request)
    if n == 0:
        return {'wordHex': '0000000000000000', 'exactZero': True,
                'gridIntervalInRneCell': True}
    require(compare_magnitude(n, d, s, dyadic(MAX_FINITE, work), work) < 0,
            'REFERENCE_RNE_FINITE_BANK')
    low, high = 0, MAX_FINITE + 1
    for _ in range(64):
        if high - low <= 1:
            break
        middle = (low + high) // 2
        if compare_magnitude(n, d, s, dyadic(middle, work), work) >= 0:
            low = middle
        else:
            high = middle
    require(high == low + 1 and high <= MAX_FINITE, 'REFERENCE_WORD_SEARCH_CAP')
    comparison = compare_magnitude(n, d, s, midpoint(low, high, work), work)
    chosen = low if comparison < 0 else high if comparison > 0 else low if low % 2 == 0 else high
    return rne_cell(request, interval, chosen, work)


def rne_cell(request, interval, chosen, work):
    """Verify one provided IEEE cell, without a root or floating-point search."""
    n, d, s, p = problem(request)
    if n == 0:
        require(chosen == 0, 'REFERENCE_ZERO_WORD')
        return {'wordHex': '0000000000000000', 'exactZero': True,
                'gridIntervalInRneCell': True}
    require(0 < chosen < MAX_FINITE, 'REFERENCE_BANK_CELL_BOUNDARY')
    lower = midpoint(chosen - 1, chosen, work)
    upper = midpoint(chosen, chosen + 1, work)
    lc, uc = compare_magnitude(n, d, s, lower, work), compare_magnitude(n, d, s, upper, work)
    even = chosen % 2 == 0
    require((lc > 0 or lc == 0 and even) and (uc < 0 or uc == 0 and even),
            'REFERENCE_RADICAL_RNE_CELL')
    if n < 0:
        lower, upper = (-upper[0], upper[1]), (-lower[0], lower[1])
    denominator = work.shift(1, p)
    gl = compare_ratios((decimal(interval['low']), denominator), lower, work)
    gu = compare_ratios((decimal(interval['high']), denominator), upper, work)
    fits = (gl > 0 or gl == 0 and even) and (gu < 0 or gu == 0 and even)
    return {'wordHex': format(chosen | ((1 << 63) if n < 0 else 0), '016x'),
            'exactZero': False, 'cellLow': text_ratio(lower), 'cellHigh': text_ratio(upper),
            'lowerIncluded': even, 'upperIncluded': even, 'radicalStrictlyInside': lc > 0 and uc < 0,
            'gridIntervalInRneCell': gl > 0 and gu < 0,
            'gridIntervalInClosedRneCell': fits}
