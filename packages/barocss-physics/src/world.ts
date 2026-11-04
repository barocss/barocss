import type { PhysicsModel, WorldOptions, PhysicsWorld, PhysicsState, Identity, QueryResult } from './types.js';
import { PhysicsError } from './types.js';
import type { FailureDetails } from './types.js';
import { admitModel } from './model-admission.js';
import { copyData, digest } from './identity.js';
import { recordingWorlds } from './recording-owner.js';
import type { RecordingOwner } from './recording-owner.js';
import { providerManifest } from './provider-manifest.generated.js';
import type { Body, PhysicsCcdHit, PhysicsContact, PhysicsEvent, PhysicsJointState, PhysicsPairStats,  PhysicsRayHit, Vec3 } from './internal-types.js';
import { MAX_STEPS, MAX_STEP_DISPLACEMENT_M, SOLVER_PASSES } from './limits.js';
import { error, parseCommands, copyBody, queryRecord, queryVector, queryNumber, includeSensors } from './validation.js';
import { add, cross, dot, scale, sub, inverseInertia, advanceOrientation } from './math.js';
import { projectJoint } from './joints.js';
import { driveDynamicHingeMotor, driveHingeMotor } from './joint-motor.js';
import { admitDynamicHingeCommands, admitDynamicHingeScene } from './dynamic-hinge-joint.js';
import { detect, solve, validateResult, sphereOverlaps, rayDistance } from './collision.js';
import { boxFaceManifold } from './contact-manifold.js';
import { correctPersistentPair, solvePersistentPoint, warmStartPoint } from './persistent-box-contact.js';
import type { PointImpulse } from './persistent-box-contact.js';
import { admitCcd, sweepSphere } from './ccd.js';
import { sweepSpherePair } from './ccd-pair.js';
import { axisAlignedBox, rejectAngularBoxCommand, sweepDynamicBox } from './ccd-box.js';
import { bodyBounds, boundsOverlap } from './broadphase.js';
import { dormantPair, filterAllowsPair, wakeOnContact } from './scene-profile.js';
import { updateSleeping, wakeForActions } from './sleep.js';
import { admitDisjointHingeCommands, driveDisjointHingeMotors, applyDisjointHingePostContact } from './disjoint-hinge/stage.js';
import { initializeCloth, prepareCloth } from './domain/cloth.js';
import { initializeFluid, prepareFluid } from './domain/fluid.js';
import type { ClothCandidate, ClothDefinition, ClothOutput, FluidCandidate, FluidDefinition, FluidOutput } from './domain/types.js';
import { CLOTH_MAX_STEPS } from './cloth/profile.js';
import { FLUID_MAX_STEPS } from './fluid/constants.js';
import { validateRotationResult } from './rotation-validation.js';
import { prepareFreeRotation } from './rigid-free-rotation.js';
import { prepareForcedRotation } from './rigid-forced-rotation.js';
import { prepareStackStep } from './stack/prepare-step.js';
import { STATIONARY_MAX_STEPS, admitStationaryCommands } from './stack/stationary-profile.js';
import { prepareStationaryOutput } from './stack/public-output.js';
import { ContactPairAccumulator, type CompletedContactPair } from './contact-contribution.js';
import { prepareFrictionlessIsland } from './stack/frictionless-island.js';

function publicState(bodies: Body[], contacts: PhysicsContact[], events: PhysicsEvent[],
  joints: PhysicsJointState[], ccdHits: PhysicsCcdHit[], pairStats: PhysicsPairStats,
  stepIndex: number, dt: number, identity: Identity, colliderIds: Map<string, string>): PhysicsState {
  return {
    identity: { ...identity }, stepIndex, timeSeconds: stepIndex * dt,
    bodies: bodies.map((body) => ({ id: body.id, kind: body.kind, positionM: [...body.positionM],
      orientationXYZW: [...body.orientation], velocityMps: [...body.velocityMps],
      angularVelocityRadps: [...body.angularVelocityRadps], sleeping: body.sleeping ?? false })),
    contacts: contacts.map((contact) => ({ colliderAId: colliderIds.get(contact.aId)!,
      colliderBId: colliderIds.get(contact.bId)!, bodyAId: contact.aId, bodyBId: contact.bId,
      normalAtoB: [...contact.normalAtoB], pointM: [...contact.pointM], penetrationM: contact.penetrationM,
      normalImpulseNs: contact.impulseNs, tangentImpulseOnBNs: [...contact.tangentImpulseNs] })),
    events: events.map((event) => ({ colliderAId: colliderIds.get(event.aId)!,
      colliderBId: colliderIds.get(event.bId)!, kind: event.kind, phase: event.phase })),
    joints: joints.map((joint) => ({ id: joint.id, bodyAId: joint.aId, bodyBId: joint.bId,
      linearImpulseOnBNs: [...joint.linearImpulseNs], angularImpulseOnBNms: [...joint.angularImpulseNms],
      angleRad: joint.angleRad ?? null, motorImpulseNms: joint.motorImpulseNms ?? null })),
    ccdHits: ccdHits.map((hit) => ({ bodyId: hit.bodyId, colliderId: colliderIds.get(hit.fixtureId)!,
      toiFraction: hit.toiFraction, normalFixtureToBody: [...hit.normalFixtureToBody] })),
    cloths: [], fluids: [], pairStats: { ...pairStats },
  };
}

