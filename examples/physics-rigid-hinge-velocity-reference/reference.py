#!/usr/bin/env python3
"""Independent input-derived hinge pose, exact binary linear model and observer.

JSON lines: {config,state,dt,beforeRawHex?,output?,afterRawHex?}; separate
algebra guards: {op:'linear',problem,result?}. No candidate/Physics imports.
Fraction certificates concern authored binary coefficients, not trig accuracy
or exact feasibility of rounded Float64 output. Scalar transcendentals are
declared separately from Decimal80/120 algebra. Importing runs no experiment.
"""
from decimal import Decimal, localcontext
from fractions import Fraction
import copy
import importlib.util
import json
import math
from pathlib import Path
import struct
import sys

sys.dont_write_bytecode = True
PATH = Path(__file__).resolve().parent.parent / "physics-rigid-coupled-hinge-reference" / "reference.py"
SPEC = importlib.util.spec_from_file_location("adopted_pose_scalar_1309", PATH)
POSE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(POSE)
OLD = POSE.OLD
Z, O = Decimal(0), Decimal(1)
DOF = ["vAx", "vAy", "vAz", "wAx", "wAy", "wAz", "vBx", "vBy", "vBz", "wBx", "wBy", "wBz"]
ROWS = ["P.x", "P.y", "P.z", "L.x", "L.y", "L.z", "anchor.x", "anchor.y", "anchor.z", "transverse.x", "transverse.y"]
INERTIA = .4 * 1 * .1**2
LINEAR_MESSAGE = "private hinge velocity linear data is invalid"
SYSTEM_MESSAGE = "private hinge velocity system is singular or unsafe"
CERT_MESSAGE = "private hinge velocity certificate is invalid"
INPUT_MESSAGE = "hinge velocity reference input is invalid"
NUMERIC_GATE = Fraction.from_float(1e-10)


class ReferenceInputError(ValueError):
    pass


class ReferenceSystemError(ValueError):
    pass


def require(value, message=INPUT_MESSAGE):
    if not value:
        raise ReferenceInputError(message)


def finite(value, message=INPUT_MESSAGE):
    require(type(value) in (int, float), message)
    try:
        binary = float(value)
    except OverflowError:
        raise ReferenceInputError(message) from None
    require(math.isfinite(binary), message)
    return binary


def array(value, size, message=INPUT_MESSAGE):
    require(isinstance(value, list) and len(value) == size, message)
    return [finite(x, message) for x in value]


def matrix(value, rows, columns, message=INPUT_MESSAGE):
    require(isinstance(value, list) and len(value) == rows, message)
    return [array(row, columns, message) for row in value]


def keys(value, expected, message=INPUT_MESSAGE):
    require(isinstance(value, dict) and set(value) == set(expected), message)


def finite_tree(value):
    if type(value) in (int, float):
        finite(value)
    elif isinstance(value, dict):
        for item in value.values():
            finite_tree(item)
    elif isinstance(value, list):
        for item in value:
            finite_tree(item)
    else:
        require(type(value) in (str, bool), INPUT_MESSAGE)


def restore_checked(bodies, hexadecimal):
    require(isinstance(hexadecimal,str) and len(hexadecimal) == 416 and all(c in "0123456789abcdefABCDEF" for c in hexadecimal),
            "hinge velocity reference raw13 encoding is invalid")
    return POSE.restored_bodies(bodies,hexadecimal)


def binary_dot(a, b):
    total = 0.0
    for x, y in zip(a, b):
        total = total + x*y
    return total


def fadd(a, b):
    return [a[i]+b[i] for i in range(3)]


def fsub(a, b):
    return [a[i]-b[i] for i in range(3)]


def fscale(a, s):
    return [x*s for x in a]


def fcross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def frotate(q, v):
    # Independently stated I+2w[u]x+2[u]x² in original binary order.
    t = fscale(fcross(q[:3], v), 2)
    return fadd(v, fadd(fscale(t, q[3]), fcross(q[:3], t)))


def binary_twist(a, b):
    ax, ay, az, aw = [-a[0], -a[1], -a[2], a[3]]
    bx, by, bz, bw = b
    qz = ((bw*az+bx*ay)-by*ax)+bz*aw
    qw = ((bw*aw-bx*ax)-by*ay)-bz*az
    value = 2*math.atan2(qz, qw)
    return value-2*math.pi if value > math.pi else value+2*math.pi if value < -math.pi else value


def fraction(value):
    return Fraction.from_float(finite(value))


def rational_dot(a, b):
    return sum((x*y for x, y in zip(a, b)), Fraction(0))


def norm_inf(a):
    return max((sum(abs(x) for x in row) for row in a), default=Fraction(0))


def exact_inverse(a):
    """Independent rational Gauss-Jordan; first nonzero pivot, no native solver."""
    n = len(a)
    augmented = [list(row)+[Fraction(int(i == j)) for j in range(n)] for i, row in enumerate(a)]
    rank = 0
    for column in range(n):
        pivot = next((i for i in range(rank, n) if augmented[i][column]), None)
        if pivot is None:
            continue
        augmented[rank], augmented[pivot] = augmented[pivot], augmented[rank]
        divisor = augmented[rank][column]
        augmented[rank] = [x/divisor for x in augmented[rank]]
        for i in range(n):
            if i != rank:
                factor = augmented[i][column]
                augmented[i] = [x-factor*y for x, y in zip(augmented[i], augmented[rank])]
        rank += 1
    if rank != n:
        raise ReferenceSystemError(SYSTEM_MESSAGE)
    return [row[n:] for row in augmented], rank


