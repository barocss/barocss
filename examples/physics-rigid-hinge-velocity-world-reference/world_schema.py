"""Strict World wire admission; imports only adopted independent Python helpers."""
import copy
import importlib.util
import math
from pathlib import Path
import struct
import sys

sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location("adopted_motor_reference", Path(__file__).resolve().parent.parent / "physics-rigid-hinge-motor-reference" / "reference.py")
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)
P = M.PARENT
DT = 1 / 120
IDS = ("pairA0", "pairB0", "pairA1", "pairB1")
JIDS = ("hinge0", "hinge1")
PHASES = ("source", "angular", "motor", "free", "postContact", "projected")
STAGES = ("admitted", "angular-ready", "motor-ready", "free-ready", "contact-ready", "pair0-ready", "pair1-ready", "report-ready")
FIELDS = M.FIELDS
STATE_KEYS = ("stepIndex", "timeSeconds", "bodies", "contacts", "events", "joints", "ccdHits", "pairStats")
PAIR_KEYS = ("jointId", "aId", "bId", "acceptedReportAngleRad", "rawSourceAngleRad", "rawFreeAngleRad", "rawPostContactAngleRad", "rawFinalAngleRad", "parsedActions", "motor", "projection", "jointReport", "bodyCorrections", "energyByPhase", "work", "reportCap", "metrics", "calls")
DIAG_KEYS = ("sourceStepIndex", "sourceTimeSeconds", "acceptedStepIndex", "acceptedTimeSeconds", "fixedStepSeconds", "frames", "pairs", "contactPasses", "pairStats", "calls", "contactChecks")
ATTEMPT_KEYS = ("stage", "sourceStepIndex", "sourceTimeSeconds", "attemptedStepIndex", "attemptedTimeSeconds", "acceptedReportAnglesRad", "parsedActions", "frames", "pairs", "pairProgress", "contactPasses", "pairStats", "calls", "contactChecks", "error")
GLOBAL_CALLS = ("angularUpdates", "freeIntegrations", "motorCalls", "projectionCalls", "reportCalls")
PAIR_CALLS = ("motorCalls", "projectionCalls", "reportCalls")
INPUT_MESSAGE = "hinge world reference input is invalid"


class InputError(ValueError):
    pass


class Unresolved(ValueError):
    pass


def need(value):
    if not value:
        raise InputError(INPUT_MESSAGE)


def keys(value, names):
    need(type(value) is dict and set(value) == set(names))


def finite(value):
    need(type(value) in (int, float))
    try:
        result = float(value)
    except OverflowError:
        raise InputError(INPUT_MESSAGE) from None
    need(math.isfinite(result))
    return result


def integer(value, maximum=3600):
    number = finite(value)
    need(0 <= number <= maximum and number == int(number))
    return int(number)


def vector(value, size=3):
    need(type(value) is list and len(value) == size)
    return [finite(x) for x in value]


def tree(value):
    if type(value) in (int, float):
        finite(value)
    elif type(value) is list:
        for item in value:
            tree(item)
    elif type(value) is dict:
        for key, item in value.items():
            need(type(key) is str)
            tree(item)
    else:
        need(value is None or type(value) in (str, bool))


def bits(value):
    return struct.pack("<d", finite(value))


def raw(bodies):
    return b"".join(bits(x) for body in bodies for field, size in FIELDS for x in vector(body[field], size)).hex()