type DomainRuntime =
  | { readonly kind: 'cloth'; readonly definition: ClothDefinition; readonly accepted: ClothCandidate }
  | { readonly kind: 'fluid'; readonly definition: FluidDefinition; readonly accepted: FluidCandidate };

/** Copies all externally visible data before the shared World commit. */
function publicDomainState(runtime: DomainRuntime, model: PhysicsModel, identity: Identity,
  stepIndex: number, dt: number, prepared?: ClothOutput | FluidOutput): PhysicsState {
  const bodies = model.bodies.map((body): PhysicsState['bodies'][number] => ({
    id: body.id, kind: body.kind, positionM: [...body.initial.positionM],
    orientationXYZW: [...body.initial.orientationXYZW], velocityMps: [0, 0, 0],
    angularVelocityRadps: [0, 0, 0], sleeping: false,
  }));
  const state: PhysicsState = {
    identity: { ...identity }, stepIndex, timeSeconds: stepIndex * dt, bodies,
    joints: [], contacts: [], events: [], ccdHits: [], cloths: [], fluids: [],
    pairStats: { eligiblePairs: 0, candidatePairs: 0, aabbTests: 0 },
  };
  if (runtime.kind === 'cloth') {
    const output: ClothOutput = prepared as ClothOutput | undefined ?? {
      id: runtime.definition.cloth.id, positionsM: runtime.accepted.positions.slice(),
      velocitiesMps: runtime.accepted.velocities.slice(), diagnostics: { ...runtime.accepted.diagnostics },
    };
    return { ...state, cloths: [output] };
  }
  const output: FluidOutput = prepared as FluidOutput | undefined ?? {
    id: runtime.definition.fluid.id, positionsM: runtime.accepted.positions.slice(),
    velocitiesMps: runtime.accepted.velocities.slice(), diagnostics: { ...runtime.accepted.diagnostics },
  };
  return { ...state, fluids: [output] };
}

