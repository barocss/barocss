import type {Body,Joint,Vec3} from '../../packages/barocss-physics/src/types.js';
import {add,sub,scale,dot,cross,rotate,worldPoint,inverse,multiplyQuaternion} from '../../packages/barocss-physics/src/math.js';

export function measureBodies(bodies:Body[],joint:Joint,origin:Vec3){
 const masses=bodies.map(b=>1/b.inverseMass),total=masses[0]+masses[1];
 const centerOfMassM=scale(add(scale(bodies[0].positionM,masses[0]),scale(bodies[1].positionM,masses[1])),1/total);
 const linearMomentumVectorKgMps=bodies.reduce((sum,b,i)=>add(sum,scale(b.velocityMps,masses[i])),[0,0,0] as Vec3);
 const orbitalAngularMomentumVectorKgM2ps=bodies.reduce((sum,b,i)=>add(sum,scale(cross(sub(b.positionM,origin),b.velocityMps),masses[i])),[0,0,0] as Vec3);
 const spinAngularMomentumVectorKgM2ps=bodies.reduce((sum,b)=>add(sum,scale(b.angularVelocityRadps,b.inertiaKgM2!)),[0,0,0] as Vec3);
 const angularMomentumVectorKgM2ps=add(orbitalAngularMomentumVectorKgM2ps,spinAngularMomentumVectorKgM2ps);
 const energyJ=bodies.reduce((sum,b,i)=>sum+.5*masses[i]*dot(b.velocityMps,b.velocityMps)+.5*b.inertiaKgM2!*dot(b.angularVelocityRadps,b.angularVelocityRadps),0);
 const a=bodies[joint.aIndex],b=bodies[joint.bIndex],relative=multiplyQuaternion(b.orientation,inverse(a.orientation));
 const raw=2*Math.atan2(dot([relative[0],relative[1],relative[2]],joint.axisWorld!),relative[3]);
 const relativeAngleRad=raw>Math.PI?raw-2*Math.PI:raw< -Math.PI?raw+2*Math.PI:raw;
 const anchorAM=worldPoint(a,joint.anchorALocalM),anchorBM=worldPoint(b,joint.anchorBLocalM);
 const anchorVelocityAMps=add(a.velocityMps,cross(a.angularVelocityRadps,rotate(a.orientation,joint.anchorALocalM)));
 const anchorVelocityBMps=add(b.velocityMps,cross(b.angularVelocityRadps,rotate(b.orientation,joint.anchorBLocalM)));
 const axisDeviationRad=Math.max(...bodies.map(body=>{const axis=rotate(body.orientation,[0,0,1]);return Math.atan2(Math.hypot(axis[0],axis[1]),axis[2]);}));
 return {relativeAngleRad,anchorAM,anchorBM,anchorGapM:Math.hypot(...sub(anchorBM,anchorAM)),axisDeviationRad,
  quaternionNormError:Math.max(...bodies.map(body=>Math.abs(Math.hypot(...body.orientation)-1))),
  limitExcessRad:Math.max(0,joint.limitRad![0]-relativeAngleRad,relativeAngleRad-joint.limitRad![1]),
  centerOfMassM,linearMomentumVectorKgMps,orbitalAngularMomentumVectorKgM2ps,spinAngularMomentumVectorKgM2ps,angularMomentumVectorKgM2ps,energyJ,
  anchorVelocityAMps,anchorVelocityBMps,anchorRelativeVelocityMps:sub(anchorVelocityAMps,anchorVelocityBMps),relativeAngularVelocityRadps:sub(b.angularVelocityRadps,a.angularVelocityRadps)};
}
export type BodyMetrics=ReturnType<typeof measureBodies>;
