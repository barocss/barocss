"""Closed owned-data accounting. No physics, model, reference or network imports."""
from contextlib import contextmanager
from fractions import Fraction
import hashlib
import json
import math
import os
from pathlib import Path
import struct
import stat
import sys
import types

AUDIT_LIMIT = 32 * 1024 * 1024
SCRATCH_LIMIT = 8 * 1024 * 1024
FILE_LIMIT = 2 * 1024 * 1024
CHUNK = 65536
FIXED_AUX = 65536
MAX_NODES = 200000
MAX_DEPTH = 64
MAX_WORKLIST = 65
ATOMS = (type(None), bool, int, float, str, bytes, bytearray)
CONTAINERS = (dict, list, tuple, set, frozenset)
FORBIDDEN_RECORDS = (types.ModuleType, types.FunctionType, types.BuiltinFunctionType,
                     types.MethodType, types.CodeType, types.FrameType, types.TracebackType, type)


class OwnedError(ValueError):
    pass


def need(ok, reason):
    if not ok:
        raise OwnedError(reason)


def runtime_guard():
    # The set-table preallocation rule below is deliberately runtime-specific.
    need(sys.implementation.name == 'cpython' and sys.version_info[:3] == (3, 13, 5)
         and struct.calcsize('P') == 8, 'UNSUPPORTED_RUNTIME_LAYOUT')
    need(sys.getsizeof([]) == 56 and sys.getsizeof([None]) == 64
         and sys.getsizeof(0) == 28, 'UNSUPPORTED_CONTAINER_LAYOUT')


class _Frame:
    __slots__ = ('value', 'iterator', 'depth', 'pending', 'has_pending', 'kind')

    def __init__(self, value, iterator, depth, kind):
        self.value, self.iterator, self.depth, self.kind = value, iterator, depth, kind
        self.pending, self.has_pending = None, False

    def next(self):
        if self.kind == 'dict':
            if self.has_pending:
                self.has_pending = False
                return self.value[self.pending]
            key = next(self.iterator)
            self.pending, self.has_pending = key, True
            return key
        return next(self.iterator)


def _set_growth_bound(seen, new_count):
    # CPython3.13 set entries are16 bytes. A no-deletion insertion grows to at
    # most next_power_of_two(4*used), or a smaller table above50000 entries.
    # Reserve BOTH the still-live old set and the complete possible new table.
    capacity = 8
    while capacity <= 4 * new_count:
        capacity *= 2
    return sys.getsizeof(seen) + sys.getsizeof(set()) + 16 * capacity


