#!/usr/bin/env python3
"""DRAFT: independent Decimal witness and finite-segment validation.

No geometry, SAT, parser or producer module is imported. Raw decoded quaternion
components define the rotation basis; the quaternion is never normalized.
Decimal80/120 must agree. Feature labels and near ties do not prove uniqueness.
Input accepts one object, an array, or a stream of JSON objects/arrays.
"""

from decimal import Decimal, localcontext
import json
import math
import sys


ZERO = Decimal(0)
ONE = Decimal(1)
TWO = Decimal(2)
METRE_TOLERANCE = Decimal("1e-12")
NORMAL_TOLERANCE = Decimal("1e-12")
PRECISION_TOLERANCE = Decimal("1e-25")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def dec(value):
    if isinstance(value, Decimal):
        require(value.is_finite(), "nonfinite Decimal")
        return value
    require(type(value) in (int, float), "expected a finite number; bool is invalid")
    try:
        original = float(value)
    except (OverflowError, ValueError) as error:
        raise ValueError("number is outside original Float64 range") from error
    require(math.isfinite(original), "nonfinite Float64")
    return Decimal.from_float(original)


def vec(values, size=3):
    require(isinstance(values, (list, tuple)) and len(values) == size, f"expected vector length {size}")
    return tuple(dec(value) for value in values)


def add(a, b):
    return tuple(x+y for x, y in zip(a, b))


def sub(a, b):
    return tuple(x-y for x, y in zip(a, b))


def scale(a, value):
    return tuple(x*value for x in a)


def dot(a, b):
    return sum((x*y for x, y in zip(a, b)), ZERO)


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def norm(a):
    return dot(a, a).sqrt()


def unit(a):
    length = norm(a)
    require(length > ZERO, "zero geometric direction")
    return scale(a, ONE/length)


def max_component_error(a, b):
    return max(abs(x-y) for x, y in zip(a, b))


def axis(value):
    require(type(value) is int and 0 <= value < 3, "axis must be integer 0..2")
    return value


def side(value):
    require(type(value) in (int, float) and value in (-1, 1), "face side must be -1 or +1")
    return dec(value)


def body(raw):
    require(isinstance(raw, dict) and isinstance(raw.get("id"), str), "body requires a string id")
    shape = raw.get("shape")
    require(isinstance(shape, dict) and shape.get("kind") == "box", "box shape required")
    extents = vec(shape.get("halfExtentsM"))
    require(min(extents) > ZERO, "positive box half extents required")
    center = vec(raw.get("positionM"))
    x, y, z, w = vec(raw.get("orientation"), 4)
    qnorm = (x*x+y*y+z*z+w*w).sqrt()
    require(abs(qnorm-ONE) <= Decimal("1e-9"), "quaternion norm exceeds native admission")
    # Raw-quaternion scalar rotation columns. No quaternion normalization.
    bases = ((ONE-TWO*(y*y+z*z), TWO*(x*y+w*z), TWO*(x*z-w*y)),
             (TWO*(x*y-w*z), ONE-TWO*(x*x+z*z), TWO*(y*z+w*x)),
             (TWO*(x*z+w*y), TWO*(y*z-w*x), ONE-TWO*(x*x+y*y)))
    determinant = dot(bases[0], cross(bases[1], bases[2]))
    require(determinant != ZERO, "singular raw rotation basis")
    return {"id": raw["id"], "center": center, "extents": extents,
            "bases": bases, "determinant": determinant, "quaternionNormError": abs(qnorm-ONE)}


def local_coordinates(box, point):
    value = sub(point, box["center"])
    a, b, c = box["bases"]
    determinant = box["determinant"]
    # Invert the actual raw basis, rather than assume exact orthogonality.
    return (dot(value, cross(b, c))/determinant,
            dot(value, cross(c, a))/determinant,
            dot(value, cross(a, b))/determinant)


def check(checks, name, error, tolerance=METRE_TOLERANCE):
    require(error.is_finite(), "nonfinite reference error")
    checks.append({"name": name, "error": error, "tolerance": tolerance, "passed": error <= tolerance})


def face_membership(box, point, face_axis, face_side):
    local = local_coordinates(box, point)
    errors = [abs(local[face_axis]-face_side*box["extents"][face_axis])]
    errors += [max(ZERO, abs(local[i])-box["extents"][i]) for i in range(3) if i != face_axis]
    return max(errors), local


