"""Actual-vs-cold comparison, full parent proof and separate precision metrics."""
import copy
from decimal import Decimal, localcontext
import math
from world_schema import M, P, DT, IDS, JIDS, PHASES, STAGES, finite, need, keys, vector, bits, raw, restore, actual_shape, Unresolved
from world_derivation import CROSS, separation

CHECKS = ("sourceRawMatchesInput", "commandsRawMatchesInput", "negativeZeroPathsMatch", "sourceCursorRetained", "attemptCursorCorrect", "parsedActionsMatch", "heldFrameBitsMatch", "namedZeroSignsMatch", "outputAttemptCorrespondence", "frameReachabilityMatch", "pairProgressMatch", "contactSequenceMatch", "callsMatch", "finiteSignedWork", "nonnegativeEnergiesAndObjective", "actualErrorMatch", "actualOutcomeMatch")
PAIR_CHECKS = ("acceptedReportAuthorityMatch", "motorMetadataMatch", "motorBranchMatch", "jointReportIdentityMatch", "targetAngleAuthorityMatch", "reportBaselineIsPostContact", "capDecisionMatch", "parentActualQualified")
REPORT_ERRORS = ("angleRad", "linearImpulseNs", "angularImpulseNms", "motorImpulseNms", "bodyLinearImpulseNs", "bodyAngularImpulseNms", "angularReactionNormNms", "motorSpeedBeforeRadps", "motorSpeedAfterRadps")
WORK_FIELDS = M.WORK_KEYS + ("contactDeltaKJ",)
PAIR_UNITS = ("positionM", "angleRad", "quaternion", "velocityMps", "angularVelocityRadps", "linearMomentumKgMps", "angularMomentumKgM2ps", "energyJ")
FIELD_UNITS = {"anchorAM":"positionM", "anchorBM":"positionM", "anchorGapM":"positionM", "centerOfMassM":"positionM", "quaternionNormError":"quaternion", "anchorVelocityAMps":"velocityMps", "anchorVelocityBMps":"velocityMps", "anchorRelativeVelocityMps":"velocityMps", "relativeAngularVelocityRadps":"angularVelocityRadps", "linearMomentumVectorKgMps":"linearMomentumKgMps", "angularMomentumVectorKgM2ps":"angularMomentumKgM2ps", "geometricAngularMomentumVectorKgM2ps":"angularMomentumKgM2ps", "energyJ":"energyJ", "geometricEnergyJ":"energyJ"}


def error(actual, expected):
    if type(expected) in (list, tuple):
        need(type(actual) is list and len(actual) == len(expected))
        return max((error(a, b) for a, b in zip(actual, expected)), default=0.0)
    return abs(finite(actual) - finite(P.public(expected)))


def same_bits(a, b):
    if type(b) in (list, tuple):
        return type(a) is list and len(a) == len(b) and all(same_bits(x, y) for x, y in zip(a, b))
    return bits(a) == bits(b)


