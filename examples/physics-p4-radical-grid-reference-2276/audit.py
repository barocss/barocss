"""ROOT ONLY R0 prefix auditor: direct inequalities and independent RNE cells."""
import re
import sys
from pathlib import Path
from oracle_math import Work, problem, request_from_case, rne_cell, square_terms
from support import HERE, authenticate, deadline, decimal, keys, load, natural, pin, require, write

WORD = re.compile(r'[0-9a-f]{16}\Z', re.ASCII)


def verify_grid(request, interval, exact, work):
    keys(interval, ('low', 'high', 'precision'), 'INTERVAL_KEYS')
    n, d, s, p = problem(request)
    require(d > 0 and s > 0 and interval['precision'] == p and type(exact) is bool,
            'INTERVAL_DOMAIN')
    low, high = decimal(interval['low']), decimal(interval['high'])
    if n == 0:
        require(low == high == 0 and exact, 'ZERO_INTERVAL')
        return
    positive_low, positive_high = (low, high) if n > 0 else (-high, -low)
    require(positive_low >= 0 and positive_high >= positive_low, 'INTERVAL_SIGN')
    c, b = square_terms(n, d, s, p, work)
    lower = work.mul(work.mul(positive_low, positive_low), b)
    successor = work.add(positive_low, 1)
    upper = work.mul(work.mul(successor, successor), b)
    require(lower <= c < upper, 'MINIMAL_GRID_SQUARE_CERTIFICATE')
    require(exact == (lower == c), 'EXACT_GRID_EQUALITY')
    require(positive_high == positive_low + (0 if exact else 1), 'MINIMAL_GRID_WIDTH')


def verify_stats(stats, previous):
    keys(stats, ('integerOperations', 'peakIntegerBits', 'axisVisits', 'conventionProblems'),
         'STATS_KEYS')
    operations = natural(stats['integerOperations'])
    peak = natural(stats['peakIntegerBits'], 16384)
    require(operations >= previous[0] and peak >= previous[1], 'NONMONOTONE_SHARED_METER')
    require(type(stats['axisVisits']) is int and stats['axisVisits'] == 0 and
            type(stats['conventionProblems']) is int and stats['conventionProblems'] == 0,
            'PURE_KERNEL_CENSUS')
    return operations, peak


