"""Direct-grid compact V3: unchanged all-axis geometry, new interval proof."""
from fractions import Fraction
import hashlib
import importlib.util
from pathlib import Path
import struct
import sys

PROTOCOL = 'p4-compact-direct-grid-v1'
ALGORITHM = 'DIRECT_SCALED_MARGIN_QUOTIENT_ISQRT_MINIMAL_GRID'
FIELDS = ('rawMarginM', 'normalizedMarginM', 'rawDepthM', 'normalizedDepthM',
          'rawNormalizedMarginDifferenceM', 'rawNormalizedDepthDifferenceM')
SELECTION = ('normal', 'boundM', 'candidateIndex', 'pointM', 'rawAxisLength', 'label', 'feature')
TEN25 = 10_000_000_000_000_000_000_000_000
_ROOT = Path(__file__).resolve().parents[2]
_GRID_PATH = _ROOT / 'examples/physics-p4-radical-grid-2276/radical_grid.py'
_GRID_CONTRACT = _ROOT / 'examples/physics-p4-radical-grid-2276/CONTRACT.md'
_GRID_SHA = 'f9a57fa5ed8aca0a671cbb4a49b0033bfcfdc89b45466320782f88ceb5169afc'
_GRID_CONTRACT_SHA = '30fa88317f5b982b79f581648f00062c9c0d637ef1ee4c7eb61c169e291adad1'


