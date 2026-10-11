"""DATA-only saved phase comparison after the independent expected/bank gates.

This module measures submitted raw states and recomputes report jumps. It does
not project, solve, run a World, or claim a new native solver certificate.
"""
import base64
import copy
from decimal import Decimal
from fractions import Fraction
import hashlib
import json
import math
import os
from pathlib import Path
import sys

sys.dont_write_bytecode = True
HISTORICAL = Path(__file__).resolve().parent.parent / "physics-rigid-hinge-velocity-world-reference"
if str(HISTORICAL) not in sys.path:
    sys.path.insert(0, str(HISTORICAL))
from world_schema import M, P, IDS, JIDS, FIELDS, keys, need, finite, vector, bits, restore, InputError, Unresolved

BODY_KEYS = ("id", "kind", "shape", "positionM", "velocityMps", "orientation", "angularVelocityRadps", "inertiaKgM2")
REPORT_KEYS = ("id", "kind", "aId", "bId", "linearImpulseNs", "angularImpulseNms", "angleRad", "motorImpulseNms")
ACTUAL_KEYS = ("projectedBodies", "projectedRawHex", "jointReports", "bodyCorrections", "reportCaps", "calls")
CHECK_KEYS = ("inputMappingMatch", "sourceInputBitsMatch", "postContactInputBitsMatch", "bankBeforeMatch",
              "derivedPostContactMatch", "derivedExpectedMatch", "bankCertificateCorrespondence", "independentExpectedPhysicalQualified",
              "callerBodyOrderMatch", "callerJointOrderMatch", "actualIdentityMatch", "actualRawMatchesJSON",
              "projectedBankBitsMatch", "jointReportsBankBitsMatch", "bodyCorrectionsBankBitsMatch", "reportCapsBankBitsMatch",
              "callsMatch", "reportBaselineIsPostContact", "reportBMatchesCorrection", "reportTargetAuthorityMatch", "capDecisionMatch")
RENAME_BODIES = ("zLeft", "aRight", "yLeft", "bRight")
RENAME_JOINTS = ("jointZulu", "jointAlpha")


def mapping(variant):
    need(variant in ("RENAME", "PERMUTE"))
    return {"bodyIds":RENAME_BODIES if variant == "RENAME" else IDS,
            "jointIds":RENAME_JOINTS if variant == "RENAME" else JIDS,
            "bodyOrder":(0, 1, 2, 3) if variant == "RENAME" else (3, 0, 1, 2),
            "jointOrder":(0, 1) if variant == "RENAME" else (1, 0)}


def same_bits_tree(actual, expected):
    if type(expected) in (int, float):
        return type(actual) in (int, float) and bits(actual) == bits(expected)
    if type(expected) is dict:
        return type(actual) is dict and set(actual) == set(expected) and all(same_bits_tree(actual[key], value) for key, value in expected.items())
    if type(expected) in (list, tuple):
        return type(actual) in (list, tuple) and len(actual) == len(expected) and all(same_bits_tree(a, b) for a, b in zip(actual, expected))
    return type(actual) is type(expected) and actual == expected


def negative_paths(value, path=""):
    if type(value) is float and value == 0 and math.copysign(1, value) < 0:
        return [path]
    if type(value) is list:
        return [item for index, part in enumerate(value) for item in negative_paths(part, path + "/" + str(index))]
    if type(value) is dict:
        return [item for key, part in value.items() for item in negative_paths(part, path + "/" + key.replace("~", "~0").replace("/", "~1"))]
    return []


def restore_paths(data, paths):
    """Restore one explicitly reached root and check its complete pointer set."""
    need(type(paths) is list and all(type(x) is str for x in paths) and len(set(paths)) == len(paths))
    for pointer in paths:
        need(pointer.startswith("/") and "\x00" not in pointer)
        parts = pointer[1:].split("/")
        owner = data
        for index, encoded in enumerate(parts):
            need(all(encoded[i + 1:i + 2] in ("0", "1") for i, char in enumerate(encoded) if char == "~"))
            component = encoded.replace("~1", "/").replace("~0", "~")
            if type(owner) is list:
                need(component == "0" or component.isascii() and component.isdigit() and not component.startswith("0"))
                key = int(component)
                need(0 <= key < len(owner))
            else:
                need(type(owner) is dict and component in owner and component not in ("__proto__", "prototype", "constructor"))
                key = component
            if index == len(parts) - 1:
                need(finite(owner[key]) == 0)
                owner[key] = -0.0
            else:
                owner = owner[key]
    need(set(negative_paths(data)) == set(paths))


