"""Root only. Flat registered retained objects, never a copied traversal oracle."""
import hashlib
import importlib.util
import json
from pathlib import Path
import signal
import sys
import time


def require(value, reason):
    if not value:
        raise AssertionError(reason)


def pin(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''):
            h.update(block)
    return dict(bytes=Path(path).stat().st_size, sha256=h.hexdigest())


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    require(len(sys.argv) == 3, 'USAGE:selftest.py FRESH_OUTPUT_DIRECTORY ROOT_REVIEWED_PINS_SHA')
    here = Path(__file__).resolve().parent; repo = here.parents[1]
    pins_path = here / 'PINS.json'
    require(pins_path.stat().st_size <= 65536, 'PINS_64K')
    raw = pins_path.read_bytes()
    require(hashlib.sha256(raw).hexdigest() == sys.argv[2], 'EXACT_ROOT_REVIEWED_PINS')
    pins = json.loads(raw)

    def authenticate():
        require(Path(sys.executable).resolve() == Path(pins['python']).resolve(), 'PINNED_EXECUTABLE')
        require(sys.version == pins['pythonVersion'], 'PINNED_PYTHON_VERSION')
        require(hashlib.sha256(pins_path.read_bytes()).hexdigest() == sys.argv[2], 'PINS_UNCHANGED')
        for name, expected in pins['files'].items():
            path = Path(name) if name.startswith('/') else repo / name
            require(pin(path) == expected, 'SOURCE_BINARY_PIN:' + name)

    authenticate()  # BEFORE target, Decimal or Fraction imports.
    owned = load(here / 'owned.py', 'stack_owned_component')
    ledger = load(here / 'ledger.py', 'stack_fixed_ledger')
    from decimal import Decimal, getcontext
    from fractions import Fraction
    import _decimal
    require(Path(_decimal.__file__).resolve() == Path(pins['decimalExtension']).resolve(), 'PINNED_DECIMAL_C_MODULE')
    out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=False)
    started = time.monotonic_ns()
    signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError('COMPONENT_170S')))
    signal.alarm(170)
    report = dict(status='NOT_RUN', firstFailure=None, groups=[], physicsCalls=0,
                  productionImports=0, oldSelftestCalls=0, baselineReruns=0,
                  whole64MiBBound=False, nativeTemporaries='UNKNOWN', allLiveFrames='UNKNOWN',
                  CPU='NOT_RUN', RSS='NOT_RUN', full1200='BLOCKED', API=False)

    class Token:
        __slots__ = ('serial', 'quaternion', 'norm')

        def __init__(self, serial, quaternion, norm):
            self.serial, self.quaternion, self.norm = serial, quaternion, norm

    class TokenChild(Token):
        pass

    class OtherSlots:
        __slots__ = ('payload',)

    traps = [0]

    class LookupTrap:
        __slots__ = ('serial', 'quaternion', 'norm')

        def __getattribute__(self, name):
            traps[0] += 1
            return object.__getattribute__(self, name)

    class PropertyTrap:
        __slots__ = ('serial', 'quaternion', 'norm')

    def trap(_):
        traps[0] += 1
        raise AssertionError('SUBJECT_GETTER_CALLED')

    PropertyTrap.norm = property(trap)

    class DecimalChild(Decimal):
        pass

    class TrapMeta(type):
        def __eq__(self, other):
            traps[0] += 1
            raise AssertionError('UNKNOWN_METACLASS_EQUALITY_CALLED')

    class MetaTrap(metaclass=TrapMeta):
        pass

    class Registry:
        def __init__(self):
            self.objects = {}

        def add(self, value):
            self.objects[id(value)] = value
            return value

        def array(self, values=()):
            return self.add(list(values))

        def fraction(self, numerator, denominator):
            value = self.add(Fraction(numerator, denominator))
            self.add(value.numerator); self.add(value.denominator)
            return value

        def expected(self):
            # Flat known objects only. No traversal, child discovery or candidate call.
            return sum(sys.getsizeof(value) for value in self.objects.values()), len(self.objects)

    def refusal(call, prefix):
        try:
            call()
        except (owned.OwnedError, ledger.LedgerError) as error:
            require(str(error).startswith(prefix), 'WRONG_REFUSAL:' + str(error))
            return
        raise AssertionError('EXPECTED_REFUSAL:' + prefix)

    def unchanged_denial(book, call, prefix):
        before = book.snapshot()
        refusal(call, prefix)
        require(book.snapshot() == before, 'LEDGER_CHANGED_ON_REFUSAL:' + prefix)

    try:
        # G1: each actual subject object is registered at construction.
        reg = Registry(); root = reg.array()
        alpha, beta, shared = reg.add('alpha'), reg.add('beta'), reg.add((1 << 512) + 17)
        child = reg.array([shared]); mapping = reg.add({alpha: child, beta: shared})
        root.extend([mapping, child, shared])
        fraction = reg.fraction((1 << 1024) + 1, 3)
        root.extend([fraction, fraction.numerator, fraction.denominator])
        word = reg.add(b'bytes'); mutable = reg.add(bytearray(b'buffer'))
        pair = reg.add((word, mutable)); root.extend([pair, root])
        expected, nodes = reg.expected()
        first = owned.owned_size(root, data_reservation=expected)
        require(first['ownedBytes'] == expected and first['uniqueNodes'] == nodes, 'G1_FLAT_ORACLE')
        require(mapping[alpha] is child and mapping[beta] is shared and root[-1] is root, 'G1_SUBJECT_MUTATION')
        report['groups'].append(dict(id='G1-direct-keys-values-fraction-alias-cycle', expectedBytes=expected,
                                     expectedNodes=nodes, actual=first))

        # G2: exact values are leaves; no coefficient formula is copied into the oracle.
        decimals = Registry(); droot = decimals.array()
        for text in ('1.0', '1.00', '+0', '-0', '9' * 76, '9' * 300, '1E-100000', '7E+100000'):
            droot.append(decimals.add(Decimal(text)))
        droot.extend([droot[0], droot[5]])
        tuples_before = tuple(value.as_tuple() for value in droot)
        flags_before = dict(getcontext().flags)
        dbytes, dnodes = decimals.expected()
        dactual = owned.owned_size(droot, data_reservation=dbytes, decimal_policy=owned.DECIMAL_POLICY)
        require(dactual['ownedBytes'] == dbytes and dactual['uniqueNodes'] == dnodes, 'G2_DECIMAL_FLAT_ORACLE')
        require(sys.getsizeof(droot[5]) > sys.getsizeof(droot[0]), 'G2_LONG_COEFFICIENT_CAPACITY')
        require(droot[2].as_tuple().sign == 0 and droot[3].as_tuple().sign == 1, 'G2_SIGNED_ZERO')
        require(tuple(value.as_tuple() for value in droot) == tuples_before and dict(getcontext().flags) == flags_before,
                'G2_DECIMAL_OR_FLAGS_MUTATED')
        report['groups'].append(dict(id='G2-decimal-cohorts-signed-zero-capacity', expectedBytes=dbytes,
                                     expectedNodes=dnodes, actual=dactual))

        # G3: direct slot referents are named independently at construction.
        tokens = Registry(); troot = tokens.array()
        serial = tokens.add(10001); norm = tokens.add(Decimal('1.00'))
        components = [tokens.add(Decimal(text)) for text in ('0', '-0', '0', '1')]
        quaternion = tokens.add(tuple(components))
        token = tokens.add(Token(serial, quaternion, norm)); troot.extend([token, token, norm])
        tbytes, tnodes = tokens.expected()
        tactual = owned.owned_size(troot, data_reservation=tbytes, decimal_policy=owned.DECIMAL_POLICY, token_type=Token)
        require(tactual['ownedBytes'] == tbytes and tactual['uniqueNodes'] == tnodes, 'G3_TOKEN_FLAT_ORACLE')
        require(token.quaternion is quaternion and token.norm is norm and token.serial is serial, 'G3_TOKEN_MUTATION')
        report['groups'].append(dict(id='G3-exact-token-native-strong-slots', expectedBytes=tbytes,
                                     expectedNodes=tnodes, actual=tactual, actualProductionToken='NOT_IMPORTED'))

        # G4: unsupported subjects and policies cannot invoke user getters.
        refusal(lambda: owned.owned_size(droot, data_reservation=dbytes), 'DECIMAL_SIZE_UNKNOWN')
        refusal(lambda: owned.owned_size(droot, data_reservation=dbytes, decimal_policy='unknown'), 'DECIMAL_POLICY_INVALID')
        refusal(lambda: owned.owned_size(DecimalChild('1'), data_reservation=65536, decimal_policy=owned.DECIMAL_POLICY), 'UNSUPPORTED_OWNED_TYPE')
        refusal(lambda: owned.owned_size(OtherSlots(), data_reservation=65536), 'UNSUPPORTED_OWNED_TYPE')
        refusal(lambda: owned.owned_size(TokenChild(serial, quaternion, norm), data_reservation=65536,
                                         decimal_policy=owned.DECIMAL_POLICY, token_type=Token), 'UNSUPPORTED_OWNED_TYPE')
        refusal(lambda: owned.owned_size(token, data_reservation=65536), 'UNSUPPORTED_OWNED_TYPE')
        refusal(lambda: owned.owned_size(LookupTrap(), data_reservation=65536, token_type=LookupTrap), 'TOKEN_TYPE_NOT_ADMITTED')
        refusal(lambda: owned.owned_size(PropertyTrap(), data_reservation=65536, token_type=PropertyTrap), 'TOKEN_NATIVE_SLOTS_REQUIRED')
        missing = object.__new__(Token); missing.serial = serial
        refusal(lambda: owned.owned_size(missing, data_reservation=65536, token_type=Token), 'TOKEN_SLOT_UNSET')
        refusal(lambda: owned.owned_size(object(), data_reservation=65536), 'UNSUPPORTED_OWNED_TYPE')
        refusal(lambda: owned.owned_size(MetaTrap(), data_reservation=65536), 'UNSUPPORTED_OWNED_TYPE')
        require(traps == [0], 'G4_USER_GETTER_EXECUTED')
        report['groups'].append(dict(id='G4-unknown-policies-types-unset-slots', refusalCases=11, getterCalls=0))

        # G5: known data charges and independently bounded AUX define exact boundaries.
        refusal(lambda: owned.owned_size(root, data_reservation=expected - 1), 'OWNED_DATA_RESERVATION_EXCEEDED')
        at = owned.owned_size(root, data_reservation=expected, total_limit=first['combinedReservedPeakBytes'])
        require(at['ownedBytes'] == expected, 'G5_AT_TOTAL_BOUNDARY')
        refusal(lambda: owned.owned_size(root, data_reservation=expected, total_limit=first['combinedReservedPeakBytes'] - 1), 'WALK_')
        refusal(lambda: owned.owned_size(root, data_reservation=expected, max_nodes=nodes - 1), 'WALK_NODE_LIMIT')
        refusal(lambda: owned.owned_size(root, data_reservation=expected, max_depth=0), 'WALK_DEPTH_LIMIT')
        refusal(lambda: owned.owned_size(root, data_reservation=-1), 'DATA_RESERVATION_ARGUMENT')
        refusal(lambda: owned.owned_size(root, data_reservation=True), 'DATA_RESERVATION_ARGUMENT')
        require(mapping[alpha] is child and mapping[beta] is shared and root[-1] is root, 'G5_SUBJECT_MUTATED')
        report['groups'].append(dict(id='G5-data-total-node-depth-boundaries', exactTotal=at['combinedReservedPeakBytes']))

        # G6: all checks precede mutation; flat snapshots are the independent oracle.
        book = ledger.Ledger()
        for owner in ledger.OWNERS:
            book.reserve(owner, 0)
        require(book.snapshot()['totalReservedBytes'] == ledger.CONTROL, 'G6_FIVE_ZERO_OWNERS')
        for owner in ledger.OWNERS:
            book.release(owner, aliases_cleared=True)
        book.reserve('producer', ledger.CAP - ledger.CONTROL)
        require(book.snapshot()['totalReservedBytes'] == 67108864, 'G6_EXACT64_WITH_CONTROLLER')
        unchanged_denial(book, lambda: book.reserve('geometry', 1), 'GLOBAL_DATA_LIMIT')
        unchanged_denial(book, lambda: book.reserve('producer', 0), 'DUPLICATE_RESERVATION')
        for amount in (-1, True, 1.5):
            unchanged_denial(book, lambda amount=amount: book.reserve('geometry', amount), 'RESERVATION_AMOUNT_INVALID')
        unchanged_denial(book, lambda: book.reserve('unknown', 0), 'UNKNOWN_OWNER')
        unchanged_denial(book, lambda: book.release('geometry', aliases_cleared=True), 'UNMATCHED_RELEASE')
        unchanged_denial(book, lambda: book.release('producer'), 'ALIASES_NOT_DECLARED_CLEARED')
        unchanged_denial(book, lambda: book.release('unknown', aliases_cleared=True), 'UNKNOWN_OWNER')
        book.release('producer', aliases_cleared=True); book.reserve('producer', 1)
        require(book.snapshot()['totalReservedBytes'] == ledger.CONTROL + 1, 'G6_RELEASE_RERESERVE')
        report['groups'].append(dict(id='G6-fixed-five-owner-atomic-global-limit', final=book.snapshot()))

        # G7: one credit is held throughout preparation, proof and archive persistence.
        flow = ledger.Ledger(); flow.begin(1); flow.advance(1, 'proof'); flow.advance(1, 'archive')
        flow.begin(2); flow.advance(2, 'proof'); flow.begin(3)
        require([x['phase'] for x in flow.snapshot()['credits']] == ['archive', 'proof', 'prepare'], 'G7_THREE_LIVE_PHASES')
        unchanged_denial(flow, lambda: flow.begin(4), 'STEP_CREDIT_LIMIT')
        unchanged_denial(flow, lambda: flow.begin(3), 'STEP_NOT_NEXT')
        unchanged_denial(flow, lambda: flow.begin(5), 'STEP_NOT_NEXT')
        for step in (-1, True):
            unchanged_denial(flow, lambda step=step: flow.begin(step), 'STEP_ID_INVALID')
        unchanged_denial(flow, lambda: flow.advance(4, 'proof'), 'UNKNOWN_STEP')
        unchanged_denial(flow, lambda: flow.advance(3, 'archive'), 'PHASE_TRANSITION_INVALID')
        unchanged_denial(flow, lambda: flow.advance(3, 'prepare'), 'PHASE_INVALID')
        unchanged_denial(flow, lambda: flow.advance(2, 'proof'), 'PHASE_TRANSITION_INVALID')
        unchanged_denial(flow, lambda: flow.commit(3), 'ARCHIVE_NOT_COMPLETED')
        flow.advance(2, 'archive')
        unchanged_denial(flow, lambda: flow.commit(2), 'NONCONTIGUOUS_COMMIT')
        flow.commit(1); flow.begin(4); flow.fail(3)
        require(flow.snapshot()['lastAcceptedStep'] == 1, 'G7_FAILURE_RETAINS_FRONTIER')
        unchanged_denial(flow, lambda: flow.begin(5), 'PREPARATION_STOPPED_AFTER_FAILURE')
        unchanged_denial(flow, lambda: flow.fail(4), 'FAILURE_ALREADY_RECORDED')
        unchanged_denial(flow, lambda: flow.advance(3, 'proof'), 'FAILED_OR_LATER_STEP_STOPPED')
        unchanged_denial(flow, lambda: flow.discard(2), 'DISCARD_NOT_FAILED_OR_LATER')
        flow.commit(2)  # Earlier, fully archived work may still commit after observed step3 failure.
        flow.discard(4); flow.discard(3)
        final = flow.snapshot()
        require(final['lastAcceptedStep'] == 2 and final['firstObservedFailureStep'] == 3
                and final['earliestFailureKnown'] is False and all(x['step'] == 0 for x in final['credits']), 'G7_FINAL_FRONTIER')
        doomed = ledger.Ledger(); doomed.begin(1); doomed.advance(1, 'proof'); doomed.advance(1, 'archive'); doomed.fail(1)
        unchanged_denial(doomed, lambda: doomed.commit(1), 'FAILED_OR_LATER_STEP_STOPPED')
        report['groups'].append(dict(id='G7-three-phase-credits-failure-frontier', final=final))
        authenticate()
        report['status'] = 'PASS_STACK_RETAINED_DATA_AND_FIXED_LEDGER_COMPONENTS'
        report['finalAuthentication'] = 'ALL_FROZEN_FILES_AND_TOOLS_EQUAL'
    except Exception as error:
        report['status'] = 'FIRST_FAILURE'
        report['firstFailure'] = dict(type=type(error).__name__, message=str(error))
    finally:
        signal.alarm(0)
        report['elapsedWallNs'] = time.monotonic_ns() - started
        encoded = (json.dumps(report, indent=2) + '\n').encode()
        require(len(encoded) <= 2 * 1024 * 1024, 'REPORT2M')
        (out / 'summary.json').write_bytes(encoded)
    return 0 if report['status'] == 'PASS_STACK_RETAINED_DATA_AND_FIXED_LEDGER_COMPONENTS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
