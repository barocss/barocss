"""Explicit compact-observer V2; no old SAT, QP, or observer calls."""
import struct

PROTOCOL = 'p4-compact-observer-v2'
FIELDS = ('rawMarginM', 'normalizedMarginM', 'rawDepthM', 'normalizedDepthM',
          'rawNormalizedMarginDifferenceM', 'rawNormalizedDepthDifferenceM')
SELECTION = ('normal', 'boundM', 'candidateIndex', 'pointM', 'rawAxisLength', 'label', 'feature')
TEN25 = 10_000_000_000_000_000_000_000_000


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
        ri, ni = k.interval(raw, precision, m), k.interval(normalized, precision, m)
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
    raise k.MicroFailure('V2_CERTIFICATE_UNRESOLVED')


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
    record['satCertificateV2'] = dict(protocol=PROTOCOL, numericIntervals=fields,
        raw=raw_report, normalized=normalized_report, physicalGates=gates,
        absoluteIntervalWidthLimitM='1e-25', axisArithmetic='EXACT_INTEGER_ALL_15_AXES_BOTH_MODELS',
        omittedLegacyField='precisionMaxDifferenceM', oldDecimalRuns=0,
        exactWinnerUsedForScalarSelection=False, scalarCandidateAxes=15)
    return record
