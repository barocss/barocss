#!/usr/bin/env python3
"""Independent accepted-world comparator over the unchanged #1280 scalar oracle.

JSON lines: {initial:<independent primitive input>,stepIndex:1|2,
previousState:<actual prior state>,state:<actual state>,diagnostic:<getter>}.
The actual states/diagnostic are never used as the oracle's initial input.
op:'face' forwards unchanged #1280 observer controls. op:'episode' compares
{full:<step1 request>,halves:[<step1 request>,<step2 request>]}.
"""
import importlib.util
import json
import math
from pathlib import Path
import struct
import sys

sys.dont_write_bytecode = True
PATH = Path(__file__).resolve().parent.parent / "physics-rigid-capsule-ccd-reference" / "reference.py"
SPEC = importlib.util.spec_from_file_location("adopted_capsule_scalar_1280", PATH)
FACE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(FACE)
GATE = 1e-12


class ReferenceInputError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise ReferenceInputError(message)


def finite(value):
    require(type(value) in (int, float), "World reference requires finite numeric fields")
    try:
        result = float(value)
    except OverflowError:
        raise ReferenceInputError("World reference requires finite numeric fields") from None
    require(math.isfinite(result), "World reference requires finite numeric fields")
    return result


def vector(value, length=3):
    require(isinstance(value, list) and len(value) == length, "World reference vector length is invalid")
    return [finite(item) for item in value]


def error_vector(actual, expected):
    return math.hypot(*(a-b for a, b in zip(vector(actual, len(expected)), expected)))


def face(input_value):
    try:
        return FACE.evaluate(input_value)
    except FACE.ReferenceInputError as error:
        return FACE.input_failure(error, input_value)


def expected_steps(initial, index):
    require(isinstance(initial, dict) and type(index) is int and index in (1, 2),
            "World reference requires independent initial input and stepIndex 1 or 2")
    require(finite(initial.get("stepSeconds")) in (1/120, 1/240), "World reference configured step is unsupported")
    box = initial.get("box")
    require(isinstance(box, dict), "World reference independent box is required")
    orientation = vector(box.get("orientationXYZW"), 4)
    require(vector(box.get("centerM")) == [0, 0, 0] and vector(box.get("halfExtentsM")) == [.001, 1, 1]
            and orientation in ([0, 0, 0, 1], [0, .09983341664682815, 0, .9950041652780257]),
            "World reference literal box profile differs")
    current = {**initial, "evaluateCandidate": False}
    references = []
    for _ in range(index):
        observed = face(current)
        require(observed.get("resolved") is True and observed.get("ok") is True,
                "Adopted scalar reference is invalid or unresolved")
        references.append((current, observed))
        _, _, decoded_box, decoded_center, _, _ = FACE.decode(current)
        require(FACE.to_local(decoded_box, decoded_center)[0] <= decoded_box["half"][0],
                "World reference selected negative face differs")
        result = observed["reference"]
        # Only independent oracle output composes the next expected step.
        current = {**current, "centerM": [float(x) for x in result["centerFinal"]],
                   "velocityMps": [float(x) for x in result["velocityFinal"]]}
    return references


def body_state(state, initial, index):
    require(isinstance(state, dict), "World reference state must be an object")
    require(type(state.get("stepIndex")) is int and state["stepIndex"] == index,
            "World reference state cursor is invalid")
    dt = finite(initial["stepSeconds"])
    require(finite(state.get("timeSeconds")) == index*dt, "World reference clock operation differs")
    bodies = state.get("bodies")
    require(isinstance(bodies, list) and len(bodies) == 2 and all(isinstance(b, dict) for b in bodies),
            "World reference requires exactly two bodies")
    dynamic_id = initial.get("bodyId", "b0")
    box = initial["box"]
    require([b.get("id") for b in bodies] == [dynamic_id, box["id"]], "World reference body IDs differ")
    capsule, fixture = bodies
    require(capsule.get("kind") == "dynamic" and capsule.get("ccd") is True and
            capsule.get("shape") == {"kind": "capsule", "radiusM": .1, "halfLengthM": .2},
            "World reference capsule metadata differs")
    require(fixture.get("kind") == "static" and fixture.get("shape") ==
            {"kind": "box", "halfExtentsM": box["halfExtentsM"]}, "World reference fixture metadata differs")
    vector(fixture["shape"].get("halfExtentsM"))
    for body in bodies:
        for field, length in (("positionM", 3), ("velocityMps", 3), ("orientation", 4), ("angularVelocityRadps", 3)):
            vector(body.get(field), length)
    for field in ("contacts", "ccdHits", "events", "joints"):
        require(isinstance(state.get(field), list), "World reference state arrays are required")
    require(state["joints"] == [], "World reference joints differ")
    stats = state.get("pairStats")
    require(isinstance(stats, dict), "World reference pair statistics are required")
    expected_stats = {"eligiblePairs": 8 if index else 0, "candidatePairs": 8 if index else 0, "aabbTests": 0}
    require(all(type(stats.get(key)) is int and stats[key] == value for key, value in expected_stats.items()),
            "World reference original eight-pass statistics differ")
    for event in state["events"]:
        require(isinstance(event, dict) and {event.get("aId"), event.get("bId")} == {dynamic_id, box["id"]}
                and event.get("kind") == "contact" and event.get("phase") in ("begin", "stay", "end"),
                "World reference event receipt differs")
    return capsule, fixture


