"""Private pair-local Gram SAT algebra. No direct-solver fallback or cache."""
import hashlib
import importlib.util
import json
from pathlib import Path
import signal
import sys
import time

_STARTED = time.monotonic()
_ROOT = Path(__file__).resolve().parents[2]
_INTEGER_PATH = _ROOT / 'examples/physics-p4-sat-2276/integer_sat.py'
_INTEGER_BYTES = 13025
_INTEGER_SHA = 'b1c2f4a4d291c52b9182864fea658381afd482aa34da7d300997a81bf45a3b1e'
PROTOCOL = 'p4-gram-sat-kernel-v1'
MAX_BYTES = 2 * 1024 * 1024
_UPPER = ((0, 0), (0, 1), (0, 2), (1, 1), (1, 2), (2, 2))
_CYCLIC = ((1, 2), (2, 0), (0, 1))


def _load_integer():
    data = _INTEGER_PATH.read_bytes()
    if len(data) != _INTEGER_BYTES or hashlib.sha256(data).hexdigest() != _INTEGER_SHA:
        raise ValueError('IMMUTABLE_INTEGER_SAT_SOURCE_DRIFT')
    name = '_p4_pair_gram_immutable_integer_sat'
    spec = importlib.util.spec_from_file_location(name, _INTEGER_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


_K = _load_integer()
Meter = _K.Meter
prepare = _K.prepare


class GramFailure(_K.MicroFailure):
    pass


def _need(condition, reason='GRAM_INPUT_INVALID'):
    if not condition:
        raise GramFailure(reason)


def _clock(deadline):
    if time.monotonic() >= deadline:
        raise GramFailure('GRAM_TIME_LIMIT')


def _gram(columns, m):
    result = [[None] * 3 for _ in range(3)]
    for i, j in _UPPER:
        value = m.dot(columns[i], columns[j])
        result[i][j] = value
        result[j][i] = value
    return result


def _weighted(weights, coefficients, m):
    total = 0
    for weight, coefficient in zip(weights, coefficients):
        total = m.add(total, m.mul(weight, abs(coefficient)))
    return total


def _cross_support(weights, coefficients, self_index, m):
    # The omitted self term is the exact alternating determinant with repeated
    # columns, not an orthogonality approximation or a dropped SAT axis.
    total = 0
    for k in range(3):
        if k == self_index:
            continue
        other = 3 - self_index - k  # Fixed structural permutation index.
        total = m.add(total, m.mul(weights[k], abs(coefficients[other])))
    return total


def compute_model(a, b, normalized, m, deadline=None):
    """One actual computation, returning minimum/report and its used tables."""
    deadline = _STARTED + 170 if deadline is None else deadline
    _clock(deadline)
    _need(type(normalized) is bool)
    m.models += 1
    ba = a.normalized if normalized else a.raw
    bb = b.normalized if normalized else b.raw
    words = [_K.dyadic(value) for value in a.center + b.center + a.extents + b.extents]
    power = max(denominator for _, denominator in words)
    lifted = [m.shift(numerator, power - denominator) for numerator, denominator in words]
    ca, cb, ha, hb = (lifted[i:i + 3] for i in (0, 3, 6, 9))
    delta = [m.sub(y, x) for x, y in zip(ca, cb)]
    cross_den = m.mul(ba.denominator, bb.denominator)
    denominator = m.mul(m.shift(1, power), cross_den)
    A, B = ba.columns, bb.columns

    AA, BB = _gram(A, m), _gram(B, m)
    AB = [[m.dot(A[i], B[j]) for j in range(3)] for i in range(3)]
    face_a = [m.dot(delta, column) for column in A]
    face_b = [m.dot(delta, column) for column in B]
    _clock(deadline)
    EA = [m.cross(A[i], A[j]) for i, j in _CYCLIC]
    EB = [m.cross(B[i], B[j]) for i, j in _CYCLIC]
    delta_cross_a = [m.cross(delta, column) for column in A]
    TA = [[m.dot(EA[r], B[j]) for j in range(3)] for r in range(3)]
    TB = [[m.dot(A[i], EB[r]) for r in range(3)] for i in range(3)]
    TC = [[m.dot(delta_cross_a[i], B[j]) for j in range(3)] for i in range(3)]
    cross_square = []
    for i in range(3):
        row = []
        for j in range(3):
            square = m.sub(m.mul(AA[i][i], BB[j][j]), m.mul(AB[i][j], AB[i][j]))
            if m.compare(square, 0) < 0:
                raise GramFailure('GRAM_LAGRANGE_NEGATIVE')
            row.append(square)
        cross_square.append(row)
    _clock(deadline)

    minimum, ties, classifications, axis_results = None, [], [], []
    for index in range(15):
        _clock(deadline)
        m.axes += 1
        if index < 3:
            i = index
            square, axis_denominator = AA[i][i], ba.denominator
        elif index < 6:
            j = index - 3
            square, axis_denominator = BB[j][j], bb.denominator
        else:
            i, j = divmod(index - 6, 3)
            square, axis_denominator = cross_square[i][j], cross_den
        zero = square == 0
        near = not zero and index >= 6 and m.compare(m.mul(square, _K.TEN24), m.mul(axis_denominator, axis_denominator)) < 0
        if zero:
            classifications.append(dict(axis=index, exactZero=True, nearParallel=False, marginSign=None))
            axis_results.append(dict(axis=index, axisDen=axis_denominator, margin=None))
            continue
        if index < 3:
            support_a = _weighted(ha, [AA[k][i] for k in range(3)], m)
            support_b = _weighted(hb, AB[i], m)
            center = abs(face_a[i])
        elif index < 6:
            support_a = _weighted(ha, [AB[k][j] for k in range(3)], m)
            support_b = _weighted(hb, [BB[k][j] for k in range(3)], m)
            center = abs(face_b[j])
        else:
            # A_k·(Ai×Bj)=(Ak×Ai)·Bj; its absolute coefficient is TA[r,j].
            support_a = _cross_support(ha, [TA[r][j] for r in range(3)], i, m)
            # B_k·(Ai×Bj)=Ai·(Bj×Bk), opposite to Ai·(Bk×Bj).
            # Only the proven absolute magnitude is used by this support sum.
            support_b = _cross_support(hb, TB[i], j, m)
            center = abs(TC[i][j])
        numerator = m.sub(m.add(m.mul(support_a, bb.denominator), m.mul(support_b, ba.denominator)), m.mul(center, cross_den))
        margin = _K.Margin(numerator, denominator, square, index)
        sign = (numerator > 0) - (numerator < 0)
        classifications.append(dict(axis=index, exactZero=False, nearParallel=near, marginSign=sign))
        axis_results.append(dict(axis=index, axisDen=axis_denominator, margin=margin))
        comparison = -1 if minimum is None else _K.compare_margin(margin, minimum, m)
        if comparison < 0:
            minimum, ties = margin, [index]
        elif comparison == 0:
            ties.append(index)
    if minimum is None:
        raise GramFailure('NO_NONZERO_AXIS')
    report = dict(firstExactMinimum=minimum.axis, exactTiedMinima=ties, axes=classifications)
    # These are aliases/captures of actual in-call values, not recomputed math.
    tables = dict(AAupper=[AA[i][j] for i, j in _UPPER],
                  BBupper=[BB[i][j] for i, j in _UPPER],
                  AB=[AB[i][j] for i in range(3) for j in range(3)],
                  faceCenterA=face_a, faceCenterB=face_b,
                  TA=[TA[r][j] for r in range(3) for j in range(3)],
                  TB=[TB[i][r] for i in range(3) for r in range(3)],
                  TC=[TC[i][j] for i in range(3) for j in range(3)])
    return minimum, report, dict(tables=tables, axisResults=axis_results)


def solve_model(a, b, normalized, m):
    """Original production API; one same compute call, diagnostics discarded."""
    minimum, report, _diagnostics = compute_model(a, b, normalized, m)
    return minimum, report


def _text(value, m, deadline):
    """Bounded diagnostic transport; no large native int-to-decimal shortcut."""
    _clock(deadline)
    negative = m.compare(value, 0) < 0
    if negative:
        value = m.sub(0, value)
    chunks = []
    while m.compare(value, 1000000000) >= 0:
        _clock(deadline)
        quotient = m.div(value, 1000000000)
        chunks.append(m.sub(value, m.mul(quotient, 1000000000)))
        value = quotient
    text = str(value)  # Proven <=9 digits.
    for chunk in reversed(chunks):
        text += format(chunk, '09d')
    return '-' + text if negative else text


def _snapshot(result, m, deadline):
    minimum, report, diagnostics = result
    def margin(value):
        return dict(N=_text(value.numerator, m, deadline),
                    D=_text(value.denominator, m, deadline),
                    S=_text(value.square, m, deadline))
    tables = {name: [_text(value, m, deadline) for value in values]
              for name, values in diagnostics['tables'].items()}
    axes = [dict(axis=item['axis'], axisDen=_text(item['axisDen'], m, deadline),
                 margin=None if item['margin'] is None else margin(item['margin']))
            for item in diagnostics['axisResults']]
    return dict(tables=tables, axisResults=axes, report=report,
                minimum=dict(axis=minimum.axis, **margin(minimum)))


def _body_wire(body):
    _need(type(body) is dict and set(body) == {'id', 'kind', 'shape', 'positionM', 'orientation'})
    _need(type(body['shape']) is dict and set(body['shape']) == {'kind', 'halfExtentsM'})


def evaluate_request(request, meter, deadline=None):
    deadline = _STARTED + 170 if deadline is None else deadline
    raw = normalized = None
    try:
        _clock(deadline)
        _need(type(request) is dict and set(request) == {'a', 'b'})
        _body_wire(request['a']); _body_wire(request['b'])
        a, b = prepare(request['a'], meter), prepare(request['b'], meter)
        raw = _snapshot(compute_model(a, b, False, meter, deadline), meter, deadline)
        normalized = _snapshot(compute_model(a, b, True, meter, deadline), meter, deadline)
        return dict(protocol=PROTOCOL, status='CERTIFIED_PAIR_GRAM', reason=None,
                    raw=raw, normalized=normalized, stats=meter.stats())
    except _K.MicroFailure as error:
        return dict(protocol=PROTOCOL, status='UNRESOLVED', reason=str(error),
                    raw=raw, normalized=normalized, stats=meter.stats())


def _load_request(path):
    path = Path(path)
    size = path.stat().st_size
    if size > MAX_BYTES or size * 128 + 65536 > 24 * 1024 * 1024:
        raise ValueError('REQUEST_PREALLOCATION_LIMIT')
    return json.loads(path.read_bytes())


def _write_reply(path, reply):
    count = 0
    with Path(path).open('x') as stream:
        for part in json.JSONEncoder(separators=(',', ':'), allow_nan=False).iterencode(reply):
            size = len(part.encode())
            if count + size + 1 > MAX_BYTES:
                raise ValueError('REPLY_LIMIT')
            stream.write(part); count += size
        stream.write('\n')
    return count + 1


def main(argv):
    if len(argv) != 3 or argv[0] != 'kernel':
        raise ValueError('gram_sat.py kernel REQUEST_FILE REPLY_FILE')
    def timeout(_signal, _frame):
        raise GramFailure('GRAM_TIME_LIMIT')
    signal.signal(signal.SIGALRM, timeout)
    signal.setitimer(signal.ITIMER_REAL, max(0.001, _STARTED + 170 - time.monotonic()))
    request = _load_request(argv[1])
    reply = evaluate_request(request, Meter(), _STARTED + 170)
    count = _write_reply(argv[2], reply)
    print(json.dumps(dict(status='SERIALIZED_GRAM_SAT_REPLY', resultStatus=reply['status'], replyBytes=count)))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
