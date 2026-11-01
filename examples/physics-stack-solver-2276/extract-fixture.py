#!/usr/bin/env python3
"""Extract one authenticated saved patch; never invoke a World or solver."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import signal
import struct
import sys
from fractions import Fraction

HERE = Path(__file__).resolve().parent
OLD = HERE.parent / "physics-motion-nogo-2276"
EXTRACTOR_INPUT_SHA = "43918b579209d55d52991bb2f20da9612e8a7f97d5bbb735711bfb2c3b91dc8c"
OBSERVER_SHA = "70a34672ef53f034fa714bcd54a120a60c672fea3fd740841064dc8ac43263e2"
CERTIFICATE_SHA = "e570e89c488bc89f6a22c5a34875156b1a43628f3af1312c9437826f3b8020f9"
CERTIFICATE_BYTES = 166333
SOURCE_BASE = "7105c4755"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def load_equilibrium():
    path = OLD / "stack-equilibrium.py"
    require(digest(path.read_bytes()) == EXTRACTOR_INPUT_SHA, "equilibrium helper source hash mismatch")
    require(digest((OLD / "stack-study.py").read_bytes()) == OBSERVER_SHA, "observer source hash mismatch")
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("pinned_saved_patch_equilibrium", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def frame_bytes(bodies, fields):
    return b"".join(struct.pack("<" + "d" * count, *body[field])
                    for body in bodies for field, count in fields)


def candidate_body(body):
    # The restricted profile has verified identity orientation before this conversion.
    diagonal = body["inverseInertiaLocal"]
    expected = [0, 0, 0] if body["kind"] == "static" else [24, 24, 24]
    require(diagonal == expected, "world inertia requires verified aligned local inertia")
    return {"id": body["id"], "positionM": body["positionM"],
            "velocityMps": body["velocityMps"], "angularVelocityRadps": body["angularVelocityRadps"],
            "inverseMass": body["inverseMass"],
            "inverseInertiaWorld": [[diagonal[0], 0, 0], [0, diagonal[1], 0], [0, 0, diagonal[2]]]}


def numeric_fraction_vector(values):
    require(type(values) is list and len(values) == 3 and all(type(x) is str for x in values), "exact vector layout")
    return [float(Fraction(value)) for value in values]


def extract():
    certificate_path = OLD / "evidence/equilibrium-study-01/result.json"
    certificate_bytes = certificate_path.read_bytes()
    require(len(certificate_bytes) == CERTIFICATE_BYTES and digest(certificate_bytes) == CERTIFICATE_SHA,
            "exact certificate receipt authentication")
    receipt = json.loads(certificate_bytes)
    equilibrium = load_equilibrium()
    prior, authentication, frames, ledger = equilibrium.load_inputs(OLD / "evidence/stack-study-01/result.json")
    S = equilibrium.S
    require(receipt["status"] == "SAVED_FIRST_PATCH_EXACT_FIXED_POINT_CERTIFIED", "prior certificate status")
    require(receipt["priorResultSha256"] == equilibrium.PRIOR_SHA and
            receipt["selectedStepJsonSha256"] == equilibrium.STEP_SHA and
            receipt["selectedStepRawSha256"] == equilibrium.RAW_SHA and
            receipt["jsonRecordsParsed"] == 2 and receipt["selectedRawBytes"] == 10296,
            "prior certificate input identities")
    for name, current in authentication.items():
        for key in ("compressedBytes", "compressedSha256", "decodedBytes", "decodedSha256"):
            require(receipt["authentication"][name][key] == current[key], "certificate archive identity mismatch")

    repacked_step = b"".join(frame_bytes(bodies, S.FIELDS) for bodies in frames.values())
    require(len(repacked_step) == 9360 and digest(repacked_step) == equilibrium.RAW_SHA,
            "restored signed binary64 step hash mismatch")
    free, velocity, points = frames["closure-ready.free"], frames["closure-ready.velocity"], ledger["points"]
    equilibrium.profile(free, points)
    require(frame_bytes(receipt["observedVelocityPhaseBodies"], S.FIELDS) == frame_bytes(velocity, S.FIELDS),
            "prior observed output signed binary64 mismatch")
    require(receipt["savedNativeFirstViolation"] == prior["firstViolation"], "old residual receipt mismatch")

    exact = receipt["certificate"]
    require(exact["exactVelocityAndSpinZero"] is True and exact["exactNormalComplementarityZero"] is True,
            "prior exact zero claims missing")
    require(len(exact["pointRows"]) == 32 and len(exact["bodyCertificate"]) == 9,
            "prior certificate cardinality")
    oracle_bodies = []
    for body, row in zip(free, exact["bodyCertificate"]):
        require(row["id"] == body["id"] and row["staticReactionSink"] == (body["kind"] == "static"),
                "oracle body binding")
        for i in range(3):
            impulse, torque = Fraction(row["netImpulseNs"][i]), Fraction(row["netTorqueNms"][i])
            predicted_v = Fraction(row["predictedVelocityMps"][i])
            predicted_w = Fraction(row["predictedAngularVelocityRadps"][i])
            require(predicted_v == 0 and predicted_w == 0, "copied oracle velocity is not exact zero")
            require(Fraction.from_float(float(body["velocityMps"][i])) +
                    impulse * Fraction.from_float(float(body["inverseMass"])) == predicted_v,
                    "copied exact linear stationarity mismatch")
            require(Fraction.from_float(float(body["angularVelocityRadps"][i])) +
                    torque * Fraction.from_float(float(body["inverseInertiaLocal"][i])) == predicted_w,
                    "copied exact angular stationarity mismatch")
        oracle_bodies.append({"id": row["id"],
                              "velocityMps": numeric_fraction_vector(row["predictedVelocityMps"]),
                              "angularVelocityRadps": numeric_fraction_vector(row["predictedAngularVelocityRadps"]),
                              "netImpulseNs": numeric_fraction_vector(row["netImpulseNs"]),
                              "netTorqueNms": numeric_fraction_vector(row["netTorqueNms"])})

    dto_points, point_mapping = [], []
    for index, (point, row) in enumerate(zip(points, exact["pointRows"])):
        require(row["pointIndex"] == index and row["pointId"] == point["pointId"] and
                row["pairKey"] == point["pairKey"], "oracle point binding")
        require(Fraction(row["normalImpulseNs"]) >= 0 and Fraction(row["normalSpeedMps"]) == 0 and
                Fraction(row["complementarityJ"]) == 0, "prior exact contact feasibility")
        qualified = json.dumps([point["pairKey"], point["pointId"]], separators=(",", ":"), ensure_ascii=True)
        dto_points.append({"id": qualified, "aId": point["aId"], "bId": point["bId"],
                           "pointM": point["pointM"], "normalAtoB": point["normal"]})
        point_mapping.append({"id": qualified, "pointIndex": index, "pointId": point["pointId"],
                              "pairKey": point["pairKey"], "aIndex": point["aIndex"], "bIndex": point["bIndex"]})
    require(len({point["id"] for point in dto_points}) == 32, "qualified point IDs are not unique")
    return {"status": "AUTHENTICATED_SAVED_FIRST_PATCH_FIXTURE", "formatVersion": 1,
            "problem": {"bodies": [candidate_body(body) for body in free], "points": dto_points},
            "oracle": {"bodies": oracle_bodies, "sourceReceiptSha256": CERTIFICATE_SHA,
                       "exactCertificate": exact, "independentGeometry": receipt["independentGeometry"]},
            "baseline": {"status": prior["status"], "bodies": [candidate_body(body) for body in velocity],
                         "observedVelocityPhaseBodies": receipt["observedVelocityPhaseBodies"],
                         "normalImpulsesNs": [point["final"]["normalNs"] for point in points],
                         "tangentImpulsesNs": [point["final"]["tangentNs"] for point in points],
                         "firstViolation": prior["firstViolation"]},
            "pointMapping": point_mapping,
            "provenance": {"parentBaseline": SOURCE_BASE, "scene": "ALIGNED", "step": 1,
                           "sourceHelperSha256": EXTRACTOR_INPUT_SHA, "observerSha256": OBSERVER_SHA,
                           "certificateReceiptSha256": CERTIFICATE_SHA, "certificateReceiptBytes": CERTIFICATE_BYTES,
                           "priorDiagnosticSha256": equilibrium.PRIOR_SHA,
                           "manifestSha256": S.MANIFEST_SHA, "authentication": authentication,
                           "decodedFullAuthentication": "REUSED_FROM_PINNED_PRIOR_RECEIPT",
                           "currentCompressedAuthentication": "COMPLETE_BEFORE_EXTRACTION",
                           "selectedStepJsonSha256": equilibrium.STEP_SHA,
                           "selectedStepRawSha256": equilibrium.RAW_SHA,
                           "repackedSignedBinary64StepSha256": digest(repacked_step),
                           "freeFrameSignedBinary64Sha256": digest(frame_bytes(free, S.FIELDS)),
                           "oldVelocityFrameSignedBinary64Sha256": digest(frame_bytes(velocity, S.FIELDS)),
                           "jsonArchiveRecordsParsed": 2, "selectedRawBytes": 10296,
                           "fixedStepSeconds": ledger["fixedStepSeconds"], "gravityMps2": ledger["gravityMps2"]},
            "execution": {"worldCalls": 0, "solverCalls": 0, "velocitySweeps": 0, "sourceGeometryCalls": 0,
                          "oracleRecomputedFromCandidate": False},
            "historicalOriginalEightBoxPhysicalGO": False,
            "limitation": "One saved normal-only patch fixture; old NO_GO remains. No stability or native adoption claim."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    require(args.output.is_absolute(), "output must be absolute")
    output = args.output.resolve()
    require(output.is_relative_to(HERE / "evidence") and not output.exists(), "output must be fresh under new example evidence")
    signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError("170-second extraction deadline")))
    signal.alarm(170)
    result = extract()
    payload = (json.dumps(result, indent=2, allow_nan=False) + "\n").encode()
    require(len(payload) <= 2 * 1024 * 1024, "fixture output budget")
    with output.open("xb") as handle:
        handle.write(payload)
    print(json.dumps({"status": result["status"], "output": str(output), "bytes": len(payload), "sha256": digest(payload)}))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        print(json.dumps({"status": "FIXTURE_EXTRACTION_REFUSED", "errorType": type(error).__name__,
                          "message": str(error), "worldCalls": 0, "solverCalls": 0}), file=sys.stderr)
        sys.exit(1)
