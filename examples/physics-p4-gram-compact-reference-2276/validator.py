"""ROOT ONLY: independent full Gram validator. No candidate module is imported."""
import sys
import time
import support
from pathlib import Path
from fractions import Fraction
from comparison import Comparison
from geometry import bind, pairs
from intervals import FIELDS, verify
from support import AUDIT_LIMIT, SCRATCH, NONJSON, GENERATED, HERE, ROOT, arm, authenticate, module, need, pin, read, same, write


def leaf_census(value):
    leaves = words = 0
    def visit(item):
        nonlocal leaves, words
        if type(item) is dict:
            for key in item:
                visit(item[key])
        elif type(item) is list:
            for child in item:
                visit(child)
        else:
            leaves += 1
            words += type(item) in (int, float)
    visit(value)
    return {'allLeavesExact': True, 'leavesCompared': leaves,
            'numericLeavesComparedByF64Word': words, 'numericExceptions': 0,
            'normalization': False, 'subtreeExclusion': False}


def run(case_id, request_path, reply_path, kernel_path):
    pins = authenticate()
    bank = read(ROOT / 'examples/physics-p4-position-witness-reference-2276/bank.json')
    frame = next((f for f in bank['frames'] if f['id'] == case_id), None)
    need(frame is not None, 'ORIGINAL_SIX_CASE_ID')
    # Authenticate original actual bytes BEFORE the one request decode. No
    # second original request graph or normalized/harness replacement exists.
    original_pin = bank['sourcePins'][frame['request']]
    need(pin(request_path) == original_pin, 'ACTUAL_CANONICAL_REQUEST_BYTES')
    request = read(request_path, original_pin)
    actual, kernel = read(reply_path), read(kernel_path)
    prior_path = ROOT / 'examples/physics-p4-radical-compact-harness-2276/evidence/full-b-01/full-bank' / (case_id + '-reply.json')
    prior = read(prior_path, pins['sources'][str(prior_path.relative_to(ROOT))])
    same(actual, prior, 'COMPLETE_PRIOR_ACTUAL_V3_NO_EXCEPTIONS')
    prior_census = leaf_census(actual)
    prior_pin = pin(prior_path)
    del prior
    support.drop(prior_path)
    saved = read(ROOT / frame['positionV2Authority'], bank['sourcePins'][frame['positionV2Authority']])
    need(actual['ok'] is True and actual['resolved'] is True and actual['executionFailure'] is False and
         actual['referenceStatus'] == 'SOLVED' and actual['violations'] == [], 'FULL_SUCCESS_ENVELOPE')

    old = module('independent_v3_old_kkt_checker', 'examples/physics-p4-position-witness-reference-2276/checker.py')
    old.START, old.READ = time.monotonic(), 0
    exact = old.Exact()
    kernel_request_path = ROOT / 'examples/physics-p4-position-witness-reference-2276/evidence/bank-01' / ('kernel-' + case_id + '.json')
    need(pin(kernel_request_path) == pins['sources'][str(kernel_request_path.relative_to(ROOT))], 'IMMUTABLE_KERNEL_REQUEST_PIN')
    kernel_request = read(kernel_request_path)
    # The old checker reads exactly these already owned documents. Its
    # transport/memory entry points are adapted; mathematical functions stay
    # byte-identical. No old world checker or old V3 support is imported.
    read(ROOT / frame['coldAuthority'], bank['sourcePins'][frame['coldAuthority']])
    read(ROOT / bank['runtimeLayoutAuthority'], bank['sourcePins'][bank['runtimeLayoutAuthority']])
    original_path = (ROOT / frame['request']).resolve()
    old_read = support.read
    def owned_read(path, expected=None):
        if Path(path).resolve() == original_path:
            need(expected is None or expected == original_pin, 'OLD_HELPER_ORIGINAL_PIN')
            return request, original_pin
        value = old_read(path, expected)
        return value, pin(path)
    old.read = owned_read
    # OLD allocation was merely its separate64MiB input-memory admission.
    # Return a conservative declared input bound under NEW actual32MiB
    # ownership. No walker or ID set is live in the kernel scratch phase.
    old.allocation = lambda value, seen=None: NONJSON
    with support.BUDGET.kernel_helper_phase(0):
        kernel_audit = old.check('kernel', case_id, kernel_request_path, kernel_path, exact)
    kernel_audit.pop('explicitRetainedBytes')
    kernel_audit['kernelInputReservationBytes'] = NONJSON
    kernel_audit['memoryAdapter'] = 'PREOWNED_DOCUMENTS_AND_FIXED_CLOSED_INPUT_BOUND'
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

    with support.BUDGET.kernel_helper_phase(0):
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
    ownership = support.measure((pins, bank, saved, request, actual, kernel, kernel_request,
                          kernel_audit, validated, comparison, widths, prepared, pre, hyp,
                          meter, stats, raw, normalized, raw_report, normalized_report,
                          exact, exact.counts, exact.categories, support.DOCUMENTS,
                          support.MEASUREMENTS),
                         (geometry.Box, geometry.Basis, geometry.Margin, geometry.Meter,
                          Comparison, old.Exact))
    need(ownership['ownedBytes'] <= NONJSON, 'COMPLETE_RETAINED_NONJSON8')
    bounded_peak = support.BUDGET.peakReservedBytes + NONJSON
    need(bounded_peak <= AUDIT_LIMIT, 'COMPLETE_AUDIT32_PREALLOCATION')
    return {'caseId': case_id, 'requestPin': pin(request_path), 'replyPin': pin(reply_path),
            'actualInCallKernelReplyPin': pin(kernel_path), 'immutableKernelRequestPin': pin(kernel_request_path),
            'savedV2AuthorityPin': pin(ROOT / frame['positionV2Authority']),
            'priorActualV3AuthorityPin': prior_pin, 'sameV3Comparison': prior_census,
            'compactRecordsVerified': pair_count, 'numericWordsVerified': word_count,
            'conventionProblemsVerified': stats['conventionProblems'], 'axisVisitsVerified': stats['axisVisits'],
            'geometryAuthority': 'AUTHENTICATED_OLD_GEOMETRY_COMPONENT_REUSE_NOT_NEW_INDEPENDENT_GEOMETRY_ORACLE',
            'gramAlgebraAuthority': 'OLD_DIRECT_CROSS_DOT_DISTINCT_FROM_NEW_PAIR_FACTORIZATION',
            'savedAxesAuthority': 'IMMUTABLE_OLD_COMPONENT_REGRESSION_WITH_COLD_PHYSICAL_PAYLOAD_AUTHORITY',
            'geometryComponentStats': stats, 'kernelIndependentAudit': kernel_audit,
            'kernelIndependentCounters': exact.counts, 'kernelIndependentPrimitiveCategories': exact.categories,
            'closedLeafCensus': census, 'maximumWidthExact': str(maximum.numerator) + '/' + str(maximum.denominator),
            'explicitRetainedBytes': ownership['ownedBytes'], 'scratchReservedBytes': SCRATCH,
            'combinedAuditLimitBytes': AUDIT_LIMIT, 'helperWorkingGraphBoundBytes': SCRATCH,
            'ownedDataMeasurement': ownership,
            'observedRetainedPeakBytes': max(support.COMPLETE_OBSERVED_PEAK, ownership['ownedBytes']),
            'boundedPeakOwnedBytes': bounded_peak,
            'nonJSONReservationBytes': NONJSON, 'generatedWithinNonJSONBoundBytes': GENERATED,
            'jsonBudgetIncludingSharedScratchBytes': AUDIT_LIMIT - NONJSON,
            'walkerAndHelperScratchConcurrent': False,
            'memoryAuthority': 'QUALIFIED_ACTUAL_REFERENCES_WITH_PREDECLARED_COPY_TRANSFER',
            'peakDefinition': 'RESERVED_PEAK_AND_ACTUAL_PHASE_WALKS_NOT_RSS',
            'newIntervalRootCalls': 0, 'coldQpCalls': 0,
            'WorldCalls': 0, 'candidateCallsByValidator': 0}


def main():
    arm()
    need(len(sys.argv) == 6, 'USAGE: validator.py CASE FULLREQUEST FULLREPLY ACTUAL_KERNEL_REPLY OUT')
    case_id = sys.argv[1]
    request_path, reply_path, kernel_path, output_path = map(Path, sys.argv[2:])
    report = {'protocol': 'p4-full-gram-reference-v1',
              'status': 'EXECUTED_NO_GO_FULL_GRAM_REFERENCE', 'firstFailure': None,
              'caseId': case_id, 'WorldCalls': 0, 'coldQpCalls': 0, 'candidateCallsByValidator': 0}
    exit_status = 1
    try:
        report['audit'] = run(case_id, request_path, reply_path, kernel_path)
        report['status'] = 'EXECUTED_PASS_FULL_GRAM_REFERENCE'
        exit_status = 0
    except Exception as error:
        report['firstFailure'] = {'type': type(error).__name__, 'reason': str(error)[:1024]}
    write(output_path, report)
    return exit_status


if __name__ == '__main__':
    sys.exit(main())