def scalar_sat(a, b, selection):
    delta = sub(b["center"], a["center"])
    rows = []
    raw_candidates = [(f"A.face.{i}", basis) for i, basis in enumerate(a["bases"])]
    raw_candidates += [(f"B.face.{i}", basis) for i, basis in enumerate(b["bases"])]
    raw_candidates += [(f"A.edge.{i}xB.edge.{j}", cross(u, v))
                       for i, u in enumerate(a["bases"]) for j, v in enumerate(b["bases"])]
    for index, (label, raw) in enumerate(raw_candidates):
        length = norm(raw)
        record = {"index": index, "label": label, "rawLength": length,
                  "exactZero": length == ZERO, "unitAxis": None, "marginM": None,
                  "nearOriginalSkipThreshold": ZERO < length < Decimal("1e-12")}
        if length > ZERO:
            direction = scale(raw, ONE/length)
            radius_a = sum((extent*abs(dot(basis, direction)) for extent, basis in zip(a["extents"], a["bases"])), ZERO)
            radius_b = sum((extent*abs(dot(basis, direction)) for extent, basis in zip(b["extents"], b["bases"])), ZERO)
            record.update(unitAxis=direction, marginM=radius_a+radius_b-abs(dot(delta, direction)))
        rows.append(record)
    minimum = min(row["marginM"] for row in rows if not row["exactZero"])
    feature = selection["feature"]
    require(isinstance(feature, dict), "selection.feature required")
    kind = feature.get("kind")
    if kind == "face-a":
        selected_index = axis(feature.get("axisA"))
    elif kind == "face-b":
        selected_index = 3+axis(feature.get("axisB"))
    else:
        require(kind == "edge-cross", "unknown selected feature")
        selected_index = 6+3*axis(feature.get("axisA"))+axis(feature.get("axisB"))
    require(type(selection.get("candidateIndex")) is int and selection["candidateIndex"] == selected_index,
            "candidate index and feature disagree")
    selected = rows[selected_index]
    require(not selected["exactZero"] and selection.get("label") == selected["label"], "invalid selected axis or label")
    hit = selection.get("hit")
    require(isinstance(hit, dict), "selection.hit required")
    hit_normal = vec(hit.get("normal"))
    hit_depth = dec(hit.get("penetration"))
    require(hit_depth >= ZERO, "negative hit penetration")
    vec(hit.get("pointM"))
    oriented_projection = dot(delta, hit_normal)
    normal_error = min(max_component_error(hit_normal, selected["unitAxis"]),
                       max_component_error(hit_normal, scale(selected["unitAxis"], -ONE)))
    return {"candidates": rows, "minMarginM": minimum, "penetrationM": max(ZERO, minimum),
            "selectedIndex": selected_index, "selectedLabel": selected["label"],
            "selectedMarginM": selected["marginM"], "selectedDepthErrorM": abs(max(ZERO, selected["marginM"])-hit_depth),
            "minimumDepthErrorM": abs(max(ZERO, minimum)-hit_depth),
            "selectedNormalParallelError": normal_error,
            "orientationViolationM": max(ZERO, -oriented_projection),
            "orientationAmbiguous": abs(oriented_projection) <= METRE_TOLERANCE,
            "nearMinimumLabels": [row["label"] for row in rows if row["marginM"] is not None
                                  and abs(row["marginM"]-minimum) <= METRE_TOLERANCE],
            "selectedNearMinimum": abs(selected["marginM"]-minimum) <= METRE_TOLERANCE,
            "nearNonzeroAxisLabels": [row["label"] for row in rows if row["nearOriginalSkipThreshold"]]}