def _owned_size(root, *, data_reservation, allowed_record_types=(), total_limit=AUDIT_LIMIT,
               aux_limit=SCRATCH_LIMIT, max_nodes=MAX_NODES, max_depth=MAX_DEPTH,
               max_worklist=MAX_WORKLIST):
    """Measure a closed graph. Caller pre-reserves its data before this walk.

    A caller-created tuple used for multiple roots is itself an owned node.
    Shared IDs/cycles count once. No caller data is changed. Unknown types fail.
    """
    runtime_guard()
    need(type(data_reservation) is int and type(total_limit) is int and 0 <= data_reservation <= total_limit <= AUDIT_LIMIT,
         'DATA_RESERVATION_ARGUMENT')
    need(type(aux_limit) is int and 0 < aux_limit <= SCRATCH_LIMIT, 'AUX_LIMIT_ARGUMENT')
    need(all(type(x) is int for x in (max_nodes, max_depth, max_worklist)) and
         0 < max_nodes <= MAX_NODES and 0 <= max_depth <= MAX_DEPTH
         and 0 < max_worklist <= MAX_WORKLIST, 'WALK_LIMIT_ARGUMENT')
    need(type(allowed_record_types) is tuple and all(type(t) is type and t not in
         ATOMS + CONTAINERS + FORBIDDEN_RECORDS + (Fraction, object) and t.__bases__ == (object,)
         and '__slots__' not in t.__dict__ and '__sizeof__' not in t.__dict__
         and type(t.__dict__.get('__dict__')) is types.GetSetDescriptorType
         for t in allowed_record_types), 'EXPLICIT_PLAIN_RECORD_TYPES_REQUIRED')
    # No dynamic worklist resize. Reserve it and the empty seen set BEFORE allocation.
    base = FIXED_AUX + 56 + 8 * max_worklist + sys.getsizeof(set())
    need(base <= aux_limit and data_reservation + base <= total_limit, 'WALK_INITIAL_AUX_LIMIT')
    work = [None] * max_worklist
    seen = set()
    ids_bytes = frames_bytes = owned = nodes = top = deepest = work_peak = 0
    reserved_peak, observed_peak = base, base
    current, depth = root, 0

    def reserve(extra):
        nonlocal reserved_peak, observed_peak
        actual = FIXED_AUX + sys.getsizeof(work) + sys.getsizeof(seen) + ids_bytes + frames_bytes
        proposed = actual + extra
        need(proposed <= aux_limit and data_reservation + proposed <= total_limit,
             'WALK_AUX_PREALLOCATION_LIMIT')
        observed_peak = max(observed_peak, actual)
        reserved_peak = max(reserved_peak, proposed)

    while True:
        oid = id(current)
        if oid not in seen:
            need(nodes < max_nodes, 'WALK_NODE_LIMIT')
            need(depth <= max_depth, 'WALK_DEPTH_LIMIT')
            kind = type(current)
            record = kind in allowed_record_types
            need(kind in ATOMS + CONTAINERS + (Fraction,) or record, 'UNSUPPORTED_OWNED_TYPE')
            amount = sys.getsizeof(current)
            need(owned + amount <= data_reservation, 'OWNED_DATA_RESERVATION_EXCEEDED')
            # Reserve ID integer plus old/new set tables BEFORE seen.add.
            id_size = sys.getsizeof(oid)
            next_set_bound = _set_growth_bound(seen, nodes + 1) - sys.getsizeof(seen)
            reserve(next_set_bound + id_size)
            seen.add(oid); ids_bytes += id_size; owned += amount; nodes += 1
            need(sys.getsizeof(seen) <= next_set_bound, 'SET_LAYOUT_BOUND')
            deepest = max(deepest, depth)
            if kind in CONTAINERS or kind is Fraction or record:
                need(top < max_worklist, 'WALK_WORKLIST_LIMIT')
                # Fixed reserve covers frame, built-in iterator, tiny depth integer
                # and iterator construction. Post-check checks actual sizes too.
                reserve(2048)
                if kind is dict:
                    iterator, frame_kind = iter(current), 'dict'
                elif kind in (list, tuple, set, frozenset):
                    iterator, frame_kind = iter(current), 'sequence'
                elif kind is Fraction:
                    # This tuple is AUX only, never a data node or a seen ID.
                    iterator, frame_kind = iter((current.numerator, current.denominator)), 'fraction'
                else:
                    record_dict = object.__getattribute__(current, '__dict__')
                    need(type(record_dict) is dict, 'RECORD_DICT_REQUIRED')
                    iterator, frame_kind = iter((record_dict,)), 'record'
                frame = _Frame(current, iterator, depth, frame_kind)
                # Fraction/record iterators own a tuple. Charge its complete shallow
                # storage conservatively; actual referenced children are data nodes.
                extra_tuple = 56 if frame_kind in ('fraction', 'record') else 0
                charge = sys.getsizeof(frame) + sys.getsizeof(iterator) + 32 + extra_tuple
                need(charge <= 2048, 'FRAME_RESERVATION_EXCEEDED')
                work[top] = (frame, charge); top += 1; work_peak = max(work_peak, top)
                # The small actual frame/charge pair is explicitly AUX.
                charge += sys.getsizeof(work[top - 1]) + sys.getsizeof(charge)
                frames_bytes += charge
                # Store the final charge without allocating a replacement tuple.
                # Fixed2048 pre-reservation already covers both transient pairs.
                work[top - 1] = (frame, charge)
                reserve(0)
        if not top:
            break
        while top:
            frame, charge = work[top - 1]
            try:
                current = frame.next(); depth = frame.depth + 1
                break
            except StopIteration:
                top -= 1; work[top] = None; frames_bytes -= charge
        if not top:
            break
    reserve(0)
    need(owned + reserved_peak <= total_limit, 'WALK_FINAL_DATA_PLUS_AUX_LIMIT')
    return dict(ownedBytes=owned, dataReservationBytes=data_reservation, uniqueNodes=nodes,
                maxDepth=deepest, maxWorklistUsed=work_peak, auxObservedPeakBytes=observed_peak,
                auxReservedPeakBytes=reserved_peak, combinedReservedPeakBytes=data_reservation + reserved_peak,
                totalLimitBytes=total_limit, scratchLimitBytes=aux_limit, rssMeasured=False)


