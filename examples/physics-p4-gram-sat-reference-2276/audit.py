"""ROOT ONLY R1: fixed old-DIRECT oracle and exact signed snapshot audit."""
import re
import sys
from pathlib import Path
from literals import input_words, requests
from support import HERE, authenticate, arm, keys, natural, need, pin, read, same, write

DECIMAL = re.compile(r'(?:0|-[1-9][0-9]*|[1-9][0-9]*)\Z', re.ASCII)
TABLES = {'AAupper': 6, 'BBupper': 6, 'AB': 9, 'faceCenterA': 3,
          'faceCenterB': 3, 'TA': 9, 'TB': 9, 'TC': 9}


def integer(text, positive=False):
    need(type(text) is str and len(text) <= 1024 and DECIMAL.fullmatch(text), 'CANONICAL_TABLE_INTEGER')
    result = int(text)
    need(abs(result).bit_length() <= 2000 and (not positive or result > 0), 'FIXED_BANK_INTEGER_RANGE')
    return result


def model(actual, expected, label):
    keys(actual, ('tables', 'axisResults', 'report', 'minimum'), 'MODEL_KEYS/' + label)
    keys(actual['tables'], TABLES, 'TABLE_KEYS/' + label)
    # Signed mixed projections are consumed BEFORE supports/minima can hide signs.
    for name in ('TA', 'TB', 'TC', 'faceCenterA', 'faceCenterB', 'AAupper', 'BBupper', 'AB'):
        values = actual['tables'][name]
        need(type(values) is list and len(values) == TABLES[name], 'TABLE_LENGTH/' + name)
        for value in values:
            integer(value)
        same(values, expected['tables'][name], 'EXACT_SIGNED_DIRECT_TABLE/' + label + '/' + name)
    axes = actual['axisResults']
    need(type(axes) is list and len(axes) == 15, 'ALL_FIFTEEN_AXIS_RESULTS')
    for index, axis in enumerate(axes):
        keys(axis, ('axis', 'axisDen', 'margin'), 'AXIS_RESULT_KEYS')
        need(type(axis['axis']) is int and axis['axis'] == index, 'AXIS_ORDER')
        integer(axis['axisDen'], positive=True)
        if axis['margin'] is not None:
            keys(axis['margin'], ('N', 'D', 'S'), 'NONZERO_AXIS_MARGIN_KEYS')
            integer(axis['margin']['N'])
            integer(axis['margin']['D'], positive=True)
            integer(axis['margin']['S'], positive=True)
        same(axis, expected['axisResults'][index], 'EXACT_DIRECT_NDS_AXIS_DEN/' + label + '/' + str(index))
    report = actual['report']
    keys(report, ('firstExactMinimum', 'exactTiedMinima', 'axes'), 'REPORT_KEYS')
    minimum = natural(report['firstExactMinimum'], 14)
    need(type(report['exactTiedMinima']) is list and report['exactTiedMinima'] and
         all(type(x) is int and 0 <= x < 15 for x in report['exactTiedMinima']), 'TIE_INDEX_TYPES')
    need(type(report['axes']) is list and len(report['axes']) == 15, 'ALL_AXIS_CLASSIFICATIONS')
    for index, classification in enumerate(report['axes']):
        keys(classification, ('axis', 'exactZero', 'nearParallel', 'marginSign'), 'AXIS_REPORT_KEYS')
        need(type(classification['axis']) is int and classification['axis'] == index and
             type(classification['exactZero']) is bool and type(classification['nearParallel']) is bool,
             'AXIS_CLASSIFICATION_TYPES')
        if axes[index]['margin'] is None:
            need(classification['exactZero'] and classification['marginSign'] is None and
                 classification['nearParallel'] is False, 'OMITTED_ZERO_AXIS_SEMANTICS')
        else:
            n = integer(axes[index]['margin']['N'])
            need(classification['exactZero'] is False and type(classification['marginSign']) is int and
                 classification['marginSign'] == (n > 0) - (n < 0), 'NONZERO_AXIS_MARGIN_SIGN')
    same(report, expected['report'], 'EXACT_OLD_ALL_AXIS_REPORT/' + label)
    keys(actual['minimum'], ('axis', 'N', 'D', 'S'), 'MINIMUM_KEYS')
    need(type(actual['minimum']['axis']) is int and actual['minimum']['axis'] == minimum and
         axes[minimum]['margin'] is not None, 'FIRST_MINIMUM_BINDING')
    same(actual['minimum'], {'axis': minimum, **axes[minimum]['margin']}, 'MINIMUM_TO_ACTUAL_AXIS_NDS')
    same(actual['minimum'], expected['minimum'], 'EXACT_OLD_SELECTED_MINIMUM/' + label)


