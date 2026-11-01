import {makeModel,dynamicPart,staticPart} from '../physics-model-input/model.mjs';
/** #1572 independent signed-plane witness against the SAME internal
 * manifold reference face and original incident candidate vertices.
 * Read-only observations from temporary esbuild, no production source edit.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';

type V=[number,number,number];
type Event={step:number,pass:number,penetrationM:number,normal:V,
 faceCenter:V,faceNormal:V,candidatePoints:V[],sourceSeparations:number[],accepted:number};
const dot=(a:V,b:V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const minus=(a:V,b:V):V=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const floor=staticPart('floor',{kind:'box',halfExtentsM:[2,.1,2]},{positionM:[0,-.1,0]},{restitution:0,friction:{static:1,dynamic:.7}});
function cube(i:number,mode:'OFFSET'|'YAW'){
 const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;
 return dynamicPart('b'+i,{kind:'box',halfExtentsM:[.25,.25,.25]},{positionM:[(i%2)*.05,.25+i*.5,0],velocityMps:[0,0,0],orientationXYZW:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)]},1,{restitution:0,friction:{static:1,dynamic:.7}});
}
const host=globalThis as typeof globalThis & {
 __p1572PlaneCtx?:{step:number,pass:number,penetrationM:number,normal:V};
 __p1572PlaneProbe?:(e:Event)=>void;
};
for(const mode of ['OFFSET','YAW'] as const){
 const stats={samples:0,allRejected:0,maxPlaneResidualM:0,largestPositiveMinM:0};
 const checkpoints:unknown[]=[];
 host.__p1572PlaneProbe=e=>{
  if(e.candidatePoints.length!==e.sourceSeparations.length)throw Error('PLANE_LENGTH_MISMATCH');
  for(let i=0;i<e.candidatePoints.length;i++){
   const independentlySigned=dot(minus(e.candidatePoints[i],e.faceCenter),e.faceNormal);
   const residual=Math.abs(independentlySigned-e.sourceSeparations[i]);
   if(!Number.isFinite(residual)||residual>1e-10)throw Error('PLANE_REFERENCE_MISMATCH');
   stats.maxPlaneResidualM=Math.max(stats.maxPlaneResidualM,residual);
  }
  stats.samples++;
  if(e.candidatePoints.length>0&&e.accepted===0){
   stats.allRejected++;
   stats.largestPositiveMinM=Math.max(stats.largestPositiveMinM,
     Math.min(...e.sourceSeparations));
  }
  if((e.step===1||e.step===600||e.step===1200)&&checkpoints.length<36)
   checkpoints.push({step:e.step,pass:e.pass,satPenetrationM:e.penetrationM,
     faceCenter:e.faceCenter,faceNormal:e.faceNormal,normal:e.normal,
     count:e.candidatePoints.length,accepted:e.accepted,
     minSignedM:Math.min(...e.sourceSeparations),
     maxSignedM:Math.max(...e.sourceSeparations)});
 };
 const world=createPhysicsWorld(makeModel({gravityMps2:[0,-9.81,0],parts:[floor,cube(0,mode),cube(1,mode),cube(2,mode)]}),{profile:'rigid-persistent-box-v1',fixedStepSeconds:1/120,broadPhase:'direct'});
 let accepted=0,failure:null|string=null;
 try{for(let step=1;step<=1200;step++){try{world.step();accepted=step;}
 catch(err){failure=String(err);break;}}}finally{world.dispose();delete host.__p1572PlaneCtx;delete host.__p1572PlaneProbe;}
 console.log(JSON.stringify({mode,accepted,failure,stats,checkpoints,
   interpretation:'same source face points, independently recomputed signed point-plane distances; source SAT overlap is not a signed point-plane distance',
   productionModified:false,physicalEightBoxGO:false}));
 if(failure||accepted!==1200||stats.samples!==9600)process.exitCode=1;
}
