/** #1572 bounded pose/rotation probe; private reference, NOT a full PhysicsWorld.
 * run: npx tsx examples/physics-contact-impulse-audit-1572/pose-drift.ts
 */
import type { Body, Vec3 } from '../../packages/barocss-physics/src/types.js';
import { solvePersistentPoint, type PointImpulse } from '../../packages/barocss-physics/src/persistent-box-contact.js';
import { advanceOrientation } from '../../packages/barocss-physics/src/math.js';
const v=(x=0,y=0,z=0):Vec3=>[x,y,z];
function b(id:string,dynamic:boolean,y:number):Body {
 return {id,kind:dynamic?'dynamic':'static',shape:{kind:'box',halfExtentsM:v(.5,.5,.5)},
 positionM:v(0,y,0),velocityMps:v(),orientation:[0,0,0,1],angularVelocityRadps:v(),
 inverseMass:dynamic?1:0,inverseInertiaLocal:dynamic?v(6,6,6):v(),frictionStatic:.8,
 frictionDynamic:.5,restitution:0,sensor:false};
}
const floor=b('floor',false,-.5),box=b('box',true,.5);
const dt=1/120,iterations=48,steps=120;
const n:Vec3=v(0,1,0),point:Vec3=v(.25,0,0);
let peakTilt=0,peakHeightError=0,maxSpeed=0;
for(let step=0;step<steps;step++){
  box.velocityMps[1]-=9.81*dt;
  const cache:PointImpulse={normalNs:0,tangentNs:v()};
  for(let i=0;i<iterations;i++)solvePersistentPoint(floor,box,point,n,cache);
  // This intentionally holds the contact point fixed to expose the inability
  // of a single off-centre constraint to support a real body. Not collision detection.
  box.positionM=[box.positionM[0]+box.velocityMps[0]*dt,
    box.positionM[1]+box.velocityMps[1]*dt,
    box.positionM[2]+box.velocityMps[2]*dt];
  box.orientation=advanceOrientation(box.orientation,box.angularVelocityRadps,dt);
  peakHeightError=Math.max(peakHeightError,Math.abs(box.positionM[1]-.5));
  const tilt=2*Math.acos(Math.min(1,Math.abs(box.orientation[3])));
  peakTilt=Math.max(peakTilt,tilt);
  maxSpeed=Math.max(maxSpeed,Math.hypot(...box.velocityMps));
  if(!Number.isFinite(tilt)||!box.positionM.every(Number.isFinite))
    throw Error('POSE_DRIFT_NUMERIC_FAILURE step '+step);
}
console.log(JSON.stringify({kind:'single-fixed-offset-contact-unphysical-probe',
 steps,dt,iterations,peakHeightErrorM:peakHeightError,peakTiltRad:peakTilt,
 maxSpeedMps:maxSpeed,physicalQuality:'NOT_QUALIFIED',fullWorldQualified:false},null,2));