def restore(bodies, hexadecimal, count=4, internal=False):
    need(type(bodies) is list and len(bodies) == count and all(type(b) is dict for b in bodies))
    need(type(hexadecimal) is str and len(hexadecimal) == count * 208 and all(c in "0123456789abcdef" for c in hexadecimal))
    words = struct.unpack("<" + str(count * 13) + "d", bytes.fromhex(hexadecimal))
    result = copy.deepcopy(bodies)
    cursor = 0
    for body in result:
        if internal:
            keys(body, M.BODY_KEYS)
            vector(body["inverseInertiaLocal"])
            for field in ("inertiaKgM2", "inverseMass", "restitution", "frictionStatic", "frictionDynamic"):
                finite(body[field])
            need(body["sensor"] is False)
        else:
            keys(body, ("id", "kind", "shape", "positionM", "velocityMps", "orientation", "angularVelocityRadps", "inertiaKgM2"))
            finite(body["inertiaKgM2"])
        keys(body["shape"], ("kind", "radiusM"))
        need(body["kind"] == "dynamic" and body["shape"]["kind"] == "sphere" and finite(body["shape"]["radiusM"]) == .1)
        for field, size in FIELDS:
            original = vector(body[field], size)
            decoded = list(words[cursor:cursor + size]);cursor += size
            need(all(math.isfinite(x) and x == y and (y != 0 or bits(x) == bits(y)) for x, y in zip(decoded, original)))
            body[field] = decoded
    return result


def restore_pointers(request):
    proofs = request["negativeZeroPaths"]
    keys(proofs, ("sourceState", "commands", "attempt", "output"))
    for root, paths in proofs.items():
        need(type(paths) is list and all(type(x) is str for x in paths) and len(set(paths)) == len(paths))
        data = request.get(root)
        if data is None:
            need(paths == [])
        for pointer in paths:
            need(pointer.startswith("/") and "\x00" not in pointer)
            components = []
            for part in pointer[1:].split("/"):
                need(all(part[i + 1:i + 2] in ("0", "1") for i, c in enumerate(part) if c == "~"))
                components.append(part.replace("~1", "/").replace("~0", "~"))
            owner = data
            for index, component in enumerate(components):
                if type(owner) is list:
                    need(component == "0" or component.isdigit() and not component.startswith("0"))
                    key = int(component);need(key < len(owner))
                else:
                    need(type(owner) is dict and component in owner and component not in ("__proto__", "prototype", "constructor"))
                    key = component
                if index == len(components) - 1:
                    need(finite(owner[key]) == 0)
                    owner[key] = -0.0
                else:
                    owner = owner[key]


def state_shape(state):
    keys(state, STATE_KEYS)
    n = integer(state["stepIndex"])
    need(finite(state["timeSeconds"]) == n * DT)
    need(type(state["bodies"]) is list and len(state["bodies"]) == 4 and [b.get("id") if type(b) is dict else None for b in state["bodies"]] == list(IDS))
    need(type(state["joints"]) is list and len(state["joints"]) == 2)
    for i, joint in enumerate(state["joints"]):
        keys(joint, ("id", "kind", "aId", "bId", "linearImpulseNs", "angularImpulseNms", "angleRad", "motorImpulseNms"))
        need(joint["id"] == JIDS[i] and joint["kind"] == "hinge" and joint["aId"] == IDS[2 * i] and joint["bId"] == IDS[2 * i + 1])
        vector(joint["linearImpulseNs"]);vector(joint["angularImpulseNms"])
        finite(joint["angleRad"]);finite(joint["motorImpulseNms"])
    for field in ("contacts", "events", "ccdHits"):
        need(type(state[field]) is list)
        tree(state[field])
    keys(state["pairStats"], ("eligiblePairs", "candidatePairs", "aabbTests"))
    for number in state["pairStats"].values():
        integer(number, 1000000)
    return n


def pair_input(config, state, bodies, index):
    start = 2 * index
    pair_config = {**copy.deepcopy(config), "bodies":copy.deepcopy(config["bodies"][start:start + 2]), "joints":[copy.deepcopy(config["joints"][index])]}
    carrier = {**copy.deepcopy(state), "bodies":copy.deepcopy(bodies[start:start + 2]), "joints":[copy.deepcopy(state["joints"][index])], "contacts":[], "events":[], "ccdHits":[], "pairStats":{"eligiblePairs":0, "candidatePairs":0, "aabbTests":0}}
    return {"config":pair_config, "carrier":carrier, "dt":DT, "rawFrames":{"source":raw(carrier["bodies"])}}


