#!/usr/bin/env python3
"""Independent Decimal OBB reference for the bounded eight-cube fixture.

No producer module is imported. Input numbers are decoded as binary floats, then
converted with Decimal.from_float. Two precision passes must agree. SAT depth
uses directional escape distance, including containment, not intersection width.
An almost-parallel nonzero edge axis is normalized and retained.
"""

import argparse
from decimal import Decimal, localcontext
from itertools import combinations, product
import json
import math
import sys


D = Decimal
ZERO = D(0)
ONE = D(1)
TWO = D(2)
TOUCH_M = D("1e-10")
NORM_LIMIT = D("1e-9")
PRECISION_LIMIT = D("1e-12")
NEAR_PARALLEL = D("1e-12")
# The contract admits this binary cosine constant. Geometry uses Decimal only.
TILT_COS_LIMIT = D.from_float(math.cos(math.pi / 180))
CUBE_IDS = tuple(f"b{i}" for i in range(8))


class ReferenceInputError(ValueError):
    pass


def decimal_number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ReferenceInputError("expected a finite number")
    try:
        decoded = float(value)
    except (ValueError, OverflowError) as error:
        raise ReferenceInputError("expected a finite number") from error
    if not math.isfinite(decoded):
        raise ReferenceInputError("expected a finite number")
    return D.from_float(decoded)


def vector(values, size=3):
    if not isinstance(values, list) or len(values) != size:
        raise ReferenceInputError(f"expected a vector with {size} components")
    return tuple(decimal_number(value) for value in values)


def dot(a, b):
    return sum((x * y for x, y in zip(a, b)), ZERO)


def subtract(a, b):
    return tuple(x - y for x, y in zip(a, b))


def length(a):
    return dot(a, a).sqrt()


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0])


def rotation_axes(values):
    """Decode active, right-handed, local-to-world [x,y,z,w] rotation."""
    quaternion = vector(values, 4)
    norm = length(quaternion)
    if norm == ZERO:
        raise ReferenceInputError("zero quaternion")
    error = abs(norm - ONE)
    if error > NORM_LIMIT:
        raise ReferenceInputError(f"quaternion norm error exceeds 1e-9: {error}")
    x, y, z, w = (component / norm for component in quaternion)
    axes = (
        (ONE - TWO * (y*y + z*z), TWO * (x*y + w*z), TWO * (x*z - w*y)),
        (TWO * (x*y - w*z), ONE - TWO * (x*x + z*z), TWO * (y*z + w*x)),
        (TWO * (x*z + w*y), TWO * (y*z - w*x), ONE - TWO * (x*x + y*y)),
    )
    return axes, error


def box_from_state(body):
    if not isinstance(body, dict):
        raise ReferenceInputError("body must be an object")
    shape = body.get("shape", {})
    if not isinstance(shape, dict) or shape.get("kind") != "box":
        raise ReferenceInputError("reference supports box shapes only")
    half = vector(shape.get("halfExtentsM"))
    if min(half) <= ZERO:
        raise ReferenceInputError("box half extents must be positive")
    axes, norm_error = rotation_axes(body.get("orientation"))
    return {"id": body.get("id"), "center": vector(body.get("positionM")),
            "half": half, "axes": axes, "norm_error": norm_error,
            "linear": vector(body.get("velocityMps")),
            "angular": vector(body.get("angularVelocityRadps"))}


