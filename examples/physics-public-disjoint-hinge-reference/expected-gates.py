"""Gate-only extraction from the immutable derive's already returned models.

No pose, row construction, optimizer, certificate evaluator or observation call
is made here. Historical certificates are correspondence evidence, not a newly
observed native certificate. The no-output parent's default actual flags are
intentionally not consulted.
"""
from decimal import Decimal, localcontext
from fractions import Fraction
import math

from world_schema import M, P, DT


def finite_number(value):
    if type(value) is Decimal:
        return value.is_finite()
    if type(value) is Fraction:
        return True
    return type(value) in (int, float) and math.isfinite(value)


def describe(value):
    if isinstance(value, (Decimal, Fraction)):
        return str(value)
    return repr(value)


def inspect_expected(low, high, low_models, high_models, historical):
    """Return physical/certificate results and detailed, reached gate evidence."""
    failures = []
    evidence = []
    physical = True
    certificate = True

    def gate(label, value, bound=None, nonnegative=False, category="physical"):
        nonlocal physical, certificate
        passed = finite_number(value)
        if passed and nonnegative:
            passed = value >= 0
        if passed and bound is not None:
            passed = value <= bound
        evidence.append({"field":label, "value":describe(value),
                         "maximum":None if bound is None else describe(bound),
                         "nonnegative":nonnegative, "passed":passed})
        if not passed:
            failures.append(label + "=" + describe(value) + " failed expected gate" +
                            (" <= " + describe(bound) if bound is not None else ""))
            if category in ("certificate", "intrinsic"):
                certificate = False
            if category in ("physical", "intrinsic"):
                physical = False

    def truth(label, value, category="physical"):
        nonlocal physical, certificate
        passed = value is True
        evidence.append({"field":label, "value":describe(value), "passed":passed})
        if not passed:
            failures.append(label + "=" + describe(value) + " is not true")
            if category in ("certificate", "intrinsic"):
                certificate = False
            if category in ("physical", "intrinsic"):
                physical = False

    with localcontext() as context:
        context.prec = 120
        for precision, reference, models in ((80, low, low_models), (120, high, high_models)):
            prefix = "expected" + str(precision)
            truth(prefix + ".reportReady", reference["stage"] == "report-ready")
            truth(prefix + ".noRefusal", reference["expectedRefusal"] is None)
            # A safe refusal is a resolved physical mismatch, without inventing
            # the model or measurements its derivation never reached.
            for index, model in enumerate(models):
                name = prefix + ".pair" + str(index)
                if model is None:
                    truth(name + ".modelReached", False)
                    certificate = False
                    continue
                for mode in ("raw", "normalized"):
                    label = name + "." + mode
                    after = model["after"][mode]
                    for field in ("anchorGapM", "quaternionNormError"):
                        gate(label + "." + field, after[field], Decimal.from_float(1e-9), True)
                    gate(label + ".limitExcessRad", after["limitExcessRad"], 1e-9, True)
                    gate(label + ".reportedAngleDifferenceRad", abs(after["reportedAngleDifferenceRad"]), 1e-9, True)
                    gate(label + ".axisDeviationRad", after["axisDeviationRad"], math.pi / 180, True)
                    for field, bound in (("ComChangeM", 1e-12), ("LinearMomentumChangeKgMps", 1e-7),
                                         ("AngularMomentumChangeKgM2ps", 1e-7),
                                         ("GeometricAngularMomentumChangeKgM2ps", 1e-7)):
                        gate(label + "." + field, model["metrics"][mode + field], Decimal.from_float(bound), True)
                    gate(label + ".anchorRelativeSpeedMps", P.OLD.magnitude(after["anchorRelativeVelocityMps"]), Decimal.from_float(1e-9), True)
                    gate(label + ".transverseRelativeOmegaRadps", P.OLD.magnitude(after["relativeAngularVelocityRadps"][:2]), Decimal.from_float(1e-9), True)
                    kind = model["problem"]["stopKind"]
                    if kind != "none":
                        rate = after["relativeAngularVelocityRadps"][2] * (1 if kind == "upper" else -1)
                        gate(label + "." + kind + "OutwardOmegaRadps", rate, Decimal.from_float(1e-9))
                    for field in ("energyJ", "geometricEnergyJ"):
                        gate(label + "." + field, after[field], nonnegative=True)
                gate(name + ".rawNormalizedGeometryDifference", model["metrics"]["rawNormalizedGeometryDifference"], Decimal.from_float(1e-12), True)
                gate(name + ".objectiveDecimalJ", model["objectiveDecimalJ"], nonnegative=True)
                exact = model["exact"]
                gate(name + ".objectiveExact", exact["objectiveExact"], nonnegative=True, category="intrinsic")
                truth(name + ".rankEqualsRowCount", type(exact["rank"]) is int and
                      type(exact["rowCount"]) is int and exact["rank"] == exact["rowCount"] and
                      exact["rowCount"] == (12 if exact["activeStop"] else 11), "intrinsic")
                for field in ("primalZero", "stationarityZero", "stopKktPassed"):
                    truth(name + "." + field, exact[field], "intrinsic")
                # This compares the returned exact result; it never evaluates a
                # certificate or fills actualFrame/actualCertificate nulls.
                truth(name + ".historicalExpectedCertificate", P.public(exact) == historical[index]["certificate"]["expected"], "certificate")
                for body_index, body in enumerate(model["actualRecords"]):
                    for field, bound in (("positionM", 10000), ("velocityMps", 1000),
                                         ("angularVelocityRadps", 1000), ("orientation", 1)):
                        for component, value in enumerate(body[field]):
                            gate(name + ".prediction" + str(body_index) + "." + field + "[" + str(component) + "]", abs(value), bound, True)

            projected = reference["frames"]["projectedBodies"]
            source = reference["frames"]["sourceBodies"]
            if projected is None:
                continue
            for body_index, (body, before) in enumerate(zip(projected, source)):
                name = prefix + ".body" + str(body_index)
                for field, bound in (("positionM", 10000), ("velocityMps", 1000), ("angularVelocityRadps", 1000)):
                    for component, value in enumerate(body[field]):
                        gate(name + "." + field + "[" + str(component) + "]", abs(value), bound, True)
                gate(name + ".rawQuaternionNormError", abs(math.hypot(*body["orientation"]) - 1), 1e-12, True)
                gate(name + ".sourceDisplacementM", math.hypot(*M.sub(body["positionM"], before["positionM"])), 10, True)
                gate(name + ".planeDriftM", abs(body["positionM"][2] - body_index // 2), 1e-12, True)
            for index, pair in enumerate(reference["pairs"]):
                name = prefix + ".worldPair" + str(index)
                cap = pair["reportCap"]
                truth(name + ".capReached", cap is not None)
                if cap is not None:
                    truth(name + ".capUnexceeded", cap["exceedsCap"] is False)
                    gate(name + ".capNorm", cap["angularReactionNormNms"], .01, True)
                origin = (Decimal(0), Decimal(0), Decimal(index))
                actions = reference["parsedActions"][2 * index:2 * index + 2]
                external = [0.0, 0.0, 0.0]
                for item in actions:
                    external = M.add(external, M.add(item["angularImpulseNms"] if item["angularImpulseNms"] is not None else [0.0] * 3,
                                                    M.scale(item["torqueNm"] if item["torqueNm"] is not None else [0.0] * 3, DT)))
                for mode in ("raw", "normalized"):
                    final = pair["phaseMetrics"]["projected"][mode]
                    before = pair["phaseMetrics"]["source"][mode]
                    label = name + "." + mode
                    for field, bound in (("anchorGapM", Decimal.from_float(.002)),
                                         ("quaternionNormError", Decimal.from_float(1e-9)),
                                         ("limitExcessRad", 1e-9), ("axisDeviationRad", math.pi / 180)):
                        gate(label + "." + field, final[field], bound, True)
                    gate(label + ".reportedAngleDifferenceRad", abs(final["reportedAngleDifferenceRad"]), 1e-9, True)
                    gate(label + ".restComDistanceM", P.OLD.magnitude(tuple(x - y for x, y in zip(final["centerOfMassM"], origin))), Decimal.from_float(1e-5), True)
                    momentum = tuple(x - y for x, y in zip(final["linearMomentumVectorKgMps"], before["linearMomentumVectorKgMps"]))
                    angular = tuple(x - y - Decimal.from_float(z) for x, y, z in zip(final["angularMomentumVectorKgM2ps"], before["angularMomentumVectorKgM2ps"], external))
                    gate(label + ".sourceLinearMomentumChangeKgMps", P.OLD.magnitude(momentum), Decimal.from_float(1e-7), True)
                    gate(label + ".commandAccountedAngularMomentumChangeKgM2ps", P.OLD.magnitude(angular), Decimal.from_float(1e-7), True)
            for index, record in enumerate(reference["contactChecks"]["final"]):
                name = prefix + ".finalSeparation" + str(index)
                truth(name + ".reached", record is not None)
                if record is not None:
                    truth(name + ".noHit", record["noHit"])
                    truth(name + ".positiveRaw", finite_number(record["separationRawM"]) and record["separationRawM"] > 0)
                    truth(name + ".positiveNormalized", finite_number(record["separationNormalizedM"]) and record["separationNormalizedM"] > 0)
                    gate(name + ".precisionMaxDifferenceM", record["precisionMaxDifferenceM"], 1e-25, True)
    return physical, certificate, failures, evidence
