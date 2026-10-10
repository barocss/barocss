import {createUprightCapsuleController,PhysicsError} from '@barocss/physics';
import type {CapsuleControllerConfigV1,CapsuleControllerStepV1,CapsuleControllerStateV1,CapsuleControllerSupportV1,CapsuleControllerAssistV1,UprightCapsuleController} from '@barocss/physics';
const config:CapsuleControllerConfigV1={version:1,profile:'upright-capsule-controller-v1',scene:{version:1,profile:'upright-capsule-box-v1',revision:'typed1',boxes:[]},positionM:[0,1,0]};
const controller:UprightCapsuleController=createUprightCapsuleController(config);
const step:CapsuleControllerStepV1={dtSeconds:1/120,sceneRevision:'typed1',desiredVelocityMps:[0,0,0]};
const state:CapsuleControllerStateV1=controller.step(step);const support:CapsuleControllerSupportV1|null=state.support;const assist:CapsuleControllerAssistV1|null=state.assist;
// @ts-expect-error Diagnostic limits are internal only.
createUprightCapsuleController({...config,queryBudget:0});
// @ts-expect-error No public trace.
state.lastQueries;
// @ts-expect-error No public scene mutation.
controller.updateScene(config.scene);
void support;void assist;void PhysicsError;controller.dispose();
