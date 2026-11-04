"""Root-only paid contact observer controls. No World/candidate/compiler calls."""
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
PAID = HOME/'evidence/dt-02'
PYTHON = '/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13'
LINE,CAP,REPLY = 2*1024*1024,16*1024*1024,65536
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
  "examples/physics-contact-convergence-2276/CONTRACT.md": {
    "bytes": 10671,
    "sha256": "3fd28725281c2b960df76a785b5d423bd2f88d48b8f42451c7923842c58b6eba"
  },
  "examples/physics-contact-convergence-2276/CONTROLS-CONTRACT.md": {
    "bytes": 3891,
    "sha256": "ee3ade693292d0e7e86f1b8fe973c23ba8e3c3ec4e2664103c78ed31466a0218"
  },
  "examples/physics-contact-convergence-2276/RUN-CONTRACT.md": {
    "bytes": 3835,
    "sha256": "2911bc775df7cd60db690bd3e5b64d53e7af8898692ba18f4145aeda92ffa8c7"
  },
  "examples/physics-contact-convergence-2276/baseline/first-dt-01/CONTRACT.md": {
    "bytes": 8823,
    "sha256": "c9fb4e5714ef417e125bdda4c109af5d7c76e2922cb707de1e7b2bc98667915c"
  },
  "examples/physics-contact-convergence-2276/baseline/first-dt-01/PINS.json": {
    "bytes": 1293,
    "sha256": "461295036c539cfe016b3c4a6dbf359977185f74007ec9dae4afeb9932315144"
  },
  "examples/physics-contact-convergence-2276/baseline/first-dt-01/oracle.py": {
    "bytes": 20991,
    "sha256": "18da93aab473d3435be155aa7807dedb8a289ccb675dd53e90ac22663e749041"
  },
  "examples/physics-contact-convergence-2276/baseline/first-dt-01/result.json": {
    "bytes": 2481,
    "sha256": "ef853f9b9cf800fb3fcc6db998f0684fc0fdeb20a9d524a6c496f22fa02f8d16"
  },
  "examples/physics-contact-convergence-2276/cases.mjs": {
    "bytes": 2374,
    "sha256": "ac0d58930827c27694856ac0381804714c69f86b4c086bc5320dd464201cbc56"
  },
  "examples/physics-contact-convergence-2276/evidence/diagnostic-01/inputs.json": {
    "bytes": 405,
    "sha256": "9a8323e70a5c6986f1852b8c932da918a00af7f2962aa887075e940d63b7cce3"
  },
  "examples/physics-contact-convergence-2276/evidence/diagnostic-01/reference.stdout": {
    "bytes": 4877,
    "sha256": "6d288e96488695c85f2f369207b460ebecdd51ee7373a31aaedaab651f53e411"
  },
  "examples/physics-contact-convergence-2276/evidence/diagnostic-01/result.json": {
    "bytes": 200,
    "sha256": "021669be652db4f9462fc35035792514426b4a3ebb5d57ee81945f3a843b7549"
  },
  "examples/physics-contact-convergence-2276/evidence/dt-02/inputs.json": {
    "bytes": 51440,
    "sha256": "1b5d2f2f7f2a7ef602f20d975ab244a038655d9062104ceb0aeaa8af6aea216b"
  },
  "examples/physics-contact-convergence-2276/evidence/dt-02/native-two-60-0-32.json": {
    "bytes": 97109,
    "sha256": "2af03782f3282a5c6f2ddba7f4d6f52055932cce8b22369b84dcf104190e7cb4"
  },
  "examples/physics-contact-convergence-2276/evidence/dt-02/native-two-60-0-32.stdout": {
    "bytes": 4877,
    "sha256": "6d288e96488695c85f2f369207b460ebecdd51ee7373a31aaedaab651f53e411"
  },
  "examples/physics-contact-convergence-2276/evidence/dt-02/result.json": {
    "bytes": 226799,
    "sha256": "fdc844094cf5ff28486d4e8ee2707d1525af6318dea89f6097cfa0305fac33ee"
  },
  "examples/physics-contact-convergence-2276/evidence/dt-02/source-two-60-0-32.json": {
    "bytes": 97109,
    "sha256": "73cc8ffc07f98221b78ac0abdf5c88947e49795018dea390701c85c87c582234"
  },
  "examples/physics-contact-convergence-2276/evidence/dt-02/source-two-60-0-32.stdout": {
    "bytes": 4877,
    "sha256": "6d288e96488695c85f2f369207b460ebecdd51ee7373a31aaedaab651f53e411"
  },
  "examples/physics-contact-convergence-2276/evidence/dt-02/source-two-60-32-60.json": {
    "bytes": 99719,
    "sha256": "6564b76b4cb9160ddb35256b7330381e65bef3f437d3ef6a4a2c82ae4aeb127b"
  },
  "examples/physics-contact-convergence-2276/oracle.py": {
    "bytes": 21081,
    "sha256": "88abb36b030bf2b29180c9154bdf6ceec0b1d85c4b1fb8d7def88dcf2c8d751c"
  },
  "examples/physics-contact-convergence-2276/run.mjs": {
    "bytes": 14060,
    "sha256": "cd61c656f0d6327c3a558cf87f11917bfb8f68e6a74b657f79543a6a0d13ecc9"
  },
  "examples/physics-coupled-cubes-floor-2276/oracle.py": {
    "bytes": 24768,
    "sha256": "c9bd37d91bb97bf584ddc0a2bc80a0e60fb8cbf26d049b97f5668315e5839f66"
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
        for chunk in iter(lambda:stream.read(65536),b''):
            digest.update(chunk)
    return {'bytes':path.stat().st_size,'sha256':digest.hexdigest()}


def authenticate():
    assert len(PINS) >= 18,'literal source/data/tool pins required'
    for name,expected in PINS.items():
        path = Path(name) if Path(name).is_absolute() else ROOT/name
        assert pin(path) == expected,'PIN:'+name


def numeric_words(value):
    words,nodes = [],0

    def visit(item,depth):
        nonlocal nodes
        nodes += 1
        assert depth <= 32 and nodes <= 262144,'numeric tree bound'
        if type(item) in (int,float):
            assert len(words) < 65536 and math.isfinite(float(item)),'finite512KiB word bound'
            words.append(struct.pack('<d',float(item)))
        elif type(item) is list:
            for child in item:
                visit(child,depth+1)
        elif type(item) is dict:
            for child in item.values():
                visit(child,depth+1)
    visit(value,0)
    return b''.join(words).hex()


def encode(value):
    return (json.dumps(value,allow_nan=False,separators=(',',':'))+'\n').encode()


def wire(data):
    return encode({'format':'contact-convergence-window-v1','data':data,
                   'numericWordsF64leHex':numeric_words(data)})


class BoundaryRefusal(ValueError):
    pass


def continuity(previous,boundary):
    if previous != boundary or numeric_words(previous) != numeric_words(boundary):
        raise BoundaryRefusal('full state or numeric-word boundary mismatch')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out',required=True)
    out = Path(parser.parse_args().out)
    assert out.is_absolute() and out.resolve().is_relative_to(HOME/'evidence')
    out.parent.mkdir(parents=True,exist_ok=True)
    out.mkdir()
    self_pin,deadline = pin(__file__),time.monotonic()+170
    charged,cli_attempts,restore_calls,host_calls = 0,0,0,0
    controls,analytical,host_controls = [],[],[]
    current,current_wire,first_failure,integrity = 'authenticate',None,None,'NOT_RUN'

    def save(name,raw):
        nonlocal charged
        assert type(raw) is bytes and charged+len(raw) <= CAP,'16MiB evidence cap'
        charged += len(raw)
        with (out/name).open('xb') as stream:
            stream.write(raw)

    def json_save(name,value):
        save(name,(json.dumps(value,allow_nan=False,indent=2)+'\n').encode())

    def cli(name,request,expected='positive',gates=(),step=None,reason=None,exact=None):
        nonlocal current,current_wire,cli_attempts
        current,current_wire = name,request
        assert len(request) <= LINE and time.monotonic() < deadline
        save(name+'-request.json',request)
        cli_attempts += 1
        child = subprocess.run([PYTHON,'-B',str(HOME/'oracle.py')],input=request,cwd=ROOT,
            stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=max(.01,deadline-time.monotonic()),check=False)
        assert len(child.stdout) <= REPLY and len(child.stderr) <= REPLY
        save(name+'.stdout',child.stdout); save(name+'.stderr',child.stderr)
        assert child.returncode == 0 and not child.stderr and child.stdout.count(b'\n') == 1,'observer execution'
        reply = json.loads(child.stdout)
        if expected == 'positive':
            assert reply['ok'] is True and reply['resolved'] is True and reply['executionFailure'] is False
        elif expected == 'physical':
            assert reply['ok'] is False and reply['resolved'] is True and reply['executionFailure'] is False
            assert reply['status'] == 'PHYSICAL_NO_GO'
            assert any(item.get('gate') in gates for item in reply['violations']),'specific physical predicate'
            assert reply['certificate']['firstPhysicalFailureStep'] == step,'first physical failure index'
            if name == 'strict-point-1e-11':
                assert 1e-12 < reply['metrics']['geometryRepresentativeFacePlaneM'] < 1e-10
        else:
            assert reply['ok'] is False and reply['resolved'] is False and reply['executionFailure'] is True
            assert reply['status'] == 'INVALID_INPUT' and reason in reply.get('reason',''),'specific invalid reason'
        if exact is not None:
            assert child.stdout == exact,'paid positive reply byte identity'
        controls.append({'name':name,'expected':expected,'confirmed':True,'status':reply['status'],
            'requestSHA256':hashlib.sha256(request).hexdigest(),'replySHA256':hashlib.sha256(child.stdout).hexdigest()})

    try:
        assert Path(sys.executable).resolve() == Path(PYTHON).resolve()
        authenticate()
        paid = json.loads((PAID/'result.json').read_text())
        assert paid['status'] == 'CONTACT_DT_SOURCE_NATIVE_WINDOW_REFERENCES_CONFIRMED'
        assert paid['failure'] is None and paid['sourceIntegrity'] == 'PASS' and paid['checkpoint32BarrierPassed'] is True
        for graph in ('source','native'):
            report = paid['reports'][graph]
            assert report['worlds'] == 6 and report['acceptedSteps'] == 840
            assert report['passedIndependentTransitions'] == 840 and report['comparedAndVerifiedTransitions'] == 840
            assert report['referenceReplies'] == 14
            segments = [(0,32),(32,60)] if graph == 'source' else [(0,32)]
            for start,end in segments:
                metadata = next(entry for entry in paid['windowPackets'][graph] if
                    entry['caseId'] == 'two-60' and entry['startStep'] == start and entry['endStep'] == end)
                assert metadata['name'] == graph+'-two-60-'+str(start)+'-'+str(end)+'.json'
                assert pin(PAID/metadata['name']) == {'bytes':metadata['bytes'],'sha256':metadata['sha256']}
        diagnostic = json.loads((HOME/'evidence/diagnostic-01/result.json').read_text())
        assert diagnostic['status'] == 'CONTACT_SAVED_FIRST32_REFERENCE_CONFIRMED' and diagnostic['sourceIntegrity'] == 'PASS'
        assert diagnostic['worldCalls'] == 0 and diagnostic['referenceCalls'] == 1
        json_save('inputs.json',{'pins':PINS,'selfPin':self_pin,'plannedOracleCLI':10,'plannedNegatives':8,
            'plannedPaidPositives':2,'plannedAnalyticalEvents':3,'plannedHostContinuityControls':1,
            'worldCalls':0,'candidateCalls':0,'compilerCalls':0})
        for rate,index in ((60,14),(120,27),(240,54)):
            current = 'analytic-event-'+str(rate)
            h,g,gap = F.from_float(1/rate),F.from_float(9.81),F(1,4)
            previous = g*h*h*(index-1)*index/2
            actual = g*h*h*index*(index+1)/2
            assert previous < gap <= actual
            toi_squared = 2*gap/g
            assert (index*h-h)**2 <= toi_squared <= (index*h+h)**2
            analytical.append({'rate':rate,'literalImpactStep':index,'confirmed':True,
                'distanceBefore':str(previous),'distanceAtImpact':str(actual),'continuousTOISquared':str(toi_squared)})
        json_save('analytical.json',analytical)
        requests = {graph:(PAID/(graph+'-two-60-0-32.json')).read_bytes() for graph in ('source','native')}
        replies = {graph:(PAID/(graph+'-two-60-0-32.stdout')).read_bytes() for graph in ('source','native')}
        assert replies['source'] == replies['native']
        assert json.loads(requests['source'])['numericWordsF64leHex'] == json.loads(requests['native'])['numericWordsF64leHex']
        for graph in ('source','native'):
            cli('paid-'+graph,requests[graph],exact=replies[graph])
        pure_path = ROOT/'examples/physics-three-cubes-floor-2276/oracle.py'
        spec = importlib.util.spec_from_file_location('closed_contact_control_transport',pure_path)
        P = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(P)
        first_packet = json.loads(requests['source'])
        second_packet = json.loads((PAID/'source-two-60-32-60.json').read_bytes())
        restore_calls += 1
        first = P.restore_words(first_packet['data'],first_packet['numericWordsF64leHex'])
        restore_calls += 1
        second = P.restore_words(second_packet['data'],second_packet['numericWordsF64leHex'])
        changed = copy.deepcopy(second)
        changed['startStep'] = 33
        cli('invalid-window-start',wire(changed),expected='invalid',reason='preregistered window')
        changed = copy.deepcopy(second)
        next(body for body in changed['states'][0]['bodies'] if body['id'] == 'upper')['positionM'][1] += .001
        current,current_wire = 'host-exact-boundary',wire(changed)
        host_calls += 1
        continuity(first['states'][-1],second['states'][0])
        host_calls += 1
        try:
            continuity(first['states'][-1],changed['states'][0])
        except BoundaryRefusal as error:
            host_controls.append({'name':current,'confirmed':True,'reason':str(error),'functionCalls':2})
        else:
            raise AssertionError('changed full-state/word boundary accepted')
        json_save('host-continuity.json',host_controls)
        cli('boundary-y-mismatch',wire(changed),expected='physical',gates=('upperDiscreteClosedPositionM',),step=32)
        for name in ('strict-point-1e-11','terminal-quaternion-norm','all-upper-authored-attitude','removed-first-upper-contact'):
            changed = copy.deepcopy(first)
            terminal = changed['states'][-1]
            upper = next(body for body in terminal['bodies'] if body['id'] == 'upper')
            if name == 'strict-point-1e-11':
                terminal['contacts'][0]['pointM'][1] += 1e-11
                gates,step = ('geometryRepresentativeFacePlaneM',),32
            elif name == 'terminal-quaternion-norm':
                upper['orientationXYZW'][3] = .5
                gates,step = ('authoredOrientationSquaredNorm',),32
            elif name == 'all-upper-authored-attitude':
                for state in changed['states']:
                    next(body for body in state['bodies'] if body['id'] == 'upper')['orientationXYZW'] = [1,0,0,0]
                gates,step = ('authoredOrientationComponent',),0
            else:
                selected = next(state for state in changed['states'][1:] if any('upper' in
                    (contact['bodyAId'],contact['bodyBId']) for contact in state['contacts']))
                at = next(i for i,contact in enumerate(selected['contacts']) if 'upper' in (contact['bodyAId'],contact['bodyBId']))
                selected['contacts'].pop(at)
                assert selected['stepIndex'] == 14
                gates,step = ('missingRequiredContact','closedDiscreteImpactContactPresence'),14
            cli(name,wire(changed),expected='physical',gates=gates,step=step)
        for name in ('finite-word-mismatch','trailing-word'):
            changed = copy.deepcopy(first_packet)
            raw = bytearray.fromhex(changed['numericWordsF64leHex'])
            if name == 'finite-word-mismatch':
                at = next(i for i in range(0,len(raw),8) if struct.unpack_from('<d',raw,i)[0] != 0)
                struct.pack_into('<d',raw,at,struct.unpack_from('<d',raw,at)[0]+.125)
                reason = 'numeric word mismatch'
            else:
                raw.extend(bytes(8)); reason = 'trailing numeric words'
            changed['numericWordsF64leHex'] = raw.hex()
            cli(name,encode(changed),expected='invalid',reason=reason)
        assert cli_attempts == 10 and len(controls) == 10 and len(analytical) == 3
        assert host_calls == 2 and len(host_controls) == 1 and restore_calls == 2
        authenticate()
        assert pin(__file__) == self_pin and time.monotonic() < deadline
        integrity = 'PASS'
    except Exception as error:
        first_failure = {'control':current,'type':type(error).__name__,'message':str(error)[:1024]}
        if current_wire is not None:
            save('first-failure-request.json',current_wire)
    finally:
        try:
            authenticate()
            assert pin(__file__) == self_pin
        except Exception as error:
            integrity = 'FAIL'
            first_failure = first_failure or {'control':'final-authentication','message':str(error)[:1024]}
        receipt = {'status':'CONTACT_CONVERGENCE_OBSERVER_CONTROLS_CONFIRMED' if first_failure is None else 'FIRST_FAILURE',
            'firstFailure':first_failure,'sourceIntegrity':integrity,'oracleCLIAttempts':cli_attempts,
            'negativeControls':sum(control['expected'] != 'positive' for control in controls),
            'paidPositives':sum(control['expected'] == 'positive' for control in controls),
            'analyticalEventControls':len(analytical),'hostContinuityControls':len(host_controls),
            'hostContinuityCalls':host_calls,'helperRestoreCalls':restore_calls,
            'controls':controls,'analytical':analytical,'hostControls':host_controls,
            'worldCalls':0,'candidateCalls':0,'compilerCalls':0,'captureOrReplayCalls':0,
            'chargedBeforeFinalReceiptBytes':charged,'evidenceCapBytes':CAP,
            'scope':'PAID_DATA_REFERENCE_CONTROLS_NOT_NEW_PHYSICAL_CASES'}
        json_save('result.json',receipt)
        print(json.dumps({'status':receipt['status'],'firstFailure':first_failure,'result':str(out/'result.json')}))
        return 1 if first_failure else 0


if __name__ == '__main__':
    raise SystemExit(main())
