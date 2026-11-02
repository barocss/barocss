#!/usr/bin/env python3
"""One authorized G1a JSONL reference; no production or World imports."""
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import signal
import struct
import sys
import time
from decimal import (Decimal, Context, ROUND_FLOOR, ROUND_CEILING, InvalidOperation,
                     DivisionByZero, Overflow, FloatOperation)
from fractions import Fraction

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
MIB = 1048576
PINS = {
    'REPAIR-DESIGN-01.md': '0469f20a8131075a43d2898a51a3f7d2a297826e5c3fdbd0688b5fd8fa7be2fa',
    'REPAIR-CASES-01.json': '843069a1a614cf0a80b82fecc866051321cd992906072e4208831e991a83748a',
    'baseline-classify.py': '5f5eee9ac2cd8b654eab134823a619254fd0b7c4ab8791419d077a71413a09eb',
}
IDS = ('T01-isotropic-cube-dt60', 'T01-isotropic-cube-dt120', 'T01-isotropic-cube-dt240',
       'T02-axisymmetric-off-axis-dt60', 'T02-axisymmetric-off-axis-dt120', 'T02-axisymmetric-off-axis-dt240',
       'C01-principal-axis', 'C02-zero-positive', 'C03-zero-signed-negative-q', 'C04-off-axis-negative-q')
ENDS = (60, 120, 240, 60, 120, 240, 1, 1, 1, 1)


class Failure(Exception):
    def __init__(self, message, detail=None):
        super().__init__(message)
        self.detail = detail


def need(value, message, detail=None):
    if not value:
        raise Failure(message, detail)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def maximum(values, arithmetic):
    iterator = iter(values)
    result = next(iterator)
    for value in iterator:
        if arithmetic.le(result, value): result = value
    return result


def file_digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''):
            h.update(block)
    return h.hexdigest()


def pairs(rows):
    result = {}
    for key, value in rows:
        need(key not in result, 'duplicate JSON key')
        result[key] = value
    return result


def json_allocation_bound(data):
    # Lexical DATA census before the stdlib decoder allocates containers.
    #512B/token covers short scalar/container/pairs staging;4B/input byte
    #covers both decoded text and Unicode payload, each charged separately.
    nodes = depth = strings = bare = 0
    quoted = escaped = False
    for byte in data:
        if quoted:
            strings += 1
            if escaped: escaped = False
            elif byte == 92: escaped = True
            elif byte == 34: quoted = False
        elif byte == 34:
            nodes += 1; quoted = True; bare = 0
        elif byte in (123, 91):
            nodes += 1; depth += 1; bare = 0
        elif byte in (125, 93): depth -= 1; bare = 0
        elif byte in (9, 10, 13, 32, 44, 58): bare = 0
        else:
            if bare == 0: nodes += 1
            bare += 1
        need(nodes <= 8192 and 0 <= depth <= 32 and bare <= 1300, 'bounded JSON token/depth/scalar census')
    need(not quoted and depth == 0, 'complete JSON lexical envelope')
    return 512 * nodes + 4 * strings + 4 * len(data) + 131072


def parse(data):
    need(json_allocation_bound(data) <= 6 * MIB, 'JSON decode allocation envelope')
    return json.loads(data, object_pairs_hook=pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(Failure('non-JSON number')))


def load(path, expected=None, limit=MIB):
    path = Path(path)
    need(path.stat().st_size <= limit, 'bounded input ' + str(path))
    data = path.read_bytes()
    if expected:
        need(len(data) == expected['bytes'] and digest(data) == expected['sha256'], 'artifact pin ' + str(path))
    return parse(data)


def encoded(value):
    if type(value) is Fraction:
        need(max(value.numerator.bit_length(), value.denominator.bit_length()) <= 4096, 'serialized Fraction bit bound')
        return {'numerator': str(value.numerator), 'denominator': str(value.denominator)}
    if type(value) is dict:
        return {key: encoded(item) for key, item in value.items()}
    if type(value) in (list, tuple):
        return [encoded(item) for item in value]
    return value


def wire(value):
    return (json.dumps(encoded(value), ensure_ascii=True, allow_nan=False, separators=(',', ':')) + '\n').encode('ascii')


def authenticate(args):
    need(Path(args.freeze).stat().st_size <= 262144, 'bounded parent freeze before read')
    raw = Path(args.freeze).read_bytes()
    need(len(raw) <= 262144 and digest(raw) == args.token, 'explicit parent token')
    need(json_allocation_bound(raw) + 2 * len(raw) + 2 * MIB <= 8 * MIB, 'authorization DATA within reference envelope')
    freeze = parse(raw)
    need(freeze['status'] == 'PARENT_AUTHORIZED_G1A_REPAIR_QUALIFICATION' and
         freeze['mode'] == 'G1A_STAGED_REPAIR_ONLY' and freeze['runtimeAuthorized'] is True and
         freeze['productionActivation'] is False and freeze['runId'] == args.run_id, 'staged repair authorization')
    for name in ['REPAIR-DESIGN-01.md', 'REPAIR-CASES-01.json', 'REPAIR-AUTHORING-FREEZE-01.json',
                 'rigid-free-rotation.ts', 'CANDIDATE-READY.json', 'repair-reference.py',
                 'REFERENCE-READY.json', 'REFERENCE-PROTOCOL.md', 'baseline-classify.py']:
        need(str(HERE.relative_to(ROOT) / name) in freeze['files'], 'complete provider pin ' + name)
    for name, pin in freeze['files'].items():
        path = (ROOT / name).resolve()
        need(path.is_relative_to(ROOT) and path.stat().st_size == pin['bytes'] and file_digest(path) == pin['sha256'], 'source pin ' + name)
    for name, pin in freeze['toolFiles'].items():
        path = Path(name)
        need(path.is_absolute() and path.stat().st_size == pin['bytes'] and file_digest(path) == pin['sha256'], 'tool pin ' + name)
    need(Path(sys.executable).resolve() == Path(freeze['tools']['python']).resolve(), 'actual Python provider')
    need(freeze['highReview']['approved'] is True and freeze['highReview']['path'] in freeze['files'], 'High review prerequisite')
    for name, expected in PINS.items():
        need(file_digest(HERE / name) == expected, 'immutable reference authority ' + name)
    recipes = load(HERE / 'REPAIR-CASES-01.json')
    for name, expected in recipes['immutableInputs'].items():
        need(file_digest(HERE / name) == expected, 'preserved original authority ' + name)
    spec = importlib.util.spec_from_file_location('g1_frozen_baseline_reference', HERE / 'baseline-classify.py')
    baseline = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(baseline)
    return freeze, recipes, baseline


