"""Root-only pure-data tests. Oracle is a flat construction registry, not a walk."""
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import signal
import struct
import sys
import time

from owned import (AUDIT_LIMIT, FILE_LIMIT, SCRATCH_LIMIT, JsonBudget, OwnedError,
                   owned_size, read_json)


class Record:
    pass


class Unknown:
    pass


class Registry:
    def __init__(self):
        self.objects = {}

    def add(self, value):
        # Keep actual objects alive. No traversal, child discovery, synthetic nodes
        # or reliance on the production walker's dispatch or size calculation.
        self.objects[id(value)] = value
        return value

    def atom(self, value):
        return self.add(value)

    def array(self, values=()):
        return self.add(list(values))

    def mapping(self, entries):
        return self.add(dict(entries))

    def fraction(self, numerator, denominator):
        value = self.add(Fraction(numerator, denominator))
        self.add(value.numerator); self.add(value.denominator)
        return value

    def record(self, payload, link):
        value = self.add(Record())
        # Register the ACTUAL dictionary and its explicitly constructed keys.
        key1, key2 = self.atom('payload'), self.atom('link')
        value.__dict__ = self.mapping([(key1, payload), (key2, link)])
        return value

    def expected_bytes(self):
        return sum(sys.getsizeof(value) for value in self.objects.values())


def fixture():
    reg = Registry(); root = reg.array()
    for i in range(1200):
        key = reg.atom('key-' + str(i))
        index_key = reg.atom('index-' + str(i))
        large = reg.atom((1 << (256 + i % 17)) + i)
        index = reg.atom(i + 10000)
        child = reg.array([large, index])
        root.append(reg.mapping([(key, child), (index_key, index)]))
    # A true nested path, constructed head-first. Registry has strong references
    # but no extra subject-root edges that would flatten discovery depth.
    head = reg.array(); root.append(head); tail = head
    for _ in range(48):
        following = reg.array(); tail.append(following); tail = following
    tail.append(reg.atom(None))
    fractions = reg.array(); root.append(fractions)
    for i in range(16):
        fractions.append(reg.fraction((1 << (2048 + i)) + i + 1, 3 + 2 * i))
    records = reg.array(); root.append(records)
    for i in range(8):
        records.append(reg.record(fractions[i], root))
    word = reg.atom('owned-word'); number = reg.atom(99999999)
    pair = reg.add((word, number)); root.append(pair)
    root.append(reg.add({word, number})); root.append(reg.add(frozenset((word, number))))
    root.append(reg.atom(b'owned-bytes')); root.append(reg.atom(bytearray(b'owned-array')))
    root.append(reg.atom(-0.0)); root.append(reg.atom(True))
    root.append(root)                  # Cycle, not a second object.
    root.append(fractions[0])          # Alias across unrelated branches.
    root.append(records[0])
    return reg, root


def failure(call, prefix):
    try:
        call()
    except (OwnedError, AttributeError) as error:
        reason = str(error)
        if not reason.startswith(prefix):
            raise AssertionError('WRONG_FAILURE:' + reason) from error
        return reason
    raise AssertionError('EXPECTED_FAILURE:' + prefix)


def require(ok, reason):
    if not ok:
        raise AssertionError(reason)


def file_pin(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''):
            digest.update(block)
    return dict(bytes=path.stat().st_size, sha256=digest.hexdigest())


