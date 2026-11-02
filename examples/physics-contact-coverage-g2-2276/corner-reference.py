#!/usr/bin/env python3
"""Files-only necessary sphere/box contact witness; no Physics imports."""
import argparse
import hashlib
import json
from pathlib import Path
import signal
import struct
import sys
import time
from fractions import Fraction

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
MIB = 1048576
COUNTS = {'witnessAuditsAttempted': 0, 'witnessAuditsReturned': 0,
          'fractionOperations': 0, 'rawNumberDecodes': 0,
          'World': 0, 'PhysicsImports': 0, 'helperCalls': 0, 'sqrt': 0, 'trig': 0,
          'odeOrLinearSolve': 0}
OWNERS = {'counts': COUNTS}
EVIDENCE = {'capturedNonBuildBytes': 0, 'witnessBytes': 0}


def need(value, message):
    if not value:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def memory(extra=0):
    seen = set()
    def visit(value, depth=0):
        need(depth <= 32 and len(seen) <= 8192, 'owned graph bound')
        key = id(value)
        if key in seen:
            return 0
        seen.add(key)
        result = sys.getsizeof(value)
        if type(value) is dict:
            result += sum(visit(k, depth + 1) + visit(v, depth + 1) for k, v in value.items())
        elif type(value) in (list, tuple):
            result += sum(visit(v, depth + 1) for v in value)
        elif type(value) is Fraction:
            result += sys.getsizeof(value.numerator) + sys.getsizeof(value.denominator)
        return result
    try:
        # <=8192 visited IDs/set growth/depth32 frames, JSON encoder/scalar
        # scratch and <=65536B hash/read blocks. Decoder/encoder payloads
        # are precharged separately. No process/tool heap or RSS claim.
        bound = visit(OWNERS) + 2 * MIB + extra
        need(bound <= 8 * MIB, '8MiB logical witness working bound')
        return bound
    finally:
        seen.clear()
        visit = None


def lexical_bound(data):
    nodes = depth = strings = 0
    quoted = escaped = bare = False
    for c in data:
        if quoted:
            strings += 1
            if escaped: escaped = False
            elif c == 92: escaped = True
            elif c == 34: quoted = False
        elif c == 34:
            nodes += 1; quoted = True; bare = False
        elif c in (123, 91):
            nodes += 1; depth += 1; bare = False
        elif c in (125, 93): depth -= 1; bare = False
        elif c in (9, 10, 13, 32, 44, 58): bare = False
        elif not bare: nodes += 1; bare = True
        need(nodes <= 8192 and 0 <= depth <= 32, 'bounded JSON lexical graph')
    need(not quoted and depth == 0, 'complete JSON envelope')
    return 512 * nodes + 4 * strings + 4 * len(data) + 131072


def unique(rows):
    result = {}
    for key, value in rows:
        need(key not in result, 'duplicate JSON key')
        result[key] = value
    return result


def read_json(path, key, cap, pin=None):
    path = Path(path).resolve()
    need(path.is_relative_to(ROOT) and path.stat().st_size <= cap, 'owned bounded input')
    data = path.read_bytes()
    OWNERS['activeReadBytes'] = data
    if pin:
        need(set(pin) == {'path', 'bytes', 'sha256'} and type(pin['path']) is str and len(pin['path']) <= 4096 and
             type(pin['bytes']) is int and 0 <= pin['bytes'] <= cap and type(pin['sha256']) is str and
             len(pin['sha256']) == 64 and all(c in '0123456789abcdef' for c in pin['sha256']), 'fixed artifact pin schema')
        need(str(path) == pin['path'] and len(data) == pin['bytes'] and digest(data) == pin['sha256'], 'input byte/hash binding')
    memory(lexical_bound(data))
    value = json.loads(data, object_pairs_hook=unique,
                       parse_constant=lambda _: (_ for _ in ()).throw(ValueError('non-JSON numeric constant')))
    OWNERS[key] = value
    OWNERS.pop('activeReadBytes')
    memory()
    return value


def file_pin(path, expected=None):
    path = Path(path).resolve()
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''):
            h.update(block)
    result = {'path': str(path), 'bytes': path.stat().st_size, 'sha256': h.hexdigest()}
    if expected:
        need(result == expected, 'full artifact/source/tool pin')
    return result