def public_body(body):
    return {key:copy.deepcopy(body[key]) for key in BODY_KEYS}


def mapped_body(body, index, contract):
    result = public_body(body)
    result["id"] = contract["bodyIds"][index]
    return result


def mapped_report(report, index, contract):
    result = copy.deepcopy(report)
    result.update(id=contract["jointIds"][index], aId=contract["bodyIds"][2 * index], bId=contract["bodyIds"][2 * index + 1])
    return result


def mapped_corrections(corrections, index, contract):
    return [{**copy.deepcopy(value), "bodyId":contract["bodyIds"][2 * index + offset]} for offset, value in enumerate(corrections)]


def empty_metrics():
    return {"actualCompared":False, "pairActualCompared":[False, False],
            "checks":{key:None for key in CHECK_KEYS}, "projectedErrors":None,
            "pairErrors":[{"postContact":None, "projected":None} for _ in range(2)],
            "reportErrors":[None, None], "capErrors":[None, None], "precision":None}


def error(actual, expected):
    if type(expected) in (list, tuple):
        need(type(actual) in (list, tuple) and len(actual) == len(expected))
        result = max((error(a, b) for a, b in zip(actual, expected)), default=0.0)
    else:
        result = abs(finite(actual) - finite(P.public(expected)))
    if not math.isfinite(result):
        raise Unresolved("saved-phase numeric comparison is not finite")
    return result


def identity_list(values, identifiers, key="id"):
    need(type(values) is list and len(values) == len(identifiers) and all(type(item) is dict for item in values))
    actual_ids = [item.get(key) for item in values]
    need(all(type(value) is str for value in actual_ids) and len(set(actual_ids)) == len(identifiers) and set(actual_ids) == set(identifiers))
    return {item[key]:item for item in values}


def internal_bodies(public, template):
    # Incoming authenticated physical metadata is authoritative, never actual
    # inverseMass or hidden producer fields. Public inertia still has to match.
    return [{**copy.deepcopy(original), **copy.deepcopy(body), "id":original["id"]} for body, original in zip(public, template)]


def pair_errors(bodies, joint, index, observation):
    measured = M.pair_metrics(bodies, joint, [0.0, 0.0, float(index)])
    values = M.pair_error(measured, observation["raw"])
    if any(type(value) not in (int, float) or not math.isfinite(value) or value < 0 for value in values.values()):
        raise Unresolved("saved-phase pair measurement is not finite")
    return values


