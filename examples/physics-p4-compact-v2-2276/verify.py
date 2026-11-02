"""Independent saved-payload and Fraction interval observer; no SAT formulas."""
from fractions import Fraction
import math
import struct

NUMERIC = ('rawMarginM', 'normalizedMarginM', 'rawDepthM', 'normalizedDepthM',
           'rawNormalizedMarginDifferenceM', 'rawNormalizedDepthDifferenceM')
OLD_KEYS = set(NUMERIC) | {'pairKey', 'selection', 'ties', 'precisionMaxDifferenceM'}


def same(actual, expected, path=''):
    if type(actual) is bool or type(expected) is bool:
        if type(actual) is not type(expected) or actual != expected:
            raise ValueError('PAYLOAD_BOOLEAN:' + path)
        return 1
    if type(actual) in (int, float) and type(expected) in (int, float):
        if struct.pack('<d', float(actual)) != struct.pack('<d', float(expected)):
            raise ValueError('PAYLOAD_F64_WORD:' + path)
        return 1
    if type(actual) is not type(expected):
        raise ValueError('PAYLOAD_TYPE:' + path)
    if type(actual) is dict:
        if set(actual) != set(expected):
            raise ValueError('PAYLOAD_FIELDS:' + path)
        return sum(same(actual[k], expected[k], path + '/' + k) for k in actual)
    if type(actual) is list:
        if len(actual) != len(expected):
            raise ValueError('PAYLOAD_LENGTH:' + path)
        return sum(same(a, b, path + '/' + str(i)) for i, (a, b) in enumerate(zip(actual, expected)))
    if actual != expected:
        raise ValueError('PAYLOAD_VALUE:' + path)
    return 1


def verify(record, saved, stage):
    if set(saved) != OLD_KEYS or set(record) != OLD_KEYS - {'precisionMaxDifferenceM'} | {'satCertificateV2'}:
        raise ValueError('UNEXPLAINED_COMPACT_FIELDS')
    leaves = 0
    for key in OLD_KEYS - {'precisionMaxDifferenceM'}:
        leaves += same(record[key], saved[key], '/' + key)
    cert = record['satCertificateV2']
    if cert['protocol'] != 'p4-compact-observer-v2' or cert['omittedLegacyField'] != 'precisionMaxDifferenceM':
        raise ValueError('EXPLICIT_PROTOCOL_REQUIRED')
    if set(cert['numericIntervals']) != set(NUMERIC):
        raise ValueError('NUMERIC_INTERVAL_FIELDS')
    bounds = {}
    for name, interval in cert['numericIntervals'].items():
        if type(interval['precision']) is not int or interval['precision'] not in (64, 128, 256, 512, 1024, 2048):
            raise ValueError('INTERVAL_PRECISION')
        if any(type(interval[key]) is not str or len(interval[key]) > 5000 for key in ('low', 'high')):
            raise ValueError('INTERVAL_SIZE')
        low = Fraction(int(interval['low']), 1 << interval['precision'])
        high = Fraction(int(interval['high']), 1 << interval['precision'])
        if low > high or high - low > Fraction(1, 10**25):
            raise ValueError('V2_WIDTH_EXCEEDS_ORIGINAL_PRECISION_GATE:' + name)
        expected_word = struct.pack('<d', float(saved[name])).hex()
        if interval['word'] != expected_word:
            raise ValueError('INTERVAL_AUTHORITY_WORD:' + name)
        value = float(saved[name])
        exact = Fraction.from_float(value)
        below, above = math.nextafter(value, -math.inf), math.nextafter(value, math.inf)
        if not math.isfinite(below) or not math.isfinite(above):
            raise ValueError('ROUNDING_CELL_UNAVAILABLE')
        lower_cell = (Fraction.from_float(below) + exact) / 2
        upper_cell = (Fraction.from_float(above) + exact) / 2
        if not lower_cell < low <= high < upper_cell:
            raise ValueError('SAVED_WORD_INTERVAL_UNRESOLVED:' + name)
        bounds[name] = low, high
    for convention, field in (('raw', 'rawMarginM'), ('normalized', 'normalizedMarginM')):
        model = cert[convention]
        if len(model['axes']) != 15 or [axis['axis'] for axis in model['axes']] != list(range(15)):
            raise ValueError('ALL_15_AXES_REQUIRED')
        sign = model['axes'][model['firstExactMinimum']]['marginSign']
        if sign != (saved[field] > 0) - (saved[field] < 0):
            raise ValueError('SAVED_MARGIN_SIGN_UNRESOLVED:' + convention)
    names = ['rawNormalizedMarginDifferenceM', 'rawNormalizedDepthDifferenceM']
    if stage == 'HYP':
        names += ['rawDepthM', 'normalizedDepthM']
    if set(cert['physicalGates']) != set(names):
        raise ValueError('PHYSICAL_GATES_INCOMPLETE')
    gate = Fraction.from_float(1e-12)
    for name in names:
        low, high = bounds[name]
        status = 'PASS' if high <= gate else 'VIOLATION' if low > gate else 'UNRESOLVED'
        if cert['physicalGates'][name] != status:
            raise ValueError('PHYSICAL_GATE_CERTIFICATE:' + name)
        if status != 'PASS':
            raise ValueError('PHYSICAL_GATE_' + status + ':' + name)
    return dict(numericWords=6, retainedPayloadLeaves=leaves,
                oldPrecisionMetadataReplacedExplicitly=True, allConsumedGatesCertified=True)
