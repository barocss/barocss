/** #1572: independent box interval projection reference at SAT-chosen normal.
 * Capture actual internal b0/b1 poses without altering source physics.
 * Check SAT overlap arithmetic and classify positive face gaps separately.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';
type V=[number,number,number];type Q=[number,number,number,number];
type BodyPose={positionM:V,orientation:Q,halfExtentsM:V};
type Event={step:number,pass:number,a:BodyPose,b:BodyPose,normal:V,penetrationM:number};
const dot=(a:V,b:V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const add=(a:V,b:V):V=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const scale=(a:V,s:number):V=>[a[0]*s,a[1]*s,a[2]*s];
function rotate(q:Q,v:V):V{
 const xyz:V=[q[0],q[1],q[2]],t=scale(cross(xyz,v),2);
 return add(v,add(scale(t,q[3]),cross(xyz,t)));
}
function interval(box:BodyPose,n:V):[number,number]{
 const basis=[rotate(box.orientation,[1,0,0]),rotate(box.orientation,[0,1,0]),rotate(box.orientation,[0,0,1])] as V[];
 const centre=dot(box.positionM,n);
 const radius=basis.reduce((v,axis,i)=>v+box.halfExtentsM[i]*Math.abs(dot(axis,n)),0);
 return [centre-radius,centre+radius];
}
const floor:PhysicsBodyConfig={id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],restitution:0,friction:{static:1,dynamic:.7}};
function cube(i:number,mode:'OFFSET'|'YAW'):PhysicsBodyConfig{
 const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;
 return {id:'b'+i,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},positionM:[(i%2)*.05,.25+.5*i,0],massKg:1,velocityMps:[0,0,0],orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],restitution:0,friction:{static:1,dynamic:.7}};
}
const host=globalThis as typeof globalThis&{__p1572ProjectionProbe?:(e:Event)=>void};
for(const mode of ['OFFSET','YAW'] as const){
 let count=0,maxResidualM=0;
 const samples:unknown[]=[];
 host.__p1572ProjectionProbe=e=>{
  const iA=interval(e.a,e.normal),iB=interval(e.b,e.normal);
  const overlap=Math.min(iA[1],iB[1])-Math.max(iA[0],iB[0]);
  const residual=Math.abs(Math.max(0,overlap)-e.penetrationM);
  if(!Number.isFinite(residual)||residual>1e-9)throw Error('P1572_SAT_INTERVAL_REFERENCE_NO_GO');
  maxResidualM=Math.max(maxResidualM,residual);count++;
  if(e.step===1||e.step===600||e.step===1200){
   if(samples.length<30)samples.push({step:e.step,pass:e.pass,intervalA:iA,intervalB:iB,
     overlapM:overlap,sourcePenetrationM:e.penetrationM,normal:e.normal,independentResidualM:residual});
  }
 };
 const world=createPhysicsWorld({fixedStepSeconds:1/120,gravityMps2:[0,-9.81,0],contactMode:'persistent-box-v1',
  bodies:[floor,cube(0,mode),cube(1,mode),cube(2,mode)]});
 let accepted=0,failure:string|null=null;
 try{for(let step=1;step<=1200;step++){try{world.step(1/120);accepted=step;}
 catch(err){failure=String(err);break;}}}
 finally{world.dispose();delete host.__p1572ProjectionProbe;}
 console.log(JSON.stringify({mode,accepted,failure,count,maxResidualM,samples,
  limitation:'SAT minimum-axis interval overlap checked at actual source-selected axis; independent axis selection and manifold face witness not yet certified',
  productionPhysicsChanged:false,eightBoxGO:false}));
 if(failure||accepted!==1200||count!==9600)process.exitCode=1;
}
