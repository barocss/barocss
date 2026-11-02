#!/usr/bin/env python3
"""Classify a closed G1 baseline from raw files. No World or production imports."""
import argparse
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import signal
import struct
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent


class ReferenceFailure(Exception):
    pass


def require(value, message):
    if not value:
        raise ReferenceFailure(message)


def file_sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''):
            digest.update(block)
    return digest.hexdigest()


def strict_pairs(items):
    output = {}
    for key, value in items:
        require(key not in output, 'duplicate JSON key')
        output[key] = value
    return output


def load(path, pin=None, limit=262144):
    path = Path(path)
    require(path.stat().st_size <= limit, 'bounded input ' + str(path))
    raw = path.read_bytes()
    if pin:
        require(len(raw) == pin['bytes'] and hashlib.sha256(raw).hexdigest() == pin['sha256'], 'input hash ' + str(path))
    return json.loads(raw, object_pairs_hook=strict_pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(ReferenceFailure('non-JSON numeric token')))


def authenticate(path, token):
    require(Path(path).stat().st_size <= 262144, 'bounded freeze')
    raw = Path(path).read_bytes()
    require(hashlib.sha256(raw).hexdigest() == token, 'parent token')
    freeze = json.loads(raw, object_pairs_hook=strict_pairs)
    require(freeze['status'] == 'PARENT_AUTHORIZED_G1_BASELINE_CHARACTERIZATION' and freeze['mode'] == 'BASELINE_CHARACTERIZATION_ONLY' and freeze['runtimeAuthorized'] is True and freeze['futureRepairAuthorized'] is False, 'baseline-only permission')
    for name in ['CONTRACT.md', 'CASES.json', 'AUTHORING-FREEZE-01.json', 'PROVIDER-IDENTITY-CLARIFICATION-01.json', 'INTEGRATION-AUDIT.md', 'baseline.mjs', 'baseline-classify.py', 'BASELINE-PLAN.json', 'BASELINE-AUTHOR-READY.json']:
        require(str(HERE.relative_to(ROOT) / name) in freeze['files'], 'required authority ' + name)
    for name, pin in freeze['files'].items():
        target = (ROOT / name).resolve()
        require(target.is_relative_to(ROOT) and target.stat().st_size == pin['bytes'] and file_sha(target) == pin['sha256'], 'frozen source ' + name)
    for name, pin in freeze['toolFiles'].items():
        target = Path(name)
        require(target.is_absolute() and target.stat().st_size == pin['bytes'] and file_sha(target) == pin['sha256'], 'frozen tool ' + name)
    require(Path(sys.executable).resolve() == Path(freeze['tools']['python']).resolve(), 'actual Python provider')
    require(freeze['highReview']['approved'] is True and freeze['highReview']['path'] in freeze['files'], 'independent review pin')
    return freeze


def decode_word(text):
    require(type(text) is str and len(text) == 16 and all(c in '0123456789abcdef' for c in text), 'F64LE word')
    word = struct.unpack('<Q', bytes.fromhex(text))[0]
    exponent, trailing = (word >> 52) & 2047, word & ((1 << 52) - 1)
    require(exponent != 2047, 'finite observed F64')
    significand = trailing if exponent == 0 else trailing + (1 << 52)
    power = -1074 if exponent == 0 else exponent - 1075
    if word >> 63:
        significand = -significand
    return Fraction(significand << power, 1) if power >= 0 else Fraction(significand, 1 << -power)


def decode(value):
    if type(value) is dict:
        if set(value) == {'$f64le'}:
            return decode_word(value['$f64le'])
        return {key: decode(item) for key, item in value.items()}
    if type(value) is list:
        return [decode(item) for item in value]
    require(type(value) in (str, bool) or value is None, 'raw numeric word required')
    return value


