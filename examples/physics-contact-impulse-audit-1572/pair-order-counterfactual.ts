/**
 * #1572 counterfactual: identical public three-cube OFFSET/YAW fixtures,
 * identical Physics solver and material laws; vary ONLY processing order of
 * eligible body pairs across each solver pass in a TEMPORARY esbuild graph.
 * Never claim an eight-box or public API acceptance from three-box evidence.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';
type Scene='OFFSET'|'YAW';
type Order='baseline'|'reverse'|'alternate'|'supportUp'|'supportDown';
const dt=1/120, steps=1200;
const globals=globalThis as typeof globalThis & {
  __p1572PairOrder?:Order;
  __p1572PairVisit?: (event:{step:number,pass:number,pair:string})=>void;
};
const floor:PhysicsBodyConfig={
  id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.1,2]},
  positionM:[0,-.1,0],restitution:0,friction:{static:1,dynamic:.7}
};
function cube(i:number,scene:Scene):PhysicsBodyConfig{
  const yaw=scene==='YAW'?(i%2===0?.05:-.05):0;
  return {id:'b'+i,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},
    positionM:[(i%2)*.05,.25+.5*i,0],velocityMps:[0,0,0],massKg:1,
    orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],
    restitution:0,friction:{static:1,dynamic:.7}};
}
function run(scene:Scene,order:Order){
  globals.__p1572PairOrder=order;
  const inputs=[cube(0,scene),cube(1,scene),cube(2,scene)];
  const worldConfig:PhysicsWorldConfig={
    fixedStepSeconds:dt,gravityMps2:[0,-9.81,0],
    contactMode:'persistent-box-v1',bodies:[floor,...inputs]
  };
  const seen=new Map<number,string[]>();
  globals.__p1572PairVisit=event=>{
    if(event.step!==1||event.pass>1)return;
    const value=seen.get(event.pass)??[];
    value.push(event.pair);seen.set(event.pass,value);
  };
  const world=createPhysicsWorld(worldConfig);
  let accepted=0,firstFailure:string|null=null;
  let maxHorizontalFromInitialM=0,maxLinearSpeedMps=0,maxAngularSpeedRadps=0;
  let maxReportedPenetrationM=0,maxVerticalDriftM=0;
  const referenceY=new Map<string,number>();
  const finalX:Record<string,number>={};
  const checkpoints:unknown[]=[];
  try{
    for(let step=1;step<=steps;step++){
      try{
        const state=world.step(dt);
        if(state.stepIndex!==step)throw Error('PAIR_ORDER_BAD_STEP_CURSOR');
        for(const contact of state.contacts){
          if(!Number.isFinite(contact.penetrationM))throw Error('PAIR_ORDER_NONFINITE_CONTACT');
          maxReportedPenetrationM=Math.max(maxReportedPenetrationM,contact.penetrationM);
        }
        const dynamic=state.bodies.filter(b=>b.kind==='dynamic');
        for(const body of dynamic){
          if(![...body.positionM,...body.velocityMps,...body.angularVelocityRadps,
            ...body.orientation].every(Number.isFinite))throw Error('PAIR_ORDER_NONFINITE_BODY');
          finalX[body.id]=body.positionM[0];
          if(step===960)referenceY.set(body.id,body.positionM[1]);
          if(step>960){
            const initial=inputs.find(item=>item.id===body.id)!;
            maxHorizontalFromInitialM=Math.max(maxHorizontalFromInitialM,
              Math.hypot(body.positionM[0]-initial.positionM[0],
                body.positionM[2]-initial.positionM[2]));
            maxLinearSpeedMps=Math.max(maxLinearSpeedMps,Math.hypot(...body.velocityMps));
            maxAngularSpeedRadps=Math.max(maxAngularSpeedRadps,
              Math.hypot(...body.angularVelocityRadps));
            maxVerticalDriftM=Math.max(maxVerticalDriftM,
              Math.abs(body.positionM[1]-referenceY.get(body.id)!));
          }
        }
        if(step===1||step%120===0)checkpoints.push({
          step,x:dynamic.map(b=>[b.id,b.positionM[0]]),
          horizontalVelocity:dynamic.map(b=>[b.id,b.velocityMps[0]])});
        accepted=step;
      }catch(error){
        firstFailure=error instanceof Error?error.message:String(error);
        break;
      }
    }
  }finally{
    world.dispose();
    delete globals.__p1572PairVisit;
  }
  const pass0=seen.get(0)??[],pass1=seen.get(1)??[];
  if(accepted>0 && (!pass0.length||!pass1.length))
    throw Error('PAIR_ORDER_PROBE_NOT_ACTIVE');
  const boundedSettlingThresholdsMet=
    accepted===steps&&maxHorizontalFromInitialM<=.01&&
    maxLinearSpeedMps<=.02&&maxAngularSpeedRadps<=.02&&
    maxVerticalDriftM<=.005&&maxReportedPenetrationM<=.002;
  return {scene,order,accepted,firstFailure,
    pass0CandidateOrder:pass0,pass1CandidateOrder:pass1,
    maxHorizontalFromInitialM,maxLinearSpeedMps,maxAngularSpeedRadps,
    maxVerticalDriftM,maxReportedPenetrationM,boundedSettlingThresholdsMet,
    finalX,checkpoints,
    independentCollisionQualityGO:false,fullEightBoxGO:false};
}
try{
  for(const scene of ['OFFSET','YAW'] as const){
    const baseline=run(scene,'baseline');
    const reversed=run(scene,'reverse');
    const alternate=run(scene,'alternate');
    const supportUp=run(scene,'supportUp');
    const supportDown=run(scene,'supportDown');
    if(baseline.pass0CandidateOrder.join('|')===
       reversed.pass0CandidateOrder.join('|'))
      throw Error('PAIR_ORDER_CONTROL_NOT_DISTINCT');
    if(baseline.pass0CandidateOrder.join('|')!==
       alternate.pass0CandidateOrder.join('|') ||
       baseline.pass1CandidateOrder.join('|')===
       alternate.pass1CandidateOrder.join('|'))
      throw Error('PAIR_ORDER_ALTERNATING_NOT_DISTINCT');
    const support=[ 'b0/floor','b0/b1','b1/b2' ];
    const onlySupport=(list:string[])=>list.filter(name=>support.includes(name));
    if(onlySupport(supportUp.pass0CandidateOrder).join('|')!==support.join('|'))
      throw Error('PAIR_ORDER_SUPPORT_UP_NOT_DISTINCT');
    if(onlySupport(supportDown.pass0CandidateOrder).join('|')!==[...support].reverse().join('|'))
      throw Error('PAIR_ORDER_SUPPORT_DOWN_NOT_DISTINCT');
    console.log(JSON.stringify({scene,baseline,reversed,alternate,supportUp,supportDown,
      comparisons:{
        reverseMinusBaselineHorizontalM:
          reversed.maxHorizontalFromInitialM-baseline.maxHorizontalFromInitialM,
        alternateMinusBaselineHorizontalM:
          alternate.maxHorizontalFromInitialM-baseline.maxHorizontalFromInitialM,
        supportUpMinusBaselineHorizontalM:
          supportUp.maxHorizontalFromInitialM-baseline.maxHorizontalFromInitialM,
        supportDownMinusBaselineHorizontalM:
          supportDown.maxHorizontalFromInitialM-baseline.maxHorizontalFromInitialM
      },
      interpretation:'temporary traversal-order-only perturbation, not a production solver fix; order effect may depend on other solver defects'}));
    if([baseline,reversed,alternate,supportUp,supportDown].some(s=>s.firstFailure!==null))
      process.exitCode=1;
  }
}finally{
  delete globals.__p1572PairOrder;
  delete globals.__p1572PairVisit;
}
