"""Root-only analytical/reference observer controls. No World, candidate, compiler or codec."""
import argparse
import copy
from fractions import Fraction as F
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import subprocess
import sys
import time

HOME = Path(__file__).resolve().parent
ROOT = HOME.parents[1]
PAID = HOME / 'evidence/api-01'
PYTHON = '/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13'
LINE, CAP, REPLY = 2*1024*1024, 16*1024*1024, 65536
# IMMUTABLE_PINS_BEGIN
PINS = {
  "/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/Python": {
    "bytes": 5080352,
    "sha256": "9fbad407dcddb437d1cdc70a57274c6a179a0a835662870b4628e750b91f5066"
  },
  "/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13": {
    "bytes": 52640,
    "sha256": "a1f6d9dc20d4787a84dc2fe782094a7bac5946f49a962aa0af48a02f0e8d5bc5"
  },
  "examples/physics-three-cubes-floor-2276/CONTRACT.md": {
    "bytes": 8821,
    "sha256": "6dd15a7bc7c2b0b4adbcb8f81bbd8eb6b113abd8c764f06400f3c6733881114e"
  },
  "examples/physics-three-cubes-floor-2276/cases.mjs": {
    "bytes": 2015,
    "sha256": "a283f3d2ccd449b8c595fbf101d3addc68b75802630dd6927c64744ee1646761"
  },
  "examples/physics-three-cubes-floor-2276/evidence/api-01/inputs.json": {
    "bytes": 40583,
    "sha256": "94a16e3934be5ed687fe18da5ed5bca989541791d10baccc583a0414442b75f2"
  },
  "examples/physics-three-cubes-floor-2276/evidence/api-01/native-full-states.json": {
    "bytes": 1162853,
    "sha256": "3ea8cd4ef40c99664cfbf6566ec06f1b02ae4551301c5c947920e2c49e722085"
  },
  "examples/physics-three-cubes-floor-2276/evidence/api-01/native-reference-256.stdout": {
    "bytes": 3794,
    "sha256": "2cc18db015827e930093f79c3febed0d326ba2f9a8ce85ca48ee4dd5d2e09db7"
  },
  "examples/physics-three-cubes-floor-2276/evidence/api-01/result.json": {
    "bytes": 9016,
    "sha256": "4357ff5dd010cc4efce5201c2c8cdb2453e19e4f9b479df3d7bd4d6e96e58a4e"
  },
  "examples/physics-three-cubes-floor-2276/evidence/api-01/source-full-states.json": {
    "bytes": 1162853,
    "sha256": "51a9b80f0263864fd7897e2026a873f9f4ab8309034d5459d4ae9bea1038bb85"
  },
  "examples/physics-three-cubes-floor-2276/evidence/api-01/source-reference-256.stdout": {
    "bytes": 3794,
    "sha256": "2cc18db015827e930093f79c3febed0d326ba2f9a8ce85ca48ee4dd5d2e09db7"
  },
  "examples/physics-three-cubes-floor-2276/oracle.py": {
    "bytes": 25480,
    "sha256": "87f5b8f44bbfcd5e3b669843d1fe185696bd8040d7e79e6cb723a2d673382dce"
  }
}
# IMMUTABLE_PINS_END


def pin(path):
    path = Path(path)
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(65536), b''):
            digest.update(chunk)
    return {'bytes': path.stat().st_size, 'sha256': digest.hexdigest()}


def authenticate():
    for name, expected in PINS.items():
        path = Path(name) if Path(name).is_absolute() else ROOT / name
        assert pin(path) == expected, 'PIN:'+name


def numeric_words(value):
    words, nodes = [], 0

    def visit(item, depth):
        nonlocal nodes
        nodes += 1
        assert nodes <= 262144 and depth <= 32
        if type(item) in (int, float):
            assert len(words) < 65536
            words.append(struct.pack('<d', float(item)))
        elif type(item) is list:
            for child in item:
                visit(child, depth+1)
        elif type(item) is dict:
            for child in item.values():
                visit(child, depth+1)
    visit(value, 0)
    return b''.join(words).hex()