class Interval:
    """Directed Decimal endpoints. Methods never change the caller context."""
    def __init__(self, precision, counts, arithmetic):
        self.precision, self.counts, self.f = precision, counts, arithmetic
        self.down = Context(prec=precision, rounding=ROUND_FLOOR, Emin=-999999, Emax=999999, capitals=1, clamp=0)
        self.up = Context(prec=precision, rounding=ROUND_CEILING, Emin=-999999, Emax=999999, capitals=1, clamp=0)
        for context in (self.down, self.up):
            for key in context.traps:
                context.traps[key] = key in (InvalidOperation, DivisionByZero, Overflow, FloatOperation)
                context.flags[key] = False

    def check(self, value):
        self.counts['decimalOperations'] += 1
        need(self.counts['decimalOperations'] <= 10000000, 'fixed Decimal operation resource bound')
        need(value.is_finite() and len(value.as_tuple().digits) <= 2048, 'finite bounded Decimal')
        return value

    def literal(self, value):
        if type(value) is int:
            d = Decimal(value)
            return d, d
        need(type(value) is Fraction, 'rational interval input')
        a, b = Decimal(str(value.numerator)), Decimal(str(value.denominator))
        return self.check(self.down.divide(a, b)), self.check(self.up.divide(a, b))

    def add(self, a, b):
        return self.check(self.down.add(a[0], b[0])), self.check(self.up.add(a[1], b[1]))

    def neg(self, a):
        return a[1].copy_negate(), a[0].copy_negate()

    def sub(self, a, b):
        return self.check(self.down.subtract(a[0], b[1])), self.check(self.up.subtract(a[1], b[0]))

    def mul(self, a, b):
        lows = [self.check(self.down.multiply(x, y)) for x in a for y in b]
        highs = [self.check(self.up.multiply(x, y)) for x in a for y in b]
        return min(lows), max(highs)

    def div(self, a, b):
        need(not b[0] <= Decimal(0) <= b[1], 'interval divisor excludes zero')
        reciprocal = (self.check(self.down.divide(Decimal(1), b[1])), self.check(self.up.divide(Decimal(1), b[0])))
        return self.mul(a, reciprocal)

    def sqrt(self, a):
        self.counts['sqrtEvaluations'] += 1
        need(self.counts['sqrtEvaluations'] <= 24 and a[0] >= Decimal(0), 'bounded nonnegative square root')
        lo = Decimal(0) if a[0].is_zero() else self.down.next_minus(self.down.sqrt(a[0]))
        hi = Decimal(0) if a[1].is_zero() else self.up.next_plus(self.up.sqrt(a[1]))
        lo, hi = self.check(lo), self.check(hi)
        lower, upper = self.f.checked(Fraction(lo)), self.f.checked(Fraction(hi))
        left, right = self.f.checked(Fraction(a[0])), self.f.checked(Fraction(a[1]))
        need(self.f.le(self.f.mul(lower, lower), left) and self.f.le(right, self.f.mul(upper, upper)), 'root endpoint square enclosure')
        return lo, hi

    def trig(self, x, cosine, remainder):
        self.counts['sinCosEvaluations'] += 1
        need(self.counts['sinCosEvaluations'] <= 80 and x[0] >= Decimal(-2) and x[1] <= Decimal(2), 'fixed trig population/argument')
        if x[0].is_zero() and x[1].is_zero():
            return self.literal(1 if cosine else 0)
        term = self.literal(1) if cosine else x
        total, square = term, self.mul(x, x)
        for k in range(1, 128):
            denominator = (2 * k - 1) * (2 * k) if cosine else (2 * k) * (2 * k + 1)
            term = self.neg(self.div(self.mul(term, square), self.literal(denominator)))
            total = self.add(total, term)
            self.counts['taylorRecurrences'] += 1
        radius = self.literal(remainder)
        return self.sub(total, radius)[0], self.add(total, radius)[1]

    def dot(self, a, b):
        total = self.literal(0)
        for x, y in zip(a, b):
            total = self.add(total, self.mul(x, y))
        return total

    def cross(self, a, b):
        return [self.sub(self.mul(a[1], b[2]), self.mul(a[2], b[1])),
                self.sub(self.mul(a[2], b[0]), self.mul(a[0], b[2])),
                self.sub(self.mul(a[0], b[1]), self.mul(a[1], b[0]))]

    def vector(self, values):
        return [self.literal(x) for x in values]

    def vadd(self, a, b):
        return [self.add(x, y) for x, y in zip(a, b)]

    def vscale(self, a, scalar):
        return [self.mul(x, scalar) for x in a]

    def matrix_product(self, a, b):
        return [[self.dot(row, [b[k][j] for k in range(3)]) for j in range(3)] for row in a]

    def fractions(self, value):
        if type(value) is tuple and len(value) == 2 and type(value[0]) is Decimal:
            return {'lo': self.f.checked(Fraction(value[0])), 'hi': self.f.checked(Fraction(value[1]))}
        if type(value) is list:
            return [self.fractions(x) for x in value]
        return {key: self.fractions(item) for key, item in value.items()}

    def report(self):
        return [{'precision': c.prec, 'rounding': c.rounding, 'Emin': c.Emin, 'Emax': c.Emax,
                 'capitals': c.capitals, 'clamp': c.clamp,
                 'traps': {k.__name__: v for k, v in c.traps.items()},
                 'flags': {k.__name__: v for k, v in c.flags.items()}} for c in (self.down, self.up)]


