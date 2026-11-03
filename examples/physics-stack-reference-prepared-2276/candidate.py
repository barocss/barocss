"""Root-only request-local preparation. Original math/router/CLI stay unchanged."""
from contextlib import contextmanager
from decimal import (getcontext, Clamped, InvalidOperation, DivisionByZero, Inexact,
                     Rounded, Subnormal, Overflow, Underflow, FloatOperation)
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SIGNALS = (Clamped, InvalidOperation, DivisionByZero, Inexact, Rounded,
           Subnormal, Overflow, Underflow, FloatOperation)
ABSENT = object()


def pin(path):
    path = Path(path)
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(65536), b''):
            digest.update(chunk)
    return {'bytes': path.stat().st_size, 'sha256': digest.hexdigest()}


def authenticate():
    pins = json.loads((HERE / 'PINS.json').read_text())
    if Path(sys.executable).resolve() != Path(pins['python']['path']).resolve() or sys.version != pins['python']['version']:
        raise RuntimeError('PREPARED_PYTHON_IDENTITY')
    for group in ('tools', 'sources'):
        for name, expected in pins[group].items():
            if pin(Path(name) if group == 'tools' else ROOT / name) != expected:
                raise RuntimeError('PREPARED_SOURCE_PIN:' + name)
    return pins


def load_original(name='prepared_original_world'):
    path = ROOT / 'examples/physics-rigid-full-pair-position-world/reference.py'
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def context_key():
    context = getcontext()
    return (context.prec, context.rounding, context.Emin, context.Emax,
            context.capitals, context.clamp,
            tuple(context.traps[signal] for signal in SIGNALS),
            tuple(context.flags[signal] for signal in SIGNALS))


def post_flags():
    return tuple(getcontext().flags[signal] for signal in SIGNALS)


def replay(flags):
    context = getcontext()
    for signal, value in zip(SIGNALS, flags):
        context.flags[signal] = value


def body_key(raw):
    """A failed key is a normal original decode call, never a cached error."""
    if type(raw) is not dict or type(raw.get('id')) is not str or type(raw.get('kind')) is not str:
        return None
    shape = raw.get('shape')
    if type(shape) is not dict or shape.get('kind') != 'box':
        return None
    values = []
    for vector, size in ((raw.get('positionM'), 3), (shape.get('halfExtentsM'), 3),
                         (raw.get('orientation'), 4)):
        if type(vector) not in (list, tuple) or len(vector) != size:
            return None
        for value in vector:
            if type(value) not in (int, float):
                return None
            try:
                value = float(value)
            except (OverflowError, ValueError):
                return None
            if not math.isfinite(value):
                return None
            values.append(value)
    return raw['id'], raw['kind'], struct.pack('>10d', *values), context_key()


class Token:
    __slots__ = ('serial', 'quaternion', 'norm')

    def __init__(self, serial, decoded):
        self.serial = serial
        self.quaternion = decoded['quaternion']
        self.norm = decoded['quaternionNorm']


class Scope:
    """ONE world request. Strong references prevent quaternion-ID reuse."""
    def __init__(self, owner):
        self.owner = owner
        self.bodies, self.bases, self.tokens = {}, {}, {}
        self.pair = None
        self.stats = dict(decodeRequests=0, decodeComputations=0, decodeHits=0,
                          satPairCalls=0, basisRequests=0, basisComputations=0,
                          basisHits=0, peakBodyEntries=0, peakBasisEntries=0)

    def decode(self, raw):
        self.stats['decodeRequests'] += 1
        key = body_key(raw)
        cached = self.bodies.get(key, ABSENT) if key is not None else ABSENT
        if cached is not ABSENT:
            snapshot, flags = cached
            replay(flags)
            self.stats['decodeHits'] += 1
            # Only this dictionary is mutable. Decimal/tuple leaves are immutable.
            return dict(snapshot)
        self.stats['decodeComputations'] += 1
        decoded = self.owner.original_decode(raw)
        if key is not None:
            snapshot = dict(decoded)
            self.bodies[key] = snapshot, post_flags()
            token = Token(len(self.tokens), snapshot)
            self.tokens[id(token.quaternion)] = token
            self.stats['peakBodyEntries'] = max(self.stats['peakBodyEntries'], len(self.bodies))
        return decoded

    def token(self, decoded):
        quaternion = decoded.get('quaternion')
        token = self.tokens.get(id(quaternion))
        if token is not None and token.quaternion is quaternion and token.norm is decoded.get('quaternionNorm'):
            return token
        return None

    def sat_pair(self, a, b, normalize_quaternion=False):
        self.stats['satPairCalls'] += 1
        previous = self.pair
        tokens = (self.token(a), self.token(b)) if type(normalize_quaternion) is bool else (None, None)
        frame = {'tokens': tokens, 'mode': normalize_quaternion, 'index': 0}
        self.pair = frame
        try:
            # Original normalization divisions, all15 axes and output construction.
            result = self.owner.original_sat_pair(a, b, normalize_quaternion)
            if frame['index'] != 2:
                raise RuntimeError('PINNED_SAT_BASIS_CALL_CENSUS')
            return result
        finally:
            self.pair = previous

    def basis(self, quaternion):
        self.stats['basisRequests'] += 1
        frame = self.pair
        token = None
        if frame is not None:
            index = frame['index']
            frame['index'] += 1
            if index < 2:
                token = frame['tokens'][index]
        key = (token.serial, frame['mode'], context_key()) if token is not None else None
        cached = self.bases.get(key, ABSENT) if key is not None else ABSENT
        if cached is not ABSENT:
            value, flags = cached
            replay(flags)
            self.stats['basisHits'] += 1
            return value
        self.stats['basisComputations'] += 1
        value = self.owner.original_basis(quaternion)
        if key is not None:
            self.bases[key] = value, post_flags()
            self.stats['peakBasisEntries'] = max(self.stats['peakBasisEntries'], len(self.bases))
        return value

    def clear(self):
        self.pair = None
        self.bodies.clear()
        self.bases.clear()
        self.tokens.clear()


class PreparedReference:
    def __init__(self, original):
        self.original = original
        self.sat = original.PARENT.PARENT.SAT
        self.original_world = original.world
        self.original_decode = self.sat.decode_body
        self.original_sat_pair = self.sat.sat_pair
        self.original_basis = self.sat.quaternion_basis
        self.active = False
        self.last_stats = None

    @contextmanager
    def scope(self):
        if self.active or self.sat.decode_body is not self.original_decode or self.sat.sat_pair is not self.original_sat_pair or self.sat.quaternion_basis is not self.original_basis:
            raise RuntimeError('PREPARED_SCOPE_IDENTITY')
        scope = Scope(self)
        self.active = True
        self.sat.decode_body, self.sat.sat_pair, self.sat.quaternion_basis = scope.decode, scope.sat_pair, scope.basis
        try:
            yield scope
        finally:
            self.sat.decode_body, self.sat.sat_pair, self.sat.quaternion_basis = self.original_decode, self.original_sat_pair, self.original_basis
            self.last_stats = dict(scope.stats)
            scope.clear()
            self.active = False

    def world(self, request):
        with self.scope():
            return self.original_world(request)

    def install(self):
        self.original.world = self.world
        return self.original


def main():
    authenticate()
    prepared = PreparedReference(load_original())
    # Use the OLD main, JSON parser, dispatch, catch policy and compact serializer.
    prepared.install().main()


if __name__ == '__main__':
    main()