def checked(value):
    need(max(value.numerator.bit_length(), value.denominator.bit_length()) <= 4096, 'stored rational bit ceiling')
    return value


def operation(kind, a, b):
    COUNTS['fractionOperations'] += 1
    need(COUNTS['fractionOperations'] <= 1000, '1000 rational operation ceiling')
    checked(a); checked(b)
    need(max(a.numerator.bit_length() + b.denominator.bit_length(),
             b.numerator.bit_length() + a.denominator.bit_length(),
             a.denominator.bit_length() + b.denominator.bit_length(),
             a.numerator.bit_length() + b.numerator.bit_length()) <= 8192, 'bounded operation products/sum8193')
    if kind == 'add': return checked(a + b)
    if kind == 'sub': return checked(a - b)
    if kind == 'mul': return checked(a * b)
    if kind == 'le': return a <= b
    raise ValueError('unknown arithmetic operation')


def decode(value):
    if type(value) is dict:
        if '$f64le' in value:
            need(set(value) == {'$f64le'} and type(value['$f64le']) is str and len(value['$f64le']) == 16 and
                 all(c in '0123456789abcdef' for c in value['$f64le']), 'exact raw F64LE number')
            COUNTS['rawNumberDecodes'] += 1
            word = struct.unpack('<Q', bytes.fromhex(value['$f64le']))[0]
            exponent, trailing = (word >> 52) & 2047, word & ((1 << 52) - 1)
            need(exponent != 2047, 'finite captured number')
            significand = trailing if exponent == 0 else trailing + (1 << 52)
            if word >> 63: significand = -significand
            power = -1074 if exponent == 0 else exponent - 1075
            return checked(Fraction(significand << power) if power >= 0 else Fraction(significand, 1 << -power))
        return {k: decode(v) for k, v in value.items()}
    if type(value) is list: return [decode(v) for v in value]
    need(type(value) in (str, bool) or value is None, 'physical numeric values require raw words')
    return value


def closest_witness(center, box_center, half, radius):
    COUNTS['witnessAuditsAttempted'] += 1
    need(COUNTS['witnessAuditsAttempted'] <= 2, 'two audits per graph; four global maximum')
    closest, gaps, squared = [], [], Fraction(0)
    for c, origin, extent in zip(center, box_center, half):
        local = operation('sub', c, origin)
        lower = operation('sub', Fraction(0), extent)
        nearest = lower if operation('le', local, lower) else extent if operation('le', extent, local) else local
        gap = operation('sub', local, nearest)
        closest.append(operation('add', origin, nearest)); gaps.append(gap)
        squared = operation('add', squared, operation('mul', gap, gap))
    tolerance = Fraction(1, 1000000000000)
    enlarged = operation('add', radius, tolerance)
    bound = operation('mul', enlarged, enlarged)
    result = {'centerM': center, 'closestPointM': closest, 'coordinateGapsM': gaps,
              'distanceSquaredM2': squared, 'necessaryContactSquaredBoundM2': bound,
              'contactDistanceToleranceM': tolerance, 'necessaryContactWithinTolerance': operation('le', squared, bound)}
    COUNTS['witnessAuditsReturned'] += 1
    return result


def pack(value):
    if type(value) is Fraction:
        return {'numerator': str(value.numerator), 'denominator': str(value.denominator)}
    if type(value) is dict: return {k: pack(v) for k, v in value.items()}
    if type(value) in (list, tuple): return [pack(v) for v in value]
    return value


