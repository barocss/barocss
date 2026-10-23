import type {Vec3} from '../scene/scene-types.js';
/** Reject unusable segments in the actual Float32 endpoint/dot representation. */
export function validateCapsuleSegment(start:Vec3,end:Vec3):void{
 const delta=end.map((value,i)=>Math.fround(Math.fround(value)-Math.fround(start[i])));
 const squared=delta.map(value=>Math.fround(value*value));
 const dot=Math.fround(Math.fround(squared[0]+squared[1])+squared[2]);
 if(!Number.isFinite(dot)||dot<=0)throw new Error('Capsule endpoints require usable nonzero Float32 separation');
}