class JsonDocument:
    __slots__ = ('value', 'pin', 'reservationBytes', '_budget', '_slot')

    def __init__(self, value, pin, reservation, budget, slot):
        self.value, self.pin, self.reservationBytes = value, pin, reservation
        self._budget, self._slot = budget, slot

    def release(self):
        need(self._slot is not None, 'DOCUMENT_ALREADY_RELEASED')
        self._budget._release(self._slot)
        self.value = None
        self._slot = None


class JsonBudget:
    """Explicit retained reservations, not a heap profiler or alias detector."""
    def __init__(self, limit=AUDIT_LIMIT, scratch=SCRATCH_LIMIT, max_documents=64):
        runtime_guard()
        need(type(limit) is int and 0 < limit <= AUDIT_LIMIT and
             type(scratch) is int and FIXED_AUX <= scratch <= SCRATCH_LIMIT, 'JSON_BUDGET_ARGUMENT')
        need(type(max_documents) is int and 0 < max_documents <= 64, 'DOCUMENT_SLOT_LIMIT')
        need(scratch + FIXED_AUX + 56 + 8 * max_documents <= limit, 'JSON_INITIAL_RESERVATION')
        self.limit, self.scratch = limit, scratch
        self.retainedBytes, self.peakReservedBytes, self.phase = 0, 0, None
        self._slots = [0] * max_documents

    def _check(self, temporary=0):
        total = FIXED_AUX + 56 + 8 * len(self._slots) + self.retainedBytes + self.scratch + temporary
        need(total <= self.limit, 'JSON_AGGREGATE_RESERVATION_LIMIT')
        self.peakReservedBytes = max(self.peakReservedBytes, total)

    def _release(self, slot):
        need(self.phase is None, 'RELEASE_DURING_ACTIVE_PHASE')
        self.retainedBytes -= self._slots[slot]; self._slots[slot] = 0

    @contextmanager
    def kernel_helper_phase(self, extra_retained_bound):
        need(self.phase is None and type(extra_retained_bound) is int and extra_retained_bound >= 0,
             'HELPER_PHASE_OR_BOUND')
        self._check(extra_retained_bound)
        self.phase = 'kernel-helper'
        try:
            yield dict(helperScratchReservedBytes=self.scratch, walkerConcurrent=False,
                       retainedAndExtraBoundBytes=self.retainedBytes + extra_retained_bound)
        finally:
            self.phase = None

    @contextmanager
    def walk_phase(self):
        need(self.phase is None, 'WALK_PHASE_OVERLAP')
        self._check(); self.phase = 'walk'
        try:
            yield
        finally:
            self.phase = None



def owned_size(root, *, data_reservation, allowed_record_types=(), total_limit=AUDIT_LIMIT,
               aux_limit=SCRATCH_LIMIT, max_nodes=MAX_NODES, max_depth=MAX_DEPTH,
               max_worklist=MAX_WORKLIST, budget=None):
    arguments = dict(data_reservation=data_reservation, allowed_record_types=allowed_record_types,
                     total_limit=total_limit, aux_limit=aux_limit, max_nodes=max_nodes,
                     max_depth=max_depth, max_worklist=max_worklist)
    if budget is None:
        return _owned_size(root, **arguments)
    need(type(budget) is JsonBudget and data_reservation >= budget.retainedBytes,
         'WALK_BUDGET_RESERVATION')
    controller = FIXED_AUX + 56 + 8 * len(budget._slots)
    arguments['total_limit'] = min(total_limit, budget.limit - controller)
    arguments['aux_limit'] = min(aux_limit, budget.scratch)
    with budget.walk_phase():
        result = _owned_size(root, **arguments)
    result['budgetControllerReservedBytes'] = controller
    result['combinedIncludingBudgetControllerBytes'] = result['combinedReservedPeakBytes'] + controller
    return result