def main():
    deadline()
    require(len(sys.argv) == 5, 'USAGE: audit.py REQUESTS ORACLE REPLIES_PREFIX FRESH_OUTPUT')
    request_path, oracle_path, result_path, output_path = map(Path, sys.argv[1:])
    report = {'protocol': 'p4-independent-radical-audit-v1',
              'status': 'EXECUTED_NO_GO_RADICAL_GRID_BANK', 'verifiedPrefix': 0,
              'verifiedValid': 0, 'verifiedExpectedInvalid': 0,
              'verifiedExpectedResource': 0, 'firstFailure': None,
              'candidateCallsByAuditor': 0, 'WorldCalls': 0}
    exit_status = 1
    try:
        source_pins = authenticate()
        manifest = load(oracle_path.parent / 'manifest.json')
        require(manifest['format'] == 'p4-independent-radical-manifest-v1' and
                manifest['caseCount'] == 17 and manifest['validCount'] == 13 and
                manifest['invalidCount'] == 2 and manifest['resourceCount'] == 2 and
                manifest['sourcePins'] == source_pins, 'MANIFEST_AUTHENTICATION')
        require(manifest['files']['requests.json'] == pin(request_path) and
                manifest['files']['oracle.json'] == pin(oracle_path), 'BANK_AUTHENTICATION')
        request_bank, oracle, result = load(request_path), load(oracle_path), load(result_path)
        spec = load(HERE / 'bank-spec.json')
        keys(request_bank, ('format', 'requests'), 'REQUEST_BANK_KEYS')
        require(request_bank['format'] == 'p4-radical-grid-requests-v1' and
                len(request_bank['requests']) == 17, 'REQUEST_BANK_COUNT')
        keys(oracle, ('format', 'specPin', 'requestPin', 'cases'), 'ORACLE_KEYS')
        require(oracle['format'] == 'p4-independent-radical-oracle-v1' and
                oracle['specPin'] == manifest['specPin'] == pin(HERE / 'bank-spec.json') and
                oracle['requestPin'] == pin(request_path) and len(oracle['cases']) == 17,
                'ORACLE_AUTHENTICATION')
        keys(result, ('format', 'replies'), 'RESULT_BANK_KEYS')
        require(result['format'] == 'p4-radical-grid-results-v1' and
                isinstance(result['replies'], list) and 1 <= len(result['replies']) <= 17,
                'REPLY_PREFIX_COUNT')
        work = Work()
        previous = (0, 0)
        for index, actual in enumerate(result['replies']):
            case, golden = spec['cases'][index], oracle['cases'][index]
            request = request_bank['requests'][index]
            report['activeCase'] = {'index': index, 'id': case['id'], 'kind': case['kind']}
            keys(request, ('numerator', 'denominator', 'square', 'precision'), 'REQUEST_KEYS')
            require(request == request_from_case(case, work), 'ORIGINAL_LITERAL_INPUT')
            keys(golden, ('index', 'id', 'kind', 'expected'), 'ORACLE_CASE_KEYS')
            require(golden['index'] == index and golden['id'] == case['id'] and
                    golden['kind'] == case['kind'], 'CASE_PROVENANCE')
            keys(actual, ('protocol', 'status', 'reason', 'interval', 'exact', 'stats'), 'REPLY_KEYS')
            require(actual['protocol'] == 'p4-radical-grid-kernel-v1', 'REPLY_PROTOCOL')
            previous = verify_stats(actual['stats'], previous)
            expected = golden['expected']
            require(actual['status'] == expected['status'] and actual['reason'] == expected['reason'] and
                    actual['interval'] == expected['interval'] and actual['exact'] == expected['exact'],
                    'EXPECTED_INTERVAL_OR_TYPED_REFUSAL')
            if case['kind'] == 'valid':
                require(actual['status'] == 'CERTIFIED_DIRECT_GRID' and actual['reason'] is None,
                        'VALID_STATUS')
                verify_grid(request, actual['interval'], actual['exact'], work)
                rne = expected['rne']
                require(WORD.fullmatch(rne['wordHex']) is not None, 'RNE_WORD')
                word = int(rne['wordHex'], 16)
                n = decimal(request['numerator'])
                require((word >> 63) == (1 if n < 0 else 0), 'RNE_SIGN')
                require(rne == rne_cell(request, actual['interval'], word & ((1 << 63) - 1), work),
                        'INDEPENDENT_RADICAL_RNE_CELL')
                report['verifiedValid'] += 1
            else:
                require(actual['status'] == 'UNRESOLVED' and actual['interval'] is None and
                        actual['exact'] is None and actual['reason'] == case['reason'],
                        'EXPECTED_REFUSAL')
                field = 'verifiedExpectedInvalid' if case['kind'] == 'invalid' else 'verifiedExpectedResource'
                report[field] += 1
            report['verifiedPrefix'] += 1
        complete = report['verifiedPrefix'] == 17
        if complete:
            require((report['verifiedValid'], report['verifiedExpectedInvalid'],
                     report['verifiedExpectedResource']) == (13, 2, 2), 'COMPLETE_CENSUS')
        report.pop('activeCase', None)
        report.update(status='EXECUTED_PASS_EXACT_RADICAL_GRID_BANK' if complete else
                      'EXECUTED_PASS_PREFIX_RADICAL_GRID', complete=complete,
                      requestPin=pin(request_path), oraclePin=pin(oracle_path),
                      repliesPin=pin(result_path), finalStats=result['replies'][-1]['stats'],
                      referenceMajorOperations=work.operations)
        exit_status = 0
    except (ValueError, KeyError, TypeError, IndexError, OSError, TimeoutError) as error:
        report['firstFailure'] = type(error).__name__ + ':' + str(error)[:512]
    write(output_path, report)
    return exit_status


if __name__ == '__main__':
    sys.exit(main())
