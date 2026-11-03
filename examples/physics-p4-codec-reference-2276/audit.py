"""ROOT ONLY U0: exact codec oracle plus independent integer IEEE decomposition."""
import re
import sys
from pathlib import Path
from materialize import integer_literal
from support import HERE, authenticate, deadline, decimal, keys, load, natural, pin, require, write

WORD = re.compile(r'[0-9a-f]{16}\Z', re.ASCII)

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
        require(counters[field] == 0, 'CODEC_ONLY_DIMENSIONS')
    for phase in ('prepare', 'factor', 'kkt', 'compare'):
        require(counters['phasePerformed'][phase] == 0, 'CODEC_ONLY_PHASES')
    require(counters['gcdRemainders'] <= counters['operationCounts']['REM'], 'GCD_REM_ACCOUNTING')
    natural(counters['peakInputBits'], 8192)
    natural(counters['peakReducedBits'], 8192)
    natural(counters['peakIntermediateBits'], 16385)


def ieee_expected(word):
    """Exact integer decomposition, independent of Python's native float oracle."""
    require(isinstance(word, str) and WORD.fullmatch(word) is not None, 'WORD_CANONICAL')
    bits = int(word, 16)
    sign = -1 if bits >> 63 else 1
    exponent = (bits >> 52) & 2047
    fraction = bits & ((1 << 52) - 1)
    if exponent == 2047:
        return {'inputWordHex': word, 'status': 'REJECTED_NONFINITE',
                'reason': 'PROOF_INPUT_INVALID'}
    numerator = fraction if exponent == 0 else (1 << 52) + fraction
    power = -1074 if exponent == 0 else exponent - 1075
    denominator = 1
    if numerator == 0:
        return {'inputWordHex': word, 'status': 'FINITE_CERTIFIED',
                'exactQ': '0/1', 'rneWordHex': '0000000000000000'}
    if power >= 0:
        require(numerator.bit_length() + power <= 1024, 'FINITE_PRE_SHIFT')
        numerator <<= power
    else:
        require(-power <= 1074, 'FINITE_DENOMINATOR_BOUND')
        denominator <<= -power
        reductions = 0
        while numerator % 2 == 0 and denominator > 1:
            reductions += 1
            require(reductions <= 1074, 'DYADIC_REDUCTION_BOUND')
            numerator //= 2
            denominator //= 2
    numerator *= sign
    return {'inputWordHex': word, 'status': 'FINITE_CERTIFIED',
            'exactQ': str(numerator) + '/' + str(denominator), 'rneWordHex': word}