def main():
    require(len(sys.argv) == 3, 'USAGE:selftest.py FRESH_OUTPUT_DIRECTORY ROOT_REVIEWED_PINS_SHA')
    out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=False)
    started = time.monotonic()
    signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError('SELFTEST_170S')))
    signal.alarm(170)
    report = dict(status='NOT_RUN', firstFailure=None, groups=[], physicsCalls=0,
                  oldAuditCalls=0, candidateCalls=0, baselineReruns=0, rssMeasured=False)
    try:
        here = Path(__file__).resolve().parent; repo = here.parents[1]
        pins_path = here / 'PINS.json'
        require(pins_path.stat().st_size <= 65536, 'BOOTSTRAP_PINS_64K')
        with pins_path.open('rb') as stream:
            pins_raw = stream.read(65537)
        require(len(pins_raw) <= 65536 and hashlib.sha256(pins_raw).hexdigest() == sys.argv[2], 'EXACT_ROOT_REVIEWED_PINS')
        pins = json.loads(pins_raw)
        require(Path(sys.executable).resolve() == Path(pins['python']).resolve() and sys.version == pins['pythonVersion'], 'PINNED_RUNTIME')
        for group in ('files','externalTools'):
            for name, expected_pin_value in pins[group].items():
                target = repo / name if group == 'files' else Path(name)
                require(file_pin(target) == expected_pin_value, 'FROZEN_SOURCE_TOOL_DRIFT:' + name)
        report['pinsPin'] = file_pin(pins_path)
        reg, root = fixture(); expected = reg.expected_bytes()
        result = owned_size(root, data_reservation=expected, allowed_record_types=(Record,))
        require(result['ownedBytes'] == expected and result['uniqueNodes'] == len(reg.objects),
                'FLAT_CONSTRUCTION_REGISTRY_EXACT_OWNED_BYTES_AND_IDS')
        require(result['auxObservedPeakBytes'] <= result['auxReservedPeakBytes'] <= SCRATCH_LIMIT,
                'AUX_ACTUAL_WITHIN_RESERVED')
        require(result['maxDepth'] == 50 and result['maxWorklistUsed'] == 50, 'CONSTRUCTED_VISITED_DEPTH_AND_WORKLIST')
        report['groups'].append(dict(id='flat-registry-graph', status='PASS',
            plannedUnrelatedDicts=1200, plannedChainLinks=48, plannedFractions=16,
            plannedRecords=8, expectedOwnedBytes=expected, expectedUniqueIds=len(reg.objects), actual=result))

        upper = result['combinedReservedPeakBytes']
        for change in (0, 1):
            at = owned_size(root, data_reservation=expected, allowed_record_types=(Record,), total_limit=upper + change)
            require(at['ownedBytes'] == expected, 'AT_AND_ABOVE_COMBINED_LIMIT')
        failure(lambda: owned_size(root, data_reservation=expected, allowed_record_types=(Record,),
                                  total_limit=upper - 1), 'WALK_')
        owned_size(root, data_reservation=expected + 1, allowed_record_types=(Record,))
        failure(lambda: owned_size(root, data_reservation=expected - 1, allowed_record_types=(Record,)),
                'OWNED_DATA_RESERVATION_EXCEEDED')
        for change in (0, 1):
            owned_size(root, data_reservation=expected, allowed_record_types=(Record,),
                       aux_limit=result['auxReservedPeakBytes'] + change)
        failure(lambda: owned_size(root, data_reservation=expected, allowed_record_types=(Record,),
                                  aux_limit=result['auxReservedPeakBytes'] - 1), 'WALK_')
        owned_size(root, data_reservation=expected, allowed_record_types=(Record,),
                   max_nodes=len(reg.objects), max_depth=result['maxDepth'])
        failure(lambda: owned_size(root, data_reservation=expected, allowed_record_types=(Record,),
                                  max_nodes=len(reg.objects) - 1), 'WALK_NODE_LIMIT')
        failure(lambda: owned_size(root, data_reservation=expected, allowed_record_types=(Record,),
                                  max_depth=result['maxDepth'] - 1), 'WALK_DEPTH_LIMIT')
        failure(lambda: owned_size(root, data_reservation=expected, allowed_record_types=(Record,),
                                  max_worklist=1), 'WALK_WORKLIST_LIMIT')
        report['groups'].append(dict(id='data-aux-total-depth-node-worklist-boundaries', status='PASS',
                                     combinedAtBytes=upper, separateAuxAtBytes=result['auxReservedPeakBytes']))

        unknowns = [Unknown(), object(), sys, lambda: None, iter(())]
        for value in unknowns:
            failure(lambda value=value: owned_size(value, data_reservation=4096), 'UNSUPPORTED_OWNED_TYPE')
        failure(lambda: owned_size(sys, data_reservation=4096, allowed_record_types=(type(sys),)),
                'EXPLICIT_PLAIN_RECORD_TYPES_REQUIRED')
        failure(lambda: owned_size(root, data_reservation=expected), 'UNSUPPORTED_OWNED_TYPE')
        report['groups'].append(dict(id='unknown-and-unapproved-records', status='PASS', unsupportedRoots=5))

        raw = '{"n":-0.0,"i":123,"s":"0/1","one":"1/1","a":[true,null],"u":"한"}'.encode()
        path = out / 'metadata.json'; path.write_bytes(raw); expected_pin = file_pin(path)
        budget = JsonBudget(); document = read_json(path, budget, expected_pin)
        require(document.pin == expected_pin and document.value['i'] == 123 and
                document.value['s'] == '0/1' and document.value['one'] == '1/1' and document.value['u'] == '한',
                'SOURCE_HASH_AND_METADATA_UNCHANGED')
        require(struct.pack('>d', document.value['n']).hex() == '8000000000000000', 'NEGATIVE_ZERO_PRESERVED')
        peak = budget.peakReservedBytes; document.release(); require(budget.retainedBytes == 0, 'RELEASE_LEDGER')
        for change in (0, 1):
            b = JsonBudget(limit=peak + change); d = read_json(path, b, expected_pin); d.release()
        failure(lambda: read_json(path, JsonBudget(limit=peak - 1), expected_pin), 'JSON_AGGREGATE_RESERVATION_LIMIT')
        failure(lambda: read_json(path, JsonBudget(), dict(bytes=len(raw), sha256='0' * 64)), 'JSON_SOURCE_PIN_MISMATCH')
        report['groups'].append(dict(id='json-metadata-hash-ledger-boundaries', status='PASS', atBudgetBytes=peak))

        malformed = [('duplicate', b'{"x":1,"x":2}', 'JSON_DUPLICATE_KEY'),
                     ('integer', b'12345678901234567', 'JSON_INTEGER_LEXEME_LIMIT'),
                     ('nonfinite', b'1e999', 'JSON_NONFINITE'),
                     ('nan', b'NaN', 'JSON_NONFINITE'),
                     ('deep', b'[' * 65 + b'0' + b']' * 65, 'JSON_LEXICAL_DEPTH_LIMIT'),
                     ('incomplete', b'{"x":', 'JSON_LEXICAL_INCOMPLETE')]
        for name, data, reason in malformed:
            p = out / (name + '.json'); p.write_bytes(data)
            failure(lambda p=p: read_json(p, JsonBudget()), reason)
        report['groups'].append(dict(id='json-invalid-before-or-during-decode', status='PASS', fixtures=6))

        for delta in (-1, 0, 1):
            p = out / ('file-cap-' + str(delta) + '.json')
            with p.open('xb') as stream:
                stream.write(b'[0]'); remaining = FILE_LIMIT + delta - 3
                while remaining:
                    block = b' ' * min(65536, remaining); stream.write(block); remaining -= len(block)
            if delta <= 0:
                b = JsonBudget(); d = read_json(p, b, file_pin(p)); require(d.value == [0], 'CAP_METADATA'); d.release()
            else:
                failure(lambda p=p: read_json(p, JsonBudget()), 'JSON_FILE_LIMIT_BEFORE_READ')
        report['groups'].append(dict(id='json-file-cap-below-at-above', status='PASS', fixedFileLimitBytes=FILE_LIMIT))

        b = JsonBudget(max_documents=1); d = read_json(path, b, expected_pin)
        failure(lambda: read_json(path, b), 'DOCUMENT_SLOT_LIMIT')
        with b.kernel_helper_phase(1024) as phase:
            require(phase['walkerConcurrent'] is False, 'DISJOINT_PHASE_SCRATCH')
            failure(lambda: read_json(path, b), 'JSON_PHASE_OVERLAP')
            failure(lambda: owned_size(d.value, data_reservation=b.retainedBytes, budget=b), 'WALK_PHASE_OVERLAP')
        with b.walk_phase():
            failure(lambda: b.kernel_helper_phase(1).__enter__(), 'HELPER_PHASE_OR_BOUND')
        measured = owned_size(d.value, data_reservation=b.retainedBytes, budget=b)
        require(measured['combinedIncludingBudgetControllerBytes'] <= AUDIT_LIMIT, 'CONTROLLER_AND_WALK_TOTAL')
        d.release()
        report['groups'].append(dict(id='retained-documents-and-exclusive-scratch-phases', status='PASS'))
        require(len(report['groups']) == 7, 'FROZEN_SEVEN_GROUPS')
        for group in ('files','externalTools'):
            for name, expected_pin_value in pins[group].items():
                require(file_pin(repo / name if group == 'files' else Path(name)) == expected_pin_value, 'FINAL_FROZEN_SOURCE_TOOL_DRIFT:' + name)
        report['finalAuthentication'] = 'ALL_FROZEN_FILES_AND_TOOLS_EQUAL'
        report['status'] = 'PASS_OWNED_DATA_SEVEN_PURE_DATA_GROUPS'
    except Exception as error:
        report['status'] = 'NO_GO_OWNED_DATA_FIRST_FAILURE'
        report['firstFailure'] = dict(type=type(error).__name__, message=str(error))
    finally:
        signal.alarm(0)
        report['elapsedWallNs'] = round((time.monotonic() - started) * 1e9)
        encoded = (json.dumps(report, indent=2) + '\n').encode()
        require(len(encoded) <= FILE_LIMIT, 'REPORT_FILE_LIMIT')
        (out / 'summary.json').write_bytes(encoded)
    print(json.dumps(dict(status=report['status'], firstFailure=report['firstFailure'], groupsCompleted=len(report['groups']))))
    return int(report['firstFailure'] is not None)


if __name__ == '__main__':
    raise SystemExit(main())
