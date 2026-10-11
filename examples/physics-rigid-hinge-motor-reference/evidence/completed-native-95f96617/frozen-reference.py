#!/usr/bin/env python3
"""Cold input-only hinge command/motor/FREE predictor and report comparator.

Ordinary float leaf operations preserve original binary64 order and zeros.
The adopted independent pose/Fraction/Decimal reference is imported unchanged.
No candidate, package runtime, motor, solver or World module is imported.
Scalar transcendental seeds are not Decimal transcendental certificates.
"""
from decimal import Decimal, localcontext
import copy
import importlib.util
import json
import math
from pathlib import Path
import struct
import sys

sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location("adopted_independent_hinge_1349",Path(__file__).resolve().parent.parent / "physics-rigid-hinge-velocity-reference" / "reference.py")
PARENT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PARENT)
DT = 1/120
INPUT_MESSAGE = "hinge motor reference input is invalid"
JSON_MESSAGE = "hinge motor reference line must be valid JSON"
LABELS = ("source","angular","motor","free","projected")
FRAME_KEYS = tuple(label+"Bodies" for label in LABELS)
FIELDS = (("positionM",3),("velocityMps",3),("orientation",4),("angularVelocityRadps",3))
BODY_KEYS = ("id","kind","shape","positionM","velocityMps","orientation","angularVelocityRadps","inertiaKgM2","inverseInertiaLocal","inverseMass","restitution","frictionStatic","frictionDynamic","sensor")
STAGES = ("admitted","angular-ready","motor-ready","free-ready","projection-ready","report-ready")
MOTOR_KEYS = ("inputAngleRad","targetSpeedRadps","limitRad","maxImpulseNms","blocked","impulseNms","relativeSpeedBeforeRadps","relativeSpeedAfterRadps")
REPORT_KEYS = ("id","kind","aId","bId","angleRad","linearImpulseNs","angularImpulseNms","motorImpulseNms")
WORK_KEYS = ("externalAngularByBodyJ","externalAngularTotalJ","motorMidpointJ","motorSpinMidpointJ","motorResidualJ","freeDeltaKJ","projectionDeltaKJ","projectionObjectiveJ")
ENERGY_KEYS = tuple(label+"J" for label in LABELS)
CAP_KEYS = ("angularReactionNormNms","maxReactionNms","exceedsCap")
CHECK_KEYS = ("sourceRawMatchesInput","commandsRawMatchesInput","parsedActionsMatch","sourceCursorRetained","acceptedReportAuthorityMatch","heldFrameBitsMatch","namedZeroSignsMatch","outputAttemptCorrespondence","callsMatch","jointReportIdentityMatch","targetAngleAuthorityMatch","capDecisionMatch","finiteSignedWork","nonnegativeEnergiesAndObjective","parentPredictionQualified","parentActualQualified","actualErrorMatch","actualOutcomeMatch")
UNIT_KEYS = ("positionM","quaternion","velocityMps","angularVelocityRadps","linearMomentumKgMps","angularMomentumKgM2ps","energyJ","impulseNs","angularImpulseNms")
ATTEMPT_KEYS = ("stage","sourceStepIndex","sourceTimeSeconds","acceptedReportAngleRad","parsedActions","frames","motor","projection","jointReport","bodyCorrections","energyByPhase","work","reportCap","calls","error")
DIAGNOSTIC_KEYS = ("sourceStepIndex","sourceTimeSeconds","acceptedReportAngleRad","rawSourceAngleRad","rawFreeAngleRad","rawFinalAngleRad","parsedActions","frames","metrics","motor","projection","bodyCorrections","energyByPhase","work","reportCap","calls")


class ReferenceInputError(ValueError):
    pass


class ReferenceUnresolved(ValueError):
    pass


def need(condition):
    if not condition:
        raise ReferenceInputError(INPUT_MESSAGE)


def keys(value,names):
    need(type(value) is dict and set(value) == set(names))


def finite(value):
    need(type(value) in (int,float))
    try:
        result = float(value)
    except OverflowError:
        raise ReferenceInputError(INPUT_MESSAGE) from None
    need(math.isfinite(result))
    return result


def vector(value,size=3):
    need(type(value) is list and len(value) == size)
    return [finite(x) for x in value]


def integer(value,limit=9007199254740991):
    need(type(value) is int and 0 <= value <= limit)
    return value


def tree(value):
    if type(value) in (int,float):
        finite(value)
    elif type(value) is list:
        for x in value:
            tree(x)
    elif type(value) is dict:
        for x in value.values():
            tree(x)
    else:
        need(value is None or type(value) in (str,bool))


def bits(value):
    return struct.pack("<d",finite(value))


def raw_hex(bodies):
    return b"".join(bits(x) for body in bodies for field,_ in FIELDS for x in body[field]).hex()


def restore(bodies,hexadecimal,full=False):
    need(type(bodies) is list and len(bodies) == 2 and all(type(b) is dict for b in bodies))
    need(type(hexadecimal) is str and len(hexadecimal) == 416 and all(c in "0123456789abcdefABCDEF" for c in hexadecimal))
    raw = bytes.fromhex(hexadecimal);values = struct.unpack("<26d",raw);result = copy.deepcopy(bodies);i = 0
    for body in result:
        if full:
            keys(body,BODY_KEYS);keys(body["shape"],("kind","radiusM"))
            need(type(body["id"]) is str and body["kind"] == "dynamic" and body["shape"]["kind"] == "sphere" and finite(body["shape"]["radiusM"]) == .1 and body["sensor"] is False)
            for field in ("inertiaKgM2","inverseMass","restitution","frictionStatic","frictionDynamic"):
                finite(body[field])
            vector(body["inverseInertiaLocal"])
        for field,size in FIELDS:
            supplied = vector(body.get(field),size)
            body[field] = []
            for value in supplied:
                decoded = values[i];i += 1
                need(math.isfinite(decoded) and decoded == value)
                body[field].append(decoded)
    return result


def add(a,b):
    return [a[i]+b[i] for i in range(3)]


def sub(a,b):
    return [a[i]-b[i] for i in range(3)]


def scale(a,s):
    return [x*s for x in a]


def dot(a,b):
    result = 0.0
    for i in range(3):
        product = a[i]*b[i]
        result = result+product
    return result


def cross(a,b):
    return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]


def conjugate(q):
    return [-q[0],-q[1],-q[2],q[3]]


def rotate(q,v):
    t = scale(cross(q[:3],v),2.0)
    return add(v,add(scale(t,q[3]),cross(q[:3],t)))


def inverse_inertia(body,v):
    local = rotate(conjugate(body["orientation"]),v)
    scaled = [local[i]*body["inverseInertiaLocal"][i] for i in range(3)]
    return rotate(body["orientation"],scaled)


