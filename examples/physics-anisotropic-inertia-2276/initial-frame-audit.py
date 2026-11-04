"""Root-only additive authored-frame audit. No candidate/package/old decoder imports."""
import argparse
import copy
from decimal import Decimal, localcontext
import hashlib
import json
import math
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
CASES = ('natural-120-64','principal-spin-120-64','natural-60','natural-120','natural-240',
         'principal-spin-60','principal-spin-120','principal-spin-240')
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
  "examples/physics-anisotropic-inertia-2276/INITIAL-FRAME-AUDIT-CONTRACT.md": {
    "bytes": 4613,
    "sha256": "0c7b15e180ce6e4fd090960bfa172f585c0cf251410b29a26f886bb262cb2854"
  },
  "examples/physics-anisotropic-inertia-2276/PUBLIC-CONTRACT.md": {
    "bytes": 3855,
    "sha256": "aef11b95c38cc9639d258ab62537839bec483843d36c97181ad1c0f0d4832fe6"
  },
  "examples/physics-anisotropic-inertia-2276/PUBLIC-REFERENCE-CONTRACT.md": {
    "bytes": 4802,
    "sha256": "832c109445bed41e80e4ed93eee72738fe192c745442f6bcafa46e4819e66ebb"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/inputs.json": {
    "bytes": 54185,
    "sha256": "f8c70324af0edce1f8980fb184a17b0409c9483d42292e78e311a31f593d67f9"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/native-natural-120-64-reference.stdout": {
    "bytes": 1216,
    "sha256": "68ab2a7c119e38b75f5af7f0650ab9430e0cde63e73e930a9dcaf7eb0803a476"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/native-natural-120-64.json": {
    "bytes": 156427,
    "sha256": "8d6afa6cf8facb897c2919091cb3d8ec3aed62dc9efbd0d0ee0004bea5d63633"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/native-natural-120-reference.stdout": {
    "bytes": 1245,
    "sha256": "c1255022dafcdf3c8a5fbcc54471ef7ad949ebc26dd8cefae72c5900c6c59923"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/native-natural-120.json": {
    "bytes": 33471,
    "sha256": "c68b43976d66d8a046a71fc56ec9feb0d739dfce0705e39c90232307e9db8bd4"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/native-natural-240-reference.stdout": {
    "bytes": 1210,
    "sha256": "19da2a918062152353efb8f04443bfbac2c193c90e4870848488c63caabd6d5e"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/native-natural-240.json": {
    "bytes": 61310,
    "sha256": "b454c8843689c1cb269de2070d0a8e8270ea9d1de40d389974f992ac07c47815"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/native-natural-60-reference.stdout": {
    "bytes": 1203,
    "sha256": "4fc562c13495676db1e9cde27e25fe9266db68b2e63ddfd1324d8199087dae3a"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/native-natural-60.json": {
    "bytes": 19179,
    "sha256": "345f276654e4554f7c532c4ba9c68ac1db5b08b5725270637d483ccbabece67b"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/native-principal-spin-120-64-reference.stdout": {
    "bytes": 1332,
    "sha256": "2633cd1a253052f9d89d9a10f2b84dc2590976277f2b53dec229ce05cf3aba89"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/native-principal-spin-120-64.json": {
    "bytes": 163937,
    "sha256": "a4094dd01bc153cfd6a3eaad980137f7b92bc47f46386ac99d329f518d6889f4"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/native-principal-spin-120-reference.stdout": {
    "bytes": 1364,
    "sha256": "de28a267ac33dfcd0bf90f0ab2f0b5b9b8fe919597f5d6d40b09d849f4430841"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/native-principal-spin-120.json": {
    "bytes": 35011,
    "sha256": "3cde112dee30288c3803a84988386f6ac79be9fe5663496e913f500ed7d3e522"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/native-principal-spin-240-reference.stdout": {
    "bytes": 1328,
    "sha256": "86d6d11a1e6f9e025a5c6f8d75f1ea16d7bd5b1d2d737836102ce29240f61512"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/native-principal-spin-240.json": {
    "bytes": 64191,
    "sha256": "27da4193a47b6bf66c8b7d9e2ad6309d7dc090e714170597e7ad7d41f2c0f2b1"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/native-principal-spin-60-reference.stdout": {
    "bytes": 1321,
    "sha256": "fa13e26a5fcd45a1641339bba2362712441e0e511a7f848e6ce621d3a02d3f46"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/native-principal-spin-60.json": {
    "bytes": 20018,
    "sha256": "49038fc280c76ab7f3cf5e5bb3c2bd480337c6a15b3d12aa35519ffe354c8053"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/result.json": {
    "bytes": 24981,
    "sha256": "90ec5e6f6c5ac5bc52125d1941a6cd45fb023797ac77cb704870ef1d314b8d48"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/source-natural-120-64-reference.stdout": {
    "bytes": 1216,
    "sha256": "68ab2a7c119e38b75f5af7f0650ab9430e0cde63e73e930a9dcaf7eb0803a476"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/source-natural-120-64.json": {
    "bytes": 156427,
    "sha256": "8117d1eea203ef4be463e5098394cc94ea753a978aebb9e3676c182d60e98cc1"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/source-natural-120-reference.stdout": {
    "bytes": 1245,
    "sha256": "c1255022dafcdf3c8a5fbcc54471ef7ad949ebc26dd8cefae72c5900c6c59923"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/source-natural-120.json": {
    "bytes": 33471,
    "sha256": "4830649c5d6084ba27699fab3fa12ecd6cc074be7b14777d9f089f2594f2c3fd"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/source-natural-240-reference.stdout": {
    "bytes": 1210,
    "sha256": "19da2a918062152353efb8f04443bfbac2c193c90e4870848488c63caabd6d5e"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/source-natural-240.json": {
    "bytes": 61310,
    "sha256": "6a51aec8c31ee5e645eff51dde46dd14861d678e0963f55e967a1cf21373d0b1"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/source-natural-60-reference.stdout": {
    "bytes": 1203,
    "sha256": "4fc562c13495676db1e9cde27e25fe9266db68b2e63ddfd1324d8199087dae3a"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/source-natural-60.json": {
    "bytes": 19179,
    "sha256": "8d3f96edcd7b7b88103f4f72b1d29b468a3c515eb31aef0fdbb1e033baa0fa19"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/source-principal-spin-120-64-reference.stdout": {
    "bytes": 1332,
    "sha256": "2633cd1a253052f9d89d9a10f2b84dc2590976277f2b53dec229ce05cf3aba89"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/source-principal-spin-120-64.json": {
    "bytes": 163937,
    "sha256": "22ffd1f015d919d8506a185a54e4aecd0cf6eb9f27c30ed51cedffaa252bb8ed"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/source-principal-spin-120-reference.stdout": {
    "bytes": 1364,
    "sha256": "de28a267ac33dfcd0bf90f0ab2f0b5b9b8fe919597f5d6d40b09d849f4430841"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/source-principal-spin-120.json": {
    "bytes": 35011,
    "sha256": "f5649d7459eda63fa067e29a81938d7e76f90686deded705b47a8f516c22f43f"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/source-principal-spin-240-reference.stdout": {
    "bytes": 1328,
    "sha256": "86d6d11a1e6f9e025a5c6f8d75f1ea16d7bd5b1d2d737836102ce29240f61512"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/source-principal-spin-240.json": {
    "bytes": 64191,
    "sha256": "539939f8d7be901208b069c038dd5c86d2a0100a3d05e2291d94a7054d1f224a"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/source-principal-spin-60-reference.stdout": {
    "bytes": 1321,
    "sha256": "fa13e26a5fcd45a1641339bba2362712441e0e511a7f848e6ce621d3a02d3f46"
  },
  "examples/physics-anisotropic-inertia-2276/evidence/api-01/source-principal-spin-60.json": {
    "bytes": 20018,
    "sha256": "9746a1b508350ee032f1f8cf8f7bcae0c1b83412a9942ea4efdb4827ff2f76e7"
  },
  "examples/physics-anisotropic-inertia-2276/oracle.py": {
    "bytes": 14774,
    "sha256": "a2520ea1a77ff227850c715b3d9599e43f29651e8d78c6e0bda61fc3b0a61e7d"
  },
  "examples/physics-anisotropic-inertia-2276/public-oracle.py": {
    "bytes": 17594,
    "sha256": "e1a171dec8452eec1fb3ab5c0efc66b9fc3bbdca28913bd7be5be9fb6b08ec6d"
  }
}
# IMMUTABLE_PINS_END