def exact_pivot_safety(gram):
    # Safety is evaluated independently on exact decoded coefficients. Native
    # rounding safety and its reported pivots are separately checked as output.
    work = [row[:] for row in gram]
    threshold = Fraction.from_float(1e-12)*max(Fraction(1), norm_inf(gram))
    for column in range(len(work)):
        pivot = max(range(column, len(work)), key=lambda i: abs(work[i][column]))
        if abs(work[pivot][column]) <= threshold:
            raise ReferenceSystemError(SYSTEM_MESSAGE)
        work[column], work[pivot] = work[pivot], work[column]
        for i in range(column+1, len(work)):
            factor = work[i][column]/work[column][column]
            for j in range(column+1, len(work)):
                work[i][j] -= factor*work[column][j]
            work[i][column] = Fraction(0)


def decode_problem(problem):
    keys(problem, ("a", "b", "h", "y0", "stopKind", "stopRow"), LINEAR_MESSAGE)
    a = matrix(problem["a"], 11, 12, LINEAR_MESSAGE)
    b = array(problem["b"], 11, LINEAR_MESSAGE)
    h = array(problem["h"], 12, LINEAR_MESSAGE)
    y0 = array(problem["y0"], 12, LINEAR_MESSAGE)
    require(all(x > 0 for x in h), LINEAR_MESSAGE)
    require(problem["stopKind"] in ("none", "upper", "lower"), LINEAR_MESSAGE)
    stop = array(problem["stopRow"], 0 if problem["stopKind"] == "none" else 12, LINEAR_MESSAGE)
    if any(not math.isfinite(1/x) for x in h):
        raise ReferenceSystemError(SYSTEM_MESSAGE)
    return a, b, h, y0, stop


def exact_phase(a, b, h, y0):
    gram = [[sum((a[i][j]/h[j])*a[k][j] for j in range(12)) for k in range(len(a))] for i in range(len(a))]
    exact_pivot_safety(gram)
    inverse, rank = exact_inverse(gram)
    condition = norm_inf(gram)*norm_inf(inverse)
    if condition > 10**12:
        raise ReferenceSystemError(SYSTEM_MESSAGE)
    rhs = [b[i]-rational_dot(row, y0) for i, row in enumerate(a)]
    lam = [rational_dot(row, rhs) for row in inverse]
    y = [y0[j]+sum(a[i][j]*lam[i] for i in range(len(a)))/h[j] for j in range(12)]
    primal = [rational_dot(row, y)-target for row, target in zip(a, b)]
    stationarity = [h[j]*(y[j]-y0[j])-sum(a[i][j]*lam[i] for i in range(len(a))) for j in range(12)]
    return {"y": y, "lambda": lam, "rank": rank, "rowCount": len(a), "gram": gram,
            "inverse": inverse, "conditionInf": condition,
            "primalZero": all(x == 0 for x in primal), "stationarityZero": all(x == 0 for x in stationarity)}


def exact_model(problem):
    aa, bb, hh, xx, dd = decode_problem(problem)
    a = [[fraction(x) for x in row] for row in aa]
    b, h, y0, d = ([fraction(x) for x in values] for values in (bb, hh, xx, dd))
    identity = all(binary_dot(row, xx)-target == 0 for row, target in zip(aa, bb)) and (not dd or binary_dot(dd, xx) <= 0)
    equality = exact_phase(a, b, h, y0)
    active = bool(d) and rational_dot(d, equality["y"]) > 0
    selected = exact_phase(a+[d], b+[Fraction(0)], h, y0) if active else equality
    rate = rational_dot(d, selected["y"]) if d else Fraction(0)
    lam_stop = selected["lambda"][-1] if active else Fraction(0)
    kkt = (not d or rate <= 0) and lam_stop <= 0 and lam_stop*rate == 0
    objective = sum(h[j]*(selected["y"][j]-y0[j])**2 for j in range(12))/2
    return {**selected, "activeStop": active, "identity": identity, "stopKktPassed": kkt,
            "objectiveExact": objective, "equality": equality, "stopRateExact": rate,
            "solveAttempts": 0 if identity else 2 if active else 1}


def public_exact(model):
    return {"rank": model["rank"], "rowCount": model["rowCount"], "activeStop": model["activeStop"],
            "identity": model["identity"], "primalZero": model["primalZero"],
            "stationarityZero": model["stationarityZero"], "stopKktPassed": model["stopKktPassed"],
            "objectiveExact": model["objectiveExact"], "yExact": model["y"], "lambdaExact": model["lambda"],
            "conditionInfExact": model["conditionInf"], "stopRateExact": model["stopRateExact"]}


