"""Root-only paid-data phase negatives plus four explicit private repeat calls. Zero Worlds."""
import argparse
import copy
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
PAID = HOME / 'evidence/private-04'
PYTHON = '/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13'
NODE = '/Users/user/.volta/tools/image/node/22.19.0/bin/node'
LINE, CAP, REPLY = 2*1024*1024, 16*1024*1024, 65536
# IMMUTABLE_PINS_BEGIN
PINS = {
  "/Users/user/.volta/tools/image/node/22.19.0/bin/node": {
    "bytes": 110712624,
    "sha256": "0d005c18e095027ca8f9fe1cc1126f767ee4ad7b004f4d6fb781ec4228a7c5d1"
  },
  "/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/Python": {
    "bytes": 5080352,
    "sha256": "9fbad407dcddb437d1cdc70a57274c6a179a0a835662870b4628e750b91f5066"
  },
  "/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13": {
    "bytes": 52640,
    "sha256": "a1f6d9dc20d4787a84dc2fe782094a7bac5946f49a962aa0af48a02f0e8d5bc5"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/native-independent-phase-oracle.stdout": {
    "bytes": 1586,
    "sha256": "e3c88e98fe1cffa57f64ff01bc540dd78e7f63f86861068086dea705c7eb0c28"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/native-phase-request.json": {
    "bytes": 82054,
    "sha256": "725282a91a31e47b6a67c5f01dccdd672319db888d630841a688eae8c605f5a1"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/native-private-output.json": {
    "bytes": 77239,
    "sha256": "cead2a62297efba0fee55891d30559ca8e3a74be233a1af89b46be3971252a1a"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/capsule-contact.js": {
    "bytes": 5708,
    "sha256": "7519483aec208b282ae23bb6985868af199b19d00d3d00564b3a5438d2113ad1"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/collision.js": {
    "bytes": 15257,
    "sha256": "a42979046e9f32c9fe16323617975b4d3a80aa71f44a74330208b0003c491457"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/contact-contribution.js": {
    "bytes": 3983,
    "sha256": "ef2eea7731343f2584baea3280515163ca23602cd3219049ea5d0296e7bce57e"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/contact-tangent.js": {
    "bytes": 2713,
    "sha256": "d5a3e6a0a2fef8000b219df53569c571a6d75b6a854b5266dd84fda3c58df9d0"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/internal-types.js": {
    "bytes": 43,
    "sha256": "b105d9550d9a3a0dccc02de4bf06d3191f7ce2a0b9241ee9031c14a54dff9b6e"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/limits.js": {
    "bytes": 416,
    "sha256": "15e4c3baf2645fa8aa040fcd4de7c5d14685e7a6ce1b6c45cffda01c47e08219"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/math.js": {
    "bytes": 2114,
    "sha256": "d82024b2458cf6ffdacef3ce57e0e1b802888bc39168ee032202536d4bdaa028"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/package.json": {
    "bytes": 1602,
    "sha256": "7ef765dcf000a0b45dd74495e60243e16516506e730afa024fc7f32b11222330"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/persistent-box-contact.js": {
    "bytes": 3933,
    "sha256": "38d7204fc639296ce5919d33b6f20290fc26dd0d61a6e94e65962e091262931b"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/contact-types.js": {
    "bytes": 11,
    "sha256": "8e609bb71c20b858c77f0e9f90bb1319db8477b13f9f965f1a1e18524bf50881"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/edge-contact.js": {
    "bytes": 3306,
    "sha256": "cd35a636c99773c087204ead2e3f797b9b803624d6883d1906b8d4bff2af0c34"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/face-contact.js": {
    "bytes": 6143,
    "sha256": "f00894e179c5317e77367991e6a30b1858ddf637282ccce40318b36873d20349"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/frictionless-island.js": {
    "bytes": 17494,
    "sha256": "9e64c47fdeef3826aa44699571fb16d2eccdde700b8ccda1feea31a781e7748f"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/full-pair-apply.js": {
    "bytes": 3288,
    "sha256": "7f8d7bc1a0540ae85de4684a571ce70f08efd536f34bb67ad111cced690377d7"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/full-pair-core.mjs": {
    "bytes": 6177,
    "sha256": "75941f67d5359c3734a68c93dd571313bdcab030a170205dee6e22d592119a46"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/full-pair-exact.mjs": {
    "bytes": 7675,
    "sha256": "258732a572bd6b2d1606db97cd2b637bfd252ce5fb59ee31cb30b0e9d298cd32"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/full-pair-input.mjs": {
    "bytes": 5935,
    "sha256": "294a5ace022a05ca93cf269c2c9f3faa7f22f9715bc8f59a2956b2cb04078027"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/full-pair-linear.mjs": {
    "bytes": 6168,
    "sha256": "f12c0243c18178a138b79faaac29b14e61714a42376c6c88c2b8757eef82b280"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/full-pair-phase.js": {
    "bytes": 5612,
    "sha256": "e82291e4014b98666367fe33bdf7e996f3b3c544c881dc5967b1b06ad6311c32"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/full-pair-rows.js": {
    "bytes": 7852,
    "sha256": "9810df91101ff635dcfe9c0610a4cc35d4b88dd340ce9cef67406ee5afcaffe9"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/full-pair-solver.d.mts": {
    "bytes": 947,
    "sha256": "c1c5c954b0664b3e75ff800d8b9fee7c237a44c6c72d64020428e377cc1a81e4"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/full-pair-solver.mjs": {
    "bytes": 9940,
    "sha256": "84e32cae07dbdd295e46af04691f0bf37815d77e73e2b5edfb75b0739e104432"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/full-pair-types.js": {
    "bytes": 11,
    "sha256": "8e609bb71c20b858c77f0e9f90bb1319db8477b13f9f965f1a1e18524bf50881"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/geometry.js": {
    "bytes": 2057,
    "sha256": "225329ca8c8359cd1e3278e7bb40951087841182cc07e1581e48f1cea691e43f"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/normal-solver.js": {
    "bytes": 15421,
    "sha256": "d672f4a7f41179fc9aefb767d0e92ed580cf346c9bd17ac8cc75b75aefba9570"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/sat-feature.js": {
    "bytes": 5108,
    "sha256": "75558bcb2392da27b81e8f0ae17cbb446ceccb191e4ec536280140da9bde7359"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/signed-sat.js": {
    "bytes": 6746,
    "sha256": "0c6d102bb26183d6f0789615bb66d9b44afedc52774dd575603308ebf859547c"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/strict-line.js": {
    "bytes": 19275,
    "sha256": "2314ce1450bc4d54148895c3498a511b793fd34e37aba03295f03501adcf51b3"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/witness.js": {
    "bytes": 1043,
    "sha256": "efd1289164059156211e7a382d69a6382e88dd0253f3e3c58a082268d20c3aa9"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/stack/world-types.js": {
    "bytes": 11,
    "sha256": "8e609bb71c20b858c77f0e9f90bb1319db8477b13f9f965f1a1e18524bf50881"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/types.js": {
    "bytes": 418,
    "sha256": "65a4905c6bda0d4e7a5fc7ea105a1362c8cae1345070b5d17fd524a8790e1f8b"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-native/validation.js": {
    "bytes": 14590,
    "sha256": "7a16fbadf07097048276364818d8851d77f980fe84a30dc79529eadcb2fabe2c"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/private-source.mjs": {
    "bytes": 137040,
    "sha256": "2e7281017f620efbc87d1b9abbf016c21681a8a485cdb56e98af51ee71673496"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/result.json": {
    "bytes": 5531,
    "sha256": "e05735091669a51303a81f94f2e264312527c5fde6edd3ce9ae2cf2031401a62"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/source-independent-phase-oracle.stdout": {
    "bytes": 1586,
    "sha256": "e3c88e98fe1cffa57f64ff01bc540dd78e7f63f86861068086dea705c7eb0c28"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/source-phase-request.json": {
    "bytes": 82054,
    "sha256": "725282a91a31e47b6a67c5f01dccdd672319db888d630841a688eae8c605f5a1"
  },
  "examples/physics-coupled-cubes-floor-2276/evidence/private-04/source-private-output.json": {
    "bytes": 77239,
    "sha256": "cead2a62297efba0fee55891d30559ca8e3a74be233a1af89b46be3971252a1a"
  },
  "examples/physics-coupled-cubes-floor-2276/oracle.py": {
    "bytes": 24768,
    "sha256": "c9bd37d91bb97bf584ddc0a2bc80a0e60fb8cbf26d049b97f5668315e5839f66"
  },
  "examples/physics-coupled-cubes-floor-2276/phase-oracle.py": {
    "bytes": 18833,
    "sha256": "fd59fe9e496b6351741b24115f31abfab52ec1d41bb46e30f3e3de4186fb620d"
  },
  "examples/physics-coupled-cubes-floor-2276/repeat-run.mjs": {
    "bytes": 11687,
    "sha256": "143c7132d82f1c5c1c792c118833523d5a3ee439629594bede644229003ca92f"
  }
}
# IMMUTABLE_PINS_END


