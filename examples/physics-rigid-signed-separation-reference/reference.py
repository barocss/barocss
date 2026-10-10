#!/usr/bin/env python3
"""Detached signed-row references. Inputs, never candidate answers, seed geometry.

Qualified Decimal SAT/coverage and the unchanged owned Fraction kernel are reused.
The scalar fresh query separately follows the declared Float64 operation order.
It is not a Decimal transcendental or unique physical feature certificate.
"""
from decimal import Decimal, localcontext
from fractions import Fraction
import copy
import importlib.util
import json
import math
from pathlib import Path
import struct
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


COVERAGE = load("qualified_coverage_1308", HERE.parent / "physics-rigid-coupled-position-diagnostic" / "coverage-reference.py")
SAT = COVERAGE.SAT
LINEAR = load("owned_signed_fraction_1344", HERE / "signed-linear-reference.py")
OLD_LINEAR = load("immutable_fraction_1263_guard", HERE.parent / "physics-rigid-coupled-position-reference" / "linear-reference.py")
ZERO = Decimal(0)
GATE = 1e-12
PRECISION_GATE = Decimal("1e-25")
MESSAGES = {
    "request": "signed reference request is invalid",
    "raw": "signed reference raw13 data is invalid",
    "query": "signed reference requires admitted raw boxes",
    "selection": "signed reference selection data is invalid",
    "row": "signed reference selected row data is invalid",
    "result": "signed reference linear result data is invalid",
    "json": "signed reference line must be valid JSON",
}


class ProtocolError(ValueError):
    pass


def require(value, key):
    if not value:
        raise ProtocolError(MESSAGES[key])


def number(value, key):
    require(type(value) in (int, float), key)
    try:
        result = float(value)
    except OverflowError:
        raise ProtocolError(MESSAGES[key]) from None
    require(math.isfinite(result), key)
    return result


def vector(value, size, key):
    require(type(value) is list and len(value) == size, key)
    return [number(v, key) for v in value]


def restore_pair(a, b, raw_hex=None):
    bodies = copy.deepcopy([a, b])
    if raw_hex is None:
        return bodies
    require(type(raw_hex) is str and len(raw_hex) == 416, "raw")
    try:
        raw = bytes.fromhex(raw_hex)
    except ValueError:
        raise ProtocolError(MESSAGES["raw"]) from None
    require(len(raw) == 208, "raw")
    numbers = struct.unpack("<26d", raw)
    index = 0
    for body in bodies:
        require(type(body) is dict, "raw")
        for field, size in (("positionM", 3), ("velocityMps", 3), ("orientation", 4), ("angularVelocityRadps", 3)):
            decoded = vector(body.get(field), size, "raw")
            for j in range(size):
                value = numbers[index]
                require(math.isfinite(value) and value == decoded[j], "raw")
                body[field][j] = value
                index += 1
    return bodies


def admitted_query_body(body):
    # Query guards mirror the selected profile, not additional shape physics.
    require(type(body) is dict and body.get("kind") in ("dynamic", "static"), "query")
    SAT.decode_body(body)
    for field, bound in (("velocityMps", 1000), ("angularVelocityRadps", 1000)):
        require(all(abs(x) <= bound for x in vector(body.get(field), 3, "query")), "query")
    mass = number(body.get("inverseMass"), "query")
    require(mass == 0 if body["kind"] == "static" else 1e-6 <= mass <= 1e6, "query")


def add(a, b):
    return [x+y for x, y in zip(a, b)]


def subtract(a, b):
    return [x-y for x, y in zip(a, b)]


def scale(a, value):
    return [x*value for x in a]


def dot(a, b):
    total = 0.0
    for x, y in zip(a, b):
        total = total+x*y
    return total


def cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def rotate(q, value):
    axis = q[:3]
    doubled = scale(cross(axis, value), 2)
    return add(value, add(scale(doubled, q[3]), cross(axis, doubled)))


def feature(index):
    if index < 3:
        return {"kind": "face-a", "axisA": index}, "A.face."+str(index)
    if index < 6:
        return {"kind": "face-b", "axisB": index-3}, "B.face."+str(index-3)
    i, j = divmod(index-6, 3)
    return {"kind": "edge-cross", "axisA": i, "axisB": j}, "A.edge."+str(i)+"xB.edge."+str(j)


