#!/usr/bin/env python3
"""Selected saved-POSTCONTACT cold JSONL qualification adapter.

The original authenticated whole request, never new actual or POSTCONTACT as a
whole-step seed, is admitted at repaired120 and derived once at80 and once at120.
New actual is not inspected until every independent/bank gate has succeeded.
Unexpected faults remain process failures with the caller's raw IPC prefix.
"""
import copy
from decimal import localcontext
import importlib.util
import json
import os
from pathlib import Path
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "physics-rigid-hinge-velocity-world-reference"))
from world_schema import admit, restore_pointers, restore, raw, InputError, Unresolved, M, P, PHASES
from world_derivation import derive
from world_observation import precision


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


C = module("saved_phase_actual_compare", "actual-compare.py")
G = module("saved_phase_expected_gates", "expected-gates.py")
JSON_MESSAGE = "hinge world reference line must be valid JSON"
INPUT_MESSAGE = "hinge world reference input is invalid"


def protocol(code, message):
    return {"ok":False, "resolved":False, "executionFailure":True, "referenceStatus":"UNRESOLVED",
            "metrics":None, "reference":None, "violations":[], "error":{"code":code, "message":message}}


def envelope(status, metrics, reference, violations):
    return {"ok":status == "RETURN", "resolved":status != "UNRESOLVED", "executionFailure":status == "UNRESOLVED",
            "referenceStatus":status, "metrics":metrics, "reference":C.encode_exact(reference), "violations":violations, "error":None}


def before_correspondence(bank, original):
    record = bank["nativeRecord"]
    before = record["before"] if bank["locator"]["name"] == "FIRST" else record["acceptedStoreBefore"]
    # acceptedStore JSON lacks independent signed-zero authority. Reuse the
    # authenticated request pointers and original source raw, not regenerated raw.
    public = {key:copy.deepcopy(before[key]) for key in original["sourceState"]}
    public["bodies"] = [C.public_body(body) for body in before["bodies"]]
    try:
        C.restore_paths(public, original["negativeZeroPaths"]["sourceState"])
        public["bodies"] = restore(public["bodies"], original["rawFrames"]["source"])
    except InputError:
        return False
    return C.same_bits_tree(public, original["sourceState"]) and before["stepIndex"] == bank["locator"]["sourceCursor"]