def segment_reference(p, p1, q, q1, result):
    require(isinstance(result, dict), "segment result must be an object")
    a, b = vec(result.get("a")), vec(result.get("b"))
    s, t = dec(result.get("parameterA")), dec(result.get("parameterB"))
    require(ZERO <= s <= ONE and ZERO <= t <= ONE, "segment parameters outside [0,1]")
    u, v, r = sub(p1, p), sub(q1, q), sub(p, q)
    aa, bb, c = dot(u, u), dot(v, v), dot(u, v)
    require(aa > ZERO and bb > ZERO, "zero-length segment")
    d, e = dot(u, r), dot(v, r)
    clamp = lambda value: max(ZERO, min(ONE, value))
    candidates = [(ZERO, clamp(e/bb)), (ONE, clamp((e+c)/bb)),
                  (clamp(-d/aa), ZERO), (clamp((c-d)/aa), ONE)]
    determinant = aa*bb-c*c
    cross_squared = dot(cross(u, v), cross(u, v))
    # Independent Gram-system stationary point, not the producer's cross formula.
    if determinant > ZERO:
        stationary_s, stationary_t = (c*e-bb*d)/determinant, (aa*e-c*d)/determinant
        if ZERO <= stationary_s <= ONE and ZERO <= stationary_t <= ONE:
            candidates.append((stationary_s, stationary_t))
    distances = []
    for candidate_s, candidate_t in candidates:
        difference = sub(add(p, scale(u, candidate_s)), add(q, scale(v, candidate_t)))
        distances.append((dot(difference, difference), candidate_s, candidate_t))
    minimum_distance_squared = min(item[0] for item in distances)
    difference = sub(a, b)
    distance_squared = dot(difference, difference)
    gradient_a = dot(scale(u, ONE/aa.sqrt()), difference)
    gradient_b = -dot(scale(v, ONE/bb.sqrt()), difference)
    def stationarity(parameter, gradient):
        if parameter == ZERO:
            return max(ZERO, -gradient)
        if parameter == ONE:
            return max(ZERO, gradient)
        return abs(gradient)
    checks = []
    check(checks, "segmentAParameterMembershipM", max_component_error(a, add(p, scale(u, s))))
    check(checks, "segmentBParameterMembershipM", max_component_error(b, add(q, scale(v, t))))
    check(checks, "segmentAStationaryOrEndpointResidualM", stationarity(s, gradient_a))
    check(checks, "segmentBStationaryOrEndpointResidualM", stationarity(t, gradient_b))
    check(checks, "globalNearestDistanceErrorM", abs(distance_squared.sqrt()-minimum_distance_squared.sqrt()))
    reported_distance = result.get("distanceSquared")
    if reported_distance is not None:
        reported = dec(reported_distance)
        require(reported >= ZERO, "negative reported segment distance")
        check(checks, "reportedDistanceErrorM", abs(reported.sqrt()-distance_squared.sqrt()))
    return {"parameterA": s, "parameterB": t, "distanceSquaredM2": distance_squared,
            "minimumDistanceSquaredM2": minimum_distance_squared, "gradientAM": gradient_a, "gradientBM": gradient_b,
            "crossSquaredM4": cross_squared, "gramDeterminantM4": determinant,
            "independentParallel": cross_squared == ZERO,
            "illConditionedGram": cross_squared > ZERO and determinant <= ZERO,
            "endpoint": s in (ZERO, ONE) or t in (ZERO, ONE),
            "minimumCandidates": [{"distanceSquaredM2": distance, "s": cs, "t": ct} for distance, cs, ct in distances],
            "reportedParallel": result.get("parallel"), "reportedBoundary": result.get("boundary"), "checks": checks}


def edge_segment(box, edge_axis, sides, direction):
    sides = vec(sides)
    require(sides[edge_axis] == ZERO and all(sides[i] in (-ONE, ONE) for i in range(3) if i != edge_axis),
            "edge sides must be zero on edge axis and +/-1 elsewhere")
    center = box["center"]
    support_errors = []
    for i in range(3):
        if i == edge_axis:
            continue
        center = add(center, scale(box["bases"][i], sides[i]*box["extents"][i]))
        support_errors.append(max(ZERO, -sides[i]*dot(box["bases"][i], direction)))
    half_edge = scale(box["bases"][edge_axis], box["extents"][edge_axis])
    return sub(center, half_edge), add(center, half_edge), max(support_errors)


