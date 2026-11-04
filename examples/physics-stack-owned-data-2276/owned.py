"""New retained-root adapters; copied qualified traversal, not inherited qualification."""
from fractions import Fraction
import struct
import sys
import types
from decimal import Decimal
import _decimal

AUDIT_LIMIT = 32 * 1024 * 1024
SCRATCH_LIMIT = 8 * 1024 * 1024
FIXED_AUX = 65536
MAX_NODES = 200000
MAX_DEPTH = 64
MAX_WORKLIST = 65
ATOMS = (type(None), bool, int, float, str, bytes, bytearray)
CONTAINERS = (dict, list, tuple, set, frozenset)


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


DECIMAL_POLICY = 'cpython3135-c-coefficient-v1'
TOKEN_SLOTS = ('serial', 'quaternion', 'norm')


def token_descriptors(token_type):
    if token_type is None:
        return ()
    need(type(token_type) is type and token_type.__bases__ == (object,), 'TOKEN_TYPE_NOT_ADMITTED')
    slots = token_type.__dict__.get('__slots__')
    need(type(slots) is tuple and len(slots) == 3 and all(type(name) is str for name in slots)
         and slots == TOKEN_SLOTS
         and all(name not in token_type.__dict__ for name in
                 ('__dict__', '__sizeof__', '__getattribute__', '__getattr__')),
         'TOKEN_TYPE_NOT_ADMITTED')
    descriptors = tuple(token_type.__dict__.get(name) for name in TOKEN_SLOTS)
    need(all(type(value) is types.MemberDescriptorType
             and value.__objclass__ is token_type and value.__name__ == name
             for name, value in zip(TOKEN_SLOTS, descriptors)), 'TOKEN_NATIVE_SLOTS_REQUIRED')
    return descriptors


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


def owned_size(root, *, data_reservation, decimal_policy=None, token_type=None, total_limit=AUDIT_LIMIT,
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
    need(decimal_policy is None or type(decimal_policy) is str and decimal_policy == DECIMAL_POLICY,
         'DECIMAL_POLICY_INVALID')
    if decimal_policy is not None:
        need(Decimal is _decimal.Decimal and Decimal.__module__ == 'decimal'
             and _decimal.__libmpdec_version__ == '4.0.1'
             and type(Decimal.__dict__.get('__sizeof__')) is types.MethodDescriptorType,
             'DECIMAL_C_SIZE_POLICY_UNAVAILABLE')
    descriptors = token_descriptors(token_type)
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
            token = token_type is not None and kind is token_type
            decimal = kind is Decimal
            need(not decimal or decimal_policy == DECIMAL_POLICY, 'DECIMAL_SIZE_UNKNOWN')
            # Unknown class/metaclass equality must never run during admission.
            need(any(kind is supported for supported in ATOMS + CONTAINERS + (Fraction, Decimal))
                 or token, 'UNSUPPORTED_OWNED_TYPE')
            amount = sys.getsizeof(current)
            need(owned + amount <= data_reservation, 'OWNED_DATA_RESERVATION_EXCEEDED')
            # Reserve ID integer plus old/new set tables BEFORE seen.add.
            id_size = sys.getsizeof(oid)
            next_set_bound = _set_growth_bound(seen, nodes + 1) - sys.getsizeof(seen)
            reserve(next_set_bound + id_size)
            seen.add(oid); ids_bytes += id_size; owned += amount; nodes += 1
            need(sys.getsizeof(seen) <= next_set_bound, 'SET_LAYOUT_BOUND')
            deepest = max(deepest, depth)
            if kind in CONTAINERS or kind is Fraction or token:
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
                    try:
                        children = tuple(descriptor.__get__(current, token_type) for descriptor in descriptors)
                    except AttributeError:
                        raise OwnedError('TOKEN_SLOT_UNSET') from None
                    iterator, frame_kind = iter(children), 'token'
                    del children
                frame = _Frame(current, iterator, depth, frame_kind)
                # Fraction/Token iterators own a tuple. Charge its complete shallow
                # storage conservatively; actual referenced children are data nodes.
                extra_tuple = 64 if frame_kind == 'token' else 56 if frame_kind == 'fraction' else 0
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
                totalLimitBytes=total_limit, scratchLimitBytes=aux_limit, rssMeasured=False,
                decimalPolicy=decimal_policy, tokenTypeAdmitted=token_type is not None,
                nativeTemporaries='UNKNOWN', allLiveFrames='UNKNOWN', whole64MiBBound=False)
