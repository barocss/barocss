/** #1572 independent 15-axis OBB SAT reference, original OFFSET/YAW 3 cubes.
 * Captures exact b0/b1 internal collision poses via temporary World build.
 * No production source modification or acceptance changes.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';
type V=[number,number,number];type Q=[number,number,number,number];
type Pose={p:V,q:Q,e:V};
type Hit={step:number,pass:number,a:Pose,b:Pose,normal:V,penetration:number};
const dot=(a:V,b:V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a:V,b:V):V=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const scale=(a:V,s:number):V=>[a[0]*s,a[1]*s,a[2]*s];
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function rot(q:Q,v:V):V{
 const t=scale(cross([q[0],q[1],q[2]],v),2);
 return [v[0]+q[3]*t[0]+cross([q[0],q[1],q[2]],t)[0],
         v[1]+q[3]*t[1]+cross([q[0],q[1],q[2]],t)[1],
         v[2]+q[3]*t[2]+cross([q[0],q[1],q[2]],t)[2]];
}
const axes=(b:Pose):V[]=>[rot(b.q,[1,0,0]),rot(b.q,[0,1,0]),rot(b.q,[0,0,1])];
function independent(b1:Pose,b2:Pose){
 const a=axes(b1),b=axes(b2),delta=sub(b2.p,b1.p);
 const candidates=[...a,...b,...a.flatMap(x=>b.map(y=>cross(x,y)))];
 let best=Infinity,bestNormal:V=[0,0,0],considered=0;
 for(const raw of candidates){
  const len=Math.hypot(...raw);if(len<1e-12)continue;
  const n=scale(raw,1/len),signed=dot(delta,n);
  const ra=a.reduce((v,axis,i)=>v+b1.e[i]*Math.abs(dot(axis,n)),0);
  const rb=b.reduce((v,axis,i)=>v+b2.e[i]*Math.abs(dot(axis,n)),0);
  const overlap=ra+rb-Math.abs(signed);considered++;
  if(overlap<best){best=overlap;bestNormal=scale(n,signed<0?-1:1);}
 }
 return {best,normal:bestNormal,considered};
}
const floor:PhysicsBodyConfig={id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],restitution:0,friction:{static:1,dynamic:.7}};
function cube(i:number,mode:'OFFSET'|'YAW'):PhysicsBodyConfig{
 const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;
 return {id:'b'+i,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},positionM:[(i%2)*.05,.25+.5*i,0],massKg:1,velocityMps:[0,0,0],orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],restitution:0,friction:{static:1,dynamic:.7}};
}
const host=globalThis as typeof globalThis&{__p1572AxisProbe?:(e:Hit)=>void};
for(const mode of ['OFFSET','YAW'] as const){
 let count=0,maxPenetrationResidual=0,maxNormalMismatch=0;
 const samples:unknown[]=[];
 host.__p1572AxisProbe=e=>{
  const expected=independent(e.a,e.b);
  const d=Math.abs(Math.max(0,expected.best)-e.penetration);
  const normMismatch=Math.hypot(...sub(expected.normal,e.normal));
  if(d>1e-9||normMismatch>1e-8||!Number.isFinite(d))throw Error('P1572_SAT_AXIS_REFERENCE_NO_GO');
  maxPenetrationResidual=Math.max(maxPenetrationResidual,d);
  maxNormalMismatch=Math.max(maxNormalMismatch,normMismatch);
  count++;
  if((e.step===1||e.step===600||e.step===1200)&&samples.length<28)
   samples.push({step:e.step,pass:e.pass,bestOverlapM:expected.best,
    producerPenetrationM:e.penetration,axisCount:expected.considered,
    normalResidual:normMismatch});
 };
 const world=createPhysicsWorld({fixedStepSeconds:1/120,gravityMps2:[0,-9.81,0],
  contactMode:'persistent-box-v1',bodies:[floor,cube(0,mode),cube(1,mode),cube(2,mode)]});
 let accepted=0,failure:null|string=null;
 try{for(let step=1;step<=1200;step++){try{world.step(1/120);accepted=step;}catch(err){failure=String(err);break;}}}
 finally{world.dispose();delete host.__p1572AxisProbe;}
 console.log(JSON.stringify({mode,accepted,failure,count,maxPenetrationResidual,maxNormalMismatch,samples,
  caveat:'independent 15-axis arithmetic on source body poses, not independent polygon manifold validation',
  productionModified:false,eightBoxGO:false}));
 if(failure||count!==9600||accepted!==1200)process.exitCode=1;
}
