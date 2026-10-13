/**
 * #1572 counterfactual: identical public three-cube OFFSET/YAW fixtures,
 * identical Physics solver and material laws; vary ONLY outer solver pass count and
 * pair traversal order as controlled factors in a TEMPORARY esbuild graph.
 * Never claim an eight-box or public API acceptance from three-box evidence.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';
type Scene='OFFSET'|'YAW';
type Order='baseline'|'supportUp';
type Passes=8|16|32;
const dt=1/120, steps=1200;
const globals=globalThis as typeof globalThis & {
  __p1572PairOrder?:Order;
  __p1572PassCount?:Passes;
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
function run(scene:Scene,order:Order,passes:Passes){
  globals.__p1572PairOrder=order;
  globals.__p1572PassCount=passes;
  const inputs=[cube(0,scene),cube(1,scene),cube(2,scene)];
  const worldConfig:PhysicsWorldConfig={
    fixedStepSeconds:dt,gravityMps2:[0,-9.81,0],
    contactMode:'persistent-box-v1',bodies:[floor,...inputs]
  };
  const seen=new Map<number,string[]>();
  globals.__p1572PairVisit=event=>{
    if(event.step!==1)return;
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
  if(accepted>0 && (seen.size!==passes||!pass0.length||!pass1.length))
    throw Error('PASS_COUNT_PROBE_NOT_ACTIVE:'+seen.size+' expected '+passes);
  const boundedSettlingThresholdsMet=
    accepted===steps&&maxHorizontalFromInitialM<=.01&&
    maxLinearSpeedMps<=.02&&maxAngularSpeedRadps<=.02&&
    maxVerticalDriftM<=.005&&maxReportedPenetrationM<=.002;
  return {scene,order,passes,observedPassCount:seen.size,accepted,firstFailure,
    pass0CandidateOrder:pass0,pass1CandidateOrder:pass1,
    maxHorizontalFromInitialM,maxLinearSpeedMps,maxAngularSpeedRadps,
    maxVerticalDriftM,maxReportedPenetrationM,boundedSettlingThresholdsMet,
    finalX,checkpoints,
    independentCollisionQualityGO:false,fullEightBoxGO:false};
}
try {
  for(const scene of ['OFFSET','YAW'] as const){
    const results=[] as ReturnType<typeof run>[];
    for(const passes of [8,16,32] as const){
      results.push(run(scene,'baseline',passes));
      results.push(run(scene,'supportUp',passes));
    }
    const baseline=results.find(r=>r.order==='baseline'&&r.passes===8)!;
    const expected=scene==='OFFSET'?0.10664399459901502:0.10827160677737203;
    if(baseline.accepted!==steps||
       Math.abs(baseline.maxHorizontalFromInitialM-expected)>1e-9)
      throw Error('PASS_COUNT_BASELINE_REPRODUCTION_FAILED:'+scene);
    const support=['b0/floor','b0/b1','b1/b2'];
    for(const x of results.filter(r=>r.order==='supportUp'&&r.accepted>0)){
      const supportOrder=x.pass0CandidateOrder.filter(name=>support.includes(name));
      if(supportOrder.join('|')!==support.join('|'))
        throw Error('PASS_COUNT_SUPPORT_ORDER_FAILED:'+x.passes);
    }
    const control=results.find(r=>r.order==='supportUp'&&r.passes===8)!;
    if(Math.abs(control.maxHorizontalFromInitialM-
      (scene==='OFFSET'?0.033460182:0.033492447))>2e-6)
      throw Error('PASS_COUNT_SUPPORT_UP_REPRODUCTION_FAILED:'+scene);
    console.log(JSON.stringify({scene,results,
      baselineEightPassesReproduced:true,
      independentPhysicsQualityGO:false,fullEightBoxGO:false,
      interpretation:'only test-only outer solver pass count (8/16/32) and pair traversal baseline/supportUp vary; compare monotonic convergence and complete existing settling gates without changing friction, per-point iterations, geometry, or production World'}));
    if(results.some(x=>x.firstFailure!==null))process.exitCode=1;
  }
}finally{
  delete globals.__p1572PairOrder;
  delete globals.__p1572PassCount;
  delete globals.__p1572PairVisit;
}