def fresh_query(a, b):
    axes_a = [rotate(a["orientation"], v) for v in ([1, 0, 0], [0, 1, 0], [0, 0, 1])]
    axes_b = [rotate(b["orientation"], v) for v in ([1, 0, 0], [0, 1, 0], [0, 0, 1])]
    axes = axes_a+axes_b+[cross(x, y) for x in axes_a for y in axes_b]
    delta = subtract(b["positionM"], a["positionM"])
    records = []
    best = None
    for index, axis in enumerate(axes):
        length = math.hypot(*axis)
        kind, label = feature(index)
        record = {"candidateIndex": index, "label": label, "feature": kind, "rawAxisLength": length,
                  "skippedByOriginalCutoff": length < GATE, "signedDistanceM": None, "overlapM": None,
                  "axis": None, "orientedNormal": None, "radiusAM": None, "radiusBM": None}
        if length >= GATE:
            direction = scale(axis, 1/length)
            radii = []
            for body, basis in ((a, axes_a), (b, axes_b)):
                total = 0.0
                for extent, side in zip(body["shape"]["halfExtentsM"], basis):
                    total = total+extent*abs(dot(side, direction))
                radii.append(total)
            distance = dot(delta, direction)
            margin = radii[0]+radii[1]-abs(distance)
            record.update(axis=direction, orientedNormal=scale(direction, -1 if distance < 0 else 1),
                          radiusAM=radii[0], radiusBM=radii[1], signedDistanceM=distance, overlapM=margin)
            if best is None or margin < best["overlapM"]:
                best = record
        records.append(record)
    require(best is not None, "query")

    def support(body, basis, direction):
        total = [0, 0, 0]
        for side, extent in zip(basis, body["shape"]["halfExtentsM"]):
            projection = dot(side, direction)
            offset = 0 if abs(projection) <= GATE else extent if projection > 0 else -extent
            total = add(total, scale(side, offset))
        return add(body["positionM"], total)

    normal = best["orientedNormal"]
    point = scale(add(support(a, axes_a, normal), support(b, axes_b, scale(normal, -1))), .5)
    return {"normal": list(normal), "boundM": best["overlapM"], "pointM": point,
            "feature": copy.deepcopy(best["feature"]), "label": best["label"],
            "candidateIndex": best["candidateIndex"], "rawAxisLength": best["rawAxisLength"], "candidates": records,
            "ambiguity": {"exactMinimumCandidateIndices": [r["candidateIndex"] for r in records if r["overlapM"] is not None and r["overlapM"] == best["overlapM"]],
                          "withinDiagnosticTieToleranceCandidateIndices": [r["candidateIndex"] for r in records if r["overlapM"] is not None and abs(r["overlapM"]-best["overlapM"]) <= GATE],
                          "skippedCandidateIndices": [r["candidateIndex"] for r in records if r["skippedByOriginalCutoff"]],
                          "diagnosticTieToleranceM": GATE, "uniquePhysicalFeatureClaimed": False}}


