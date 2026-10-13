/** #1572: gravity-load, fixed-pose velocity-only slice. NOT a PhysicsWorld/stack stability test. */
import type { Body, Vec3 } from '../../packages/barocss-physics/src/types.js';
import { solvePersistentPoint, type PointImpulse } from '../../packages/barocss-physics/src/persistent-box-contact.js';

const v=(x=0,y=0,z=0):Vec3=>[x,y,z];
function make(id:string,inverseMass:number,y:number):Body {
  return {id, kind: inverseMass?'dynamic':'static', shape:{kind:'box',halfExtentsM:v(.5,.5,.5)},
    positionM:v(0,y,0),velocityMps:v(),orientation:[0,0,0,1],angularVelocityRadps:v(),
    inverseMass,inverseInertiaLocal:inverseMass?v(6,6,6):v(),
    restitution:0,frictionStatic:.8,frictionDynamic:.5,sensor:false};
}
function assert(condition:boolean,message:string):void {if(!condition)throw Error('GRAVITY_CONTACT_FAILURE: '+message);}
const dt=1/120, gravity=-9.81, steps=120, sweeps=48, tolerance=1e-10;
const floor=make('floor',0,-.5),lower=make('lower',1,.5),upper=make('upper',1,1.5);
const floorImpulse:PointImpulse={normalNs:0,tangentNs:v()};
const upperImpulse:PointImpulse={normalNs:0,tangentNs:v()};
const normal:Vec3=v(0,1,0);
let maxResidual=0;
for(let step=0;step<steps;step++){
  // Cached impulses are deliberately reset to zero per frame because this
  // isolated test does not execute a warm-start phase. Within each frame the
  // incremental impulses must remain accumulated through its 48 sweeps.
  floorImpulse.normalNs=0;upperImpulse.normalNs=0;
  floorImpulse.tangentNs=v();upperImpulse.tangentNs=v();
  lower.velocityMps[1]+=gravity*dt;
  upper.velocityMps[1]+=gravity*dt;
  for(let iteration=0;iteration<sweeps;iteration++){
    solvePersistentPoint(floor,lower,v(0,0,0),normal,floorImpulse);
    solvePersistentPoint(lower,upper,v(0,1,0),normal,upperImpulse);
  }
  const residual=Math.max(Math.abs(lower.velocityMps[1]),Math.abs(upper.velocityMps[1]));
  maxResidual=Math.max(maxResidual,residual);
  assert(Number.isFinite(residual),'finite velocity');
  assert(residual<tolerance,'supported velocity after bounded solve step '+step);
  assert(Math.abs(floorImpulse.normalNs-2*Math.abs(gravity)*dt)<tolerance,'floor load step '+step);
  assert(Math.abs(upperImpulse.normalNs-Math.abs(gravity)*dt)<tolerance,'upper load step '+step);
}
console.log(JSON.stringify({scope:'fixed-pose-velocity-only',fullWorldQualified:false,
  steps,dt,sweeps,maxResidual,finalFloorImpulseNs:floorImpulse.normalNs,
  finalUpperImpulseNs:upperImpulse.normalNs,status:'PASS'},null,2));
