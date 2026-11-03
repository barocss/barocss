"""Direct inequalities and Fraction composition; no interval-root computation."""
from fractions import Fraction
import math
import re
import struct
from support import need, same

FIELDS = ('rawMarginM', 'normalizedMarginM', 'rawDepthM', 'normalizedDepthM',
          'rawNormalizedMarginDifferenceM', 'rawNormalizedDepthDifferenceM')
PRECISIONS = (64, 128, 256, 512, 1024, 2048)
DECIMAL = re.compile(r'(?:0|-[1-9][0-9]*|[1-9][0-9]*)\Z', re.ASCII)


def integer(text):
    need(type(text) is str and len(text) <= 4096 and DECIMAL.fullmatch(text), 'ENDPOINT_CANONICAL')
    value = int(text)
    need(abs(value).bit_length() <= 16384, 'ENDPOINT_BIT_CAP')
    return value


def mul(a, b):
    need(abs(a).bit_length() + abs(b).bit_length() <= 16384, 'RADICAL_PRODUCT_PREBOUND')
    return a * b


def base(margin, encoded):
    n, d, s = margin.numerator, margin.denominator, margin.square
    p = encoded['precision']
    need(d > 0 and s > 0, 'RADICAL_DOMAIN')
    low, high = integer(encoded['low']), integer(encoded['high'])
    if n == 0:
        need(low == high == 0, 'ZERO_POINT')
        return
    lower, upper = (low, high) if n > 0 else (-high, -low)
    need(0 <= lower <= upper, 'RADICAL_SIGN')
    square = mul(abs(n), abs(n))
    need(square.bit_length() + 2 * p <= 16384, 'RADICAL_SHIFT_PREBOUND')
    c, b = square << (2 * p), mul(mul(d, d), s)
    need(lower.bit_length() + 1 <= 16384, 'RADICAL_SUCCESSOR_PREBOUND')
    successor = lower + 1
    lower_test, upper_test = mul(mul(lower, lower), b), mul(mul(successor, successor), b)
    need(lower_test <= c < upper_test, 'MINIMAL_GRID_INEQUALITIES')
    need(upper == lower + (0 if lower_test == c else 1), 'MINIMAL_GRID_EQUALITY_WIDTH')


def radical_equal(a, b):
    sa = (a.numerator > 0) - (a.numerator < 0)
    sb = (b.numerator > 0) - (b.numerator < 0)
    if sa != sb:
        return False
    if sa == 0:
        return True
    left = mul(mul(mul(a.numerator, a.numerator), mul(b.denominator, b.denominator)), b.square)
    right = mul(mul(mul(b.numerator, b.numerator), mul(a.denominator, a.denominator)), a.square)
    return left == right


def difference(a, b):
    low, high = a[0] - b[1], a[1] - b[0]
    return (Fraction(0), max(-low, high)) if low <= 0 <= high else (min(abs(low), abs(high)), max(abs(low), abs(high)))


def verify(record, authority, raw, normalized, stage):
    cert, saved = record['satCertificateV3'], authority['satCertificateV2']
    need(set(cert) == set(saved) | {'enclosureAlgorithm'}, 'CLOSED_V3_CERTIFICATE')
    need(saved['protocol'] == 'p4-compact-observer-v2', 'AUTHENTICATED_SAVED_CERTIFICATE_PROTOCOL')
    need(cert['protocol'] == 'p4-compact-direct-grid-v1' and
         cert['enclosureAlgorithm'] == 'DIRECT_SCALED_MARGIN_QUOTIENT_ISQRT_MINIMAL_GRID', 'V3_CERTIFICATE_PROTOCOL')
    need(set(cert['numericIntervals']) == set(FIELDS), 'INTERVAL_FIELDS')
    bounds, widths, precisions = {}, [], set()
    for field in FIELDS:
        item = cert['numericIntervals'][field]
        need(set(item) == {'low', 'high', 'precision', 'word'}, 'INTERVAL_CLOSED_FIELDS')
        p = item['precision']
        need(type(p) is int and p in PRECISIONS, 'FIXED_PRECISION_TABLE')
        precisions.add(p)
        ln, hn = integer(item['low']), integer(item['high'])
        need(max(abs(ln).bit_length(), abs(hn).bit_length()) <= p + 1025,
             'FINITE_WORD_ENDPOINT_PREBOUND')
        low, high = Fraction(ln, 1 << p), Fraction(hn, 1 << p)
        need(low <= high and high - low <= Fraction(1, 10**25), 'EXACT_WIDTH_GATE')
        word = struct.pack('<d', authority[field]).hex()
        need(item['word'] == word == saved['numericIntervals'][field]['word'], 'LITTLE_ENDIAN_SAVED_WORD')
        same(record[field], authority[field], field)
        value = float(authority[field])
        below, above = math.nextafter(value, -math.inf), math.nextafter(value, math.inf)
        need(math.isfinite(below) and math.isfinite(above), 'FINITE_RNE_CELL')
        center = Fraction.from_float(value)
        lc, uc = (Fraction.from_float(below) + center) / 2, (Fraction.from_float(above) + center) / 2
        need(lc < low <= high < uc, 'STRICT_SAVED_WORD_RNE_CELL')
        bounds[field] = low, high
        widths.append(high - low)
    need(len(precisions) == 1, 'UNCHANGED_COMMON_PRECISION_POLICY')
    base(raw, cert['numericIntervals']['rawMarginM'])
    base(normalized, cert['numericIntervals']['normalizedMarginM'])
    clipped = {}
    for source, target in (('rawMarginM', 'rawDepthM'), ('normalizedMarginM', 'normalizedDepthM')):
        clipped[target] = tuple(max(Fraction(0), x) for x in bounds[source])
        need(bounds[target] == clipped[target], 'DEPTH_CLIPPING_COMPOSITION')
    equal = radical_equal(raw, normalized)
    for source_a, source_b, target in (
            ('rawMarginM', 'normalizedMarginM', 'rawNormalizedMarginDifferenceM'),
            ('rawDepthM', 'normalizedDepthM', 'rawNormalizedDepthDifferenceM')):
        derived = (Fraction(0), Fraction(0)) if equal else difference(bounds[source_a], bounds[source_b])
        need(bounds[target] == derived, 'ABSOLUTE_DIFFERENCE_COMPOSITION')
    names = {'rawNormalizedMarginDifferenceM', 'rawNormalizedDepthDifferenceM'}
    if stage == 'HYP':
        names |= {'rawDepthM', 'normalizedDepthM'}
    need(set(cert['physicalGates']) == names, 'PHYSICAL_GATE_FIELDS')
    gate = Fraction.from_float(1e-12)
    for field in names:
        need(bounds[field][1] <= gate and cert['physicalGates'][field] == 'PASS', 'REPRESENTED_PHYSICAL_GATE')
    return max(widths)
