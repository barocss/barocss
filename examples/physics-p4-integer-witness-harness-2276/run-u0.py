"""Root-only codec gate. Candidate gets requests only, never the oracle."""
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
CORE = ROOT / 'examples/physics-p4-integer-witness-2276'
REFERENCE = ROOT / 'examples/physics-p4-codec-reference-2276'


def read(path, cap=REPLY_BYTES):
    return read_json(path, cap)


def main():
    require(len(sys.argv) == 3 and re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', sys.argv[1]) is not None, 'ONE_FRESH_U0_ID')
    evidence = Evidence(HOME / 'evidence' / sys.argv[1])
    started = time.monotonic()
    deadline = started + 170
    summary = dict(protocol='p4-bounded-codec-u0-harness-v1', status='NOT_RUN', firstFailure=None,
                   counts=dict(candidateCommands=0, independentAudits=0, decimalsVerified=0, finiteWordsVerified=0, rejectedWordsVerified=0,
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
        require(result['status'] == 'PASS_COMMAND_ONLY', result['firstFailure'] or 'U0_COMMAND_FAILED')

    try:
        frozen_path = HOME / 'AUTHOR-FREEZE-01.json'
        frozen = read(frozen_path, EVIDENCE_BYTES)
        authenticate(ROOT, frozen['files']); authenticate(ROOT, frozen['externalToolFiles'])
        summary['freezePin'] = pin(frozen_path)
        protocol = read(ROOT / frozen['runProtocol'])
        summary['guardPolicy'] = dict(protocol['guardPolicy'], pin=pin(ROOT / protocol['guardPolicy']['path']))
        prior_path = Path(sys.argv[2]).resolve()
        require(prior_path.is_relative_to(HOME / 'evidence') and prior_path.name == 'summary.json', 'OWNED_FRESH_G0_PREREQUISITE')
        prior = read(prior_path)
        require(prior['status'] == 'PASS_BOUNDED_CODEC_G0_THIRTY_TWO_GLOBAL_METERED_PAIRS' and prior['firstFailure'] is None and prior['freezePin'] == summary['freezePin'], 'FRESH_SAME_SOURCE_G0_PASS_BEFORE_U0')
        require(prior['counts']['pairsVerified'] == 32 and prior['counts']['globalMeters'] == 1, 'FRESH_G0_EXACT_CENSUS')
        require(pin(prior_path.parent / 'candidate-reply.json') == prior['candidateReplyPin'] and pin(prior_path.parent / 'independent-gcd.json') == prior['independentReportPin'], 'FRESH_G0_PROOF_PINS')
        summary['g0Prerequisite'] = dict(path=str(prior_path.relative_to(ROOT)), pin=pin(prior_path), qualifiedPairs=32)
        u0 = protocol['u0']
        bank = (ROOT / u0['bankDirectory']).resolve()
        require(bank.is_relative_to(REFERENCE / 'evidence'), 'ORIGINAL_IMMUTABLE_U0_BANK')
        request_path, oracle_path = bank / u0['requestFile'], bank / u0['oracleFile']
        request = read(request_path)
        require(set(request) == {'op', 'decimals', 'words'} and request['op'] == 'codec-bank' and len(request['decimals']) == 16 and len(request['words']) == 28, 'EXACT_U0_REQUEST_ONLY')
        require(all(type(value) is str and re.fullmatch(r'0|-?[1-9][0-9]*', value) for value in request['decimals']), 'U0_CANONICAL_SIGNED_DECIMALS')
        require(all(type(value) is str and re.fullmatch(r'[0-9a-f]{16}', value) for value in request['words']), 'U0_EXACT_BIG_ENDIAN_WORD_HEX')
        summary['requestPin'], summary['oraclePin'] = pin(request_path), pin(oracle_path)
        actual_request = evidence.directory / 'candidate-request.json'
        evidence.put(actual_request.name, request_path.read_bytes())
        require(pin(actual_request) == summary['requestPin'], 'ACTUAL_U0_REQUEST_COPY')
        reply_path = evidence.directory / 'candidate-reply.json'
        cursor = 'one-global-meter-candidate-command'
        summary['counts']['candidateCommands'] = 1
        child('candidate', [protocol['nodeGuard'], str(CORE / 'candidate.mjs'), 'codec-bank', str(actual_request), str(reply_path)])
        summary['candidateReplyPin'] = evidence.adopt(reply_path)
        reply = read(reply_path)
        require(reply['protocol'] == 'p4-bounded-codec-bank-v1' and isinstance(reply['proofCounters'], dict), 'TYPED_U0_GLOBAL_METER_REPLY')
        summary['counts']['globalMeters'] = 1
        summary['proofCounters'] = reply['proofCounters']
        summary['candidateResult'] = dict(status=reply['status'], reason=reply['reason'], failedSection=reply['failedSection'], failedCaseIndex=reply['failedCaseIndex'])
        require(reply['protocol'] == 'p4-bounded-codec-bank-v1' and reply['status'] == 'EXACT_CODEC_BANK_CERTIFIED' and reply['reason'] is None and reply['failedSection'] is None and reply['failedCaseIndex'] is None and len(reply['decimalTexts']) == 16 and len(reply['wordResults']) == 28, 'U0_COMPLETE_CANDIDATE_RETURN')
        cursor = 'independent-global-codec-audit'
        report_path = evidence.directory / 'independent-codec.json'
        summary['counts']['independentAudits'] = 1
        child('independent', [protocol['python'], '-B', str(REFERENCE / 'audit.py'), str(actual_request), str(oracle_path), str(reply_path), str(report_path)])
        summary['independentReportPin'] = evidence.adopt(report_path)
        report = read(report_path)
        require(report['status'] == u0['auditorSuccessStatus'] and report['firstFailure'] is None, 'U0_INDEPENDENT_ALL_PAIRS_REQUIRED')
        require(report['verifiedDecimals'] == 16 and report['verifiedFiniteWords'] == 24 and report['verifiedExpectedRejections'] == 4, 'U0_EXACT_INDEPENDENT_POSITIVE_AND_REJECTION_CENSUS')
        require(report['candidateCallsByAuditor'] == report['WorldCalls'] == 0, 'INDEPENDENT_U0_NO_CANDIDATE_OR_WORLD_CALLS')
        require(report['requestPin'] == summary['requestPin'] and report['oraclePin'] == summary['oraclePin'] and report['replyPin'] == summary['candidateReplyPin'], 'INDEPENDENT_U0_ACTUAL_INPUT_REPLY_PINS')
        counters = reply['proofCounters']
        require(counters['limit'] == 2000000 and counters['resetCount'] == 0 and 0 <= counters['performed'] == counters['attempted'] <= 2000000 and counters['denied'] is None, 'ONE_ORIGINAL_GLOBAL_TWO_MILLION_METER')
        require(sum(row['status'] == 'FINITE_CERTIFIED' for row in reply['wordResults']) == 24 and sum(row['status'] == 'REJECTED_NONFINITE' for row in reply['wordResults']) == 4, 'U0_FINITE_AND_REJECTED_WORD_COUNTS')
        summary['counts']['decimalsVerified'] = 16
        summary['counts']['finiteWordsVerified'] = 24
        summary['counts']['rejectedWordsVerified'] = 4
        summary['counts']['globalMeters'] = 1
        summary['proofCounters'] = counters
        summary['privateStats'] = reply['privateStats']
        summary['independentStatus'] = report['status']
        summary['status'] = 'PASS_BOUNDED_CODEC_U0_SIXTEEN_DECIMALS_TWENTY_EIGHT_WORDS'
    except Exception as error:
        summary['status'] = 'NO_GO_BOUNDED_CODEC_U0_FIRST_FAILURE'
        summary['firstFailure'] = dict(cursor=cursor, type=type(error).__name__, message=str(error))
    finally:
        signal.alarm(0); signal.signal(signal.SIGALRM, old_handler)
        summary.update(elapsedWallNs=round((time.monotonic()-started)*1e9), writtenEvidenceBytesBeforeSummary=evidence.bytes,
                       laterChecks='NOT_RUN_AFTER_FIRST_FAILURE' if summary['firstFailure'] else 'FRESH_A10_REQUIRED_BEFORE_B6',
                       oldCandidates='UNCHANGED_ENDED', numericalBankScope='CODEC16_PLUS_24_FINITE_AND_4_REJECTED_WORDS_NO_KERNEL_WORLD_COMPACT')
        evidence.put('summary.json', summary, terminal=True)
    print(json.dumps(dict(status=summary['status'], firstFailure=summary['firstFailure'], counts=summary['counts'])))
    return int(summary['firstFailure'] is not None)


if __name__ == '__main__':
    raise SystemExit(main())
