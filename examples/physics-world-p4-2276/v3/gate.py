#!/usr/bin/env python3
"""Six CURRENT native raw replies, after frozen SAT-scoped controls PASS."""
import argparse
import copy
import hashlib
import importlib.util
from pathlib import Path
import platform
import re
import signal
import sys
import time

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
CONTROLS_SOURCE_SHA = '4c2093c6c1bead610223c66f48dbb36af797b51035016d1de6551f268c124463'


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


if hashlib.sha256((HERE / 'controls.py').read_bytes()).hexdigest() != CONTROLS_SOURCE_SHA:
    raise RuntimeError('v3 DATA/auth controls provider differs before import')
D = load(HERE / 'controls.py', 'v2_scoped_control_data_only')
C = D.C


def primitive_authority(path, digest):
    data = C.read_bound(path, 8 * C.MIB)
    C.need(re.fullmatch('[0-9a-f]{64}', digest) and D.sha(data) == digest, 'v2 control receipt hash differs from parent freeze')
    value = C.strict_json(data)
    C.need(value['status'] == 'PASS_ACCOUNTING_CACHE_CONTROLS' and value['groupsCompleted'] == 12 and
           len(value['groups']) == 12 and all(x['passed'] is True for x in value['groups']) and
           value['firstFailure'] is None and value['totalSatAttempts'] == 24 and
           value['totalOriginalSupportAttempts'] <= 720, 'all frozen paired SAT controls must pass before full math')
    C.need(value['counts'] == {'baselineSatAttempts': 12, 'candidateSatAttempts': 12,
                              'baselineOriginalSupportAttempts': 273, 'candidateOriginalSupportAttempts': 221,
                              'candidateLogicalSupportCalls': 273, 'candidateHits': 52}, 'v2 actual paired population differs')
    C.need(C.difference(D.source_pins(), value['sources']) is None, 'current v2 provider graph differs from tested controls')
    D.check_pins(value['sources'])
    return value


