#!/usr/bin/env python3
"""Offline validation and velocity/energy observations for frozen OFFSET traces.

No producer is imported. No world is executed. Energy is an observation in SI
units, not a conservation, dissipation, force-accuracy, or physical-GO test.
Intermediate empty contacts do not prove missing contacts or geometry quality.
"""

import argparse
import copy
from decimal import Decimal, localcontext
import gzip
import hashlib
import importlib.util
from itertools import combinations
import json
import math
from pathlib import Path
import struct
import sys


sys.dont_write_bytecode = True
REFERENCE_PATH = Path(__file__).resolve().parent.parent / "physics-rigid-contact-reference" / "geometry-reference.py"
SPEC = importlib.util.spec_from_file_location("immutable_geometry_primitives", REFERENCE_PATH)
REFERENCE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(REFERENCE)

IDS = tuple(f"b{i}" for i in range(8)) + ("floor",)
DYNAMIC_IDS = IDS[:-1]
GRAPHS = ("source", "source-repeat", "compiled-dependencies")
STEPS = (14, 15, 16)
PAIRS = tuple(combinations(IDS, 2))
PAIR_PHASES = ("pair-before", "after-warm", "after-response", "after-position")
FIELDS = (("positionM", 3), ("velocityMps", 3), ("orientation", 4), ("angularVelocityRadps", 3))
FRAME_BYTES = 117 * 8
AGREEMENT = Decimal("1e-25")
ANGULAR_THRESHOLD = Decimal(".02")
ZERO = Decimal(0)


class InvalidDiagnostic(ValueError):
    def __init__(self, message, **location):
        super().__init__(message)
        self.location = location


def require(condition, message, **location):
    if not condition:
        raise InvalidDiagnostic(message, **location)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def read_json(path):
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", encoding="utf-8") as handle:
        return json.load(handle)


