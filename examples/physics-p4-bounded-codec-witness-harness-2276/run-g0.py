"""Root-only32-pair GCD gate. Candidate gets requests only, never the oracle."""
import json
from pathlib import Path
import re
import signal
import sys
import time

from bounds import Evidence, authenticate, command, pin, require, REPLY_BYTES, EVIDENCE_BYTES
from run import read_json

HOME = Path(__file__).resolve().parent
ROOT = HOME.parents[1]
CORE = ROOT / 'examples/physics-p4-bounded-codec-witness-2276'
REFERENCE = ROOT / 'examples/physics-p4-invariant-gcd-reference-2276'


def read(path, cap=REPLY_BYTES):
    return read_json(path, cap)


def main():
    require(len(sys.argv) == 2 and re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', sys.argv[1]) is not None, 'ONE_FRESH_G0_ID')
    evidence = Evidence(HOME / 'evidence' / sys.argv[1])
    started = time.monotonic()
    deadline = started + 170
    summary = dict(protocol='p4-invariant-g0-harness-v1', status='NOT_RUN', firstFailure=None,
                   counts=dict(candidateCommands=0, independentAudits=0, pairsVerified=0,
                               globalMeters=0, WorldCalls=0, baselineReruns=0),
                   stageA='NOT_RUN', stageB='NOT_RUN', costDecision='NOT_RUN', wholeP4='UNCHANGED_NO_GO')
    cursor = 'authenticate'
    old_handler = signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError('INTERNAL_170S_DEADLINE')))
    signal.alarm(170)

    def child(label, argv):
        result = command(argv, b'', ROOT, deadline)
        evidence.put(label + '.stdout.raw', result.pop('stdout'))
        evidence.put(label + '.stderr.raw', result.pop('stderr'))
        evidence.put(label + '.process.json', result)
        require(result['status'] == 'PASS_COMMAND_ONLY', result['firstFailure'] or 'G0_COMMAND_FAILED')

    try:
        frozen_path = HOME / 'AUTHOR-FREEZE-01.json'
        frozen = read(frozen_path, EVIDENCE_BYTES)
        authenticate(ROOT, frozen['files']); authenticate(ROOT, frozen['externalToolFiles'])
        summary['freezePin'] = pin(frozen_path)
        protocol = read(ROOT / frozen['runProtocol'])
        summary['guardPolicy'] = dict(protocol['guardPolicy'], pin=pin(ROOT / protocol['guardPolicy']['path']))
        g0 = protocol['g0']
        bank = (ROOT / g0['bankDirectory']).resolve()
        require(bank.is_relative_to(ROOT / g0['bankAuthorityDirectory'] / 'evidence'), 'ORIGINAL_IMMUTABLE_G0_BANK')
        request_path, oracle_path = bank / g0['requestFile'], bank / g0['oracleFile']
        request = read(request_path)
        require(set(request) == {'op', 'cases'} and request['op'] == 'gcd-bank' and len(request['cases']) == 32, 'EXACT_G0_REQUEST_ONLY')
        for case in request['cases']:
            require(set(case) == {'a', 'b'} and all(type(case[k]) is str and re.fullmatch(r'0|-?[1-9][0-9]*', case[k]) for k in ('a', 'b')), 'G0_CANONICAL_SIGNED_DECIMAL_REQUEST')
        summary['requestPin'], summary['oraclePin'] = pin(request_path), pin(oracle_path)
        actual_request = evidence.directory / 'candidate-request.json'
        evidence.put(actual_request.name, request_path.read_bytes())
        require(pin(actual_request) == summary['requestPin'], 'ACTUAL_G0_REQUEST_COPY')
        reply_path = evidence.directory / 'candidate-reply.json'
        cursor = 'one-global-meter-candidate-command'
        summary['counts']['candidateCommands'] = 1
        child('candidate', [protocol['nodeGuard'], str(CORE / 'candidate.mjs'), 'gcd-bank', str(actual_request), str(reply_path)])
        summary['candidateReplyPin'] = evidence.adopt(reply_path)
        reply = read(reply_path)
        require(reply['protocol'] == 'p4-invariant-gcd-bank-v1' and isinstance(reply['proofCounters'], dict), 'TYPED_G0_GLOBAL_METER_REPLY')
        summary['counts']['globalMeters'] = 1
        summary['proofCounters'] = reply['proofCounters']
        summary['candidateResult'] = dict(status=reply['status'], reason=reply['reason'], failedCaseIndex=reply['failedCaseIndex'])
        require(reply['protocol'] == 'p4-invariant-gcd-bank-v1' and reply['status'] == 'EXACT_GCD_BANK_CERTIFIED' and reply['reason'] is None and reply['failedCaseIndex'] is None and len(reply['gcds']) == 32, 'G0_COMPLETE_CANDIDATE_RETURN')
        cursor = 'independent-global-gcd-audit'
        report_path = evidence.directory / 'independent-gcd.json'
        summary['counts']['independentAudits'] = 1
        child('independent', [protocol['python'], '-B', str(REFERENCE / 'audit.py'), str(actual_request), str(oracle_path), str(reply_path), str(report_path)])
        summary['independentReportPin'] = evidence.adopt(report_path)
        report = read(report_path)
        require(report['status'] == g0['auditorSuccessStatus'] and report['firstFailure'] is None, 'G0_INDEPENDENT_ALL_PAIRS_REQUIRED')
        require(report['caseCount'] == report['verifiedCases'] == 32 and report['candidateCallsByAuditor'] == report['WorldCalls'] == 0, 'INDEPENDENT_G0_EXACT_CENSUS')
        require(report['requestPin'] == summary['requestPin'] and report['oraclePin'] == summary['oraclePin'] and report['replyPin'] == summary['candidateReplyPin'], 'INDEPENDENT_G0_ACTUAL_INPUT_REPLY_PINS')
        counters = reply['proofCounters']
        require(counters['limit'] == 2000000 and counters['resetCount'] == 0 and 0 <= counters['performed'] == counters['attempted'] <= 2000000 and counters['denied'] is None, 'ONE_ORIGINAL_GLOBAL_TWO_MILLION_METER')
        summary['counts']['pairsVerified'] = 32
        summary['counts']['globalMeters'] = 1
        summary['proofCounters'] = counters
        summary['privateStats'] = reply['privateStats']
        summary['independentStatus'] = report['status']
        summary['status'] = 'PASS_BOUNDED_CODEC_G0_THIRTY_TWO_GLOBAL_METERED_PAIRS'
    except Exception as error:
        summary['status'] = 'NO_GO_BOUNDED_CODEC_G0_FIRST_FAILURE'
        summary['firstFailure'] = dict(cursor=cursor, type=type(error).__name__, message=str(error))
    finally:
        signal.alarm(0); signal.signal(signal.SIGALRM, old_handler)
        summary.update(elapsedWallNs=round((time.monotonic()-started)*1e9), writtenEvidenceBytesBeforeSummary=evidence.bytes,
                       laterChecks='NOT_RUN_AFTER_FIRST_FAILURE' if summary['firstFailure'] else 'FRESH_A10_REQUIRED_BEFORE_B6',
                       oldCandidates='UNCHANGED_ENDED', numericalBankScope='GCD32_ONLY_NO_KERNEL_WORLD_COMPACT')
        evidence.put('summary.json', summary, terminal=True)
    print(json.dumps(dict(status=summary['status'], firstFailure=summary['firstFailure'], counts=summary['counts'])))
    return int(summary['firstFailure'] is not None)


if __name__ == '__main__':
    raise SystemExit(main())
