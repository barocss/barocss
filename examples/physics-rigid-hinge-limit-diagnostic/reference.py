#!/usr/bin/env python3
"""Independent observation of one archived pair; no Physics imports or steps.

JSON line protocol: {state:{bodies:[A,B],joints:[jointState]},
config:{bodies:[originalA,originalB],joints:[originalJoint]},dt:1/120}.
Raw quaternion polynomial and explicitly normalized geometry are both retained.
Decimal80/120 certifies scalar algebra only. Angles use scalar math.atan2.
"""

from decimal import Decimal, localcontext
import json
import math
import sys


ZERO = Decimal(0)
ONE = Decimal(1)
TWO = Decimal(2)
RADIUS = Decimal.from_float(.1)
MASS = ONE
PRECISION_GATE = Decimal("1e-25")
ORIGINAL_ANGLE_GATE = 1e-9
SCALAR_ANGLE_REPEAT_GATE = 1e-12


class ReferenceInputError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise ReferenceInputError(message)


def number(value):
    require(type(value) in (int, float), "Reference input must contain finite binary numbers")
    try:
        binary = float(value)
    except OverflowError:
        raise ReferenceInputError("Reference input must contain finite binary numbers") from None
    require(math.isfinite(binary), "Reference input must contain finite binary numbers")
    return Decimal.from_float(binary)


def vector(value, size=3):
    require(isinstance(value, list) and len(value) == size,
            "Reference vector must contain exactly " + str(size) + " numbers")
    return tuple(number(component) for component in value)


def add(a, b):
    return tuple(a[i]+b[i] for i in range(3))


def subtract(a, b):
    return tuple(a[i]-b[i] for i in range(3))


def scale(a, factor):
    return tuple(component*factor for component in a)


def dot(a, b):
    return sum((x*y for x, y in zip(a, b)), ZERO)


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def magnitude(a):
    return dot(a, a).sqrt()


def polynomial_rotation(q, v):
    """Rodrigues polynomial I + 2w[u]x + 2[u]x^2, without normalizing q."""
    u, w = q[:3], q[3]
    # This scalar expansion derives the polynomial from uuT and |u|^2 I.
    return add(scale(v, ONE-TWO*dot(u, u)),
               add(scale(u, TWO*dot(u, v)), scale(cross(u, v), TWO*w)))


def quaternion_product(left, right):
    a, aw = left[:3], left[3]
    b, bw = right[:3], right[3]
    xyz = add(add(scale(a, bw), scale(b, aw)), cross(a, b))
    return (*xyz, aw*bw-dot(a, b))


def scalar_angle(relative):
    z, w = float(relative[2]), float(relative[3])
    require(math.isfinite(z) and math.isfinite(w), "Reference result must be finite")
    angle = TWO*Decimal.from_float(math.atan2(z, w))
    binary = float(angle)
    if binary > math.pi:
        binary -= 2*math.pi
    elif binary < -math.pi:
        binary += 2*math.pi
    return binary