def compare_selection(actual, expected, geometry):
    require(type(actual) is dict and set(actual) == set(expected), "selection")
    require(type(actual["candidateIndex"]) is int and 0 <= actual["candidateIndex"] < 15
            and type(actual["candidates"]) is list and len(actual["candidates"]) == 15, "selection")
    kind, _ = feature(actual["candidateIndex"])
    require(type(actual["feature"]) is dict and set(actual["feature"]) == set(kind)
            and all(type(actual["feature"][key]) is type(value) for key, value in kind.items())
            and type(actual["label"]) is str, "selection")
    vector(actual["pointM"], 3, "selection")  # Point is retained; it does not seed a row.
    errors, equal, usable, skipped = [], True, [], []
    for index, recorded in enumerate(actual["candidates"]):
        template = expected["candidates"][index]
        independent = geometry["raw"]["candidates"][index]
        require(type(recorded) is dict and set(recorded) == set(template)
                and type(recorded["candidateIndex"]) is int
                and type(recorded["label"]) is str
                and type(recorded["feature"]) is dict and set(recorded["feature"]) == set(template["feature"])
                and all(type(recorded["feature"][key]) is type(value) for key, value in template["feature"].items())
                and type(recorded["skippedByOriginalCutoff"]) is bool, "selection")
        equal = equal and recorded["candidateIndex"] == index and recorded["label"] == template["label"] and recorded["feature"] == template["feature"]
        length = number(recorded["rawAxisLength"], "selection")
        require(length >= 0, "selection")
        errors.append(abs(length-independent["rawAxisLength"]))
        equal = equal and recorded["skippedByOriginalCutoff"] == (length < GATE)
        equal = equal and recorded["skippedByOriginalCutoff"] == (independent["rawAxisLength"] < GATE)
        fields = ("signedDistanceM", "overlapM", "axis", "orientedNormal", "radiusAM", "radiusBM")
        if recorded["skippedByOriginalCutoff"]:
            require(all(recorded[field] is None for field in fields), "selection")
            skipped.append(index)
            continue
        require(independent["axis"] is not None, "selection")
        axis = vector(recorded["axis"], 3, "selection")
        normal = vector(recorded["orientedNormal"], 3, "selection")
        distance = number(recorded["signedDistanceM"], "selection")
        margin = number(recorded["overlapM"], "selection")
        sign = -1 if independent["signedCenterDistanceM"] < 0 else 1
        errors.extend(abs(x-y) for x, y in zip(axis, independent["axis"]))
        errors.extend(abs(x-y*sign) for x, y in zip(normal, independent["axis"]))
        for name, key in (("radiusAM", "radiusAM"), ("radiusBM", "radiusBM"), ("signedDistanceM", "signedCenterDistanceM"), ("overlapM", "marginM")):
            errors.append(abs(number(recorded[name], "selection")-independent[key]))
        equal = equal and normal == scale(axis, -1 if distance < 0 else 1)
        equal = equal and margin == recorded["radiusAM"]+recorded["radiusBM"]-abs(distance)
        usable.append(recorded)
    require(bool(usable), "selection")
    own_winner = min(usable, key=lambda item: item["overlapM"])
    chosen = actual["candidateIndex"]
    chosen_record = actual["candidates"][chosen]
    equal = equal and chosen == own_winner["candidateIndex"] and not chosen_record["skippedByOriginalCutoff"]
    require(not chosen_record["skippedByOriginalCutoff"], "selection")
    equal = equal and actual["feature"] == chosen_record["feature"] and actual["label"] == chosen_record["label"]
    normal = vector(actual["normal"], 3, "selection")
    bound = number(actual["boundM"], "selection")
    equal = equal and normal == chosen_record["orientedNormal"] and bound == chosen_record["overlapM"]
    equal = equal and number(actual["rawAxisLength"], "selection") == chosen_record["rawAxisLength"]
    ambiguity = actual["ambiguity"]
    own_ambiguity = {"exactMinimumCandidateIndices": [r["candidateIndex"] for r in usable if r["overlapM"] == own_winner["overlapM"]],
                     "withinDiagnosticTieToleranceCandidateIndices": [r["candidateIndex"] for r in usable if abs(r["overlapM"]-own_winner["overlapM"]) <= GATE],
                     "skippedCandidateIndices": skipped, "diagnosticTieToleranceM": GATE, "uniquePhysicalFeatureClaimed": False}
    require(type(ambiguity) is dict and set(ambiguity) == set(own_ambiguity), "selection")
    for key in ("exactMinimumCandidateIndices", "withinDiagnosticTieToleranceCandidateIndices", "skippedCandidateIndices"):
        require(type(ambiguity[key]) is list and all(type(value) is int and 0 <= value < 15 for value in ambiguity[key]), "selection")
    number(ambiguity["diagnosticTieToleranceM"], "selection")
    require(type(ambiguity["uniquePhysicalFeatureClaimed"]) is bool, "selection")
    equal = equal and ambiguity == own_ambiguity
    for convention in ("raw", "normalized"):
        candidates = geometry[convention]["candidates"]
        eligible = [item for item in candidates if item["rawAxisLength"] >= GATE]
        chosen_axis = candidates[chosen]
        require(bool(eligible) and chosen_axis["axis"] is not None, "selection")
        equal = equal and chosen_axis["rawAxisLength"] >= GATE and chosen_axis["marginM"] <= min(r["marginM"] for r in eligible)+GATE
        sign = -1 if chosen_axis["signedCenterDistanceM"] < 0 else 1
        errors.append(abs(bound-chosen_axis["marginM"]))
        errors.extend(abs(x-y*sign) for x, y in zip(normal, chosen_axis["axis"]))
    return equal and max(errors, default=0) <= GATE, max(errors, default=0), chosen