def evaluate_step(request):
    require(isinstance(request, dict), "World reference request must be an object")
    outcome = request.get("outcome", "accepted")
    require(outcome in ("accepted", "attempted-refused"), "World reference outcome is invalid")
    initial, index = request.get("initial"), request.get("stepIndex")
    steps = expected_steps(initial, index)
    start, base = steps[-1]
    ref = base["reference"]
    actual, fixture = body_state(request.get("state"), initial, index)
    previous, previous_fixture = body_state(request.get("previousState"), initial, index-1)
    diagnostic = request.get("diagnostic")
    require(isinstance(diagnostic, dict), "World reference diagnostic must be an object")
    require(type(diagnostic.get("acceptedStepIndex")) is int and diagnostic["acceptedStepIndex"] == index,
            "World reference diagnostic cursor differs")
    dt = finite(initial["stepSeconds"])
    expected_center = [float(x) for x in ref["centerFinal"]]
    expected_velocity = [float(x) for x in ref["velocityFinal"]]
    metrics = {"previousCenterErrorM": error_vector(previous["positionM"], start["centerM"]),
               "previousVelocityErrorMps": error_vector(previous["velocityMps"], start["velocityMps"]),
               "finalCenterErrorM": error_vector(actual["positionM"], expected_center),
               "finalVelocityErrorMps": error_vector(actual["velocityMps"], expected_velocity),
               "stepTimeErrorSeconds": abs(finite(diagnostic.get("stepSeconds"))-dt),
               "startCenterErrorM": error_vector(diagnostic.get("startCenterM"), start["centerM"]),
               "startVelocityErrorMps": error_vector(diagnostic.get("startVelocityMps"), start["velocityMps"]),
               "faceFinalCenterErrorM": error_vector(diagnostic.get("faceFinalCenterM"), expected_center),
               "faceFinalVelocityErrorMps": error_vector(diagnostic.get("faceFinalVelocityMps"), expected_velocity),
               "acceptedCenterDiagnosticErrorM": error_vector(diagnostic.get("acceptedCenterM"), actual["positionM"]),
               "acceptedVelocityDiagnosticErrorMps": error_vector(diagnostic.get("acceptedVelocityMps"), actual["velocityMps"])}
    violations = []
    for field, bound in (("positionM", 10000), ("velocityMps", 1000), ("angularVelocityRadps", 1000)):
        maximum = max(abs(x) for body in request["state"]["bodies"] for x in body[field])
        metrics["max"+field[0].upper()+field[1:]] = maximum
        if maximum > bound:
            violations.append("Original world " + field + " bound is exceeded")
    if actual["orientation"] != [0, 0, 0, 1]:
        violations.append("Accepted capsule orientation changed")
    if any(value != 0 for value in actual["angularVelocityRadps"]):
        violations.append("Accepted capsule spin is nonzero")
    box = initial["box"]
    for field, expected in (("positionM", box["centerM"]), ("orientation", box["orientationXYZW"]),
                            ("velocityMps", [0, 0, 0]), ("angularVelocityRadps", [0, 0, 0])):
        if fixture[field] != expected or previous_fixture[field] != expected:
            violations.append("Static fixture " + field + " changed")
    inertia = .4*(.1+.2)**2
    require(actual.get("inertiaDiagonalKgM2") == [inertia]*3 and previous.get("inertiaDiagonalKgM2") == [inertia]*3,
            "World reference original capsule inertia differs")
    hit = diagnostic.get("hit")
    require("hit" in diagnostic and (hit is None or isinstance(hit, dict)), "World reference hit must be explicit null or object")
    expected_hit = ref["status"] == "hit"
    if (hit is not None) != expected_hit:
        violations.append("Diagnostic hit presence differs from independent face law")
    world_hits = request["state"]["ccdHits"]
    for receipt in world_hits:
        require(isinstance(receipt, dict) and receipt.get("bodyId") == actual["id"] and
                receipt.get("fixtureId") == fixture["id"], "World reference CCD IDs differ")
        require(0 <= finite(receipt.get("toiFraction")) <= 1, "World reference CCD fraction differs")
        vector(receipt.get("normalFixtureToBody"))
    if len(world_hits) != (1 if expected_hit else 0):
        violations.append("World CCD hit count differs from independent face law")
    expected_time = float(ref["toiSeconds"]) if expected_hit else 0
    actual_time = finite(diagnostic.get("hitTimeSeconds"))
    remaining = finite(diagnostic.get("remainingTimeSeconds"))
    metrics.update({"hitTimeErrorSeconds": abs(actual_time-expected_time),
                    "remainingTimeErrorSeconds": abs(remaining-float(ref["remainingSeconds"])),
                    "timeAccountingErrorSeconds": abs(actual_time+remaining-dt)})
    if not 0 <= actual_time <= dt or not 0 <= remaining <= dt:
        violations.append("World CCD time is outside the configured step")
    if expected_hit and hit is not None:
        require(hit.get("dynamicBodyId") == actual["id"] and hit.get("fixtureId") == fixture["id"],
                "World reference diagnostic hit IDs differ")
        fraction = finite(hit.get("fraction"))
        require(0 <= fraction <= 1, "World reference fraction is outside the step")
        metrics["fractionError"] = abs(fraction-float(ref["toiFraction"]))
        face_hit = {"toiFraction": fraction, "normalFixtureToCapsule": vector(hit.get("normal")),
                    "pointM": vector(hit.get("pointM")), "segmentPointM": vector(hit.get("segmentPointM"))}
        checked = face({**start, "evaluateCandidate": True, "hit": face_hit,
                        "result": {"centerM": actual["positionM"], "velocityMps": actual["velocityMps"],
                                   "hitTimeSeconds": actual_time, "remainingTimeSeconds": remaining}})
        require(checked.get("resolved") is True, "Adopted scalar candidate comparison is unresolved")
        violations.extend(checked.get("violations", []))
        metrics.update({key: value for key, value in checked.get("metrics", {}).items()
                        if key.startswith("witness") or key in ("normalError", "normalUnitError", "candidateFinalGapM", "candidateClosingSpeedMps")})
        if len(world_hits) == 1:
            receipt = world_hits[0]
            require(isinstance(receipt, dict) and receipt.get("bodyId") == actual["id"] and
                    receipt.get("fixtureId") == fixture["id"], "World reference CCD IDs differ")
            metrics["worldFractionDiagnosticError"] = abs(finite(receipt.get("toiFraction"))-fraction)
            metrics["worldNormalDiagnosticError"] = error_vector(receipt.get("normalFixtureToBody"), face_hit["normalFixtureToCapsule"])
    # Final signed distance is evaluated by the unchanged independent scalar oracle.
    final_geometry = face({**start, "centerM": actual["positionM"], "velocityMps": [0, 0, 0], "evaluateCandidate": False})
    require(final_geometry.get("resolved") is True and "signedGapM" in final_geometry.get("metrics", {}),
            "Independent final geometry is unresolved")
    metrics["finalSignedGapM"] = finite(final_geometry["metrics"]["signedGapM"])
    if metrics["finalSignedGapM"] < -GATE:
        violations.append("Accepted world penetrates beyond 1e-12 m")
    for contact in request["state"]["contacts"]:
        require(isinstance(contact, dict), "World reference contact must be an object")
        for field in ("normalAtoB", "pointM", "tangentImpulseNs"):
            vector(contact.get(field))
        depth, impulse = finite(contact.get("penetrationM")), finite(contact.get("impulseNs"))
        if not 0 <= depth <= GATE or impulse < 0:
            violations.append("Original discrete contact fields exceed the admitted face gate")
        require({contact.get("aId"), contact.get("bId")} == {actual["id"], fixture["id"]},
                "World reference contact IDs differ")
        expected_normal = [float(x) for x in ref["normal"]]
        if contact["aId"] == actual["id"]:
            expected_normal = [-x for x in expected_normal]
        metrics["contactNormalOrientationError"] = max(metrics.get("contactNormalOrientationError", 0),
                                                        error_vector(contact["normalAtoB"], expected_normal))
        metrics["contactNormalUnitError"] = max(metrics.get("contactNormalUnitError", 0),
                                                 abs(math.hypot(*contact["normalAtoB"])-1))
    for key, value in metrics.items():
        if "Error" in key and value > GATE:
            violations.append(key+" exceeds 1e-12")
    raw_verified = False
    if "rawStateHex" in request:
        value = request["rawStateHex"]
        require(isinstance(value, str) and len(value) == 416, "World reference raw13 length differs")
        try:
            raw = bytes.fromhex(value)
        except ValueError:
            raise ReferenceInputError("World reference raw13 encoding differs") from None
        decoded = struct.unpack("<26d", raw)
        numbers = [x for b in request["state"]["bodies"] for field in
                   ("positionM", "velocityMps", "orientation", "angularVelocityRadps") for x in b[field]]
        require(all(math.isfinite(a) and a == b for a, b in zip(decoded, numbers)), "World reference raw13 differs from JSON state")
        packed_equal = lambda a, b: struct.pack("<d", a) == struct.pack("<d", float(b))
        if not all(packed_equal(decoded[6+i], value) for i, value in enumerate([0, 0, 0, 1])):
            violations.append("Accepted capsule orientation raw bits changed")
        if not all(packed_equal(decoded[13+i], value) for i, value in enumerate(box["centerM"])) or not all(
                packed_equal(decoded[19+i], value) for i, value in enumerate(box["orientationXYZW"])):
            violations.append("Static fixture pose raw bits changed")
        raw_verified = True
    first_contact = next(((i*dt)+float(item[1]["reference"]["toiSeconds"]) for i, item in enumerate(steps)
                          if item[1]["reference"]["status"] == "hit"), None)
    return {"ok": not violations, "resolved": True, "executionFailure": False, "outcome": outcome,
            "metrics": metrics, "violations": violations, "reference": ref,
            "firstAbsoluteContactTimeSeconds": first_contact, "raw13Verified": raw_verified,
            "signedZeroAuthority": "supplied raw13 and consumer bit receipts; JSON alone loses zero signs"}