def transpose(matrix):
    return [list(row) for row in zip(*matrix)]


def outer(a, b, engine):
    return [[engine.mul(x, y) for y in b] for x in a]


def matrix_sum(matrices, engine):
    return [[sum_intervals([m[i][j] for m in matrices], engine) for j in range(3)] for i in range(3)]


def sum_intervals(values, engine):
    total = engine.literal(0)
    for value in values:
        total = engine.add(total, value)
    return total


def interval_rows(value, path=''):
    if type(value) is dict and set(value) == {'lo', 'hi'}:
        yield path, value
    elif type(value) is dict:
        for key, child in value.items():
            yield from interval_rows(child, path + '/' + key)
    else:
        for i, child in enumerate(value):
            yield from interval_rows(child, path + '/' + str(i))


def analytic_sample(kind, t, A, C, norm, engine, sin_remainder, cos_remainder):
    """Full-angle Euler/triad reference; no candidate quaternion product."""
    e = engine
    zero, one = e.literal(0), e.literal(1)
    z = [zero, zero, one]
    ti, ai, ci = e.literal(t), e.literal(A), e.literal(C)
    if kind == 'axial':
        momentum = e.vector([A, Fraction(0), C])
        n = e.vscale(momentum, e.div(one, norm))
        speed = e.div(norm, ai)
        phase = e.mul(speed, ti)
        sn = e.trig(phase, False, sin_remainder)
        cs = e.trig(phase, True, cos_remainder)
        nz = e.cross(n, z)
        projection = e.dot(n, z)
        axis = e.vadd(e.vadd(e.vscale(z, cs), e.vscale(nz, sn)), e.vscale(n, e.mul(projection, e.sub(one, cs))))
        axis_dot = e.vadd(e.vadd(e.vscale(z, e.neg(e.mul(speed, sn))), e.vscale(nz, e.mul(speed, cs))),
                         e.vscale(n, e.mul(projection, e.mul(speed, sn))))
        beta = e.div(e.sub(ci, ai), ai)
        bp = e.mul(beta, ti)
        sb = e.trig(bp, False, sin_remainder)
        cb = e.trig(bp, True, cos_remainder)
        p = [cb, sb, zero]
        pd = e.vscale([e.neg(sb), cb, zero], beta)
        q, qd = e.cross(z, p), e.cross(z, pd)
        P = e.vscale(e.vadd(momentum, e.vscale(axis, e.neg(ci))), e.div(one, ai))
        Pd = e.vscale(axis_dot, e.neg(e.div(ci, ai)))
        Q = e.cross(axis, P)
        Qd = e.vadd(e.cross(axis_dot, P), e.cross(axis, Pd))
        rotation = matrix_sum([outer(P, p, e), outer(Q, q, e), outer(axis, z, e)], e)
        derivative = matrix_sum([outer(Pd, p, e), outer(P, pd, e), outer(Qd, q, e), outer(Q, qd, e), outer(axis_dot, z, e)], e)
        body_omega = [cb, sb, one]
        omega = [e.dot(row, body_omega) for row in rotation]
        body_derivative = [e.neg(e.mul(beta, sb)), e.mul(beta, cb), zero]
        euler = [e.add(e.mul(ai, body_derivative[0]), e.mul(e.sub(ci, ai), e.mul(body_omega[1], body_omega[2]))),
                 e.add(e.mul(ai, body_derivative[1]), e.mul(e.sub(ai, ci), e.mul(body_omega[2], body_omega[0]))),
                 e.mul(ci, body_derivative[2])]
    else:
        w = [Fraction(0), Fraction(0), Fraction(1)] if kind == 'principal' else [Fraction(1), Fraction(0), Fraction(1)]
        omega = e.vector(w)
        n = e.vscale(omega, e.div(one, norm))
        phase = e.mul(norm, ti)
        sn, cs = e.trig(phase, False, sin_remainder), e.trig(phase, True, cos_remainder)
        rotation = [[e.add(e.add(e.mul(one if i == j else zero, cs),
                                  e.mul(e.mul(n[i], n[j]), e.sub(one, cs))),
                              e.mul(e.cross(n, e.vector([int(k == j) for k in range(3)]))[i], sn)) for j in range(3)] for i in range(3)]
        derivative = [[e.add(e.add(e.mul(one if i == j else zero, e.neg(e.mul(norm, sn))),
                                    e.mul(e.mul(n[i], n[j]), e.mul(norm, sn))),
                                e.mul(e.cross(n, e.vector([int(k == j) for k in range(3)]))[i], e.mul(norm, cs))) for j in range(3)] for i in range(3)]
        euler = [zero, zero, zero]
        momentum = e.vector([Fraction(0), Fraction(0), C] if kind == 'principal' else [A, Fraction(0), A])
    trace = sum_intervals([rotation[i][i] for i in range(3)], e)
    qw = e.div(e.sqrt(e.add(one, trace)), e.literal(2))
    need(qw[0] > Decimal('0.5'), 'continuous quaternion trace branch is safely positive')
    den = e.mul(e.literal(4), qw)
    quaternion = [e.div(e.sub(rotation[2][1], rotation[1][2]), den),
                  e.div(e.sub(rotation[0][2], rotation[2][0]), den),
                  e.div(e.sub(rotation[1][0], rotation[0][1]), den), qw]
    residues = list(euler)
    for j in range(3):
        cross = e.cross(omega, [rotation[i][j] for i in range(3)])
        residues.extend(e.sub(derivative[i][j], cross[i]) for i in range(3))
    ortho = e.matrix_product(transpose(rotation), rotation)
    residues.extend(e.sub(ortho[i][j], one if i == j else zero) for i in range(3) for j in range(3))
    body_tensor = [[ai if i == j and i < 2 else ci if i == j else zero for j in range(3)] for i in range(3)]
    world = e.matrix_product(e.matrix_product(rotation, body_tensor), transpose(rotation))
    actual_momentum = [e.dot(row, omega) for row in world]
    residues.extend(e.sub(a, b) for a, b in zip(actual_momentum, momentum))
    energy_fraction = e.f.div(C, Fraction(2)) if kind == 'principal' else A if kind == 'cube' else e.f.div(e.f.add(A, C), Fraction(2))
    expected_energy = e.literal(energy_fraction)
    residues.append(e.sub(e.div(e.dot(omega, actual_momentum), e.literal(2)), expected_energy))
    determinant = e.dot(rotation[0], e.cross(rotation[1], rotation[2]))
    residues.append(e.sub(determinant, one))
    result = e.fractions({'q': quaternion, 'R': rotation, 'omega': omega})
    residuals = e.fractions(residues)
    limit = Fraction(1, 10 ** (65 if e.precision == 80 else 105))
    max_width = Fraction(0)
    for path, cell in interval_rows(result):
        width = e.f.sub(cell['hi'], cell['lo'])
        need(e.f.le(width, limit), 'analytic component enclosure width ' + path)
        max_width = maximum((max_width, width), e.f)
    for cell in residuals:
        need(e.f.le(cell['lo'], Fraction(0)) and e.f.le(Fraction(0), cell['hi']) and e.f.le(e.f.sub(cell['hi'], cell['lo']), limit), 'analytic derivative/invariant enclosure')
    return result, {'maxComponentWidth': max_width, 'residualCount': len(residuals), 'allResidualsEncloseZero': True,
                    'contexts': e.report(), 'positiveQwLower': e.f.checked(Fraction(qw[0]))}


