/** #1572: fresh native contact+manifold every step; private diagnostic only.
 * Run: npx tsx examples/physics-contact-impulse-audit-1572/fresh-contact.ts
 */
import type {Body,Vec3} from '../../packages/barocss-physics/src/types.js';
import {detect} from '../../packages/barocss-physics/src/collision.js';
import {boxFaceManifold} from '../../packages/barocss-physics/src/contact-manifold.js';
import {solvePersistentPoint,type PointImpulse} from '../../packages/barocss-physics/src/persistent-box-contact.js';
import {advanceOrientation} from '../../packages/barocss-physics/src/math.js';
const v=(x=0,y=0,z=0):Vec3=>[x,y,z];
function body(id:string,dynamic:boolean,y:number):Body{
 return {id,kind:dynamic?'dynamic':'static',shape:{kind:'box',halfExtentsM:v(.5,.5,.5)},
 positionM:v(0,y,0),velocityMps:v(),orientation:[0,0,0,1],angularVelocityRadps:v(),
 inverseMass:dynamic?1:0,inverseInertiaLocal:dynamic?v(6,6,6):v(),
 restitution:0,frictionStatic:.8,frictionDynamic:.5,sensor:false};
}
const floor=body('floor',false,-.5),box=body('box',true,.5);
const dt=1/120,steps=120,sweeps=8;
let framesWithContact=0,maxPenetrationM=0,maxHeightErrorM=0,maxTiltRad=0;
let maxPoints=0;
for(let step=0;step<steps;step++){
 box.velocityMps[1]-=9.81*dt;
 // Probe contacts at the predicted configuration; no penetration correction.
 box.positionM=box.positionM.map((x,i)=>x+box.velocityMps[i]*dt) as Vec3;
 box.orientation=advanceOrientation(box.orientation,box.angularVelocityRadps,dt);
 const hit=detect(floor,box);
 if(hit){
   framesWithContact++;
   maxPenetrationM=Math.max(maxPenetrationM,hit.penetration);
   const manifold=boxFaceManifold(floor,box,hit);
   const points=(manifold?.length?manifold.map(x=>x.pointM):[hit.pointM]);
   maxPoints=Math.max(maxPoints,points.length);
   const caches:PointImpulse[]=points.map(()=>({normalNs:0,tangentNs:v()}));
   for(let iteration=0;iteration<sweeps;iteration++)
     for(let i=0;i<points.length;i++)
       solvePersistentPoint(floor,box,points[i],hit.normal,caches[i]);
 }
 maxHeightErrorM=Math.max(maxHeightErrorM,Math.abs(box.positionM[1]-.5));
 maxTiltRad=Math.max(maxTiltRad,2*Math.acos(Math.min(1,Math.abs(box.orientation[3]))));
 if(![...box.positionM,...box.velocityMps,...box.angularVelocityRadps,...box.orientation].every(Number.isFinite))
  throw Error('NONFINITE_FRESH_CONTACT step='+step);
}
console.log(JSON.stringify({profile:'fresh-contact-private-v1',steps,dt,sweeps,
 framesWithContact,maxPoints,maxPenetrationM,maxHeightErrorM,maxTiltRad,
 actualWorldQualified:false,positionCorrection:false,cacheAcrossSteps:false,
 physicalGO:false},null,2));