def save(out, name, value):
    OWNERS['activeResult'] = value
    # Fixed schema <=512 output nodes and <=128 rational leaves, each
    # <=1300-character numerator/denominator. Precharge packed containers,
    # strings and concurrent ASCII/UTF8 copies before encoding.
    memory(2 * MIB)
    packed = pack(value); OWNERS['packedResult'] = packed
    data = (json.dumps(packed, ensure_ascii=True, allow_nan=False, separators=(',', ':')) + '\n').encode('ascii')
    OWNERS['serializedResult'] = data
    need(len(data) <= 65536, 'bounded witness receipt')
    reserve = 0 if name == 'first-failure.json' else 8192
    need(EVIDENCE['capturedNonBuildBytes'] + EVIDENCE['witnessBytes'] + len(data) + reserve <= MIB,
         'combined capture/witness1MiB evidence ceiling')
    memory()
    path = out / name
    with path.open('xb') as stream: stream.write(data)
    EVIDENCE['witnessBytes'] += len(data)
    for key in ('activeResult', 'packedResult', 'serializedResult'): OWNERS.pop(key)
    return file_pin(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ('freeze', 'token', 'out'): parser.add_argument('--' + key, required=True)
    args = parser.parse_args()
    started = time.monotonic_ns()
    signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError('30s witness deadline')))
    signal.setitimer(signal.ITIMER_REAL, 30)
    out = None
    try:
        freeze_path = Path(args.freeze).resolve()
        need(freeze_path.stat().st_size <= 262144 and file_pin(freeze_path)['sha256'] == args.token, 'explicit parent token')
        freeze = read_json(freeze_path, 'freeze', 262144)
        need(freeze['status'] == 'PARENT_AUTHORIZED_G2_CORNER_CAPTURE' and freeze['runtimeAuthorized'] is True and
             freeze['WorldAuthorized'] is False and freeze['graph'] in ('source', 'native'), 'bounded geometry-only authorization')
        need(Path(freeze['tools']['python']).resolve() == Path(sys.executable).resolve() and
             str(Path(freeze['tools']['python'])) in freeze['toolFiles'], 'actual pinned Python')
        for name, pin in freeze['files'].items():
            path = (ROOT / name).resolve(); need(path.is_relative_to(ROOT), 'owned source path'); file_pin(path, {'path': str(path), **pin})
        for name, pin in freeze['toolFiles'].items(): file_pin(name, {'path': str(Path(name).resolve()), **pin})
        for name in ('CORNER-PROPOSAL-01.json', 'CORNER-INPUT-01.json', 'corner-capture.mjs', 'corner-reference.py', 'CORNER-REVIEW-01.md'):
            need(str(HERE.relative_to(ROOT) / name) in freeze['files'], 'complete witness provider pin')
        need(freeze['highReview']['approved'] is True and freeze['highReview']['path'] in freeze['files'], 'High geometry review pin')
        out = Path(args.out).resolve(); need(out.is_relative_to(HERE / 'evidence'), 'owned fresh output')
        out.mkdir(parents=True, exist_ok=False)
        summary = read_json(freeze['captureSummary']['path'], 'captureSummary', 65536, freeze['captureSummary'])
        capture_directory = Path(freeze['captureSummary']['path']).resolve().parent
        for path in capture_directory.iterdir():
            need(path.is_file() and not path.is_symlink(), 'fixed flat capture directory')
            if path.name not in ('entry.mjs', 'capture-provider.mjs', 'metafile.json'):
                EVIDENCE['capturedNonBuildBytes'] += path.stat().st_size
        need(summary['status'] == 'CAPTURE_COMPLETE_NOT_PHYSICS_PASS' and summary['firstFailure'] is None and
             summary['graph'] == freeze['graph'] and summary['World'] == 0, 'successful bound capture prerequisite')
        capture_pin = summary['capture']
        capture = read_json(capture_pin['path'], 'capture', 65536, capture_pin)
        need(capture['graph'] == freeze['graph'], 'capture graph binding')
        input_pin = capture['input']
        raw_input = read_json(input_pin['path'], 'inputRaw', 65536, input_pin)
        provider = capture['provider']; need(provider['bytes'] <= 524288, 'single provider bound'); file_pin(provider['path'], provider)
        expected = {'admitModelAttempts': 1, 'admitModelReturns': 1, 'admitCcdAttempts': 1,
                    'admitCcdReturns': 1, 'sweepSphereAttempts': 1, 'sweepSphereReturns': 1, 'World': 0}
        for key, count in expected.items(): need(capture['counts'][key] == summary['counts'][key] == count, 'actual capture ledger')
        pair = decode(raw_input); OWNERS['decodedInput'] = pair
        model = pair['model']; need(len(model['bodies']) == len(model['colliders']) == 2 and not model['joints'], 'frozen two-body profile')
        sphere, box = model['bodies']; sphere_shape, box_shape = model['colliders']
        need(sphere['id'] == 'sphere' and sphere['kind'] == 'dynamic' and box['id'] == 'fixture' and box['kind'] == 'static', 'direct endpoint roles')
        need(sphere_shape['bodyId'] == sphere['id'] and sphere_shape['geometry']['kind'] == 'sphere' and
             box_shape['bodyId'] == box['id'] and box_shape['geometry']['kind'] == 'box', 'shape roles')
        need(len(sphere['initial']['positionM']) == len(box['initial']['positionM']) == len(pair['candidateEndM']) == 3,
             'three-dimensional endpoint positions')
        identity = [Fraction(0), Fraction(0), Fraction(0), Fraction(1)]
        need(box['initial']['orientationXYZW'] == identity and all(x == 0 for x in box_shape['local']['positionM']) and
             box_shape['local']['orientationXYZW'] == identity, 'identity box and local collider')
        radius, half = sphere_shape['geometry']['radiusM'], box_shape['geometry']['halfExtentsM']
        need(not operation('le', radius, Fraction(0)) and len(half) == 3 and
             all(not operation('le', x, Fraction(0)) for x in half), 'positive frozen geometry')
        hit = decode(capture['hit']); OWNERS['decodedHit'] = hit
        result = {'graph': freeze['graph'], 'input': input_pin, 'capture': capture_pin,
                  'captureSummary': freeze['captureSummary'], 'authoritySha256': args.token,
                  'scope': 'Necessary exact-contact witness only; not World/contact response or complete CCD correctness.',
                  'computedZeroSignAuthority': False}
        if hit is None:
            result.update(status='EXACT_CONTACT_WITNESS_UNRESOLVED_NO_HIT', firstFailure='No returned hit to audit; no new solver or trajectory claim.')
        else:
            need(hit['bodyId'] == 'sphere' and hit['fixtureId'] == 'fixture', 'hit endpoint roles')
            fraction = hit['toiFraction']; need(operation('le', Fraction(0), fraction) and operation('le', fraction, Fraction(1)), 'fraction domain0..1')
            start, end = sphere['initial']['positionM'], pair['candidateEndM']
            center = [operation('add', a, operation('mul', fraction, operation('sub', b, a))) for a, b in zip(start, end)]
            report = closest_witness(center, box['initial']['positionM'], half, radius)
            result['fractionWitness'] = {'toiFraction': fraction, **report}
            if report['necessaryContactWithinTolerance']:
                stopped = decode(capture['stoppedCandidate']); OWNERS['decodedStoppedCandidate'] = stopped
                need(len(stopped['positionM']) == 3, 'three-dimensional biased stop')
                result['biasedStopDiagnostic'] = closest_witness(stopped['positionM'], box['initial']['positionM'], half, radius)
                result.update(status='NECESSARY_CONTACT_WITNESS_PASS_ONLY', firstFailure=None)
            else:
                result.update(status='EXACT_CONTACT_WITNESS_NO_GO_CONSERVATIVE_BOUND',
                              firstFailure='Returned fraction is not within radius+1e-12m of the identity box. This does not show tunnelling or refute an explicitly conservative broad-phase guarantee.',
                              biasedStopDiagnostic='NOT_RUN_AFTER_FIRST_FAILURE')
        result.update(counts=dict(COUNTS), elapsedNs=time.monotonic_ns() - started, physicalWorldPASS=False,
                      sqrtOrTrigOrOde=False, heapOrRssClaim=False)
        OWNERS['result'] = result
        save(out, 'witness.json', result)
        print(json.dumps({'status': result['status'], 'counts': COUNTS, 'receipt': str(out / 'witness.json')}))
        return 0 if result['status'] == 'NECESSARY_CONTACT_WITNESS_PASS_ONLY' else 1
    except BaseException as error:
        signal.setitimer(signal.ITIMER_REAL, 4)
        failure = {'status': 'CORNER_REFERENCE_FAILURE', 'graph': OWNERS.get('freeze', {}).get('graph'),
                   'counts': dict(COUNTS), 'firstFailure': {'type': type(error).__name__, 'message': str(error)[:2048]}, 'World': 0}
        if out is not None:
            try: save(out, 'first-failure.json', failure)
            except BaseException as receipt_error: failure['receiptFailure'] = str(receipt_error)[:512]
        print(json.dumps(failure)); return 1
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)


if __name__ == '__main__':
    sys.exit(main())