def multiply_quaternion(a,b):
    ax,ay,az,aw = a;bx,by,bz,bw = b
    return [((aw*bx+ax*bw)+ay*bz)-az*by,((aw*by-ax*bz)+ay*bw)+az*bx,
        ((aw*bz+ax*by)-ay*bx)+az*bw,((aw*bw-ax*bx)-ay*by)-az*bz]


def advance(q,w,dt):
    speed = math.hypot(*w)
    if speed == 0:
        return q[:]
    half = (speed*dt)/2.0;factor = math.sin(half)/speed
    delta = [w[0]*factor,w[1]*factor,w[2]*factor,math.cos(half)]
    product = multiply_quaternion(delta,q);length = math.hypot(*product)
    if not math.isfinite(length) or length == 0:
        raise ReferenceUnresolved("independent scalar orientation is unresolved")
    return [x/length for x in product]


def clamp(value,low,high):
    # Explicit JS min/max zero ties; the fixed impulse bounds are nonzero.
    upper = high if value > high else value
    if value == high == 0:
        upper = -0.0 if math.copysign(1,value) < 0 or math.copysign(1,high) < 0 else 0.0
    result = low if upper < low else upper
    if upper == low == 0:
        result = 0.0 if math.copysign(1,upper) > 0 or math.copysign(1,low) > 0 else -0.0
    return result


def twist(a,b):
    relative = multiply_quaternion(b,conjugate(a));angle = 2.0*math.atan2(dot(relative[:3],[0.0,0.0,1.0]),relative[3])
    return angle-2.0*math.pi if angle > math.pi else angle+2.0*math.pi if angle < -math.pi else angle


def old_bodies(bodies):
    return [{short:tuple(Decimal.from_float(x) for x in body[field]) for short,field in (("p","positionM"),("v","velocityMps"),("q","orientation"),("w","angularVelocityRadps"))} for body in bodies]


def source_input(request):
    need(finite(request["dt"]) == DT)
    config,carrier = PARENT.POSE.carrier({"config":request["config"],"state":request["carrier"],"dt":request["dt"],"beforeRawHex":request["rawFrames"]["source"]})
    PARENT.finite_tree(config);PARENT.finite_tree(carrier)
    need(set(config) == {"bodies","joints","fixedStepSeconds","gravityMps2"})
    need(type(config["bodies"]) is list and len(config["bodies"]) == 2 and all(type(b) is dict for b in config["bodies"]))
    need(type(config["joints"]) is list and len(config["joints"]) == 1 and type(config["joints"][0]) is dict)
    for b in config["bodies"]:
        need(set(b) <= {"id","kind","shape","positionM","velocityMps","massKg","restitution","friction","orientation","angularVelocityRadps","ccd","sensor"})
        need("inertiaKgM2" not in b and b.get("sensor",False) is False and b.get("ccd",False) is False)
        keys(b.get("friction"),("static","dynamic"))
    keys(config["joints"][0],("id","kind","aId","bId","anchorALocalM","anchorBLocalM","axisWorld","limitRad","motor"))
    keys(config["joints"][0]["motor"],("targetSpeedRadps","maxImpulseNms","maxReactionNms"))
    decoded,report,origin,limits = PARENT.OLD.decode({"config":config,"state":carrier,"dt":DT})
    bodies = []
    for original,raw in zip(config["bodies"],carrier["bodies"]):
        inertia = (.4*finite(original["massKg"]))*finite(original["shape"]["radiusM"])**2
        inverse_mass = 1.0/finite(original["massKg"])
        body = {"id":original["id"],"kind":"dynamic","shape":{"kind":"sphere","radiusM":.1},
            **{field:vector(raw[field],size) for field,size in FIELDS},"inertiaKgM2":inertia,"inverseInertiaLocal":[1.0/inertia]*3,
            "inverseMass":inverse_mass,"restitution":0.0,"frictionStatic":1.0,"frictionDynamic":.7,"sensor":False}
        for field,bound in (("positionM",10000),("velocityMps",1000),("angularVelocityRadps",1000),("orientation",1)):
            need(all(abs(x) <= bound for x in body[field]))
        need(abs(math.hypot(*body["orientation"])-1.0) <= 1e-9)
        bodies.append(body)
    return config,carrier,bodies,float(report),list(map(float,origin)),list(map(float,limits))


def command_actions(request,bodies):
    commands = request["commands"];need(type(commands) is list and len(commands) <= 64)
    hexadecimal = request["commandsRawHex"]
    need(type(hexadecimal) is str and len(hexadecimal) == 48*len(commands) and all(c in "0123456789abcdefABCDEF" for c in hexadecimal))
    decoded = struct.unpack("<"+str(len(commands)*3)+"d",bytes.fromhex(hexadecimal));actions = [{"bodyId":b["id"],"torqueNm":None,"angularImpulseNms":None} for b in bodies]
    by_id = {b["id"]:i for i,b in enumerate(bodies)};offset = 0
    for command in commands:
        need(type(command) is dict and type(command.get("kind")) is str)
        kind = command["kind"];need(kind in ("torque","angularImpulse"));field = "torqueNm" if kind == "torque" else "angularImpulseNms"
        keys(command,("kind","bodyId",field));need(type(command["bodyId"]) is str and command["bodyId"] in by_id)
        supplied = vector(command[field]);actual = []
        for value in supplied:
            raw = decoded[offset];offset += 1;need(math.isfinite(raw) and value == raw);actual.append(raw)
        bound = 1000000 if kind == "torque" else 100000
        need(all(abs(x) <= bound for x in actual) and math.hypot(*sub(actual,scale([0.0,0.0,1.0],dot(actual,[0.0,0.0,1.0])))) <= 1e-12)
        action = actions[by_id[command["bodyId"]]];need(action[field] is None);action[field] = actual
    return actions


def pair_metrics(bodies,joint,origin):
    masses = [1.0/b["inverseMass"] for b in bodies]
    center = scale(add(scale(bodies[0]["positionM"],masses[0]),scale(bodies[1]["positionM"],masses[1])),1.0/(masses[0]+masses[1]))
    momentum = [0.0]*3;orbital = [0.0]*3;spin = [0.0]*3;energy = 0.0
    for body,mass in zip(bodies,masses):
        momentum = add(momentum,scale(body["velocityMps"],mass))
        orbital = add(orbital,scale(cross(sub(body["positionM"],origin),body["velocityMps"]),mass))
        spin = add(spin,scale(body["angularVelocityRadps"],body["inertiaKgM2"]))
        energy = (energy+(.5*mass)*dot(body["velocityMps"],body["velocityMps"]))+(.5*body["inertiaKgM2"])*dot(body["angularVelocityRadps"],body["angularVelocityRadps"])
    a,b = bodies;ra = rotate(a["orientation"],vector(joint["anchorALocalM"]));rb = rotate(b["orientation"],vector(joint["anchorBLocalM"]))
    aa,ab = add(a["positionM"],ra),add(b["positionM"],rb)
    va,vb = add(a["velocityMps"],cross(a["angularVelocityRadps"],ra)),add(b["velocityMps"],cross(b["angularVelocityRadps"],rb))
    deviations = []
    for body in bodies:
        axis = rotate(body["orientation"],[0.0,0.0,1.0]);deviations.append(math.atan2(math.hypot(axis[0],axis[1]),axis[2]))
    angle = twist(a["orientation"],b["orientation"])
    return {"relativeAngleRad":angle,"anchorAM":aa,"anchorBM":ab,"anchorGapM":math.hypot(*sub(ab,aa)),"axisDeviationRad":max(deviations),
        "quaternionNormError":max(abs(math.hypot(*body["orientation"])-1.0) for body in bodies),"limitExcessRad":max(0.0,joint["limitRad"][0]-angle,angle-joint["limitRad"][1]),
        "centerOfMassM":center,"linearMomentumVectorKgMps":momentum,"orbitalAngularMomentumVectorKgM2ps":orbital,"spinAngularMomentumVectorKgM2ps":spin,
        "angularMomentumVectorKgM2ps":add(orbital,spin),"energyJ":energy,"anchorVelocityAMps":va,"anchorVelocityBMps":vb,"anchorRelativeVelocityMps":sub(va,vb),
        "relativeAngularVelocityRadps":sub(b["angularVelocityRadps"],a["angularVelocityRadps"])}