def state_boxes(state):
    if not isinstance(state, dict) or not isinstance(state.get("bodies"), list):
        raise ReferenceInputError("state must contain a bodies array")
    by_id = {}
    for raw in state["bodies"]:
        if not isinstance(raw, dict) or not isinstance(raw.get("id"), str):
            raise ReferenceInputError("body requires a string id")
        body_id = raw["id"]
        if body_id in by_id:
            raise ReferenceInputError(f"duplicate body id: {body_id}")
        by_id[body_id] = raw
    if set(by_id) != set(CUBE_IDS) | {"floor"}:
        raise ReferenceInputError("expected exactly b0 through b7 and floor")
    decoded = {body_id: box_from_state(raw) for body_id, raw in by_id.items()}
    for body_id in CUBE_IDS:
        if by_id[body_id].get("kind") != "dynamic":
            raise ReferenceInputError(f"expected dynamic cube: {body_id}")
        if decoded[body_id]["half"] != (D(".25"),) * 3:
            raise ReferenceInputError(f"expected 0.5 m cube: {body_id}")
    floor = decoded["floor"]
    if by_id["floor"].get("kind") != "static":
        raise ReferenceInputError("expected static floor")
    expected_half = tuple(decimal_number(value) for value in [2, .1, 2])
    expected_center = tuple(decimal_number(value) for value in [0, -.1, 0])
    identity_axes = ((ONE, ZERO, ZERO), (ZERO, ONE, ZERO), (ZERO, ZERO, ONE))
    if floor["half"] != expected_half or floor["center"] != expected_center:
        raise ReferenceInputError("finite floor geometry differs from fixture")
    if max(abs(x - y) for a, b in zip(floor["axes"], identity_axes)
           for x, y in zip(a, b)) > PRECISION_LIMIT:
        raise ReferenceInputError("finite floor rotation differs from fixture")
    return decoded


def support_radius(box, axis):
    return sum((half * abs(dot(local, axis))
                for half, local in zip(box["half"], box["axes"])), ZERO)


def sat_depth(a, b):
    """Return nonnegative least translation depth, signed SAT margin, axis count.

    A negative margin is a projection gap, not Euclidean separation distance.
    Exact zero cross products are skipped. No radius inflation is used.
    """
    axes = list(a["axes"]) + list(b["axes"])
    near_parallel_count = 0
    for a_axis in a["axes"]:
        for b_axis in b["axes"]:
            edge_axis = cross(a_axis, b_axis)
            axis_length = length(edge_axis)
            if axis_length == ZERO:
                continue
            if axis_length < NEAR_PARALLEL:
                near_parallel_count += 1
            axes.append(tuple(value / axis_length for value in edge_axis))
    delta = subtract(b["center"], a["center"])
    margins = []
    for axis in axes:
        # Face axes also get explicit normalization, including rounding drift.
        norm = length(axis)
        unit = tuple(value / norm for value in axis)
        margins.append(support_radius(a, unit) + support_radius(b, unit)
                       - abs(dot(delta, unit)))
    margin = min(margins)
    return max(ZERO, margin), margin, near_parallel_count


def vertices(box):
    result = []
    for signs in product((-ONE, ONE), repeat=3):
        result.append(tuple(box["center"][coordinate] + sum(
            (sign * half * axis[coordinate]
             for sign, half, axis in zip(signs, box["half"], box["axes"])), ZERO)
            for coordinate in range(3)))
    return result


def body_geometry(box, floor):
    points = vertices(box)
    low = tuple(min(point[index] for point in points) for index in range(3))
    high = tuple(max(point[index] for point in points) for index in range(3))
    floor_low = subtract(floor["center"], floor["half"])
    floor_high = tuple(x + y for x, y in zip(floor["center"], floor["half"]))
    contained = all(low[index] >= floor_low[index] - TOUCH_M
                    and high[index] <= floor_high[index] + TOUCH_M
                    for index in (0, 2))
    return {"vertices": points, "halfspace": max(ZERO, -low[1]),
            "tilt_cos": max(-ONE, min(ONE, box["axes"][1][1])),
            "contained": contained,
            "escaped": high[1] < floor_low[1] - TOUCH_M}


