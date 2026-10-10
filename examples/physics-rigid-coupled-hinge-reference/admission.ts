import type {Body,Joint,PhysicsState,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';
import {PhysicsError} from '../../packages/barocss-physics/src/types.js';
import {record,fields,finite,vector,parseBody,error} from '../../packages/barocss-physics/src/validation.js';
import {MAX_BODIES,MAX_LARGE_BODIES} from '../../packages/barocss-physics/src/limits.js';
import {parseJoints} from '../../packages/barocss-physics/src/joints.js';
import {preparePair,PAIR_MESSAGE,POSE_MESSAGE} from '../physics-rigid-hinge-limit-diagnostic/adapter.js';
import {DT,ERRORS,denseDataArray,profileError,poseError,copyCarrier} from './profile.js';
/** Original config/body/joint structural errors precede the private pair/raw profile. */
function structural(config:PhysicsWorldConfig){
 const input=record(config,'world');fields(input,['fixedStepSeconds','gravityMps2','bodies','joints','broadPhase','contactMode','sceneMode'],'world');
 if(Object.hasOwn(input,'sceneMode')&&input.sceneMode!=='large-v1')error('INVALID_CONFIG','sceneMode must be large-v1 when present');
 if(Object.hasOwn(input,'broadPhase')&&input.broadPhase!=='aabb')error('INVALID_CONFIG','broadPhase must be aabb when present');
 if(Object.hasOwn(input,'contactMode')&&input.contactMode!=='persistent-box-v1')error('INVALID_CONFIG','contactMode must be persistent-box-v1 when present');
 const largeMode=input.sceneMode==='large-v1',persistent=input.contactMode==='persistent-box-v1';
 if(largeMode&&(input.broadPhase!=='aabb'||persistent||Object.hasOwn(input,'joints')))error('INVALID_CONFIG','large-v1 requires aabb and excludes joints and persistent-box-v1');
 finite(input.fixedStepSeconds,1/240,1/30,'fixedStepSeconds');vector(input.gravityMps2,-1000,1000,'gravityMps2');
 const bodyLimit=largeMode?MAX_LARGE_BODIES:MAX_BODIES;if(!Array.isArray(input.bodies)||input.bodies.length<1||input.bodies.length>bodyLimit)error('INVALID_CONFIG',`bodies must contain 1..${bodyLimit} entries`);
 if(persistent&&input.bodies.length>4)error('INVALID_CONFIG','persistent-box-v1 admits at most four bodies');
 if(!denseDataArray(input.bodies))profileError();
 const bodies=input.bodies.map(b=>parseBody(b,largeMode));if(largeMode&&bodies.some(b=>b.ccd))error('INVALID_CONFIG','large-v1 excludes CCD');if(!bodies.some(b=>b.kind==='dynamic'))error('INVALID_CONFIG','at least one dynamic body is required');if(new Set(bodies.map(b=>b.id)).size!==bodies.length)error('INVALID_CONFIG','duplicate body ID');
 const joints=parseJoints(Object.hasOwn(input,'joints')?input.joints:[],bodies);
 return {input,bodies,joints};
}
function knownBridge<T>(phase:'profile'|'pose',action:()=>T):T{
 try{return action();}catch(caught){
  if(caught instanceof PhysicsError&&caught.code==='INVALID_CONFIG'&&(caught.message===PAIR_MESSAGE||caught.message===POSE_MESSAGE)){if(phase==='profile')profileError();else poseError();}
  throw caught;
 }
}
export function admit(config:PhysicsWorldConfig,state:PhysicsState,dt:number):{bodies:Body[];joint:Joint;carrier:PhysicsState;config:PhysicsWorldConfig}{
 if(dt!==DT)error('INVALID_STEP',ERRORS.dt);
 const parsed=structural(config);
 if(parsed.bodies.length!==2||parsed.joints.length!==1||parsed.joints[0].kind!=='hinge'||parsed.input.fixedStepSeconds!==DT||['sceneMode','broadPhase','contactMode'].some(key=>Object.hasOwn(parsed.input,key)))profileError();
 const copiedConfig=structuredClone(config) as PhysicsWorldConfig & Parameters<typeof preparePair>[0],joint=parsed.joints[0];
 const resting={bodies:parsed.bodies,joints:[{id:joint.id,kind:joint.kind,aId:parsed.bodies[joint.aIndex].id,bId:parsed.bodies[joint.bIndex].id,angleRad:0}]};
 knownBridge('profile',()=>preparePair(copiedConfig,resting));
 const carrier=copyCarrier(state);
 const prepared=knownBridge('pose',()=>preparePair(copiedConfig,carrier as Parameters<typeof preparePair>[1]));
 // The reused helper constructs rest metadata/joints BEFORE exact raw13 overwrite.
 return {bodies:prepared.bodies,joint:prepared.joint,carrier,config:copiedConfig};
}