def midpoint_by_body(before,after):
    values = []
    for a,b in zip(before,after):
        delta = sub(b["angularVelocityRadps"],a["angularVelocityRadps"]);total = add(a["angularVelocityRadps"],b["angularVelocityRadps"])
        values.append((.5*a["inertiaKgM2"])*dot(delta,total))
    return values


def refusal(reference,message):
    reference["expectedRefusal"] = {"stage":reference["stage"],"name":"PhysicsError","code":"NUMERIC_LIMIT","message":message}
    return reference


def parent_request(config,carrier,free):
    state = copy.deepcopy(carrier)
    for raw,body in zip(state["bodies"],free):
        for field,_ in FIELDS:
            raw[field] = body[field][:]
    return {"config":copy.deepcopy(config),"state":state,"dt":DT,"beforeRawHex":raw_hex(free)}


def predict(request,precision):
    with localcontext() as context:
        context.prec = precision
        config,carrier,source,memory,origin,limits = source_input(request);joint = config["joints"][0];actions = command_actions(request,source)
        reference = {"stage":"admitted","authority":{"sourceStepIndex":carrier["stepIndex"],"sourceTimeSeconds":carrier["timeSeconds"],"acceptedReportAngleRad":memory,
            "rawSourceAngleRad":twist(source[0]["orientation"],source[1]["orientation"]),"rawFreeAngleRad":None,"rawFinalAngleRad":None},"parsedActions":actions,
            "frames":{key:source if key == "sourceBodies" else None for key in FRAME_KEYS},"rawFrames":{label:raw_hex(source) if label == "source" else None for label in LABELS},
            "motor":None,"jointReport":None,"bodyCorrections":None,"energyByPhase":None,"work":None,"reportCap":None,"calls":{"motorCalls":0,"projectionCalls":0},
            "parent":{"mode":"unreached","reply":None,"refusal":None},"expectedRefusal":None}
        angular = copy.deepcopy(source)
        for body,action in zip(angular,actions):
            delta = add(action["angularImpulseNms"] if action["angularImpulseNms"] is not None else [0.0]*3,
                scale(action["torqueNm"] if action["torqueNm"] is not None else [0.0]*3,DT))
            body["angularVelocityRadps"] = add(body["angularVelocityRadps"],inverse_inertia(body,delta))
        reference["frames"]["angularBodies"] = angular;reference["rawFrames"]["angular"] = raw_hex(angular);reference["stage"] = "angular-ready"
        motor = copy.deepcopy(angular);axis = vector(joint["axisWorld"]);spec = joint["motor"]
        speed_before = dot(sub(motor[1]["angularVelocityRadps"],motor[0]["angularVelocityRadps"]),axis)
        blocked = memory <= limits[0] and spec["targetSpeedRadps"] < 0 or memory >= limits[1] and spec["targetSpeedRadps"] > 0
        reference["calls"]["motorCalls"] = 1
        j = 0.0
        if not blocked:
            inverse_sum = dot(axis,inverse_inertia(motor[0],axis))+dot(axis,inverse_inertia(motor[1],axis))
            if not math.isfinite(inverse_sum) or inverse_sum == 0:
                raise ReferenceUnresolved("independent motor inverse inertia is unresolved")
            needed = (finite(spec["targetSpeedRadps"])-speed_before)/inverse_sum;j = clamp(needed,-finite(spec["maxImpulseNms"]),finite(spec["maxImpulseNms"]))
            motor[0]["angularVelocityRadps"] = sub(motor[0]["angularVelocityRadps"],inverse_inertia(motor[0],scale(axis,j)))
            motor[1]["angularVelocityRadps"] = add(motor[1]["angularVelocityRadps"],inverse_inertia(motor[1],scale(axis,j)))
        speed_after = dot(sub(motor[1]["angularVelocityRadps"],motor[0]["angularVelocityRadps"]),axis)
        reference["motor"] = {"inputAngleRad":memory,"targetSpeedRadps":finite(spec["targetSpeedRadps"]),"limitRad":limits,"maxImpulseNms":finite(spec["maxImpulseNms"]),
            "blocked":blocked,"impulseNms":j,"relativeSpeedBeforeRadps":speed_before,"relativeSpeedAfterRadps":speed_after}
        reference["frames"]["motorBodies"] = motor;reference["rawFrames"]["motor"] = raw_hex(motor);reference["stage"] = "motor-ready"
        free = copy.deepcopy(motor);gravity = vector(config["gravityMps2"])
        for body in free:
            w = body["angularVelocityRadps"]
            if any(not math.isfinite(x) or abs(x) > 1000 for x in w) or math.hypot(*w)*DT > 10:
                return refusal(reference,body["id"]+" exceeded angular movement limit"),None
            body["orientation"] = advance(body["orientation"],w,DT)
            for i in range(3):
                body["velocityMps"][i] = body["velocityMps"][i]+0.0*body["inverseMass"]
                body["velocityMps"][i] = body["velocityMps"][i]+(gravity[i]+0.0*body["inverseMass"])*DT
            if math.hypot(*body["velocityMps"])*DT > 10:
                return refusal(reference,body["id"]+" exceeded step displacement limit"),None
            for i in range(3):
                body["positionM"][i] = body["positionM"][i]+body["velocityMps"][i]*DT
        reference["frames"]["freeBodies"] = free;reference["rawFrames"]["free"] = raw_hex(free);reference["stage"] = "free-ready"
        reference["authority"]["rawFreeAngleRad"] = twist(free[0]["orientation"],free[1]["orientation"]);reference["calls"]["projectionCalls"] = 1
        if any(any(abs(x)>bound for x in b[field]) for b in free for field,bound in (("positionM",10000),("velocityMps",1000),("angularVelocityRadps",1000),("orientation",1))) or any(abs(math.hypot(*b["orientation"])-1)>1e-9 for b in free):
            return refusal(reference,"private hinge velocity archived pose is invalid"),None
        parent_input = parent_request(config,carrier,free)
        try:
            inherited = PARENT.at_precision(parent_input,precision)
        except PARENT.ReferenceSystemError as error:
            reference["parent"] = {"mode":"refused","reply":None,"refusal":{"code":"REFERENCE_SYSTEM","message":str(error)}}
            return refusal(reference,"private hinge velocity system is singular or unsafe"),None
        projected = copy.deepcopy(free)
        for body,wanted in zip(projected,inherited["expectedBodies"]):
            for field,size in FIELDS:
                body[field] = [finite(PARENT.public(x)) for x in wanted[field]]
        for body in projected:
            for label,field,bound in (("position","positionM",10000),("velocity","velocityMps",1000),("angularVelocity","angularVelocityRadps",1000)):
                if any(not math.isfinite(x) or abs(x)>bound for x in body[field]):
                    return refusal(reference,body["id"]+" "+label+" exceeded bounds"),inherited
            if abs(math.hypot(*body["orientation"])-1)>1e-12:
                return refusal(reference,body["id"]+" orientation exceeded tolerance"),inherited
        reference["frames"]["projectedBodies"] = projected;reference["rawFrames"]["projected"] = raw_hex(projected);reference["stage"] = "projection-ready"
        reference["authority"]["rawFinalAngleRad"] = twist(projected[0]["orientation"],projected[1]["orientation"])
        corrections = [{"bodyId":b["id"],"linearImpulseNs":scale(sub(b["velocityMps"],a["velocityMps"]),1.0/a["inverseMass"]),
            "angularImpulseNms":scale(sub(b["angularVelocityRadps"],a["angularVelocityRadps"]),a["inertiaKgM2"])} for a,b in zip(free,projected)]
        report = {"id":joint["id"],"kind":"hinge","aId":source[0]["id"],"bId":source[1]["id"],"angleRad":inherited["poseReport"]["targetAngleRad"],
            "linearImpulseNs":corrections[1]["linearImpulseNs"][:],"angularImpulseNms":corrections[1]["angularImpulseNms"][:],"motorImpulseNms":j}
        energies = {label+"J":pair_metrics(reference["frames"][label+"Bodies"],joint,origin)["energyJ"] for label in LABELS}
        external = midpoint_by_body(source,angular);spin = midpoint_by_body(angular,motor);midpoint = (j*(speed_before+speed_after))*.5;spin_total = spin[0]+spin[1]
        try:
            objective = finite(float(inherited["projection"]["objectiveJ"]))
        except OverflowError:
            raise ReferenceUnresolved("independent objective has no finite binary representation") from None
        work = {"externalAngularByBodyJ":external,"externalAngularTotalJ":external[0]+external[1],"motorMidpointJ":midpoint,"motorSpinMidpointJ":spin_total,"motorResidualJ":spin_total-midpoint,
            "freeDeltaKJ":energies["freeJ"]-energies["motorJ"],"projectionDeltaKJ":energies["projectedJ"]-energies["freeJ"],"projectionObjectiveJ":objective}
        cap = {"angularReactionNormNms":math.hypot(*corrections[1]["angularImpulseNms"]),"maxReactionNms":.01,"exceedsCap":math.hypot(*corrections[1]["angularImpulseNms"])>.01}
        tree(report);tree(work);tree(energies);need(all(x>=0 for x in energies.values()) and objective>=0)
        reference.update(jointReport=report,bodyCorrections=corrections,energyByPhase=energies,work=work,reportCap=cap,stage="report-ready")
        if cap["exceedsCap"]:
            refusal(reference,joint["id"]+" exceeded motor reaction limit")
        return reference,inherited


