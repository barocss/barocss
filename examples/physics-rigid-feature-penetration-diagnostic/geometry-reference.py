#!/usr/bin/env python3
"""Independent pair SAT in raw and normalized quaternion conventions.

Only Python standard-library scalar Decimal arithmetic is used. No engine,
observer, detector or feature-selector implementation is imported. Every
nonzero cross axis is tested. Zero margin is touching; negative margin is
separated, without the producer's -1e-12 separation allowance.
"""

from decimal import Decimal, localcontext
import json
import math
import sys


ZERO = Decimal(0)
ONE = Decimal(1)
TWO = Decimal(2)
PRECISION_TOLERANCE = Decimal("1e-25")
COMPARISON_TOLERANCE_M = Decimal("1e-12")
TIE_TOLERANCE_M = Decimal("1e-12")
NEAR_PARALLEL_LENGTH = Decimal("1e-12")
QUATERNION_NORM_LIMIT = Decimal("1e-9")

MESSAGES = {
    "request": "reference request must be an object with a and b",
    "body": "reference body must be an object",
    "id": "reference body id must be a nonempty string",
    "kind": "reference body kind must be dynamic, static, or kinematic",
    "shape": "reference shape must be a box",
    "number": "reference number must be a finite Float64; bool is invalid",
    "position": "reference positionM must contain three numbers",
    "position_bounds": "reference positionM exceeds admitted bounds",
    "extents": "reference halfExtentsM must contain three numbers",
    "extent_bounds": "reference halfExtentsM exceeds admitted bounds",
    "orientation": "reference orientation must contain four numbers",
    "orientation_bounds": "reference orientation component exceeds admitted bounds",
    "norm": "reference quaternion must have norm within 1e-9 of one",
    "ids": "reference bodies must have distinct ids",
    "json": "reference line is not valid JSON",
    "precision": "reference Decimal80/120 precision disagreement",
}


class ReferenceInputError(ValueError):
    pass


def require(condition, key):
    if not condition:
        raise ReferenceInputError(MESSAGES[key])


def dec(value):
    if isinstance(value, Decimal):
        require(value.is_finite(), "number")
        return value
    require(type(value) in (int, float), "number")
    try:
        decoded = float(value)
    except (OverflowError, ValueError) as error:
        raise ReferenceInputError(MESSAGES["number"]) from error
    require(math.isfinite(decoded), "number")
    return Decimal.from_float(decoded)


def vector(values, size=3, message_key="position"):
    require(isinstance(values, (list, tuple)) and len(values) == size, message_key)
    return tuple(dec(value) for value in values)


def dot(a, b):
    return sum((x*y for x, y in zip(a, b)), ZERO)


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def sub(a, b):
    return tuple(x-y for x, y in zip(a, b))


def norm(a):
    return dot(a, a).sqrt()


def quaternion_basis(quaternion):
    x, y, z, w = quaternion
    return ((ONE-TWO*(y*y+z*z), TWO*(x*y+w*z), TWO*(x*z-w*y)),
            (TWO*(x*y-w*z), ONE-TWO*(x*x+z*z), TWO*(y*z+w*x)),
            (TWO*(x*z+w*y), TWO*(y*z-w*x), ONE-TWO*(x*x+y*y)))


def decode_body(raw):
    require(isinstance(raw, dict), "body")
    require(isinstance(raw.get("id"), str) and bool(raw["id"]), "id")
    require(raw.get("kind") in ("dynamic", "static", "kinematic"), "kind")
    shape = raw.get("shape")
    require(isinstance(shape, dict) and shape.get("kind") == "box", "shape")
    extents = vector(shape.get("halfExtentsM"), message_key="extents")
    # Decode the original Float64 lower bound rather than change its admission.
    require(all(Decimal.from_float(.0001) <= value <= Decimal(1000) for value in extents), "extent_bounds")
    center = vector(raw.get("positionM"))
    require(all(abs(value) <= Decimal(10000) for value in center), "position_bounds")
    quaternion = vector(raw.get("orientation"), 4, "orientation")
    require(all(abs(value) <= ONE for value in quaternion), "orientation_bounds")
    qnorm = norm(quaternion)
    require(qnorm != ZERO and abs(qnorm-ONE) <= QUATERNION_NORM_LIMIT, "norm")
    return {"id": raw["id"], "center": center, "extents": extents,
            "quaternion": quaternion, "quaternionNorm": qnorm, "quaternionNormError": abs(qnorm-ONE)}