def compare_actual(actual_value, actual_paths, variant, incoming, bank_request, expected, metrics, violations):
    """First actual access belongs to the caller, after every pre-actual gate."""
    keys(actual_value, ACTUAL_KEYS)
    actual = copy.deepcopy(actual_value)
    restore_paths(actual, actual_paths)
    contract = mapping(variant)
    # Completeness/uniqueness are representation requirements. A complete but
    # wrongly ordered array remains a resolved mismatch, not silently repaired.
    by_id = identity_list(actual["projectedBodies"], contract["bodyIds"])
    restored = restore(actual["projectedBodies"], actual["projectedRawHex"])
    by_id = {body["id"]:body for body in restored}
    reports = identity_list(actual["jointReports"], contract["jointIds"])
    for report in reports.values():
        keys(report, REPORT_KEYS)
        need(type(report["kind"]) is str and type(report["aId"]) is str and type(report["bId"]) is str)
        vector(report["linearImpulseNs"]); vector(report["angularImpulseNms"])
        finite(report["angleRad"]); finite(report["motorImpulseNms"])
    corrections, caps = actual["bodyCorrections"], actual["reportCaps"]
    need(type(corrections) is list and len(corrections) == 2 and type(caps) is list and len(caps) == 2)
    for index in range(2):
        identity_list(corrections[index], contract["bodyIds"][2 * index:2 * index + 2], "bodyId")
        for correction in corrections[index]:
            keys(correction, ("bodyId", "linearImpulseNs", "angularImpulseNms"))
            need(type(correction["bodyId"]) is str)
            vector(correction["linearImpulseNs"]); vector(correction["angularImpulseNms"])
        keys(caps[index], ("angularReactionNormNms", "maxReactionNms", "exceedsCap"))
        finite(caps[index]["angularReactionNormNms"]); finite(caps[index]["maxReactionNms"])
        need(type(caps[index]["exceedsCap"]) is bool)
    keys(actual["calls"], ("projectionCalls", "reportCalls"))
    need(all(type(value) is int and value >= 0 for value in actual["calls"].values()))

    flags = metrics["checks"]
    metrics["actualCompared"] = True
    flags["callerBodyOrderMatch"] = [body["id"] for body in restored] == [contract["bodyIds"][i] for i in contract["bodyOrder"]]
    flags["callerJointOrderMatch"] = [report["id"] for report in actual["jointReports"]] == [contract["jointIds"][i] for i in contract["jointOrder"]]
    flags["actualRawMatchesJSON"] = True  # restore above checked every raw word and sign
    flags["callsMatch"] = actual["calls"] == {"projectionCalls":2, "reportCalls":2}
    public = [by_id[identifier] for identifier in contract["bodyIds"]]
    canonical = internal_bodies(public, incoming)
    # Only the raw13 fields are copied onto authenticated internal metadata for
    # measurement; a mismatching public metadata value remains a failed check.
    flags["actualIdentityMatch"] = all(same_bits_tree({k:v for k,v in body.items() if k not in dict(FIELDS)},
                                                    {**{k:v for k,v in public_body(original).items() if k not in dict(FIELDS)}, "id":contract["bodyIds"][i]})
                                             for i, (body, original) in enumerate(zip(public, incoming)))
    for body, original in zip(canonical, incoming):
        for key in set(original) - set(dict(FIELDS)):
            body[key] = copy.deepcopy(original[key])

    bank_frames = bank_request["attempt"]["frames"]
    bank_pairs = bank_request["attempt"]["pairs"]
    wanted_bodies = [mapped_body(bank_frames["projectedBodies"][i], i, contract) for i in contract["bodyOrder"]]
    flags["projectedBankBitsMatch"] = same_bits_tree(restored, wanted_bodies)
    flags["jointReportsBankBitsMatch"] = same_bits_tree(actual["jointReports"], [mapped_report(bank_pairs[i]["jointReport"], i, contract) for i in contract["jointOrder"]])
    flags["bodyCorrectionsBankBitsMatch"] = same_bits_tree(corrections, [mapped_corrections(bank_pairs[i]["bodyCorrections"], i, contract) for i in range(2)])
    flags["reportCapsBankBitsMatch"] = same_bits_tree(caps, [pair["reportCap"] for pair in bank_pairs])
    frame = M.frame_error(canonical, expected["frames"]["projectedBodies"])
    metrics["projectedErrors"] = {key:frame[key] for key in ("positionM", "quaternion", "velocityMps", "angularVelocityRadps")}
    for field, bound in (("positionM", 1e-12), ("quaternion", 1e-12), ("velocityMps", 1e-10), ("angularVelocityRadps", 1e-9)):
        value = frame[field]
        if not math.isfinite(value):
            raise Unresolved("projected frame error is not finite")
        if value > bound:
            violations.append("actual projected." + field + "=" + repr(value) + " exceeds " + repr(bound))

    baseline_flags = []; b_flags = []; target_flags = []; cap_flags = []
    for index in range(2):
        metrics["pairActualCompared"][index] = True
        pair = expected["pairs"][index]
        a, b = 2 * index, 2 * index + 2
        for phase, bodies in (("postContact", incoming[a:b]), ("projected", canonical[a:b])):
            values = pair_errors(bodies, bank_request["config"]["joints"][index], index, pair["phaseMetrics"][phase])
            metrics["pairErrors"][index][phase] = values
            for field, value in values.items():
                if value > 1e-12:
                    violations.append("actual pair" + str(index) + "." + phase + "." + field + "=" + repr(value) + " exceeds 1e-12")
        report = reports[contract["jointIds"][index]]
        corr, cap = corrections[index], caps[index]
        flags["actualIdentityMatch"] = flags["actualIdentityMatch"] and report["kind"] == "hinge" and report["aId"] == contract["bodyIds"][a] and report["bId"] == contract["bodyIds"][a + 1] and [item["bodyId"] for item in corr] == list(contract["bodyIds"][a:b])
        jumps = [{"linearImpulseNs":M.scale(M.sub(after["velocityMps"], before["velocityMps"]), 1.0 / before["inverseMass"]),
                  "angularImpulseNms":M.scale(M.sub(after["angularVelocityRadps"], before["angularVelocityRadps"]), before["inertiaKgM2"])}
                 for before, after in zip(incoming[a:b], canonical[a:b])]
        wanted = pair["jointReport"]
        errs = {field:error(report[field], wanted[field]) for field in ("angleRad", "linearImpulseNs", "angularImpulseNms", "motorImpulseNms")}
        # Reports too must agree with the actual B jump and submitted B correction.
        for field in ("linearImpulseNs", "angularImpulseNms"):
            errs[field] = max(errs[field], error(report[field], jumps[1][field]), error(report[field], corr[1][field]))
        errs["bodyLinearImpulseNs"] = max(error(item["linearImpulseNs"], authority["linearImpulseNs"]) for offset, item in enumerate(corr) for authority in (pair["bodyCorrections"][offset], jumps[offset]))
        errs["bodyAngularImpulseNms"] = max(error(item["angularImpulseNms"], authority["angularImpulseNms"]) for offset, item in enumerate(corr) for authority in (pair["bodyCorrections"][offset], jumps[offset]))
        metrics["reportErrors"][index] = errs
        baseline_flags.append(errs["bodyLinearImpulseNs"] <= 1e-12 and errs["bodyAngularImpulseNms"] <= 1e-12)
        b_flags.append(all(error(report[field], corr[1][field]) <= 1e-12 and error(report[field], jumps[1][field]) <= 1e-12 for field in ("linearImpulseNs", "angularImpulseNms")))
        target_flags.append(errs["angleRad"] <= 1e-9)
        norm = math.hypot(*jumps[1]["angularImpulseNms"])
        cap_errors = {"angularReactionNormNms":max(error(cap["angularReactionNormNms"], pair["reportCap"]["angularReactionNormNms"]), error(cap["angularReactionNormNms"], norm)),
                      "maxReactionNms":error(cap["maxReactionNms"], .01)}
        metrics["capErrors"][index] = cap_errors
        cap_flags.append(bits(cap["maxReactionNms"]) == bits(.01) and cap["exceedsCap"] == (norm > .01) == pair["reportCap"]["exceedsCap"])
        for field, value in errs.items():
            bound = 1e-9 if field == "angleRad" else 1e-12
            if value > bound:
                violations.append("actual pair" + str(index) + ".report." + field + "=" + repr(value) + " exceeds " + repr(bound))
        for field, value in cap_errors.items():
            bound = 0 if field == "maxReactionNms" else 1e-12
            if value > bound:
                violations.append("actual pair" + str(index) + ".cap." + field + "=" + repr(value) + " exceeds " + repr(bound))
    flags["reportBaselineIsPostContact"] = all(baseline_flags)
    flags["reportBMatchesCorrection"] = all(b_flags)
    flags["reportTargetAuthorityMatch"] = all(target_flags)
    flags["capDecisionMatch"] = all(cap_flags)
    for key in CHECK_KEYS[8:]:
        if flags[key] is False:
            violations.append(key + " is false")


