"""Root-only paid-data observer controls. No World/candidate/compiler imports or calls."""
import argparse
import copy
from fractions import Fraction as F
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct
import subprocess
import sys
import time

HOME = Path(__file__).resolve().parent
ROOT = HOME.parents[1]
PRIVATE = HOME / 'evidence/private-01'
PUBLIC = HOME / 'evidence/api-01'
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
  "examples/physics-anisotropic-inertia-2276/CAPTURE-REFERENCE-ADDENDUM.md": {
    "bytes": 2294,
    "sha256": "3ed75c67bf14740b01769f79d1eba832a8730c1eb5f0c27766e3ed136724c69b"
  },
  "examples/physics-anisotropic-inertia-2276/CONTRACT.md": {
    "bytes": 6502,
    "sha256": "a9437ab7ec43d1856806ccad5cd34e29bb5720e35beed5a149c22b9c3dad3ac5"
  },
  "examples/physics-anisotropic-inertia-2276/ORACLE-CONTROLS-CONTRACT.md": {
    "bytes": 4615,
    "sha256": "a9b71f88dcced73689d2d8c59f411624126a75978d0d35b0d3e07af35f76c50e"
  },
  "examples/physics-anisotropic-inertia-2276/PUBLIC-REFERENCE-CONTRACT.md": {
    "bytes": 4802,
    "sha256": "832c109445bed41e80e4ed93eee72738fe192c745442f6bcafa46e4819e66ebb"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/inputs.json": {
    "bytes": 54185,
    "sha256": "f8c70324af0edce1f8980fb184a17b0409c9483d42292e78e311a31f593d67f9"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/native-principal-spin-120-64-reference.stdout": {
    "bytes": 1332,
    "sha256": "2633cd1a253052f9d89d9a10f2b84dc2590976277f2b53dec229ce05cf3aba89"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/native-principal-spin-120-64.json": {
    "bytes": 163937,
    "sha256": "a4094dd01bc153cfd6a3eaad980137f7b92bc47f46386ac99d329f518d6889f4"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/result.json": {
    "bytes": 24981,
    "sha256": "90ec5e6f6c5ac5bc52125d1941a6cd45fb023797ac77cb704870ef1d314b8d48"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/source-principal-spin-120-64-reference.stdout": {
    "bytes": 1332,
    "sha256": "2633cd1a253052f9d89d9a10f2b84dc2590976277f2b53dec229ce05cf3aba89"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/source-principal-spin-120-64.json": {
    "bytes": 163937,
    "sha256": "22ffd1f015d919d8506a185a54e4aecd0cf6eb9f27c30ed51cedffaa252bb8ed"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/private-01/inputs.json": {
    "bytes": 81138,
    "sha256": "12f86477b7600822e294b11d928d5f1b78731c09bfe77c664f78cc9192047f33"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/private-01/native-captured-free-candidate.json": {
    "bytes": 55289,
    "sha256": "7271906a47c09a12f18d35251a1c37989d50ead2fa651d3895e23097196278e9"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/private-01/native-captured-oracle.stdout": {
    "bytes": 760,
    "sha256": "a7b41f70314de680baf24a39e3c2e11d784d8dc9d8cec47afceca10d50e981ed"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/private-01/result.json": {
    "bytes": 6395,
    "sha256": "a25611638e598dda2d9689853319d08b48086f1f141068ff961d5b8c0bc206c8"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/private-01/source-captured-free-candidate.json": {
    "bytes": 55289,
    "sha256": "7271906a47c09a12f18d35251a1c37989d50ead2fa651d3895e23097196278e9"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/private-01/source-captured-oracle.stdout": {
    "bytes": 760,
    "sha256": "a7b41f70314de680baf24a39e3c2e11d784d8dc9d8cec47afceca10d50e981ed"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/public-build-02/result.json": {
    "bytes": 153592,
    "sha256": "f6109ca4253d0c7d61d8b3a4140eeaba00020615e138f65bf03b2a99fffb8308"
  },
  "examples/physics-anisotropic-inertia-2276/oracle.py": {
    "bytes": 14774,
    "sha256": "a2520ea1a77ff227850c715b3d9599e43f29651e8d78c6e0bda61fc3b0a61e7d"
  },
  "examples/physics-anisotropic-inertia-2276/private-cases.mjs": {
    "bytes": 4617,
    "sha256": "4c4df06f5822c3e76ac28918c952346d69d20046c553f6d89682dcf500828c4e"
  },
  "examples/physics-anisotropic-inertia-2276/private.test.mjs": {
    "bytes": 4280,
    "sha256": "4c78425df274c284c65100868001096faaa0ee861fde1bb69b197f40e634fdb3"
  },
  "examples/physics-anisotropic-inertia-2276/public-oracle.py": {
    "bytes": 17594,
    "sha256": "e1a171dec8452eec1fb3ab5c0efc66b9fc3bbdca28913bd7be5be9fb6b08ec6d"
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
    assert len(PINS) >= 16, 'closed literal pins required'
    for name, expected in PINS.items():
        path = Path(name) if Path(name).is_absolute() else ROOT / name
        assert pin(path) == expected, 'PIN:'+name


def numeric_words(value):
    encoded, nodes = [], 0

    def visit(item, depth):
        nonlocal nodes
        nodes += 1
        assert nodes <= 262144 and depth <= 32, 'numeric tree bound'
        if type(item) in (int, float):
            assert len(encoded) < 65536 and math.isfinite(float(item)), 'finite512KiB word bound'
            encoded.append(struct.pack('<d', float(item)))
        elif type(item) is list:
            for child in item:
                visit(child, depth+1)
        elif type(item) is dict:
            for child in item.values():
                visit(child, depth+1)
    visit(value, 0)
    return b''.join(encoded).hex()


def encode(value):
    return (json.dumps(value, allow_nan=False, separators=(',', ':'))+'\n').encode()


def wire(data, public=False):
    return encode({'format':'anisotropic-inertia-public-v1' if public else 'anisotropic-inertia-private-v1',
                   'data':data, 'numericWordsF64leHex':numeric_words(data)})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', required=True)
    options = parser.parse_args()
    out = Path(options.out)
    assert out.is_absolute() and out.resolve().is_relative_to(HOME / 'evidence')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.mkdir()
    self_pin, deadline = pin(__file__), time.monotonic()+170
    charged, analytical_calls, restore_calls, cli_attempts = 0, 0, 0, 0
    controls, analytical = [], []
    current_name, current_wire, first_failure = 'authenticate', None, None
    integrity = 'NOT_RUN'

    def save(name, raw):
        nonlocal charged
        assert type(raw) is bytes and charged+len(raw) <= CAP, '16MiB evidence cap'
        charged += len(raw)
        with (out / name).open('xb') as stream:
            stream.write(raw)

    def json_save(name, value):
        save(name, (json.dumps(value, allow_nan=False, indent=2)+'\n').encode())

    def cli(name, request, public=False, expected='positive', gates=(), reason=None, exact=None):
        nonlocal cli_attempts, current_name, current_wire
        current_name, current_wire = name, request
        assert len(request) <= LINE and time.monotonic() < deadline, 'wire/deadline'
        # Save the complete exact request before the observer child executes.
        save(name+'-request.json',request)
        cli_attempts += 1
        child = subprocess.run([PYTHON,'-B',str(HOME / ('public-oracle.py' if public else 'oracle.py'))],
            cwd=ROOT,input=request,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
            timeout=max(.01,deadline-time.monotonic()),check=False)
        assert len(child.stdout) <= REPLY and len(child.stderr) <= REPLY, 'reply bound'
        save(name+'.stdout',child.stdout); save(name+'.stderr',child.stderr)
        assert child.returncode == 0 and not child.stderr and child.stdout.count(b'\n') == 1, 'observer execution'
        reply = json.loads(child.stdout)
        if expected == 'positive':
            assert reply['ok'] is True and reply['resolved'] is True and reply['executionFailure'] is False
        elif expected == 'physical':
            assert reply['ok'] is False and reply['resolved'] is True and reply['executionFailure'] is False
            assert reply['status'] == 'PHYSICAL_NO_GO'
            names = {item.get('gate') for item in reply['violations']}
            assert all(gate in names for gate in gates), 'specific unchanged physical predicates'
            if public:
                assert reply['certificate']['firstPhysicalFailureStep'] == 64
            if name == 'public-strict-point-1e-11':
                assert 1e-12 < reply['metrics']['geometryRepresentativeFacePlaneM'] < 1e-10
        else:
            assert reply['ok'] is False and reply['resolved'] is False and reply['executionFailure'] is True
            assert reply['status'] == 'INVALID_INPUT' and reason in reply.get('reason',''), 'specific invalid reason'
        if exact is not None:
            assert child.stdout == exact, 'paid observer reply byte identity'
        controls.append({'name':name,'expected':expected,'confirmed':True,'public':public,
                         'requestBytes':len(request),'requestSHA256':hashlib.sha256(request).hexdigest(),
                         'replySHA256':hashlib.sha256(child.stdout).hexdigest(),'status':reply['status']})

    try:
        assert Path(sys.executable).resolve() == Path(PYTHON).resolve()
        authenticate()
        private_receipt = json.loads((PRIVATE / 'result.json').read_text())
        public_receipt = json.loads((PUBLIC / 'result.json').read_text())
        assert private_receipt['status'] == 'ANISOTROPIC_PRIVATE_SOURCE_NATIVE_20CALLS_13REFERENCES_CONFIRMED'
        assert public_receipt['status'] == 'ANISOTROPIC_PUBLIC_SOURCE_NATIVE_EIGHT_CASES_CONFIRMED'
        for receipt in (private_receipt,public_receipt):
            assert receipt['failure'] is None and receipt['sourceIntegrity'] == 'PASS'
        for graph in ('source','native'):
            assert private_receipt['reports'][graph]['candidateCalls'] == 20
            assert private_receipt['reports'][graph]['referenceReplies'] == 13
            report = public_receipt['reports'][graph]
            assert report['worlds'] == 8 and report['acceptedSteps'] == 212 and report['referenceReplies'] == 8
        json_save('inputs.json',{'pins':PINS,'selfPin':self_pin,'plannedOracleCLI':16,
            'plannedAnalyticalHelperCalls':3,'plannedHelperRestoreCalls':4,'worldCalls':0,'candidateCalls':0})
        spec = importlib.util.spec_from_file_location('frozen_anisotropic_reference',HOME / 'oracle.py')
        O = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(O)
        current_name = 'literal-normalized-quarter-turn'
        analytical_calls += 1
        literal = O.rotated([F(0),F(0),F(1),F(1)],[F(1),F(0),F(0)])
        assert literal == [0,1,0]
        analytical.append({'name':current_name,'confirmed':True,'value':[str(x) for x in literal]})
        current_name = 'literal-signed-quarter-turn'
        analytical_calls += 1
        literal = O.rotated([F(0),F(0),F(-1),F(-1)],[F(1),F(0),F(0)])
        assert literal == [0,1,0]
        analytical.append({'name':current_name,'confirmed':True,'value':[str(x) for x in literal]})
        current_name = 'literal-principal-angular-action'
        analytical_calls += 1
        literal = O.tensor_action([F(0),F(0),F(1),F(1)],
            [F(24,13),F(12,5),F(24,5)],[F(0),F(1,8),F(0)])
        assert literal == [0,F(3,13),0]
        analytical.append({'name':current_name,'confirmed':True,'value':[str(x) for x in literal]})
        json_save('analytical.json',analytical)

        private_wires = {graph:(PRIVATE / (graph+'-captured-free-candidate.json')).read_bytes()
                         for graph in ('source','native')}
        private_replies = {graph:(PRIVATE / (graph+'-captured-oracle.stdout')).read_bytes()
                           for graph in ('source','native')}
        public_wires = {graph:(PUBLIC / (graph+'-principal-spin-120-64.json')).read_bytes()
                        for graph in ('source','native')}
        public_replies = {graph:(PUBLIC / (graph+'-principal-spin-120-64-reference.stdout')).read_bytes()
                          for graph in ('source','native')}
        for requests,replies in ((private_wires,private_replies),(public_wires,public_replies)):
            assert replies['source'] == replies['native'], 'paid Source/Native observer reply identity'
            assert json.loads(requests['source'])['numericWordsF64leHex'] == \
                   json.loads(requests['native'])['numericWordsF64leHex'], 'paid Source/Native all numeric words'
        cli('paid-private-capture',private_wires['source'],exact=private_replies['source'])
        cli('paid-public-principal',public_wires['source'],public=True,exact=public_replies['source'])
        encoded_private, encoded_public = json.loads(private_wires['source']),json.loads(public_wires['source'])
        restore_calls += 1
        private = O.restore_words(encoded_private['data'],encoded_private['numericWordsF64leHex'])
        restore_calls += 1
        public = O.restore_words(encoded_public['data'],encoded_public['numericWordsF64leHex'])

        for name in ('private-symmetric-wrong-tensor','private-asymmetric-tensor','private-wrong-angular-load',
                     'private-captured-upper-contact','private-captured-upper-word'):
            changed = copy.deepcopy(private)
            problem = changed['observation']['result']['diagnostics']['normalProblem']
            upper = next(body for body in problem['bodies'] if body['id'] == 'upper')
            if name == 'private-symmetric-wrong-tensor':
                upper['inverseInertiaWorld'][0][0] += .01
                gates = ('physicalTensorKgInvMInv2',)
            elif name == 'private-asymmetric-tensor':
                upper['inverseInertiaWorld'][0][1] += .01
                gates = ('exactMatrixSymmetry',)
            elif name == 'private-wrong-angular-load':
                load = next(load for load in changed['angularLoads'] if load['bodyId'] == 'upper'
                            and load['torqueNms'] == [1,0,0])
                for key in ('inverseActionRadps','afterSpinRadps','inertiaRoundTripNms'):
                    load[key][0] += .01
                gates = ('angularActionRadps','angularMomentumNms','angularLoadEnergyJ')
            elif name == 'private-captured-upper-contact':
                point = problem['points'][0]
                assert 'upper' not in (point['aId'],point['bId'])
                point['bId'] = 'upper'
                gates = ('capturedUpperHasContact',)
            else:
                body = next(body for body in changed['observation']['result']['candidateBodies'] if body['id'] == 'upper')
                body['velocityMps'][0] += .01
                gates = ('capturedUpperBodyWordsChanged',)
            cli(name,wire(changed),expected='physical',gates=gates)

        for name in ('public-terminal-quaternion','public-terminal-spin','public-terminal-freefall',
                     'public-strict-point-1e-11','public-forbidden-upper-contact'):
            changed = copy.deepcopy(public)
            terminal = changed['states'][-1]
            upper = next(body for body in terminal['bodies'] if body['id'] == 'upper')
            if name == 'public-terminal-quaternion':
                upper['orientationXYZW'][0] += .01
                gates = ('principalOrientationComponent',)
            elif name == 'public-terminal-spin':
                upper['angularVelocityRadps'][1] += .01
                gates = ('principalAngularVelocityRadps',)
            elif name == 'public-terminal-freefall':
                upper['positionM'][1] += .01
                gates = ('upperKickDriftPositionM',)
            elif name == 'public-strict-point-1e-11':
                terminal['contacts'][0]['pointM'][1] += 1e-11
                gates = ('geometryRepresentativeFacePlaneM',)
            else:
                contact = terminal['contacts'][0]
                assert {contact['bodyAId'],contact['bodyBId']} == {'lower','floor'}
                side = 'A' if contact['bodyAId'] == 'lower' else 'B'
                contact['body'+side+'Id'] = 'upper'
                contact['collider'+side+'Id'] = next(c['id'] for c in changed['model']['colliders'] if c['bodyId'] == 'upper')
                gates = ('unexpectedUpperContact',)
            cli(name,wire(changed,public=True),public=True,expected='physical',gates=gates)

        for name in ('nonzero-mismatch','nonfinite-word','trailing-word'):
            changed = copy.deepcopy(encoded_private)
            raw = bytearray.fromhex(changed['numericWordsF64leHex'])
            if name == 'nonzero-mismatch':
                offset = next(index for index in range(0,len(raw),8) if struct.unpack_from('<d',raw,index)[0] != 0)
                struct.pack_into('<d',raw,offset,struct.unpack_from('<d',raw,offset)[0]+.125)
                reason = 'nonzero numeric word mismatch'
            elif name == 'nonfinite-word':
                raw[:8] = bytes.fromhex('000000000000f87f')
                reason = 'nonfinite numeric word'
            else:
                raw.extend(bytes(8))
                reason = 'trailing numeric words'
            changed['numericWordsF64leHex'] = raw.hex()
            cli('wire-'+name,encode(changed),expected='invalid',reason=reason)

        current_name = 'literal-negative-zero-restore'
        restore_calls += 1
        restored = O.restore_words({'value':0},'0000000000000080')
        assert struct.pack('<d',restored['value']).hex() == '0000000000000080'
        current_name = 'literal-missing-word-refusal'
        restore_calls += 1
        try:
            O.restore_words({'value':1},'')
        except O.Invalid as error:
            assert str(error) == 'missing numeric word'
        else:
            raise AssertionError('missing literal word was accepted')
        changed = copy.deepcopy(public)
        next(body for body in changed['states'][0]['bodies'] if body['id'] == 'lower')['positionM'][0] = -0.0
        signed_packet = json.loads(wire(changed,public=True))
        next(body for body in signed_packet['data']['states'][0]['bodies'] if body['id'] == 'lower')['positionM'][0] = 0.0
        cli('signed-zero-public-value',encode(signed_packet),public=True,exact=public_replies['source'])
        assert cli_attempts == 16 and analytical_calls == 3 and restore_calls == 4
        authenticate()
        assert pin(__file__) == self_pin and time.monotonic() < deadline
        integrity = 'PASS'
    except Exception as error:
        first_failure = {'control':current_name,'type':type(error).__name__,'message':str(error)[:1024]}
        if current_wire is not None and len(current_wire) <= LINE:
            save('first-failure-request.json',current_wire)
    finally:
        try:
            authenticate()
            assert pin(__file__) == self_pin
        except Exception as error:
            integrity = 'FAIL'
            first_failure = first_failure or {'control':'final-authentication','message':str(error)[:1024]}
        receipt = {'status':'ANISOTROPIC_INERTIA_REFERENCE_CONTROLS_CONFIRMED' if first_failure is None else 'FIRST_FAILURE',
            'firstFailure':first_failure,'sourceIntegrity':integrity,'oracleCLIAttempts':cli_attempts,
            'confirmedControls':len(controls),'analyticalHelperCalls':analytical_calls,'helperRestoreCalls':restore_calls,
            'controls':controls,'analytical':analytical,'worldCalls':0,'candidateCalls':0,'compilerCalls':0,
            'captureOrReplayCalls':0,'chargedBeforeFinalReceiptBytes':charged,'evidenceCapBytes':CAP,
            'scope':'REFERENCE_OBSERVER_CONTROLS_NOT_NEW_PHYSICAL_CASES'}
        json_save('result.json',receipt)
        print(json.dumps({'status':receipt['status'],'firstFailure':first_failure,'result':str(out/'result.json'),
                          'worldCalls':0,'candidateCalls':0}))
        return 1 if first_failure else 0


if __name__ == '__main__':
    raise SystemExit(main())
