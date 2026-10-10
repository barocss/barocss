#!/usr/bin/env python3
"""Independent archived pair transition observer. No world or solver imports.

The unchanged #1252 scalar SAT module supplies decode and all-axis geometry.
Recorded u, binary64 round(pre+u), and decoded final-pre are separate quantities.
Only the supplied final poses are observed; no alternate accepted pose is built.
"""
from decimal import Decimal, localcontext
import importlib.util
import json
import math
from pathlib import Path
import sys

sys.dont_write_bytecode = True
PATH = Path(__file__).resolve().parent.parent / "physics-rigid-feature-penetration-diagnostic" / "geometry-reference.py"
SPEC = importlib.util.spec_from_file_location("adopted_pair_scalar_1252", PATH)
SAT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SAT)
ZERO = Decimal(0)
GATE = Decimal("1e-12")
PRECISION_GATE = Decimal("1e-25")
MESSAGES = {
    "request": "coverage reference requires before, after, translations and explicit row",
    "pair": "coverage reference pair must contain a and b",
    "identity": "coverage reference pair IDs or kinds changed",
    "geometry": "coverage reference support geometry changed",
    "translation": "coverage reference translation must be a finite 3-vector",
    "row": "coverage reference row must name the ordered pair",
    "normal": "coverage reference row normal must be finite and unit",
    "depth": "coverage reference row depth must be finite and within zero to ten metres",
    "json": "coverage reference line must be valid JSON",
}


class ReferenceInputError(ValueError):
    pass


def require(condition, key):
    if not condition:
        raise ReferenceInputError(MESSAGES[key])


def decoded_vector(value, key):
    require(isinstance(value, list) and len(value) == 3, key)
    try:
        return tuple(SAT.dec(item) for item in value)
    except SAT.ReferenceInputError:
        raise ReferenceInputError(MESSAGES[key]) from None


def classify(margin):
    return "separated" if margin < ZERO else "overlap" if margin > ZERO else "touching"


def pair(value):
    require(isinstance(value, dict) and "a" in value and "b" in value, "pair")
    a, b = SAT.decode_body(value["a"]), SAT.decode_body(value["b"])
    SAT.require(a["id"] != b["id"], "ids")
    return a, b


def rounded_sum(before, translation):
    result = float(before)+float(translation)
    if not math.isfinite(result):
        raise OverflowError("coverage binary64 position sum exceeds finite range")
    return Decimal.from_float(result)


