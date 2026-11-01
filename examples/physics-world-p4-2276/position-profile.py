#!/usr/bin/env python3
"""Two direct, unchanged reference evaluations under cProfile; no World or IPC."""
import argparse
import copy
import cProfile
import hashlib
import importlib.util
import json
from pathlib import Path
import platform
import pstats
import re
import signal
import sys
import time

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OLD_HELPER_SHA = "67c23875efa2836cd2c374794dfb6b942366493e8fbf979ffcd8789ac2c8464f"
SOURCE_SUMMARY_SHA = "be2317e3160da6ac961b7e4ec7e0bbddd20133947bc536c3de955691d9df80cb"
SELECTED = ("ALIGNED", "YAW")


def sha(data):
    return hashlib.sha256(data).hexdigest()


helper_path = HERE / "cost-census.py"
if sha(helper_path.read_bytes()) != OLD_HELPER_SHA:
    raise RuntimeError("original DATA helper changed")
spec = importlib.util.spec_from_file_location("unchanged_profile_data_helpers", helper_path)
C = importlib.util.module_from_spec(spec)
spec.loader.exec_module(C)


def checked(path, count, digest, maximum=C.MAX_IPC):
    data = C.read_bound(path, maximum)
    C.need(len(data) == count and sha(data) == digest, "position profile input byte/hash mismatch: " + str(path))
    return data


def authenticate(source):
    C.need(source.resolve() == HERE / "evidence/observable-census-01", "wrong current raw authority folder")
    summary_bytes = checked(source / "summary.json", 59236, SOURCE_SUMMARY_SHA)
    summary = C.strict_json(summary_bytes)
    C.need(summary["status"] == "PASS_OBSERVABLE_ARCHIVE_CENSUS" and summary["counts"] == {
        "framesCompleted": 6, "reusedValidated": 2, "freshReferenceIpcAttempted": 22,
        "freshReferenceRepliesCompleted": 22, "observableArchiveMatched": 24,
        "dataProjectionAttempted": 22, "dataProjectionCompleted": 22}, "observable census did not qualify its complete population")
    C.need(summary["preservedOriginalCensusStatus"] == "FAIL" and summary["historicalRawReplyEquivalence"] == "NOT_ESTABLISHED",
           "historical raw-reply uncertainty changed")
    authority, frames = C.authenticate_inputs()
    C.need(C.difference(authority["providerPins"], summary["authentication"]["providerPins"]) is None,
           "current reference source differs from captured uncached authority")
    selected = []
    for scene in SELECTED:
        record = next((row for row in summary["requests"] if row["scene"] == scene and row["step"] == 16 and row["operation"] == "position-world"), None)
        C.need(record and record["observableArchiveEqual"] is True and record["source"] == "NEW_ACTUAL_REFERENCE", "selected actual uncached reference reply absent")
        payload = {}
        for kind in ("request", "reply"):
            pin = record["locators"][kind]
            C.need(Path(pin["path"]).name == pin["path"], "unsafe captured payload path")
            payload[kind] = checked(source / pin["path"], pin["bytes"], pin["sha256"])
        request = C.strict_json(payload["request"])
        C.need(request["op"] == "world" and request["scene"] == scene and request["stepIndex"] == 16, "captured request identity differs")
        frame = next(frame for frame in frames if frame["scene"] == scene and frame["step"] == 16)
        C.need(request["preRawHex"] == frame["frames"]["velocity-ready/velocityBodies"]["hex"] and
               request["hypRawHex"] == frame["frames"]["after"]["hex"], "captured request raw frame differs from full authenticated archive")
        expected = C.strict_json(payload["reply"])
        C.need(expected["ok"] is True and expected["resolved"] is True and expected["executionFailure"] is False and
               expected["referenceStatus"] == "SOLVED" and not expected["violations"], "selected current uncached reply did not qualify")
        selected.append({"scene": scene, "step": 16, "record": record, "request": request,
                         "requestBytes": payload["request"], "expected": expected, "expectedBytes": payload["reply"]})
    return authority, selected


