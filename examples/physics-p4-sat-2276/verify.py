"""Saved-authority observer. No candidate SAT, radical or rounding imports."""
from fractions import Fraction
import math
import struct

FIELDS = ('rawMarginM', 'normalizedMarginM', 'rawDepthM', 'normalizedDepthM',
          'rawNormalizedMarginDifferenceM', 'rawNormalizedDepthDifferenceM')


def word(value):
    return struct.pack('<d', value).hex()


def verify(candidate, saved):
    if candidate['pairKey'] != saved['pairKey'] or set(candidate['fields']) != set(FIELDS):
        raise ValueError('AUTHORITY_LAYOUT')
    checked = 0
    for field in FIELDS:
        value = saved[field]
        if type(value) not in (int, float) or not math.isfinite(value):
            raise ValueError('AUTHORITY_NONFINITE')
        observed = candidate['fields'][field]
        if observed['word'] != word(float(value)):
            raise ValueError('F64_WORD_MISMATCH:' + field)
        precision = observed['precision']
        if type(precision) is not int or precision not in (64, 128, 256, 512, 1024, 2048):
            raise ValueError('INTERVAL_LAYOUT')
        if any(type(observed[k]) is not str or len(observed[k]) > 5000 for k in ('low', 'high')):
            raise ValueError('INTERVAL_SIZE')
        low = Fraction(int(observed['low']), 1 << precision)
        high = Fraction(int(observed['high']), 1 << precision)
        if low > high:
            raise ValueError('INTERVAL_REVERSED')
        exact = Fraction.from_float(float(value))
        below, above = math.nextafter(float(value), -math.inf), math.nextafter(float(value), math.inf)
        if not math.isfinite(below) or not math.isfinite(above):
            raise ValueError('ROUNDING_CELL_UNAVAILABLE')
        lower_cell = (Fraction.from_float(below) + exact) / 2
        upper_cell = (Fraction.from_float(above) + exact) / 2
        # Strict containment avoids silently making any halfway-even assumption.
        if not lower_cell < low <= high < upper_cell:
            raise ValueError('SAVED_WORD_INTERVAL_UNRESOLVED:' + field)
        checked += 1
    for convention, field in (('raw', 'rawMarginM'), ('normalized', 'normalizedMarginM')):
        model = candidate[convention]
        if len(model['axes']) != 15 or [a['axis'] for a in model['axes']] != list(range(15)):
            raise ValueError('ALL_AXES_REQUIRED')
        winner = model['firstExactMinimum']
        sign = model['axes'][winner]['marginSign']
        expected = (saved[field] > 0) - (saved[field] < 0)
        if sign != expected:
            raise ValueError('SAVED_MARGIN_SIGN_UNRESOLVED:' + convention)
    return dict(verifiedNumericWords=checked, verifiedMarginSigns=2,
                independentFeatureOracle='UNAVAILABLE_IN_COMPACT_AUTHORITY',
                legacyPrecisionDelta='NOT_RECONSTRUCTED', fullCompactPair='NOT_QUALIFIED')
