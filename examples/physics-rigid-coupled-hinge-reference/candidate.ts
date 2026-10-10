import type {Body,Joint,PhysicsState,PhysicsWorldConfig,Vec3} from '../../packages/barocss-physics/src/types.js';
import {copyBody,error} from '../../packages/barocss-physics/src/validation.js';
import {validateResult} from '../../packages/barocss-physics/src/collision.js';
import {add,sub,scale,dot,cross,rotate,worldPoint,inverseInertia,advanceOrientation,inverse,multiplyQuaternion} from '../../packages/barocss-physics/src/math.js';
import {admit} from './admission.js';
import {ERRORS} from './profile.js';
function angle(a:Body,b:Body,axis:Vec3){const q=multiplyQuaternion(b.orientation,inverse(a.orientation));const raw=2*Math.atan2(dot([q[0],q[1],q[2]],axis),q[3]);return raw>Math.PI?raw-2*Math.PI:raw< -Math.PI?raw+2*Math.PI:raw;}
function momentum(bodies:Body[],origin:Vec3){
 const masses=bodies.map(b=>1/b.inverseMass),total=masses[0]+masses[1];
 const centerOfMassM=scale(add(scale(bodies[0].positionM,masses[0]),scale(bodies[1].positionM,masses[1])),1/total);
 const linearMomentumVectorKgMps=bodies.reduce((sum,b,i)=>add(sum,scale(b.velocityMps,masses[i])),[0,0,0] as Vec3);
 const orbitalAngularMomentumVectorKgM2ps=bodies.reduce((sum,b,i)=>add(sum,scale(cross(sub(b.positionM,origin),b.velocityMps),masses[i])),[0,0,0] as Vec3);
 const spinAngularMomentumVectorKgM2ps=bodies.reduce((sum,b)=>add(sum,scale(b.angularVelocityRadps,b.inertiaKgM2!)),[0,0,0] as Vec3);
 const angularMomentumVectorKgM2ps=add(orbitalAngularMomentumVectorKgM2ps,spinAngularMomentumVectorKgM2ps);
 const energyJ=bodies.reduce((sum,b,i)=>sum+.5*masses[i]*dot(b.velocityMps,b.velocityMps)+.5*b.inertiaKgM2!*dot(b.angularVelocityRadps,b.angularVelocityRadps),0);
 return {centerOfMassM,linearMomentumVectorKgMps,orbitalAngularMomentumVectorKgM2ps,spinAngularMomentumVectorKgM2ps,angularMomentumVectorKgM2ps,energyJ};
}
function measure(bodies:Body[],joint:Joint,origin:Vec3){
 const a=bodies[joint.aIndex],b=bodies[joint.bIndex],relativeAngleRad=angle(a,b,joint.axisWorld!),anchorAM=worldPoint(a,joint.anchorALocalM),anchorBM=worldPoint(b,joint.anchorBLocalM);
 const axisDeviationRad=Math.max(...bodies.map(body=>{const axis=rotate(body.orientation,[0,0,1]);return Math.atan2(Math.hypot(axis[0],axis[1]),axis[2]);}));
 return {relativeAngleRad,anchorAM,anchorBM,anchorGapM:Math.hypot(...sub(anchorBM,anchorAM)),axisDeviationRad,quaternionNormError:Math.max(...bodies.map(b=>Math.abs(Math.hypot(...b.orientation)-1))),limitExcessRad:Math.max(0,joint.limitRad![0]-relativeAngleRad,relativeAngleRad-joint.limitRad![1]),...momentum(bodies,origin)};
}
function finiteData(value:unknown):boolean{if(typeof value==='number')return Number.isFinite(value);if(typeof value==='string'||typeof value==='boolean')return true;if(Array.isArray(value))return value.every(finiteData);if(value&&typeof value==='object')return Object.values(value).every(finiteData);return false;}
/** ONE declared pose-only law; v/omega are never assigned or compensated. */
export function projectCoupledHingeCandidate(config:PhysicsWorldConfig,state:PhysicsState,dt:number){
 const input=admit(config,state,dt),before=input.bodies.map(copyBody),bodies=input.bodies.map(copyBody),joint=input.joint;
 const origin=scale(add(input.config.bodies[0].positionM,input.config.bodies[1].positionM),.5),beforeMetric=measure(before,joint,origin);
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
 const afterMetric=measure(bodies,joint,origin),velocityBitsUnchanged=bodies.every((body,i)=>body.velocityMps.every((v,k)=>Object.is(v,before[i].velocityMps[k]))),angularVelocityBitsUnchanged=bodies.every((body,i)=>body.angularVelocityRadps.every((v,k)=>Object.is(v,before[i].angularVelocityRadps[k])));
 const poseReport={jointId:joint.id,finalAngleRad:afterMetric.relativeAngleRad,targetAngleRad};
 const diagnostics={before:beforeMetric,after:afterMetric,targetAngleRad,angleCorrectionsRad,translationCorrectionsM:bodies.map((body,i)=>sub(body.positionM,before[i].positionM)),sourceStepIndex:input.carrier.stepIndex,sourceTimeSeconds:input.carrier.timeSeconds,velocityBitsUnchanged,angularVelocityBitsUnchanged,lawEvaluations:1};
 if(!finiteData(poseReport)||!finiteData(diagnostics)||!velocityBitsUnchanged||!angularVelocityBitsUnchanged)error('NUMERIC_LIMIT',ERRORS.result);
 return {bodies:bodies.map(copyBody),poseReport:structuredClone(poseReport),diagnostics:structuredClone(diagnostics)};
}
