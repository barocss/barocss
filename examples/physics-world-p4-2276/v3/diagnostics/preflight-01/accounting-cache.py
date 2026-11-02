"""V3 changes ownership accounting only; geometry/key/stage code is inherited."""
import ast
import hashlib
import importlib.util
import inspect
from pathlib import Path
import sys
import textwrap

HERE = Path(__file__).resolve().parent
BASE_PATH = HERE.parent / 'v2/scoped-cache.py'
BASE_SHA = 'c100855cdf88cd00a6716df38447f78caeb099e7459e98fee68517f19a85bc4a'
if hashlib.sha256(BASE_PATH.read_bytes()).hexdigest() != BASE_SHA:
    raise RuntimeError('frozen v2 accounting-transfer provider differs')
spec = importlib.util.spec_from_file_location('immutable_v2_scoped_provider_for_v3', BASE_PATH)
BASE = importlib.util.module_from_spec(spec); spec.loader.exec_module(BASE)
DEFAULT_BOUNDS = BASE.DEFAULT_BOUNDS
SIGNALS = BASE.SIGNALS
COUNTERS = BASE.COUNTERS
CacheResourceError = BASE.CacheResourceError
flag_mask = BASE.flag_mask
settings = BASE.settings
BOOKKEEPING_UPPER = 262144
PARTS = {'static': 65536, 'integers': 16384, 'scope': 65536, 'audit': 65536, 'margin': 49152}
TIMER_MAX = 180000000000
AUDIT_COUNT_MAX = 8640 + 3 * 288 + 1024
UNCHANGED = ('_key', '_arguments', '_identity', '_check_context', '_invoke_support',
             'support_radius', 'sat_pair', 'install', 'restore', '_stage_size')
INTEGER_FIELDS = ('_payload_bytes', '_encoded_bytes', '_stage_entries', '_peak_owned',
                  '_bookkeeping_upper', '_pair_dict_bytes', '_pending_dict_bytes', '_active_key_bytes',
                  '_audit_count', '_audit_lifetime_count', '_last_measured_sum', '_last_measured_fixed',
                  '_last_static', '_last_integer', '_last_scope', '_last_audit_scratch',
                  '_last_walk_payload', '_last_walk_keys', '_last_walk_stages')
ATTRIBUTE_NAMES = frozenset(INTEGER_FIELDS + (
    'module', 'original_sat', 'original_support', '_sat_code', '_support_code', '_source', '_bounds',
    '_observer', '_scope_observer', '_pairs', '_counters', '_active', '_sat_wrapper', '_support_wrapper',
    '_audit_mutations', '_audit_busy', '_initialized'))


def need(condition, message):
    if not condition:
        raise CacheResourceError(message)


def stage_allocation(token, value, ordinal_limit):
    need(type(token) is int and 0 <= token < ordinal_limit * 512 and type(value) is tuple and len(value) == 2,
         'stage token/value shape differs')
    result, flags = value
    need(type(result) is BASE.Decimal and type(flags) is tuple and len(flags) == 9 and
         all(type(flag) is bool for flag in flags), 'mutable/unlisted retained stage payload')
    return BASE.SatScopedCache._stage_size(token, value)


