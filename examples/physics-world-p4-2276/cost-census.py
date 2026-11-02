#!/usr/bin/env python3
"""Bounded offline cost census. Never import a producer or construct a World."""
import argparse
import copy
import gzip
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import selectors
import signal
import struct
import subprocess
import sys
import time

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OLD = "examples/physics-contact-boundary-2276"
BANK = OLD + "/evidence/world-source-03"
MANIFEST = OLD + "/manifest.json"
MANIFEST_SHA = "824cde0637a1cf033f77f673b1b4e12caf478c6b0aea6dbe9fc185b8a3f653c3"
REFERENCE_PATHS = (
    "examples/physics-stack-solver-2276/trajectory-reference.py",
    "examples/physics-motion-nogo-2276/stack-study.py",
    "examples/physics-rigid-contact-reference/geometry-reference.py",
    "examples/physics-rigid-full-pair-position-world/reference.py",
    "examples/physics-rigid-full-pair-position-world/full-pair-reference.py",
    "examples/physics-rigid-full-pair-position-world/nine-row-reference.py",
    "examples/physics-rigid-signed-closure-world/reference.py",
    "examples/physics-rigid-signed-separation-reference/reference.py",
    "examples/physics-rigid-signed-separation-reference/signed-linear-reference.py",
    "examples/physics-rigid-coupled-position-diagnostic/coverage-reference.py",
    "examples/physics-rigid-feature-penetration-diagnostic/geometry-reference.py",
    "examples/physics-rigid-coupled-position-reference/linear-reference.py",
)
FIXTURE_SOURCE = "examples/physics-rigid-contact-reference/fixtures.mjs"
BODY_FIELDS = (("positionM", 3), ("velocityMps", 3), ("orientation", 4), ("angularVelocityRadps", 3))
IDS = ["b" + str(index) for index in range(8)] + ["floor"]
FRAME_BYTES = 936
MIB = 1024 * 1024
MAX_LINE = 4 * MIB
MAX_IPC = 2 * MIB
MAX_MAIN = 128 * MIB
INTERNAL_SECONDS = 170


class CensusFailure(Exception):
    pass


