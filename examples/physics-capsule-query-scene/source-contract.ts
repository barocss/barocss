import { createUprightCapsuleQuery, PhysicsError } from '@barocss/physics';
import type { CapsuleQueryBoxV1, CapsuleQuerySceneV1, CapsuleSweepInputV1, CapsuleSweepHitV1, UprightCapsuleQuery } from '@barocss/physics';
const box: CapsuleQueryBoxV1 = { id: 'wall', centerM: [.5,.6,0], halfExtentsM: [.05,1,1], orientationXYZW: [0,0,0,1] };
const scene: CapsuleQuerySceneV1 = {version:1,profile:'upright-capsule-box-v1',revision:'typed1',boxes:[box]};
const input: CapsuleSweepInputV1 = {revision:'typed1',centerM:[-.5,.6,0],displacementM:[2,0,0],excludeId:null};
const query: UprightCapsuleQuery = createUprightCapsuleQuery(scene);
const hit: CapsuleSweepHitV1 | null = query.sweep(input);
if(hit){const normal: [number,number,number]=hit.normalFixtureToCapsule;const fraction:number=hit.toiFraction;void normal;void fraction;}
// @ts-expect-error Version2 is outside the selected DTO.
const invalid: CapsuleQuerySceneV1 = {...scene,version:2};
void invalid;void PhysicsError;query.dispose();