def compare_bank(reference, models, bank, metrics):
    """Original numerical correspondence gates, distinct from actual bit reuse."""
    failures = []
    evidence = {"frameErrors":{}, "pairErrors":[], "reportErrors":[], "workErrors":[],
                "derivedRawBitsEqualBank":{}, "historicalExpectedFrameErrors":{}, "coefficientErrors":[]}
    original = bank["admittedRequest"]
    frames = original["attempt"]["frames"]
    post_passed = True
    expected_passed = reference["stage"] == "report-ready" and reference["expectedRefusal"] is None

    def check(label, value, bound, phase=None):
        nonlocal post_passed, expected_passed
        if value > bound:
            failures.append(label + "=" + repr(value) + " exceeds " + repr(bound))
            if phase == "postContact":
                post_passed = False
            else:
                expected_passed = False

    for phase in PHASES:
        predicted = reference["frames"][phase + "Bodies"]
        if predicted is None:
            expected_passed = False
            if phase == "postContact":
                post_passed = False
            failures.append("derived bank." + phase + " was not reached")
            continue
        bodies = restore(frames[phase + "Bodies"], original["rawFrames"][phase], internal=True)
        errs = M.frame_error(bodies, predicted)
        evidence["frameErrors"][phase] = errs
        evidence["derivedRawBitsEqualBank"][phase] = raw(predicted) == original["rawFrames"][phase]
        for field, bound in (("positionM", 1e-12), ("quaternion", 1e-12), ("velocityMps", 1e-10),
                             ("angularVelocityRadps", 1e-9 if phase == "projected" else 1e-10)):
            check("derived bank." + phase + "." + field, errs[field], bound, phase)
        if errs["metadataMatch"] is not True:
            failures.append("derived bank." + phase + " original metadata differs")
            if phase == "postContact":
                post_passed = False
            else:
                expected_passed = False
        # Historical independently expected frames are separate from the native
        # bank output. They are available in the preserved complete World reply.
        historical = bank["reply"]["reference"]["frames"][phase + "Bodies"]
        historical_errors = M.frame_error(historical, predicted)
        evidence["historicalExpectedFrameErrors"][phase] = historical_errors
        for field, bound in (("positionM", 1e-12), ("quaternion", 1e-12), ("velocityMps", 1e-10),
                             ("angularVelocityRadps", 1e-9 if phase == "projected" else 1e-10)):
            check("historical expected." + phase + "." + field, historical_errors[field], bound, phase)

    for index in range(2):
        predicted = reference["pairs"][index]
        archived = original["attempt"]["pairs"][index]
        pair_evidence = {}
        for phase in PHASES:
            observed = predicted["phaseMetrics"][phase]
            if observed is None:
                continue
            errors = M.pair_error(archived["metrics"][phase], observed["raw"])
            pair_evidence[phase] = errors
            for field, value in errors.items():
                check("derived bank.pair" + str(index) + "." + phase + "." + field, value, 1e-12, phase)
        evidence["pairErrors"].append(pair_evidence)
        if predicted["phaseMetrics"]["postContact"] is not None:
            incoming = bank["incoming"][2 * index:2 * index + 2]
            errors = C.pair_errors(incoming, original["config"]["joints"][index], index, predicted["phaseMetrics"]["postContact"])
            metrics["pairErrors"][index]["postContact"] = errors
            for field, value in errors.items():
                check("input pair" + str(index) + ".postContact." + field, value, 1e-12, "postContact")
        if predicted["jointReport"] is None:
            expected_passed = False
            continue
        errors = {field:C.error(archived["jointReport"][field], predicted["jointReport"][field])
                  for field in ("angleRad", "linearImpulseNs", "angularImpulseNms", "motorImpulseNms")}
        for field in ("linearImpulseNs", "angularImpulseNms"):
            errors["body" + field[0].upper() + field[1:]] = max(C.error(a[field], b[field]) for a, b in zip(archived["bodyCorrections"], predicted["bodyCorrections"]))
        errors["angularReactionNormNms"] = C.error(archived["reportCap"]["angularReactionNormNms"], predicted["reportCap"]["angularReactionNormNms"])
        errors["motorSpeedBeforeRadps"] = C.error(archived["motor"]["relativeSpeedBeforeRadps"], predicted["motor"]["relativeSpeedBeforeRadps"])
        errors["motorSpeedAfterRadps"] = C.error(archived["motor"]["relativeSpeedAfterRadps"], predicted["motor"]["relativeSpeedAfterRadps"])
        evidence["reportErrors"].append(errors)
        for field, value in errors.items():
            check("derived bank.pair" + str(index) + ".report." + field, value,
                  1e-9 if field == "angleRad" else 1e-10 if field.startswith("motorSpeed") else 1e-12)
        metadata_match = all(archived["motor"][field] == predicted["motor"][field] for field in
                             ("inputAngleRad", "targetSpeedRadps", "limitRad", "maxImpulseNms", "blocked"))
        metadata_match = metadata_match and archived["reportCap"]["exceedsCap"] == predicted["reportCap"]["exceedsCap"] and C.same_bits_tree(archived["reportCap"]["maxReactionNms"], .01)
        metadata_match = metadata_match and archived["parsedActions"] == reference["parsedActions"][2 * index:2 * index + 2]
        metadata_match = metadata_match and archived["acceptedReportAngleRad"] == reference["authority"]["acceptedReportAnglesRad"][index]
        if not metadata_match:
            expected_passed = False
            failures.append("derived bank.pair" + str(index) + " prior memory/actions/motor/cap authority differs")
        work = {field:C.error(archived["work"][field], predicted["work"][field]) for field in predicted["work"]}
        work["energyByPhaseJ"] = max(C.error(archived["energyByPhase"][field], value) for field, value in predicted["energyByPhase"].items())
        evidence["workErrors"].append(work)
        for field, value in work.items():
            check("derived bank.pair" + str(index) + "." + field, value, 1e-10 if field == "projectionObjectiveJ" else 1e-12)
        model = models[index]
        if model is not None:
            historical = bank["historical"][index]["reference"]
            # The original coefficient gate is relative-scale1e-12. This does
            # not build rows: both operands are retained expected model DATA.
            coefficient = {}
            for field in ("physicalA", "physicalB", "physicalH", "physicalX0", "columnScales", "rowDivisors",
                          "dimensionlessA", "dimensionlessB", "dimensionlessH", "dimensionlessX0",
                          "centerOfMassOriginM", "originalOriginM", "physicalStopRow", "dimensionlessStopRow"):
                coefficient[field] = P.coefficient_error(historical["projection"][field], P.public(model["projection"][field]))
                check("historical expected.pair" + str(index) + ".projection." + field, coefficient[field], 1e-12)
            evidence["coefficientErrors"].append(coefficient)
            for field in ("dofOrder", "rowIds", "stopKind"):
                if historical["projection"][field] != model["projection"][field]:
                    expected_passed = False
                    failures.append("historical expected.pair" + str(index) + ".projection." + field + " differs")
            for field in ("targetAngleRad", "finalAngleRad"):
                check("historical expected.pair" + str(index) + ".poseReport." + field,
                      C.error(historical["poseReport"][field], model["poseReport"][field]), 1e-9)
    return post_passed, expected_passed, failures, evidence


