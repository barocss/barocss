import type { Body, PhysicsCcdHit, Vec3 } from '../../packages/barocss-physics/src/types.js';
import type { CcdProfile } from '../../packages/barocss-physics/src/ccd.js';
export { sweepSphere } from '../../packages/barocss-physics/src/ccd.js';
import { createRigidCapsuleFaceReference } from '../physics-rigid-capsule-ccd-reference/entry.js';
import { advanceHeadOnFaceStep } from '../physics-rigid-capsule-ccd-reference/response.js';
import type { Hit, Result, Snapshot } from '../physics-rigid-capsule-ccd-reference/profile.js';
import { faceContext, assertCurrentProfile, type CapsuleFaceScene } from './candidate-profile.js';
export interface CapsuleFaceCcdProfile { kind:'capsule-face'; capsuleIndex:number; fixtureIndex:number; snapshot:Snapshot; reference:ReturnType<typeof createRigidCapsuleFaceReference> }
export type CandidateCcdProfile = CcdProfile | CapsuleFaceCcdProfile;
export function admitCandidateCcd(bodies:Body[],scene:CapsuleFaceScene,dt:number): CandidateCcdProfile {
  const reference=faceContext('constructor',()=>createRigidCapsuleFaceReference(scene.snapshot));
  try {
    faceContext('constructor',()=>reference.sweep({revision:scene.snapshot.revision,centerM:[...bodies[scene.capsuleIndex].positionM],velocityMps:[...bodies[scene.capsuleIndex].velocityMps],stepSeconds:dt}));
  } catch(caught) { reference.dispose();throw caught; }
  return {kind:'capsule-face',...scene,reference};
}
export interface CapsuleFaceAdvance { faceHit:Hit|null; worldHit:PhysicsCcdHit|null; response:Result }
export function advanceCandidateCapsuleFace(accepted:Body[],working:Body[],profile:CapsuleFaceCcdProfile,dt:number): CapsuleFaceAdvance {
  assertCurrentProfile(accepted,profile);
  assertCurrentProfile(working,profile);
  const start=accepted[profile.capsuleIndex],staged=working[profile.capsuleIndex];
  const movement={revision:profile.snapshot.revision,centerM:[...start.positionM] as Vec3,velocityMps:[...staged.velocityMps] as Vec3,stepSeconds:dt};
  return faceContext('step',()=>{
    const faceHit=profile.reference.sweep(movement);
    const response=advanceHeadOnFaceStep({snapshot:profile.snapshot,...movement},faceHit,dt);
    const worldHit:PhysicsCcdHit|null=faceHit===null?null:{bodyId:start.id,fixtureId:faceHit.bodyId,toiFraction:faceHit.toiFraction,normalFixtureToBody:[...faceHit.normalFixtureToCapsule]};
    staged.positionM=[...response.centerM];staged.velocityMps=[...response.velocityMps];
    return {faceHit,worldHit,response};
  });
}