def source_input(request):
    config, state = request["config"], request["sourceState"]
    keys(config, ("fixedStepSeconds", "gravityMps2", "bodies", "joints"))
    need(finite(config["fixedStepSeconds"]) == DT and vector(config["gravityMps2"]) == [0, 0, 0])
    need(type(config["bodies"]) is list and len(config["bodies"]) == 4 and type(config["joints"]) is list and len(config["joints"]) == 2)
    n = state_shape(state)
    hexadecimal = request["sourceRawHex"] if request["op"] == "initial" else request["rawFrames"]["source"]
    restored = restore(state["bodies"], hexadecimal)
    parsed = [];inputs = []
    for i in range(2):
        pair = pair_input(config, state, restored, i)
        cfg, carrier, internal, memory, origin, limits = M.source_input(pair)
        need(cfg["joints"][0]["id"] == JIDS[i])
        for j, body in enumerate(cfg["bodies"]):
            need(body["id"] == IDS[2 * i + j] and vector(body["positionM"]) == [-.1 if j == 0 else .1, 0, i])
            need(set(body) <= {"id", "kind", "shape", "positionM", "velocityMps", "massKg", "restitution", "friction", "orientation", "angularVelocityRadps"})
            need(finite(body["massKg"]) == 1 and finite(body["restitution"]) == 0 and vector(body["velocityMps"]) == [0, 0, 0])
            need(vector(body.get("angularVelocityRadps", [0, 0, 0])) == [0, 0, 0] and vector(body.get("orientation", [0, 0, 0, 1]), 4) == [0, 0, 0, 1])
            need(finite(body["friction"]["static"]) == 1 and finite(body["friction"]["dynamic"]) == .7)
        joint = cfg["joints"][0]
        need(vector(joint["anchorALocalM"]) == [.1, 0, 0] and vector(joint["anchorBLocalM"]) == [-.1, 0, 0] and vector(joint["axisWorld"]) == [0, 0, 1] and vector(joint["limitRad"], 2) == [-.8, .8])
        need(finite(joint["motor"]["targetSpeedRadps"]) == .5 and finite(joint["motor"]["maxImpulseNms"]) == .0001 and finite(joint["motor"]["maxReactionNms"]) == .01)
        parsed += internal;inputs.append(pair)
    need([b["id"] for b in parsed] == list(IDS))
    need(state["contacts"] == [] and state["events"] == [] and state["ccdHits"] == [])
    if n == 0:
        need(state["pairStats"] == {"eligiblePairs":0, "candidatePairs":0, "aabbTests":0})
    else:
        need(state["pairStats"] == {"eligiblePairs":32, "candidatePairs":32, "aabbTests":0})
    return parsed, inputs


def known_error(error):
    keys(error, ("name", "code", "message"))
    need(error["name"] == "PhysicsError" and type(error["code"]) is str and type(error["message"]) is str)
    numeric = {"contact penetration exceeded limit", "unsafe contact result", "unsafe joint reaction", "private hinge velocity World contact profile is unsupported", "private hinge velocity World diagnostics are invalid", "private hinge velocity World result is invalid", "private hinge velocity archived pose is invalid", "private hinge velocity result is invalid", "private hinge velocity linear data is invalid", "private hinge velocity system is singular or unsafe", "private hinge velocity certificate is invalid"}
    for identifier in IDS:
        numeric.update(identifier + suffix for suffix in (" exceeded angular movement limit", " exceeded step displacement limit", " position exceeded bounds", " velocity exceeded bounds", " angularVelocity exceeded bounds", " orientation exceeded tolerance"))
    numeric.update(joint + " exceeded motor reaction limit" for joint in JIDS)
    need(error["code"] == "NUMERIC_LIMIT" and error["message"] in numeric or (error["code"], error["message"]) in (("INVALID_STEP", "step must equal configured fixedStepSeconds"), ("WORLD_LIMIT", "world step limit reached"), ("INVALID_STEP", "private hinge velocity step must equal 1/120"), ("INVALID_CONFIG", "private hinge velocity profile is unsupported")))


