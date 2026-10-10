#!/usr/bin/env python3
"""Independent pose-only hinge law and before/after momentum observer.

JSON lines: {config:<full original pair config>,state:<full pair carrier>,dt,
output?:{bodies,poseReport,diagnostics},beforeRawHex?,afterRawHex?}.
Unchanged #1294 scalar algebra is imported. Python atan2/sin/cos are separately
declared binary scalar functions; Decimal80/120 does not certify transcendentals.
No candidate, world, motor, old hinge projection or solver is imported/called.
"""
from decimal import Decimal, localcontext
import copy
import importlib.util
import json
import math
from pathlib import Path
import struct
import sys

sys.dont_write_bytecode = True
PATH = Path(__file__).resolve().parent.parent / "physics-rigid-hinge-limit-diagnostic" / "reference.py"
SPEC = importlib.util.spec_from_file_location("adopted_hinge_scalar_1294", PATH)
OLD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(OLD)
ZERO, ONE, TWO = Decimal(0), Decimal(1), Decimal(2)
ALGEBRA_GATE = Decimal("1e-25")
COMPARE_GATE = 1e-12
POSE_GATE = 1e-9
MOMENTUM_GATE = 1e-7


class ReferenceInputError(ValueError):
    pass


def require(value, message):
    if not value:
        raise ReferenceInputError(message)


def finite(value):
    require(type(value) in (int, float), "coupled hinge reference requires finite numeric fields")
    try:
        result = float(value)
    except OverflowError:
        raise ReferenceInputError("coupled hinge reference requires finite numeric fields") from None
    require(math.isfinite(result), "coupled hinge reference requires finite numeric fields")
    return result


def decimal_value(value):
    return value if isinstance(value,Decimal) else OLD.number(value)


def carrier(request):
    require(isinstance(request, dict), "coupled hinge reference request must be an object")
    require(finite(request.get("dt")) == 1/120, "coupled hinge reference dt must equal 1/120")
    config, state = copy.deepcopy(request.get("config")), copy.deepcopy(request.get("state"))
    require(isinstance(config, dict) and isinstance(state, dict), "coupled hinge reference config and state are required")
    require(finite(config.get("fixedStepSeconds")) == 1/120 and OLD.vector(config.get("gravityMps2")) == (ZERO, ZERO, ZERO),
            "coupled hinge reference full original configuration differs")
    index = state.get("stepIndex")
    require(type(index) is int and 0 <= index <= 3600 and finite(state.get("timeSeconds")) == index*(1/120),
            "coupled hinge reference carrier cursor differs")
    for field in ("contacts", "events", "ccdHits", "joints"):
        require(isinstance(state.get(field), list), "coupled hinge reference carrier arrays are required")
    stats = state.get("pairStats")
    require(isinstance(stats, dict) and all(type(stats.get(key)) is int and stats[key] >= 0
            for key in ("eligiblePairs", "candidatePairs", "aabbTests")), "coupled hinge reference carrier statistics differ")
    if "beforeRawHex" in request:
        state["bodies"] = restored_bodies(state.get("bodies"), request["beforeRawHex"])
    return config, state


def restored_bodies(bodies, hexadecimal):
    require(isinstance(bodies, list) and len(bodies) == 2 and isinstance(hexadecimal, str) and len(hexadecimal) == 416,
            "coupled hinge reference raw13 length differs")
    try:
        raw = bytes.fromhex(hexadecimal)
    except ValueError:
        raise ReferenceInputError("coupled hinge reference raw13 encoding differs") from None
    numbers = struct.unpack("<26d", raw)
    restored = copy.deepcopy(bodies)
    cursor = 0
    for body in restored:
        require(isinstance(body, dict), "coupled hinge reference raw13 carrier differs")
        for field, count in (("positionM", 3), ("velocityMps", 3), ("orientation", 4), ("angularVelocityRadps", 3)):
            require(isinstance(body.get(field), list) and len(body[field]) == count, "coupled hinge reference raw13 carrier differs")
            for index in range(count):
                value = numbers[cursor]
                require(math.isfinite(value) and value == finite(body[field][index]), "coupled hinge reference raw13/JSON mismatch")
                body[field][index] = value
                cursor += 1
    return restored


