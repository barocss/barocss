"""Root-only bounded Stage A/B orchestration. No candidate/checker definition imports."""
import json
import math
from pathlib import Path
import re
import signal
import sys
import time

from bounds import Evidence, authenticate, command, pin, require, retained_size, REPLY_BYTES, EVIDENCE_BYTES
from physical import compare_world, compare

HOME = Path(__file__).resolve().parent
ROOT = HOME.parents[1]
CANDIDATE = ROOT / 'examples/physics-p4-native-witness-2276'
REFERENCE = ROOT / 'examples/physics-p4-position-witness-reference-2276'
FRAME_IDS = ['ALIGNED-1', 'ALIGNED-16', 'OFFSET-1', 'OFFSET-16', 'YAW-1', 'YAW-16']
A_ORDER = ['ALIGNED-1', 'control-duplicate-index', 'control-dependent-original-row1',
           'control-omit-ground-row7', 'control-reported-translation'] + FRAME_IDS[1:]


def read_json(path, cap=REPLY_BYTES, retained=()):
    require(path.stat().st_size <= cap, 'JSON_FILE_LIMIT:' + str(path))
    raw = path.read_bytes()
    # Conservative syntax-token reservation before json.loads. No numerical decoding here.
    tokens, depth, in_string, escape, atom = 0, 0, False, False, False
    for byte in raw:
        if in_string:
            if escape:
                escape = False
            elif byte == 92:
                escape = True
            elif byte == 34:
                in_string = False
            continue
        if byte == 34:
            tokens += 1
            in_string, atom = True, False
        elif byte in (123, 91):
            tokens += 1
            depth += 1
            require(depth <= 128, 'JSON_DEPTH_PREALLOCATION')
            atom = False
        elif byte in (125, 93):
            depth -= 1
            atom = False
        elif byte in (9, 10, 13, 32, 44, 58):
            atom = False
        elif not atom:
            tokens += 1
            atom = True
    reserve = tokens * 256 + len(raw) * 8 + 8 * 1024 * 1024
    require(retained_size(*retained) + reserve <= 64 * 1024 * 1024, 'JSON_FULL_CONTEXT_PREALLOCATION')
    value = json.loads(raw)
    retained_size(raw, value, *retained)
    return value