def output_certificate(problem, result):
    keys(result, ("y", "lambda", "activeStop", "identity", "solveAttempts", "phases", "objectiveDimensionless", "certificate"), CERT_MESSAGE)
    require(type(result["activeStop"]) is bool and type(result["identity"]) is bool, CERT_MESSAGE)
    active, identity = result["activeStop"], result["identity"]
    require(not active or problem["stopKind"] != "none", CERT_MESSAGE)
    count = 12 if active else 11
    y = [fraction(x) for x in array(result["y"], 12, CERT_MESSAGE)]
    lam = [fraction(x) for x in array(result["lambda"], count, CERT_MESSAGE)]
    a = [[fraction(x) for x in row] for row in problem["a"]]
    b = [fraction(x) for x in problem["b"]]
    h, y0, d = ([fraction(x) for x in values] for values in (problem["h"], problem["y0"], problem["stopRow"]))
    if active:
        a.append(d); b.append(Fraction(0))
    primal = max(abs(rational_dot(row, y)-target) for row, target in zip(a, b))
    stationarity = max(abs(h[j]*(y[j]-y0[j])-sum(a[i][j]*lam[i] for i in range(count))) for j in range(12))
    rate = rational_dot(d, y) if d else Fraction(0)
    stop_lam = lam[-1] if active else Fraction(0)
    objective = sum(h[j]*(y[j]-y0[j])**2 for j in range(12))/2
    objective_error = abs(objective-fraction(result["objectiveDimensionless"]))
    residuals = {"primal": primal, "stationarity": stationarity, "negativeMu": max(Fraction(0), stop_lam),
                 "complementarity": abs(stop_lam*rate), "objective": objective_error}
    keys(result["certificate"], residuals.keys(), CERT_MESSAGE)
    recorded = {key: fraction(finite(result["certificate"][key], CERT_MESSAGE)) for key in residuals}
    require(type(result["solveAttempts"]) is int and result["solveAttempts"] == (0 if identity else 2 if active else 1), CERT_MESSAGE)
    require(isinstance(result["phases"], list) and len(result["phases"]) == result["solveAttempts"], CERT_MESSAGE)
    phase_pass = True
    for index, phase in enumerate(result["phases"]):
        n = 11 if index == 0 else 12
        keys(phase, ("rowIds", "rowCount", "pivots", "inverse", "normInf", "conditionInf", "lambda", "y", "residuals"), CERT_MESSAGE)
        require(type(phase["rowCount"]) is int and phase["rowCount"] == n and phase["rowIds"] == list(range(n)) and
                all(type(x) is int for x in phase["rowIds"]), CERT_MESSAGE)
        pivots = array(phase["pivots"], n, CERT_MESSAGE)
        inv = [[fraction(x) for x in row] for row in matrix(phase["inverse"], n, n, CERT_MESSAGE)]
        plam = [fraction(x) for x in array(phase["lambda"], n, CERT_MESSAGE)]
        py = [fraction(x) for x in array(phase["y"], 12, CERT_MESSAGE)]
        aa = a[:11]+([d] if n == 12 else [])
        bb = b[:11]+([Fraction(0)] if n == 12 else [])
        gram = [[sum(aa[i][j]/h[j]*aa[k][j] for j in range(12)) for k in range(n)] for i in range(n)]
        rhs = [bb[i]-rational_dot(aa[i], y0) for i in range(n)]
        lin = max(abs(rational_dot(row, plam)-rhs[i]) for i, row in enumerate(gram))
        inverse_error = max(sum(abs(sum(gram[i][k]*inv[k][j] for k in range(n))-int(i == j)) for j in range(n)) for i in range(n))
        keys(phase["residuals"], ("linear", "inverse"), CERT_MESSAGE)
        recorded_linear = fraction(finite(phase["residuals"]["linear"], CERT_MESSAGE))
        recorded_inverse = fraction(finite(phase["residuals"]["inverse"], CERT_MESSAGE))
        native_norm = fraction(finite(phase["normInf"], CERT_MESSAGE))
        native_condition = fraction(finite(phase["conditionInf"], CERT_MESSAGE))
        norm_error = abs(native_norm-norm_inf(gram))
        condition_error = abs(native_condition-norm_inf(gram)*norm_inf(inv))
        py_error = max(abs(py[j]-y0[j]-sum(aa[i][j]*plam[i] for i in range(n))/h[j]) for j in range(12))
        phase_pass = phase_pass and lin <= NUMERIC_GATE and inverse_error <= NUMERIC_GATE and py_error <= NUMERIC_GATE and \
            abs(recorded_linear-lin) <= NUMERIC_GATE and abs(recorded_inverse-inverse_error) <= NUMERIC_GATE and \
            all(recorded_value >= 0 for recorded_value in (recorded_linear, recorded_inverse)) and \
            norm_error <= Fraction.from_float(1e-12)*max(1, norm_inf(gram)) and \
            condition_error <= Fraction.from_float(1e-12)*max(1, norm_inf(gram)*norm_inf(inv)) and native_condition <= 10**12 and \
            all(abs(fraction(x)) > Fraction.from_float(1e-12)*max(1, native_norm) for x in pivots)
        if index == len(result["phases"])-1:
            phase_pass = phase_pass and py == y and plam == lam
    if identity:
        phase_pass = phase_pass and all(x == 0 for x in lam) and result["activeStop"] is False
    passed = phase_pass and all(0 <= x <= NUMERIC_GATE for x in residuals.values()) and \
        all(0 <= recorded[key] <= NUMERIC_GATE and abs(recorded[key]-value) <= NUMERIC_GATE for key, value in residuals.items()) and \
        (not d or rate <= NUMERIC_GATE) and objective >= 0
    return {"passed": passed, "residuals": residuals, "rate": rate, "objective": objective,
            "y": y, "lambda": lam, "phasePassed": phase_pass}