def precision(low, high, low_models, high_models):
    differences = {unit:None for unit in M.UNIT_KEYS};scalar = Decimal(0)
    def add(unit, a, b):
        value = M.decimal_difference(a, b)
        differences[unit] = max(differences[unit] or Decimal(0), value)
    with localcontext() as context:
        context.prec = 120
        for phase in PHASES:
            a, b = low["frames"][phase + "Bodies"], high["frames"][phase + "Bodies"]
            if (a is None) != (b is None):
                raise Unresolved("independent World frame precision reachability differs")
            if a is not None:
                for x, y in zip(a, b):
                    for field, unit in (("positionM", "positionM"), ("orientation", "quaternion"), ("velocityMps", "velocityMps"), ("angularVelocityRadps", "angularVelocityRadps")):
                        add(unit, x[field], y[field])
        for index in range(2):
            a, b = low["pairs"][index], high["pairs"][index]
            for phase in PHASES:
                left, right = a["phaseMetrics"][phase], b["phaseMetrics"][phase]
                if (left is None) != (right is None):
                    raise Unresolved("independent World observation precision reachability differs")
                if left is not None:
                    for mode in ("raw", "normalized"):
                        for field, unit in FIELD_UNITS.items():
                            add(unit, left[mode][field], right[mode][field])
                        for field in ("relativeAngleRad", "axisDeviationRad", "reportedAngleDifferenceRad", "limitExcessRad"):
                            scalar = max(scalar, M.decimal_difference(left[mode][field], right[mode][field]))
            if a["bodyCorrections"] is not None and b["bodyCorrections"] is not None:
                for left, right in zip(a["bodyCorrections"], b["bodyCorrections"]):
                    add("impulseNs", left["linearImpulseNs"], right["linearImpulseNs"])
                    add("angularImpulseNms", left["angularImpulseNms"], right["angularImpulseNms"])
            if a["motor"] is not None and b["motor"] is not None:
                add("angularImpulseNms", a["motor"]["impulseNms"], b["motor"]["impulseNms"])
            if a["work"] is not None and b["work"] is not None:
                for field in WORK_FIELDS:
                    add("energyJ", a["work"][field], b["work"][field])
        models_match = all((a is None) == (b is None) and (a is None or a["problem"] == b["problem"] and a["exact"] == b["exact"]) for a, b in zip(low_models, high_models))
        return {"algebraMaxDifferenceByUnit":P.public(differences), "scalarRepeatMaxDifferenceRad":float(scalar), "algebraResolved":models_match and low["stage"] == high["stage"] and low["expectedRefusal"] == high["expectedRefusal"] and all(x is None or x <= Decimal("1e-25") for x in differences.values()), "scalarResolved":scalar <= Decimal("1e-12")}


def empty_metrics(prec):
    return {"actualCompared":False, "pairActualCompared":[False, False], "checks":{**{key:None for key in CHECKS}, "pairs":[{key:None for key in PAIR_CHECKS} for _ in JIDS]}, "frameErrors":{phase:None for phase in PHASES}, "pairErrors":[{phase:None for phase in PHASES} for _ in JIDS], "contactChecks":{"passes":[None] * 32, "final":[None] * 4}, "reportErrors":[None, None], "workErrors":[None, None], "precision":prec}


def compare_frames(actual, reference, metrics, violations):
    zeros = True
    for phase, bodies in actual.items():
        wanted = reference["frames"][phase + "Bodies"]
        if wanted is None:
            violations.append(phase + " actual frame reached beyond independent World stage")
            continue
        errs = M.frame_error(bodies, wanted);metrics["frameErrors"][phase] = errs
        for field, gate in (("positionM", 1e-12), ("quaternion", 1e-12), ("velocityMps", 1e-10), ("angularVelocityRadps", 1e-9 if phase == "projected" else 1e-10)):
            if errs[field] > gate:
                violations.append(phase + " " + field + " comparison exceeds frozen SI gate")
        if not errs["metadataMatch"]:
            violations.append(phase + " original metadata differs")
        for a, b in zip(bodies, wanted):
            for field, _ in M.FIELDS:
                for x, y in zip(a[field], b[field]):
                    if x == y == 0 and bits(x) != bits(y) and phase != "projected":
                        zeros = False
    metrics["checks"]["namedZeroSignsMatch"] = zeros