def observations(reference,config,precision):
    joint = config["joints"][0];origin = tuple(PARENT.OLD.number(x) for x in config["bodies"][0]["positionM"])
    # Fixed original pair origin is its config midpoint, not config A's x.
    origin = (Decimal(0),Decimal(0),origin[2]);limits = tuple(PARENT.OLD.number(x) for x in joint["limitRad"]);result = {}
    with localcontext() as context:
        context.prec = precision
        for label in LABELS:
            bodies = reference["frames"][label+"Bodies"]
            if bodies is not None:
                report = reference["jointReport"]["angleRad"] if label == "projected" and reference["jointReport"] is not None else reference["authority"]["acceptedReportAngleRad"]
                result[label] = PARENT.observed(old_bodies(bodies),PARENT.OLD.number(report),origin,limits)
    return result


def decimal_difference(a,b):
    if type(a) in (list,tuple):
        need(type(b) in (list,tuple) and len(a) == len(b))
        return max((decimal_difference(x,y) for x,y in zip(a,b)),default=Decimal(0))
    return abs(PARENT.POSE.decimal_value(a)-PARENT.POSE.decimal_value(b))


def precision_report(low,high,low_parent,high_parent,low_obs,high_obs):
    differences = {key:Decimal(0) for key in UNIT_KEYS};scalar = Decimal(0)
    field_units = {"anchorAM":"positionM","anchorBM":"positionM","anchorGapM":"positionM","centerOfMassM":"positionM","quaternionNormError":"quaternion",
        "anchorVelocityAMps":"velocityMps","anchorVelocityBMps":"velocityMps","anchorRelativeVelocityMps":"velocityMps","relativeAngularVelocityRadps":"angularVelocityRadps",
        "linearMomentumVectorKgMps":"linearMomentumKgMps","angularMomentumVectorKgM2ps":"angularMomentumKgM2ps","geometricAngularMomentumVectorKgM2ps":"angularMomentumKgM2ps",
        "energyJ":"energyJ","geometricEnergyJ":"energyJ"}
    with localcontext() as context:
        context.prec = 120
        need(set(low_obs) == set(high_obs))
        for label in high_obs:
            for mode in ("raw","normalized"):
                for field,unit in field_units.items():
                    differences[unit] = max(differences[unit],decimal_difference(low_obs[label][mode][field],high_obs[label][mode][field]))
                for field in ("relativeAngleRad","axisDeviationRad","reportedAngleDifferenceRad","limitExcessRad"):
                    scalar = max(scalar,decimal_difference(low_obs[label][mode][field],high_obs[label][mode][field]))
        for label in LABELS:
            a,b = low["frames"][label+"Bodies"],high["frames"][label+"Bodies"]
            need((a is None) == (b is None))
            if a is not None:
                for left,right in zip(a,b):
                    for field,unit in (("positionM","positionM"),("orientation","quaternion"),("velocityMps","velocityMps"),("angularVelocityRadps","angularVelocityRadps")):
                        differences[unit] = max(differences[unit],decimal_difference(left[field],right[field]))
        if high["bodyCorrections"] is not None and low["bodyCorrections"] is not None:
            for a,b in zip(low["bodyCorrections"],high["bodyCorrections"]):
                for field,unit in (("linearImpulseNs","impulseNs"),("angularImpulseNms","angularImpulseNms")):
                    differences[unit] = max(differences[unit],decimal_difference(a[field],b[field]))
        if high["work"] is not None and low["work"] is not None:
            for field in WORK_KEYS:
                differences["energyJ"] = max(differences["energyJ"],decimal_difference(low["work"][field],high["work"][field]))
        same_model = (low_parent is None) == (high_parent is None)
        if low_parent is not None and high_parent is not None:
            same_model = low_parent["problem"] == high_parent["problem"] and low_parent["exact"] == high_parent["exact"]
        same_outcome = low["stage"] == high["stage"] and low["expectedRefusal"] == high["expectedRefusal"]
        return {"algebraMaxDifferenceByUnit":PARENT.public(differences),"scalarRepeatMaxDifferenceRad":float(scalar),
            "algebraResolved":same_model and same_outcome and all(x <= Decimal("1e-25") for x in differences.values()),"scalarResolved":scalar <= Decimal("1e-12")}


