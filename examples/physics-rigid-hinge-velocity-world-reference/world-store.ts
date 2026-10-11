import type { Body, PhysicsContact, PhysicsEvent, PhysicsJointState, PhysicsCcdHit, PhysicsPairStats, PhysicsState, Vec3 } from '../../packages/barocss-physics/src/types.js';
import type { PointImpulse } from '../../packages/barocss-physics/src/persistent-box-contact.js';
import { copyShape } from '../../packages/barocss-physics/src/validation.js';
import { copyData, copyBodies } from './copy.js';
import type { WorldDiagnostics, WorldTransactionSnapshot } from './types.js';

export interface WorldStore {
  bodies: Body[]; contacts: PhysicsContact[]; events: PhysicsEvent[];
  joints: PhysicsJointState[]; ccdHits: PhysicsCcdHit[]; pairStats: PhysicsPairStats;
  activePairs: Map<string, Omit<PhysicsEvent, 'phase'>>;
  persistentPoints: Map<string, PointImpulse>; sleepFrames: number[];
  stepIndex: number; diagnostics: WorldDiagnostics | null;
}

/** Same public field selection and copy operation as the archived original World. */
export function publicState(store: WorldStore, dt: number): PhysicsState {
  const { bodies, contacts, events, joints, ccdHits, pairStats, stepIndex } = store;
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
    events: events.map(event => ({ ...event })),
    joints: joints.map(joint => ({ ...joint, linearImpulseNs: [...joint.linearImpulseNs],
      angularImpulseNms: [...joint.angularImpulseNms] })),
    ccdHits: ccdHits.map(hit => ({ ...hit, normalFixtureToBody: [...hit.normalFixtureToBody] })),
    pairStats: { ...pairStats },
  };
}

export function transactionSnapshot(store: WorldStore, dt: number): WorldTransactionSnapshot {
  return {
    stepIndex: store.stepIndex, timeSeconds: store.stepIndex * dt,
    bodies: copyBodies(store.bodies), contacts: copyData(store.contacts), events: copyData(store.events),
    joints: copyData(store.joints), ccdHits: copyData(store.ccdHits), pairStats: { ...store.pairStats },
    activePairs: [...store.activePairs].map(([key, value]) => [key, copyData(value)]),
    persistentPoints: [...store.persistentPoints].map(([key, value]) => [key, copyData(value)]),
    sleepFrames: store.sleepFrames.slice(), diagnostics: copyData(store.diagnostics),
  };
}