def need(condition, message):
    if not condition:
        raise CensusFailure(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def strict_json(data):
    def pairs(items):
        result = {}
        for key, value in items:
            need(key not in result, "duplicate JSON key")
            result[key] = value
        return result
    def invalid(_value):
        raise CensusFailure("nonfinite JSON token")
    return json.loads(data, object_pairs_hook=pairs, parse_constant=invalid)


def encoded(value):
    return (json.dumps(value, allow_nan=False, separators=(",", ":")) + "\n").encode()


def safe_path(relative):
    need(type(relative) is str and not Path(relative).is_absolute() and ".." not in Path(relative).parts, "unsafe authority path")
    result = (ROOT / relative).resolve()
    need(result.is_relative_to(ROOT) and result.is_file(), "authority path escapes root or is absent")
    return result


def read_bound(path, maximum):
    with path.open("rb") as stream:
        data = stream.read(maximum + 1)
    need(len(data) <= maximum, "file bound exceeded: " + str(path))
    return data


def authenticate_file(relative, entry, maximum):
    data = read_bound(safe_path(relative), maximum)
    need(len(data) == entry["bytes"] and sha(data) == entry["sha256"], "authority byte/hash mismatch: " + relative)
    return data


def f64(value):
    need(type(value) in (int, float) and math.isfinite(value), "invalid numeric operand")
    return struct.pack("<d", float(value))


def difference(expected, actual, path=""):
    if type(expected) in (int, float) or type(actual) in (int, float):
        if type(expected) in (int, float) and type(actual) in (int, float) and f64(expected) == f64(actual):
            return None
        return {"path": path, "expected": expected, "actual": actual,
                "expectedF64le": f64(expected).hex() if type(expected) in (int, float) else None,
                "actualF64le": f64(actual).hex() if type(actual) in (int, float) else None}
    if type(expected) is not type(actual):
        return {"path": path, "expectedType": type(expected).__name__, "actualType": type(actual).__name__}
    if type(expected) is dict:
        if expected.keys() != actual.keys():
            return {"path": path, "expectedKeys": sorted(expected), "actualKeys": sorted(actual)}
        for key in expected:
            found = difference(expected[key], actual[key], path + "/" + key.replace("~", "~0").replace("/", "~1"))
            if found:
                return found
        return None
    if type(expected) is list:
        if len(expected) != len(actual):
            return {"path": path, "expectedLength": len(expected), "actualLength": len(actual)}
        for index, (left, right) in enumerate(zip(expected, actual)):
            found = difference(left, right, path + "/" + str(index))
            if found:
                return found
        return None
    return None if expected == actual else {"path": path, "expected": expected, "actual": actual}


def numeric_raw_match(bodies, raw):
    need(type(bodies) is list and [body["id"] for body in bodies] == IDS and len(raw) == FRAME_BYTES, "nine-body raw layout mismatch")
    offset = 0
    zero_signs = []
    for body_index, body in enumerate(bodies):
        for field, count in BODY_FIELDS:
            values = body[field]
            need(type(values) is list and len(values) == count, "body vector layout mismatch")
            for component, value in enumerate(values):
                actual = struct.unpack_from("<d", raw, offset)[0]
                need(math.isfinite(actual) and type(value) in (int, float) and actual == value, "saved JSON/raw body values differ")
                if actual == 0:
                    zero_signs.append({"bodyIndex": body_index, "field": field, "component": component, "f64le": raw[offset:offset + 8].hex()})
                offset += 8
    return zero_signs


def point_raw_match(points, raw_hex):
    need(type(points) is list and len(points) == 32 and type(raw_hex) is str and re.fullmatch("[0-9a-f]{3072}", raw_hex), "32-point operand layout mismatch")
    raw = bytes.fromhex(raw_hex)
    for index, point in enumerate(points):
        values = point["pointM"] + point["normal"]
        need(len(values) == 6, "point/normal vector layout mismatch")
        actual = struct.unpack_from("<6d", raw, index * 48)
        need(all(math.isfinite(x) and type(y) in (int, float) and x == y for x, y in zip(actual, values)), "saved JSON/raw point values differ")
    return {"bytes": len(raw), "sha256": sha(raw), "f64leHex": raw_hex}


def authenticate_inputs():
    manifest_bytes = read_bound(safe_path(MANIFEST), MIB)
    need(len(manifest_bytes) == 73147 and sha(manifest_bytes) == MANIFEST_SHA, "original manifest byte/hash mismatch")
    manifest = strict_json(manifest_bytes)
    entries = {entry["path"]: entry for entry in manifest["files"]}
    need(len(entries) == len(manifest["files"]), "duplicate manifest path")
    source_relative = BANK + "/source.json"
    source = strict_json(authenticate_file(source_relative, entries[source_relative], MIB))
    source_pins = {entry["path"]: entry["sha256"] for entry in source["files"]}
    pins = {}
    for relative in (*REFERENCE_PATHS, FIXTURE_SOURCE):
        need(relative in source_pins, "missing original provider pin: " + relative)
        data = read_bound(safe_path(relative), 2 * MIB)
        need(sha(data) == source_pins[relative], "original reference source changed: " + relative)
        pins[relative] = source_pins[relative]
    # Authenticate all compressed streams and outcome records before decoding.
    reports, compressed = {}, {}
    for scene in ("ALIGNED", "OFFSET", "YAW"):
        report_path = BANK + "/" + scene + "-result.json"
        report = strict_json(authenticate_file(report_path, entries[report_path], MIB))
        need(report["selectedSteps"] == 16 and report["independentlyAcceptedSteps"] == 16 and
             report["selectedPrefixPassed"] is True and report["privateTrajectoryGO"] is False and
             report["failure"] is None and report["executionFailure"] is None, "original 16-step outcome mismatch")
        reports[scene] = report
        for suffix in (".jsonl.gz", ".f64le.gz"):
            relative = BANK + "/" + scene + suffix
            compressed[relative] = authenticate_file(relative, entries[relative], 2 * MIB)
    selected, authentication = [], []
    for scene in ("ALIGNED", "OFFSET", "YAW"):
        report = reports[scene]
        raw = gzip.decompress(compressed[BANK + "/" + scene + ".f64le.gz"])
        need(len(raw) == report["evidence"]["rawBytes"] == 120744 and sha(raw) == report["evidence"]["rawSha256"], "decoded raw hash mismatch")
        import io
        stream = gzip.GzipFile(fileobj=io.BytesIO(compressed[BANK + "/" + scene + ".jsonl.gz"]))
        digest = hashlib.sha256(); count = offset = raw_offset = 0; initial = None
        with stream:
            while True:
                line = stream.readline(MAX_LINE + 1)
                if not line:
                    break
                need(len(line) <= MAX_LINE and line.endswith(b"\n"), "decoded line bound/EOF mismatch")
                digest.update(line); count += len(line)
                need(count <= 32 * MIB, "decoded stream bound exceeded")
                row = strict_json(line)
                locator = {"decodedByteOffset": offset, "bytes": len(line), "sha256": sha(line)}
                offset += len(line)
                if row.get("kind") == "initial":
                    need(initial is None and raw_offset == 0, "initial record order mismatch")
                    initial = row["state"]
                    numeric_raw_match(initial["bodies"], raw[:FRAME_BYTES]); raw_offset += FRAME_BYTES
                    continue
                step = row.get("step")
                need(initial is not None and row.get("scene") == scene and row.get("kind") == "step" and
                     step == (raw_offset - FRAME_BYTES) // (8 * FRAME_BYTES) + 1 and 1 <= step <= 16 and
                     row["failure"] is None and row["executionFailure"] is None, "original record cursor/outcome mismatch")
                arrays = [("before", row["before"]["state"]["bodies"])]
                for stage in row["stages"]:
                    for field in ("freeBodies", "velocityBodies", "finalBodies"):
                        if stage["ledger"].get(field) is not None:
                            arrays.append((stage["stage"] + "/" + field, stage["ledger"][field]))
                arrays.append(("after", row["after"]["state"]["bodies"]))
                need(len(arrays) == 8, "original eight raw frames per step changed")
                frames = {}
                for name, bodies in arrays:
                    span = raw[raw_offset:raw_offset + FRAME_BYTES]
                    signs = numeric_raw_match(bodies, span)
                    frames[name] = {"offset": raw_offset, "bytes": FRAME_BYTES, "sha256": sha(span), "hex": span.hex(), "zeroSigns": signs}
                    raw_offset += FRAME_BYTES
                stage_by_name = {stage["stage"]: stage["ledger"] for stage in row["stages"]}
                points = stage_by_name["velocity-ready"]["points"]
                point_raw_match(points, row["pointOperandF64leHex"])
                position = row["positionAttempt"]
                numeric_raw_match(position["preBodies"], bytes.fromhex(frames["velocity-ready/velocityBodies"]["hex"]))
                numeric_raw_match(position["hypotheticalBodies"], bytes.fromhex(frames["after"]["hex"]))
                for field, name in (("beforeBodies", "before"), ("freeBodies", "free-ready/freeBodies"),
                                    ("velocityBodies", "velocity-ready/velocityBodies"), ("finalBodies", "after")):
                    numeric_raw_match(stage_by_name["closure-ready"][field], bytes.fromhex(frames[name]["hex"]))
                if step in (1, 16):
                    need(row["event"]["assembledPointCount"] == 32, "selected frame dropped a point")
                    selected.append({"scene": scene, "step": step, "row": row, "initial": copy.deepcopy(initial),
                                     "frames": frames, "recordLocator": locator})
        need(raw_offset == len(raw) and digest.hexdigest() == report["evidence"]["decodedRecordSha256"], "decoded JSON/raw hash or coverage mismatch")
        authentication.append({"scene": scene, "decodedBytes": count, "decodedSha256": digest.hexdigest(),
                               "rawBytes": len(raw), "rawSha256": sha(raw), "completeEOF": True})
    need(len(selected) == 6, "selected six-frame population mismatch")
    return {"manifestSha256": MANIFEST_SHA, "sourceReceiptSha256": entries[source_relative]["sha256"],
            "sourceNode": source["node"], "providerPins": pins, "streams": authentication}, selected


def reference_child(kind, timing_path, spec_path):
    spec = strict_json(read_bound(Path(spec_path), MIB))
    need(sha(read_bound(Path(__file__), MIB)) == spec["harnessSha256"], "census child source changed")
    for relative, wanted in spec["providerPins"].items():
        need(sha(read_bound(safe_path(relative), 2 * MIB)) == wanted, "reference child provider changed")
    entry = REFERENCE_PATHS[0] if kind == "geometry" else REFERENCE_PATHS[3]
    loaded = importlib.util.spec_from_file_location("immutable_census_" + kind, safe_path(entry))
    module = importlib.util.module_from_spec(loaded)
    started = time.monotonic_ns(); loaded.loader.exec_module(module)
    with Path(timing_path).open("xb") as timing:
        def emit(value):
            timing.write(encoded(value)); timing.flush()
        if kind == "geometry":
            original_load = module.load_pinned
            imported = 0
            def measured_load(*args):
                nonlocal imported
                result = original_load(*args)
                imported += 1
                if imported == 2:
                    emit({"type": "ready", "kind": kind, "importWallNs": time.monotonic_ns() - started,
                          "originalHelperImports": imported})
                return result
            module.load_pinned = measured_load
        else:
            emit({"type": "ready", "kind": kind, "importWallNs": time.monotonic_ns() - started})
        name = "dispatch" if kind == "geometry" else "evaluate"
        original = getattr(module, name)
        ordinal = 0
        def measured(request, *args):
            nonlocal ordinal
            ordinal += 1
            emit({"type": "start", "ordinal": ordinal, "op": request.get("op") if type(request) is dict else None})
            wall = time.monotonic_ns(); cpu = time.process_time_ns(); outcome = "returned"
            try:
                return original(request, *args)
            except BaseException:
                outcome = "raised"; raise
            finally:
                emit({"type": "call", "ordinal": ordinal, "op": request.get("op") if type(request) is dict else None,
                      "computeWallNs": time.monotonic_ns() - wall, "computeCpuNs": time.process_time_ns() - cpu, "outcome": outcome})
        setattr(module, name, measured)
        return module.main()


class Child:
    def __init__(self, kind, out, spec, put):
        self.kind, self.out, self.put, self.ordinal = kind, out, put, 0
        self.timing_path = out / (kind + ".timing.jsonl")
        self.stderr = bytearray()
        self.process = subprocess.Popen([sys.executable, "-B", str(Path(__file__).resolve()), "--reference-child", kind,
                                         str(self.timing_path), str(spec)], stdin=subprocess.PIPE,
                                        stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        for pipe in (self.process.stdout, self.process.stderr):
            os.set_blocking(pipe.fileno(), False)
        self.selector = selectors.DefaultSelector()
        self.selector.register(self.process.stdout, selectors.EVENT_READ, "stdout")
        self.selector.register(self.process.stderr, selectors.EVENT_READ, "stderr")
        self.trailing = bytearray()
        self.stdout_eof = self.stderr_eof = False
        self.last_transport = None

    def wait_ready(self):
        while not self.timing_path.exists() or not self.timing_path.read_bytes().endswith(b"\n"):
            need(self.process.poll() is None, "reference startup failed: " + self.kind)
            self.drain_stderr(); time.sleep(.001)
        self.ready = strict_json(self.timing_path.read_bytes().splitlines()[0])

    def drain_stderr(self):
        try:
            chunk = os.read(self.process.stderr.fileno(), 65536)
        except BlockingIOError:
            return
        if not chunk:
            self.stderr_eof = True
        self.stderr.extend(chunk)
        need(len(self.stderr) <= 128 * 1024, "reference stderr bound exceeded")

    def ask(self, request, name):
        self.ordinal += 1
        serialization = time.monotonic_ns(); wire = encoded(request)
        serialization = time.monotonic_ns() - serialization
        need(len(wire) <= MAX_IPC, "reference request exceeds2MiB")
        request_name = name + ".stdin.jsonl"
        self.put(request_name, wire)
        started = time.monotonic_ns(); write_start = time.monotonic_ns()
        self.last_transport = {"serializedRequestPath": request_name, "serializedBytes": len(wire),
                               "writeAttempted": True, "writeFlushCompleted": False,
                               "bytesAcceptedByBufferedWriter": None, "exactOsDeliveredBytes": "UNOBSERVED"}
        accepted = self.process.stdin.write(wire); self.process.stdin.flush()
        self.last_transport.update(writeFlushCompleted=True, bytesAcceptedByBufferedWriter=accepted)
        write_ns = time.monotonic_ns() - write_start
        pending = bytearray()
        try:
            while b"\n" not in pending:
                for key, _event in self.selector.select(1):
                    if key.data == "stderr":
                        self.drain_stderr(); continue
                    chunk = os.read(key.fileobj.fileno(), 65536)
                    need(chunk, "reference stdout ended before a complete reply")
                    pending.extend(chunk)
                    need(len(pending) <= MAX_IPC, "reference reply exceeds2MiB")
                need(self.process.poll() is None or b"\n" in pending, "reference child exited during a request")
            need(pending.count(b"\n") == 1 and pending.endswith(b"\n"), "unsolicited/trailing reference stdout")
        finally:
            self.put(name + ".stdout.raw", bytes(pending))
        ipc_ns = time.monotonic_ns() - started
        decode_start = time.monotonic_ns(); reply = strict_json(pending); decode_ns = time.monotonic_ns() - decode_start
        timings = [strict_json(line) for line in self.timing_path.read_bytes().splitlines()]
        measured = timings[-1]
        need(measured.get("type") == "call" and measured["ordinal"] == self.ordinal and measured["op"] == request["op"], "reference timing/call correspondence mismatch")
        return reply, {"parentSerializeNs": serialization, "parentWriteFlushNs": write_ns,
                       "parentIpcWallNs": ipc_ns, "parentDecodeNs": decode_ns, **measured,
                       "ipcLessComputeWallNs": ipc_ns - measured["computeWallNs"]}, {
                           "request": {"path": request_name, "bytes": len(wire), "sha256": sha(wire)},
                           "reply": {"path": name + ".stdout.raw", "bytes": len(pending), "sha256": sha(pending)}}

    def drain_close(self):
        self.drain_stderr()
        try:
            chunk = os.read(self.process.stdout.fileno(), 65536)
            if not chunk:
                self.stdout_eof = True
            self.trailing.extend(chunk)
            need(len(self.trailing) <= MAX_IPC, "reference trailing stdout bound exceeded")
        except BlockingIOError:
            pass


def requests_for(frame, config):
    row, frames = frame["row"], frame["frames"]
    stages = {stage["stage"]: stage["ledger"] for stage in row["stages"]}
    position = row["positionAttempt"]
    # Raw operands are authenticated separately. Preserve the original JSON wire
    # values; JSON.stringify did not carry negative-zero signs in these arrays.
    return [
        ("contacts", "geometry", {"op": "contacts", "freeBodies": stages["free-ready"]["freeBodies"],
                                   "pointLedger": stages["velocity-ready"]["points"]}, row["contactGeometry"]),
        ("position-world", "position", {"op": "world", "scene": frame["scene"], "stepIndex": frame["step"], "config": config,
             "preBodies": position["preBodies"], "preRawHex": frames["velocity-ready/velocityBodies"]["hex"],
             "problem": position["problem"], "rowSelections": position["rowSources"], "result": position["result"],
             "hypBodies": position["hypotheticalBodies"], "hypRawHex": frames["after"]["hex"]}, row["positionCheck"]),
        ("step-ledger", "position", {"op": "step-ledger", "scene": frame["scene"], "stepIndex": frame["step"], "outcome": "accepted",
             "ledger": stages["closure-ready"], "raw": {"before": frames["before"]["hex"],
             "free": frames["free-ready/freeBodies"]["hex"], "velocity": frames["velocity-ready/velocityBodies"]["hex"],
             "final": frames["after"]["hex"]}}, row["ledgerCheck"]),
        ("quality", "geometry", {"op": "quality", "request": {"state": row["after"]["state"], "initial": frame["initial"],
             "timeSeconds": row["after"]["state"]["timeSeconds"], "referenceAt8s": None}}, row["quality"]),
    ]


def counter_trees(value, path=""):
    found = []
    if type(value) is dict:
        for key, item in value.items():
            if key in ("counters", "counts") and type(item) is dict:
                found.append({"path": path + "/" + key, "value": item})
            found.extend(counter_trees(item, path + "/" + key))
    elif type(value) is list:
        for index, item in enumerate(value):
            found.extend(counter_trees(item, path + "/" + str(index)))
    return found


def run(run_id, node):
    need(re.fullmatch("[a-z0-9][a-z0-9-]{0,95}", run_id), "invalid fresh run ID")
    out = HERE / "evidence" / run_id
    out.mkdir(parents=True, exist_ok=False)
    started = time.monotonic_ns(); used = 0; children = {}; current = None
    summary = {"workId": "physics-world-p4-cost-census-2276", "runId": run_id, "status": "IN_PROGRESS",
               "worldCalls": 0, "productionCalls": 0, "productionSolverCalls": 0,
               "counts": {"framesCompleted": 0, "referenceIpcAttempted": 0, "referenceRepliesCompleted": 0,
                          "fullReplyEqual": 0}, "requests": [], "firstFailure": None, "cleanup": []}
    def put(name, data):
        nonlocal used
        need(used + len(data) <= MAX_MAIN, "128MiB census storage exhausted")
        with (out / name).open("xb") as stream:
            stream.write(data)
        used += len(data)
    def progress():
        (out / "progress.json").write_bytes(encoded(summary))
    def timeout(_signal, _frame):
        raise CensusFailure("170s internal census deadline")
    previous = signal.signal(signal.SIGALRM, timeout)
    signal.setitimer(signal.ITIMER_REAL, INTERNAL_SECONDS)
    try:
        authentication, frames = authenticate_inputs()
        summary["authentication"] = authentication
        own_sha = sha(read_bound(Path(__file__), MIB))
        helper = HERE / "fixture-data.mjs"
        node = Path(node).resolve()
        node_bytes = read_bound(node, 256 * MIB)
        summary["harnessSha256"] = own_sha
        summary["fixtureHelperSha256"] = sha(read_bound(helper, 65536))
        summary["node"] = {"path": str(node), "bytes": len(node_bytes), "sha256": sha(node_bytes)}
        progress()
        fixture_run = subprocess.run([str(node), str(helper)], capture_output=True, timeout=10, check=False)
        put("fixture-data.stdout", fixture_run.stdout); put("fixture-data.stderr", fixture_run.stderr)
        need(fixture_run.returncode == 0 and not fixture_run.stderr, "original DATA fixture helper failed")
        fixtures = strict_json(fixture_run.stdout)
        need(fixtures["node"] == authentication["sourceNode"] and fixtures["fixtureFunctionCalls"] == 3 and
             fixtures["sinCalls"] == fixtures["cosCalls"] == 8, "original fixture runtime/call population differs")
        summary["fixtureSetup"] = {key: value for key, value in fixtures.items() if key != "fixtures"}
        spec = {"harnessSha256": own_sha, "providerPins": authentication["providerPins"]}
        put("reference-spec.json", encoded(spec))
        # All authority hashes and complete archives passed before either import.
        for kind in ("geometry", "position"):
            children[kind] = Child(kind, out, out / "reference-spec.json", put)
            children[kind].wait_ready()
        summary["referenceStartup"] = {key: value.ready for key, value in children.items()}
        for frame in frames:
            current = {"scene": frame["scene"], "step": frame["step"], "recordLocator": frame["recordLocator"]}
            receipt = {**current, "rawFrames": frame["frames"],
                       "pointOperands": point_raw_match(next(stage["ledger"]["points"] for stage in frame["row"]["stages"]
                                                             if stage["stage"] == "velocity-ready"), frame["row"]["pointOperandF64leHex"])}
            put(frame["scene"] + "-" + str(frame["step"]) + ".authentication.json", encoded(receipt))
            for label, kind, request, expected in requests_for(frame, fixtures["fixtures"][frame["scene"]]):
                need(summary["counts"]["referenceIpcAttempted"] < 24, "reference IPC population exhausted")
                current["operation"] = label
                summary["counts"]["referenceIpcAttempted"] += 1; progress()
                name = frame["scene"] + "-" + str(frame["step"]) + "-" + label
                reply, timing, locators = children[kind].ask(request, name)
                summary["counts"]["referenceRepliesCompleted"] += 1
                mismatch = difference(expected, reply)
                record = {**current, "timing": timing, "locators": locators, "originalFullReplySha256": sha(encoded(expected)),
                          "originalClassification": {key: expected.get(key) for key in ("ok", "resolved", "executionFailure", "referenceStatus", "precisionResolved")},
                          "actualClassification": {key: reply.get(key) for key in ("ok", "resolved", "executionFailure", "referenceStatus", "precisionResolved")},
                          "exactFullReplyEqual": mismatch is None, "firstDifference": mismatch,
                          "independentReferenceCounterTrees": counter_trees(reply)}
                summary["requests"].append(record)
                put(name + ".comparison.json", encoded(record)); progress()
                if mismatch:
                    zero_bits = {mismatch.get("expectedF64le"), mismatch.get("actualF64le")}
                    zero_sign = zero_bits == {"0000000000000000", "0000000000000080"}
                    summary["firstFailure"] = {"classification": "ARCHIVED_REPLY_ZERO_SIGN_UNOBSERVED" if zero_sign else "EXACT_ARCHIVED_REPLY_MISMATCH",
                        "firstDifference": mismatch, "reached": dict(current), "physicalTrajectoryVerdictChanged": False,
                        "note": "The archived JSON writer did not preserve the original Python reply zero sign." if zero_sign else None}
                    raise CensusFailure("first full original reply mismatch")
                summary["counts"]["fullReplyEqual"] += 1
            summary["counts"]["framesCompleted"] += 1; progress()
        need(summary["counts"] == {"framesCompleted": 6, "referenceIpcAttempted": 24,
             "referenceRepliesCompleted": 24, "fullReplyEqual": 24}, "incomplete census prefix")
        for relative, wanted in authentication["providerPins"].items():
            need(sha(read_bound(safe_path(relative), 2 * MIB)) == wanted, "provider changed during census")
        need(sha(read_bound(Path(__file__), MIB)) == own_sha and
             sha(read_bound(helper, 65536)) == summary["fixtureHelperSha256"], "census harness changed during execution")
        summary["postRunSourceAuthentication"] = "PASS"
        summary["status"] = "PASS"
    except BaseException as error:
        summary["status"] = "FAIL"
        if summary["firstFailure"] is None:
            summary["firstFailure"] = {"classification": "CENSUS_EXECUTION_OR_EXACT_REPLY_FAILURE", "type": type(error).__name__,
                                       "message": str(error), "reached": copy.deepcopy(current), "counts": dict(summary["counts"])}
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        cleanup_errors = []
        def drain(child):
            try:
                child.drain_close()
            except BaseException as error:
                cleanup_errors.append({"kind": child.kind, "type": type(error).__name__, "message": str(error)})
        def send(child, name):
            try:
                getattr(child.process, name)()
            except ProcessLookupError:
                pass
        cleanup_start = time.monotonic()
        terminated, killed = set(), set()
        # On failure, stop calculations before touching a buffered input stream.
        if summary["status"] != "PASS":
            for child in children.values():
                if child.process.poll() is None:
                    send(child, "terminate"); terminated.add(child.kind)
        for child in children.values():
            try:
                pipe = child.process.stdin
                # Never flush a possibly interrupted BufferedWriter during cleanup.
                os.close(pipe.fileno())
                try:
                    pipe.close()
                except OSError:
                    pass
                child.process.stdin = None
            except BaseException as error:
                cleanup_errors.append({"kind": child.kind, "type": type(error).__name__, "message": str(error)})
        while time.monotonic() - cleanup_start < 4:
            for child in children.values():
                drain(child)
                if child.process.poll() is None:
                    elapsed = time.monotonic() - cleanup_start
                    if elapsed >= 1 and child.kind not in terminated:
                        summary["status"] = "FAIL"; send(child, "terminate"); terminated.add(child.kind)
                    if elapsed >= 2 and child.kind not in killed:
                        send(child, "kill"); killed.add(child.kind)
            if all(child.process.poll() is not None and child.stdout_eof and child.stderr_eof for child in children.values()):
                break
            time.sleep(.005)
        for kind, child in children.items():
            try:
                put(kind + ".stderr.raw", bytes(child.stderr))
                put(kind + ".trailing.stdout.raw", bytes(child.trailing))
                complete = child.process.poll() is not None and child.stdout_eof and child.stderr_eof
                need(complete, "reference pipes have incomplete EOF")
                need(not child.trailing and not child.stderr, "reference trailing stdout/stderr is nonempty")
                if summary["status"] == "PASS":
                    need(child.process.returncode == 0, "reference clean exit is not zero")
                summary["cleanup"].append({"kind": kind, "returncode": child.process.returncode, "completeEOF": True,
                                           "timing": child.timing_path.read_text(), "lastTransport": child.last_transport,
                                           "terminateAttempted": kind in terminated, "killAttempted": kind in killed})
            except BaseException as error:
                summary["cleanup"].append({"kind": kind, "completeEOF": False, "type": type(error).__name__, "message": str(error)})
                summary["status"] = "FAIL"
        if cleanup_errors:
            summary["cleanupErrors"] = cleanup_errors; summary["status"] = "FAIL"
        if summary["status"] == "FAIL" and summary["firstFailure"] is None:
            summary["firstFailure"] = {"classification": "CENSUS_CLEANUP_FAILURE", "reached": current}
        summary["referenceCallCounts"] = {}
        for kind, child in children.items():
            if child.timing_path.exists():
                lines = child.timing_path.read_bytes().splitlines(keepends=True)
                values = [strict_json(line) for line in lines if line.endswith(b"\n")]
                summary["referenceCallCounts"][kind] = {
                    "attempted": sum(value.get("type") == "start" for value in values),
                    "completed": sum(value.get("type") == "call" for value in values),
                    "returned": sum(value.get("type") == "call" and value.get("outcome") == "returned" for value in values),
                    "trailingTimingFragmentBytes": len(lines[-1]) if lines and not lines[-1].endswith(b"\n") else 0}
        summary["elapsedWallNs"] = time.monotonic_ns() - started; summary["storedMainBytes"] = used
        summary["cleanupWallNs"] = int((time.monotonic() - cleanup_start) * 1000000000)
        signal.signal(signal.SIGALRM, previous)
        progress(); put("summary.json", encoded(summary))
    return 0 if summary["status"] == "PASS" else 1


if __name__ == "__main__":
    if len(sys.argv) == 5 and sys.argv[1] == "--reference-child":
        sys.exit(reference_child(sys.argv[2], sys.argv[3], sys.argv[4]))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--node", required=True, help="installed immutable original Node22.19 executable")
    args = parser.parse_args()
    sys.exit(run(args.run_id, args.node))