def advance_z(quaternion, correction):
    if correction == ZERO:
        # Original advanceOrientation explicitly returns the raw copy at zero speed.
        return tuple(quaternion)
    angle = float(correction)
    speed = abs(angle)
    factor = math.sin(speed/2)/speed
    delta = (ZERO, ZERO, Decimal.from_float(angle*factor), Decimal.from_float(math.cos(speed/2)))
    product = OLD.quaternion_product(delta, quaternion)
    length = OLD.magnitude(product)
    require(length > ZERO, "coupled hinge reference output quaternion has zero norm")
    return tuple(component/length for component in product)


def inverse_axis_inertia(quaternion):
    # Original rest parser's binary default inertia is derived independently.
    inverse = Decimal.from_float(1/(.4*1*.1**2))
    axis = (ZERO, ZERO, ONE)
    conjugate = tuple(-x for x in quaternion[:3])+(quaternion[3],)
    local = OLD.polynomial_rotation(conjugate, axis)
    world = OLD.polynomial_rotation(quaternion, OLD.scale(local, inverse))
    return world[2]


def law(bodies, before, limits):
    theta = before["relativeAngleRad"]
    target = min(float(limits[1]), max(float(limits[0]), theta))
    excess = Decimal.from_float(theta)-Decimal.from_float(target)
    a, b = bodies
    ia, ib = inverse_axis_inertia(a["q"]), inverse_axis_inertia(b["q"])
    require(ia > ZERO and ib > ZERO, "coupled hinge reference inverse inertia is invalid")
    alpha_a, alpha_b = excess*ia/(ia+ib), -excess*ib/(ia+ib)
    qa, qb = advance_z(a["q"], alpha_a), advance_z(b["q"], alpha_b)
    ra = OLD.polynomial_rotation(qa, (OLD.RADIUS, ZERO, ZERO))
    rb = OLD.polynomial_rotation(qb, (-OLD.RADIUS, ZERO, ZERO))
    center = OLD.scale(OLD.add(a["p"], b["p"]), ONE/TWO)
    offset = OLD.scale(OLD.subtract(rb, ra), ONE/TWO)
    result = [{**a, "p": OLD.add(center, offset), "q": qa},
              {**b, "p": OLD.subtract(center, offset), "q": qb}]
    return result, target, (alpha_a, alpha_b)


def observe(bodies, report, origin, limits):
    inertia = TWO/Decimal(5)*OLD.MASS*OLD.RADIUS*OLD.RADIUS
    orbital = OLD.add(*(OLD.scale(OLD.cross(OLD.subtract(body["p"],origin),body["v"]),OLD.MASS) for body in bodies))
    spin = OLD.scale(OLD.add(bodies[0]["w"],bodies[1]["w"]),inertia)
    return {mode:{**OLD.observe(bodies, report, origin, limits, mode == "normalized"),
                  "orbitalAngularMomentumVectorKgM2ps":orbital,"spinAngularMomentumVectorKgM2ps":spin}
            for mode in ("raw", "normalized")}


def body_records(template, decoded):
    result = copy.deepcopy(template)
    for raw, body in zip(result, decoded):
        for field, key in (("positionM", "p"), ("velocityMps", "v"), ("orientation", "q"), ("angularVelocityRadps", "w")):
            raw[field] = list(body[key])
    return result


def vector_error(a, b):
    return OLD.magnitude(tuple(x-y for x, y in zip(a, b)))


