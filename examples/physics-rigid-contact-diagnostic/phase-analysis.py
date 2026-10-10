#!/usr/bin/env python3
"""Validate saved phase traces and compute independent offline geometry.

This analyzer does not import a producer, start a world, or change an algorithm.
Intermediate empty contact arrays are not evidence of a missed detection.
Signed SAT margins below zero are projection gaps, not Euclidean distances.
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
SPEC = importlib.util.spec_from_file_location("independent_contact_geometry", REFERENCE_PATH)
REFERENCE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(REFERENCE)

IDS = tuple(f"b{index}" for index in range(8)) + ("floor",)
GRAPHS = ("source", "source-repeat", "compiled-dependencies")
SCENES = ("ALIGNED", "OFFSET", "YAW")
PAIRS = tuple(combinations(IDS, 2))
FIELDS = (("positionM", 3), ("velocityMps", 3), ("orientation", 4), ("angularVelocityRadps", 3))
FRAME_COMPONENTS = 117
FRAME_BYTES = FRAME_COMPONENTS * 8
TOUCH_M = Decimal("1e-10")
QUALITY_M = Decimal(".002")
PRECISION_M = Decimal("1e-12")


class InvalidDiagnostic(ValueError):
    def __init__(self, message, **location):
        super().__init__(message)
        self.location = location


def require(condition, message, **location):
    if not condition:
        raise InvalidDiagnostic(message, **location)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def read_json(path):
    if path.suffix == ".gz":
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            return json.load(handle)
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def require_finite(value, location):
    if isinstance(value, float):
        require(math.isfinite(value), "nonfinite JSON number", location=location)
    elif isinstance(value, dict):
        for key, item in value.items():
            require_finite(item, f"{location}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            require_finite(item, f"{location}[{index}]")


def read_raw(path, frame_count, expected_sha):
    with gzip.open(path, "rb") as handle:
        raw = handle.read(frame_count * FRAME_BYTES + 1)
    require(len(raw) == frame_count * FRAME_BYTES, "raw frame byte count mismatch",
            file=path.name, expectedBytes=frame_count * FRAME_BYTES, actualBytes=len(raw))
    require(isinstance(expected_sha, str) and sha256(raw) == expected_sha,
            "uncompressed raw SHA256 mismatch", file=path.name)
    frames = list(struct.iter_unpack("<117d", raw))
    for index, frame in enumerate(frames):
        require(all(math.isfinite(value) for value in frame), "nonfinite raw Float64 component",
                file=path.name, frame=index)
    return raw, frames


def decode_state(json_state, frame, location):
    require(isinstance(json_state, dict), "state must be an object", location=location)
    require_finite(json_state, location)
    bodies = json_state.get("bodies")
    require(isinstance(bodies, list) and len(bodies) == len(IDS), "body count mismatch", location=location)
    require(all(isinstance(body, dict) for body in bodies), "invalid body record", location=location)
    require(tuple(body.get("id") for body in bodies) == IDS, "body ID order mismatch", location=location)
    state = copy.deepcopy(json_state)
    cursor = 0
    for body in state["bodies"]:
        for field, count in FIELDS:
            values = body.get(field)
            require(isinstance(values, list) and len(values) == count,
                    "body component vector length mismatch", location=location, body=body["id"], field=field)
            decoded = list(frame[cursor:cursor + count])
            for component, (json_value, raw_value) in enumerate(zip(values, decoded)):
                require(type(json_value) in (int, float) and float(json_value) == raw_value,
                        "JSON and raw component differ", location=location, body=body["id"],
                        field=field, component=component)
            # JSON.stringify loses negative zero. LE bytes remain authoritative.
            body[field] = decoded
            cursor += count
    require(cursor == FRAME_COMPONENTS, "decoded component count mismatch", location=location)
    return state


def expected_order():
    order = []
    for step in range(1, 7):
        order.append(("integrated", step, None, None))
        for pass_index in range(8):
            if step == 6 and pass_index == 7:
                for pair in PAIRS:
                    order.append(("pair-before", step, pass_index, pair))
                    order.append(("pair-after", step, pass_index, pair))
            order.append(("pass-end", step, pass_index, None))
    return order


ORDER = tuple(expected_order())


def validate_metadata(metadata, expected, index):
    require(isinstance(metadata, dict), "metadata must be an object", frame=index)
    require(set(metadata) == {"phase", "stepIndex", "pass", "pair", "hit", "manifold"},
            "metadata schema differs from freeze", frame=index)
    phase, step, pass_index, pair = expected
    require(metadata.get("phase") == phase and type(metadata.get("stepIndex")) is int
            and metadata["stepIndex"] == step and metadata.get("pass") == pass_index,
            "trace phase, step, or pass order mismatch", frame=index, expected=list(expected[:3]))
    if pass_index is not None:
        require(type(metadata.get("pass")) is int, "pass must be an integer", frame=index)
    expected_pair = list(pair) if pair is not None else None
    require(metadata.get("pair") == expected_pair, "trace pair order mismatch", frame=index,
            expectedPair=expected_pair)
    require("hit" in metadata and "manifold" in metadata, "missing decision metadata", frame=index)
    hit, manifold = metadata["hit"], metadata["manifold"]
    require_finite(metadata, f"metadata[{index}]")
    if pair is None:
        require(hit is None and manifold is None, "phase checkpoint has pair decision metadata", frame=index)
        return
    if hit is None:
        require(manifold is None, "no-hit decision must have null manifold", frame=index)
        return
    require(isinstance(hit, dict), "hit must be an object or null", frame=index)
    try:
        with localcontext() as context:
            context.prec = 120
            normal = REFERENCE.vector(hit.get("normalAtoB"))
            REFERENCE.vector(hit.get("pointM"))
            penetration = REFERENCE.decimal_number(hit.get("penetrationM"))
            require(REFERENCE.length(normal) > 0 and penetration >= 0,
                    "invalid hit normal or penetration", frame=index)
    except REFERENCE.ReferenceInputError as error:
        raise InvalidDiagnostic(str(error), frame=index) from error
    if manifold is not None:
        require(isinstance(manifold, list), "manifold must be an array or null", frame=index)
        for point_index, point in enumerate(manifold):
            require(isinstance(point, dict) and isinstance(point.get("id"), str),
                    "invalid manifold point id", frame=index, point=point_index)
            try:
                REFERENCE.vector(point.get("pointM"))
            except REFERENCE.ReferenceInputError as error:
                raise InvalidDiagnostic(str(error), frame=index, point=point_index) from error


def validate_timestamp(state, step, location):
    require(type(state.get("stepIndex")) is int and state["stepIndex"] == step,
            "state stepIndex mismatch", location=location)
    time = state.get("timeSeconds")
    require(type(time) in (int, float) and math.isfinite(float(time))
            and abs(float(time) - step / 120) <= 1e-12,
            "state timestamp mismatch", location=location)


def pair_geometry(result):
    return {tuple(sorted(pair)): values
            for pair, values in {**result["pairs"], **result["floor_pairs"]}.items()}


def observe(state, initial, location):
    request = {"state": state, "initial": initial,
               "timeSeconds": state["timeSeconds"], "referenceAt8s": None}
    try:
        low = REFERENCE.evaluate_precision(request, 80)
        high = REFERENCE.evaluate_precision(request, 120)
        with localcontext() as context:
            context.prec = 120
            require(REFERENCE.precision_agrees(low, high), "observer precision unresolved", location=location)
            low_pairs, high_pairs = pair_geometry(low), pair_geometry(high)
            require(tuple(sorted(high_pairs)) == PAIRS, "observer pair coverage mismatch", location=location)
            for pair in PAIRS:
                require(abs(low_pairs[pair][1] - high_pairs[pair][1]) <= PRECISION_M,
                        "pair signed depth precision unresolved", location=location, pair=list(pair))
                require((low_pairs[pair][1] > TOUCH_M) == (high_pairs[pair][1] > TOUCH_M),
                        "pair touching classification precision unresolved", location=location, pair=list(pair))
            high["low_precision_pairs"] = low_pairs
            return high
    except REFERENCE.ReferenceInputError as error:
        raise InvalidDiagnostic(str(error), location=location) from error


def checkpoint_record(observed, metadata, index):
    pairs = pair_geometry(observed)
    # First canonical pair wins an exact depth tie.
    worst = max(PAIRS, key=lambda pair: pairs[pair][0])
    metrics = observed["metrics"]
    quality = [f"{name} exceeds 0.002 m" for name in (
        "maxPairPenetrationM", "maxFloorPenetrationM", "maxHalfspaceIntrusionM")
        if metrics[name] > QUALITY_M]
    if not metrics["footprintContained"]:
        quality.append("cube footprint is outside finite floor")
    if metrics["escapedBelowFloor"]:
        quality.append("cube is wholly below finite floor")
    public_metrics = {key: float(value) if isinstance(value, Decimal) else value
                      for key, value in metrics.items()
                      if key not in ("overlapWithoutContactCount", "maxVerticalDriftM")}
    return {"index": index, "metadata": metadata,
            "worstPair": list(worst), "worstPairDepthM": float(pairs[worst][0]),
            "worstPairDepthDecimalM": str(pairs[worst][0]),
            "worstPairSignedDepthM": float(pairs[worst][1]),
            "penetratingPairCount": sum(margin > TOUCH_M for _, margin in pairs.values()),
            "referencePrecisionResolved": True, "metrics": public_metrics,
            "qualityObservations": quality}


def classify_change(before, after):
    before_depth, before_margin = before
    after_depth, after_margin = after
    delta = after_depth - before_depth
    reopened = before_margin <= TOUCH_M and after_margin > TOUCH_M
    residual_increase = before_margin > TOUCH_M and delta > 0
    return {"beforeDepthM": float(before_depth), "afterDepthM": float(after_depth),
            "beforeSignedDepthM": float(before_margin), "afterSignedDepthM": float(after_margin),
            "beforeSignedDepthDecimalM": str(before_margin), "afterSignedDepthDecimalM": str(after_margin),
            "depthIncreaseM": float(delta), "depthIncreaseDecimalM": str(delta),
            "increaseExceedsPrecisionTolerance": delta > PRECISION_M,
            "newlyReopened": reopened, "existingResidualIncrease": residual_increase}


def direction_diagnostic(before_state, after_state, pair, hit):
    if hit is None:
        return None
    before = {body["id"]: body for body in before_state["bodies"]}
    after = {body["id"]: body for body in after_state["bodies"]}
    normal = REFERENCE.vector(hit["normalAtoB"])
    normal_length = REFERENCE.length(normal)
    unit = tuple(value / normal_length for value in normal)
    a_id, b_id = pair
    old_delta = REFERENCE.subtract(REFERENCE.vector(before[b_id]["positionM"]),
                                   REFERENCE.vector(before[a_id]["positionM"]))
    new_delta = REFERENCE.subtract(REFERENCE.vector(after[b_id]["positionM"]),
                                   REFERENCE.vector(after[a_id]["positionM"]))
    along = REFERENCE.dot(REFERENCE.subtract(new_delta, old_delta), unit)
    direction = ("along_reported_normal" if along > TOUCH_M else
                 "opposite_reported_normal" if along < -TOUCH_M else "within_touch_tolerance")
    return {"normalLength": float(normal_length),
            "relativeCenterMoveAlongNormalM": float(along),
            "relativeCenterMoveAlongNormalDecimalM": str(along),
            "beforeCenterOffsetAlongNormalM": float(REFERENCE.dot(old_delta, unit)),
            "direction": direction,
            "interpretation": "center displacement diagnostic; rotation and manifold adequacy are not proved"}


def transition_record(index, metadata, before, after, before_state, after_state):
    own = tuple(metadata["pair"])
    before_pairs, after_pairs = pair_geometry(before), pair_geometry(after)
    with localcontext() as context:
        context.prec = 120
        for pair in PAIRS:
            low_change = classify_change(before["low_precision_pairs"][pair], after["low_precision_pairs"][pair])
            high_change = classify_change(before_pairs[pair], after_pairs[pair])
            low_delta = after["low_precision_pairs"][pair][1] - before["low_precision_pairs"][pair][1]
            high_delta = after_pairs[pair][1] - before_pairs[pair][1]
            require(abs(low_delta - high_delta) <= PRECISION_M,
                    "pair signed depth change precision unresolved", frame=index, pair=list(pair))
            require(low_change["newlyReopened"] == high_change["newlyReopened"]
                    and low_change["existingResidualIncrease"] == high_change["existingResidualIncrease"],
                    "pair transition classification precision unresolved", frame=index, pair=list(pair))
        own_change = classify_change(before_pairs[own], after_pairs[own])
        neighbors = []
        for pair in PAIRS:
            if pair == own or not set(pair).intersection(own):
                continue
            change = classify_change(before_pairs[pair], after_pairs[pair])
            if after_pairs[pair][0] > before_pairs[pair][0] or change["newlyReopened"]:
                neighbors.append({"pair": list(pair), **change})
        hit, manifold = metadata["hit"], metadata["manifold"]
        return {"beforeFrame": index, "afterFrame": index + 1, "stepIndex": 6, "pass": 7,
                "pair": list(own), "ownPair": own_change,
                "missedDetect": before_pairs[own][1] > TOUCH_M and hit is None,
                "detectorHit": hit, "manifoldPointCount": len(manifold) if manifold is not None else None,
                "singlePointFallback": hit is not None and manifold is None,
                "neighborDepthIncreases": neighbors,
                "directionDiagnostic": direction_diagnostic(before_state, after_state, own, hit)}


def analyze_case(directory, graph, scene):
    stem = f"{graph}-{scene}"
    report = read_json(directory / f"{stem}-report.json.gz")
    require(isinstance(report, dict), "report must be an object")
    require(report.get("graph") == graph and report.get("scene") == scene,
            "report graph or scene differs from file identity")
    require(report.get("originalParity") is True and report.get("traceCopyIsolation") is True,
            "original parity or trace copy isolation receipt is missing or false")
    require(report.get("numericalGO") is False, "original numerical NO-GO receipt is missing")
    failure = report.get("failure")
    require(isinstance(failure, dict) and failure.get("kind") == "independent-quality"
            and type(failure.get("step")) is int and failure["step"] == 6,
            "original first failure must be independent-quality at step six")
    require(report.get("ids") == list(IDS), "report stable ID order mismatch")
    config = report.get("config")
    require(isinstance(config, dict) and config.get("fixedStepSeconds") == 1 / 120,
            "fixture fixed step must be 1/120 s")
    states, traces = report.get("states"), report.get("traces")
    require(isinstance(states, list) and len(states) == 7, "accepted state count must be seven")
    require(isinstance(traces, list) and len(traces) == len(ORDER) == 126, "trace frame count must be 126")
    require("observations" in report and "failure" in report, "report lacks original observations or failure")
    accepted_raw, accepted_frames = read_raw(directory / f"{stem}-accepted.f64le.gz", 7, report.get("rawSha256"))
    trace_raw, trace_frames = read_raw(directory / f"{stem}-trace.f64le.gz", 126, report.get("traceRawSha256"))
    accepted = []
    for index, (state, frame) in enumerate(zip(states, accepted_frames)):
        decoded = decode_state(state, frame, f"accepted[{index}]")
        validate_timestamp(decoded, index, f"accepted[{index}]")
        accepted.append(decoded)
    initial = accepted[0]
    accepted_series = []
    for index, state in enumerate(accepted):
        observed = observe(state, initial, f"accepted[{index}]")
        accepted_series.append(checkpoint_record(observed, {"phase": "accepted", "stepIndex": index}, index))
    phase_series, pair_transitions = [], []
    previous_observed = previous_state = previous_metadata = previous_bytes = None
    endpoint_indices = {}
    for index, (trace, frame, expected) in enumerate(zip(traces, trace_frames, ORDER)):
        require(isinstance(trace, dict) and "state" in trace and "metadata" in trace,
                "trace requires metadata and state", frame=index)
        metadata = trace["metadata"]
        validate_metadata(metadata, expected, index)
        state = decode_state(trace["state"], frame, f"trace[{index}]")
        validate_timestamp(state, metadata["stepIndex"], f"trace[{index}]")
        for field in ("contacts", "events", "joints", "ccdHits"):
            require(state.get(field) == [], "intermediate state must have empty diagnostic arrays", frame=index, field=field)
        stats = state.get("pairStats")
        require(isinstance(stats, dict) and stats.get("eligiblePairs") == 36,
                "intermediate pairStats.eligiblePairs must be 36", frame=index)
        current_bytes = trace_raw[index * FRAME_BYTES:(index + 1) * FRAME_BYTES]
        phase = metadata["phase"]
        if phase == "pair-before":
            require(previous_bytes == current_bytes, "body continuity before pair mismatch", frame=index)
        if phase == "pair-after":
            require(previous_metadata == {**metadata, "phase": "pair-before"},
                    "pair-before/after decision metadata differ", frame=index)
        if phase == "pass-end" and metadata["stepIndex"] == 6 and metadata["pass"] == 7:
            require(previous_bytes == current_bytes, "final pair-after to pass-end continuity mismatch", frame=index)
        if phase == "pass-end" and metadata["pass"] == 7:
            step = metadata["stepIndex"]
            accepted_bytes = accepted_raw[step * FRAME_BYTES:(step + 1) * FRAME_BYTES]
            require(current_bytes == accepted_bytes, "pass-end7 and accepted endpoint raw values differ", frame=index, step=step)
            endpoint_indices[step] = index
        observed = observe(state, initial, f"trace[{index}]")
        phase_series.append(checkpoint_record(observed, metadata, index))
        if phase == "pair-after":
            pair_transitions.append(transition_record(index - 1, previous_metadata,
                                                      previous_observed, observed, previous_state, state))
        previous_observed, previous_state = observed, state
        previous_metadata, previous_bytes = metadata, current_bytes
    require(len(pair_transitions) == 36 and len(endpoint_indices) == 6, "pair transition or endpoint coverage mismatch")
    analysis = {"acceptedSeries": accepted_series, "phaseSeries": phase_series,
                "pairTransitions": pair_transitions,
                "aggregateObservations": {
                    "missedDetectCount": sum(item["missedDetect"] for item in pair_transitions),
                    "singlePointFallbackCount": sum(item["singlePointFallback"] for item in pair_transitions),
                    "newlyReopenedNeighborCount": sum(change["newlyReopened"] for item in pair_transitions
                                                      for change in item["neighborDepthIncreases"]),
                    "existingResidualIncreaseCount": sum(change["existingResidualIncrease"] for item in pair_transitions
                                                          for change in item["neighborDepthIncreases"]),
                    "phaseQualityObservationCount": sum(bool(item["qualityObservations"]) for item in phase_series)},
                "endpointTraceIndices": endpoint_indices}
    case = {"graph": graph, "scene": scene, "acceptedRawSha256": sha256(accepted_raw),
            "traceRawSha256": sha256(trace_raw), "traceAnalysisSha256": sha256(canonical(analysis)),
            "acceptedCount": 7, "traceCount": 126, "pairCountPerFrame": 36,
            "originalFailure": report["failure"], **analysis}
    parity = {"acceptedRaw": accepted_raw, "traceRaw": trace_raw,
              "metadata": [trace["metadata"] for trace in traces],
              "traceStates": [trace["state"] for trace in traces],
              "acceptedStates": states, "observations": report["observations"],
              "failure": report["failure"], "config": config, "analysis": canonical(analysis)}
    return case, parity


def check_parity(baseline, current, graph, scene):
    for name in ("acceptedRaw", "traceRaw", "metadata", "traceStates", "acceptedStates",
                 "observations", "failure", "config", "analysis"):
        require(baseline[name] == current[name], "source/repeat/compiled parity mismatch",
                graph=graph, scene=scene, field=name)


def first_named_observation(cases):
    for case in cases:
        for item in case["pairTransitions"]:
            if item["missedDetect"] or item["neighborDepthIncreases"]:
                return {"scene": case["scene"], "graph": case["graph"],
                        "stepIndex": 6, "pass": 7, "pair": item["pair"],
                        "beforeFrame": item["beforeFrame"], "afterFrame": item["afterFrame"],
                        "missedDetect": item["missedDetect"],
                        "neighborDepthIncreases": item["neighborDepthIncreases"]}
    for case in cases:
        for item in case["phaseSeries"]:
            if item["worstPairDepthM"] > float(TOUCH_M):
                return {"scene": case["scene"], "graph": case["graph"],
                        "frame": item["index"], "metadata": item["metadata"],
                        "pair": item["worstPair"], "depthM": item["worstPairDepthM"]}
    return None


def analyze_directory(directory):
    cases, baseline_by_scene = [], {}
    current_location = {"file": "summary.json"}
    try:
        summary = read_json(directory / "summary.json")
        require(isinstance(summary, dict) and summary.get("acceptedRawParity") is True
                and summary.get("phaseGraphParity") is True and summary.get("physicalModelGO") is False,
                "summary parity or preserved physical NO-GO receipt is missing or false")
        results = summary.get("results") if isinstance(summary, dict) else None
        require(isinstance(results, list) and len(results) == 9, "summary must contain nine results")
        requested = []
        for result in results:
            require(isinstance(result, dict), "summary result must be an object")
            requested.append((result.get("graph"), result.get("scene")))
        expected = {(graph, scene) for graph in GRAPHS for scene in SCENES}
        require(len(set(requested)) == 9 and set(requested) == expected, "summary graph/scene coverage mismatch")
        # Analyze source first so every repeat is checked against its source case.
        for graph in GRAPHS:
            for scene in SCENES:
                current_location = {"graph": graph, "scene": scene}
                case, parity = analyze_case(directory, graph, scene)
                if graph == "source":
                    baseline_by_scene[scene] = parity
                else:
                    check_parity(baseline_by_scene[scene], parity, graph, scene)
                cases.append(case)
        named = first_named_observation(cases)
        return {"result": "PASS" if named is not None else "INCONCLUSIVE",
                "diagnosticValid": True, "physicalModelGO": False,
                "geometryReferenceSha256": sha256(REFERENCE_PATH.read_bytes()),
                "acceptedSnapshotCount": 63, "traceFrameCount": 1134,
                "namedObservation": named, "cases": cases,
                "limits": ["Intermediate empty contacts do not prove missed detection.",
                           "Missed detection uses the recorded subsequent detect decision only.",
                           "Intermediate 2 mm quality observations do not change accepted-state decisions.",
                           "Pair direction and schedule observations do not prove manifold adequacy or a physical model GO."]}, 0
    except (InvalidDiagnostic, OSError, ValueError, TypeError, KeyError, ArithmeticError) as error:
        location = {**current_location, **getattr(error, "location", {})}
        return {"result": "INVALID", "diagnosticValid": False, "physicalModelGO": False,
                "firstFailure": {**location, "message": str(error)},
                "validatedCaseCount": len(cases), "cases": [],
                "limits": ["Validation stopped at the first invalid record. No physical inference is made."]}, 1


def self_check():
    checks = []

    def record(name, passed):
        checks.append({"control": name, "passed": bool(passed)})

    with localcontext() as context:
        context.prec = 120
        reopened = classify_change((Decimal(0), Decimal("-1e-12")),
                                   (Decimal(".001"), Decimal(".001")))
        record("newly_reopened_is_not_existing_residual", reopened["newlyReopened"] and not reopened["existingResidualIncrease"])
        residual = classify_change((Decimal(".001"), Decimal(".001")),
                                   (Decimal(".002"), Decimal(".002")))
        record("existing_residual_is_not_newly_reopened", residual["existingResidualIncrease"] and not residual["newlyReopened"])
        touching = classify_change((Decimal(0), Decimal(0)), (TOUCH_M, TOUCH_M))
        record("exact_touch_threshold_is_not_reopened", not touching["newlyReopened"])
        record("raw_subthreshold_depth_is_retained", touching["afterDepthM"] == float(TOUCH_M))
        decreased = classify_change((Decimal(".002"), Decimal(".002")),
                                    (Decimal(".001"), Decimal(".001")))
        record("decreased_residual_is_not_an_increase", not decreased["existingResidualIncrease"])
    record("126_trace_records", len(ORDER) == 126)
    record("36_sorted_pairs", len(PAIRS) == 36 and PAIRS == tuple(sorted(PAIRS)))
    record("six_integrated_phases", sum(phase == "integrated" for phase, _, _, _ in ORDER) == 6)
    record("48_pass_end_phases", sum(phase == "pass-end" for phase, _, _, _ in ORDER) == 48)
    record("72_pair_phases", sum(phase.startswith("pair-") for phase, _, _, _ in ORDER) == 72)
    record("pair_order_is_final_step_final_pass_only", all(step == 6 and pass_index == 7
           for phase, step, pass_index, _ in ORDER if phase.startswith("pair-")))
    signed_zero = struct.pack("<d", -0.0)
    decoded_zero = struct.unpack("<d", signed_zero)[0]
    record("raw_signed_zero_preserved", math.copysign(1, decoded_zero) == -1 and decoded_zero == 0)
    try:
        validate_metadata({"phase": "pair-before", "stepIndex": 6, "pass": 7,
                           "pair": list(PAIRS[0]), "hit": None, "manifold": []}, ORDER[53], 53)
        invalid_rejected = False
    except InvalidDiagnostic:
        invalid_rejected = True
    record("invalid_no_hit_manifold_rejected", invalid_rejected)
    passed = all(item["passed"] for item in checks)
    return {"result": "PASS" if passed else "FAIL", "controls": checks}, 0 if passed else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", nargs="?", type=Path)
    parser.add_argument("--self-check", action="store_true")
    arguments = parser.parse_args()
    if arguments.self_check:
        result, exit_code = self_check()
    else:
        if arguments.directory is None:
            parser.error("directory is required unless --self-check is used")
        result, exit_code = analyze_directory(arguments.directory)
        output_path = arguments.directory / "analysis.json"
        output_path.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps(result if arguments.self_check else {
        "result": result["result"], "diagnosticValid": result["diagnosticValid"],
        "physicalModelGO": False, "analysisPath": str(output_path.resolve()),
        "firstFailure": result.get("firstFailure")}, allow_nan=False))
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