def contact_comparison(request, data, actual, reference, metrics, violations):
    recorded = data["contactChecks"] if data is not None else []
    sequence = True
    for offset, check in enumerate(recorded):
        pass_index, pair_index = divmod(offset, 4);a, b = CROSS[pair_index]
        sequence = sequence and check["pass"] == pass_index and check["pairIndex"] == pair_index and check["aId"] == IDS[a] and check["bId"] == IDS[b]
        wanted = reference["contactChecks"]["passes"][offset]
        if wanted is None:
            violations.append("contact check reached beyond independent no-contact stage")
            continue
        gap = finite(wanted["separationRawM"])
        expected_free = reference["frames"]["freeBodies"]
        positions = same_bits(check["aPositionM"], expected_free[a]["positionM"]) and same_bits(check["bPositionM"], expected_free[b]["positionM"])
        no_hit = check["hit"] is None and gap > 0
        metrics["contactChecks"]["passes"][offset] = {"pass":pass_index, "pairIndex":pair_index, "aId":IDS[a], "bId":IDS[b], "positionsMatch":positions, "hitMatch":check["hit"] is None, "noHit":no_hit, "separationRawM":gap, "separationNormalizedM":gap, "precisionMaxDifferenceM":wanted["precisionMaxDifferenceM"]}
        if not positions or not no_hit:
            violations.append("cross-group contact/position disagreement at pass " + str(pass_index) + " pair " + str(pair_index))
    if data is not None:
        metrics["checks"]["contactSequenceMatch"] = sequence and len(recorded) == sum(x is not None for x in reference["contactChecks"]["passes"])
    final_frame = actual.get("source") if request["op"] == "initial" else actual.get("projected")
    if final_frame is not None:
        for index, (a, b) in enumerate(CROSS):
            with localcontext() as context:
                context.prec = 80;low = separation(final_frame, a, b)
            with localcontext() as context:
                context.prec = 120;high = separation(final_frame, a, b)
            gap = float(high);repeat = float(abs(high - low))
            expected_frame = reference["frames"]["sourceBodies"] if request["op"] == "initial" else reference["frames"]["projectedBodies"]
            positions = expected_frame is not None and error(final_frame[a]["positionM"], expected_frame[a]["positionM"]) <= 1e-12 and error(final_frame[b]["positionM"], expected_frame[b]["positionM"]) <= 1e-12
            # No extra native final detector call exists. Geometry is tested;
            # native hit correspondence is honestly unreached, not true.
            metrics["contactChecks"]["final"][index] = {"pass":None, "pairIndex":index, "aId":IDS[a], "bId":IDS[b], "positionsMatch":positions, "hitMatch":None, "noHit":gap > 0, "separationRawM":gap, "separationNormalizedM":gap, "precisionMaxDifferenceM":repeat}
            if not positions:
                violations.append("final independent position correspondence failed pair " + str(index))
            if gap <= 0 or repeat > 1e-25:
                violations.append("final cross-group separation failed pair " + str(index))


def parent_reply(index, parent_input, progress, data, request, reference, metrics, violations):
    if parent_input is None:
        return
    supplied = progress["projection"] if progress is not None else data["pairs"][index]["projection"] if data is not None and data["pairs"][index] is not None else None
    query = copy.deepcopy(parent_input)
    if supplied is not None:
        query["output"] = copy.deepcopy(supplied)
        query["afterRawHex"] = progress["projectedRawHex"] if progress is not None else raw(supplied["bodies"])
        metrics["pairActualCompared"][index] = True
    try:
        reply = P.evaluate_physical(query)
    except P.ReferenceSystemError as caught:
        reply = {"ok":False, "resolved":True, "executionFailure":False, "code":"REFERENCE_SYSTEM", "message":str(caught), "violations":[str(caught)]}
    except (P.ReferenceInputError, P.POSE.ReferenceInputError, P.OLD.ReferenceInputError) as caught:
        reply = {"ok":False, "resolved":False, "executionFailure":True, "code":"REFERENCE_INPUT", "message":str(caught)}
    reference["pairReplies"][index] = reply
    if reply.get("resolved") is not True or reply.get("executionFailure") is not False:
        raise Unresolved("inherited parent reply is unresolved for " + JIDS[index])
    if supplied is not None:
        qualified = reply.get("ok") is True and reply.get("metrics", {}).get("actualNativeCertificatePassed") is True and reply.get("metrics", {}).get("actualFrameCertificatePassed") is True
        metrics["checks"]["pairs"][index]["parentActualQualified"] = qualified
    if "certificate" in reply:
        violations.extend("parent " + JIDS[index] + ": " + text for text in reply["violations"])
    elif reference["expectedRefusal"] is None or reference["expectedRefusal"]["message"] != "private hinge velocity system is singular or unsafe":
        raise Unresolved("independent parent system refusal was not predicted")


