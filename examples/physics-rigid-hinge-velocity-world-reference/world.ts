import type { PhysicsWorldConfig, PhysicsEvent, PhysicsJointState, Vec3 } from '../../packages/barocss-physics/src/types.js';
import { MAX_STEPS, MAX_STEP_DISPLACEMENT_M } from '../../packages/barocss-physics/src/limits.js';
import { error, parseCommands } from '../../packages/barocss-physics/src/validation.js';
import { admitDynamicHingeCommands } from '../../packages/barocss-physics/src/dynamic-hinge-joint.js';
import { validateResult } from '../../packages/barocss-physics/src/collision.js';
import { enforceHingeMotorReactionCap } from '../physics-rigid-hinge-motor-reference/report.js';
import { admitWorldProfile } from './profile.js';
import { admitWorldOptions } from './options.js';
import { copyBodies, copyData } from './copy.js';
import { makeWorldAttempt, runAngularStage, runMotorStage, runFreeStage, runContactStage, markKnownRefusedCall } from './stages.js';
import { runPostContactStage } from './postcontact-pair.js';
import { makeWorldDiagnostics, validateWorldDiagnostics } from './diagnostics.js';
import { knownWorldCalculationError, worldFailure } from './errors.js';
import { publicState, transactionSnapshot } from './world-store.js';
import type { WorldStore } from './world-store.js';
import { overlapAccepted, raycastAccepted } from './world-query.js';
import type { HingeVelocityWorld } from './types.js';

export function createHingeVelocityWorldCandidate(config: PhysicsWorldConfig, privateOptions: unknown = {}): HingeVelocityWorld {
  // Original config/profile errors precede admission of an observer.
  const profile = admitWorldProfile(config);
  const options = admitWorldOptions(privateOptions);
  const dt = profile.dt;
  let store: WorldStore = {
    bodies: copyBodies(profile.bodies), contacts: [], events: [], ccdHits: [],
    pairStats: { eligiblePairs: 0, candidatePairs: 0, aabbTests: 0 },
    joints: profile.joints.map(joint => ({ id: joint.id, kind: joint.kind,
      aId: profile.bodies[joint.aIndex].id, bId: profile.bodies[joint.bIndex].id,
      linearImpulseNs: [0, 0, 0], angularImpulseNms: [0, 0, 0],
      ...(joint.kind === 'hinge' ? { angleRad: 0 } : {}),
      ...(joint.motor ? { motorImpulseNms: 0 } : {}) })),
    activePairs: new Map(), persistentPoints: new Map(), sleepFrames: profile.bodies.map(() => 0),
    stepIndex: 0, diagnostics: null,
  };
  let disposed = false;
  const ensureActive = () => { if (disposed) error('DISPOSED', 'world is disposed'); };
  return {
    getState() { ensureActive(); return publicState(store, dt); },
    getDiagnostics() { ensureActive(); return copyData(store.diagnostics); },
    getTransactionSnapshot() { ensureActive(); return transactionSnapshot(store, dt); },
    step(fixedStepSeconds, commands = []) {
      ensureActive();
      if (fixedStepSeconds !== dt) error('INVALID_STEP', 'step must equal configured fixedStepSeconds');
      if (store.stepIndex >= MAX_STEPS) error('WORLD_LIMIT', 'world step limit reached');
      const actions = parseCommands(commands, store.bodies);
      for (const hinge of profile.joints) admitDynamicHingeCommands(hinge, store.bodies, actions);
      const next = copyBodies(store.bodies);
      const attempt = makeWorldAttempt(profile, store.bodies, store.joints, store.stepIndex, actions);
      let staged: WorldStore;
      try {
        runAngularStage(profile, next, attempt, actions);
        runMotorStage(profile, next, attempt, store.joints);
        runFreeStage(profile, next, attempt, actions);
        const contact = runContactStage(profile, next, attempt, store.persistentPoints);
        runPostContactStage(profile, next, attempt, store.joints);
        const nextJoints: PhysicsJointState[] = attempt.pairs.map(pair => {
          if (pair === null) worldFailure('diagnostics');
          return copyData(pair.jointReport);
        });
        const nextActive = new Map<string, Omit<PhysicsEvent, 'phase'>>(contact.sensed);
        for (const entry of contact.contacts) nextActive.set(`${entry.aId}\u0000${entry.bId}`,
          { aId: entry.aId, bId: entry.bId, kind: 'contact' });
        const nextEvents = [...new Set([...store.activePairs.keys(), ...nextActive.keys()])].sort()
          .map((key): PhysicsEvent => {
            const current = nextActive.get(key), previous = store.activePairs.get(key);
            return { ...(current ?? previous!), phase: current ? previous ? 'stay' : 'begin' : 'end' };
          });
        const diagnostics = makeWorldDiagnostics(profile, attempt);
        validateResult(next, contact.contacts);
        if (nextJoints.some(joint => [...joint.linearImpulseNs, ...joint.angularImpulseNms].some(value =>
          !Number.isFinite(value)) || joint.angleRad !== undefined && !Number.isFinite(joint.angleRad)))
          error('NUMERIC_LIMIT', 'unsafe joint reaction');
        validateWorldDiagnostics(diagnostics);
        for (let index = 0; index < next.length; index++) {
          const delta = next[index].positionM.map((value, component) => value - store.bodies[index].positionM[component]) as Vec3;
          if (Math.hypot(...delta) > MAX_STEP_DISPLACEMENT_M) worldFailure('result');
        }
        attempt.stage = 'report-ready';
        staged = { bodies: next, contacts: contact.contacts, events: nextEvents, joints: nextJoints,
          ccdHits: [], pairStats: { ...attempt.pairStats }, activePairs: nextActive,
          persistentPoints: contact.persistentPoints, sleepFrames: store.sleepFrames.slice(),
          stepIndex: store.stepIndex + 1, diagnostics };
      } catch (received) {
        const known = knownWorldCalculationError(received, store.bodies);
        if (known === null) throw received;
        markKnownRefusedCall(attempt);
        attempt.error = known;
        // Outside calculation handling: callback failures retain their exact identity.
        options.observeAttempt?.(copyData(attempt));
        throw received;
      }
      options.observeAttempt?.(copyData(attempt));
      // Parent strict reaction cap order. A cap failure has one report-ready observation, error:null.
      for (const joint of staged.joints) enforceHingeMotorReactionCap(joint.id, joint.angularImpulseNms);
      // All accepted fields move together after every check and both caps.
      store = staged;
      return publicState(store, dt);
    },
    overlapSphere(input) { ensureActive(); return overlapAccepted(store.bodies, input); },
    raycast(input) { ensureActive(); return raycastAccepted(store.bodies, input); },
    dispose() {
      disposed = true;
      store.bodies = []; store.contacts = []; store.events = []; store.ccdHits = [];
      store.activePairs.clear(); store.persistentPoints.clear(); store.sleepFrames = [];
      store.diagnostics = null;
    },
  };
}
