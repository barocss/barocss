"""ROOT ONLY M3: OLD direct projection oracle; no new candidate import/call."""
import sys
import support
from pathlib import Path
from direct_oracle import pair
from literals import input_words, requests
from support import AUDIT_LIMIT, SCRATCH, HERE, authenticate, arm, module, need, pin, read, write


def main():
    arm()
    need(len(sys.argv) == 2, 'USAGE: materialize.py FRESH_DIRECTORY')
    source_pins = authenticate()
    spec = read(HERE / 'bank-spec.json')
    need(support.PREALLOCATED + 8 * 1024 * 1024 + SCRATCH <= AUDIT_LIMIT,
         'M3_FIXED_ORACLE_GRAPH_PREALLOCATION')
    bank = {'format': 'p4-gram-sat-requests-v1', 'requests': requests(spec)}
    oracle = {'format': 'p4-independent-gram-oracle-v1',
              'specPin': pin(HERE / 'bank-spec.json'), 'requestPin': None, 'cases': []}
    old = module('independent_m3_old_direct_sat', 'examples/physics-p4-sat-2276/integer_sat.py')
    meter = old.Meter()
    for index, request in enumerate(bank['requests']):
        expected = pair(request, old, meter)
        oracle['cases'].append({'index': index, 'id': spec['cases'][index]['id'],
                                'inputF64leWords': input_words(request), 'expected': expected})
    need(meter.models == 36 and meter.axes == 540, 'ORACLE_DIRECT_AND_OLD_SOURCE_CROSSCHECK_CENSUS')
    destination = Path(sys.argv[1])
    destination.mkdir(parents=False, exist_ok=False)
    write(destination / 'requests.json', bank)
    oracle['requestPin'] = pin(destination / 'requests.json')
    write(destination / 'oracle.json', oracle)
    write(destination / 'manifest.json',
          {'format': 'p4-independent-gram-manifest-v1', 'caseCount': 9,
           'candidateConventions': 18, 'candidateAxisSlots': 270,
           'gramCoefficients': 378, 'faceCenterCoefficients': 108, 'signedMixedCoefficients': 486,
           'oracleDirectCapturedModels': 18, 'oracleOldSourceCrossChecks': 18,
           'oracleOnlyMeterStats': meter.stats(), 'candidateInput': 'requests.json',
           'oracleOnly': 'oracle.json', 'specPin': pin(HERE / 'bank-spec.json'),
           'sourcePins': source_pins,
           'files': {name: pin(destination / name) for name in ('requests.json', 'oracle.json')},
           'candidateCalls': 0, 'coldQpCalls': 0, 'WorldCalls': 0})


if __name__ == '__main__':
    main()
