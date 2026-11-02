"""SAT-scoped dependency memo; all geometry runs in the retained original code."""
from decimal import (Decimal, Context, getcontext, Clamped, InvalidOperation,
                     DivisionByZero, Inexact, Rounded, Subnormal, Overflow,
                     Underflow, FloatOperation)
import hashlib
from pathlib import Path
import sys
import time
from types import FunctionType, MethodDescriptorType

SIGNALS = (Clamped, InvalidOperation, DivisionByZero, Inexact, Rounded,
           Subnormal, Overflow, Underflow, FloatOperation)
DEFAULT_BOUNDS = {
    'max_sat_calls': 288, 'max_logical_support_calls': 8640,
    'max_pair_entries': 288, 'max_stage_entries': 8192,
    'max_stages_per_pair': 30, 'max_flag_masks_per_stage': 512,
    'max_key_bytes': 16384, 'max_encoded_bytes': 16777216,
    'max_owned_bytes': 67108864,
}
SOURCE_SHA = '9ff4ed05dc2f2f98d32533527b506d4aa0f7799bc6d86a0862ecf24f389b9841'
COUNTERS = ('sat_attempts', 'sat_returns', 'sat_raises', 'support_calls',
            'original_sat_attempts', 'original_sat_returns', 'original_sat_raises',
            'hits', 'misses', 'original_attempts', 'original_returns',
            'original_raises', 'type_bypasses', 'context_bypasses',
            'capacity_bypasses', 'pair_hits', 'pair_misses',
            'pair_capacity_bypasses', 'key_build_cpu_ns', 'key_build_wall_ns')
RESERVE = 16384


class CacheResourceError(RuntimeError):
    pass


class _Capacity(Exception):
    pass


def flag_mask(context):
    return sum(int(bool(context.flags[s])) << index for index, s in enumerate(SIGNALS))


def settings(context):
    return (context.prec, context.rounding, context.Emin, context.Emax,
            context.capitals, context.clamp, tuple(bool(context.traps[s]) for s in SIGNALS))


