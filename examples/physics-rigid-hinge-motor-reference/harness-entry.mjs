/** Harness-only original helper bridge; producer entry remains unchanged. */
export * from './entry.ts';
export {prepareInput} from '../physics-rigid-hinge-velocity-reference/profile.ts';
export {parseCommands} from '../../packages/barocss-physics/src/validation.js';
export {admitDynamicHingeCommands} from '../../packages/barocss-physics/src/dynamic-hinge-joint.js';
export {driveDynamicHingeMotor} from '../../packages/barocss-physics/src/joint-motor.js';