def parent_prediction_qualified(inherited):
    if inherited is None:
        return None
    exact = inherited["exact"]
    if not exact["primalZero"] or not exact["stationarityZero"] or not exact["stopKktPassed"]:
        return False
    if inherited["metrics"]["rawNormalizedGeometryDifference"] > 1e-12:
        return False
    for mode in ("raw","normalized"):
        x = inherited["after"][mode]
        if x["anchorGapM"] > Decimal("1e-9") or x["quaternionNormError"] > Decimal("1e-9") or x["limitExcessRad"] > 1e-9 or abs(x["reportedAngleDifferenceRad"]) > 1e-9 or x["axisDeviationRad"] > math.pi/180:
            return False
        for field,gate in (("ComChangeM","1e-12"),("LinearMomentumChangeKgMps","1e-7"),("AngularMomentumChangeKgM2ps","1e-7"),("GeometricAngularMomentumChangeKgM2ps","1e-7")):
            if inherited["metrics"][mode+field] > Decimal(gate):
                return False
        if PARENT.OLD.magnitude(x["anchorRelativeVelocityMps"]) > Decimal("1e-9") or PARENT.OLD.magnitude(x["relativeAngularVelocityRadps"][:2]) > Decimal("1e-9"):
            return False
        kind = inherited["problem"]["stopKind"]
        if kind != "none" and x["relativeAngularVelocityRadps"][2]*(1 if kind == "upper" else -1) > Decimal("1e-9"):
            return False
        if x["energyJ"] < 0 or x["geometricEnergyJ"] < 0:
            return False
    return True


def error_record(value,ids,joint_id):
    keys(value,("name","code","message"));need(value["name"] == "PhysicsError" and type(value["code"]) is str and type(value["message"]) is str)
    allowed = {"unsafe joint reaction","private hinge motor diagnostics are invalid","private hinge velocity archived pose is invalid","private hinge velocity result is invalid",
        "private hinge velocity linear data is invalid","private hinge velocity system is singular or unsafe","private hinge velocity certificate is invalid",joint_id+" exceeded motor reaction limit"}
    for identifier in ids:
        allowed.update(identifier+suffix for suffix in (" exceeded angular movement limit"," exceeded step displacement limit"," position exceeded bounds"," velocity exceeded bounds"," angularVelocity exceeded bounds"," orientation exceeded tolerance"))
    need(value["code"] == "NUMERIC_LIMIT" and value["message"] in allowed)
    return value


def actions_shape(value,ids):
    need(type(value) is list and len(value) == 2)
    for action,identifier in zip(value,ids):
        keys(action,("bodyId","torqueNm","angularImpulseNms"));need(action["bodyId"] == identifier)
        for field in ("torqueNm","angularImpulseNms"):
            if action[field] is not None:
                vector(action[field])


def motor_shape(value):
    keys(value,MOTOR_KEYS);vector(value["limitRad"],2);need(type(value["blocked"]) is bool)
    for key in MOTOR_KEYS:
        if key not in ("limitRad","blocked"):
            finite(value[key])


def report_shape(value,ids,joint_id):
    keys(value,REPORT_KEYS);need(value["id"] == joint_id and value["aId"] == ids[0] and value["bId"] == ids[1] and value["kind"] == "hinge")
    finite(value["angleRad"]);finite(value["motorImpulseNms"]);vector(value["linearImpulseNs"]);vector(value["angularImpulseNms"])


def correction_shape(value,ids):
    need(type(value) is list and len(value) == 2)
    for correction,identifier in zip(value,ids):
        keys(correction,("bodyId","linearImpulseNs","angularImpulseNms"));need(correction["bodyId"] == identifier)
        vector(correction["linearImpulseNs"]);vector(correction["angularImpulseNms"])


def work_shape(value):
    keys(value,WORK_KEYS);vector(value["externalAngularByBodyJ"],2)
    for field in WORK_KEYS:
        if field != "externalAngularByBodyJ":
            finite(value[field])


def energy_shape(value):
    keys(value,ENERGY_KEYS)
    for item in value.values():
        finite(item)


def cap_shape(value):
    keys(value,CAP_KEYS);finite(value["angularReactionNormNms"]);finite(value["maxReactionNms"]);need(type(value["exceedsCap"]) is bool)


def calls_shape(value):
    keys(value,("motorCalls","projectionCalls"));integer(value["motorCalls"],1);integer(value["projectionCalls"],1)


def projection_shape(value):
    keys(value,("bodies","poseReport","diagnostics"));need(type(value["bodies"]) is list and len(value["bodies"]) == 2)
    keys(value["poseReport"],("jointId","finalAngleRad","targetAngleRad"));need(type(value["poseReport"]["jointId"]) is str)
    finite(value["poseReport"]["finalAngleRad"]);finite(value["poseReport"]["targetAngleRad"]);need(type(value["diagnostics"]) is dict);tree(value)


def payload_shape(value,attempt,ids,joint_id):
    keys(value,ATTEMPT_KEYS if attempt else DIAGNOSTIC_KEYS)
    if attempt:
        need(type(value["stage"]) is str and value["stage"] in STAGES)
        if value["error"] is not None:
            error_record(value["error"],ids,joint_id)
    else:
        for field in ("rawSourceAngleRad","rawFreeAngleRad","rawFinalAngleRad"):
            finite(value[field])
        keys(value["metrics"],LABELS)
        for data in value["metrics"].values():
            keys(data,pair_metrics_dummy_keys());tree(data)
    integer(value["sourceStepIndex"],3600);finite(value["sourceTimeSeconds"]);finite(value["acceptedReportAngleRad"]);actions_shape(value["parsedActions"],ids)
    keys(value["frames"],FRAME_KEYS);need(value["frames"]["sourceBodies"] is not None)
    for frame in value["frames"].values():
        if frame is not None:
            need(type(frame) is list and len(frame) == 2)
    for field,check in (("motor",motor_shape),("projection",projection_shape),("jointReport",lambda x:report_shape(x,ids,joint_id)),("bodyCorrections",lambda x:correction_shape(x,ids)),("energyByPhase",energy_shape),("work",work_shape),("reportCap",cap_shape)):
        if field == "jointReport" and not attempt:
            # RETURN report is separately validated at output top-level.
            continue
        if value[field] is not None:
            check(value[field])
        elif not attempt:
            need(False)
    calls_shape(value["calls"])