def run(run_id, controls, controls_sha):
    C.need(re.fullmatch('[a-z0-9][a-z0-9-]{0,95}', run_id), 'invalid fresh v3 gate ID')
    out = HERE / 'evidence' / run_id; out.mkdir(parents=True, exist_ok=False)
    started = time.monotonic_ns(); charged = 0; current = None; cache = sat = None
    counts = {'evaluateAttempted': 0, 'evaluateReturned': 0, 'currentRawMatched': 0}
    summary = {'workId': 'physics-world-p4-accounting-cache-v3-2276', 'runId': run_id,
               'status': 'IN_PROGRESS', 'numericStatus': 'NOT_RUN', 'costStatus': 'NOT_RUN', 'counts': counts,
               'priorActualFullEvaluations': 38, 'cases': [], 'firstFailure': None,
               'WorldCalls': 0, 'productionSolverCalls': 0, 'fixtureCalls': 0, 'trigCalls': 0, 'NodeProjectionCalls': 0,
               'preservedV1NumericStatus': 'NUMERIC_EQ_PASS', 'preservedV1CostStatus': 'COST_NO_GO',
               'oldRawCensusStatus': 'FAIL_PRESERVED', 'historicalPreArchiveReplyZeroSigns': 'UNKNOWN'}
    def put(name, data):
        nonlocal charged
        C.need(charged + len(data) <= 32 * C.MIB, 'v3 gate32MiB evidence ceiling')
        with (out / name).open('xb') as stream:
            stream.write(data)
        charged += len(data)
    def progress():
        (out / 'progress.json').write_bytes(C.encoded(summary))
    def deadline(_signum, _frame):
        raise C.CensusFailure('170s v3 six-reference deadline')
    previous = signal.signal(signal.SIGALRM, deadline); signal.setitimer(signal.ITIMER_REAL, 170)
    try:
        recipe, authority, cases = D.authenticate()
        primitive = primitive_authority(controls.resolve(), controls_sha)
        pins = D.source_pins()
        summary.update(authority=authority, sources=pins, bounds=recipe['defaultBounds'], primitiveGate={
            'path': str(controls.resolve()), 'sha256': controls_sha, 'counts': primitive['counts'],
            'totalSatAttempts': primitive['totalSatAttempts'], 'totalOriginalSupportAttempts': primitive['totalOriginalSupportAttempts']})
        executable = Path(sys.executable).resolve()
        summary['python'] = {'executable': str(executable), 'version': sys.version, 'platform': platform.platform(),
                             'executableSha256': D.sha(C.read_bound(executable, 256 * C.MIB))}
        progress()
        core = D.load(HERE / 'accounting-cache.py', 'frozen_v2_scoped_cache_full_gate')
        C.need(core.DEFAULT_BOUNDS == recipe['defaultBounds'], 'full gate core bounds differ')
        summary['sourceTransferProof'] = core.transfer_proof()
        summary['accountingMeaning'] = {'owned_bytes': 'conservative owned upper bound', 'peak_owned_bytes': 'peak conservative upper bound', 'measuredAllocationSumBytes': 'actual sizeof observations; shared immutable objects may count twice; not unique heap/RSS', 'bookkeepingUpperBoundBytes': 262144}
        import_wall = time.monotonic_ns()
        position = D.load(C.safe_path(C.REFERENCE_PATHS[3]), 'unchanged_position_for_v2_full_gate')
        summary['referenceImportWallNs'] = time.monotonic_ns() - import_wall
        sat = position.PARENT.PARENT.SAT
        C.need(Path(sat.__file__).resolve() == C.safe_path(D.SAT_PATH), 'wrong actual SAT module instance')
        original_sat, original_support = sat.sat_pair, sat.support_radius
        for case in cases:
            current = {'scene': case['scene'], 'step': case['step'], 'recordLocator': case['recordLocator'],
                       'sourceDirectory': case['sourceDirectory'], 'sourceLocators': case['record']['locators']}
            name = case['scene'] + '-' + str(case['step'])
            before = C.encoded(case['request'])
            record = {**current, 'uncachedCpuNs': case['record']['timing']['computeCpuNs'],
                      'uncachedWallNs': case['record']['timing']['computeWallNs'], 'timing': {}, 'returned': False,
                      'candidateContextBefore': D.context_snapshot(D.getcontext(), core.SIGNALS)}
            summary['cases'].append(record); progress()
            returned = None; primary_error = None; cleanup_errors = []; cache = None
            prep_wall, prep_cpu = time.monotonic_ns(), time.process_time_ns()
            try:
                cache = core.SatScopedCache(sat, dict(recipe['defaultBounds'])); cache.clear(); cache.install()
                record['timing'].update(preparationCpuNs=time.process_time_ns() - prep_cpu,
                                        preparationWallNs=time.monotonic_ns() - prep_wall)
                counts['evaluateAttempted'] += 1; progress()
                wall, cpu = time.monotonic_ns(), time.process_time_ns()
                try:
                    returned = position.evaluate(case['request'])
                finally:
                    record['timing'].update(evaluateCpuNs=time.process_time_ns() - cpu,
                                            evaluateWallNs=time.monotonic_ns() - wall)
                counts['evaluateReturned'] += 1; record['returned'] = True
                raw = C.encoded(returned); put(name + '.stdout.raw', raw)
            except BaseException as error:
                primary_error = error
            finally:
                finish_wall, finish_cpu = time.monotonic_ns(), time.process_time_ns()
                if cache is not None:
                    cache.restore()
                    try:
                        record['ownershipEndAudit'] = cache.audit()
                        record['cacheStats'] = cache.stats()
                    except BaseException as error: cleanup_errors.append({'phase': 'stats', 'type': type(error).__name__, 'message': str(error)})
                    try:
                        cache.clear(); record['afterClearStats'] = cache.stats()
                    except BaseException as error: cleanup_errors.append({'phase': 'clear/stats', 'type': type(error).__name__, 'message': str(error)})
                sat.sat_pair = original_sat; sat.support_radius = original_support
                record['timing'].update(finishCpuNs=time.process_time_ns() - finish_cpu,
                                        finishWallNs=time.monotonic_ns() - finish_wall)
                record['cleanupErrors'] = cleanup_errors
                record['candidateContextAfter'] = D.context_snapshot(D.getcontext(), core.SIGNALS)
                record['originalEvaluationException'] = None if primary_error is None else {'type': type(primary_error).__name__, 'message': str(primary_error)}
                put(name + '.prefix.json', C.encoded(record)); progress()
            if primary_error is not None: raise primary_error
            C.need(not cleanup_errors, 'v2 cache accounting/clear failure')
            D.validate_stats(record['cacheStats'], recipe['defaultBounds'])
            empty = record['afterClearStats']
            C.need(empty['pair_entries'] == empty['stage_entries'] == empty['encoded_key_bytes'] == empty['sat_attempts'] == 0,
                   'request cache did not clear')
            C.need(sat.sat_pair is original_sat and sat.support_radius is original_support and cache._active is None,
                   'actual original SAT/support pointers or scope not restored')
            input_diff = C.difference(C.strict_json(before), case['request'])
            difference = C.difference(case['expected'], returned)
            record.update(inputUnchanged=input_diff is None, firstInputDifference=input_diff,
                          currentRawBytesEqual=raw == case['rawExpected'], fullNumberBitsEqual=difference is None,
                          firstResponseDifference=difference, rawReplySha256=D.sha(raw),
                          independentReferenceCounterTrees=C.counter_trees(returned))
            timing = record['timing']
            timing['pairedCachedCpuNs'] = timing['preparationCpuNs'] + timing['evaluateCpuNs'] + timing['finishCpuNs']
            timing['pairedCachedWallNs'] = timing['preparationWallNs'] + timing['evaluateWallNs'] + timing['finishWallNs']
            record['observedCpuDeltaNs'] = timing['pairedCachedCpuNs'] - record['uncachedCpuNs']
            put(name + '.comparison.json', C.encoded(record)); progress()
            C.need(input_diff is None and difference is None and record['currentRawBytesEqual'], 'first v2 caller/current raw mismatch')
            counts['currentRawMatched'] += 1
        C.need(counts == {'evaluateAttempted': 6, 'evaluateReturned': 6, 'currentRawMatched': 6}, 'incomplete six CURRENT raw gate')
        baseline = sum(x['uncachedCpuNs'] for x in summary['cases'])
        candidate = sum(x['timing']['pairedCachedCpuNs'] for x in summary['cases'])
        C.need(baseline == 885643000, 'original uncached aggregate cost authority differs')
        D.check_pins(pins); primitive_authority(controls.resolve(), controls_sha)
        for path, wanted in authority['providerPins'].items():
            C.need(D.sha(C.read_bound(C.safe_path(path), 2 * C.MIB)) == wanted, 'original reference provider changed')
        summary['pairedCpu'] = {'uncachedTotalNs': baseline, 'candidateTotalNs': candidate, 'deltaNs': candidate - baseline,
                                'observedReductionFraction': 1 - candidate / baseline,
                                'singlePriorFreshPairing': True, 'perFrameNonRegressionClaimed': False}
        summary['numericStatus'] = 'NUMERIC_EQ_PASS'; summary['costStatus'] = 'COST_GO' if candidate < baseline else 'COST_NO_GO'
        summary['status'] = 'PASS_ACCOUNTING_CACHE_GATE' if candidate < baseline else 'NUMERIC_EQ_PASS_COST_NO_GO'
        summary['specificCacheSliceEnded'] = candidate >= baseline
        summary['furtherCacheIterationAuthorized'] = False
    except BaseException as error:
        summary['status'] = 'FAIL'; summary['numericStatus'] = 'NUMERIC_EQ_INCOMPLETE_OR_FAIL'
        summary['firstFailure'] = {'type': type(error).__name__, 'message': str(error), 'reached': copy.deepcopy(current), 'counts': dict(counts)}
    finally:
        if cache is not None: cache.restore()
        signal.setitimer(signal.ITIMER_REAL, 0); signal.signal(signal.SIGALRM, previous)
        summary['studyActualFullEvaluations'] = 38 + counts['evaluateAttempted']
        summary['elapsedWallNs'] = time.monotonic_ns() - started; summary['chargedArtifactBytes'] = charged
        summary['fullRequestUncachedContextFlagsCaptured'] = False
        summary['contextProof'] = 'Frozen paired controls and actual per-stage incoming/postflag observations; no historical full-request Context flag proof invented.'
        progress(); put('summary.json', C.encoded(summary))
    return 0 if summary['status'] in ('PASS_ACCOUNTING_CACHE_GATE', 'NUMERIC_EQ_PASS_COST_NO_GO') else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-id', required=True); parser.add_argument('--controls', type=Path, required=True)
    parser.add_argument('--controls-sha256', required=True)
    args = parser.parse_args(); sys.exit(run(args.run_id, args.controls, args.controls_sha256))