def support_radius(extents, bases, direction):
    return sum((extent*abs(dot(basis, direction)) for extent, basis in zip(extents, bases)), ZERO)


def sat_pair(a, b, normalize_quaternion=False):
    qa, qb = a["quaternion"], b["quaternion"]
    if normalize_quaternion:
        qa = tuple(value/a["quaternionNorm"] for value in qa)
        qb = tuple(value/b["quaternionNorm"] for value in qb)
    bases_a, bases_b = quaternion_basis(qa), quaternion_basis(qb)
    candidates = [(f"A.face.{i}", basis) for i, basis in enumerate(bases_a)]
    candidates += [(f"B.face.{i}", basis) for i, basis in enumerate(bases_b)]
    candidates += [(f"A.edge.{i}xB.edge.{j}", cross(ua, ub))
                   for i, ua in enumerate(bases_a) for j, ub in enumerate(bases_b)]
    delta = sub(b["center"], a["center"])
    records = []
    for index, (label, raw_axis) in enumerate(candidates):
        length = norm(raw_axis)
        record = {"candidateIndex": index, "label": label, "rawAxisLength": length,
                  "exactZero": length == ZERO,
                  "nearParallel": index >= 6 and ZERO < length < NEAR_PARALLEL_LENGTH,
                  "axis": None, "radiusAM": None, "radiusBM": None,
                  "signedCenterDistanceM": None, "marginM": None}
        if length != ZERO:
            direction = tuple(value/length for value in raw_axis)
            radius_a = support_radius(a["extents"], bases_a, direction)
            radius_b = support_radius(b["extents"], bases_b, direction)
            projection = dot(delta, direction)
            record.update(axis=direction, radiusAM=radius_a, radiusBM=radius_b,
                          signedCenterDistanceM=projection, marginM=radius_a+radius_b-abs(projection))
        records.append(record)
    usable = [record for record in records if not record["exactZero"]]
    # First strict minimum is a deterministic report choice only.
    winner = min(usable, key=lambda record: record["marginM"])
    margin = winner["marginM"]
    sign = -ONE if winner["signedCenterDistanceM"] < ZERO else ONE
    return {"depthM": max(ZERO, margin), "marginM": margin,
            "normalAtoB": tuple(value*sign for value in winner["axis"]),
            "candidateIndex": winner["candidateIndex"], "label": winner["label"],
            "rawAxisLength": winner["rawAxisLength"], "candidates": records,
            "nearParallelAxisCount": sum(record["nearParallel"] for record in records),
            "exactZeroAxisCount": sum(record["exactZero"] for record in records),
            "tiedCandidateIndices": [record["candidateIndex"] for record in usable if abs(record["marginM"]-margin) <= TIE_TOLERANCE_M],
            "tiedAxisLabels": [record["label"] for record in usable if abs(record["marginM"]-margin) <= TIE_TOLERANCE_M],
            "separated": margin < ZERO, "touching": margin == ZERO,
            "normalOrientationAmbiguous": winner["signedCenterDistanceM"] == ZERO,
            "quaternionNormErrors": {"a": a["quaternionNormError"], "b": b["quaternionNormError"]},
            "convention": "normalized-quaternion observer" if normalize_quaternion else "raw-quaternion scalar rotation basis"}


def evaluate_precision(request, precision):
    require(isinstance(request, dict) and "a" in request and "b" in request, "request")
    with localcontext() as context:
        context.prec = precision
        a, b = decode_body(request["a"]), decode_body(request["b"])
        require(a["id"] != b["id"], "ids")
        return {"raw": sat_pair(a, b, False), "normalized": sat_pair(a, b, True)}


