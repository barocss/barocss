import assert from 'node:assert/strict';
const CREDITS=3;
export class Window {
 constructor(scene,steps){assert.ok(steps===16||steps===1200);this.steps=steps;this.scene=scene;this.slots=new Map();this.next=1;this.contiguous=0;this.arrivals=0;this.firstObserved=null;this.failures=new Map();this.peak=0;}
 hold(step){assert.ok(!this.firstObserved,'producer stopped');assert.equal(step,this.next);assert.ok(step<=this.steps,'fixed scene population');assert.ok(this.slots.size<CREDITS,'three credits include every phase');this.slots.set(step,{step,state:'producing'});this.next++;this.peak=Math.max(this.peak,this.slots.size);}
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