def calls_shape(value, pair=False):
    keys(value, PAIR_CALLS if pair else GLOBAL_CALLS)
    for field, number in value.items():
        integer(number, 1 if pair else 4 if field in ("angularUpdates", "freeIntegrations") else 2)


def frames_shape(frames):
    keys(frames, tuple(p + "Bodies" for p in PHASES))
    for value in frames.values():
        if value is not None:
            need(type(value) is list and len(value) == 4)
            tree(value)


def pair_diagnostic(value, index):
    keys(value, PAIR_KEYS)
    ids = IDS[2 * index:2 * index + 2]
    need(value["jointId"] == JIDS[index] and value["aId"] == ids[0] and value["bId"] == ids[1])
    for field in ("acceptedReportAngleRad", "rawSourceAngleRad", "rawFreeAngleRad", "rawPostContactAngleRad", "rawFinalAngleRad"):
        finite(value[field])
    M.actions_shape(value["parsedActions"], ids);M.motor_shape(value["motor"]);M.projection_shape(value["projection"])
    M.report_shape(value["jointReport"], ids, JIDS[index]);M.correction_shape(value["bodyCorrections"], ids);M.cap_shape(value["reportCap"])
    keys(value["energyByPhase"], tuple(phase + "J" for phase in PHASES))
    for number in value["energyByPhase"].values():
        finite(number)
    keys(value["work"], M.WORK_KEYS + ("contactDeltaKJ",))
    vector(value["work"]["externalAngularByBodyJ"], 2)
    for field, number in value["work"].items():
        if field != "externalAngularByBodyJ":
            finite(number)
    keys(value["metrics"], PHASES)
    for measurement in value["metrics"].values():
        keys(measurement, M.pair_metrics_dummy_keys())
        for field, number in measurement.items():
            if field in ("relativeAngleRad", "anchorGapM", "axisDeviationRad", "quaternionNormError", "limitExcessRad", "energyJ"):
                finite(number)
            else:
                vector(number)
    calls_shape(value["calls"], True)


