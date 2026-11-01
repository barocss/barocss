#!/usr/bin/env python3
"""Exact closed-form certificate for one authenticated saved contact patch."""
import argparse
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import signal
import sys
import time
from fractions import Fraction

HERE = Path(__file__).resolve().parent
HELPER_SHA = "70a34672ef53f034fa714bcd54a120a60c672fea3fd740841064dc8ac43263e2"
PRIOR_SHA = "f8941733862d59a49730c5f5624d99186e7d9f8a1f307dda3026371efc2b89db"
STEP_SHA = "f588b8d940c75dc246b164b7ab0b0182e6cf32604672986bcdabbe81b2108840"
RAW_SHA = "b156e035caaa3c94f5885a24a2541b9913869221a22311a416af64d58121ecc2"
spec = importlib.util.spec_from_file_location("immutable_stack_observer", HERE / "stack-study.py")
S = importlib.util.module_from_spec(spec)
# Verify the helper before import. It contains definitions, not a study run.
if hashlib.sha256((HERE / "stack-study.py").read_bytes()).hexdigest() != HELPER_SHA:
    raise RuntimeError("immutable observer source hash mismatch")
spec.loader.exec_module(S)
ZERO = Fraction(0)
ONE = Fraction(1)
VZERO = (ZERO, ZERO, ZERO)


class CertificateRefused(Exception):
    pass


def admit(condition, message):
    if not condition:
        raise CertificateRefused(message)


def f(value):
    S.number(value)
    return Fraction.from_float(float(value))


def v(value):
    S.vector(value)
    return tuple(f(x) for x in value)


def add(a, b):
    return tuple(x+y for x, y in zip(a, b))


def sub(a, b):
    return tuple(x-y for x, y in zip(a, b))


def mul(a, factor):
    return tuple(x*factor for x in a)


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def dot(a, b):
    return sum((x*y for x, y in zip(a, b)), ZERO)


def chain(free, points):
    """Use connectivity and heights. IDs identify rows, never their loads."""
    admit(len(free) == 9 and len(points) == 32, "requires nine bodies and32actual points")
    static = [i for i, body in enumerate(free) if body["kind"] == "static"]
    admit(len(static) == 1, "requires one static root")
    root = static[0]
    groups = {}
    for index, point in enumerate(points):
        a, b = point["aIndex"], point["bIndex"]
        admit(0 <= a < 9 and 0 <= b < 9 and a != b, "endpoint index")
        key = tuple(sorted((a, b)))
        groups.setdefault(key, []).append(index)
    admit(len(groups) == 8 and all(len(rows) == 4 for rows in groups.values()), "eight four-point interfaces required")
    adjacency = {i: [] for i in range(9)}
    for a, b in groups:
        adjacency[a].append(b)
        adjacency[b].append(a)
    admit(len(adjacency[root]) == 1 and all(1 <= len(rows) <= 2 for rows in adjacency.values()), "branched or isolated topology")
    order, previous, current = [], None, root
    while True:
        admit(current not in order, "cycle")
        order.append(current)
        following = [i for i in adjacency[current] if i != previous]
        if not following:
            break
        admit(len(following) == 1, "branch")
        previous, current = current, following[0]
    admit(len(order) == 9, "disconnected chain")
    loads = {}
    for i, (low, high) in enumerate(zip(order, order[1:])):
        admit(f(free[high]["positionM"][1]) > f(free[low]["positionM"][1]), "chain height direction")
        key = tuple(sorted((low, high)))
        loads[key] = sum(1 for node in order[i+1:] if free[node]["kind"] == "dynamic")
    return groups, order, loads


