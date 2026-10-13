/** #1572: Observed contact impulse centroid vs independently computed initial
 * support reference. Temporary World instrumentation only, no production edits.
 * This is descriptive: per-pass accumulated point impulses are not per-pass loads.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';
type V=[number,number,number];
type RecordPoint={pointM:V,normalNs:number,tangentNs:V};
type Event={step:number,pass:number,pair:string,normal:V,points:RecordPoint[],fallback:boolean};
type Mode='OFFSET'|'YAW';
const dt=1/120,steps=1200;
const floor:PhysicsBodyConfig={id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],restitution:0,friction:{static:1,dynamic:.7}};
function cube(i:number,mode:Mode):PhysicsBodyConfig{
 const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;
 return {id:'b'+i,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},
 positionM:[(i%2)*.05,.25+i*.5,0],velocityMps:[0,0,0],massKg:1,
 orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],restitution:0,friction:{static:1,dynamic:.7}};
}
const host=globalThis as typeof globalThis&{__physics1572CentroidProbe?:(event:Event)=>void};
for(const mode of ['OFFSET','YAW'] as const){
 const checkpoints:unknown[]=[];let nonFinite=0,manifoldCount=0,fallbackCount=0;
 host.__physics1572CentroidProbe=e=>{
   if(![1,600,1200].includes(e.step)||e.pass!==7)return;
   if(!['b0/b1','b1/b2'].includes(e.pair))throw Error('CENTROID_PAIR_UNEXPECTED');
   if(e.fallback)fallbackCount++;else manifoldCount++;
   const sum=e.points.reduce((n,p)=>n+p.normalNs,0);
   const centroid=sum>1e-15?[
     e.points.reduce((n,p)=>n+p.pointM[0]*p.normalNs,0)/sum,
     e.points.reduce((n,p)=>n+p.pointM[2]*p.normalNs,0)/sum
   ]:null;
   const meanTangent=e.points.reduce((n,p)=>n+Math.hypot(...p.tangentNs),0);
   const values=[...e.normal,sum,meanTangent,...(centroid??[])];
   if(!values.every(Number.isFinite))nonFinite++;
   checkpoints.push({step:e.step,pair:e.pair,normal:e.normal,pointCount:e.points.length,
     fallback:e.fallback,normalImpulseNs:sum,normalWeightedCentroidXZ:centroid,
     totalTangentMagnitudeNs:meanTangent,points:e.points});
 };
 const world=createPhysicsWorld({fixedStepSeconds:dt,gravityMps2:[0,-9.81,0],
 contactMode:'persistent-box-v1',bodies:[floor,cube(0,mode),cube(1,mode),cube(2,mode)]});
 let accepted=0,firstFailure:string|null=null;
 try{for(let step=1;step<=steps;step++){
   try{world.step(dt);accepted=step;}catch(e){firstFailure=String(e);break;}
 }}finally{world.dispose();delete host.__physics1572CentroidProbe;}
 console.log(JSON.stringify({mode,accepted,firstFailure,nonFinite,manifoldCount,fallbackCount,
 checkpoints,initialStaticB0B1CentreXZ:[.025,0],initialStaticB1B2CentreXZ:[0,0],
 qualification:'observed dynamic cached normal-load centroid; reference initial COM is frozen and not a dynamic target',
 productionSolverChanged:false,physicalGO:false}));
 if(firstFailure||nonFinite||checkpoints.length!==6)process.exitCode=1;
}
