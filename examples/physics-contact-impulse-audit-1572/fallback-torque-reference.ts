/** #1572 independent arithmetic audit of the actual fallback solve call.
 * Test-only temporary World probe; original OFFSET/YAW floor + 3 boxes.
 * Samples b0/b1 during step 600 and validates applied impulse and torque.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';
type V=[number,number,number];type Q=[number,number,number,number];
type Body={pos:V,v:V,w:V,q:Q,invMass:number,invInertia:V};
type Event={step:number,pair:string,point:V,normal:V,
 impulseNormal:number,impulseTangent:V,beforeA:Body,beforeB:Body,afterA:Body,afterB:Body};
const minus=(a:V,b:V):V=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a:V,b:V):V=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const scale=(a:V,s:number):V=>[a[0]*s,a[1]*s,a[2]*s];
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=(a:V)=>Math.hypot(...a);
function rotate(q:Q,v:V):V{
 const axis:V=[q[0],q[1],q[2]],t=scale(cross(axis,v),2);
 return add(v,add(scale(t,q[3]),cross(axis,t)));
}
function inertiaApply(b:Body,j:V,sign:number,point:V):V{
 const q=b.q,inv:Q=[-q[0],-q[1],-q[2],q[3]];
 const local=rotate(inv,cross(minus(point,b.pos),scale(j,sign)));
 return rotate(q,[local[0]*b.invInertia[0],local[1]*b.invInertia[1],local[2]*b.invInertia[2]]);
}
const dt=1/120,steps=1200;
const floor:PhysicsBodyConfig={id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],restitution:0,friction:{static:1,dynamic:.7}};
function cube(i:number,mode:'OFFSET'|'YAW'):PhysicsBodyConfig{
 const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;
 return {id:'b'+i,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},
 positionM:[(i%2)*.05,.25+.5*i,0],massKg:1,velocityMps:[0,0,0],
 orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],restitution:0,friction:{static:1,dynamic:.7}};
}
const host=globalThis as typeof globalThis&{__p1572FallbackTorqueProbe?:(event:Event)=>void};
for(const mode of ['OFFSET','YAW'] as const){
 let observations=0,maxLinearResidual=0,maxAngularResidual=0,totalJx=0,totalJy=0;
 const samples:unknown[]=[];
 host.__p1572FallbackTorqueProbe=e=>{
  if(e.step!==600||e.pair!=='b0/b1')throw Error('FALLBACK_TORQUE_OUT_OF_SCOPE');
  const j=add(scale(e.normal,e.impulseNormal),e.impulseTangent);
  const a=e.beforeA,b=e.beforeB;
  const linear=Math.max(norm(minus(minus(e.afterA.v,a.v),scale(j,-a.invMass))),
    norm(minus(minus(e.afterB.v,b.v),scale(j,b.invMass))));
  const angular=Math.max(norm(minus(minus(e.afterA.w,a.w),inertiaApply(a,j,-1,e.point))),
    norm(minus(minus(e.afterB.w,b.w),inertiaApply(b,j,1,e.point))));
  if(![...j,linear,angular].every(Number.isFinite)||linear>1e-10||angular>1e-10)
    throw Error('FALLBACK_TORQUE_REFERENCE_NO_GO');
  maxLinearResidual=Math.max(maxLinearResidual,linear);
  maxAngularResidual=Math.max(maxAngularResidual,angular);
  totalJx+=j[0];totalJy+=j[1];observations++;
  if(samples.length<8)samples.push({point:e.point,normal:e.normal,appliedJ:j,
    deltaOmegaB:minus(e.afterB.w,b.w),linearResidual:linear,angularResidual:angular});
 };
 const world=createPhysicsWorld({fixedStepSeconds:dt,gravityMps2:[0,-9.81,0],
 contactMode:'persistent-box-v1',bodies:[floor,cube(0,mode),cube(1,mode),cube(2,mode)]});
 let accepted=0,firstFailure:string|null=null;
 try{for(let step=1;step<=steps;step++){
  try{world.step(dt);accepted=step;}catch(err){firstFailure=String(err);break;}
 }}finally{world.dispose();delete host.__p1572FallbackTorqueProbe;}
 console.log(JSON.stringify({mode,accepted,firstFailure,observations,maxLinearResidual,maxAngularResidual,
 totalFallbackJxNs:totalJx,totalFallbackJyNs:totalJy,samples,productionSolverChanged:false,
 interpretation:'independent pointwise impulse arithmetic at fallback solve; not an independent collision contact or dynamic stability certificate'}));
 if(firstFailure||observations===0)process.exitCode=1;
}
