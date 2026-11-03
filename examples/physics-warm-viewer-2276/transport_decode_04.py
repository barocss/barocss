"""Bounded verified-subtree canonical transport. No engine or observer imports."""
import hashlib
import json
import math
import re

MAX_EXPANDED_BYTES = 16 * 1024 * 1024
MAX_SHARED_NODES = 8192
MAX_REFERENCE_DEPTH = 64
MAX_CANONICAL_FRAGMENTS = 1000000
MAX_CACHED_NODE_BYTES = 4096
MAX_CACHED_BYTES = 4 * 1024 * 1024


def _need(ok, message):
    if not ok:
        raise ValueError(message)


class _Canonical:
    def __init__(self):
        self.spans = {}
        self.stats = dict(emittedFragments=0, emittedCanonicalBytes=0, canonicalJobs=0,
                          cacheEntries=0, cacheBytes=0, cacheHits=0, cacheHitBytes=0,
                          maxEmittedSpanBytes=0, maximumExpandedDepth=0)

    def fingerprint(self, value, collect_small=False):
        digest = hashlib.sha256()
        size = 0
        collected = bytearray() if collect_small else None
        self.stats['canonicalJobs'] += 1

        def emit(data):
            nonlocal size, collected
            _need(0 < len(data) <= MAX_CACHED_NODE_BYTES, 'Canonical emitted span bound')
            size += len(data)
            self.stats['emittedFragments'] += 1
            self.stats['emittedCanonicalBytes'] += len(data)
            _need(size <= MAX_EXPANDED_BYTES, 'Expanded canonical trace byte bound')
            _need(self.stats['emittedFragments'] <= MAX_CANONICAL_FRAGMENTS,
                  'Actual canonical emitted fragment work bound')
            self.stats['maxEmittedSpanBytes'] = max(self.stats['maxEmittedSpanBytes'], len(data))
            digest.update(data)
            if collected is not None:
                if len(collected) + len(data) <= MAX_CACHED_NODE_BYTES:
                    collected.extend(data)
                else:
                    collected = None

        def string(text):
            # Bound before escaping, then retain at most one 4 KiB chunk.
            _need(len(text) <= MAX_EXPANDED_BYTES, 'Canonical string input bound')
            chunk = bytearray(b'"')
            escapes = {'"': b'\\"', '\\': b'\\\\', '\b': b'\\b', '\f': b'\\f',
                       '\n': b'\\n', '\r': b'\\r', '\t': b'\\t'}
            for char in text:
                data = escapes.get(char)
                if data is None:
                    data = ('\\u%04x' % ord(char)).encode('ascii') if ord(char) < 32 else char.encode('utf-8')
                if len(chunk) + len(data) > MAX_CACHED_NODE_BYTES:
                    emit(bytes(chunk))
                    chunk.clear()
                chunk.extend(data)
            if len(chunk) == MAX_CACHED_NODE_BYTES:
                emit(bytes(chunk))
                chunk.clear()
            chunk.extend(b'"')
            emit(bytes(chunk))

        def walk(item, depth):
            _need(depth <= MAX_REFERENCE_DEPTH, 'Expanded canonical value depth bound')
            self.stats['maximumExpandedDepth'] = max(self.stats['maximumExpandedDepth'], depth)
            span = self.spans.get(id(item)) if type(item) in (dict, list) else None
            if span is not None:
                data, height = span
                _need(depth + height <= MAX_REFERENCE_DEPTH, 'Cached canonical value depth bound')
                self.stats['maximumExpandedDepth'] = max(self.stats['maximumExpandedDepth'], depth + height)
                self.stats['cacheHits'] += 1
                self.stats['cacheHitBytes'] += len(data)
                emit(data)
                return height
            if type(item) is dict:
                _need(all(type(key) is str for key in item), 'Canonical object keys must be strings')
                emit(b'{')
                height = 0
                for index, key in enumerate(sorted(item)):
                    if index:
                        emit(b',')
                    string(key)
                    emit(b':')
                    height = max(height, 1 + walk(item[key], depth + 1))
                emit(b'}')
                return height
            if type(item) is list:
                emit(b'[')
                height = 0
                for index, child in enumerate(item):
                    if index:
                        emit(b',')
                    height = max(height, 1 + walk(child, depth + 1))
                emit(b']')
                return height
            if type(item) is str:
                string(item)
            elif item is None:
                emit(b'null')
            elif type(item) is bool:
                emit(b'true' if item else b'false')
            elif type(item) is int:
                _need(item.bit_length() <= 16384, 'Canonical integer bit bound')
                data = str(item).encode('ascii')
                for start in range(0, len(data), MAX_CACHED_NODE_BYTES):
                    emit(data[start:start + MAX_CACHED_NODE_BYTES])
            elif type(item) is float:
                _need(math.isfinite(item), 'Canonical finite scalar required')
                # A binary64 scalar has bounded text; containers never use dumps.
                emit(json.dumps(item, ensure_ascii=False, allow_nan=False, separators=(',', ':')).encode('ascii'))
            else:
                raise ValueError('Canonical plain JSON values required')
            return 0

        height = walk(value, 0)
        return digest.hexdigest(), size, bytes(collected) if collected is not None else None, height

    def admit(self, decoded, data, height):
        if data is None or type(decoded) not in (dict, list) or id(decoded) in self.spans:
            return
        if self.stats['cacheBytes'] + len(data) > MAX_CACHED_BYTES:
            return
        self.spans[id(decoded)] = (data, height)
        self.stats['cacheEntries'] += 1
        self.stats['cacheBytes'] += len(data)


