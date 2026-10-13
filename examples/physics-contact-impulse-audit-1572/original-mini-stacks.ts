/**
 * #1572: first 3 dynamic cubes of the immutable #1185 ALIGNED/OFFSET/YAW
 * input families, within the current public persistent-box-v1 cap (4 bodies).
 * No solver change, no 8-box qualification, no independent SAT observer.
 */
import { createPhysicsWorld } from '../../packages/barocss-physics/src/index.js';
import type { PhysicsBodyConfig, PhysicsWorldConfig, PhysicsBodyState } from '../../packages/barocss-physics/src/types.js';

type CaseName = 'ALIGNED' | 'OFFSET' | 'YAW';
type Vec3 = [number,number,number];
const dt=1/120, steps=1200;
const floor:PhysicsBodyConfig={id:'floor',kind:'static',
  shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],
  restitution:0,friction:{static:1,dynamic:.7}};
function cube(i:number,name:CaseName):PhysicsBodyConfig{
  const x=name==='ALIGNED'?0:(i%2)*.05;
  const yaw=name==='YAW'?(i%2===0?.05:-.05):0;
  return {id:`b${i}`,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},
    positionM:[x,.25+.5*i,0],velocityMps:[0,0,0],massKg:1,
    orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],
    angularVelocityRadps:[0,0,0],restitution:0,friction:{static:1,dynamic:.7}};
}
function finiteBody(b:PhysicsBodyState):boolean{
  return [...b.positionM,...b.velocityMps,...b.orientation,...b.angularVelocityRadps].every(Number.isFinite);
}
let anyFailure=false;
for(const name of ['ALIGNED','OFFSET','YAW'] as const){
  const inputs=[0,1,2].map(i=>cube(i,name));
  const config:PhysicsWorldConfig={fixedStepSeconds:dt,gravityMps2:[0,-9.81,0],
    contactMode:'persistent-box-v1',bodies:[floor,...inputs]};
  const world=createPhysicsWorld(config);
  const at8s=new Map<string,Vec3>();
  const stats=new Map<string,{maxVerticalDriftM:number,maxHorizontalFromInitialM:number,
    maxLinearSpeedMps:number,maxAngularSpeedRadps:number,maxTiltFromUprightRad:number}>();
  let accepted=0,firstFailure:string|null=null,peakProducerContactPenetrationM=0;
  try{
    for(let i=0;i<steps;i++){
      try{
        const state=world.step(dt);
        if(state.stepIndex!==i+1||state.timeSeconds!==(i+1)*dt)throw Error('bad cursor');
        for(const b of state.bodies){
          if(!finiteBody(b))throw Error('nonfinite body '+b.id);
        }
        for(const c of state.contacts){
          if(!Number.isFinite(c.penetrationM)||c.penetrationM<0)throw Error('invalid contact depth');
          peakProducerContactPenetrationM=Math.max(peakProducerContactPenetrationM,c.penetrationM);
        }
        if(i===959)for(const b of state.bodies.filter(b=>b.kind==='dynamic'))
          at8s.set(b.id,[...b.positionM]);
        if(i>=960)for(const b of state.bodies.filter(b=>b.kind==='dynamic')){
          const start=at8s.get(b.id);
          const initial=inputs.find(x=>x.id===b.id);
          if(!start||!initial)throw Error('missing reference pose');
          const current=stats.get(b.id)??{maxVerticalDriftM:0,maxHorizontalFromInitialM:0,
            maxLinearSpeedMps:0,maxAngularSpeedRadps:0,maxTiltFromUprightRad:0};
          current.maxVerticalDriftM=Math.max(current.maxVerticalDriftM,Math.abs(b.positionM[1]-start[1]));
          current.maxHorizontalFromInitialM=Math.max(current.maxHorizontalFromInitialM,
            Math.hypot(b.positionM[0]-initial.positionM[0],b.positionM[2]-initial.positionM[2]));
          current.maxLinearSpeedMps=Math.max(current.maxLinearSpeedMps,Math.hypot(...b.velocityMps));
          current.maxAngularSpeedRadps=Math.max(current.maxAngularSpeedRadps,Math.hypot(...b.angularVelocityRadps));
          // upright deviation means the box local up axis vs world Y, not absolute yaw.
          const [qx,,qz,qw]=b.orientation;
          current.maxTiltFromUprightRad=Math.max(current.maxTiltFromUprightRad,
            Math.acos(Math.min(1,Math.max(-1,1-2*(qx*qx+qz*qz)))));
          stats.set(b.id,current);
        }
        accepted++;
      }catch(e){
        firstFailure=e instanceof Error?e.message:String(e);
        break;
      }
    }
    if(firstFailure)anyFailure=true;
    // Apply the original #1185 settling thresholds as a diagnostic comparison,
    // NOT as a public 8-box certification or independent geometry result.
    const thresholdM=0.005, horizontalLimitM=0.01, speedLimitMps=0.02;
    const angularLimitRadps=0.02, tiltLimitRad=Math.PI/180;
    const settlingViolations=[...stats].flatMap(([id,m])=>[
      ...(m.maxVerticalDriftM>thresholdM?[`${id}:verticalDrift`]:[]),
      ...(m.maxHorizontalFromInitialM>horizontalLimitM?[`${id}:horizontalDrift`]:[]),
      ...(m.maxLinearSpeedMps>speedLimitMps?[`${id}:linearSpeed`]:[]),
      ...(m.maxAngularSpeedRadps>angularLimitRadps?[`${id}:angularSpeed`]:[]),
      ...(m.maxTiltFromUprightRad>tiltLimitRad?[`${id}:uprightTilt`]:[])
    ]);
    console.log(JSON.stringify({case:name,profile:'original-fixture-three-box-public-v1',
      stepsRequested:steps,accepted,firstFailure,peakProducerContactPenetrationM,
      bodyFinalWindow:Object.fromEntries([...stats].sort(([a],[b])=>a.localeCompare(b))),
      boundedSettlingThresholdsPassed:accepted===steps&&settlingViolations.length===0,
      settlingViolations,collisionReference:'producer-only',
      eightDynamicBoxQualified:false,
      physicalResult:firstFailure||settlingViolations.length?'BOUNDED_SETTLING_NO_GO':'BOUNDED_SETTLING_THRESHOLDS_MET_ONLY'}));
  }finally{world.dispose();}
}
if(anyFailure)process.exitCode=1;