class Arithmetic:
    def __init__(self, counts):
        self.counts = counts

    def checked(self, value):
        require(max(value.numerator.bit_length(), value.denominator.bit_length()) <= 4096, 'stored Fraction4096bit bound')
        return value

    def operation(self):
        self.counts['fractionScalarOperations'] += 1
        require(self.counts['fractionScalarOperations'] <= 10000, 'Fraction10000operation bound')

    def add(self, a, b):
        self.operation()
        require(a.numerator.bit_length() + b.denominator.bit_length() <= 8192 and b.numerator.bit_length() + a.denominator.bit_length() <= 8192 and a.denominator.bit_length() + b.denominator.bit_length() <= 8192, 'addition product precheck')
        return self.checked(a + b)

    def sub(self, a, b):
        self.operation()
        require(a.numerator.bit_length() + b.denominator.bit_length() <= 8192 and b.numerator.bit_length() + a.denominator.bit_length() <= 8192 and a.denominator.bit_length() + b.denominator.bit_length() <= 8192, 'subtraction product precheck')
        return self.checked(a - b)

    def mul(self, a, b):
        self.operation()
        require(a.numerator.bit_length() + b.numerator.bit_length() <= 8192 and a.denominator.bit_length() + b.denominator.bit_length() <= 8192, 'product precheck')
        return self.checked(a * b)

    def div(self, a, b):
        self.operation()
        require(b != 0 and a.numerator.bit_length() + b.denominator.bit_length() <= 8192 and a.denominator.bit_length() + b.numerator.bit_length() <= 8192, 'division precheck')
        return self.checked(a / b)

    def neg(self, value):
        self.operation()
        return self.checked(-value)

    def absolute(self, value):
        self.operation()
        return self.checked(abs(value))

    def equal(self, a, b):
        self.operation()
        return a == b

    def le(self, a, b):
        self.operation()
        return a <= b

    def scale_bound(self, a, b):
        value = Fraction(1)
        for item in [self.absolute(a), self.absolute(b)]:
            if self.le(value, item):
                value = item
        return value

    def dot(self, a, b):
        total = Fraction(0)
        for x, y in zip(a, b):
            total = self.add(total, self.mul(x, y))
        return total


def integral_certificate(mass, half, arithmetic, counts):
    counts['bodyGeometryCertificatesAttempted'] += 1
    require(not arithmetic.le(mass, Fraction(0)) and all(not arithmetic.le(h, Fraction(0)) for h in half), 'positive actual native mass/half extents')
    moments = []
    for h in half:
        negative_h = arithmetic.neg(h)
        axis = []
        for n in range(3):
            counts['oneDimensionalMonomialMoments'] += 1
            positive, negative = Fraction(1), Fraction(1)
            for _ in range(n + 1):
                positive = arithmetic.mul(positive, h)
                negative = arithmetic.mul(negative, negative_h)
            axis.append(arithmetic.div(arithmetic.sub(positive, negative), Fraction(n + 1)))
        moments.append(axis)
    def volume_monomial(exponents):
        value = Fraction(1)
        for i in range(3):
            value = arithmetic.mul(value, moments[i][exponents[i]])
        return value
    volume = volume_monomial([0, 0, 0])
    density = arithmetic.div(mass, volume)
    integrated_mass = arithmetic.mul(density, volume)
    com = []
    for i in range(3):
        powers = [0, 0, 0]; powers[i] = 1
        com.append(arithmetic.div(arithmetic.mul(density, volume_monomial(powers)), integrated_mass))
    tensor = []
    for i in range(3):
        row = []
        for j in range(3):
            square_sum = Fraction(0)
            if i == j:
                for k in range(3):
                    powers = [0, 0, 0]; powers[k] = 2
                    square_sum = arithmetic.add(square_sum, volume_monomial(powers))
            powers = [0, 0, 0]; powers[i] += 1; powers[j] += 1
            row.append(arithmetic.mul(density, arithmetic.sub(square_sum, volume_monomial(powers))))
        tensor.append(row)
    require(arithmetic.equal(integrated_mass, mass) and all(arithmetic.equal(x, Fraction(0)) for x in com), 'integrated mass/COM certificate')
    require(all(arithmetic.equal(tensor[i][j], tensor[j][i]) and (i == j or arithmetic.equal(tensor[i][j], Fraction(0))) for i in range(3) for j in range(3)), 'symmetric diagonal integral tensor')
    require(arithmetic.equal(tensor[0][0], tensor[1][1]) and all(not arithmetic.le(tensor[i][i], Fraction(0)) for i in range(3)), 'equal intended body axes')
    counts['bodyGeometryCertificatesReturned'] += 1
    return {'oneAxisMomentPowers': [0,1,2], 'oneAxisMomentUnits': ['m','m^2','m^3'], 'oneAxisMoments': moments, 'volumeM3': volume, 'densityKgPerM3': density,
            'integratedMassKg': integrated_mass, 'integratedComM': com, 'tensorKgM2': tensor}


