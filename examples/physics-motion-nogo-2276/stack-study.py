#!/usr/bin/env python3
"""Bounded saved-data observer. No dynamics or source reference imports."""
import argparse
import gzip
import hashlib
import json
import math
import signal
import struct
import sys
import time
from decimal import Decimal, localcontext
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OLD = ROOT / "examples/physics-rigid-full-pair-position-world"
ARCHIVE = OLD / "evidence/native-final-a1b9e0a5"
MANIFEST_SHA = "b9f3a446022d8bedf65070f5ea43694fedcc7208b7de408c5067a6ce608cd42d"
PINS = {
    "source-ALIGNED.jsonl.gz": (54063016, "daea697b1a04c1e3bb00189e76db69ebadfbedbec9bc5dad4590a42a0bb80959", 420695755, "a4e96c868909477d498eb66194b5ff350437b3e484c36c8d64b0b2882f7b526b"),
    "source-ALIGNED.f64le.gz": (1581367, "8434ef44711481fddedf0583af23f4cf48257dcc9c37824365b080d259dfd15b", 8986536, "3749440ec8567ffe4384443d83e58927721eacb1f858c4ec5d1aef4d44cbec49"),
}
IDS = ["b" + str(i) for i in range(8)] + ["floor"]
FIELDS = (("positionM", 3), ("velocityMps", 3), ("orientation", 4), ("angularVelocityRadps", 3))
FRAME_BYTES = 936
MAX_LINE = 2 * 1024 * 1024
GATE = Decimal("1e-10")
GEOMETRY_GATE = Decimal("1e-9")
PRECISION_GATE = Decimal("1e-60")
Z = Decimal(0)
O = Decimal(1)


class StudyError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise StudyError(message)


def number(value):
    require(type(value) in (int, float) and math.isfinite(value), "nonfinite or nonnumeric operand")
    return Decimal.from_float(float(value))


def vector(value, count=3):
    require(type(value) is list and len(value) == count, "vector layout")
    return tuple(number(x) for x in value)


def add(a, b):
    return tuple(x + y for x, y in zip(a, b))


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def scale(a, factor):
    return tuple(x * factor for x in a)


def dot(a, b):
    return sum((x * y for x, y in zip(a, b)), Z)


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def norm(a):
    return dot(a, a).sqrt()


def keys(value, expected, label):
    require(type(value) is dict and set(value) == set(expected), label + " fields")


def body_layout(bodies):
    require(type(bodies) is list and len(bodies) == 9, "nine-body frame required")
    require([b.get("id") for b in bodies] == IDS, "body order")
    for b in bodies:
        for field, count in FIELDS:
            vector(b.get(field), count)
        require(b.get("kind") == ("static" if b["id"] == "floor" else "dynamic"), "body kind")
        expected = [2, .1, 2] if b["id"] == "floor" else [.25, .25, .25]
        require(b.get("shape") == {"kind": "box", "halfExtentsM": expected}, "fixed box shape")


def restore_frame(bodies, data):
    """Check JSON numeric layout against raw, then preserve raw binary operands."""
    body_layout(bodies)
    require(len(data) == FRAME_BYTES, "raw frame bytes")
    result = []
    offset = 0
    for source in bodies:
        b = dict(source)
        for field, count in FIELDS:
            values = list(struct.unpack_from("<" + "d"*count, data, offset))
            require(all(math.isfinite(x) for x in values), "raw nonfinite")
            require(values == source[field], "JSON/raw numeric mismatch")
            b[field] = values
            offset += 8 * count
        result.append(b)
    return result


def record_frames(record):
    require(record.get("scene") == "ALIGNED", "scene mismatch")
    if record.get("kind") == "initial":
        return [("initial", record["state"]["bodies"])]
    require(record.get("kind") == "step", "unexpected record kind")
    stages = record.get("stages")
    require(type(stages) is list and [s.get("stage") for s in stages] ==
            ["free-ready", "velocity-ready", "closure-ready"], "stage order")
    free, velocity, closure = (s["ledger"] for s in stages)
    require(free["velocityBodies"] is None and free["finalBodies"] is None and free["points"] is None,
            "free-ready layout")
    require(velocity["finalBodies"] is None, "velocity-ready layout")
    attempt = record["attempt"]
    return [("before", record["before"]["state"]["bodies"]),
            ("free-ready.free", free["freeBodies"]),
            ("velocity-ready.free", velocity["freeBodies"]),
            ("velocity-ready.velocity", velocity["velocityBodies"]),
            ("closure-ready.free", closure["freeBodies"]),
            ("closure-ready.velocity", closure["velocityBodies"]),
            ("closure-ready.final", closure["finalBodies"]),
            ("attempt.pre", attempt["preBodies"]),
            ("attempt.hypothetical", attempt["hypotheticalBodies"]),
            ("after", record["after"]["state"]["bodies"])]


