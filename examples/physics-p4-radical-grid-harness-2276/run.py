"""Root-only17 direct calls on ONE actual old Meter; immediate independent prefix audits."""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import signal
import sys
import time

from bounds import Evidence, authenticate, command, pin, require, retained_size, REPLY_BYTES

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def load(path):
    require(path.stat().st_size <= REPLY_BYTES, 'JSON_FILE_LIMIT')
    raw = path.read_bytes()
    # Fixed small bank, with conservative preallocation before JSON decoding.
    require(len(raw) * 128 + 65536 <= 24 * 1024 * 1024, 'JSON_PREALLOCATION_LIMIT')
    value = json.loads(raw); retained_size(raw, value); return value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('fresh_id'); parser.add_argument('--reviewed-pins-sha', required=True)
    args = parser.parse_args()
    require(re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', args.fresh_id) is not None, 'FRESH_ID')
    evidence = Evidence(HERE / 'evidence' / args.fresh_id)
    started = time.monotonic(); deadline = started + 170
    summary = dict(status='NOT_RUN', protocol='p4-radical-r0-harness-v1', firstFailure=None,
                   counts=dict(meterContexts=0, candidateCallsAttempted=0, candidateReplies=0,
                   auditCommandsAttempted=0, auditPasses=0, validVerified=0,
                   expectedInvalidVerified=0, expectedResourceVerified=0, WorldCalls=0),
                   controls=['NOT_RUN'] * 17, costDecisions=0, baselineReruns=0,
                   fullPosition='NOT_RUN_NOT_IMPLEMENTED', oldCandidates='UNCHANGED_ENDED')
    meter, replies, cursor = None, [], 'authentication'
    peak = 0
    old_handler = signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError('R0_INTERNAL_170S_SHARED_DEADLINE')))
    signal.alarm(170)
    try:
        pins_path = HERE / 'PINS.json'
        require(pin(pins_path)['sha256'] == args.reviewed_pins_sha, 'EXACT_ROOT_REVIEWED_PINS')
        pins = load(pins_path)
        require(Path(sys.executable).resolve() == Path(pins['python']).resolve(), 'PINNED_PYTHON')
        authenticate(ROOT, pins['sources']); authenticate(ROOT, pins['tools'])
        summary['pinsPin'] = pin(pins_path)
        m2 = load(ROOT / pins['m2Receipt'])
        require(m2['status'] == 'PASS' and m2['exit'] == 0 and m2['timedOut'] is False, 'ACTUAL_SEPARATE_M2_PASS')
        manifest = load(ROOT / pins['manifest'])
        require((manifest['caseCount'], manifest['validCount'], manifest['invalidCount'], manifest['resourceCount']) == (17, 13, 2, 2) and manifest['candidateCalls'] == manifest['WorldCalls'] == 0, 'ACTUAL_M2_COUNTS')
        request_path, oracle_path = ROOT / pins['requests'], ROOT / pins['oracle']
        bank = load(request_path)
        require(set(bank) == {'format', 'requests'} and bank['format'] == 'p4-radical-grid-requests-v1' and len(bank['requests']) == 17, 'EXACT_RAW17_BANK')
        summary['requestPin'], summary['oraclePin'] = pin(request_path), pin(oracle_path)
        require(manifest['files']['requests.json'] == summary['requestPin'] and manifest['files']['oracle.json'] == summary['oraclePin'], 'ACTUAL_M2_FILE_PINS')
        # Only after all source and data authentication; no author imports this module.
        spec = importlib.util.spec_from_file_location('_actual_root_r0_radical_grid', ROOT / pins['candidate'])
        core = importlib.util.module_from_spec(spec); sys.modules[spec.name] = core; spec.loader.exec_module(core)
        require(core.Meter is core._K.Meter and core._K.MAX_OPS == 2000000 and core._K.MAX_BITS == 16384, 'ACTUAL_UNCHANGED_OLD_METER_CLASS')
        meter = core.Meter(); summary['counts']['meterContexts'] = 1
        require(meter.stats() == dict(integerOperations=0, peakIntegerBits=0, axisVisits=0, conventionProblems=0), 'ONE_FRESH_METER')
        previous_ops, previous_bits = 0, 0
        for index, request in enumerate(bank['requests']):
            cursor = index
            require(time.monotonic() < deadline, 'NO_REMAINING_SHARED_TIME')
            require(set(request) == {'numerator', 'denominator', 'square', 'precision'}, 'RAW_REQUEST_ONLY_NO_ORACLE_LABELS')
            summary['controls'][index] = 'EXECUTED_NO_GO'
            summary['counts']['candidateCallsAttempted'] += 1
            reply = core.evaluate_request(request, meter, deadline=deadline)
            replies.append(reply); summary['counts']['candidateReplies'] += 1
            prefix = dict(format='p4-radical-grid-results-v1', replies=replies)
            prefix_name = f'prefix-{index + 1:02d}.json'
            prefix_raw = (json.dumps(prefix, separators=(',', ':'), allow_nan=False) + '\n').encode()
            require(len(prefix_raw) <= REPLY_BYTES, 'PREFIX_REPLY_FILE_LIMIT')
            evidence.put(prefix_name, prefix_raw)
            del prefix_raw
            peak = max(peak, retained_size(pins, manifest, m2, bank, replies, prefix, summary))
            require(peak <= 24 * 1024 * 1024, 'PARENT_GRAPH_24M_RESERVATION')
            # No next candidate call until this complete prefix independently passes.
            output_name = f'audit-{index + 1:02d}.json'
            summary['counts']['auditCommandsAttempted'] += 1
            process = command([pins['python'], '-B', str(ROOT / pins['auditor']), str(request_path), str(oracle_path),
                               str(evidence.directory / prefix_name), str(evidence.directory / output_name)], b'', ROOT, deadline)
            evidence.put(f'audit-{index + 1:02d}.stdout.raw', process.pop('stdout'))
            evidence.put(f'audit-{index + 1:02d}.stderr.raw', process.pop('stderr'))
            evidence.put(f'audit-{index + 1:02d}.process.json', process)
            require((evidence.directory / output_name).is_file(), 'AUDIT_REPORT_REQUIRED')
            report_pin = evidence.adopt(evidence.directory / output_name)
            report = load(evidence.directory / output_name)
            expected_status = 'EXECUTED_PASS_EXACT_RADICAL_GRID_BANK' if index == 16 else 'EXECUTED_PASS_PREFIX_RADICAL_GRID'
            require(process['status'] == 'PASS_COMMAND_ONLY' and report['status'] == expected_status and report['firstFailure'] is None, 'FIRST_INDEPENDENT_PREFIX_FAILURE:' + str(report.get('firstFailure')))
            require(report['verifiedPrefix'] == index + 1 and report['complete'] is (index == 16), 'PREFIX_AND_COMPLETE_BOUNDARY')
            require(report['requestPin'] == summary['requestPin'] and report['oraclePin'] == summary['oraclePin'] and report['repliesPin'] == pin(evidence.directory / prefix_name), 'AUDITOR_ACTUAL_PREFIX_BINDING')
            require(report['candidateCallsByAuditor'] == report['WorldCalls'] == 0, 'NO_HIDDEN_CANDIDATE_OR_WORLD')
            stats = meter.stats()
            require(reply['stats'] == stats == report['finalStats'], 'ACTUAL_SINGLE_SHARED_CONTEXT_STATS')
            require(previous_ops <= stats['integerOperations'] <= 2000000 and previous_bits <= stats['peakIntegerBits'] <= 16384 and stats['axisVisits'] == stats['conventionProblems'] == 0, 'ORIGINAL_CUMULATIVE_METER_BOUNDS_NO_RESET')
            previous_ops, previous_bits = stats['integerOperations'], stats['peakIntegerBits']
            summary['counts']['auditPasses'] += 1
            summary['counts']['validVerified'] = report['verifiedValid']
            summary['counts']['expectedInvalidVerified'] = report['verifiedExpectedInvalid']
            summary['counts']['expectedResourceVerified'] = report['verifiedExpectedResource']
            summary['controls'][index] = 'INDEPENDENT_PREFIX_PASS'
            summary['lastAudit'] = dict(file=output_name, pin=report_pin, status=report['status'], complete=report['complete'])
        require((summary['counts']['candidateReplies'], summary['counts']['auditPasses'], summary['counts']['validVerified'], summary['counts']['expectedInvalidVerified'], summary['counts']['expectedResourceVerified']) == (17, 17, 13, 2, 2), 'COMPLETE_13_VALID_2_INVALID_2_RESOURCE')
        authenticate(ROOT, pins['sources']); authenticate(ROOT, pins['tools'])
        summary['finalAuthentication'] = 'ALL_FROZEN_SOURCES_AND_TOOLS_EQUAL'
        summary['status'] = 'PASS_R0_PURE17_ONE_GLOBAL_METER'
    except Exception as error:
        summary['status'] = 'NO_GO_R0_FIRST_FAILURE'
        summary['firstFailure'] = dict(cursor=cursor, type=type(error).__name__, message=str(error))
    finally:
        signal.alarm(0); signal.signal(signal.SIGALRM, old_handler)
        summary.update(finalStats=None if meter is None else meter.stats(), elapsedWallNs=round((time.monotonic()-started)*1e9),
                       peakExplicitParentDataBytes=peak, writtenEvidenceBytesBeforeSummary=evidence.bytes,
                       laterChecks='NOT_RUN_AFTER_FIRST_FAILURE' if summary['firstFailure'] else 'PHASE3_REQUIRES_SEPARATE_ROOT_MAP_REVIEW_AND_AUTHORIZATION',
                       m2IncludedInR0Timing=False, rssQualified=False)
        evidence.put('summary.json', summary, terminal=True)
    print(json.dumps(dict(status=summary['status'], firstFailure=summary['firstFailure'], counts=summary['counts'])))
    return int(summary['firstFailure'] is not None)


if __name__ == '__main__': raise SystemExit(main())