class SatScopedCache:
    def __init__(self, module, bounds, observe_original=None, observe_scope=None):
        if type(bounds) is not dict or set(bounds) != set(DEFAULT_BOUNDS):
            raise TypeError('exact v2 bounds required')
        for name, maximum in DEFAULT_BOUNDS.items():
            if type(bounds[name]) is not int or not 1 <= bounds[name] <= maximum:
                raise ValueError('bound outside frozen ceiling: ' + name)
        self.module = module
        self.original_sat = module.sat_pair
        self.original_support = module.support_radius
        if type(self.original_sat) is not FunctionType or type(self.original_support) is not FunctionType:
            raise TypeError('retained original function objects required')
        self._sat_code = self.original_sat.__code__
        self._support_code = self.original_support.__code__
        source = Path(self._sat_code.co_filename).resolve()
        if source != Path(self._support_code.co_filename).resolve() or hashlib.sha256(source.read_bytes()).hexdigest() != SOURCE_SHA:
            raise CacheResourceError('original SAT/support source identity differs')
        self._source = str(source)
        self._bounds = dict(bounds)
        self._observer = observe_original
        self._scope_observer = observe_scope
        self._pairs = {}
        self._counters = {}
        self._active = None
        self._payload_bytes = self._encoded_bytes = self._stage_entries = self._peak_owned = 0
        self._sat_wrapper = self.sat_pair
        self._support_wrapper = self.support_radius
        self.clear()

    def install(self):
        if self.module.sat_pair is not self.original_sat or self.module.support_radius is not self.original_support:
            raise CacheResourceError('SAT module pointers changed before install')
        self.module.sat_pair = self._sat_wrapper
        self.module.support_radius = self._support_wrapper

    def restore(self):
        self.module.sat_pair = self.original_sat
        self.module.support_radius = self.original_support
        self._active = None

    def _identity(self):
        if self.original_sat.__code__ is not self._sat_code or self.original_support.__code__ is not self._support_code:
            raise CacheResourceError('original callable code identity changed')

    def _owned(self):
        own = (sys.getsizeof(self) + sys.getsizeof(self.__dict__) + sys.getsizeof(self._bounds)
               + sum(sys.getsizeof(v) for v in self._bounds.values())
               + sys.getsizeof(self._counters) + sum(sys.getsizeof(v) for v in self._counters.values())
               + sys.getsizeof(self._pairs) + self._payload_bytes + sys.getsizeof(self._source)
               + sys.getsizeof(self._sat_wrapper) + sys.getsizeof(self._support_wrapper)
               + sum(sys.getsizeof(v) for v in (self._payload_bytes, self._encoded_bytes,
                                               self._stage_entries, self._peak_owned)))
        a = self._active
        if a is not None:
            own += (sys.getsizeof(a) + sys.getsizeof(a['pending']) + a['pending_bytes']
                    + sys.getsizeof(a['key']) + sys.getsizeof(a['settings'])
                    + sum(sys.getsizeof(v) for v in a['settings'])
                    + sum(sys.getsizeof(v) for v in (a['ordinal'], a['pending_bytes'])))
        return own

    def _account(self):
        owned = self._owned()
        self._peak_owned = max(owned, self._peak_owned)
        if owned > self._bounds['max_owned_bytes']:
            raise CacheResourceError('actual owned memory exceeded frozen bound')
        return owned

    def clear(self):
        if self._active is not None:
            raise CacheResourceError('cannot clear an active SAT scope')
        self._pairs = {}
        self._counters = {key: 0 for key in COUNTERS}
        self._payload_bytes = self._encoded_bytes = self._stage_entries = self._peak_owned = 0
        if self._account() + RESERVE > self._bounds['max_owned_bytes']:
            raise CacheResourceError('empty bookkeeping cannot fit bound')

    def stats(self):
        owned = self._account()
        return {**self._counters, 'pair_entries': len(self._pairs), 'stage_entries': self._stage_entries,
                'pending_pair_entries': int(self._active is not None and self._active['entry'] is None),
                'pending_stage_entries': 0 if self._active is None else len(self._active['pending']),
                'encoded_key_bytes': self._encoded_bytes, 'owned_bytes': owned,
                'peak_owned_bytes': self._peak_owned}

    @staticmethod
    def _arguments(args, kwargs):
        if not (len(args) in (2, 3) and set(kwargs) <= {'normalize_quaternion'}):
            return None
        if len(args) == 3 and kwargs:
            return None
        normal = args[2] if len(args) == 3 else kwargs.get('normalize_quaternion', False)
        if type(normal) is not bool:
            return None
        bodies = args[:2]
        for body in bodies:
            if type(body) is not dict:
                return None
            for field, size in (('extents', 3), ('quaternion', 4), ('center', 3)):
                value = body.get(field)
                if type(value) is not tuple or len(value) != size or any(type(x) is not Decimal or not x.is_finite() for x in value):
                    return None
            for field in ('quaternionNorm', 'quaternionNormError'):
                if type(body.get(field)) is not Decimal or not body[field].is_finite():
                    return None
        return bodies, normal

    def _key(self, bodies, normal, context):
        limit = self._bounds['max_key_bytes']
        leaves = [x for body in bodies for field in ('extents', 'quaternion') for x in body[field]]
        leaves += [body['quaternionNorm'] for body in bodies]
        largest = max(sys.getsizeof(x) for x in leaves)
        if largest > limit or self._owned() + largest * 128 + limit * 16 + 65536 + RESERVE > self._bounds['max_owned_bytes']:
            raise _Capacity()
        data = bytearray()

        def add(value):
            if len(data) + len(value) > limit:
                raise _Capacity()
            data.extend(value)

        def integer(value):
            magnitude = abs(value)
            count = max(1, (magnitude.bit_length() + 7) // 8)
            if count + 6 > limit - len(data):
                raise _Capacity()
            add(b'I' + bytes((int(value < 0),)) + count.to_bytes(4, 'big'))
            add(magnitude.to_bytes(count, 'big'))

        def text(value):
            if len(value) * 4 + 5 > limit - len(data):
                raise _Capacity()
            value = value.encode('utf-8'); add(b'S' + len(value).to_bytes(4, 'big')); add(value)

        def decimal(value):
            parts = value.as_tuple()
            if len(parts.digits) + 6 > limit - len(data):
                raise _Capacity()
            add(b'D' + bytes((parts.sign,)) + len(parts.digits).to_bytes(4, 'big'))
            add(bytes(parts.digits)); integer(parts.exponent)

        add(b'SAT-SCOPED-v2\x00'); text(SOURCE_SHA); text(self._source)
        for function, code in ((self.original_sat, self._sat_code), (self.original_support, self._support_code)):
            integer(id(function)); integer(id(code)); integer(code.co_firstlineno)
            add(b'B' + len(code.co_code).to_bytes(4, 'big')); add(code.co_code)
        add(b'C'); integer(context.prec); text(context.rounding)
        for value in (context.Emin, context.Emax, context.capitals, context.clamp):
            integer(value)
        for signal in SIGNALS:
            text(signal.__name__); integer(id(signal))
            add(bytes((int(context.traps[signal]), int(context.flags[signal]))))
        add(b'N' + bytes((int(normal),)))
        for label, body in zip((b'A', b'B'), bodies):
            add(label)
            for field in ('extents', 'quaternion'):
                text(field); integer(len(body[field]))
                for value in body[field]:
                    decimal(value)
            text('quaternionNorm'); decimal(body['quaternionNorm'])
        return bytes(data)

    def _check_context(self, active):
        if getcontext() is not active['context'] or settings(getcontext()) != active['settings']:
            raise CacheResourceError('Context identity/settings/traps changed inside original SAT')
        self._identity()

    def _invoke_support(self, args, kwargs):
        self._counters['original_attempts'] += 1
        try:
            result = self.original_support(*args, **kwargs)
        except BaseException as error:
            self._counters['original_raises'] += 1
            if self._observer is not None:
                self._observer('raise', error, getcontext())
            raise
        self._counters['original_returns'] += 1
        if self._observer is not None:
            self._observer('return', result, getcontext())
        return result

    @staticmethod
    def _stage_size(token, value):
        result, flags = value
        return sys.getsizeof(token) + sys.getsizeof(value) + sys.getsizeof(result) + sys.getsizeof(flags)

    def support_radius(self, *args, **kwargs):
        if self._counters['support_calls'] >= self._bounds['max_logical_support_calls']:
            raise CacheResourceError('logical support call ceiling exhausted')
        self._counters['support_calls'] += 1
        active = self._active
        if active is None:
            self._counters['misses'] += 1
            return self._invoke_support(args, kwargs)
        self._check_context(active)
        ordinal = active['ordinal']; active['ordinal'] += 1
        if ordinal >= self._bounds['max_stages_per_pair']:
            raise CacheResourceError('original support traversal exceeded frozen bound')
        mask = flag_mask(active['context'])
        token = ordinal * 512 + mask
        entry = active['entry']
        value = None if entry is None else entry[1].get(token)
        if value is not None:
            self._counters['hits'] += 1
            result, postflags = value
            for signal, flag in zip(SIGNALS, postflags):
                active['context'].flags[signal] = flag
            return result
        self._counters['misses'] += 1
        result = self._invoke_support(args, kwargs)
        self._check_context(active)
        if not active['store'] or type(result) is not Decimal:
            self._counters['capacity_bypasses'] += 1
            return result
        postflags = tuple(bool(active['context'].flags[signal]) for signal in SIGNALS)
        value = (result, postflags); payload = self._stage_size(token, value)
        masks_full = False
        if self._bounds['max_flag_masks_per_stage'] < 512:
            committed = () if entry is None else entry[1]
            masks_full = sum(old // 512 == ordinal for old in committed) >= self._bounds['max_flag_masks_per_stage']
        if (masks_full or self._stage_entries + len(active['pending']) >= self._bounds['max_stage_entries'] or
                self._owned() + payload + max(2048, 2 * sys.getsizeof(active['pending'])) + RESERVE > self._bounds['max_owned_bytes']):
            self._counters['capacity_bypasses'] += 1
            return result
        active['pending'][token] = value
        active['pending_bytes'] += payload
        self._account()
        return result

    def _commit(self, active):
        pending = active['pending']
        if not active['store'] or not pending:
            return
        entry = active['entry']
        old_table = {} if entry is None else entry[1]
        extra = active['pending_bytes'] + max(2048, sys.getsizeof(old_table) * 2)
        if entry is None:
            extra += sys.getsizeof(active['key']) + sys.getsizeof([active['ordinal'], {}]) + max(2048, 2 * sys.getsizeof(self._pairs))
        if self._owned() + extra + RESERVE > self._bounds['max_owned_bytes']:
            self._counters['capacity_bypasses'] += len(pending)
            return
        if entry is None:
            entry = [active['ordinal'], {}]
            self._pairs[active['key']] = entry
            self._payload_bytes += sys.getsizeof(active['key']) + sys.getsizeof(entry) + sys.getsizeof(entry[0]) + sys.getsizeof(entry[1])
            self._encoded_bytes += len(active['key'])
        table = entry[1]; old_dict_size = sys.getsizeof(table)
        table.update(pending)
        self._payload_bytes += active['pending_bytes'] + sys.getsizeof(table) - old_dict_size
        self._stage_entries += len(pending)
        self._account()

    def sat_pair(self, *args, **kwargs):
        if self._active is not None:
            raise CacheResourceError('unexpected nested original SAT invocation')
        if self._counters['sat_attempts'] >= self._bounds['max_sat_calls']:
            raise CacheResourceError('SAT call ceiling exhausted')
        self._counters['sat_attempts'] += 1
        self._identity()
        context = getcontext(); parsed = self._arguments(args, kwargs); key = None
        native = type(Decimal.as_tuple) is MethodDescriptorType and type(Context.copy) is MethodDescriptorType
        eligible = parsed is not None and type(context) is Context and context.prec in (80, 120) and native
        if parsed is None:
            self._counters['type_bypasses'] += 1
        elif not eligible:
            self._counters['context_bypasses'] += 1
        if eligible:
            wall, cpu = time.monotonic_ns(), time.process_time_ns()
            try:
                key = self._key(*parsed, context)
            except _Capacity:
                pass
            finally:
                self._counters['key_build_cpu_ns'] += time.process_time_ns() - cpu
                self._counters['key_build_wall_ns'] += time.monotonic_ns() - wall
        entry = self._pairs.get(key) if key is not None else None
        store = key is not None
        if entry is not None:
            self._counters['pair_hits'] += 1
        else:
            self._counters['pair_misses'] += 1
            if (key is None or len(self._pairs) >= self._bounds['max_pair_entries'] or
                    self._encoded_bytes + len(key) > self._bounds['max_encoded_bytes']):
                store = False
                self._counters['pair_capacity_bypasses'] += int(eligible)
        active = {'context': context, 'settings': settings(context), 'key': key,
                  'entry': entry, 'store': store, 'ordinal': 0, 'pending': {}, 'pending_bytes': 0}
        self._active = active
        try:
            self._account()
            if self._scope_observer is not None:
                self._scope_observer(key)
            self._counters['original_sat_attempts'] += 1
            try:
                result = self.original_sat(*args, **kwargs)
            except BaseException:
                self._counters['original_sat_raises'] += 1
                raise
            self._counters['original_sat_returns'] += 1
            self._check_context(active)
            if entry is not None and active['ordinal'] != entry[0]:
                raise CacheResourceError('original support traversal changed for identical invariants')
            self._commit(active)
            self._counters['sat_returns'] += 1
            return result
        except BaseException:
            self._counters['sat_raises'] += 1
            raise
        finally:
            self._active = None
