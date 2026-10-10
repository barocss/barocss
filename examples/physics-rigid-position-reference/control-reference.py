#!/usr/bin/env python3
"""Offline Decimal observer for the original one-step STACK2_CONTROL fixture.

The immutable eight-cube observer supplies primitive geometry functions only.
This file imports no producer and executes no world. It checks two dynamic
cubes and the finite floor. One-step speed and upright tilt are observations.
"""

import argparse
import copy
from decimal import Decimal, localcontext
import importlib.util
import json
import math
from pathlib import Path
import sys


sys.dont_write_bytecode = True
REFERENCE_PATH = Path(__file__).resolve().parent.parent / "physics-rigid-contact-reference" / "geometry-reference.py"
SPEC = importlib.util.spec_from_file_location("immutable_contact_geometry", REFERENCE_PATH)
REFERENCE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(REFERENCE)

IDS = ("b0", "b1", "floor")
PAIRS = (("b0", "b1"), ("b0", "floor"), ("b1", "floor"))
INITIAL_POSITIONS = {"b0": [0, .25, 0], "b1": [.05, .75, 0], "floor": [0, -.1, 0]}
ZERO = Decimal(0)
QUALITY_M = Decimal(".002")
POSITION_LIMIT_M = Decimal(10000)
VELOCITY_LIMIT = Decimal(1000)


def require(condition, message):
    if not condition:
        raise REFERENCE.ReferenceInputError(message)