def measure(request, precision):
    with localcontext() as context:
        context.prec = precision
        require(isinstance(request, dict) and all(key in request for key in ("before", "after", "translations", "row")), "request")
        before_a, before_b = pair(request["before"])
        after_a, after_b = pair(request["after"])
        for side, first, last in (("a", before_a, after_a), ("b", before_b, after_b)):
            require(first["id"] == last["id"] and request["before"][side]["kind"] == request["after"][side]["kind"], "identity")
            require(first["extents"] == last["extents"] and first["quaternion"] == last["quaternion"], "geometry")
        translations = request["translations"]
        require(isinstance(translations, dict), "translation")
        u_a, u_b = decoded_vector(translations.get("aM"), "translation"), decoded_vector(translations.get("bM"), "translation")
        actual_a, actual_b = SAT.sub(after_a["center"], before_a["center"]), SAT.sub(after_b["center"], before_b["center"])
        nominal_relative, actual_relative = SAT.sub(u_b, u_a), SAT.sub(actual_b, actual_a)
        rounding = []
        for first, last, u, actual in ((before_a, after_a, u_a, actual_a), (before_b, after_b, u_b, actual_b)):
            rounded = tuple(rounded_sum(p, delta) for p, delta in zip(first["center"], u))
            unrounded = tuple(p+delta for p, delta in zip(first["center"], u))
            rounding.append({"id": first["id"], "nominalTranslationM": u,
                             "actualDecodedTranslationM": actual, "roundedPositionM": rounded,
                             "roundedPositionErrorM": max(abs(a-b) for a, b in zip(last["center"], rounded)),
                             "binary64AdditionRoundoffM": max(abs(a-b) for a, b in zip(rounded, unrounded)),
                             "actualMinusNominalTranslationM": max(abs(a-b) for a, b in zip(actual, u)),
                             "roundedFinalMatches": last["center"] == rounded})
        row = request["row"]
        row_residual = actual_row_residual = None
        if row is not None:
            require(isinstance(row, dict) and row.get("aId") == before_a["id"] and row.get("bId") == before_b["id"], "row")
            normal = decoded_vector(row.get("normal"), "normal")
            require(abs(SAT.norm(normal)-Decimal(1)) <= GATE, "normal")
            try:
                depth = SAT.dec(row.get("depthM"))
            except SAT.ReferenceInputError:
                raise ReferenceInputError(MESSAGES["depth"]) from None
            require(ZERO <= depth <= Decimal(10), "depth")
            row_residual = SAT.dot(normal, nominal_relative)-depth
            actual_row_residual = SAT.dot(normal, actual_relative)-depth
        reference = {}
        formula_errors, support_changes = [], []
        geometry_before, geometry_after = {}, {}
        for convention, normalize in (("raw", False), ("normalized", True)):
            first = SAT.sat_pair(before_a, before_b, normalize)
            last = SAT.sat_pair(after_a, after_b, normalize)
            geometry_before[convention], geometry_after[convention] = first, last
            axes = []
            for pre, post in zip(first["candidates"], last["candidates"]):
                if pre["exactZero"]:
                    axes.append({"candidateIndex": pre["candidateIndex"], "label": pre["label"],
                                 "exactZero": True, "nearParallel": False,
                                 "marginChangeM": None, "actualProjectionDeltaM": None,
                                 "expectedMarginChangeM": None, "axisFormulaErrorM": None})
                    continue
                direction = pre["axis"]
                projection = pre["signedCenterDistanceM"]
                projected_actual = SAT.dot(direction, actual_relative)
                projected_nominal = SAT.dot(direction, nominal_relative)
                expected_change = -abs(projection+projected_actual)+abs(projection)
                observed_change = post["marginM"]-pre["marginM"]
                formula_error = abs(observed_change-expected_change)
                support_change = max(abs(post["radiusAM"]-pre["radiusAM"]), abs(post["radiusBM"]-pre["radiusBM"]))
                formula_errors.append(formula_error)
                support_changes.append(support_change)
                axes.append({"candidateIndex": pre["candidateIndex"], "label": pre["label"],
                             "exactZero": False, "nearParallel": pre["nearParallel"], "axis": direction,
                             "projectionBeforeM": projection, "projectionAfterM": post["signedCenterDistanceM"],
                             "nominalProjectionDeltaM": projected_nominal,
                             "actualProjectionDeltaM": projected_actual,
                             "marginChangeM": observed_change, "expectedMarginChangeM": expected_change,
                             "axisFormulaErrorM": formula_error, "supportRadiusChangeM": support_change,
                             "centerProjectionSignChanged": (projection < ZERO) != (post["signedCenterDistanceM"] < ZERO),
                             "centerProjectionZeroBefore": projection == ZERO,
                             "centerProjectionZeroAfter": post["signedCenterDistanceM"] == ZERO})
            reference[convention] = {"before": first, "after": last, "axes": axes,
                                     "beforeClass": classify(first["marginM"]), "afterClass": classify(last["marginM"]),
                                     "minimizingAxisChanged": first["label"] != last["label"],
                                     "tiedAxesChanged": first["tiedAxisLabels"] != last["tiedAxisLabels"],
                                     "uniquePhysicalFeatureClaimed": False}
        metrics = {"maxRawNormalizedDepthDifferenceM": max(abs(geometry_before["raw"]["depthM"]-geometry_before["normalized"]["depthM"]),
                                                             abs(geometry_after["raw"]["depthM"]-geometry_after["normalized"]["depthM"])),
                   "maxRawNormalizedMarginDifferenceM": max(abs(geometry_before["raw"]["marginM"]-geometry_before["normalized"]["marginM"]),
                                                              abs(geometry_after["raw"]["marginM"]-geometry_after["normalized"]["marginM"])),
                   "maxRecordedFinalErrorM": max(item["roundedPositionErrorM"] for item in rounding),
                   "maxActualMinusNominalTranslationM": max(item["actualMinusNominalTranslationM"] for item in rounding),
                   "maxBinary64RoundingM": max(item["binary64AdditionRoundoffM"] for item in rounding),
                   "axisFormulaMaxErrorM": max(formula_errors, default=ZERO),
                   "supportRadiusMaxChangeM": max(support_changes, default=ZERO),
                   "rowResidualM": row_residual, "actualRowResidualM": actual_row_residual,
                   "recordedRoundedFinalMatches": all(item["roundedFinalMatches"] for item in rounding),
                   "fixedOrientation": True}
        return {"metrics": metrics, "reference": reference, "rounding": rounding,
                "geometryBefore": geometry_before, "geometryAfter": geometry_after}