class SatScopedCache(BASE.SatScopedCache):
    def __init__(self, module, bounds, observe_original=None, observe_scope=None, audit_mutations=False):
        self._bookkeeping_upper = BOOKKEEPING_UPPER
        self._pair_dict_bytes = self._pending_dict_bytes = self._active_key_bytes = 0
        self._audit_count = self._audit_lifetime_count = 0
        self._last_measured_sum = self._last_measured_fixed = 0
        self._last_static = self._last_integer = self._last_scope = self._last_audit_scratch = 0
        self._last_walk_payload = self._last_walk_keys = self._last_walk_stages = 0
        self._audit_mutations = bool(audit_mutations)
        self._audit_busy = False
        self._initialized = False
        need(sys.implementation.name == 'cpython', 'ownership proof requires the pinned native CPython runtime')
        need(sys.getsizeof(TIMER_MAX) <= 128 and sys.getsizeof(67108864) <= 128,
             'native bounded integer representation exceeds reservation')
        super().__init__(module, bounds, observe_original, observe_scope)
        self._initialized = True
        self.audit()

    def _refresh_sizes(self):
        self._pair_dict_bytes = sys.getsizeof(self._pairs)
        active = self._active
        self._pending_dict_bytes = 0 if active is None else sys.getsizeof(active['pending'])
        self._active_key_bytes = 0 if active is None or active['key'] is None else sys.getsizeof(active['key'])

    def _owned(self):
        # Existing v2 preflights call this before allocation. Containers only
        # mutate at sites followed immediately by the overridden _account().
        active = self._active
        pending = 0 if active is None else active['pending_bytes'] + self._pending_dict_bytes + self._active_key_bytes
        return self._bookkeeping_upper + self._payload_bytes + self._pair_dict_bytes + pending

    def _account(self):
        self._refresh_sizes()
        upper = self._owned()
        self._peak_owned = max(self._peak_owned, upper)
        need(upper <= self._bounds['max_owned_bytes'], 'conservative owned upper bound exceeds frozen64MiB ceiling')
        if self._initialized and self._audit_mutations and not self._audit_busy:
            self.audit()
        return upper

    def clear(self):
        saved = self._audit_mutations
        self._audit_mutations = False
        try:
            BASE.SatScopedCache.clear(self)
            self._audit_count = 0
            self._last_measured_sum = self._last_measured_fixed = 0
            self._last_static = self._last_integer = self._last_scope = self._last_audit_scratch = 0
            self._last_walk_payload = self._last_walk_keys = self._last_walk_stages = 0
        finally:
            self._audit_mutations = saved
        if self._initialized:
            self.audit()

    def _commit(self, active):
        BASE.SatScopedCache._commit(self, active)
        if self._audit_mutations:
            self.audit()

    def _fixed_measure(self):
        # No payload/entry graph is read here. All referenced provider/caller
        # functions, modules, code objects, Contexts, callbacks, global string
        # keys, signal classes and singleton booleans are explicitly shared.
        static = (sys.getsizeof(self) + sys.getsizeof(self.__dict__) + sys.getsizeof(self._bounds)
                  + sys.getsizeof(self._counters) + sys.getsizeof(self._source)
                  + sys.getsizeof(self._sat_wrapper) + sys.getsizeof(self._support_wrapper))
        integer = 0; slots = 0
        for name in INTEGER_FIELDS:
            value = getattr(self, name)
            ceiling = AUDIT_COUNT_MAX if name in ('_audit_count', '_audit_lifetime_count') else 67108864
            need(type(value) is int and 0 <= value <= ceiling and sys.getsizeof(value) <= 128,
                 'private integer size/magnitude/inventory mismatch: ' + name)
            integer += sys.getsizeof(value); slots += 1
        for name, value in self._bounds.items():
            need(type(value) is int and 1 <= value <= DEFAULT_BOUNDS[name] and sys.getsizeof(value) <= 128,
                 'bounds integer differs')
            integer += sys.getsizeof(value); slots += 1
        for name, value in self._counters.items():
            ceiling = TIMER_MAX if name.startswith('key_build_') else (
                self._bounds['max_sat_calls'] if name.startswith(('sat_', 'original_sat_', 'pair_')) else
                self._bounds['max_logical_support_calls'])
            need(type(value) is int and 0 <= value <= ceiling and sys.getsizeof(value) <= 128,
                 'counter integer size/magnitude differs: ' + name)
            integer += sys.getsizeof(value); slots += 1
        need(set(self.__dict__) == ATTRIBUTE_NAMES, 'unlisted private attribute/ownership inventory')
        need(set(self._counters) == set(COUNTERS) and set(self._bounds) == set(DEFAULT_BOUNDS),
             'fixed dictionary shape changed')
        scope = 0; active = self._active
        if active is not None:
            need(set(active) == {'context', 'settings', 'key', 'entry', 'store', 'ordinal', 'pending', 'pending_bytes'},
                 'scope shape changed')
            scope = sys.getsizeof(active) + sys.getsizeof(active['settings'])
            for value in active['settings']:
                scope += sys.getsizeof(value)
            for name, ceiling in (('ordinal', self._bounds['max_stages_per_pair']), ('pending_bytes', 67108864)):
                value = active[name]
                need(type(value) is int and 0 <= value <= ceiling and sys.getsizeof(value) <= 128,
                     'scope integer size/magnitude differs')
                integer += sys.getsizeof(value); slots += 1
            # Five scalar Context settings can be caller/shared native ints;
            # counting these references again is a conservative allocation sum.
            slots += 5
        need(slots + 40 <= 128, 'mutable integer/audit-local slot reservation exceeded')
        need(static <= PARTS['static'] and integer <= PARTS['integers'] and scope <= PARTS['scope'],
             'fixed bookkeeping sub-reservation exceeded')
        return static, integer, scope, slots

    def audit(self):
        need(not self._audit_busy, 'recursive ownership audit')
        self._audit_busy = True
        try:
            self._audit_count += 1; self._audit_lifetime_count += 1
            static, integer, scope, slots = self._fixed_measure()
            payload = keys = stages = 0
            for key, entry in self._pairs.items():
                need(type(key) is bytes and type(entry) is list and len(entry) == 2 and type(entry[1]) is dict,
                     'retained pair shape differs')
                need(len(key) <= self._bounds['max_key_bytes'] and type(entry[0]) is int and
                     1 <= entry[0] <= self._bounds['max_stages_per_pair'], 'retained key/traversal bound differs')
                keys += len(key)
                payload += sys.getsizeof(key) + sys.getsizeof(entry) + sys.getsizeof(entry[0]) + sys.getsizeof(entry[1])
                for token, value in entry[1].items():
                    payload += stage_allocation(token, value, entry[0]); stages += 1
            need(payload == self._payload_bytes and keys == self._encoded_bytes and stages == self._stage_entries,
                 'independent retained payload/key/stage walk differs from ledger')
            need(self._pair_dict_bytes == sys.getsizeof(self._pairs), 'pair-container capacity ledger is stale')
            active = self._active; pending = 0; pending_container = active_key = 0
            if active is not None:
                for token, value in active['pending'].items():
                    pending += stage_allocation(token, value, active['ordinal'])
                need(pending == active['pending_bytes'], 'independent pending payload walk differs')
                pending_container = sys.getsizeof(active['pending'])
                active_key = 0 if active['key'] is None else sys.getsizeof(active['key'])
                need(pending_container == self._pending_dict_bytes and active_key == self._active_key_bytes,
                     'pending/key container ledger is stale')
            measured = static + integer + scope + payload + sys.getsizeof(self._pairs) + pending + pending_container + active_key
            upper = self._owned()
            # Fixed-depth audit stack/locals, iterators and return metadata use
            # this always-reserved component. No seen/id set or graph snapshot.
            frame = sys._getframe()
            # Do not materialize f_locals: that snapshot can retain the frame
            # itself and delay release through a reference cycle.
            scratch_measured = sys.getsizeof(frame)
            scratch_upper = scratch_measured + 16384
            del frame
            need(scratch_upper <= PARTS['audit'], 'audit scratch sub-reservation exceeded')
            fixed = static + integer + scope + scratch_measured
            measured += scratch_measured
            need(fixed <= self._bookkeeping_upper and measured <= upper <= self._bounds['max_owned_bytes'],
                 'allocation sum undercount or ownership ceiling failure')
            self._last_measured_sum = measured; self._last_measured_fixed = fixed
            self._last_static, self._last_integer, self._last_scope = static, integer, scope
            self._last_audit_scratch = scratch_measured
            self._last_walk_payload, self._last_walk_keys, self._last_walk_stages = payload, keys, stages
            return {'fixedBookkeepingMeasuredBytes': fixed, 'measuredAllocationSumBytes': measured,
                    'ownedUpperBoundBytes': upper, 'peakOwnedUpperBoundBytes': self._peak_owned,
                    'integerSlotCountIncludingLocalReservation': slots + 40,
                    'staticMeasuredBytes': static, 'integerMeasuredBytes': integer, 'scopeMeasuredBytes': scope,
                    'auditScratchMeasuredBytes': scratch_measured, 'auditScratchUpperBoundBytes': scratch_upper,
                    'bookkeepingUpperBoundBytes': self._bookkeeping_upper,
                    'auditCount': self._audit_count, 'auditLifetimeCount': self._audit_lifetime_count}
        finally:
            self._audit_busy = False

    def stats(self):
        value = BASE.SatScopedCache.stats(self)
        return {**value, 'ownedUpperBoundBytes': value['owned_bytes'],
                'peakOwnedUpperBoundBytes': value['peak_owned_bytes'],
                'measuredAllocationSumBytes': self._last_measured_sum,
                'fixedBookkeepingMeasuredBytes': self._last_measured_fixed,
                'bookkeepingUpperBoundBytes': self._bookkeeping_upper,
                'auditCount': self._audit_count, 'auditLifetimeCount': self._audit_lifetime_count}