def actual_shape(request):
    attempt, output = request["attempt"], request["output"]
    if request["outcome"] == "returned":
        need(request["error"] is None)
        keys(output, ("state", "diagnostics"));state_shape(output["state"])
        keys(output["diagnostics"], DIAG_KEYS)
        data = output["diagnostics"]
    else:
        need(output is None);known_error(request["error"])
        data = attempt
    if attempt is not None:
        keys(attempt, ATTEMPT_KEYS);need(attempt["stage"] in STAGES)
        integer(attempt["sourceStepIndex"]);finite(attempt["sourceTimeSeconds"])
        integer(attempt["attemptedStepIndex"], 3601);finite(attempt["attemptedTimeSeconds"])
        vector(attempt["acceptedReportAnglesRad"], 2)
        need(type(attempt["parsedActions"]) is list and len(attempt["parsedActions"]) == 4)
        for i in range(2):
            M.actions_shape(attempt["parsedActions"][2 * i:2 * i + 2], IDS[2 * i:2 * i + 2])
        level = STAGES.index(attempt["stage"])
        frames_shape(attempt["frames"])
        for phase, threshold in (("angular", 1), ("motor", 2), ("free", 3), ("postContact", 4), ("projected", 6)):
            need((attempt["frames"][phase + "Bodies"] is not None) == (level >= threshold))
        if attempt["error"] is not None:
            known_error(attempt["error"])
        need(type(attempt["pairProgress"]) is list and len(attempt["pairProgress"]) == 2)
        for i, progress in enumerate(attempt["pairProgress"]):
            keys(progress, ("jointId", "motor", "projection", "report", "calls", "completedCalls", "lastCall", "projectedRawHex"))
            need(progress["jointId"] == JIDS[i]);calls_shape(progress["calls"], True);calls_shape(progress["completedCalls"], True)
            for op in ("motor", "projection", "report"):
                count = op + "Calls"
                need(progress["completedCalls"][count] <= progress["calls"][count] and (progress[op] is not None) == (progress["completedCalls"][count] == 1))
            if progress["lastCall"] is not None:
                keys(progress["lastCall"], ("operation", "ordinal", "outcome"))
                need(progress["lastCall"]["operation"] in ("motor", "projection", "report") and progress["lastCall"]["ordinal"] == i + 1 and progress["lastCall"]["outcome"] in ("started", "returned", "known-refused"))
            need((progress["projectedRawHex"] is not None) == (progress["projection"] is not None))
            if progress["projection"] is not None:
                M.projection_shape(progress["projection"])
                restore(progress["projection"]["bodies"], progress["projectedRawHex"], 2, True)
            if progress["motor"] is not None:
                M.motor_shape(progress["motor"])
            if progress["report"] is not None:
                keys(progress["report"], ("jointReport", "bodyCorrections", "reportCap"))
                M.report_shape(progress["report"]["jointReport"], IDS[2 * i:2 * i + 2], JIDS[i]);M.correction_shape(progress["report"]["bodyCorrections"], IDS[2 * i:2 * i + 2]);M.cap_shape(progress["report"]["reportCap"])
            need((attempt["pairs"][i] is not None) == (level >= 5 + i))
            if attempt["pairs"][i] is not None:
                need(progress["projection"] is not None and progress["report"] is not None)
    if data is None:
        need(all(request["rawFrames"][phase] is None for phase in PHASES[1:]))
        return None, {}
    frames_shape(data["frames"]);calls_shape(data["calls"])
    keys(data["pairStats"], ("eligiblePairs", "candidatePairs", "aabbTests"))
    for number in data["pairStats"].values():
        integer(number, 1000000)
    if output is not None:
        integer(data["acceptedStepIndex"]);finite(data["acceptedTimeSeconds"]);finite(data["fixedStepSeconds"])
    integer(data["sourceStepIndex"]);finite(data["sourceTimeSeconds"]);integer(data["contactPasses"], 8)
    need(type(data["pairs"]) is list and len(data["pairs"]) == 2)
    restored = {}
    for phase in PHASES:
        frame, hexadecimal = data["frames"][phase + "Bodies"], request["rawFrames"][phase]
        need((frame is None) == (hexadecimal is None))
        if frame is not None:
            restored[phase] = restore(frame, hexadecimal, 4, True)
            need([b["id"] for b in restored[phase]] == list(IDS))
            if attempt is not None:
                restore(attempt["frames"][phase + "Bodies"], hexadecimal, 4, True)
    need("source" in restored)
    for i, pair in enumerate(data["pairs"]):
        if pair is not None:
            pair_diagnostic(pair, i)
    need(type(data["contactChecks"]) is list and len(data["contactChecks"]) <= 32)
    for check in data["contactChecks"]:
        keys(check, ("pass", "pairIndex", "aId", "bId", "aPositionM", "bPositionM", "hit"))
        integer(check["pass"], 7);integer(check["pairIndex"], 3);vector(check["aPositionM"]);vector(check["bPositionM"])
        if check["hit"] is not None:
            keys(check["hit"], ("normal", "penetration", "pointM"));vector(check["hit"]["normal"]);finite(check["hit"]["penetration"]);vector(check["hit"]["pointM"])
    tree(data)
    return data, restored


def admit(request):
    need(type(request) is dict and request.get("op") in ("initial", "world-step"))
    expected = ("op", "config", "sourceState", "sourceRawHex", "negativeZeroPaths") if request["op"] == "initial" else ("op", "config", "sourceState", "dt", "commands", "commandsRawHex", "outcome", "attempt", "output", "error", "rawFrames", "negativeZeroPaths")
    keys(request, expected)
    result = copy.deepcopy(request);restore_pointers(result)
    if result["op"] == "world-step":
        need(finite(result["dt"]) == DT and result["outcome"] in ("returned", "refused"))
        keys(result["rawFrames"], PHASES)
    source, pairs = source_input(result)
    if result["op"] == "initial":
        need(result["sourceState"]["stepIndex"] == 0)
    return result, source, pairs
