"""Bounded standalone validator transport and source authentication only."""
import hashlib
import importlib.util
import json
import math
import signal
import struct
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
READ = 0
PREALLOCATED = 0
AUDIT_LIMIT = 32 * 1024 * 1024
SCRATCH = 8 * 1024 * 1024


def need(value, reason):
    if not value:
        raise ValueError(reason)


def pin(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            h.update(chunk)
    return {'bytes': Path(path).stat().st_size, 'sha256': h.hexdigest()}


def unique(items):
    result = {}
    for key, value in items:
        need(key not in result, 'DUPLICATE_JSON_KEY')
        result[key] = value
    return result


def json_allocation_bound(data):
    """Conservative pinned-runtime allocation bound before JSON decoding."""
    quoted = escaped = primitive = False
    strings = dictionaries = lists = entries = scalars = depth = 0
    for byte in data:
        if quoted:
            if escaped:
                escaped = False
            elif byte == 92:
                escaped = True
            elif byte == 34:
                quoted = False
            continue
        if byte == 34:
            strings += 1
            quoted = True
            primitive = False
        elif byte in (123, 91):
            depth += 1
            need(depth <= 32, 'JSON_DEPTH_CAP')
            dictionaries += byte == 123
            lists += byte == 91
            primitive = False
        elif byte == 58:
            entries += 1
            primitive = False
        elif byte in (125, 93):
            depth -= 1
            primitive = False
        elif byte in (9, 10, 13, 32, 44):
            primitive = False
        elif not primitive:
            scalars += 1
            primitive = True
    # Includes input bytes, possible Unicode decode/string buffers, container
    # spare capacity/pointers and bounded numeric scalar objects. It counts
    # repeated/shared objects separately and is deliberately conservative.
    return (10 * len(data) + 80 * strings + 80 * dictionaries + 72 * lists +
            160 * entries + 40 * scalars + 65536)


def read(path, expected=None):
    global READ, PREALLOCATED
    path = Path(path)
    need(path.stat().st_size <= 2 * 1024 * 1024, 'FILE_CAP')
    need(READ + path.stat().st_size <= 16 * 1024 * 1024, 'TOTAL_READ_CAP')
    if expected is not None:
        need(pin(path) == expected, 'SOURCE_OR_INPUT_PIN:' + str(path))
    need(PREALLOCATED + path.stat().st_size + SCRATCH <= AUDIT_LIMIT, 'RAW_BUFFER_PREALLOCATION')
    data = path.read_bytes()
    READ += len(data)
    need(sum(data.count(c) for c in (b'{', b'[', b',', b':')) <= 16384,
         'JSON_CONTAINER_PREALLOCATION_CAP')
    bound = json_allocation_bound(data)
    need(PREALLOCATED + bound + SCRATCH <= AUDIT_LIMIT, 'JSON_AUDIT32_PREALLOCATION')
    PREALLOCATED += bound
    depth = 0
    quoted = escaped = False
    for byte in data:
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
            need(depth <= 32, 'JSON_DEPTH_CAP')
        elif byte in (93, 125):
            depth -= 1
    def integer(text):
        need(len(text) <= 16, 'JSON_STRUCTURAL_INTEGER_CAP')
        return int(text)
    def floating(text):
        value = float(text)
        need(math.isfinite(value), 'JSON_NONFINITE')
        return value
    def invalid(_):
        raise ValueError('JSON_NONFINITE')
    return json.loads(data, object_pairs_hook=unique, parse_int=integer,
                      parse_float=floating, parse_constant=invalid)


def authenticate():
    p = read(HERE / 'PINS.json')
    need(Path(sys.executable).resolve() == Path(p['python']['path']).resolve() and
         sys.version == p['python']['version'], 'PYTHON_IDENTITY')
    for group in ('tools', 'sources'):
        for name, expected in p[group].items():
            need(pin(Path(name) if group == 'tools' else ROOT / name) == expected,
                 'PIN_MISMATCH:' + name)
    return p


def module(name, relative):
    """A standalone process imports only pinned OLD independent components."""
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    result = importlib.util.module_from_spec(spec)
    sys.modules[name] = result
    spec.loader.exec_module(result)
    return result


def same(a, b, path=''):
    if type(a) in (int, float) and type(b) in (int, float):
        need(struct.pack('<d', a) == struct.pack('<d', b), 'F64_WORD:' + path)
    elif type(a) is dict and type(b) is dict:
        need(set(a) == set(b), 'KEYS:' + path)
        for key in a:
            same(a[key], b[key], path + '/' + key)
    elif type(a) is list and type(b) is list:
        need(len(a) == len(b), 'LENGTH:' + path)
        for i, (x, y) in enumerate(zip(a, b)):
            same(x, y, path + '/' + str(i))
    else:
        need(type(a) is type(b) and a == b, 'VALUE:' + path)


def arm():
    def expired(*_):
        raise TimeoutError('VALIDATOR_INTERNAL_170S')
    signal.signal(signal.SIGALRM, expired)
    signal.alarm(170)


def write(path, report):
    data = (json.dumps(report, indent=2, allow_nan=False) + '\n').encode()
    need(len(data) <= 2 * 1024 * 1024, 'OUTPUT_CAP')
    with Path(path).open('xb') as f:
        f.write(data)


def keys(value, wanted, label):
    need(type(value) is dict and set(value) == set(wanted), label)


def natural(value, maximum=2000000):
    need(type(value) is int and 0 <= value <= maximum, 'COUNTER_BOUND')
    return value
