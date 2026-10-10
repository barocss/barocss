#!/usr/bin/env python3
"""Independent Decimal OBB SAT and recorded-normal face alignment inspector.

Reference quaternions are explicitly normalized, as in the adopted independent
observer. The unchanged Float64 helper rotates with its received quaternion.
The separate Float64 convention mirror below explains that difference; it is
not a producer import or a replacement collision detector. Hit normals remain
unchanged. Axis ties and small nonzero crosses do not prove unique features.
"""

import argparse
from decimal import Decimal, localcontext
import importlib.util
import json
import math
from pathlib import Path
import sys


sys.dont_write_bytecode = True
REFERENCE_PATH = Path(__file__).resolve().parent.parent / "physics-rigid-contact-reference" / "geometry-reference.py"
SPEC = importlib.util.spec_from_file_location("adopted_independent_box_math", REFERENCE_PATH)
REFERENCE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(REFERENCE)

ZERO = Decimal(0)
ONE = Decimal(1)
PRECISION_LIMIT = Decimal("1e-25")
COMPARE_LIMIT = Decimal("1e-12")
TIE_MARGIN_M = Decimal("1e-12")
NEAR_AXIS_LENGTH = Decimal("1e-12")
FACE_THRESHOLD = ONE - Decimal("1e-6")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def numeric_tree(value, decimal_strings=False):
    if isinstance(value, Decimal):
        if decimal_strings:
            return str(value)
        converted = float(value)
        require(math.isfinite(converted), "reference result exceeds finite JSON number range")
        return converted
    if isinstance(value, dict):
        return {key: numeric_tree(item, decimal_strings) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [numeric_tree(item, decimal_strings) for item in value]
    return value


def independent(request, precision):
    with localcontext() as context:
        context.prec = precision
        a, b = REFERENCE.box_from_state(request["a"]), REFERENCE.box_from_state(request["b"])
        hit = request["hit"]
        require(isinstance(hit, dict), "hit must be an object")
        normal = REFERENCE.vector(hit.get("normal"))
        REFERENCE.vector(hit.get("pointM"))
        helper_depth = REFERENCE.decimal_number(hit.get("penetration"))
        require(helper_depth >= ZERO and REFERENCE.length(normal) > ZERO, "invalid hit depth or zero normal")
        opposite = tuple(-value for value in normal)
        alignments = {"a": [REFERENCE.dot(axis, normal) for axis in a["axes"]],
                      "b": [REFERENCE.dot(axis, opposite) for axis in b["axes"]]}
        candidates = []
        for body_label, box in (("A", a), ("B", b)):
            for index, axis in enumerate(box["axes"]):
                candidates.append((f"{body_label}.face.{index}", "face", axis))
        for i, axis_a in enumerate(a["axes"]):
            for j, axis_b in enumerate(b["axes"]):
                candidates.append((f"A.edge.{i}xB.edge.{j}", "cross", REFERENCE.cross(axis_a, axis_b)))
        delta = REFERENCE.subtract(b["center"], a["center"])
        axes = []
        for label, family, raw in candidates:
            norm = REFERENCE.length(raw)
            record = {"label": label, "family": family, "rawAxis": raw, "rawLength": norm,
                      "exactZero": norm == ZERO, "nearParallel": family == "cross" and ZERO < norm < NEAR_AXIS_LENGTH,
                      "unitAxis": None, "radiusA": None, "radiusB": None,
                      "signedCenterProjection": None, "marginM": None}
            if norm != ZERO:
                unit = tuple(value / norm for value in raw)
                radius_a = REFERENCE.support_radius(a, unit)
                radius_b = REFERENCE.support_radius(b, unit)
                projection = REFERENCE.dot(delta, unit)
                record.update(unitAxis=unit, radiusA=radius_a, radiusB=radius_b,
                              signedCenterProjection=projection, marginM=radius_a + radius_b - abs(projection))
            axes.append(record)
        usable = [axis for axis in axes if not axis["exactZero"]]
        minimum = min(axis["marginM"] for axis in usable)
        tied = [axis["label"] for axis in usable if abs(axis["marginM"] - minimum) <= TIE_MARGIN_M]
        eligible = {key: [abs(value) >= FACE_THRESHOLD for value in values] for key, values in alignments.items()}
        return {"bases": {"a": a["axes"], "b": b["axes"]}, "faceAlignments": alignments,
                "faceEligible": eligible, "referenceFaceAvailable": any(eligible["a"]) or any(eligible["b"]),
                "quaternionNormErrors": {"a": a["norm_error"], "b": b["norm_error"]},
                "inputNormal": normal, "inputNormalLength": REFERENCE.length(normal),
                "helperDepthM": helper_depth, "candidateAxes": axes, "minMarginM": minimum,
                "penetrationM": max(ZERO, minimum), "tiedAxisLabels": tied,
                "exactZeroAxisLabels": [axis["label"] for axis in axes if axis["exactZero"]],
                "nearParallelAxisLabels": [axis["label"] for axis in axes if axis["nearParallel"]],
                "nearFaceThreshold": {key: [abs(abs(value) - FACE_THRESHOLD) <= COMPARE_LIMIT for value in values]
                                      for key, values in alignments.items()}}


def compare_precision(low, high):
    maximum = ZERO
    same_structure = True
    def visit(a, b):
        nonlocal maximum, same_structure
        if isinstance(a, Decimal) and isinstance(b, Decimal):
            maximum = max(maximum, abs(a-b))
        elif isinstance(a, dict) and isinstance(b, dict) and a.keys() == b.keys():
            for key in a:
                visit(a[key], b[key])
        elif isinstance(a, (tuple, list)) and isinstance(b, (tuple, list)) and len(a) == len(b):
            for x, y in zip(a, b):
                visit(x, y)
        elif a != b:
            same_structure = False
    with localcontext() as context:
        context.prec = 120
        visit(low, high)
    return same_structure and maximum <= PRECISION_LIMIT, maximum


def float_cross(a, b):
    return (a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0])