RECEIPT_SHA256 = "b28355cac28b45d9c35639968196f386f4b2fe51dc063897bf52c1b9ab8e3cd4"
NATIVE_HEAD = "f40123da0eedb19245688557f865e1beb09d47ef"
REQUEST_KEYS = ("version", "op", "snapshot", "variant", "config", "sourceState", "sourceRawHex", "postContactBodies", "postContactRawHex", "actual", "negativeZeroPaths")
PARENT_REPLY_KEYS = ("ok", "resolved", "executionFailure", "metrics", "violations", "reference", "certificate", "transcendentals", "zeroAuthority")


def parse_json(data):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("duplicate JSON member")
            result[key] = value
        return result
    return json.loads(data, object_pairs_hook=unique,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError("nonfinite JSON")))


def bank_need(value, label):
    if not value:
        raise RuntimeError("saved bank authentication failed: " + label)


def authenticated_bytes(record, expected_bytes, expected_sha, label):
    bank_need(type(record) is dict and type(record.get("base64")) is str, label + " byte encoding")
    raw = base64.b64decode(record["base64"], validate=True)
    bank_need(len(raw) == expected_bytes and hashlib.sha256(raw).hexdigest() == expected_sha, label + " byte hash")
    bank_need(record["bytes"] == expected_bytes and record["sha256"] == expected_sha, label + " descriptor")
    return raw


