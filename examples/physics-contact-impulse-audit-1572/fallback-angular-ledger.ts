/** #1572 read-only pair-block angular impulse ledger, with fallback included.
 * The snapshots bracket existing solver processing, no physics law changes.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';
type Mode='OFFSET'|'YAW';
type V=[number,number,number];
type Event={step:number,pass:number,pair:string,fallback:boolean,pointCount:number,
 normal:V,pointM:V,beforeA:V,afterA:V,beforeB:V,afterB:V,
 beforeAV:V,afterAV:V,beforeBV:V,afterBV:V};
const dt=1/120,steps=1200;
const floor:PhysicsBodyConfig={id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],restitution:0,friction:{static:1,dynamic:.7}};
function cube(i:number,mode:Mode):PhysicsBodyConfig{
 const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;
 return {id:'b'+i,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},positionM:[(i%2)*.05,.25+.5*i,0],massKg:1,velocityMps:[0,0,0],orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],restitution:0,friction:{static:1,dynamic:.7}};
}
const host=globalThis as typeof globalThis&{__p1572AngularProbe?:(e:Event)=>void};
for(const mode of ['OFFSET','YAW'] as const){
 const records=new Map<string,{calls:number,fallback:number,manifold:number,
 sumUpperAngularX:number,sumUpperAngularY:number,sumUpperAngularZ:number,
 sumLowerAngularZ:number,sumUpperVelocityX:number,
 maxUpperAngularZChange:number,maxPairMomentumMismatch:number}>();
 host.__p1572AngularProbe=e=>{
  if(![1,600,1200].includes(e.step)||!['b0/b1','b1/b2'].includes(e.pair))throw Error('ANGULAR_EVENT_SCOPE');
  const key=e.step+':'+e.pair,r=records.get(key)??{calls:0,fallback:0,manifold:0,
   sumUpperAngularX:0,sumUpperAngularY:0,sumUpperAngularZ:0,sumLowerAngularZ:0,sumUpperVelocityX:0,
   maxUpperAngularZChange:0,maxPairMomentumMismatch:0};
  const db=e.afterB.map((v,i)=>v-e.beforeB[i]),da=e.afterA.map((v,i)=>v-e.beforeA[i]);
  const dvB=e.afterBV[0]-e.beforeBV[0],dvA=e.afterAV[0]-e.beforeAV[0];
  const mismatch=Math.abs(dvA+dvB);
  if(![...db,...da,mismatch].every(Number.isFinite)||mismatch>1e-9)throw Error('ANGULAR_NONFINITE_OR_MOMENTUM');
  r.calls++;if(e.fallback)r.fallback++;else r.manifold++;
  r.sumUpperAngularX+=db[0];r.sumUpperAngularY+=db[1];r.sumUpperAngularZ+=db[2];
  r.sumLowerAngularZ+=da[2];r.sumUpperVelocityX+=dvB;
  r.maxUpperAngularZChange=Math.max(r.maxUpperAngularZChange,Math.abs(db[2]));
  r.maxPairMomentumMismatch=Math.max(r.maxPairMomentumMismatch,mismatch);
  records.set(key,r);
 };
 const world=createPhysicsWorld({fixedStepSeconds:dt,gravityMps2:[0,-9.81,0],
 contactMode:'persistent-box-v1',bodies:[floor,cube(0,mode),cube(1,mode),cube(2,mode)]});
 let accepted=0,firstFailure:string|null=null;
 try{for(let i=1;i<=steps;i++){try{world.step(dt);accepted=i;}catch(e){firstFailure=String(e);break;}}}
 finally{world.dispose();delete host.__p1572AngularProbe;}
 console.log(JSON.stringify({mode,accepted,firstFailure,
  byStepPair:Object.fromEntries([...records].sort(([a],[b])=>a.localeCompare(b))),
  interpretation:'per pair block angular velocity change, NOT a direct geometric torque certificate; includes fallback and manifold',
  productionModified:false,eightBoxGO:false}));
 if(firstFailure||records.size!==6)process.exitCode=1;
}
