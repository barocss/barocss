#!/usr/bin/env python3
"""Independent scalar Decimal80/120 observer. No Physics or candidate imports.

Input and output are one JSON object per line. JSON numbers are decoded as
binary64 first, then converted exactly with Decimal.from_float. The centreline
distance uses halfspace breakpoints and a quadratic minimum on each interval.
Quaternion components retain their original bits. The scalar rotation matrix
uses 2 / squared_norm, which represents the unit rotation without rewriting q.
"""

from decimal import Decimal, getcontext, localcontext
import json
import math
import sys


ZERO = Decimal(0)
ONE = Decimal(1)
TWO = Decimal(2)
GEOMETRY_GATE = Decimal("1e-12")
PRECISION_GATE = Decimal("1e-25")


class ReferenceInputError(ValueError):
    def __init__(self, message, code="REF_INPUT"):
        super().__init__(message)
        self.code = code


def require(condition, message, code="REF_INPUT"):
    if not condition:
        raise ReferenceInputError(message, code)


def number(value):
    require(type(value) in (int, float), "Reference input must contain finite binary numbers")
    try:
        binary = float(value)
    except OverflowError:
        raise ReferenceInputError("Reference input must contain finite binary numbers") from None
    require(math.isfinite(binary), "Reference input must contain finite binary numbers")
    return Decimal.from_float(binary)


def vector(value, length=3):
    require(isinstance(value, list) and len(value) == length,
            "Reference vector has invalid length")
    return tuple(number(item) for item in value)


def add(a, b):
    return tuple(a[i] + b[i] for i in range(3))


def subtract(a, b):
    return tuple(a[i] - b[i] for i in range(3))


def multiply(a, factor):
    return tuple(component * factor for component in a)


def dot(a, b):
    return sum((a[i] * b[i] for i in range(3)), ZERO)


def norm(a):
    return dot(a, a).sqrt()


def rotation(q):
    x, y, z, w = q
    squared = x*x + y*y + z*z + w*w
    require(squared > ZERO, "Reference quaternion has zero norm")
    factor = TWO / squared
    return ((ONE-factor*(y*y+z*z), factor*(x*y-z*w), factor*(x*z+y*w)),
            (factor*(x*y+z*w), ONE-factor*(x*x+z*z), factor*(y*z-x*w)),
            (factor*(x*z-y*w), factor*(y*z+x*w), ONE-factor*(x*x+y*y)))


def rotate(matrix, point):
    return tuple(dot(row, point) for row in matrix)


def inverse_rotate(matrix, point):
    return tuple(sum((matrix[j][i]*point[j] for j in range(3)), ZERO)
                 for i in range(3))


def to_local(box, point):
    return inverse_rotate(box["matrix"], subtract(point, box["center"]))


def to_world(box, point):
    return add(box["center"], rotate(box["matrix"], point))


def clamp(value, half):
    return min(half, max(-half, value))


def point_distance_squared(point, half):
    return sum(((point[i]-clamp(point[i], half[i]))**2 for i in range(3)), ZERO)


def segment_distance(center, half_length, box):
    """Minimize ||s(s)-clamp_box(s(s))||^2 for -h <= s <= h."""
    origin = to_local(box, center)
    direction = inverse_rotate(box["matrix"], (ZERO, ONE, ZERO))
    half = box["half"]
    breaks = {-half_length, half_length}
    for axis in range(3):
        if direction[axis] != ZERO:
            for plane in (-half[axis], half[axis]):
                crossing = (plane-origin[axis])/direction[axis]
                if -half_length < crossing < half_length:
                    breaks.add(crossing)
    ordered = sorted(breaks)
    candidates = []
    flats = []
    def distance_at(parameter):
        local = add(origin, multiply(direction, parameter))
        return point_distance_squared(local, half)
    for parameter in ordered:
        candidates.append((distance_at(parameter), parameter))
    for lower, upper in zip(ordered, ordered[1:]):
        middle = (lower+upper)/TWO
        quadratic = ZERO
        linear = ZERO
        for axis in range(3):
            sample = origin[axis]+direction[axis]*middle
            if sample < -half[axis] or sample > half[axis]:
                plane = -half[axis] if sample < -half[axis] else half[axis]
                residual = origin[axis]-plane
                quadratic += direction[axis]**2
                linear += TWO*residual*direction[axis]
        if quadratic == ZERO:
            flats.append((distance_at(middle), lower, upper))
            candidates.append((distance_at(middle), middle))
        else:
            stationary = -linear/(TWO*quadratic)
            if lower <= stationary <= upper:
                candidates.append((distance_at(stationary), stationary))
    minimum = min(item[0] for item in candidates)
    # Only numerical equality at the active Decimal precision is used for ties.
    tie_gate = Decimal(10) ** (-(max(40, getcontext().prec-10)))
    minimizers = sorted({parameter for squared, parameter in candidates
                         if abs(squared-minimum) <= tie_gate})
    intervals = [(lower, upper) for squared, lower, upper in flats
                 if abs(squared-minimum) <= tie_gate]
    selected = (intervals[0][0]+intervals[0][1])/TWO if intervals else minimizers[0]
    segment_local = add(origin, multiply(direction, selected))
    point_local = tuple(clamp(segment_local[i], half[i]) for i in range(3))
    return {"distanceM": minimum.sqrt(), "distanceSquaredM2": minimum,
            "segmentPointM": to_world(box, segment_local),
            "pointM": to_world(box, point_local),
            "segmentParameterM": selected, "minimizerParametersM": minimizers,
            "flatIntervalsM": intervals,
            "witnessAmbiguity": "flat-interval" if intervals else
                                "tied-points" if len(minimizers)>1 else "unique"}