def proper_rotation(q, arithmetic, counts):
    counts['properRationalRotationAttempts'] += 1
    x, y, z, w = q
    s = arithmetic.dot(q, q)
    require(not arithmetic.le(s, Fraction(0)), 'observed quaternion has positive squared norm')
    two, one = Fraction(2), Fraction(1)
    xx, yy, zz = [arithmetic.mul(v, v) for v in [x, y, z]]
    xy, xz, yz, xw, yw, zw = [arithmetic.mul(a, b) for a, b in [(x,y),(x,z),(y,z),(x,w),(y,w),(z,w)]]
    r = [[arithmetic.sub(one, arithmetic.div(arithmetic.mul(two, arithmetic.add(yy, zz)), s)), arithmetic.div(arithmetic.mul(two, arithmetic.sub(xy, zw)), s), arithmetic.div(arithmetic.mul(two, arithmetic.add(xz, yw)), s)],
         [arithmetic.div(arithmetic.mul(two, arithmetic.add(xy, zw)), s), arithmetic.sub(one, arithmetic.div(arithmetic.mul(two, arithmetic.add(xx, zz)), s)), arithmetic.div(arithmetic.mul(two, arithmetic.sub(yz, xw)), s)],
         [arithmetic.div(arithmetic.mul(two, arithmetic.sub(xz, yw)), s), arithmetic.div(arithmetic.mul(two, arithmetic.add(yz, xw)), s), arithmetic.sub(one, arithmetic.div(arithmetic.mul(two, arithmetic.add(xx, yy)), s))]]
    for i in range(3):
        for j in range(3):
            require(arithmetic.equal(arithmetic.dot([r[k][i] for k in range(3)], [r[k][j] for k in range(3)]), Fraction(int(i == j))), 'exact proper-R orthogonality')
    determinant = Fraction(0)
    for j in range(3):
        minor = arithmetic.sub(arithmetic.mul(r[1][(j+1)%3], r[2][(j+2)%3]), arithmetic.mul(r[1][(j+2)%3], r[2][(j+1)%3]))
        determinant = arithmetic.add(determinant, arithmetic.mul(r[0][j], minor))
    require(arithmetic.equal(determinant, Fraction(1)), 'exact proper-R determinant')
    counts['properRationalRotationReturns'] += 1
    return r, s


def observed_audit(state, certificate, mass, arithmetic, counts):
    counts['observedStateAuditsAttempted'] += 1
    body = state['bodies'][0]
    rotation, s = proper_rotation(body['orientationXYZW'], arithmetic, counts)
    tensor = certificate['tensorKgM2']
    left = [[arithmetic.dot(rotation[i], [tensor[k][j] for k in range(3)]) for j in range(3)] for i in range(3)]
    world = [[arithmetic.dot(left[i], rotation[j]) for j in range(3)] for i in range(3)]
    omega = body['angularVelocityRadps']
    momentum = [arithmetic.dot(row, omega) for row in world]
    energy = arithmetic.div(arithmetic.dot(omega, momentum), Fraction(2))
    linear = [arithmetic.mul(mass, v) for v in body['velocityMps']]
    counts['observedStateAuditsReturned'] += 1
    return {'properRotation': rotation, 'worldTensorKgM2': world, 'angularMomentumKgM2ps': momentum,
            'rotationalEnergyJ': energy, 'quaternionSquaredNorm': s,
            'comPositionM': body['positionM'], 'linearMomentumKgMps': linear}


