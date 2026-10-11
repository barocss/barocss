"""Cold original-input binary leaf stages and unchanged independent pair optimum."""
import copy
from decimal import Decimal, localcontext
import math
from world_schema import M, P, DT, IDS, JIDS, PHASES, FIELDS, finite, vector, need, raw, InputError, Unresolved

CROSS = ((0, 2), (0, 3), (2, 1), (1, 3))


def separation(bodies, a, b):
    points = [tuple(Decimal.from_float(x) for x in bodies[i]["positionM"]) for i in (a, b)]
    delta = tuple(x - y for x, y in zip(points[1], points[0]))
    return sum(x * x for x in delta).sqrt() - Decimal.from_float(.1) * 2


def contact_record(pass_index, pair_index, bodies, a, b, precision):
    with localcontext() as context:
        context.prec = 80;low = separation(bodies, a, b)
        context.prec = 120;high = separation(bodies, a, b)
    return {"pass":pass_index, "pairIndex":pair_index, "aId":IDS[a], "bId":IDS[b], "positionsMatch":None, "hitMatch":None, "noHit":high > 0, "separationRawM":float(high), "separationNormalizedM":float(high), "precisionMaxDifferenceM":float(abs(high - low))}


def measurement(bodies, memory, index, precision):
    with localcontext() as context:
        context.prec = precision
        return P.observed(M.old_bodies(bodies), Decimal.from_float(float(memory)), (Decimal(0), Decimal(0), Decimal(index)), (Decimal.from_float(-.8), Decimal.from_float(.8)))


def store_frame(reference, phase, bodies, precision):
    reference["frames"][phase + "Bodies"] = copy.deepcopy(bodies)
    reference["rawFrames"][phase] = raw(bodies)
    for index in range(2):
        reference["pairs"][index]["phaseMetrics"][phase] = measurement(bodies[2 * index:2 * index + 2], reference["authority"]["acceptedReportAnglesRad"][index], index, precision)


def refusal(reference, message, code="NUMERIC_LIMIT"):
    reference["expectedRefusal"] = {"stage":reference["stage"], "name":"PhysicsError", "code":code, "message":message}
    return reference


def pair_request(pair, incoming):
    return M.parent_request(pair["config"], pair["carrier"], incoming)