def decode(payload):
    require(isinstance(payload, dict), "Reference request must be an object")
    state, config = payload.get("state"), payload.get("config")
    require(isinstance(state, dict) and isinstance(config, dict), "Reference state and config are required")
    if "gravityMps2" in config:
        require(vector(config["gravityMps2"]) == (ZERO, ZERO, ZERO), "Reference original gravity differs")
    require(number(payload.get("dt")) == number(.008333333333333333), "Reference dt differs from original fixture")
    originals, joints = config.get("bodies"), config.get("joints")
    require(isinstance(originals, list) and len(originals) == 2 and
            isinstance(joints, list) and len(joints) == 1, "Reference config requires one original pair")
    require(all(isinstance(body, dict) for body in originals) and isinstance(joints[0], dict),
            "Reference config requires one original pair")
    joint = joints[0]
    require(joint.get("id") in ("hinge0", "hinge1"), "Reference pair IDs are invalid")
    group = int(joint["id"][-1])
    ids = ("pairA"+str(group), "pairB"+str(group))
    require(tuple(body.get("id") for body in originals) == ids and
            joint.get("aId") == ids[0] and joint.get("bId") == ids[1], "Reference pair IDs are invalid")
    original_z = vector(originals[0].get("positionM"))[2]
    require(original_z in (ZERO, Decimal(group)), "Reference original pair position differs")
    for index, body in enumerate(originals):
        require(body.get("kind") == "dynamic" and body.get("shape") == {"kind": "sphere", "radiusM": .1}
                and number(body.get("massKg")) == MASS, "Reference original sphere metadata differs")
        material = body.get("friction")
        require(number(body.get("restitution")) == ZERO and isinstance(material, dict)
                and number(material.get("static")) == ONE and number(material.get("dynamic")) == number(.7),
                "Reference original sphere material differs")
        require(vector(body.get("velocityMps", [0, 0, 0])) == (ZERO, ZERO, ZERO)
                and vector(body.get("angularVelocityRadps", [0, 0, 0])) == (ZERO, ZERO, ZERO)
                and vector(body.get("orientation", [0, 0, 0, 1]), 4) == (ZERO, ZERO, ZERO, ONE),
                "Reference original sphere motion differs")
        require(vector(body.get("positionM")) == ((-RADIUS if index == 0 else RADIUS), ZERO, original_z),
                "Reference original pair position differs")
    require(joint.get("kind") == "hinge" and vector(joint.get("anchorALocalM")) == (RADIUS, ZERO, ZERO)
            and vector(joint.get("anchorBLocalM")) == (-RADIUS, ZERO, ZERO)
            and vector(joint.get("axisWorld")) == (ZERO, ZERO, ONE)
            and vector(joint.get("limitRad"), 2) == (number(-.8), number(.8)),
            "Reference original hinge metadata differs")
    motor = joint.get("motor")
    require(isinstance(motor, dict) and number(motor.get("targetSpeedRadps")) == number(.5)
            and number(motor.get("maxImpulseNms")) == number(.0001)
            and number(motor.get("maxReactionNms")) == number(.01), "Reference original hinge metadata differs")
    raw, states = state.get("bodies"), state.get("joints")
    require(isinstance(raw, list) and len(raw) == 2 and all(isinstance(body, dict) for body in raw),
            "Reference state requires exactly two bodies")
    require(tuple(body.get("id") for body in raw) == ids, "Reference pair IDs are invalid")
    require(isinstance(states, list) and len(states) == 1 and isinstance(states[0], dict),
            "Reference state requires exactly one joint")
    joint_state = states[0]
    require(joint_state.get("id") == joint["id"] and joint_state.get("kind") == "hinge"
            and joint_state.get("aId") == ids[0] and joint_state.get("bId") == ids[1], "Reference pair IDs are invalid")
    report = number(joint_state.get("angleRad"))
    decoded = []
    for body in raw:
        require(body.get("kind") == "dynamic" and body.get("shape") == {"kind": "sphere", "radiusM": .1},
                "Reference state sphere metadata differs")
        q = vector(body.get("orientation"), 4)
        require(magnitude(q) > ZERO, "Reference quaternion has zero norm")
        decoded.append({"p": vector(body.get("positionM")), "v": vector(body.get("velocityMps")),
                        "q": q, "w": vector(body.get("angularVelocityRadps"))})
    return decoded, report, (ZERO, ZERO, original_z), vector(joint["limitRad"], 2)


def observe(bodies, report, origin, limits, normalized):
    poses = []
    for body in bodies:
        q = body["q"]
        if normalized:
            qnorm = magnitude(q)
            q = tuple(component/qnorm for component in q)
        poses.append({**body, "q": q})
    a, b = poses
    anchor_a = add(a["p"], polynomial_rotation(a["q"], (RADIUS, ZERO, ZERO)))
    anchor_b = add(b["p"], polynomial_rotation(b["q"], (-RADIUS, ZERO, ZERO)))
    conjugate_a = tuple(-component for component in a["q"][:3]) + (a["q"][3],)
    relative = quaternion_product(b["q"], conjugate_a)
    angle = scalar_angle(relative)
    deviation = []
    for body in poses:
        axis = polynomial_rotation(body["q"], (ZERO, ZERO, ONE))
        tangent = (axis[0]*axis[0]+axis[1]*axis[1]).sqrt()
        require(magnitude(axis) > ZERO, "Reference rotated axis has zero norm")
        deviation.append(math.atan2(float(tangent), float(axis[2])))
    inertia = TWO/Decimal(5)*MASS*RADIUS*RADIUS
    momentum = scale(add(a["v"], b["v"]), MASS)
    angular = add(add(scale(cross(subtract(a["p"], origin), a["v"]), MASS),
                      scale(cross(subtract(b["p"], origin), b["v"]), MASS)),
                  scale(add(a["w"], b["w"]), inertia))
    energy = sum((MASS*dot(body["v"], body["v"])/TWO +
                  inertia*dot(body["w"], body["w"])/TWO for body in poses), ZERO)
    residual = angle-float(report)
    excess = max(0., float(limits[0])-angle, angle-float(limits[1]))
    center = scale(add(a["p"], b["p"]), ONE/TWO)
    norm_error = max(abs(magnitude(body["q"])-ONE) for body in poses)
    return {"relativeAngleRad": angle, "relativeQuaternionXYZW": relative,
            "anchorAM": anchor_a, "anchorBM": anchor_b, "anchorGapM": magnitude(subtract(anchor_b, anchor_a)),
            "axisDeviationRad": max(deviation), "limitExcessRad": excess,
            "reportedAngleDifferenceRad": residual, "limitGatePassed": excess <= ORIGINAL_ANGLE_GATE,
            "reportGatePassed": abs(residual) <= ORIGINAL_ANGLE_GATE,
            "centerOfMassM": center, "comDriftM": magnitude(subtract(center, origin)),
            "linearMomentumKgMps": magnitude(momentum), "linearMomentumVectorKgMps": momentum,
            "angularMomentumKgM2ps": magnitude(angular), "angularMomentumVectorKgM2ps": angular,
            "energyJ": energy, "inertiaKgM2": inertia, "quaternionNormError": norm_error,
            "unitQuaternionGatePassed": norm_error <= Decimal("1e-9")}