def fingerprint(value):
    digest, size, _, _ = _Canonical().fingerprint(value)
    return digest, size


def decode_packet_with_receipt(packet):
    _need(type(packet) is dict and packet.get('format') == 'physics-lossless-trace-dag-v1',
          'Required canonical trace DAG format')
    _need('root' in packet, 'Required canonical trace root')
    declared = packet.get('expandedCanonicalBytes')
    _need(type(declared) is int and 0 <= declared <= MAX_EXPANDED_BYTES, 'Declared expanded trace byte bound')
    pool = packet.get('objects')
    _need(type(pool) is dict and len(pool) <= MAX_SHARED_NODES, 'Shared trace node bound')
    _need(all(type(key) is str and re.fullmatch('[0-9a-f]{64}', key) for key in pool), 'Shared canonical SHA key required')
    canonical = _Canonical()
    decoded_nodes = {}
    active = set()
    verified = {}

    def node(value, depth=0):
        _need(depth <= MAX_REFERENCE_DEPTH, 'Trace reference depth bound')
        if type(value) is list:
            return [node(child, depth + 1) for child in value]
        if type(value) is dict:
            if set(value) == {'$node'}:
                key = value['$node']
                _need(type(key) is str and key in pool, 'Missing trace reference')
                if key in decoded_nodes:
                    return decoded_nodes[key]
                _need(key not in active, 'Cyclic trace reference')
                active.add(key)
                decoded = node(pool[key], depth + 1)
                active.remove(key)
                digest, _, data, height = canonical.fingerprint(decoded, collect_small=True)
                _need(digest == key, 'Trace reference hash mismatch')
                verified[key] = digest
                decoded_nodes[key] = decoded
                canonical.admit(decoded, data, height)
                return decoded
            _need(all(type(key) is str for key in value), 'Plain trace object keys required')
            return {key: node(child, depth + 1) for key, child in value.items()}
        _need(value is None or type(value) in (str, bool, int, float), 'Plain trace scalar required')
        return value

    decoded = node(packet['root'])
    _need(set(decoded_nodes) == set(pool), 'Unreferenced trace dictionary entries')
    digest, size, _, _ = canonical.fingerprint(decoded)
    _need(digest == packet.get('expandedCanonicalSha256') and size == declared,
          'Expanded trace root SHA256/byte accounting mismatch')
    receipt = dict(format='verified-subtree-canonical-transport-04', status='VERIFIED_FULL_CANONICAL_DAG',
                   rootCanonicalSha256=digest, rootCanonicalBytes=size,
                   verifiedNodeHashes=verified, verifiedSharedNodes=len(verified), **canonical.stats)
    return decoded, receipt


def decode_packet(packet):
    return decode_packet_with_receipt(packet)[0]