def assessment(graph, before, after, arithmetic, first_failure):
    epsilon = Fraction(1, 1000000000000)
    checks = []
    for i in range(3):
        a, b = before['angularMomentumKgM2ps'][i], after['angularMomentumKgM2ps'][i]
        bound = arithmetic.add(epsilon, arithmetic.mul(epsilon, arithmetic.scale_bound(a, b)))
        error = arithmetic.sub(b, a)
        checks.append({'quantity': 'angularMomentum', 'component': i, 'unit': 'kg*m^2/s', 'before': a, 'after': b, 'residual': error, 'bound': bound, 'pass': arithmetic.le(arithmetic.absolute(error), bound)})
    a, b = before['rotationalEnergyJ'], after['rotationalEnergyJ']
    error = arithmetic.sub(b, a)
    bound = arithmetic.add(epsilon, arithmetic.mul(epsilon, arithmetic.scale_bound(a, b)))
    checks.append({'quantity': 'rotationalEnergy', 'unit': 'J', 'before': a, 'after': b, 'residual': error, 'bound': bound, 'pass': arithmetic.le(arithmetic.absolute(error), bound)})
    for phase, observed in [('before', before), ('after', after)]:
        norm_error = arithmetic.sub(observed['quaternionSquaredNorm'], Fraction(1))
        checks.append({'quantity': 'quaternionSquaredNorm', 'phase': phase, 'unit': 'dimensionless', 'residual': norm_error, 'bound': epsilon, 'pass': arithmetic.le(arithmetic.absolute(norm_error), epsilon)})
        for key, quantity, unit in [('linearMomentumKgMps','linearMomentum','kg*m/s'), ('comPositionM','comPosition','m')]:
            for i, residual in enumerate(observed[key]):
                checks.append({'quantity': quantity, 'phase': phase, 'component': i, 'unit': unit, 'residual': residual, 'bound': epsilon, 'pass': arithmetic.le(arithmetic.absolute(residual), epsilon)})
    failures = [item for item in checks if not item['pass']]
    if first_failure is None and failures:
        first_failure = {'graph': graph, 'check': failures[0], 'meaning': 'first physical failure from immutable saved states; later native assessment uses files only'}
    return {'graph': graph, 'status': 'PHYSICAL_NO_GO_OBSERVED' if failures else 'NO_FAILURE_OBSERVED', 'before': before, 'after': after, 'checks': checks, 'failures': failures}, first_failure


def collect_rounding(native, intended, arithmetic, output, path=''):
    if type(native) is dict:
        for key,value in native.items():
            collect_rounding(value,intended[key],arithmetic,output,path+'/'+key)
    elif type(native) is list:
        for i,value in enumerate(native):
            collect_rounding(value,intended[i],arithmetic,output,path+'/'+str(i))
    elif type(native) is Fraction:
        output.append({'path':path,'nativeMinusIntended':arithmetic.sub(native,Fraction(intended))})


def owned_size(value, seen, depth=0):
    require(depth <= 32 and len(seen) <= 8192, 'owned graph bound')
    key = id(value)
    if key in seen:
        return 0
    seen.add(key)
    size = sys.getsizeof(value)
    if type(value) is dict:
        for name, item in value.items():
            size += owned_size(name, seen, depth+1) + owned_size(item, seen, depth+1)
    elif type(value) in (list, tuple):
        for item in value:
            size += owned_size(item, seen, depth+1)
    elif type(value) is Fraction:
        size += sys.getsizeof(value.numerator) + sys.getsizeof(value.denominator)
    return size


def encoded_bound(value):
    # ASCII JSON size upper bound plus newly packed dict/list/string allocations.
    if type(value) is Fraction:
        n, d = str(value.numerator), str(value.denominator)
        require(len(n) <= 1300 and len(d) <= 1300, 'serialized rational1300character bound')
        return len(n) + len(d) + 48, 1024 + sys.getsizeof(n) + sys.getsizeof(d)
    if type(value) is dict:
        length, extra = 2, 4 * sys.getsizeof(value)
        for key, item in value.items():
            kl, ke = encoded_bound(key); vl, ve = encoded_bound(item)
            length += kl + vl + 2; extra += ke + ve
        return length, extra
    if type(value) in (list, tuple):
        length, extra = 2, 4 * sys.getsizeof(value)
        for item in value:
            child, more = encoded_bound(item); length += child + 1; extra += more
        return length, extra
    if type(value) is str:
        require(len(value) <= 8192, 'scalar text bound')
        return 2 + 6 * len(value), 0
    if value is None or type(value) is bool:
        return 5, 0
    if type(value) is int:
        return len(str(value)), 0
    raise ReferenceFailure('unsupported owned/serialized value')