class Invalid(ValueError):
    pass


def need(condition, message):
    if not condition:
        raise Invalid(message)


def binary_number(value):
    need(type(value) in (int,float), 'finite JS Number required')
    try:
        actual = float(value)
    except (ValueError,OverflowError):
        raise Invalid('finite JS Number required') from None
    need(math.isfinite(actual), 'finite JS Number required')
    return actual


def restore(value, hexadecimal):
    """Independent finite-word iterator, preserving sign and exact consumption."""
    need(type(hexadecimal) is str and len(hexadecimal)%16 == 0 and
         len(hexadecimal) <= 65536*16, 'bounded numeric hex shape')
    need(all(char in '0123456789abcdef' for char in hexadecimal), 'lowercase numeric hex')
    raw = bytes.fromhex(hexadecimal)
    iterator = iter(struct.iter_unpack('<d',raw))
    leaves, nodes = 0, 0

    def visit(item, depth):
        nonlocal leaves,nodes
        nodes += 1
        need(depth <= 32 and nodes <= 262144, 'numeric tree bound')
        if type(item) in (int,float):
            try:
                actual = next(iterator)[0]
            except StopIteration:
                raise Invalid('missing numeric word') from None
            leaves += 1
            need(math.isfinite(actual), 'nonfinite numeric word')
            need(actual == binary_number(item), 'nonzero numeric word mismatch')
            return actual
        if type(item) is list:
            return [visit(entry,depth+1) for entry in item]
        if type(item) is dict:
            return {key:visit(entry,depth+1) for key,entry in item.items()}
        need(item is None or type(item) in (bool,str), 'JSON value required')
        return item

    restored = visit(value,0)
    try:
        next(iterator)
    except StopIteration:
        return restored,leaves
    raise Invalid('trailing numeric words')


