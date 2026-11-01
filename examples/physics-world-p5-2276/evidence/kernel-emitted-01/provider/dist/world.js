import { PhysicsError } from './types.js';
import { admitModel } from './model-admission.js';
import { copyData, digest } from './identity.js';
import { recordingWorlds } from './recording-owner.js';
import { providerManifest } from './provider-manifest.generated.js';
import { MAX_STEPS, MAX_STEP_DISPLACEMENT_M, SOLVER_PASSES } from './limits.js';
import { error, parseCommands, copyBody, queryRecord, queryVector, queryNumber, includeSensors } from './validation.js';
import { add, scale, inverseInertia, advanceOrientation } from './math.js';
import { projectJoint } from './joints.js';
import { driveDynamicHingeMotor, driveHingeMotor } from './joint-motor.js';
import { admitDynamicHingeCommands, admitDynamicHingeScene } from './dynamic-hinge-joint.js';
import { detect, solve, validateResult, sphereOverlaps, rayDistance } from './collision.js';
import { boxFaceManifold } from './contact-manifold.js';
import { correctPersistentPair, solvePersistentPoint, warmStartPoint } from './persistent-box-contact.js';
import { admitCcd, sweepSphere } from './ccd.js';
import { sweepSpherePair } from './ccd-pair.js';
import { axisAlignedBox, rejectAngularBoxCommand, sweepDynamicBox } from './ccd-box.js';
import { bodyBounds, boundsOverlap } from './broadphase.js';
import { dormantPair, filterAllowsPair, wakeOnContact } from './scene-profile.js';
import { updateSleeping, wakeForActions } from './sleep.js';
import { admitDisjointHingeCommands, driveDisjointHingeMotors, applyDisjointHingePostContact } from './disjoint-hinge/stage.js';
function publicState(bodies, contacts, events, joints, ccdHits, pairStats, stepIndex, dt, identity, colliderIds) {
    return {
        identity: { ...identity }, stepIndex, timeSeconds: stepIndex * dt,
        bodies: bodies.map((body) => ({ id: body.id, kind: body.kind, positionM: [...body.positionM],
            orientationXYZW: [...body.orientation], velocityMps: [...body.velocityMps],
            angularVelocityRadps: [...body.angularVelocityRadps], sleeping: body.sleeping ?? false })),
        contacts: contacts.map((contact) => ({ colliderAId: colliderIds.get(contact.aId),
            colliderBId: colliderIds.get(contact.bId), bodyAId: contact.aId, bodyBId: contact.bId,
            normalAtoB: [...contact.normalAtoB], pointM: [...contact.pointM], penetrationM: contact.penetrationM,
            normalImpulseNs: contact.impulseNs, tangentImpulseOnBNs: [...contact.tangentImpulseNs] })),
        events: events.map((event) => ({ colliderAId: colliderIds.get(event.aId),
            colliderBId: colliderIds.get(event.bId), kind: event.kind, phase: event.phase })),
        joints: joints.map((joint) => ({ id: joint.id, bodyAId: joint.aId, bodyBId: joint.bId,
            linearImpulseOnBNs: [...joint.linearImpulseNs], angularImpulseOnBNms: [...joint.angularImpulseNms],
            angleRad: joint.angleRad ?? null, motorImpulseNms: joint.motorImpulseNms ?? null })),
        ccdHits: ccdHits.map((hit) => ({ bodyId: hit.bodyId, colliderId: colliderIds.get(hit.fixtureId),
            toiFraction: hit.toiFraction, normalFixtureToBody: [...hit.normalFixtureToBody] })),
        cloths: [], fluids: [], pairStats: { ...pairStats },
    };
}
export function createPhysicsWorld(model, options) {
    const admitted = admitModel(model, options);
    const dt = admitted.options.fixedStepSeconds;
    const gravity = [...admitted.model.gravityMps2];
    const useAabb = admitted.options.broadPhase === 'aabb';
    const usePersistentBox = admitted.options.profile === 'rigid-persistent-box-v1';
    const largeMode = admitted.options.profile === 'rigid-large-v1';
    let bodies = admitted.bodies;
    let joints = admitted.joints;
    let disjointHinges = admitted.disjointHinges;
    let modelCopy = admitted.model;
    let optionsCopy = admitted.options;
    const colliderIds = new Map(admitted.model.colliders.map((collider) => [collider.bodyId, collider.id]));
    const identity = { modelRevision: admitted.model.revision,
        modelDigest: digest(admitted.model), configurationDigest: digest(admitted.options),
        providerDigest: digest(providerManifest), profile: admitted.options.profile,
        frameId: admitted.model.frame.id, fixedStepSeconds: dt };
    let dynamicHinge = joints.find((joint) => joint.kind === 'hinge' &&
        bodies[joint.aIndex].kind === 'dynamic');
    if (dynamicHinge && !disjointHinges)
        admitDynamicHingeScene(dynamicHinge, bodies, gravity);
    let ccd = admitCcd(bodies, joints.length, gravity);
    if (ccd.kind === 'box-pair' && usePersistentBox) {
        error('INVALID_CONFIG', 'box CCD excludes persistent-box-v1');
    }
    const disabledPairs = new Set(joints.map((joint) => [bodies[joint.aIndex].id, bodies[joint.bIndex].id].sort().join('\u0000')));
    const pairs = [];
    for (let a = 0; a < bodies.length; a++)
        for (let b = a + 1; b < bodies.length; b++) {
            if ((bodies[a].inverseMass !== 0 || bodies[b].inverseMass !== 0) &&
                (!largeMode || filterAllowsPair(bodies[a], bodies[b]))) {
                if (disabledPairs.has([bodies[a].id, bodies[b].id].sort().join('\u0000')))
                    continue;
                pairs.push(bodies[a].id < bodies[b].id ? [a, b] : [b, a]);
            }
        }
    pairs.sort((left, right) => bodies[left[0]].id < bodies[right[0]].id ? -1 :
        bodies[left[0]].id > bodies[right[0]].id ? 1 :
            bodies[left[1]].id < bodies[right[1]].id ? -1 : 1);
    let contacts = [];
    let events = [];
    let ccdHits = [];
    let pairStats = { eligiblePairs: 0, candidatePairs: 0, aabbTests: 0 };
    let jointStates = joints.map((joint) => ({ id: joint.id, kind: joint.kind,
        aId: bodies[joint.aIndex].id, bId: bodies[joint.bIndex].id,
        linearImpulseNs: [0, 0, 0], angularImpulseNms: [0, 0, 0],
        ...(joint.kind === 'hinge' ? { angleRad: 0 } : {}),
        ...(joint.motor ? { motorImpulseNms: 0 } : {}) }));
    let activePairs = new Map();
    let persistentPoints = new Map();
    let sleepFrames = bodies.map(() => 0);
    let stepIndex = 0;
    let disposed = false;
    let owner = null;
    let advancingOwner = null;
    const ensureActive = () => { if (disposed)
        error('DISPOSED', 'world is disposed'); };
    const world = {
        getModel() { ensureActive(); return copyData(modelCopy); },
        getState() { ensureActive(); return publicState(bodies, contacts, events, jointStates, ccdHits, pairStats, stepIndex, dt, identity, colliderIds); },
        step(commands = []) {
            ensureActive();
            if (owner !== advancingOwner)
                error('WORLD_OWNED', 'World has an exclusive recorder');
            if (stepIndex >= MAX_STEPS)
                error('WORLD_LIMIT', 'world step limit reached');
            if (owner && (owner.recording.frames.length >= 512 ||
                (Array.isArray(commands) && owner.commandCount + commands.length > 4096))) {
                error('WORLD_LIMIT', 'recording frame or command limit reached');
            }
            let admittedCommands;
            try {
                admittedCommands = copyData(commands);
            }
            catch (failure) {
                if (failure instanceof PhysicsError && failure.code === 'INVALID_CONFIG')
                    error('INVALID_COMMAND', failure.message);
                throw failure;
            }
            if (owner && Array.isArray(admittedCommands) && owner.commandCount + admittedCommands.length > 4096) {
                error('WORLD_LIMIT', 'recording command limit reached');
            }
            const actions = parseCommands(admittedCommands, bodies);
            if (disjointHinges)
                admitDisjointHingeCommands(disjointHinges, bodies, actions, admittedCommands.length);
            else if (dynamicHinge)
                admitDynamicHingeCommands(dynamicHinge, bodies, actions);
            if (ccd.kind === 'box-pair')
                rejectAngularBoxCommand(actions.get(bodies[ccd.boxIndex].id));
            const preparedFrames = owner ? owner.prepareFrames(admittedCommands, stepIndex + 1) : null;
            const next = bodies.map(copyBody);
            const motorImpulses = joints.map(() => 0);
            const nextSleepFrames = sleepFrames.slice();
            if (largeMode)
                wakeForActions(next, contacts, actions, nextSleepFrames);
            for (const body of next) {
                if (body.kind !== 'dynamic' || (largeMode && body.sleeping))
                    continue;
                const action = actions.get(body.id);
                body.angularVelocityRadps = add(body.angularVelocityRadps, inverseInertia(body, add(action?.angularImpulseNms ?? [0, 0, 0], scale(action?.torqueNm ?? [0, 0, 0], dt))));
            }
            if (disjointHinges)
                driveDisjointHingeMotors(disjointHinges, next, jointStates, motorImpulses);
            else
                for (let index = 0; index < joints.length; index++) {
                    const joint = joints[index];
                    if (!joint.motor)
                        continue;
                    motorImpulses[index] = next[joint.aIndex].kind === 'dynamic'
                        ? driveDynamicHingeMotor(joint, next[joint.aIndex], next[joint.bIndex], jointStates[index].angleRad)
                        : driveHingeMotor(joint, next[joint.bIndex], jointStates[index].angleRad);
                }
            for (let bodyIndex = 0; bodyIndex < next.length; bodyIndex++) {
                const body = next[bodyIndex];
                const action = actions.get(body.id);
                if (body.kind === 'kinematic') {
                    const target = action?.positionM ?? body.positionM;
                    const delta = target.map((value, index) => value - body.positionM[index]);
                    if (Math.hypot(...delta) > MAX_STEP_DISPLACEMENT_M ||
                        delta.some((value) => Math.abs(value / dt) > 1000)) {
                        error('NUMERIC_LIMIT', `${body.id} exceeded kinematic movement limit`);
                    }
                    body.velocityMps = delta.map((value) => value / dt);
                    body.positionM = [...target];
                }
                else if (body.kind === 'dynamic') {
                    if (largeMode && body.sleeping)
                        continue;
                    if (body.angularVelocityRadps.some((value) => !Number.isFinite(value) || Math.abs(value) > 1000) ||
                        Math.hypot(...body.angularVelocityRadps) * dt > 10) {
                        error('NUMERIC_LIMIT', `${body.id} exceeded angular movement limit`);
                    }
                    body.orientation = advanceOrientation(body.orientation, body.angularVelocityRadps, dt);
                    for (let i = 0; i < 3; i++) {
                        body.velocityMps[i] += (action?.impulseNs?.[i] ?? 0) * body.inverseMass;
                        body.velocityMps[i] += (gravity[i] + (action?.forceN?.[i] ?? 0) * body.inverseMass) * dt;
                    }
                    if (Math.hypot(...body.velocityMps) * dt > MAX_STEP_DISPLACEMENT_M) {
                        error('NUMERIC_LIMIT', `${body.id} exceeded step displacement limit`);
                    }
                    for (let i = 0; i < 3; i++)
                        body.positionM[i] += body.velocityMps[i] * dt;
                }
            }
            const hit = ccd.kind === 'static-boxes'
                ? sweepSphere(bodies[ccd.sphereIndex], next[ccd.sphereIndex], ccd.fixtures)
                : ccd.kind === 'sphere-pair'
                    ? sweepSpherePair(bodies[ccd.sphereIndex], next[ccd.sphereIndex], bodies[ccd.otherIndex], next[ccd.otherIndex])
                    : ccd.kind === 'box-pair'
                        ? sweepDynamicBox(bodies[ccd.boxIndex], next[ccd.boxIndex], next[ccd.fixtureIndex]) : null;
            const nextCcdHits = hit ? [hit] : [];
            const nextPairStats = { eligiblePairs: 0, candidatePairs: 0, aabbTests: 0 };
            const found = new Map();
            const nextPersistentPoints = new Map();
            const sensed = new Map();
            const nextJoints = jointStates.map((joint, index) => ({ ...joint,
                linearImpulseNs: [0, 0, 0], angularImpulseNms: [0, 0, 0],
                ...(joint.motorImpulseNms === undefined ? {} :
                    { motorImpulseNms: motorImpulses[index] }) }));
            const bounds = useAabb ? next.map(bodyBounds) : null;
            for (let pass = 0; pass < SOLVER_PASSES; pass++) {
                if (bounds && pass > 0)
                    for (let index = 0; index < next.length; index++) {
                        if (next[index].kind !== 'static')
                            bounds[index] = bodyBounds(next[index]);
                    }
                for (const [aIndex, bIndex] of pairs) {
                    nextPairStats.eligiblePairs++;
                    if (largeMode && pass > 0 && dormantPair(next[aIndex], next[bIndex]))
                        continue;
                    if (bounds) {
                        nextPairStats.aabbTests++;
                        if (!boundsOverlap(bounds[aIndex], bounds[bIndex]))
                            continue;
                    }
                    nextPairStats.candidatePairs++;
                    const a = next[aIndex], b = next[bIndex];
                    const hit = detect(a, b);
                    if (!hit)
                        continue;
                    if (hit.penetration > MAX_STEP_DISPLACEMENT_M)
                        error('NUMERIC_LIMIT', 'contact penetration exceeded limit');
                    const key = `${a.id}\u0000${b.id}`;
                    if (a.sensor || b.sensor) {
                        sensed.set(key, { aId: a.id, bId: b.id, kind: 'sensor' });
                        continue;
                    }
                    if (largeMode)
                        wakeOnContact(a, b, nextSleepFrames, aIndex, bIndex);
                    let contact = found.get(key);
                    if (!contact) {
                        contact = { aId: a.id, bId: b.id, normalAtoB: [...hit.normal], pointM: [...hit.pointM],
                            penetrationM: 0, impulseNs: 0, tangentImpulseNs: [0, 0, 0] };
                        found.set(key, contact);
                    }
                    const manifold = usePersistentBox ? boxFaceManifold(a, b, hit) : null;
                    const points = manifold?.map((entry) => entry.pointM) ?? [hit.pointM];
                    contact.pointM = points.reduce((sum, point) => add(sum, point), [0, 0, 0])
                        .map((value) => value / points.length);
                    contact.penetrationM = Math.max(contact.penetrationM, hit.penetration);
                    if (largeMode && dormantPair(a, b))
                        continue;
                    if (manifold) {
                        for (const point of manifold) {
                            const pointKey = `${key}\u0000${point.id}`;
                            let impulse = nextPersistentPoints.get(pointKey);
                            if (!impulse) {
                                const prior = persistentPoints.get(pointKey);
                                impulse = prior ? { normalNs: prior.normalNs, tangentNs: [...prior.tangentNs] }
                                    : { normalNs: 0, tangentNs: [0, 0, 0] };
                                nextPersistentPoints.set(pointKey, impulse);
                                if (prior)
                                    warmStartPoint(a, b, point.pointM, hit.normal, impulse);
                            }
                        }
                        for (let iteration = 0; iteration < 8; iteration++) {
                            const order = iteration % 2 ? [...manifold].reverse() : manifold;
                            for (const point of order) {
                                const impulse = nextPersistentPoints.get(`${key}\u0000${point.id}`);
                                solvePersistentPoint(a, b, point.pointM, hit.normal, impulse);
                            }
                        }
                        correctPersistentPair(a, b, hit.normal, hit.penetration);
                        contact.impulseNs = 0;
                        contact.tangentImpulseNs = [0, 0, 0];
                        for (const point of manifold) {
                            const impulse = nextPersistentPoints.get(`${key}\u0000${point.id}`);
                            contact.impulseNs += impulse.normalNs;
                            contact.tangentImpulseNs = add(contact.tangentImpulseNs, impulse.tangentNs);
                        }
                    }
                    else {
                        const resolved = solve(a, b, hit);
                        contact.impulseNs += resolved.normalImpulseNs;
                        contact.tangentImpulseNs = add(contact.tangentImpulseNs, resolved.tangentImpulseNs);
                    }
                    if (bounds) {
                        bounds[aIndex] = bodyBounds(a);
                        bounds[bIndex] = bodyBounds(b);
                    }
                }
                if (!disjointHinges)
                    for (let index = 0; index < joints.length; index++) {
                        const reaction = projectJoint(joints[index], next, bodies, dt);
                        nextJoints[index].linearImpulseNs = add(nextJoints[index].linearImpulseNs, reaction.linearImpulseNs);
                        nextJoints[index].angularImpulseNms = add(nextJoints[index].angularImpulseNms, reaction.angularImpulseNms);
                        if (reaction.angleRad !== undefined)
                            nextJoints[index].angleRad = reaction.angleRad;
                    }
            }
            if (disjointHinges) {
                if (found.size !== 0 || sensed.size !== 0) {
                    error('NUMERIC_LIMIT', 'disjoint hinge contact profile is unsupported');
                }
                applyDisjointHingePostContact(disjointHinges, next, nextJoints, motorImpulses, stepIndex, stepIndex * dt);
            }
            const nextContacts = [...found.values()];
            if (largeMode)
                updateSleeping(next, nextContacts, nextSleepFrames);
            const nextActive = new Map(sensed);
            for (const contact of nextContacts) {
                nextActive.set(`${contact.aId}\u0000${contact.bId}`, { aId: contact.aId, bId: contact.bId, kind: 'contact' });
            }
            const nextEvents = [...new Set([...activePairs.keys(), ...nextActive.keys()])].sort().map((key) => {
                const current = nextActive.get(key);
                const previous = activePairs.get(key);
                return { ...(current ?? previous), phase: current ? previous ? 'stay' : 'begin' : 'end' };
            });
            validateResult(next, nextContacts);
            if (ccd.kind === 'box-pair' && !axisAlignedBox(next[ccd.boxIndex])) {
                error('NUMERIC_LIMIT', 'box CCD contact rotated outside the admitted profile');
            }
            if (nextJoints.some((joint) => [...joint.linearImpulseNs, ...joint.angularImpulseNms].some((value) => !Number.isFinite(value)) || (joint.angleRad !== undefined && !Number.isFinite(joint.angleRad)))) {
                error('NUMERIC_LIMIT', 'unsafe joint reaction');
            }
            for (let index = 0; index < joints.length; index++) {
                const motor = joints[index].motor;
                if (motor && Math.hypot(...nextJoints[index].angularImpulseNms) > motor.maxReactionNms) {
                    error('NUMERIC_LIMIT', `${joints[index].id} exceeded motor reaction limit`);
                }
            }
            const state = publicState(next, nextContacts, nextEvents, nextJoints, nextCcdHits, nextPairStats, stepIndex + 1, dt, identity, colliderIds);
            // All candidate, output and recording allocations finish before shared commit.
            const preparedRecording = owner ? owner.prepare(preparedFrames, state) : null;
            const preparedCommandCount = owner ? owner.commandCount + admittedCommands.length : 0;
            // Shared commit: assignments only. No allocation or callback.
            bodies = next;
            contacts = nextContacts;
            events = nextEvents;
            jointStates = nextJoints;
            ccdHits = nextCcdHits;
            pairStats = nextPairStats;
            activePairs = nextActive;
            persistentPoints = nextPersistentPoints;
            sleepFrames = nextSleepFrames;
            stepIndex++;
            if (owner) {
                owner.recording = preparedRecording;
                owner.commandCount = preparedCommandCount;
            }
            return state;
        },
        query(input) {
            ensureActive();
            const data = queryRecord(input, ['kind', 'includeSensors'], ['centerM', 'radiusM', 'originM', 'direction', 'maxDistanceM']);
            const sensors = includeSensors(data);
            if (data.kind === 'overlap-sphere') {
                const query = queryRecord(data, ['kind', 'centerM', 'radiusM', 'includeSensors'], []);
                const center = queryVector(query.centerM, 10000, 'centerM');
                const radius = queryNumber(query.radiusM, 0.0001, 1000, 'radiusM');
                return { kind: 'overlap-sphere', colliderIds: bodies.filter((body) => (sensors || !body.sensor) && sphereOverlaps(center, radius, body))
                        .map((body) => body.id).sort().map((id) => colliderIds.get(id)) };
            }
            if (data.kind !== 'raycast')
                error('INVALID_QUERY', 'unsupported query kind');
            const query = queryRecord(data, ['kind', 'originM', 'direction', 'maxDistanceM', 'includeSensors'], []);
            const origin = queryVector(query.originM, 10000, 'originM');
            const direction = queryVector(query.direction, 1 + 1e-9, 'direction');
            if (Math.abs(Math.hypot(...direction) - 1) > 1e-9)
                error('INVALID_QUERY', 'direction must be a unit 3-vector');
            const limit = queryNumber(query.maxDistanceM, 0.0001, 10000, 'maxDistanceM');
            let best = null;
            for (const body of bodies) {
                if (!sensors && body.sensor)
                    continue;
                const distance = rayDistance(origin, direction, body);
                if (distance === null || distance > limit)
                    continue;
                if (best === null || distance < best.distanceM || (distance === best.distanceM && body.id < best.bodyId))
                    best = { bodyId: body.id, distanceM: distance };
            }
            return { kind: 'raycast', hit: best === null ? null : { ...best, colliderId: colliderIds.get(best.bodyId) } };
        },
        dispose() {
            disposed = true;
            if (owner) {
                owner.recording = null;
                owner.commandCount = 0;
                owner = null;
            }
            optionsCopy = null;
            bodies = [];
            contacts = [];
            events = [];
            ccdHits = [];
            activePairs.clear();
            persistentPoints.clear();
            sleepFrames = [];
            jointStates = [];
            joints = [];
            dynamicHinge = undefined;
            disjointHinges = null;
            ccd = { kind: 'none' };
            pairs.length = 0;
            colliderIds.clear();
            modelCopy = null;
        },
    };
    let running = false;
    function guarded(operation, action) {
        if (disposed)
            throw new PhysicsError('DISPOSED', 'world is disposed', {
                operation, phase: 'lifecycle', domain: 'world', entityIds: [], accepted: { stepIndex, timeSeconds: stepIndex * dt }
            });
        if (running)
            throw new PhysicsError('REENTRANT_CALL', 'World call is reentrant', {
                operation, phase: 'lifecycle', domain: 'world', entityIds: [], accepted: { stepIndex, timeSeconds: stepIndex * dt }
            });
        running = true;
        try {
            return action();
        }
        catch (failure) {
            if (!(failure instanceof PhysicsError))
                throw failure;
            const enriched = new PhysicsError(failure.code, failure.message, {
                operation, phase: ['DISPOSED', 'WORLD_OWNED', 'REENTRANT_CALL'].includes(failure.code) ? 'lifecycle' :
                    failure.code === 'WORLD_LIMIT' ? 'budget' : failure.code === 'NUMERIC_LIMIT' ? 'validation' : 'admission',
                domain: 'rigid', entityIds: failure.details.entityIds,
                accepted: { stepIndex, timeSeconds: stepIndex * dt }
            });
            enriched.stack = failure.stack;
            throw enriched;
        }
        finally {
            running = false;
        }
    }
    const getModel = world.getModel;
    const getState = world.getState;
    const step = world.step;
    const query = world.query;
    const dispose = world.dispose;
    world.getModel = () => guarded('read', getModel);
    world.getState = () => guarded('read', getState);
    world.step = (commands) => guarded('step', () => step(commands));
    world.query = (input) => guarded('query', () => query(input));
    world.dispose = () => { if (!disposed)
        guarded('read', dispose); };
    recordingWorlds.set(world, {
        attach: (prepare) => guarded('record', () => {
            if (owner)
                error('WORLD_OWNED', 'World has an exclusive recorder');
            if (stepIndex !== 0)
                error('INVALID_SNAPSHOT', 'recording must attach at step zero');
            const prepared = prepare({ model: copyData(modelCopy), options: copyData(optionsCopy), state: getState() });
            owner = prepared;
            return prepared;
        }),
        detach: (current) => {
            if (!disposed)
                guarded('record', () => {
                    if (owner === current)
                        owner = null;
                    current.recording = null;
                    current.commandCount = 0;
                });
        },
        read: (current) => guarded('record', () => {
            if (owner !== current)
                error('DISPOSED', 'recorder is detached');
            return getState();
        }),
        step: (current, commands) => guarded('record', () => {
            if (owner !== current)
                error('DISPOSED', 'recorder is detached');
            advancingOwner = current;
            try {
                return step(commands);
            }
            finally {
                advancingOwner = null;
            }
        }),
    });
    return world;
}
