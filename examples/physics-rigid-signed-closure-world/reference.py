#!/usr/bin/env python3
"""Independent live-choice and point-ledger observations; JSON lines only.

Adopted Fraction/SAT/coverage references are imported unchanged. No producer,
World, closure model or impulse solver is imported or executed by this module.
Scalar sin/cos are binary seeds, not high-precision transcendental certificates.
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
PARENT_PATH = Path(__file__).resolve().parent.parent / "physics-rigid-signed-separation-reference" / "reference.py"
SPEC = importlib.util.spec_from_file_location("adopted_signed_reference_1344", PARENT_PATH)
PARENT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PARENT)
Z, O = Decimal(0), Decimal(1)
MESSAGE = "live signed world reference request is invalid"
JSON_MESSAGE = "live signed world reference line must be valid JSON"
GEOMETRY_GATE = 1e-12
PRECISION_GATE = Decimal("1e-25")
BODY_FIELDS = (("positionM",3),("velocityMps",3),("orientation",4),("angularVelocityRadps",3))
SELECTION_KEYS = ("normal","boundM","candidateIndex","pointM","rawAxisLength","label","feature")


class ProtocolError(ValueError):
    pass


def need(value):
    if not value:
        raise ProtocolError(MESSAGE)


def number(value):
    need(type(value) in (int,float))
    try:
        result = float(value)
    except OverflowError:
        raise ProtocolError(MESSAGE) from None
    need(math.isfinite(result))
    return result


def dec(value):
    return Decimal.from_float(number(value))


def exact_keys(value, names):
    need(type(value) is dict and set(value) == set(names))


def vector(value, size=3):
    need(type(value) is list and len(value) == size)
    return tuple(dec(x) for x in value)


def tree(value):
    if type(value) in (int,float):
        number(value)
    elif type(value) is dict:
        for item in value.values():
            tree(item)
    elif type(value) is list:
        for item in value:
            tree(item)
    else:
        need(type(value) in (bool,str))


def integer(value, lower=0):
    need(type(value) is int and value >= lower)
    return value


def add(a,b):
    return tuple(x+y for x,y in zip(a,b))


def sub(a,b):
    return tuple(x-y for x,y in zip(a,b))


def scale(a,s):
    return tuple(x*s for x in a)


def dot(a,b):
    return sum((x*y for x,y in zip(a,b)),Z)


def norm(a):
    return dot(a,a).sqrt()


def cross(a,b):
    return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])


def rotate(q,v):
    u,w = q[:3],q[3]
    t = scale(cross(u,v),Decimal(2))
    return add(v,add(scale(t,w),cross(u,t)))


def conjugate(q):
    return tuple(-x for x in q[:3])+(q[3],)


def normalized(q):
    return scale(q,O/norm(q))


def quat_product(a,b):
    xyz = add(add(scale(b[:3],a[3]),scale(a[:3],b[3])),cross(a[:3],b[:3]))
    return xyz+(a[3]*b[3]-dot(a[:3],b[:3]),)


def advance(q,w,dt):
    speed = math.hypot(*(float(x) for x in w))
    if speed == 0:
        return q
    half = speed*float(dt)/2
    factor = math.sin(half)/speed
    delta = tuple(Decimal.from_float(float(x)*factor) for x in w)+(Decimal.from_float(math.cos(half)),)
    result = quat_product(delta,q)
    return scale(result,O/norm(result))


def public(value):
    if isinstance(value,Decimal):
        return number(float(value))
    if type(value) is dict:
        return {key:public(item) for key,item in value.items()}
    if type(value) in (list,tuple):
        return [public(item) for item in value]
    if type(value) is float:
        number(value)
    return value


def raw_bodies(bodies, hexadecimal):
    need(type(bodies) is list and 1 <= len(bodies) <= 9 and all(type(b) is dict for b in bodies))
    need(type(hexadecimal) is str and len(hexadecimal) == len(bodies)*208 and all(c in "0123456789abcdefABCDEF" for c in hexadecimal))
    raw = bytes.fromhex(hexadecimal)
    values = struct.unpack("<"+str(len(bodies)*13)+"d",raw)
    result = copy.deepcopy(bodies);index = 0;ids = set()
    for b in result:
        tree(b)
        need(type(b.get("id")) is str and b["id"] and "\0" not in b["id"] and b["id"] not in ids)
        ids.add(b["id"])
        need(b.get("kind") in ("dynamic","static") and type(b.get("shape")) is dict and b["shape"].get("kind") == "box")
        half = vector(b["shape"].get("halfExtentsM"));need(all(Decimal(".0001") <= x <= 1000 for x in half))
        inverse_mass = number(b.get("inverseMass"))
        need(inverse_mass == 0 if b["kind"] == "static" else 1e-6 <= inverse_mass <= 1e6)
        if inverse_mass:
            inertia = vector(b.get("inertiaDiagonalKgM2"));need(all(x > 0 for x in inertia))
            local_inverse = vector(b.get("inverseInertiaLocal"));need(all(x > 0 for x in local_inverse))
        else:
            need(vector(b.get("inverseInertiaLocal")) == (Z,Z,Z))
        for field,size in BODY_FIELDS:
            need(type(b.get(field)) is list and len(b[field]) == size)
            for j in range(size):
                value = values[index];index += 1
                need(math.isfinite(value) and value == number(b[field][j]))
                b[field][j] = value
        need(abs(norm(vector(b["orientation"],4))-O) <= Decimal("1e-9"))
    return result,raw


def eligible(bodies):
    pairs = []
    for i in range(len(bodies)):
        for j in range(i+1,len(bodies)):
            if bodies[i]["inverseMass"] == bodies[j]["inverseMass"] == 0:
                continue
            a,b = (i,j) if bodies[i]["id"] < bodies[j]["id"] else (j,i)
            pairs.append((bodies[a]["id"]+"\0"+bodies[b]["id"],a,b))
    return sorted(pairs)


def compact_pair(a,b,pair_key):
    scalar = PARENT.fresh_query(a,b)
    geometry = PARENT.evaluate({"op":"pair","a":a,"b":b})
    need(geometry.get("resolved") is True and geometry.get("executionFailure") is False)
    return {"pairKey":pair_key,"rawDepthM":geometry["raw"]["depthM"],"normalizedDepthM":geometry["normalized"]["depthM"],
            "rawMarginM":geometry["raw"]["marginM"],"normalizedMarginM":geometry["normalized"]["marginM"],
            "precisionMaxDifferenceM":geometry["precisionMaxDifferenceM"],
            "rawNormalizedDepthDifferenceM":geometry["rawNormalizedDepthDifferenceM"],
            "rawNormalizedMarginDifferenceM":geometry["rawNormalizedMarginDifferenceM"],
            "selection":{key:copy.deepcopy(scalar[key]) for key in SELECTION_KEYS},
            "ties":copy.deepcopy(scalar["ambiguity"]),"scalar":scalar}


def selection_difference(actual,a,b,expected):
    exact_keys(actual,SELECTION_KEYS)
    integer(actual["candidateIndex"]);need(actual["candidateIndex"] < 15)
    need(type(actual["label"]) is str and type(actual["feature"]) is dict)
    feature = actual["feature"]
    if feature.get("kind") == "face-a":
        exact_keys(feature,("kind","axisA"));need(type(feature["axisA"]) is int and 0 <= feature["axisA"] < 3)
    elif feature.get("kind") == "face-b":
        exact_keys(feature,("kind","axisB"));need(type(feature["axisB"]) is int and 0 <= feature["axisB"] < 3)
    else:
        exact_keys(feature,("kind","axisA","axisB"));need(feature["kind"] == "edge-cross" and all(type(feature[key]) is int and 0 <= feature[key] < 3 for key in ("axisA","axisB")))
    scalar = expected["scalar"]
    candidate = scalar["candidates"][actual["candidateIndex"]]
    need(not candidate["skippedByOriginalCutoff"])
    vector(actual["normal"]);vector(actual["pointM"]);number(actual["boundM"]);number(actual["rawAxisLength"])
    # The observed index identifies the axis being checked, never an oracle
    # minimum. Independently require it within the fixed diagnostic min gate.
    difference = max(abs(number(actual["boundM"])-candidate["overlapM"]),abs(number(actual["rawAxisLength"])-candidate["rawAxisLength"]),
                     max(abs(number(x)-y) for x,y in zip(actual["normal"],candidate["orientedNormal"])),
                     max(0,candidate["overlapM"]-scalar["boundM"]))
    if actual["feature"] != candidate["feature"] or actual["label"] != candidate["label"]:
        difference = max(difference,1.0)
    normal = candidate["orientedNormal"]
    def support(body,direction):
        basis = [PARENT.rotate(body["orientation"],v) for v in ([1,0,0],[0,1,0],[0,0,1])]
        total = [0,0,0]
        for axis,half in zip(basis,body["shape"]["halfExtentsM"]):
            projection = PARENT.dot(axis,direction)
            offset = 0 if abs(projection) <= 1e-12 else half if projection > 0 else -half
            total = PARENT.add(total,PARENT.scale(axis,offset))
        return PARENT.add(body["positionM"],total)
    point = PARENT.scale(PARENT.add(support(a,normal),support(b,PARENT.scale(normal,-1))),.5)
    return max(difference,max(abs(number(x)-y) for x,y in zip(actual["pointM"],point)))


def compare_linear(problem,result,exact):
    """Reuse the already-computed exact optimum; do not solve it a second time."""
    names = ("ok","status","activeMask","active","lambdaKgM","translations","primalMarginsM","objectiveKgM2","certificate","gram","singularMasks","infeasibleMasks","enumeratedMasks","worldStepped")
    exact_keys(result,names);tree(result)
    need(result["ok"] is True and result["status"] == "SOLVED" and result["worldStepped"] is False)
    bodies,rows = PARENT.LINEAR.validate_problem(problem);n = len(rows)
    mask = integer(result["activeMask"]);need(mask < 2**n and result["active"] == [i for i in range(n) if mask & (1<<i)] and all(type(x) is int for x in result["active"]))
    need(type(result["translations"]) is list and len(result["translations"]) == len(bodies))
    translations = []
    for b,t in zip(bodies,result["translations"]):
        exact_keys(t,("id","u"));need(t["id"] == b["id"])
        u = tuple(Fraction.from_float(number(x)) for x in public(vector(t["u"])))
        need(b["inverseMass"] != 0 or all(x == 0 for x in u));translations.append(u)
    multipliers = tuple(Fraction.from_float(number(x)) for x in public(vector(result["lambdaKgM"],n)))
    vector(result["primalMarginsM"],n)
    need(type(result["gram"]) is list and len(result["gram"]) == n)
    for row in result["gram"]:
        vector(row,n)
    need(type(result["singularMasks"]) is list and all(type(x) is int and 0 <= x < 2**n for x in result["singularMasks"]) and result["singularMasks"] == sorted(set(result["singularMasks"])))
    integer(result["infeasibleMasks"]);integer(result["enumeratedMasks"])
    need(result["enumeratedMasks"] == 2**n and len(result["singularMasks"])+result["infeasibleMasks"] < 2**n)
    keys = ("primalViolationM","negativeMultiplierKgM","complementarityKgM2","stationarityKgM")
    exact_keys(result["certificate"],keys);need(all(number(result["certificate"][key]) >= 0 for key in keys))
    incidence = PARENT.LINEAR.signed_incidence(rows);zero = (Fraction(0),)*3
    margins = [sum((PARENT.LINEAR.dot(row.get(b["id"],zero),u) for b,u in zip(bodies,translations)),Fraction(0))-source["boundM"] for row,source in zip(incidence,rows)]
    objective = sum((PARENT.LINEAR.dot(u,u)/b["inverseMass"]/2 for b,u in zip(bodies,translations) if b["inverseMass"] > 0),Fraction(0))
    stationarity = max([Fraction(0)]+[abs(u[j]/b["inverseMass"]-sum((lam*row.get(b["id"],zero)[j] for lam,row in zip(multipliers,incidence)),Fraction(0))) for b,u in zip(bodies,translations) if b["inverseMass"] > 0 for j in range(3)])
    certificate_exact = {"primalViolationM":max([Fraction(0)]+[-x for x in margins]),"negativeMultiplierKgM":max([Fraction(0)]+[-x for x in multipliers]),
        "complementarityKgM2":max([Fraction(0)]+[abs(x*y) for x,y in zip(multipliers,margins)]),"stationarityKgM":stationarity}
    certificate = {key:float(value) for key,value in certificate_exact.items()}
    delta = max((abs(float(x)-number(y)) for u,t in zip(translations,exact["translations"]) for x,y in zip(u,t["u"])),default=0)
    objective_delta = max(abs(float(objective)-number(exact["objectiveKgM2"])),abs(float(objective)-number(result["objectiveKgM2"])))
    field_error = max([0]+[abs(float(x)-number(y)) for x,y in zip(margins,result["primalMarginsM"])]+[abs(value-number(result["certificate"][key])) for key,value in certificate.items()])
    support_matches = all(multipliers[i] == 0 if i not in result["active"] else abs(margins[i]) <= Fraction.from_float(1e-12) for i in range(n))
    gram = PARENT.LINEAR.gram_matrix(bodies,incidence)
    gram_error = max((abs(float(x)-number(y)) for row,record in zip(gram,result["gram"]) for x,y in zip(row,record)),default=0)
    ok = delta <= 1e-12 and objective_delta <= 1e-12 and field_error <= 1e-12 and gram_error <= 1e-12 and support_matches and \
        all(value <= 1e-12 for value in certificate.values()) and all(number(result["certificate"][key]) <= 1e-12 for key in keys) and \
        all(math.hypot(*(float(x) for x in u)) <= 10 for u in translations)
    return {"ok":ok,"metrics":{"translationDifferenceM":delta,"objectiveDifferenceKgM2":objective_delta,**certificate},
            "actualCertificate":certificate,"actualCertificateExact":{key:PARENT.LINEAR.rational(value) for key,value in certificate_exact.items()},
            "nativeActiveMask":mask,"referenceActiveMask":exact["activeMask"],"uniqueActiveSetClaimed":False}


def choice(request):
    exact_keys(request,("op","scene","stepIndex","choiceIndex","config","preBodies","preRawHex","problem","rowSelections","hypBodies","hypRawHex","result","previousChoiceRows"))
    need(type(request["scene"]) is str and type(request["config"]) is dict)
    integer(request["stepIndex"]);index = integer(request["choiceIndex"]);need(index < 9)
    tree(request["config"])
    pre,pre_raw = raw_bodies(request["preBodies"],request["preRawHex"])
    pairs = eligible(pre);before = [compact_pair(pre[a],pre[b],key) for key,a,b in pairs]
    by_key = {x["pairKey"]:x for x in before};locations = {key:(a,b) for key,a,b in pairs}
    problem = request["problem"]
    try:
        PARENT.LINEAR.validate_problem(problem)
    except PARENT.LINEAR.ReferenceError:
        raise ProtocolError(MESSAGE) from None
    need(problem["bodies"] == [{"id":b["id"],"inverseMass":b["inverseMass"]} for b in pre])
    sources = request["rowSelections"];need(type(sources) is list and len(sources) == len(problem["rows"]))
    previous = request["previousChoiceRows"];need(type(previous) is list)
    violations = [];checks = [];max_selection = 0.0;protected = set();initial_keys = []
    for i,(row,source) in enumerate(zip(problem["rows"],sources)):
        exact_keys(source,("pairKey","aIndex","bIndex","kind","selection"))
        need(source["kind"] in ("initial","added") and type(source["pairKey"]) is str and source["pairKey"] in locations)
        ai,bi = locations[source["pairKey"]]
        integer(source["aIndex"]);integer(source["bIndex"])
        need((source["aIndex"],source["bIndex"]) == (ai,bi))
        need(row["aId"] == pre[ai]["id"] and row["bId"] == pre[bi]["id"] and source["pairKey"] not in protected)
        protected.add(source["pairKey"])
        expected = by_key[source["pairKey"]]
        delta = selection_difference(source["selection"],pre[ai],pre[bi],expected);max_selection = max(max_selection,delta)
        expected_bound = max(0,expected["selection"]["boundM"]) if source["kind"] == "initial" else expected["selection"]["boundM"]
        row_delta = max(abs(number(row["boundM"])-expected_bound),max(abs(number(x)-number(y)) for x,y in zip(row["normal"],source["selection"]["normal"])))
        if source["kind"] == "initial":
            initial_keys.append(source["pairKey"])
            if expected["selection"]["boundM"] < -1e-12:
                violations.append("initial row is independently separated beyond original detector tolerance")
        elif expected["selection"]["boundM"] >= 0:
            violations.append("added row is not separated at immutable PRE")
        if max(delta,row_delta) > 1e-12:
            violations.append("fresh PRE row/axis correspondence exceeds 1e-12 m")
        checks.append({"pairKey":source["pairKey"],"kind":source["kind"],"axisDifferenceM":delta,"rowDifferenceM":row_delta})
    expected_initial = [x["pairKey"] for x in before if x["selection"]["boundM"] >= -1e-12]
    initial_agree = initial_keys == expected_initial
    append_agree = previous == [] and all(source["kind"] == "initial" for source in sources) if index == 0 else len(problem["rows"]) == len(previous)+1 and problem["rows"][:-1] == previous and sources[-1]["kind"] == "added"
    if not initial_agree or not append_agree:
        violations.append("initial rows or immutable one-row prefix is invalid")
    try:
        linear = PARENT.LINEAR.evaluate(problem)
    except PARENT.LINEAR.ReferenceError:
        raise ProtocolError(MESSAGE) from None
    need(linear.get("status") in ("SOLVED","INFEASIBLE") and type(request["result"]) is dict)
    supplied = request["result"];need(supplied.get("status") in ("SOLVED","INFEASIBLE"))
    if supplied["status"] != linear["status"]:
        violations.append("native and exact Fraction status differ")
    metrics = {"translationDifferenceM":None,"objectiveDifferenceKgM2":None,"primalViolationM":None,"negativeMultiplierKgM":None,
        "complementarityKgM2":None,"stationarityKgM":None,"maxPreAxisDifferenceM":max_selection,
        "maxHypDepthRawM":None,"maxHypDepthNormalizedM":None,"precisionMaxDifferenceM":max((x["precisionMaxDifferenceM"] for x in before),default=0),
        "roundedFinalMatches":None,"heldBitsMatch":None,"growthMatches":initial_agree and append_agree,"stageReached":False}
    hypothesis = [];growth = {"expectedAction":None,"pairKey":None,"nativeFailingPairs":[],"rawFailingPairs":[],"normalizedFailingPairs":[]}
    if linear["status"] == "INFEASIBLE":
        need(request["hypBodies"] is None and request["hypRawHex"] is None)
        return {"ok":False,"resolved":True,"executionFailure":False,"status":"INFEASIBLE","metrics":metrics,
            "reference":{"exactLinear":linear,"prePairs":strip_scalar(before),"hypPairs":[],"rowChecks":checks,"growthCheck":growth},
            "violations":violations+["bounded signed constraints are infeasible"]}
    if supplied["status"] == "INFEASIBLE":
        need(request["hypBodies"] is None and request["hypRawHex"] is None)
        return {"ok":False,"resolved":True,"executionFailure":False,"status":"SOLVED","metrics":metrics,
                "reference":{"exactLinear":linear,"prePairs":strip_scalar(before),"hypPairs":[],"rowChecks":checks,"growthCheck":growth},"violations":violations}
    checked = compare_linear(problem,supplied,linear)
    if checked.get("ok") is not True:
        violations.append("bounded Fraction/Float64 certificate agreement failed")
    metrics.update(checked["metrics"])
    if request["hypBodies"] is None or request["hypRawHex"] is None:
        need(request["hypBodies"] is None and request["hypRawHex"] is None)
        return {"ok":not violations,"resolved":True,"executionFailure":False,"status":"SOLVED","metrics":metrics,
                "reference":{"exactLinear":{**linear,"comparison":checked},"prePairs":strip_scalar(before),"hypPairs":[],"rowChecks":checks,"growthCheck":growth},
                "violations":violations}
    hyp,hyp_raw = raw_bodies(request["hypBodies"],request["hypRawHex"]);need(len(hyp) == len(pre))
    metrics["stageReached"] = True
    metrics["heldBitsMatch"] = True;metrics["roundedFinalMatches"] = True
    for i,(a,b,t) in enumerate(zip(pre,hyp,supplied["translations"])):
        need(a["id"] == b["id"] and t["id"] == a["id"])
        same_meta = {k:v for k,v in a.items() if k not in ("positionM",)} == {k:v for k,v in b.items() if k not in ("positionM",)}
        held = pre_raw[i*104+24:(i+1)*104] == hyp_raw[i*104+24:(i+1)*104]
        expected_p = a["positionM"] if a["inverseMass"] == 0 else [number(x)+number(u) for x,u in zip(a["positionM"],t["u"])]
        rounded = struct.pack("<3d",*expected_p) == hyp_raw[i*104:i*104+24]
        if a["inverseMass"] == 0:
            held = held and pre_raw[i*104:(i+1)*104] == hyp_raw[i*104:(i+1)*104]
        metrics["heldBitsMatch"] &= held and same_meta;metrics["roundedFinalMatches"] &= rounded
    if not metrics["heldBitsMatch"] or not metrics["roundedFinalMatches"]:
        violations.append("hypothesis is not one immutable PRE translation with held bits")
    hypothesis = [compact_pair(hyp[a],hyp[b],key) for key,a,b in pairs]
    native_fail = [x["pairKey"] for x in hypothesis if x["selection"]["boundM"] > 1e-12]
    raw_fail = [x["pairKey"] for x in hypothesis if x["rawDepthM"] > 1e-12]
    normalized_fail = [x["pairKey"] for x in hypothesis if x["normalizedDepthM"] > 1e-12]
    protected_fail = [key for key in native_fail if key in protected]
    if protected_fail:
        action,key = "protected-refusal",protected_fail[0]
    elif native_fail:
        action,key = ("row-cap-refusal" if len(problem["rows"]) == 8 else "append"),native_fail[0]
    else:
        action,key = None,None
    growth = {"expectedAction":action,"pairKey":key,"nativeFailingPairs":native_fail,"rawFailingPairs":raw_fail,"normalizedFailingPairs":normalized_fail,
              "initialRowsMatch":initial_agree,"oneImmutableAppendMatches":append_agree,"hypothesisDepthsAreTransient":True}
    metrics["maxHypDepthRawM"] = max((x["rawDepthM"] for x in hypothesis),default=0)
    metrics["maxHypDepthNormalizedM"] = max((x["normalizedDepthM"] for x in hypothesis),default=0)
    metrics["precisionMaxDifferenceM"] = max(metrics["precisionMaxDifferenceM"],max((x["precisionMaxDifferenceM"] for x in hypothesis),default=0))
    if any(x["precisionMaxDifferenceM"] > 1e-25 or x["rawNormalizedDepthDifferenceM"] > 1e-12 or x["rawNormalizedMarginDifferenceM"] > 1e-12 for x in before+hypothesis):
        violations.append("independent geometry precision/conventions unresolved")
    # Intermediate overlap is reported for growth, not universally vetoed.
    return {"ok":not violations,"resolved":metrics["precisionMaxDifferenceM"] <= 1e-25,"executionFailure":metrics["precisionMaxDifferenceM"] > 1e-25,
        "status":"SOLVED","metrics":metrics,"reference":{"exactLinear":{**linear,"comparison":checked},"prePairs":strip_scalar(before),"hypPairs":strip_scalar(hypothesis),"rowChecks":checks,"growthCheck":growth},"violations":violations}


def strip_scalar(records):
    return [{k:v for k,v in record.items() if k != "scalar"} for record in records]


def inertia(body,v,mode,inverse=False):
    if body["inverseMass"] == 0:
        return (Z,Z,Z)
    q = vector(body["orientation"],4)
    if mode == "normalized":
        q = normalized(q)
    diagonal = vector(body["inverseInertiaLocal"] if inverse else body["inertiaDiagonalKgM2"])
    local = rotate(conjugate(q),v)
    return rotate(q,tuple(x*y for x,y in zip(local,diagonal)))


def observe(bodies,g,mode):
    p,l_orb,l_spin = (Z,Z,Z),(Z,Z,Z),(Z,Z,Z);k,u = Z,Z
    for b in bodies:
        if b["inverseMass"] == 0:
            continue
        mass = O/dec(b["inverseMass"]);v = vector(b["velocityMps"]);w = vector(b["angularVelocityRadps"]);position = vector(b["positionM"])
        p = add(p,scale(v,mass));l_orb = add(l_orb,cross(position,scale(v,mass)))
        spin = inertia(b,w,mode);l_spin = add(l_spin,spin)
        k += mass*dot(v,v)/2+dot(w,spin)/2;u -= mass*dot(g,position)
    return {"linearMomentumKgMps":p,"orbitalAngularMomentumKgM2ps":l_orb,"spinAngularMomentumKgM2ps":l_spin,
            "angularMomentumKgM2ps":add(l_orb,l_spin),"kineticEnergyJ":k,"potentialEnergyJ":u}


def step_at_precision(ledger,raw,precision):
    with localcontext() as context:
        context.prec = precision
        frames = {};buffers = {}
        for phase,field in (("before","beforeBodies"),("free","freeBodies"),("velocity","velocityBodies"),("final","finalBodies")):
            frames[phase],buffers[phase] = raw_bodies(ledger[field],raw[phase])
        before,free,velocity,final = (frames[x] for x in ("before","free","velocity","final"))
        need(all(len(frame) == len(before) and [b["id"] for b in frame] == [b["id"] for b in before] for frame in frames.values()))
        dt = dec(ledger["fixedStepSeconds"]);need(Decimal.from_float(1/240) <= dt <= Decimal.from_float(1/30))
        g = vector(ledger["gravityMps2"]);need(all(abs(x) <= 1000 for x in g))
        actions = {};need(type(ledger["actions"]) is list)
        ids = {b["id"]:i for i,b in enumerate(before)}
        for pair in ledger["actions"]:
            need(type(pair) is list and len(pair) == 2 and type(pair[0]) is str and pair[0] in ids and pair[0] not in actions and type(pair[1]) is dict)
            need(before[ids[pair[0]]]["inverseMass"] > 0 and set(pair[1]) <= {"forceN","impulseNs","torqueNm","angularImpulseNms"})
            actions[pair[0]] = {key:vector(value) for key,value in pair[1].items()}
            need(all(abs(x) <= (100000 if key in ("impulseNs","angularImpulseNms") else 1000000) for key,value in actions[pair[0]].items() for x in value))
        metrics = {"freeVelocityDifferenceMps":Z,"freeOmegaDifferenceRadps":Z,"freePositionDifferenceM":Z,"freeQuaternionDifference":Z,
                   "velocityVelocityDifferenceMps":Z,"velocityOmegaDifferenceRadps":Z,"positionVelocityBitsHeld":True,"pointLedgerMatches":True,"phaseGeometryBitsHeld":True}
        predictions = {};free_j = (Z,Z,Z);free_tau = (Z,Z,Z);integration_artifact = (Z,Z,Z)
        transport = {mode:(Z,Z,Z) for mode in ("raw","normalized")};point_j = [(Z,Z,Z) for _ in before];point_tau = [(Z,Z,Z) for _ in before]
        for i,(a,b) in enumerate(zip(before,free)):
            metadata = lambda body:{k:v for k,v in body.items() if k not in ("positionM","velocityMps","angularVelocityRadps","orientation")}
            need(all(metadata(frame[i]) == metadata(a) for frame in frames.values()))
            if a["inverseMass"] == 0:
                metrics["phaseGeometryBitsHeld"] &= all(buffers[phase][i*104:(i+1)*104] == buffers["before"][i*104:(i+1)*104] for phase in frames)
                continue
            inv = dec(a["inverseMass"]);mass = O/inv;action = actions.get(a["id"],{});zero = (Z,Z,Z)
            j = add(action.get("impulseNs",zero),scale(add(scale(g,mass),action.get("forceN",zero)),dt))
            tau = add(action.get("angularImpulseNms",zero),scale(action.get("torqueNm",zero),dt))
            delta_w = inertia(a,tau,"raw",True)
            wanted_w = add(vector(a["angularVelocityRadps"]),delta_w)
            wanted_v = add(vector(a["velocityMps"]),scale(j,inv))
            wanted_q = advance(vector(a["orientation"],4),wanted_w,dt)
            # The original binary position addition is separately checked.
            wanted_p = tuple(Decimal.from_float(number(x)+number(v)*float(dt)) for x,v in zip(a["positionM"],b["velocityMps"]))
            metrics["freeVelocityDifferenceMps"] = max(metrics["freeVelocityDifferenceMps"],max(abs(x-y) for x,y in zip(vector(b["velocityMps"]),wanted_v)))
            metrics["freeOmegaDifferenceRadps"] = max(metrics["freeOmegaDifferenceRadps"],max(abs(x-y) for x,y in zip(vector(b["angularVelocityRadps"]),wanted_w)))
            metrics["freePositionDifferenceM"] = max(metrics["freePositionDifferenceM"],norm(sub(vector(b["positionM"]),wanted_p)))
            metrics["freeQuaternionDifference"] = max(metrics["freeQuaternionDifference"],norm(sub(vector(b["orientation"],4),wanted_q)))
            predictions[a["id"]] = {"velocityMps":wanted_v,"angularVelocityRadps":wanted_w,"orientation":wanted_q,"positionM":wanted_p}
            free_j = add(free_j,j);free_tau = add(free_tau,add(cross(vector(a["positionM"]),j),tau))
            integration_artifact = add(integration_artifact,cross(sub(vector(b["positionM"]),vector(a["positionM"])),scale(vector(b["velocityMps"]),mass)))
            for mode in transport:
                fixed_w = vector(a["angularVelocityRadps"])
                orientation_only = sub(inertia(b,fixed_w,mode),inertia(a,fixed_w,mode))
                command_transport = sub(inertia(b,delta_w,mode),tau)
                transport[mode] = add(transport[mode],add(orientation_only,command_transport))
        need(type(ledger["points"]) is list);seen = set();point_summary = []
        for point in ledger["points"]:
            exact_keys(point,("aId","bId","aIndex","bIndex","pairKey","pointId","family","pointM","normal","aPositionM","bPositionM","warm","final"))
            ai,bi = integer(point["aIndex"]),integer(point["bIndex"]);need(ai < len(before) and bi < len(before) and ai != bi)
            need(point["aId"] == before[ai]["id"] and point["bId"] == before[bi]["id"] and point["pairKey"] == point["aId"]+"\0"+point["bId"])
            need(point["family"] in ("face","edge") and type(point["pointId"]) is str and point["pointId"] and (point["pairKey"],point["pointId"]) not in seen)
            seen.add((point["pairKey"],point["pointId"]));normal = vector(point["normal"]);position = vector(point["pointM"])
            need(abs(norm(normal)-O) <= Decimal("1e-12"))
            need(vector(point["aPositionM"]) == vector(free[ai]["positionM"]) and vector(point["bPositionM"]) == vector(free[bi]["positionM"]))
            for field in ("warm","final"):
                exact_keys(point[field],("normalNs","tangentNs"));need(dec(point[field]["normalNs"]) >= 0);vector(point[field]["tangentNs"])
            impulse = add(scale(normal,dec(point["final"]["normalNs"])),vector(point["final"]["tangentNs"]))
            for i,sign in ((ai,-1),(bi,1)):
                if before[i]["inverseMass"] > 0:
                    applied = scale(impulse,Decimal(sign));point_j[i] = add(point_j[i],applied)
                    point_tau[i] = add(point_tau[i],cross(sub(position,vector(free[i]["positionM"])),applied))
            point_summary.append({"pairKey":point["pairKey"],"pointId":point["pointId"],"netImpulseNs":impulse,"warmSubtracted":False})
        external_j,external_tau = (Z,Z,Z),(Z,Z,Z)
        for i,(a,b,c) in enumerate(zip(free,velocity,final)):
            if a["inverseMass"] > 0:
                wanted_v = add(vector(a["velocityMps"]),scale(point_j[i],dec(a["inverseMass"])))
                wanted_w = add(vector(a["angularVelocityRadps"]),inertia(a,point_tau[i],"raw",True))
                metrics["velocityVelocityDifferenceMps"] = max(metrics["velocityVelocityDifferenceMps"],max(abs(x-y) for x,y in zip(vector(b["velocityMps"]),wanted_v)))
                metrics["velocityOmegaDifferenceRadps"] = max(metrics["velocityOmegaDifferenceRadps"],max(abs(x-y) for x,y in zip(vector(b["angularVelocityRadps"]),wanted_w)))
                external_j = add(external_j,point_j[i]);external_tau = add(external_tau,add(cross(vector(a["positionM"]),point_j[i]),point_tau[i]))
            metrics["phaseGeometryBitsHeld"] &= buffers["free"][i*104:i*104+24] == buffers["velocity"][i*104:i*104+24] and buffers["free"][i*104+48:i*104+80] == buffers["velocity"][i*104+48:i*104+80]
            metrics["positionVelocityBitsHeld"] &= buffers["velocity"][i*104+24:(i+1)*104] == buffers["final"][i*104+24:(i+1)*104]
        phase = {name:{mode:observe(frame,g,mode) for mode in ("raw","normalized")} for name,frame in frames.items()}
        position_artifact = (Z,Z,Z);gravity_work = Z
        for a,b,c in zip(before,velocity,final):
            if a["inverseMass"] > 0:
                mass = O/dec(a["inverseMass"])
                position_artifact = add(position_artifact,cross(sub(vector(c["positionM"]),vector(b["positionM"])),scale(vector(b["velocityMps"]),mass)))
                gravity_work += dot(scale(g,mass),sub(vector(c["positionM"]),vector(a["positionM"])))
        residuals = {}
        for mode in ("raw","normalized"):
            b,f,v,end = (phase[name][mode] for name in ("before","free","velocity","final"))
            residuals[mode] = {"freeLinearMomentumResidualKgMps":norm(sub(sub(f["linearMomentumKgMps"],b["linearMomentumKgMps"]),free_j)),
                "freeAngularMomentumResidualKgM2ps":norm(sub(sub(f["angularMomentumKgM2ps"],b["angularMomentumKgM2ps"]),add(free_tau,add(integration_artifact,transport[mode])))),
                "velocityLinearMomentumResidualKgMps":norm(sub(sub(v["linearMomentumKgMps"],f["linearMomentumKgMps"]),external_j)),
                "velocityAngularMomentumResidualKgM2ps":norm(sub(sub(v["angularMomentumKgM2ps"],f["angularMomentumKgM2ps"]),external_tau)),
                "positionAngularResidualKgM2ps":norm(sub(sub(end["angularMomentumKgM2ps"],v["angularMomentumKgM2ps"]),position_artifact)),
                "stepLinearMomentumResidualKgMps":norm(sub(sub(end["linearMomentumKgMps"],b["linearMomentumKgMps"]),add(free_j,external_j))),
                "stepAngularMomentumResidualKgM2ps":norm(sub(sub(end["angularMomentumKgM2ps"],b["angularMomentumKgM2ps"]),add(add(free_tau,external_tau),add(add(integration_artifact,transport[mode]),position_artifact))))}
        for key in residuals["raw"]:
            metrics[key] = max(residuals[mode][key] for mode in residuals)
        metrics["positionAngularArtifactKgM2ps"] = norm(position_artifact)
        return {"metrics":metrics,"phases":phase,"predictions":predictions,"budgets":{"freeImpulseNs":free_j,"freeTorqueNms":free_tau,
            "velocityNetDynamicImpulseNs":external_j,"velocityNetDynamicTorqueNms":external_tau,"integrationOrbitalArtifactKgM2ps":integration_artifact,
            "orientationCommandTransportKgM2ps":transport,"positionOrbitalArtifactKgM2ps":position_artifact},"pointImpulses":point_summary,
            "contactDeltaKJ":{mode:phase["velocity"][mode]["kineticEnergyJ"]-phase["free"][mode]["kineticEnergyJ"] for mode in residuals},
            "gravityGeometricWorkJ":gravity_work,"separateFrictionWorkMeasured":False,"warmTelescopingFromUnchangedSource":True,
            "perUpdateRoundingMeasured":False,"originM":(Z,Z,Z)}


def differences(low,high,path="",out=None):
    if out is None:
        out = {}
    if isinstance(high,Decimal):
        out[path] = abs(high-low)
    elif type(high) is dict:
        need(low.keys() == high.keys())
        for key,value in high.items():
            differences(low[key],value,path+"."+key,out)
    elif type(high) in (list,tuple):
        need(len(low) == len(high))
        for i,value in enumerate(high):
            differences(low[i],value,path+"["+str(i)+"]",out)
    elif type(high) is float:
        out[path] = Decimal.from_float(abs(high-low))
    else:
        need(low == high)
    return out


def step_ledger(request):
    exact_keys(request,("op","scene","stepIndex","outcome","ledger","raw"))
    need(type(request["scene"]) is str and request["outcome"] in ("accepted","attempted-final"));integer(request["stepIndex"])
    ledger,raw = request["ledger"],request["raw"]
    exact_keys(ledger,("beforeBodies","freeBodies","velocityBodies","finalBodies","fixedStepSeconds","gravityMps2","actions","points"))
    exact_keys(raw,("before","free","velocity","final"))
    low,high = step_at_precision(ledger,raw,80),step_at_precision(ledger,raw,120)
    with localcontext() as context:
        context.prec = 120
        delta = differences(low,high)
    # Scalar transcendentals have a separate1e-12 check. Algebra1e-25 is not
    # a claim that sin/cos are computed at Decimal precision.
    algebra = max((x for key,x in delta.items() if ".predictions." not in key),default=Z)
    scalar = max((x for key,x in delta.items() if ".predictions." in key),default=Z)
    resolved = algebra <= PRECISION_GATE and scalar <= Decimal("1e-12")
    metrics = high["metrics"];violations = []
    for key,value in metrics.items():
        if key.endswith("ResidualKgMps") or key.endswith("ResidualKgM2ps"):
            if value > Decimal("1e-7"):
                violations.append(key+" exceeds 1e-7 in stated SI units")
    for key,gate in (("freeVelocityDifferenceMps","1e-10"),("freeOmegaDifferenceRadps","1e-10"),("freePositionDifferenceM","1e-12"),("freeQuaternionDifference","1e-12"),("velocityVelocityDifferenceMps","1e-10"),("velocityOmegaDifferenceRadps","1e-10")):
        if metrics[key] > Decimal(gate):
            violations.append(key+" exceeds frozen update agreement")
    for key in ("positionVelocityBitsHeld","pointLedgerMatches","phaseGeometryBitsHeld"):
        if not metrics[key]:
            violations.append(key+" is false")
    if any(frame[mode]["kineticEnergyJ"] < 0 for frame in high["phases"].values() for mode in ("raw","normalized")):
        violations.append("kinetic energy is negative")
    if not resolved:
        violations.append("reference precision is unresolved")
    units = {"positionM":Z,"velocityMps":Z,"angularVelocityRadps":Z,"linearMomentumKgMps":Z,"angularMomentumKgM2ps":Z,"energyJ":Z,"quaternion":Z}
    for path,value in delta.items():
        if any(x in path for x in ("EnergyJ","DeltaKJ","WorkJ")):
            unit = "energyJ"
        elif any(x in path for x in ("KgM2ps","TorqueNms")):
            unit = "angularMomentumKgM2ps"
        elif any(x in path for x in ("KgMps","ImpulseNs")):
            unit = "linearMomentumKgMps"
        elif any(x in path for x in ("OmegaDifference","angularVelocityRadps")):
            unit = "angularVelocityRadps"
        elif any(x in path for x in ("VelocityDifference","velocityMps")):
            unit = "velocityMps"
        elif any(x in path for x in ("Quaternion","orientation")):
            unit = "quaternion"
        else:
            unit = "positionM"
        units[unit] = max(units[unit],value)
    metrics["precisionDifferencesByUnit"] = {**units,"algebraMax":algebra,"scalarTranscendentalRepeat":scalar}
    reference = {key:value for key,value in high.items() if key != "metrics"}
    return {"ok":resolved and not violations,"resolved":resolved,"executionFailure":not resolved,"metrics":public(metrics),"reference":public(reference),"violations":violations}


def evaluate(request):
    need(type(request) is dict)
    try:
        if request.get("op") == "choice":
            return choice(request)
        if request.get("op") == "step-ledger":
            return step_ledger(request)
        raise ProtocolError(MESSAGE)
    except (PARENT.ProtocolError,PARENT.LINEAR.ReferenceError,PARENT.SAT.ReferenceInputError,PARENT.COVERAGE.ReferenceInputError):
        raise ProtocolError(MESSAGE) from None


def main():
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            result = {"ok":False,"resolved":False,"executionFailure":True,"code":"REFERENCE_JSON","message":JSON_MESSAGE,"violations":[]}
        else:
            try:
                result = evaluate(request)
            except ProtocolError:
                result = {"ok":False,"resolved":False,"executionFailure":True,"code":"REFERENCE_INPUT","message":MESSAGE,"violations":[]}
        print(json.dumps(result,allow_nan=False,separators=(",",":")),flush=True)


if __name__ == "__main__":
    main()