def profile(free, points):
    groups, order, loads = chain(free, points)
    speed = None
    seen = set()
    for body in free:
        admit(body["orientation"] == [0, 0, 0, 1], "identity orientations required")
        admit(v(body["positionM"])[0] == 0 and v(body["positionM"])[2] == 0, "centred aligned COMs required")
        admit(v(body["angularVelocityRadps"]) == VZERO, "zero free spin required")
        admit(body["frictionStatic"] == 1 and body["frictionDynamic"] == .7 and body["restitution"] == 0, "fixed material")
        velocity = v(body["velocityMps"])
        if body["kind"] == "static":
            admit(body["inverseMass"] == 0 and velocity == VZERO, "static root state")
            admit(body["shape"] == {"kind": "box", "halfExtentsM": [2, .1, 2]}, "fixed floor")
        else:
            admit(body["kind"] == "dynamic" and body["inverseMass"] == 1, "one-kilogram dynamic body required")
            admit(body["shape"] == {"kind": "box", "halfExtentsM": [.25, .25, .25]}, "fixed cube")
            admit(body["inverseInertiaLocal"] == [24, 24, 24], "fixed inverse inertia")
            admit(velocity[0] == 0 and velocity[2] == 0 and velocity[1] < 0, "downward free velocity required")
            if speed is None:
                speed = -velocity[1]
            admit(-velocity[1] == speed, "unequal free velocity")
    for point in points:
        S.point_layout(point, free, seen)
        admit(point["family"] == "face", "face row required")
        admit(point["warm"]["normalNs"] == 0 and point["warm"]["tangentNs"] == [0, 0, 0], "cold first frame required")
        a, b = point["aIndex"], point["bIndex"]
        sign = 1 if free[b]["positionM"][1] > free[a]["positionM"][1] else -1
        admit(v(point["normal"]) == (ZERO, Fraction(sign), ZERO), "vertical geometric normal required")
    corners = {(Fraction(x, 4), Fraction(z, 4)) for x in (-1, 1) for z in (-1, 1)}
    for rows in groups.values():
        actual = [(f(points[i]["pointM"][0]), f(points[i]["pointM"][2])) for i in rows]
        admit(len(set(actual)) == 4 and set(actual) == corners, "four symmetric actual corners required")
        admit(len({f(points[i]["pointM"][1]) for i in rows}) == 1, "common interface plane required")
    return groups, order, loads, speed


def certificate(free, points, gravity, dt, progress=None):
    groups, order, loads, speed = profile(free, points)
    impulses = [VZERO for _ in free]
    torques = [VZERO for _ in free]
    rows = []
    ideal_speed = f(gravity) * f(dt)
    for index, point in enumerate(points):
        if progress is not None:
            progress["candidateImpulseRowsConstructed"] += 1
        a, b = point["aIndex"], point["bIndex"]
        key = tuple(sorted((a, b)))
        impulse = loads[key] * speed / 4
        ideal = loads[key] * ideal_speed / 4
        j = mul(v(point["normal"]), impulse)
        for endpoint, sign in ((a, -1), (b, 1)):
            signed = mul(j, sign)
            impulses[endpoint] = add(impulses[endpoint], signed)
            torques[endpoint] = add(torques[endpoint], cross(sub(v(point["pointM"]), v(free[endpoint]["positionM"])), signed))
        rows.append({"pointIndex": index, "pointId": point["pointId"], "pairKey": point["pairKey"],
                     "supportedDynamicCount": loads[key], "normalImpulseNs": impulse,
                     "tangentImpulseNs": VZERO, "idealGravityDtImpulseNs": ideal,
                     "stoppingMinusIdealImpulseNs": impulse-ideal})
    predicted_v, predicted_w, bodies = [], [], []
    for i, body in enumerate(free):
        if body["kind"] == "static":
            velocity, spin = v(body["velocityMps"]), v(body["angularVelocityRadps"])
        else:
            velocity = add(v(body["velocityMps"]), mul(impulses[i], f(body["inverseMass"])))
            spin = add(v(body["angularVelocityRadps"]), tuple(t*inv for t, inv in zip(torques[i], v(body["inverseInertiaLocal"]))))
        admit(velocity == VZERO and spin == VZERO, "exact candidate velocity/spin does not vanish")
        predicted_v.append(velocity)
        predicted_w.append(spin)
        bodies.append({"id": body["id"], "netImpulseNs": impulses[i], "netTorqueNms": torques[i],
                       "predictedVelocityMps": velocity, "predictedAngularVelocityRadps": spin,
                       "staticReactionSink": body["kind"] == "static"})
    for row, point in zip(rows, points):
        if progress is not None:
            progress["exactCertificateRows"] += 1
        speeds = []
        for i in (point["aIndex"], point["bIndex"]):
            speeds.append(add(predicted_v[i], cross(predicted_w[i], sub(v(point["pointM"]), v(free[i]["positionM"])))))
        normal_speed = dot(v(point["normal"]), sub(speeds[1], speeds[0]))
        impulse = row["normalImpulseNs"]
        admit(impulse >= 0 and normal_speed >= 0 and impulse*normal_speed == 0, "candidate normal feasibility")
        relative = sub(speeds[1], speeds[0])
        tangent_speed = sub(relative, mul(v(point["normal"]), normal_speed))
        # Both materials are identical; no square root is needed for their limits.
        static_limit = f(free[point["aIndex"]]["frictionStatic"]) * impulse
        dynamic_limit = f(free[point["aIndex"]]["frictionDynamic"]) * impulse
        friction_feasible = tangent_speed == VZERO and ZERO <= static_limit and ZERO <= dynamic_limit
        admit(friction_feasible, "candidate zero-tangent feasibility")
        row.update({"normalSpeedMps": normal_speed, "complementarityJ": impulse*normal_speed,
                    "negativeNormalImpulseNs": max(ZERO, -impulse), "frictionConeFeasible": friction_feasible,
                    "tangentRelativeVelocityMps": tangent_speed,
                    "staticFrictionLimitNs": static_limit, "dynamicFrictionLimitNs": dynamic_limit})
    return {"chainBodyIdsFromStaticRoot": [free[i]["id"] for i in order],
            "interfaces": len(groups), "pointRows": rows, "bodyCertificate": bodies,
            "savedStoppingSpeedMps": speed, "exactGravityDtSpeedMps": ideal_speed,
            "stoppingMinusGravityDtMps": speed-ideal_speed,
            "exactVelocityAndSpinZero": True, "exactNormalComplementarityZero": True,
            "candidateIsUniqueImpulseDistribution": False}


