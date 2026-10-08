import type { Body, PhysicsCcdHit, PhysicsContact, PhysicsEvent, PhysicsJointState, PhysicsPairStats, PhysicsState, PhysicsWorld, PhysicsWorldConfig, PhysicsRayHit, Vec3 } from './types.js';
import { MAX_BODIES, MAX_LARGE_BODIES, MAX_STEPS, MAX_STEP_DISPLACEMENT_M, SOLVER_PASSES } from './limits.js';
import { error, record, fields, finite, vector, parseBody, parseCommands, copyBody, copyShape, queryRecord, queryVector, queryNumber, includeSensors } from './validation.js';
import { add, scale, inverseInertia, advanceOrientation } from './math.js';
import { parseJoints, projectJoint } from './joints.js';
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

function publicState(bodies: Body[], contacts: PhysicsContact[], events: PhysicsEvent[],
  joints: PhysicsJointState[], ccdHits: PhysicsCcdHit[], pairStats: PhysicsPairStats,
  stepIndex: number, dt: number): PhysicsState {
  return {
    stepIndex, timeSeconds: stepIndex * dt,
    bodies: bodies.map(({ id, kind, shape: collider, positionM, velocityMps, orientation, angularVelocityRadps, inertiaKgM2, inertiaDiagonalKgM2, sensor, ccd, collisionFilter, sleeping }) =>
      ({ id, kind, shape: copyShape(collider), positionM: [...positionM], velocityMps: [...velocityMps],
        orientation: [...orientation], angularVelocityRadps: [...angularVelocityRadps],
        ...(inertiaKgM2 === undefined ? {} : { inertiaKgM2 }),
        ...(inertiaDiagonalKgM2 === undefined ? {} : { inertiaDiagonalKgM2: [...inertiaDiagonalKgM2] as Vec3 }),
        ...(sensor ? { sensor: true } : {}), ...(ccd ? { ccd: true as const } : {}),
        ...(collisionFilter ? { collisionFilter: { ...collisionFilter } } : {}),
        ...(sleeping !== undefined ? { sleeping } : {}) })),
    contacts: contacts.map(({ aId, bId, normalAtoB, pointM, penetrationM, impulseNs, tangentImpulseNs }) =>
      ({ aId, bId, normalAtoB: [...normalAtoB], pointM: [...pointM], penetrationM, impulseNs,
        tangentImpulseNs: [...tangentImpulseNs] })),
    events: events.map((event) => ({ ...event })),
    joints: joints.map((joint) => ({ ...joint, linearImpulseNs: [...joint.linearImpulseNs],
      angularImpulseNms: [...joint.angularImpulseNms] })),
    ccdHits: ccdHits.map((hit) => ({ ...hit, normalFixtureToBody: [...hit.normalFixtureToBody] })),
    pairStats: { ...pairStats },
  };
}