def decode(request):
    require(isinstance(request, dict), "Reference request must be an object")
    capsule = request.get("capsule", {})
    require(isinstance(capsule, dict), "Reference capsule must be an object")
    radius = number(capsule.get("radiusM", request.get("radius", .1)))
    half_length = number(capsule.get("halfLengthM", request.get("halfLength", .2)))
    require(radius == number(.1) and half_length == number(.2),
            "Reference capsule dimensions are unsupported", "REF_PROFILE")
    if "orientationXYZW" in capsule:
        require(vector(capsule["orientationXYZW"], 4) == (ZERO, ZERO, ZERO, ONE),
                "Reference capsule orientation is unsupported", "REF_PROFILE")
    if "angularVelocityRadps" in capsule:
        require(vector(capsule["angularVelocityRadps"]) == (ZERO, ZERO, ZERO),
                "Reference angular motion is unsupported", "REF_PROFILE")
    raw = request.get("box")
    require(isinstance(raw, dict), "Reference box must be an object")
    for field in ("velocityMps", "angularVelocityRadps"):
        if field in raw:
            require(vector(raw[field]) == (ZERO, ZERO, ZERO),
                    "Reference moving box is unsupported", "REF_PROFILE")
    box = {"center": vector(raw.get("centerM", raw.get("center"))),
           "half": vector(raw.get("halfExtentsM", raw.get("half"))),
           "q": vector(raw.get("orientationXYZW", raw.get("orientation")), 4)}
    require(all(item > ZERO for item in box["half"]), "Reference box extent must be positive")
    box["matrix"] = rotation(box["q"])
    center = vector(request.get("centerM", request.get("center")))
    velocity = vector(request.get("velocityMps", request.get("velocity")))
    step = number(request.get("stepSeconds"))
    require(step > ZERO, "Reference stepSeconds must be positive")
    upright_local = inverse_rotate(box["matrix"], (ZERO, ONE, ZERO))
    require(norm(subtract(upright_local, (ZERO, ONE, ZERO))) <= GEOMETRY_GATE,
            "Reference box orientation is unsupported", "REF_PROFILE")
    local_velocity = inverse_rotate(box["matrix"], velocity)
    require(max(abs(local_velocity[1]), abs(local_velocity[2])) <= GEOMETRY_GATE,
            "Reference face movement is unsupported", "REF_MOVEMENT")
    return radius, half_length, box, center, velocity, step


def field_error(actual, expected):
    return norm(subtract(vector(actual), expected))


def witness_metrics(hit, center, box, half_length, radius, side, normal):
    point = vector(hit.get("pointM"))
    segment = vector(hit.get("segmentPointM"))
    local_point = to_local(box, point)
    tangential_error = max(ZERO, abs(segment[1]-center[1])-half_length)
    segment_error = norm((segment[0]-center[0], tangential_error, segment[2]-center[2]))
    box_error = point_distance_squared(local_point, box["half"]).sqrt()
    face_error = max(abs(local_point[0]-side*box["half"][0]),
                     max(ZERO, abs(local_point[1])-box["half"][1]),
                     max(ZERO, abs(local_point[2])-box["half"][2]))
    received_normal = vector(hit.get("normalFixtureToCapsule", hit.get("normal")))
    return {"witnessSegmentMembershipErrorM": segment_error,
            "witnessBoxMembershipErrorM": box_error,
            "witnessFaceMembershipErrorM": face_error,
            "witnessDistanceErrorM": abs(norm(subtract(segment, point))-radius),
            "normalError": norm(subtract(received_normal, normal)),
            "normalUnitError": abs(norm(received_normal)-ONE)}