def authored_quaternion(value):
    need(type(value) is list and len(value) == 4, 'authored quaternion shape')
    exact = [Decimal.from_float(binary_number(component)) for component in value]
    with localcontext() as context:
        context.prec = 90
        norm2 = sum((component*component for component in exact),Decimal(0))
        need(norm2 > 0 and all(abs(component) <= 1 for component in exact), 'bounded authored quaternion')
        norm = norm2.sqrt()
        need(abs(norm-1) <= Decimal('1e-6'), 'authored unit-quaternion domain')
        return [component/norm for component in exact]


def audit_packet(packet):
    try:
        need(type(packet) is dict and packet.get('format') == 'anisotropic-inertia-public-v1', 'wire format')
        data,leaves = restore(packet['data'],packet['numericWordsF64leHex'])
        need(type(data) is dict and data.get('caseId') in CASES, 'fixed paid case identity')
        model = data['model']
        need(type(model) is dict and type(model.get('bodies')) is list and len(model['bodies']) == 3,
             'three authored bodies')
        authored = {}
        for body in model['bodies']:
            need(type(body) is dict and type(body.get('id')) is str and body['id'] not in authored,
                 'unique authored body identity')
            authored[body['id']] = body
        states = data['states']
        need(type(states) is list and 1 <= len(states) <= 65, 'bounded actual trajectory')
        initial = states[0]
        need(type(initial) is dict and binary_number(initial.get('stepIndex')) == 0 and
             binary_number(initial.get('timeSeconds')) == 0, 'actual initial cursor')
        need(type(initial.get('bodies')) is list and len(initial['bodies']) == 3, 'three actual initial bodies')
        observed = {}
        for body in initial['bodies']:
            need(type(body) is dict and type(body.get('id')) is str and body['id'] not in observed,
                 'unique observed body identity')
            observed[body['id']] = body
        need(authored.keys() == observed.keys(), 'authored/observed endpoint population')
        violations,checks = [],[]
        with localcontext() as context:
            context.prec = 90
            component_gate = Decimal.from_float(1e-10)
            norm_gate = Decimal.from_float(1e-12)
            for body_id,body in authored.items():
                target = authored_quaternion(body['initial']['orientationXYZW'])
                actual = observed[body_id]['orientationXYZW']
                need(type(actual) is list and len(actual) == 4, 'actual quaternion shape')
                actual = [Decimal.from_float(binary_number(component)) for component in actual]
                positive = max(abs(a-b) for a,b in zip(actual,target))
                negative = max(abs(a+b) for a,b in zip(actual,target))
                error = min(positive,negative)
                norm_error = abs(sum((value*value for value in actual),Decimal(0))-1)
                checks.append({'bodyId':body_id,'componentError':float(error),'squaredNormError':float(norm_error),
                               'physicalSign':1 if positive <= negative else -1})
                if error > component_gate:
                    violations.append({'gate':'initialAuthoredQuaternionComponent','bodyId':body_id,
                                       'residual':float(error),'limit':1e-10})
                if norm_error > norm_gate:
                    violations.append({'gate':'initialActualQuaternionSquaredNorm','bodyId':body_id,
                                       'residual':float(norm_error),'limit':1e-12})
        return {'ok':not violations,'resolved':True,'executionFailure':False,
                'status':'INITIAL_FRAME_CONFIRMED' if not violations else 'PHYSICAL_NO_GO',
                'violations':violations,'checks':checks,
                'certificate':{'caseId':data['caseId'],'initialQuaternionChecks':3,'numericLeaves':leaves,
                               'numericWordsSHA256':hashlib.sha256(bytes.fromhex(packet['numericWordsF64leHex'])).hexdigest(),
                               'scope':'authored versus actual initial physical attitudes only'}}
    except (Invalid,KeyError,TypeError,IndexError,ValueError,OverflowError) as error:
        return {'ok':False,'resolved':False,'executionFailure':True,'status':'INVALID_INPUT',
                'violations':[],'checks':[],'certificate':{},'reason':str(error)}