def evaluate(value, counters):
    metrics = C.empty_metrics()
    reference = {"derived80":None, "derived120":None, "pairModels80":None, "pairModels120":None,
                 "historicalPairReplies":None, "bank":None}
    # Outer/key admission and the three input roots are the only request
    # traversal before the independent and bank gates. actual remains opaque.
    roots = C.input_roots(value)
    bank = C.load_bank(value["snapshot"])
    original = copy.deepcopy(bank["request"])
    restore_pointers(original)
    original["sourceState"]["bodies"] = restore(original["sourceState"]["bodies"], original["rawFrames"]["source"])
    expected_inputs = C.mapped_inputs(original, value["variant"])
    checks = metrics["checks"]
    checks["inputMappingMatch"] = all(C.same_bits_tree(roots[field], expected_inputs[field]) for field in ("config", "sourceState", "postContactBodies"))
    checks["sourceInputBitsMatch"] = roots["sourceRawHex"] == expected_inputs["sourceRawHex"] and C.same_bits_tree(roots["sourceState"], expected_inputs["sourceState"])
    checks["postContactInputBitsMatch"] = roots["postContactRawHex"] == expected_inputs["postContactRawHex"] and C.same_bits_tree(roots["postContactBodies"], expected_inputs["postContactBodies"])
    checks["bankBeforeMatch"] = before_correspondence(bank, original)
    reference["historicalPairReplies"] = bank["historical"]
    reference["bank"] = {"nativeHead":C.NATIVE_HEAD, "snapshot":value["snapshot"], "variant":value["variant"],
                         "receiptSha256":C.RECEIPT_SHA256, "manifest":bank["manifest"], "locators":bank["locator"],
                         "mapping":C.mapping(value["variant"]), "correspondence":None, "expectedPhysicalGates":None,
                         "sourceInputNegativeZeroPaths":{root:value["negativeZeroPaths"][root] for root in ("config", "sourceState", "postContactBodies")},
                         "acceptedStoreZeroAuthority":"authenticated original request pointers and source raw"}
    violations = [key + " is false" for key in C.CHECK_KEYS[:4] if checks[key] is False]
    if violations:
        return envelope("MISMATCH", metrics, reference, violations)
    with localcontext() as context:
        context.prec = 120
        request, source, pair_inputs = admit(bank["request"])
    bank["admittedRequest"] = request
    bank["incoming"] = restore(request["attempt"]["frames"]["postContactBodies"], request["rawFrames"]["postContact"], internal=True)
    try:
        if counters["deriveAttempted"] >= 2:
            raise RuntimeError("saved-phase derive budget exhausted before invocation")
        counters["deriveAttempted"] += 1
        low, low_models, _ = derive(request, source, pair_inputs, 80)
        counters["deriveCompleted"] += 1
        reference.update(derived80=low, pairModels80=low_models)
        if counters["deriveAttempted"] >= 2:
            raise RuntimeError("saved-phase derive budget exhausted before invocation")
        counters["deriveAttempted"] += 1
        high, high_models, _ = derive(request, source, pair_inputs, 120)
        counters["deriveCompleted"] += 1
        reference.update(derived120=high, pairModels120=high_models)
        metrics["precision"] = precision(low, high, low_models, high_models)
        if metrics["precision"]["algebraResolved"] is not True or metrics["precision"]["scalarResolved"] is not True:
            return envelope("UNRESOLVED", metrics, reference, ["independent saved-phase precision, reachability, binary problem or exact result is unresolved"])
        physical, certificate, gate_failures, gate_evidence = G.inspect_expected(low, high, low_models, high_models, bank["historical"])
        checks["independentExpectedPhysicalQualified"] = physical
        checks["bankCertificateCorrespondence"] = certificate
        reference["bank"]["expectedPhysicalGates"] = gate_evidence
        post, projected, bank_failures, correspondence = compare_bank(high, high_models, bank, metrics)
        checks["derivedPostContactMatch"] = post
        checks["derivedExpectedMatch"] = projected
        reference["bank"]["correspondence"] = correspondence
        violations.extend(gate_failures + bank_failures)
        for key in C.CHECK_KEYS[:8]:
            if checks[key] is False:
                violations.append(key + " is false")
        if violations:
            return envelope("MISMATCH", metrics, reference, violations)
        # First and only new SOURCE actual value/shape/raw/pointer access.
        C.compare_actual(value["actual"], value["negativeZeroPaths"]["actual"], value["variant"],
                         bank["incoming"], request, high, metrics, violations)
        return envelope("MISMATCH" if violations else "RETURN", metrics, reference, violations)
    except (Unresolved, M.ReferenceUnresolved) as caught:
        return envelope("UNRESOLVED", metrics, reference, [str(caught)])