def evaluate_precision(request, precision):
    with localcontext() as context:
        context.prec = precision
        radius, half_length, box, center, velocity, step = decode(request)
        initial = segment_distance(center, half_length, box)
        local_center = to_local(box, center)
        local_axis = inverse_rotate(box["matrix"], (ZERO, ONE, ZERO))
        side = -ONE if local_center[0] <= ZERO else ONE
        normal = rotate(box["matrix"], (side, ZERO, ZERO))
        footprint = all(abs(local_center[i])+half_length*abs(local_axis[i])+radius
                        <= box["half"][i]+GEOMETRY_GATE for i in (1, 2))
        require(footprint, "Reference face footprint is unsupported", "REF_PROFILE")
        gap = initial["distanceM"]-radius
        face_gap = side*local_center[0]-box["half"][0]-radius-half_length*abs(local_axis[0])
        closing = -dot(velocity, normal)
        overlap = gap < -GEOMETRY_GATE
        time = None
        if not overlap:
            if gap <= GEOMETRY_GATE:
                time = ZERO
            elif closing > ZERO:
                proposed = face_gap/closing
                if ZERO <= proposed <= step:
                    time = proposed
        expected_hit = time is not None
        status = "initial-overlap" if overlap else "hit" if expected_hit else "clear"
        hit_center = add(center, multiply(velocity, time)) if expected_hit else None
        remaining = step-time if expected_hit else step
        normal_speed = dot(velocity, normal)
        final_velocity = subtract(velocity, multiply(normal, min(ZERO, normal_speed))) if expected_hit else velocity
        final_center = add(hit_center, multiply(final_velocity, remaining)) if expected_hit else add(center, multiply(velocity, step))
        contact = segment_distance(hit_center, half_length, box) if expected_hit else None
        final = segment_distance(final_center, half_length, box)
        metrics = {"distanceM": initial["distanceM"], "signedGapM": gap,
                   "faceGapM": face_gap, "footprintContained": footprint,
                   "expectedHit": expected_hit, "initialOverlap": overlap,
                   "expectedToiSeconds": time, "expectedToiFraction": time/step if expected_hit else None,
                   "expectedRemainingSeconds": remaining,
                   "contactGapM": contact["distanceM"]-radius if contact else None,
                   "finalGapM": final["distanceM"]-radius,
                   "closingSpeedMps": max(ZERO, -dot(final_velocity, normal)),
                   "quaternionNormError": abs(sum((item*item for item in box["q"]), ZERO).sqrt()-ONE)}
        violations = []
        if expected_hit and abs(metrics["contactGapM"]) > GEOMETRY_GATE:
            violations.append("Independent contact gap exceeds 1e-12 m")
        if expected_hit and metrics["finalGapM"] < -GEOMETRY_GATE:
            violations.append("Independent response penetrates the box")
        if request.get("evaluateCandidate", True) and "hit" in request:
            hit = request["hit"]
            require(hit is None or isinstance(hit, dict), "Reference hit must be an object or null")
            if (hit is not None) != expected_hit:
                violations.append("Candidate hit presence differs from independent face time")
            if hit is not None and expected_hit:
                require(isinstance(hit, dict), "Reference hit must be an object or null")
                received_fraction = number(hit.get("toiFraction"))
                received_time = received_fraction*step
                received_center = add(center, multiply(velocity, received_time))
                metrics.update({"toiErrorSeconds": abs(received_time-time),
                                "fractionError": abs(received_fraction-time/step),
                                "contactCenterErrorM": norm(subtract(received_center, hit_center)),
                                "candidateContactGapM": segment_distance(received_center, half_length, box)["distanceM"]-radius})
                metrics.update(witness_metrics(hit, received_center, box, half_length, radius, side, normal))
                if abs(metrics["candidateContactGapM"]) > GEOMETRY_GATE:
                    violations.append("Candidate contact gap exceeds 1e-12 m")
                if not ZERO <= received_fraction <= ONE:
                    violations.append("Candidate fraction is outside the step")
        result = request.get("result")
        if "result" in request:
            require(isinstance(result, dict), "Reference result must be an object")
        response_center = request.get("responseCenter")
        response_velocity = request.get("responseVelocity")
        if result is not None:
            require(isinstance(result, dict), "Reference result must be an object")
            response_center = result.get("centerM")
            response_velocity = result.get("velocityMps")
            received_hit_time = number(result.get("hitTimeSeconds"))
            received_remaining = number(result.get("remainingTimeSeconds"))
            expected_time = time if expected_hit else ZERO
            metrics.update({"timeAccountingErrorSeconds": abs(received_hit_time+received_remaining-step),
                            "remainingErrorSeconds": abs(received_remaining-remaining),
                            "resultHitTimeErrorSeconds": abs(received_hit_time-expected_time)})
            if received_hit_time < ZERO or received_remaining < ZERO or received_hit_time > step or received_remaining > step:
                violations.append("Candidate response time is outside the step")
        if response_center is not None:
            received_center = vector(response_center)
            metrics.update({"finalCenterErrorM": norm(subtract(received_center, final_center)),
                            "candidateFinalGapM": segment_distance(received_center, half_length, box)["distanceM"]-radius})
            if metrics["candidateFinalGapM"] < -GEOMETRY_GATE:
                violations.append("Candidate response penetrates the box")
        if response_velocity is not None:
            received_velocity = vector(response_velocity)
            metrics.update({"finalVelocityErrorMps": norm(subtract(received_velocity, final_velocity)),
                            "candidateClosingSpeedMps": max(ZERO, -dot(received_velocity, normal))})
        for name, value in metrics.items():
            if value is not None and isinstance(value, Decimal):
                if ("Error" in name and name != "quaternionNormError" and value > GEOMETRY_GATE):
                    violations.append(name+" exceeds its frozen 1e-12 gate")
        if expected_hit and "candidateClosingSpeedMps" in metrics and abs(metrics["candidateClosingSpeedMps"]) > GEOMETRY_GATE:
            violations.append("Candidate closing speed exceeds 1e-12 m/s")
        reference = {"status": status, "distance": initial["distanceM"], "signedGap": gap,
                     "faceGap": face_gap, "toiSeconds": time, "toiFraction": time/step if expected_hit else None,
                     "remainingSeconds": remaining, "centerHit": hit_center,
                     "centerFinal": final_center, "velocityFinal": final_velocity,
                     "normal": normal, "initialWitness": initial,
                     "contactWitness": contact, "finalWitness": final}
        if overlap:
            reference["error"] = {"code": "INITIAL_OVERLAP", "message": "Initial capsule overlaps a box"}
        expected_error = request.get("expectedError")
        if expected_error is not None:
            if not overlap or expected_error != reference["error"]:
                violations.append("Expected error differs from independent overlap refusal")
        elif overlap:
            violations.append("Initial capsule overlaps a box")
        return {"metrics": metrics, "reference": reference, "violations": violations}