def validate_geometry(request):
    a, b = body(request["a"]), body(request["b"])
    require(a["id"] != b["id"], "distinct body ids required")
    geometry = request.get("geometry")
    require(isinstance(geometry, dict), "geometry must be an object")
    selection = geometry.get("selection")
    require(isinstance(selection, dict), "geometry.selection required")
    sat = scalar_sat(a, b, selection)
    normal = vec(geometry.get("planeNormalAtoB"))
    hit_normal = vec(selection["hit"]["normal"])
    points = geometry.get("points")
    require(isinstance(points, list) and 0 < len(points) <= 4, "one to four witness points required")
    checks, point_metrics = [], []
    check(checks, "SATSelectedDepthErrorM", sat["selectedDepthErrorM"])
    check(checks, "SATIndependentMinimumDepthErrorM", sat["minimumDepthErrorM"])
    check(checks, "SATNormalParallelError", sat["selectedNormalParallelError"], NORMAL_TOLERANCE)
    check(checks, "SATNormalOrientationViolationM", sat["orientationViolationM"])
    check(checks, "planeNormalUnitError", abs(norm(normal)-ONE), NORMAL_TOLERANCE)
    feature = selection["feature"]
    family = geometry.get("family")
    keys = []
    segment = None
    if family == "face":
        require(feature["kind"] in ("face-a", "face-b"), "face family and selected feature disagree")
        reference = geometry.get("reference")
        require(isinstance(reference, dict), "face reference required")
        ref_body = reference.get("body")
        require(ref_body in ("a", "b") and ref_body == ("a" if feature["kind"] == "face-a" else "b"), "wrong reference body")
        ref, incident = (a, b) if ref_body == "a" else (b, a)
        reference_axis, reference_side = axis(reference.get("axis")), side(reference.get("side"))
        require(reference_axis == feature["axisA" if ref_body == "a" else "axisB"], "reference axis mismatch")
        incident_axis, incident_side = axis(reference.get("incidentAxis")), side(reference.get("incidentSide"))
        outward = unit(scale(ref["bases"][reference_axis], reference_side))
        plane = add(ref["center"], scale(ref["bases"][reference_axis], reference_side*ref["extents"][reference_axis]))
        expected_normal = outward if ref_body == "a" else scale(outward, -ONE)
        check(checks, "declaredFaceNormalError", max_component_error(normal, expected_normal), NORMAL_TOLERANCE)
        check(checks, "faceSelectedNormalError", max_component_error(normal, hit_normal), NORMAL_TOLERANCE)
        incident_alignments = [abs(dot(basis, outward)) for basis in incident["bases"]]
        check(checks, "incidentAxisAlignmentDeficit", max(incident_alignments)-incident_alignments[incident_axis], NORMAL_TOLERANCE)
        check(checks, "incidentSideSupportViolation", max(ZERO, incident_side*dot(incident["bases"][incident_axis], outward)), NORMAL_TOLERANCE)
        for index, point in enumerate(points):
            wa, wb = vec(point.get("witnessAM")), vec(point.get("witnessBM"))
            ref_point, incident_point = (wa, wb) if ref_body == "a" else (wb, wa)
            ref_error, ref_local = face_membership(ref, ref_point, reference_axis, reference_side)
            inc_error, inc_local = face_membership(incident, incident_point, incident_axis, incident_side)
            projection = sub(incident_point, scale(outward, dot(sub(incident_point, plane), outward)))
            check(checks, f"point{index}.referenceFaceMembershipM", ref_error)
            check(checks, f"point{index}.incidentFaceMembershipM", inc_error)
            check(checks, f"point{index}.referenceProjectionErrorM", max_component_error(ref_point, projection))
            check(checks, f"point{index}.referencePlaneResidualM", abs(dot(sub(ref_point, plane), outward)))
            point_metrics.append({"referenceLocalCoordinates": ref_local, "incidentLocalCoordinates": inc_local})
    else:
        require(family == "edge" and feature["kind"] == "edge-cross" and len(points) == 1, "edge family requires one edge-cross point")
        edges = geometry.get("edges")
        require(isinstance(edges, dict), "edge references required")
        edge_a, edge_b = axis(edges.get("axisA")), axis(edges.get("axisB"))
        require(edge_a == feature["axisA"] and edge_b == feature["axisB"], "edge axes mismatch")
        pa, pa1, support_a = edge_segment(a, edge_a, edges.get("sidesA"), hit_normal)
        pb, pb1, support_b = edge_segment(b, edge_b, edges.get("sidesB"), scale(hit_normal, -ONE))
        check(checks, "supportedEdgeAOrientationError", support_a, NORMAL_TOLERANCE)
        check(checks, "supportedEdgeBOrientationError", support_b, NORMAL_TOLERANCE)
        check(checks, "edgePlaneSelectedNormalError", max_component_error(normal, hit_normal), NORMAL_TOLERANCE)
        point = points[0]
        wa, wb = vec(point.get("witnessAM")), vec(point.get("witnessBM"))
        segment = segment_reference(pa, pa1, pb, pb1,
            {"a": wa, "b": wb, "parameterA": edges.get("parameterA"), "parameterB": edges.get("parameterB")})
        checks.extend(segment["checks"])
        difference = sub(wb, wa)
        check(checks, "edgeTangentialWitnessResidualM", norm(sub(difference, scale(normal, dot(difference, normal)))))
        point_metrics.append({"localA": local_coordinates(a, wa), "localB": local_coordinates(b, wb)})
    for index, point in enumerate(points):
        require(isinstance(point, dict) and isinstance(point.get("key"), str), "witness key required")
        keys.append(point["key"])
        wa, wb, midpoint = vec(point.get("witnessAM")), vec(point.get("witnessBM")), vec(point.get("midpointM"))
        gap = dot(sub(wb, wa), normal)
        penetration = max(ZERO, -gap)
        check(checks, f"point{index}.midpointIdentityM", max_component_error(midpoint, scale(add(wa, wb), ONE/TWO)))
        check(checks, f"point{index}.normalGapIdentityM", abs(dec(point.get("normalGapM"))-gap))
        check(checks, f"point{index}.pointPenetrationIdentityM", abs(dec(point.get("pointPenetrationM"))-penetration))
        point_metrics[index].update(key=point["key"], normalGapM=gap, pointPenetrationM=penetration)
    require(len(set(keys)) == len(keys), "duplicate witness keys")
    return {"SAT": sat, "points": point_metrics, "segments": segment, "checks": checks,
            "quaternionNormErrors": {"a": a["quaternionNormError"], "b": b["quaternionNormError"]},
            "uniquePhysicalFeatureClaimed": False}