def numeric_difference(low, high):
    if isinstance(high, Decimal):
        if not isinstance(low, Decimal):
            return PRECISION_GATE*Decimal(10)
        return abs(low-high)
    if isinstance(high, dict):
        if not isinstance(low, dict) or low.keys() != high.keys():
            return PRECISION_GATE*Decimal(10)
        return max((numeric_difference(low[key], high[key]) for key in high), default=ZERO)
    if isinstance(high, (list, tuple)):
        if not isinstance(low, (list, tuple)) or len(low) != len(high):
            return PRECISION_GATE*Decimal(10)
        return max((numeric_difference(a, b) for a, b in zip(low, high)), default=ZERO)
    # Tie/winner/sign report identity does not assert a unique physical feature.
    return ZERO


def public(value):
    if isinstance(value, Decimal):
        return SAT.native_number(value)
    if isinstance(value, (list, tuple)):
        return [public(item) for item in value]
    if isinstance(value, dict):
        return {key: public(item) for key, item in value.items()}
    return value


def evaluate(request):
    if isinstance(request, dict) and request.get("op") == "pair":
        # Explicit old analytic controls only. Actual transition policy has no exception.
        return SAT.evaluate({"a": request.get("a"), "b": request.get("b")})
    low, high = measure(request, 80), measure(request, 120)
    before_agrees, before_error = SAT.precision_agreement(low["geometryBefore"], high["geometryBefore"])
    after_agrees, after_error = SAT.precision_agreement(low["geometryAfter"], high["geometryAfter"])
    with localcontext() as context:
        context.prec = 120
        extra_error = max(numeric_difference(low["metrics"], high["metrics"]),
                          numeric_difference(low["rounding"], high["rounding"]),
                          *(numeric_difference(low["reference"][mode]["axes"], high["reference"][mode]["axes"])
                            for mode in ("raw", "normalized")))
        precision_error = max(before_error, after_error, extra_error)
    resolved = before_agrees and after_agrees and precision_error <= PRECISION_GATE
    metrics = high["metrics"]
    violations = []
    if not resolved:
        violations.append("coverage Decimal80/120 precision disagreement")
    for field in ("maxRawNormalizedDepthDifferenceM", "maxRawNormalizedMarginDifferenceM",
                  "maxRecordedFinalErrorM", "axisFormulaMaxErrorM", "supportRadiusMaxChangeM"):
        if metrics[field] > GATE:
            violations.append(field+" exceeds 1e-12 m")
    reference = {}
    for convention in ("raw", "normalized"):
        source = high["reference"][convention]
        reference[convention] = {**public(source), "before": SAT.public_result(source["before"]),
                                 "after": SAT.public_result(source["after"])}
    return {"ok": resolved and not violations, "resolved": resolved,
            "metrics": {**public(metrics), "precisionMaxDifferenceM": SAT.native_number(precision_error)},
            "violations": violations, "reference": {**reference, "rounding": public(high["rounding"]),
                "rowIncluded": request["row"] is not None,
                "limits": "detector null is not independent separation; fixed-axis formula handles centre sign changes; JSON alone loses signed zero; raw frame receipts remain authoritative"}}


def main():
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            result = evaluate(json.loads(line))
        except json.JSONDecodeError:
            result = {"ok": False, "resolved": False, "code": "REFERENCE_INPUT", "message": MESSAGES["json"]}
        except (ReferenceInputError, SAT.ReferenceInputError) as error:
            result = {"ok": False, "resolved": False, "code": "REFERENCE_INPUT", "message": str(error)}
        # Unexpected exceptions propagate; no diagnostic or physical refusal is invented.
        print(json.dumps(result, allow_nan=False, separators=(",", ":")), flush=True)


if __name__ == "__main__":
    main()