def _lexical(data):
    tokens = depth = peak = 0
    quoted = escaped = atom = False
    for byte in data:
        if quoted:
            if escaped:
                escaped = False
            elif byte == 92:
                escaped = True
            elif byte == 34:
                quoted = False
        elif byte == 34:
            quoted = True; atom = False; tokens += 1
        elif byte in (91, 123):
            depth += 1; peak = max(peak, depth); tokens += 1; atom = False
            need(peak <= MAX_DEPTH, 'JSON_LEXICAL_DEPTH_LIMIT')
        elif byte in (93, 125):
            depth -= 1; atom = False
            need(depth >= 0, 'JSON_LEXICAL_DEPTH')
        elif byte in (9, 10, 13, 32, 44, 58):
            atom = False
        elif not atom:
            atom = True; tokens += 1
        need(tokens <= 100000, 'JSON_LEXICAL_TOKEN_LIMIT')
    need(not quoted and not escaped and depth == 0, 'JSON_LEXICAL_INCOMPLETE')
    return tokens, peak


def _unique(items):
    result = {}
    for key, value in items:
        need(key not in result, 'JSON_DUPLICATE_KEY')
        result[key] = value
    return result


def _integer(text):
    need(len(text) <= 16, 'JSON_INTEGER_LEXEME_LIMIT')
    return int(text)


def _floating(text):
    need(len(text) <= 64, 'JSON_FLOAT_LEXEME_LIMIT')
    value = float(text)
    need(math.isfinite(value), 'JSON_NONFINITE')
    return value


def _invalid(_):
    raise OwnedError('JSON_NONFINITE')


def read_json(path, budget, expected_pin=None):
    """Raw cap/reservation before reads; lexical decode reservation before loads."""
    need(type(budget) is JsonBudget and budget.phase is None, 'JSON_PHASE_OVERLAP')
    slot = next((i for i, size in enumerate(budget._slots) if size == 0), None)
    need(slot is not None, 'DOCUMENT_SLOT_LIMIT')
    path = Path(path)
    info = path.stat(); size = info.st_size
    need(stat.S_ISREG(info.st_mode) and 0 <= size <= FILE_LIMIT, 'JSON_FILE_LIMIT_BEFORE_READ')
    # Conservative fixed raw/decoder headroom and hash/view metadata BEFORE allocation.
    budget._check(2 * size + 2 * CHUNK + FIXED_AUX)
    budget.phase = 'json-read'
    try:
        # Supported immutable files use ONE stat-sized raw allocation. No
        # bytearray.extend/reallocation and no extra sentinel read are used.
        raw = bytearray(size); digest = hashlib.sha256(); offset = 0
        with path.open('rb', buffering=0) as stream:
            need(os.fstat(stream.fileno()).st_size == size, 'JSON_FILE_CHANGED_BEFORE_READ')
            while offset < size:
                view = memoryview(raw)[offset:min(size, offset + CHUNK)]
                try:
                    count = stream.readinto(view)
                    need(type(count) is int and 0 <= count <= len(view), 'JSON_BOUNDED_READ_RESULT')
                    if count:
                        digest.update(view[:count])
                finally:
                    view.release(); del view
                if not count:
                    break
                offset += count
            need(offset == size and os.fstat(stream.fileno()).st_size == size
                 and path.stat().st_size == size, 'JSON_FILE_CHANGED_OR_OVER_LIMIT')
        actual_pin = dict(bytes=len(raw), sha256=digest.hexdigest())
        need(expected_pin is None or actual_pin == expected_pin, 'JSON_SOURCE_PIN_MISMATCH')
        tokens, depth = _lexical(raw)
        #256 per syntax token covers container tables, parsed scalars, pair-hook
        #entry tuples and temporary maps.8*wire covers decoded strings plus UTF
        #decoder text; raw storage remains separately reserved until release.
        decoded = 256 * tokens + 8 * len(raw) + FIXED_AUX
        budget._check(decoded + 2 * size + 2 * CHUNK + FIXED_AUX)
        value = json.loads(raw, object_pairs_hook=_unique, parse_int=_integer,
                           parse_float=_floating, parse_constant=_invalid)
        del raw
        budget._slots[slot] = decoded; budget.retainedBytes += decoded
        budget._check()
        return JsonDocument(value, actual_pin, decoded, budget, slot)
    finally:
        budget.phase = None