def build_rows(before, posed, origin, target):
    # Only original before values and independently derived/validated poses.
    x0 = [float(x) for body in before for field in ("v", "w") for x in body[field]]
    center = fscale(fadd(list(map(float, before[0]["p"])), list(map(float, before[1]["p"]))), .5)
    native_origin = list(map(float, origin))
    momentum = [0.0]*3; orbital = [0.0]*3; spin = [0.0]*3
    for body in before:
        momentum = fadd(momentum, fscale(list(map(float, body["v"])), 1))
        orbital = fadd(orbital, fscale(fcross(fsub(list(map(float, body["p"])), native_origin), list(map(float, body["v"]))), 1))
        spin = fadd(spin, fscale(list(map(float, body["w"])), INERTIA))
    shifted = fsub(fadd(orbital, spin), fcross(fsub(center, native_origin), momentum))
    a = [[0.0]*12 for _ in range(11)]
    arms = [frotate(list(map(float, body["q"])), [.1 if i == 0 else -.1, 0, 0]) for i, body in enumerate(posed)]
    cross_matrix = lambda v: [[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]]
    for body_index in range(2):
        base = body_index*6
        lever = cross_matrix(fsub(list(map(float, posed[body_index]["p"])), center))
        arm = cross_matrix(arms[body_index])
        sign = 1 if body_index == 0 else -1
        for i in range(3):
            a[i][base+i] = 1
            a[3+i][base+3+i] = INERTIA
            a[6+i][base+i] = sign
            for j in range(3):
                a[3+i][base+j] = lever[i][j]
                a[6+i][base+3+j] = -sign*arm[i][j]
    for i in range(2):
        a[9+i][3+i] = -1; a[9+i][9+i] = 1
    kind = "upper" if target == .8 else "lower" if target == -.8 else "none"
    stop = [] if kind == "none" else [0.0]*12
    if stop:
        sign = 1 if kind == "upper" else -1
        stop[5], stop[11] = -sign, sign
    h = [1, 1, 1, INERTIA, INERTIA, INERTIA]*2
    scales = [1, 1, 1, 10, 10, 10]*2
    divisors = [1]*3+[.1]*3+[1]*3+[10]*2
    b = momentum+shifted+[0]*5
    ad = [[(x*scales[j])/divisors[i] for j, x in enumerate(row)] for i, row in enumerate(a)]
    hd = [(x*scales[j])*scales[j]/1 for j, x in enumerate(h)]
    dd = [(x*scales[j])/10 for j, x in enumerate(stop)]
    problem = {"a": ad, "b": [x/divisors[i] for i, x in enumerate(b)], "h": hd,
               "y0": [x/scales[j] for j, x in enumerate(x0)], "stopKind": kind, "stopRow": dd}
    ra = tuple(Decimal.from_float(x) for x in arms[0]); rb = tuple(Decimal.from_float(x) for x in arms[1])
    gap_lever = OLD.subtract(ra, rb)
    d = OLD.subtract(posed[1]["p"], posed[0]["p"])
    margin = 2*Decimal.from_float(INERTIA)-OLD.magnitude(gap_lever)*OLD.magnitude(OLD.subtract(d, gap_lever))
    return problem, {"dofOrder": DOF[:], "rowIds": ROWS[:], "physicalA": a, "physicalB": b, "physicalH": h,
        "physicalX0": x0, "columnScales": scales, "rowDivisors": divisors, "dimensionlessA": ad,
        "dimensionlessB": problem["b"], "dimensionlessH": hd, "dimensionlessX0": problem["y0"],
        "centerOfMassOriginM": center, "originalOriginM": native_origin, "stopKind": kind,
        "physicalStopRow": stop, "dimensionlessStopRow": dd, "rankSufficientMarginKgM2": margin}


def observed(bodies, report, origin, limits):
    result = POSE.observe(bodies, report, origin, limits)
    inertia = Decimal.from_float(INERTIA)
    for mode in ("raw", "normalized"):
        poses = [{**body, "q": tuple(x/OLD.magnitude(body["q"]) for x in body["q"]) if mode == "normalized" else body["q"]} for body in bodies]
        arms = [OLD.polynomial_rotation(body["q"], (OLD.RADIUS if i == 0 else -OLD.RADIUS, Z, Z)) for i, body in enumerate(poses)]
        velocities = [OLD.add(body["v"], OLD.cross(body["w"], arm)) for body, arm in zip(poses, arms)]
        measurement = result[mode]
        measurement["geometricInertiaKgM2"] = measurement["inertiaKgM2"]
        measurement["geometricAngularMomentumVectorKgM2ps"] = measurement["angularMomentumVectorKgM2ps"]
        measurement["geometricEnergyJ"] = measurement["energyJ"]
        spin = OLD.scale(OLD.add(bodies[0]["w"], bodies[1]["w"]), inertia)
        measurement["spinAngularMomentumVectorKgM2ps"] = spin
        measurement["angularMomentumVectorKgM2ps"] = OLD.add(measurement["orbitalAngularMomentumVectorKgM2ps"], spin)
        measurement["angularMomentumKgM2ps"] = OLD.magnitude(measurement["angularMomentumVectorKgM2ps"])
        measurement["energyJ"] = sum((OLD.dot(body["v"], body["v"])+inertia*OLD.dot(body["w"], body["w"])) / 2 for body in bodies)
        measurement.update(anchorVelocityAMps=velocities[0], anchorVelocityBMps=velocities[1],
            anchorRelativeVelocityMps=OLD.subtract(velocities[0], velocities[1]),
            relativeAngularVelocityRadps=OLD.subtract(bodies[1]["w"], bodies[0]["w"]))
    return result


def norm_error(a, b):
    return OLD.magnitude(tuple(x-y for x, y in zip(a, b)))


def coefficient_error(a, b):
    if isinstance(b, (tuple, list)):
        require(isinstance(a, list) and len(a) == len(b))
        return max((coefficient_error(x, y) for x, y in zip(a, b)), default=0.0)
    return abs(finite(a)-finite(b))/max(1, abs(finite(b)))


def measurement_error(recorded, expected):
    require(isinstance(recorded, dict))
    scalar = ("relativeAngleRad", "anchorGapM", "axisDeviationRad", "quaternionNormError", "limitExcessRad", "energyJ")
    vectors = ("anchorAM", "anchorBM", "centerOfMassM", "linearMomentumVectorKgMps", "orbitalAngularMomentumVectorKgM2ps",
               "spinAngularMomentumVectorKgM2ps", "angularMomentumVectorKgM2ps", "anchorVelocityAMps", "anchorVelocityBMps",
               "anchorRelativeVelocityMps", "relativeAngularVelocityRadps")
    keys(recorded, scalar+vectors)
    return max(*(abs(Decimal.from_float(finite(recorded[key]))-POSE.decimal_value(expected[key])) for key in scalar),
               *(norm_error(OLD.vector(recorded[key]), expected[key]) for key in vectors))