def at_precision(request, precision):
    with localcontext() as context:
        context.prec = precision
        config, state = carrier(request)
        before_bodies, report, origin, limits = OLD.decode({"config": config, "state": state, "dt": request["dt"]})
        require(all(all(abs(x)<=bound for x in body[key]) for body in before_bodies
                for key,bound in (("p",10000),("v",1000),("w",1000),("q",1))) and
                all(abs(OLD.magnitude(body["q"])-ONE)<=Decimal("1e-9") for body in before_bodies),
                "coupled hinge reference carrier raw pose exceeds original bounds")
        before = observe(before_bodies, report, origin, limits)
        expected_bodies, target, corrections = law(before_bodies, before["raw"], limits)
        relative = OLD.quaternion_product(expected_bodies[1]["q"],
                    tuple(-x for x in expected_bodies[0]["q"][:3])+(expected_bodies[0]["q"][3],))
        expected_angle = OLD.scalar_angle(relative)
        expected = observe(expected_bodies, Decimal.from_float(expected_angle), origin, limits)
        output = request.get("output")
        actual_bodies, actual, actual_records = expected_bodies, expected, body_records(state["bodies"], expected_bodies)
        actual_report, actual_target = expected_angle, target
        if output is not None:
            require(isinstance(output, dict) and isinstance(output.get("poseReport"), dict), "coupled hinge reference output is invalid")
            pose = output["poseReport"]
            require(set(pose) == {"jointId", "finalAngleRad", "targetAngleRad"} and pose["jointId"] == config["joints"][0]["id"],
                    "coupled hinge reference pose report differs")
            actual_report, actual_target = finite(pose.get("finalAngleRad")), finite(pose.get("targetAngleRad"))
            actual_records = copy.deepcopy(output.get("bodies"))
            if "afterRawHex" in request:
                actual_records = restored_bodies(actual_records, request["afterRawHex"])
            output_state = {**state, "bodies": actual_records, "joints": [{**state["joints"][0], "angleRad": actual_report}]}
            actual_bodies, _, _, _ = OLD.decode({"config": config, "state": output_state, "dt": request["dt"]})
            actual = observe(actual_bodies, Decimal.from_float(actual_report), origin, limits)
        metrics = {"expectedPositionErrorM": max(vector_error(body["p"], wanted["p"]) for body, wanted in zip(actual_bodies, expected_bodies)),
                   "expectedQuaternionError": max(OLD.magnitude(tuple(x-y for x,y in zip(body["q"],wanted["q"]))) for body,wanted in zip(actual_bodies,expected_bodies)),
                   "expectedTargetErrorRad": abs(actual_target-target),
                   "expectedFinalAngleErrorRad": abs(actual_report-expected_angle),
                   "velocityChanged": any(body["v"] != old["v"] for body, old in zip(actual_bodies,before_bodies)),
                   "angularVelocityChanged": any(body["w"] != old["w"] for body, old in zip(actual_bodies,before_bodies))}
        if output is not None:
            metrics["velocityBitsChanged"] = any(struct.pack("<d",finite(after)) != struct.pack("<d",finite(old))
                for first,last in zip(state["bodies"],actual_records) for field in ("velocityMps","angularVelocityRadps") for old,after in zip(first[field],last[field]))
        else:
            metrics["velocityBitsChanged"] = False
        for mode in ("raw", "normalized"):
            a, b = before[mode], actual[mode]
            metrics[mode+"ComChangeM"] = vector_error(a["centerOfMassM"], b["centerOfMassM"])
            metrics[mode+"LinearMomentumChangeKgMps"] = vector_error(a["linearMomentumVectorKgMps"],b["linearMomentumVectorKgMps"])
            metrics[mode+"AngularMomentumChangeKgM2ps"] = vector_error(a["angularMomentumVectorKgM2ps"],b["angularMomentumVectorKgM2ps"])
        metrics["rawNormalizedGeometryDifference"] = max(abs(observation["raw"][field]-observation["normalized"][field])
            for observation in (before,expected,actual)
            for field in ("anchorGapM","relativeAngleRad","axisDeviationRad","limitExcessRad","reportedAngleDifferenceRad"))
        metrics["maxPositionComponentM"] = max(abs(x) for body in actual_bodies for x in body["p"])
        metrics["maxVelocityComponentMps"] = max(abs(x) for body in actual_bodies for x in body["v"])
        metrics["maxAngularVelocityComponentRadps"] = max(abs(x) for body in actual_bodies for x in body["w"])
        if output is not None:
            diagnostics=output.get("diagnostics")
            require(isinstance(diagnostics,dict),"coupled hinge reference diagnostics are required")
            require(type(diagnostics.get("lawEvaluations")) is int and diagnostics["lawEvaluations"]==1 and
                    type(diagnostics.get("sourceStepIndex")) is int and diagnostics["sourceStepIndex"]==state["stepIndex"] and
                    finite(diagnostics.get("sourceTimeSeconds"))==state["timeSeconds"],
                    "coupled hinge reference diagnostic cursor or law count differs")
            require(type(diagnostics.get("velocityBitsUnchanged")) is bool and type(diagnostics.get("angularVelocityBitsUnchanged")) is bool,
                    "coupled hinge reference preservation flags differ")
            metrics["diagnosticPreservationFailed"]=not(diagnostics["velocityBitsUnchanged"] and diagnostics["angularVelocityBitsUnchanged"])
            diag_error=ZERO
            for key,observation in (("before",before["raw"]),("after",actual["raw"])):
                recorded=diagnostics.get(key)
                require(isinstance(recorded,dict),"coupled hinge reference diagnostic observation is invalid")
                for field in ("relativeAngleRad","anchorGapM","axisDeviationRad","quaternionNormError","limitExcessRad","energyJ"):
                    diag_error=max(diag_error,abs(Decimal.from_float(finite(recorded.get(field)))-decimal_value(observation[field])))
                for field in ("anchorAM","anchorBM","centerOfMassM","linearMomentumVectorKgMps",
                              "orbitalAngularMomentumVectorKgM2ps","spinAngularMomentumVectorKgM2ps","angularMomentumVectorKgM2ps"):
                    diag_error=max(diag_error,vector_error(OLD.vector(recorded.get(field)),observation[field]))
            metrics["diagnosticMeasurementError"]=diag_error
            require(isinstance(diagnostics.get("angleCorrectionsRad"),list) and len(diagnostics["angleCorrectionsRad"])==2 and
                    isinstance(diagnostics.get("translationCorrectionsM"),list) and len(diagnostics["translationCorrectionsM"])==2,
                    "coupled hinge reference correction vectors are invalid")
            metrics["diagnosticCorrectionError"]=max(
                *(abs(OLD.number(x)-y) for x,y in zip(diagnostics["angleCorrectionsRad"],corrections)),
                *(vector_error(OLD.vector(x),OLD.subtract(b["p"],a["p"])) for x,a,b in
                  zip(diagnostics["translationCorrectionsM"],before_bodies,actual_bodies)),
                abs(OLD.number(diagnostics.get("targetAngleRad"))-OLD.number(target)))
        return {"metrics":metrics,"before":before,"expected":expected,"actual":actual,
                "expectedBodies":body_records(state["bodies"],expected_bodies),"targetAngleRad":target,
                "expectedFinalAngleRad":expected_angle,"angleCorrectionsRad":corrections,
                "translationCorrectionsM":[OLD.subtract(b["p"],a["p"]) for a,b in zip(before_bodies,expected_bodies)]}


