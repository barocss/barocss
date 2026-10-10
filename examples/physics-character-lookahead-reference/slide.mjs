import { add,scale,dot,norm,SKIN,WALKABLE,STEP_HEIGHT,PREVIEW,STEP_DOWN,SLIDE_CAP,MovementRefusal } from '../physics-character-controller-reference/constants.mjs';
export const LOOKAHEAD=.02;
function tryStep(position,remaining,candidate,context){
 const horizontal=[remaining[0],0,remaining[2]],length=norm(horizontal);if(length<=1e-12||!candidate.grounded)return null;
 const direction=scale(horizontal,1/length),up=context.sweep(position,[0,STEP_HEIGHT,0],'step-up-probe',true);if(up.hit)return null;
 const raised=add(position,[0,STEP_HEIGHT,0]),forward=context.sweep(raised,scale(direction,PREVIEW),'step-ahead-probe',true);if(forward.hit)return null;
 const preview=add(raised,scale(direction,PREVIEW)),down=context.sweep(preview,[0,-STEP_DOWN,0],'step-down-probe',true);
 if(!down.hit||down.hit.normalFixtureToCapsule[1]<WALKABLE)return null;
 const targetY=raised[1]-STEP_DOWN*down.hit.toiFraction+SKIN/down.hit.normalFixtureToCapsule[1],rise=targetY-position[1];
 if(rise<=1e-9||rise>STEP_HEIGHT+1e-6)return null;
 const actualRaised=add(position,[0,rise,0]),actual=context.sweep(actualRaised,horizontal,'step-actual-forward',false);if(actual.hit)return null;
 let moved=context.commit(position,[0,rise,0],'step-up',up.indices);moved=context.commit(moved,horizontal,'step-forward',actual.indices);
 candidate.assist={bodyId:down.hit.bodyId,heightM:targetY,directionXZ:[direction[0],direction[2]],frames:0};candidate.fallVelocityYMps=0;candidate.grounded=false;candidate.support=null;
 return moved;
}
export function move(position,delta,candidate,context,diagnostic={}){
 let p=[...position],remaining=[...delta];
 for(let pass=0;pass<(diagnostic.slideBudget??SLIDE_CAP);pass++){
  if(norm(remaining)<=1e-12)return p;
  const length=norm(remaining),direction=scale(remaining,1/length),probeLength=length+LOOKAHEAD;
  const result=context.sweep(p,scale(direction,probeLength),'slide-lookahead',true),hit=result.hit;
  if(!hit)return context.commit(p,remaining,'travel',result.indices);
  const n=hit.normalFixtureToCapsule,closingUnit=-dot(n,direction);
  if(closingUnit<=1e-12)throw new MovementRefusal('UNRESOLVED_LOOKAHEAD','Lookahead closing normal unresolved');
  const contactDistance=probeLength*hit.toiFraction,safeDistance=Math.max(0,contactDistance-SKIN/closingUnit);
  const fraction=Math.min(1,safeDistance/length);
  const travel=scale(remaining,fraction);if(norm(travel)>0)p=context.commit(p,travel,'travel',result.indices);
  if(fraction===1)return p;
  remaining=scale(remaining,1-fraction);
  if(n[1]<WALKABLE){
   const stepped=tryStep(p,remaining,candidate,context);if(stepped)return stepped;
   candidate.blocked=true;const horizontalNormal=[n[0],0,n[2]],size=norm(horizontalNormal);
   if(size>1e-12){const unit=scale(horizontalNormal,1/size),into=dot(remaining,unit);if(into<0)remaining=add(remaining,scale(unit,-into));}
   if(n[1]>1e-12&&remaining[1]<0){remaining[1]=0;candidate.fallVelocityYMps=0;}
   else if(n[1]<-1e-12&&remaining[1]>0)remaining[1]=0;
  }else{const into=dot(remaining,n);if(into<0)remaining=add(remaining,scale(n,-into));candidate.fallVelocityYMps=0;}
 }
 if(norm(remaining)>1e-12)throw new MovementRefusal('SLIDE_LIMIT','Slide limit exhausted');return p;
}
