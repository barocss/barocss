#!/usr/bin/env python3
"""One saved binary64 result audit. No solve and no project numerical imports."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import signal
import struct
import sys
from fractions import Fraction

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
MAX_JSON = 1048576


def need(condition, message):
    if not condition:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def file_digest(path):
    result = hashlib.sha256()
    with Path(path).open('rb') as stream:
        while True:
            block = stream.read(65536)
            if not block:
                break
            result.update(block)
    return result.hexdigest()


class PhysicalGateFailure(ValueError):
    def __init__(self, path, detail):
        super().__init__('physical gate ' + path)
        self.detail = detail


def display(value):
    try:
        return float(value)
    except OverflowError:
        return 'OUTSIDE_BINARY64_DISPLAY_RANGE'


class WorkingBound:
    def __init__(self):
        self.peak = 0

    @staticmethod
    def _visit(value, depth, seen, scratch):
        # A class-owned function has no recursive closure cell and no self-cycle.
        need(depth <= 32, 'working graph depth')
        identity = id(value)
        if identity in seen:
            return
        need(scratch['nodes'] < 50000, 'working graph nodes')
        # Before adding an identity, charge old+new set tables at their largest
        # bounded CPython growth (4x new +1x old), owned ID integers and active
        # traversal frames. The 1MiB physical/encoder scratch reserve is separate.
        traversal = (5 * sys.getsizeof(seen) + scratch['identityBytes'] +
                     sys.getsizeof(identity) + 4096 * (depth + 1) + sys.getsizeof(scratch))
        predicted = 1048576 + scratch['payload'] + traversal
        scratch['peak'] = max(scratch['peak'], predicted)
        need(predicted <= 8388608, 'validator8MiB traversal/live working bound')
        seen.add(identity)
        scratch['nodes'] += 1
        scratch['identityBytes'] += sys.getsizeof(identity)
        if type(value) is Fraction:
            bits = value.numerator.bit_length() + value.denominator.bit_length()
            need(max(value.numerator.bit_length(), value.denominator.bit_length()) <= 4096, 'working rational size')
            charge = 2048 + 16 * bits
        elif type(value) is dict:
            charge = 512 + len(value) * 128
        elif type(value) in (list, tuple):
            charge = 256 + len(value) * 32
        elif type(value) is str:
            charge = 256 + len(value) * 24
        elif type(value) is bytes:
            charge = 128 + len(value) * 2
        elif type(value) is int:
            charge = 128 + value.bit_length()
        else:
            charge = 128
        scratch['payload'] += charge
        active = (sys.getsizeof(seen) + scratch['identityBytes'] +
                  4096 * (depth + 1) + sys.getsizeof(scratch))
        total = 1048576 + scratch['payload'] + active
        scratch['peak'] = max(scratch['peak'], total)
        need(total <= 8388608, 'validator8MiB owned live+serialization working bound')
        if type(value) is dict:
            for key, item in value.items():
                WorkingBound._visit(key, depth + 1, seen, scratch)
                WorkingBound._visit(item, depth + 1, seen, scratch)
        elif type(value) in (list, tuple):
            for item in value:
                WorkingBound._visit(item, depth + 1, seen, scratch)

    def check(self, *roots):
        seen = set()
        scratch = {'nodes': 0, 'payload': 0, 'identityBytes': 0, 'peak': 0}
        try:
            for root in roots:
                WorkingBound._visit(root, 0, seen, scratch)
            return scratch['peak']
        finally:
            self.peak = max(self.peak, scratch['peak'])
            # Release on success and exceptions; no cyclic-GC collection needed.
            seen.clear()
            scratch.clear()
            roots = ()
            root = None
            del seen, scratch


def pairs(items):
    result = {}
    for key, value in items:
        need(key not in result, 'duplicate JSON key')
        result[key] = value
    return result


def read_json(path, expected=None, limit=MAX_JSON):
    path = Path(path)
    need(path.stat().st_size <= limit, 'bounded JSON input')
    data = path.read_bytes()
    if expected is not None:
        need(len(data) == expected['bytes'] and digest(data) == expected['sha256'], 'artifact byte/hash mismatch: ' + str(path))
    return json.loads(data, object_pairs_hook=pairs, parse_constant=lambda text: (_ for _ in ()).throw(ValueError('non-JSON number ' + text)))


def authenticate(path, token):
    need(Path(path).stat().st_size <= 4194304, 'bounded parent freeze')
    raw = Path(path).read_bytes()
    need(len(raw) <= 4194304 and digest(raw) == token, 'parent freeze token')
    frozen = json.loads(raw, object_pairs_hook=pairs)
    need(frozen.get('status') == 'PARENT_AUTHORIZED_IMPULSE_CAMPAIGN' and frozen.get('runtimeAuthorized') is True and frozen.get('p5Closed') is True, 'parent execution approval required')
    need(frozen.get('validationRequestLimit') == 26, 'frozen validator population')
    for name in ['candidate.ts', 'oracle.py', 'native-validate.py', 'impulse-run.mjs', 'CONTRACT.md', 'CASES.json', 'RUNNER-PLAN.json', 'RUNNER-AUTHOR-READY.json', 'RUNNER-AUTHORING-FREEZE-01.json', 'AUTHORING-FREEZE-01.json', 'CANDIDATE-AUTHOR-READY.json', 'ORACLE-AUTHOR-READY.json']:
        need(str(HERE.relative_to(ROOT) / name) in frozen['files'], 'missing source pin ' + name)
    for name, pin in frozen['files'].items():
        target = (ROOT / name).resolve()
        need(target.is_relative_to(ROOT), 'source path escape')
        need(target.stat().st_size == pin['bytes'], 'source byte count ' + name)
        need(file_digest(target) == pin['sha256'], 'source SHA ' + name)
    for name, pin in frozen['toolFiles'].items():
        target = Path(name)
        need(target.is_absolute() and target.stat().st_size == pin['bytes'] and file_digest(target) == pin['sha256'], 'tool SHA ' + name)
    need(frozen['highReview']['approved'] is True and frozen['highReview']['path'] in frozen['files'], 'High static review prerequisite')
    need('examples/physics-world-p5-2276/completion-results.json' in frozen['files'], 'P5 record pin')
    need('examples/physics-world-p5-2276/command-run.mjs' in frozen['files'], 'outer guard pin')
    need(Path(sys.executable).resolve() == Path(frozen['tools']['python']).resolve(), 'actual Python provider')
    completion = read_json(ROOT / 'examples/physics-world-p5-2276/completion-results.json')
    need(completion['status'] == 'P5_DONE_BOUNDED_LOCALSELECTED_WITH_RENDERING_SDK_BOUNDARY', 'P5 completion prerequisite')
    return frozen


def binary_fraction(word):
    need(type(word) is str and re.fullmatch('[0-9a-f]{16}', word), 'raw IEEE754 binary64 word')
    bits = struct.unpack('<Q', bytes.fromhex(word))[0]
    exponent, trailing = (bits >> 52) & 2047, bits & ((1 << 52) - 1)
    need(exponent != 2047, 'nonfinite native normal input/output')
    significand = trailing if exponent == 0 else trailing + (1 << 52)
    power = -1074 if exponent == 0 else exponent - 1075
    signed = -significand if bits >> 63 else significand
    return Fraction(signed << power, 1) if power >= 0 else Fraction(signed, 1 << -power)


def decode(value):
    if type(value) is dict:
        if set(value) == {'$f64le'}:
            return binary_fraction(value['$f64le'])
        return {key: decode(item) for key, item in value.items()}
    if type(value) is list:
        return [decode(item) for item in value]
    need(type(value) is str or value is None or type(value) is bool, 'every numeric native field requires raw-word encoding')
    return value


def reference_numbers(value):
    if type(value) is dict:
        if set(value) == {'numerator', 'denominator'}:
            need(all(type(value[k]) is str and len(value[k]) <= 1300 for k in value), 'reference integer bound')
            result = Fraction(int(value['numerator']), int(value['denominator']))
            need(max(result.numerator.bit_length(), result.denominator.bit_length()) <= 4096, 'reference rational bound')
            return result
        return {key: reference_numbers(item) for key, item in value.items()}
    if type(value) is list:
        return [reference_numbers(item) for item in value]
    return value


def pack(value):
    if type(value) is Fraction:
        need(max(value.numerator.bit_length(), value.denominator.bit_length()) <= 4096, 'audited rational output bound')
        return {'numerator': str(value.numerator), 'denominator': str(value.denominator)}
    if type(value) is dict:
        return {key: pack(item) for key, item in value.items()}
    if type(value) is list:
        return [pack(item) for item in value]
    return value


def vadd(a, b):
    return [a[i] + b[i] for i in range(3)]


def vsub(a, b):
    return [a[i] - b[i] for i in range(3)]


def vmul(scalar, vector):
    return [scalar * item for item in vector]


def inner(a, b):
    return sum((a[i] * b[i] for i in range(3)), Fraction(0))


def vector_product(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def apply_tensor(tensor, vector):
    return [inner(row, vector) for row in tensor]


def physical(state):
    point, body = state['point'], state['rigid']
    rotation, moments = body['rotationBodyToWorld'], body['principalInertiaKgM2']
    tensor = [[sum((rotation[i][k] * moments[k] * rotation[j][k] for k in range(3)), Fraction(0)) for j in range(3)] for i in range(3)]
    p_point = vmul(point['massKg'], point['velocityMps'])
    p_body = vmul(body['massKg'], body['velocityMps'])
    spin = apply_tensor(tensor, body['angularVelocityRadps'])
    angular = vadd(vadd(vector_product(point['positionM'], p_point), vector_product(body['comPositionM'], p_body)), spin)
    energy = (inner(point['velocityMps'], p_point) + inner(body['velocityMps'], p_body) + inner(body['angularVelocityRadps'], spin)) / 2
    arm = apply_tensor(rotation, body['endpoint']['anchorLocalM'])
    relative = vsub(vsub(point['velocityMps'], body['velocityMps']), vector_product(body['angularVelocityRadps'], arm))
    return {'tensor': tensor, 'pointMomentum': p_point, 'bodyMomentum': p_body, 'spin': spin,
            'linear': vadd(p_point, p_body), 'angular': angular, 'energy': energy, 'arm': arm, 'relative': relative}


def at(tree, dotted):
    for part in dotted.split('.'):
        tree = tree[part]
    return tree


def validate(before, after, ideal, raw_ideal, ideal_arm, memory, owned_roots):
    epsilon = Fraction(1, 10 ** 12)
    checks, peak = [], {'ratio': Fraction(0), 'path': None}
    memory.check(owned_roots, before, after, ideal, raw_ideal)

    def gate(path, actual, expected, scale=None):
        if type(expected) is list:
            need(type(actual) is list and len(actual) == len(expected), 'component shape ' + path)
            for i, value in enumerate(expected):
                item_scale = scale[i] if type(scale) is list else scale
                gate(path + '[' + str(i) + ']', actual[i], value, item_scale)
            return
        need(type(actual) is Fraction and type(expected) is Fraction, 'rational component ' + path)
        bound = epsilon + epsilon * (abs(expected) if scale is None else scale)
        error = actual - expected
        ratio = abs(error) / bound
        check = {'path': path, 'actual': actual, 'idealOrTarget': expected, 'signedError': error, 'bound': bound,
                 'errorDisplay': display(error), 'boundDisplay': display(bound), 'pass': abs(error) <= bound}
        checks.append(check)
        if ratio > peak['ratio']:
            peak.update(ratio=ratio, path=path)
        need(len(checks) <= 256, 'finite component check count')
        memory.check(owned_roots, before, after, ideal, raw_ideal, checks, peak)
        if not check['pass']:
            raise PhysicalGateFailure(path, {'checks': checks, 'peakBoundRatio': peak})

    def invariant(path, actual, expected, before_scale, after_scale):
        if type(expected) is list:
            for i in range(len(expected)):
                invariant(path + '[' + str(i) + ']', actual[i], expected[i], before_scale[i], after_scale[i])
        else:
            gate(path, actual, expected, max(Fraction(1), abs(before_scale), abs(after_scale)))

    mapping = {
        'point.velocityMps': 'velocityPointMps', 'rigid.velocityMps': 'velocityRigidMps',
        'rigid.angularVelocityRadps': 'angularVelocityRigidRadps',
        'report.pointLinearImpulseNs': 'impulseOnClothNs', 'report.rigidLinearImpulseNs': 'linearImpulseOnRigidNs',
        'report.rigidAngularImpulseNms': 'angularImpulseOnRigidNms',
        'report.relativeVelocityBeforeMps': 'relativeVelocityBeforeMps', 'report.relativeVelocityAfterMps': 'relativeVelocityAfterMps',
        'report.kineticEnergyBeforeJ': 'kineticEnergyBeforeJ', 'report.kineticEnergyAfterJ': 'kineticEnergyAfterJ',
        'report.dissipatedEnergyJ': 'dissipatedEnergyJ',
    }
    for output_path, ideal_key in mapping.items():
        gate(output_path, at(after, output_path), ideal[ideal_key])
    first, last = physical(before), physical(after)
    point_impulse = vsub(last['pointMomentum'], first['pointMomentum'])
    rigid_impulse = vsub(last['bodyMomentum'], first['bodyMomentum'])
    spin_impulse = vsub(last['spin'], first['spin'])
    for name, actual, key in [('point', point_impulse, 'impulseOnClothNs'), ('rigid', rigid_impulse, 'linearImpulseOnRigidNs'), ('angular', spin_impulse, 'angularImpulseOnRigidNms')]:
        gate('stateDerivedImpulse.' + name, actual, ideal[key])
    zero = [Fraction(0)] * 3
    invariant('linearMomentum.before', first['linear'], ideal['linearMomentumBeforeKgMps'], ideal['linearMomentumBeforeKgMps'], ideal['linearMomentumAfterKgMps'])
    invariant('linearMomentum.after', last['linear'], ideal['linearMomentumAfterKgMps'], ideal['linearMomentumBeforeKgMps'], ideal['linearMomentumAfterKgMps'])
    invariant('linearMomentum.balance', vsub(last['linear'], first['linear']), zero, ideal['linearMomentumBeforeKgMps'], ideal['linearMomentumAfterKgMps'])
    invariant('angularMomentum.before', first['angular'], ideal['angularMomentumBeforeKgM2ps'], ideal['angularMomentumBeforeKgM2ps'], ideal['angularMomentumAfterKgM2ps'])
    invariant('angularMomentum.after', last['angular'], ideal['angularMomentumAfterKgM2ps'], ideal['angularMomentumBeforeKgM2ps'], ideal['angularMomentumAfterKgM2ps'])
    invariant('angularMomentum.balance', vsub(last['angular'], first['angular']), zero, ideal['angularMomentumBeforeKgM2ps'], ideal['angularMomentumAfterKgM2ps'])
    gate('actualRelative.before', first['relative'], ideal['relativeVelocityBeforeMps'])
    invariant('actualRelative.after', last['relative'], zero, ideal['relativeVelocityBeforeMps'], ideal['relativeVelocityAfterMps'])
    gate('actualEnergy.before', first['energy'], ideal['kineticEnergyBeforeJ'])
    gate('actualEnergy.after', last['energy'], ideal['kineticEnergyAfterJ'])
    delta = last['energy'] - first['energy']
    # Work uses actual state-derived momenta and average velocities, never reported J.
    work = (inner(vadd(before['point']['velocityMps'], after['point']['velocityMps']), point_impulse) +
            inner(vadd(before['rigid']['velocityMps'], after['rigid']['velocityMps']), rigid_impulse) +
            inner(vadd(before['rigid']['angularVelocityRadps'], after['rigid']['angularVelocityRadps']), spin_impulse)) / 2
    dvp = vsub(after['point']['velocityMps'], before['point']['velocityMps'])
    dvb = vsub(after['rigid']['velocityMps'], before['rigid']['velocityMps'])
    dwo = vsub(after['rigid']['angularVelocityRadps'], before['rigid']['angularVelocityRadps'])
    objective = (inner(dvp, point_impulse) + inner(dvb, rigid_impulse) + inner(dwo, spin_impulse)) / 2
    energy_before, energy_after = ideal['kineticEnergyBeforeJ'], ideal['kineticEnergyAfterJ']
    for name, actual, target in [('change', delta, ideal['kineticChangeJ']), ('work', work, ideal['constraintImpulseWorkJ']), ('dissipated', -delta, ideal['dissipatedEnergyJ']), ('objective', objective, ideal['minimumMassMetricObjectiveJ'])]:
        invariant('actualEnergy.' + name, actual, target, energy_before, energy_after)
    invariant('workMinusKineticChange', work - delta, Fraction(0), energy_before, energy_after)
    invariant('objectivePlusKineticChange', objective + delta, Fraction(0), energy_before, energy_after)
    for name, actual, reported, key in [('point', point_impulse, after['report']['pointLinearImpulseNs'], 'impulseOnClothNs'), ('rigid', rigid_impulse, after['report']['rigidLinearImpulseNs'], 'linearImpulseOnRigidNs'), ('angular', spin_impulse, after['report']['rigidAngularImpulseNms'], 'angularImpulseOnRigidNms')]:
        gate('reportMinusStateImpulse.' + name, reported, actual)
    invariant('oppositeLinearReactions', vadd(after['report']['pointLinearImpulseNs'], after['report']['rigidLinearImpulseNs']), zero, ideal['impulseOnClothNs'], ideal['linearImpulseOnRigidNs'])
    invariant('torqueSign', vsub(after['report']['rigidAngularImpulseNms'], vector_product(first['arm'], after['report']['rigidLinearImpulseNs'])), zero, ideal['angularImpulseOnRigidNms'], ideal['angularImpulseOnRigidNms'])
    invariant('reportedRelative.before', vsub(after['report']['relativeVelocityBeforeMps'], first['relative']), zero, ideal['relativeVelocityBeforeMps'], ideal['relativeVelocityBeforeMps'])
    invariant('reportedRelative.after', vsub(after['report']['relativeVelocityAfterMps'], last['relative']), zero, ideal['relativeVelocityBeforeMps'], ideal['relativeVelocityAfterMps'])
    for key, actual in [('kineticEnergyBeforeJ', first['energy']), ('kineticEnergyAfterJ', last['energy']), ('dissipatedEnergyJ', -delta)]:
        gate('reportedEnergy.' + key, after['report'][key], actual)
    gate('worldAnchorArmM.ideal', after['report']['worldAnchorArmM'], ideal_arm)
    gate('worldAnchorArmM.actualInput', after['report']['worldAnchorArmM'], first['arm'])
    need(-delta >= -(epsilon + epsilon * max(Fraction(1), abs(energy_before), abs(energy_after))), 'negative dissipated energy')
    rounding = []

    def rounding_walk(native, literal, path=''):
        if type(native) is dict:
            for key, value in native.items():
                rounding_walk(value, literal[key], path + '/' + key)
        elif type(native) is list:
            for i, value in enumerate(native):
                rounding_walk(value, literal[i], path + '/' + str(i))
        elif type(native) is Fraction:
            target = Fraction(literal)
            rounding.append({'path': path, 'nativeMinusIdeal': native - target})
    rounding_walk(before, raw_ideal)
    memory.check(owned_roots, before, after, ideal, raw_ideal, checks, peak, first, last, rounding)
    return {'checks': checks, 'peakBoundRatio': peak, 'inputRounding': rounding, 'computed': {'linearBefore': first['linear'], 'linearAfter': last['linear'], 'angularBefore': first['angular'], 'angularAfter': last['angular'], 'energyBeforeJ': first['energy'], 'energyAfterJ': last['energy'], 'workJ': work, 'massMetricObjectiveJ': objective}, 'signedZeroAuthority': 'Fraction treats both zero signs as numerical zero; raw source/native sign gates belong to runner'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--request', required=True, type=Path)
    parser.add_argument('--request-sha256', required=True)
    parser.add_argument('--freeze', required=True, type=Path)
    parser.add_argument('--token', required=True)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError('validator deadline')))
    signal.setitimer(signal.ITIMER_REAL, 5)
    need(args.out.resolve().parent == args.request.resolve().parent and args.out.resolve().is_relative_to(HERE / 'evidence') and not args.out.exists(), 'fresh owned result path')
    memory = WorkingBound()
    raw, request, artifacts, detail = b'', {}, {}, None
    result = {'status': 'FAIL', 'linearSolves': 0, 'candidateCalls': 0, 'referenceCalls': 0, 'WorldCalls': 0, 'firstFailure': None}
    try:
        authenticate(args.freeze, args.token)
        need(args.request.stat().st_size <= 65536, 'bounded request')
        raw = args.request.read_bytes()
        need(len(raw) <= 65536 and digest(raw) == args.request_sha256, 'request token')
        request = json.loads(raw, object_pairs_hook=pairs)
        need(request['executionFreezeSha256'] == args.token and request['graph'] in ['source', 'native'], 'request provenance')
        need(1 <= request['validationOrdinal'] <= 26, 'validation ordinal')
        campaign = args.request.resolve().parent
        need(args.out.resolve().parent == campaign and not args.out.exists(), 'fresh result in owned request directory')
        artifacts = {}
        for name in ['input', 'output', 'oracleReply', 'oracleSummary']:
            pin = request[name]
            target = Path(pin['path']).resolve()
            need(target.is_relative_to(HERE / 'evidence'), 'artifact outside owned evidence')
            artifacts[name] = read_json(target, pin)
        summary, reply = artifacts['oracleSummary'], artifacts['oracleReply']
        need(summary['status'] == 'PASS_INDEPENDENT_IMPULSE_ORACLE', 'oracle PASS prerequisite')
        need(summary['counts']['requestsReturned'] == 23 and summary['counts']['acceptedReferences'] == 13, 'oracle count prerequisite')
        matching = [p for p in summary['replies'] if p['path'] == request['caseId'] + '.reply.json']
        need(len(matching) == 1 and matching[0]['sha256'] == request['oracleReply']['sha256'] and matching[0]['bytes'] == request['oracleReply']['bytes'], 'saved oracle reply authority')
        need(reply['status'] == 'ACCEPTED_REFERENCE' and reply['caseId'] == request['caseId'], 'normal oracle case')
        result.update(caseId=request['caseId'], graph=request['graph'], validationOrdinal=request['validationOrdinal'], provenance={'freezeSha256': args.token, 'requestSha256': args.request_sha256, 'inputSha256': request['input']['sha256'], 'outputSha256': request['output']['sha256'], 'oracleReplySha256': request['oracleReply']['sha256']})
        memory.check(raw, request, artifacts)
        detail = validate(decode(artifacts['input']), decode(artifacts['output']), reference_numbers(reply['reference']['fraction']['values']), reply['rawIdealInput'], reference_numbers(reply['reference']['fraction']['worldArmM']), memory, [raw, request, artifacts])
        result.update(status='PASS_NATIVE_F64_PHYSICAL_AUDIT', **detail)
    except BaseException as error:
        result['firstFailure'] = {'type': type(error).__name__, 'message': str(error)[:2048]}
        if isinstance(error, PhysicalGateFailure):
            result['failedPhysicalChecks'] = error.detail
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
    result['workingData'] = {'peakOwnedLiveAndSerializationChargeBytes': memory.peak, 'limitBytes': 8388608, 'chargeModel': 'owned live payload and serialization; not process heap', 'RSSClaim': False}
    memory.check(raw, request, artifacts, detail, result)
    data = (json.dumps(pack(result), separators=(',', ':'), allow_nan=False) + '\n').encode()
    need(len(data) <= 262144, 'validator evidence bound')
    with args.out.open('xb') as stream:
        stream.write(data)
    print(json.dumps({'status': result['status'], 'caseId': result.get('caseId'), 'linearSolves': 0, 'firstFailure': result['firstFailure']}, separators=(',', ':')))
    return 0 if result['status'] == 'PASS_NATIVE_F64_PHYSICAL_AUDIT' else 1


if __name__ == '__main__':
    sys.exit(main())
