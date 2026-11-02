#!/usr/bin/env python3
"""Six CURRENT raw reference replies; exact memo equality and paired cost are separate."""
import argparse
import copy
from decimal import getcontext
import hashlib
import importlib.util
from pathlib import Path
import platform
import re
import signal
import sys
import time

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OLD_HELPER_SHA = "67c23875efa2836cd2c374794dfb6b942366493e8fbf979ffcd8789ac2c8464f"
OLD_SUMMARY_SHA = "bf65e7fadf3b87f6f80cfac4f1f05bd5fb9f4462fcf0947aaa3a19125bf44357"
OBSERVABLE_SHA = "be2317e3160da6ac961b7e4ec7e0bbddd20133947bc536c3de955691d9df80cb"
PROFILE_SHA = "0605970212d39cfc1a6a245cdf5e48b38474e533a57f334902d32d461bfc9a54"
RECIPE_SHA = "ad6ee93d263ea5cb5ffc0c96011f7808826b564fb589879e96c271de887ff0cb"
FREEZE_SHA = "5ce630e842017debb8129f90a047867f3da7e011461b0d1b9a3b595e980ee42f"
SAT_PATH = "examples/physics-rigid-feature-penetration-diagnostic/geometry-reference.py"
BOUNDS = {"max_entries": 8192, "max_key_bytes": 16384, "max_encoded_bytes": 16777216,
          "max_owned_bytes": 67108864, "max_logical_calls": 8640}
STATS = {"calls", "eligible", "hits", "misses", "type_bypasses", "context_bypasses", "capacity_bypasses",
         "original_attempts", "original_returns", "original_raises", "entries", "encoded_key_bytes",
         "owned_bytes", "peak_owned_bytes", "key_build_cpu_ns", "key_build_wall_ns"}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


if sha((HERE / "cost-census.py").read_bytes()) != OLD_HELPER_SHA:
    raise RuntimeError("unchanged DATA helper source differs")
C = load(HERE / "cost-census.py", "unchanged_radius_gate_data")


def checked(path, count, digest, maximum=C.MAX_IPC):
    data = C.read_bound(path, maximum)
    C.need(len(data) == count and sha(data) == digest, "support-radius gate input byte/hash mismatch: " + str(path))
    return data


def flags():
    return {signal.__name__: bool(value) for signal, value in getcontext().flags.items()}


def controls_authority(path, digest, authority):
    freeze = C.strict_json(checked(HERE / "cache-implementation-freeze-01.json", 1729, FREEZE_SHA))
    C.need(freeze["status"] == "parent_scope_frozen_before_core_implementation" and
           freeze["approvedBounds"] == BOUNDS, "parent implementation freeze differs")
    for name, wanted in freeze["inputs"].items():
        C.need(name in ("CACHE-CONTRACT.md", "CACHE-CONTROLS.json") and
               sha(C.read_bound(HERE / name, C.MIB)) == wanted, "frozen cache contract/recipe changed")
    data = C.read_bound(path, 8 * C.MIB)
    C.need(re.fullmatch("[0-9a-f]{64}", digest) and sha(data) == digest, "primitive receipt differs from parent freeze")
    result = C.strict_json(data)
    C.need(result["status"] == "PASS_SUPPORT_RADIUS_PRIMITIVES" and result["groupsCompleted"] == 12 and
           result["firstFailure"] is None and len(result["groups"]) == 12, "all primitive groups must PASS before full reference calls")
    counts = result["counts"]
    C.need(C.difference(freeze["approvedPrimitiveLedger"], counts) is None, "frozen primitive actual population differs")
    C.need(0 <= counts["wrapperCalls"] <= 48 and 0 <= counts["totalOriginalAttempts"] <= 72 and
           counts["totalOriginalAttempts"] == counts["directOriginalAttempts"] + counts["delegatedOriginalAttempts"],
           "primitive actual helper count boundary differs")
    C.need(C.difference(BOUNDS, result["bounds"]) is None, "primitive cache bounds differ")
    expected = {"cacheModule": HERE / "support-radius-cache.py", "controlsModule": HERE / "support-radius-controls.py",
                "recipes": HERE / "CACHE-CONTROLS.json", "originalHelper": C.safe_path(SAT_PATH)}
    for name, target in expected.items():
        pin = result["sources"][name]
        actual = C.safe_path(pin["path"])
        C.need(actual == target.resolve(), "primitive provider path differs: " + name)
        checked(actual, pin["bytes"], pin["sha256"])
    C.need(result["sources"]["recipes"]["sha256"] == RECIPE_SHA and
           result["sources"]["originalHelper"]["sha256"] == authority["providerPins"][SAT_PATH], "recipe/original helper identity differs")
    return result