def compare_pair(index, request, data, progress, reference, metrics, actual, violations):
    expected = reference["pairs"][index];flags = metrics["checks"]["pairs"][index]
    pair = data["pairs"][index] if data is not None else None
    motor = progress["motor"] if progress is not None else pair["motor"] if pair is not None else None
    flags["acceptedReportAuthorityMatch"] = data["acceptedReportAnglesRad"][index] == reference["authority"]["acceptedReportAnglesRad"][index] if data is not None and "acceptedReportAnglesRad" in data else pair["acceptedReportAngleRad"] == reference["authority"]["acceptedReportAnglesRad"][index] if pair is not None else None
    errs = None
    if motor is not None:
        wanted = expected["motor"]
        if wanted is None:
            violations.append(JIDS[index] + " motor reached beyond independent stage")
        else:
            errs = {key:None for key in REPORT_ERRORS}
            errs["motorImpulseNms"] = error(motor["impulseNms"], wanted["impulseNms"])
            errs["motorSpeedBeforeRadps"] = error(motor["relativeSpeedBeforeRadps"], wanted["relativeSpeedBeforeRadps"])
            errs["motorSpeedAfterRadps"] = error(motor["relativeSpeedAfterRadps"], wanted["relativeSpeedAfterRadps"])
            flags["motorMetadataMatch"] = all(motor[key] == wanted[key] for key in ("targetSpeedRadps", "limitRad", "maxImpulseNms"))
            flags["motorBranchMatch"] = motor["inputAngleRad"] == wanted["inputAngleRad"] and motor["blocked"] == wanted["blocked"]
    report_record = progress["report"] if progress is not None else {key:pair[key] for key in ("jointReport", "bodyCorrections", "reportCap")} if pair is not None else None
    if report_record is not None:
        report = report_record["jointReport"];corr = report_record["bodyCorrections"];cap = report_record["reportCap"]
        wanted = expected["jointReport"]
        if wanted is None:
            violations.append(JIDS[index] + " report reached beyond independent stage")
        else:
            errs = errs or {key:None for key in REPORT_ERRORS}
            for field in ("angleRad", "linearImpulseNs", "angularImpulseNms", "motorImpulseNms"):
                errs[field] = max(errs[field] or 0.0, error(report[field], wanted[field]))
            errs["bodyLinearImpulseNs"] = max(error(a["linearImpulseNs"], b["linearImpulseNs"]) for a, b in zip(corr, expected["bodyCorrections"]))
            errs["bodyAngularImpulseNms"] = max(error(a["angularImpulseNms"], b["angularImpulseNms"]) for a, b in zip(corr, expected["bodyCorrections"]))
            errs["angularReactionNormNms"] = error(cap["angularReactionNormNms"], expected["reportCap"]["angularReactionNormNms"])
            flags["jointReportIdentityMatch"] = report["id"] == JIDS[index] and report["aId"] == IDS[2 * index] and report["bId"] == IDS[2 * index + 1] and report["kind"] == "hinge"
            projected = progress["projection"]["bodies"] if progress is not None and progress["projection"] is not None else pair["projection"]["bodies"] if pair is not None else None
            actual_projection = progress["projection"] if progress is not None else pair["projection"] if pair is not None else None
            flags["targetAngleAuthorityMatch"] = actual_projection is not None and report["angleRad"] == actual_projection["poseReport"]["targetAngleRad"]
            incoming = actual.get("postContact")
            if projected is not None and incoming is not None:
                baseline = incoming[2 * index:2 * index + 2]
                actual_jumps = [{"linearImpulseNs":M.scale(M.sub(b["velocityMps"], a["velocityMps"]), 1.0 / a["inverseMass"]), "angularImpulseNms":M.scale(M.sub(b["angularVelocityRadps"], a["angularVelocityRadps"]), a["inertiaKgM2"])} for a, b in zip(baseline, projected)]
                for a, b in zip(corr, actual_jumps):
                    errs["bodyLinearImpulseNs"] = max(errs["bodyLinearImpulseNs"], error(a["linearImpulseNs"], b["linearImpulseNs"]))
                    errs["bodyAngularImpulseNms"] = max(errs["bodyAngularImpulseNms"], error(a["angularImpulseNms"], b["angularImpulseNms"]))
                norm = math.hypot(*actual_jumps[1]["angularImpulseNms"])
                flags["reportBaselineIsPostContact"] = errs["bodyLinearImpulseNs"] <= 1e-12 and errs["bodyAngularImpulseNms"] <= 1e-12
                flags["capDecisionMatch"] = cap["maxReactionNms"] == .01 and cap["exceedsCap"] == (norm > .01) == expected["reportCap"]["exceedsCap"]
                errs["angularReactionNormNms"] = max(errs["angularReactionNormNms"], abs(finite(cap["angularReactionNormNms"]) - norm))
    metrics["reportErrors"][index] = errs
    if errs is not None:
        for key, value in errs.items():
            gate = 1e-9 if key == "angleRad" else 1e-10 if key.startswith("motorSpeed") else 1e-12
            if value is not None and value > gate:
                violations.append(JIDS[index] + " " + key + " report/motor error exceeds frozen gate")
    if pair is not None:
        for phase in PHASES:
            obs = expected["phaseMetrics"][phase]
            if obs is not None:
                errs_pair = M.pair_error(pair["metrics"][phase], obs["raw"])
                metrics["pairErrors"][index][phase] = errs_pair
                if any(x > 1e-12 for x in errs_pair.values()):
                    violations.append(JIDS[index] + " " + phase + " published metric error exceeds SI gate")
        if expected["work"] is not None:
            work = pair["work"];energy = pair["energyByPhase"]
            errs_work = {key:error(work[key], expected["work"][key]) for key in WORK_FIELDS}
            errs_work["energyByPhaseJ"] = max(error(energy[key], expected["energyByPhase"][key]) for key in expected["energyByPhase"])
            errs_work["motorBalanceResidualJ"] = abs(finite(work["motorSpinMidpointJ"]) - finite(work["motorMidpointJ"]))
            metrics["workErrors"][index] = errs_work
            for key, value in errs_work.items():
                if value > (1e-10 if key == "projectionObjectiveJ" else 1e-12):
                    violations.append(JIDS[index] + " " + key + " work error exceeds J gate")