def at_precision(request, precision):
    with localcontext() as context:
        context.prec = precision
        clean_request = copy.deepcopy(request)
        if "beforeRawHex" in request:
            require(isinstance(clean_request.get("state"),dict))
            clean_request["state"]["bodies"] = restore_checked(clean_request["state"].get("bodies"),request["beforeRawHex"])
            del clean_request["beforeRawHex"]
        config, state = POSE.carrier(clean_request)
        finite_tree(config); finite_tree(state)
        require(set(config) <= {"bodies","joints","fixedStepSeconds","gravityMps2"} and
                isinstance(config.get("bodies"),list) and all(isinstance(body,dict) and "inertiaKgM2" not in body for body in config["bodies"]))
        bodies, report, origin, limits = OLD.decode({"config": config, "state": state, "dt": request["dt"]})
        require(all(abs(x) <= bound for body in bodies for field, bound in (("p",10000),("v",1000),("w",1000),("q",1)) for x in body[field]) and
                all(abs(OLD.magnitude(body["q"])-O) <= Decimal("1e-9") for body in bodies))
        theta = binary_twist(list(map(float, bodies[0]["q"])), list(map(float, bodies[1]["q"])))
        posed, target, angle_corrections = POSE.law(bodies, {"relativeAngleRad": theta}, limits)
        problem, projection = build_rows(bodies, posed, origin, target)
        exact = exact_model(problem)
        expected_velocity = [float(x)*projection["columnScales"][j] for j, x in enumerate(exact["y"])]
        if exact["identity"]:
            expected_velocity = projection["physicalX0"][:]
        expected = [{**body, "v": tuple(Decimal.from_float(x) for x in expected_velocity[i*6:i*6+3]),
                     "w": tuple(Decimal.from_float(x) for x in expected_velocity[i*6+3:i*6+6])} for i, body in enumerate(posed)]
        final_angle = OLD.scalar_angle(OLD.quaternion_product(posed[1]["q"], tuple(-x for x in posed[0]["q"][:3])+(posed[0]["q"][3],)))
        wanted_pose = {"jointId": config["joints"][0]["id"], "finalAngleRad": final_angle, "targetAngleRad": target}
        before = observed(bodies, report, origin, limits)
        after = observed(expected, Decimal.from_float(final_angle), origin, limits)
        actual, actual_records, actual_frame, actual_cert = expected, POSE.body_records(state["bodies"], expected), None, None
        metrics = {"coefficientAgreementFailed": False, "inertiaBitsAgree": True, "branchAgreement": True,
                   "actualFrameVelocityError": Z, "actualFrameLinearVelocityErrorMps":Z,"actualFrameAngularVelocityErrorRadps":Z,
                   "actualFrameCertificatePassed": True, "changedComponentsAgree": True,
                   "identityBitsPreserved": True, "diagnosticMeasurementError": Z, "diagnosticCorrectionError": Z,
                   "objectiveErrorJ": Z, "actualNativeCertificatePassed": True, "expectedTargetErrorRad": 0.0,
                   "objectiveMeasurementErrorJ":Z,"expectedFinalAngleErrorRad": 0.0, "sourceCursorRetained": True}
        projection["objectiveJ"] = exact["objectiveExact"]
        projection["physicalLambda"] = [float(x)/projection["rowDivisors"][i] if i < 11 else float(x)/10 for i, x in enumerate(exact["lambda"])]
        if exact["activeStop"]:
            projection["rowIds"] += ["stop."+problem["stopKind"]]
        output = request.get("output")
        if "output" in request:
            keys(output, ("bodies", "poseReport", "diagnostics"))
            finite_tree(output)
            keys(output["poseReport"], wanted_pose.keys())
            require(output["poseReport"]["jointId"] == wanted_pose["jointId"])
            actual_report = finite(output["poseReport"]["finalAngleRad"])
            actual_target = finite(output["poseReport"]["targetAngleRad"])
            actual_records = copy.deepcopy(output["bodies"])
            if "afterRawHex" in request:
                actual_records = restore_checked(actual_records, request["afterRawHex"])
            actual_state = {**state, "bodies": actual_records, "joints": [{**state["joints"][0], "angleRad": actual_report}]}
            actual, _, _, _ = OLD.decode({"config": config, "state": actual_state, "dt": request["dt"]})
            after = observed(actual, Decimal.from_float(actual_report), origin, limits)
            metrics["expectedTargetErrorRad"], metrics["expectedFinalAngleErrorRad"] = abs(actual_target-target), abs(actual_report-final_angle)
            diag = output["diagnostics"]
            keys(diag, ("poseStage", "before", "after", "velocityCorrections", "projection", "changedComponents", "identityVelocityBitsPreserved", "poseLawEvaluations", "sourceStepIndex", "sourceTimeSeconds"))
            require(type(diag["poseLawEvaluations"]) is int and type(diag["sourceStepIndex"]) is int and type(diag["identityVelocityBitsPreserved"]) is bool)
            metrics["sourceCursorRetained"] = diag["poseLawEvaluations"] == 1 and diag["sourceStepIndex"] == state["stepIndex"] and finite(diag["sourceTimeSeconds"]) == state["timeSeconds"]
            metrics["diagnosticMeasurementError"] = max(measurement_error(diag["before"], before["raw"]), measurement_error(diag["after"], after["raw"]))
            pr = diag["projection"]
            keys(pr, tuple(projection.keys())+("result",))
            for key in ("physicalA","physicalB","physicalH","physicalX0","columnScales","rowDivisors","dimensionlessA","dimensionlessB","dimensionlessH","dimensionlessX0","centerOfMassOriginM","originalOriginM","physicalStopRow","dimensionlessStopRow"):
                metrics["coefficientAgreementFailed"] |= coefficient_error(pr[key], projection[key]) > 1e-12
            metrics["coefficientAgreementFailed"] |= pr["dofOrder"] != DOF or pr["rowIds"] != projection["rowIds"] or pr["stopKind"] != problem["stopKind"]
            metrics["inertiaBitsAgree"] = all(struct.pack("<d",finite(pr["physicalH"][j])) == struct.pack("<d",INERTIA) for j in (3,4,5,9,10,11)) and \
                all("inertiaKgM2" in body and struct.pack("<d",finite(body["inertiaKgM2"])) == struct.pack("<d",INERTIA) for body in actual_records)
            metrics["objectiveErrorJ"] = abs(Decimal.from_float(finite(pr["objectiveJ"]))-Decimal(exact["objectiveExact"].numerator)/Decimal(exact["objectiveExact"].denominator))
            require(isinstance(pr["result"], dict))
            if type(pr["result"].get("activeStop")) is not bool or type(pr["result"].get("identity")) is not bool:
                raise ReferenceInputError(INPUT_MESSAGE)
            metrics["branchAgreement"] = pr["result"]["activeStop"] == exact["activeStop"] and pr["result"]["identity"] == exact["identity"]
            actual_problem, actual_projection = build_rows(bodies, actual, origin, target)
            actual_frame = exact_model(actual_problem)
            actual_cert = output_certificate(actual_problem, pr["result"])
            metrics["branchAgreement"] &= pr["result"]["activeStop"] == actual_frame["activeStop"] and pr["result"]["identity"] == actual_frame["identity"]
            metrics["actualNativeCertificatePassed"] = actual_cert["passed"]
            metrics["actualFrameCertificatePassed"] = actual_frame["primalZero"] and actual_frame["stationarityZero"] and actual_frame["stopKktPassed"]
            flat = [x for body in actual for field in ("v", "w") for x in body[field]]
            metrics["actualFrameVelocityError"] = max(abs(x-Decimal(actual_frame["y"][j].numerator)/Decimal(actual_frame["y"][j].denominator)*Decimal(projection["columnScales"][j])) for j, x in enumerate(flat))
            frame_errors = [abs(x-Decimal(actual_frame["y"][j].numerator)/Decimal(actual_frame["y"][j].denominator)*Decimal(projection["columnScales"][j])) for j,x in enumerate(flat)]
            metrics["actualFrameLinearVelocityErrorMps"] = max(x for j,x in enumerate(frame_errors) if j%6 < 3)
            metrics["actualFrameAngularVelocityErrorRadps"] = max(x for j,x in enumerate(frame_errors) if j%6 >= 3)
            metrics["diagnosticCorrectionError"] = coefficient_error(pr["physicalLambda"], [float(x)/projection["rowDivisors"][i] if i < 11 else float(x)/10 for i, x in enumerate(pr["result"]["lambda"])])
            metrics["diagnosticCorrectionError"] = max(Decimal.from_float(metrics["diagnosticCorrectionError"]), abs(Decimal.from_float(finite(pr["rankSufficientMarginKgM2"]))-actual_projection["rankSufficientMarginKgM2"]))
            corr = diag["velocityCorrections"]
            keys(corr, ("linearMps", "angularRadps"))
            for key, field in (("linearMps", "v"), ("angularRadps", "w")):
                require(isinstance(corr[key], list) and len(corr[key]) == 2)
                metrics["diagnosticCorrectionError"] = max(metrics["diagnosticCorrectionError"], *(norm_error(OLD.vector(v), OLD.subtract(b[field], a[field])) for v, a, b in zip(corr[key], bodies, actual)))
            require(isinstance(diag["changedComponents"], list) and len(diag["changedComponents"]) == 2)
            changes = []
            for i in range(2):
                require(isinstance(diag["changedComponents"][i], list) and len(diag["changedComponents"][i]) == 6 and all(type(x) is bool for x in diag["changedComponents"][i]))
                changes.append([struct.pack("<d",finite(old)) != struct.pack("<d",finite(new)) for field in ("velocityMps","angularVelocityRadps") for old,new in zip(state["bodies"][i][field],actual_records[i][field])])
            metrics["changedComponentsAgree"] = changes == diag["changedComponents"]
            metrics["identityBitsPreserved"] = (not exact["identity"] or not any(any(row) for row in changes)) and diag["identityVelocityBitsPreserved"] == (exact["identity"] and not any(any(row) for row in changes))
            # Historical pose-stage diagnostics are an independently checked
            # intermediate with unchanged original v/w, never the final observer.
            stage = diag["poseStage"]
            keys(stage, ("before","after","targetAngleRad","angleCorrectionsRad","translationCorrectionsM","sourceStepIndex","sourceTimeSeconds","velocityBitsUnchanged","angularVelocityBitsUnchanged","lawEvaluations"))
            require(type(stage["lawEvaluations"]) is int and type(stage["sourceStepIndex"]) is int and type(stage["velocityBitsUnchanged"]) is bool and type(stage["angularVelocityBitsUnchanged"]) is bool)
            metrics["sourceCursorRetained"] &= stage["lawEvaluations"] == 1 and stage["sourceStepIndex"] == state["stepIndex"] and finite(stage["sourceTimeSeconds"]) == state["timeSeconds"] and stage["velocityBitsUnchanged"] and stage["angularVelocityBitsUnchanged"]
            require(isinstance(stage["angleCorrectionsRad"], list) and len(stage["angleCorrectionsRad"]) == 2 and isinstance(stage["translationCorrectionsM"], list) and len(stage["translationCorrectionsM"]) == 2)
            metrics["diagnosticCorrectionError"] = max(metrics["diagnosticCorrectionError"], abs(Decimal.from_float(finite(stage["targetAngleRad"]))-Decimal.from_float(target)),
                *(abs(Decimal.from_float(finite(x))-y) for x,y in zip(stage["angleCorrectionsRad"],angle_corrections)),
                *(norm_error(OLD.vector(x),OLD.subtract(b["p"],a["p"])) for x,a,b in zip(stage["translationCorrectionsM"],bodies,posed)))
            pose_before = observed(bodies, report, origin, limits)["raw"]
            pose_after = observed(posed, Decimal.from_float(final_angle), origin, limits)["raw"]
            for recorded, wanted in ((stage["before"],pose_before),(stage["after"],pose_after)):
                require(isinstance(recorded, dict))
                base = {key:value for key,value in wanted.items() if key in diag["before"] and key not in ("anchorVelocityAMps","anchorVelocityBMps","anchorRelativeVelocityMps","relativeAngularVelocityRadps")}
                keys(recorded, base.keys())
                for key,value in base.items():
                    err = norm_error(OLD.vector(recorded[key]),value) if isinstance(value,tuple) else abs(Decimal.from_float(finite(recorded[key]))-POSE.decimal_value(value))
                    metrics["diagnosticMeasurementError"] = max(metrics["diagnosticMeasurementError"],err)
        metrics["expectedPositionErrorM"] = max(norm_error(a["p"],b["p"]) for a,b in zip(actual,posed))
        metrics["expectedQuaternionError"] = max(norm_error(a["q"],b["q"]) for a,b in zip(actual,posed))
        metrics["expectedLinearVelocityErrorMps"] = max(abs(x-y) for a,b in zip(actual,expected) for x,y in zip(a["v"],b["v"]))
        metrics["expectedAngularVelocityErrorRadps"] = max(abs(x-y) for a,b in zip(actual,expected) for x,y in zip(a["w"],b["w"]))
        metrics["rawNormalizedGeometryDifference"] = max(abs(observation["raw"][field]-observation["normalized"][field]) for observation in (before,after) for field in ("anchorGapM","relativeAngleRad","axisDeviationRad","limitExcessRad","reportedAngleDifferenceRad"))
        objective_decimal = sum(Decimal.from_float(INERTIA if field == "w" else 1)*OLD.dot(OLD.subtract(a[field],b[field]),OLD.subtract(a[field],b[field]))/2
                                for a,b in zip(actual,bodies) for field in ("v","w"))
        if "output" in request:
            metrics["objectiveMeasurementErrorJ"] = abs(Decimal.from_float(finite(output["diagnostics"]["projection"]["objectiveJ"]))-objective_decimal)
        energy_difference = {mode:{"nativeJ":after[mode]["energyJ"]-before[mode]["energyJ"],
                                  "geometricJ":after[mode]["geometricEnergyJ"]-before[mode]["geometricEnergyJ"]}
                             for mode in ("raw","normalized")}
        for mode in ("raw", "normalized"):
            for field, key in (("ComChangeM","centerOfMassM"),("LinearMomentumChangeKgMps","linearMomentumVectorKgMps"),("AngularMomentumChangeKgM2ps","angularMomentumVectorKgM2ps"),("GeometricAngularMomentumChangeKgM2ps","geometricAngularMomentumVectorKgM2ps")):
                metrics[mode+field] = norm_error(before[mode][key],after[mode][key])
        return {"metrics":metrics,"before":before,"after":after,"expectedBodies":POSE.body_records(state["bodies"],expected),
                "expectedVelocity":expected_velocity,"poseReport":wanted_pose,"projection":projection,"problem":problem,
                "exact":public_exact(exact),"actualFrame":public_exact(actual_frame) if actual_frame else None,
                "actualCertificate":actual_cert,"geometricInertiaKgM2":OLD.TWO/Decimal(5)*OLD.MASS*OLD.RADIUS*OLD.RADIUS,
                "nativeInertiaKgM2":[INERTIA,INERTIA],"actualRecords":actual_records,
                "objectiveDecimalJ":objective_decimal,"energyDifferenceJ":energy_difference}