def inputs():
    authority, frames = C.authenticate_inputs()
    old_dir = HERE / "evidence/cost-census-01"; observed_dir = HERE / "evidence/observable-census-01"
    old = C.strict_json(checked(old_dir / "summary.json", 8319, OLD_SUMMARY_SHA))
    observed = C.strict_json(checked(observed_dir / "summary.json", 59236, OBSERVABLE_SHA))
    profile = C.strict_json(checked(HERE / "evidence/position-profile-01/summary.json", 9652, PROFILE_SHA))
    C.need(old["status"] == "FAIL" and old["firstFailure"]["classification"] == "ARCHIVED_REPLY_ZERO_SIGN_UNOBSERVED",
           "original raw-census failure changed")
    C.need(observed["status"] == "PASS_OBSERVABLE_ARCHIVE_CENSUS" and observed["counts"]["observableArchiveMatched"] == 24,
           "observable census did not qualify")
    C.need(profile["status"] == "PASS_POSITION_REFERENCE_PROFILE" and profile["counts"] == {
        "evaluateAttempted": 2, "evaluateReturned": 2, "strictRawReplyMatched": 2}, "position profile did not qualify")
    C.need(C.difference(authority["providerPins"], observed["authentication"]["providerPins"]) is None,
           "original reference provider differs from current raw authority")
    cases = []
    for frame in frames:
        directory, summary = (old_dir, old) if frame["scene"] == "ALIGNED" and frame["step"] == 1 else (observed_dir, observed)
        record = next((row for row in summary["requests"] if row["scene"] == frame["scene"] and
                       row["step"] == frame["step"] and row["operation"] == "position-world"), None)
        C.need(record and record["timing"]["computeCpuNs"] > 0, "paired uncached CPU/actual request is absent")
        payload = {}
        for kind in ("request", "reply"):
            pin = record["locators"][kind]
            C.need(Path(pin["path"]).name == pin["path"], "unsafe captured payload path")
            payload[kind] = checked(directory / pin["path"], pin["bytes"], pin["sha256"])
        request, expected = C.strict_json(payload["request"]), C.strict_json(payload["reply"])
        C.need(request["op"] == "world" and request["scene"] == frame["scene"] and request["stepIndex"] == frame["step"] and
               request["preRawHex"] == frame["frames"]["velocity-ready/velocityBodies"]["hex"] and
               request["hypRawHex"] == frame["frames"]["after"]["hex"], "captured request/raw frame differs")
        C.need(expected["ok"] is True and expected["resolved"] is True and expected["executionFailure"] is False and
               expected["referenceStatus"] == "SOLVED" and not expected["violations"], "current uncached reply did not qualify")
        cases.append({"scene": frame["scene"], "step": frame["step"], "request": request,
                      "expected": expected, "rawExpected": payload["reply"], "record": record,
                      "recordLocator": frame["recordLocator"], "sourceDirectory": str(directory)})
    C.need(len(cases) == 6, "six selected position inputs required")
    return authority, cases


def validate_stats(stats):
    C.need(STATS <= stats.keys(), "required actual cache statistics missing")
    C.need(all(type(stats[key]) is int and stats[key] >= 0 for key in STATS), "invalid cache counter")
    C.need(stats["calls"] <= BOUNDS["max_logical_calls"] and stats["entries"] <= BOUNDS["max_entries"] and
           stats["encoded_key_bytes"] <= BOUNDS["max_encoded_bytes"] and stats["owned_bytes"] <= BOUNDS["max_owned_bytes"] and
           stats["peak_owned_bytes"] <= BOUNDS["max_owned_bytes"], "cache accounting bound exceeded")
    C.need(stats["original_attempts"] == stats["original_returns"] + stats["original_raises"] and
           stats["calls"] == stats["hits"] + stats["original_attempts"], "actual cache arithmetic-call ledger differs")