def world_quality(request, data, actual, reference, violations):
    """Selected World gates, separate from inherited POSTCONTACT conservation."""
    if "projected" not in actual:
        return
    with localcontext() as context:
        context.prec = 120
        for index in range(2):
            bodies = actual["projected"][2 * index:2 * index + 2]
            source = actual["source"][2 * index:2 * index + 2]
            report = data["pairs"][index]["jointReport"]["angleRad"] if data is not None and data["pairs"][index] is not None else reference["pairs"][index]["jointReport"]["angleRad"]
            origin = (Decimal(0), Decimal(0), Decimal(index));limits = (Decimal.from_float(-.8), Decimal.from_float(.8))
            observed = P.observed(M.old_bodies(bodies), Decimal.from_float(finite(report)), origin, limits)
            before = P.observed(M.old_bodies(source), Decimal.from_float(finite(request["sourceState"]["joints"][index]["angleRad"])), origin, limits)
            action = reference["parsedActions"][2 * index:2 * index + 2]
            external = [0.0, 0.0, 0.0]
            for item in action:
                external = M.add(external, M.add(item["angularImpulseNms"] if item["angularImpulseNms"] is not None else [0.0] * 3, M.scale(item["torqueNm"] if item["torqueNm"] is not None else [0.0] * 3, DT)))
            for mode in ("raw", "normalized"):
                value = observed[mode]
                if value["anchorGapM"] > Decimal.from_float(.002) or value["axisDeviationRad"] > math.pi / 180 or abs(value["reportedAngleDifferenceRad"]) > 1e-9 or value["limitExcessRad"] > 1e-9 or value["quaternionNormError"] > Decimal.from_float(1e-9):
                    violations.append(JIDS[index] + " " + mode + " original World geometry gate failed")
                if P.OLD.magnitude(tuple(x - y for x, y in zip(value["centerOfMassM"], origin))) > Decimal.from_float(1e-5):
                    violations.append(JIDS[index] + " " + mode + " original World COM drift gate failed")
                momentum_delta = tuple(x - y for x, y in zip(value["linearMomentumVectorKgMps"], before[mode]["linearMomentumVectorKgMps"]))
                angular_delta = tuple(x - y - Decimal.from_float(z) for x, y, z in zip(value["angularMomentumVectorKgM2ps"], before[mode]["angularMomentumVectorKgM2ps"], external))
                if P.OLD.magnitude(momentum_delta) > Decimal.from_float(1e-7) or P.OLD.magnitude(angular_delta) > Decimal.from_float(1e-7):
                    violations.append(JIDS[index] + " " + mode + " command-accounted World momentum gate failed")
            for body, previous in zip(bodies, source):
                if abs(finite(body["positionM"][2]) - index) > 1e-12:
                    violations.append(body["id"] + " original World plane drift exceeds 1e-12 m")
                if math.hypot(*M.sub(body["positionM"], previous["positionM"])) > 10:
                    violations.append(body["id"] + " accepted-to-final movement exceeds original 10 m")