export function createPhysicsWorld(model: PhysicsModel, options: WorldOptions): PhysicsWorld {
  const admitted = admitModel(model, options);
  const islandMode = admitted.options.profile === 'rigid-persistent-box-v1' &&
    admitted.joints.length === 0 && admitted.bodies.some(body => body.kind === 'dynamic') &&
    admitted.bodies.every(body => (body.kind === 'dynamic' || body.kind === 'static') &&
      body.shape.kind === 'box' && !body.sleeping && !body.sensor && !body.ccd &&
      !body.collisionFilter && body.restitution === 0 && body.frictionStatic === 0 && body.frictionDynamic === 0);
  if (islandMode && admitted.options.broadPhase !== 'direct') {
    error('INVALID_CONFIG', 'frictionless island requires direct broadPhase');
  }
  const dt = admitted.options.fixedStepSeconds;
  const domainKind = admitted.domain?.kind ?? null;
  const domainId = admitted.domain?.data.id ?? null;
  const stationaryMode = admitted.stationary;
  const stepLimit = stationaryMode ? STATIONARY_MAX_STEPS : domainKind === 'cloth' ? CLOTH_MAX_STEPS : domainKind === 'fluid' ? FLUID_MAX_STEPS : MAX_STEPS;
  // Only this clearable holder owns runtime definitions and accepted domain buffers.
  let domainState: DomainRuntime | null = null;
  if (admitted.domain?.kind === 'cloth') {
    const initialized = initializeCloth(admitted.domain.data, admitted.domain.staticData);
    domainState = { kind: 'cloth', definition: initialized.definition, accepted: initialized.initial };
  } else if (admitted.domain?.kind === 'fluid') {
    const initialized = initializeFluid(admitted.domain.data, admitted.domain.staticData);
    domainState = { kind: 'fluid', definition: initialized.definition, accepted: initialized.initial };
  }
  const gravity = [...admitted.model.gravityMps2] as Vec3;
  const useAabb = admitted.options.broadPhase === 'aabb';
  const usePersistentBox = admitted.options.profile === 'rigid-persistent-box-v1';
  const largeMode = admitted.options.profile === 'rigid-large-v1';
  let bodies = admitted.bodies;
  let joints = admitted.joints;
  let disjointHinges = admitted.disjointHinges;
  let modelCopy: PhysicsModel | null = admitted.model;
  let optionsCopy: WorldOptions | null = admitted.options;
  const colliderIds = new Map(admitted.model.colliders.map((collider) => [collider.bodyId, collider.id]));
  const identity: Identity = { modelRevision: admitted.model.revision,
    modelDigest: digest(admitted.model), configurationDigest: digest(admitted.options),
    providerDigest: digest(providerManifest), profile: admitted.options.profile,
    frameId: admitted.model.frame.id, fixedStepSeconds: dt };
  let dynamicHinge = joints.find((joint) => joint.kind === 'hinge' &&
    bodies[joint.aIndex].kind === 'dynamic');
  if (dynamicHinge && !disjointHinges) admitDynamicHingeScene(dynamicHinge, bodies, gravity);
  let ccd = domainKind ? { kind: 'none' as const } : admitCcd(bodies, joints.length, gravity);
  if (ccd.kind === 'box-pair' && usePersistentBox) {
    error('INVALID_CONFIG', 'box CCD excludes persistent-box-v1');
  }
  const disabledPairs = new Set(joints.map((joint) =>
    [bodies[joint.aIndex].id, bodies[joint.bIndex].id].sort().join('\u0000')));
  const pairs: Array<[number, number]> = [];
  for (let a = 0; a < bodies.length; a++) for (let b = a + 1; b < bodies.length; b++) {
    if ((bodies[a].inverseMass !== 0 || bodies[b].inverseMass !== 0) &&
      (!largeMode || filterAllowsPair(bodies[a], bodies[b]))) {
      if (disabledPairs.has([bodies[a].id, bodies[b].id].sort().join('\u0000'))) continue;
      pairs.push(bodies[a].id < bodies[b].id ? [a, b] : [b, a]);
    }
  }
  pairs.sort((left, right) => bodies[left[0]].id < bodies[right[0]].id ? -1 :
    bodies[left[0]].id > bodies[right[0]].id ? 1 :
      bodies[left[1]].id < bodies[right[1]].id ? -1 : 1);
  let contacts: PhysicsContact[] = [];
  let events: PhysicsEvent[] = [];
  let ccdHits: PhysicsCcdHit[] = [];
  let pairStats: PhysicsPairStats = { eligiblePairs: 0, candidatePairs: 0, aabbTests: 0 };
  let jointStates: PhysicsJointState[] = joints.map((joint) => ({ id: joint.id, kind: joint.kind,
    aId: bodies[joint.aIndex].id, bId: bodies[joint.bIndex].id,
    linearImpulseNs: [0, 0, 0], angularImpulseNms: [0, 0, 0],
    ...(joint.kind === 'hinge' ? { angleRad: 0 } : {}),
    ...(joint.motor ? { motorImpulseNms: 0 } : {}) }));
  let activePairs = new Map<string, Omit<PhysicsEvent, 'phase'>>();
  let persistentPoints = new Map<string, PointImpulse>();
  let sleepFrames = bodies.map(() => 0);
  let stepIndex = 0;
  let disposed = false;
  let owner: RecordingOwner | null = null;
  let advancingOwner: RecordingOwner | null = null;
  const ensureActive = () => { if (disposed) error('DISPOSED', 'world is disposed'); };
  const world: PhysicsWorld = {
    getModel() { ensureActive(); return copyData(modelCopy!); },
    getState() {
      ensureActive();
      return domainState ? publicDomainState(domainState, modelCopy!, identity, stepIndex, dt)
        : publicState(bodies, contacts, events, jointStates, ccdHits, pairStats, stepIndex, dt, identity, colliderIds);
    },
    step(commands = []) {
      ensureActive();
      if (owner !== advancingOwner) error('WORLD_OWNED', 'World has an exclusive recorder');
      if (stepIndex >= stepLimit) error('WORLD_LIMIT', 'world step limit reached');
      if (owner && (owner.recording!.frames.length >= 512 ||
        (Array.isArray(commands) && owner.commandCount + commands.length > 4096))) {
        error('WORLD_LIMIT', 'recording frame or command limit reached');
      }
      let admittedCommands: typeof commands;
      try { admittedCommands = copyData(commands); }
      catch (failure) {
        if (failure instanceof PhysicsError && failure.code === 'INVALID_CONFIG') error('INVALID_COMMAND', failure.message);
        throw failure;
      }
      if (owner && Array.isArray(admittedCommands) && owner.commandCount + admittedCommands.length > 4096) {
        error('WORLD_LIMIT', 'recording command limit reached');
      }
      const actions = parseCommands(admittedCommands, bodies);
      if (stationaryMode) {
        admitStationaryCommands(admittedCommands);
        let phase: FailureDetails['phase'] = 'prepare-output';
        try {
          const preparedFrames = owner ? owner.prepareFrames(admittedCommands, stepIndex + 1) : null;
          phase = 'candidate';
          const prepared = prepareStackStep(bodies, dt, gravity);
          phase = 'prepare-output';
          const output = prepareStationaryOutput(prepared, activePairs);
          const next = prepared.candidateBodies;
          phase = 'validation';
          validateResult(next, output.contacts);
          phase = 'prepare-output';
          const nextJoints: PhysicsJointState[] = [], nextCcdHits: PhysicsCcdHit[] = [];
          const nextPersistentPoints = new Map<string, PointImpulse>(), nextSleepFrames = next.map(() => 0);
          const state = publicState(next, output.contacts, output.events, nextJoints, nextCcdHits,
            output.pairStats, stepIndex + 1, dt, identity, colliderIds);
          const preparedRecording = owner ? owner.prepare(preparedFrames!, state) : null;
          const preparedCommandCount = owner ? owner.commandCount + admittedCommands.length : 0;
          // Stationary shared commit: all candidate/output/log work finished; assignments only.
          bodies = next;
          contacts = output.contacts;
          events = output.events;
          jointStates = nextJoints;
          ccdHits = nextCcdHits;
          pairStats = output.pairStats;
          activePairs = output.activePairs;
          persistentPoints = nextPersistentPoints;
          sleepFrames = nextSleepFrames;
          stepIndex++;
          if (owner) { owner.recording = preparedRecording!; owner.commandCount = preparedCommandCount; }
          return state;
        } catch (failure) {
          if (!(failure instanceof PhysicsError)) throw failure;
          const enriched = new PhysicsError(failure.code, failure.message, {
            operation: owner ? 'record' : 'step', phase: failure.code === 'WORLD_LIMIT' ? 'budget' : phase,
            domain: 'rigid', entityIds: [...failure.details.entityIds], accepted: { stepIndex, timeSeconds: stepIndex * dt } });
          enriched.stack = failure.stack;
          throw enriched;
        }
      }
      if (domainState) {
        if (admittedCommands.length !== 0) error('INVALID_COMMAND', 'visual domain commands are unsupported');
        const preparedFrames = owner ? owner.prepareFrames(admittedCommands, stepIndex + 1) : null;
        let nextDomain: DomainRuntime;
        let output: ClothOutput | FluidOutput;
        if (domainState.kind === 'cloth') {
          const prepared = prepareCloth(domainState.definition, domainState.accepted);
          nextDomain = { kind: 'cloth', definition: domainState.definition, accepted: prepared.candidate };
          output = prepared.output;
        } else {
          const prepared = prepareFluid(domainState.definition, domainState.accepted);
          nextDomain = { kind: 'fluid', definition: domainState.definition, accepted: prepared.candidate };
          output = prepared.output;
        }
        const state = publicDomainState(nextDomain, modelCopy!, identity, stepIndex + 1, dt, output);
        const preparedRecording = owner ? owner.prepare(preparedFrames!, state) : null;
        const preparedCommandCount = owner ? owner.commandCount + admittedCommands.length : 0;
        // Shared domain commit: all allocations/callbacks above, assignments only below.
        domainState = nextDomain;
        stepIndex++;
        if (owner) { owner.recording = preparedRecording!; owner.commandCount = preparedCommandCount; }
        return state;
      }
      if (disjointHinges) admitDisjointHingeCommands(disjointHinges, bodies, actions, admittedCommands.length);
      else if (dynamicHinge) admitDynamicHingeCommands(dynamicHinge, bodies, actions);
      if (ccd.kind === 'box-pair') rejectAngularBoxCommand(actions.get(bodies[ccd.boxIndex].id));
      let preparationPhase: FailureDetails['phase'] = 'prepare-output';
      try {
      const preparedFrames = owner ? owner.prepareFrames(admittedCommands, stepIndex + 1) : null;
      preparationPhase = 'candidate';
      let next = bodies.map(copyBody);
      const motorImpulses = joints.map(() => 0);
      const nextSleepFrames = sleepFrames.slice();
      if (largeMode) wakeForActions(next, contacts, actions, nextSleepFrames);
      for (const body of next) {
        if (body.kind !== 'dynamic' || (largeMode && body.sleeping)) continue;
        const action = actions.get(body.id);
        body.angularVelocityRadps = add(body.angularVelocityRadps,
          inverseInertia(body, action?.angularImpulseNms ?? [0, 0, 0]));
      }
      if (disjointHinges) driveDisjointHingeMotors(disjointHinges, next, jointStates, motorImpulses);
      else for (let index = 0; index < joints.length; index++) {
        const joint = joints[index];
        if (!joint.motor) continue;
        motorImpulses[index] = next[joint.aIndex].kind === 'dynamic'
          ? driveDynamicHingeMotor(joint, next[joint.aIndex], next[joint.bIndex],
            jointStates[index].angleRad!)
          : driveHingeMotor(joint, next[joint.bIndex], jointStates[index].angleRad!);
      }
      for (let bodyIndex = 0; bodyIndex < next.length; bodyIndex++) {
        const body = next[bodyIndex];
        const action = actions.get(body.id);
        if (body.kind === 'kinematic') {
          const target = action?.positionM ?? body.positionM;
          const delta = target.map((value, index) => value - body.positionM[index]) as Vec3;
          if (Math.hypot(...delta) > MAX_STEP_DISPLACEMENT_M ||
            delta.some((value) => Math.abs(value / dt) > 1000)) {
            error('NUMERIC_LIMIT', `${body.id} exceeded kinematic movement limit`);
          }
          body.velocityMps = delta.map((value) => value / dt) as Vec3;
          body.positionM = [...target];
        } else if (body.kind === 'dynamic') {
          if (largeMode && body.sleeping) continue;
          if (body.angularVelocityRadps.some((value) => !Number.isFinite(value) || Math.abs(value) > 1000) ||
            Math.hypot(...body.angularVelocityRadps) * dt > 10) {
            error('NUMERIC_LIMIT', `${body.id} exceeded angular movement limit`);
          }
          const preparedRotation = prepareForcedRotation(body, dt, action?.torqueNm ?? [0, 0, 0]) ??
            prepareFreeRotation(body, dt) ?? {
              orientation: advanceOrientation(body.orientation, body.angularVelocityRadps, dt),
              angularVelocityRadps: [...body.angularVelocityRadps] as Vec3,
            };
          validateRotationResult(preparedRotation, dt);
          body.angularVelocityRadps = preparedRotation.angularVelocityRadps;
          body.orientation = preparedRotation.orientation;
          for (let i = 0; i < 3; i++) {
            body.velocityMps[i] += (action?.impulseNs?.[i] ?? 0) * body.inverseMass;
            body.velocityMps[i] += (gravity[i] + (action?.forceN?.[i] ?? 0) * body.inverseMass) * dt;
          }
          if (Math.hypot(...body.velocityMps) * dt > MAX_STEP_DISPLACEMENT_M) {
            error('NUMERIC_LIMIT', `${body.id} exceeded step displacement limit`);
          }
          for (let i = 0; i < 3; i++) body.positionM[i] += body.velocityMps[i] * dt;
        }
      }
      const hit = ccd.kind === 'static-boxes'
        ? sweepSphere(bodies[ccd.sphereIndex], next[ccd.sphereIndex], ccd.fixtures)
        : ccd.kind === 'sphere-pair'
          ? sweepSpherePair(bodies[ccd.sphereIndex], next[ccd.sphereIndex],
            bodies[ccd.otherIndex], next[ccd.otherIndex])
          : ccd.kind === 'box-pair'
            ? sweepDynamicBox(bodies[ccd.boxIndex], next[ccd.boxIndex],
              next[ccd.fixtureIndex]) : null;
      const nextCcdHits = hit ? [hit] : [];
      const nextPairStats: PhysicsPairStats = { eligiblePairs: 0, candidatePairs: 0, aabbTests: 0 };
      const found = new Map<string, PhysicsContact>();
      const contactContributions = new ContactPairAccumulator();
      const nextPersistentPoints = new Map<string, PointImpulse>();
      const persistentNormalTargets = new Map<string, number>();
      const sensed = new Map<string, Omit<PhysicsEvent, 'phase'>>();
      const nextJoints = jointStates.map((joint, index) => ({ ...joint,
        linearImpulseNs: [0, 0, 0] as Vec3, angularImpulseNms: [0, 0, 0] as Vec3,
        ...(joint.motorImpulseNms === undefined ? {} :
          { motorImpulseNms: motorImpulses[index] }) }));
      let islandContributions: readonly CompletedContactPair[] = [];
      if (islandMode) {
        const prepared = prepareFrictionlessIsland(next, pairs, { jointCount: joints.length });
        next = prepared.candidateBodies;
        preparationPhase = 'prepare-output';
        nextPairStats.eligiblePairs = prepared.pairStats.eligiblePairs;
        nextPairStats.candidatePairs = prepared.pairStats.candidatePairs;
        nextPairStats.aabbTests = prepared.pairStats.aabbTests;
        for (const contact of prepared.contacts) found.set(`${contact.aId}\u0000${contact.bId}`, contact);
        islandContributions = prepared.pairContributions;
      } else {
      const bounds = useAabb ? next.map(bodyBounds) : null;
      for (let pass = 0; pass < SOLVER_PASSES; pass++) {
        if (bounds && pass > 0) for (let index = 0; index < next.length; index++) {
          if (next[index].kind !== 'static') bounds[index] = bodyBounds(next[index]);
        }
        for (const [aIndex, bIndex] of pairs) {
          nextPairStats.eligiblePairs++;
          if (largeMode && pass > 0 && dormantPair(next[aIndex], next[bIndex])) continue;
          if (bounds) {
            nextPairStats.aabbTests++;
            if (!boundsOverlap(bounds[aIndex], bounds[bIndex])) continue;
          }
          nextPairStats.candidatePairs++;
          const a = next[aIndex], b = next[bIndex];
          const hit = detect(a, b);
          if (!hit) continue;
          if (hit.penetration > MAX_STEP_DISPLACEMENT_M) error('NUMERIC_LIMIT', 'contact penetration exceeded limit');
          const key = `${a.id}\u0000${b.id}`;
          if (a.sensor || b.sensor) {
            sensed.set(key, { aId: a.id, bId: b.id, kind: 'sensor' });
            continue;
          }
          if (largeMode) wakeOnContact(a, b, nextSleepFrames, aIndex, bIndex);
          let contact = found.get(key);
          if (!contact) {
            contact = { aId: a.id, bId: b.id, normalAtoB: [...hit.normal], pointM: [...hit.pointM],
              penetrationM: 0, impulseNs: 0, tangentImpulseNs: [0, 0, 0] };
            found.set(key, contact);
          }
          const manifold = usePersistentBox ? boxFaceManifold(a, b, hit) : null;
          const points = manifold?.map((entry) => entry.pointM) ?? [hit.pointM];
          contact.pointM = points.reduce((sum, point) => add(sum, point), [0, 0, 0] as Vec3)
            .map((value) => value / points.length) as Vec3;
          contact.penetrationM = Math.max(contact.penetrationM, hit.penetration);
          if (largeMode && dormantPair(a, b)) continue;
          if (manifold) {
            // Capture every point before this pair's first warm start. Targets
            // remain fixed through this step's passes and never enter the cache.
            const restitution = Math.min(a.restitution, b.restitution);
            for (const point of manifold) {
              const pointKey = `${key}\u0000${point.id}`;
              if (persistentNormalTargets.has(pointKey)) continue;
              let target = 0;
              if (restitution !== 0) {
                const velocityA = add(a.velocityMps,
                  cross(a.angularVelocityRadps, sub(point.pointM, a.positionM)));
                const velocityB = add(b.velocityMps,
                  cross(b.angularVelocityRadps, sub(point.pointM, b.positionM)));
                const speed = dot(hit.normal, sub(velocityB, velocityA));
                if (-speed > 0.5) target = -speed * restitution;
              }
              persistentNormalTargets.set(pointKey, target);
            }
            for (const point of manifold) {
              const pointKey = `${key}\u0000${point.id}`;
              let impulse = nextPersistentPoints.get(pointKey);
              if (!impulse) {
                const prior = persistentPoints.get(pointKey);
                impulse = prior ? { normalNs: prior.normalNs, tangentNs: [...prior.tangentNs] as Vec3 }
                  : { normalNs: 0, tangentNs: [0, 0, 0] };
                nextPersistentPoints.set(pointKey, impulse);
                if (prior) contactContributions.add(a.id, b.id,
                  warmStartPoint(a, b, point.pointM, hit.normal, impulse));
              }
            }
            for (let iteration = 0; iteration < 8; iteration++) {
              const order = iteration % 2 ? [...manifold].reverse() : manifold;
              for (const point of order) {
                const pointKey = `${key}\u0000${point.id}`;
                const impulse = nextPersistentPoints.get(pointKey)!;
                contactContributions.add(a.id, b.id,
                  solvePersistentPoint(a, b, point.pointM, hit.normal, impulse,
                    persistentNormalTargets.get(pointKey)!));
              }
            }
            correctPersistentPair(a, b, hit.normal, hit.penetration);
            contact.impulseNs = 0;
            contact.tangentImpulseNs = [0, 0, 0];
            for (const point of manifold) {
              const impulse = nextPersistentPoints.get(`${key}\u0000${point.id}`)!;
              contact.impulseNs += impulse.normalNs;
              contact.tangentImpulseNs = add(contact.tangentImpulseNs, impulse.tangentNs);
            }
          } else {
            const resolved = solve(a, b, hit);
            contactContributions.add(a.id, b.id, resolved.contribution);
            contact.impulseNs += resolved.normalImpulseNs;
            contact.tangentImpulseNs = add(contact.tangentImpulseNs, resolved.tangentImpulseNs);
          }
          if (bounds) {
            bounds[aIndex] = bodyBounds(a);
            bounds[bIndex] = bodyBounds(b);
          }
        }
        if (!disjointHinges) for (let index = 0; index < joints.length; index++) {
          const reaction = projectJoint(joints[index], next, bodies, dt);
          nextJoints[index].linearImpulseNs = add(nextJoints[index].linearImpulseNs, reaction.linearImpulseNs);
          nextJoints[index].angularImpulseNms = add(nextJoints[index].angularImpulseNms, reaction.angularImpulseNms);
          if (reaction.angleRad !== undefined) nextJoints[index].angleRad = reaction.angleRad;
        }
      }
      } // Existing pair/joint iteration belongs only to the non-island route.
      preparationPhase = 'prepare-output';
      if (disjointHinges) {
        if (found.size !== 0 || sensed.size !== 0) {
          error('NUMERIC_LIMIT', 'disjoint hinge contact profile is unsupported');
        }
        applyDisjointHingePostContact(disjointHinges, next, nextJoints, motorImpulses, stepIndex, stepIndex * dt);
      }
      const nextContacts = [...found.values()];
      if (largeMode) updateSleeping(next, nextContacts, nextSleepFrames);
      const nextActive = new Map<string, Omit<PhysicsEvent, 'phase'>>(sensed);
      for (const contact of nextContacts) {
        nextActive.set(`${contact.aId}\u0000${contact.bId}`,
          { aId: contact.aId, bId: contact.bId, kind: 'contact' });
      }
      const nextEvents = [...new Set([...activePairs.keys(), ...nextActive.keys()])].sort().map((key): PhysicsEvent => {
        const current = nextActive.get(key);
        const previous = activePairs.get(key);
        return { ...(current ?? previous!), phase: current ? previous ? 'stay' : 'begin' : 'end' };
      });
      preparationPhase = 'validation';
      validateResult(next, nextContacts);
      if (ccd.kind === 'box-pair' && !axisAlignedBox(next[ccd.boxIndex])) {
        error('NUMERIC_LIMIT', 'box CCD contact rotated outside the admitted profile');
      }
      if (nextJoints.some((joint) => [...joint.linearImpulseNs, ...joint.angularImpulseNms].some((value) =>
        !Number.isFinite(value)) || (joint.angleRad !== undefined && !Number.isFinite(joint.angleRad)))) {
        error('NUMERIC_LIMIT', 'unsafe joint reaction');
      }
      for (let index = 0; index < joints.length; index++) {
        const motor = joints[index].motor;
        if (motor && Math.hypot(...nextJoints[index].angularImpulseNms) > motor.maxReactionNms) {
          error('NUMERIC_LIMIT', `${joints[index].id} exceeded motor reaction limit`);
        }
      }
      if (!islandMode) contactContributions.finish();
      else for (const pair of islandContributions) {
        if (!next.some(body => body.id === pair.aId) || !next.some(body => body.id === pair.bId) ||
          [pair.onA, pair.onB].some(side => [side.linearImpulseNs, side.angularImpulseAboutWorldOriginNms]
            .some(vector => vector.length !== 3 || vector.some(value => !Number.isFinite(value))))) {
          error('NUMERIC_LIMIT', 'unsafe completed island contribution');
        }
      }
      preparationPhase = 'prepare-output';
      const state = publicState(next, nextContacts, nextEvents, nextJoints, nextCcdHits, nextPairStats, stepIndex + 1, dt, identity, colliderIds);
      // All candidate, output and recording allocations finish before shared commit.
      const preparedRecording = owner ? owner.prepare(preparedFrames!, state) : null;
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
      if (owner) { owner.recording = preparedRecording!; owner.commandCount = preparedCommandCount; }
      return state;
      } catch (failure) {
        if (!islandMode || !(failure instanceof PhysicsError)) throw failure;
        const enriched = new PhysicsError(failure.code, failure.message, {
          operation: owner ? 'record' : 'step', phase: failure.code === 'WORLD_LIMIT' ? 'budget' : preparationPhase,
          domain: 'rigid', entityIds: [...failure.details.entityIds], accepted: { stepIndex, timeSeconds: stepIndex * dt } });
        enriched.stack = failure.stack;
        throw enriched;
      }
    },
    query(input): QueryResult {
      ensureActive();
      const data = queryRecord(input, ['kind','includeSensors'], ['centerM','radiusM','originM','direction','maxDistanceM']);
      const sensors = includeSensors(data);
      if (data.kind === 'overlap-sphere') {
        const query = queryRecord(data, ['kind','centerM','radiusM','includeSensors'], []);
        const center = queryVector(query.centerM, 10000, 'centerM');
        const radius = queryNumber(query.radiusM, 0.0001, 1000, 'radiusM');
        if (domainState) error('INVALID_QUERY', 'visual domain queries are unsupported');
        return { kind: 'overlap-sphere', colliderIds: bodies.filter((body) => (sensors || !body.sensor) && sphereOverlaps(center, radius, body))
          .map((body) => body.id).sort().map((id) => colliderIds.get(id)!) };
      }
      if (data.kind !== 'raycast') error('INVALID_QUERY', 'unsupported query kind');
      const query = queryRecord(data, ['kind','originM','direction','maxDistanceM','includeSensors'], []);
      const origin = queryVector(query.originM, 10000, 'originM');
      const direction = queryVector(query.direction, 1 + 1e-9, 'direction');
      if (Math.abs(Math.hypot(...direction) - 1) > 1e-9) error('INVALID_QUERY', 'direction must be a unit 3-vector');
      const limit = queryNumber(query.maxDistanceM, 0.0001, 10000, 'maxDistanceM');
      if (domainState) error('INVALID_QUERY', 'visual domain queries are unsupported');
      let best: PhysicsRayHit | null = null;
      for (const body of bodies) {
        if (!sensors && body.sensor) continue;
        const distance = rayDistance(origin, direction, body);
        if (distance === null || distance > limit) continue;
        if (best === null || distance < best.distanceM || (distance === best.distanceM && body.id < best.bodyId)) best = { bodyId: body.id, distanceM: distance };
      }
      return { kind: 'raycast', hit: best === null ? null : { ...best, colliderId: colliderIds.get(best.bodyId)! } };
    },
    dispose() { disposed = true;
      if (owner) { owner.recording = null; owner.commandCount = 0; owner = null; }
      optionsCopy = null; domainState = null; advancingOwner = null; bodies = []; contacts = []; events = []; ccdHits = [];
      activePairs.clear(); persistentPoints.clear(); sleepFrames = []; jointStates = [];
      joints = []; dynamicHinge = undefined; disjointHinges = null; ccd = { kind: 'none' }; pairs.length = 0;
      colliderIds.clear(); modelCopy = null; },
  };
  let running = false;
  function guarded<T>(operation: FailureDetails['operation'], action: () => T): T {
    if (disposed) throw new PhysicsError('DISPOSED', 'world is disposed', {
      operation, phase: 'lifecycle', domain: 'world', entityIds: [], accepted: { stepIndex, timeSeconds: stepIndex * dt } });
    if (running) throw new PhysicsError('REENTRANT_CALL', 'World call is reentrant', {
      operation, phase: 'lifecycle', domain: 'world', entityIds: [], accepted: { stepIndex, timeSeconds: stepIndex * dt } });
    running = true;
    try { return action(); }
    catch (failure) {
      if (!(failure instanceof PhysicsError)) throw failure;
      const enriched = new PhysicsError(failure.code, failure.message, {
        operation, phase: (stationaryMode || islandMode) && ['candidate','validation','prepare-output','budget'].includes(failure.details.phase) && failure.details.accepted !== null ? failure.details.phase :
          ['DISPOSED','WORLD_OWNED','REENTRANT_CALL'].includes(failure.code) ? 'lifecycle' :
          failure.code === 'WORLD_LIMIT' ? 'budget' : failure.code === 'NUMERIC_LIMIT' ? 'validation' : 'admission',
        domain: domainKind ?? 'rigid', entityIds: domainId && failure.details.entityIds.length === 0 ? [domainId] : failure.details.entityIds,
        accepted: { stepIndex, timeSeconds: stepIndex * dt } });
      enriched.stack = failure.stack;
      throw enriched;
    } finally { running = false; }
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
  world.dispose = () => { if (!disposed) guarded('read', dispose); };
  recordingWorlds.set(world, {
    attach: (prepare) => guarded('record', () => {
      if (owner) error('WORLD_OWNED', 'World has an exclusive recorder');
      if (stepIndex !== 0) error('INVALID_SNAPSHOT', 'recording must attach at step zero');
      const prepared = prepare({ model: copyData(modelCopy!), options: copyData(optionsCopy!), state: getState() });
      owner = prepared;
      return prepared;
    }),
    detach: (current) => {
      if (!disposed) guarded('record', () => {
        if (owner === current) owner = null;
        current.recording = null; current.commandCount = 0;
      });
    },
    read: (current) => guarded('record', () => {
      if (owner !== current) error('DISPOSED', 'recorder is detached');
      return getState();
    }),
    step: (current, commands) => guarded('record', () => {
      if (owner !== current) error('DISPOSED', 'recorder is detached');
      advancingOwner = current;
      try { return step(commands); } finally { advancingOwner = null; }
    }),
  });
  return world;
}