def evaluate_precision(request, precision):
    with localcontext() as context:
        context.prec = precision
        current = state_boxes(request.get("state"))
        initial = state_boxes(request.get("initial"))
        time_seconds = decimal_number(request.get("timeSeconds"))
        if time_seconds < ZERO:
            raise ReferenceInputError("timeSeconds must be nonnegative")
        baseline_raw = request.get("referenceAt8s")
        baseline = state_boxes(baseline_raw) if baseline_raw is not None else None
        missing_baseline = time_seconds >= D(8) and baseline is None
        floor = current["floor"]
        geometries = {body_id: body_geometry(current[body_id], floor)
                      for body_id in CUBE_IDS}
        pairs = {}
        floor_pairs = {}
        near_parallel_count = 0
        for a_id, b_id in combinations(CUBE_IDS, 2):
            depth, margin, count = sat_depth(current[a_id], current[b_id])
            pairs[(a_id, b_id)] = (depth, margin)
            near_parallel_count += count
        for body_id in CUBE_IDS:
            depth, margin, count = sat_depth(floor, current[body_id])
            floor_pairs[("floor", body_id)] = (depth, margin)
            near_parallel_count += count
        contacts = request["state"].get("contacts")
        if not isinstance(contacts, list):
            raise ReferenceInputError("state must contain a contacts array")
        contact_pairs = set()
        for contact in contacts:
            if not isinstance(contact, dict):
                raise ReferenceInputError("contact must be an object")
            a_id, b_id = contact.get("aId"), contact.get("bId")
            if not isinstance(a_id, str) or not isinstance(b_id, str):
                raise ReferenceInputError("contact requires aId and bId")
            contact_pairs.add(frozenset((a_id, b_id)))
        overlap_without_contact = sum(
            margin > TOUCH_M and frozenset(pair) not in contact_pairs
            for pair, (_, margin) in {**pairs, **floor_pairs}.items())
        horizontal = max(length((current[body_id]["center"][0] - initial[body_id]["center"][0],
                                 current[body_id]["center"][2] - initial[body_id]["center"][2]))
                         for body_id in CUBE_IDS)
        vertical = (max(abs(current[body_id]["center"][1] - baseline[body_id]["center"][1])
                        for body_id in CUBE_IDS) if baseline is not None else None)
        metrics = {
            "maxPairPenetrationM": max(depth for depth, _ in pairs.values()),
            "maxFloorPenetrationM": max(depth for depth, _ in floor_pairs.values()),
            "maxHalfspaceIntrusionM": max(item["halfspace"] for item in geometries.values()),
            "maxQuaternionNormError": max(box["norm_error"] for box in current.values()),
            "minTiltCosine": min(item["tilt_cos"] for item in geometries.values()),
            "maxHorizontalDriftM": horizontal,
            "maxVerticalDriftM": vertical,
            "maxLinearSpeedMps": max(length(current[body_id]["linear"]) for body_id in CUBE_IDS),
            "maxAngularSpeedRadps": max(length(current[body_id]["angular"]) for body_id in CUBE_IDS),
            "footprintContained": all(item["contained"] for item in geometries.values()),
            "escapedBelowFloor": any(item["escaped"] for item in geometries.values()),
            "nearParallelAxisCount": near_parallel_count,
            "overlapWithoutContactCount": overlap_without_contact,
        }
        return {"metrics": metrics, "pairs": pairs, "floor_pairs": floor_pairs,
                "geometries": geometries, "time": time_seconds,
                "missing_baseline": missing_baseline}


def precision_agrees(low, high):
    for name in ("maxPairPenetrationM", "maxFloorPenetrationM",
                 "maxHalfspaceIntrusionM", "minTiltCosine",
                 "maxQuaternionNormError", "maxHorizontalDriftM",
                 "maxLinearSpeedMps", "maxAngularSpeedRadps"):
        if abs(low["metrics"][name] - high["metrics"][name]) > PRECISION_LIMIT:
            return False
    if high["metrics"]["maxVerticalDriftM"] is not None:
        if abs(low["metrics"]["maxVerticalDriftM"] - high["metrics"]["maxVerticalDriftM"]) > PRECISION_LIMIT:
            return False
    for group in ("pairs", "floor_pairs"):
        if any(abs(low[group][pair][1] - high[group][pair][1]) > PRECISION_LIMIT
               for pair in high[group]):
            return False
    for body_id in CUBE_IDS:
        for name in ("halfspace", "tilt_cos"):
            if abs(low["geometries"][body_id][name] - high["geometries"][body_id][name]) > PRECISION_LIMIT:
                return False
    for name in ("footprintContained", "escapedBelowFloor", "nearParallelAxisCount",
                 "overlapWithoutContactCount"):
        if low["metrics"][name] != high["metrics"][name]:
            return False
    return True