def geometry(free, points, progress=None):
    result = []
    for index, point in enumerate(points):
        if progress is not None:
            progress["geometryPointChecks"] += 1
        low = S.geometry_at_precision(point, free, 80)
        high = S.geometry_at_precision(point, free, 120)
        difference = S.compare_geometry(low, high)
        admit(high["lineIntersectsBoth"] and high["lineMidpointWithinTolerance"] and
              high["a"]["pointInsideTolerance"] and high["b"]["pointInsideTolerance"] and
              high["supportPlaneGapM"] <= S.GEOMETRY_GATE, "independent geometry rejected point" + str(index))
        result.append({"pointIndex": index, "pairKey": point["pairKey"],
                       "supportPlaneGapM": high["supportPlaneGapM"], "lineWitnessGapM": high["lineWitnessGapM"],
                       "pointToLineWitnessMidpointM": high["pointToLineWitnessMidpointM"],
                       "aMaxLocalSlabViolationM": high["a"]["maxLocalSlabViolationM"],
                       "bMaxLocalSlabViolationM": high["b"]["maxLocalSlabViolationM"],
                       "precisionMaxDifference": difference, "witness": high})
    return result


def load_inputs(diagnostic):
    prior_bytes = diagnostic.read_bytes()
    S.require(len(prior_bytes) == 16407 and hashlib.sha256(prior_bytes).hexdigest() == PRIOR_SHA, "prior diagnostic authentication")
    prior = json.loads(prior_bytes)
    S.require(prior["status"] == "DIAGNOSTIC_NORMAL_CONTACT_NO_GO" and prior["decodedAuthenticationComplete"] is True
              and prior["archiveRecordsHashed"] == 961 and prior["decodedJsonBytesHashed"] == 420695755,
              "prior decoded authentication receipt")
    compressed = S.compressed_authentication()
    for name, pin in S.PINS.items():
        previous = prior["authentication"][name]
        S.require((previous["compressedBytes"], previous["compressedSha256"], previous["decodedBytes"], previous["decodedSha256"])
                  == pin, "prior/current archive identities differ")
    with gzip.open(S.ARCHIVE / "source-ALIGNED.jsonl.gz", "rb") as handle:
        lines = [handle.readline(S.MAX_LINE+1), handle.readline(S.MAX_LINE+1)]
    S.require(all(line.endswith(b"\n") and len(line) <= S.MAX_LINE for line in lines), "selected JSON record cap/layout")
    S.require(hashlib.sha256(lines[1]).hexdigest() == STEP_SHA, "step1 JSON authentication")
    with gzip.open(S.ARCHIVE / "source-ALIGNED.f64le.gz", "rb") as handle:
        raw = handle.read(10296)
    S.require(len(raw) == 10296 and hashlib.sha256(raw[936:]).hexdigest() == RAW_SHA, "step1 raw authentication")
    initial, step = (json.loads(line) for line in lines)
    S.require(initial["kind"] == "initial" and initial["scene"] == "ALIGNED" and initial["state"]["stepIndex"] == 0,
              "initial record cursor")
    S.require(step["kind"] == "step" and step["scene"] == "ALIGNED" and step["step"] == 1
              and step["producerRefused"] is False, "accepted first step required")
    S.restore_frame(initial["state"]["bodies"], raw[:936])
    frames = {}
    for i, (label, bodies) in enumerate(S.record_frames(step)):
        frames[label] = S.restore_frame(bodies, raw[936+i*936:936+(i+1)*936])
    S.require(len(frames) == 10, "first-step frame count")
    ledger = step["stages"][2]["ledger"]
    S.require(ledger["fixedStepSeconds"] == 1/120 and ledger["gravityMps2"] == [0, -9.81, 0] and ledger["actions"] == [], "first-step fixed configuration")
    return prior, compressed, frames, ledger