def float_basis(quaternion):
    # Mirrors math.rotate's operation order with the received, unnormalized q.
    q = tuple(float(value) for value in quaternion)
    result = []
    for v in ((1., 0., 0.), (0., 1., 0.), (0., 0., 1.)):
        t = tuple(value * 2 for value in float_cross(q[:3], v))
        product = float_cross(q[:3], t)
        result.append(tuple(v[i] + (t[i]*q[3] + product[i]) for i in range(3)))
    return result


def float_dot(a, b):
    value = 0.
    for x, y in zip(a, b):
        value += x*y
    return value


def float_convention(request):
    bases = {"a": float_basis(request["a"]["orientation"]), "b": float_basis(request["b"]["orientation"])}
    n = tuple(float(value) for value in request["hit"]["normal"])
    alignments = {"a": [float_dot(axis, n) for axis in bases["a"]],
                  "b": [float_dot(axis, tuple(-value for value in n)) for axis in bases["b"]]}
    skipped = []
    for i, axis_a in enumerate(bases["a"]):
        for j, axis_b in enumerate(bases["b"]):
            if math.hypot(*float_cross(axis_a, axis_b)) < 1e-12:
                skipped.append(f"A.edge.{i}xB.edge.{j}")
    require(all(math.isfinite(value) for values in alignments.values() for value in values), "nonfinite Float64 alignment mirror")
    return {"bases": bases, "faceAlignments": alignments, "crossAxisLabelsBelowHelperCutoff": skipped,
            "convention": "received quaternion; Float64 rotate/dot operation mirror; actual Node helper remains separate"}


def evaluate(request):
    require(isinstance(request, dict) and all(key in request for key in ("a", "b", "hit")), "request requires a, b, and hit")
    low, high = independent(request, 80), independent(request, 120)
    precision_resolved, maximum_error = compare_precision(low, high)
    mirror = float_convention(request)
    with localcontext() as context:
        context.prec = 120
        depth_error = abs(high["penetrationM"] - high["helperDepthM"])
        alignment_errors = {key: [abs(reference - Decimal.from_float(actual))
                                  for reference, actual in zip(high["faceAlignments"][key], mirror["faceAlignments"][key])]
                            for key in ("a", "b")}
        max_alignment_error = max(value for values in alignment_errors.values() for value in values)
        comparisons = {"depthAbsoluteErrorM": depth_error, "depthAgrees": depth_error <= COMPARE_LIMIT,
                       "alignmentAbsoluteErrors": alignment_errors, "alignmentAgrees": max_alignment_error <= COMPARE_LIMIT,
                       "maxAlignmentAbsoluteError": max_alignment_error,
                       "nonNullHitSeparationAgrees": high["minMarginM"] >= -COMPARE_LIMIT}
    compared = comparisons["depthAgrees"] and comparisons["alignmentAgrees"] and comparisons["nonNullHitSeparationAgrees"]
    mismatches = [name for name in ("depthAgrees", "alignmentAgrees", "nonNullHitSeparationAgrees") if not comparisons[name]]
    return {"ok": precision_resolved, "resolved": precision_resolved and compared,
            "referencePrecisionResolved": precision_resolved,
            "precisionMaximumAbsoluteError": float(maximum_error), "precisionMaximumAbsoluteErrorDecimal": str(maximum_error),
            "faceAlignments": numeric_tree(high["faceAlignments"]), "faceAlignmentsDecimal": numeric_tree(high["faceAlignments"], True),
            "reference": numeric_tree(high), "referenceDecimals": numeric_tree(high, True),
            "comparison": numeric_tree(comparisons), "comparisonDecimals": numeric_tree(comparisons, True),
            "comparisonMismatches": mismatches, "floatConventionMirror": mirror,
            "ambiguity": {"tiedAxisLabels": high["tiedAxisLabels"], "tieMarginToleranceM": float(TIE_MARGIN_M),
                          "nearParallelAxisLabels": high["nearParallelAxisLabels"],
                          "nearAxisLengthThreshold": float(NEAR_AXIS_LENGTH), "nearFaceThreshold": high["nearFaceThreshold"],
                          "uniquePhysicalFeatureClaimed": False},
            "inputHit": request["hit"],
            "conventions": {"quaternion": "Decimal reference normalizes decoded [x,y,z,w]; actual Float64 helper receives its original q",
                            "normal": "input hit.normal is preserved; B face alignment uses -normal",
                            "axes": "15 labelled axes; exact zero only omitted from SAT minimum; all nonzero crosses retained",
                            "margin": "negative SAT margin is a projection gap, not Euclidean separation distance",
                            "ok": "validated input and precision; resolved additionally requires stated helper comparisons"},
            "violations": [] if precision_resolved else ["Decimal80/120 geometry precision unresolved"]}


