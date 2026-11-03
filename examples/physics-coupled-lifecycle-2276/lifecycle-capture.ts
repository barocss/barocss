/** Private bounded lifecycle observation. Never feeds a physics/producer decision. */
import type {PhysicsState,PhysicsModel,Recording} from './types.js';
import {phaseReserveLifecycle,phaseLifecycleBudget} from './private-phase.js';
const MAX_WORLDS=4,MAX_CELLS=8192,MAX_DEPTH=64,MAX_STRING=4096,MAX_READS=16;
interface OwnerInput {recording:Recording|null;commandCount:number}
interface Readers {view:()=>unknown;state:()=>PhysicsState;model:()=>PhysicsModel;private:()=>unknown;owner:()=>OwnerInput|null}
interface Captured {status:'CAPTURED';worldId:number;publicState:PhysicsState;model:PhysicsModel;privateSnapshot:unknown;owner:{status:'ACTUAL_ATTACHED_OWNER';recording:Recording|null;commandCount:number}|{status:'NOT_APPLICABLE_NO_ATTACHED_OWNER'};preflightCells:number;reservedCopyBytes:number}
interface Unresolved {status:'UNRESOLVED';worldId:number;reason:string}
type Capture=Captured|Unresolved;
const slots:(Capture|null)[]=[null,null,null,null],seen=[false,false,false,false];
let captureCalls=0,duplicateHookCalls=0,readCalls=0,readCopyBytes=0,captureCopyBytes=0,globalFailure:string|null=null;
// Fixed refusal metadata is accounted before any World or snapshot exists.
if(!phaseReserveLifecycle(4096))globalFailure='FAILURE_METADATA_RESERVATION';
function measure(value:unknown):{ok:boolean;bytes:number;cells:number;reason:string} {
 let bytes=256,cells=0,reason='';const active=new Set<object>();
 const add=(n:number):boolean=>{bytes+=n;if(bytes>16*1024*1024){reason='BYTE_BOUND';return false;}return true;};
 function walk(x:unknown,depth:number):boolean {
  if(++cells>MAX_CELLS){reason='CELL_BOUND';return false;}if(depth>MAX_DEPTH){reason='DEPTH_BOUND';return false;}
  if(x===null||x===undefined||typeof x==='boolean')return add(16);
  if(typeof x==='number'){if(!Number.isFinite(x)){reason='NONFINITE_DATA';return false;}return add(48);}
  if(typeof x==='string'){if(x.length>MAX_STRING){reason='STRING_BOUND';return false;}return add(x.length*6+8);}
  if(typeof x!=='object'){reason='NONDATA_VALUE';return false;}
  if(active.has(x)){reason='CYCLIC_DATA';return false;}active.add(x);
  try{
   if(Array.isArray(x)){if(x.length>MAX_CELLS){reason='ARRAY_CELL_BOUND';return false;}if(!add(16))return false;for(let i=0;i<x.length;i++)if(!walk(x[i],depth+1))return false;return true;}
   const prototype=Object.getPrototypeOf(x);if(prototype!==Object.prototype&&prototype!==null){reason='NONPLAIN_DATA';return false;}
   if(!add(16))return false;
   for(const key in x)if(Object.hasOwn(x,key)){if(key.length>MAX_STRING){reason='KEY_BOUND';return false;}if(!add(key.length*6+12)||!walk(Reflect.get(x,key),depth+1))return false;}
   return true;
  }finally{active.delete(x);}
 }
 const ok=walk(value,0);return{ok,bytes,cells,reason};
}
function freezeClone(value:unknown):void {
 if(value!==null&&typeof value==='object'&&!Object.isFrozen(value)){for(const key in value)if(Object.hasOwn(value,key))freezeClone(Reflect.get(value,key));Object.freeze(value);}
}
/** Called only at original nonreentrant, nondisposed dispose boundary. Never throws. */
export function captureBeforeDispose(worldId:number,read:Readers):void {
 try{
  if(!Number.isInteger(worldId)||worldId<1||worldId>MAX_WORLDS){globalFailure='INVALID_WORLD_ID';return;}
  const index=worldId-1;if(seen[index]){duplicateHookCalls++;return;}seen[index]=true;captureCalls++;
  const refuse=(reason:string):void=>{slots[index]=Object.freeze({status:'UNRESOLVED',worldId,reason});};
  if(globalFailure){refuse(globalFailure);return;}
  // read.view is a shallow view of actual live accepted storage, not a clone/getter.
  const checked=measure(read.view());if(!checked.ok){refuse('PREFLIGHT_'+checked.reason);return;}
  // Conservative allowance covers getter/intermediate/owner copies before any allocation.
  const reserved=checked.bytes*4;if(!Number.isSafeInteger(reserved)||!phaseReserveLifecycle(reserved)){refuse('SHARED_DIAGNOSTIC_BYTE_BOUND');return;}captureCopyBytes+=reserved;
  const publicState=read.state(),model=read.model(),privateSnapshot=read.private(),ownerInput=read.owner();
  const owner:Captured['owner']=ownerInput===null?{status:'NOT_APPLICABLE_NO_ATTACHED_OWNER'}:{status:'ACTUAL_ATTACHED_OWNER',...structuredClone(ownerInput)};
  const capture:Captured={status:'CAPTURED',worldId,publicState,model,privateSnapshot,owner,preflightCells:checked.cells,reservedCopyBytes:reserved};
  const actual=measure(capture);if(!actual.ok||actual.bytes>reserved){refuse('POSTREAD_DATA_BOUND');return;}
  freezeClone(capture);slots[index]=capture;
 }catch{if(Number.isInteger(worldId)&&worldId>=1&&worldId<=MAX_WORLDS)slots[worldId-1]=Object.freeze({status:'UNRESOLVED',worldId,reason:'OBSERVATION_EXCEPTION'});else globalFailure='OBSERVATION_EXCEPTION';}
}
export function lifecycleCaptureStats(){return{captureCalls,duplicateHookCalls,readCalls,readCopyBytes,captureCopyBytes,globalFailure,budget:phaseLifecycleBudget(),limits:{worlds:MAX_WORLDS,cells:MAX_CELLS,depth:MAX_DEPTH,string:MAX_STRING,reads:MAX_READS}};}
function emptyRecords():Capture[]{return[];}
/** Every return has its own bounded clone. No stored capture is exposed. */
export function lifecycleCaptures(){
 try{
  if(readCalls>=MAX_READS)return{status:'UNRESOLVED_READ_COUNT',records:emptyRecords(),stats:lifecycleCaptureStats()};
  readCalls++;const records=slots.filter((x):x is Capture=>x!==null),checked=measure(records);
  if(!checked.ok||!phaseReserveLifecycle(checked.bytes))return{status:'UNRESOLVED_READ_BOUND',records:emptyRecords(),stats:lifecycleCaptureStats()};
  readCopyBytes+=checked.bytes;return{status:'CAPTURE_VIEW',records:structuredClone(records),stats:lifecycleCaptureStats()};
 }catch{return{status:'UNRESOLVED_READ_EXCEPTION',records:emptyRecords(),stats:lifecycleCaptureStats()};}
}
