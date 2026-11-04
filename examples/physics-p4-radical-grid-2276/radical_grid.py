"""Private direct-grid radical interval; no model, producer, oracle or fallback."""
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
MAX_BYTES = 2 * 1024 * 1024
PROTOCOL = 'p4-radical-grid-kernel-v1'


def _load_integer():
    data = _INTEGER_PATH.read_bytes()
    if len(data) != _INTEGER_BYTES or hashlib.sha256(data).hexdigest() != _INTEGER_SHA:
        raise ValueError('IMMUTABLE_INTEGER_SAT_SOURCE_DRIFT')
    name = '_p4_radical_grid_immutable_integer_sat'
    spec = importlib.util.spec_from_file_location(name, _INTEGER_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


_K = _load_integer()
Meter = _K.Meter  # The actual unchanged class, not a replacement or subclass.


class GridFailure(_K.MicroFailure):
    pass


def _need(condition, reason):
    if not condition:
        raise GridFailure(reason)


def _clock(deadline):
    if time.monotonic() >= deadline:
        raise GridFailure('GRID_TIME_LIMIT')


def _parse_integer(text, meter, deadline):
    _need(type(text) is str and 1 <= len(text) <= 4096, 'GRID_INPUT_INVALID')
    negative = text[0] == '-'
    start = 1 if negative else 0
    _need(start < len(text), 'GRID_INPUT_INVALID')
    _need(text[start] != '0' or not negative and len(text) == 1, 'GRID_INPUT_INVALID')
    value = 0
    for index in range(start, len(text)):
        if index % 256 == 0:
            _clock(deadline)
        code = ord(text[index])
        _need(48 <= code <= 57, 'GRID_INPUT_INVALID')
        # Digit materialization uses the same checked mathematical operations.
        value = meter.add(meter.mul(value, 10), code - 48)
    if negative:
        value = meter.sub(0, value)
    return meter.checked(value)


def _direct(value, precision, meter, deadline):
    _clock(deadline)
    _need(type(precision) is int and precision in _K.PRECISIONS, 'GRID_PRECISION_INVALID')
    numerator, denominator, square = value.numerator, value.denominator, value.square
    _need(all(type(item) is int for item in (numerator, denominator, square)), 'GRID_INPUT_INVALID')
    for item in (numerator, denominator, square):
        meter.checked(item)
    _need(meter.compare(denominator, 0) > 0, 'GRID_NONPOSITIVE_DENOMINATOR')
    _need(meter.compare(square, 0) > 0, 'GRID_NONPOSITIVE_SQUARE')
    sign = meter.compare(numerator, 0)
    if sign == 0:
        return (0, 0, precision), True
    magnitude = meter.sub(0, numerator) if sign < 0 else numerator
    C = meter.shift(meter.mul(magnitude, magnitude), 2 * precision)
    B = meter.mul(meter.mul(denominator, denominator), square)
    quotient = meter.div(C, B)
    _clock(deadline)
    # Existing sqrt_floor is positive-only. Tiny nonzero margins need q=0.
    q = 0 if meter.compare(quotient, 0) == 0 else meter.sqrt_floor(quotient)
    _clock(deadline)
    lower_certificate = meter.mul(meter.mul(q, q), B)
    upper_q = meter.add(q, 1)
    # ALWAYS guard the upper product, even if the lower bound is an exact point.
    upper_certificate = meter.mul(meter.mul(upper_q, upper_q), B)
    lower_comparison = meter.compare(lower_certificate, C)
    _need(lower_comparison <= 0 and meter.compare(C, upper_certificate) < 0, 'GRID_CERTIFICATE_FAILURE')
    exact = lower_comparison == 0
    high = q if exact else upper_q
    if sign < 0:
        return (meter.sub(0, high), meter.sub(0, q), precision), exact
    return (q, high, precision), exact


def interval(value, precision, meter):
    """Backend-facing original interval tuple; no old-interval fallback."""
    result, _ = _direct(value, precision, meter, _STARTED + 170)
    return result


def evaluate_request(request, meter, deadline=None):
    """One literal request; caller shares THIS actual Meter across the bank."""
    deadline = _STARTED + 170 if deadline is None else deadline
    try:
        _clock(deadline)
        _need(type(request) is dict and set(request) == {'numerator', 'denominator', 'square', 'precision'}, 'GRID_INPUT_INVALID')
        n = _parse_integer(request['numerator'], meter, deadline)
        d = _parse_integer(request['denominator'], meter, deadline)
        s = _parse_integer(request['square'], meter, deadline)
        value = _K.Margin(n, d, s, -1)
        result, exact = _direct(value, request['precision'], meter, deadline)
        low, high, precision = result
        return dict(protocol=PROTOCOL, status='CERTIFIED_DIRECT_GRID', reason=None,
                    interval=dict(low=str(low), high=str(high), precision=precision),
                    exact=exact, stats=meter.stats())
    except _K.MicroFailure as error:
        return dict(protocol=PROTOCOL, status='UNRESOLVED', reason=str(error),
                    interval=None, exact=None, stats=meter.stats())


def _load_request(path):
    path = Path(path)
    size = path.stat().st_size
    if size > MAX_BYTES or size * 128 + 65536 > 24 * 1024 * 1024:
        raise ValueError('REQUEST_PREALLOCATION_LIMIT')
    return json.loads(path.read_bytes())


def _write_reply(path, reply):
    count = 0
    encoder = json.JSONEncoder(separators=(',', ':'), allow_nan=False)
    with Path(path).open('x') as stream:
        for part in encoder.iterencode(reply):
            size = len(part.encode())
            if count + size + 1 > MAX_BYTES:
                raise ValueError('REPLY_LIMIT')
            stream.write(part)
            count += size
        stream.write('\n')
    return count + 1


def main(argv):
    if len(argv) != 3 or argv[0] != 'kernel':
        raise ValueError('radical_grid.py kernel REQUEST_FILE REPLY_FILE')
    def timeout(_signal, _frame):
        raise GridFailure('GRID_TIME_LIMIT')
    signal.signal(signal.SIGALRM, timeout)
    signal.setitimer(signal.ITIMER_REAL, max(0.001, _STARTED + 170 - time.monotonic()))
    request = _load_request(argv[1])
    reply = evaluate_request(request, Meter(), _STARTED + 170)
    count = _write_reply(argv[2], reply)
    print(json.dumps(dict(status='SERIALIZED_RADICAL_GRID_REPLY', resultStatus=reply['status'], replyBytes=count)))
    return 0  # Successfully serialized expected typed controls are normal replies.


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
