/** #1572 test-only full-step energy phase ledger.
 * Actual Physics World states at pre-step, post-free-gravity-integrator,
 * and fully accepted post-contact state. The middle observation is injected
 * ONLY into an esbuild temporary copy of World, never a production API.
 * Independent uniform cube energy math; not an 8-box qualification.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';
type V=[number,number,number]; type Mode='OFFSET'|'YAW';
type BodyView={id:string,positionM:V,velocityMps:V,angularVelocityRadps:V};
type FreeEvent={step:number,bodies:BodyView[]};
type Totals={kineticJ:number,potentialJ:number,totalJ:number};
type Bucket={frames:number,integratorDeltaJ:number,postIntegratorDeltaJ:number,
 netDeltaJ:number,positivePostFrames:number,negativePostFrames:number,
 largestPostRiseJ:number,largestPostDropJ:number,maxIntegratorResidualJ:number};
const dt=1/120,steps=1200,g=9.81,m=1,side=.5;
const I=m*(side*side+side*side)/12;
const dot=(v:V)=>v[0]**2+v[1]**2+v[2]**2;
function energy(bodies:BodyView[]):Totals{
 let kineticJ=0,potentialJ=0;
 if(bodies.length!==3)throw Error('PHASE_ENERGY_BODY_COUNT');
 for(const b of bodies){
  if(![...b.positionM,...b.velocityMps,...b.angularVelocityRadps].every(Number.isFinite))
    throw Error('PHASE_ENERGY_BODY_NONFINITE:'+b.id);
  kineticJ+=.5*m*dot(b.velocityMps)+.5*I*dot(b.angularVelocityRadps);
  potentialJ+=m*g*b.positionM[1];
 }
 return {kineticJ,potentialJ,totalJ:kineticJ+potentialJ};
}
const dynamic=(bodies:readonly any[]):BodyView[]=>
 bodies.filter(b=>b.id==='b0'||b.id==='b1'||b.id==='b2')
  .map(b=>({id:b.id,positionM:[...b.positionM] as V,velocityMps:[...b.velocityMps] as V,
    angularVelocityRadps:[...b.angularVelocityRadps] as V})).sort((a,b)=>a.id.localeCompare(b.id));
const fresh=():Bucket=>({frames:0,integratorDeltaJ:0,postIntegratorDeltaJ:0,
 netDeltaJ:0,positivePostFrames:0,negativePostFrames:0,largestPostRiseJ:0,
 largestPostDropJ:0,maxIntegratorResidualJ:0});
function accumulate(s:Bucket,free:number,post:number,net:number,residual:number){
 s.frames++;s.integratorDeltaJ+=free;s.postIntegratorDeltaJ+=post;s.netDeltaJ+=net;
 if(post>1e-12)s.positivePostFrames++;
 if(post< -1e-12)s.negativePostFrames++;
 s.largestPostRiseJ=Math.max(s.largestPostRiseJ,post);
 s.largestPostDropJ=Math.min(s.largestPostDropJ,post);
 s.maxIntegratorResidualJ=Math.max(s.maxIntegratorResidualJ,Math.abs(residual));
}
const floor:PhysicsBodyConfig={id:'floor',kind:'static',
 shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],
 restitution:0,friction:{static:1,dynamic:.7}};
function cube(i:number,mode:Mode):PhysicsBodyConfig{
 const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;
 return {id:'b'+i,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},
 positionM:[(i%2)*.05,.25+i*.5,0],velocityMps:[0,0,0],massKg:m,
 orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],
 restitution:0,friction:{static:1,dynamic:.7}};
}
if(Math.abs(I-1/24)>1e-15)throw Error('PHASE_ENERGY_INERTIA_CONTROL');
const expectedFreeDeltaJ=-.5*3*m*g*g*dt*dt;
const probe=globalThis as typeof globalThis & {__physics1572FreeEnergyProbe?:(e:FreeEvent)=>void};
for(const mode of ['OFFSET','YAW'] as const){
 const freeStates=new Map<number,BodyView[]>();
 probe.__physics1572FreeEnergyProbe=e=>{
  if(freeStates.has(e.step))throw Error('PHASE_ENERGY_DUPLICATE:'+e.step);
  freeStates.set(e.step,e.bodies);
 };
 const world=createPhysicsWorld({fixedStepSeconds:dt,gravityMps2:[0,-g,0],
  contactMode:'persistent-box-v1',bodies:[floor,cube(0,mode),cube(1,mode),cube(2,mode)]});
 const total=fresh(),driftWindow=fresh(),checkpoints:unknown[]=[];
 let accepted=0,firstFailure:string|null=null;
 const start=energy(dynamic(world.getState().bodies));
 let previous=start,last=start;
 try{
  for(let step=1;step<=steps;step++){
   try{
    const state=world.step(dt);
    if(state.stepIndex!==step)throw Error('PHASE_ENERGY_STEP_CURSOR:'+step);
    const freeBodies=freeStates.get(step);
    if(!freeBodies)throw Error('PHASE_ENERGY_MISSING_PRECONTACT:'+step);
    const free=energy(freeBodies),now=energy(dynamic(state.bodies));
    const integrated=free.totalJ-previous.totalJ;
    const post=now.totalJ-free.totalJ;
    const net=now.totalJ-previous.totalJ;
    const residual=integrated-expectedFreeDeltaJ;
    if(![integrated,post,net,residual].every(Number.isFinite)
      ||Math.abs(residual)>1e-9
      ||Math.abs(integrated+post-net)>1e-10)
      throw Error('PHASE_ENERGY_REFERENCE_NO_GO:'+step);
    accumulate(total,integrated,post,net,residual);
    if(step>=680&&step<=720)accumulate(driftWindow,integrated,post,net,residual);
    if(step===1||step%120===0||(step>=680&&step<=720&&step%4===0))
      checkpoints.push({step,freeDeltaJ:integrated,postContactDeltaJ:post,
        netDeltaJ:net,driftFromInitialJ:now.totalJ-start.totalJ,
        freeKineticJ:free.kineticJ,freePotentialJ:free.potentialJ,
        acceptedKineticJ:now.kineticJ,acceptedPotentialJ:now.potentialJ,
        x:state.bodies.filter(b=>b.kind==='dynamic').map(b=>({id:b.id,x:b.positionM[0]}))});
    freeStates.delete(step);previous=now;last=now;accepted=step;
   }catch(e){firstFailure=e instanceof Error?e.message:String(e);break;}
  }
 }finally{world.dispose();delete probe.__physics1572FreeEnergyProbe;}
 const closureErrorJ=Math.abs(start.totalJ+total.integratorDeltaJ+total.postIntegratorDeltaJ-last.totalJ);
 if(closureErrorJ>1e-9)throw Error('PHASE_ENERGY_LEDGER_CLOSURE:'+closureErrorJ);
 console.log(JSON.stringify({mode,accepted,firstFailure,start,last,total,driftWindow,
  expectedFreeDeltaPerStepJ:expectedFreeDeltaJ,
  observedFullStepEnergyChangeJ:last.totalJ-start.totalJ,closureErrorJ,checkpoints,
  boundary:'FREE means World directly after velocity/position gravity integration; POST means subsequent collision, impulse, correction, and other processing combined',
  limitations:'cannot assign post-integrator energy change to a single contact law; gravity correction and position projection can transfer potential energy',
  sourceWorldModified:false,physicalEightBoxGO:false}));
 if(firstFailure)process.exitCode=1;
}