def main():
    deadline()
    require(len(sys.argv) == 5, 'USAGE: audit.py REQUESTS ORACLE REPLY FRESH_OUTPUT')
    request_path, oracle_path, reply_path, output_path = map(Path, sys.argv[1:])
    report = {'protocol': 'p4-independent-codec-audit-v1',
              'status': 'EXECUTED_NO_GO_CODEC_BANK', 'verifiedDecimals': 0,
              'verifiedFiniteWords': 0, 'verifiedExpectedRejections': 0,
              'firstFailure': None, 'candidateCallsByAuditor': 0, 'WorldCalls': 0}
    exit_status = 1
    try:
        source_pins = authenticate()
        manifest = load(oracle_path.parent / 'manifest.json')
        keys(manifest, ('format', 'decimalCount', 'finiteWordCount', 'invalidWordCount',
                        'wordCount', 'candidateInput', 'oracleOnly', 'specPin',
                        'sourcePins', 'files', 'candidateCalls', 'WorldCalls'), 'MANIFEST_KEYS')
        require(manifest['format'] == 'p4-independent-codec-manifest-v1' and
                manifest['sourcePins'] == source_pins and manifest['decimalCount'] == 16 and
                manifest['wordCount'] == 28 and manifest['finiteWordCount'] == 24 and
                manifest['invalidWordCount'] == 4 and manifest['candidateCalls'] == 0 and
                manifest['WorldCalls'] == 0, 'MANIFEST_AUTHENTICATION')
        require(manifest['files']['requests.json'] == pin(request_path) and
                manifest['files']['oracle.json'] == pin(oracle_path), 'BANK_FILE_AUTHENTICATION')
        spec = load(HERE / 'bank-spec.json')
        oracle = load(oracle_path)
        request = load(request_path)
        actual = load(reply_path)
        keys(request, ('op', 'decimals', 'words'), 'REQUEST_KEYS')
        require(request['op'] == 'codec-bank' and isinstance(request['decimals'], list) and
                isinstance(request['words'], list) and len(request['decimals']) == 16 and
                len(request['words']) == 28, 'REQUEST_COUNTS')
        keys(oracle, ('format', 'specPin', 'requestPin', 'decimals', 'words'), 'ORACLE_KEYS')
        require(oracle['format'] == 'p4-independent-codec-oracle-v1' and
                oracle['specPin'] == manifest['specPin'] == pin(HERE / 'bank-spec.json') and
                oracle['requestPin'] == pin(request_path) and len(oracle['decimals']) == 16 and
                len(oracle['words']) == 28, 'ORACLE_AUTHENTICATION')
        keys(actual, ('protocol', 'status', 'reason', 'decimalTexts', 'wordResults',
                      'failedSection', 'failedCaseIndex', 'proofCounters', 'privateStats'),
             'REPLY_KEYS')
        require(actual['protocol'] == 'p4-bounded-codec-bank-v1', 'REPLY_PROTOCOL')
        require(actual['status'] == 'EXACT_CODEC_BANK_CERTIFIED',
                'ACTUAL_REFUSAL:' + str(actual['reason']))
        require(actual['reason'] is None and actual['failedSection'] is None and
                actual['failedCaseIndex'] is None, 'SUCCESS_TAGS')
        require(isinstance(actual['decimalTexts'], list) and len(actual['decimalTexts']) == 16 and
                isinstance(actual['wordResults'], list) and len(actual['wordResults']) == 28,
                'REPLY_COUNTS')
        audit_counters(actual['proofCounters'])
        keys(actual['privateStats'], ('guardedGcdEntries', 'invariantRemainders',
                                     'guardedTextEntries', 'constantF64Returns',
                                     'fixedWordDecodes'), 'PRIVATE_STATS_KEYS')
        for value in actual['privateStats'].values():
            natural(value)
        require(actual['privateStats']['invariantRemainders'] ==
                actual['proofCounters']['gcdRemainders'], 'INVARIANT_REMAINDER_CENSUS')
        # Specific diagnostic semantics are fixed in CONTRACT before execution.
        require(actual['privateStats']['guardedTextEntries'] == 64, 'TEXT_GUARD_CENSUS')
        require(actual['privateStats']['constantF64Returns'] == 4, 'CONSTANT_RETURN_CENSUS')
        require(actual['privateStats']['fixedWordDecodes'] == 20, 'FIXED_DECODE_CENSUS')
        for index, (text, returned, golden, literal) in enumerate(zip(
                request['decimals'], actual['decimalTexts'], oracle['decimals'], spec['decimals'])):
            report['activeCase'] = {'section': 'decimals', 'index': index, 'id': literal['id']}
            keys(golden, ('index', 'id', 'expectedText'), 'INTEGER_ORACLE_KEYS')
            require(golden['index'] == index and golden['id'] == literal['id'], 'INTEGER_PROVENANCE')
            number, result = decimal(text), decimal(returned)
            require(number == integer_literal(literal) and result == number and
                    returned == text == golden['expectedText'] == str(number),
                    'EXACT_INTEGER_TEXT')
            report['verifiedDecimals'] += 1
        for index, (word, returned, golden, literal) in enumerate(zip(
                request['words'], actual['wordResults'], oracle['words'], spec['words'])):
            report['activeCase'] = {'section': 'words', 'index': index, 'id': literal['id']}
            keys(golden, ('index', 'id', 'expected'), 'WORD_ORACLE_KEYS')
            require(golden['index'] == index and golden['id'] == literal['id'] and
                    word == literal['word'], 'WORD_PROVENANCE')
            expected = ieee_expected(word)
            require(golden['expected'] == expected, 'STRUCT_ORACLE_VS_INTEGER_DERIVATION')
            require(returned == expected, 'EXACT_WORD_RESULT')
            if expected['status'] == 'FINITE_CERTIFIED':
                require(literal['expected'] == 'finite', 'FINITE_SPEC_CLASSIFICATION')
                report['verifiedFiniteWords'] += 1
            else:
                require(literal['expected'] == 'invalid', 'INVALID_SPEC_CLASSIFICATION')
                report['verifiedExpectedRejections'] += 1
        require(report['verifiedDecimals'] == 16 and report['verifiedFiniteWords'] == 24 and
                report['verifiedExpectedRejections'] == 4, 'COMPLETE_BANK_COUNTS')
        report.pop('activeCase', None)
        report.update(status='EXECUTED_PASS_EXACT_CODEC_BANK',
                      requestPin=pin(request_path), oraclePin=pin(oracle_path),
                      replyPin=pin(reply_path), proofCounters=actual['proofCounters'],
                      privateStats=actual['privateStats'])
        exit_status = 0
    except (ValueError, KeyError, TypeError, IndexError, OSError, TimeoutError) as error:
        report['firstFailure'] = type(error).__name__ + ':' + str(error)[:512]
    write(output_path, report)
    return exit_status


if __name__ == '__main__':
    sys.exit(main())