def pin(path):
    path = Path(path)
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for piece in iter(lambda: stream.read(65536), b''):
            digest.update(piece)
    return {'bytes': path.stat().st_size, 'sha256': digest.hexdigest()}


def authenticate():
    for name, expected in PINS.items():
        path = Path(name) if Path(name).is_absolute() else ROOT / name
        assert pin(path) == expected, 'PIN:'+name


def words(value):
    pieces, nodes = [], 0

    def visit(item, depth):
        nonlocal nodes
        nodes += 1
        assert nodes <= 262144 and depth <= 32
        if type(item) in (int, float):
            assert len(pieces) < 65536
            pieces.append(struct.pack('<d', float(item)))
        elif type(item) is list:
            for child in item:
                visit(child, depth+1)
        elif type(item) is dict:
            for child in item.values():
                visit(child, depth+1)
    visit(value, 0)
    return b''.join(pieces).hex()


def pack(data):
    packet = {'format': 'frictionless-island-phase-v1', 'data': data, 'numericWordsF64leHex': words(data)}
    return (json.dumps(packet, allow_nan=False, separators=(',', ':'))+'\n').encode()


def body(items, bid):
    return next(item for item in items if item['id'] == bid)


def linked_velocity(data, bid, key, delta):
    candidate = data['candidate']
    for items in [candidate['candidateBodies'], candidate['diagnostics']['velocityBodies'],
                  candidate['diagnostics']['positionAttempt']['preBodies'],
                  candidate['diagnostics']['positionAttempt']['hypotheticalBodies']]:
        body(items, bid)[key][0 if key == 'angularVelocityRadps' else 1] += delta


