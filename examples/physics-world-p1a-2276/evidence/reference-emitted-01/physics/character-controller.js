import { admitConfig, admitCommand } from './character/admission.js';
import { createCharacterCore } from './character/core.js';
import { projectState } from './character/state.js';
import { PhysicsError } from './capsule-query-error.js';
/** Fixed upright capsule gameplay movement against an immutable bounded box scene. */
export function createUprightCapsuleController(config) {
    const admitted = admitConfig(config);
    const core = createCharacterCore(admitted.scene, admitted.positionM, {}, { capture: false });
    let disposed = false;
    function live() { if (disposed)
        throw new PhysicsError('DISPOSED', 'Capsule controller is disposed'); }
    return {
        getSnapshot() { live(); return projectState(core.getState()); },
        step(input) {
            live();
            const command = admitCommand(input);
            return projectState(core.step(command.dtSeconds, command.desiredVelocityMps, command.sceneRevision));
        },
        dispose() { if (!disposed) {
            disposed = true;
            core.dispose();
        } },
    };
}