def reference(request, precision):
    require(isinstance(request, dict), "reference request must be an object")
    with localcontext() as context:
        context.prec = precision
        if "segments" in request:
            segments = request["segments"]
            require(isinstance(segments, dict), "segments must be an object")
            return segment_reference(vec(segments.get("p")), vec(segments.get("p1")),
                                     vec(segments.get("q")), vec(segments.get("q1")), segments.get("result"))
        return validate_geometry(request)


def precision_agreement(a, b):
    maximum, shape_agrees = ZERO, True
    def visit(x, y):
        nonlocal maximum, shape_agrees
        if isinstance(x, Decimal) and isinstance(y, Decimal):
            maximum = max(maximum, abs(x-y))
        elif isinstance(x, dict) and isinstance(y, dict) and x.keys() == y.keys():
            for key in x:
                visit(x[key], y[key])
        elif isinstance(x, (tuple, list)) and isinstance(y, (tuple, list)) and len(x) == len(y):
            for first, second in zip(x, y):
                visit(first, second)
        elif x != y:
            shape_agrees = False
    with localcontext() as context:
        context.prec = 120
        visit(a, b)
    return shape_agrees and maximum <= PRECISION_TOLERANCE, maximum


def json_native(value, strings=False):
    if isinstance(value, Decimal):
        if strings:
            return str(value)
        result = float(value)
        require(math.isfinite(result), "reference result exceeds finite JSON number range")
        return result
    if isinstance(value, dict):
        return {key: json_native(item, strings) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [json_native(item, strings) for item in value]
    return value


def evaluate(request):
    try:
        low, high = reference(request, 80), reference(request, 120)
        resolved, error = precision_agreement(low, high)
        violations = [item["name"] for item in high["checks"] if not item["passed"]]
        if not resolved:
            violations.append("Decimal80/120 reference precision unresolved")
        segments = high.get("segments") if "segments" in high else high
        if segments is not None and segments.get("illConditionedGram"):
            resolved = False
            violations.append("independent Gram stationary point unresolved")
        return {"ok": resolved and not violations, "resolved": resolved,
                "referencePrecisionResolved": resolved, "metrics": json_native(high),
                "metricsDecimal": json_native(high, True),
                "precisionMaximumAbsoluteError": float(error), "precisionMaximumAbsoluteErrorDecimal": str(error),
                "violations": violations,
                "conventions": {"quaternion": "original decoded raw components; never normalized",
                                "membership": "scalar inverse of raw rotated basis; finite declared features",
                                "nearestSegments": "independent Gram stationary point and four boundary minima plus KKT checks",
                                "uniqueness": "labels/ties/degeneracy are observations, not a physical feature certificate"}}
    except (ValueError, KeyError, TypeError, ArithmeticError) as error:
        return {"ok": False, "resolved": False, "referencePrecisionResolved": False,
                "metrics": None, "violations": [str(error)]}


def process(value):
    return [evaluate(item) for item in value] if isinstance(value, list) else evaluate(value)


def closed_json(text):
    depth, quoted, escaped = 0, False, False
    for character in text:
        if quoted:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                quoted = False
        elif character == '"':
            quoted = True
        elif character in "[{":
            depth += 1
        elif character in "]}":
            depth -= 1
    return not quoted and depth <= 0


def main():
    buffer = ""
    for line in sys.stdin:
        if not buffer and not line.strip():
            continue
        buffer += line
        try:
            value = json.loads(buffer)
        except json.JSONDecodeError as error:
            if not closed_json(buffer):
                continue
            response = {"ok": False, "resolved": False, "violations": [f"invalid JSON: {error}"]}
        else:
            response = process(value)
        print(json.dumps(response, allow_nan=False), flush=True)
        buffer = ""
    if buffer.strip():
        print(json.dumps({"ok": False, "resolved": False, "violations": ["incomplete JSON input"]}), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