def function_id(key):
    filename, line, name = key
    path = Path(filename)
    if path.is_absolute() and path.is_relative_to(ROOT):
        filename = str(path.relative_to(ROOT))
    return {"file": filename, "line": line, "function": name}


def profile_rows(profiler):
    stats = pstats.Stats(profiler)
    rows = []
    for key, value in stats.stats.items():
        primitive, calls, self_seconds, cumulative_seconds, callers = value
        caller_rows = []
        for caller, counters in callers.items():
            if type(counters) is tuple:
                count, total, own, cumulative = counters
                caller_rows.append({**function_id(caller), "primitiveCalls": count, "calls": total,
                                    "selfSeconds": own, "cumulativeSeconds": cumulative})
            else:
                caller_rows.append({**function_id(caller), "calls": counters})
        rows.append({**function_id(key), "primitiveCalls": primitive, "calls": calls,
                     "selfSeconds": self_seconds, "cumulativeSeconds": cumulative_seconds,
                     "callers": sorted(caller_rows, key=lambda item: (item["file"], item["line"], item["function"]))})
    return sorted(rows, key=lambda item: (-item["cumulativeSeconds"], item["file"], item["line"], item["function"]))


def phases(rows):
    # These two roots are disjoint in original world(): PRE geometry, exact
    # kernel, then HYP geometry. Other inclusive times must not be added to them.
    targets = {
        "satGeometryCompactPairs": ("examples/physics-rigid-signed-closure-world/reference.py", "compact_pair"),
        "exactQpSolve": ("examples/physics-rigid-full-pair-position-world/full-pair-reference.py", "solve_exact"),
        "positionKernelIncludingValidation": ("examples/physics-rigid-full-pair-position-world/reference.py", "kernel"),
        "positionWorld": ("examples/physics-rigid-full-pair-position-world/reference.py", "world"),
        "evaluate": ("examples/physics-rigid-full-pair-position-world/reference.py", "evaluate"),
    }
    return {label: [row for row in rows if (row["file"], row["function"]) == target] for label, target in targets.items()}


