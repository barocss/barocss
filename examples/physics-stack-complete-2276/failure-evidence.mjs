// Harness-only failure data. No physics, clocks, queues or file IO.
import assert from 'node:assert/strict';
import {types} from 'node:util';
const CAP=2**21,NODES=262144,DEPTH=64,FORMAT='STACK_FAILURE_FINITE_JSON_V1';
export class FailureEvidenceError extends Error {
 constructor(code){super(code);this.name='FailureEvidenceError';this.code=code;}
}
const need=(value,code)=>{if(!value)throw new FailureEvidenceError(code);};

// A selected frame remains an alias. Availability rows are scalar copies at capture.
export function captureFailureWindow(window,firstStep){
 need(window.slots instanceof Map&&window.slots.size<=3,'FAILURE_CREDIT_BOUND');
 need(Number.isSafeInteger(firstStep)&&firstStep>=0,'FAILURE_STEP');
 const slots=[...window.slots.values()].sort((a,b)=>a.step-b.step);
 const same=slots.find(slot=>slot.step===firstStep),selected=same?.received?same:slots.find(slot=>slot.received);
 return {captureStatus:'CAPTURED',availabilityScope:'FINGERPRINT_IDENTITY_WORD_CHAIN_PASSED',firstObservedStep:firstStep,
  selectedStep:selected?.step??null,selectedFrame:selected?.received??null,
  selectionReason:same?.received?'FIRST_OBSERVED_STEP_PACKET':selected?'EARLIEST_RECEIVED_UNCOMMITTED':'NO_RECEIVED_PACKET',
  firstCandidateMissing:!same?.received,
  availabilityAtCapture:slots.map(slot=>({step:slot.step,phase:slot.state,returned:!!slot.received,recordReady:!!slot.value}))};
}
export function failureWindowMetadata(capture){
 if(capture===null)return null;
 const {selectedFrame,...metadata}=capture;
 return metadata;
}

// Visit JSON occurrences, not unique identities: aliases need a zero path per copy.
function walkFinite(data,visitNumber=()=>{}){
 let nodes=0;const active=new Set();
 function walk(value,path){
  need(++nodes<=NODES&&path.length<=DEPTH,'FAILURE_GRAPH_BOUND');
  if(typeof value==='number'){need(Number.isFinite(value),'FAILURE_NONFINITE');visitNumber(value,path);return;}
  if(value===null||typeof value==='string'||typeof value==='boolean')return;
  need(value&&typeof value==='object'&&!types.isProxy(value),'FAILURE_DATA');
  const array=Array.isArray(value);
  need(Object.getPrototypeOf(value)===(array?Array.prototype:Object.prototype),'FAILURE_PROTOTYPE');
  need(!active.has(value),'FAILURE_CYCLE');
  const keys=Object.keys(value);
  need(Reflect.ownKeys(value).length===keys.length+(array?1:0),'FAILURE_OWN_KEYS');
  if(array)need(keys.length===value.length&&keys.every((key,i)=>key===String(i)),'FAILURE_DENSE_ARRAY');
  active.add(value);
  for(const key of keys){
   const descriptor=Object.getOwnPropertyDescriptor(value,key);
   need(descriptor&&'value'in descriptor&&descriptor.enumerable,'FAILURE_ACCESSOR');
   if(descriptor.value===undefined){need(!array,'FAILURE_UNDEFINED_ARRAY');continue;}
   walk(descriptor.value,path.concat(key));
  }
  active.delete(value);
 }
 walk(data,[]);
}
export function encodeFiniteFailure(data,wire){
 const negativeZeroPaths=[];let pathBytes=0;
 walkFinite(data,(value,path)=>{
  if(!Object.is(value,-0))return;
  const bytes=wire(path,CAP);need(Buffer.isBuffer(bytes)&&bytes.length<=CAP,'FAILURE_PATH_BOUND');
  pathBytes+=bytes.length;need(pathBytes<=CAP,'FAILURE_PATH_BOUND');negativeZeroPaths.push(path);
 });
 const bytes=wire({format:FORMAT,aliasIdentityRestored:false,negativeZeroPathCount:negativeZeroPaths.length,data,negativeZeroPaths},CAP);
 need(Buffer.isBuffer(bytes)&&bytes.length<=CAP,'FAILURE_TOTAL_BOUND');
 return bytes;
}
export function decodeFiniteFailure(bytes){
 need(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=CAP,'FAILURE_TOTAL_BOUND');
 const envelope=JSON.parse(bytes.toString('utf8'));
 need(envelope&&Object.getPrototypeOf(envelope)===Object.prototype,'FAILURE_FORMAT');
 assert.deepEqual(Object.keys(envelope).sort(),['aliasIdentityRestored','data','format','negativeZeroPathCount','negativeZeroPaths']);
 need(envelope.format===FORMAT&&envelope.aliasIdentityRestored===false,'FAILURE_FORMAT');
 const paths=envelope.negativeZeroPaths;
 need(Array.isArray(paths)&&Number.isSafeInteger(envelope.negativeZeroPathCount)&&envelope.negativeZeroPathCount===paths.length&&paths.length<=NODES,'FAILURE_PATHS');
 walkFinite(envelope.data);
 const seen=new Set();
 for(const path of paths){
  need(Array.isArray(path)&&path.length<=DEPTH&&path.every(key=>typeof key==='string'),'FAILURE_PATH');
  const key=JSON.stringify(path);need(!seen.has(key),'FAILURE_DUPLICATE_PATH');seen.add(key);
  if(path.length===0){need(typeof envelope.data==='number'&&envelope.data===0,'FAILURE_ZERO_LEAF');envelope.data=-0;continue;}
  let parent=envelope.data;
  for(let i=0;i<path.length-1;i++){need(parent&&typeof parent==='object'&&Object.hasOwn(parent,path[i]),'FAILURE_OWN_PATH');parent=parent[path[i]];}
  const leaf=path.at(-1);
  need(parent&&typeof parent==='object'&&Object.hasOwn(parent,leaf),'FAILURE_OWN_PATH');
  const descriptor=Object.getOwnPropertyDescriptor(parent,leaf);
  need(descriptor&&'value'in descriptor&&typeof descriptor.value==='number'&&descriptor.value===0,'FAILURE_ZERO_LEAF');
  Object.defineProperty(parent,leaf,{...descriptor,value:-0});
 }
 return envelope;
}