def pair_metrics_dummy_keys():
    return ("relativeAngleRad","anchorAM","anchorBM","anchorGapM","axisDeviationRad","quaternionNormError","limitExcessRad","centerOfMassM","linearMomentumVectorKgMps",
        "orbitalAngularMomentumVectorKgM2ps","spinAngularMomentumVectorKgM2ps","angularMomentumVectorKgM2ps","energyJ","anchorVelocityAMps","anchorVelocityBMps","anchorRelativeVelocityMps","relativeAngularVelocityRadps")


def delta(a,b):
    if type(b) in (list,tuple):
        need(type(a) is list and len(a) == len(b))
        return max((delta(x,y) for x,y in zip(a,b)),default=0.0)
    return abs(finite(a)-finite(PARENT.public(b)))


def bits_fields(a,b,fields):
    return all(bits(x) == bits(y) for left,right in zip(a,b) for field in fields for x,y in zip(left[field],right[field]))


def frame_error(actual,expected):
    fields = {"positionM":"positionM","quaternion":"orientation","velocityMps":"velocityMps","angularVelocityRadps":"angularVelocityRadps"}
    result = {name:max(delta(a[field],b[field]) for a,b in zip(actual,expected)) for name,field in fields.items()}
    def metadata(body):
        return {key:value for key,value in body.items() if key not in dict(FIELDS)}
    result["metadataMatch"] = all(metadata(a) == metadata(b) and bits(a["inertiaKgM2"]) == bits(b["inertiaKgM2"]) and bits(a["inverseMass"]) == bits(b["inverseMass"])
        and all(bits(x)==bits(y) for x,y in zip(a["inverseInertiaLocal"],b["inverseInertiaLocal"])) for a,b in zip(actual,expected))
    return result


def pair_error(actual,expected):
    # Same inherited diagnostic measurement1e-12, grouped by stated SI units.
    grouping = {"positionM":("anchorAM","anchorBM","anchorGapM","centerOfMassM"),"angleRad":("relativeAngleRad","axisDeviationRad","limitExcessRad"),
        "quaternion":("quaternionNormError",),"velocityMps":("anchorVelocityAMps","anchorVelocityBMps","anchorRelativeVelocityMps"),"angularVelocityRadps":("relativeAngularVelocityRadps",),
        "linearMomentumKgMps":("linearMomentumVectorKgMps",),"angularMomentumKgM2ps":("orbitalAngularMomentumVectorKgM2ps","spinAngularMomentumVectorKgM2ps","angularMomentumVectorKgM2ps"),"energyJ":("energyJ",)}
    return {unit:max(delta(actual[field],expected[field]) for field in fields) for unit,fields in grouping.items()}


def actual_payload(request,ids,joint_id):
    outcome = request["outcome"];attempt = request["attempt"];output = request["output"]
    if outcome == "prediction":
        need(attempt is None and output is None and request["error"] is None and all(request["rawFrames"][key] is None for key in LABELS if key != "source"))
        return None,None,None
    if outcome == "returned":
        need(request["error"] is None);keys(output,("bodies","jointReport","diagnostics"));report_shape(output["jointReport"],ids,joint_id)
        payload_shape(output["diagnostics"],False,ids,joint_id)
        if attempt is not None:
            payload_shape(attempt,True,ids,joint_id);need(attempt["stage"] == "report-ready" and attempt["error"] is None)
        # Report is top-level in RETURN and embedded in an observer attempt.
        # This local comparison view is never a producer key/schema change.
        data = {**output["diagnostics"],"jointReport":output["jointReport"]}
    else:
        need(outcome == "refused" and output is None);error_record(request["error"],ids,joint_id)
        if attempt is None:
            need(all(request["rawFrames"][key] is None for key in LABELS if key != "source"))
            return None,None,None
        payload_shape(attempt,True,ids,joint_id);data = attempt
        cap_message = joint_id+" exceeded motor reaction limit"
        if request["error"]["message"] == cap_message:
            need(data["stage"] == "report-ready" and data["error"] is None)
        else:
            need(data["error"] == request["error"])
    if attempt is not None:
        index = STAGES.index(attempt["stage"])
        for label,threshold in (("angular",1),("motor",2),("free",3),("projected",4)):
            need((attempt["frames"][label+"Bodies"] is not None) == (index >= threshold))
        need((attempt["motor"] is not None) == (index >= 2) and (attempt["projection"] is not None) == (index >= 4))
        for field in ("jointReport","bodyCorrections","energyByPhase","work","reportCap"):
            need((attempt[field] is not None) == (index >= 5))
    restored = {}
    for label in LABELS:
        frame = data["frames"][label+"Bodies"];hexadecimal = request["rawFrames"][label]
        need((frame is None) == (hexadecimal is None))
        if frame is not None:
            restored[label] = restore(frame,hexadecimal,True);need([b["id"] for b in restored[label]] == ids)
    if data["projection"] is not None:
        projected_copy = restore(data["projection"]["bodies"],request["rawFrames"]["projected"],True)
        need([b["id"] for b in projected_copy] == ids)
    if output is not None:
        restore(output["bodies"],request["rawFrames"]["projected"],True)
    if attempt is not None and output is not None:
        for label in LABELS:
            restore(attempt["frames"][label+"Bodies"],request["rawFrames"][label],True)
    return data,restored,output


def empty_metrics(precision):
    return {"actualCompared":False,"checks":{key:None for key in CHECK_KEYS},"frameErrors":{key:None for key in LABELS},"motorError":None,"reportError":None,"workError":None,
        "pairMetricErrors":{key:None for key in LABELS},"precision":precision}


