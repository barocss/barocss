#!/usr/bin/env python3
"""Independent cold full-pair optimum, adopted SAT and point-ledger observer.

No producer module or World is imported. Raw archives define observed binary
poses; native output never defines the expected optimum. Scalar transcendental
seeds in the unchanged parent are not Decimal transcendental certificates.
"""
import copy
import gzip
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct
import sys
from fractions import Fraction

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent


def load(name,path):
    spec = importlib.util.spec_from_file_location(name,path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


F = load("cold_full_pair_1399",HERE / "full-pair-reference.py")
NINE = load("cold_nine_masks_1399",HERE / "nine-row-reference.py")
PARENT = load("unchanged_live_observer_1384",HERE.parent / "physics-rigid-signed-closure-world" / "reference.py")
MESSAGE = "full-pair world reference request is invalid"
JSON_MESSAGE = "full-pair world reference line must be valid JSON"
GATE = Fraction.from_float(1e-12)
RESULT_KEYS = ("ok","status","basisRows","basisRank","dynamicDof","counters","trace","lastSafeIterate","translations","lambdaKgM","primalMarginsM","objectiveKgM2","certificate","infeasibilityCertificate","reason","worldStepped")
CERT_KEYS = ("primalViolationM","negativeMultiplierKgM","complementarityKgM2","stationarityKgM")
COUNTER_LIMITS = {"iterations":1024,"activeChanges":1024,"rankChecks":2048,"linearSolves":2048,"constraintTests":262144,"factorizations":2048,"blockRightHandSides":57344,"exactIntegerOperations":1000000,"exactPeakBits":16385}
UNSAFE = {"nonfinite","negative-step","negative-multiplier","pivot","condition","factor-residual","direction-residual","near-dependent-independent","dependent-basis","dependency-conversion","uncertified-infeasibility","iterate-certificate","result-certificate","translation-bound"}
WORK = {"cycle"}|{"budget:"+key for key in ("iterations","activeChanges","rankChecks","linearSolves","constraintTests","exactIntegerOperations","reducedRationalBits","intermediateIntegerBits")}
BODY_FIELDS = (("positionM",3),("velocityMps",3),("orientation",4),("angularVelocityRadps",3))


def integer(value,maximum=9007199254740991):
    F.need(type(value) is int and 0 <= value <= maximum)
    return value


def array(value,length):
    F.need(type(value) is list and len(value) == length)
    return value


def numbers(value,length):
    return [F.finite(x) for x in array(value,length)]


def indexes(value,m):
    F.need(type(value) is list)
    for x in value:
        integer(x,m-1)
    F.need(value == sorted(set(value)))
    return value


def bits(value):
    return struct.pack("<d",F.finite(value))


def numeric_tree(value):
    if type(value) is dict:
        for item in value.values():
            numeric_tree(item)
    elif type(value) is list:
        for item in value:
            numeric_tree(item)
    elif type(value) in (int,float):
        F.finite(value)
    else:
        F.need(value is None or type(value) in (str,bool))


def result_shape(result,model):
    F.keys(result,RESULT_KEYS)
    m,d = model["m"],model["d"]
    F.need(type(result["ok"]) is bool and result["worldStepped"] is False)
    F.need(type(result["status"]) is str and result["status"] in ("SOLVED","INFEASIBLE","NUMERIC_UNSAFE","WORK_LIMIT"))
    F.need(result["ok"] == (result["status"] == "SOLVED"))
    indexes(result["basisRows"],m);integer(result["basisRank"],d)
    F.need(result["basisRank"] == len(result["basisRows"]) and result["dynamicDof"] == d and type(result["dynamicDof"]) is int)
    F.keys(result["counters"],COUNTER_LIMITS)
    for key,limit in COUNTER_LIMITS.items():
        integer(result["counters"][key],limit)
    F.need(type(result["trace"]) is list and len(result["trace"]) <= result["counters"]["iterations"]+1)
    for record in result["trace"]:
        F.keys(record,("iteration","enteringRow","basisBefore","basisAfter","action","blocker","stepKgM","schurInverseKg","condition","exactDependent"))
        integer(record["iteration"],1024)
        for key in ("enteringRow","blocker"):
            if record[key] is not None:
                integer(record[key],m-1)
        indexes(record["basisBefore"],m);indexes(record["basisAfter"],m)
        F.need(record["action"] in ("add","drop","dependent-drop","infeasible","unsafe","work-limit") and (record["exactDependent"] is None or type(record["exactDependent"]) is bool))
        for key in ("stepKgM","schurInverseKg","condition"):
            if record[key] is not None:
                F.finite(record[key])
    safe = result["lastSafeIterate"]
    F.keys(safe,("uDynamic","lambdaKgM","pendingRow","pendingLambdaKgM","basisRows"))
    numbers(safe["uDynamic"],d);numbers(safe["lambdaKgM"],m);indexes(safe["basisRows"],m)
    F.finite(safe["pendingLambdaKgM"])
    if safe["pendingRow"] is not None:
        integer(safe["pendingRow"],m-1)
    if result["status"] == "SOLVED":
        F.need(result["reason"] is None and result["infeasibilityCertificate"] is None)
        F.keys(result["certificate"],CERT_KEYS)
        for x in result["certificate"].values():
            F.need(F.finite(x) >= 0)
        numbers(result["lambdaKgM"],m);numbers(result["primalMarginsM"],m)
        F.need(F.finite(result["objectiveKgM2"]) >= 0)
        array(result["translations"],len(model["bodies"]))
        for body,translation in zip(model["bodies"],result["translations"]):
            F.keys(translation,("id","u"));F.need(translation["id"] == body["id"])
            values = numbers(translation["u"],3)
            if body["inverseMass"] == 0:
                F.need(all(bits(x) == bytes(8) for x in values))
    else:
        F.need(all(result[key] is None for key in ("translations","lambdaKgM","primalMarginsM","objectiveKgM2","certificate")))
        if result["status"] == "INFEASIBLE":
            F.need(result["reason"] is None and type(result["infeasibilityCertificate"]) is dict)
        else:
            F.need(result["infeasibilityCertificate"] is None)
            F.need(type(result["reason"]) is str and result["reason"] in (UNSAFE if result["status"] == "NUMERIC_UNSAFE" else WORK))


def check_farkas(witness,model,r):
    F.keys(witness,("weights","sumWeights","dynamicDot","boundDotM"))
    weights = [F.parse_rational(x) for x in array(witness["weights"],model["m"])]
    declared = [F.parse_rational(x) for x in array(witness["dynamicDot"],model["d"])]
    bound = F.parse_rational(witness["boundDotM"])
    F.need(witness["sumWeights"] == "1/1")
    dynamic = [r.total(r.mul(weights[i],model["a"][i][j]) for i in range(model["m"])) for j in range(model["d"])]
    actual_bound = r.dot(weights,model["b"])
    return all(x >= 0 for x in weights) and r.total(weights) == F.ONE and not any(dynamic) and dynamic == declared and bound == actual_bound and bound > 0


def compare(problem,result,expected):
    if result is None:
        return None,[]
    r = F.Arithmetic();model = F.decode(problem,r);result_shape(result,model)
    status = result["status"];violations = []
    # A safe native refusal is fully observable, never a native solution/GO.
    if status in ("NUMERIC_UNSAFE","WORK_LIMIT"):
        return None,violations
    if status == "INFEASIBLE":
        valid = check_farkas(result["infeasibilityCertificate"],model,r)
        if not valid:
            violations.append("native infeasibility witness is not exact Farkas proof")
        if expected["referenceStatus"] != "INFEASIBLE":
            violations.append("native infeasibility differs from independent status")
        return {"infeasibilityCertificateValid":valid,"solutionReached":False},violations
    if expected["referenceStatus"] != "SOLVED":
        return {"solutionReached":True},["native solution differs from independent infeasibility"]
    dynamic = [r.binary(component) for body in result["translations"] if body["id"] in model["columns"] for component in body["u"]]
    lam = [r.binary(x) for x in result["lambdaKgM"]]
    full = F.margins(model,dynamic,r)
    stationary = [r.sub(r.div(dynamic[j],model["inverse"][j]),r.total(r.mul(model["a"][i][j],lam[i]) for i in range(model["m"]))) for j in range(model["d"])]
    objective = r.div(r.total(r.div(r.mul(x,x),inv) for x,inv in zip(dynamic,model["inverse"])),Fraction(2))
    residual = {"primalViolationM":max([F.ZERO]+[r.neg(x) for x in full]),"negativeMultiplierKgM":max([F.ZERO]+[r.neg(x) for x in lam]),
        "complementarityKgM2":max([F.ZERO]+[abs(r.mul(x,y)) for x,y in zip(lam,full)]),"stationarityKgM":max([F.ZERO]+[abs(x) for x in stationary])}
    translation_delta = max([F.ZERO]+[abs(r.sub(r.binary(v),e)) for actual,ideal in zip(result["translations"],expected["translations"]) for v,e in zip(actual["u"],ideal["u"])])
    objective_delta = abs(r.sub(r.binary(result["objectiveKgM2"]),expected["objectiveKgM2"]))
    declared_delta = max(abs(r.sub(r.binary(result["certificate"][key]),value)) for key,value in residual.items())
    margins_delta = max([F.ZERO]+[abs(r.sub(r.binary(x),y)) for x,y in zip(result["primalMarginsM"],full)])
    objective_recomputed = abs(r.sub(r.binary(result["objectiveKgM2"]),objective))
    metrics = {"translationDifferenceM":F.numeric(translation_delta),"objectiveDifferenceKgM2":F.numeric(objective_delta),
        "certificateReportedDifference":F.numeric(declared_delta),"marginReportedDifferenceM":F.numeric(margins_delta),"objectiveReportedDifferenceKgM2":F.numeric(objective_recomputed),
        **F.numeric(residual),"solutionReached":True,"actualCertificateExact":F.exact_tree(residual)}
    for key,value in {**residual,"translationDifferenceM":translation_delta,"objectiveDifferenceKgM2":objective_delta,"certificateReportedDifference":declared_delta,"marginReportedDifferenceM":margins_delta,"objectiveReportedDifferenceKgM2":objective_recomputed}.items():
        if value > GATE:
            violations.append(key+" exceeds frozen 1e-12 in stated units")
    if any(lam[i] != 0 for i in range(model["m"]) if i not in result["basisRows"]):
        violations.append("nonbasis native multiplier is not exact zero")
    for body in result["translations"]:
        if math.hypot(*body["u"]) > 10:
            violations.append("native translation exceeds ten metres")
    return metrics,violations


def nine_geometry(problem):
    recipe = json.loads((HERE / "start-input-recipe.json").read_text())
    root = HERE.parent.parent
    for path,sha in ((recipe["nativeArtifactPath"],recipe["nativeArtifactSha256"]),(recipe["rawArtifactPath"],recipe["rawArtifactSha256"])):
        F.need(hashlib.sha256((root / path).read_bytes()).hexdigest() == sha)
    index = recipe["frameIndex"]
    raw = gzip.decompress((root / recipe["rawArtifactPath"]).read_bytes())
    frame = raw[index["offsetBytes"]:index["offsetBytes"]+index["lengthBytes"]]
    F.need(len(frame) == 936 and hashlib.sha256(frame).hexdigest() == index["sha256"] and frame.hex() == recipe["preRawHex"])
    pre,_ = PARENT.raw_bodies(recipe["preBodies"],recipe["preRawHex"])
    record = None
    with gzip.open(root / recipe["nativeArtifactPath"],"rt") as stream:
        for line in stream:
            value = json.loads(line)
            if value.get("step") == index["step"]:
                record = value;break
    F.need(type(record) is dict and record["attempt"]["preBodies"] == recipe["preBodies"])
    F.need(record["attempt"]["choices"][-1]["problem"]["rows"] == recipe["eightRows"])
    F.need(problem["bodies"] == [{"id":b["id"],"inverseMass":b["inverseMass"]} for b in pre])
    F.need(len(problem["rows"]) == 9 and problem["rows"][:8] == recipe["eightRows"])
    ninth = problem["rows"][8];F.need(ninth["aId"] == "b6" and ninth["bId"] == "b7")
    expected = PARENT.compact_pair(pre[6],pre[7],"b6\0b7")
    delta = max(abs(F.finite(ninth["boundM"])-expected["selection"]["boundM"]),max(abs(F.finite(x)-y) for x,y in zip(ninth["normal"],expected["selection"]["normal"])))
    violations = [] if delta <= 1e-12 else ["ninth row differs from independent original PRE geometry"]
    return {"frameSha256":index["sha256"],"preRawVerified":True,"eightRowsVerified":True,"coefficientDifferenceM":delta,"pair":PARENT.strip_scalar([expected])[0]},violations


def kernel(request):
    F.keys(request,("op","scope","problem","result"));F.need(request["scope"] in ("nine-start","full-pair"))
    geometry = None;violations = []
    # Admission and provenance precede exact evaluation; expected has no access
    # to native translations, basis, multipliers, certificates or trace.
    F.decode(request["problem"],F.Arithmetic())
    if request["scope"] == "nine-start":
        geometry,violations = nine_geometry(request["problem"])
    expected = F.solve_exact(request["problem"])
    if expected["referenceStatus"].startswith("REFERENCE_"):
        return resource_reply(expected)
    if request["scope"] == "nine-start":
        masked = NINE.evaluate(request["problem"])
        if masked["referenceStatus"].startswith("REFERENCE_"):
            return resource_reply(masked)
        agrees = masked["referenceStatus"] == expected["referenceStatus"]
        if agrees and expected["referenceStatus"] == "SOLVED":
            agrees = masked["translations"] == expected["translations"] and masked["objectiveKgM2"] == expected["objectiveKgM2"]
        if not agrees:
            raise F.ResourceError("REFERENCE_WORK_LIMIT","independent-crosscheck-disagreement",expected["counters"])
        expected["maskCrosscheck"] = masked["maskCrosscheck"]
    metrics,actual_violations = compare(request["problem"],request["result"],expected)
    violations.extend(actual_violations)
    public = F.published(expected)
    if geometry is not None:
        public["nineStartGeometry"] = geometry
    return {"ok":not violations,"resolved":True,"executionFailure":False,"referenceStatus":expected["referenceStatus"],"metrics":metrics,"reference":public,"violations":violations}


def resource_reply(expected):
    return {"ok":False,"resolved":False,"executionFailure":True,"referenceStatus":expected["referenceStatus"],"metrics":None,"reference":F.published(expected),"violations":["independent exact reference resource limit: "+expected["reason"]]}


def world(request):
    F.keys(request,("op","scene","stepIndex","config","preBodies","preRawHex","problem","rowSelections","result","hypBodies","hypRawHex"))
    F.need(type(request["scene"]) is str);integer(request["stepIndex"])
    F.need(type(request["config"]) is dict);numeric_tree(request["config"])
    pre,pre_raw = PARENT.raw_bodies(request["preBodies"],request["preRawHex"])
    model = F.decode(request["problem"],F.Arithmetic())
    F.need(request["problem"]["bodies"] == [{"id":b["id"],"inverseMass":b["inverseMass"]} for b in pre])
    pairs = PARENT.eligible(pre);array(request["rowSelections"],len(pairs));array(request["problem"]["rows"],len(pairs))
    records = [];row_checks = [];violations = [];axis_difference = 0.0
    for i,(pair_key,ai,bi) in enumerate(pairs):
        expected = PARENT.compact_pair(pre[ai],pre[bi],pair_key);records.append(expected)
        source,row = request["rowSelections"][i],request["problem"]["rows"][i]
        F.keys(source,("rowIndex","pairKey","aIndex","bIndex","selection"))
        F.need(type(source["rowIndex"]) is int and source["rowIndex"] == i and source["pairKey"] == pair_key and type(source["aIndex"]) is int and source["aIndex"] == ai and type(source["bIndex"]) is int and source["bIndex"] == bi)
        F.need(row["aId"] == pre[ai]["id"] and row["bId"] == pre[bi]["id"])
        delta = PARENT.selection_difference(source["selection"],pre[ai],pre[bi],expected)
        row_delta = max(abs(F.finite(row["boundM"])-F.finite(source["selection"]["boundM"])),max(abs(F.finite(x)-F.finite(y)) for x,y in zip(row["normal"],source["selection"]["normal"])))
        axis_difference = max(axis_difference,delta,row_delta)
        row_checks.append({"pairKey":pair_key,"rowIndex":i,"selectionDifferenceM":delta,"rowDifferenceM":row_delta})
        if delta > 1e-12 or row_delta > 1e-12:
            violations.append("PRE signed row differs from independent geometry: "+pair_key)
    reply = kernel({"op":"kernel","scope":"full-pair","problem":request["problem"],"result":request["result"]})
    if not reply["resolved"]:
        return reply
    violations.extend(reply["violations"])
    metrics = dict(reply["metrics"] or {})
    metrics.update(maxPreAxisDifferenceM=axis_difference,maxHypDepthRawM=None,maxHypDepthNormalizedM=None,heldBitsMatch=None,roundedFinalMatches=None,staticBitsMatch=None,
        maxRoundedFinalDifferenceM=None,precisionMaxDifferenceM=max([0.0]+[F.finite(x["precisionMaxDifferenceM"]) for x in records]),
        rawNormalizedDepthDifferenceM=max([0.0]+[F.finite(x["rawNormalizedDepthDifferenceM"]) for x in records]),stageReached=False)
    for record in records:
        if F.finite(record["precisionMaxDifferenceM"]) > 1e-25 or F.finite(record["rawNormalizedDepthDifferenceM"]) > 1e-12 or F.finite(record["rawNormalizedMarginDifferenceM"]) > 1e-12:
            violations.append("PRE geometry precision/agreement is unresolved: "+record["pairKey"])
    hyp_records = [];actual_delta = None;roundoff = None;actual_row_margins = None
    F.need((request["hypBodies"] is None) == (request["hypRawHex"] is None))
    if request["hypBodies"] is not None:
        F.need(request["result"] is not None and request["result"]["status"] == "SOLVED")
        hyp,hyp_raw = PARENT.raw_bodies(request["hypBodies"],request["hypRawHex"]);array(hyp,len(pre))
        held = True;rounded = True;static = True;position_delta = 0.0
        translations = request["result"]["translations"];r = F.Arithmetic()
        actual_delta = [];roundoff = [];dynamic_delta = []
        for i,(before,after,translation) in enumerate(zip(pre,hyp,translations)):
            F.need(before["id"] == after["id"])
            before_meta = {key:value for key,value in before.items() if key not in ("positionM","velocityMps","orientation","angularVelocityRadps")}
            after_meta = {key:value for key,value in after.items() if key not in ("positionM","velocityMps","orientation","angularVelocityRadps")}
            held = held and before_meta == after_meta
            for key in ("velocityMps","orientation","angularVelocityRadps"):
                held = held and all(bits(x) == bits(y) for x,y in zip(before[key],after[key]))
            if before["inverseMass"] == 0:
                static = static and pre_raw[i*104:(i+1)*104] == hyp_raw[i*104:(i+1)*104]
                target = before["positionM"]
            else:
                target = [F.finite(x+y) for x,y in zip(before["positionM"],translation["u"])]
            rounded = rounded and all(bits(x) == bits(y) for x,y in zip(target,after["positionM"]))
            position_delta = max(position_delta,max(abs(x-y) for x,y in zip(target,after["positionM"])))
            decoded = [r.sub(r.binary(y),r.binary(x)) for x,y in zip(before["positionM"],after["positionM"])]
            addition_error = [r.sub(x,r.binary(y)) for x,y in zip(decoded,translation["u"])]
            actual_delta.append({"id":before["id"],"uExact":F.exact_tree(decoded),"u":F.numeric(decoded)})
            roundoff.append({"id":before["id"],"errorExactM":F.exact_tree(addition_error),"errorM":F.numeric(addition_error)})
            if before["inverseMass"] != 0:
                dynamic_delta.extend(decoded)
        actual_row_margins = F.exact_tree(F.margins(model,dynamic_delta,r))
        for pair_key,ai,bi in pairs:
            hyp_records.append(PARENT.compact_pair(hyp[ai],hyp[bi],pair_key))
        metrics.update(stageReached=True,heldBitsMatch=held,roundedFinalMatches=rounded,staticBitsMatch=static,maxRoundedFinalDifferenceM=position_delta,
            maxHypDepthRawM=max([0.0]+[F.finite(x["rawDepthM"]) for x in hyp_records]),maxHypDepthNormalizedM=max([0.0]+[F.finite(x["normalizedDepthM"]) for x in hyp_records]))
        metrics["precisionMaxDifferenceM"] = max(metrics["precisionMaxDifferenceM"],max([0.0]+[F.finite(x["precisionMaxDifferenceM"]) for x in hyp_records]))
        metrics["rawNormalizedDepthDifferenceM"] = max(metrics["rawNormalizedDepthDifferenceM"],max([0.0]+[F.finite(x["rawNormalizedDepthDifferenceM"]) for x in hyp_records]))
        for key in ("heldBitsMatch","roundedFinalMatches","staticBitsMatch"):
            if not metrics[key]:
                violations.append(key+" is false")
        for record in hyp_records:
            if F.finite(record["rawDepthM"]) > 1e-12 or F.finite(record["normalizedDepthM"]) > 1e-12:
                violations.append("hypothesis overlap exceeds 1e-12: "+record["pairKey"])
            if F.finite(record["precisionMaxDifferenceM"]) > 1e-25 or F.finite(record["rawNormalizedDepthDifferenceM"]) > 1e-12 or F.finite(record["rawNormalizedMarginDifferenceM"]) > 1e-12:
                violations.append("hypothesis geometry precision/agreement is unresolved: "+record["pairKey"])
    reference = {**reply["reference"],"prePairs":PARENT.strip_scalar(records),"hypPairs":PARENT.strip_scalar(hyp_records),"rowChecks":row_checks,
        "actualDecodedDelta":actual_delta,"additionRoundoff":roundoff,"actualDecodedRowMarginsExactM":actual_row_margins,
        "oneApplyBasis":"original PRE plus independently checked native u; binary64 add once; static raw copy","nonpenetrationChecked":metrics["stageReached"]}
    return {"ok":not violations,"resolved":True,"executionFailure":False,"referenceStatus":reply["referenceStatus"],"metrics":metrics,"reference":reference,"violations":violations}


def evaluate(request):
    F.need(type(request) is dict)
    try:
        if request.get("op") == "kernel":
            return kernel(request)
        if request.get("op") == "world":
            return world(request)
        if request.get("op") == "step-ledger":
            reply = PARENT.step_ledger(request)
            return {**reply,"referenceStatus":"LEDGER"}
        raise F.InputError(MESSAGE)
    except F.ResourceError as error:
        return resource_reply({"referenceStatus":error.status,"reason":error.reason,"counters":error.counters})
    except (PARENT.ProtocolError,PARENT.PARENT.ProtocolError,PARENT.PARENT.LINEAR.ReferenceError,PARENT.PARENT.SAT.ReferenceInputError,PARENT.PARENT.COVERAGE.ReferenceInputError):
        raise F.InputError(MESSAGE) from None


def main():
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            request = json.loads(line,parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
        except (json.JSONDecodeError,ValueError):
            reply = {"ok":False,"resolved":False,"executionFailure":True,"referenceStatus":"REFERENCE_JSON","metrics":None,"reference":None,"code":"REFERENCE_JSON","message":JSON_MESSAGE,"violations":[]}
        else:
            try:
                reply = evaluate(request)
            except F.InputError:
                reply = {"ok":False,"resolved":False,"executionFailure":True,"referenceStatus":"REFERENCE_INPUT","metrics":None,"reference":None,"code":"REFERENCE_INPUT","message":MESSAGE,"violations":[]}
        print(json.dumps(reply,allow_nan=False,separators=(",",":")),flush=True)


if __name__ == "__main__":
    main()
