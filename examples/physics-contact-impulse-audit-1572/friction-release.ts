/** Regression for #1572: friction cache must be released if normal support vanishes.
 * Expected to FAIL against the current persistent-box-contact.ts until fixed.
 * From root: npx tsx examples/physics-contact-impulse-audit-1572/friction-release.ts
 */
import type { Body, Vec3 } from '../../packages/barocss-physics/src/types.js';
import { solvePersistentPoint, type PointImpulse } from '../../packages/barocss-physics/src/persistent-box-contact.js';
const vec=(x=0,y=0,z=0):Vec3=>[x,y,z];
function make(id:string, dynamic:boolean,vy:number):Body {
  return {id,kind:dynamic?'dynamic':'static',shape:{kind:'box',halfExtentsM:vec(.5,.5,.5)},
    positionM:vec(0,dynamic?.5:-.5,0),velocityMps:vec(0,vy,0),
    orientation:[0,0,0,1],angularVelocityRadps:vec(),
    inverseMass:dynamic?1:0,inverseInertiaLocal:dynamic?vec(6,6,6):vec(),
    restitution:0,frictionStatic:.8,frictionDynamic:.5,sensor:false};
}
const floor=make('floor',false,0),box=make('box',true,1);
const cache:PointImpulse={normalNs:1,tangentNs:vec(.25,0,0)};
solvePersistentPoint(floor,box,vec(0,0,0),vec(0,1,0),cache);
if(Math.abs(cache.normalNs)>1e-12)throw Error('expected separating contact to lose normal support');
const tangentMagnitude=Math.hypot(...cache.tangentNs);
const bound=.8*cache.normalNs;
if(tangentMagnitude>bound+1e-12)throw Error(
  'FRICTION_CACHE_RELEASE_FAILURE: tangent impulse '+tangentMagnitude+
  ' Ns remains while normal support is '+cache.normalNs+' Ns');
console.log('PASS friction cache release');
