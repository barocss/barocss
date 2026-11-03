import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectPacket} from '../physics-stack-packet-2276/packet.mjs';
export const STEPS=16,CREDITS=3;
export class Cancelled extends Error {constructor(){super('work stopped after observed failure');this.name='Cancelled';}}
// Type/key/UTF16/word/identity transcript. No JSON or repeated alias traversal.
export function fingerprint(packet){
 const admission=inspectPacket(packet),hash=createHash('sha256'),seen=new Map(),scratch=Buffer.alloc(4096);
 const tag=x=>hash.update(x),u32=x=>{scratch.writeUInt32BE(x,0);hash.update(scratch.subarray(0,4));};
 function text(value){u32(value.length);for(let start=0;start<value.length;start+=2048){const count=Math.min(2048,value.length-start);for(let i=0;i<count;i++)scratch.writeUInt16BE(value.charCodeAt(start+i),i*2);hash.update(scratch.subarray(0,count*2));}}
 function walk(value){
  if(value===null){tag('N');return;}if(typeof value==='boolean'){tag(value?'T':'F');return;}
  if(typeof value==='number'){tag('D');scratch.writeDoubleBE(value,0);hash.update(scratch.subarray(0,8));return;}
  if(typeof value==='string'){tag('S');text(value);return;}
  if(seen.has(value)){tag('R');u32(seen.get(value));return;}
  const id=seen.size;seen.set(value,id);tag(Array.isArray(value)?'A':'O');u32(id);const keys=Object.keys(value);u32(keys.length);if(Array.isArray(value))u32(value.length);
  for(const key of keys){tag('K');text(key);walk(value[key]);}tag('E');
 }
 walk(packet);return {sha256:hash.digest('hex'),...admission};
}
export function verifyFingerprint(packet,expected){const actual=fingerprint(packet);assert.deepEqual(actual,expected,'structured-clone fingerprint changed');return actual;}

export class Window {
 constructor(scene){this.scene=scene;this.slots=new Map();this.next=1;this.contiguous=0;this.arrivals=0;this.firstObserved=null;this.failures=new Map();this.peak=0;}
 hold(step){assert.ok(!this.firstObserved,'producer stopped');assert.equal(step,this.next);assert.ok(step<=STEPS,'hard16-step limit');assert.ok(this.slots.size<CREDITS,'three credits include every phase');this.slots.set(step,{step,state:'producing'});this.next++;this.peak=Math.max(this.peak,this.slots.size);}
 phase(step,state){const slot=this.slots.get(step);assert.ok(slot);slot.state=state;return slot;}
 canResolve(step){return !this.firstObserved||step<Math.min(...this.failures.keys());}
 verified(step,value){assert.ok(this.canResolve(step));Object.assign(this.phase(step,'verified'),{value});}
 ready(){const slot=this.slots.get(this.contiguous+1);return slot?.state==='verified'?slot:null;}
 beginArchive(step){assert.equal(step,this.contiguous+1,'no accepted gap');assert.equal(this.slots.get(step)?.state,'verified');this.phase(step,'archiving');}
 archived(step){assert.equal(step,this.contiguous+1,'no accepted gap');assert.equal(this.slots.get(step)?.state,'archiving');this.slots.delete(step);this.contiguous=step;}
 fail(step,gate,error){const record={scene:this.scene,step,gate,arrivalOrder:++this.arrivals,hostMonotonicNs:String(process.hrtime.bigint()),errorClass:error.name,code:error.code,message:error.message,unresolved:error.unresolved===true};this.firstObserved??=record;if(!this.failures.has(step))this.failures.set(step,record);if(this.slots.has(step))this.phase(step,error.unresolved?'unresolved':'failed');return record;}
 unknown(step){if(this.slots.has(step))this.phase(step,'unresolved');}
 failureSummary(){if(!this.firstObserved)return null;const earliest=Math.min(...this.failures.keys()),known=this.contiguous>=earliest-1&&!this.failures.get(earliest).unresolved;return {firstObserved:this.firstObserved,earliestFailingKnown:known,earliestFailingStep:known?earliest:'UNKNOWN',contiguousPhysicalAccepted:this.contiguous};}
}
// Exactly one outstanding original observer call; queued work belongs to credits.
export class SerialReference {
 constructor(ref,permit){this.ref=ref;this.permit=permit;this.tail=Promise.resolve();this.ordinal=0;this.active=0;this.peak=0;}
 run(step,operation){const task=this.tail.then(async()=>{if(!this.permit(step))throw new Cancelled();assert.equal(this.active,0);this.active++;this.peak=Math.max(this.peak,this.active);try{return await operation(++this.ordinal);}finally{this.active--;}});this.tail=task.then(()=>undefined,()=>undefined);return task;}
}
export async function terminateOwnedWorker(worker,timeoutMs=1000){
 let timer;try{return await Promise.race([worker.terminate(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('owned Worker terminate/reap deadline')),timeoutMs);})]);}finally{clearTimeout(timer);}
}