def control_body(center=(0, 0, 0), quaternion=(0, 0, 0, 1), half=(.25, .25, .25)):
    return {"id": "control", "kind": "dynamic", "shape": {"kind": "box", "halfExtentsM": list(half)},
            "positionM": list(center), "orientation": list(quaternion), "velocityMps": [0, 0, 0], "angularVelocityRadps": [0, 0, 0]}


def self_check():
    controls = []
    def record(name, passed):
        controls.append({"control": name, "passed": bool(passed)})
    def inspect(a, b, normal, depth):
        return evaluate({"a": a, "b": b, "hit": {"normal": list(normal), "pointM": [0, 0, 0], "penetration": depth}})
    identity = control_body()
    face = inspect(identity, control_body((0, .49, 0)), (0, 1, 0), .01)
    record("aligned_face_depth_and_alignment", face["ok"] and face["resolved"] and face["reference"]["referenceFaceAvailable"])
    record("all15_labels_including_zero_crosses", len(face["reference"]["candidateAxes"]) == 15
           and len(face["reference"]["exactZeroAxisLabels"]) == 3)
    record("equal_axes_are_reported_as_tied", len(face["ambiguity"]["tiedAxisLabels"]) > 1)
    angle = math.pi / 4
    yaw = (0, math.sin(angle/2), 0, math.cos(angle/2))
    rotated = inspect(identity, control_body((0, .49, 0), yaw), (0, 1, 0), .01)
    record("rotated_face_reference", rotated["resolved"] and rotated["reference"]["referenceFaceAvailable"])
    tiny = (0, math.sin(1e-13/2), 0, math.cos(1e-13/2))
    near = inspect(identity, control_body((0, .49, 0), tiny), (0, 1, 0), .01)
    record("nonzero_near_parallel_cross_is_retained", any(axis["nearParallel"] and axis["unitAxis"] is not None
           for axis in near["reference"]["candidateAxes"]))
    record("Float64_cutoff_is_separate_diagnostic", len(near["floatConventionMirror"]["crossAxisLabelsBelowHelperCutoff"])
           > len(near["reference"]["exactZeroAxisLabels"]))
    contained = inspect(identity, control_body(half=(.1, .1, .1)), (1, 0, 0), .35)
    record("containment_uses_escape_depth_not_intersection_width", contained["resolved"]
           and abs(contained["reference"]["penetrationM"] - .35) < 1e-12)
    qx = (math.sin(angle/2), 0, 0, math.cos(angle/2))
    edge_n = (-1/math.sqrt(3), 1/math.sqrt(3), -1/math.sqrt(3))
    edge_depth = .5*(1+math.sqrt(2))/math.sqrt(3) - .69
    edge = inspect(control_body(quaternion=qx), control_body(tuple(.69*x for x in edge_n), yaw), edge_n, edge_depth)
    record("edge_axis_minimum_is_not_a_face", edge["resolved"] and not edge["reference"]["referenceFaceAvailable"]
           and "A.edge.1xB.edge.0" in edge["reference"]["tiedAxisLabels"])
    mismatch = inspect(identity, control_body((0, .49, 0)), (0, 1, 0), .02)
    record("helper_depth_mismatch_is_evidence_not_input_failure", mismatch["ok"] and not mismatch["resolved"]
           and "depthAgrees" in mismatch["comparisonMismatches"])
    request = {"a": identity, "b": control_body((0, .49, 0)), "hit": {"normal": [0, 1, 0], "pointM": [0, 0, 0], "penetration": .01}}
    low, high = independent(request, 80), independent(request, 120)
    record("Decimal80_120_component_agreement", compare_precision(low, high)[0])
    with localcontext() as context:
        context.prec = 120
        low["minMarginM"] += Decimal("1e-24")
    record("precision_disagreement_is_not_hidden", not compare_precision(low, high)[0])
    passed = all(item["passed"] for item in controls)
    return {"result": "PASS" if passed else "FAIL", "controls": controls}, 0 if passed else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-check", action="store_true")
    arguments = parser.parse_args()
    if arguments.self_check:
        result, code = self_check()
        print(json.dumps(result, allow_nan=False))
        return code
    for line in sys.stdin:
        try:
            response = evaluate(json.loads(line))
        except (REFERENCE.ReferenceInputError, ValueError, TypeError, KeyError, ArithmeticError) as error:
            response = {"ok": False, "resolved": False, "referencePrecisionResolved": False, "violations": [str(error)]}
        print(json.dumps(response, allow_nan=False), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
