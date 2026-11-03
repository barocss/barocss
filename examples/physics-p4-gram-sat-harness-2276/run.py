"""Root-only9 pure Gram calls, one old Meter and immediate prefix audits."""
import importlib.util
import hashlib
import json
from pathlib import Path
import re
import signal
import sys
import time

from bounds import Evidence, authenticate, command, pin, require, REPLY_BYTES

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PARENT_LIMIT = 24 * 1024 * 1024
NON_JSON = 8 * 1024 * 1024


def bootstrap(path):
    # Explicit1MiB bootstrap reservation, independent of unqualified reader code.
    require(path.stat().st_size <= 65536, 'BOOTSTRAP_64K')
    with path.open('rb') as stream:
        raw = stream.read(65537)
    require(len(raw) <= 65536, 'BOOTSTRAP_BOUNDED_READ')
    return raw



def bootstrap_json(path, expected_sha=None):
    raw = bootstrap(path)
    require(expected_sha is None or hashlib.sha256(raw).hexdigest() == expected_sha, 'ACTUAL_BOOTSTRAP_BYTE_HASH')
    punctuation = sum(raw.count(bytes((c,))) for c in (123, 91, 44, 58))
    require(512 * punctuation + 8 * len(raw) + 65536 <= 1024 * 1024,
            'BOOTSTRAP_JSON_PREALLOCATION_1M')
    return json.loads(raw)


def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec); sys.modules[name] = value
    spec.loader.exec_module(value)
    return value