def public(value):
    if isinstance(value, Fraction):
        return [str(value.numerator), str(value.denominator)]
    if isinstance(value, Decimal):
        return finite(float(value))
    if isinstance(value, dict):
        return {key: public(item) for key,item in value.items()}
    if isinstance(value, (list, tuple)):
        return [public(item) for item in value]
    if type(value) is float:
        finite(value)
    return value


def evaluate_physical(request):
    low, high = at_precision(request,80), at_precision(request,120)
    with localcontext() as context:
        context.prec = 120
        precision = POSE.numeric_difference(low,high)
    scalar = max(abs(low[phase][mode][field]-high[phase][mode][field]) for phase in ("before","after") for mode in ("raw","normalized") for field in ("relativeAngleRad","axisDeviationRad","reportedAngleDifferenceRad","limitExcessRad"))
    resolved = precision <= Decimal("1e-25") and scalar <= 1e-12 and low["problem"] == high["problem"] and low["exact"] == high["exact"]
    metrics = high["metrics"]
    violations = []
    if not resolved:
        violations.append("independent reference precision or binary model is unresolved")
    for field,gate in (("expectedPositionErrorM",1e-12),("expectedQuaternionError",1e-12),("expectedLinearVelocityErrorMps",1e-10),("expectedAngularVelocityErrorRadps",1e-9),("actualFrameLinearVelocityErrorMps",1e-10),("actualFrameAngularVelocityErrorRadps",1e-9),("objectiveErrorJ",1e-10),("objectiveMeasurementErrorJ",1e-10),("diagnosticMeasurementError",1e-12),("diagnosticCorrectionError",1e-12),("rawNormalizedGeometryDifference",1e-12),("expectedTargetErrorRad",1e-9),("expectedFinalAngleErrorRad",1e-9)):
        if metrics[field] > Decimal.from_float(gate):
            violations.append(field+" exceeds frozen agreement gate")
    for field in ("inertiaBitsAgree","branchAgreement","actualFrameCertificatePassed","actualNativeCertificatePassed","changedComponentsAgree","identityBitsPreserved","sourceCursorRetained"):
        if not metrics[field]:
            violations.append(field+" is false")
    if metrics["coefficientAgreementFailed"]:
        violations.append("independent coefficient agreement exceeds 1e-12 relative scale")
    for mode in ("raw","normalized"):
        observation = high["after"][mode]
        for field in ("anchorGapM","quaternionNormError"):
            if observation[field] > Decimal.from_float(1e-9):
                violations.append(mode+" "+field+" exceeds 1e-9")
        if observation["limitExcessRad"] > 1e-9 or abs(observation["reportedAngleDifferenceRad"]) > 1e-9 or observation["axisDeviationRad"] > math.pi/180:
            violations.append(mode+" pose angle/report/axis gate failed")
        for field,gate in (("ComChangeM",1e-12),("LinearMomentumChangeKgMps",1e-7),("AngularMomentumChangeKgM2ps",1e-7),("GeometricAngularMomentumChangeKgM2ps",1e-7)):
            if metrics[mode+field] > Decimal.from_float(gate):
                violations.append(mode+field+" exceeds frozen physical gate")
        if OLD.magnitude(observation["anchorRelativeVelocityMps"]) > Decimal.from_float(1e-9):
            violations.append(mode+" anchor relative velocity exceeds 1e-9 m/s")
        if OLD.magnitude(observation["relativeAngularVelocityRadps"][:2]) > Decimal.from_float(1e-9):
            violations.append(mode+" transverse rate exceeds 1e-9 rad/s")
        kind = high["problem"]["stopKind"]
        rate = observation["relativeAngularVelocityRadps"][2]*(1 if kind == "upper" else -1)
        if kind != "none" and rate > Decimal.from_float(1e-9):
            violations.append(mode+" eligible outward rate exceeds 1e-9 rad/s")
        if observation["energyJ"] < 0 or observation["geometricEnergyJ"] < 0:
            violations.append(mode+" energy is negative")
    for body in high["actualRecords"]:
        for field,bound in (("positionM",10000),("velocityMps",1000),("angularVelocityRadps",1000),("orientation",1)):
            # No-output predictions have internally authored Decimal records;
            # serialize those here without broadening external finite admission.
            if any(abs(finite(public(x))) > bound for x in body[field]):
                violations.append("actual output exceeds original "+field+" bounds")
    wanted = {key:high[key] for key in ("before","after","expectedBodies","expectedVelocity","poseReport","projection","geometricInertiaKgM2","nativeInertiaKgM2","objectiveDecimalJ","energyDifferenceJ")}
    # objectiveJ is a numeric physical quantity, whereas its exact rational
    # representation is separately retained in certificate.objectiveExact.
    wanted["projection"] = {**wanted["projection"],"objectiveJ":float(high["projection"]["objectiveJ"])}
    return {"ok":resolved and not violations,"resolved":resolved,"executionFailure":False,
            "metrics":public({**metrics,"precisionMaxDifference":precision,"scalarRepeatMaxDifferenceRad":scalar}),
            "violations":violations,"reference":public(wanted),
            "certificate":public({"expected":high["exact"],"actualFrame":high["actualFrame"],"actualOutput":high["actualCertificate"]}),
            "transcendentals":"separate binary scalar atan2/sin/cos; Fraction and Decimal do not certify transcendental accuracy",
            "zeroAuthority":"raw13 binary buffers; JSON alone cannot preserve signed-zero evidence"}


