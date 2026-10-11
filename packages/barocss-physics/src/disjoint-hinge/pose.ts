import type { Vec3 } from '../types.js';
import { copyBody } from '../validation.js';
import { validateResult } from '../collision.js';
import { add, sub, scale, dot, rotate, inverseInertia, advanceOrientation } from '../math.js';
import { measurePose } from './measure.js';
import { fail } from './errors.js';
import type { PairInput } from './types.js';

function finiteData(value:unknown):boolean{if(typeof value==='number')return Number.isFinite(value);if(typeof value==='string'||typeof value==='boolean')return true;if(Array.isArray(value))return value.every(finiteData);if(value&&typeof value==='object')return Object.values(value).every(finiteData);return false;}

/** ONE declared pose-only law; v/omega are never assigned or compensated. */
export function projectCoupledHinge(input:PairInput){
 const before=input.bodies.map(copyBody),bodies=input.bodies.map(copyBody),joint=input.pair.joint;
 const origin=[...input.pair.originM] as Vec3,beforeMetric=measurePose(before,joint,origin);
 const targetAngleRad=Math.max(joint.limitRad![0],Math.min(joint.limitRad![1],beforeMetric.relativeAngleRad)),excess=beforeMetric.relativeAngleRad-targetAngleRad;
 const a=bodies[joint.aIndex],b=bodies[joint.bIndex],axis=joint.axisWorld!,inverseA=dot(axis,inverseInertia(a,axis)),inverseB=dot(axis,inverseInertia(b,axis)),inverseSum=inverseA+inverseB;
 const angleCorrectionsRad=[excess*inverseA/inverseSum,-excess*inverseB/inverseSum];
 a.orientation=advanceOrientation(a.orientation,scale(axis,angleCorrectionsRad[0]),1);
 b.orientation=advanceOrientation(b.orientation,scale(axis,angleCorrectionsRad[1]),1);
 // Orientations are now held; no angular anchor feedback or repeated clamp.
 const massA=1/a.inverseMass,massB=1/b.inverseMass,totalMass=massA+massB;
 const center=scale(add(scale(before[joint.aIndex].positionM,massA),scale(before[joint.bIndex].positionM,massB)),1/totalMass);
 const offset=sub(rotate(b.orientation,joint.anchorBLocalM),rotate(a.orientation,joint.anchorALocalM));
 a.positionM=add(center,scale(offset,massB/totalMass));b.positionM=sub(center,scale(offset,massA/totalMass));
 // Original output bounds/errors remain original; no correction is repaired.
 validateResult(bodies,[]);
 const afterMetric=measurePose(bodies,joint,origin),velocityBitsUnchanged=bodies.every((body,i)=>body.velocityMps.every((v,k)=>Object.is(v,before[i].velocityMps[k]))),angularVelocityBitsUnchanged=bodies.every((body,i)=>body.angularVelocityRadps.every((v,k)=>Object.is(v,before[i].angularVelocityRadps[k])));
 const poseReport={jointId:joint.id,finalAngleRad:afterMetric.relativeAngleRad,targetAngleRad};
 const diagnostics={before:beforeMetric,after:afterMetric,targetAngleRad,angleCorrectionsRad,translationCorrectionsM:bodies.map((body,i)=>sub(body.positionM,before[i].positionM)),sourceStepIndex:input.sourceStepIndex,sourceTimeSeconds:input.sourceTimeSeconds,velocityBitsUnchanged,angularVelocityBitsUnchanged,lawEvaluations:1};
 if(!finiteData(poseReport)||!finiteData(diagnostics)||!velocityBitsUnchanged||!angularVelocityBitsUnchanged)fail('result');
 return {bodies:bodies.map(copyBody),poseReport:structuredClone(poseReport),diagnostics:structuredClone(diagnostics)};
}