export function createPhysicsWorld(config: PhysicsWorldConfig): PhysicsWorld {
  const input = record(config, 'world');
  fields(input, ['fixedStepSeconds', 'gravityMps2', 'bodies', 'joints', 'broadPhase', 'contactMode', 'sceneMode'], 'world');
  if (Object.hasOwn(input, 'sceneMode') && input.sceneMode !== 'large-v1') {
    error('INVALID_CONFIG', 'sceneMode must be large-v1 when present');
  }
  if (Object.hasOwn(input, 'broadPhase') && input.broadPhase !== 'aabb') {
    error('INVALID_CONFIG', 'broadPhase must be aabb when present');
  }
  if (Object.hasOwn(input, 'contactMode') && input.contactMode !== 'persistent-box-v1') {
    error('INVALID_CONFIG', 'contactMode must be persistent-box-v1 when present');
  }
  const useAabb = input.broadPhase === 'aabb';
  const usePersistentBox = input.contactMode === 'persistent-box-v1';
  const largeMode = input.sceneMode === 'large-v1';
  if (largeMode && (!useAabb || usePersistentBox || Object.hasOwn(input, 'joints'))) {
    error('INVALID_CONFIG', 'large-v1 requires aabb and excludes joints and persistent-box-v1');
  }
  const dt = finite(input.fixedStepSeconds, 1 / 240, 1 / 30, 'fixedStepSeconds');
  const gravity = vector(input.gravityMps2, -1000, 1000, 'gravityMps2');
  const bodyLimit = largeMode ? MAX_LARGE_BODIES : MAX_BODIES;
  if (!Array.isArray(input.bodies) || input.bodies.length < 1 || input.bodies.length > bodyLimit) {
    error('INVALID_CONFIG', `bodies must contain 1..${bodyLimit} entries`);
  }
  if (usePersistentBox && input.bodies.length > 4) {
    error('INVALID_CONFIG', 'persistent-box-v1 admits at most four bodies');
  }
  let bodies = input.bodies.map((value) => parseBody(value, largeMode));
  if (largeMode && bodies.some((body) => body.ccd)) {
    error('INVALID_CONFIG', 'large-v1 excludes CCD');
  }
  if (!bodies.some((body) => body.kind === 'dynamic')) error('INVALID_CONFIG', 'at least one dynamic body is required');
  if (new Set(bodies.map((body) => body.id)).size !== bodies.length) error('INVALID_CONFIG', 'duplicate body ID');
  const joints = parseJoints(Object.hasOwn(input, 'joints') ? input.joints : [], bodies);
  const ccd = admitCcd(bodies, joints.length, gravity);
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
    ...(joint.kind === 'hinge' ? { angleRad: 0 } : {}) }));
  let activePairs = new Map<string, Omit<PhysicsEvent, 'phase'>>();
  let persistentPoints = new Map<string, PointImpulse>();
  let sleepFrames = bodies.map(() => 0);
  let stepIndex = 0;
  let disposed = false;
  const ensureActive = () => { if (disposed) error('DISPOSED', 'world is disposed'); };
  return {
    getState() { ensureActive(); return publicState(bodies, contacts, events, jointStates, ccdHits, pairStats, stepIndex, dt); },
    step(fixedStepSeconds, commands = []) {
      ensureActive();
      if (fixedStepSeconds !== dt) error('INVALID_STEP', 'step must equal configured fixedStepSeconds');
      if (stepIndex >= MAX_STEPS) error('WORLD_LIMIT', 'world step limit reached');
      const actions = parseCommands(commands, bodies);
      if (ccd.kind === 'box-pair') rejectAngularBoxCommand(actions.get(bodies[ccd.boxIndex].id));
      const next = bodies.map(copyBody);
      const nextSleepFrames = sleepFrames.slice();
      if (largeMode) wakeForActions(next, contacts, actions, nextSleepFrames);
      for (const body of next) {
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
          const angularImpulse = action?.angularImpulseNms ?? [0, 0, 0];
          const torque = action?.torqueNm ?? [0, 0, 0];
          body.angularVelocityRadps = add(body.angularVelocityRadps,
            inverseInertia(body, add(angularImpulse, scale(torque, dt))));
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
      const nextPersistentPoints = new Map<string, PointImpulse>();
      const sensed = new Map<string, Omit<PhysicsEvent, 'phase'>>();
      const nextJoints = jointStates.map((joint) => ({ ...joint,
        linearImpulseNs: [0, 0, 0] as Vec3, angularImpulseNms: [0, 0, 0] as Vec3 }));
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
            for (const point of manifold) {
              const pointKey = `${key}\u0000${point.id}`;
              let impulse = nextPersistentPoints.get(pointKey);
              if (!impulse) {
                const prior = persistentPoints.get(pointKey);
                impulse = prior ? { normalNs: prior.normalNs, tangentNs: [...prior.tangentNs] as Vec3 }
                  : { normalNs: 0, tangentNs: [0, 0, 0] };
                nextPersistentPoints.set(pointKey, impulse);
                if (prior) warmStartPoint(a, b, point.pointM, hit.normal, impulse);
              }
            }
            for (let iteration = 0; iteration < 8; iteration++) {
              const order = iteration % 2 ? [...manifold].reverse() : manifold;
              for (const point of order) {
                const impulse = nextPersistentPoints.get(`${key}\u0000${point.id}`)!;
                solvePersistentPoint(a, b, point.pointM, hit.normal, impulse);
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
            contact.impulseNs += resolved.normalImpulseNs;
            contact.tangentImpulseNs = add(contact.tangentImpulseNs, resolved.tangentImpulseNs);
          }
          if (bounds) {
            bounds[aIndex] = bodyBounds(a);
            bounds[bIndex] = bodyBounds(b);
          }
        }
        for (let index = 0; index < joints.length; index++) {
          const reaction = projectJoint(joints[index], next, bodies, dt);
          nextJoints[index].linearImpulseNs = add(nextJoints[index].linearImpulseNs, reaction.linearImpulseNs);
          nextJoints[index].angularImpulseNms = add(nextJoints[index].angularImpulseNms, reaction.angularImpulseNms);
          if (reaction.angleRad !== undefined) nextJoints[index].angleRad = reaction.angleRad;
        }
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
      validateResult(next, nextContacts);
      if (ccd.kind === 'box-pair' && !axisAlignedBox(next[ccd.boxIndex])) {
        error('NUMERIC_LIMIT', 'box CCD contact rotated outside the admitted profile');
      }
      if (nextJoints.some((joint) => [...joint.linearImpulseNs, ...joint.angularImpulseNms].some((value) =>
        !Number.isFinite(value)) || (joint.angleRad !== undefined && !Number.isFinite(joint.angleRad)))) {
        error('NUMERIC_LIMIT', 'unsafe joint reaction');
      }
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
      return publicState(bodies, contacts, events, jointStates, ccdHits, pairStats, stepIndex, dt);
    },
    overlapSphere(input) {
      ensureActive();
      const query = queryRecord(input, ['centerM', 'radiusM'], ['includeSensors']);
      const center = queryVector(query.centerM, 10000, 'centerM');
      const radius = queryNumber(query.radiusM, 0.0001, 1000, 'radiusM');
      const sensors = includeSensors(query);
      return bodies.filter((body) => (sensors || !body.sensor) && sphereOverlaps(center, radius, body))
        .map((body) => body.id).sort();
    },
    raycast(input) {
      ensureActive();
      const query = queryRecord(input, ['originM', 'direction', 'maxDistanceM'], ['includeSensors']);
      const origin = queryVector(query.originM, 10000, 'originM');
      const direction = queryVector(query.direction, 1 + 1e-9, 'direction');
      if (Math.abs(Math.hypot(...direction) - 1) > 1e-9) {
        error('INVALID_QUERY', 'direction must be a unit 3-vector');
      }
      const limit = queryNumber(query.maxDistanceM, 0.0001, 10000, 'maxDistanceM');
      const sensors = includeSensors(query);
      let best: PhysicsRayHit | null = null;
      for (const body of bodies) {
        if (!sensors && body.sensor) continue;
        const distance = rayDistance(origin, direction, body);
        if (distance === null || distance > limit) continue;
        if (best === null || distance < best.distanceM ||
          (distance === best.distanceM && body.id < best.bodyId)) {
          best = { bodyId: body.id, distanceM: distance };
        }
      }
      return best;
    },
    dispose() { disposed = true; bodies = []; contacts = []; events = []; ccdHits = [];
      activePairs.clear(); persistentPoints.clear(); sleepFrames = []; },
  };
}
