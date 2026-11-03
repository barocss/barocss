// Harness only. Never imports production, computes GCD, retains results or changes counters.
import assert from 'node:assert/strict';
const CALL_CAP=2000000,CONTEXT_CAP=512;
export function observeMake(prototype){
 const original=Object.getOwnPropertyDescriptor(prototype,'make');
 assert.ok(original&&Object.hasOwn(original,'value')&&typeof original.value==='function');
 assert.equal(original.value.name,'make');assert.equal(original.value.length,1);
 assert.equal(original.writable,true);assert.equal(original.configurable,true);assert.equal(original.enumerable,false);
 const contexts=new WeakMap(),classes=Object.fromEntries(['unit','dyadic','nonbinary'].map(k=>[k,{visits:0,last1:0,last4:0}]));
 const counts={successfulMakes:0,contextsSeen:0,last1:0,last4:0,negativeDenominator:0,zeroNumerator:0,originalThrows:0,classes};
 let diagnosticFailure=null,enabled=true;
 function fail(error){enabled=false;diagnosticFailure??=String(error?.message??error).slice(0,512);}
 function record(receiver,n,d){
  assert.equal(typeof n,'bigint');assert.equal(typeof d,'bigint');
  assert.ok(counts.successfulMakes<CALL_CAP,'diagnostic make-count bound');
  let state=contexts.get(receiver);
  if(!state){assert.ok(counts.contextsSeen<CONTEXT_CAP,'diagnostic context-count bound');state=[];contexts.set(receiver,state);counts.contextsSeen++;}
  if(d<0n){n=-n;d=-d;counts.negativeDenominator++;}
  const category=d===1n?'unit':(d&(d-1n))===0n?'dyadic':'nonbinary',c=classes[category];
  const index=state.findIndex(key=>key.n===n&&key.d===d);
  counts.successfulMakes++;c.visits++;if(n===0n)counts.zeroNumerator++;
  if(index===0){counts.last1++;c.last1++;}if(index>=0){counts.last4++;c.last4++;}
  if(index>=0)state.splice(index,1);else if(state.length===4)state.pop();
  state.unshift({n,d});
 }
 function make(n,d=1n){
  let result;
  try{result=Reflect.apply(original.value,this,arguments);}catch(error){counts.originalThrows++;throw error;}
  if(enabled)try{record(this,n,d);}catch(error){fail(error);}
  return result;
 }
 const replacement={...original,value:make};Object.defineProperty(prototype,'make',replacement);
 let restored=false;
 return {
  snapshot(){return structuredClone(counts);},
  checkpoint(){assert.equal(diagnosticFailure,null,'diagnostic observation invalid');assert.equal(counts.originalThrows,0,'production throw invalidates observations');assert.deepEqual(Object.getOwnPropertyDescriptor(prototype,'make'),replacement,'prototype ownership changed');},
  restore(){assert.equal(restored,false);assert.deepEqual(Object.getOwnPropertyDescriptor(prototype,'make'),replacement,'prototype ownership changed before restore');Object.defineProperty(prototype,'make',original);assert.deepEqual(Object.getOwnPropertyDescriptor(prototype,'make'),original);restored=true;},
  status(){return {diagnosticFailure,restored,originalThrows:counts.originalThrows,interpretation:'HYPOTHETICAL_SIGN_NORMALIZED_RAW_PAIR_LAST1_AND_DISTINCT_LRU4_ONLY',dataBoundary:'At most512 cumulative WeakMap contexts,4 checked pairs each;16MiB diagnostic reservation, not whole-data/RSS qualification'};}
 };
}