def comparison(request,reference,inherited,observed,precision):
    metrics = empty_metrics(precision);checks = metrics["checks"];checks["sourceRawMatchesInput"] = True;checks["commandsRawMatchesInput"] = True
    checks["parentPredictionQualified"] = parent_prediction_qualified(inherited)
    config = request["config"];joint = config["joints"][0];ids = [b["id"] for b in reference["frames"]["sourceBodies"]];joint_id = joint["id"]
    data,actual,output = actual_payload(request,ids,joint_id);violations = []
    if checks["parentPredictionQualified"] is False:
        violations.append("independent parent prediction failed its original physical gates")
    if reference["work"] is not None and abs(reference["work"]["motorResidualJ"]) > 1e-12:
        violations.append("independent signed motor midpoint balance exceeds 1e-12 J")
    own_free = reference["frames"]["freeBodies"]
    if own_free is not None and inherited is not None and reference["parent"]["mode"] != "refused":
        parent_input = parent_request(config,request["carrier"],own_free)
        if data is not None and data["projection"] is not None:
            parent_input.update(output=copy.deepcopy(data["projection"]),afterRawHex=request["rawFrames"]["projected"])
            mode = "comparison"
        else:
            mode = "prediction"
        try:
            reply = PARENT.evaluate_physical(parent_input)
        except PARENT.ReferenceSystemError as error:
            reference["parent"] = {"mode":"refused","reply":None,"refusal":{"code":"REFERENCE_SYSTEM","message":str(error)}}
            raise ReferenceUnresolved("independent parent comparison system is unresolved") from None
        reference["parent"] = {"mode":mode,"reply":reply,"refusal":None}
        if reply["resolved"] is not True:
            raise ReferenceUnresolved("inherited parent precision or model is unresolved")
        if mode == "comparison":
            checks["parentActualQualified"] = reply["ok"] is True and reply["metrics"]["actualNativeCertificatePassed"] is True and reply["metrics"]["actualFrameCertificatePassed"] is True
        if reply["violations"]:
            violations.extend("parent: "+value for value in reply["violations"])
    if request["outcome"] == "prediction":
        status = "CAP_REFUSAL" if reference["expectedRefusal"] is not None and reference["expectedRefusal"]["message"] == joint_id+" exceeded motor reaction limit" else "PRODUCER_REFUSAL" if reference["expectedRefusal"] is not None else "RETURN"
        return metrics,violations,status
    metrics["actualCompared"] = True
    expected_error = None if reference["expectedRefusal"] is None else {key:reference["expectedRefusal"][key] for key in ("name","code","message")}
    checks["actualErrorMatch"] = request["error"] == expected_error
    checks["actualOutcomeMatch"] = (request["outcome"] == "returned") == (expected_error is None)
    if not checks["actualOutcomeMatch"] or not checks["actualErrorMatch"]:
        violations.append("actual first disposition/error differs from independent prediction")
    if data is None:
        violations.append("actual numerical case has no reached attempt/output")
        return metrics,violations,"MISMATCH"
    checks["sourceCursorRetained"] = data["sourceStepIndex"] == reference["authority"]["sourceStepIndex"] and data["sourceTimeSeconds"] == reference["authority"]["sourceTimeSeconds"]
    checks["acceptedReportAuthorityMatch"] = data["acceptedReportAngleRad"] == reference["authority"]["acceptedReportAngleRad"]
    checks["parsedActionsMatch"] = data["parsedActions"] == reference["parsedActions"]
    checks["callsMatch"] = data["calls"] == reference["calls"]
    held = True;zero_match = True
    for label,actual_frame in actual.items():
        expected = reference["frames"][label+"Bodies"]
        if expected is None:
            violations.append("actual frame reached beyond independent stage: "+label);continue
        error = frame_error(actual_frame,expected);metrics["frameErrors"][label] = error
        omega_gate = 1e-9 if label == "projected" else 1e-10
        for field,gate in (("positionM",1e-12),("quaternion",1e-12),("velocityMps",1e-10),("angularVelocityRadps",omega_gate)):
            if error[field] > gate:
                violations.append(label+" "+field+" agreement exceeds frozen gate")
        if not error["metadataMatch"]:
            violations.append(label+" metadata differs from original rest metadata")
        if label != "projected":
            for a,b in zip(actual_frame,expected):
                for field,_ in FIELDS:
                    for x,y in zip(a[field],b[field]):
                        if x == y == 0:
                            zero_match = zero_match and bits(x) == bits(y)
    if "source" in actual:
        checks["sourceRawMatchesInput"] = request["rawFrames"]["source"].lower() == reference["rawFrames"]["source"].lower()
    for label,previous in (("angular","source"),("motor","angular")):
        if label in actual and previous in actual:
            held = held and bits_fields(actual[label],actual[previous],("positionM","orientation","velocityMps"))
    if "free" in actual and "motor" in actual:
        for a,b in zip(actual["motor"],actual["free"]):
            if math.hypot(*a["angularVelocityRadps"]) == 0:
                held = held and all(bits(x)==bits(y) for x,y in zip(a["orientation"],b["orientation"]))
    if "projected" in actual and "free" in actual and data["projection"] is not None:
        result = data["projection"]["diagnostics"].get("projection",{}).get("result",{})
        if result.get("identity") is True:
            held = held and bits_fields(actual["free"],actual["projected"],("velocityMps","angularVelocityRadps"))
    checks["heldFrameBitsMatch"] = held;checks["namedZeroSignsMatch"] = zero_match
    if output is not None:
        checks["outputAttemptCorrespondence"] = True if request["attempt"] is None else all(request["attempt"][field] == data[field] for field in ATTEMPT_KEYS if field not in ("stage","error"))
        checks["outputAttemptCorrespondence"] = checks["outputAttemptCorrespondence"] and output["jointReport"] == data["jointReport"] and output["bodies"] == data["frames"]["projectedBodies"] and data["projection"]["bodies"] == data["frames"]["projectedBodies"]
        for field,expected_angle in (("rawSourceAngleRad",reference["authority"]["rawSourceAngleRad"]),("rawFreeAngleRad",reference["authority"]["rawFreeAngleRad"]),("rawFinalAngleRad",reference["authority"]["rawFinalAngleRad"])):
            if delta(data[field],expected_angle) > 1e-12:
                violations.append(field+" diagnostic differs from independent scalar angle")
        for label in LABELS:
            error = pair_error(data["metrics"][label],observed[label]["raw"]);metrics["pairMetricErrors"][label] = error
            if any(x > 1e-12 for x in error.values()):
                violations.append(label+" original pair metric diagnostic differs by more than 1e-12")
    if data["motor"] is not None:
        wanted = reference["motor"]
        if wanted is None:
            violations.append("actual motor reached beyond independent stage")
        else:
            motor = data["motor"];error = {"inputAngleMatch":motor["inputAngleRad"] == wanted["inputAngleRad"],"blockedMatch":motor["blocked"] == wanted["blocked"],
                "impulseNms":delta(motor["impulseNms"],wanted["impulseNms"]),"relativeSpeedBeforeRadps":delta(motor["relativeSpeedBeforeRadps"],wanted["relativeSpeedBeforeRadps"]),
                "relativeSpeedAfterRadps":delta(motor["relativeSpeedAfterRadps"],wanted["relativeSpeedAfterRadps"])};metrics["motorError"] = error
            if not error["inputAngleMatch"] or not error["blockedMatch"] or error["impulseNms"] > 1e-12 or error["relativeSpeedBeforeRadps"] > 1e-10 or error["relativeSpeedAfterRadps"] > 1e-10 or motor["targetSpeedRadps"] != wanted["targetSpeedRadps"] or motor["limitRad"] != wanted["limitRad"] or motor["maxImpulseNms"] != wanted["maxImpulseNms"]:
                violations.append("motor authority/metadata/branch/impulse/speed differs from independent prediction")
    if data["jointReport"] is not None:
        if reference["jointReport"] is None or reference["bodyCorrections"] is None:
            violations.append("actual report reached beyond independent stage")
        else:
            report = data["jointReport"];wanted = reference["jointReport"];corr = data["bodyCorrections"];free = actual["free"];projected = actual["projected"]
            recomputed = [{"bodyId":a["id"],"linearImpulseNs":scale(sub(b["velocityMps"],a["velocityMps"]),1.0/a["inverseMass"]),"angularImpulseNms":scale(sub(b["angularVelocityRadps"],a["angularVelocityRadps"]),a["inertiaKgM2"])} for a,b in zip(free,projected)]
            error = {"angleRad":delta(report["angleRad"],wanted["angleRad"]),"linearImpulseNs":max(delta(report["linearImpulseNs"],wanted["linearImpulseNs"]),delta(report["linearImpulseNs"],recomputed[1]["linearImpulseNs"])),
                "angularImpulseNms":max(delta(report["angularImpulseNms"],wanted["angularImpulseNms"]),delta(report["angularImpulseNms"],recomputed[1]["angularImpulseNms"])),
                "motorImpulseNms":delta(report["motorImpulseNms"],wanted["motorImpulseNms"]),
                "bodyLinearImpulseNs":max(max(delta(a["linearImpulseNs"],b["linearImpulseNs"]) for a,b in zip(corr,reference["bodyCorrections"])),max(delta(a["linearImpulseNs"],b["linearImpulseNs"]) for a,b in zip(corr,recomputed))),
                "bodyAngularImpulseNms":max(max(delta(a["angularImpulseNms"],b["angularImpulseNms"]) for a,b in zip(corr,reference["bodyCorrections"])),max(delta(a["angularImpulseNms"],b["angularImpulseNms"]) for a,b in zip(corr,recomputed))),
                "angularReactionNormNms":max(delta(data["reportCap"]["angularReactionNormNms"],reference["reportCap"]["angularReactionNormNms"]),abs(finite(data["reportCap"]["angularReactionNormNms"])-math.hypot(*recomputed[1]["angularImpulseNms"])))}
            metrics["reportError"] = error;checks["jointReportIdentityMatch"] = report["id"] == joint_id and report["kind"] == "hinge" and report["aId"] == ids[0] and report["bId"] == ids[1]
            checks["targetAngleAuthorityMatch"] = report["angleRad"] == data["projection"]["poseReport"]["targetAngleRad"]
            actual_cap = math.hypot(*recomputed[1]["angularImpulseNms"])>.01
            checks["capDecisionMatch"] = data["reportCap"]["maxReactionNms"] == .01 and data["reportCap"]["exceedsCap"] == actual_cap == reference["reportCap"]["exceedsCap"] and (math.hypot(*report["angularImpulseNms"])>.01) == actual_cap
            for key,value in error.items():
                if value > (1e-9 if key == "angleRad" else 1e-12):
                    violations.append(key+" report comparison exceeds frozen impulse/angle gate")
    if data["work"] is not None:
        if reference["work"] is None or reference["energyByPhase"] is None:
            violations.append("actual work reached beyond independent stage")
        else:
            error = {key:delta(data["work"][key],reference["work"][key]) for key in WORK_KEYS}
            error["energyByPhaseJ"] = max(delta(data["energyByPhase"][key],reference["energyByPhase"][key]) for key in ENERGY_KEYS)
            error["motorBalanceResidualJ"] = abs(finite(data["work"]["motorSpinMidpointJ"])-finite(data["work"]["motorMidpointJ"]))
            metrics["workError"] = error;checks["finiteSignedWork"] = True;checks["nonnegativeEnergiesAndObjective"] = all(finite(x)>=0 for x in data["energyByPhase"].values()) and data["work"]["projectionObjectiveJ"]>=0
            for key,value in error.items():
                if value > (1e-10 if key == "projectionObjectiveJ" else 1e-12):
                    violations.append(key+" work comparison exceeds frozen J gate")
            if data["work"]["motorResidualJ"] != data["work"]["motorSpinMidpointJ"]-data["work"]["motorMidpointJ"]:
                violations.append("reported signed motor residual differs from its original subtraction")
    for key,value in checks.items():
        if value is False:
            violations.append(key+" is false")
    status = "CAP_REFUSAL" if expected_error is not None and expected_error["message"] == joint_id+" exceeded motor reaction limit" else "PRODUCER_REFUSAL" if expected_error is not None else "RETURN"
    return metrics,violations,"MISMATCH" if violations else status


