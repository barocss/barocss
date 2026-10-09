import { SweepRefusal } from './sweep.mjs';
function refuse(message){throw new SweepRefusal('INVALID_INPUT',message);}
export function record(value,keys){
 if(!value || Object.getPrototypeOf(value)!==Object.prototype)refuse('Expected plain record');
 const own=Reflect.ownKeys(value);if(own.length!==keys.length || own.some(k=>!keys.includes(k)))refuse('Unexpected fields');
 const out={};for(const key of keys){const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!descriptor || !('value'in descriptor))refuse('Accessor field');out[key]=descriptor.value;}return out;
}
export function vector(value,length,bound){
 if(!Array.isArray(value)||value.length!==length||Reflect.ownKeys(value).length!==length+1)refuse('Expected dense tuple');
 const out=[];for(let i=0;i<length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d || !('value'in d)||typeof d.value!=='number'||!Number.isFinite(d.value)||Math.abs(d.value)>bound)refuse('Invalid tuple value');out.push(d.value);}return out;
}
export function identity(value){if(typeof value!=='string'||!/^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,63}$/.test(value))refuse('Invalid identity');return value;}
export function sceneInput(input){const s=record(input,['revision','boxes']);identity(s.revision);
 if(!Array.isArray(s.boxes)||s.boxes.length>32||Reflect.ownKeys(s.boxes).length!==s.boxes.length+1)refuse('Box capacity or sparse list');
 const items=[];for(let i=0;i<s.boxes.length;i++){const descriptor=Object.getOwnPropertyDescriptor(s.boxes,String(i));if(!descriptor||!('value'in descriptor))refuse('Accessor box');items.push(descriptor.value);}
 const boxes=items.map(item=>{const b=record(item,['id','centerM','halfExtentsM','orientationXYZW']);identity(b.id);
  const centerM=vector(b.centerM,3,10),halfExtentsM=vector(b.halfExtentsM,3,5),orientationXYZW=vector(b.orientationXYZW,4,1);
  if(halfExtentsM.some(v=>v<.0001)||Math.abs(Math.hypot(...orientationXYZW)-1)>1e-12)refuse('Invalid extent or quaternion');
  return {id:b.id,centerM,halfExtentsM,orientationXYZW};});
 if(new Set(boxes.map(b=>b.id)).size!==boxes.length)refuse('Duplicate ID');return {revision:s.revision,boxes};
}
export function queryInput(input,scene){const q=record(input,['revision','centerM','displacementM','excludeId']);identity(q.revision);
 if(q.revision!==scene.revision)throw new SweepRefusal('STALE_SCENE','Revision mismatch');
 const centerM=vector(q.centerM,3,5),displacementM=vector(q.displacementM,3,2);
 if(Math.hypot(...displacementM)>2)refuse('Displacement exceeds2m');
 if(q.excludeId!==null && (!scene.boxes.some(b=>b.id===q.excludeId)))refuse('Unknown excluded ID');
 return {centerM,displacementM,excludeId:q.excludeId};
}