class Server:
    def __init__(self, args, freeze, recipes, baseline):
        self.args, self.freeze, self.recipes, self.b = args, freeze, recipes, baseline
        self.counts = {key: 0 for key in ('requestsAttempted', 'requestsReturned', 'bankInitializations',
            'bodyGeometryCertificatesAttempted', 'bodyGeometryCertificatesReturned', 'oneDimensionalMonomialMoments',
            'observedStateAuditsAttempted', 'observedStateAuditsReturned', 'properRationalRotationAttempts',
            'properRationalRotationReturns', 'fractionScalarOperations', 'decimalOperations', 'sinCosEvaluations',
            'sqrtEvaluations', 'taylorRecurrences', 'decimal80Evaluations', 'decimal120Evaluations',
            'WorldCalls', 'candidateCalls', 'nativeFixtureConversions', 'odeSolves', 'linearSolves')}
        class BoundedArithmetic(baseline.Arithmetic):
            def operation(inner):
                inner.counts['fractionScalarOperations'] += 1
                need(inner.counts['fractionScalarOperations'] <= 10000000, 'Fraction10M operation bound')
        self.f = BoundedArithmetic(self.counts)
        self.owners = {'freeze': freeze, 'recipes': recipes, 'counts': self.counts}
        self.configs, self.certificates, self.bank, self.initial, self.errors = {}, {}, {}, {}, {}
        self.owners.update(configs=self.configs, certificates=self.certificates, bank=self.bank, initial=self.initial, errors=self.errors)
        self.transient_allowance = 0
        self.graph, self.case_cursor, self.index = 'source', 0, -1
        self.source_complete = self.finished = False
        self.stored = 0
        self.peak = 0
        self.out = Path(args.out).resolve()
        need(self.out.is_relative_to(HERE / 'evidence'), 'owned fresh reference directory')
        self.out.mkdir(parents=True, exist_ok=False)
        self.bank_pin = None

    def memory(self, value, extra=0):
        bound = self.b.working_bound(self.owners, value)
        # Original2MiB baseline allowance covers traversal/scalar/encoder work.
        # The analytic interval phase adds a separate proved1MiB envelope.
        bound['extraLiveIntervalOrDecodeBytes'] = self.transient_allowance + extra
        bound['ownedUpperBytes'] += self.transient_allowance + extra
        need(bound['ownedUpperBytes'] <= 8 * MIB, 'full current reference owned8MiB precharge')
        self.peak = max(self.peak, bound['ownedUpperBytes'])
        return bound

    def write(self, name, value, limit=MIB, reserved=False):
        self.memory(value)
        data = wire(value)
        need(len(data) <= limit and self.stored + len(data) <= 8 * MIB - (8192 if reserved else 65536), 'reference evidence byte ceiling')
        path = self.out / name
        with path.open('xb') as stream:
            stream.write(data)
        self.stored += len(data)
        return {'path': name, 'bytes': len(data), 'sha256': digest(data)}

    def progress(self, failure=None):
        value = {'counts': self.counts, 'graph': self.graph, 'caseCursor': self.case_cursor,
                 'stepIndex': self.index, 'sourceGraphComplete': self.source_complete, 'firstFailure': failure}
        self.memory(value)
        data = wire(value)
        need(len(data) <= 8192, 'bounded progress')
        (self.out / 'progress.json').write_bytes(data)

    def base_raw(self):
        summary = load(HERE / 'evidence/g1-baseline-01/summary.json')
        self.owners['baselineSummary'] = summary
        need(summary['status'] == 'CHARACTERIZED_PHYSICAL_NO_GO', 'preserved baseline prerequisite')
        closed_pin = summary['closedCapture']
        closed = load(closed_pin['path'], closed_pin, 65536)
        self.owners['baselineClosed'] = closed
        base = load(closed['inputPin']['path'], closed['inputPin'], 65536)
        self.owners.pop('baselineSummary'); self.owners.pop('baselineClosed')
        return base

    def init(self, packet):
        need(self.counts['bankInitializations'] == 0 and packet['authoritySha256'] == self.args.token, 'one authorized bank')
        rows = packet['cases']
        need(type(rows) is list and [x['caseId'] for x in rows] == list(IDS), 'exact10 ordered input pairs')
        base = self.base_raw()
        scratch = {'base': base, 'rows': rows}
        self.owners['initScratch'] = scratch
        for i, row in enumerate(rows):
            expected = copy.deepcopy(base)
            scratch['expected'] = expected
            if i < 3:
                expected['model']['colliders'][0]['geometry']['halfExtentsM'][2] = copy.deepcopy(expected['model']['colliders'][0]['geometry']['halfExtentsM'][0])
            shift = 1 if i in (0, 3) else -1 if i in (2, 5) else 0
            cell = expected['options']['fixedStepSeconds']
            word = int.from_bytes(bytes.fromhex(cell['$f64le']), 'little')
            cell['$f64le'] = (word + shift * (1 << 52)).to_bytes(8, 'little').hex()
            initial = expected['model']['bodies'][0]['initial']
            zero = {'$f64le': '0000000000000000'}
            negative_zero = {'$f64le': '0000000000000080'}
            one = {'$f64le': '000000000000f03f'}
            minus_one = {'$f64le': '000000000000f0bf'}
            if i == 6: initial['angularVelocityRadps'] = [zero, zero, one]
            if i == 7: initial['angularVelocityRadps'] = [zero, zero, zero]
            if i == 8:
                initial['orientationXYZW'] = [negative_zero, zero, negative_zero, minus_one]
                initial['angularVelocityRadps'] = [negative_zero, zero, negative_zero]
            if i == 9: initial['orientationXYZW'] = [zero, zero, zero, minus_one]
            need(row['pairRaw'] == expected, 'canonical native input words ' + IDS[i])
            pair = self.b.decode(row['pairRaw'])
            self.configs[IDS[i]] = {'pair': pair, 'end': ENDS[i], 'family': 'cube' if i < 3 else 'principal' if i == 6 else 'zero' if i in (7, 8) else 'axial', 'negativeQ': i in (8, 9)}
        # The exact input transport line remains owned. Release its parsed
        #duplicate cases after canonical-word checks; decoded configs persist.
        packet['cases'] = None
        scratch['rows'] = scratch['expected'] = None
        rows = row = expected = pair = initial = None
        for name, cid in [('cube', IDS[0]), ('axial', IDS[3])]:
            model = self.configs[cid]['pair']['model']
            self.certificates[name] = self.b.integral_certificate(model['bodies'][0]['massKg'], model['colliders'][0]['geometry']['halfExtentsM'], self.f, self.counts)
        self.memory({})
        times = [self.f.mul(Fraction(ENDS[i]), self.configs[IDS[i]]['pair']['options']['fixedStepSeconds']) for i in range(6)]
        scratch['times'] = times
        need(all(self.f.equal(t, times[0]) for t in times), 'identical exact matched durations')
        factorial = 1
        for i in range(1, 258): factorial *= i
        sin_rem = self.f.checked(Fraction(1 << 257, factorial))
        cos_rem = self.f.checked(Fraction(1 << 256, factorial // 257))
        self.owners['TaylorRemainders'] = {'sin': sin_rem, 'cos': cos_rem}
        self.owners['normalizationContexts'] = {}
        self.owners['initialConditionCertificate'] = {
            'R0': [[Fraction(int(i == j)) for j in range(3)] for i in range(3)],
            'q0Signs': {'positive': Fraction(1), 'negative': Fraction(-1)},
            'symbolicT0': 'sin0=0/cos0=1; triads P=p=e1,Q=q=e2,a=e3; R0=I; body/world omega and momentum match original input; zero spin exact',
            'noAdditionalAnalyticEvaluations': True}
        tensor = self.certificates['axial']['tensorKgM2']
        A, C = tensor[0][0], tensor[2][2]
        cube_A = self.certificates['cube']['tensorKgM2'][0][0]
        for precision in (80, 120):
            # <=2048 live Decimal endpoints at<=384B, <=1024 small
            # containers/references and <=131072B scalar/frame scratch.
            # The actual constants/Taylor inputs here are <=510digits.
            self.transient_allowance = MIB
            self.memory({})
            constant_engine = Interval(precision, self.counts, self.f)
            norms = {'cube': constant_engine.sqrt(constant_engine.literal(Fraction(2))),
                     'axial': constant_engine.sqrt(constant_engine.literal(self.f.add(self.f.mul(A, A), self.f.mul(C, C)))),
                     'principal': constant_engine.literal(1)}
            scratch['normalizationIntervals'] = norms
            scratch['normalizationContexts'] = {'down': constant_engine.down, 'up': constant_engine.up}
            self.owners['normalizationContexts'][str(precision)] = constant_engine.report()
            for family in ('cube', 'axial', 'principal'):
                sample_times = [self.f.div(self.f.mul(times[0], Fraction(k)), Fraction(4)) for k in range(1, 5)] if family != 'principal' else []
                if family in ('axial', 'principal'): sample_times.append(self.configs[IDS[4]]['pair']['options']['fixedStepSeconds'])
                scratch['sampleTimes'] = sample_times
                for t in sample_times:
                    e = Interval(precision, self.counts, self.f)
                    scratch['activeContexts'] = {'down': e.down, 'up': e.up}
                    self.counts['decimal' + str(precision) + 'Evaluations'] += 1
                    values, proof = analytic_sample(family, t, cube_A if family == 'cube' else A,
                                                    cube_A if family == 'cube' else C, norms[family], e, sin_rem, cos_rem)
                    key = self.bank_key(family, t)
                    self.bank.setdefault(key, {})[str(precision)] = {'values': values, 'proof': proof}
                    self.memory({})
        self.transient_allowance = 0
        for key, levels in self.bank.items():
            low, high = dict(interval_rows(levels['80']['values'])), dict(interval_rows(levels['120']['values']))
            need(set(low) == set(high), 'precision tree')
            for path in low:
                need(self.f.le(low[path]['lo'], high[path]['lo']) and self.f.le(high[path]['lo'], high[path]['hi']) and self.f.le(high[path]['hi'], low[path]['hi']), '120 enclosed by80 ' + key + path)
        need(len(self.bank) == 10 and self.counts['sqrtEvaluations'] <= 24, 'fixed analytic bank population')
        self.counts['bankInitializations'] = 1
        self.owners.pop('initScratch'); base = rows = expected = scratch = constant_engine = e = norms = values = proof = None
        self.bank_pin = self.write('analytic-bank.json', {'bank': self.bank, 'geometry': self.certificates,
                                  'normalizationContexts': self.owners['normalizationContexts'],
                                  'initialConditionCertificate': self.owners['initialConditionCertificate'], 'counts': dict(self.counts)})
        return {'status': 'PASS_G1A_REFERENCE_BANK', 'bank': self.bank_pin, 'sourceGraphComplete': False}

    @staticmethod
    def bank_key(family, time_value):
        return family + ':' + str(time_value.numerator) + '/' + str(time_value.denominator)

    def target(self, config, step):
        f = self.f
        if step == 0 or config['family'] == 'zero':
            q = config['pair']['model']['bodies'][0]['initial']['orientationXYZW']
            w = config['pair']['model']['bodies'][0]['initial']['angularVelocityRadps']
            identity = [[Fraction(int(i == j)) for j in range(3)] for i in range(3)]
            def exact(value):
                if type(value) is list: return [exact(x) for x in value]
                return {'lo': value, 'hi': value}
            try: return {'q': exact(q), 'R': exact(identity), 'omega': exact(w)}
            finally: exact = None
        t = f.mul(Fraction(step), config['pair']['options']['fixedStepSeconds'])
        key = self.bank_key(config['family'], t)
        if key not in self.bank: return None
        value = self.bank[key]['120']['values']
        if config['negativeQ']:
            return {**value, 'q': [{'lo': f.neg(x['hi']), 'hi': f.neg(x['lo'])} for x in value['q']]}
        return value

    def compare_trajectory(self, actual, target):
        errors = {}
        for key in ('R', 'omega', 'q'):
            maximum_error = Fraction(0)
            native = actual[key]
            if key == 'R': native = [x for row in native for x in row]
            reference = target[key]
            if key == 'R': reference = [x for row in reference for x in row]
            for i, (value, cell) in enumerate(zip(native, reference)):
                error = maximum((self.f.absolute(self.f.sub(value, cell['lo'])), self.f.absolute(self.f.sub(value, cell['hi']))), self.f)
                scale = maximum((self.f.absolute(cell['lo']), self.f.absolute(cell['hi'])), self.f)
                bound = self.f.add(Fraction(1, 10 ** 11), self.f.mul(Fraction(1, 10 ** 12), scale))
                need(self.f.le(error, bound), 'trajectory component gate', {'quantity': key, 'component': i, 'actual': value, 'reference': cell, 'error': error, 'bound': bound})
                maximum_error = maximum((maximum_error, error), self.f)
            errors[key] = maximum_error
        return errors

    def check_refinement(self, graph):
        reports = []
        for prefix in ('T01-isotropic-cube', 'T02-axisymmetric-off-axis'):
            for coarse, fine in (('dt60', 'dt120'), ('dt120', 'dt240')):
                a, b = (graph + ':' + prefix + '-' + x for x in (coarse, fine))
                if a not in self.errors or b not in self.errors: continue
                for observable in ('R', 'omega', 'q'):
                    high, low = self.errors[a][observable], self.errors[b][observable]
                    bound = maximum((self.f.div(high, Fraction(9, 5)), Fraction(1, 10 ** 11)), self.f)
                    need(self.f.le(low, bound), 'three-dt refinement', {'graph': graph, 'family': prefix, 'observable': observable, 'coarse': high, 'fine': low, 'bound': bound})
                    reports.append({'family': prefix, 'pair': coarse + '->' + fine, 'observable': observable,
                                    'coarseError': high, 'fineError': low, 'bound': bound,
                                    'roundingFloor': self.f.le(high, Fraction(1, 10 ** 11)) and self.f.le(low, Fraction(1, 10 ** 11))})
        return reports

    def audit(self, packet):
        need(self.counts['bankInitializations'] == 1 and not self.finished, 'bank before audits')
        graph, cid, index = packet['graph'], packet['caseId'], packet['stepIndex']
        need(graph == self.graph and self.case_cursor < 10 and cid == IDS[self.case_cursor] and type(index) is int and index == self.index + 1, 'fixed source/native case/cursor order')
        config = self.configs[cid]
        need(index <= config['end'], 'fixed case step ceiling')
        raw = packet['stateRaw']
        state = self.b.decode(raw)
        self.owners['currentStateRaw'] = raw; self.owners['currentState'] = state
        need(state['stepIndex'] == index and len(state['bodies']) == 1 and state['bodies'][0]['id'] == 'rotor', 'actual state cursor/body')
        need(all(not state[key] for key in ('contacts', 'joints', 'events', 'ccdHits', 'cloths', 'fluids')), 'isolated free plant')
        geometry = self.certificates['cube' if config['family'] == 'cube' else 'axial']
        observed = self.b.observed_audit(state, geometry, config['pair']['model']['bodies'][0]['massKg'], self.f, self.counts)
        self.owners['currentObserved'] = observed
        location = graph + ':' + cid
        if index == 0: self.initial[location] = observed
        item, failure = self.b.assessment(location, self.initial[location], observed, self.f, None)
        self.owners['currentAssessment'] = item
        need(failure is None, 'conservation/norm/COM physical gate', item)
        target = self.target(config, index)
        self.owners['currentTarget'] = target
        trajectory = {'checked': target is not None}
        self.owners['currentTrajectory'] = trajectory
        if target is not None:
            errors = self.compare_trajectory({'R': observed['properRotation'], 'omega': state['bodies'][0]['angularVelocityRadps'], 'q': state['bodies'][0]['orientationXYZW']}, target)
            trajectory['errors'] = errors
            maxima = self.errors.setdefault(location, {key: Fraction(0) for key in ('R', 'omega', 'q')})
            for key in maxima: maxima[key] = maximum((maxima[key], errors[key]), self.f)
        self.index = index
        completed = index == config['end']
        refinement = self.check_refinement(graph) if completed else []
        self.owners['currentRefinement'] = refinement
        if completed:
            self.case_cursor += 1; self.index = -1
            if self.case_cursor == 10 and graph == 'source':
                need(self.counts['observedStateAuditsReturned'] == 854, 'complete854 source audits')
                self.source_complete = True; self.graph = 'native'; self.case_cursor = 0
            elif self.case_cursor == 10:
                need(self.counts['observedStateAuditsReturned'] == 1708, 'complete1708 audits')
        # All18 checks executed above. Persist each distinct current residual/
        # bound once; initial metrics are pinned once and unchanged zero checks
        # are represented by their exact maximum, not repeated verbose records.
        compact = {'angularMomentum': [{'residual': c['residual'], 'bound': c['bound']} for c in item['checks'][:3]],
                   'rotationalEnergy': {k: item['checks'][3][k] for k in ('residual', 'bound')},
                   'quaternionSquaredNorm': {'residual': self.f.sub(observed['quaternionSquaredNorm'], Fraction(1)), 'bound': Fraction(1, 10 ** 12)},
                   'maxLinearMomentum': {'residual': maximum((self.f.absolute(x) for x in observed['linearMomentumKgMps']), self.f), 'bound': Fraction(1, 10 ** 12)},
                   'maxComPosition': {'residual': maximum((self.f.absolute(x) for x in observed['comPositionM']), self.f), 'bound': Fraction(1, 10 ** 12)}}
        proof = {'graph': graph, 'caseId': cid, 'stepIndex': index, 'checkedComponents': len(item['checks']),
                 'conservation': compact, 'trajectory': trajectory}
        if index == 0: proof['initialMetrics'] = observed
        if refinement: proof['refinement'] = refinement
        self.owners['currentProof'] = proof
        artifact = self.write('audit-' + str(self.counts['observedStateAuditsReturned']).zfill(4) + '.json', proof, 32768)
        for key in ('currentStateRaw', 'currentState', 'currentObserved', 'currentProof',
                    'currentAssessment', 'currentTarget', 'currentTrajectory', 'currentRefinement'): self.owners.pop(key)
        return {'status': 'PASS_G1A_STATE_AUDIT', 'graph': graph, 'caseId': cid, 'stepIndex': index,
                'sourceGraphComplete': self.source_complete, 'metrics': {'physicalChecks': len(item['checks']), 'trajectory': trajectory}, 'artifact': artifact}

    def finish(self):
        need(self.source_complete and self.graph == 'native' and self.case_cursor == 10 and self.counts['observedStateAuditsReturned'] == 1708, 'complete finite population before finish')
        need(self.counts['bodyGeometryCertificatesReturned'] == 2 and self.counts['oneDimensionalMonomialMoments'] == 18 and
             self.counts['decimal80Evaluations'] == self.counts['decimal120Evaluations'] == 10 and
             self.counts['properRationalRotationReturns'] == 1708, 'actual fixed reference ledger')
        self.finished = True
        refinement = {g: self.check_refinement(g) for g in ('source', 'native')}
        summary = self.write('summary.json', {'status': 'PASS_G1A_REFERENCE_FINISH', 'counts': dict(self.counts), 'refinement': refinement,
                             'countBoundary': 'Math/audits complete; counts before committing finish response; final packet gives durable returned count1710',
                             'bank': self.bank_pin, 'peakOwnedUpperBytes': self.peak, 'RSSClaim': False}, 65536)
        return {'status': 'PASS_G1A_REFERENCE_FINISH', 'sourceGraphComplete': True, 'refinement': refinement, 'bank': self.bank_pin, 'summary': summary}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('run-id', 'freeze', 'token', 'out'): parser.add_argument('--' + name, required=True)
    args = parser.parse_args()
    started = time.monotonic_ns()
    signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError('170s reference deadline')))
    signal.setitimer(signal.ITIMER_REAL, 170)
    server = None
    try:
        freeze, recipes, baseline = authenticate(args)
        server = Server(args, freeze, recipes, baseline)
        ready = {'status': 'READY_G1A_REFERENCE', 'protocol': 'G1A_REFERENCE_JSONL_V1', 'requestOrdinal': 0,
                 'runId': args.run_id, 'authoritySha256': args.token, 'counts': dict(server.counts)}
        sys.stdout.buffer.write(wire(ready)); sys.stdout.buffer.flush()
        line = packet = reply = response = None
        while not server.finished:
            line = packet = reply = response = None
            for key in ('activeLine', 'activePacket', 'activeReply', 'activeResponse'): server.owners.pop(key, None)
            line = sys.stdin.buffer.readline(262145)
            need(line and len(line) <= 262144 and line.endswith(b'\n'), 'bounded complete JSONL request; EOF before finish is failure')
            server.owners['activeLine'] = line
            server.memory({}, extra=json_allocation_bound(line))
            need(time.monotonic_ns() - started < 170000000000, 'reference deadline before request')
            packet = parse(line)
            server.owners['activePacket'] = packet
            op = packet.get('op')
            server.counts['requestsAttempted'] += 1
            ordinal = server.counts['requestsAttempted']
            need(ordinal <= 1710, 'fixed1710 request limit')
            server.progress()
            if op == 'init':
                need(ordinal == 1, 'init request first')
                reply = server.init(packet)
            elif op == 'audit': reply = server.audit(packet)
            elif op == 'finish':
                need(ordinal == 1710, 'finish request ordinal')
                reply = server.finish()
            else: raise Failure('unknown protocol operation')
            reply.update(op=op, requestOrdinal=ordinal, counts={**server.counts, 'requestsReturned': server.counts['requestsReturned'] + 1})
            server.owners['activeReply'] = reply
            # The durable reply record defines returned; transport receipt is
            # counted separately by the runner and can be UNKNOWN on interruption.
            server.write('reply-' + str(ordinal).zfill(4) + '.json', reply, 65536)
            server.counts['requestsReturned'] += 1
            server.progress()
            response = wire(reply); need(len(response) <= 65536, 'bounded protocol response')
            server.owners['activeResponse'] = response
            server.memory(reply)
            sys.stdout.buffer.write(response); sys.stdout.buffer.flush()
        return 0
    except BaseException as error:
        signal.setitimer(signal.ITIMER_REAL, 4)
        detail = {'type': type(error).__name__, 'message': str(error)[:2048], 'detail': getattr(error, 'detail', None)}
        if server is not None:
            failure = {'status': 'FAIL_G1A_REFERENCE', 'op': locals().get('op'),
                       'requestOrdinal': server.counts['requestsAttempted'], 'counts': dict(server.counts), 'firstFailure': detail}
            try:
                server.progress({'type': detail['type'], 'message': detail['message']})
                failure['artifact'] = server.write('first-failure.json', failure, 57344, reserved=True)
            except BaseException as receipt_error:
                failure['firstFailure']['receiptError'] = str(receipt_error)[:512]
                failure['firstFailure']['detail'] = None
            data = wire(failure)
            if len(data) > 65536:
                failure['firstFailure']['detail'] = None; data = wire(failure)
            sys.stdout.buffer.write(data); sys.stdout.buffer.flush()
        else:
            sys.stderr.write(json.dumps({'status': 'FAIL_G1A_REFERENCE_STARTUP', 'firstFailure': {'type': detail['type'], 'message': detail['message']}}) + '\n')
        return 1
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)


if __name__ == '__main__':
    sys.exit(main())
