"""ROOT ONLY M2: frozen direct-square search oracle; no candidate import/call."""
import sys
from pathlib import Path
from oracle_math import Work, floor_grid, request_from_case, rne_reference
from support import HERE, authenticate, deadline, keys, load, pin, require, write


def main():
    deadline()
    require(len(sys.argv) == 2, 'USAGE: materialize.py FRESH_DIRECTORY')
    source_pins = authenticate()
    spec = load(HERE / 'bank-spec.json')
    keys(spec, ('format', 'cases'), 'SPEC_KEYS')
    require(spec['format'] == 'p4-independent-radical-spec-v1' and len(spec['cases']) == 17,
            'SPEC_COUNT')
    requests = {'format': 'p4-radical-grid-requests-v1', 'requests': []}
    oracle = {'format': 'p4-independent-radical-oracle-v1',
              'specPin': pin(HERE / 'bank-spec.json'), 'requestPin': None, 'cases': []}
    work = Work()
    for index, case in enumerate(spec['cases']):
        request = request_from_case(case, work)
        requests['requests'].append(request)
        if case['kind'] == 'valid':
            interval, exact = floor_grid(request, work)
            expected = {'status': 'CERTIFIED_DIRECT_GRID', 'reason': None,
                        'interval': interval, 'exact': exact,
                        'rne': rne_reference(request, interval, work)}
        else:
            require(case['kind'] in ('invalid', 'resource'), 'SPEC_CLASSIFICATION')
            expected = {'status': 'UNRESOLVED', 'reason': case['reason'],
                        'interval': None, 'exact': None}
        oracle['cases'].append({'index': index, 'id': case['id'], 'kind': case['kind'],
                                'expected': expected})
    destination = Path(sys.argv[1])
    destination.mkdir(parents=False, exist_ok=False)
    write(destination / 'requests.json', requests)
    oracle['requestPin'] = pin(destination / 'requests.json')
    write(destination / 'oracle.json', oracle)
    write(destination / 'manifest.json',
          {'format': 'p4-independent-radical-manifest-v1', 'caseCount': 17,
           'validCount': 13, 'invalidCount': 2, 'resourceCount': 2,
           'candidateInput': 'requests.json', 'oracleOnly': 'oracle.json',
           'specPin': pin(HERE / 'bank-spec.json'), 'sourcePins': source_pins,
           'files': {name: pin(destination / name) for name in ('requests.json', 'oracle.json')},
           'referenceMajorOperations': work.operations, 'candidateCalls': 0, 'WorldCalls': 0})


if __name__ == '__main__':
    main()
