/** #1572 source-selected face and incident face identity audit, immutable World. */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';
type E={step:number,pass:number,referenceBody:string,referenceAxis:number,referenceSide:number,incidentBody:string,incidentAxis:number,incidentSide:number,normalAlignment:number,incidentAlignment:number,acceptedCount:number};
const host=globalThis as typeof globalThis & {__p1572FaceContext?:{step:number,pass:number};__p1572FaceProbe?:(e:E)=>void};
const floor:PhysicsBodyConfig={id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],restitution:0,friction:{static:1,dynamic:.7}};
const cube=(i:number,mode:'OFFSET'|'YAW'):PhysicsBodyConfig=>{const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;return {id:'b'+i,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},positionM:[(i%2)*.05,.25+i*.5,0],velocityMps:[0,0,0],massKg:1,orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],restitution:0,friction:{static:1,dynamic:.7}}};
for(const mode of ['OFFSET','YAW'] as const){
 const stats={samples:0,referenceA:0,referenceB:0,referenceSwitches:0,manifoldEmpty:0,minIncidentAlignment:1};
 const checkpoints:E[]=[];let previous:string|null=null;
 host.__p1572FaceProbe=e=>{
  if(!Number.isFinite(e.normalAlignment)||!Number.isFinite(e.incidentAlignment))throw Error('FACE_NONFINITE');
  if(e.referenceAxis<0||e.referenceAxis>2||e.incidentAxis<0||e.incidentAxis>2)throw Error('FACE_AXIS_INVALID');
  if(e.normalAlignment<1-1e-6-1e-12||Math.abs(e.incidentAlignment)<0.9)throw Error('FACE_ALIGNMENT_INVALID');
  stats.samples++;if(e.referenceBody==='b0')stats.referenceA++;else if(e.referenceBody==='b1')stats.referenceB++;else throw Error('FACE_UNEXPECTED_REFERENCE');
  const identity=e.referenceBody+':'+e.referenceAxis+':'+e.referenceSide;
  if(previous!==null&&previous!==identity)stats.referenceSwitches++;
  previous=identity;
  if(e.acceptedCount===0)stats.manifoldEmpty++;
  stats.minIncidentAlignment=Math.min(stats.minIncidentAlignment,Math.abs(e.incidentAlignment));
  if((e.step===1||e.step===600||e.step===1200)&&checkpoints.length<48)checkpoints.push(e);
 };
 const world=createPhysicsWorld({fixedStepSeconds:1/120,gravityMps2:[0,-9.81,0],contactMode:'persistent-box-v1',bodies:[floor,cube(0,mode),cube(1,mode),cube(2,mode)]});
 let accepted=0,firstFailure:string|null=null;
 try{for(let step=1;step<=1200;step++){try{world.step(1/120);accepted=step;}catch(e){firstFailure=String(e);break;}}}
 finally{world.dispose();delete host.__p1572FaceContext;delete host.__p1572FaceProbe;}
 console.log(JSON.stringify({mode,accepted,firstFailure,stats,checkpoints,productionPhysicsModified:false,eightBoxGO:false,
 interpretation:'source choice frequencies; does not independently validate physically correct incident/reference support face'}));
 if(firstFailure||stats.samples!==9600)process.exitCode=1;
}