def run(run_id, controls, controls_sha):
    C.need(re.fullmatch("[a-z0-9][a-z0-9-]{0,95}", run_id), "invalid fresh cache gate ID")
    out = HERE / "evidence" / run_id; out.mkdir(parents=True, exist_ok=False)
    started = time.monotonic_ns(); used = 0; current = None; sat = original = None
    counts = {"evaluateAttempted": 0, "evaluateReturned": 0, "currentRawMatched": 0}
    summary = {"workId": "physics-world-p4-support-radius-cache-2276", "runId": run_id,
               "status": "IN_PROGRESS", "numericStatus": "NOT_RUN", "costStatus": "NOT_RUN", "counts": counts,
               "priorStudyReferenceEvaluations": 26, "WorldCalls": 0, "productionSolverCalls": 0, "fixtureCalls": 0,
               "trigCalls": 0, "NodeProjectionCalls": 0, "cases": [], "firstFailure": None,
               "oldRawCensusStatus": "FAIL_PRESERVED", "historicalPreArchiveReplyZeroSigns": "UNKNOWN"}
    def put(name, data):
        nonlocal used
        C.need(used + len(data) <= 32 * C.MIB, "32MiB cache gate evidence exhausted")
        with (out / name).open("xb") as stream:
            stream.write(data)
        used += len(data)
    def progress():
        (out / "progress.json").write_bytes(C.encoded(summary))
    def timeout(_signum, _frame):
        raise C.CensusFailure("170s support-radius gate internal deadline")
    old_handler = signal.signal(signal.SIGALRM, timeout); signal.setitimer(signal.ITIMER_REAL, 170)
    try:
        authority, cases = inputs()
        primitive = controls_authority(controls.resolve(), controls_sha, authority)
        summary["authority"] = authority; summary["bounds"] = BOUNDS
        summary["primitiveGate"] = {"path": str(controls.resolve()), "sha256": controls_sha,
                                    "counts": primitive["counts"], "sources": primitive["sources"]}
        own_sha = sha(C.read_bound(Path(__file__), C.MIB)); summary["harnessSha256"] = own_sha
        executable = Path(sys.executable).resolve()
        summary["python"] = {"executable": str(executable), "version": sys.version, "platform": platform.platform(),
                             "executableSha256": sha(C.read_bound(executable, 256 * C.MIB))}
        progress()
        cache_module = load(HERE / "support-radius-cache.py", "qualified_reference_support_cache")
        position = load(C.safe_path(C.REFERENCE_PATHS[3]), "unchanged_cached_position_reference")
        sat = position.PARENT.PARENT.SAT
        C.need(Path(sat.__file__).resolve() == C.safe_path(SAT_PATH), "wrong SAT module instance")
        original = sat.support_radius
        C.need(Path(original.__code__.co_filename).resolve() == C.safe_path(SAT_PATH), "wrong original support function")
        for case in cases:
            current = {"scene": case["scene"], "step": case["step"], "sourceDirectory": case["sourceDirectory"],
                       "sourceLocators": case["record"]["locators"], "recordLocator": case["recordLocator"]}
            name = case["scene"] + "-" + str(case["step"])
            before_request = C.encoded(case["request"])
            record = {**current, "uncachedCpuNs": case["record"]["timing"]["computeCpuNs"],
                      "uncachedWallNs": case["record"]["timing"]["computeWallNs"], "cachedContextBefore": flags(),
                      "cacheStats": None, "timing": {}, "returned": False}
            summary["cases"].append(record); progress()
            memo = None; returned = None; compute_cpu = compute_wall = None; primary_error = None
            cleanup_errors = []
            prep_wall, prep_cpu = time.monotonic_ns(), time.process_time_ns()
            try:
                memo = cache_module.SupportRadiusCache(original, dict(BOUNDS)); memo.clear()
                sat.support_radius = memo.call
                record["timing"].update(preparationCpuNs=time.process_time_ns() - prep_cpu,
                                       preparationWallNs=time.monotonic_ns() - prep_wall)
                counts["evaluateAttempted"] += 1; progress()
                wall, cpu = time.monotonic_ns(), time.process_time_ns()
                try:
                    returned = position.evaluate(case["request"])
                finally:
                    compute_cpu, compute_wall = time.process_time_ns() - cpu, time.monotonic_ns() - wall
                    record["timing"].update(evaluateCpuNs=compute_cpu, evaluateWallNs=compute_wall)
                counts["evaluateReturned"] += 1; record["returned"] = True
                raw = C.encoded(returned)
                put(name + ".stdout.raw", raw)
            except BaseException as error:
                primary_error = error
            finally:
                finish_wall, finish_cpu = time.monotonic_ns(), time.process_time_ns()
                sat.support_radius = original
                if memo is not None:
                    try:
                        record["cacheStats"] = memo.stats()
                    except BaseException as error:
                        cleanup_errors.append({"phase": "stats", "type": type(error).__name__, "message": str(error)})
                    try:
                        memo.clear()
                        record["afterClearStats"] = memo.stats()
                    except BaseException as error:
                        cleanup_errors.append({"phase": "clear/stats", "type": type(error).__name__, "message": str(error)})
                record["timing"].update(finishCpuNs=time.process_time_ns() - finish_cpu,
                                       finishWallNs=time.monotonic_ns() - finish_wall)
                record["cachedContextAfter"] = flags()
                record["cleanupErrors"] = cleanup_errors
                record["originalEvaluationException"] = None if primary_error is None else {
                    "type": type(primary_error).__name__, "message": str(primary_error)}
                put(name + ".cache-prefix.json", C.encoded(record)); progress()
            if primary_error is not None:
                raise primary_error
            C.need(not cleanup_errors, "cache accounting/clear failed after original support restoration")
            validate_stats(record["cacheStats"])
            C.need(record["afterClearStats"]["entries"] == 0 and record["afterClearStats"]["calls"] == 0 and
                   record["afterClearStats"]["encoded_key_bytes"] == 0, "request cache was not cleared")
            C.need(sat.support_radius is original, "original support function was not restored")
            request_diff = C.difference(C.strict_json(before_request), case["request"])
            response_diff = C.difference(case["expected"], returned)
            record.update(inputUnchanged=request_diff is None, firstInputDifference=request_diff,
                          currentRawBytesEqual=raw == case["rawExpected"], fullNumberBitsEqual=response_diff is None,
                          firstResponseDifference=response_diff, rawReplySha256=sha(raw),
                          independentReferenceCounterTrees=C.counter_trees(returned))
            timing = record["timing"]
            timing["pairedCachedCpuNs"] = timing["preparationCpuNs"] + timing["evaluateCpuNs"] + timing["finishCpuNs"]
            timing["pairedCachedWallNs"] = timing["preparationWallNs"] + timing["evaluateWallNs"] + timing["finishWallNs"]
            record["observedCpuDeltaNs"] = timing["pairedCachedCpuNs"] - record["uncachedCpuNs"]
            put(name + ".comparison.json", C.encoded(record)); progress()
            C.need(request_diff is None and response_diff is None and record["currentRawBytesEqual"], "first caller/current raw response mismatch")
            counts["currentRawMatched"] += 1
        C.need(counts == {"evaluateAttempted": 6, "evaluateReturned": 6, "currentRawMatched": 6}, "incomplete six-reference gate")
        for relative, wanted in authority["providerPins"].items():
            C.need(sha(C.read_bound(C.safe_path(relative), 2 * C.MIB)) == wanted, "original reference provider changed")
        controls_authority(controls.resolve(), controls_sha, authority)
        C.need(sha(C.read_bound(Path(__file__), C.MIB)) == own_sha, "gate source changed")
        baseline = sum(record["uncachedCpuNs"] for record in summary["cases"])
        cached = sum(record["timing"]["pairedCachedCpuNs"] for record in summary["cases"])
        summary["pairedCpu"] = {"uncachedTotalNs": baseline, "cachedTotalNs": cached, "deltaNs": cached - baseline,
                                "observedReductionFraction": 1 - cached / baseline,
                                "singlePriorFreshPairing": True, "perFrameNonRegressionClaimed": False}
        summary["numericStatus"] = "NUMERIC_EQ_PASS"
        summary["costStatus"] = "COST_GO" if cached < baseline else "COST_NO_GO"
        summary["status"] = "PASS_SUPPORT_RADIUS_GATE" if cached < baseline else "NUMERIC_EQ_PASS_COST_NO_GO"
        summary["studyActualReferenceEvaluations"] = 32
    except BaseException as error:
        summary["status"] = "FAIL"; summary["numericStatus"] = "NUMERIC_EQ_INCOMPLETE_OR_FAIL"
        summary["firstFailure"] = {"type": type(error).__name__, "message": str(error), "reached": copy.deepcopy(current), "counts": dict(counts)}
    finally:
        if sat is not None and original is not None:
            sat.support_radius = original
        signal.setitimer(signal.ITIMER_REAL, 0); signal.signal(signal.SIGALRM, old_handler)
        summary["studyActualReferenceEvaluations"] = 26 + counts["evaluateAttempted"]
        summary["elapsedWallNs"] = time.monotonic_ns() - started; summary["chargedArtifactBytes"] = used
        summary["fullRequestUncachedContextFlagsCaptured"] = False
        summary["contextProof"] = "Frozen primitive controls plus exact incoming-key/post-flag replay; no invented historical full-request flag observation."
        progress(); put("summary.json", C.encoded(summary))
    return 0 if summary["status"] in ("PASS_SUPPORT_RADIUS_GATE", "NUMERIC_EQ_PASS_COST_NO_GO") else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--controls", type=Path, required=True)
    parser.add_argument("--controls-sha256", required=True)
    args = parser.parse_args()
    sys.exit(run(args.run_id, args.controls, args.controls_sha256))