def precision_differences(low, high, path="", differences=None):
    if differences is None:
        differences = {}
    if isinstance(high, Decimal):
        differences[path] = abs(high-low)
    elif isinstance(high, dict):
        require(low.keys() == high.keys(), "Reference precision structure differs")
        for key in high:
            precision_differences(low[key], high[key], path+"."+key, differences)
    elif isinstance(high, (list, tuple)):
        require(len(low) == len(high), "Reference precision structure differs")
        for index, value in enumerate(high):
            precision_differences(low[index], value, path+"["+str(index)+"]", differences)
    elif type(high) is float:
        differences[path] = Decimal.from_float(abs(high-low))
    else:
        require(low == high, "Reference precision decisions differ")
    return differences


def public(value):
    if isinstance(value, Decimal):
        binary = float(value)
        require(math.isfinite(binary), "Reference result must be finite")
        return binary
    if isinstance(value, dict):
        return {key: public(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [public(item) for item in value]
    if type(value) is float:
        require(math.isfinite(value), "Reference result must be finite")
    return value


def at_precision(payload, precision):
    with localcontext() as context:
        context.prec = precision
        bodies, report, origin, limits = decode(payload)
        return {"raw": observe(bodies, report, origin, limits, False),
                "normalized": observe(bodies, report, origin, limits, True)}


def evaluate(payload):
    low, high = at_precision(payload, 80), at_precision(payload, 120)
    with localcontext() as context:
        context.prec = 120
        differences = precision_differences(low, high)
    angles = ("relativeAngleRad", "axisDeviationRad", "limitExcessRad", "reportedAngleDifferenceRad")
    algebra = {key: value for key, value in differences.items() if not key.endswith(angles)}
    angle_repeat = {key: value for key, value in differences.items() if key.endswith(angles)}
    algebra_max = max(algebra.values(), default=ZERO)
    angle_max = max(angle_repeat.values(), default=ZERO)
    resolved = algebra_max <= PRECISION_GATE and angle_max <= Decimal.from_float(SCALAR_ANGLE_REPEAT_GATE)
    raw_valid = high["raw"]["unitQuaternionGatePassed"]
    violations = []
    if not resolved:
        violations.append("Independent precision gate failed")
    if not raw_valid:
        violations.append("Raw quaternion norm exceeds original 1e-9 gate")
    return {"ok": resolved and raw_valid, "resolved": resolved, **public(high),
            "precisionMaxDifference": public(algebra_max),
            "precisionDifferences": {key: str(value) for key, value in algebra.items()},
            "scalarAngleRepeatMaxDifferenceRad": public(angle_max),
            "violations": violations,
            "failureClass": None if not violations else "reference-execution-validation",
            "stateValidation": {"rawFieldsFinite": True, "rawQuaternionUnit": raw_valid, "metadataValid": True},
            "metadataSubset": "config original bodies/joints and dt; optional gravity must be zero; omitted initial motion uses original zero/identity defaults; full archive metadata remains hash-pinned",
            "convention": "raw quaternion polynomial retained; normalized geometry separate; Decimal80/120 scalar algebra; binary scalar atan2"}


def main():
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            payload = json.loads(line)
            result = evaluate(payload)
        except json.JSONDecodeError:
            result = {"ok": False, "resolved": False, "code": "REFERENCE_INPUT", "message": "Reference input must be valid JSON"}
        except ReferenceInputError as error:
            result = {"ok": False, "resolved": False, "code": "REFERENCE_INPUT", "message": str(error)}
        # Unexpected exceptions propagate; no physical refusal is invented.
        print(json.dumps(result, allow_nan=False, separators=(",", ":")), flush=True)


if __name__ == "__main__":
    main()