def public(value):
    if isinstance(value, Fraction):
        return str(value.numerator) + "/" + str(value.denominator)
    if type(value) is dict:
        return {key: public(item) for key, item in value.items()}
    if type(value) in (list, tuple):
        return [public(item) for item in value]
    return S.public(value)


def study(diagnostic):
    prior, authentication, frames, ledger = load_inputs(diagnostic)
    free, points = frames["closure-ready.free"], ledger["points"]
    result = {"authentication": authentication, "priorResultSha256": PRIOR_SHA,
              "decodedFullAuthentication": "REUSED_FROM_PINNED_PRIOR_RECEIPT",
              "currentCompressedAuthentication": "COMPLETE_BEFORE_CERTIFICATE",
              "selectedStepJsonSha256": STEP_SHA, "selectedStepRawSha256": RAW_SHA,
              "jsonRecordsParsed": 2, "selectedRawBytes": 10296,
              "savedNativeFirstViolation": prior["firstViolation"],
              "nativeLawFixAuthorized": False, "originalEightBoxPhysicalGO": False,
              "causalLawDefect": "UNKNOWN", "worldCalls": 0, "solverCalls": 0, "velocitySweeps": 0,
              "sourceGeometryCalls": 0, "geometryPointChecks": 0, "exactCertificateRows": 0}
    result["candidateImpulseRowsConstructed"] = 0
    try:
        profile(free, points)
        witnesses = geometry(free, points, result)
        exact = certificate(free, points, -ledger["gravityMps2"][1], ledger["fixedStepSeconds"], result)
        result.update({"status": "SAVED_FIRST_PATCH_EXACT_FIXED_POINT_CERTIFIED",
                       "exactCertificateRows": len(exact["pointRows"]), "certificate": exact,
                       "independentGeometry": witnesses,
                       "observedVelocityPhaseBodies": frames["closure-ready.velocity"],
                       "limitation": "One feasible fixed point and the native64-sweep residual do not prove asymptotic convergence or the cause of long-term collapse."})
    except CertificateRefused as error:
        result.update({"status": "CERTIFICATE_REFUSED", "reason": str(error)})
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--diagnostic", type=Path, default=HERE / "evidence/stack-study-01/result.json")
    args = parser.parse_args()
    S.require(args.output.is_absolute() and args.diagnostic.is_absolute(), "absolute output/diagnostic paths required")
    S.require(not args.output.exists(), "output already exists")
    signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(S.StudyError("170-second internal deadline")))
    signal.alarm(170)
    started = time.monotonic()
    try:
        result, exit_code = study(args.diagnostic), 0
    except (S.StudyError, OSError, ValueError, TypeError, KeyError, ArithmeticError, EOFError) as error:
        result, exit_code = {"status": "EXECUTION_FAILURE", "errorType": type(error).__name__, "message": str(error),
                             "nativeLawFixAuthorized": False, "originalEightBoxPhysicalGO": False,
                             "causalLawDefect": "UNKNOWN", "worldCalls": 0, "solverCalls": 0}, 1
    result["elapsedSeconds"] = time.monotonic()-started
    payload = (json.dumps(public(result), indent=2, allow_nan=False)+"\n").encode()
    S.require(len(payload) <= 16*1024*1024, "derived output budget")
    with args.output.open("xb") as handle:
        handle.write(payload)
    print(json.dumps({"status": result["status"], "output": str(args.output), "bytes": len(payload),
                      "sha256": hashlib.sha256(payload).hexdigest(),
                      "geometryPointChecks": result.get("geometryPointChecks"),
                      "exactCertificateRows": result.get("exactCertificateRows")}))
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
