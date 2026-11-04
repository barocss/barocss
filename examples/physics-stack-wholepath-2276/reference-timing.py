#!/usr/bin/env python3
"""Timing sidecar only. Run the original CLI/router and return physical replies unchanged."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import time

sys.dont_write_bytecode = True
ROOT = Path(os.environ['PHYSICS_CENSUS_ROOT'])
ROLE = os.environ['PHYSICS_CENSUS_ROLE']
PINS = Path(os.environ['PHYSICS_CENSUS_PINS'])
assert hashlib.sha256(PINS.read_bytes()).hexdigest() == 'd8538379c5ee00c82de5b623b7c834b337a946c39b842f6de5a1e6d8ebc41625'
pins = {name: pin for name, pin in json.loads(PINS.read_text())['files'].items() if name.endswith('.py')}
assert len(pins) == 12
for name, pin in pins.items():
    data = (ROOT / name).read_bytes()
    assert len(data) == pin['bytes'] and hashlib.sha256(data).hexdigest() == pin['sha256']
timing = open(os.environ['PHYSICS_CENSUS_TIMING'], 'x', encoding='utf8')
records = 0
timing_bytes = 0

def measure(kind, name, operation, args):
    global records, timing_bytes
    wall, cpu, failure = time.perf_counter_ns(), time.process_time_ns(), None
    try:
        return operation(*args)
    except BaseException as error:
        failure = type(error).__name__
        raise
    finally:
        value = {'role': ROLE, 'kind': kind, 'name': name, 'ordinal': records + 1,
                 'handlerWallNs': time.perf_counter_ns() - wall,
                 'selfReportedHandlerCpuNs': time.process_time_ns() - cpu,
                 'errorType': failure}
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

name = {'geometry': 'examples/physics-stack-solver-2276/trajectory-reference.py',
        'position': 'examples/physics-rigid-full-pair-position-world/reference.py'}[ROLE]
spec = importlib.util.spec_from_file_location('unchanged_census_' + ROLE, ROOT / name)
module = importlib.util.module_from_spec(spec)
measure('initialization', 'original-module-import', spec.loader.exec_module, (module,))
if ROLE == 'geometry':
    original_load = module.load_pinned
    module.load_pinned = lambda path, label: measure('initialization', path, original_load, (path, label))
    original = module.dispatch
    module.dispatch = lambda request, saved, quality: measure('operation', request.get('op') if isinstance(request, dict) else 'invalid', original, (request, saved, quality))
else:
    original = module.evaluate
    module.evaluate = lambda request: measure('operation', request.get('op') if isinstance(request, dict) else 'invalid', original, (request,))
try:
    if ROLE == 'geometry':
        try:
            code = module.main()
        except Exception as error:
            print(json.dumps({'status': 'REFERENCE_STARTUP_FAILURE', 'errorType': type(error).__name__, 'message': str(error)}), file=sys.stderr)
            code = 1
        sys.exit(code)
    module.main()
finally:
    timing.close()
