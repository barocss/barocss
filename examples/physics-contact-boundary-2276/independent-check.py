#!/usr/bin/env python3
"""Check all saved boundary rows with pinned independent Decimal geometry."""
import argparse
import copy
from fractions import Fraction
import importlib.util
import json
import math
from pathlib import Path
import signal
import struct
import sys
import time

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
GEOMETRY_PATH = ROOT / 'examples/physics-motion-nogo-2276/stack-study.py'
GEOMETRY_SHA = '70a34672ef53f034fa714bcd54a120a60c672fea3fd740841064dc8ac43263e2'
MOVE_SQUARED = Fraction(1, 10 ** 24)


def load_definitions(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# This local helper has only standard-library definitions. It imports no geometry.
F = load_definitions(HERE / 'failure-fixtures.py', 'boundary_fixture_data')


def prepare_generated(fixtures, supplied, baseline):
    """Validate every raw input and identity before importing the geometry provider."""
    if baseline:
        supplied = {'version': 1, 'cases': [
            {'caseId': case['caseId'], 'pointLedger': copy.deepcopy(case['originalPointLedger']),
             'pointOperandF64leHex': case['pointOperandF64leHex']} for case in fixtures['cases']]}
    F.need(type(supplied) is dict and set(supplied) == {'version', 'cases'} and supplied['version'] == 1,
           'Generated envelope must have version1 and cases')
    F.need(type(supplied['cases']) is list and len(supplied['cases']) == 6, 'Exactly six generated cases required')
    prepared = []
    for source, generated in zip(fixtures['cases'], supplied['cases']):
        F.need(type(generated) is dict and set(generated) == {'caseId', 'pointLedger', 'pointOperandF64leHex'},
               'Generated case fields differ')
        F.need(generated['caseId'] == source['caseId'], 'Generated case identity/order differs')
        points = F.restore_points(generated['pointLedger'], generated['pointOperandF64leHex'])
        original_raw, new_raw = bytes.fromhex(source['pointOperandF64leHex']), bytes.fromhex(generated['pointOperandF64leHex'])
        movements = []
        for index, (original, actual) in enumerate(zip(source['originalPointLedger'], points)):
            F.need(set(actual) == set(original), 'Ledger fields differ')
            F.need(all(actual[key] == original[key] for key in original if key not in ('pointM', 'normal')),
                   'Identity, endpoint, family, COM, warm, or final ledger data changed')
            F.need(new_raw[index * 48 + 24:index * 48 + 48] == original_raw[index * 48 + 24:index * 48 + 48],
                   'Generated normal binary64 bits changed')
            squared = sum((Fraction(value) - Fraction(before)) ** 2
                          for value, before in zip(actual['pointM'], original['pointM']))
            F.need(squared <= MOVE_SQUARED, 'Point Euclidean movement exceeds1e-12m')
            movements.append({'squaredM2': str(squared), 'distanceM': math.sqrt(float(squared)),
                              'rawPointBytesChanged': new_raw[index * 48:index * 48 + 24] != original_raw[index * 48:index * 48 + 24]})
        F.need(len(points) == 32, 'All32row identities must remain')
        # Always use the newly authenticated original body bytes, never generated bodies.
        free = F.restore_bodies(source['freeBodies'], bytes.fromhex(source['freeBodyRawHex']))
        prepared.append({'source': source, 'free': free, 'points': points, 'movements': movements,
                         'generatedPointOperandF64leHex': generated['pointOperandF64leHex']})
    return prepared


def run(fixtures_path, generated_path, output_path, baseline):
    F.need(not output_path.exists(), 'Output path must be new')
    started = time.monotonic()
    result = {'status': 'IN_PROGRESS', 'mode': 'baseline' if baseline else 'replacement',
              'geometryPassed': False, 'baselineMatchesSavedChecks': None,
              'baselineReproduced': False,
              'worldCalls': 0, 'solverCalls': 0, 'productionPredicateCalls': 0,
              'counts': {'casesCompleted': 0, 'rowsChecked': 0, 'geometry80Attempted': 0,
                         'geometry80Completed': 0, 'geometry120Attempted': 0, 'geometry120Completed': 0,
                         'precisionComparisonsAttempted': 0, 'precisionComparisonsCompleted': 0,
                         'passedRows': 0, 'failedRows': 0, 'unresolvedRows': 0,
                         'historicalFailedRowsRetested': 0, 'historicalFailedRowsRepaired': 0,
                         'historicalUnresolvedRowsRetested': 0, 'historicalBadRowsRetested': 0,
                         'historicalBadRowsResolvedAndRepaired': 0,
                         'positiveControlRows': 0, 'positiveControlPassedRows': 0},
              'cases': [], 'limitations': [
                  'Strict geometric witness qualification only; no dynamics or stack stability is established.',
                  'Parent separately checks complete paired face witnesses, copy ownership, and World behavior.',
                  'All historical failures and current HOLDs remain; no legacy fallback is enabled.',
                  'Prior trajectory-run error-helper wiring is not repaired or retroactively claimed here.']}
    try:
        # Authenticate complete immutable archived JSON/raw bytes before any geometry import.
        expected = F.load_fixtures()
        fixture_bytes = F.read(fixtures_path, F.MAX_FILE)
        F.need(fixture_bytes == F.encode(expected), 'Fixture export does not match deterministic authenticated DATA')
        result['fixtureSha256'] = F.sha(fixture_bytes)
        result['inputAuthentication'] = expected['provenance']
        supplied = None if baseline else F.parse(F.read(generated_path, F.MAX_FILE))
        prepared = prepare_generated(expected, supplied, baseline)
        result['allRawInputsAuthenticatedBeforeGeometryImport'] = True
        geometry_source = F.read(GEOMETRY_PATH, 131072)
        F.need(F.sha(geometry_source) == GEOMETRY_SHA, 'Independent geometry source changed')
        saved = load_definitions(GEOMETRY_PATH, 'frozen_boundary_geometry')
        result['independentGeometrySourceSha256'] = GEOMETRY_SHA
        all_baseline_checks_match = True
        for case in prepared:
            source, free, points = case['source'], case['free'], case['points']
            saved.body_layout(free)
            seen = set()
            case_result = {'caseId': source['caseId'], 'rows': [], 'failedIndexes': [], 'unresolvedIndexes': [],
                           'expectedHistoricalFailedIndexes': source['expectedFailedIndexes'],
                           'expectedHistoricalUnresolvedIndexes': source['expectedUnresolvedIndexes'],
                           'generatedPointOperandF64leHex': case['generatedPointOperandF64leHex']}
            result['cases'].append(case_result)
            for index, point in enumerate(points):
                counts = result['counts']
                counts['rowsChecked'] += 1
                historical_failed = index in source['expectedFailedIndexes']
                historical_unresolved = index in source['expectedUnresolvedIndexes']
                historical_bad = historical_failed or historical_unresolved
                if historical_failed:
                    counts['historicalFailedRowsRetested'] += 1
                if historical_unresolved:
                    counts['historicalUnresolvedRowsRetested'] += 1
                if historical_bad:
                    counts['historicalBadRowsRetested'] += 1
                positive_control = source['caseId'] == 'ALIGNED:1'
                if positive_control:
                    counts['positiveControlRows'] += 1
                row = {'pointIndex': index, 'pointId': point['pointId'], 'pairKey': point['pairKey'],
                       'historicalStrictFailure': historical_failed, 'movement': case['movements'][index]}
                row['historicalUnresolved'] = historical_unresolved
                case_result['rows'].append(row)
                try:
                    saved.point_layout(point, free, seen)
                    counts['geometry80Attempted'] += 1
                    low = saved.geometry_at_precision(point, free, 80)
                    counts['geometry80Completed'] += 1
                    counts['geometry120Attempted'] += 1
                    high = saved.geometry_at_precision(point, free, 120)
                    counts['geometry120Completed'] += 1
                    counts['precisionComparisonsAttempted'] += 1
                    difference = saved.compare_geometry(low, high)
                    counts['precisionComparisonsCompleted'] += 1
                    checks = {'lineIntersectsBoth': high['lineIntersectsBoth'],
                              'lineMidpointWithinTolerance': high['lineMidpointWithinTolerance'],
                              'aPointInsideTolerance': high['a']['pointInsideTolerance'],
                              'bPointInsideTolerance': high['b']['pointInsideTolerance'],
                              'signedSupportPlaneGapWithinTolerance': high['supportPlaneGapM'] <= saved.GEOMETRY_GATE}
                    violations = [key for key, passed in checks.items() if not passed]
                    baseline_checks = source['baselineReference']['rows'][index].get('checks')
                    if checks != baseline_checks:
                        all_baseline_checks_match = False
                    row.update({'resolved': True, 'checks': checks, 'violations': violations,
                                'precisionMaxDifference': saved.public(difference), 'witness': saved.public(high)})
                    if violations:
                        counts['failedRows'] += 1
                        case_result['failedIndexes'].append(index)
                    else:
                        counts['passedRows'] += 1
                        if historical_failed:
                            counts['historicalFailedRowsRepaired'] += 1
                        if historical_bad:
                            counts['historicalBadRowsResolvedAndRepaired'] += 1
                        if positive_control:
                            counts['positiveControlPassedRows'] += 1
                except (saved.StudyError, ValueError, TypeError, KeyError, ArithmeticError, IndexError) as error:
                    counts['unresolvedRows'] += 1
                    case_result['unresolvedIndexes'].append(index)
                    row.update({'resolved': False, 'errorType': type(error).__name__, 'message': str(error)})
                    previous = source['baselineReference']['rows'][index]
                    reproduced = (historical_unresolved and previous.get('precisionResolved') is False
                                  and previous.get('errorType') == type(error).__name__
                                  and previous.get('violations') == [str(error)])
                    row['savedUnresolvedReproduced'] = reproduced
                    if not reproduced:
                        all_baseline_checks_match = False
            result['counts']['casesCompleted'] += 1
            case_result['strictGeometryPassed'] = not case_result['failedIndexes'] and not case_result['unresolvedIndexes']
        counts = result['counts']
        F.need(counts['rowsChecked'] == 192 and counts['casesCompleted'] == 6
               and counts['historicalFailedRowsRetested'] == 79 and counts['historicalUnresolvedRowsRetested'] == 1
               and counts['historicalBadRowsRetested'] == 80 and counts['positiveControlRows'] == 32,
               'Exact six-case/all-row coverage failed')
        result['geometryPassed'] = counts['failedRows'] == 0 and counts['unresolvedRows'] == 0
        if baseline:
            expected_lists = all(case['failedIndexes'] == case['expectedHistoricalFailedIndexes']
                                 and case['unresolvedIndexes'] == case['expectedHistoricalUnresolvedIndexes']
                                 for case in result['cases'])
            match = all_baseline_checks_match and expected_lists and counts['failedRows'] == 79
            match = match and counts['unresolvedRows'] == 1 and counts['passedRows'] == 112
            match = match and counts['positiveControlPassedRows'] == 32
            result['baselineMatchesSavedChecks'] = match
            result['baselineReproduced'] = match
            result['status'] = 'BASELINE_STRICT_FAILURES_REPRODUCED' if match else 'BASELINE_CLASSIFICATION_MISMATCH'
        elif counts['unresolvedRows']:
            result['status'] = 'EXECUTION_FAILURE'
        else:
            passed = result['geometryPassed'] and counts['historicalFailedRowsRepaired'] == 79
            passed = passed and counts['historicalBadRowsResolvedAndRepaired'] == 80
            passed = passed and counts['positiveControlPassedRows'] == 32
            result['status'] = 'REPLACEMENT_STRICT_GEOMETRY_PASS' if passed else 'REPLACEMENT_STRICT_GEOMETRY_NO_GO'
    except Exception as error:
        result['status'] = 'EXECUTION_FAILURE'
        result['errorType'], result['message'] = type(error).__name__, str(error)
    result['elapsedSeconds'] = time.monotonic() - started
    F.write_new(output_path, result)
    print(json.dumps({'status': result['status'], 'geometryPassed': result['geometryPassed'], 'counts': result['counts']}))
    return 1 if result['status'] in ('EXECUTION_FAILURE', 'BASELINE_CLASSIFICATION_MISMATCH') else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixtures', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--baseline', action='store_true')
    mode.add_argument('--generated', type=Path)
    args = parser.parse_args()
    signal.signal(signal.SIGALRM, F.deadline)
    signal.alarm(170)
    try:
        return run(args.fixtures, args.generated, args.output, args.baseline)
    finally:
        signal.alarm(0)


if __name__ == '__main__':
    sys.exit(main())