def main():
    require(len(sys.argv) == 3 and re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', sys.argv[1]),
            'USAGE:run.py FRESH_ID ROOT_REVIEWED_PINS_SHA')
    evidence = Evidence(HERE / 'evidence' / sys.argv[1])
    started = time.monotonic(); deadline = started + 170
    summary = dict(protocol='p4-gram-r1-harness-v1', status='NOT_RUN', firstFailure=None,
        controls=['NOT_RUN'] * 9, counts=dict(meterContexts=0, candidateCallsAttempted=0,
        candidateReplies=0, independentAuditsAttempted=0, independentAuditsPassed=0,
        verifiedConventions=0, verifiedAxisSlots=0, verifiedGramCoefficients=0,
        verifiedFaceCenterCoefficients=0, verifiedSignedMixedCoefficients=0, WorldCalls=0),
        costDecisions=0, baselineReruns=0, fullB='NOT_RUN_REQUIRES_SEPARATE_ROOT_APPROVAL',
        oldCostEligibility='ALL_ENDED_COMBINATIONS_UNCHANGED', original1200='NOT_RUN', desktop='NOT_RUN')
    cursor = 'authentication'; meter = None; replies = []; documents = []
    old_handler = signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError('R1_SHARED_170S')))
    signal.alarm(170)
    try:
        pins_path = HERE / 'PINS.json'
        require(pin(pins_path)['sha256'] == sys.argv[2], 'EXACT_ROOT_REVIEWED_PINS')
        pins = bootstrap_json(pins_path, sys.argv[2])
        authenticate(ROOT, pins['sources']); authenticate(ROOT, pins['tools'])
        require(Path(sys.executable).resolve() == Path(pins['python']).resolve() and sys.version == pins['pythonVersion'], 'EXACT_PINNED_PYTHON')
        summary['pinsPin'] = pin(pins_path)
        # Source authentication precedes imports/calls. Qualification is checked
        # before candidate import; merely authoring this helper is insufficient.
        qualification = bootstrap_json(ROOT / pins['ownedQualification'])
        require(qualification['status'] == 'PASS_OWNED_DATA_SEVEN_PURE_DATA_GROUPS'
                and qualification['firstFailure'] is None
                and qualification['finalAuthentication'] == 'ALL_FROZEN_FILES_AND_TOOLS_EQUAL'
                and len(qualification['groups']) == 7 and all(g['status']=='PASS' for g in qualification['groups'])
                and qualification['physicsCalls']==qualification['oldAuditCalls']==qualification['candidateCalls']==qualification['baselineReruns']==0, 'ACTUAL_OWNED_DATA_SELFTEST_PASS')
        require(qualification['pinsPin'] == pin(ROOT / pins['ownedPins']), 'QUALIFIED_OWNED_SOURCE_PINS')
        for field in ('ownedGuard', 'm3Guard'):
            receipt = bootstrap_json(ROOT / pins[field])
            require(receipt['status'] == 'PASS' and receipt['exit'] == 0 and receipt['timedOut'] is False,
                    'ACTUAL_PREREQUISITE_GUARD:' + field)
        # The actual qualification is established BEFORE any helper import/call.
        owned = module(ROOT / pins['ownedHelper'], '_r1_qualified_owned_data')
        budget = owned.JsonBudget(limit=PARENT_LIMIT - NON_JSON)
        def read(path):
            document = owned.read_json(path, budget, pin(path)); documents.append(document)
            return document
        request_path, oracle_path = ROOT / pins['requests'], ROOT / pins['oracle']
        manifest_doc = read(ROOT / pins['manifest']); manifest = manifest_doc.value
        bank_doc = read(request_path); bank = bank_doc.value
        require(set(bank) == {'format', 'requests'} and bank['format'] == 'p4-gram-sat-requests-v1'
                and len(bank['requests']) == 9, 'EXACT_NINE_RAW_REQUESTS')
        require(manifest['candidateCalls'] == manifest['WorldCalls'] == manifest['coldQpCalls'] == 0, 'M3_DATA_ONLY')
        require((manifest['caseCount'],manifest['candidateConventions'],manifest['candidateAxisSlots'],manifest['gramCoefficients'],manifest['faceCenterCoefficients'],manifest['signedMixedCoefficients']) == (9,18,270,378,108,486), 'ACTUAL_M3_FIXED_CENSUS')
        require(manifest['files']['requests.json']==pin(request_path) and manifest['files']['oracle.json']==pin(oracle_path), 'ACTUAL_M3_BANK_BYTE_PINS')
        summary['requestPin'], summary['oraclePin'] = pin(request_path), pin(oracle_path)
        core = module(ROOT / pins['candidate'], '_r1_actual_gram_sat')
        require(core.Meter is core._K.Meter and core._K.MAX_OPS == 2000000 and core._K.MAX_BITS == 16384,
                'ACTUAL_UNCHANGED_OLD_METER')
        meter = core.Meter(); summary['counts']['meterContexts'] = 1
        require(meter.stats() == dict(integerOperations=0, peakIntegerBits=0, axisVisits=0, conventionProblems=0),
                'ONE_FRESH_SHARED_METER')
        previous_ops = previous_bits = 0
        for index, request in enumerate(bank['requests']):
            cursor = index
            require(time.monotonic() < deadline and set(request) == {'a', 'b'}, 'RAW_PAIR_ONLY_AND_REMAINING_TIME')
            summary['controls'][index] = 'EXECUTED_NO_GO'
            summary['counts']['candidateCallsAttempted'] += 1
            with budget.kernel_helper_phase(0):
                reply = core.evaluate_request(request, meter, deadline=deadline)
            replies.append(reply); summary['counts']['candidateReplies'] += 1
            prefix = dict(format='p4-gram-sat-results-v1', replies=replies)
            with budget.walk_phase():
                observation = owned.owned_size((pins, qualification, receipt, replies, prefix, summary, meter),
                    data_reservation=NON_JSON, total_limit=2 * NON_JSON,
                    allowed_record_types=(core.Meter,))
            summary['nonJsonOwnedBytesPeak'] = max(summary.get('nonJsonOwnedBytesPeak', 0), observation['ownedBytes'])
            summary['walkerAuxReservedPeakBytes'] = max(summary.get('walkerAuxReservedPeakBytes', 0), observation['auxReservedPeakBytes'])
            name = f'prefix-{index + 1:02d}.json'
            # Bounded incremental encoding, not an unbounded dumps-before-cap.
            with budget.kernel_helper_phase(0):
                payload = bytearray()
                for text in json.JSONEncoder(separators=(',', ':'), allow_nan=False).iterencode(prefix):
                    part = text.encode()
                    if len(payload) + len(part) + 1 > REPLY_BYTES:
                        evidence.put(name + '.partial.raw', bytes(payload))
                        raise ValueError('PREFIX_2M_ENCODING_LIMIT_PARTIAL_RETAINED')
                    payload.extend(part)
                payload.extend(b'\n'); evidence.put(name, bytes(payload)); del payload
            output = evidence.directory / f'audit-{index + 1:02d}.json'
            summary['counts']['independentAuditsAttempted'] += 1
            process = command([pins['python'], '-B', str(ROOT / pins['auditor']), str(request_path),
                               str(oracle_path), str(evidence.directory / name), str(output)], b'', ROOT, deadline)
            evidence.put(f'audit-{index + 1:02d}.stdout.raw', process.pop('stdout'))
            evidence.put(f'audit-{index + 1:02d}.stderr.raw', process.pop('stderr'))
            evidence.put(f'audit-{index + 1:02d}.process.json', process)
            require(output.is_file(), 'ACTUAL_AUDIT_REPORT_REQUIRED')
            output_pin = evidence.adopt(output)
            audit_doc = read(output); audit = audit_doc.value
            expected = 'EXECUTED_PASS_EXACT_GRAM_SAT_BANK' if index == 8 else 'EXECUTED_PASS_PREFIX_GRAM_SAT'
            require(process['status'] == 'PASS_COMMAND_ONLY' and audit['status'] == expected
                    and audit['firstFailure'] is None, 'FIRST_PREFIX_AUDIT_NO_GO:' + str(audit['firstFailure']))
            require(audit['complete'] is (index == 8) and audit['verifiedPrefix'] == index + 1, 'EXACT_PREFIX_COMPLETION')
            require(audit['requestPin'] == summary['requestPin'] and audit['oraclePin'] == summary['oraclePin']
                    and audit['repliesPin'] == pin(evidence.directory / name), 'AUDITOR_ACTUAL_PREFIX_BINDING')
            for field in ('candidateCallsByAuditor', 'directOracleCallsByAuditor', 'geometryCallsByAuditor', 'coldQpCalls', 'WorldCalls'):
                require(audit[field] == 0, 'NO_HIDDEN_AUDITOR_WORK:' + field)
            for field, factor in (('verifiedConventions', 2), ('verifiedAxisSlots', 30),
                                  ('verifiedGramCoefficients', 42), ('verifiedFaceCenterCoefficients', 12),
                                  ('verifiedSignedMixedCoefficients', 54)):
                require(audit[field] == (index + 1) * factor, 'ALL_AXES_SIGNED_TABLES_CENSUS:' + field)
                summary['counts'][field] = (index + 1) * factor
            stats = meter.stats()
            require(reply['stats'] == audit['finalStats'] == stats, 'ONE_ACTUAL_CUMULATIVE_METER_STATS')
            require(previous_ops <= stats['integerOperations'] <= 2000000
                    and previous_bits <= stats['peakIntegerBits'] <= 16384
                    and stats['axisVisits'] == (index + 1) * 30 and stats['conventionProblems'] == (index + 1) * 2,
                    'GLOBAL_ORIGINAL_METER_CAP_NO_RESET')
            previous_ops, previous_bits = stats['integerOperations'], stats['peakIntegerBits']
            summary['counts']['independentAuditsPassed'] += 1
            summary['controls'][index] = 'INDEPENDENT_PREFIX_PASS'
            summary['lastAudit'] = dict(file=output.name, pin=output_pin, status=expected)
            del audit; audit_doc.release(); documents.remove(audit_doc)
        require(summary['counts']['candidateReplies'] == summary['counts']['independentAuditsPassed'] == 9, 'COMPLETE_NINE_CALL_NINE_AUDIT')
        authenticate(ROOT, pins['sources']); authenticate(ROOT, pins['tools'])
        summary['finalAuthentication'] = 'ALL_FROZEN_SOURCES_AND_TOOLS_EQUAL'
        summary['jsonLedgerPeakReservedBytes'] = budget.peakReservedBytes
        summary['parentReservationBytes'] = PARENT_LIMIT
        summary['status'] = 'PASS_R1_NINE_PAIRS_ONE_GLOBAL_METER'
    except Exception as error:
        summary['status'] = 'NO_GO_R1_FIRST_FAILURE'
        summary['firstFailure'] = dict(cursor=cursor, type=type(error).__name__, message=str(error))
    finally:
        signal.alarm(0); signal.signal(signal.SIGALRM, old_handler)
        summary.update(finalStats=None if meter is None else meter.stats(), elapsedWallNs=round((time.monotonic()-started)*1e9),
            writtenEvidenceBytesBeforeSummary=evidence.bytes, M3IncludedInR1Timing=False, rssQualified=False,
            oldV3ObservedGraph='UNCHANGED_UNQUALIFIED_NO_REAUDIT_OR_RETIME',
            laterChecks='NOT_RUN_AFTER_FIRST_FAILURE' if summary['firstFailure'] else 'FULL_B_REQUIRES_SEPARATE_ROOT_APPROVAL')
        evidence.put('summary.json', summary, terminal=True)
    print(json.dumps(dict(status=summary['status'], firstFailure=summary['firstFailure'], counts=summary['counts'])))
    return int(summary['firstFailure'] is not None)


if __name__ == '__main__':
    raise SystemExit(main())
