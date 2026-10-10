import { PhysicsError, type Body, type Vec3 } from '../../packages/barocss-physics/src/types.js';
import { error } from '../../packages/barocss-physics/src/validation.js';
import { PROFILE, RADIUS_M, HALF_LENGTH_M, YAW_QUATERNION } from '../physics-rigid-capsule-ccd-reference/profile.js';
import type { Snapshot } from '../physics-rigid-capsule-ccd-reference/profile.js';
export const WORLD_ERRORS = {
  profile:'private capsule face world profile is unsupported',
  commands:'private capsule face world commands are unsupported',
  step:'private capsule face world step is unsupported',
  result:'private capsule face world result is invalid',
} as const;
export const INTERNAL_REVISION = 'capsule-face-world-1298';
export interface CapsuleFaceScene { capsuleIndex:number; fixtureIndex:number; snapshot:Snapshot }
export interface CandidateObserverPayload { workingState: import('../../packages/barocss-physics/src/types.js').PhysicsState; diagnostics: import('./candidate-diagnostics.js').CapsuleFaceStepDiagnostics }
export interface CapsuleFaceWorldOptions { observeAttempt?: (attempt:CandidateObserverPayload) => void }
const dense = (v: unknown, n: number): v is number[] => Array.isArray(v) && Object.getPrototypeOf(v)===Array.prototype && v.length===n && Reflect.ownKeys(v).length===n+1 && Array.from(v).every(Number.isFinite);
const equals = (a: readonly number[],b: readonly number[]) => a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
const zero = (v: readonly number[]) => v.every(x=>x===0);
const identity = (v: readonly number[]) => equals(v,[0,0,0,1]);
export function copyObserverOptions(input: CapsuleFaceWorldOptions): CapsuleFaceWorldOptions {
  if(input===null||typeof input!=='object'||Object.getPrototypeOf(input)!==Object.prototype)error('INVALID_CONFIG',WORLD_ERRORS.profile);
  const keys=Reflect.ownKeys(input);
  if(keys.some(k=>k!=='observeAttempt'))error('INVALID_CONFIG',WORLD_ERRORS.profile);
  if(!keys.length)return {};
  const d=Object.getOwnPropertyDescriptor(input,'observeAttempt');
  if(!d||!('value'in d)||typeof d.value!=='function')error('INVALID_CONFIG',WORLD_ERRORS.profile);
  return {observeAttempt:d.value};
}
export function admitEmptyCommands(commands: unknown): asserts commands is [] {
  if(!Array.isArray(commands)||Object.getPrototypeOf(commands)!==Array.prototype||commands.length!==0||Reflect.ownKeys(commands).length!==1)error('INVALID_COMMAND',WORLD_ERRORS.commands);
}
function fixedBodies(capsule:Body,fixture:Body): boolean {
  const inertia=0.4*(RADIUS_M+HALF_LENGTH_M)**2;
  return capsule.kind==='dynamic'&&capsule.shape.kind==='capsule'&&capsule.shape.radiusM===RADIUS_M&&capsule.shape.halfLengthM===HALF_LENGTH_M&&capsule.ccd===true&&capsule.inverseMass===1&&
    dense(capsule.orientation,4)&&identity(capsule.orientation)&&dense(capsule.angularVelocityRadps,3)&&zero(capsule.angularVelocityRadps)&&
    dense(capsule.positionM,3)&&dense(capsule.velocityMps,3)&&capsule.inertiaKgM2===undefined&&dense(capsule.inertiaDiagonalKgM2,3)&&capsule.inertiaDiagonalKgM2.every(x=>x===inertia)&&dense(capsule.inverseInertiaLocal,3)&&capsule.inverseInertiaLocal.every(x=>x===1/inertia)&&
    fixture.kind==='static'&&fixture.shape.kind==='box'&&dense(fixture.positionM,3)&&equals(fixture.positionM,[0,0,0])&&dense(fixture.shape.halfExtentsM,3)&&equals(fixture.shape.halfExtentsM,[.001,1,1])&&dense(fixture.orientation,4)&&(identity(fixture.orientation)||equals(fixture.orientation,YAW_QUATERNION))&&
    dense(fixture.velocityMps,3)&&zero(fixture.velocityMps)&&dense(fixture.angularVelocityRadps,3)&&zero(fixture.angularVelocityRadps)&&fixture.inverseMass===0&&
    [capsule,fixture].every(b=>b.restitution===0&&b.frictionStatic===1&&b.frictionDynamic===.7&&!b.sensor&&!b.collisionFilter);
}
export function admitCapsuleFaceScene(input: Record<string,unknown>,bodies:Body[],jointCount:number,gravity:Vec3,dt:number): CapsuleFaceScene {
  if(!Array.isArray(bodies)||Object.getPrototypeOf(bodies)!==Array.prototype||bodies.length!==2||![0,1].every(i=>Object.hasOwn(bodies,i))||jointCount!==0||!zero(gravity)||(dt!==1/120&&dt!==1/240)||['sceneMode','broadPhase','contactMode'].some(k=>Object.hasOwn(input,k)))error('INVALID_CONFIG',WORLD_ERRORS.profile);
  const capsuleIndex=bodies.findIndex(b=>b.kind==='dynamic'),fixtureIndex=1-capsuleIndex;
  if(capsuleIndex<0||!fixedBodies(bodies[capsuleIndex],bodies[fixtureIndex]))error('INVALID_CONFIG',WORLD_ERRORS.profile);
  const capsule=bodies[capsuleIndex],box=bodies[fixtureIndex];
  if(box.shape.kind!=='box')error('INVALID_CONFIG',WORLD_ERRORS.profile);
  const snapshot:Snapshot={version:1,profile:PROFILE,selectedFace:'negative-x',revision:INTERNAL_REVISION,
    capsule:{radiusM:RADIUS_M,halfLengthM:HALF_LENGTH_M,orientationXYZW:[...capsule.orientation],angularVelocityRadps:[...capsule.angularVelocityRadps]},
    box:{id:box.id,centerM:[...box.positionM],halfExtentsM:[...box.shape.halfExtentsM],orientationXYZW:[...box.orientation],velocityMps:[...box.velocityMps],angularVelocityRadps:[...box.angularVelocityRadps]}};
  return {capsuleIndex,fixtureIndex,snapshot};
}
export function assertCurrentProfile(bodies:Body[],scene:CapsuleFaceScene): void {
  if(!fixedBodies(bodies[scene.capsuleIndex],bodies[scene.fixtureIndex]))error('NUMERIC_LIMIT',WORLD_ERRORS.step);
}
/** Map only exact known adopted errors in the applicable constructor/step phase. */
export function faceContext<T>(phase:'constructor'|'step',action:()=>T): T {
  try { return action(); }
  catch(caught) {
    if(caught instanceof PhysicsError) {
      if((caught.code==='INVALID_CONFIG'&&caught.message==='Private capsule face profile is unsupported')||(caught.code==='INVALID_QUERY'&&caught.message==='Private capsule face movement is unsupported'))error(phase==='constructor'?'INVALID_CONFIG':'NUMERIC_LIMIT',phase==='constructor'?WORLD_ERRORS.profile:WORLD_ERRORS.step);
      if(caught.code==='NUMERIC_LIMIT'&&caught.message==='Private capsule face result is invalid')error('NUMERIC_LIMIT',WORLD_ERRORS.result);
    }
    throw caught;
  }
}
