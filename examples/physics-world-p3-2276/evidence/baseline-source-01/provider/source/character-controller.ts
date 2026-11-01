import { admitConfig, admitCommand } from './character/admission.js';
import { createCharacterCore } from './character/core.js';
import { projectState } from './character/state.js';
import { PhysicsError } from './capsule-query-error.js';
import type { CapsuleControllerConfigV1, UprightCapsuleController } from './character/types.js';

export type {
  CapsuleControllerConfigV1, CapsuleControllerStepV1, CapsuleControllerStateV1,
  CapsuleControllerSupportV1, CapsuleControllerAssistV1, UprightCapsuleController,
} from './character/types.js';

/** Fixed upright capsule gameplay movement against an immutable bounded box scene. */
export function createUprightCapsuleController(config: CapsuleControllerConfigV1): UprightCapsuleController {
  const admitted = admitConfig(config);
  const core = createCharacterCore(admitted.scene, admitted.positionM, {}, { capture: false });
  let disposed = false;
  function live(): void { if (disposed) throw new PhysicsError('DISPOSED', 'Capsule controller is disposed'); }
  return {
    getSnapshot() { live(); return projectState(core.getState()); },
    step(input) {
      live();
      const command = admitCommand(input);
      return projectState(core.step(command.dtSeconds, command.desiredVelocityMps, command.sceneRevision));
    },
    dispose() { if (!disposed) { disposed = true; core.dispose(); } },
  };
}
