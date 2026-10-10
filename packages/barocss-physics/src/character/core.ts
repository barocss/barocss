import { createUprightCapsuleQuery } from '../capsule-query.js';
import { PhysicsError } from '../capsule-query-error.js';
import type { Vec3 } from '../types.js';
import type { CapsuleQuerySceneV1 } from '../capsule-query.js';
import { DT, GRAVITY, PROFILE } from './profile.js';
import { clone } from './math.js';
import { admitConfig, admitCoreCommand } from './admission.js';
import { initialState, validateState, errorRecord } from './state.js';
import { queryContext } from './query.js';
import { move } from './slide.js';
import { snap } from './ground.js';
import { validateAssist } from './step-assist.js';
import type { CharacterCore, CharacterDiagnostics, CharacterState, RejectedAttempt } from './types.js';

/** Private direct harness entry. The public facade uses this same core with capture disabled. */
export function createCharacterCore(scene: CapsuleQuerySceneV1, positionM: Vec3,
    diagnostic: CharacterDiagnostics = {}, options: { capture?: boolean } = {}): CharacterCore {
  const admitted = admitConfig({ version: 1, profile: PROFILE, scene, positionM });
  const query = createUprightCapsuleQuery(admitted.scene);
  let state: CharacterState;
  try {
    const snapshot = query.getSnapshot();
    query.sweep({ revision: snapshot.revision, centerM: [...admitted.positionM], displacementM: [0, 0, 0], excludeId: null });
    state = initialState(admitted.positionM, snapshot.revision);
  } catch (error) { query.dispose(); throw error; }
  const capture = options.capture ?? true;
  let lastRejected: RejectedAttempt | null = null, disposed = false;
  function live(): void { if (disposed) throw new PhysicsError('DISPOSED', 'Capsule controller is disposed'); }
  return {
    getState() { live(); return clone(state); },
    getLastRejected() { return clone(lastRejected); },
    step(dt, velocity, revision = state.sceneRevision) {
      live();
      let attempted: CharacterState | null = null;
      try {
        const request = admitCoreCommand(dt, velocity, revision, state.sceneRevision, state.stepIndex);
        const next = clone(state);
        attempted = next;
        next.queryCount = 0; next.lastQueries = []; next.lastSegments = []; next.blocked = false;
        const assisted = !!state.assist, speed = Math.hypot(request[0], request[2]);
        if (assisted && (speed === 0 || Math.abs(request[0] / speed - state.assist!.directionXZ[0]) > 1e-12 ||
            Math.abs(request[2] / speed - state.assist!.directionXZ[1]) > 1e-12)) {
          throw new PhysicsError('INVALID_COMMAND', 'Controller assist request changed');
        }
        const predicted = state.grounded || assisted ? 0 : state.fallVelocityYMps + GRAVITY * DT;
        next.fallVelocityYMps = predicted;
        next.gravityPrediction = capture ? {
          previousFallVelocityYMps: state.fallVelocityYMps, previousGrounded: state.grounded,
          previousAssisted: assisted, predictedFallVelocityYMps: predicted, predictedDeltaYM: predicted * DT,
        } : null;
        const context = queryContext(query, next, diagnostic, capture);
        const delta: Vec3 = [request[0] * DT, predicted * DT, request[2] * DT];
        let p = move(state.positionM, delta, next, context, diagnostic);
        p = snap(p, next, context);
        validateAssist(p, next, context, diagnostic);
        if (diagnostic.numericFault) throw new PhysicsError('NUMERIC_LIMIT', 'Internal controller numeric fault');
        const actualVelocity = p.map((value, index) => (value - state.positionM[index]) / DT) as Vec3;
        validateState(p, actualVelocity, request, state);
        next.positionM = p; next.velocityMps = actualVelocity;
        next.stepIndex++; next.timeSeconds = next.stepIndex * DT;
        state = next; lastRejected = null;
        return clone(state);
      } catch (error) {
        if (capture) lastRejected = { acceptedState: clone(state), attemptedState: clone(attempted), error: errorRecord(error) };
        throw error;
      }
    },
    dispose() { if (!disposed) { disposed = true; query.dispose(); } },
  };
}