def numeric_words(value):
    words,nodes = [],0

    def visit(item,depth):
        nonlocal nodes
        nodes += 1
        need(nodes <= 262144 and depth <= 32,'numeric tree bound')
        if type(item) in (int,float):
            need(len(words) < 65536,'512KiB word bound')
            words.append(struct.pack('<d',binary_number(item)))
        elif type(item) is list:
            for entry in item:
                visit(entry,depth+1)
        elif type(item) is dict:
            for entry in item.values():
                visit(entry,depth+1)
    visit(value,0)
    return b''.join(words).hex()


def encoded(value):
    raw = (json.dumps(value,allow_nan=False,separators=(',',':'))+'\n').encode()
    need(len(raw) <= LINE,'2MiB wire cap')
    return raw


def pin(path):
    path = Path(path)
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda:stream.read(65536),b''):
            digest.update(chunk)
    return {'bytes':path.stat().st_size,'sha256':digest.hexdigest()}


def authenticate():
    assert len(PINS) >= 40,'literal source/data/tool pins required'
    for name,expected in PINS.items():
        path = Path(name) if Path(name).is_absolute() else ROOT/name
        assert pin(path) == expected,'PIN:'+name


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out',required=True)
    out = Path(parser.parse_args().out)
    assert out.is_absolute() and out.resolve().is_relative_to(HOME/'evidence')
    out.parent.mkdir(parents=True,exist_ok=True)
    out.mkdir()
    self_pin,deadline = pin(__file__),time.monotonic()+170
    charged,audit_calls,paid_checks,diagnostic_calls = 0,0,0,0
    paid,negatives,diagnostics = [],[],[]
    current,current_wire,first_failure,integrity = 'authenticate',None,None,'NOT_RUN'

    def save(name,raw):
        nonlocal charged
        assert type(raw) is bytes and charged+len(raw) <= CAP,'16MiB evidence cap'
        charged += len(raw)
        with (out/name).open('xb') as stream:
            stream.write(raw)

    def json_save(name,value):
        save(name,(json.dumps(value,allow_nan=False,indent=2)+'\n').encode())

    def check(name,packet,expected='positive',body_id=None,reason=None):
        nonlocal current,current_wire,audit_calls,paid_checks
        current,current_wire = name,encoded(packet)
        assert time.monotonic() < deadline
        save(name+'-request.json',current_wire)
        audit_calls += 1
        reply = audit_packet(packet)
        json_save(name+'-audit.json',reply)
        if expected == 'positive':
            assert reply['ok'] is True and reply['resolved'] is True and reply['executionFailure'] is False
            paid_checks += reply['certificate']['initialQuaternionChecks']
        elif expected == 'physical':
            assert reply['ok'] is False and reply['resolved'] is True and reply['executionFailure'] is False
            assert reply['status'] == 'PHYSICAL_NO_GO'
            assert any(item.get('gate') == 'initialAuthoredQuaternionComponent' and
                       item.get('bodyId') == body_id for item in reply['violations']),'specific authored frame gate'
        else:
            assert reply['ok'] is False and reply['resolved'] is False and reply['executionFailure'] is True
            assert reply['status'] == 'INVALID_INPUT' and reason in reply.get('reason','')
        return {'name':name,'status':reply['status'],'requestSHA256':hashlib.sha256(current_wire).hexdigest(),
                'numericWordsSHA256':hashlib.sha256(bytes.fromhex(packet['numericWordsF64leHex'])).hexdigest(),
                'confirmed':True}

    try:
        assert Path(sys.executable).resolve() == Path(PYTHON).resolve()
        authenticate()
        receipt = json.loads((PAID/'result.json').read_text())
        assert receipt['status'] == 'ANISOTROPIC_PUBLIC_SOURCE_NATIVE_EIGHT_CASES_CONFIRMED'
        assert receipt['failure'] is None and receipt['sourceIntegrity'] == 'PASS'
        json_save('inputs.json',{'pins':PINS,'selfPin':self_pin,'plannedPaidPacketAudits':16,
            'plannedInitialQuaternionChecks':48,'plannedNegativeControls':5,'plannedOldOracleDiagnostics':2,
            'worldCalls':0,'candidateCalls':0,'compilerCalls':0})
        packets = {}
        for graph in ('source','native'):
            report = receipt['reports'][graph]
            assert report['worlds'] == 8 and report['acceptedSteps'] == 212 and report['referenceReplies'] == 8
            for case in CASES:
                raw = (PAID/(graph+'-'+case+'.json')).read_bytes()
                assert len(raw) <= LINE
                packet = json.loads(raw)
                old_reply = json.loads((PAID/(graph+'-'+case+'-reference.stdout')).read_bytes())
                assert old_reply['ok'] is True and old_reply['resolved'] is True and old_reply['executionFailure'] is False
                packets[graph,case] = packet
                paid.append(check('paid-'+graph+'-'+case,packet))
        for case in CASES:
            assert packets['source',case]['numericWordsF64leHex'] == packets['native',case]['numericWordsF64leHex']
        assert len(paid) == 16 and paid_checks == 48
        for graph in ('source','native'):
            packet = copy.deepcopy(packets[graph,'natural-120-64'])
            data,_ = restore(packet['data'],packet['numericWordsF64leHex'])
            for state in data['states']:
                next(body for body in state['bodies'] if body['id'] == 'upper')['orientationXYZW'] = [0,0,0,1]
            packet['data'],packet['numericWordsF64leHex'] = data,numeric_words(data)
            name = graph+'-all-natural-upper-identity'
            negatives.append(check(name,packet,expected='physical',body_id='upper'))
            current,current_wire = name+'-old-oracle-diagnostic',encoded(packet)
            assert time.monotonic() < deadline
            save(current+'-request.json',current_wire)
            diagnostic_calls += 1
            child = subprocess.run([PYTHON,'-B',str(HOME/'public-oracle.py')],input=current_wire,cwd=ROOT,
                stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=max(.01,deadline-time.monotonic()),check=False)
            assert len(child.stdout) <= REPLY and len(child.stderr) <= REPLY
            save(current+'.stdout',child.stdout); save(current+'.stderr',child.stderr)
            assert child.returncode == 0 and not child.stderr and child.stdout.count(b'\n') == 1
            observed = json.loads(child.stdout)
            assert (observed['ok'] is True and observed['resolved'] is True and
                    observed['executionFailure'] is False), 'preserved old relative-frame blind spot'
            diagnostics.append({'graph':graph,'oldOracleStatus':observed['status'],'oldOracleOk':True,
                                'additiveAuditRejected':True,'scope':'PRESERVED_REFERENCE_BLIND_SPOT_NOT_PHYSICAL_PASS'})
        for body_id,name,orientation in (
                ('upper','initial-principal-upper-identity',[0,0,0,1]),
                ('floor','initial-floor-wrong-attitude',[.5,.5,.5,.5])):
            packet = copy.deepcopy(packets['source','principal-spin-120-64'])
            data,_ = restore(packet['data'],packet['numericWordsF64leHex'])
            next(body for body in data['states'][0]['bodies'] if body['id'] == body_id)['orientationXYZW'] = orientation
            packet['data'],packet['numericWordsF64leHex'] = data,numeric_words(data)
            negatives.append(check(name,packet,expected='physical',body_id=body_id))
        packet = copy.deepcopy(packets['source','natural-120-64'])
        raw = bytearray.fromhex(packet['numericWordsF64leHex'])
        at = next(index for index in range(0,len(raw),8) if struct.unpack_from('<d',raw,index)[0] != 0)
        struct.pack_into('<d',raw,at,struct.unpack_from('<d',raw,at)[0]+.125)
        packet['numericWordsF64leHex'] = raw.hex()
        negatives.append(check('wrong-finite-word',packet,expected='invalid',reason='nonzero numeric word mismatch'))
        assert audit_calls == 21 and len(negatives) == 5 and diagnostic_calls == 2
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
        final = {'status':'ANISOTROPIC_INITIAL_FRAME_AUDIT_CONFIRMED' if first_failure is None else 'FIRST_FAILURE',
            'firstFailure':first_failure,'sourceIntegrity':integrity,'paidPacketAudits':len(paid),
            'paidInitialQuaternionChecks':paid_checks,'negativeControls':len(negatives),
            'oldOracleDiagnosticCalls':diagnostic_calls,'auditCalls':audit_calls,
            'paid':paid,'negatives':negatives,'diagnostics':diagnostics,'worldCalls':0,'candidateCalls':0,
            'compilerCalls':0,'captureOrReplayCalls':0,'chargedBeforeFinalReceiptBytes':charged,
            'evidenceCapBytes':CAP,'scope':'ADDITIVE_AUTHORED_INITIAL_FRAME_ONLY_NOT_NEW_PHYSICAL_CASES'}
        json_save('result.json',final)
        print(json.dumps({'status':final['status'],'firstFailure':first_failure,'result':str(out/'result.json')}))
        return 1 if first_failure else 0


if __name__ == '__main__':
    raise SystemExit(main())
