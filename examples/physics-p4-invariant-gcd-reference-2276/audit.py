"""ROOT ONLY: compare actual G0 output to the frozen independent oracle."""
import sys
from pathlib import Path
from literals import operand
from support import HERE, authenticate, deadline, decimal, keys, load, natural, pin, require, write

PHASES = ('parse', 'prepare', 'factor', 'kkt', 'rne', 'compare')
OPS = ('READ_FIELD', 'READ_CHAR', 'WRITE_CHAR', 'READ_BYTE', 'ADD', 'SUB', 'MUL',
       'NEG', 'CMP', 'BIT_LENGTH', 'SHL', 'SHR', 'AND', 'OR', 'QUOT', 'REM',
       'DIVMOD', 'F64_CAST', 'F64_PACK', 'F64_FROM_SMALL_INT', 'F64_SCALE_POW2',
       'F64_FINITE', 'F64_CMP', 'F64_ABS', 'F64_SUB', 'F64_HYPOT3')
COUNTERS = ('pricing', 'limit', 'performed', 'attempted', 'phasePerformed',
            'phaseAttempted', 'operationCounts', 'gcdRemainders', 'normalizations',
            'factorizationAttempts', 'pivots', 'allRows', 'dynamicDof', 'witnessRows',
            'peakInputBits', 'peakReducedBits', 'peakIntermediateBits', 'denied', 'resetCount')


def audit_counters(counters):
    keys(counters, COUNTERS, 'COUNTER_KEYS')
    require(counters['pricing'] == 'p4-position-witness-primitives-v1', 'PRICING')
    require(counters['limit'] == 2000000 and counters['resetCount'] == 0, 'GLOBAL_METER')
    require(counters['denied'] is None, 'DENIED_OPERATION')
    performed = natural(counters['performed'])
    require(performed > 0 and natural(counters['attempted']) == performed, 'PERFORMED')
    keys(counters['operationCounts'], OPS, 'OPERATION_KEYS')
    weighted = 0
    for op in OPS:
        weighted += natural(counters['operationCounts'][op]) * (2 if op == 'DIVMOD' else 1)
    require(weighted == performed, 'PRICED_SUM')
    for field in ('phasePerformed', 'phaseAttempted'):
        keys(counters[field], PHASES, 'PHASE_KEYS')
        require(sum(natural(counters[field][p]) for p in PHASES) == performed, 'PHASE_SUM')
    require(counters['phasePerformed'] == counters['phaseAttempted'], 'PHASE_ATTEMPTS')
    for field in ('gcdRemainders', 'normalizations', 'factorizationAttempts', 'pivots',
                  'allRows', 'dynamicDof', 'witnessRows'):
        natural(counters[field])
    for field in ('factorizationAttempts', 'pivots', 'allRows', 'dynamicDof', 'witnessRows'):
        require(counters[field] == 0, 'GCD_ONLY_DIMENSIONS')
    for phase in ('prepare', 'kkt', 'compare'):
        require(counters['phasePerformed'][phase] == 0, 'GCD_ONLY_PHASES')
    require(counters['gcdRemainders'] <= counters['operationCounts']['REM'], 'GCD_REM_ACCOUNTING')
    natural(counters['peakInputBits'], 8192)
    natural(counters['peakReducedBits'], 8192)
    natural(counters['peakIntermediateBits'], 16385)