def evaluate_linear(request):
    require(isinstance(request,dict) and set(request) <= {"op","problem","result"} and "problem" in request)
    model = exact_model(request["problem"])
    violations = []
    actual = None
    if "result" in request:
        actual = output_certificate(request["problem"],request["result"])
        result = request["result"]
        if result["activeStop"] != model["activeStop"] or result["identity"] != model["identity"]:
            violations.append("linear branch differs from exact reference")
        if not actual["passed"]:
            violations.append("linear output certificate failed")
        if max(abs(x-y) for x,y in zip(actual["y"],model["y"])) > NUMERIC_GATE:
            violations.append("linear optimum differs from exact reference")
    return {"ok":not violations,"resolved":True,"executionFailure":False,
            "metrics":{"precisionMaxDifference":0,"scalarRepeatMaxDifferenceRad":0},"violations":violations,
            "reference":{"expectedY":[finite(float(x)) for x in model["y"]],"expectedLambda":[finite(float(x)) for x in model["lambda"]]},
            "certificate":public({"expected":public_exact(model),"actualOutput":actual})}


def evaluate(request):
    require(isinstance(request,dict))
    if request.get("op") == "linear":
        return evaluate_linear(request)
    require(set(request) <= {"config","state","dt","beforeRawHex","output","afterRawHex"} and
            all(key in request for key in ("config","state","dt")) and ("afterRawHex" not in request or "output" in request))
    return evaluate_physical(request)


def main():
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            result = evaluate(json.loads(line))
        except (ReferenceInputError,POSE.ReferenceInputError,OLD.ReferenceInputError,json.JSONDecodeError) as error:
            result = {"ok":False,"resolved":False,"executionFailure":True,"code":"REFERENCE_INPUT","message":str(error)}
        except ReferenceSystemError as error:
            result = {"ok":False,"resolved":True,"executionFailure":False,"code":"REFERENCE_SYSTEM","message":str(error),"violations":[str(error)]}
        print(json.dumps(result,allow_nan=False,separators=(",",":")),flush=True)


if __name__ == "__main__":
    main()
