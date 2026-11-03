"""Bounded IO/authentication only. Importing this file performs no math."""
import hashlib
import json
import re
import signal
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
FILE_CAP = 2 * 1024 * 1024
EVIDENCE_CAP = 16 * 1024 * 1024
RETAINED_CAP = 64 * 1024 * 1024
DECIMAL = re.compile(r'(?:0|-[1-9][0-9]*|[1-9][0-9]*)\Z', re.ASCII)


def require(value, reason):
    if not value:
        raise ValueError(reason)


def deadline():
    def expired(_signum, _frame):
        raise TimeoutError('REFERENCE_INTERNAL_170S')
    signal.signal(signal.SIGALRM, expired)
    signal.alarm(170)


def pairs_unique(items):
    result = {}
    for key, value in items:
        require(key not in result, 'DUPLICATE_JSON_KEY')
        result[key] = value
    return result


def load(path):
    path = Path(path)
    require(path.is_file() and path.stat().st_size <= FILE_CAP, 'FILE_CAP')
    raw = path.read_bytes()
    # A conservative lexical container bound BEFORE the JSON allocation.
    require(sum(raw.count(c) for c in (b'{', b'[', b',', b':')) <= 4096,
            'JSON_CONTAINER_CAP')
    depth = peak = 0
    quoted = escaped = False
    for byte in raw:
        if quoted:
            if escaped:
                escaped = False
            elif byte == 92:
                escaped = True
            elif byte == 34:
                quoted = False
        elif byte == 34:
            quoted = True
        elif byte in (91, 123):
            depth += 1
            peak = max(peak, depth)
            require(peak <= 16, 'JSON_DEPTH_CAP')
        elif byte in (93, 125):
            depth -= 1
    def number(text):
        require(len(text) <= 16, 'JSON_METADATA_INTEGER_CAP')
        return int(text)
    def no_number(_text):
        raise ValueError('NONINTEGER_JSON_NUMBER')
    return json.loads(raw, object_pairs_hook=pairs_unique, parse_int=number,
                      parse_float=no_number, parse_constant=no_number)


def pin(path):
    path = Path(path)
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        while True:
            chunk = stream.read(65536)
            if not chunk:
                break
            digest.update(chunk)
    return {'bytes': path.stat().st_size, 'sha256': digest.hexdigest()}


def authenticate():
    pins = load(HERE / 'PINS.json')
    require(Path(sys.executable).resolve() == Path(pins['python']['path']).resolve(),
            'PYTHON_PATH_MISMATCH')
    require(sys.version == pins['python']['version'], 'PYTHON_VERSION_MISMATCH')
    for group in ('tools', 'sources'):
        for name, expected in pins[group].items():
            path = Path(name) if group == 'tools' else HERE / name
            require(pin(path) == expected, 'PIN_MISMATCH:' + name)
    return pins


def decimal(text, nonnegative=False):
    require(isinstance(text, str) and DECIMAL.fullmatch(text) is not None,
            'NONCANONICAL_DECIMAL')
    magnitude = text[1:] if text.startswith('-') else text
    require(len(text) <= 4096, 'DECIMAL_WIRE_CAP')
    require(not nonnegative or not text.startswith('-'), 'NEGATIVE_GCD')
    value = int(text)
    require(abs(value).bit_length() <= 16384, 'OPERAND_BIT_CAP')
    return value


def write(path, value):
    raw = (json.dumps(value, indent=2, ensure_ascii=True, allow_nan=False) + '\n').encode()
    require(len(raw) <= FILE_CAP, 'OUTPUT_FILE_CAP')
    with Path(path).open('xb') as stream:
        stream.write(raw)


def keys(value, wanted, reason):
    require(isinstance(value, dict) and set(value) == set(wanted), reason)


def natural(value, ceiling=2000000):
    require(type(value) is int and 0 <= value <= ceiling, 'COUNTER_RANGE')
    return value
