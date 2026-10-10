import { PhysicsError, type Body, type Joint, type PhysicsBodyConfig, type PhysicsBodyState, type PhysicsJointConfig, type PhysicsJointState, type Vec3 } from '../../packages/barocss-physics/src/types.js';
import { parseBody, copyBody, error } from '../../packages/barocss-physics/src/validation.js';
import { parseJoints } from '../../packages/barocss-physics/src/joints.js';
import { projectDynamicHingeJoint } from '../../packages/barocss-physics/src/dynamic-hinge-joint.js';
import { inverse, multiplyQuaternion, worldPoint, rotate, sub, dot } from '../../packages/barocss-physics/src/math.js';
export { PhysicsError };
export const PAIR_MESSAGE='private hinge diagnostic requires an admitted archived pair';
export const POSE_MESSAGE='private hinge diagnostic requires finite unit raw poses within original bounds';
export const DT_MESSAGE='private hinge diagnostic requires dt=1/120';
export interface PairConfig { bodies: PhysicsBodyConfig[]; joints: PhysicsJointConfig[]; gravityMps2?:Vec3; fixedStepSeconds?:number }
export type PairJointState=Pick<PhysicsJointState,'id'|'kind'|'aId'|'bId'> & {angleRad:number};
export interface PairState { bodies: PhysicsBodyState[]; joints: PairJointState[] }
function dense(value:unknown,size:number,bound:number):value is number[]{return Array.isArray(value)&&value.length===size&&Array.from({length:size},(_,i)=>i).every(i=>Object.hasOwn(value,i)&&typeof value[i]==='number'&&Number.isFinite(value[i])&&Math.abs(value[i])<=bound);}
function same(a:readonly number[],b:readonly number[]):boolean{return a.length===b.length&&a.every((v,i)=>v===b[i]);}
/** Build original initial metadata before overwriting exact archived raw13 fields. */
export function preparePair(config:PairConfig,state:PairState):{bodies:Body[];joint:Joint;reportedAngleRad:number}{
 if(!config||!state||!Array.isArray(config.bodies)||config.bodies.length!==2||!Array.isArray(config.joints)||config.joints.length!==1||!Array.isArray(state.bodies)||state.bodies.length!==2||!Array.isArray(state.joints)||state.joints.length!==1)error('INVALID_CONFIG',PAIR_MESSAGE);
 for(const [array,size]of [[config.bodies,2],[config.joints,1]] as const)if(!Array.from({length:size},(_,i)=>i).every(i=>Object.hasOwn(array,i)&&array[i]!==null&&typeof array[i]==='object'))error('INVALID_CONFIG',PAIR_MESSAGE);
 if(Object.hasOwn(config,'gravityMps2')&&(!dense(config.gravityMps2,3,1000)||!same(config.gravityMps2,[0,0,0]))||Object.hasOwn(config,'fixedStepSeconds')&&config.fixedStepSeconds!==1/120)error('INVALID_CONFIG',PAIR_MESSAGE);
 if(config.bodies.some(b=>Object.hasOwn(b,'inertiaKgM2')))error('INVALID_CONFIG',PAIR_MESSAGE);
 const bodies=config.bodies.map(b=>parseBody(b,false));
 const [a,b]=bodies,group=/^pairA([01])$/.exec(a.id);
 if(!group||b.id!==`pairB${group[1]}`||bodies.some(body=>body.kind!=='dynamic'||body.shape.kind!=='sphere'||body.shape.radiusM!==.1||body.inverseMass!==1||body.inertiaKgM2!==0.4*.1**2||body.restitution!==0||body.frictionStatic!==1||body.frictionDynamic!==.7||body.ccd||body.sensor||body.collisionFilter||!same(body.velocityMps,[0,0,0])||!same(body.angularVelocityRadps,[0,0,0])||!same(body.orientation,[0,0,0,1])))error('INVALID_CONFIG',PAIR_MESSAGE);
 const origin=a.positionM[2];if((origin!==0&&origin!==Number(group[1]))||!same(a.positionM,[-.1,0,origin])||!same(b.positionM,[.1,0,origin]))error('INVALID_CONFIG',PAIR_MESSAGE);
 const joint=parseJoints(config.joints,bodies)[0];
 if(joint.id!==`hinge${group[1]}`||joint.kind!=='hinge'||joint.aIndex!==0||joint.bIndex!==1||!same(joint.anchorALocalM,[.1,0,0])||!same(joint.anchorBLocalM,[-.1,0,0])||!same(joint.axisWorld!,[0,0,1])||!same(joint.limitRad!,[-.8,.8])||joint.motor?.targetSpeedRadps!==.5||joint.motor.maxImpulseNms!==.0001||joint.motor.maxReactionNms!==.01)error('INVALID_CONFIG',PAIR_MESSAGE);
 const report=state.joints[0];if(!report||report.id!==joint.id||report.kind!=='hinge'||report.aId!==a.id||report.bId!==b.id||typeof report.angleRad!=='number'||!Number.isFinite(report.angleRad))error('INVALID_CONFIG',PAIR_MESSAGE);
 for(let index=0;index<2;index++){
  const archived=state.bodies[index],body=bodies[index];
  if(!archived||archived.id!==body.id||archived.kind!=='dynamic'||archived.shape?.kind!=='sphere'||archived.shape.radiusM!==.1||archived.inertiaKgM2!==undefined&&archived.inertiaKgM2!==body.inertiaKgM2)error('INVALID_CONFIG',PAIR_MESSAGE);
  if(!dense(archived.positionM,3,10000)||!dense(archived.velocityMps,3,1000)||!dense(archived.orientation,4,1)||!dense(archived.angularVelocityRadps,3,1000)||Math.abs(Math.hypot(...archived.orientation)-1)>1e-9)error('INVALID_CONFIG',POSE_MESSAGE);
  body.positionM=[...archived.positionM];body.velocityMps=[...archived.velocityMps];body.orientation=[...archived.orientation];body.angularVelocityRadps=[...archived.angularVelocityRadps];
 }
 return {bodies,joint,reportedAngleRad:report.angleRad};
}
/** Measurement uses unchanged original helpers; no projection or world is called. */
export function originalMeasurement(bodies:Body[],joint:Joint,reportedAngleRad:number){
 const a=bodies[joint.aIndex],b=bodies[joint.bIndex],relative=multiplyQuaternion(b.orientation,inverse(a.orientation));
 const raw=2*Math.atan2(dot([relative[0],relative[1],relative[2]],joint.axisWorld!),relative[3]);
 const angle=raw>Math.PI?raw-2*Math.PI:raw< -Math.PI?raw+2*Math.PI:raw;
 const anchorAM=worldPoint(a,joint.anchorALocalM),anchorBM=worldPoint(b,joint.anchorBLocalM);
 const axes=[a,b].map(body=>{const axis=rotate(body.orientation,[0,0,1]);return Math.acos(Math.max(-1,Math.min(1,axis[2]/Math.hypot(...axis))));});
 return {relativeAngleRad:angle,relativeQuaternionXYZW:[...relative],anchorAM,anchorBM,anchorGapM:Math.hypot(...sub(anchorBM,anchorAM)),axisDeviationRad:Math.max(...axes),limitExcessRad:Math.max(0,joint.limitRad![0]-angle,angle-joint.limitRad![1]),reportedAngleDifferenceRad:angle-reportedAngleRad};
}
export function inspectPair(config:PairConfig,state:PairState){const prepared=preparePair(config,state);return originalMeasurement(prepared.bodies,prepared.joint,prepared.reportedAngleRad);}
/** Exactly ONE detached original projection. No motor, clock, world or hidden replay. */
export function projectOnce(config:PairConfig,state:PairState,dt:number){
 if(dt!==1/120)error('INVALID_STEP',DT_MESSAGE);
 const prepared=preparePair(config,state),before=prepared.bodies.map(copyBody),working=prepared.bodies.map(copyBody);
 const beforeMeasurement=originalMeasurement(before,prepared.joint,prepared.reportedAngleRad);
 try{
  const returned=projectDynamicHingeJoint(prepared.joint,working,dt);
  return {ok:true as const,before,beforeMeasurement,returned,after:working.map(copyBody),afterMeasurement:originalMeasurement(working,prepared.joint,returned.angleRad!)};
 }catch(caught){
  if(caught instanceof PhysicsError&&caught.code==='NUMERIC_LIMIT')return {ok:false as const,before,beforeMeasurement,returned:null,after:working.map(copyBody),code:caught.code,message:caught.message};
  throw caught;
 }
}
