"""Closed parent transport using the qualified owned-data helper; no math imports."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
MIB = 1024 * 1024
CONTROL = 2 * MIB
HELPER = ROOT / 'examples/physics-p4-owned-data-2276'


def need(ok, why):
    if not ok:
        raise ValueError(why)


def pin(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''):
            digest.update(block)
    return dict(bytes=Path(path).stat().st_size, sha256=digest.hexdigest())


def bootstrap(path, expected=None):
    """Source/receipt metadata only: capped wire and4MiB PRE-decode reservation."""
    path = Path(path); size = path.stat().st_size
    need(size <= 131072, 'METADATA_BOOTSTRAP_128K')
    raw = bytearray(size)
    with path.open('rb', buffering=0) as stream:
        offset = 0
        while offset < size:
            view = memoryview(raw)[offset:min(size, offset + 65536)]
            try:
                count = stream.readinto(view)
            finally:
                view.release(); del view
            if not count:
                break
            offset += count
        need(offset == size and path.stat().st_size == size, 'IMMUTABLE_METADATA_SIZE')
    actual = dict(bytes=size, sha256=hashlib.sha256(raw).hexdigest())
    need(expected is None or actual == expected, 'METADATA_BYTE_IDENTITY')
    punctuation = sum(raw.count(bytes((c,))) for c in (123, 91, 44, 58))
    need(512 * punctuation + 8 * size + 65536 <= 4 * MIB, 'METADATA_BOOTSTRAP_DECODE_RESERVATION')
    return json.loads(raw)


def qualified_owned():
    # Caller authenticates the whole frozen source closure before invoking this.
    qualification = bootstrap(HELPER / 'evidence/selftest-01/summary.json')
    need(qualification['status'] == 'PASS_OWNED_DATA_SEVEN_PURE_DATA_GROUPS'
         and qualification['firstFailure'] is None
         and qualification['finalAuthentication'] == 'ALL_FROZEN_FILES_AND_TOOLS_EQUAL'
         and qualification['pinsPin'] == pin(HELPER / 'PINS.json')
         and len(qualification['groups']) == 7 and all(g['status'] == 'PASS' for g in qualification['groups']),
         'ACTUAL_QUALIFIED_OWNED_HELPER')
    spec = importlib.util.spec_from_file_location('_full_gram_qualified_owned_data', HELPER / 'owned.py')
    module = importlib.util.module_from_spec(spec); sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class Transport:
    def __init__(self, ledger_limit=22 * MIB):
        self.owned = qualified_owned()
        self.budget = self.owned.JsonBudget(limit=ledger_limit, max_documents=16)
        self.documents = []
        self.control_peak = self.packet_peak = self.aux_peak = 0

    def open(self, path, expected=None):
        need(len(self.documents) < 16, 'TRANSPORT_LIVE_DOCUMENT_LIMIT')
        document = self.owned.read_json(path, self.budget, expected or pin(path))
        self.documents.append(document)
        return document

    def close(self, document):
        document.release(); self.documents.remove(document)

    def control(self, *roots):
        with self.budget.walk_phase():
            result = self.owned.owned_size(roots, data_reservation=CONTROL,
                total_limit=10 * MIB, aux_limit=8 * MIB)
        self.control_peak = max(self.control_peak, result['ownedBytes'])
        self.aux_peak = max(self.aux_peak, result['auxReservedPeakBytes'])
        return result

    def packets(self):
        # All live packet values; a new actual roots tuple is explicitly charged.
        roots = tuple(document.value for document in self.documents)
        reservation = self.budget.retainedBytes + sys.getsizeof(roots)
        result = self.owned.owned_size(roots, data_reservation=reservation,
            total_limit=self.budget.limit, aux_limit=8 * MIB, budget=self.budget)
        self.packet_peak = max(self.packet_peak, result['ownedBytes'])
        self.aux_peak = max(self.aux_peak, result['auxReservedPeakBytes'])
        return result

    def wrapper_graph(self, roots, allowed_records):
        # Outer orchestrator2MiB + this wrapper(data14+scratch8)22 = parent24.
        with self.budget.walk_phase():
            result = self.owned.owned_size(roots, data_reservation=14 * MIB,
                total_limit=22 * MIB, aux_limit=8 * MIB, allowed_record_types=allowed_records)
        self.packet_peak = max(self.packet_peak, result['ownedBytes'])
        self.aux_peak = max(self.aux_peak, result['auxReservedPeakBytes'])
        return result

    def receipt(self):
        return dict(controlOwnedPeakBytes=self.control_peak, packetOwnedPeakBytes=self.packet_peak,
            walkerAuxReservedPeakBytes=self.aux_peak, jsonPreallocationPeakBytes=self.budget.peakReservedBytes,
            jsonLedgerLimitBytes=self.budget.limit, controlReservationBytes=CONTROL,
            observations='QUALIFIED_ACTUAL_KEY_VALUE_AND_FRACTION_WALKER', rssMeasured=False)