def main():
    deadline()
    require(len(sys.argv) == 5, 'USAGE: audit.py REQUESTS ORACLE REPLY FRESH_OUTPUT')
    request_path, oracle_path, reply_path, output_path = map(Path, sys.argv[1:])
    report = {'protocol': 'p4-independent-invariant-gcd-audit-v1', 'status': 'EXECUTED_NO_GO_GCD_BANK',
              'caseCount': 32, 'verifiedCases': 0, 'firstFailure': None,
              'candidateCallsByAuditor': 0, 'WorldCalls': 0}
    exit_status = 1
    try:
        source_pins = authenticate()
        manifest = load(oracle_path.parent / 'manifest.json')
        require(manifest['format'] == 'p4-independent-gcd-manifest-v1' and
                manifest['caseCount'] == 32 and manifest['sourcePins'] == load(HERE / '../physics-p4-gcd-reference-2276/PINS.json'),
                'MANIFEST_SOURCE_AUTHENTICATION')
        require(manifest['files']['requests.json'] == pin(request_path) and
                manifest['files']['oracle.json'] == pin(oracle_path), 'BANK_FILE_AUTHENTICATION')
        require(source_pins['bank']['requests.json'] == pin(request_path) and
                source_pins['bank']['oracle.json'] == pin(oracle_path) and
                source_pins['bank']['manifest.json'] == pin(oracle_path.parent / 'manifest.json'),
                'ORIGINAL_EXECUTED_BANK_BYTES')
        spec = load(HERE / '../physics-p4-gcd-reference-2276/bank-spec.json')
        oracle = load(oracle_path)
        request = load(request_path)
        actual = load(reply_path)
        keys(request, ('op', 'cases'), 'REQUEST_KEYS')
        require(request['op'] == 'gcd-bank' and len(request['cases']) == 32, 'REQUEST_COUNT')
        keys(oracle, ('format', 'specPin', 'requestPin', 'cases'), 'ORACLE_KEYS')
        require(oracle['format'] == 'p4-independent-gcd-oracle-v1' and
                oracle['specPin'] == manifest['specPin'] == pin(HERE / '../physics-p4-gcd-reference-2276/bank-spec.json') and
                oracle['requestPin'] == pin(request_path) and len(oracle['cases']) == 32,
                'ORACLE_AUTHENTICATION')
        keys(actual, ('protocol', 'status', 'reason', 'gcds', 'failedCaseIndex',
                      'proofCounters', 'privateStats'), 'REPLY_KEYS')
        require(actual['protocol'] == 'p4-invariant-gcd-bank-v1', 'REPLY_PROTOCOL')
        require(actual['status'] == 'EXACT_GCD_BANK_CERTIFIED',
                'ACTUAL_REFUSAL:' + str(actual['reason']))
        require(actual['reason'] is None and actual['failedCaseIndex'] is None, 'SUCCESS_TAGS')
        require(isinstance(actual['gcds'], list) and len(actual['gcds']) == 32, 'REPLY_COUNT')
        audit_counters(actual['proofCounters'])
        keys(actual['privateStats'], ('guardedGcdEntries', 'invariantRemainders'),
             'PRIVATE_STATS_KEYS')
        require(natural(actual['privateStats']['guardedGcdEntries']) == 32,
                'GUARDED_GCD_ENTRY_CENSUS')
        require(natural(actual['privateStats']['invariantRemainders']) > 0 and
                actual['privateStats']['invariantRemainders'] ==
                actual['proofCounters']['gcdRemainders'], 'INVARIANT_REMAINDER_CENSUS')
        for index, (case, expected, literal, gcd_text) in enumerate(zip(
                request['cases'], oracle['cases'], spec['cases'], actual['gcds'])):
            report['activeCase'] = {'index': index, 'id': literal['id']}
            keys(case, ('a', 'b'), 'OPERAND_KEYS')
            keys(expected, ('index', 'id', 'expected', 'accelerationCoverage'), 'ORACLE_CASE_KEYS')
            keys(expected['expected'], ('gcd', 'u', 'v'), 'ORACLE_GCD_KEYS')
            require(expected['index'] == index and expected['id'] == literal['id'] and
                    expected['accelerationCoverage'] is literal.get('accelerationCoverage', False),
                    'CASE_PROVENANCE')
            a, b = decimal(case['a']), decimal(case['b'])
            require(a == operand(literal['a']) and b == operand(literal['b']), 'LITERAL_MISMATCH')
            gcd = decimal(gcd_text, nonnegative=True)
            golden = decimal(expected['expected']['gcd'], nonnegative=True)
            u, v = decimal(expected['expected']['u']), decimal(expected['expected']['v'])
            require(gcd_text == expected['expected']['gcd'] and gcd == golden, 'EXACT_GCD_DIGITS')
            if a == 0 and b == 0:
                require(gcd_text == '0' and u == 0 and v == 0, 'BOTH_ZERO_CANONICAL')
            else:
                require(gcd > 0, 'POSITIVE_GCD')
                require(a % gcd == 0 and b % gcd == 0, 'DIVISIBILITY')
                positive = [abs(x) for x in (a, b) if x]
                require(gcd <= min(positive), 'GCD_BOUND')
                if not a or not b:
                    require(gcd == max(abs(a), abs(b)), 'ONE_ZERO_GCD')
                require(abs(u) <= max(abs(a), abs(b)) and abs(v) <= max(abs(a), abs(b)),
                        'BEZOUT_COEFFICIENT_BOUND')
                require(abs(u).bit_length() + abs(a).bit_length() <= 16385 and
                        abs(v).bit_length() + abs(b).bit_length() <= 16385,
                        'BEZOUT_PRE_PRODUCT')
                ua, vb = u * a, v * b
                require(max(abs(ua).bit_length(), abs(vb).bit_length()) + 1 <= 16385,
                        'BEZOUT_PRE_ADD')
                require(ua + vb == gcd, 'BEZOUT_GREATESTNESS')
            report['verifiedCases'] += 1
        report.pop('activeCase', None)
        report.update(status='EXECUTED_PASS_EXACT_GCD_BANK',
                      requestPin=pin(request_path), oraclePin=pin(oracle_path),
                      replyPin=pin(reply_path), proofCounters=actual['proofCounters'],
                      privateStats=actual['privateStats'],
                      coverage='original32 exact pairs; guardedEntries32; invariantRemainders=GCD_REM>0; no World')
        exit_status = 0
    except (ValueError, KeyError, TypeError, IndexError, OSError, TimeoutError) as error:
        report['firstFailure'] = type(error).__name__ + ':' + str(error)[:512]
    write(output_path, report)
    return exit_status


if __name__ == '__main__':
    sys.exit(main())