def main():
    arm()
    need(len(sys.argv) == 5, 'USAGE: audit.py REQUESTS ORACLE REPLIES_PREFIX FRESH_OUTPUT')
    request_path, oracle_path, replies_path, output_path = map(Path, sys.argv[1:])
    report = {'protocol': 'p4-independent-gram-audit-v1', 'status': 'EXECUTED_NO_GO_GRAM_SAT_BANK',
              'verifiedPrefix': 0, 'verifiedConventions': 0, 'verifiedAxisSlots': 0,
              'verifiedGramCoefficients': 0, 'verifiedFaceCenterCoefficients': 0,
              'verifiedSignedMixedCoefficients': 0, 'firstFailure': None,
              'candidateCallsByAuditor': 0, 'directOracleCallsByAuditor': 0,
              'geometryCallsByAuditor': 0, 'coldQpCalls': 0, 'WorldCalls': 0}
    exit_status = 1
    try:
        source_pins = authenticate()
        manifest = read(oracle_path.parent / 'manifest.json')
        need(manifest['format'] == 'p4-independent-gram-manifest-v1' and manifest['caseCount'] == 9 and
             manifest['sourcePins'] == source_pins, 'MANIFEST_AUTHENTICATION')
        need(manifest['files']['requests.json'] == pin(request_path) and
             manifest['files']['oracle.json'] == pin(oracle_path), 'BANK_BYTE_AUTHENTICATION')
        bank, oracle, result = read(request_path), read(oracle_path), read(replies_path)
        spec = read(HERE / 'bank-spec.json')
        original = requests(spec)
        keys(bank, ('format', 'requests'), 'REQUEST_BANK_KEYS')
        need(bank['format'] == 'p4-gram-sat-requests-v1' and len(bank['requests']) == 9, 'FIXED_REQUEST_BANK')
        same(bank['requests'], original, 'FROZEN_LITERAL_INPUT_WORDS')
        keys(oracle, ('format', 'specPin', 'requestPin', 'cases'), 'ORACLE_KEYS')
        need(oracle['format'] == 'p4-independent-gram-oracle-v1' and
             oracle['specPin'] == manifest['specPin'] == pin(HERE / 'bank-spec.json') and
             oracle['requestPin'] == pin(request_path) and len(oracle['cases']) == 9, 'ORACLE_AUTHENTICATION')
        keys(result, ('format', 'replies'), 'RESULT_PREFIX_KEYS')
        need(result['format'] == 'p4-gram-sat-results-v1' and type(result['replies']) is list and
             1 <= len(result['replies']) <= 9, 'PREFIX_LENGTH')
        previous_ops = previous_peak = 0
        for index, actual in enumerate(result['replies']):
            case, golden = spec['cases'][index], oracle['cases'][index]
            report['activeCase'] = {'index': index, 'id': case['id']}
            keys(golden, ('index', 'id', 'inputF64leWords', 'expected'), 'ORACLE_CASE_KEYS')
            need(golden['index'] == index and golden['id'] == case['id'] and
                 golden['inputF64leWords'] == input_words(bank['requests'][index]), 'EXACT_INPUT_WORD_PROVENANCE')
            keys(actual, ('protocol', 'status', 'reason', 'raw', 'normalized', 'stats'), 'REPLY_KEYS')
            need(actual['protocol'] == 'p4-gram-sat-kernel-v1' and actual['status'] == 'CERTIFIED_PAIR_GRAM' and
                 actual['reason'] is None, 'NORMAL_CASE_UNEXPECTED_REFUSAL_OR_PROTOCOL')
            keys(actual['stats'], ('integerOperations', 'peakIntegerBits', 'axisVisits', 'conventionProblems'), 'STATS_KEYS')
            ops = natural(actual['stats']['integerOperations'])
            peak = natural(actual['stats']['peakIntegerBits'], 16384)
            need(ops >= previous_ops and peak >= previous_peak and
                 natural(actual['stats']['axisVisits']) == 30 * (index + 1) and
                 natural(actual['stats']['conventionProblems']) == 2 * (index + 1), 'ONE_SHARED_OLD_METER_CENSUS')
            previous_ops, previous_peak = ops, peak
            for convention in ('raw', 'normalized'):
                model(actual[convention], golden['expected'][convention], str(index) + '/' + convention)
                report['verifiedConventions'] += 1
                report['verifiedAxisSlots'] += 15
                report['verifiedGramCoefficients'] += 21
                report['verifiedFaceCenterCoefficients'] += 6
                report['verifiedSignedMixedCoefficients'] += 27
            report['verifiedPrefix'] += 1
        complete = report['verifiedPrefix'] == 9
        report.pop('activeCase', None)
        report.update(status='EXECUTED_PASS_EXACT_GRAM_SAT_BANK' if complete else 'EXECUTED_PASS_PREFIX_GRAM_SAT',
                      complete=complete, requestPin=pin(request_path), oraclePin=pin(oracle_path),
                      repliesPin=pin(replies_path), finalStats=result['replies'][-1]['stats'])
        exit_status = 0
    except Exception as error:
        report['firstFailure'] = {'type': type(error).__name__, 'reason': str(error)[:1024]}
    write(output_path, report)
    return exit_status


if __name__ == '__main__':
    sys.exit(main())
