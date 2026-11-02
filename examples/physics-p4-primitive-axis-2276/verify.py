"""Complete saved-reply audit with only declared certificate metadata changes."""
from fractions import Fraction
import math


def verify(reply, saved, compact_observer):
    same = compact_observer.same
    if reply.get('referenceProtocol') != 'p4-full-position-observer-v2':
        raise ValueError('POSITION_V2_PROTOCOL_REQUIRED')
    if set(reply) != set(saved) | {'referenceProtocol'}:
        raise ValueError('UNEXPLAINED_REPLY_FIELDS')
    leaves = 0
    for name in set(saved) - {'metrics', 'reference'}:
        leaves += same(reply[name], saved[name], '/' + name)
    actual_metrics, old_metrics = reply['metrics'], saved['metrics']
    if 'precisionMaxDifferenceM' not in old_metrics or 'maxCertifiedSatWidthM' not in actual_metrics:
        raise ValueError('EXPLICIT_METRIC_REPLACEMENT_REQUIRED')
    if set(actual_metrics) != (set(old_metrics) - {'precisionMaxDifferenceM'}) | {'maxCertifiedSatWidthM'}:
        raise ValueError('UNEXPLAINED_METRIC_FIELDS')
    for name in set(old_metrics) - {'precisionMaxDifferenceM'}:
        leaves += same(actual_metrics[name], old_metrics[name], '/metrics/' + name)
    actual, old = reply['reference'], saved['reference']
    if set(actual) != set(old):
        raise ValueError('UNEXPLAINED_REFERENCE_FIELDS')
    for name in set(old) - {'prePairs', 'hypPairs'}:
        leaves += same(actual[name], old[name], '/reference/' + name)
    pairs = words = 0
    widths = []
    for key, stage in (('prePairs', 'PRE'), ('hypPairs', 'HYP')):
        if len(actual[key]) != 36 or len(old[key]) != 36:
            raise ValueError('ALL_36_REFERENCE_PAIRS_REQUIRED')
        for candidate, authority in zip(actual[key], old[key]):
            checked = compact_observer.verify(candidate, authority, stage)
            pairs += 1
            words += checked['numericWords']
            leaves += checked['retainedPayloadLeaves']
            widths.extend(Fraction(int(i['high']) - int(i['low']), 1 << i['precision'])
                          for i in candidate['satCertificateV2']['numericIntervals'].values())
    maximum = max(widths)
    metric = actual_metrics['maxCertifiedSatWidthM']
    if not math.isfinite(metric) or maximum > Fraction(1, 10**25):
        raise ValueError('RIGOROUS_WIDTH_BOUND')
    same(metric, float(maximum), '/metrics/maxCertifiedSatWidthM')
    return dict(compactRecordsVerified=pairs, numericWordsVerified=words,
                retainedPayloadLeavesVerified=leaves, maximumWidthM=float(maximum),
                fullRetainedPhysicalReplyCompatible=True, oldPrecisionMetadataReconstructed=False)