def load_bank(snapshot):
    """Only the orchestrator-controlled fixed runtime path; no request paths."""
    filename = Path(os.environ["PHYSICS_HINGE_BANK_FILE"]).resolve(strict=True)
    allowed = Path("/workspace/shared/physics1489-evidence").resolve()
    bank_need(filename.name == "bank.json" and filename.parent.parent == allowed, "runtime destination")
    bank_need(filename.stat().st_size <= 8 * 1024 * 1024, "bounded bank file")
    bank = parse_json(filename.read_bytes())
    bank_need(bank["version"] == 1 and bank["nativeHead"] == NATIVE_HEAD, "version/native head")
    receipt_raw = authenticated_bytes(bank["receipt"], 34958, RECEIPT_SHA256, "receipt")
    # The checked-in original receipt is independently fixed too.
    local_receipt = Path(__file__).with_name("saved-input-authentication.json").read_bytes()
    bank_need(local_receipt == receipt_raw, "checked-in receipt bytes")
    receipt = parse_json(receipt_raw)
    bank_need(bank["receipt"]["data"] == receipt, "receipt DATA copy")
    manifest_record = bank["manifest"]
    manifest_raw = authenticated_bytes(manifest_record, manifest_record["bytes"], receipt["bankManifest"]["sha256"], "manifest")
    manifest = parse_json(manifest_raw)
    bank_need(manifest_record["data"] == manifest and manifest_record["path"] == receipt["bankManifest"]["path"], "manifest DATA/location")
    locator = next(item for item in receipt["snapshots"] if item["name"] == snapshot)
    selected = bank["snapshots"][snapshot]
    bank_need(selected["locators"] == locator, "selected locators")
    originals = {}
    for key, descriptor, data_key in (("request", "referenceRequest", "originalRequest"),
                                      ("reply", "referenceReply", "originalReply"),
                                      ("nativeRecord", "nativeRecord", "nativeRecord"),
                                      ("outcomeRecord", "successfulOutcomeRecord", "outcomeRecord")):
        where = locator[descriptor]
        raw = authenticated_bytes(selected["bytes"][key], where["bytes"], where["sha256"], key)
        originals[key] = parse_json(raw)
        bank_need(originals[key] == selected[data_key], key + " DATA copy")
    bank_need(originals["nativeRecord"]["request"] == originals["request"], "native/IPC request correspondence")
    for phase in locator["rawValidation"]["phases"]:
        value = selected["rawPhases"][phase["phase"]]
        bank_need(value["locator"] == phase, "raw phase locator")
        hex_value = value["hex"]
        bank_need(type(hex_value) is str and len(hex_value) == 832 and all(c in "0123456789abcdef" for c in hex_value), "raw encoding")
        decoded = bytes.fromhex(hex_value)
        bank_need(len(decoded) == phase["bytes"] and hashlib.sha256(decoded).hexdigest() == phase["sha256"], "raw phase hash")
        if phase["phase"] in originals["request"]["rawFrames"]:
            bank_need(hex_value == originals["request"]["rawFrames"][phase["phase"]], "request/raw correspondence")
    for phase in ("source", "postContact", "projected"):
        bank_need(selected[phase + "RawHex"] == selected["rawPhases"][phase]["hex"], phase + " raw selection")
        bank_need(hashlib.sha256(bytes.fromhex(selected[phase + "RawHex"])).hexdigest() == locator[phase + "RawSha256"], phase + " snapshot hash")
    reply = originals["reply"]
    bank_need(reply["ok"] is True and reply["resolved"] is True and reply["executionFailure"] is False and
              reply["referenceStatus"] == "RETURN" and reply["error"] is None and reply["violations"] == [], "historical World return")
    historical = reply["reference"]["pairReplies"]
    bank_need(type(historical) is list and len(historical) == 2, "historical pair replies")
    for index, parent in enumerate(historical):
        bank_need(type(parent) is dict and set(parent) == set(PARENT_REPLY_KEYS), "historical exact9")
        bank_need(parent["ok"] is True and parent["resolved"] is True and parent["executionFailure"] is False and parent["violations"] == [], "historical parent success")
        bank_need(set(parent["certificate"]) == {"expected", "actualFrame", "actualOutput"} and all(parent["certificate"][name] is not None for name in parent["certificate"]), "historical complete certificate")
        proof = locator["parents"][index]
        for obj, digest_key, size_key in ((parent, "parentCanonicalJsonSha256", None),
                                          (parent["certificate"], "certificateCanonicalJsonSha256", "certificateCanonicalJsonBytes")):
            encoded = json.dumps(obj, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")
            bank_need(hashlib.sha256(encoded).hexdigest() == proof[digest_key] and (size_key is None or len(encoded) == proof[size_key]), "historical canonical certificate locator")
    return {**originals, "historical":historical, "selected":selected, "locator":locator,
            "manifest":manifest, "receipt":receipt}


def mapped_inputs(original, variant):
    contract = mapping(variant)
    config = copy.deepcopy(original["config"])
    state = copy.deepcopy(original["sourceState"])
    bodies = original["attempt"]["frames"]["postContactBodies"]
    for index, body in enumerate(config["bodies"]):
        body["id"] = contract["bodyIds"][index]
    for index, joint in enumerate(config["joints"]):
        joint.update(id=contract["jointIds"][index], aId=contract["bodyIds"][index * 2], bId=contract["bodyIds"][index * 2 + 1])
    config["bodies"] = [config["bodies"][i] for i in contract["bodyOrder"]]
    config["joints"] = [config["joints"][i] for i in contract["jointOrder"]]
    state["bodies"] = [mapped_body(original["sourceState"]["bodies"][i], i, contract) for i in contract["bodyOrder"]]
    state["joints"] = [mapped_report(original["sourceState"]["joints"][i], i, contract) for i in contract["jointOrder"]]
    def raw_order(hex_value):
        return "".join(hex_value[i * 208:(i + 1) * 208] for i in contract["bodyOrder"])
    return {"config":config, "sourceState":state,
            "postContactBodies":[mapped_body(bodies[i], i, contract) for i in contract["bodyOrder"]],
            "sourceRawHex":raw_order(original["rawFrames"]["source"]),
            "postContactRawHex":raw_order(original["rawFrames"]["postContact"])}


def input_roots(value):
    # Do not copy/visit actual or negativeZeroPaths.actual here, even to validate.
    keys(value, REQUEST_KEYS)
    need(type(value["version"]) is int and value["version"] == 1 and value["op"] == "saved-postcontact")
    need(value["snapshot"] in ("FIRST", "LIMIT", "FINAL") and value["variant"] in ("RENAME", "PERMUTE"))
    keys(value["negativeZeroPaths"], ("config", "sourceState", "postContactBodies", "actual"))
    result = {}
    for root in ("config", "sourceState", "postContactBodies"):
        result[root] = copy.deepcopy(value[root])
        restore_paths(result[root], value["negativeZeroPaths"][root])
    contract = mapping(value["variant"])
    keys(result["config"], ("fixedStepSeconds", "gravityMps2", "bodies", "joints"))
    from world_schema import STATE_KEYS, tree
    keys(result["sourceState"], STATE_KEYS)
    identity_list(result["config"]["bodies"], contract["bodyIds"])
    identity_list(result["config"]["joints"], contract["jointIds"])
    identity_list(result["sourceState"]["bodies"], contract["bodyIds"])
    identity_list(result["sourceState"]["joints"], contract["jointIds"])
    identity_list(result["postContactBodies"], contract["bodyIds"])
    result["sourceState"]["bodies"] = restore(result["sourceState"]["bodies"], value["sourceRawHex"])
    result["postContactBodies"] = restore(result["postContactBodies"], value["postContactRawHex"])
    result["sourceRawHex"] = value["sourceRawHex"]
    result["postContactRawHex"] = value["postContactRawHex"]
    for root in ("config", "sourceState", "postContactBodies"):
        tree(result[root])
    return result


def encode_exact(value):
    if type(value) is Decimal:
        if not value.is_finite():
            raise Unresolved("nonfinite Decimal in retained expected model")
        return {"kind":"decimal", "text":str(value)}
    if type(value) is Fraction:
        return {"kind":"fraction", "numerator":str(value.numerator), "denominator":str(value.denominator)}
    if type(value) is dict:
        return {key:encode_exact(item) for key, item in value.items()}
    if type(value) in (list, tuple):
        return [encode_exact(item) for item in value]
    if type(value) is float and not math.isfinite(value):
        raise Unresolved("nonfinite binary number in retained expected model")
    return value


def decode_exact(value):
    if type(value) is dict:
        if value.get("kind") == "decimal":
            keys(value, ("kind", "text")); need(type(value["text"]) is str)
            result = Decimal(value["text"]); need(result.is_finite())
            return result
        if value.get("kind") == "fraction":
            keys(value, ("kind", "numerator", "denominator"))
            need(type(value["numerator"]) is str and type(value["denominator"]) is str)
            result = Fraction(int(value["numerator"]), int(value["denominator"]))
            need(str(result.numerator) == value["numerator"] and str(result.denominator) == value["denominator"])
            return result
        return {key:decode_exact(item) for key, item in value.items()}
    if type(value) is list:
        return [decode_exact(item) for item in value]
    return value


def require_source_return(reply):
    """Strict completed SOURCE admission for DATA reuse, with no new derivation."""
    keys(reply, ("ok", "resolved", "executionFailure", "referenceStatus", "metrics", "reference", "violations", "error"))
    need(reply["ok"] is True and reply["resolved"] is True and reply["executionFailure"] is False and
         reply["referenceStatus"] == "RETURN" and reply["violations"] == [] and reply["error"] is None)
    metrics = reply["metrics"]
    keys(metrics, ("actualCompared", "pairActualCompared", "checks", "projectedErrors", "pairErrors", "reportErrors", "capErrors", "precision"))
    need(metrics["actualCompared"] is True and type(metrics["pairActualCompared"]) is list and len(metrics["pairActualCompared"]) == 2 and all(v is True for v in metrics["pairActualCompared"]))
    keys(metrics["checks"], CHECK_KEYS); need(all(v is True for v in metrics["checks"].values()))
    def errors(value, bounds):
        keys(value, bounds)
        need(all(0 <= finite(value[key]) <= bound for key, bound in bounds.items()))
    errors(metrics["projectedErrors"], {"positionM":1e-12, "quaternion":1e-12, "velocityMps":1e-10, "angularVelocityRadps":1e-9})
    need(type(metrics["pairErrors"]) is list and len(metrics["pairErrors"]) == 2)
    for pair in metrics["pairErrors"]:
        keys(pair, ("postContact", "projected"))
        for phase in pair.values():
            errors(phase, {key:1e-12 for key in ("positionM", "angleRad", "quaternion", "velocityMps", "angularVelocityRadps", "linearMomentumKgMps", "angularMomentumKgM2ps", "energyJ")})
    need(type(metrics["reportErrors"]) is list and len(metrics["reportErrors"]) == 2 and type(metrics["capErrors"]) is list and len(metrics["capErrors"]) == 2)
    for report in metrics["reportErrors"]:
        errors(report, {"angleRad":1e-9, "linearImpulseNs":1e-12, "angularImpulseNms":1e-12, "motorImpulseNms":1e-12, "bodyLinearImpulseNs":1e-12, "bodyAngularImpulseNms":1e-12})
    for cap in metrics["capErrors"]:
        errors(cap, {"angularReactionNormNms":1e-12, "maxReactionNms":0})
    precision = metrics["precision"]
    keys(precision, ("algebraMaxDifferenceByUnit", "scalarRepeatMaxDifferenceRad", "algebraResolved", "scalarResolved"))
    errors(precision["algebraMaxDifferenceByUnit"], {key:1e-25 for key in M.UNIT_KEYS})
    need(0 <= finite(precision["scalarRepeatMaxDifferenceRad"]) <= 1e-12 and precision["algebraResolved"] is True and precision["scalarResolved"] is True)
    keys(reply["reference"], ("derived80", "derived120", "pairModels80", "pairModels120", "historicalPairReplies", "bank"))
    for field in ("derived80", "derived120"):
        derived = reply["reference"][field]
        need(type(derived) is dict and derived["pairReplies"] == [None, None] and derived["stage"] == "report-ready" and derived["expectedRefusal"] is None)
    for field in ("pairModels80", "pairModels120"):
        models = reply["reference"][field]
        need(type(models) is list and len(models) == 2 and all(type(model) is dict for model in models))
        need(all(model["actualFrame"] is None and model["actualCertificate"] is None for model in models))


def compare_saved(source_request, source_reply, actual_record):
    """Compare compiled DATA against authenticated inputs and completed expected."""
    require_source_return(source_reply)
    roots = input_roots(source_request)
    bank = load_bank(source_request["snapshot"])
    from world_schema import restore_pointers
    original = copy.deepcopy(bank["request"])
    restore_pointers(original)
    original["sourceState"]["bodies"] = restore(original["sourceState"]["bodies"], original["rawFrames"]["source"])
    wanted = mapped_inputs(original, source_request["variant"])
    need(all(same_bits_tree(roots[key], wanted[key]) for key in wanted))
    retained = decode_exact(copy.deepcopy(source_reply["reference"]))
    need(retained["bank"]["snapshot"] == source_request["snapshot"] and retained["bank"]["variant"] == source_request["variant"] and
         retained["bank"]["receiptSha256"] == RECEIPT_SHA256 and retained["bank"]["nativeHead"] == NATIVE_HEAD and
         retained["bank"]["locators"] == bank["locator"] and retained["bank"]["manifest"] == bank["manifest"] and
         retained["historicalPairReplies"] == bank["historical"])
    for precision in (80, 120):
        derived = retained["derived" + str(precision)]
        need(derived["rawFrames"]["source"] == original["rawFrames"]["source"])
        need(derived["authority"]["sourceStepIndex"] == original["sourceState"]["stepIndex"] and
             derived["authority"]["acceptedReportAnglesRad"] == [joint["angleRad"] for joint in original["sourceState"]["joints"]])
        for index, model in enumerate(retained["pairModels" + str(precision)]):
            need(P.public(model["exact"]) == bank["historical"][index]["certificate"]["expected"])
    metrics = empty_metrics()
    metrics["precision"] = copy.deepcopy(source_reply["metrics"]["precision"])
    for key in CHECK_KEYS[:8]:
        metrics["checks"][key] = source_reply["metrics"]["checks"][key]
    # First new compiled actual access follows independent expected reuse and
    # bank/input authentication. Complete expected output is read as DATA only.
    incoming = restore(original["attempt"]["frames"]["postContactBodies"], original["rawFrames"]["postContact"], internal=True)
    actual_record = actual_record() if callable(actual_record) else actual_record
    keys(actual_record, ("actual", "negativeZeroPaths"))
    violations = []
    try:
        compare_actual(actual_record["actual"], actual_record["negativeZeroPaths"], source_request["variant"], incoming,
                       original, retained["derived120"], metrics, violations)
    except (Unresolved, M.ReferenceUnresolved) as caught:
        return {"ok":False, "resolved":False, "executionFailure":True, "referenceStatus":"UNRESOLVED",
                "metrics":metrics, "reference":encode_exact(retained), "violations":[str(caught)], "error":None}
    return {"ok":not violations, "resolved":True, "executionFailure":False,
            "referenceStatus":"MISMATCH" if violations else "RETURN", "metrics":metrics,
            "reference":encode_exact(retained), "violations":violations, "error":None}


def main():
    import argparse
    parser = argparse.ArgumentParser(description="File-only compiled saved-phase DATA comparison; no reference JSONL IPC")
    parser.add_argument("--source-request", required=True)
    parser.add_argument("--source-reply", required=True)
    parser.add_argument("--actual", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    def read(path, maximum=2 * 1024 * 1024):
        value = Path(path)
        bank_need(value.stat().st_size <= maximum, "bounded DATA input")
        return value.read_bytes()
    request_raw, reply_raw = read(args.source_request), read(args.source_reply)
    for raw_bytes, env_name, label in ((request_raw, "PHYSICS_HINGE_SOURCE_REQUEST_SHA256", "SOURCE request"),
                                       (reply_raw, "PHYSICS_HINGE_SOURCE_REPLY_SHA256", "SOURCE reply")):
        expected_hash = os.environ[env_name]
        bank_need(len(expected_hash) == 64 and all(char in "0123456789abcdef" for char in expected_hash) and
                  hashlib.sha256(raw_bytes).hexdigest() == expected_hash, label + " completed byte identity")
    request, reply = parse_json(request_raw), parse_json(reply_raw)
    require_source_return(reply)
    # Opening/reading compiled actual is delayed until compare_saved finishes
    # authenticating the bank and binding the saved expected to this input.
    actual_raw = None
    class ActualJSONError(ValueError):
        pass
    def load_actual():
        nonlocal actual_raw
        actual_raw = read(args.actual)
        try:
            return parse_json(actual_raw.decode("utf-8", errors="strict"))
        except (json.JSONDecodeError, ValueError, UnicodeError):
            raise ActualJSONError from None
    def protocol(code, message):
        return {"ok":False, "resolved":False, "executionFailure":True, "referenceStatus":"UNRESOLVED",
                "metrics":None, "reference":None, "violations":[], "error":{"code":code, "message":message}}
    try:
        result = compare_saved(request, reply, load_actual)
    except ActualJSONError:
        result = protocol("REFERENCE_JSON", "hinge world reference line must be valid JSON")
    except (InputError, M.ReferenceInputError, P.ReferenceInputError, P.POSE.ReferenceInputError, P.OLD.ReferenceInputError):
        result = protocol("REFERENCE_INPUT", "hinge world reference input is invalid")
    except (Unresolved, M.ReferenceUnresolved) as caught:
        result = {"ok":False, "resolved":False, "executionFailure":True, "referenceStatus":"UNRESOLVED",
                  "metrics":None, "reference":None, "violations":[str(caught)], "error":None}
    if result["reference"] is not None:
        result["reference"]["bank"]["dataReuse"] = {
            "kind":"compiled-data-only", "sourceRequestSha256":hashlib.sha256(request_raw).hexdigest(),
            "sourceReplySha256":hashlib.sha256(reply_raw).hexdigest(), "actualSha256":hashlib.sha256(actual_raw).hexdigest()}
    encoded = (json.dumps(result, allow_nan=False, separators=(",", ":")) + "\n").encode("utf-8")
    maximum = int(os.environ.get("PHYSICS_HINGE_DATA_OUTPUT_MAX_BYTES", str(2 * 1024 * 1024)))
    bank_need(0 <= maximum <= 2 * 1024 * 1024 and len(encoded) <= maximum, "DATA output storage ceiling")
    with Path(args.output).open("xb") as output:
        output.write(encoded)
        output.flush()
        os.fsync(output.fileno())


if __name__ == "__main__":
    main()
