"""ROOT ONLY: independent full V3 validator. No candidate module is imported."""
import sys
import time
import support
from pathlib import Path
from fractions import Fraction
from comparison import Comparison
from geometry import bind, pairs
from intervals import FIELDS, verify
from support import AUDIT_LIMIT, SCRATCH, HERE, ROOT, allocation, arm, authenticate, json_file_bound, module, need, pin, read, same, write


def run(case_id, request_path, reply_path, kernel_path):
    pins = authenticate()
    bank = read(ROOT / 'examples/physics-p4-position-witness-reference-2276/bank.json')
    frame = next((f for f in bank['frames'] if f['id'] == case_id), None)
    need(frame is not None, 'ORIGINAL_SIX_CASE_ID')
    original = read(ROOT / frame['request'], bank['sourcePins'][frame['request']])
    saved = read(ROOT / frame['positionV2Authority'], bank['sourcePins'][frame['positionV2Authority']])
    request, actual, kernel = read(request_path), read(reply_path), read(kernel_path)
    same(request, original, 'AUTHENTICATED_ORIGINAL_FULL_REQUEST')
    need(actual['ok'] is True and actual['resolved'] is True and actual['executionFailure'] is False and
         actual['referenceStatus'] == 'SOLVED' and actual['violations'] == [], 'FULL_SUCCESS_ENVELOPE')

    old = module('independent_v3_old_kkt_checker', 'examples/physics-p4-position-witness-reference-2276/checker.py')
    old.START, old.READ = time.monotonic(), 0
    exact = old.Exact()
    kernel_request_path = ROOT / 'examples/physics-p4-position-witness-reference-2276/evidence/bank-01' / ('kernel-' + case_id + '.json')
    need(pin(kernel_request_path) == pins['sources'][str(kernel_request_path.relative_to(ROOT))], 'IMMUTABLE_KERNEL_REQUEST_PIN')
    kernel_request = read(kernel_request_path)
    helper_paths = (ROOT / 'examples/physics-p4-position-witness-reference-2276/bank.json',
                    ROOT / frame['request'], ROOT / frame['coldAuthority'], kernel_request_path,
                    kernel_path, ROOT / bank['runtimeLayoutAuthority'])
    helper_bound = sum(json_file_bound(path) for path in helper_paths)
    bounded_peak = support.PREALLOCATED + helper_bound + SCRATCH
    need(bounded_peak <= AUDIT_LIMIT, 'OLD_KERNEL_HELPER32_PREALLOCATION')
    initial_retained = allocation((pins, bank, original, saved, request, actual, kernel, kernel_request))
    need(initial_retained + helper_bound + SCRATCH <= AUDIT_LIMIT, 'OLD_KERNEL_HELPER32_OBSERVED_PREFLIGHT')
    kernel_audit = old.check('kernel', case_id, kernel_request_path, kernel_path, exact)
    same(kernel_request, {'op': 'kernel', 'problem': request['problem'], 'result': request['result']}, 'KERNEL_TO_FULL_REQUEST_BINDING')
    reference = actual['reference']
    for key, value in kernel['certificate'].items():
        if key not in ('stationarityExactKgM', 'complementarityExactKgM2'):
            same(reference[key], value, 'ACTUAL_IN_CALL_KERNEL_CERTIFICATE/' + key)
    same(reference['proofCounters'], kernel['proofCounters'], 'ACTUAL_IN_CALL_KERNEL_COUNTERS')
    same({k: actual['metrics'][k] for k in old.KERNEL_METRICS}, kernel['metrics'], 'ACTUAL_IN_CALL_KERNEL_METRICS')
    need(reference['arithmetic'] == 'guarded exact witness; one fraction-free factorization; all-row KKT' and
         reference['proofAuthority'] == 'exact-global-KKT-with-untrusted-native-basis', 'DECLARED_KKT_AUTHORITY')
    same(reference['witnessProvenance'], {'source': 'request.result.basisRows', 'trusted': False,
         'usedAsSearchSeed': False, 'basisRows': request['result']['basisRows']}, 'OBSERVED_WITNESS_PROVENANCE')
    need(saved['reference']['arithmetic'] == 'guarded exact Fraction; cold elastic LP then primal QP' and
         'counters' not in reference, 'NO_FABRICATED_COLD_COUNTERS')
    need(actual['referenceProtocol'] == 'p4-position-witness-direct-grid-v3' and
         saved['referenceProtocol'] == 'p4-full-position-observer-v2', 'EXPLICIT_OUTER_PROTOCOL_CHANGE')
    validated = {path: True for path in ('/referenceProtocol', '/reference/arithmetic',
        '/reference/proofCounters', '/reference/proofAuthority', '/reference/witnessProvenance', '/reference/counters')}

    pre, hyp = bind(request, actual)
    order = pairs(request)
    geometry = module('independent_v3_pinned_old_sat_geometry', 'examples/physics-p4-sat-2276/integer_sat.py')
    meter = geometry.Meter()
    widths = []
    pair_count = word_count = 0
    for phase, stage, bodies in (('prePairs', 'PRE', pre), ('hypPairs', 'HYP', hyp)):
        prepared = [geometry.prepare(body, meter) for body in bodies]
        need(len(reference[phase]) == len(saved['reference'][phase]) == 36, 'ALL_36_PAIRS_PER_STAGE')
        for i, (record, authority, row) in enumerate(zip(reference[phase], saved['reference'][phase], order)):
            a, b = row['aIndex'], row['bIndex']
            key = row['pairKey']
            need(key == record['pairKey'] == authority['pairKey'] and
                 request['problem']['rows'][i]['aId'] == bodies[a]['id'] and
                 request['problem']['rows'][i]['bId'] == bodies[b]['id'], 'AUTHENTICATED_PAIR_GEOMETRY_BINDING')
            raw, raw_report = geometry.solve_model(prepared[a], prepared[b], False, meter)
            normalized, normalized_report = geometry.solve_model(prepared[a], prepared[b], True, meter)
            cert = record['satCertificateV3']
            same(cert['raw'], raw_report, 'REUSED_GEOMETRY_ALL_RAW_AXES/' + key)
            same(cert['normalized'], normalized_report, 'REUSED_GEOMETRY_ALL_NORMALIZED_AXES/' + key)
            widths.append(verify(record, authority, raw, normalized, stage))
            base = '/reference/' + phase + '/' + str(i) + '/satCertificateV3'
            validated[base + '/protocol'] = True
            validated[base + '/enclosureAlgorithm'] = True
            for field in FIELDS:
                for name in ('low', 'high', 'precision'):
                    validated[base + '/numericIntervals/' + field + '/' + name] = True
            pair_count += 1
            word_count += 6
    stats = meter.stats()
    need(stats['axisVisits'] == 2160 and stats['conventionProblems'] == 144 and
         stats['integerOperations'] <= 2000000 and stats['peakIntegerBits'] <= 16384,
         'COMPLETE_REUSED_GEOMETRY_CENSUS_AND_BOUNDS')
    maximum = max(widths)
    need(maximum <= Fraction(1, 10**25), 'GLOBAL_EXACT_WIDTH_GATE')
    same(actual['metrics']['maxCertifiedSatWidthM'], float(maximum), 'DERIVED_MAXIMUM_WIDTH_METRIC')
    validated['/metrics/maxCertifiedSatWidthM'] = True
    comparison = Comparison(validated)
    comparison.walk(actual, saved)
    census = comparison.result()
    retained = allocation((pins, bank, original, saved, request, actual, kernel, kernel_request,
                          kernel_audit, validated, comparison, widths, prepared, pre, hyp,
                          meter, stats, raw, normalized, raw_report, normalized_report,
                          exact.counts, exact.categories))
    need(retained + SCRATCH <= AUDIT_LIMIT, 'FULL_VALIDATOR_AUDIT32_PLUS_SCRATCH')
    bounded_peak = max(bounded_peak, support.PREALLOCATED + SCRATCH, retained + SCRATCH)
    need(bounded_peak <= AUDIT_LIMIT, 'FULL_VALIDATOR_AUDIT32_BOUNDED_PEAK')
    return {'caseId': case_id, 'requestPin': pin(request_path), 'replyPin': pin(reply_path),
            'actualInCallKernelReplyPin': pin(kernel_path), 'immutableKernelRequestPin': pin(kernel_request_path),
            'savedV2AuthorityPin': pin(ROOT / frame['positionV2Authority']),
            'compactRecordsVerified': pair_count, 'numericWordsVerified': word_count,
            'conventionProblemsVerified': stats['conventionProblems'], 'axisVisitsVerified': stats['axisVisits'],
            'geometryAuthority': 'AUTHENTICATED_OLD_GEOMETRY_COMPONENT_REUSE_NOT_NEW_INDEPENDENT_GEOMETRY_ORACLE',
            'savedAxesAuthority': 'IMMUTABLE_OLD_COMPONENT_REGRESSION_WITH_COLD_PHYSICAL_PAYLOAD_AUTHORITY',
            'geometryComponentStats': stats, 'kernelIndependentAudit': kernel_audit,
            'kernelIndependentCounters': exact.counts, 'kernelIndependentPrimitiveCategories': exact.categories,
            'closedLeafCensus': census, 'maximumWidthExact': str(maximum.numerator) + '/' + str(maximum.denominator),
            'explicitRetainedBytes': retained, 'scratchReservedBytes': SCRATCH,
            'combinedAuditLimitBytes': AUDIT_LIMIT, 'helperWorkingGraphBoundBytes': helper_bound,
            'observedRetainedPeakBytes': max(initial_retained, retained),
            'boundedPeakOwnedBytes': bounded_peak,
            'peakDefinition': 'PHASE_CHECKPOINTS_PLUS_CONSERVATIVE_HELPER_PREFLIGHT_NOT_RSS',
            'newIntervalRootCalls': 0, 'coldQpCalls': 0,
            'WorldCalls': 0, 'candidateCallsByValidator': 0}


def main():
    arm()
    need(len(sys.argv) == 6, 'USAGE: validator.py CASE FULLREQUEST FULLREPLY ACTUAL_KERNEL_REPLY OUT')
    case_id = sys.argv[1]
    request_path, reply_path, kernel_path, output_path = map(Path, sys.argv[2:])
    report = {'protocol': 'p4-full-direct-grid-reference-v1',
              'status': 'EXECUTED_NO_GO_FULL_DIRECT_GRID_REFERENCE', 'firstFailure': None,
              'caseId': case_id, 'WorldCalls': 0, 'coldQpCalls': 0, 'candidateCallsByValidator': 0}
    exit_status = 1
    try:
        report['audit'] = run(case_id, request_path, reply_path, kernel_path)
        report['status'] = 'EXECUTED_PASS_FULL_DIRECT_GRID_REFERENCE'
        exit_status = 0
    except Exception as error:
        report['firstFailure'] = {'type': type(error).__name__, 'reason': str(error)[:1024]}
    write(output_path, report)
    return exit_status


if __name__ == '__main__':
    sys.exit(main())
