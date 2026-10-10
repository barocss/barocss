import { createUprightCapsuleQuery } from '@barocss/physics';
import { DT,STEPS,GRAVITY,SKIN,SNAP,PREVIEW,STEP_DOWN,WALKABLE,ASSIST_CAP,clone,norm,dot,scale,add,MovementRefusal } from '../physics-character-controller-reference/constants.mjs';
import { queryContext } from '../physics-character-controller-reference/query.mjs';
import { move } from './slide.mjs';
function command(dt,velocity,revision,state){
 if(dt!==DT)throw new MovementRefusal('INVALID_COMMAND','Invalid dt');
 if(!Array.isArray(velocity)||velocity.length!==3||Reflect.ownKeys(velocity).length!==4)throw new MovementRefusal('INVALID_COMMAND','Expected velocity tuple');
 const values=[];for(let i=0;i<3;i++){const d=Object.getOwnPropertyDescriptor(velocity,String(i));if(!d||!('value'in d)||typeof d.value!=='number'||!Number.isFinite(d.value))throw new MovementRefusal('INVALID_COMMAND','Invalid velocity');values.push(d.value);}
 if(values[1]!==0||Math.hypot(values[0],values[2])>1)throw new MovementRefusal('INVALID_COMMAND','Horizontal request bound');
 if(revision!==state.sceneRevision)throw new MovementRefusal('STALE','Stale scene');if(state.stepIndex>=STEPS)throw new MovementRefusal('STEP_LIMIT','Step limit');return values;
}
function snap(position,candidate,context){
 const down=context.sweep(position,[0,-SNAP,0],'ground-probe',true),hit=down.hit;
 if(!hit||hit.normalFixtureToCapsule[1]<WALKABLE){candidate.grounded=false;candidate.support=null;return position;}
 const targetY=position[1]-SNAP*hit.toiFraction+SKIN/hit.normalFixtureToCapsule[1],delta=[0,targetY-position[1],0];let proof=down.indices;
 if(delta[1]>0){const up=context.sweep(position,delta,'positive-snap-validation');if(up.hit)throw new MovementRefusal('UNRESOLVED_SNAP','Positive snap blocked');proof=up.indices;}
 const p=context.commit(position,delta,'ground-snap',proof);candidate.grounded=true;candidate.support={bodyId:hit.bodyId,normal:[...hit.normalFixtureToCapsule]};candidate.fallVelocityYMps=0;candidate.assist=null;return p;
}
function validate(position,velocity,request,previous){
 if(position.some(v=>!Number.isFinite(v)||Math.abs(v)>5)||velocity.some(v=>!Number.isFinite(v))||norm(velocity)>20)throw new MovementRefusal('NUMERIC_LIMIT','State bound');
 const actual=position.map((v,i)=>v-previous.positionM[i]),horizontal=Math.hypot(actual[0],actual[2]),allowed=Math.hypot(request[0],request[2])*DT;
 if(horizontal>allowed+1e-9||Math.abs(actual[1])>.1+1e-6)throw new MovementRefusal('NUMERIC_LIMIT','Movement bound');
}
export function createController(fixture,diagnostic={}){
 const query=createUprightCapsuleQuery(clone(fixture.scene));try{query.sweep({revision:fixture.scene.revision,centerM:[...fixture.positionM],displacementM:[0,0,0],excludeId:null});}catch(e){query.dispose();throw e;}
 let lastRejected=null,disposed=false,state={stepIndex:0,timeSeconds:0,positionM:[...fixture.positionM],velocityMps:[0,0,0],fallVelocityYMps:0,orientationXYZW:[0,0,0,1],grounded:false,support:null,blocked:false,assist:null,sceneRevision:fixture.scene.revision,queryCount:0,lastQueries:[],lastSegments:[],gravityPrediction:null};
 const live=()=>{if(disposed)throw new MovementRefusal('DISPOSED','Controller is disposed');};
 return {getState(){live();return clone(state);},getLastRejected(){return clone(lastRejected);},step(dt,velocity,revision=state.sceneRevision){
  live();let attempted=null;try{const request=command(dt,velocity,revision,state),next=clone(state);attempted=next;next.queryCount=0;next.lastQueries=[];next.lastSegments=[];next.blocked=false;
  const assisted=!!state.assist,speed=Math.hypot(request[0],request[2]);if(assisted&&(speed===0||Math.abs(request[0]/speed-state.assist.directionXZ[0])>1e-12||Math.abs(request[2]/speed-state.assist.directionXZ[1])>1e-12))throw new MovementRefusal('UNRESOLVED_ASSIST','Assist request changed');
  const predicted=state.grounded||assisted?0:state.fallVelocityYMps+GRAVITY*DT;next.fallVelocityYMps=predicted;next.gravityPrediction={previousFallVelocityYMps:state.fallVelocityYMps,previousGrounded:state.grounded,previousAssisted:assisted,predictedFallVelocityYMps:predicted,predictedDeltaYM:predicted*DT};
  const context=queryContext(query,next,diagnostic),delta=[request[0]*DT,predicted*DT,request[2]*DT];let p=move(state.positionM,delta,next,context,diagnostic);p=snap(p,next,context);
  if(next.assist){
   const direction=[next.assist.directionXZ[0],0,next.assist.directionXZ[1]],ahead=context.sweep(p,scale(direction,PREVIEW),'assist-ahead',true);if(ahead.hit)throw new MovementRefusal('UNRESOLVED_ASSIST','Assist forward blocked');
   const down=context.sweep(add(p,scale(direction,PREVIEW)),[0,-STEP_DOWN,0],'assist-support',true),hit=down.hit;
   const target=hit?p[1]-STEP_DOWN*hit.toiFraction+SKIN/hit.normalFixtureToCapsule[1]:NaN;
   if(!hit||hit.normalFixtureToCapsule[1]<WALKABLE||hit.bodyId!==next.assist.bodyId||Math.abs(target-next.assist.heightM)>1e-6)throw new MovementRefusal('UNRESOLVED_ASSIST','Assist support changed');
   next.assist.frames++;if(next.assist.frames>(diagnostic.assistCap??ASSIST_CAP))throw new MovementRefusal('ASSIST_LIMIT','Assist duration');
  }
  if(diagnostic.numericFault)throw new MovementRefusal('NUMERIC_LIMIT','Internal numeric fault');
  const actualVelocity=p.map((v,i)=>(v-state.positionM[i])/DT);validate(p,actualVelocity,request,state);next.positionM=p;next.velocityMps=actualVelocity;next.stepIndex++;next.timeSeconds=next.stepIndex*DT;state=next;lastRejected=null;return clone(state);
  }catch(error){lastRejected={acceptedState:clone(state),attemptedState:clone(attempted),error:{name:error.name,code:error.code,message:error.message}};throw error;}
 },dispose(){if(!disposed){disposed=true;query.dispose();}}};
}