def compare(request, reference, parent_inputs, prec):
    metrics = empty_metrics(prec);violations = [];checks = metrics["checks"]
    initial = request["op"] == "initial"
    if initial:
        actual = {"source":restore(request["sourceState"]["bodies"], request["sourceRawHex"])}
        # Metadata comes from independently parsed immutable rest configuration.
        actual["source"] = [{**wanted, **body} for wanted, body in zip(reference["frames"]["sourceBodies"], actual["source"])]
        data = None
    else:
        data, actual = actual_shape(request)
    metrics["actualCompared"] = True
    compare_frames(actual, reference, metrics, violations)
    checks["sourceRawMatchesInput"] = (request["sourceRawHex"] if initial else request["rawFrames"]["source"]) == reference["rawFrames"]["source"]
    checks["negativeZeroPathsMatch"] = True
    checks["sourceCursorRetained"] = reference["authority"]["sourceStepIndex"] == request["sourceState"]["stepIndex"] and reference["authority"]["sourceTimeSeconds"] == request["sourceState"]["timeSeconds"]
    checks["heldFrameBitsMatch"] = True
    checks["frameReachabilityMatch"] = True
    if initial:
        for index in range(2):
            checks["pairs"][index]["acceptedReportAuthorityMatch"] = request["sourceState"]["joints"][index]["angleRad"] == 0 and vector(request["sourceState"]["joints"][index]["linearImpulseNs"]) == [0, 0, 0] and vector(request["sourceState"]["joints"][index]["angularImpulseNms"]) == [0, 0, 0] and finite(request["sourceState"]["joints"][index]["motorImpulseNms"]) == 0
    else:
        checks["commandsRawMatchesInput"] = True  # Strict decoded action admission ran independently.
        expected_error = None if reference["expectedRefusal"] is None else {key:reference["expectedRefusal"][key] for key in ("name", "code", "message")}
        checks["actualErrorMatch"] = request["error"] == expected_error
        checks["actualOutcomeMatch"] = (request["outcome"] == "returned") == (expected_error is None)
        attempt, output = request["attempt"], request["output"]
        if data is not None:
            checks["sourceCursorRetained"] = checks["sourceCursorRetained"] and data["sourceStepIndex"] == reference["authority"]["sourceStepIndex"] and data["sourceTimeSeconds"] == reference["authority"]["sourceTimeSeconds"]
            reached_contacts = sum(x is not None for x in reference["contactChecks"]["passes"])
            checks["callsMatch"] = data["calls"] == reference["calls"] and data["contactPasses"] == reached_contacts // 4 and data["pairStats"] == {"eligiblePairs":reached_contacts, "candidatePairs":reached_contacts, "aabbTests":0}
            checks["parsedActionsMatch"] = data.get("parsedActions", [action for pair in data["pairs"] if pair is not None for action in pair["parsedActions"]]) == reference["parsedActions"]
        if attempt is not None:
            checks["attemptCursorCorrect"] = attempt["attemptedStepIndex"] == reference["authority"]["attemptedStepIndex"] and attempt["attemptedTimeSeconds"] == reference["authority"]["attemptedTimeSeconds"]
            checks["frameReachabilityMatch"] = attempt["stage"] == reference["stage"]
            checks["pairProgressMatch"] = all(progress["calls"]["motorCalls"] == (1 if reference["pairs"][i]["motor"] is not None else 0) and progress["completedCalls"]["motorCalls"] == (1 if reference["pairs"][i]["motor"] is not None else 0) for i, progress in enumerate(attempt["pairProgress"]))
        if output is not None:
            need("projected" in actual)
            state = output["state"]
            checks["outputAttemptCorrespondence"] = raw(state["bodies"]) == request["rawFrames"]["projected"] and state["stepIndex"] == reference["authority"]["attemptedStepIndex"] and state["timeSeconds"] == reference["authority"]["attemptedTimeSeconds"]
            for i, pair in enumerate(data["pairs"]):
                checks["outputAttemptCorrespondence"] = checks["outputAttemptCorrespondence"] and pair is not None and state["joints"][i] == pair["jointReport"]
            if attempt is not None:
                checks["outputAttemptCorrespondence"] = checks["outputAttemptCorrespondence"] and all(attempt[key] == data[key] for key in ("frames", "pairs", "calls", "contactPasses", "pairStats", "contactChecks"))
            checks["finiteSignedWork"] = True
            checks["nonnegativeEnergiesAndObjective"] = all(all(finite(x) >= 0 for x in pair["energyByPhase"].values()) and finite(pair["work"]["projectionObjectiveJ"]) >= 0 for pair in data["pairs"])
            if state["contacts"] or state["events"] or state["ccdHits"] or state["pairStats"] != {"eligiblePairs":32, "candidatePairs":32, "aabbTests":0}:
                violations.append("accepted World contact/event/counter profile differs")
        elif data is not None and all(pair is not None for pair in data["pairs"]):
            checks["finiteSignedWork"] = True
            checks["nonnegativeEnergiesAndObjective"] = all(all(finite(x) >= 0 for x in pair["energyByPhase"].values()) and finite(pair["work"]["projectionObjectiveJ"]) >= 0 for pair in data["pairs"])
        for i in range(2):
            progress = attempt["pairProgress"][i] if attempt is not None else None
            parent_reply(i, parent_inputs[i], progress, data, request, reference, metrics, violations)
            compare_pair(i, request, data, progress, reference, metrics, actual, violations)
        for phase, before in (("angular", "source"), ("motor", "angular")):
            if phase in actual and before in actual:
                checks["heldFrameBitsMatch"] = checks["heldFrameBitsMatch"] and all(same_bits(a[field], b[field]) for a, b in zip(actual[phase], actual[before]) for field in ("positionM", "orientation", "velocityMps"))
        if "postContact" in actual and "free" in actual:
            checks["heldFrameBitsMatch"] = checks["heldFrameBitsMatch"] and raw(actual["postContact"]) == raw(actual["free"])
        for i, reply in enumerate(reference["pairReplies"]):
            if metrics["pairActualCompared"][i] and reply is not None and reply.get("certificate", {}).get("expected", {}).get("identity") is True:
                progress = attempt["pairProgress"][i] if attempt is not None else None
                projected = progress["projection"]["bodies"] if progress else data["pairs"][i]["projection"]["bodies"]
                if "postContact" in actual:
                    checks["heldFrameBitsMatch"] = checks["heldFrameBitsMatch"] and all(same_bits(a[field], b[field]) for a, b in zip(actual["postContact"][2 * i:2 * i + 2], projected) for field in ("velocityMps", "angularVelocityRadps"))
    contact_comparison(request, data, actual, reference, metrics, violations)
    if not initial:
        world_quality(request, data, actual, reference, violations)
    for key, value in checks.items():
        if key != "pairs" and value is False:
            violations.append(key + " is false")
    for i, flags in enumerate(checks["pairs"]):
        for key, value in flags.items():
            if value is False:
                violations.append(JIDS[i] + " " + key + " is false")
    if not initial and request["outcome"] == "returned" and not all(metrics["pairActualCompared"]):
        raise Unresolved("returned World has no complete actual parent qualification")
    return metrics, violations