def numeric_difference(low, high):
    if isinstance(high, Decimal):
        return abs(low-high)
    if isinstance(high, dict):
        return max((numeric_difference(low[key], value) for key,value in high.items()),default=ZERO)
    if isinstance(high, (tuple,list)):
        return max((numeric_difference(a,b) for a,b in zip(low,high)),default=ZERO)
    return ZERO


def public(value):
    if isinstance(value, Decimal):
        return finite(float(value))
    if isinstance(value, dict):
        return {key:public(item) for key,item in value.items()}
    if isinstance(value, (tuple,list)):
        return [public(item) for item in value]
    if type(value) is float:
        finite(value)
    return value


def evaluate(request):
    low, high = at_precision(request,80), at_precision(request,120)
    with localcontext() as context:
        context.prec = 120
        precision = numeric_difference(low,high)
    scalar_repeat = max(abs(low[mode][view][field]-high[mode][view][field])
        for mode in ("before","expected","actual") for view in ("raw","normalized")
        for field in ("relativeAngleRad","axisDeviationRad","limitExcessRad","reportedAngleDifferenceRad"))
    resolved = precision <= ALGEBRA_GATE and scalar_repeat <= COMPARE_GATE
    violations = []
    if not resolved:
        violations.append("coupled hinge reference precision is unresolved")
    metrics = high["metrics"]
    for field in ("expectedPositionErrorM","expectedQuaternionError","rawNormalizedGeometryDifference"):
        if metrics[field] > Decimal.from_float(COMPARE_GATE):
            violations.append(field+" exceeds 1e-12")
    for field in ("diagnosticMeasurementError","diagnosticCorrectionError"):
        if field in metrics and metrics[field]>Decimal.from_float(COMPARE_GATE):
            violations.append(field+" exceeds 1e-12")
    for field,bound in (("maxPositionComponentM",10000),("maxVelocityComponentMps",1000),("maxAngularVelocityComponentRadps",1000)):
        if metrics[field]>bound:
            violations.append(field+" exceeds original output bounds")
    for field in ("expectedTargetErrorRad","expectedFinalAngleErrorRad"):
        if metrics[field] > POSE_GATE:
            violations.append(field+" exceeds 1e-9 rad")
    if any(metrics[field] for field in ("velocityChanged","angularVelocityChanged","velocityBitsChanged")):
        violations.append("pose-only law changed velocity or angular velocity")
    if metrics.get("diagnosticPreservationFailed"):
        violations.append("pose-only diagnostic records changed velocity or angular velocity")
    for view in ("raw","normalized"):
        observation = high["actual"][view]
        for field in ("anchorGapM","quaternionNormError"):
            if observation[field] > Decimal.from_float(POSE_GATE):
                violations.append(view+" "+field+" exceeds 1e-9")
        if observation["limitExcessRad"] > POSE_GATE or abs(observation["reportedAngleDifferenceRad"]) > POSE_GATE:
            violations.append(view+" actual angle/report/limit exceeds 1e-9 rad")
        if observation["axisDeviationRad"] > math.pi/180:
            violations.append(view+" axis drift exceeds one degree")
        if metrics[view+"ComChangeM"] > Decimal.from_float(COMPARE_GATE):
            violations.append(view+" COM change exceeds 1e-12 m")
        for field in ("LinearMomentumChangeKgMps","AngularMomentumChangeKgM2ps"):
            if metrics[view+field] > Decimal.from_float(MOMENTUM_GATE):
                violations.append(view+" "+field+" exceeds 1e-7")
        if observation["energyJ"] < ZERO:
            violations.append(view+" energy is negative")
    return {"ok":resolved and not violations,"resolved":resolved,"executionFailure":False,
            "metrics":{**public(metrics),"precisionMaxDifference":public(precision),"scalarRepeatMaxDifferenceRad":scalar_repeat},
            "violations":violations,"reference":public({"before":high["before"],"expected":high["expected"],
                "after":high["actual"],"expectedBodies":high["expectedBodies"],"targetAngleRad":high["targetAngleRad"],
                "expectedFinalAngleRad":high["expectedFinalAngleRad"],"angleCorrectionsRad":high["angleCorrectionsRad"],
                "translationCorrectionsM":high["translationCorrectionsM"]}),
            "velocityBitAuthority":"supplied raw13 buffers plus consumer bit receipts; JSON alone loses zero signs",
            "transcendentals":"binary scalar atan2/sin/cos, not Decimal transcendental certification"}


def main():
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            result=evaluate(json.loads(line))
        except (ReferenceInputError,OLD.ReferenceInputError,json.JSONDecodeError) as error:
            result={"ok":False,"resolved":False,"executionFailure":True,"code":"REFERENCE_INPUT","message":str(error)}
        print(json.dumps(result,allow_nan=False,separators=(",",":")),flush=True)


if __name__ == "__main__":
    main()