def wire(data):
    return (json.dumps({'format': 'three-cubes-floor-case-v1', 'data': data,
                        'numericWordsF64leHex': numeric_words(data)}, allow_nan=False,
                       separators=(',', ':'))+'\n').encode()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', required=True)
    options = parser.parse_args()
    out = Path(options.out)
    assert out.is_absolute() and out.resolve().is_relative_to(HOME / 'evidence')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.mkdir()
    self_pin, deadline = pin(__file__), time.monotonic()+170
    charged, helper_calls, restore_calls, cli_attempts = 0, 0, 0, 0
    analytical, controls, first_failure = [], [], None
    current_name, current_wire, integrity = 'authenticate', None, 'NOT_RUN'

    def save(name, raw):
        nonlocal charged
        assert type(raw) is bytes and charged+len(raw) <= CAP, '16MiB evidence cap'
        charged += len(raw)
        with (out / name).open('xb') as stream:
            stream.write(raw)

    def json_save(name, value):
        save(name, (json.dumps(value, allow_nan=False, indent=2)+'\n').encode())

    def cli(name, request, expected, gates=(), message=None, exact=None):
        nonlocal cli_attempts, current_name, current_wire
        current_name, current_wire = name, request
        assert len(request) <= LINE and time.monotonic() < deadline
        cli_attempts += 1
        child = subprocess.run([PYTHON, '-B', str(HOME / 'oracle.py')], input=request, cwd=ROOT,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            timeout=max(.01, deadline-time.monotonic()), check=False)
        assert len(child.stdout) <= REPLY and len(child.stderr) <= REPLY
        save(name+'.stdout', child.stdout); save(name+'.stderr', child.stderr)
        assert child.returncode == 0 and not child.stderr and child.stdout.count(b'\n') == 1, 'reference execution'
        reply = json.loads(child.stdout)
        if expected == 'positive':
            assert reply['ok'] is True and reply['resolved'] is True and reply['executionFailure'] is False
        elif expected == 'physical':
            assert reply['ok'] is False and reply['resolved'] is True and reply['executionFailure'] is False
            assert reply['certificates']['firstPhysicalFailureStep'] == 256
            assert any(item.get('gate') in gates for item in reply['violations']), 'specific original physical gate'
            if name == 'terminal-point-1e-11':
                residual = reply['metrics']['geometryRepresentativeFacePlaneM']
                assert 1e-12 < residual < 1e-10, 'separate original strict geometry gate'
        else:
            assert reply['ok'] is False and reply['resolved'] is False and reply['executionFailure'] is True
            assert message in str(reply['violations']), 'specific full-consumption/finite refusal'
        if exact is not None:
            assert child.stdout == exact, 'paid CLI reply byte identity'
        controls.append({'name': name, 'expected': expected, 'confirmed': True,
                         'requestBytes': len(request), 'requestSHA256': hashlib.sha256(request).hexdigest(),
                         'replySHA256': hashlib.sha256(child.stdout).hexdigest(), 'status': reply['status']})

    try:
        assert Path(sys.executable).resolve() == Path(PYTHON).resolve()
        authenticate()
        paid = json.loads((PAID / 'result.json').read_text())
        assert paid['status'] == 'THREE_CUBES_FLOOR_SOURCE_NATIVE_256_CONFIRMED' and paid['failure'] is None and paid['sourceIntegrity'] == 'PASS'
        for graph in ['source', 'native']:
            report = paid['reports'][graph]
            assert report['worlds'] == 1 and report['acceptedSteps'] == 256 and report['referenceReplies'] == 2 and report['passedIndependentTransitions'] == 256
        json_save('inputs.json', {'pins': PINS, 'selfPin': self_pin, 'plannedAnalyticalHelperCalls': 6,
            'plannedOracleCLIAttempts': 11, 'plannedHelperRestoreCalls': 2,
            'worldCalls': 0, 'candidateCalls': 0, 'scope': 'REFERENCE_OBSERVER_CONTROLS_ONLY'})
        spec = importlib.util.spec_from_file_location('frozen_three_chain_reference', HOME / 'oracle.py')
        O = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(O)
        rows = [[F(1), F(0), F(0)], [F(-1), F(1), F(0)], [F(0), F(-1), F(1)]]
        position_bounds, velocity_bounds = [F(1, 2), F(1), F(1)], [F(0)]*3
        literal = [
            ('feasible-free', [F(1), F(5, 2), F(4)], position_bounds,
             [F(1), F(5, 2), F(4)], [F(0)]*3, F(0)),
            ('floor-only', [F(1, 4), F(2), F(4)], position_bounds,
             [F(1, 2), F(2), F(4)], [F(1, 2), F(0), F(0)], F(1, 16)),
            ('lower-middle-pair', [F(3, 4), F(3, 2), F(3)], position_bounds,
             [F(5, 8), F(13, 8), F(3)], [F(0), F(1, 4), F(0)], F(1, 32)),
            ('middle-upper-degenerate', [F(3, 4), F(2), F(5, 2)], position_bounds,
             [F(3, 4), F(7, 4), F(11, 4)], [F(0), F(0), F(1, 2)], F(1, 8)),
            ('full-position', [F(1, 4), F(1), F(7, 4)], position_bounds,
             [F(1, 2), F(3, 2), F(5, 2)], [F(3), F(5, 2), F(3, 2)], F(7, 8)),
            ('full-velocity', [F(-1), F(-2), F(-3)], velocity_bounds,
             [F(0)]*3, [F(12), F(10), F(6)], F(14)),
        ]
        for name, free, bounds, expected, dual, objective in literal:
            current_name = 'analytical-'+name
            # Independently obvious literal targets/duals, with component mass balance.
            for k in range(3):
                assert 2*(expected[k]-free[k]) == sum(rows[i][k]*dual[i] for i in range(3))
            for i in range(3):
                margin = sum(a*b for a, b in zip(rows[i], expected))-bounds[i]
                assert margin >= 0 and dual[i] >= 0 and dual[i]*margin == 0
            assert sum((a-b)**2 for a, b in zip(expected, free)) == objective
            helper_calls += 1
            target, lam, actual_objective = O.project_three(free, rows, bounds)
            assert target == expected and lam == dual and actual_objective == objective
            if name == 'middle-upper-degenerate':
                assert sum(a*b for a, b in zip(rows[1], target)) == bounds[1] and lam[1] == 0
            if name == 'full-velocity':
                assert sum(x*x for x in free)-sum(x*x for x in target) == 14
            analytical.append({'name': name, 'confirmed': True, 'target': [str(x) for x in target],
                               'multipliers': [str(x) for x in lam], 'objective': str(actual_objective)})
        assert helper_calls == 6
        json_save('analytical.json', analytical)
        requests = {g: (PAID / (g+'-full-states.json')).read_bytes() for g in ['source', 'native']}
        replies = {g: (PAID / (g+'-reference-256.stdout')).read_bytes() for g in ['source', 'native']}
        assert replies['source'] == replies['native'], 'paid source/native numeric reference reply identity'
        for graph in ['source', 'native']:
            cli('paid-'+graph, requests[graph], 'positive', exact=replies[graph])
        packet = json.loads(requests['source'])
        restore_calls += 1
        data = O.restore_words(packet['data'], packet['numericWordsF64leHex'])
        assert len(data['states']) == 257
        dynamic = sorted((b for b in data['model']['bodies'] if b['kind'] == 'dynamic'), key=lambda b: b['initial']['positionM'][1])
        lower, middle, upper = [b['id'] for b in dynamic]
        def body(d, bid):
            return next(b for b in d['states'][-1]['bodies'] if b['id'] == bid)
        for name in ['terminal-velocity', 'terminal-position', 'terminal-required-contact', 'terminal-point-1e-11']:
            changed = copy.deepcopy(data)
            if name == 'terminal-velocity':
                body(changed, lower)['velocityMps'][1] += .01
                gates = ('globalVelocityProjectionMps', 'bodyMomentumNs')
            elif name == 'terminal-position':
                body(changed, middle)['positionM'][1] += .01
                gates = ('globalPositionProjectionM', 'geometryRepresentativeFacePlaneM')
            elif name == 'terminal-required-contact':
                contacts = changed['states'][-1]['contacts']
                remove = next(i for i, c in enumerate(contacts) if {c['bodyAId'], c['bodyBId']} == {middle, upper})
                contacts.pop(remove)
                gates = ('missingRequiredContact',)
            else:
                changed['states'][-1]['contacts'][0]['pointM'][1] += 1e-11
                gates = ('geometryRepresentativeFacePlaneM',)
            cli(name, wire(changed), 'physical', gates=gates)
        for name in ['nonzero-mismatch', 'trailing-word', 'missing-word', 'nonfinite-word']:
            changed = json.loads(requests['source'])
            raw = bytearray.fromhex(changed['numericWordsF64leHex'])
            message = 'numeric word mismatch'
            if name == 'nonzero-mismatch':
                at = next(i for i in range(0, len(raw), 8) if struct.unpack_from('<d', raw, i)[0] != 0)
                struct.pack_into('<d', raw, at, struct.unpack_from('<d', raw, at)[0]+.125)
            elif name == 'trailing-word':
                raw.extend(bytes(8));message = 'trailing numeric words'
            elif name == 'missing-word':
                del raw[-8:];message = 'missing numeric word'
            else:
                raw[:8] = bytes.fromhex('000000000000f87f')
            changed['numericWordsF64leHex'] = raw.hex()
            request = (json.dumps(changed, allow_nan=False, separators=(',', ':'))+'\n').encode()
            cli('wire-'+name, request, 'invalid', message=message)
        restore_calls += 1
        zero = O.restore_words({'zero': 0}, '0000000000000080')
        assert struct.pack('<d', zero['zero']).hex() == '0000000000000080'
        changed = copy.deepcopy(data)
        next(b for b in changed['states'][0]['bodies'] if b['id'] == lower)['positionM'][0] = -0.0
        cli('signed-zero-value-preserved', wire(changed), 'positive')
        assert cli_attempts == 11 and restore_calls == 2
        authenticate()
        assert pin(__file__) == self_pin and time.monotonic() < deadline
        integrity = 'PASS'
    except Exception as error:
        first_failure = {'control': current_name, 'type': type(error).__name__, 'message': str(error)[:1024]}
        if current_wire is not None and len(current_wire) <= LINE:
            save('first-failure-request.json', current_wire)
    finally:
        try:
            authenticate()
            assert pin(__file__) == self_pin
        except Exception as error:
            integrity = 'FAIL'
            first_failure = first_failure or {'control': 'final-authentication', 'message': str(error)[:1024]}
        receipt = {'status': 'THREE_CUBES_FLOOR_REFERENCE_CONTROLS_CONFIRMED' if first_failure is None else 'FIRST_FAILURE',
            'firstFailure': first_failure, 'sourceIntegrity': integrity, 'analyticalHelperCalls': helper_calls,
            'helperRestoreCalls': restore_calls, 'oracleCLIAttempts': cli_attempts,
            'confirmedControls': len(controls), 'analytical': analytical, 'controls': controls,
            'worldCalls': 0, 'candidateCalls': 0, 'compilerCalls': 0, 'captureOrReplayCalls': 0,
            'chargedBeforeFinalReceiptBytes': charged, 'evidenceCapBytes': CAP,
            'scope': 'FIXED_REFERENCE_AND_PAID_DATA_OBSERVER_CONTROLS_NOT_NEW_PHYSICAL_CASES'}
        json_save('result.json', receipt)
        print(json.dumps({'status': receipt['status'], 'firstFailure': first_failure,
                          'result': str(out / 'result.json'), 'worldCalls': 0, 'candidateCalls': 0}))
        return 1 if first_failure else 0


if __name__ == '__main__':
    raise SystemExit(main())