def precision_agreement(low, high):
    maximum = ZERO
    topology_agrees = True
    with localcontext() as context:
        context.prec = 120
        for convention in ("raw", "normalized"):
            a, b = low[convention], high[convention]
            for field in ("depthM", "marginM"):
                maximum = max(maximum, abs(a[field]-b[field]))
            for first, second in zip(a["candidates"], b["candidates"]):
                if first["exactZero"] != second["exactZero"]:
                    topology_agrees = False
                for field in ("rawAxisLength", "radiusAM", "radiusBM", "signedCenterDistanceM", "marginM"):
                    x, y = first[field], second[field]
                    if x is None or y is None:
                        topology_agrees = topology_agrees and x is None and y is None
                    else:
                        maximum = max(maximum, abs(x-y))
                if first["axis"] is not None and second["axis"] is not None:
                    maximum = max(maximum, max(abs(x-y) for x, y in zip(first["axis"], second["axis"])))
            # Different tied report winners are not a failed precision identity.
            if (a["marginM"] < ZERO) != (b["marginM"] < ZERO):
                topology_agrees = False
    return topology_agrees and maximum <= PRECISION_TOLERANCE, maximum


def native_number(value):
    converted = float(value)
    if not math.isfinite(converted):
        # An internal/output error must not be disguised as caller input refusal.
        raise OverflowError("reference result exceeds finite JSON number range")
    return converted


def public_result(result):
    output = {}
    for key, value in result.items():
        if isinstance(value, Decimal):
            output[key] = native_number(value)
        elif isinstance(value, tuple):
            output[key] = [native_number(component) for component in value]
        elif key == "candidates":
            output[key] = [{field: native_number(item) if isinstance(item, Decimal)
                           else [native_number(component) for component in item] if isinstance(item, tuple) else item
                           for field, item in candidate.items()} for candidate in value]
        elif key == "quaternionNormErrors":
            output[key] = {name: native_number(error) for name, error in value.items()}
        else:
            output[key] = value
    output["marginDecimalM"] = str(result["marginM"])
    output["depthDecimalM"] = str(result["depthM"])
    output["rawAxisLengthDecimal"] = str(result["rawAxisLength"])
    output["quaternionNormErrorsDecimal"] = {name: str(error) for name, error in result["quaternionNormErrors"].items()}
    return output


def evaluate(request):
    try:
        low, high = evaluate_precision(request, 80), evaluate_precision(request, 120)
    except ReferenceInputError as error:
        return {"ok": False, "code": "REFERENCE_INPUT", "message": str(error)}
    agrees, maximum = precision_agreement(low, high)
    with localcontext() as context:
        context.prec = 120
        convention_depth_difference = abs(high["raw"]["depthM"]-high["normalized"]["depthM"])
        convention_margin_difference = abs(high["raw"]["marginM"]-high["normalized"]["marginM"])
    result = {"ok": agrees, "raw": public_result(high["raw"]), "normalized": public_result(high["normalized"]),
              "precisionMaxDifferenceM": native_number(maximum), "precisionMaxDifferenceDecimalM": str(maximum),
              "rawNormalizedDepthDifferenceM": native_number(convention_depth_difference),
              "rawNormalizedDepthDifferenceDecimalM": str(convention_depth_difference),
              "rawNormalizedMarginDifferenceM": native_number(convention_margin_difference),
              "rawNormalizedMarginDifferenceDecimalM": str(convention_margin_difference),
              "conventionsAgreeWithin1e12M": convention_depth_difference <= COMPARISON_TOLERANCE_M
                  and convention_margin_difference <= COMPARISON_TOLERANCE_M,
              "precisionWinnerIndices": {key: [low[key]["candidateIndex"], high[key]["candidateIndex"]] for key in ("raw", "normalized")},
              "ambiguity": {"tieToleranceM": native_number(TIE_TOLERANCE_M),
                            "nearParallelLengthThreshold": native_number(NEAR_PARALLEL_LENGTH),
                            "uniquePhysicalFeatureClaimed": False},
              "limits": {"negativeMargin": "signed projection gap, not Euclidean separation distance",
                         "rawQuaternion": "original components retained; scalar rotation arithmetic has no Float64 rounding",
                         "normalizedQuaternion": "observer convention only; engine input is never changed",
                         "separation": "independent strict margin<0; no producer epsilon",
                         "winner": "deterministic Decimal minimum; no producer-bit or unique-feature winner assertion"}}
    if not agrees:
        result.update(code="REFERENCE_PRECISION", message=MESSAGES["precision"])
    return result


def main():
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            response = {"ok": False, "code": "REFERENCE_INPUT", "message": MESSAGES["json"]}
        else:
            response = evaluate(request)
        print(json.dumps(response, allow_nan=False, separators=(",", ":")), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