def finite_json(value, location):
    if isinstance(value, float):
        require(math.isfinite(value), "nonfinite JSON number", location=location)
    elif isinstance(value, dict):
        for name, item in value.items():
            finite_json(item, f"{location}.{name}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            finite_json(item, f"{location}[{index}]")


def read_raw(path, count, expected_hash):
    with gzip.open(path, "rb") as handle:
        raw = handle.read(count * FRAME_BYTES + 1)
    require(len(raw) == count * FRAME_BYTES, "raw byte count mismatch", file=path.name)
    require(isinstance(expected_hash, str) and sha256(raw) == expected_hash,
            "uncompressed raw SHA256 mismatch", file=path.name)
    frames = list(struct.iter_unpack("<117d", raw))
    for index, frame in enumerate(frames):
        require(all(math.isfinite(value) for value in frame), "nonfinite raw Float64", file=path.name, frame=index)
    return raw, frames


def decode_state(saved, frame, step, location):
    require(isinstance(saved, dict), "state must be an object", location=location)
    finite_json(saved, location)
    require(type(saved.get("stepIndex")) is int and saved["stepIndex"] == step,
            "state step index mismatch", location=location)
    time = saved.get("timeSeconds")
    require(type(time) in (int, float) and float(time) == step * (1 / 120),
            "state timestamp mismatch", location=location)
    bodies = saved.get("bodies")
    require(isinstance(bodies, list) and len(bodies) == 9 and all(isinstance(body, dict) for body in bodies),
            "state must contain nine bodies", location=location)
    require(tuple(body.get("id") for body in bodies) == IDS, "body ID order mismatch", location=location)
    state = copy.deepcopy(saved)
    cursor = 0
    for body in state["bodies"]:
        for field, count in FIELDS:
            values = body.get(field)
            require(isinstance(values, list) and len(values) == count, "invalid body vector", location=location, field=field)
            decoded = list(frame[cursor:cursor + count])
            require(all(type(value) in (int, float) and float(value) == raw for value, raw in zip(values, decoded)),
                    "JSON/raw component mismatch", location=location, body=body["id"], field=field)
            # JSON zero signs can be lost. Raw bytes retain every sign bit.
            body[field] = decoded
            cursor += count
    require(cursor == 117, "raw cursor mismatch", location=location)
    for precision in (80, 120):
        with localcontext() as context:
            context.prec = precision
            try:
                # Primitive pose/shape validation only; no SAT quality evaluation.
                REFERENCE.state_boxes(state)
            except REFERENCE.ReferenceInputError as error:
                raise InvalidDiagnostic(str(error), location=location) from error
    return state


def make_order():
    result = []
    for step in STEPS:
        result.append(("integrated", step, None, None))
        for pass_index in range(8):
            for pair in PAIRS:
                for phase in PAIR_PHASES:
                    result.append((phase, step, pass_index, pair))
            result.append(("pass-end", step, pass_index, None))
        result.append(("projection-before", step, None, None))
        result.append(("projection-after", step, None, None))
    return tuple(result)


ORDER = make_order()


def cache_rows(rows, pair, frame):
    require(isinstance(rows, list), "cache rows must be an array", frame=frame)
    prefix = "\0".join(pair) + "\0"
    keys = []
    for row in rows:
        require(isinstance(row, dict) and set(row) == {"key", "normalNs", "tangentNs"},
                "cache row schema mismatch", frame=frame)
        key = row["key"]
        require(isinstance(key, str) and key.startswith(prefix), "cache row belongs to another pair", frame=frame)
        keys.append(key)
        try:
            normal = REFERENCE.decimal_number(row["normalNs"])
            REFERENCE.vector(row["tangentNs"])
        except REFERENCE.ReferenceInputError as error:
            raise InvalidDiagnostic(str(error), frame=frame) from error
        require(normal >= 0, "negative cached normal impulse", frame=frame)
    require(len(set(keys)) == len(keys), "duplicate cache key", frame=frame)


def validate_metadata(metadata, expected, index):
    require(isinstance(metadata, dict) and set(metadata) == {
        "phase", "stepIndex", "pass", "pair", "hit", "manifold", "path", "previous", "current"},
        "metadata schema mismatch", frame=index)
    phase, step, pass_index, pair = expected
    require(metadata["phase"] == phase and type(metadata["stepIndex"]) is int and metadata["stepIndex"] == step
            and metadata["pass"] == pass_index and metadata["pair"] == (list(pair) if pair else None),
            "phase/step/pass/pair order mismatch", frame=index)
    if pass_index is not None:
        require(type(metadata["pass"]) is int, "pass must be an integer", frame=index)
    finite_json(metadata, f"metadata[{index}]")
    if pair is None:
        require(metadata["path"] == "checkpoint" and metadata["hit"] is None and metadata["manifold"] is None
                and metadata["previous"] == [] and metadata["current"] == [], "invalid checkpoint metadata", frame=index)
        return
    cache_rows(metadata["previous"], pair, index)
    cache_rows(metadata["current"], pair, index)
    hit, manifold = metadata["hit"], metadata["manifold"]
    if hit is None:
        require(manifold is None and metadata["path"] == "no-hit-skipped", "invalid no-hit path", frame=index)
        return
    require(isinstance(hit, dict) and set(hit) == {"normalAtoB", "pointM", "penetrationM"}, "invalid hit schema", frame=index)
    try:
        with localcontext() as context:
            context.prec = 120
            require(REFERENCE.length(REFERENCE.vector(hit["normalAtoB"])) > 0
                    and REFERENCE.decimal_number(hit["penetrationM"]) >= 0, "invalid hit normal/depth", frame=index)
            REFERENCE.vector(hit["pointM"])
    except REFERENCE.ReferenceInputError as error:
        raise InvalidDiagnostic(str(error), frame=index) from error
    if manifold is None:
        paths = dict(zip(PAIR_PHASES, ("combined-fallback", "fallback-warm-skipped", "combined-fallback", "fallback-position-already-combined")))
        require(metadata["path"] == paths[phase], "fallback path label mismatch", frame=index)
    else:
        require(isinstance(manifold, list) and metadata["path"] == "manifold", "invalid manifold path", frame=index)
        for point in manifold:
            require(isinstance(point, dict) and set(point) == {"id", "pointM"} and isinstance(point["id"], str),
                    "invalid manifold point", frame=index)
            REFERENCE.vector(point["pointM"])


def field_bytes(raw_frame, body_index, start, count):
    offset = (body_index * 13 + start) * 8
    return raw_frame[offset:offset + count * 8]


def require_position_only(before, after, frame):
    for body_index in range(9):
        require(field_bytes(before, body_index, 3, 10) == field_bytes(after, body_index, 3, 10),
                "position-only phase changed velocity/orientation/angular components", frame=frame, body=IDS[body_index])


def require_pose_only_unchanged(before, after, frame):
    for body_index in range(9):
        require(field_bytes(before, body_index, 0, 3) == field_bytes(after, body_index, 0, 3)
                and field_bytes(before, body_index, 6, 4) == field_bytes(after, body_index, 6, 4),
                "warm/response manifold phase changed position or orientation", frame=frame, body=IDS[body_index])


def validate_transition(metadata, previous_metadata, current_raw, previous_raw, pair_before_metadata, pair_before_raw, frame):
    phase, path = metadata["phase"], metadata["path"]
    if phase in ("pair-before", "pass-end", "projection-before"):
        require(current_raw == previous_raw, "pair/pass/projection continuity mismatch", frame=frame)
    if phase in PAIR_PHASES[1:]:
        for field in ("stepIndex", "pass", "pair", "hit", "manifold", "previous"):
            require(metadata[field] == pair_before_metadata[field], "pair decision/previous cache changed between phases", frame=frame, field=field)
        # A pair response can change only its two body records.
        for body_index, body_id in enumerate(IDS):
            if body_id not in metadata["pair"]:
                require(field_bytes(current_raw, body_index, 0, 13) == field_bytes(pair_before_raw, body_index, 0, 13),
                        "pair work changed a non-pair body", frame=frame, body=body_id)
    if path == "no-hit-skipped":
        require(current_raw == pair_before_raw and metadata["current"] == pair_before_metadata["current"],
                "no-hit phases changed body or cache values", frame=frame)
    elif phase == "after-warm" and path == "fallback-warm-skipped":
        require(current_raw == previous_raw and metadata["current"] == previous_metadata["current"],
                "skipped fallback warm stage changed values", frame=frame)
    elif phase in ("after-warm", "after-response") and path == "manifold":
        require_pose_only_unchanged(previous_raw, current_raw, frame)
    elif phase == "after-position":
        require_position_only(previous_raw, current_raw, frame)
        require(metadata["current"] == previous_metadata["current"], "position stage changed cached impulse", frame=frame)
        if path == "fallback-position-already-combined":
            require(current_raw == previous_raw, "already-combined fallback changed values again", frame=frame)
    elif phase == "projection-after":
        require_position_only(previous_raw, current_raw, frame)
    # after-response/combined-fallback explicitly combines response and position.
    # Its pose may change. It is not claimed to be an isolated velocity stage.


def decimal_vector(values):
    return tuple(Decimal.from_float(value) for value in values)


def measure(state, previous, precision):
    with localcontext() as context:
        context.prec = precision
        old = {body["id"]: body for body in previous["bodies"]}
        bodies = {}
        kinetic = potential = ZERO
        for body in state["bodies"]:
            body_id = body["id"]
            v, w = decimal_vector(body["velocityMps"]), decimal_vector(body["angularVelocityRadps"])
            old_v, old_w = decimal_vector(old[body_id]["velocityMps"]), decimal_vector(old[body_id]["angularVelocityRadps"])
            dv, dw = tuple(x-y for x, y in zip(v, old_v)), tuple(x-y for x, y in zip(w, old_w))
            v2, w2 = sum((x*x for x in v), ZERO), sum((x*x for x in w), ZERO)
            # Floor speeds/deltas are checked, but the static floor has no energy contribution.
            energy = v2 / 2 + w2 / 48 if body_id != "floor" else ZERO
            body_potential = Decimal("9.81") * Decimal.from_float(body["positionM"][1]) if body_id != "floor" else ZERO
            bodies[body_id] = {"velocity": v, "angularVelocity": w, "linearDelta": dv, "angularDelta": dw,
                               "linearSpeed": v2.sqrt(), "angularSpeed": w2.sqrt(),
                               "angularDeltaNorm": sum((x*x for x in dw), ZERO).sqrt(),
                               "kineticJ": energy, "potentialJ": body_potential}
            kinetic += energy
            potential += body_potential
        return {"bodies": bodies, "kineticJ": kinetic, "potentialJ": potential, "mechanicalJ": kinetic + potential}


def precision_check(low, high, frame):
    with localcontext() as context:
        context.prec = 120
        for name in ("kineticJ", "potentialJ", "mechanicalJ"):
            require(abs(low[name] - high[name]) <= AGREEMENT, "energy precision unresolved", frame=frame, field=name)
        for body_id in IDS:
            for name, value in high["bodies"][body_id].items():
                before = low["bodies"][body_id][name]
                differences = (abs(x-y) for x, y in zip(before, value)) if isinstance(value, tuple) else (abs(before-value),)
                require(all(error <= AGREEMENT for error in differences), "velocity/energy precision unresolved",
                        frame=frame, body=body_id, field=name)
            require((low["bodies"][body_id]["angularSpeed"] > ANGULAR_THRESHOLD)
                    == (high["bodies"][body_id]["angularSpeed"] > ANGULAR_THRESHOLD),
                    "angular threshold classification unresolved", frame=frame, body=body_id)


def public_vector(values):
    return [float(value) for value in values]


def frame_record(index, metadata, current, previous):
    largest = max(DYNAMIC_IDS, key=lambda body_id: current["bodies"][body_id]["angularSpeed"])
    changed = []
    for body_id, body in current["bodies"].items():
        if any(body["linearDelta"]) or any(body["angularDelta"]):
            changed.append({"body": body_id, "linearDeltaMps": public_vector(body["linearDelta"]),
                            "angularDeltaRadps": public_vector(body["angularDelta"]),
                            "linearSpeedMps": float(body["linearSpeed"]), "angularSpeedRadps": float(body["angularSpeed"]),
                            "kineticJ": float(body["kineticJ"])})
    b3, old_b3 = current["bodies"]["b3"], previous["bodies"]["b3"]
    with localcontext() as context:
        context.prec = 120
        b3_change = {"frame": index, "stepIndex": metadata["stepIndex"], "pass": metadata["pass"],
                     "pair": metadata["pair"], "phase": metadata["phase"], "path": metadata["path"],
                     "hit": metadata["hit"], "manifold": metadata["manifold"],
                     "previousCacheRows": metadata["previous"], "currentCacheRows": metadata["current"],
                     "beforeAngularRadps": public_vector(old_b3["angularVelocity"]),
                     "afterAngularRadps": public_vector(b3["angularVelocity"]),
                     "angularDeltaRadps": public_vector(b3["angularDelta"]),
                     "angularDeltaDecimalRadps": [str(value) for value in b3["angularDelta"]],
                     "angularDeltaNormRadps": float(b3["angularDeltaNorm"]),
                     "angularDeltaNormDecimalRadps": str(b3["angularDeltaNorm"]),
                     "beforeSpeedRadps": float(old_b3["angularSpeed"]), "afterSpeedRadps": float(b3["angularSpeed"]),
                     "speedChangeRadps": float(b3["angularSpeed"] - old_b3["angularSpeed"]),
                     "speedChange": "increase" if b3["angularSpeed"] > old_b3["angularSpeed"] else
                                    "decrease" if b3["angularSpeed"] < old_b3["angularSpeed"] else "unchanged"}
    record = {"frame": index, "stepIndex": metadata["stepIndex"], "pass": metadata["pass"],
              "pair": metadata["pair"], "phase": metadata["phase"], "path": metadata["path"],
              "kineticJ": float(current["kineticJ"]), "potentialJ": float(current["potentialJ"]),
              "mechanicalJ": float(current["mechanicalJ"]),
              "kineticDecimalJ": str(current["kineticJ"]), "potentialDecimalJ": str(current["potentialJ"]),
              "largestAngularBody": largest, "maxAngularSpeedRadps": float(current["bodies"][largest]["angularSpeed"]),
              "bodyVelocityChanges": changed, "b3AngularRadps": public_vector(b3["angularVelocity"]),
              "b3AngularSpeedRadps": float(b3["angularSpeed"])}
    return record, b3_change


def analyze_case(directory, graph):
    stem = f"{graph}-OFFSET"
    report = read_json(directory / f"{stem}-report.json.gz")
    require(isinstance(report, dict) and report.get("graph") == graph and report.get("scene") == "OFFSET", "report identity mismatch")
    require(report.get("ids") == list(IDS), "stable IDs differ")
    require(report.get("originalParity") is True and report.get("traceCopyIsolation") is True,
            "original parity or trace copy isolation receipt missing")
    require(report.get("numericalGO") is False, "original numerical NO-GO receipt missing")
    require(isinstance(report.get("failure"), dict) and report["failure"].get("kind") == "independent-quality"
            and report["failure"].get("step") == 495, "original failure495 receipt differs")
    states, traces = report.get("states"), report.get("traces")
    require(isinstance(states, list) and len(states) == 496, "accepted state count must be 496")
    require(isinstance(traces, list) and len(traces) == len(ORDER) == 3489, "trace count must be 3489")
    require("projectionStats" in report and isinstance(report.get("observations"), list), "original observation/projection receipt missing")
    accepted_raw, accepted_frames = read_raw(directory / f"{stem}-accepted.f64le.gz", 496, report.get("rawSha256"))
    trace_raw, trace_frames = read_raw(directory / f"{stem}-trace.f64le.gz", 3489, report.get("traceRawSha256"))
    accepted = [decode_state(state, frame, step, f"accepted[{step}]") for step, (state, frame) in enumerate(zip(states, accepted_frames))]
    initial_floor_raw = field_bytes(accepted_raw[:FRAME_BYTES], 8, 0, 13)
    for step in range(496):
        require(field_bytes(accepted_raw[step*FRAME_BYTES:(step+1)*FRAME_BYTES], 8, 0, 13) == initial_floor_raw,
                "accepted static floor body fields changed", step=step)
    previous_state = accepted[13]
    previous_measure = measure(previous_state, previous_state, 120)
    previous_raw = accepted_raw[13*FRAME_BYTES:14*FRAME_BYTES]
    previous_metadata = None
    pair_before_metadata = pair_before_raw = None
    series, b3_events, onset_crossings, cache_series, fallback_exceptions = [], [], [], [], []
    for index, (trace, frame, expected) in enumerate(zip(traces, trace_frames, ORDER)):
        require(isinstance(trace, dict) and set(trace) == {"metadata", "state"}, "trace schema mismatch", frame=index)
        metadata = trace["metadata"]
        validate_metadata(metadata, expected, index)
        state = decode_state(trace["state"], frame, metadata["stepIndex"], f"trace[{index}]")
        require(all(state.get(field) == [] for field in ("contacts", "events", "joints", "ccdHits")),
                "intermediate arrays must be empty", frame=index)
        require(state.get("pairStats") == {"eligiblePairs": 36, "candidatePairs": 0, "aabbTests": 0},
                "intermediate pairStats placeholder differs", frame=index)
        current_raw = trace_raw[index*FRAME_BYTES:(index+1)*FRAME_BYTES]
        require(field_bytes(current_raw, 8, 0, 13) == initial_floor_raw,
                "intermediate static floor body fields changed", frame=index)
        if metadata["phase"] == "pair-before":
            pair_before_metadata, pair_before_raw = metadata, current_raw
        if metadata["phase"] != "integrated":
            validate_transition(metadata, previous_metadata, current_raw, previous_raw,
                                pair_before_metadata, pair_before_raw, index)
        if metadata["phase"] == "projection-after":
            step = metadata["stepIndex"]
            require(current_raw == accepted_raw[step*FRAME_BYTES:(step+1)*FRAME_BYTES],
                    "projection endpoint differs from accepted raw body fields", frame=index, step=step)
        low = measure(state, previous_state, 80)
        high = measure(state, previous_state, 120)
        precision_check(low, high, index)
        record, b3_change = frame_record(index, metadata, high, previous_measure)
        series.append(record)
        if high["bodies"]["b3"]["angularDeltaNorm"] > 0:
            b3_events.append(b3_change)
        old_max = max(body["angularSpeed"] for body in previous_measure["bodies"].values())
        new_max = max(body["angularSpeed"] for body in high["bodies"].values())
        if (old_max > ANGULAR_THRESHOLD) != (new_max > ANGULAR_THRESHOLD):
            onset_crossings.append({"frame": index, "stepIndex": metadata["stepIndex"], "pass": metadata["pass"],
                                   "pair": metadata["pair"], "phase": metadata["phase"], "path": metadata["path"],
                                   "direction": "above" if new_max > ANGULAR_THRESHOLD else "at_or_below",
                                   "beforeMaxRadps": float(old_max), "afterMaxRadps": float(new_max),
                                   "largestAngularBody": record["largestAngularBody"]})
        if metadata["pair"] == ["b3", "b4"]:
            cache_series.append({"frame": index, **metadata})
        if metadata["phase"] == "after-response" and metadata["path"] == "combined-fallback":
            fallback_exceptions.append(index)
        previous_state, previous_measure, previous_raw, previous_metadata = state, high, current_raw, metadata
    ranked = sorted(b3_events, key=lambda event: Decimal(event["angularDeltaNormDecimalRadps"]), reverse=True)
    step15_ranked = [event for event in ranked if event["stepIndex"] == 15]
    analysis = {"phaseSeries": series, "b3AngularChanges": b3_events,
                "largestB3AngularVectorChanges": ranked[:12], "largestStep15B3AngularVectorChanges": step15_ranked[:12],
                "descriptiveAngularThresholdRadps": .02, "maxAngularThresholdCrossings": onset_crossings,
                "firstObservedCrossing": next((event for event in onset_crossings if event["direction"] == "above"), None),
                "b3b4CachePhaseSeries": cache_series, "combinedFallbackResponseExceptionFrames": fallback_exceptions,
                "positionOnlyInvarianceVerified": True, "allPhasePrecisionResolved": True}
    case = {"graph": graph, "scene": "OFFSET", "acceptedCount": 496, "traceCount": 3489,
            "acceptedRawSha256": sha256(accepted_raw), "traceRawSha256": sha256(trace_raw),
            "analysisSha256": sha256(canonical(analysis)), "originalFailure": report["failure"], **analysis}
    parity = {"acceptedRaw": accepted_raw, "traceRaw": trace_raw,
              "metadata": canonical([trace["metadata"] for trace in traces]),
              "states": canonical(states), "traces": canonical(traces), "config": canonical(report.get("config")),
              "observations": canonical(report["observations"]), "failure": canonical(report["failure"]),
              "projectionStats": canonical(report["projectionStats"]), "analysis": canonical(analysis)}
    return case, parity


def analyze_directory(directory):
    cases, baseline = [], None
    location = {"file": "summary.json"}
    try:
        summary = read_json(directory / "summary.json")
        require(isinstance(summary, dict) and summary.get("physicalModelGO") is False, "summary physical NO-GO receipt missing")
        results = summary.get("results")
        require(isinstance(results, list) and len(results) == 3, "summary must contain three OFFSET graphs")
        identities = [(row.get("graph"), row.get("scene")) for row in results if isinstance(row, dict)]
        require(len(identities) == 3 and set(identities) == {(graph, "OFFSET") for graph in GRAPHS}, "summary graph coverage differs")
        for graph in GRAPHS:
            location = {"graph": graph, "scene": "OFFSET"}
            case, parity = analyze_case(directory, graph)
            if baseline is None:
                baseline = parity
            else:
                for field in baseline:
                    require(baseline[field] == parity[field], "source/repeat/compiled parity mismatch", graph=graph, field=field)
            cases.append(case)
        named = cases[0]["largestStep15B3AngularVectorChanges"]
        return {"result": "PASS" if named else "INCONCLUSIVE", "diagnosticValid": True, "physicalModelGO": False,
                "traceFrameCount": 10467, "decimalPrecisions": [80, 120], "absoluteAgreementTolerance": "1e-25",
                "cases": cases, "limits": ["Energy observations are not conservation, dissipation, or force-accuracy proof.",
                    "The 0.02 rad/s threshold is descriptive within selected steps14–16, before8 s.",
                    "After-response contains all eight point iterations; inner iterations are not isolated.",
                    "Combined fallback response includes position correction; its phase is not velocity-only.",
                    "Intermediate geometry quality and missing contacts are unmeasured.",
                    "Original accepted-state geometry and physical NO-GO are preserved producer receipts."]}, 0
    except (InvalidDiagnostic, REFERENCE.ReferenceInputError, OSError, ValueError, TypeError, KeyError, ArithmeticError) as error:
        return {"result": "INVALID", "diagnosticValid": False, "physicalModelGO": False,
                "firstFailure": {**location, **getattr(error, "location", {}), "message": str(error)},
                "validatedCaseCount": len(cases), "cases": [],
                "limits": ["Validation stopped at the first invalid record. No physical inference is made."]}, 1


def self_check():
    controls = []
    def record(name, passed):
        controls.append({"control": name, "passed": bool(passed)})
    record("3489_ordered_frames", len(ORDER) == 3489)
    record("36_sorted_pairs", len(PAIRS) == 36 and PAIRS == tuple(sorted(PAIRS)))
    record("three_integrated_24_pass_end_six_projection", sum(row[0] == "integrated" for row in ORDER) == 3
           and sum(row[0] == "pass-end" for row in ORDER) == 24 and sum(row[0].startswith("projection-") for row in ORDER) == 6)
    raw = struct.pack("<117d", *([0.0] * 117))
    modified = bytearray(raw); modified[0:8] = struct.pack("<d", 1.0)
    require_position_only(raw, bytes(modified), 0)
    record("position_change_admitted", True)
    modified[3*8:4*8] = struct.pack("<d", -0.0)
    try:
        require_position_only(raw, bytes(modified), 0)
        rejected = False
    except InvalidDiagnostic:
        rejected = True
    record("position_phase_preserves_velocity_sign_bits", rejected)
    bodies = [{"id": body_id, "positionM": [0, 1, 0], "velocityMps": [0, 0, 0], "angularVelocityRadps": [0, 0, 0]}
              for body_id in IDS]
    old = {"bodies": bodies}
    current = copy.deepcopy(old)
    current["bodies"][3]["velocityMps"] = [3, -4, 0]
    current["bodies"][3]["angularVelocityRadps"] = [0, 0, -12]
    low, high = measure(current, old, 80), measure(current, old, 120)
    precision_check(low, high, 0)
    record("decimal_energy_kinetic_15_5J", high["kineticJ"] == Decimal("15.5"))
    record("decimal_energy_potential_78_48J", high["potentialJ"] == Decimal("78.48"))
    record("signed_velocity_and_angular_deltas", high["bodies"]["b3"]["linearDelta"] == (Decimal(3), Decimal(-4), ZERO)
           and high["bodies"]["b3"]["angularDelta"] == (ZERO, ZERO, Decimal(-12)))
    record("decimal_vector_speed_and_change_norm", high["bodies"]["b3"]["linearSpeed"] == Decimal(5)
           and high["bodies"]["b3"]["angularDeltaNorm"] == Decimal(12))
    record("raw_signed_zero_preserved", math.copysign(1, struct.unpack("<d", struct.pack("<d", -0.0))[0]) == -1)
    passed = all(item["passed"] for item in controls)
    return {"result": "PASS" if passed else "FAIL", "controls": controls}, 0 if passed else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", nargs="?", type=Path)
    parser.add_argument("--self-check", action="store_true")
    arguments = parser.parse_args()
    if arguments.self_check:
        result, exit_code = self_check()
        print(json.dumps(result, allow_nan=False))
        return exit_code
    if arguments.directory is None:
        parser.error("directory is required unless --self-check is used")
    result, exit_code = analyze_directory(arguments.directory)
    destination = arguments.directory / "analysis.json"
    destination.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"result": result["result"], "diagnosticValid": result["diagnosticValid"],
                      "physicalModelGO": False, "analysisPath": str(destination.resolve()),
                      "firstFailure": result.get("firstFailure")}, allow_nan=False))
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