def query(request):
    a, b = restore_pair(request.get("a"), request.get("b"), request.get("rawHex"))
    admitted_query_body(a)
    admitted_query_body(b)
    SAT.require(a["id"] != b["id"], "ids")
    # Complete independent answers exist before inspecting candidate fields.
    expected = fresh_query(a, b)
    geometry = SAT.evaluate({"a": a, "b": b})
    if "raw" not in geometry or not geometry.get("ok"):
        return {**geometry, "resolved": False, "executionFailure": True}
    selection_agrees, selection_error, chosen = True, 0, expected["candidateIndex"]
    if "selection" in request:
        selection_agrees, selection_error, chosen = compare_selection(request["selection"], expected, geometry)
    selected_axis = {}
    maximum_axis_error = 0
    for convention in ("raw", "normalized"):
        item = geometry[convention]["candidates"][chosen]
        require(item["axis"] is not None, "query")
        sign = -1 if item["signedCenterDistanceM"] < 0 else 1
        selected_axis[convention] = {"normal": scale(item["axis"], sign), "boundM": item["marginM"],
                                     "candidateIndex": item["candidateIndex"], "label": item["label"]}
        source = request.get("selection", expected)
        maximum_axis_error = max(maximum_axis_error, abs(item["marginM"]-source["boundM"]),
                                 *(abs(x-y) for x, y in zip(selected_axis[convention]["normal"], source["normal"])))
    row_agrees, row_error = True, 0
    if "row" in request:
        row = request["row"]
        require(type(row) is dict and set(row) == {"aId", "bId", "normal", "boundM"}
                and row["aId"] == a["id"] and row["bId"] == b["id"] and request.get("rowKind") in ("original", "added"), "row")
        normal = vector(row["normal"], 3, "row")
        bound = number(row["boundM"], "row")
        independent = selected_axis["raw"]
        intended = max(0, independent["boundM"]) if request["rowKind"] == "original" else independent["boundM"]
        row_error = max(abs(bound-intended), *(abs(x-y) for x, y in zip(normal, independent["normal"])))
        row_agrees = row_error <= GATE and (request["rowKind"] == "original" or bound < 0 and independent["boundM"] < 0)
    resolved = geometry["precisionMaxDifferenceM"] <= 1e-25
    violations = []
    if not selection_agrees:
        violations.append("fresh selection differs")
    if not row_agrees:
        violations.append("selected signed row differs")
    if maximum_axis_error > GATE:
        violations.append("independent selected axis differs")
    if not geometry["conventionsAgreeWithin1e12M"]:
        violations.append("raw and normalized geometry differ")
    return {"ok": resolved and not violations, "resolved": resolved, "executionFailure": not resolved,
            "metrics": {"precisionMaxDifferenceM": geometry["precisionMaxDifferenceM"],
                        "rawNormalizedDepthDifferenceM": geometry["rawNormalizedDepthDifferenceM"],
                        "rawNormalizedMarginDifferenceM": geometry["rawNormalizedMarginDifferenceM"],
                        "selectionAgreement": selection_agrees, "rowAgreement": row_agrees,
                        "maxSelectionDifferenceM": selection_error, "maxRowDifferenceM": row_error,
                        "selectedAxisDifference": maximum_axis_error}, "violations": violations,
            "reference": {"selection": expected, "raw": geometry["raw"], "normalized": geometry["normalized"],
                          "selectedAxis": selected_axis, "uniquePhysicalFeatureClaimed": False,
                          "producerSelection": copy.deepcopy(request["selection"]) if "selection" in request else None,
                          "chosenAxisIndex": chosen, "crossRuntimeWinnerBitsRequired": False,
                          "scalarConvention": "independent Float64 scalar fresh axes; Decimal all-axis observer separate"}}