def main():
    require(len(sys.argv) in (3, 4) and sys.argv[1] in ('stage-a', 'stage-b'),
            'USAGE:run.py stage-a FRESH_ID | stage-b FRESH_ID ACTUAL_STAGE_A_SUMMARY')
    mode, run_id = sys.argv[1:3]
    require(re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', run_id) is not None, 'FRESH_RUN_ID')
    require((mode == 'stage-a' and len(sys.argv) == 3) or (mode == 'stage-b' and len(sys.argv) == 4), 'STAGE_ARGUMENTS')
    evidence = Evidence(HOME / 'evidence' / run_id)
    started = time.monotonic()
    deadline = started + 170
    summary = dict(protocol='p4-position-witness-harness-v1', stage=mode, status='NOT_RUN',
                   firstFailure=None, cases=[], controls={case: 'NOT_RUN' for case in (A_ORDER if mode == 'stage-a' else FRAME_IDS)}, counts=dict(candidateChecksAttempted=0,
                   candidateRepliesRetained=0, independentChecksAttempted=0, independentChecksPassed=0,
                   freshFullWrapperCommands=0, fullFramesVerified=0, costDecisions=0, WorldCalls=0,
                   baselineReruns=0), stageB='NOT_RUN', costDecision='NOT_RUN', wholeP4='UNCHANGED_NO_GO',
                   directAPI='NOT_RUN', desktop='NOT_RUN', executionBoundary='OFFLINE_SAVED_REQUESTS_ONLY')
    cursor = 'authentication'
    old_handler = signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError('INTERNAL_170S_DEADLINE')))
    signal.alarm(170)
    peak = 0

    def child(label, argv):
        result = command(argv, b'', ROOT, deadline)
        evidence.put(label + '.stdout.raw', result.pop('stdout'))
        evidence.put(label + '.stderr.raw', result.pop('stderr'))
        evidence.put(label + '.process.json', result)
        require(result['status'] == 'PASS_COMMAND_ONLY', result['firstFailure'] or 'CHILD_COMMAND_FAILED')
        return result

    def audited_case(check_mode, case, request_path, reply_path):
        output = evidence.directory / (check_mode + '-' + case['id'] + '-independent.json')
        summary['counts']['independentChecksAttempted'] += 1
        child(check_mode + '-' + case['id'] + '-checker',
              [python, '-B', str(REFERENCE / 'checker.py'), check_mode, case['id'],
               str(request_path), str(reply_path), str(output)])
        output_pin = evidence.adopt(output)
        audit = read_json(output)
        expected = 'EXECUTED_PASS_POSITION_WITNESS_' + check_mode.upper() + '_CASE'
        require(audit['status'] == expected and audit['firstFailure'] is None, 'INDEPENDENT_CASE_NO_GO')
        require(audit['WorldCalls'] == 0 and audit['coldQpCalls'] == 0, 'INDEPENDENT_FORBIDDEN_WORK')
        summary['counts']['independentChecksPassed'] += 1
        return dict(path=str(output.relative_to(ROOT)), pin=output_pin, status=audit['status'],
                    expectedRejectionControl=audit['audit'].get('expectedRejectionControl', False))

    try:
        frozen_path = HOME / 'AUTHOR-FREEZE-01.json'
        frozen = read_json(frozen_path, EVIDENCE_BYTES)
        authenticate(ROOT, frozen['files'])
        authenticate(ROOT, frozen['externalToolFiles'])
        summary['freezePin'] = pin(frozen_path)
        protocol = read_json(ROOT / frozen['runProtocol'])
        python = protocol['python']
        require(pin(Path(python)) == frozen['externalToolFiles'][python], 'EXACT_INSTALLED_PYTHON')
        bank = (ROOT / protocol['bankDirectory']).resolve()
        require(bank.is_relative_to(REFERENCE / 'evidence'), 'FROZEN_REFERENCE_BANK_DIRECTORY')
        manifest_path = bank / ('stage-a.json' if mode == 'stage-a' else 'stage-b.json')
        manifest = read_json(manifest_path)
        expected_ids = A_ORDER if mode == 'stage-a' else FRAME_IDS
        require([case['id'] for case in manifest['cases']] == expected_ids, 'EXACT_CASE_ORDER')
        require(manifest['candidateChecks'] == manifest['callCap'] == len(expected_ids), 'EXACT_STAGE_CENSUS')
        require(manifest['WorldCalls'] == manifest['coldQpCalls'] == manifest['fixtureCalls'] == 0, 'BANK_NO_FORBIDDEN_WORK')
        for case in manifest['cases']:
            require(Path(case['request']).name == case['request'], 'BANK_REQUEST_FILENAME')
            require(pin(bank / case['request']) == case['requestPin'], 'BANK_REQUEST_PIN')
            require(case['requestPin']['bytes'] <= REPLY_BYTES, 'BANK_REQUEST_LIMIT')
        summary['manifestPin'] = pin(manifest_path)
        corpus = read_json(HOME / 'CORPUS.json')
        authorities = {case['id']: case for case in corpus['frames']}
        if mode == 'stage-a':
            require(manifest['format'] == 'p4-position-witness-stage-a-bank-v1' and manifest['compactCalls'] == 0, 'PURE_KERNEL_STAGE_A')
            for case in manifest['cases']:
                cursor = case['id']
                summary['controls'][case['id']] = 'EXECUTED_NO_GO'
                bank_request_path = bank / case['request']
                request_path = evidence.directory / ('kernel-' + case['id'] + '-request.json')
                evidence.put(request_path.name, bank_request_path.read_bytes())
                require(pin(request_path) == case['requestPin'], 'ACTUAL_REQUEST_COPY_PIN')
                request = read_json(request_path)
                require(set(request) == {'op', 'problem', 'result'} and request['op'] == 'kernel', 'PURE_KERNEL_REQUEST_NO_ORACLE_SEED')
                reply_path = evidence.directory / ('kernel-' + case['id'] + '-reply.json')
                require(not reply_path.exists(), 'FRESH_CANDIDATE_REPLY')
                summary['counts']['candidateChecksAttempted'] += 1
                child('kernel-' + case['id'] + '-candidate', [protocol['nodeGuard'], str(CANDIDATE / 'candidate.mjs'), 'kernel', str(request_path), str(reply_path)])
                reply_pin = evidence.adopt(reply_path)
                summary['counts']['candidateRepliesRetained'] += 1
                reply = read_json(reply_path)
                require(reply['protocol'] == 'p4-position-witness-kernel-v1', 'KERNEL_PROTOCOL')
                require(reply['status'] == case['expected']['status'], 'KERNEL_EXPECTED_STATUS')
                if 'reason' in case['expected']:
                    require(reply['reason'] == case['expected']['reason'], 'CONTROL_EXACT_EXPECTED_REASON')
                else:
                    require(reply['ok'] is True and reply['resolved'] is True and reply['reason'] is None, 'CERTIFIED_KERNEL_EXPECTED')
                peak = max(peak, retained_size(request, reply, manifest, corpus))
                audit = audited_case('kernel', case, request_path, reply_path)
                require(audit['expectedRejectionControl'] is ('reason' in case['expected']), 'INDEPENDENT_CONTROL_CLASSIFICATION')
                summary['controls'][case['id']] = 'EXECUTED_PASS'
                summary['cases'].append(dict(id=case['id'], status='EXECUTED_PASS', actualStatus=reply['status'],
                                            actualReason=reply['reason'], replyPin=reply_pin, independent=audit))
            require(summary['counts']['candidateChecksAttempted'] == summary['counts']['independentChecksPassed'] == 10, 'COMPLETE_TEN_AUDITED_KERNEL_CHECKS')
            summary['status'] = 'PASS_POSITION_WITNESS_STAGE_A_TEN_PURE_KERNEL_CHECKS'
        else:
            cursor = 'stage-a-prerequisite'
            prior_path = Path(sys.argv[3]).resolve()
            require(prior_path.is_relative_to(HOME / 'evidence') and prior_path.name == 'summary.json', 'OWNED_ACTUAL_STAGE_A_SUMMARY')
            prior = read_json(prior_path)
            require(prior['status'] == 'PASS_POSITION_WITNESS_STAGE_A_TEN_PURE_KERNEL_CHECKS' and prior['firstFailure'] is None, 'ACTUAL_COMPLETE_STAGE_A_PASS_REQUIRED')
            require(prior['freezePin'] == summary['freezePin'], 'SAME_FROZEN_SOURCE_STAGE_A')
            require(prior['counts']['candidateChecksAttempted'] == prior['counts']['independentChecksPassed'] == 10, 'ACTUAL_STAGE_A_CENSUS')
            summary['stageAPrerequisite'] = dict(path=str(prior_path.relative_to(ROOT)), pin=pin(prior_path))
            require(manifest['format'] == 'p4-position-witness-stage-b-bank-v1' and manifest['singleMeasuredBank'] is True and manifest['compactCalls'] == 432, 'ONE_MEASURED_SIX_FRAME_BANK')
            # The final implementation summary schema is frozen in PROTOCOL-01.json.
            wrapper_out = evidence.directory / 'full-bank'
            require(not wrapper_out.exists(), 'FRESH_FULL_WRAPPER_DIRECTORY')
            wrapper_manifest_path = ROOT / protocol['wrapperManifest']
            wrapper_manifest = read_json(wrapper_manifest_path)
            require(wrapper_manifest['cases'] == manifest['cases'], 'SAME_ORIGINAL_WRAPPER_BANK_CASES')
            require((wrapper_manifest_path.parent / wrapper_manifest['bankDirectory']).resolve() == bank, 'SAME_WRAPPER_TRANSPORT_BANK')
            cursor = 'single-measured-full-bank'
            summary['counts']['freshFullWrapperCommands'] += 1
            child('full-bank-candidate', [python, '-B', str(HOME / 'wrapper.py'), 'world-bank', str(wrapper_manifest_path), str(wrapper_out)])
            for file in sorted(wrapper_out.rglob('*')):
                require(not file.is_symlink(), 'NO_WRAPPER_OUTPUT_SYMLINK')
                if file.is_file():
                    evidence.adopt(file, REPLY_BYTES)
            wrapper = read_json(wrapper_out / protocol['wrapperSummaryFile'])
            require(wrapper['status'] == protocol['wrapperSuccessStatus'] and wrapper['firstFailure'] is None, 'WRAPPER_COMPLETE_NUMERICAL_RETURN')
            schema = protocol['wrapperSchema']
            summary['wrapperReturnedCounts'] = wrapper[schema['counts']]
            rows = wrapper[schema['frames']]
            require([row[schema['caseId']] for row in rows] == FRAME_IDS, 'SIX_FRAME_WRAPPER_ORDER')
            cost_total = 0
            for case, row in zip(manifest['cases'], rows):
                cursor = case['id']
                summary['controls'][case['id']] = 'EXECUTED_NO_GO'
                request_path = bank / case['request']
                request = read_json(request_path)
                frame_id = case['id']
                require(pin(request_path) == {key: authorities[frame_id]['request'][key] for key in ('bytes', 'sha256')}, 'EXACT_ORIGINAL_WORLD_REQUEST_BYTES')
                reply_name = row[schema['replyFile']]
                require(Path(reply_name).name == reply_name, 'WRAPPER_REPLY_NAME')
                reply_path = wrapper_out / reply_name
                require(pin(reply_path) == row[schema['replyPin']], 'WRAPPER_ACTUAL_REPLY_PIN')
                reply = read_json(reply_path, retained=(request, manifest, corpus, wrapper))
                saved_path = ROOT / authorities[frame_id]['positionV2Oracle']['path']
                saved = read_json(saved_path, retained=(request, reply, manifest, corpus, wrapper))
                physical = compare_world(reply, saved, request)
                evidence.put(frame_id + '-physical.json', physical)
                audit = audited_case('world', case, request_path, reply_path)
                model_name = row['modelExactFile']
                require(Path(model_name).name == model_name, 'ACTUAL_PRICED_NATIVE_MODEL_FILE')
                model_path = wrapper_out / model_name
                require(pin(model_path) == row['modelExactPin'], 'ACTUAL_PRICED_NATIVE_MODEL_PIN')
                model_exact = read_json(model_path, retained=(request, reply, saved, manifest, corpus, wrapper))
                require(set(model_exact) == {'a', 'b', 'inverse', 'columns', 'd', 'm'} and model_exact['d'] == 24 and model_exact['m'] == 36, 'PRICED_NATIVE_MODEL_SCHEMA')
                require(row['legacyOuterCalls']['problemEquivalenceIntegerComparisons'] == 1848, 'ALL_924_OUTER_NATIVE_COEFFICIENT_PAIRS_COMPARED')
                kernel_name = row[schema['kernelFile']]
                require(Path(kernel_name).name == kernel_name, 'ACTUAL_IN_CALL_KERNEL_FILE')
                kernel_path = wrapper_out / kernel_name
                require(pin(kernel_path) == row[schema['kernelPin']], 'ACTUAL_IN_CALL_KERNEL_PIN')
                kernel = read_json(kernel_path, retained=(request, reply, saved, model_exact, manifest, corpus, wrapper))
                require(kernel['protocol'] == 'p4-position-witness-kernel-v1' and kernel['status'] == 'EXACT_KKT_CERTIFIED', 'ACTUAL_IN_CALL_KERNEL_CERTIFIED')
                certificate = kernel['certificate']
                expected_fields = {'translationsExact', 'lambdaExactKgM', 'primalMarginsExactM', 'objectiveExactKgM2',
                    'stationarityExactKgM', 'complementarityExactKgM2', 'basisRows', 'basisRank', 'dynamicDof',
                    'certificateExact', 'translations', 'lambdaKgM', 'primalMarginsM', 'objectiveKgM2'}
                require(set(certificate) == expected_fields, 'IN_CALL_COMPLETE_CERTIFICATE_FIELDS')
                for key in expected_fields - {'stationarityExactKgM', 'complementarityExactKgM2'}:
                    compare(certificate[key], reply['reference'][key], {'replace': [], 'add': [], 'remove': []})
                require(certificate['stationarityExactKgM'] == ['0/1'] * 24 and certificate['complementarityExactKgM2'] == ['0/1'] * 36,
                        'IN_CALL_EXACT_ZERO_VECTORS_BOUND_TO_INDEPENDENT_WORLD_KKT')
                compare(kernel['proofCounters'], reply['reference']['proofCounters'], {'replace': [], 'add': [], 'remove': []})
                for key, value in kernel['metrics'].items():
                    compare(value, reply['metrics'][key], {'replace': [], 'add': [], 'remove': []})
                core = row[schema['coreCpuNs']]
                require(type(core) is int and core >= 0, 'ACTUAL_CORE_CPU_NANOSECONDS')
                cost_total += core
                peak = max(peak, retained_size(request, reply, saved, kernel, model_exact, manifest, corpus, wrapper))
                summary['counts']['fullFramesVerified'] += 1
                summary['controls'][frame_id] = 'EXECUTED_PASS'
                summary['cases'].append(dict(id=frame_id, status='EXECUTED_PASS', independent=audit, physical=physical, coreCpuNs=core))
                del request, reply, saved, kernel, certificate, model_exact
            require(wrapper['costDecision'] == 'DEFERRED_EXTERNAL_NUMERIC_AUDIT', 'NO_PREMATURE_COST_DECISION')
            require(wrapper['coreCpuNs'] == wrapper['parentCoreCpuNs'] == cost_total, 'ACTUAL_PARENT_CONTEXT_CPU_SUM')
            worker = wrapper['worker']
            require(worker['workerStarts'] == 1 and worker['requestCalls'] == 6 and worker['workerClosed'] is True and worker['exit'] == 0 and worker['cleanupError'] is None, 'ONE_GENUINELY_CLOSED_NATIVE_WORKER')
            require(worker['childCpuAuthority'] == 'RESOURCE_RUSAGE_CHILDREN_DELTA_AFTER_CLOSE_AND_WAIT' and worker['selfReportedChildCpuUsed'] is False, 'AUTHORITATIVE_CHILD_LIFETIME_CPU')
            before_cpu, after_cpu = worker['resourceBefore'], worker['resourceAfter']
            user_delta = after_cpu['userSeconds'] - before_cpu['userSeconds']
            system_delta = after_cpu['systemSeconds'] - before_cpu['systemSeconds']
            require(math.isfinite(user_delta) and math.isfinite(system_delta) and user_delta >= 0 and system_delta >= 0, 'ACTUAL_CHILD_CPU_MONOTONIC')
            child_cpu = math.ceil((user_delta + system_delta) * 1000000000)
            require(type(worker['childLifetimeCpuNs']) is int and worker['childLifetimeCpuNs'] == child_cpu, 'AUTHORITATIVE_CHILD_RESOURCE_CPU_DELTA')
            envelope_cpu = cost_total + child_cpu
            require(wrapper['conservativeEnvelopeCpuNs'] == envelope_cpu, 'CONSERVATIVE_COST_ENVELOPE')
            require(worker['parentTransportLimitBytes'] == worker['childTransportReservedBytes'] == 4 * 1024 * 1024 and worker['maxExplicitTransportReservedBytes'] <= 4 * 1024 * 1024, 'SHARED_TRANSPORT_EIGHT_MIB_SPLIT')
            summary['wrapperSummaryPin'] = pin(wrapper_out / protocol['wrapperSummaryFile'])
            counts = wrapper[schema['counts']]
            for name, expected in protocol['wrapperExpectedCounts'].items():
                require(counts[name] == expected, 'WRAPPER_ACTUAL_CENSUS:' + name)
            sat = wrapper['satCounters']
            require(sat['conventionProblems'] == 864 and sat['axisVisits'] == 12960, 'UNCHANGED_SAT_COMPLETE_POPULATION')
            require(type(sat['integerOperations']) is int and 0 <= sat['integerOperations'] <= 2000000 and sat['peakIntegerBits'] <= 16384, 'ORIGINAL_SEPARATE_SAT_BUDGET')
            summary['satCounters'] = sat
            require(summary['counts']['fullFramesVerified'] == summary['counts']['independentChecksPassed'] == 6, 'COMPLETE_SIX_FULL_PHYSICAL_AND_INDEPENDENT_GATES')
            summary['stageB'] = 'PASS_SIX_FULL_POSITION_REFERENCES_AND_INDEPENDENT_CHECKS'
            summary['counts']['costDecisions'] += 1
            summary['parentCoreCpuNs'] = cost_total
            summary['childLifetimeCpuNs'] = child_cpu
            summary['conservativeEnvelopeCpuNs'] = envelope_cpu
            summary['costBoundaryIdenticalToSavedBaseline'] = False
            summary['costAuthority'] = 'PARENT_SIX_CONTEXT_CPU_PLUS_OWNED_NODE_ENTIRE_LIFETIME_RESOURCE_CPU'
            summary['worker'] = worker
            summary['savedBaselineCoreCpuNs'] = 773147000
            summary['costDecision'] = 'GO' if envelope_cpu * 10 <= 773147000 * 9 else 'NO_GO'
            summary['status'] = 'PASS_POSITION_WITNESS_STAGE_B_COST_GO' if summary['costDecision'] == 'GO' else 'NO_GO_POSITION_WITNESS_STAGE_B_COST'
            if summary['costDecision'] == 'NO_GO':
                summary['firstFailure'] = dict(cursor='one-cost-decision', type='CostGate', message='CONSERVATIVE_NATIVE_CPU_ENVELOPE_EXCEEDS_FIXED_695832300NS_GATE')
    except Exception as error:
        summary['status'] = 'NO_GO_POSITION_WITNESS_HARNESS'
        summary['firstFailure'] = dict(cursor=cursor, type=type(error).__name__, message=str(error))
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old_handler)
        summary.update(elapsedWallNs=round((time.monotonic()-started)*1e9), peakExplicitRetainedDataBytes=peak,
                       explicitDataBoundary='Accounted retained Python data, not process RSS', writtenEvidenceBytesBeforeSummary=evidence.bytes,
                       laterChecks='NOT_RUN_AFTER_FIRST_FAILURE' if summary['firstFailure'] else None,
                       setupIOAuditTiming='Wrapper attribution separately reported; node whole lifetime authority includes startup/IO/shutdown; no subtracting child self timing',
                       warm='NOT_RUN', original1200Steps='NOT_RUN', baselineRemeasured=False)
        evidence.put('summary.json', summary, terminal=True)
    print(json.dumps(dict(status=summary['status'], firstFailure=summary['firstFailure'], counts=summary['counts'], costDecision=summary['costDecision'])))
    return int(summary['firstFailure'] is not None)


if __name__ == '__main__':
    raise SystemExit(main())
