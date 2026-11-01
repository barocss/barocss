#!/usr/bin/env python3
"""Separate observable-JSON census; reuse two captured calls, run at most22 new ones."""
import argparse
import copy
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OLD_CENSUS_SHA = "67c23875efa2836cd2c374794dfb6b942366493e8fbf979ffcd8789ac2c8464f"
OLD_SUMMARY_SHA = "bf65e7fadf3b87f6f80cfac4f1f05bd5fb9f4462fcf0947aaa3a19125bf44357"
AUDIT_SHA = "9210f1417bf64077cb113ed498b8194aa20efe19abaf72a5d13e3ba04a9b8164"
AUDIT_SOURCE_SHA = "8577371ad7a562cd2e9d0a505d8300b4fdc54168ee53d38460a29f4f7eda8b5f"
FIXTURE_CAPTURE_SHA = "5d7ee93405f98a2b8a98138b8d8df1ac2b00990d2309dfa23f2f1353dcd65bdf"
NODE_PROJECTION = """const fs=require('node:fs');
const fresh=JSON.parse(fs.readFileSync(0,'utf8'));
const observable=JSON.parse(JSON.stringify(fresh));
process.stdout.write(JSON.stringify(observable)+'\\n');
"""


def load_original():
    import hashlib
    path = HERE / "cost-census.py"
    if hashlib.sha256(path.read_bytes()).hexdigest() != OLD_CENSUS_SHA:
        raise RuntimeError("original census helper bytes changed")
    spec = importlib.util.spec_from_file_location("unchanged_census_definitions", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


C = load_original()


def checked(path, count, digest, maximum=C.MAX_IPC):
    data = C.read_bound(path, maximum)
    C.need(len(data) == count and C.sha(data) == digest, "observable input byte/hash mismatch: " + str(path))
    return data


def all_differences(expected, actual):
    differences, nodes = [], 0
    def visit(left, right, path):
        nonlocal nodes
        nodes += 1
        C.need(nodes <= 1000000, "reply node bound exceeded")
        if type(left) in (int, float) or type(right) in (int, float):
            found = C.difference(left, right, path)
            if found:
                found["classification"] = "ZERO_SIGN_ONLY" if type(left) in (int, float) and type(right) in (int, float) and left == 0 and right == 0 else "NONZERO_NUMBER_OR_TYPE"
                differences.append(found)
        elif type(left) is not type(right):
            differences.append({"path": path, "classification": "VALUE_TYPE", "expectedType": type(left).__name__, "actualType": type(right).__name__})
        elif type(left) is dict:
            for key in left:
                at = path + "/" + key.replace("~", "~0").replace("/", "~1")
                if key not in right:
                    differences.append({"path": at, "classification": "MISSING_KEY"})
                else:
                    visit(left[key], right[key], at)
            for key in right.keys() - left.keys():
                differences.append({"path": path + "/" + key, "classification": "EXTRA_KEY"})
        elif type(left) is list:
            if len(left) != len(right):
                differences.append({"path": path, "classification": "ARRAY_LENGTH", "expected": len(left), "actual": len(right)})
            for index, (a, b) in enumerate(zip(left, right)):
                visit(a, b, path + "/" + str(index))
        elif left != right:
            differences.append({"path": path, "classification": "NONNUMERIC_VALUE", "expected": left, "actual": right})
        C.need(len(differences) <= 4096, "reply difference storage bound exceeded")
    visit(expected, actual, "")
    return {"nodesVisited": nodes, "totalDifferences": len(differences),
            "zeroSignOnlyCount": sum(item["classification"] == "ZERO_SIGN_ONLY" for item in differences),
            "nonZeroSignDifferenceCount": sum(item["classification"] != "ZERO_SIGN_ONLY" for item in differences),
            "differences": differences}


def validate_prefix(prior_path, audit_path, authentication, first_frame):
    prior = C.strict_json(checked(prior_path / "summary.json", 8319, OLD_SUMMARY_SHA))
    audit_bytes = checked(audit_path, 10671, AUDIT_SHA)
    audit = C.strict_json(audit_bytes)
    C.need(prior["status"] == "FAIL" and prior["firstFailure"]["classification"] == "ARCHIVED_REPLY_ZERO_SIGN_UNOBSERVED" and
           prior["counts"] == {"framesCompleted": 0, "referenceIpcAttempted": 2, "referenceRepliesCompleted": 2, "fullReplyEqual": 1},
           "original raw-reply census failure/count changed")
    C.need(audit["status"] == "PASS_DATA_OBSERVATION_CLASSIFICATION" and all(value == 0 for value in audit["calls"].values()) and
           audit["preservedCensusStatus"] == "FAIL" and audit["historicalPreArchiveReplyZeroSigns"] == "UNKNOWN" and
           audit["auditSourceSha256"] == AUDIT_SOURCE_SHA, "DATA audit did not qualify both captured replies")
    C.need(C.sha(C.read_bound(HERE / "reply-observation-audit.mjs", C.MIB)) == AUDIT_SOURCE_SHA, "DATA audit provider changed")
    C.need(C.difference(prior["authentication"]["providerPins"], authentication["providerPins"]) is None, "original reference providers differ")
    fixture_bytes = C.read_bound(prior_path / "fixture-data.stdout", 65536)
    C.need(C.sha(fixture_bytes) == FIXTURE_CAPTURE_SHA, "captured original fixture DTOs changed")
    fixture_data = C.strict_json(fixture_bytes)
    C.need(fixture_data["node"] == prior["fixtureSetup"]["node"] == authentication["sourceNode"] and
           fixture_data["fixtureFunctionCalls"] == 3 and fixture_data["sinCalls"] == fixture_data["cosCalls"] == 8,
           "captured fixture population differs")
    C.need([item["operation"] for item in audit["prefixReplies"]] == ["contacts", "position-world"], "wrong two-call reused prefix")
    replies, pins = [], {}
    originals = {"contacts": first_frame["row"]["contactGeometry"], "position-world": first_frame["row"]["positionCheck"]}
    request_recipes = C.requests_for(first_frame, fixture_data["fixtures"]["ALIGNED"])
    for index, item in enumerate(audit["prefixReplies"]):
        C.need(C.difference(item["recordLocator"], first_frame["recordLocator"]) is None, "reused original row locator changed")
        for kind in ("request", "reply"):
            pin = item[kind]
            data = checked(C.safe_path(pin["repoPath"]), pin["bytes"], pin["sha256"])
            pins[pin["repoPath"]] = {"bytes": len(data), "sha256": C.sha(data)}
            if kind == "reply":
                raw_reply = data
            else:
                C.need(C.difference(C.strict_json(data), request_recipes[index][2]) is None, "reused request recipe differs")
        artifact = item["observableArtifact"]
        relative = artifact["auditRelativePath"]
        C.need(type(relative) is str and not Path(relative).is_absolute() and ".." not in Path(relative).parts, "unsafe audit artifact path")
        projected_path = (audit_path.parent / relative).resolve()
        C.need(projected_path.is_relative_to(audit_path.parent.resolve()), "audit artifact escaped its folder")
        observable_bytes = checked(projected_path, artifact["bytes"], artifact["sha256"])
        raw_diff = all_differences(originals[item["operation"]], C.strict_json(raw_reply))
        C.need(raw_diff["nonZeroSignDifferenceCount"] == 0 and raw_diff["totalDifferences"] == item["strictComparison"]["totalDifferences"], "captured prefix has an unqualified raw difference")
        C.need(C.difference(originals[item["operation"]], C.strict_json(observable_bytes)) is None and
               item["observableComparison"]["status"] == "PASS" and item["observableComparison"]["totalDifferences"] == 0,
               "captured observable prefix no longer matches its archive")
        replies.append({"source": "REUSED_ACTUAL_COST_CENSUS_01", "operation": item["operation"],
                        "rawReply": item["reply"], "observableArtifact": artifact, "strictRawComparison": raw_diff,
                        "timing": prior["requests"][index]["timing"], "observableArchiveEqual": True})
    return prior, audit, fixture_data, replies, pins


def project_node(node, raw_reply, name, out, put, counters):
    counters["dataProjectionAttempted"] += 1
    started = time.monotonic_ns()
    try:
        result = subprocess.run([str(node), "-e", NODE_PROJECTION], input=raw_reply, capture_output=True, timeout=10, check=False)
    except subprocess.TimeoutExpired as error:
        put(name + ".node-observable.stdout.raw", error.stdout or b"")
        put(name + ".node-observable.stderr.raw", error.stderr or b"")
        raise C.CensusFailure("10s Node DATA observation deadline") from error
    put(name + ".node-observable.stdout.raw", result.stdout)
    put(name + ".node-observable.stderr.raw", result.stderr)
    C.need(len(result.stdout) <= C.MAX_IPC and len(result.stderr) <= 128 * 1024 and result.returncode == 0 and not result.stderr,
           "Node DATA observation failed/resource bound")
    observable = C.strict_json(result.stdout)
    counters["dataProjectionCompleted"] += 1
    return observable, {"processWallNs": time.monotonic_ns() - started, "exit": result.returncode,
                        "projectionProgramSha256": C.sha(NODE_PROJECTION.encode()),
                        "artifact": {"path": name + ".node-observable.stdout.raw", "bytes": len(result.stdout), "sha256": C.sha(result.stdout)},
                        "WorldCalls": 0, "referenceCalls": 0, "fixtureCalls": 0, "trigCalls": 0}


def close_children(children, failed, put):
    started = time.monotonic(); records, errors = [], []
    terminated, killed = set(), set()
    def send(child, action):
        try:
            getattr(child.process, action)()
        except ProcessLookupError:
            pass
    if failed:
        for kind, child in children.items():
            if child.process.poll() is None:
                send(child, "terminate"); terminated.add(kind)
    for kind, child in children.items():
        try:
            pipe = child.process.stdin; os.close(pipe.fileno())
            try:
                pipe.close()
            except OSError:
                pass
            child.process.stdin = None
        except BaseException as error:
            errors.append({"kind": kind, "type": type(error).__name__, "message": str(error)})
    while time.monotonic() - started < 4:
        for kind, child in children.items():
            try:
                child.drain_close()
            except BaseException as error:
                errors.append({"kind": kind, "type": type(error).__name__, "message": str(error)})
            if child.process.poll() is None:
                elapsed = time.monotonic() - started
                if elapsed >= 1 and kind not in terminated:
                    send(child, "terminate"); terminated.add(kind)
                if elapsed >= 2 and kind not in killed:
                    send(child, "kill"); killed.add(kind)
        if all(child.process.poll() is not None and child.stdout_eof and child.stderr_eof for child in children.values()):
            break
        time.sleep(.005)
    for kind, child in children.items():
        put(kind + ".stderr.raw", bytes(child.stderr)); put(kind + ".trailing.stdout.raw", bytes(child.trailing))
        complete = child.process.poll() is not None and child.stdout_eof and child.stderr_eof
        timing_bytes = child.timing_path.read_bytes() if child.timing_path.exists() else b""
        lines = timing_bytes.splitlines(keepends=True)
        timing = [C.strict_json(line) for line in lines if line.endswith(b"\n")]
        counts = {"attempted": sum(item.get("type") == "start" for item in timing),
                  "completed": sum(item.get("type") == "call" for item in timing),
                  "returned": sum(item.get("type") == "call" and item.get("outcome") == "returned" for item in timing)}
        records.append({"kind": kind, "exit": child.process.poll(), "completeEOF": complete,
                        "terminateAttempted": kind in terminated, "killAttempted": kind in killed,
                        "stderrBytes": len(child.stderr), "trailingStdoutBytes": len(child.trailing), "counts": counts,
                        "timingSha256": C.sha(timing_bytes), "lastTransport": child.last_transport})
        if not complete or child.stderr or child.trailing or (not failed and (terminated or killed or child.process.poll() != 0)):
            errors.append({"kind": kind, "message": "reference clean-exit/EOF gate failed"})
    return records, errors


def run(run_id, node, prior_path, audit_path):
    C.need(re.fullmatch("[a-z0-9][a-z0-9-]{0,95}", run_id), "invalid fresh observable census ID")
    out = HERE / "evidence" / run_id; out.mkdir(parents=True, exist_ok=False)
    started = time.monotonic_ns(); used = 0; children = {}; current = None
    counters = {"framesCompleted": 0, "reusedValidated": 0, "freshReferenceIpcAttempted": 0,
                "freshReferenceRepliesCompleted": 0, "observableArchiveMatched": 0,
                "dataProjectionAttempted": 0, "dataProjectionCompleted": 0}
    summary = {"workId": "physics-world-p4-observable-cost-2276", "runId": run_id, "status": "IN_PROGRESS",
               "preservedOriginalCensusStatus": "FAIL", "historicalPreArchiveReplyZeroSigns": "UNKNOWN",
               "historicalRawReplyEquivalence": "NOT_ESTABLISHED", "worldCalls": 0, "productionCalls": 0,
               "productionSolverCalls": 0, "newFixtureCalls": 0, "newFixtureTrigCalls": 0,
               "counts": counters, "requests": [], "firstFailure": None}
    def put(name, data):
        nonlocal used
        C.need(used + len(data) <= C.MAX_MAIN, "128MiB observable evidence exhausted")
        with (out / name).open("xb") as stream:
            stream.write(data)
        used += len(data)
    def progress():
        (out / "progress.json").write_bytes(C.encoded(summary))
    def timeout(_signal, _frame):
        raise C.CensusFailure("170s observable census internal deadline")
    old_handler = signal.signal(signal.SIGALRM, timeout); signal.setitimer(signal.ITIMER_REAL, 170)
    try:
        authentication, frames = C.authenticate_inputs()
        prior_path, audit_path = prior_path.resolve(), audit_path.resolve()
        C.need(prior_path == HERE / "evidence/cost-census-01" and audit_path.is_relative_to(HERE / "evidence"), "wrong prior/audit scope")
        prior, audit, fixtures, reused, prior_pins = validate_prefix(prior_path, audit_path, authentication, frames[0])
        counters["reusedValidated"] = counters["observableArchiveMatched"] = 2
        summary["authentication"] = authentication
        summary["audit"] = {"path": str(audit_path), "bytes": 10671, "sha256": AUDIT_SHA, "status": audit["status"],
                            "priorAuditDATAProcesses": 1, "priorAuditReferenceCalls": 0}
        summary["priorActualReferenceCalls"] = 2; summary["reusedReplies"] = reused
        summary["priorSessionElapsedWallNs"] = prior["elapsedWallNs"]
        own_sha = C.sha(C.read_bound(Path(__file__), C.MIB)); summary["harnessSha256"] = own_sha
        node = node.resolve(); node_bytes = C.read_bound(node, 256 * C.MIB)
        C.need(len(node_bytes) == prior["node"]["bytes"] and C.sha(node_bytes) == prior["node"]["sha256"], "installed observation Node differs from captured runtime")
        summary["node"] = {"path": str(node), "bytes": len(node_bytes), "sha256": C.sha(node_bytes)}
        spec = {"harnessSha256": OLD_CENSUS_SHA, "providerPins": authentication["providerPins"]}
        put("reference-spec.json", C.encoded(spec)); progress()
        for kind in ("geometry", "position"):
            children[kind] = C.Child(kind, out, out / "reference-spec.json", put); children[kind].wait_ready()
        summary["referenceStartup"] = {kind: child.ready for kind, child in children.items()}
        ordinal = 0
        for frame in frames:
            current = {"scene": frame["scene"], "step": frame["step"], "recordLocator": frame["recordLocator"]}
            put(frame["scene"] + "-" + str(frame["step"]) + ".authentication.json", C.encoded({**current, "rawFrames": frame["frames"],
                "pointOperandF64leHex": frame["row"]["pointOperandF64leHex"]}))
            for label, kind, request, expected in C.requests_for(frame, fixtures["fixtures"][frame["scene"]]):
                ordinal += 1
                if ordinal <= 2:
                    C.need(frame["scene"] == "ALIGNED" and frame["step"] == 1 and label == reused[ordinal - 1]["operation"], "wrong reused composite prefix")
                    continue
                current["operation"] = label; current["compositeOrdinal"] = ordinal
                C.need(counters["freshReferenceIpcAttempted"] < 22, "remaining reference request population exhausted")
                counters["freshReferenceIpcAttempted"] += 1; progress()
                name = frame["scene"] + "-" + str(frame["step"]) + "-" + label
                reply, timing, locators = children[kind].ask(request, name)
                counters["freshReferenceRepliesCompleted"] += 1
                raw_diff = all_differences(expected, reply)
                record = {**current, "source": "NEW_ACTUAL_REFERENCE", "timing": timing, "locators": locators,
                          "strictRawComparison": raw_diff, "independentReferenceCounterTrees": C.counter_trees(reply),
                          "historicalPreArchiveReplyZeroSigns": "UNKNOWN"}
                summary["requests"].append(record)
                put(name + ".raw-comparison.json", C.encoded(record)); progress()
                C.need(raw_diff["nonZeroSignDifferenceCount"] == 0, "first nonzero/type/key/string/classification reply mismatch")
                raw_reply = C.read_bound(out / locators["reply"]["path"], C.MAX_IPC)
                observable, projection = project_node(node, raw_reply, name, out, put, counters)
                mismatch = C.difference(expected, observable)
                record.update(observationProjection=projection, observableArchiveEqual=mismatch is None, firstObservableDifference=mismatch)
                put(name + ".observable-comparison.json", C.encoded(record)); progress()
                C.need(mismatch is None, "first observable archive reply mismatch")
                counters["observableArchiveMatched"] += 1
            counters["framesCompleted"] += 1; progress()
        C.need(counters == {"framesCompleted": 6, "reusedValidated": 2, "freshReferenceIpcAttempted": 22,
                "freshReferenceRepliesCompleted": 22, "observableArchiveMatched": 24,
                "dataProjectionAttempted": 22, "dataProjectionCompleted": 22}, "incomplete observable census prefix")
        for relative, wanted in authentication["providerPins"].items():
            C.need(C.sha(C.read_bound(C.safe_path(relative), 2 * C.MIB)) == wanted, "reference provider changed during observable census")
        for relative, pin in prior_pins.items():
            checked(C.safe_path(relative), pin["bytes"], pin["sha256"])
        checked(prior_path / "summary.json", 8319, OLD_SUMMARY_SHA); checked(audit_path, 10671, AUDIT_SHA)
        C.need(C.sha(C.read_bound(Path(__file__), C.MIB)) == own_sha, "observable harness source changed")
        summary["status"] = "PASS_OBSERVABLE_ARCHIVE_CENSUS"
        summary["actualUniqueReferenceRequestsAcrossSessions"] = 24
    except BaseException as error:
        summary["status"] = "FAIL"
        summary["firstFailure"] = {"type": type(error).__name__, "message": str(error), "reached": copy.deepcopy(current),
                                   "counts": dict(counters), "physicalTrajectoryVerdictChanged": False}
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        cleanup_start = time.monotonic_ns()
        try:
            summary["cleanup"], errors = close_children(children, summary["status"] == "FAIL", put)
            if errors:
                summary["cleanupErrors"] = errors; summary["status"] = "FAIL"
                if summary["firstFailure"] is None:
                    summary["firstFailure"] = {"message": "observable census cleanup failed", "reached": copy.deepcopy(current)}
        except BaseException as error:
            summary["status"] = "FAIL"; summary["cleanupException"] = {"type": type(error).__name__, "message": str(error)}
        summary["cleanupWallNs"] = time.monotonic_ns() - cleanup_start
        summary["elapsedWallNs"] = time.monotonic_ns() - started; summary["chargedPutBytes"] = used
        summary["combinedTimingBoundary"] = "Two sessions; first two measurements reused from the preserved failed raw-reply census. Not one uninterrupted24-call benchmark."
        signal.signal(signal.SIGALRM, old_handler)
        progress(); put("summary.json", C.encoded(summary))
    return 0 if summary["status"] == "PASS_OBSERVABLE_ARCHIVE_CENSUS" else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--node", type=Path, required=True)
    parser.add_argument("--prior", type=Path, required=True)
    parser.add_argument("--audit", type=Path, required=True)
    arguments = parser.parse_args()
    sys.exit(run(arguments.run_id, arguments.node, arguments.prior, arguments.audit))