def require_finite(value, location):
    if isinstance(value, float):
        require(math.isfinite(value), f"nonfinite original field: {location}")
    elif isinstance(value, dict):
        for name, item in value.items():
            require_finite(item, f"{location}.{name}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            require_finite(item, f"{location}[{index}]")


def decode_state(state, initial):
    name = "initial" if initial else "state"
    require(isinstance(state, dict), f"{name} must be a copied PhysicsState")
    require_finite(state, name)
    step = 0 if initial else 1
    require(type(state.get("stepIndex")) is int and state["stepIndex"] == step,
            f"{name}.stepIndex must be exactly {step}")
    time = state.get("timeSeconds")
    require(type(time) in (int, float) and float(time) == step / 120,
            f"{name}.timeSeconds must be exactly {step}/120")
    for field in ("contacts", "events", "joints", "ccdHits"):
        require(isinstance(state.get(field), list), f"{name}.{field} must be an array")
    require(isinstance(state.get("pairStats"), dict), f"{name}.pairStats must be an object")
    bodies = state.get("bodies")
    require(isinstance(bodies, list) and len(bodies) == 3,
            f"{name} must contain exactly b0, b1, and floor")
    require(all(isinstance(body, dict) for body in bodies), f"invalid body in {name}")
    require(tuple(body.get("id") for body in bodies) == IDS, f"{name} body order must be b0,b1,floor")
    decoded = {}
    identity_axes = ((Decimal(1), ZERO, ZERO), (ZERO, Decimal(1), ZERO), (ZERO, ZERO, Decimal(1)))
    for raw in bodies:
        body_id = raw["id"]
        box = REFERENCE.box_from_state(raw)
        expected_kind = "static" if body_id == "floor" else "dynamic"
        require(raw.get("kind") == expected_kind, f"unexpected body kind: {body_id}")
        expected_half = [2, .1, 2] if body_id == "floor" else [.25, .25, .25]
        require(box["half"] == tuple(REFERENCE.decimal_number(value) for value in expected_half),
                f"shape differs from original STACK2_CONTROL: {body_id}")
        require(max(abs(value) for value in box["center"]) <= POSITION_LIMIT_M,
                f"position component exceeds 10000 m: {body_id}")
        require(max(abs(value) for value in box["linear"]) <= VELOCITY_LIMIT,
                f"linear velocity component exceeds 1000 m/s: {body_id}")
        require(max(abs(value) for value in box["angular"]) <= VELOCITY_LIMIT,
                f"angular velocity component exceeds 1000 rad/s: {body_id}")
        if initial or body_id == "floor":
            expected_position = tuple(REFERENCE.decimal_number(value) for value in INITIAL_POSITIONS[body_id])
            require(box["center"] == expected_position, f"fixed initial/floor position differs: {body_id}")
            require(max(abs(x - y) for axis, expected in zip(box["axes"], identity_axes)
                        for x, y in zip(axis, expected)) <= REFERENCE.PRECISION_LIMIT,
                    f"fixed initial/floor orientation differs: {body_id}")
            require(box["linear"] == (ZERO,) * 3 and box["angular"] == (ZERO,) * 3,
                    f"fixed initial/floor velocity differs: {body_id}")
        decoded[body_id] = box
    return decoded


def evaluate_precision(request, precision):
    with localcontext() as context:
        context.prec = precision
        current = decode_state(request.get("state"), initial=False)
        initial = decode_state(request.get("initial"), initial=True)
        pair_results = {pair: REFERENCE.sat_depth(current[pair[0]], current[pair[1]]) for pair in PAIRS}
        geometry = {body_id: REFERENCE.body_geometry(current[body_id], current["floor"])
                    for body_id in ("b0", "b1")}
        metrics = {
            "maxPairPenetrationM": pair_results[("b0", "b1")][0],
            "maxFloorPenetrationM": max(pair_results[(body_id, "floor")][0] for body_id in ("b0", "b1")),
            "maxHalfspaceIntrusionM": max(item["halfspace"] for item in geometry.values()),
            "maxQuaternionNormError": max(box["norm_error"] for box in current.values()),
            "maxPositionComponentM": max(abs(value) for box in current.values() for value in box["center"]),
            "maxLinearComponentMps": max(abs(value) for box in current.values() for value in box["linear"]),
            "maxAngularComponentRadps": max(abs(value) for box in current.values() for value in box["angular"]),
            "maxLinearSpeedMps": max(REFERENCE.length(current[body_id]["linear"]) for body_id in ("b0", "b1")),
            "maxAngularSpeedRadps": max(REFERENCE.length(current[body_id]["angular"]) for body_id in ("b0", "b1")),
            "minTiltCosine": min(item["tilt_cos"] for item in geometry.values()),
            "maxHorizontalDriftM": max(REFERENCE.length((current[body_id]["center"][0] - initial[body_id]["center"][0],
                                                        current[body_id]["center"][2] - initial[body_id]["center"][2]))
                                       for body_id in ("b0", "b1")),
            "maxVerticalDisplacementM": max(abs(current[body_id]["center"][1] - initial[body_id]["center"][1])
                                            for body_id in ("b0", "b1")),
            "footprintContained": all(item["contained"] for item in geometry.values()),
            "escapedBelowFloor": any(item["escaped"] for item in geometry.values()),
            "nearParallelAxisCount": sum(result[2] for result in pair_results.values()),
        }
        return {"metrics": metrics, "pairs": pair_results, "geometry": geometry}


def precision_agrees(low, high):
    with localcontext() as context:
        context.prec = 120
        for name, value in high["metrics"].items():
            if isinstance(value, Decimal):
                if abs(low["metrics"][name] - value) > REFERENCE.PRECISION_LIMIT:
                    return False
            elif low["metrics"][name] != value:
                return False
        for pair in PAIRS:
            if any(abs(low["pairs"][pair][index] - high["pairs"][pair][index]) > REFERENCE.PRECISION_LIMIT
                   for index in (0, 1)):
                return False
            if (low["pairs"][pair][1] > REFERENCE.TOUCH_M) != (high["pairs"][pair][1] > REFERENCE.TOUCH_M):
                return False
        for body_id in ("b0", "b1"):
            for field in ("halfspace", "tilt_cos"):
                if abs(low["geometry"][body_id][field] - high["geometry"][body_id][field]) > REFERENCE.PRECISION_LIMIT:
                    return False
        return True


def evaluate(request):
    require(isinstance(request, dict), "request must be an object")
    low = evaluate_precision(request, 80)
    high = evaluate_precision(request, 120)
    resolved = precision_agrees(low, high)
    metrics = high["metrics"]
    violations = []
    if not resolved:
        violations.append("reference precision unresolved between Decimal80 and Decimal120")
    for name in ("maxPairPenetrationM", "maxFloorPenetrationM", "maxHalfspaceIntrusionM"):
        if metrics[name] > QUALITY_M:
            violations.append(f"{name} exceeds 0.002 m")
    if not metrics["footprintContained"]:
        violations.append("cube footprint is outside the finite floor")
    if metrics["escapedBelowFloor"]:
        violations.append("cube is wholly below the finite floor")
    public = {name: float(value) if isinstance(value, Decimal) else value
              for name, value in metrics.items()}
    public["maxTiltRad"] = math.acos(float(metrics["minTiltCosine"]))
    public["referencePrecisionResolved"] = resolved
    public["pairGeometry"] = [
        {"pair": list(pair), "penetrationM": float(high["pairs"][pair][0]),
         "penetrationDecimalM": str(high["pairs"][pair][0]),
         "signedDepthM": float(high["pairs"][pair][1]),
         "signedDepthDecimalM": str(high["pairs"][pair][1]),
         "penetratingBeyondTouchTolerance": high["pairs"][pair][1] > REFERENCE.TOUCH_M}
        for pair in PAIRS]
    return {"ok": resolved and not violations, "resolved": resolved,
            "metrics": public, "violations": violations}


def control_state(step):
    bodies = []
    for body_id in IDS:
        bodies.append({"id": body_id, "kind": "static" if body_id == "floor" else "dynamic",
                       "shape": {"kind": "box", "halfExtentsM": [2, .1, 2] if body_id == "floor" else [.25, .25, .25]},
                       "positionM": list(INITIAL_POSITIONS[body_id]), "orientation": [0, 0, 0, 1],
                       "velocityMps": [0, 0, 0], "angularVelocityRadps": [0, 0, 0]})
    return {"stepIndex": step, "timeSeconds": step / 120, "bodies": bodies,
            "contacts": [], "events": [], "joints": [], "ccdHits": [],
            "pairStats": {"eligiblePairs": 3, "candidatePairs": 0, "aabbTests": 0}}


def self_check():
    controls = []

    def record(name, passed):
        controls.append({"control": name, "passed": bool(passed)})

    initial, current = control_state(0), control_state(1)
    result = evaluate({"state": current, "initial": initial})
    record("two_cubes_and_finite_floor_touch", result["ok"] and len(result["metrics"]["pairGeometry"]) == 3
           and result["metrics"]["maxPairPenetrationM"] == 0 and result["metrics"]["maxFloorPenetrationM"] == 0)
    penetrated = copy.deepcopy(current)
    penetrated["bodies"][1]["positionM"][1] = .74
    result = evaluate({"state": penetrated, "initial": initial})
    record("pair_penetration_is_measured_and_rejected", result["resolved"] and not result["ok"]
           and abs(result["metrics"]["maxPairPenetrationM"] - .01) < 1e-12)
    intruded = copy.deepcopy(current)
    intruded["bodies"][0]["positionM"][1] = .24
    result = evaluate({"state": intruded, "initial": initial})
    record("finite_floor_and_halfspace_intrusion", not result["ok"]
           and abs(result["metrics"]["maxFloorPenetrationM"] - .01) < 1e-12
           and abs(result["metrics"]["maxHalfspaceIntrusionM"] - .01) < 1e-12)
    moving = copy.deepcopy(current)
    moving["bodies"][1]["velocityMps"] = [1000, 1000, 1000]
    result = evaluate({"state": moving, "initial": initial})
    record("bounds_are_componentwise_and_speed_has_no_settled_gate", result["ok"]
           and result["metrics"]["maxLinearSpeedMps"] > 1000)
    small = copy.deepcopy(current)
    small["bodies"][1]["positionM"][1] = .75 - 1e-11
    result = evaluate({"state": small, "initial": initial})
    pair = result["metrics"]["pairGeometry"][0]
    record("small_positive_depth_is_retained", pair["penetrationM"] > 0
           and not pair["penetratingBeyondTouchTolerance"])
    invalid = copy.deepcopy(current)
    invalid["bodies"][1]["orientation"] = [0, 0, 0, 1.000000002]
    try:
        evaluate({"state": invalid, "initial": initial})
        rejected = False
    except REFERENCE.ReferenceInputError:
        rejected = True
    record("invalid_quaternion_is_rejected", rejected)
    passed = all(item["passed"] for item in controls)
    return {"result": "PASS" if passed else "FAIL", "controls": controls}, 0 if passed else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-check", action="store_true")
    arguments = parser.parse_args()
    if arguments.self_check:
        result, exit_code = self_check()
        print(json.dumps(result, allow_nan=False))
        return exit_code
    for line in sys.stdin:
        try:
            response = evaluate(json.loads(line))
        except (REFERENCE.ReferenceInputError, ValueError, TypeError, KeyError, ArithmeticError) as error:
            response = {"ok": False, "resolved": False, "metrics": None, "violations": [str(error)]}
        print(json.dumps(response, allow_nan=False), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