POINT_KEYS = ("aId", "bId", "aIndex", "bIndex", "pairKey", "pointId", "family", "pointM", "normal", "aPositionM", "bPositionM", "warm", "final")


def point_layout(point, free, seen):
    keys(point, POINT_KEYS, "point")
    ai, bi = point["aIndex"], point["bIndex"]
    require(type(ai) is int and type(bi) is int and 0 <= ai < 9 and 0 <= bi < 9 and ai != bi,
            "point endpoint index")
    require(point["aId"] == free[ai]["id"] and point["bId"] == free[bi]["id"], "point endpoint id")
    require(point["pairKey"] == point["aId"] + "\0" + point["bId"], "pair key")
    require(point["family"] in ("face", "edge"), "point family")
    require(type(point["pointId"]) is str and 0 < len(point["pointId"]) <= 4096, "point id")
    key = (point["pairKey"], point["pointId"])
    require(key not in seen, "duplicate point")
    seen.add(key)
    vector(point["pointM"])
    with localcontext() as context:
        context.prec = 120
        require(abs(norm(vector(point["normal"])) - O) <= Decimal("1e-12"), "normal not unit")
    require(vector(point["aPositionM"]) == vector(free[ai]["positionM"]) and
            vector(point["bPositionM"]) == vector(free[bi]["positionM"]), "fixed free pose mismatch")
    for field in ("warm", "final"):
        keys(point[field], ("normalNs", "tangentNs"), "impulse")
        number(point[field]["normalNs"])
        vector(point[field]["tangentNs"])


def contact_at_precision(point, free, velocity, precision):
    with localcontext() as context:
        context.prec = precision
        p, n = vector(point["pointM"]), vector(point["normal"])
        endpoint_speed = []
        for i in (point["aIndex"], point["bIndex"]):
            arm = sub(p, vector(free[i]["positionM"]))
            endpoint_speed.append(add(vector(velocity[i]["velocityMps"]),
                                      cross(vector(velocity[i]["angularVelocityRadps"]), arm)))
        vn = dot(n, sub(endpoint_speed[1], endpoint_speed[0]))
        impulse = number(point["final"]["normalNs"])
        residuals = {"negativeNormalImpulseNs": max(Z, -impulse),
                     "closingNormalSpeedMps": max(Z, -vn),
                     "complementarityJ": abs(impulse * vn)}
        violations = classify_residuals(residuals)
        return {"normalSpeedMps": vn, "normalImpulseNs": impulse,
                "residuals": residuals, "violations": violations}


def classify_residuals(residuals):
    return [key for key, value in residuals.items() if value > GATE]


def precision_agreement(low, high):
    require(low["violations"] == high["violations"], "UNRESOLVED classification differs by precision")
    differences = {key: abs(low["residuals"][key] - value) for key, value in high["residuals"].items()}
    differences["normalSpeedMps"] = abs(low["normalSpeedMps"] - high["normalSpeedMps"])
    require(max(differences.values(), default=Z) <= PRECISION_GATE, "UNRESOLVED contact precision")
    return differences


def rotation_matrix(quaternion):
    # Independent normalized quaternion matrix; columns are derived here.
    q = vector(quaternion, 4)
    length = norm(q)
    require(length > Decimal("1e-30"), "degenerate quaternion")
    x, y, z, w = (v / length for v in q)
    return ((1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)),
            (2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)),
            (2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)))


def matrix_vector(matrix, v):
    return tuple(dot(row, v) for row in matrix)


def transpose_vector(matrix, v):
    return tuple(sum((matrix[j][i]*v[j] for j in range(3)), Z) for i in range(3))