def evaluate(request):
    if not isinstance(request, dict):
        raise ReferenceInputError("request must be an object")
    low = evaluate_precision(request, 80)
    high = evaluate_precision(request, 120)
    with localcontext() as context:
        context.prec = 120
        resolved = precision_agrees(low, high) and not high["missing_baseline"]
        metrics = high["metrics"]
        violations = []
        if not resolved:
            violations.append("reference_unresolved: missing exact 8 s baseline or precision disagreement")
        for name in ("maxPairPenetrationM", "maxFloorPenetrationM", "maxHalfspaceIntrusionM"):
            if metrics[name] > D(".002"):
                violations.append(f"{name} exceeds 0.002 m")
        if not metrics["footprintContained"]:
            violations.append("cube footprint is outside the finite floor")
        if metrics["escapedBelowFloor"]:
            violations.append("cube is wholly below the finite floor")
        if high["time"] >= D(8):
            for name, limit, units in (("maxVerticalDriftM", D(".005"), "m"),
                                       ("maxHorizontalDriftM", D(".01"), "m"),
                                       ("maxLinearSpeedMps", D(".02"), "m/s"),
                                       ("maxAngularSpeedRadps", D(".02"), "rad/s")):
                if metrics[name] is not None and metrics[name] > limit:
                    violations.append(f"{name} exceeds {limit} {units}")
            if metrics["minTiltCosine"] < TILT_COS_LIMIT:
                violations.append("upright tilt exceeds one degree")
        public = {name: float(value) if isinstance(value, D) else value
                  for name, value in metrics.items() if name != "minTiltCosine"}
        public["maxTiltRad"] = math.acos(float(metrics["minTiltCosine"]))
        public["referencePrecisionResolved"] = resolved
        # Contact presence is diagnostic only. Normals and impulses are unmeasured.
        return {"ok": True, "metrics": public, "violations": violations}


def control_box(center=(0, 0, 0), orientation=(0, 0, 0, 1), half=(.25, .25, .25)):
    return box_from_state({"id": "control", "shape": {"kind": "box", "halfExtentsM": list(half)},
                           "positionM": list(center), "orientation": list(orientation),
                           "velocityMps": [0, 0, 0], "angularVelocityRadps": [0, 0, 0]})