def envelope(code,message):
    return {"ok":False,"resolved":False,"executionFailure":True,"referenceStatus":"UNRESOLVED","metrics":None,"reference":None,"violations":[],"error":{"code":code,"message":message}}


def evaluate(request):
    keys(request,("op","config","carrier","dt","commands","commandsRawHex","outcome","attempt","output","error","rawFrames"))
    need(request["op"] == "evaluate" and type(request["outcome"]) is str and request["outcome"] in ("prediction","returned","refused"));keys(request["rawFrames"],LABELS)
    # Expected math is complete before reading any actual producer payload.
    low,low_parent = predict(request,80);high,high_parent = predict(request,120)
    low_obs = observations(low,request["config"],80);high_obs = observations(high,request["config"],120)
    precision = precision_report(low,high,low_parent,high_parent,low_obs,high_obs)
    if not precision["algebraResolved"] or not precision["scalarResolved"]:
        return {"ok":False,"resolved":False,"executionFailure":True,"referenceStatus":"UNRESOLVED","metrics":None,"reference":high,"violations":["independent staged precision or binary parent model is unresolved"],"error":None}
    metrics,violations,status = comparison(request,high,high_parent,high_obs,precision)
    return {"ok":not violations,"resolved":True,"executionFailure":False,"referenceStatus":status,"metrics":metrics,"reference":high,"violations":violations,"error":None}


def main():
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            request = json.loads(line,parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
        except (json.JSONDecodeError,ValueError):
            reply = envelope("REFERENCE_JSON",JSON_MESSAGE)
        else:
            try:
                reply = evaluate(request)
            except (ReferenceInputError,PARENT.ReferenceInputError,PARENT.POSE.ReferenceInputError,PARENT.OLD.ReferenceInputError):
                reply = envelope("REFERENCE_INPUT",INPUT_MESSAGE)
            except ReferenceUnresolved as error:
                reply = {"ok":False,"resolved":False,"executionFailure":True,"referenceStatus":"UNRESOLVED","metrics":None,"reference":None,"violations":[str(error)],"error":None}
        print(json.dumps(reply,allow_nan=False,separators=(",",":")),flush=True)


if __name__ == "__main__":
    main()