def coherent_application(data, index):
    candidate = data['candidate']
    point = candidate['diagnostics']['normalProblem']['points'][index]
    app = candidate['diagnostics']['applications'][index]
    app['pointM'], app['normalAtoB'] = list(point['pointM']), list(point['normalAtoB'])
    lam = candidate['diagnostics']['normalResult']['normalImpulsesNs'][index]
    app['normalImpulseNs'] = lam
    on_b = [x*lam for x in point['normalAtoB']]
    for bid, sign, side in [(point['aId'], -1, 'onA'), (point['bId'], 1, 'onB')]:
        com = body(data['freeBodies'], bid)['positionM']
        arm = [x-y for x, y in zip(point['pointM'], com)]
        torque = [arm[1]*on_b[2]-arm[2]*on_b[1], arm[2]*on_b[0]-arm[0]*on_b[2], arm[0]*on_b[1]-arm[1]*on_b[0]]
        app['contribution']['applications'][0][side] = {'comM': list(com), 'armM': arm,
            'linearImpulseNs': [sign*x for x in on_b], 'armTorqueNms': [sign*x for x in torque]}
    for contact in candidate['contacts']:
        key = contact['aId']+'\0'+contact['bId']
        total = 0.0
        for item in candidate['diagnostics']['applications']:
            if item['pairKey'] == key:
                total += item['normalImpulseNs']
        contact['impulseNs'] = total


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', required=True)
    options = parser.parse_args()
    out = Path(options.out)
    assert out.is_absolute() and out.resolve().is_relative_to(HOME / 'evidence')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.mkdir()
    deadline = time.monotonic()+170
    self_pin = pin(__file__)
    charged, cli_calls, repeat_calls, helper_calls = 0, 0, 0, 0
    repeat_attempted = False
    reports, first_failure, repeat_receipt = [], None, None
    current_name, current_wire = 'authenticate', None

    def save(name, raw):
        nonlocal charged
        assert type(raw) is bytes and charged+len(raw) <= CAP, '16MiB shared control evidence'
        charged += len(raw)
        with (out / name).open('xb') as stream:
            stream.write(raw)

    def json_save(name, value):
        save(name, (json.dumps(value, allow_nan=False, indent=2)+'\n').encode())

    def run_cli(name, wire, expected, gates=(), message=None, exact=None):
        nonlocal cli_calls, current_name, current_wire
        current_name, current_wire = name, wire
        assert len(wire) <= LINE and time.monotonic() < deadline
        cli_calls += 1
        child = subprocess.run([PYTHON, '-B', str(HOME / 'phase-oracle.py')], input=wire,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=ROOT,
            timeout=max(.01, deadline-time.monotonic()), check=False)
        assert len(child.stdout) <= REPLY and len(child.stderr) <= REPLY
        save(name+'.stdout', child.stdout)
        save(name+'.stderr', child.stderr)
        assert child.returncode == 0 and not child.stderr, 'reference execution failure'
        assert child.stdout.count(b'\n') == 1
        reply = json.loads(child.stdout)
        if expected == 'positive':
            assert reply['ok'] is True and reply['resolved'] is True and reply['executionFailure'] is False
        elif expected == 'physical':
            assert reply['ok'] is False and reply['resolved'] is True and reply['executionFailure'] is False
            assert any(item.get('gate') in gates for item in reply['violations']), 'required independent physical gate'
        else:
            assert reply['ok'] is False and reply['resolved'] is False and reply['executionFailure'] is True
            assert message in str(reply['violations']), 'specific certificate/encoding refusal'
        if exact is not None:
            assert child.stdout == exact, 'paid reply must be byte-identical'
        reports.append({'name': name, 'expected': expected, 'confirmed': True,
            'requestBytes': len(wire), 'requestSHA256': hashlib.sha256(wire).hexdigest(),
            'replySHA256': hashlib.sha256(child.stdout).hexdigest(), 'observedStatus': reply['status']})

    try:
        assert Path(sys.executable).resolve() == Path(PYTHON).resolve()
        authenticate()
        paid_result = json.loads((PAID / 'result.json').read_text())
        assert paid_result['status'] == 'PRIVATE_FREE27_SOURCE_NATIVE_PHASE_CONFIRMED'
        json_save('inputs.json', {'pins': PINS, 'selfPin': self_pin, 'expectedCLIControls': 17,
            'expectedPrivateRepeatCalls': 4, 'worldCalls': 0, 'acceptedWorldSteps': 0,
            'scope': 'PAID_CAPTURED_FREE27_DATA_CONTROLS_NOT_NEW_PHYSICAL_INPUTS'})
        source_raw, native_raw = (PAID / 'source-phase-request.json').read_bytes(), (PAID / 'native-phase-request.json').read_bytes()
        source_reply, native_reply = (PAID / 'source-independent-phase-oracle.stdout').read_bytes(), (PAID / 'native-independent-phase-oracle.stdout').read_bytes()
        assert source_raw == native_raw and source_reply == native_reply
        run_cli('paid-source', source_raw, 'positive', exact=source_reply)
        run_cli('paid-native', native_raw, 'positive', exact=native_reply)
        spec = importlib.util.spec_from_file_location('paid_phase_word_helper', HOME / 'oracle.py')
        base = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(base)
        packet = json.loads(source_raw)
        helper_calls += 1
        data = base.restore_words(packet['data'], packet['numericWordsF64leHex'])
        moving = sorted((b for b in data['freeBodies'] if b['kind'] == 'dynamic'), key=lambda b: b['positionM'][1])
        lower = moving[0]['id']
        point_index = max(range(len(data['candidate']['diagnostics']['applications'])),
                          key=lambda i: data['candidate']['diagnostics']['normalResult']['normalImpulsesNs'][i])
        assert data['candidate']['diagnostics']['normalResult']['normalImpulsesNs'][point_index] > 0
        mutations = []
        mutations.append(('linked-velocity', lambda d: linked_velocity(d, lower, 'velocityMps', .01), 'physical',
                          ('actualPointLinearMomentumNs', 'fullJLinearStationarityNs', 'globalClosedVelocityMps'), None))

        def pose(d):
            for items in [d['candidate']['candidateBodies'], d['candidate']['diagnostics']['positionAttempt']['hypotheticalBodies']]:
                body(items, lower)['positionM'][1] += .01
        mutations.append(('linked-position', pose, 'physical', ('globalClosedPositionM', 'postRepresentativeFaceM'), None))
        mutations.append(('linked-spin', lambda d: linked_velocity(d, lower, 'angularVelocityRadps', .01), 'physical',
                          ('actualPointAngularMomentumNms', 'fullJAngularStationarityNms', 'omegaRadps'), None))

        def multiplier(d):
            d['candidate']['diagnostics']['normalResult']['normalImpulsesNs'][point_index] += .1
            coherent_application(d, point_index)
        mutations.append(('coherent-lambda', multiplier, 'physical', ('actualPointLinearMomentumNs', 'fullJLinearStationarityNs'), None))

        def arm(d):
            d['candidate']['diagnostics']['applications'][point_index]['contribution']['applications'][0]['onA']['armM'][0] += .01
        mutations.append(('application-arm-word', arm, 'invalid', (), 'actual recorded operand words: armM'))

        def torque(d):
            d['candidate']['diagnostics']['applications'][point_index]['contribution']['applications'][0]['onB']['armTorqueNms'][2] += .01
        mutations.append(('application-torque-word', torque, 'invalid', (), 'actual recorded operand words: armTorqueNms'))

        def completed(d):
            d['candidate']['pairContributions'][0]['onA']['angularImpulseAboutWorldOriginNms'][0] += .01
        mutations.append(('completed-wrench', completed, 'physical', ('completedPairWorldAngularImpulseNms',), None))

        def geometry(d):
            d['candidate']['contacts'][0]['pointM'][0] += 1
        mutations.append(('post-geometry-point', geometry, 'physical', ('postRepresentativeBoundsM',), None))

        def row(d):
            d['candidate']['diagnostics']['positionAttempt']['problem']['rows'].pop()
        mutations.append(('position-row-missing', row, 'invalid', (), 'one complete all-three-pair position phase'))

        def point(d):
            d['candidate']['diagnostics']['normalProblem']['points'][point_index]['pointM'][0] += .25
            coherent_application(d, point_index)
        mutations.append(('coherent-point-wrench', point, 'physical', ('actualPointAngularMomentumNms', 'fullJAngularStationarityNms'), None))
        assert len(mutations) == 10
        for name, mutate, expected, gates, message in mutations:
            changed = copy.deepcopy(data)
            mutate(changed)
            run_cli(name, pack(changed), expected, gates, message)
        for name in ['nonzero-mismatch', 'trailing-word', 'missing-word', 'nonfinite-word']:
            changed = json.loads(source_raw)
            raw = bytearray.fromhex(changed['numericWordsF64leHex'])
            message = 'numeric word mismatch'
            if name == 'nonzero-mismatch':
                at = next(i for i in range(0, len(raw), 8) if struct.unpack_from('<d', raw, i)[0] != 0)
                value = struct.unpack_from('<d', raw, at)[0]
                struct.pack_into('<d', raw, at, value+.125)
            elif name == 'trailing-word':
                raw.extend(bytes(8));message = 'trailing numeric words'
            elif name == 'missing-word':
                del raw[-8:];message = 'missing numeric word'
            else:
                raw[:8] = bytes.fromhex('000000000000f87f')
            changed['numericWordsF64leHex'] = raw.hex()
            wire = (json.dumps(changed, allow_nan=False, separators=(',', ':'))+'\n').encode()
            run_cli('wire-'+name, wire, 'invalid', message=message)
        helper_calls += 1
        zero = base.restore_words({'zero': 0}, '0000000000000080')
        assert struct.pack('<d', zero['zero']).hex() == '0000000000000080'
        changed = copy.deepcopy(data)
        body(changed['beforeBodies'], lower)['positionM'][0] = -0.0
        run_cli('signed-zero-physical-value-preserved', pack(changed), 'positive')
        assert cli_calls == 17
        current_name, current_wire = 'private-determinism', None
        assert time.monotonic() < deadline
        repeat_attempted, repeat_calls = True, None
        child = subprocess.run([NODE, str(HOME / 'repeat-run.mjs')], cwd=ROOT,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=max(.01, deadline-time.monotonic()), check=False)
        assert len(child.stdout) <= REPLY and len(child.stderr) <= REPLY
        save('private-determinism.stdout', child.stdout);save('private-determinism.stderr', child.stderr)
        assert child.returncode == 0 and not child.stderr
        repeat_receipt = json.loads(child.stdout)
        repeat_calls = repeat_receipt['candidateCalls']
        assert repeat_calls == 4 and repeat_receipt['worldCalls'] == 0 and repeat_receipt['acceptedWorldSteps'] == 0
        authenticate()
        assert pin(__file__) == self_pin and time.monotonic() < deadline
    except Exception as error:
        first_failure = {'case': current_name, 'type': type(error).__name__, 'message': str(error)[:1024]}
        if current_wire is not None and len(current_wire) <= LINE:
            save('first-failure-request.json', current_wire)
    finally:
        try:
            authenticate()
            assert pin(__file__) == self_pin
        except Exception as error:
            first_failure = first_failure or {'case': 'final-authentication', 'message': str(error)[:1024]}
        receipt = {'status': 'PHASE_PRIVATE_CONTROLS_CONFIRMED' if first_failure is None else 'FIRST_FAILURE',
            'firstFailure': first_failure, 'controls': reports, 'oracleCLIAttempts': cli_calls,
            'helperRestoreCalls': helper_calls, 'privateCandidateRepeatCalls': repeat_calls,
            'privateRepeatChildAttempted': repeat_attempted,
            'privateRepeat': repeat_receipt, 'worldCalls': 0, 'acceptedWorldSteps': 0,
            'compilerCalls': 0, 'captureOrReplayCalls': 0, 'paidSourceNativePositiveControls': 2,
            'semanticNegativesPlanned': 10, 'wireNegativesPlanned': 4, 'signedZeroControlsPlanned': 1,
            'chargedBeforeFinalReceiptBytes': charged, 'evidenceCapBytes': CAP,
            'scope': 'OBSERVER_AND_SAME_FREE_INPUT_PRIVATE_DETERMINISM_ONLY_NOT_WORLD_ADOPTION'}
        json_save('result.json', receipt)
        print(json.dumps({'status': receipt['status'], 'firstFailure': first_failure,
                          'result': str(out / 'result.json'), 'worldCalls': 0}))
        return 1 if first_failure else 0


if __name__ == '__main__':
    raise SystemExit(main())
