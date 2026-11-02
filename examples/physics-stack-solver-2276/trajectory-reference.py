#!/usr/bin/env python3
"""Pinned independent geometry functions, exposed as bounded newline JSON."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
SOURCE_PINS = {
    "physics-motion-nogo-2276/stack-study.py": "70a34672ef53f034fa714bcd54a120a60c672fea3fd740841064dc8ac43263e2",
    "physics-rigid-contact-reference/geometry-reference.py": "2c8bc7f6cd809e865c986a859b8614c963c4862296920555eb31c9487411af26",
}
MAX_LINE = 2 * 1024 * 1024


def load_pinned(relative, name):
    path = HERE.parent / relative
    if hashlib.sha256(path.read_bytes()).hexdigest() != SOURCE_PINS[relative]:
        raise ValueError("reference helper authentication failed: " + relative)
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def failure(error, request=None):
    metadata = request.get("guardMetadata") if type(request) is dict else None
    return {"ok": False, "resolved": False, "executionFailure": True,
            "precisionResolved": False, "op": request.get("op") if type(request) is dict else None,
            "metrics": None, "rows": [], "violations": [str(error)],
            "errorType": type(error).__name__, "guardMetadata": metadata, "sourcePins": SOURCE_PINS}


def contacts(request, saved):
    free, points = request["freeBodies"], request["pointLedger"]
    saved.body_layout(free)
    saved.require(type(points) is list and len(points) <= 32, "contacts require zero to 32 ledger points")
    rows, violations, seen = [], [], set()
    precision_resolved = True
    support_gaps, midpoint_errors, slab_errors, precision_errors = [], [], [], []
    for index, point in enumerate(points):
        row = {"pointIndex": index}
        if type(point) is dict:
            row.update({"pairKey": point.get("pairKey"), "pointId": point.get("pointId")})
        try:
            saved.point_layout(point, free, seen)
            low = saved.geometry_at_precision(point, free, 80)
            high = saved.geometry_at_precision(point, free, 120)
            difference = saved.compare_geometry(low, high)
            checks = {"lineIntersectsBoth": high["lineIntersectsBoth"],
                      "lineMidpointWithinTolerance": high["lineMidpointWithinTolerance"],
                      "aPointInsideTolerance": high["a"]["pointInsideTolerance"],
                      "bPointInsideTolerance": high["b"]["pointInsideTolerance"],
                      "signedSupportPlaneGapWithinTolerance": high["supportPlaneGapM"] <= saved.GEOMETRY_GATE}
            row_violations = [name for name, passed in checks.items() if not passed]
            row.update({"precisionResolved": True, "checks": checks, "violations": row_violations,
                        "precisionMaxDifference": saved.public(difference), "witness": saved.public(high)})
            violations.extend({"pointIndex": index, "pointId": point["pointId"], "check": name} for name in row_violations)
            support_gaps.append(high["supportPlaneGapM"])
            if high["pointToLineWitnessMidpointM"] is not None:
                midpoint_errors.append(high["pointToLineWitnessMidpointM"])
            slab_errors.extend([high["a"]["maxLocalSlabViolationM"], high["b"]["maxLocalSlabViolationM"]])
            precision_errors.append(difference)
        except (saved.StudyError, ValueError, TypeError, KeyError, ArithmeticError, IndexError) as error:
            precision_resolved = False
            row.update({"precisionResolved": False, "errorType": type(error).__name__,
                        "violations": [str(error)]})
            violations.append({"pointIndex": index, "check": "unresolved", "message": str(error)})
        rows.append(row)

    def maximum(values):
        return float(max(values)) if values else None

    metrics = {"maxSignedSupportPlaneGapM": maximum(support_gaps),
               "maxPointToLineWitnessMidpointM": maximum(midpoint_errors),
               "maxLocalSlabViolationM": maximum(slab_errors),
               "maxPrecisionDifference": maximum(precision_errors)}
    return {"op": "contacts", "ok": precision_resolved and not violations,
            "resolved": precision_resolved, "executionFailure": not precision_resolved,
            "precisionResolved": precision_resolved, "pointChecks": len(rows),
            "metrics": metrics, "rows": rows, "violations": violations,
            "guardMetadata": request.get("guardMetadata"), "sourcePins": SOURCE_PINS}


def dispatch(request, saved, quality):
    if type(request) is not dict:
        raise ValueError("reference request must be an object")
    operation = request.get("op")
    if operation == "contacts":
        return contacts(request, saved)
    if operation == "quality":
        result = quality.evaluate(request["request"])
        # Keep the old quality fields and all original numerical gates unchanged.
        resolved = result["metrics"]["referencePrecisionResolved"]
        return {**result, "op": operation, "resolved": resolved, "executionFailure": not resolved,
                "precisionResolved": resolved, "guardMetadata": request.get("guardMetadata"),
                "sourcePins": SOURCE_PINS}
    raise ValueError("reference operation must be quality or contacts")


def main():
    saved = load_pinned("physics-motion-nogo-2276/stack-study.py", "immutable_contact_witness")
    quality = load_pinned("physics-rigid-contact-reference/geometry-reference.py", "immutable_trajectory_quality")
    while True:
        line = sys.stdin.buffer.readline(MAX_LINE + 1)
        if not line:
            break
        request = None
        if len(line) > MAX_LINE:
            print(json.dumps(failure(ValueError("reference line exceeds 2 MiB"))), flush=True)
            return 1
        try:
            request = json.loads(line)
            result = dispatch(request, saved, quality)
        except (saved.StudyError, quality.ReferenceInputError, ValueError, TypeError, KeyError,
                ArithmeticError, IndexError, AttributeError) as error:
            result = failure(error, request)
        print(json.dumps(result, allow_nan=False), flush=True)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        print(json.dumps({"status": "REFERENCE_STARTUP_FAILURE", "errorType": type(error).__name__,
                          "message": str(error)}), file=sys.stderr)
        sys.exit(1)
