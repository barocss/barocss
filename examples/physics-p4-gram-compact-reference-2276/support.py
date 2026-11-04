"""Root-only finite transport/ownership adapter. No candidate imports."""
import hashlib
import importlib.util
import json
import signal
import struct
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
AUDIT_LIMIT = 32 * 1024 * 1024
SCRATCH = 8 * 1024 * 1024
NONJSON = 8 * 1024 * 1024
GENERATED = 4 * 1024 * 1024
READ = 0
DOCUMENTS = {}
OWNED = None
BUDGET = None
MEASUREMENTS = []
COMPLETE_OBSERVED_PEAK = 0


def need(ok, reason):
    if not ok:
        raise ValueError(reason)


def pin(path):
    path = Path(path)
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(65536), b''):
            h.update(chunk)
    return dict(bytes=path.stat().st_size, sha256=h.hexdigest())


def module(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    result = importlib.util.module_from_spec(spec)
    sys.modules[name] = result
    spec.loader.exec_module(result)
    return result


def start():
    global OWNED, BUDGET
    # Bootstrap imports ONLY the independently qualified data component. Its
    # literal source pin is checked BEFORE import; PINS reauthenticates closure.
    source = ROOT / 'examples/physics-p4-owned-data-2276/owned.py'
    need(pin(source) == dict(bytes=15993, sha256='03aef2a5fa1cec2f8389b6f668a9f170e26fae43bfb319db79fd722e9b22278f'),
         'QUALIFIED_OWNED_SOURCE_BEFORE_IMPORT')
    OWNED = module('gram_reference_qualified_owned', str(source.relative_to(ROOT)))
    # This24MiB contains JSON decode/raw reservations AND the shared8MiB
    # scratch. The separate fixed8MiB non-JSON reservation completes32MiB.
    BUDGET = OWNED.JsonBudget(limit=AUDIT_LIMIT - NONJSON, scratch=SCRATCH)


def measure(value, allowed=()):
    controller = OWNED.FIXED_AUX + 56 + 8 * len(BUDGET._slots)
    with BUDGET.walk_phase():
        result = OWNED.owned_size(value,
            data_reservation=BUDGET.retainedBytes + NONJSON,
            allowed_record_types=allowed, total_limit=AUDIT_LIMIT - controller,
            aux_limit=SCRATCH)
    MEASUREMENTS.append(result)
    return result


def _clone(value, memo):
    """Closed JSON copy. Only actual mutable containers are new data nodes.

    The pinned decoder builds dictionaries by insertion and lists by append.
    The clone uses the same order/growth. Complete source shallow capacities
    are reserved before entry; no source items tuple or discovered object IDs
    become data nodes. Immutable scalar references are ownership-transferred.
    """
    kind = type(value)
    if kind not in (dict, list):
        need(kind in (type(None), bool, int, float, str), 'CLOSED_JSON_COPY_TYPE')
        return value
    oid = id(value)
    if oid in memo:
        return memo[oid]
    result = {} if kind is dict else []
    memo[oid] = result
    if kind is dict:
        for key in value:
            need(type(key) is str, 'JSON_STRING_KEY')
            result[key] = _clone(value[key], memo)
            need(sys.getsizeof(result) <= sys.getsizeof(value), 'JSON_COPY_DICT_CAPACITY')
    else:
        for child in value:
            result.append(_clone(child, memo))
            need(sys.getsizeof(result) <= sys.getsizeof(value), 'JSON_COPY_LIST_CAPACITY')
    return result


def read(path, expected=None):
    global READ, COMPLETE_OBSERVED_PEAK
    path = Path(path).resolve()
    key = str(path)
    if key in DOCUMENTS:
        value, actual_pin = DOCUMENTS[key]
        need(expected is None or actual_pin == expected, 'CACHED_DOCUMENT_PIN')
        return value
    size = path.stat().st_size
    need(size <= 2 * 1024 * 1024 and READ + size <= 16 * 1024 * 1024,
         'AUDIT_FILE_OR_TOTAL_READ_CAP')
    document = OWNED.read_json(path, BUDGET, expected)
    READ += size
    # Neither source graph nor clone is admitted on speculation. The source
    # document keeps its conservative ledger reservation during both walks.
    source = measure(document.value)
    roots = tuple(entry[0] for entry in DOCUMENTS.values())
    retained = measure(roots)
    checkpoint = measure((roots, document.value))
    COMPLETE_OBSERVED_PEAK = max(COMPLETE_OBSERVED_PEAK, checkpoint['ownedBytes'])
    need(source['uniqueNodes'] <= 32768, 'COPY_MEMO_CLOSED_NODE_BOUND')
    need(retained['ownedBytes'] + source['ownedBytes'] + GENERATED <= NONJSON,
         'COPY_TARGET_AND_GENERATED_PREALLOCATION')
    # Clone memo and recursion use the SAME8MiB scratch, never concurrently
    # with a walk, decoder or old KKT matrix/proof-vector scratch.
    with BUDGET.kernel_helper_phase(0):
        copied = _clone(document.value, {})
    copied_size = measure(copied)
    need(copied_size['ownedBytes'] <= source['ownedBytes'], 'COPY_OWNERSHIP_BOUND')
    checkpoint = measure((roots, document.value, copied))
    COMPLETE_OBSERVED_PEAK = max(COMPLETE_OBSERVED_PEAK, checkpoint['ownedBytes'])
    del roots
    actual_pin = dict(document.pin)
    # All original mutable aliases are confined to document.value. The clone
    # owns the preserved immutable leaves under the already reserved NONJSON.
    document.release()
    del document
    DOCUMENTS[key] = (copied, actual_pin)
    return copied


def drop(path):
    # Caller must delete all of its aliases BEFORE this call. Fixed NONJSON
    # is not released or shrunk; the registry drops the final data owner.
    del DOCUMENTS[str(Path(path).resolve())]


def authenticate():
    start()
    result = read(HERE / 'PINS.json')
    need(Path(sys.executable).resolve() == Path(result['python']['path']).resolve()
         and sys.version == result['python']['version'], 'PYTHON_IDENTITY')
    for group in ('tools', 'sources'):
        for name, expected in result[group].items():
            need(pin(Path(name) if group == 'tools' else ROOT / name) == expected,
                 'PIN_MISMATCH:' + name)
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
    # Encoding/hash/output scratch belongs to the enclosing transport8MiB.
    data = (json.dumps(report, indent=2, allow_nan=False) + '\n').encode()
    need(len(data) <= 2 * 1024 * 1024, 'OUTPUT_CAP')
    with Path(path).open('xb') as stream:
        stream.write(data)