def self_check():
    controls = []

    def record(name, actual, expected, tolerance=D("1e-12")):
        error = abs(actual - expected)
        controls.append({"control": name, "actual": float(actual), "expectedApprox": float(expected),
                         "absoluteError": float(error), "passed": error <= tolerance})

    for precision in (80, 120):
        with localcontext() as context:
            context.prec = precision
            prefix = f"decimal{precision}:"
            a = control_box()
            for name, center, expected in (
                ("touch", (.5, 0, 0), ZERO),
                ("separated", (.501, 0, 0), ZERO),
                ("penetrating", (.499, 0, 0), D(".001")),
                ("coincident", (0, 0, 0), D(".5")),
                ("two_axis_offset", (.45, .45, 0), D(".05"))):
                record(prefix + name, sat_depth(a, control_box(center))[0], expected)
            record(prefix + "containment", sat_depth(a, control_box(half=(.1, .1, .1)))[0], D(".35"))
            record(prefix + "separation_margin", sat_depth(a, control_box((.501, 0, 0)))[1], D("-.001"))
            floor = control_box((0, -.1, 0), half=(2, .1, 2))
            record(prefix + "upright_floor_touch", body_geometry(control_box((0, .25, 0)), floor)["halfspace"], ZERO)
            record(prefix + "upright_floor_intrusion", body_geometry(control_box((0, .249, 0)), floor)["halfspace"], D(".001"))
            angle = math.pi / 4
            tilted = control_box((0, .25, 0), (0, 0, math.sin(angle / 2), math.cos(angle / 2)))
            tilted_geometry = body_geometry(tilted, floor)
            record(prefix + "tilted_floor_intrusion", tilted_geometry["halfspace"], (TWO.sqrt() - ONE) / D(4))
            record(prefix + "tilt_cosine", tilted_geometry["tilt_cos"], ONE / TWO.sqrt())
            lifted = control_box((0, math.sqrt(2) / 4, 0), (0, 0, math.sin(angle / 2), math.cos(angle / 2)))
            record(prefix + "tilted_lifted_floor_touch", body_geometry(lifted, floor)["halfspace"], ZERO)
            upside_down = control_box((0, .25, 0), (1, 0, 0, 0))
            record(prefix + "upside_down_cosine", body_geometry(upside_down, floor)["tilt_cos"], -ONE)
            record(prefix + "upside_down_floor_touch", body_geometry(upside_down, floor)["halfspace"], ZERO)
            outside = control_box((2.251, .25, 0))
            record(prefix + "outside_finite_floor_footprint", D(not body_geometry(outside, floor)["contained"]), ONE)
            below = control_box((0, -.451, 0))
            record(prefix + "whole_cube_below_floor", D(body_geometry(below, floor)["escaped"]), ONE)
            record(prefix + "below_floor_sat_separated", sat_depth(floor, below)[0], ZERO)
            record(prefix + "below_floor_halfspace_intrusion", body_geometry(below, floor)["halfspace"], D(".701"))
            near = control_box((.499, 0, 0), (0, math.sin(1e-13 / 2), 0, math.cos(1e-13 / 2)))
            near_depth, _, near_count = sat_depth(a, near)
            record(prefix + "near_parallel_depth", near_depth, D(".001") + D(".25") * D("1e-13"))
            record(prefix + "near_parallel_axes_retained", D(near_count > 0), ONE)
            sign_flip = control_box((.499, 0, 0), (0, -math.sin(1e-13 / 2), 0, -math.cos(1e-13 / 2)))
            record(prefix + "quaternion_sign", sat_depth(a, sign_flip)[0], near_depth, D("1e-70"))
            raw_norm = rotation_axes([0, 0, 0, 1 + 5e-10])[1]
            record(prefix + "quaternion_normalization", raw_norm, D("5e-10"))
            for name, quaternion in (("zero_quaternion_rejected", [0, 0, 0, 0]),
                                     ("nonunit_quaternion_rejected", [0, 0, 0, 1.000000002])):
                try:
                    rotation_axes(quaternion)
                    rejected = False
                except ReferenceInputError:
                    rejected = True
                record(prefix + name, D(rejected), ONE)

    initial_bodies = []
    for index in range(8):
        initial_bodies.append({"id": f"b{index}", "kind": "dynamic",
                               "shape": {"kind": "box", "halfExtentsM": [.25, .25, .25]},
                               "positionM": [0, .25 + .5 * index, 0], "orientation": [0, 0, 0, 1],
                               "velocityMps": [0, 0, 0], "angularVelocityRadps": [0, 0, 0]})
    initial_bodies.append({"id": "floor", "kind": "static",
                           "shape": {"kind": "box", "halfExtentsM": [2, .1, 2]},
                           "positionM": [0, -.1, 0], "orientation": [0, 0, 0, 1],
                           "velocityMps": [0, 0, 0], "angularVelocityRadps": [0, 0, 0]})
    state = {"bodies": initial_bodies, "contacts": []}
    request = {"state": state, "initial": state, "timeSeconds": 8, "referenceAt8s": state}
    result = evaluate(request)
    internal = evaluate_precision(request, 80)
    record("stack8_pair_count", D(len(internal["pairs"])), D(28))
    record("stack8_floor_count", D(len(internal["floor_pairs"])), D(8))
    record("stack8_initial_penetration", D.from_float(result["metrics"]["maxPairPenetrationM"]), ZERO)
    record("stack8_initial_floor_intrusion", D.from_float(result["metrics"]["maxHalfspaceIntrusionM"]), ZERO)
    record("stack8_reference_resolved", D(result["metrics"]["referencePrecisionResolved"]), ONE)
    record("stack8_no_violations", D(not result["violations"]), ONE)
    missing = evaluate({"state": state, "initial": state, "timeSeconds": 8, "referenceAt8s": None})
    record("missing_8s_baseline_unresolved", D(not missing["metrics"]["referencePrecisionResolved"]), ONE)
    rotated = json.loads(json.dumps(state))
    for index, body in enumerate(rotated["bodies"][:-1]):
        yaw = (-1) ** index * .05
        body["positionM"][0] = index % 2 * .05
        body["orientation"] = [0, math.sin(yaw / 2), 0, math.cos(yaw / 2)]
    rotated_result = evaluate({"state": rotated, "initial": rotated,
                               "timeSeconds": 0, "referenceAt8s": None})
    record("yaw_stack_initial_penetration", D.from_float(rotated_result["metrics"]["maxPairPenetrationM"]), ZERO)
    record("yaw_stack_initial_tilt", D.from_float(rotated_result["metrics"]["maxTiltRad"]), ZERO)
    record("yaw_stack_no_violations", D(not rotated_result["violations"]), ONE)
    active = json.loads(json.dumps(state))
    top = active["bodies"][7]
    angle = math.pi / 90  # Two degrees; lifted clear of adjacent cube.
    top["positionM"] = [.011, 4.5, 0]
    top["orientation"] = [0, 0, math.sin(angle / 2), math.cos(angle / 2)]
    top["velocityMps"] = [.021, 0, 0]
    top["angularVelocityRadps"] = [0, .021, 0]
    before = evaluate({"state": active, "initial": state, "timeSeconds": 7, "referenceAt8s": None})
    record("pre8_speed_tilt_drift_only_recorded", D(not before["violations"]), ONE)
    after = evaluate({"state": active, "initial": state, "timeSeconds": 8, "referenceAt8s": active})
    for name in ("maxHorizontalDriftM", "maxLinearSpeedMps", "maxAngularSpeedRadps", "upright tilt"):
        record("at8_gate:" + name, D(any(name in entry for entry in after["violations"])), ONE)
    later = json.loads(json.dumps(state))
    later["bodies"][7]["positionM"][1] += .006
    later_result = evaluate({"state": later, "initial": state, "timeSeconds": 9, "referenceAt8s": state})
    record("post8_vertical_drift_gate", D(any("maxVerticalDriftM" in entry
                                             for entry in later_result["violations"])), ONE)
    disagreed = evaluate_precision(request, 120)
    disagreed["metrics"]["maxFloorPenetrationM"] += D("1e-11")
    record("precision_disagreement_unresolved", D(not precision_agrees(internal, disagreed)), ONE)
    passed = all(control["passed"] for control in controls)
    return {"result": "PASS" if passed else "FAIL", "controls": controls}, passed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-check", action="store_true")
    arguments = parser.parse_args()
    if arguments.self_check:
        result, passed = self_check()
        print(json.dumps(result, allow_nan=False))
        return 0 if passed else 1
    for line in sys.stdin:
        try:
            request = json.loads(line)
            response = evaluate(request)
        except (ReferenceInputError, ValueError, TypeError, KeyError, ArithmeticError) as error:
            response = {"ok": False, "metrics": None, "violations": [str(error)]}
        print(json.dumps(response, allow_nan=False), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