def derive(request, source, pair_inputs, precision):
    with localcontext() as context:
        context.prec = precision
        initial = request["op"] == "initial"
        memories = [0.0, 0.0] if initial else [finite(j["angleRad"]) for j in request["sourceState"]["joints"]]
        n = request["sourceState"]["stepIndex"]
        reference = {"stage":"initial" if initial else "admitted", "authority":{"sourceStepIndex":n, "sourceTimeSeconds":n * DT, "attemptedStepIndex":None if initial else n + 1, "attemptedTimeSeconds":None if initial else (n + 1) * DT, "acceptedReportAnglesRad":memories, "rawSourceAnglesRad":[None, None], "rawFreeAnglesRad":[None, None], "rawPostContactAnglesRad":[None, None], "rawFinalAnglesRad":[None, None]}, "parsedActions":[], "frames":{phase + "Bodies":None for phase in PHASES}, "rawFrames":{phase:None for phase in PHASES}, "pairs":[{"jointId":identifier, "motor":None, "jointReport":None, "bodyCorrections":None, "energyByPhase":None, "work":None, "reportCap":None, "phaseMetrics":{phase:None for phase in PHASES}} for identifier in JIDS], "contactChecks":{"passes":[None] * 32, "final":[None] * 4}, "calls":{"angularUpdates":0, "freeIntegrations":0, "motorCalls":0, "projectionCalls":0, "reportCalls":0}, "expectedRefusal":None, "pairReplies":[None, None]}
        models = [None, None];parent_inputs = [None, None]
        working = copy.deepcopy(source)
        if initial:
            for body, original in zip(working, request["config"]["bodies"]):
                body["positionM"] = vector(original["positionM"])
                body["velocityMps"] = vector(original["velocityMps"])
                body["angularVelocityRadps"] = vector(original.get("angularVelocityRadps", [0, 0, 0]))
                quaternion = vector(original.get("orientation", [0, 0, 0, 1]), 4)
                norm = math.hypot(*quaternion)
                body["orientation"] = [x / norm for x in quaternion]
        store_frame(reference, "source", working, precision)
        for index in range(2):
            reference["authority"]["rawSourceAnglesRad"][index] = M.twist(working[2 * index]["orientation"], working[2 * index + 1]["orientation"])
        if initial:
            for pair_index, (a, b) in enumerate(CROSS):
                gap = separation(working, a, b)
                reference["contactChecks"]["final"][pair_index] = contact_record(None, pair_index, working, a, b, precision)
            return reference, models, parent_inputs
        if n >= 3600:
            return refusal(reference, "world step limit reached", "WORLD_LIMIT"), models, parent_inputs
        actions = M.command_actions(request, working)
        reference["parsedActions"] = copy.deepcopy(actions)
        for body, action in zip(working, actions):
            delta = M.add(action["angularImpulseNms"] if action["angularImpulseNms"] is not None else [0.0] * 3, M.scale(action["torqueNm"] if action["torqueNm"] is not None else [0.0] * 3, DT))
            reference["calls"]["angularUpdates"] += 1
            body["angularVelocityRadps"] = M.add(body["angularVelocityRadps"], M.inverse_inertia(body, delta))
        store_frame(reference, "angular", working, precision);reference["stage"] = "angular-ready"
        for index in range(2):
            a, b = working[2 * index:2 * index + 2]
            before = M.dot(M.sub(b["angularVelocityRadps"], a["angularVelocityRadps"]), [0.0, 0.0, 1.0])
            blocked = memories[index] >= .8
            reference["calls"]["motorCalls"] += 1
            j = 0.0
            if not blocked:
                axis = [0.0, 0.0, 1.0]
                inverse_sum = M.dot(axis, M.inverse_inertia(a, axis)) + M.dot(axis, M.inverse_inertia(b, axis))
                if not math.isfinite(inverse_sum) or inverse_sum == 0:
                    raise Unresolved("independent motor inverse inertia is unresolved")
                j = M.clamp((.5 - before) / inverse_sum, -.0001, .0001)
                a["angularVelocityRadps"] = M.sub(a["angularVelocityRadps"], M.inverse_inertia(a, M.scale(axis, j)))
                b["angularVelocityRadps"] = M.add(b["angularVelocityRadps"], M.inverse_inertia(b, M.scale(axis, j)))
            after = M.dot(M.sub(b["angularVelocityRadps"], a["angularVelocityRadps"]), [0.0, 0.0, 1.0])
            reference["pairs"][index]["motor"] = {"inputAngleRad":memories[index], "targetSpeedRadps":.5, "limitRad":[-.8, .8], "maxImpulseNms":.0001, "blocked":blocked, "impulseNms":j, "relativeSpeedBeforeRadps":before, "relativeSpeedAfterRadps":after}
        store_frame(reference, "motor", working, precision);reference["stage"] = "motor-ready"
        for body in working:
            reference["calls"]["freeIntegrations"] += 1
            omega = body["angularVelocityRadps"]
            if any(not math.isfinite(x) or abs(x) > 1000 for x in omega) or math.hypot(*omega) * DT > 10:
                return refusal(reference, body["id"] + " exceeded angular movement limit"), models, parent_inputs
            body["orientation"] = M.advance(body["orientation"], omega, DT)
            for component in range(3):
                body["velocityMps"][component] += 0.0 * body["inverseMass"]
                body["velocityMps"][component] += (0.0 + 0.0 * body["inverseMass"]) * DT
            if math.hypot(*body["velocityMps"]) * DT > 10:
                return refusal(reference, body["id"] + " exceeded step displacement limit"), models, parent_inputs
            for component in range(3):
                body["positionM"][component] += body["velocityMps"][component] * DT
        store_frame(reference, "free", working, precision);reference["stage"] = "free-ready"
        for index in range(2):
            reference["authority"]["rawFreeAnglesRad"][index] = M.twist(working[2 * index]["orientation"], working[2 * index + 1]["orientation"])
        for pass_index in range(8):
            for pair_index, (a, b) in enumerate(CROSS):
                gap = separation(working, a, b)
                if gap <= 0 or math.hypot(*M.sub(working[b]["positionM"], working[a]["positionM"])) <= .1 + .1:
                    # The selected consumer stops at no-contact-profile failure;
                    # candidate contact output never supplies an expected pose.
                    return refusal(reference, "private hinge velocity World contact profile is unsupported"), models, parent_inputs
                reference["contactChecks"]["passes"][pass_index * 4 + pair_index] = contact_record(pass_index, pair_index, working, a, b, precision)
        store_frame(reference, "postContact", working, precision);reference["stage"] = "contact-ready"
        reference["authority"]["rawPostContactAnglesRad"] = reference["authority"]["rawFreeAnglesRad"][:]
        post = copy.deepcopy(working)
        for index in range(2):
            incoming = post[2 * index:2 * index + 2]
            parent_input = pair_request(pair_inputs[index], incoming);parent_inputs[index] = parent_input
            reference["calls"]["projectionCalls"] += 1
            try:
                model = P.at_precision(parent_input, precision)
            except P.ReferenceSystemError:
                return refusal(reference, "private hinge velocity system is singular or unsafe"), models, parent_inputs
            except (P.ReferenceInputError, P.POSE.ReferenceInputError, P.OLD.ReferenceInputError):
                return refusal(reference, "private hinge velocity archived pose is invalid"), models, parent_inputs
            models[index] = model
            projected = copy.deepcopy(incoming)
            for body, wanted in zip(projected, model["expectedBodies"]):
                for field, size in FIELDS:
                    body[field] = [float(x) for x in wanted[field]]
            # Original provider validateResult precedes its successful return.
            # A refused projection does not fabricate a completed raw208 frame.
            for body in projected:
                for field, label, bound in (("positionM", "position", 10000), ("velocityMps", "velocity", 1000), ("angularVelocityRadps", "angularVelocity", 1000)):
                    if any(not math.isfinite(x) or abs(x) > bound for x in body[field]):
                        return refusal(reference, body["id"] + " " + label + " exceeded bounds"), models, parent_inputs
                if any(not math.isfinite(x) for x in body["orientation"]) or abs(math.hypot(*body["orientation"]) - 1) > 1e-12:
                    return refusal(reference, body["id"] + " orientation exceeded tolerance"), models, parent_inputs
            reference["authority"]["rawFinalAnglesRad"][index] = M.twist(projected[0]["orientation"], projected[1]["orientation"])
            reference["pairs"][index]["phaseMetrics"]["projected"] = measurement(projected, model["poseReport"]["targetAngleRad"], index, precision)
            working[2 * index:2 * index + 2] = projected
            reference["calls"]["reportCalls"] += 1
            corrections = [{"bodyId":b["id"], "linearImpulseNs":M.scale(M.sub(b["velocityMps"], a["velocityMps"]), 1.0 / a["inverseMass"]), "angularImpulseNms":M.scale(M.sub(b["angularVelocityRadps"], a["angularVelocityRadps"]), a["inertiaKgM2"])} for a, b in zip(incoming, projected)]
            pair = reference["pairs"][index];motor = pair["motor"]
            report = {"id":JIDS[index], "kind":"hinge", "aId":IDS[2 * index], "bId":IDS[2 * index + 1], "angleRad":model["poseReport"]["targetAngleRad"], "linearImpulseNs":corrections[1]["linearImpulseNs"][:], "angularImpulseNms":corrections[1]["angularImpulseNms"][:], "motorImpulseNms":motor["impulseNms"]}
            phase_bodies = {phase:reference["frames"][phase + "Bodies"][2 * index:2 * index + 2] for phase in PHASES[:-1]};phase_bodies["projected"] = projected
            joint = pair_inputs[index]["config"]["joints"][0]
            energy = {phase + "J":M.pair_metrics(bodies, joint, [0.0, 0.0, float(index)])["energyJ"] for phase, bodies in phase_bodies.items()}
            external = M.midpoint_by_body(phase_bodies["source"], phase_bodies["angular"]);spin = M.midpoint_by_body(phase_bodies["angular"], phase_bodies["motor"])
            midpoint = (motor["impulseNms"] * (motor["relativeSpeedBeforeRadps"] + motor["relativeSpeedAfterRadps"])) * .5
            spin_total = spin[0] + spin[1]
            work = {"externalAngularByBodyJ":external, "externalAngularTotalJ":external[0] + external[1], "motorMidpointJ":midpoint, "motorSpinMidpointJ":spin_total, "motorResidualJ":spin_total - midpoint, "freeDeltaKJ":energy["freeJ"] - energy["motorJ"], "contactDeltaKJ":energy["postContactJ"] - energy["freeJ"], "projectionDeltaKJ":energy["projectedJ"] - energy["postContactJ"], "projectionObjectiveJ":float(model["projection"]["objectiveJ"])}
            norm = math.hypot(*corrections[1]["angularImpulseNms"])
            cap = {"angularReactionNormNms":norm, "maxReactionNms":.01, "exceedsCap":norm > .01}
            pair.update(jointReport=report, bodyCorrections=corrections, energyByPhase=energy, work=work, reportCap=cap)
            reference["stage"] = "pair0-ready" if index == 0 else "pair1-ready"
        reference["frames"]["projectedBodies"] = copy.deepcopy(working);reference["rawFrames"]["projected"] = raw(working)
        for pair_index, (a, b) in enumerate(CROSS):
            gap = separation(working, a, b)
            reference["contactChecks"]["final"][pair_index] = contact_record(None, pair_index, working, a, b, precision)
        for body in working:
            for field, label, bound in (("positionM", "position", 10000), ("velocityMps", "velocity", 1000), ("angularVelocityRadps", "angularVelocity", 1000)):
                if any(not math.isfinite(x) or abs(x) > bound for x in body[field]):
                    return refusal(reference, body["id"] + " " + label + " exceeded bounds"), models, parent_inputs
            if any(not math.isfinite(x) for x in body["orientation"]) or abs(math.hypot(*body["orientation"]) - 1) > 1e-12:
                return refusal(reference, body["id"] + " orientation exceeded tolerance"), models, parent_inputs
        if any(math.hypot(*M.sub(body["positionM"], original["positionM"])) > 10 for body, original in zip(working, source)):
            return refusal(reference, "private hinge velocity World result is invalid"), models, parent_inputs
        reference["stage"] = "report-ready"
        for pair in reference["pairs"]:
            if pair["reportCap"]["exceedsCap"]:
                return refusal(reference, pair["jointId"] + " exceeded motor reaction limit"), models, parent_inputs
        return reference, models, parent_inputs
