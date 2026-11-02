"""Request-local exact dependency memo. No support-radius formula is implemented here."""
from decimal import (Decimal, Context, getcontext, Clamped, InvalidOperation,
                     DivisionByZero, Inexact, Rounded, Subnormal, Overflow,
                     Underflow, FloatOperation)
import sys
import time
from types import FunctionType, MethodDescriptorType

DEFAULT_BOUNDS = {
    'max_entries': 8192, 'max_key_bytes': 16384,
    'max_encoded_bytes': 16777216, 'max_owned_bytes': 67108864,
    'max_logical_calls': 8640,
}
SIGNALS = (Clamped, InvalidOperation, DivisionByZero, Inexact, Rounded,
           Subnormal, Overflow, Underflow, FloatOperation)
COUNTERS = ('calls', 'eligible', 'hits', 'misses', 'type_bypasses',
            'context_bypasses', 'capacity_bypasses', 'original_attempts',
            'original_returns', 'original_raises', 'key_build_cpu_ns',
            'key_build_wall_ns')
ACCOUNTING_RESERVE = 16384


class CacheResourceError(RuntimeError):
    pass


class _KeyCapacity(Exception):
    pass


class SupportRadiusCache:
    """Only immutable, fully represented Decimal dependencies can hit.

    Function and code-object identity are retained for this request. Their
    physical source bytes are authenticated by the outer reference harness.
    Key identity uses complete typed bytes, not a digest or Decimal equality.
    """
    def __init__(self, original, bounds):
        if not callable(original):
            raise TypeError('original must be callable')
        if type(bounds) is not dict or set(bounds) != set(DEFAULT_BOUNDS):
            raise TypeError('exact cache bounds dictionary required')
        for name, maximum in DEFAULT_BOUNDS.items():
            value = bounds[name]
            if type(value) is not int or not 1 <= value <= maximum:
                raise ValueError('cache bound is outside approved ceiling: ' + name)
        self._original = original
        self._code = original.__code__ if type(original) is FunctionType else None
        self._bounds = dict(bounds)
        self._entries = {}
        self._counters = {}
        self._payload_bytes = 0
        self._encoded_bytes = 0
        self._peak_owned = 0
        self.clear()

    def _owned(self):
        # Shared callable/code/signal/class/global string objects are not owned.
        # Count all private dictionaries, immutable payload objects and numeric
        # bookkeeping conservatively (including repeated shared small integers).
        return (sys.getsizeof(self) + sys.getsizeof(self.__dict__)
                + sys.getsizeof(self._bounds)
                + sum(sys.getsizeof(value) for value in self._bounds.values())
                + sys.getsizeof(self._counters)
                + sum(sys.getsizeof(value) for value in self._counters.values())
                + sys.getsizeof(self._entries) + self._payload_bytes
                + sys.getsizeof(self._payload_bytes) + sys.getsizeof(self._encoded_bytes)
                + sys.getsizeof(self._peak_owned))

    def _account(self):
        owned = self._owned()
        self._peak_owned = max(self._peak_owned, owned)
        if owned > self._bounds['max_owned_bytes']:
            raise CacheResourceError('actual owned cache accounting exceeded bound')
        return owned

    def clear(self):
        self._entries = {}
        self._counters = {name: 0 for name in COUNTERS}
        self._payload_bytes = self._encoded_bytes = 0
        self._peak_owned = 0
        self._account()
        if self._owned() + ACCOUNTING_RESERVE > self._bounds['max_owned_bytes']:
            raise CacheResourceError('cache bound cannot hold empty bookkeeping reserve')

    def stats(self):
        owned = self._account()
        return {**self._counters, 'entries': len(self._entries),
                'encoded_key_bytes': self._encoded_bytes, 'owned_bytes': owned,
                'peak_owned_bytes': self._peak_owned}

    @staticmethod
    def _valid_args(args, kwargs):
        if kwargs or len(args) != 3:
            return False
        extents, bases, direction = args
        if (type(extents) is not tuple or len(extents) != 3
                or type(bases) is not tuple or len(bases) != 3
                or any(type(row) is not tuple or len(row) != 3 for row in bases)
                or type(direction) is not tuple or len(direction) != 3):
            return False
        return all(type(value) is Decimal and value.is_finite()
                   for row in (extents, *bases, direction) for value in row)

    def _key(self, args, context):
        limit = self._bounds['max_key_bytes']
        leaves = [value for row in (args[0], *args[1], args[2]) for value in row]
        largest = max(sys.getsizeof(value) for value in leaves)
        # Native Decimal.__sizeof__ includes coefficient storage. This check is
        # applied BEFORE as_tuple allocates a digit tuple. A factor64 covers
        # native coefficient -> two simultaneous digit tuple representations;
        # fixed slack covers the bounded output buffer and scalar metadata.
        temporary_reserve = largest * 128 + limit * 16 + 65536
        if (largest > limit or self._owned() + temporary_reserve
                + ACCOUNTING_RESERVE > self._bounds['max_owned_bytes']):
            raise _KeyCapacity()
        data = bytearray()

        def append(value):
            if len(data) + len(value) > limit:
                raise _KeyCapacity()
            data.extend(value)

        def integer(value):
            sign = 1 if value < 0 else 0
            magnitude = -value if value < 0 else value
            count = max(1, (magnitude.bit_length() + 7) // 8)
            if count + 6 > limit - len(data):
                raise _KeyCapacity()
            append(b'I' + bytes((sign,)) + count.to_bytes(4, 'big'))
            append(magnitude.to_bytes(count, 'big'))

        def text(value):
            if len(value) * 4 + 5 > limit - len(data):
                raise _KeyCapacity()
            encoded = value.encode('utf-8')
            append(b'S' + len(encoded).to_bytes(4, 'big')); append(encoded)

        def decimal(value):
            parts = value.as_tuple()
            if len(parts.digits) + 6 > limit - len(data):
                raise _KeyCapacity()
            append(b'D' + bytes((parts.sign,)) + len(parts.digits).to_bytes(4, 'big'))
            append(bytes(parts.digits)); integer(parts.exponent)

        append(b'SUPPORT-RADIUS-KEY-v1\x00')
        integer(id(self._original)); integer(id(self._code))
        if self._code is not None:
            # Keep the original code object alive, preventing identity reuse.
            # A changed __code__ is a source violation, not another memo entry.
            if self._original.__code__ is not self._code:
                raise CacheResourceError('original callable code changed during request')
            text(self._code.co_filename); integer(self._code.co_firstlineno)
            append(b'B' + len(self._code.co_code).to_bytes(4, 'big'))
            append(self._code.co_code)
        append(b'CONTEXT\x00')
        for value in (context.prec, context.Emin, context.Emax, context.capitals, context.clamp):
            integer(value)
        text(context.rounding)
        for signal in SIGNALS:
            text(signal.__name__); integer(id(signal))
            append(bytes((int(context.traps[signal]), int(context.flags[signal]))))
        append(b'ARGS:T3\x00')
        for index, item in enumerate(args):
            if index == 1:
                append(b'BASES:T3\x00')
                for row in item:
                    append(b'T3\x00')
                    for value in row:
                        decimal(value)
            else:
                append(b'EXTENTS:T3\x00' if index == 0 else b'DIRECTION:T3\x00')
                for value in item:
                    decimal(value)
        return bytes(data)

    def _invoke(self, args, kwargs):
        self._counters['original_attempts'] += 1
        try:
            value = self._original(*args, **kwargs)
        except BaseException:
            self._counters['original_raises'] += 1
            # Do not inspect/replace an exception or restore Context flags.
            raise
        self._counters['original_returns'] += 1
        return value

    def call(self, *args, **kwargs):
        if self._counters['calls'] >= self._bounds['max_logical_calls']:
            raise CacheResourceError('logical support-radius call ceiling exhausted')
        self._counters['calls'] += 1
        if not self._valid_args(args, kwargs):
            self._counters['type_bypasses'] += 1
            return self._invoke(args, kwargs)
        context = getcontext()
        native = (type(Decimal.as_tuple) is MethodDescriptorType
                  and type(Context.copy) is MethodDescriptorType)
        if type(context) is not Context or context.prec not in (80, 120) or not native:
            self._counters['context_bypasses'] += 1
            return self._invoke(args, kwargs)
        self._counters['eligible'] += 1
        wall, cpu = time.monotonic_ns(), time.process_time_ns()
        key = None
        try:
            key = self._key(args, context)
        except _KeyCapacity:
            pass
        finally:
            self._counters['key_build_cpu_ns'] += time.process_time_ns() - cpu
            self._counters['key_build_wall_ns'] += time.monotonic_ns() - wall
        if key is None:
            self._counters['misses'] += 1
            self._counters['capacity_bypasses'] += 1
            return self._invoke(args, kwargs)
        entry = self._entries.get(key)
        if entry is not None:
            self._counters['hits'] += 1
            result, flags = entry
            for signal, value in zip(SIGNALS, flags):
                context.flags[signal] = value
            self._account()
            return result
        self._counters['misses'] += 1
        result = self._invoke(args, kwargs)
        flags = tuple(bool(context.flags[signal]) for signal in SIGNALS)
        if type(result) is not Decimal:
            # Original returns remain untouched. No unsupported mutable result
            # can become retained cache state.
            self._counters['capacity_bypasses'] += 1
            return result
        entry = (result, flags)
        payload = (sys.getsizeof(key) + sys.getsizeof(entry)
                   + sys.getsizeof(result) + sys.getsizeof(flags))
        dictionary_growth = max(2048, sys.getsizeof(self._entries) * 2)
        if (len(self._entries) >= self._bounds['max_entries']
                or self._encoded_bytes + len(key) > self._bounds['max_encoded_bytes']
                or self._owned() + payload + dictionary_growth + ACCOUNTING_RESERVE
                > self._bounds['max_owned_bytes']):
            self._counters['capacity_bypasses'] += 1
            return result
        self._entries[key] = entry
        self._encoded_bytes += len(key)
        self._payload_bytes += payload
        self._account()
        return result