def linear(request):
    response = LINEAR.evaluate(request.get("problem"))
    solved = response.get("status") in ("SOLVED", "INFEASIBLE")
    response.update(resolved=solved, executionFailure=not solved, uniqueActiveSetClaimed=False)
    if not solved or response["status"] == "INFEASIBLE" or "result" not in request:
        return response
    problem, actual = request["problem"], request["result"]
    require(type(actual) is dict and actual.get("ok") is True and actual.get("status") == "SOLVED", "result")
    bodies, rows = LINEAR.validate_problem(problem)
    require(type(actual.get("translations")) is list and len(actual["translations"]) == len(bodies), "result")
    translations = []
    for body, record in zip(bodies, actual["translations"]):
        require(type(record) is dict and set(record) == {"id", "u"} and record["id"] == body["id"], "result")
        u = tuple(Fraction.from_float(x) for x in vector(record["u"], 3, "result"))
        require(body["inverseMass"] != 0 or all(x == 0 for x in u), "result")
        translations.append(u)
    multipliers = [Fraction.from_float(x) for x in vector(actual.get("lambdaKgM"), len(rows), "result")]
    incidence = LINEAR.signed_incidence(rows)
    zero_vector = (Fraction(0),)*3
    margins = [sum((LINEAR.dot(row.get(body["id"], zero_vector), u) for body, u in zip(bodies, translations)), Fraction(0))-source["boundM"]
               for row, source in zip(incidence, rows)]
    objective = sum((LINEAR.dot(u, u)/body["inverseMass"]/2 for body, u in zip(bodies, translations) if body["inverseMass"] > 0), Fraction(0))
    stationarity = max([Fraction(0)]+[abs(u[j]/body["inverseMass"]-sum((v*row.get(body["id"], zero_vector)[j] for v, row in zip(multipliers, incidence)), Fraction(0)))
                  for body, u in zip(bodies, translations) if body["inverseMass"] > 0 for j in range(3)])
    certificate = {"primalViolationM": float(max([Fraction(0)]+[-x for x in margins])),
                   "negativeMultiplierKgM": float(max([Fraction(0)]+[-x for x in multipliers])),
                   "complementarityKgM2": float(max([Fraction(0)]+[abs(x*y) for x, y in zip(multipliers, margins)])),
                   "stationarityKgM": float(stationarity)}
    delta = max((abs(float(x)-expected) for u, wanted in zip(translations, response["translations"]) for x, expected in zip(u, wanted["u"])), default=0)
    objective_delta = abs(float(objective)-response["objectiveKgM2"])
    supplied_objective_delta = abs(number(actual.get("objectiveKgM2"), "result")-float(objective))
    norm_limit = all(math.hypot(*(float(x) for x in u)) <= 10 for u in translations)
    passed = delta <= GATE and objective_delta <= GATE and supplied_objective_delta <= GATE and norm_limit and all(x <= GATE for x in certificate.values())
    response.update(ok=passed, metrics={"translationDifferenceM": delta, "objectiveDifferenceKgM2": objective_delta,
                    "suppliedObjectiveDifferenceKgM2": supplied_objective_delta, "actualCertificate": certificate,
                    "correctionNormWithinTenM": norm_limit}, actualCertificate=certificate,
                    nativeActiveMask=actual.get("activeMask"), referenceActiveMask=response["activeMask"])
    return response


def evaluate(request):
    require(type(request) is dict, "request")
    operation = request.get("op")
    if operation == "old-linear-negative":
        problem = request.get("problem")
        require(type(problem) is dict and type(problem.get("rows")) is list
                and any(type(row) is dict and type(row.get("depthM")) in (int, float) and row["depthM"] < 0 for row in problem["rows"]), "request")
        try:
            OLD_LINEAR.validate_problem(problem)
        except OLD_LINEAR.ReferenceError as error:
            return {"ok": False, "resolved": True, "executionFailure": False,
                    "code": error.code, "message": str(error), "guardOnly": True,
                    "oldSolveCalled": False}
        require(False, "request")
    if operation == "linear":
        return linear(request)
    if operation == "query":
        return query(request)
    if operation == "pair":
        a, b = restore_pair(request.get("a"), request.get("b"), request.get("rawHex"))
        response = SAT.evaluate({"a": a, "b": b})
        response.update(resolved=response.get("ok") is True, executionFailure=response.get("ok") is not True)
        return response
    if operation == "transition":
        require(request.get("row") is None and "row" in request, "request")
        before, after = request.get("before"), request.get("after")
        require(type(before) is dict and type(after) is dict, "request")
        ba, bb = restore_pair(before.get("a"), before.get("b"), request.get("beforeRawHex"))
        aa, ab = restore_pair(after.get("a"), after.get("b"), request.get("afterRawHex"))
        response = COVERAGE.evaluate({"before": {"a": ba, "b": bb}, "after": {"a": aa, "b": ab}, "translations": request.get("translations"), "row": None})
        response["executionFailure"] = response.get("resolved") is not True
        return response
    require(False, "request")


def main():
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            response = evaluate(json.loads(line))
        except json.JSONDecodeError:
            response = {"ok": False, "resolved": False, "executionFailure": True, "code": "REFERENCE_INPUT", "message": MESSAGES["json"]}
        except (ProtocolError, SAT.ReferenceInputError, COVERAGE.ReferenceInputError) as error:
            response = {"ok": False, "resolved": False, "executionFailure": True, "code": "REFERENCE_INPUT", "message": str(error)}
        print(json.dumps(response, allow_nan=False, separators=(",", ":")), flush=True)


if __name__ == "__main__":
    main()
