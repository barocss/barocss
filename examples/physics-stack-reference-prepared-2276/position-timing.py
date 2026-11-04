#!/usr/bin/env python3
"""Root-only observational wrapper. Original position main and wire stay intact."""
import importlib.util
import json
import os
from pathlib import Path
import sys
import time

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
assert os.environ['PHYSICS_CENSUS_ROLE'] == 'position'
assert Path(os.environ['PHYSICS_CENSUS_ROOT']).resolve() == HERE.parents[1]
timing = open(os.environ['PHYSICS_CENSUS_TIMING'], 'x', encoding='utf8')
records = 0
timing_bytes = 0
owner = None


def restored():
    return (not owner.active and owner.sat.decode_body is owner.original_decode
            and owner.sat.sat_pair is owner.original_sat_pair
            and owner.sat.quaternion_basis is owner.original_basis)


def measure(kind, name, operation, args):
    global records, timing_bytes
    wall, cpu, failure = time.perf_counter_ns(), time.process_time_ns(), None
    # A ledger/invalid request must not inherit a preceding world's diagnostics.
    if kind == 'operation':
        owner.last_stats = None
    try:
        return operation(*args)
    except BaseException as error:
        failure = type(error).__name__
        raise
    finally:
        value = {'role': 'position', 'kind': kind, 'name': name,
                 'ordinal': records + 1,
                 'handlerWallNs': time.perf_counter_ns() - wall,
                 'selfReportedHandlerCpuNs': time.process_time_ns() - cpu,
                 'errorType': failure,
                 'preparationStats': (dict(owner.last_stats)
                                      if kind == 'operation' and name == 'world'
                                      and owner.last_stats is not None else None),
                 'functionsRestored': restored() if kind == 'operation' else None}
        line = json.dumps(value, separators=(',', ':')) + '\n'
        assert records < 200 and len(line.encode()) <= 2048 and timing_bytes + len(line.encode()) <= 256 * 1024
        try:
            timing.write(line)
            timing.flush()
            records += 1
            timing_bytes += len(line.encode())
        except OSError:
            if failure is None:
                raise


def initialize():
    global owner
    spec = importlib.util.spec_from_file_location('prepared_census_candidate', HERE / 'candidate.py')
    candidate = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(candidate)
    candidate.authenticate()
    owner = candidate.PreparedReference(candidate.load_original('prepared_census_original_world'))
    return owner.install()


try:
    module = measure('initialization', 'prepared-original-module-import', initialize, ())
    original = module.evaluate
    module.evaluate = lambda request: measure('operation', request.get('op') if isinstance(request, dict) else 'invalid', original, (request,))
    module.main()
finally:
    timing.close()
