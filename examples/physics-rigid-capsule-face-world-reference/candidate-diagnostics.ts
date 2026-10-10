import type { Body, PhysicsState, Vec3 } from '../../packages/barocss-physics/src/types.js';
import { error } from '../../packages/barocss-physics/src/validation.js';
import { faceCoordinates } from '../physics-rigid-capsule-ccd-reference/face-sweep.js';
import type { CapsuleFaceAdvance } from './candidate-ccd.js';
import { WORLD_ERRORS, type CapsuleFaceScene } from './candidate-profile.js';
export interface CapsuleFaceDiagnosticHit { dynamicBodyId:string; fixtureId:string; fraction:number; normal:Vec3; pointM:Vec3; segmentPointM:Vec3 }
export interface CapsuleFaceStepDiagnostics {
  acceptedStepIndex:number; stepSeconds:number; startCenterM:Vec3; startVelocityMps:Vec3;
  hit:CapsuleFaceDiagnosticHit|null; hitTimeSeconds:number; remainingTimeSeconds:number;
  faceFinalCenterM:Vec3; faceFinalVelocityMps:Vec3; acceptedCenterM:Vec3; acceptedVelocityMps:Vec3;
}
export interface CapsuleFaceAttempt { workingState:PhysicsState; diagnostics:CapsuleFaceStepDiagnostics }
export function copyDiagnostics(d:CapsuleFaceStepDiagnostics|null): CapsuleFaceStepDiagnostics|null {
  if(d===null)return null;
  return {...d,startCenterM:[...d.startCenterM],startVelocityMps:[...d.startVelocityMps],hit:d.hit===null?null:{...d.hit,normal:[...d.hit.normal],pointM:[...d.hit.pointM],segmentPointM:[...d.hit.segmentPointM]},faceFinalCenterM:[...d.faceFinalCenterM],faceFinalVelocityMps:[...d.faceFinalVelocityMps],acceptedCenterM:[...d.acceptedCenterM],acceptedVelocityMps:[...d.acceptedVelocityMps]};
}
export function makeDiagnostics(acceptedStepIndex:number,dt:number,start:Body,final:Body,advance:CapsuleFaceAdvance): CapsuleFaceStepDiagnostics {
  const hit=advance.faceHit;
  return {acceptedStepIndex,stepSeconds:dt,startCenterM:[...start.positionM],startVelocityMps:[...start.velocityMps],
    hit:hit===null?null:{dynamicBodyId:start.id,fixtureId:hit.bodyId,fraction:hit.toiFraction,normal:[...hit.normalFixtureToCapsule],pointM:[...hit.pointM],segmentPointM:[...hit.segmentPointM]},
    hitTimeSeconds:advance.response.hitTimeSeconds,remainingTimeSeconds:advance.response.remainingTimeSeconds,
    faceFinalCenterM:[...advance.response.centerM],faceFinalVelocityMps:[...advance.response.velocityMps],acceptedCenterM:[...final.positionM],acceptedVelocityMps:[...final.velocityMps]};
}
function invalid(): never { return error('NUMERIC_LIMIT',WORLD_ERRORS.result); }
const denseFinite=(v:unknown,n:number):v is number[]=>Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&v.length===n&&Reflect.ownKeys(v).length===n+1&&Array.from(v).every(Number.isFinite);
function exactRecord(v:unknown,keys:string[]): v is Record<string,unknown> {return v!==null&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d!==undefined&&'value'in d;});}
export function validateStepDiagnostics(d:CapsuleFaceStepDiagnostics,bodyId:string,fixtureId:string): void {
  if(!exactRecord(d,['acceptedStepIndex','stepSeconds','startCenterM','startVelocityMps','hit','hitTimeSeconds','remainingTimeSeconds','faceFinalCenterM','faceFinalVelocityMps','acceptedCenterM','acceptedVelocityMps']))invalid();
  if(!Number.isInteger(d.acceptedStepIndex)||d.acceptedStepIndex<1||(d.stepSeconds!==1/120&&d.stepSeconds!==1/240)||!Number.isFinite(d.hitTimeSeconds)||!Number.isFinite(d.remainingTimeSeconds)||d.hitTimeSeconds<0||d.remainingTimeSeconds<0||d.hitTimeSeconds>d.stepSeconds||d.remainingTimeSeconds>d.stepSeconds||Math.abs(d.hitTimeSeconds+d.remainingTimeSeconds-d.stepSeconds)>1e-12)invalid();
  for(const values of [d.startCenterM,d.startVelocityMps,d.faceFinalCenterM,d.faceFinalVelocityMps,d.acceptedCenterM,d.acceptedVelocityMps])if(!denseFinite(values,3))invalid();
  if(d.hit===null) {if(d.hitTimeSeconds!==0||d.remainingTimeSeconds!==d.stepSeconds)invalid();return;}
  const h=d.hit;
  if(!exactRecord(h,['dynamicBodyId','fixtureId','fraction','normal','pointM','segmentPointM'])||h.dynamicBodyId!==bodyId||h.fixtureId!==fixtureId||!Number.isFinite(h.fraction)||h.fraction<0||h.fraction>1||!denseFinite(h.normal,3)||!denseFinite(h.pointM,3)||!denseFinite(h.segmentPointM,3)||Math.abs(Math.hypot(...h.normal)-1)>1e-12||Math.abs(h.fraction*d.stepSeconds-d.hitTimeSeconds)>1e-12)invalid();
}
function sameData(a:unknown,b:unknown): boolean {
  if(typeof a!=='object'||a===null||typeof b!=='object'||b===null)return Object.is(a,b);
  const ka=Reflect.ownKeys(a),kb=Reflect.ownKeys(b);
  if(ka.length!==kb.length||ka.some(k=>!kb.includes(k)))return false;
  return ka.every(k=>sameData((a as Record<PropertyKey,unknown>)[k],(b as Record<PropertyKey,unknown>)[k]));
}
/** Preserve the actual attempted original solver result; never repair pose or spin. */
export function validateFinalFacePose(accepted:Body[],working:Body[],scene:CapsuleFaceScene,diagnostic:CapsuleFaceStepDiagnostics): void {
  const start=accepted[scene.capsuleIndex],final=working[scene.capsuleIndex];
  if(final.angularVelocityRadps.some(x=>x!==0)||!sameData(final.orientation,start.orientation)||!sameData(working[scene.fixtureIndex],accepted[scene.fixtureIndex]))invalid();
  const face=faceCoordinates(scene.snapshot,final.positionM);
  if(!Number.isFinite(face.gapM)||face.gapM< -1e-12)invalid();
  if(diagnostic.hit!==null) {
    const closing=-(face.normal[0]*final.velocityMps[0]+face.normal[1]*final.velocityMps[1]+face.normal[2]*final.velocityMps[2]);
    if(!Number.isFinite(closing)||closing>1e-12)invalid();
  }
}