def obb_witness(body, point, normal, side):
    matrix = rotation_matrix(body["orientation"])
    centre, extents = vector(body["positionM"]), vector(body["shape"]["halfExtentsM"])
    corners = [add(centre, matrix_vector(matrix, (sx*extents[0], sy*extents[1], sz*extents[2])))
               for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
    projections = [dot(corner, normal) for corner in corners]
    extreme = max(projections) if side == "A" else min(projections)
    support = [c for c, projected in zip(corners, projections) if abs(projected-extreme) <= GEOMETRY_GATE]
    local = transpose_vector(matrix, sub(point, centre))
    direction = transpose_vector(matrix, normal)
    outside = max([Z] + [abs(local[i])-extents[i] for i in range(3)])
    low, high = Decimal("-Infinity"), Decimal("Infinity")
    intersects = True
    for i in range(3):
        if direction[i] == 0:
            if abs(local[i]) > extents[i]:
                intersects = False
        else:
            a, b = (-extents[i]-local[i])/direction[i], (extents[i]-local[i])/direction[i]
            low, high = max(low, min(a, b)), min(high, max(a, b))
    intersects = intersects and low <= high
    surface_t = (high if side == "A" else low) if intersects else None
    return {"supportPlaneM": extreme, "supportCornersM": support,
            "localPointM": local, "maxLocalSlabViolationM": max(Z, outside),
            "pointInsideTolerance": outside <= GEOMETRY_GATE,
            "lineIntersects": intersects, "surfaceLineParameterM": surface_t,
            "surfaceWitnessM": add(point, scale(normal, surface_t)) if intersects else None}


def geometry_at_precision(point, free, precision):
    with localcontext() as context:
        context.prec = precision
        p, raw_normal = vector(point["pointM"]), vector(point["normal"])
        length = norm(raw_normal)
        require(length > Decimal("1e-30"), "degenerate normal")
        n = scale(raw_normal, O / length)
        a = obb_witness(free[point["aIndex"]], p, n, "A")
        b = obb_witness(free[point["bIndex"]], p, n, "B")
        both = a["lineIntersects"] and b["lineIntersects"]
        midpoint = abs((a["surfaceLineParameterM"] + b["surfaceLineParameterM"])/2) if both else None
        return {"toleranceM": GEOMETRY_GATE, "normalizedProjectionNormal": n, "a": a, "b": b,
                "supportPlaneGapM": b["supportPlaneM"]-a["supportPlaneM"],
                "lineIntersectsBoth": both,
                "lineWitnessGapM": b["surfaceLineParameterM"]-a["surfaceLineParameterM"] if both else None,
                "pointToLineWitnessMidpointM": midpoint,
                "lineMidpointWithinTolerance": midpoint <= GEOMETRY_GATE if both else False,
                "causalLawDefect": "UNKNOWN", "contactPatchSufficiency": "UNKNOWN"}


def compare_geometry(low, high):
    largest = Z
    def walk(a, b):
        nonlocal largest
        if isinstance(b, Decimal):
            largest = max(largest, abs(a-b))
        elif type(b) is dict:
            require(a.keys() == b.keys(), "UNRESOLVED geometry layout")
            for key in b:
                walk(a[key], b[key])
        elif type(b) in (list, tuple):
            require(len(a) == len(b), "UNRESOLVED support-corner classification")
            for x, y in zip(a, b):
                walk(x, y)
        else:
            require(a == b, "UNRESOLVED geometry classification")
    walk(low, high)
    require(largest <= PRECISION_GATE, "UNRESOLVED geometry precision")
    return largest


def compressed_authentication():
    manifest_data = (ARCHIVE / "manifest.json").read_bytes()
    require(len(manifest_data) <= 65536 and hashlib.sha256(manifest_data).hexdigest() == MANIFEST_SHA,
            "manifest authentication")
    manifest = json.loads(manifest_data)
    evidence = {Path(item["path"]).name: item for item in manifest["artifacts"]}
    result = {}
    for name, (size, sha, decoded_size, decoded_sha) in PINS.items():
        item = evidence[name]
        require(item["path"] == "evidence/native-final-a1b9e0a5/" + name, "manifest artifact path")
        require((item["bytes"], item["sha256"], item["decodedBytes"], item["decodedSha256"]) ==
                (size, sha, decoded_size, decoded_sha), "manifest pin disagreement")
        path = ARCHIVE / name
        require(path.stat().st_size == size, "compressed size")
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            while chunk := handle.read(1024 * 1024):
                digest.update(chunk)
        require(digest.hexdigest() == sha, "compressed hash")
        result[name] = {"path": str(path), "compressedBytes": size, "compressedSha256": sha,
                        "decodedBytes": decoded_size, "decodedSha256": decoded_sha}
    return result


def public(value):
    if isinstance(value, Decimal):
        return str(value)
    if type(value) is dict:
        return {key: public(v) for key, v in value.items()}
    if type(value) in (list, tuple):
        return [public(v) for v in value]
    return value


def study():
    authentication = compressed_authentication()
    raw_name = "source-ALIGNED.f64le.gz"
    with gzip.open(ARCHIVE / raw_name, "rb") as handle:
        raw = handle.read(PINS[raw_name][2] + 1)
    require(len(raw) == PINS[raw_name][2] and hashlib.sha256(raw).hexdigest() == PINS[raw_name][3],
            "decoded raw authentication")
    selected = None
    records = decoded_bytes = parsed_records = checked_steps = checks = raw_offset = 0
    maxima = {"negativeNormalImpulseNs": Z, "closingNormalSpeedMps": Z, "complementarityJ": Z}
    json_digest = hashlib.sha256()
    json_name = "source-ALIGNED.jsonl.gz"
    prefix_digest = hashlib.sha256()
    selected_snapshot = None
    with gzip.open(ARCHIVE / json_name, "rb") as handle:
        while line := handle.readline(MAX_LINE + 1):
            records += 1
            decoded_bytes += len(line)
            require(records <= 961 and len(line) <= MAX_LINE and line.endswith(b"\n") and
                    decoded_bytes <= PINS[json_name][2], "decoded JSON budget/layout")
            json_digest.update(line)
            if selected is not None:
                continue
            prefix_digest.update(line)
            record = json.loads(line, parse_constant=lambda _: (_ for _ in ()).throw(StudyError("JSON nonfinite")))
            parsed_records += 1
            require((records == 1 and record.get("kind") == "initial") or
                    (record.get("kind") == "step" and record.get("step") == records-1), "record cursor")
            restored = {}
            frame_start = raw_offset
            for label, bodies in record_frames(record):
                restored[label] = restore_frame(bodies, raw[raw_offset:raw_offset+FRAME_BYTES])
                raw_offset += FRAME_BYTES
            if records == 1:
                require(record["state"]["stepIndex"] == 0, "initial cursor")
                for i, body in enumerate(restored["initial"]):
                    require(body["positionM"] == ([0, -.1, 0] if i == 8 else [0, .25+.5*i, 0])
                            and body["orientation"] == [0, 0, 0, 1]
                            and body["velocityMps"] == [0, 0, 0]
                            and body["angularVelocityRadps"] == [0, 0, 0], "initial fixed fixture")
                continue
            ledger = record["stages"][2]["ledger"]
            require(ledger["fixedStepSeconds"] == 1/120 and ledger["gravityMps2"] == [0, -9.81, 0]
                    and ledger["actions"] == [], "fixed profile")
            require(record.get("producerRefused") is False and record["after"]["state"]["stepIndex"] == records-1,
                    "accepted step required")
            free, velocity = restored["closure-ready.free"], restored["closure-ready.velocity"]
            for a, b in zip(free, velocity):
                require(a["positionM"] == b["positionM"] and a["orientation"] == b["orientation"], "velocity phase changed pose")
                require(a.get("inverseMass") == (0 if a["id"] == "floor" else 1), "fixed mass")
                require(a.get("frictionStatic") == 1 and a.get("frictionDynamic") == .7 and a.get("restitution") == 0,
                        "fixed material")
            points = ledger["points"]
            require(type(points) is list and len(points) <= 144, "point budget")
            seen = set()
            checked_steps += 1
            for index, point in enumerate(points):
                point_layout(point, free, seen)
                checks += 1
                require(checks <= 138240, "total point budget")
                low = contact_at_precision(point, free, velocity, 80)
                high = contact_at_precision(point, free, velocity, 120)
                differences = precision_agreement(low, high)
                for key, value in high["residuals"].items():
                    maxima[key] = max(maxima[key], value)
                if high["violations"]:
                    gl = geometry_at_precision(point, free, 80)
                    gh = geometry_at_precision(point, free, 120)
                    geometry_difference = compare_geometry(gl, gh)
                    selected_snapshot = {"point": point,
                                         "freeEndpoints": [free[point["aIndex"]], free[point["bIndex"]]],
                                         "velocityEndpoints": [velocity[point["aIndex"]], velocity[point["bIndex"]]],
                                         "freeFrameRawHex": raw[frame_start+4*FRAME_BYTES:frame_start+5*FRAME_BYTES].hex(),
                                         "velocityFrameRawHex": raw[frame_start+5*FRAME_BYTES:frame_start+6*FRAME_BYTES].hex()}
                    require(len(json.dumps(selected_snapshot).encode()) <= MAX_LINE, "selected snapshot budget")
                    selected = {"step": records-1, "pointIndex": index, "pointId": point["pointId"],
                                "pairKey": point["pairKey"], "pointFamily": point["family"],
                                "recordSha256": hashlib.sha256(line).hexdigest(),
                                "recordRawOffsetBytes": frame_start, "recordRawBytes": raw_offset-frame_start,
                                "recordRawSha256": hashlib.sha256(raw[frame_start:raw_offset]).hexdigest(),
                                "decimal80": low, "decimal120": high, "precisionDifferences": differences,
                                "independentGeometry": gh, "geometryPrecisionMaxDifference": geometry_difference}
                    break
    require(records == 961 and decoded_bytes == PINS[json_name][2] and
            json_digest.hexdigest() == PINS[json_name][3], "complete decoded JSON authentication")
    if selected is None:
        require(checked_steps == 960 and raw_offset == len(raw), "complete scan cursor")
    return {"status": "DIAGNOSTIC_NORMAL_CONTACT_NO_GO" if selected else "NO_NORMAL_RESIDUAL_ABOVE_GATE_IN_SAVED_PREFIX",
            "authentication": authentication, "manifestSha256": MANIFEST_SHA,
            "decodedAuthenticationComplete": True,
            "authenticationOrder": ["manifest and complete compressed hashes before arithmetic",
                                    "complete decoded raw hash before arithmetic",
                                    "complete decoded JSON hash after stopped diagnostic, before result delivery"],
            "arithmeticPrecisionDigits": [80, 120], "gateEachStatedSIUnit": str(GATE),
            "archiveRecordsHashed": records, "decodedJsonBytesHashed": decoded_bytes,
            "recordsParsedBeforeStop": parsed_records, "stepsExamined": checked_steps, "pointChecks": checks,
            "parsedPrefixSha256": prefix_digest.hexdigest(), "maxResidualsInExaminedPrefix": maxima,
            "firstViolation": selected, "selectedSnapshot": selected_snapshot,
            "stoppedPointArithmeticAtFirstViolation": selected is not None,
            "worldCalls": 0, "solverCalls": 0, "sourceGeometryCalls": 0,
            "causalLawDefect": "UNKNOWN", "contactPatchSufficiency": "UNKNOWN",
            "nativeLawFixAuthorized": False, "originalEightBoxPhysicalGO": False,
            "limitation": "The saved frozen constraint is examined. A residual and one support witness do not prove the cause of long-term instability."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    require(args.output.is_absolute(), "output must be absolute")
    require(not args.output.exists(), "output already exists")
    signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(StudyError("170-second internal process budget")))
    signal.alarm(170)
    start = time.monotonic()
    try:
        result = study()
        exit_code = 0
    except (StudyError, ValueError, KeyError, TypeError, OSError, EOFError, ArithmeticError) as error:
        result = {"status": "EXECUTION_FAILURE", "errorType": type(error).__name__, "message": str(error),
                  "causalLawDefect": "UNKNOWN", "nativeLawFixAuthorized": False,
                  "worldCalls": 0, "solverCalls": 0, "sourceGeometryCalls": 0}
        exit_code = 1
    result["elapsedSeconds"] = time.monotonic() - start
    payload = (json.dumps(public(result), indent=2, allow_nan=False) + "\n").encode()
    require(len(payload) <= 16 * 1024 * 1024, "derived output budget")
    with args.output.open("xb") as handle:
        handle.write(payload)
    print(json.dumps({"status": result["status"], "output": str(args.output),
                      "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest(),
                      "pointChecks": result.get("pointChecks"), "stepsExamined": result.get("stepsExamined")}))
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