def evaluate_episode(request):
    require(isinstance(request.get("halves"), list) and len(request["halves"]) == 2, "World reference episode requires two halves")
    require(isinstance(request.get("full"), dict) and all(isinstance(item, dict) for item in request["halves"]),
            "World reference episode records must be objects")
    require(request["full"].get("stepIndex") == 1 and [item.get("stepIndex") for item in request["halves"]] == [1, 2],
            "World reference episode cursors differ")
    require(finite(request["full"]["initial"].get("stepSeconds")) == 1/120 and
            all(finite(item["initial"].get("stepSeconds")) == 1/240 for item in request["halves"]),
            "World reference episode steps differ")
    full = evaluate_step(request["full"])
    halves = [evaluate_step(item) for item in request["halves"]]
    violations = []
    for result in [full, *halves]:
        violations.extend(result["violations"])
    a, b = request["full"]["state"], request["halves"][-1]["state"]
    metrics = {"finalCenterErrorM": error_vector(a["bodies"][0]["positionM"], b["bodies"][0]["positionM"]),
               "finalVelocityErrorMps": error_vector(a["bodies"][0]["velocityMps"], b["bodies"][0]["velocityMps"]),
               "elapsedTimeErrorSeconds": abs(finite(a["timeSeconds"])-finite(b["timeSeconds"]))}
    actual_first = []
    for requests in ([request["full"]], request["halves"]):
        actual_first.append(next((finite(item["previousState"]["timeSeconds"])+finite(item["diagnostic"]["hitTimeSeconds"])
                                  for item in requests if item["diagnostic"]["hit"] is not None), None))
    if (actual_first[0] is None) != (actual_first[1] is None):
        violations.append("Full/half first contact presence differs")
    elif actual_first[0] is not None:
        metrics["firstContactTimeErrorSeconds"] = abs(actual_first[0]-actual_first[1])
    for key, value in metrics.items():
        if value > GATE:
            violations.append(key+" exceeds 1e-12")
    return {"ok": not violations, "resolved": True, "executionFailure": False, "metrics": metrics,
            "violations": violations, "firstAbsoluteContactTimeSeconds": actual_first,
            "wholeLastStatesCompared": False}


def evaluate(request):
    require(isinstance(request, dict), "World reference request must be an object")
    if request.get("op") == "face":
        return face(request.get("input"))
    if request.get("op") == "episode":
        return evaluate_episode(request)
    return evaluate_step(request)


def main():
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            result = evaluate(json.loads(line))
        except (ReferenceInputError, json.JSONDecodeError) as error:
            result = {"ok": False, "resolved": False, "executionFailure": True, "code": "REFERENCE_INPUT",
                      "metrics": None, "violations": [str(error)]}
        print(json.dumps(result, allow_nan=False, separators=(",", ":")), flush=True)


if __name__ == "__main__":
    main()