def working_bound(owners, result):
    seen = set()
    try:
        measured = owned_size(owners, seen) + owned_size(result, seen)
        length, packed = encoded_bound(result)
        # 1.5MiB traversal (8192 IDs/old+new set tables/depth32 frames),
        # 0.5MiB bounded Fraction/encoder/control transient growth; JSON/UTF8
        # overlap are charged separately before writing.
        upper = measured + 2097152 + packed + 2 * length
        require(upper <= 8388608, 'reference8MiB live/serialization charge')
        return {'measuredReachableOwnedBytes': measured, 'derivedScratchBytes': 2097152,
                'packedAllocationChargeBytes': packed, 'asciiJsonSizeUpperBytes': length,
                'ownedUpperBytes': upper, 'limitBytes': 8388608, 'RSSClaim': False}
    finally:
        seen.clear()
        del seen


def pack(value):
    if type(value) is Fraction:
        return {'numerator': str(value.numerator), 'denominator': str(value.denominator)}
    if type(value) is dict:
        return {key: pack(item) for key, item in value.items()}
    if type(value) is list:
        return [pack(item) for item in value]
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    require(all(len(value)<=4096 for value in sys.argv),'bounded CLI strings')
    for name in ['request','request-sha256','freeze','token','out']:
        parser.add_argument('--'+name, required=True)
    args = parser.parse_args()
    out, request_path = Path(args.out).resolve(), Path(args.request).resolve()
    require(out.parent == request_path.parent and out.is_relative_to(HERE/'evidence') and not out.exists(), 'fresh owned output')
    signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError('baseline classifier deadline')))
    signal.setitimer(signal.ITIMER_REAL, 170)
    counts = {'bodyGeometryCertificatesAttempted':0,'bodyGeometryCertificatesReturned':0,'oneDimensionalMonomialMoments':0,'observedStateAuditsAttempted':0,'observedStateAuditsReturned':0,'properRationalRotationAttempts':0,'properRationalRotationReturns':0,'fractionScalarOperations':0,'WorldCalls':0,'trig':0,'sqrt':0,'odeSolves':0,'linearSolves':0}
    result = {'status':'REFERENCE_OR_RESOURCE_FAILURE','counts':counts,'assessments':[],'firstPhysicalFailure':None,'executionFailure':None,'graphArtifacts':[]}
    owners = {'counts':counts,'result':result}
    def progress():
        raw = json.dumps({'status':'IN_PROGRESS','pendingResultStatus':result['status'],'counts':counts,'completedGraphs':[a['graph'] for a in result.get('assessments',[])],'firstPhysicalFailureKnown':result['firstPhysicalFailure'] is not None}, separators=(',',':'))+'\n'
        require(len(raw) <= 8192, 'progress bound')
        with (out.parent/'classifier-progress.json').open('w') as stream:
            stream.write(raw); stream.flush()
    try:
        freeze = authenticate(args.freeze,args.token);owners['freeze']=freeze
        require(request_path.stat().st_size <= 65536 and file_sha(request_path)==args.request_sha256, 'request hash')
        request = load(request_path);owners['request']=request
        require(request['freezeSha256']==args.token and request['mode']=='BASELINE_CHARACTERIZATION_ONLY','request identity')
        artifacts = {}
        for name,pin in request['artifacts'].items():
            path=Path(pin['path']).resolve();require(path.is_relative_to(HERE/'evidence'),'owned captured file')
            artifacts[name]=load(path,pin,65536)
        owners['rawArtifacts']=artifacts
        closed=artifacts['closed'];require(closed['status']=='CAPTURE_CLOSED_COMPLETE' and closed['allWorldReferencesReleased'] is True,'closed capture prerequisite')
        for key in ['constructorAttempts','constructorReturns','getStateAttempts','getStateReturns','stepAttempts','stepReturns','disposeAttempts','disposeReturns']:
            require(closed['counts'][key]==2,'actual capture count '+key)
        require(closed['counts']['query']==closed['counts']['getModel']==closed['counts']['recorder']==0,'no extra APIs')
        pair=decode(artifacts['input']);owners['nativePair']=pair
        states={name:decode(artifacts[name]) for name in ['sourceBefore','sourceAfter','nativeBefore','nativeAfter']};owners['observedStates']=states
        source=pair['model'];mass=source['bodies'][0]['massKg'];half=source['colliders'][0]['geometry']['halfExtentsM']
        arithmetic=Arithmetic(counts);progress();certificate=integral_certificate(mass,half,arithmetic,counts);owners['certificate']=certificate;result['geometryCertificate']=certificate;result['workingData']=working_bound(owners,result)
        for graph in ['source','native']:
            progress();first=observed_audit(states[graph+'Before'],certificate,mass,arithmetic,counts);owners['currentBefore']=first
            progress();last=observed_audit(states[graph+'After'],certificate,mass,arithmetic,counts);owners['currentAfter']=last
            item,result['firstPhysicalFailure']=assessment(graph,first,last,arithmetic,result['firstPhysicalFailure'])
            result['assessments'].append(item);owners.pop('currentBefore');owners.pop('currentAfter');first=last=item=None
            result['workingData']=working_bound(owners,result)
            graph_path=out.parent/(graph+'-assessment.json')
            graph_data=(json.dumps(pack(result['assessments'][-1]),separators=(',',':'),ensure_ascii=True,allow_nan=False)+'\n').encode('ascii')
            require(len(graph_data)<=262144,'per-graph immutable assessment bound')
            with graph_path.open('xb') as stream:stream.write(graph_data)
            result['graphArtifacts'].append({'path':str(graph_path),'bytes':len(graph_data),'sha256':hashlib.sha256(graph_data).hexdigest()})
            graph_data=None
            progress()
        literal=load(HERE/'CASES.json');owners['literalCases']=literal
        rounding=[]
        collect_rounding(pair,{'model':literal['literalModel'],'options':literal['literalOptions']},arithmetic,rounding)
        result['inputRounding']=rounding
        require(counts['bodyGeometryCertificatesReturned']==1 and counts['oneDimensionalMonomialMoments']==9 and counts['observedStateAuditsReturned']==counts['properRationalRotationReturns']==4,'final fixed classifier ledger')
        result['status']='CHARACTERIZED_PHYSICAL_NO_GO' if result['firstPhysicalFailure'] else 'CHARACTERIZED_NO_FAILURE_OBSERVED'
        result['provenance']={'freezeSha256':args.token,'requestSha256':args.request_sha256,'artifactPins':request['artifacts']}
    except BaseException as error:
        result['executionFailure']={'type':type(error).__name__,'message':str(error)[:2048]}
    finally:
        signal.setitimer(signal.ITIMER_REAL,0)
    try:
        result['workingData']=working_bound(owners,result)
    except BaseException as final_error:
        original=result['executionFailure']
        result={'status':'REFERENCE_OR_RESOURCE_FAILURE','counts':counts,'firstPhysicalFailure':result['firstPhysicalFailure'],'graphArtifacts':result['graphArtifacts'],'executionFailure':original or {'type':type(final_error).__name__,'message':str(final_error)[:2048]},'finalReceiptFailure':str(final_error)[:2048]}
        owners.clear()
        require(encoded_bound(result)[0]<=65536,'bounded emergency classification receipt')
    progress()
    encoded=(json.dumps(pack(result),separators=(',',':'),ensure_ascii=True,allow_nan=False)+'\n').encode('ascii')
    require(len(encoded)<=524288,'classifier artifact bound')
    with out.open('xb') as stream:stream.write(encoded)
    print(json.dumps({'status':'IN_PROGRESS','pendingResultStatus':result['status'],'counts':counts,'firstPhysicalFailure':result['firstPhysicalFailure'] is not None,'executionFailure':result['executionFailure']},separators=(',',':')))
    return 0 if result['executionFailure'] is None else 1


if __name__=='__main__':
    sys.exit(main())