def process(value, counters):
    original_at_precision = P.at_precision
    def counted_at_precision(*args, **kwargs):
        if counters["atPrecisionAttempted"] >= 4:
            raise RuntimeError("saved-phase pair precision budget exhausted before invocation")
        counters["atPrecisionAttempted"] += 1
        result = original_at_precision(*args, **kwargs)
        counters["atPrecisionCompleted"] += 1
        return result
    P.at_precision = counted_at_precision
    try:
        return evaluate(value, counters)
    finally:
        P.at_precision = original_at_precision


def main():
    for encoded in sys.stdin.buffer:
        counters = {"deriveAttempted":0, "deriveCompleted":0, "atPrecisionAttempted":0, "atPrecisionCompleted":0}
        try:
            try:
                value = C.parse_json(encoded.decode("utf-8", errors="strict"))
            except (json.JSONDecodeError, ValueError, UnicodeError):
                result = protocol("REFERENCE_JSON", JSON_MESSAGE)
            else:
                try:
                    result = process(value, counters)
                except (InputError, M.ReferenceInputError, P.ReferenceInputError, P.POSE.ReferenceInputError, P.OLD.ReferenceInputError):
                    result = protocol("REFERENCE_INPUT", INPUT_MESSAGE)
                except (Unresolved, M.ReferenceUnresolved) as caught:
                    result = envelope("UNRESOLVED", None, None, [str(caught)])
        finally:
            # Failure to preserve a sidecar is a real storage/process failure.
            # This does not replace the wire DTO with a fabricated refusal.
            path = Path(os.environ["PHYSICS_HINGE_COUNTER_FILE"])
            with path.open("x", encoding="utf-8") as stream:
                json.dump(counters, stream, allow_nan=False, separators=(",", ":"))
                stream.write("\n")
        encoded_reply = (json.dumps(result, allow_nan=False, separators=(",", ":")) + "\n").encode("utf-8")
        if len(encoded_reply) > 2 * 1024 * 1024:
            raise RuntimeError("saved-phase reply exceeds fixed 2MiB wire ceiling")
        sys.stdout.buffer.write(encoded_reply)
        sys.stdout.buffer.flush()


if __name__ == "__main__":
    main()