def run(run_id, source):
    C.need(re.fullmatch("[a-z0-9][a-z0-9-]{0,95}", run_id), "invalid fresh position profile ID")
    out = HERE / "evidence" / run_id; out.mkdir(parents=True, exist_ok=False)
    started = time.monotonic_ns(); charged = 0; current = None
    counts = {"evaluateAttempted": 0, "evaluateReturned": 0, "strictRawReplyMatched": 0}
    summary = {"workId": "physics-world-p4-position-profile-2276", "runId": run_id, "status": "IN_PROGRESS",
               "counts": counts, "priorStudyReferenceEvaluations": 24, "WorldCalls": 0, "productionSolverCalls": 0,
               "fixtureCalls": 0, "trigCalls": 0, "IPCRequests": 0, "PythonChildren": 0,
               "profiledCalls": [], "firstFailure": None}
    def put(name, data):
        nonlocal charged
        C.need(charged + len(data) <= 16 * C.MIB, "16MiB position profile storage exhausted")
        with (out / name).open("xb") as stream:
            stream.write(data)
        charged += len(data)
    def progress():
        (out / "progress.json").write_bytes(C.encoded(summary))
    def deadline(_signum, _frame):
        raise C.CensusFailure("170s position profiling internal deadline")
    previous = signal.signal(signal.SIGALRM, deadline); signal.setitimer(signal.ITIMER_REAL, 170)
    try:
        authority, selected = authenticate(source.resolve())
        summary["authority"] = authority
        summary["currentRawAuthority"] = {"source": str(source.resolve()), "summaryBytes": 59236, "summarySha256": SOURCE_SUMMARY_SHA}
        own_sha = sha(C.read_bound(Path(__file__), C.MIB)); summary["harnessSha256"] = own_sha
        executable = Path(sys.executable).resolve()
        summary["python"] = {"executable": str(executable), "version": sys.version, "platform": platform.platform(),
                             "executableSha256": sha(C.read_bound(executable, 256 * C.MIB))}
        progress()
        reference_path = C.safe_path(C.REFERENCE_PATHS[3])
        module_spec = importlib.util.spec_from_file_location("immutable_profiled_position_reference", reference_path)
        module = importlib.util.module_from_spec(module_spec)
        import_started = time.monotonic_ns(); module_spec.loader.exec_module(module)
        summary["referenceImportWallNs"] = time.monotonic_ns() - import_started
        for item in selected:
            current = {"scene": item["scene"], "step": 16, "sourceLocators": item["record"]["locators"]}
            put(item["scene"] + ".input-provenance.json", C.encoded({**current, "requestSha256": sha(item["requestBytes"]),
                "currentRawReplySha256": sha(item["expectedBytes"]), "recordLocator": item["record"]["recordLocator"]}))
            profiler = cProfile.Profile(); result = None
            counts["evaluateAttempted"] += 1; progress()
            wall = time.monotonic_ns(); cpu = time.process_time_ns()
            try:
                profiler.enable()
                result = module.evaluate(item["request"])
                profiler.disable()
                counts["evaluateReturned"] += 1
            finally:
                profiler.disable()
                timing = {"profiledWallNs": time.monotonic_ns() - wall, "profiledCpuNs": time.process_time_ns() - cpu}
                rows = profile_rows(profiler)
                stats_path = out / (item["scene"] + ".pstats")
                C.need(not stats_path.exists(), "profile file already exists")
                profiler.dump_stats(str(stats_path))
                charged += stats_path.stat().st_size
                put(item["scene"] + ".functions.json", C.encoded({"timing": timing, "functions": rows, "phaseRoots": phases(rows),
                    "returned": result is not None, "inclusiveTimesOverlap": True, "profileOverheadPresent": True}))
            raw = C.encoded(result)
            put(item["scene"] + ".stdout.raw", raw)
            first = C.difference(item["expected"], result)
            exact_bytes = raw == item["expectedBytes"]
            record = {**current, "timing": timing, "phaseRoots": phases(rows), "replyBytes": len(raw), "replySha256": sha(raw),
                      "fullParsedNumberBitsEqual": first is None, "fullRawBytesEqual": exact_bytes, "firstDifference": first,
                      "independentReferenceCounterTrees": C.counter_trees(result), "profileOverheadPresent": True}
            summary["profiledCalls"].append(record)
            put(item["scene"] + ".comparison.json", C.encoded(record)); progress()
            C.need(first is None and exact_bytes, "first current raw uncached reply mismatch")
            C.need(all(len(value) == 1 for value in phases(rows).values()), "profile phase root is missing or ambiguous")
            counts["strictRawReplyMatched"] += 1
        C.need(counts == {"evaluateAttempted": 2, "evaluateReturned": 2, "strictRawReplyMatched": 2}, "incomplete two-call profile")
        for relative, wanted in authority["providerPins"].items():
            C.need(sha(C.read_bound(C.safe_path(relative), 2 * C.MIB)) == wanted, "reference provider changed while profiling")
        checked(source / "summary.json", 59236, SOURCE_SUMMARY_SHA)
        C.need(sha(C.read_bound(Path(__file__), C.MIB)) == own_sha, "position profile harness changed")
        summary["status"] = "PASS_POSITION_REFERENCE_PROFILE"
        summary["studyActualReferenceEvaluations"] = 26
    except BaseException as error:
        summary["status"] = "FAIL"
        summary["firstFailure"] = {"type": type(error).__name__, "message": str(error), "reached": copy.deepcopy(current), "counts": dict(counts)}
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0); signal.signal(signal.SIGALRM, previous)
        summary["elapsedWallNs"] = time.monotonic_ns() - started; summary["chargedArtifactBytes"] = charged
        summary["timingBoundary"] = "cProfile changes timing overhead; phase attribution for two selected saved inputs, not a six-frame speed benchmark."
        progress(); put("summary.json", C.encoded(summary))
    return 0 if summary["status"] == "PASS_POSITION_REFERENCE_PROFILE" else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--source", type=Path, default=HERE / "evidence/observable-census-01")
    args = parser.parse_args()
    sys.exit(run(args.run_id, args.source))
