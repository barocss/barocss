"""D406 numeric gate over an independent native OCCT reader. Stdlib only; no product imports.
Args: CLI, fresh STEP folder, existing valid wrong-dimensions STEP, output, installed OCCT lib-dir.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys

BOUND_TOL = 1e-6
VOLUME_TOL = 1e-5
EXPECTED = {
    'box': {'solids': 1, 'shells': 1, 'faces': 6, 'edges': 12, 'vertices': 8, 'volume': 40000, 'bbox': [0, 0, 0, 80, 50, 10], 'per_solid': [{'volume': 40000, 'bbox': [0, 0, 0, 80, 50, 10]}]},
    'assembly': {'solids': 3, 'shells': 3, 'faces': 18, 'edges': 36, 'vertices': 24, 'volume': 3000, 'bbox': [-20, 0, 0, 100, 90, 5], 'per_solid': [{'volume': 1000, 'bbox': [80, 0, 0, 100, 10, 5]}, {'volume': 1000, 'bbox': [-20, 50, 0, 0, 60, 5]}, {'volume': 1000, 'bbox': [-10, 70, 0, 0, 90, 5]}]},
}


def compare(raw, expected):
    errors, matched = [], []
    for key in ('solids', 'shells', 'faces', 'edges', 'vertices'):
        if raw[key] != expected[key]:
            errors.append(key + ' count mismatch')
    if not raw['valid'] or any(not solid['valid'] for solid in raw['per_solid']):
        errors.append('geometry-enabled BRepCheck invalid')
    if not math.isfinite(raw['volume']) or raw['volume'] <= 0 or any(not math.isfinite(s['volume']) or s['volume'] <= 0 for s in raw['per_solid']):
        errors.append('signed volume is nonpositive or nonfinite')
    volume_error = raw['volume'] - expected['volume']
    bounds_error = max(abs(a - b) for a, b in zip(raw['bbox'], expected['bbox']))
    if abs(volume_error) > VOLUME_TOL:
        errors.append('total volume mismatch: ' + repr(volume_error))
    if bounds_error > BOUND_TOL:
        errors.append('aggregate bounds mismatch: ' + repr(bounds_error))
    if abs(raw['volume'] - sum(s['volume'] for s in raw['per_solid'])) > VOLUME_TOL:
        errors.append('whole/per-solid signed volume mismatch')
    remaining = list(raw['per_solid'])
    for wanted in expected['per_solid']:
        index = next((i for i, s in enumerate(remaining) if max(abs(a - b) for a, b in zip(s['bbox'], wanted['bbox'])) <= BOUND_TOL), None)
        if index is None:
            errors.append('per-solid bounds mismatch: ' + repr(wanted['bbox']))
            continue
        solid = remaining.pop(index)
        error = solid['volume'] - wanted['volume']
        matched.append({'boundsMaxError': max(abs(a - b) for a, b in zip(solid['bbox'], wanted['bbox'])), 'volumeError': error})
        if abs(error) > VOLUME_TOL:
            errors.append('per-solid volume mismatch: ' + repr(error))
    return {'pass': not errors, 'errors': errors, 'totalVolumeError': volume_error, 'aggregateBoundsMaxError': bounds_error, 'matchedSolids': matched}


def main(binary, source, wrong, output, libraries):
    output.mkdir(parents=True, exist_ok=True)
    report = {'status': 'RUNNING', 'boundTolerance': BOUND_TOL, 'volumeTolerance': VOLUME_TOL, 'binarySha256': hashlib.sha256(binary.read_bytes()).hexdigest(), 'cases': {}, 'controls': {}, 'productImports': 0, 'limits': ['Automatic ShapeProcess postprocessing disabled; not every built-in STEP translation adjustment is disabled.', 'Only selected planar prism geometry and 90-degree placements; no general STEP/AP242 assembly/PMI/datum acceptance.']}

    def run(label, path, options=()):
        target = output / (label + '.json')
        env = dict(os.environ, DYLD_PRINT_LIBRARIES='1')
        argv = [str(binary), str(path), str(target), *options]
        result = subprocess.run(argv, capture_output=True, text=True, env=env)
        (output / (label + '.stdout.txt')).write_text(result.stdout)
        (output / (label + '.stderr.txt')).write_text(result.stderr)
        raw = json.loads(target.read_text()) if target.exists() else None
        return {'argv': argv, 'exit': result.returncode, 'inputSha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'raw': raw}, result

    def require_control_and_diagnostics(read, process):
        assert read['exit'] == 0 and read['raw'], 'native process failed; inspect stdout/stderr'
        raw = read['raw']
        assert raw['schema'] == 'd406-native-probe-v1'
        assert raw['transfer_executed'] is True
        assert all(raw[key] is True for key in ('flags_set_before', 'flags_empty_before', 'flags_set_after', 'flags_empty_after', 'postprocess_flags_explicitly_empty_before_and_after'))
        assert raw['all_translator_adjustments_disabled'] is False
        assert raw['read_status'] == 1 and raw['system_length_unit'] == 1
        assert raw['roots'] > 0 and raw['transferred_roots'] == raw['roots'] and raw['shapes'] > 0
        for key in ('load_warning_count', 'load_failure_count', 'transfer_warning_count', 'transfer_failure_count'):
            assert raw[key] == 0, key + ': ' + str(raw[key])
        for suffix in ('.load.txt', '.transfer.txt'):
            path = output / (Path(read['argv'][2]).name + suffix)
            read[suffix[1:]] = path.read_text()  # Retain complete text as well as independent numeric gates.
        assert str(libraries / 'libTKDESTEP.8.0.1.dylib') in process.stderr, 'actual OCCT loader path not observed'

    try:
        for name, expected in EXPECTED.items():
            report['phase'] = 'forward-' + name
            read, process = run(name, source / (name + '.step'))
            report['cases'][name] = read
            require_control_and_diagnostics(read, process)
            read['comparison'] = compare(read['raw'], expected)
            assert read['comparison']['pass'], 'GEOMETRY_FAIL: ' + repr(read['comparison'])
        report['phase'] = 'negative-default-flags'
        read, process = run('default-flags-control', source / 'box.step', ['--leave-flags-default'])
        report['controls']['defaultFlags'] = read
        assert read['exit'] == 2 and read['raw']['control_rejected'] is True and read['raw']['transfer_executed'] is False
        report['phase'] = 'negative-truncated'
        truncated = output / 'truncated.step'
        truncated.write_text("ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('truncated'),'2;1');\n")
        read, process = run('truncated-control', truncated)
        report['controls']['truncated'] = read
        assert read['exit'] != 0 and 'ReadFile did not return IFSelect_RetDone' in process.stderr
        report['controls']['truncated']['reason'] = 'ReadFile rejected truncated syntax before transfer'
        report['phase'] = 'negative-valid-wrong-geometry'
        read, process = run('wrong-geometry-control', wrong)
        report['controls']['wrongGeometry'] = read
        require_control_and_diagnostics(read, process)
        read['comparison'] = compare(read['raw'], EXPECTED['box'])
        assert read['raw']['valid'] and all(s['valid'] for s in read['raw']['per_solid'])
        assert not read['comparison']['pass'] and any('volume mismatch' in error or 'bounds mismatch' in error for error in read['comparison']['errors'])
        report['status'] = 'PASS'
    except Exception as error:
        report.update(status='FAIL', failure=repr(error))
    finally:
        (output / 'qualification-readback.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'phase': report.get('phase'), 'failure': report.get('failure'), 'report': str(output / 'qualification-readback.json')}))
    return report['status'] == 'PASS'


if __name__ == '__main__':
    sys.exit(0 if main(*(Path(value).resolve() for value in sys.argv[1:6])) else 1)
