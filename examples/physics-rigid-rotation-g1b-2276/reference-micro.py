#!/usr/bin/env python3
"""Authorized G1b M-only independent interval-Taylor reference, JSONL."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import signal
import sys
import time
from decimal import Decimal, Context, ROUND_FLOOR, ROUND_CEILING, InvalidOperation, DivisionByZero, Overflow, FloatOperation
from fractions import Fraction

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
MIB = 1048576
BASELINE = ROOT / 'examples/physics-rigid-rotation-g1-2276/baseline-classify.py'
BASELINE_SHA = '5f5eee9ac2cd8b654eab134823a619254fd0b7c4ab8791419d077a71413a09eb'
PINS = {'CONTRACT.md': 'c1c87c64323836d7ac656ead490380bee82f801de2b67979f9f91309ee73ed31',
        'CASES.json': '0fb8b4ebc78044e8984fab83878a42fc5051f8717ce914091246de7098fbc386',
        'REFERENCES-CLARIFICATION-01.md': '0d6e8a79f2cbf45f7579291f9b1b947295f28f0cf00eb57053ed581cb8979945'}


class Failure(Exception):
    def __init__(self, message, detail=None):
        super().__init__(message)
        self.detail = detail


def need(value, message, detail=None):
    if not value: raise Failure(message, detail)


def sha(data): return hashlib.sha256(data).hexdigest()


def file_sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''): h.update(block)
    return h.hexdigest()


def unique(rows):
    result = {}
    for key, value in rows:
        need(key not in result, 'duplicate JSON key')
        result[key] = value
    return result


def decode_bound(data):
    nodes = depth = strings = bare = 0
    quoted = escaped = False
    for c in data:
        if quoted:
            strings += 1
            if escaped: escaped = False
            elif c == 92: escaped = True
            elif c == 34: quoted = False
        elif c == 34: nodes += 1; quoted = True; bare = 0
        elif c in (123, 91): nodes += 1; depth += 1; bare = 0
        elif c in (125, 93): depth -= 1; bare = 0
        elif c in (9, 10, 13, 32, 44, 58): bare = 0
        else:
            if bare == 0: nodes += 1
            bare += 1
        need(nodes <= 8192 and 0 <= depth <= 32 and bare <= 1300, 'JSON allocation census')
    need(not quoted and depth == 0, 'complete bounded JSON envelope')
    return 512 * nodes + 4 * strings + 4 * len(data) + 131072


def parse(data):
    need(decode_bound(data) <= 6 * MIB, 'bounded decoder allocation')
    return json.loads(data, object_pairs_hook=unique,
                      parse_constant=lambda _: (_ for _ in ()).throw(Failure('non-JSON number')))


def packed(value):
    if type(value) is Fraction:
        need(max(value.numerator.bit_length(), value.denominator.bit_length()) <= 4096, 'encoded rational bound')
        return {'numerator': str(value.numerator), 'denominator': str(value.denominator)}
    if type(value) is dict: return {k: packed(v) for k, v in value.items()}
    if type(value) in (list, tuple): return [packed(v) for v in value]
    return value


def wire(value): return (json.dumps(packed(value), ensure_ascii=True, allow_nan=False, separators=(',', ':')) + '\n').encode('ascii')


def authenticate(args):
    path = Path(args.freeze)
    need(path.stat().st_size <= 262144, 'bounded execution freeze')
    raw = path.read_bytes()
    need(sha(raw) == args.token and decode_bound(raw) + 2 * len(raw) + 2 * MIB <= 8 * MIB, 'parent token and authorization allocation')
    freeze = parse(raw)
    need(freeze['status'] == 'PARENT_AUTHORIZED_G1B_MICRO' and freeze['mode'] == 'G1B_M_STAGED_ONLY' and
         freeze['phase'] == 'M' and freeze['runtimeAuthorized'] is True and freeze['phaseTAuthorized'] is False and
         freeze['productionActivation'] is False and freeze['runId'] == args.run_id, 'M-only authorization')
    required = ('CONTRACT.md', 'CASES.json', 'INTEGRATION-NOTES.md', 'REFERENCES-CLARIFICATION-01.md',
                'AUTHORING-FREEZE-M01.json', 'ADMISSION-NORMALIZATION-CORRECTION-01.json',
                'rigid-triaxial-free-rotation.ts', 'CANDIDATE-READY-M02.json', 'LINEAR-CHECK-REPAIR-M02.md',
                'reference-micro.py', 'REFERENCE-PROTOCOL-M01.md', 'REFERENCE-READY-M01.json')
    for name in required: need(str(HERE.relative_to(ROOT) / name) in freeze['files'], 'required frozen authority ' + name)
    need(str(BASELINE.relative_to(ROOT)) in freeze['files'], 'baseline helper closure')
    for name, pin in freeze['files'].items():
        target = (ROOT / name).resolve()
        need(target.is_relative_to(ROOT) and target.stat().st_size == pin['bytes'] and file_sha(target) == pin['sha256'], 'source/authority pin ' + name)
    for name, pin in freeze['toolFiles'].items():
        target = Path(name)
        need(target.is_absolute() and target.stat().st_size == pin['bytes'] and file_sha(target) == pin['sha256'], 'tool pin ' + name)
    need(Path(sys.executable).resolve() == Path(freeze['tools']['python']).resolve() and
         freeze['tools']['python'] in freeze['toolFiles'], 'actual pinned Python')
    need(freeze['highReview']['approved'] is True and freeze['highReview']['path'] in freeze['files'], 'High execution review')
    for name, expected in PINS.items(): need(file_sha(HERE / name) == expected, 'immutable proposal ' + name)
    need(file_sha(BASELINE) == BASELINE_SHA, 'unchanged independent integral/audit helper')
    spec = importlib.util.spec_from_file_location('g1b_original_integral_audit', BASELINE)
    baseline = importlib.util.module_from_spec(spec); spec.loader.exec_module(baseline)
    return freeze, baseline


def fmaximum(values, arithmetic):
    iterator = iter(values); result = next(iterator)
    for value in iterator:
        if arithmetic.le(result, value): result = value
    return result


class Intervals:
    """Directed elementary arithmetic only; no global Decimal context changes."""
    def __init__(self, precision, counts, arithmetic):
        self.precision, self.counts, self.f = precision, counts, arithmetic
        self.down = Context(prec=precision, rounding=ROUND_FLOOR, Emin=-999999, Emax=999999, capitals=1, clamp=0)
        self.up = Context(prec=precision, rounding=ROUND_CEILING, Emin=-999999, Emax=999999, capitals=1, clamp=0)
        for context in (self.down, self.up):
            for key in context.traps:
                context.traps[key] = key in (InvalidOperation, DivisionByZero, Overflow, FloatOperation)
                context.flags[key] = False

    def tick(self):
        self.counts['decimalOperations'] += 1
        need(self.counts['decimalOperations'] <= 32000000, 'Decimal32M bound')

    def check(self, value):
        self.tick()
        need(value.is_finite() and len(value.as_tuple().digits) <= 2048, 'finite bounded Decimal result')
        return value

    def le(self, a, b): self.tick(); return a <= b
    def lt(self, a, b): self.tick(); return a < b

    def select(self, values, largest):
        result = values[0]
        for value in values[1:]:
            if self.le(result, value) if largest else self.le(value, result): result = value
        return result

    def literal(self, value):
        if type(value) is int:
            self.counts['decimalConversions'] += 1
            d = Decimal(value); return d, d
        need(type(value) is Fraction, 'rational interval literal')
        self.f.checked(value); self.counts['decimalConversions'] += 2
        n, d = Decimal(str(value.numerator)), Decimal(str(value.denominator))
        return self.check(self.down.divide(n, d)), self.check(self.up.divide(n, d))

    def add(self, a, b): return self.check(self.down.add(a[0], b[0])), self.check(self.up.add(a[1], b[1]))
    def sub(self, a, b): return self.check(self.down.subtract(a[0], b[1])), self.check(self.up.subtract(a[1], b[0]))
    def neg(self, a): return self.check(a[1].copy_negate()), self.check(a[0].copy_negate())

    def mul(self, a, b):
        lows = [self.check(self.down.multiply(x, y)) for x in a for y in b]
        highs = [self.check(self.up.multiply(x, y)) for x in a for y in b]
        return self.select(lows, False), self.select(highs, True)

    def div(self, a, b):
        zero = Decimal(0)
        need(not (self.le(b[0], zero) and self.le(zero, b[1])), 'interval divisor excludes0')
        reciprocal = self.check(self.down.divide(Decimal(1), b[1])), self.check(self.up.divide(Decimal(1), b[0]))
        return self.mul(a, reciprocal)

    def absupper(self, value):
        return self.select([self.check(value[0].copy_abs()), self.check(value[1].copy_abs())], True)

    def scalar_add_up(self, a, b): return self.check(self.up.add(a, b))
    def scalar_mul_up(self, a, b): return self.check(self.up.multiply(a, b))

    def fraction(self, value):
        self.counts['decimalToFractionConversions'] += 1
        return self.f.checked(Fraction(value))

    def sqrt(self, value):
        need(self.le(Decimal(0), value[0]), 'nonnegative interval square root')
        self.counts['endpointDecimalSqrtOperations'] += 2
        need(self.counts['endpointDecimalSqrtOperations'] <= 108, 'fixed endpoint sqrt ceiling')
        low_root = self.check(self.down.sqrt(value[0])); high_root = self.check(self.up.sqrt(value[1]))
        low = Decimal(0) if value[0].is_zero() else self.check(self.down.next_minus(low_root))
        high = Decimal(0) if value[1].is_zero() else self.check(self.up.next_plus(high_root))
        a, b = self.fraction(low), self.fraction(high)
        need(self.f.le(self.f.mul(a, a), self.fraction(value[0])) and
             self.f.le(self.fraction(value[1]), self.f.mul(b, b)), 'sqrt endpoint square enclosure')
        return low, high

    def fractions(self, value):
        if type(value) is tuple and len(value) == 2 and type(value[0]) is Decimal:
            return {'lo': self.fraction(value[0]), 'hi': self.fraction(value[1])}
        if type(value) is list: return [self.fractions(v) for v in value]
        return {key: self.fractions(v) for key, v in value.items()}

    def report(self):
        return [{'precision': c.prec, 'rounding': c.rounding, 'Emin': c.Emin, 'Emax': c.Emax,
                 'capitals': c.capitals, 'clamp': c.clamp,
                 'traps': {k.__name__: v for k, v in c.traps.items()},
                 'flags': {k.__name__: v for k, v in c.flags.items()}} for c in (self.down, self.up)]


def alternating(i, j, k):
    if (i, j, k) in ((0, 1, 2), (1, 2, 0), (2, 0, 1)): return 1
    if (i, j, k) in ((0, 2, 1), (2, 1, 0), (1, 0, 2)): return -1
    return 0


def equation_terms(diagonal, engine):
    # Independent tensor-index construction for p'=p cross Dp and R'=R[Dp]cross.
    rows = [[] for _ in range(12)]
    for i in range(3):
        for j in range(3):
            for k in range(3):
                sign = alternating(i, j, k)
                if sign: rows[i].append((diagonal[k] if sign > 0 else engine.neg(diagonal[k]), j, k))
    for i in range(3):
        for j in range(3):
            for k in range(3):
                for ell in range(3):
                    sign = -alternating(k, j, ell)
                    if sign: rows[3 + 3 * i + j].append((diagonal[ell] if sign > 0 else engine.neg(diagonal[ell]), 3 + 3 * i + k, ell))
    return rows


def polynomial_field_coefficient(degree, coefficients, terms, engine):
    result = []
    for row in terms:
        total = engine.literal(0)
        for constant, left, right in row:
            convolution = engine.literal(0)
            for k in range(max(0, degree - len(coefficients) + 1), min(degree, len(coefficients) - 1) + 1):
                convolution = engine.add(convolution, engine.mul(coefficients[k][left], coefficients[degree - k][right]))
            total = engine.add(total, engine.mul(constant, convolution))
        result.append(total)
    return result


def polynomial_value(coefficients, time_interval, engine):
    result = list(coefficients[-1])
    for coefficient in reversed(coefficients[:-1]):
        result = [engine.add(engine.mul(value, time_interval), term) for value, term in zip(result, coefficient)]
    return result


def interval_tree_rows(value, path=''):
    if type(value) is dict and set(value) == {'lo', 'hi'}: yield path, value
    elif type(value) is dict:
        for key, child in value.items(): yield from interval_tree_rows(child, path + '/' + key)
    else:
        for index, child in enumerate(value): yield from interval_tree_rows(child, path + '/' + str(index))


class Server:
    def __init__(self, args, freeze, baseline):
        self.args, self.freeze, self.b = args, freeze, baseline
        self.counts = {k: 0 for k in ('requestsAttempted', 'requestsReturned', 'bankInitializations',
            'bodyGeometryCertificatesAttempted', 'bodyGeometryCertificatesReturned', 'oneDimensionalMonomialMoments',
            'observedStateAuditsAttempted', 'observedStateAuditsReturned', 'properRationalRotationAttempts',
            'properRationalRotationReturns', 'privateBodyObservations', 'algebraicBisectionDecisions',
            'algebraicRootsCertified', 'taylorWindowsAttempted', 'taylorWindowsReturned',
            'decimal80Windows', 'decimal120Windows', 'fractionScalarOperations', 'decimalOperations',
            'decimalConversions', 'decimalToFractionConversions', 'endpointDecimalSqrtOperations',
            'WorldCalls', 'candidateCalls', 'PhysicsImports', 'referenceLinearSolves', 'trigEvaluations')}
        class BoundedArithmetic(baseline.Arithmetic):
            def operation(inner):
                inner.counts['fractionScalarOperations'] += 1
                need(inner.counts['fractionScalarOperations'] <= 10000000, 'Fraction10M bound')
        self.f = BoundedArithmetic(self.counts)
        self.owners = {'freeze': freeze, 'counts': self.counts}
        self.bank, self.initial, self.private = {}, {}, {}
        self.owners.update(bank=self.bank, initial=self.initial, private=self.private)
        self.pair = self.geometry = self.source_coefficients_raw = self.bank_pin = None
        self.next_audit = 0
        self.source_complete = self.finished = False
        self.transient = self.peak = self.stored = 0
        self.out = Path(args.out).resolve()
        need(self.out.is_relative_to(HERE / 'evidence'), 'owned fresh reference output')
        self.out.mkdir(parents=True, exist_ok=False)

    def memory(self, result, extra=0):
        value = self.b.working_bound(self.owners, result)
        value['analyticAndDecodePrechargeBytes'] = self.transient + extra
        value['ownedUpperBytes'] += self.transient + extra
        need(value['ownedUpperBytes'] <= 8 * MIB, 'reference full owned8MiB')
        self.peak = max(self.peak, value['ownedUpperBytes'])
        return value

    def write(self, name, value, cap=MIB, reserved=False):
        self.memory(value)
        data = wire(value)
        need(len(data) <= cap and self.stored + len(data) <= 8 * MIB - (8192 if reserved else 65536), 'reference evidence subcap inside combined16MiB')
        with (self.out / name).open('xb') as stream: stream.write(data)
        self.stored += len(data)
        return {'path': name, 'bytes': len(data), 'sha256': sha(data)}

    def progress(self, failure=None):
        value = {'counts': self.counts, 'nextAudit': self.next_audit,
                 'sourceGraphComplete': self.source_complete, 'firstFailure': failure}
        self.memory(value)
        data = wire(value); need(len(data) <= 8192, 'bounded progress record')
        (self.out / 'progress.json').write_bytes(data)

    def canonical_pair(self, raw):
        need(set(raw) == {'model', 'options'}, 'canonical pair envelope')
        model, options = raw['model'], raw['options']
        need(model['format'] == 'barocss-physics-model' and len(model['bodies']) == len(model['colliders']) == 1 and
             not any(model[k] for k in ('joints', 'cloths', 'fluids', 'sourceBindings')), 'single isolated rigid literal')
        body, collider = model['bodies'][0], model['colliders'][0]
        zero, one = {'$f64le': '0000000000000000'}, {'$f64le': '000000000000f03f'}
        need(body['id'] == collider['bodyId'] == 'rotor' and body['kind'] == 'dynamic' and
             body['massKg'] == one and body['inertia'] == {'kind': 'primitive-com', 'about': 'com', 'frame': 'body-local'}, 'canonical primitive body')
        initial = body['initial']
        need(initial['positionM'] == initial['velocityMps'] == model['gravityMps2'] == [zero, zero, zero] and
             initial['orientationXYZW'] == [zero, zero, zero, one] and
             initial['angularVelocityRadps'] == [one, one, one], 'canonical M initial words')
        need(collider['geometry'] == {'kind': 'box', 'halfExtentsM': [
            {'$f64le': '9a9999999999b93f'}, {'$f64le': '9a9999999999c93f'}, {'$f64le': '333333333333d33f'}]} and
             collider['local'] == {'positionM': [zero, zero, zero], 'orientationXYZW': [zero, zero, zero, one]} and
             collider['ccd'] is False and collider['sensor'] is False, 'canonical native box geometry')
        need(options['profile'] == 'rigid-discrete-v1' and options['broadPhase'] == 'direct', 'canonical rigid options')
        pair = self.b.decode(raw)
        need(self.f.equal(pair['options']['fixedStepSeconds'], Fraction(4803839602528529, 576460752303423488)), 'actual native dt120 authority')
        return pair

    def certify_coefficients(self, raw):
        need(set(raw) == {'exponents', 'roots', 'a', 'b', 'weights'}, 'observed coefficient fields')
        data = self.b.decode(raw)
        need(data['exponents'] == [Fraction(3), Fraction(5), Fraction(7)] and
             all(len(data[k]) == 3 for k in ('roots', 'a', 'b')) and len(data['weights']) == 27, 'fixed coefficient dataset shape')
        self.owners['coefficientValues'] = data
        proofs = []
        self.owners['coefficientProofs'] = proofs
        for index, exponent in enumerate((3, 5, 7)):
            lo, hi = Fraction(1), Fraction(2)
            self.owners['algebraicScratch'] = {}
            scratch = self.owners['algebraicScratch']
            for decision in range(512):
                scratch.update(lo=lo, hi=hi)
                middle = self.f.div(self.f.add(lo, hi), Fraction(2)); scratch['middle'] = middle
                power = Fraction(1)
                for _ in range(exponent): power = self.f.mul(power, middle)
                scratch['power'] = power
                self.counts['algebraicBisectionDecisions'] += 1
                if self.f.le(power, Fraction(2)): lo = middle
                else: hi = middle
            observed = data['roots'][index]
            worst = fmaximum((self.f.absolute(self.f.sub(observed, lo)), self.f.absolute(self.f.sub(observed, hi))), self.f)
            bound = self.f.mul(Fraction(8, 1 << 52), lo)
            need(self.f.le(worst, bound), 'actual SOURCE algebraic constant bound', {'exponent': exponent, 'observed': observed, 'lo': lo, 'hi': hi, 'error': worst, 'bound': bound})
            proofs.append({'exponent': exponent, 'lo': lo, 'hi': hi, 'observed': observed, 'error': worst, 'bound': bound, 'decisions': 512})
            self.counts['algebraicRootsCertified'] += 1
            self.owners.pop('algebraicScratch')
        total = Fraction(0)
        for weight in data['weights']:
            need(self.f.le(self.f.absolute(weight), Fraction(3)) and not self.f.equal(self.f.absolute(weight), Fraction(3)), 'actual signed stage bound')
            total = self.f.add(total, weight)
        error = self.f.absolute(self.f.sub(total, Fraction(1)))
        need(self.f.le(error, Fraction(64, 1 << 52)), 'actual SOURCE weight sum bound', {'sum': total, 'error': error})
        need(self.counts['algebraicBisectionDecisions'] == 1536, 'fixed exact algebraic work')
        return {'roots': proofs, 'observedSourceWordsSha256': sha(wire(raw)), 'weightSum': total,
                'weightSumError': error, 'weightSumBound': Fraction(64, 1 << 52),
                'NativeValuesObservedByReference': False, 'nativeAuthority': 'Runner reads actual Native words only after Source PASS/dispose and proves exact DATA equality.'}

    def window(self, initial, diagonal, h, engine, window_index):
        self.counts['taylorWindowsAttempted'] += 1
        self.counts['decimal' + str(engine.precision) + 'Windows'] += 1
        self.transient = MIB
        scratch = {'initial': initial, 'contexts': {'down': engine.down, 'up': engine.up}}
        self.owners['currentWindow'] = scratch
        self.memory({})
        terms = equation_terms(diagonal, engine); scratch['terms'] = terms
        coefficients = [initial]; scratch['coefficients'] = coefficients
        for degree in range(32):
            current = polynomial_field_coefficient(degree, coefficients, terms, engine)
            scratch['currentFieldCoefficient'] = current
            coefficients.append([engine.div(value, engine.literal(degree + 1)) for value in current])
            self.memory({})
        tube = engine.literal(Fraction(17, 16))
        tube_abs = tube[1]
        M = L = Decimal(0)
        for row in terms:
            field_bound = derivative_bound = Decimal(0)
            for constant, _, _ in row:
                magnitude = engine.absupper(constant)
                field_bound = engine.scalar_add_up(field_bound, engine.scalar_mul_up(magnitude, engine.scalar_mul_up(tube_abs, tube_abs)))
                derivative_bound = engine.scalar_add_up(derivative_bound, engine.scalar_mul_up(Decimal(2), engine.scalar_mul_up(magnitude, tube_abs)))
            M = engine.select([M, field_bound], True); L = engine.select([L, derivative_bound], True)
        need(engine.le(M, Decimal(8)) and engine.le(L, Decimal(16)), 'verified full-tube field/Lipschitz bounds')
        h_interval = engine.literal(h); h_upper = h_interval[1]
        start_max = engine.select([engine.absupper(value) for value in initial], True)
        need(engine.lt(engine.scalar_add_up(start_max, engine.scalar_mul_up(h_upper, M)), tube_abs) and
             engine.lt(engine.scalar_mul_up(h_upper, M), engine.literal(Fraction(1, 16))[0]) and
             engine.lt(engine.scalar_mul_up(h_upper, L), engine.literal(Fraction(1, 8))[0]), 'Picard map/tube contraction with full initial width')
        polynomial_range = polynomial_value(coefficients, (Decimal(0), h_upper), engine)
        scratch['polynomialRange'] = polynomial_range
        need(all(engine.le(engine.absupper(value), tube_abs) for value in polynomial_range), 'every fixed Taylor polynomial lies in the same convex tube')
        # Stream all65 residual coefficients. No degree64 matrix tree is retained.
        eta_by_component = [Decimal(0) for _ in range(12)]
        power = engine.literal(1)
        scratch['etaByComponent'] = eta_by_component
        coefficient_hash = hashlib.sha256()
        for row in coefficients:
            for lo, hi in row:
                for endpoint in (lo, hi):
                    chunk = str(endpoint).encode('ascii'); need(len(chunk) <= 4096, 'bounded coefficient hash chunk')
                    coefficient_hash.update(str(len(chunk)).encode('ascii') + b':' + chunk)
        for degree in range(65):
            value = polynomial_field_coefficient(degree, coefficients, terms, engine)
            if degree < 32:
                value = [engine.sub(engine.mul(engine.literal(degree + 1), coefficients[degree + 1][i]), value[i]) for i in range(12)]
            else: value = [engine.neg(x) for x in value]
            scratch['currentResidualCoefficient'] = value
            for index, cell in enumerate(value):
                eta_by_component[index] = engine.scalar_add_up(eta_by_component[index], engine.scalar_mul_up(engine.absupper(cell), power[1]))
            power = engine.mul(power, h_interval)
        eta = engine.select(eta_by_component, True)
        numerator = engine.mul((eta, eta), h_interval)
        denominator = engine.sub(engine.literal(1), engine.mul((L, L), h_interval))
        error = engine.div(numerator, denominator)[1]
        endpoint = polynomial_value(coefficients, h_interval, engine)
        scratch['endpointPolynomial'] = endpoint
        negative_error = engine.neg((error, error))[0]
        widened = [engine.add(value, (negative_error, error)) for value in endpoint]
        scratch['endpointWithError'] = widened
        self.memory({})
        certificate = {'window': window_index, 'order': 32, 'completeResidualDegree': 64,
            'coefficientTreeSha256': coefficient_hash.hexdigest(), 'MperSecond': engine.fraction(M),
            'LperSecond': engine.fraction(L), 'tubeComponentBound': Fraction(17, 16),
            'fullInitialAbsoluteUpper': engine.fraction(start_max),
            'defectAbsoluteUpper': engine.fraction(eta), 'uniformSolutionErrorUpper': engine.fraction(error),
            'proof': 'For every fixed initial z, interval coefficients enclose the exact recurrence coefficients; complete residual bounds all corresponding fixed polynomials. e(0)=0; previous uncertainty enters C0 and every recurrence coefficient.',
            'contexts': engine.report()}
        scratch['certificate'] = certificate
        self.memory({})
        self.counts['taylorWindowsReturned'] += 1
        self.owners.pop('currentWindow'); self.transient = 0
        return widened, certificate

    def observable(self, state, diagonal, engine):
        scratch = {'state': state, 'diagonal': diagonal}
        self.owners['observableScratch'] = scratch
        p = state[:3]; rotation = [state[3 + 3 * i:6 + 3 * i] for i in range(3)]
        scratch['rotation'] = rotation
        body_omega = [engine.mul(p[i], diagonal[i]) for i in range(3)]
        scratch['bodyOmega'] = body_omega
        omega = []
        for row in rotation:
            value = engine.literal(0)
            for r, w in zip(row, body_omega): value = engine.add(value, engine.mul(r, w))
            omega.append(value)
        scratch['omega'] = omega
        trace = engine.literal(0)
        for i in range(3): trace = engine.add(trace, rotation[i][i])
        qw = engine.div(engine.sqrt(engine.add(engine.literal(1), trace)), engine.literal(2))
        need(engine.lt(Decimal('0.5'), qw[0]), 'positive continuous quaternion extraction branch')
        denominator = engine.mul(engine.literal(4), qw)
        q = [engine.div(engine.sub(rotation[2][1], rotation[1][2]), denominator),
             engine.div(engine.sub(rotation[0][2], rotation[2][0]), denominator),
             engine.div(engine.sub(rotation[1][0], rotation[0][1]), denominator), qw]
        scratch['q'] = q
        result = engine.fractions({'R': rotation, 'omega': omega, 'q': q})
        scratch['result'] = result
        maximum_width = Fraction(0)
        for path, cell in interval_tree_rows(result):
            width = self.f.sub(cell['hi'], cell['lo'])
            need(self.f.le(width, Fraction(1, 10 ** 24)), 'certified observable width ' + path)
            maximum_width = fmaximum((maximum_width, width), self.f)
        self.memory({})
        self.owners.pop('observableScratch')
        return result, maximum_width

    def init(self, packet):
        need(self.counts['bankInitializations'] == 0 and packet['authoritySha256'] == self.args.token, 'one authorized bank initialization')
        self.pair = self.canonical_pair(packet['pairRaw']); self.owners['pair'] = self.pair
        self.source_coefficients_raw = packet['sourceCoefficientsRaw']; self.owners['sourceCoefficientsRaw'] = self.source_coefficients_raw
        coefficient_certificate = self.certify_coefficients(self.source_coefficients_raw)
        self.owners['sourceCoefficientCertificate'] = coefficient_certificate
        model = self.pair['model']; mass = model['bodies'][0]['massKg']; half = model['colliders'][0]['geometry']['halfExtentsM']
        self.geometry = self.b.integral_certificate(mass, half, self.f, self.counts)
        self.owners['geometry'] = self.geometry
        inertia = [self.geometry['tensorKgM2'][i][i] for i in range(3)]
        need(all(not self.f.le(value, Fraction(0)) for value in inertia) and
             all(not self.f.equal(inertia[i], inertia[j]) for i in range(3) for j in range(i)), 'independent positive unequal moments')
        scale = Fraction(1, 16)
        diagonal = [self.f.div(scale, value) for value in inertia]
        p0 = [self.f.div(value, scale) for value in inertia]
        initial = p0 + [Fraction(int(i == j)) for i in range(3) for j in range(3)]
        self.owners['referenceInitialVector'] = initial
        self.owners['referenceDiagonal'] = diagonal
        h = self.f.div(self.pair['options']['fixedStepSeconds'], Fraction(2))
        self.owners['nativeReferenceWindow'] = h
        for precision in (80, 120):
            engine = Intervals(precision, self.counts, self.f)
            active = {'contexts': {'down': engine.down, 'up': engine.up}}
            self.owners['precisionScratch'] = active
            d = [engine.literal(value) for value in diagonal]; active['diagonal'] = d
            state = [engine.literal(value) for value in initial]; active['state'] = state
            levels = {}; self.bank[str(precision)] = levels
            for window_index in (1, 2):
                state, certificate = self.window(state, d, h, engine, window_index)
                active['state'] = state
                active['certificate'] = certificate
                self.transient = MIB
                self.memory({})
                values, width = self.observable(state, d, engine)
                active['values'] = values
                levels[str(window_index)] = {'values': values, 'maxObservableWidth': width, 'certificate': certificate}
                self.memory({}); self.transient = 0
            # Keep the final actual Context objects rooted through bank encoding.
        for index in ('1', '2'):
            low = dict(interval_tree_rows(self.bank['80'][index]['values']))
            high = dict(interval_tree_rows(self.bank['120'][index]['values']))
            need(set(low) == set(high), 'precision observable tree')
            for path in low:
                need(self.f.le(low[path]['lo'], high[path]['hi']) and self.f.le(high[path]['lo'], low[path]['hi']), 'independently proved80/120 enclosures intersect ' + path)
        self.counts['bankInitializations'] = 1
        self.bank_pin = self.write('bank.json', {'scope': 'M_ONLY', 'geometry': self.geometry,
            'sourceCoefficients': coefficient_certificate, 'nativeWindowSeconds': h, 'bank': self.bank,
            'initialCondition': {'q': [Fraction(0), Fraction(0), Fraction(0), Fraction(1)],
                'R': [[Fraction(int(i == j)) for j in range(3)] for i in range(3)],
                'omega': [Fraction(1), Fraction(1), Fraction(1)], 'p': p0}, 'counts': dict(self.counts)})
        self.owners.pop('precisionScratch')
        return {'status': 'PASS_G1B_MICRO_BANK', 'bank': self.bank_pin, 'sourceGraphComplete': False}

    def observe_private(self, raw, state_raw, graph):
        need(type(raw) is dict and set(raw) == {'bodyId', 'inertiaDiagonalKgM2', 'orientationXYZW', 'cacheSnapshotSha256'}, 'one complete admitted private observation')
        need(raw['bodyId'] == 'rotor' and raw['orientationXYZW'] == state_raw['bodies'][0]['orientationXYZW'] and
             type(raw['cacheSnapshotSha256']) is str and len(raw['cacheSnapshotSha256']) == 64 and
             all(c in '0123456789abcdef' for c in raw['cacheSnapshotSha256']), 'private/public pose/cache binding')
        value = self.b.decode(raw); moments = value['inertiaDiagonalKgM2']
        need(type(moments) is list and len(moments) == 3 and all(not self.f.le(x, Fraction(0)) for x in moments) and
             all(not self.f.equal(moments[i], moments[j]) for i in range(3) for j in range(i)), 'observed positive unequal native Body moments')
        diagonal = [self.f.div(Fraction(1, 16), x) for x in moments]
        derivative = self.f.mul(Fraction(2), fmaximum((self.f.absolute(self.f.sub(diagonal[i], diagonal[j])) for i in range(3) for j in range(i)), self.f))
        momentum = [self.f.div(x, Fraction(1, 16)) for x in moments]
        norm_squared = self.f.dot(momentum, momentum)
        need(self.f.le(derivative, Fraction(5)) and not self.f.equal(derivative, Fraction(5)) and
             self.f.le(norm_squared, self.f.mul(Fraction(15, 16), Fraction(15, 16))) and
             not self.f.equal(norm_squared, self.f.mul(Fraction(15, 16), Fraction(15, 16))), 'actual selected native parameter support certificate')
        if graph == 'native':
            need(raw['inertiaDiagonalKgM2'] == self.private['source']['raw']['inertiaDiagonalKgM2'] and
                 raw['orientationXYZW'] == self.private['source']['raw']['orientationXYZW'], 'actual source/native admitted moment/pose words')
        differences = [self.f.sub(moments[i], self.geometry['tensorKgM2'][i][i]) for i in range(3)]
        self.private[graph] = {'raw': raw, 'observed': value, 'derivativeBoundPerSecond': derivative,
                               'scaledMomentumNormSquared': norm_squared, 'nativeMomentMinusIntegralKgM2': differences,
                               'interpretation': 'Observed rounded primitive moments; physical state truth uses independent volume integrals. Raw model q is not numeric Body q authority.'}
        self.counts['privateBodyObservations'] += 1

    def compare_trajectory(self, observed, state, index):
        actual = {'R': observed['properRotation'], 'q': state['bodies'][0]['orientationXYZW'],
                  'omega': state['bodies'][0]['angularVelocityRadps']}
        if index == 0:
            exact = {'R': [[Fraction(int(i == j)) for j in range(3)] for i in range(3)],
                     'q': [Fraction(0), Fraction(0), Fraction(0), Fraction(1)], 'omega': [Fraction(1), Fraction(1), Fraction(1)]}
            def enclose(value):
                if type(value) is list: return [enclose(x) for x in value]
                return {'lo': value, 'hi': value}
            try: targets = {'initialExact': enclose_tree(exact, enclose)}
            finally: enclose = None
        else: targets = {precision: self.bank[precision]['2']['values'] for precision in ('80', '120')}
        reports = {}
        self.owners['trajectoryScratch'] = {'actual': actual, 'targets': targets, 'reports': reports}
        for precision, target in targets.items():
            errors = {}
            for quantity in ('R', 'q', 'omega'):
                values = [x for row in actual[quantity] for x in row] if quantity == 'R' else actual[quantity]
                references = [x for row in target[quantity] for x in row] if quantity == 'R' else target[quantity]
                maximum_error = Fraction(0)
                for component, (value, cell) in enumerate(zip(values, references)):
                    for endpoint in ('lo', 'hi'):
                        error = self.f.absolute(self.f.sub(value, cell[endpoint]))
                        bound = self.f.add(Fraction(1, 10 ** 11), self.f.mul(Fraction(1, 10 ** 12), self.f.absolute(cell[endpoint])))
                        need(self.f.le(error, bound), 'strict trajectory component gate', {'quantity': quantity, 'component': component, 'precision': precision, 'actual': value, 'reference': cell, 'error': error, 'bound': bound})
                        maximum_error = fmaximum((maximum_error, error), self.f)
                errors[quantity] = maximum_error
            reports[precision] = errors
        self.owners.pop('trajectoryScratch')
        return reports

    def audit(self, packet):
        sequence = [('source', 0), ('source', 1), ('native', 0), ('native', 1)]
        need(self.counts['bankInitializations'] == 1 and self.next_audit < 4, 'bank and finite audit prefix')
        graph, index = sequence[self.next_audit]
        need(packet['graph'] == graph and type(packet['stepIndex']) is int and packet['stepIndex'] == index and
             packet['caseId'] == 'M01-triaxial-off-axis', 'fixed source-before-native case/audit order')
        need((index == 0) == ('initialPrivateRaw' in packet), 'exactly two initial private observations')
        raw = packet['stateRaw']; state = self.b.decode(raw)
        self.owners['currentState'] = state
        need(state['stepIndex'] == index and len(state['bodies']) == 1 and state['bodies'][0]['id'] == 'rotor' and
             all(not state[k] for k in ('contacts', 'joints', 'events', 'ccdHits', 'cloths', 'fluids')), 'isolated M state')
        need(self.f.equal(state['timeSeconds'], self.f.mul(Fraction(index), self.pair['options']['fixedStepSeconds'])), 'actual M state clock')
        if index == 0: self.observe_private(packet['initialPrivateRaw'], raw, graph)
        observed = self.b.observed_audit(state, self.geometry, self.pair['model']['bodies'][0]['massKg'], self.f, self.counts)
        self.owners['currentObserved'] = observed
        if index == 0: self.initial[graph] = observed
        report, failure = self.b.assessment(graph, self.initial[graph], observed, self.f, None)
        self.owners['currentAssessment'] = report
        need(failure is None, 'unchanged conservation/norm/COM/linear gate', report)
        trajectory = self.compare_trajectory(observed, state, index)
        self.owners['currentTrajectory'] = trajectory
        proof = {'graph': graph, 'caseId': 'M01-triaxial-off-axis', 'stepIndex': index,
                 'stateRawSha256': sha(wire(raw)), 'physical': report, 'trajectoryErrors': trajectory,
                 'private': self.private[graph] if index == 0 else None}
        self.owners['currentProof'] = proof
        artifact = self.write('audit-' + str(self.next_audit + 1).zfill(4) + '.json', proof, 65536)
        self.next_audit += 1
        if self.next_audit == 2: self.source_complete = True
        for key in ('currentState', 'currentObserved', 'currentAssessment', 'currentTrajectory', 'currentProof'): self.owners.pop(key)
        return {'status': 'PASS_G1B_MICRO_AUDIT', 'graph': graph, 'caseId': 'M01-triaxial-off-axis', 'stepIndex': index,
                'sourceGraphComplete': self.source_complete, 'metrics': {'physicalChecks': len(report['checks']), 'trajectoryErrors': trajectory}, 'artifact': artifact}

    def finish(self):
        need(self.source_complete and self.next_audit == 4 and self.counts['privateBodyObservations'] == 2 and
             self.counts['observedStateAuditsReturned'] == self.counts['properRationalRotationReturns'] == 4 and
             self.counts['bodyGeometryCertificatesReturned'] == 1 and self.counts['oneDimensionalMonomialMoments'] == 9 and
             self.counts['taylorWindowsAttempted'] == self.counts['taylorWindowsReturned'] == 4 and
             self.counts['decimal80Windows'] == self.counts['decimal120Windows'] == 2 and
             self.counts['endpointDecimalSqrtOperations'] == 8 and
             self.counts['algebraicBisectionDecisions'] == 1536 and self.counts['algebraicRootsCertified'] == 3,
             'complete exact M reference ledger')
        self.finished = True
        summary = self.write('summary.json', {'status': 'PASS_G1B_MICRO_FINISH', 'counts': dict(self.counts),
            'countBoundary': 'Before durable reply6; final reply carries requestsReturned6; received counts are driver-owned.',
            'bank': self.bank_pin, 'privateObservations': self.private, 'peakOwnedUpperBytes': self.peak,
            'nativeCoefficients': 'Not directly observed here; driver must authenticate actual Native words against the certified Source dataset after Source physical/helper/dispose PASS.',
            'phaseTAuthorized': False, 'productionActivation': False, 'heapOrRssClaim': False}, 65536)
        return {'status': 'PASS_G1B_MICRO_FINISH', 'sourceGraphComplete': True, 'bank': self.bank_pin, 'summary': summary}


def enclose_tree(value, convert):
    return {key: convert(item) for key, item in value.items()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ('run-id', 'freeze', 'token', 'out'): parser.add_argument('--' + key, required=True)
    args = parser.parse_args(); started = time.monotonic_ns()
    signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError('170s M reference deadline')))
    signal.setitimer(signal.ITIMER_REAL, 170)
    server = None
    try:
        freeze, baseline = authenticate(args); server = Server(args, freeze, baseline)
        ready = {'status': 'READY_G1B_MICRO_REFERENCE', 'protocol': 'G1B_MICRO_JSONL_V1', 'requestOrdinal': 0,
                 'runId': args.run_id, 'authoritySha256': args.token, 'counts': dict(server.counts)}
        server.memory(ready); sys.stdout.buffer.write(wire(ready)); sys.stdout.buffer.flush()
        line = packet = reply = response = None
        while not server.finished:
            line = packet = reply = response = None
            for key in ('activeLine', 'activePacket', 'activeReply', 'activeResponse'): server.owners.pop(key, None)
            line = sys.stdin.buffer.readline(262145)
            need(line and len(line) <= 262144 and line.endswith(b'\n'), 'bounded complete request; EOF before finish fails')
            server.owners['activeLine'] = line; server.memory({}, decode_bound(line))
            need(time.monotonic_ns() - started < 170000000000, 'deadline before next request')
            packet = parse(line); server.owners['activePacket'] = packet
            server.counts['requestsAttempted'] += 1; ordinal = server.counts['requestsAttempted']; op = packet.get('op')
            need(ordinal <= 6, 'six-request ceiling'); server.progress()
            if op == 'init': need(ordinal == 1, 'init first'); reply = server.init(packet)
            elif op == 'audit': need(2 <= ordinal <= 5, 'four consecutive audit requests'); reply = server.audit(packet)
            elif op == 'finish': need(ordinal == 6, 'finish sixth'); reply = server.finish()
            else: raise Failure('unknown M reference operation')
            reply.update(op=op, requestOrdinal=ordinal, counts={**server.counts, 'requestsReturned': server.counts['requestsReturned'] + 1})
            server.owners['activeReply'] = reply
            server.write('reply-' + str(ordinal).zfill(4) + '.json', reply, 65536)
            server.counts['requestsReturned'] += 1; server.progress()
            response = wire(reply); need(len(response) <= 65536, 'bounded reference response')
            server.owners['activeResponse'] = response; server.memory(reply)
            sys.stdout.buffer.write(response); sys.stdout.buffer.flush()
        return 0
    except BaseException as error:
        signal.setitimer(signal.ITIMER_REAL, 4)
        detail = {'type': type(error).__name__, 'message': str(error)[:2048], 'detail': getattr(error, 'detail', None)}
        if server is not None:
            failure = {'status': 'FAIL_G1B_MICRO_REFERENCE', 'op': locals().get('op'), 'requestOrdinal': server.counts['requestsAttempted'],
                       'counts': dict(server.counts), 'firstFailure': detail}
            try:
                server.progress({'type': detail['type'], 'message': detail['message']})
                failure['artifact'] = server.write('first-failure.json', failure, 57344, reserved=True)
            except BaseException as receipt_error:
                failure['firstFailure']['receiptError'] = str(receipt_error)[:512]; failure['firstFailure']['detail'] = None
            data = wire(failure)
            if len(data) > 65536: failure['firstFailure']['detail'] = None; data = wire(failure)
            sys.stdout.buffer.write(data); sys.stdout.buffer.flush()
        else: sys.stderr.write(json.dumps({'status': 'FAIL_G1B_MICRO_REFERENCE_STARTUP', 'firstFailure': {'type': detail['type'], 'message': detail['message']}}) + '\n')
        return 1
    finally: signal.setitimer(signal.ITIMER_REAL, 0)


if __name__ == '__main__': sys.exit(main())