def _load_grid():
    for path, expected in ((_GRID_PATH, _GRID_SHA), (_GRID_CONTRACT, _GRID_CONTRACT_SHA)):
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError('FROZEN_RADICAL_GRID_SOURCE_DRIFT:' + str(path))
    name = '_p4_radical_compact_frozen_grid'
    spec = importlib.util.spec_from_file_location(name, _GRID_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


_GRID = _load_grid()


def _interval(value, precision, k, m):
    try:
        return _GRID.interval(value, precision, m)
    except _GRID._K.MicroFailure as error:
        # The frozen kernel authenticates a separate module instance. Preserve
        # its reason while using the supplied geometry component's error class.
        raise k.MicroFailure(str(error)) from error


def threshold_status(interval, k, m):
    low, high, precision = interval
    gate, gate_power = k.dyadic(1e-12)
    common = max(precision, gate_power)
    boundary = m.shift(gate, common - gate_power)
    if m.compare(m.shift(high, common - precision), boundary) <= 0:
        return 'PASS'
    if m.compare(m.shift(low, common - precision), boundary) > 0:
        return 'VIOLATION'
    return 'UNRESOLVED'


def certify(raw, normalized, stage, k, m):
    equal = k.compare_margin(raw, normalized, m) == 0
    for precision in k.PRECISIONS:
        ri, ni = _interval(raw, precision, k, m), _interval(normalized, precision, k, m)
        rd = (0, 0, precision) if raw.numerator <= 0 else (max(0, ri[0]), max(0, ri[1]), precision)
        nd = (0, 0, precision) if normalized.numerator <= 0 else (max(0, ni[0]), max(0, ni[1]), precision)
        intervals = dict(rawMarginM=ri, normalizedMarginM=ni, rawDepthM=rd, normalizedDepthM=nd,
                         rawNormalizedMarginDifferenceM=(0, 0, precision) if equal else k.absolute_difference(ri, ni, m),
                         rawNormalizedDepthDifferenceM=(0, 0, precision) if equal else k.absolute_difference(rd, nd, m))
        fields = {}
        for name, (low, high, power) in intervals.items():
            word = k.dyadic_word(low, power, m)
            if word != k.dyadic_word(high, power, m):
                break
            if not k.own_rounding_cell_contains(low, high, power, word, m):
                break
            if m.compare(m.mul(m.sub(high, low), TEN25), m.shift(1, power)) > 0:
                break
            fields[name] = dict(word=word, low=str(low), high=str(high), precision=power)
        else:
            gates = {name: threshold_status(intervals[name], k, m)
                     for name in ('rawNormalizedMarginDifferenceM', 'rawNormalizedDepthDifferenceM')}
            if stage == 'HYP':
                for name in ('rawDepthM', 'normalizedDepthM'):
                    gates[name] = threshold_status(intervals[name], k, m)
            if 'UNRESOLVED' in gates.values():
                continue
            return fields, gates
    raise k.MicroFailure('DIRECT_GRID_CERTIFICATE_UNRESOLVED')


def compact(a, b, original_a, original_b, stage, scalar_query, k, m):
    raw, raw_report = k.solve_model(a, b, False, m)
    normalized, normalized_report = k.solve_model(a, b, True, m)
    fields, gates = certify(raw, normalized, stage, k, m)
    # Authenticated unchanged Float64 code; exact winner never seeds selection.
    scalar = scalar_query(original_a, original_b)
    record = dict(pairKey=a.id + '\0' + b.id)
    for name in FIELDS:
        record[name] = struct.unpack('<d', bytes.fromhex(fields[name]['word']))[0]
    record['selection'] = {name: scalar[name] for name in SELECTION}
    record['ties'] = scalar['ambiguity']
    record['satCertificateV3'] = dict(protocol=PROTOCOL, numericIntervals=fields,
        raw=raw_report, normalized=normalized_report, physicalGates=gates,
        absoluteIntervalWidthLimitM='1e-25', axisArithmetic='EXACT_INTEGER_ALL_15_AXES_BOTH_MODELS',
        omittedLegacyField='precisionMaxDifferenceM', oldDecimalRuns=0,
        exactWinnerUsedForScalarSelection=False, scalarCandidateAxes=15,
        enclosureAlgorithm=ALGORITHM)
    return record


_RECORD_KEYS = frozenset(('pairKey', *FIELDS, 'selection', 'ties', 'satCertificateV3'))
_CERTIFICATE_KEYS = frozenset(('protocol', 'numericIntervals', 'raw', 'normalized',
    'physicalGates', 'absoluteIntervalWidthLimitM', 'axisArithmetic', 'omittedLegacyField',
    'oldDecimalRuns', 'exactWinnerUsedForScalarSelection', 'scalarCandidateAxes', 'enclosureAlgorithm'))
_REPORT_KEYS = frozenset(('firstExactMinimum', 'exactTiedMinima', 'axes'))
_AXIS_KEYS = frozenset(('axis', 'exactZero', 'nearParallel', 'marginSign'))


def _require(condition):
    if not condition:
        raise ValueError('DIRECT_GRID_CLOSED_SCHEMA')


def _endpoint(text):
    _require(type(text) is str and 1 <= len(text) <= 2468)
    start = 1 if text[0] == '-' else 0
    _require(start < len(text) and all('0' <= char <= '9' for char in text[start:]))
    _require(text[start] != '0' or start == 0 and len(text) == 1)
    return int(text)


def _certificate(record):
    _require(type(record) is dict and frozenset(record) in (_RECORD_KEYS, _RECORD_KEYS | {'scalar'}))
    cert = record['satCertificateV3']
    _require(type(cert) is dict and frozenset(cert) == _CERTIFICATE_KEYS)
    _require(cert['protocol'] == PROTOCOL and cert['enclosureAlgorithm'] == ALGORITHM)
    _require(cert['absoluteIntervalWidthLimitM'] == '1e-25')
    _require(cert['axisArithmetic'] == 'EXACT_INTEGER_ALL_15_AXES_BOTH_MODELS')
    _require(cert['omittedLegacyField'] == 'precisionMaxDifferenceM')
    _require(type(cert['oldDecimalRuns']) is int and cert['oldDecimalRuns'] == 0)
    _require(cert['exactWinnerUsedForScalarSelection'] is False)
    _require(type(cert['scalarCandidateAxes']) is int and cert['scalarCandidateAxes'] == 15)
    intervals = cert['numericIntervals']
    _require(type(intervals) is dict and set(intervals) == set(FIELDS))
    precisions = set()
    for item in intervals.values():
        _require(type(item) is dict and set(item) == {'word', 'low', 'high', 'precision'})
        word, precision = item['word'], item['precision']
        _require(type(word) is str and len(word) == 16 and all(char in '0123456789abcdef' for char in word))
        _require(type(precision) is int and precision in _GRID._K.PRECISIONS)
        _endpoint(item['low']); _endpoint(item['high'])
        precisions.add(precision)
    _require(len(precisions) == 1)
    for convention in ('raw', 'normalized'):
        report = cert[convention]
        _require(type(report) is dict and frozenset(report) == _REPORT_KEYS)
        first, ties, axes = report['firstExactMinimum'], report['exactTiedMinima'], report['axes']
        _require(type(first) is int and 0 <= first < 15)
        _require(type(ties) is list and 1 <= len(ties) <= 15)
        _require(all(type(index) is int and 0 <= index < 15 for index in ties))
        _require(ties == sorted(set(ties)) and first == ties[0])
        _require(type(axes) is list and len(axes) == 15)
        for index, axis in enumerate(axes):
            _require(type(axis) is dict and frozenset(axis) == _AXIS_KEYS)
            _require(type(axis['axis']) is int and axis['axis'] == index)
            _require(type(axis['exactZero']) is bool and type(axis['nearParallel']) is bool)
            if axis['exactZero']:
                _require(axis['nearParallel'] is False and axis['marginSign'] is None)
            else:
                _require(type(axis['marginSign']) is int and axis['marginSign'] in (-1, 0, 1))
    return cert


def certificate_width(record):
    """Same exact-width diagnostic, bound only to the closed V3 schema."""
    intervals = _certificate(record)['numericIntervals'].values()
    return float(max(Fraction(int(item['high']) - int(item['low']), 1 << item['precision']) for item in intervals))


def certificate_ok(record, stage):
    """V3-only world gate; the independent validator still audits all cells."""
    try:
        if stage not in ('PRE', 'HYP'):
            return False
        cert = _certificate(record)
        names = {'rawNormalizedDepthDifferenceM', 'rawNormalizedMarginDifferenceM'}
        if stage == 'HYP':
            names |= {'rawDepthM', 'normalizedDepthM'}
        gates = cert['physicalGates']
        if type(gates) is not dict or set(gates) != names or any(value != 'PASS' for value in gates.values()):
            return False
        for item in cert['numericIntervals'].values():
            low = Fraction(int(item['low']), 1 << item['precision'])
            high = Fraction(int(item['high']), 1 << item['precision'])
            if low > high or high - low > Fraction(1, 10**25):
                return False
        return True
    except (ValueError, TypeError, KeyError, ZeroDivisionError, OverflowError):
        return False