def transfer_proof():
    unchanged = {}
    for name in UNCHANGED:
        method = getattr(SatScopedCache, name); original = getattr(BASE.SatScopedCache, name)
        need(method is original, 'non-accounting v2 method replaced: ' + name)
        unchanged[name] = hashlib.sha256(method.__code__.co_code).hexdigest()
    need(flag_mask is BASE.flag_mask and settings is BASE.settings, 'flag/Context functions replaced')
    allowed = {'__module__', '__doc__', '__init__', '_refresh_sizes', '_owned', '_account', 'clear', '_commit',
               '_fixed_measure', 'audit', 'stats'}
    need(set(SatScopedCache.__dict__) <= allowed, 'unapproved subclass override')
    expected = ast.parse('def _commit(self, active):\n BASE.SatScopedCache._commit(self, active)\n if self._audit_mutations:\n  self.audit()\n').body[0]
    actual = ast.parse(textwrap.dedent(inspect.getsource(SatScopedCache._commit))).body[0]
    need(ast.dump(actual, include_attributes=False) == ast.dump(expected, include_attributes=False),
         'commit transfer must delegate once then run DATA audit only')
    return {'status': 'PASS_ACCOUNTING_ONLY_SOURCE_TRANSFER', 'basePath': str(BASE_PATH), 'baseSha256': BASE_SHA,
            'unchangedMethodBytecodeSha256': unchanged, 'flagAndContextFunctionsIdentical': True,
            'allowedOverrides': sorted(allowed - {'__module__', '__doc__'}), 'geometryFormulaCopies': 0,
            'mathematicalCalls': 0, 'bookkeepingUpperBoundBytes': BOOKKEEPING_UPPER}