def precision_error(low, high):
    if isinstance(high, Decimal):
        return abs(low-high)
    if isinstance(high, dict):
        require(low.keys() == high.keys(), "Reference precision structure differs", "REF_UNRESOLVED")
        return max((precision_error(low[key], high[key]) for key in high), default=ZERO)
    if isinstance(high, (list, tuple)):
        require(len(low) == len(high), "Reference precision structure differs", "REF_UNRESOLVED")
        return max((precision_error(a, b) for a, b in zip(low, high)), default=ZERO)
    require(low == high, "Reference precision decisions differ", "REF_UNRESOLVED")
    return ZERO


def serialize(value, decimal_strings=False):
    if isinstance(value, Decimal):
        require(value.is_finite(), "Reference result is outside finite binary range", "REF_NUMERIC")
        if decimal_strings:
            return str(value)
        binary = float(value)
        require(math.isfinite(binary), "Reference result is outside finite binary range", "REF_NUMERIC")
        return binary
    if isinstance(value, dict):
        return {key: serialize(item, decimal_strings) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [serialize(item, decimal_strings) for item in value]
    return value


def evaluate(request):
    low = evaluate_precision(request, 80)
    high = evaluate_precision(request, 120)
    with localcontext() as context:
        context.prec = 120
        difference = precision_error(low, high)
    resolved = difference <= PRECISION_GATE
    violations = list(high["violations"])
    if not resolved:
        violations.append("Decimal80/120 difference exceeds 1e-25")
    selected = low if request.get("precision") == 80 else high
    reference = serialize(selected["reference"], True)
    return {"ok": resolved and not violations, "resolved": resolved,
            "metrics": {**serialize(high["metrics"]), "precisionMaxDifference": str(difference)},
            "violations": violations, "reference": reference, **reference}


def input_failure(error, request):
    expected = request.get("expectedError") if isinstance(request, dict) else None
    actual = {"code": error.code, "message": str(error)}
    matched = expected == actual
    return {"ok": matched, "resolved": error.code != "REF_UNRESOLVED",
            "metrics": {}, "violations": [] if matched else [str(error)],
            "reference": {"status": "input-error", "error": actual}, "error": actual}


def main():
    for line in sys.stdin:
        if not line.strip():
            continue
        request = None
        try:
            request = json.loads(line)
            reply = evaluate(request)
        except json.JSONDecodeError:
            reply = input_failure(ReferenceInputError("Reference input must be valid JSON"), request)
        except ReferenceInputError as error:
            reply = input_failure(error, request)
        # Unexpected exceptions propagate. They are not physical refusals.
        print(json.dumps(reply, allow_nan=False, separators=(",", ":")), flush=True)


if __name__ == "__main__":
    main()
