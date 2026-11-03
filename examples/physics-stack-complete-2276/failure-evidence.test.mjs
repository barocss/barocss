// New fixed8 failure-data controls. No solver, provider, reference or campaign call.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from './window.mjs';
import {wire} from '../physics-stack-library-2276/io.mjs';
import {captureFailureWindow,failureWindowMetadata,encodeFiniteFailure,decodeFiniteFailure} from './failure-evidence.mjs';
const CAP=2**21;
const frame=step=>({packet:{scene:'ALIGNED',step,priorBodies:[{positionM:[-0,0,0]}],prepared:{candidateBodies:[{positionM:[0,-0,0]}],diagnostics:{pending:true}}},proof:{sha256:'a'.repeat(64)}});
const encode=data=>encodeFiniteFailure(data,wire),decode=bytes=>decodeFiniteFailure(bytes);
const bits=value=>{const b=Buffer.alloc(8);b.writeDoubleBE(value);return b.toString('hex');};
function advance(window,count){for(let step=1;step<=count;step++){window.hold(step);window.verified(step,{});window.beginArchive(step);window.archived(step);}}

test('01 exact1115 received and1116 missing selection keeps first observed failure',()=>{
 const w=new Window('ALIGNED',1200);advance(w,1114);w.hold(1115);w.hold(1116);const actual=frame(1115);w.slots.get(1115).received=actual;w.phase(1115,'proof');
 w.fail(1116,'producer deadline',Object.assign(Error('synthetic deadline'),{unresolved:true}));const first=w.firstObserved,before=structuredClone(w.failureSummary()),capture=captureFailureWindow(w,1116);
 assert.equal(capture.selectedFrame,actual);assert.equal(capture.selectedStep,1115);assert.equal(capture.selectionReason,'EARLIEST_RECEIVED_UNCOMMITTED');assert.equal(capture.firstCandidateMissing,true);
 assert.deepEqual(capture.availabilityAtCapture,[{step:1115,phase:'proof',returned:true,recordReady:false},{step:1116,phase:'unresolved',returned:false,recordReady:false}]);
 assert.equal(w.firstObserved,first);assert.deepEqual(w.failureSummary(),before);assert.equal(w.contiguous,1114);assert.equal(w.failureSummary().earliestFailingStep,'UNKNOWN');
 const saved=decode(encode({firstObserved:first,lastAccepted:{stepIndex:1114,velocityMps:[-0,0,0]},failureWindow:capture}));
 assert.equal(saved.data.failureWindow.selectedFrame.packet.step,1115);assert.equal(saved.data.failureWindow.availabilityAtCapture[1].returned,false);assert.ok(Object.is(saved.data.lastAccepted.velocityMps[0],-0));assert.ok(Object.is(saved.data.failureWindow.selectedFrame.packet.prepared.candidateBodies[0].positionM[1],-0));
});
test('02 actual failed-slot packet wins; no received packet is explicit null',()=>{
 const w=new Window('ALIGNED',16);w.hold(1);w.hold(2);w.slots.get(1).received=frame(1);const actual=frame(2);w.slots.get(2).received=actual;w.fail(2,'reference',Error('synthetic physical failure'));
 const capture=captureFailureWindow(w,2);assert.equal(capture.selectedFrame,actual);assert.equal(capture.selectionReason,'FIRST_OBSERVED_STEP_PACKET');assert.equal(capture.firstCandidateMissing,false);
 const none=new Window('ALIGNED',16);none.hold(1);none.fail(1,'producer',Object.assign(Error('synthetic missing'),{unresolved:true}));const missing=captureFailureWindow(none,1);assert.equal(missing.selectedFrame,null);assert.equal(missing.selectedStep,null);assert.equal(missing.selectionReason,'NO_RECEIVED_PACKET');assert.equal(missing.firstCandidateMissing,true);
});
test('03 three credits release alias only after archive; captured alias survives drain',()=>{
 const normal=new Window('ALIGNED',16);for(let i=1;i<=3;i++){normal.hold(i);normal.slots.get(i).received=frame(i);}assert.throws(()=>normal.hold(4));
 const slot=normal.slots.get(1);normal.verified(1,{});normal.beginArchive(1);delete slot.received;normal.archived(1);assert.equal(Object.hasOwn(slot,'received'),false);normal.hold(4);assert.equal(normal.slots.size,3);
 const stopped=new Window('ALIGNED',16);for(let i=1;i<=3;i++)stopped.hold(i);const actual=frame(1);stopped.slots.get(1).received=actual;stopped.phase(1,'proof');stopped.fail(3,'later failure',Error('synthetic'));
 const capture=captureFailureWindow(stopped,3);stopped.verified(1,{});stopped.beginArchive(1);delete stopped.slots.get(1).received;stopped.archived(1);
 assert.equal(capture.selectedFrame,actual);assert.equal(capture.availabilityAtCapture[0].phase,'proof');assert.equal(stopped.contiguous,1);assert.throws(()=>stopped.hold(4));
 assert.equal(Object.hasOwn(failureWindowMetadata(capture),'selectedFrame'),false);assert.equal(failureWindowMetadata(capture).availabilityAtCapture[0].returned,true);
 const invalid={slots:new Map(Array.from({length:4},(_,i)=>[i,{step:i,state:'proof'}]))};assert.throws(()=>captureFailureWindow(invalid,1),{code:'FAILURE_CREDIT_BOUND'});assert.equal(invalid.slots.size,4);
});
test('04 reference or archive failure before/after record-ready retains actual packet',()=>{
 for(const archiveFailure of [false,true]){
  const w=new Window('ALIGNED',16);w.hold(1);w.hold(2);const actual=frame(1);w.slots.get(1).received=actual;w.phase(1,'proof');if(archiveFailure){w.verified(1,{record:{step:1}});w.beginArchive(1);}w.fail(1,archiveFailure?'archive':'reference',Error('synthetic'));
  const first=w.firstObserved,capture=captureFailureWindow(w,1);assert.equal(capture.selectedFrame,actual);assert.equal(capture.availabilityAtCapture[0].recordReady,archiveFailure);
  w.slots.get(2).received=frame(2);w.phase(2,'ignored-shadow');assert.equal(capture.availabilityAtCapture[1].returned,false);assert.throws(()=>w.verified(2,{}));assert.equal(w.firstObserved,first);assert.equal(w.contiguous,0);
 }
});
test('05 independent finite IEEE bank and each alias zero occurrence recover exactly',()=>{
 const values=[0,-0,Number.MIN_VALUE,-Number.MIN_VALUE,Number.MAX_VALUE,-Number.MAX_VALUE,1,-1,2**-1022];
 const words=['0000000000000000','8000000000000000','0000000000000001','8000000000000001','7fefffffffffffff','ffefffffffffffff','3ff0000000000000','bff0000000000000','0010000000000000'];
 const shared=Object.freeze({neg:-0,pos:0}),data={lastAccepted:{values},failureData:{left:shared,right:shared}},saved=decode(encode(data));
 assert.deepEqual(saved.data.lastAccepted.values.map(bits),words);assert.deepEqual(saved.negativeZeroPaths,[['lastAccepted','values','1'],['failureData','left','neg'],['failureData','right','neg']]);
 assert.ok(Object.is(saved.data.failureData.left.neg,-0));assert.ok(Object.is(saved.data.failureData.right.neg,-0));assert.ok(Object.is(saved.data.failureData.left.pos,0));assert.notEqual(saved.data.failureData.left,saved.data.failureData.right);assert.equal(saved.aliasIdentityRestored,false);assert.ok(Object.is(shared.neg,-0));
 const root=decode(encode(-0));assert.deepEqual(root.negativeZeroPaths,[[]]);assert.equal(bits(root.data),'8000000000000000');assert.equal(decode(encode(0)).negativeZeroPathCount,0);
});
test('06 structural Unicode and own special keys; forged paths cannot use prototypes',()=>{
 const data=JSON.parse('{"__proto__":0,"constructor":0,"":0,"a/b":0,"~":0,"한😀":0,"\\ud800":0}');for(const key of Object.keys(data))Object.defineProperty(data,key,{value:-0,writable:true,enumerable:true,configurable:true});data.list=[{'0':-0}];data.optional=undefined;
 const bytes=encode(data),saved=decode(bytes);for(const key of Object.keys(data).filter(key=>!['list','optional'].includes(key)))assert.ok(Object.hasOwn(saved.data,key)&&Object.is(saved.data[key],-0));assert.ok(Object.is(saved.data.list[0]['0'],-0));assert.equal(Object.hasOwn(saved.data,'optional'),false);assert.equal(Object.getPrototypeOf(saved.data),Object.prototype);
 const malformed=change=>{const envelope=JSON.parse(encode({zero:-0}).toString('utf8'));change(envelope);return Buffer.from(JSON.stringify(envelope)+'\n');};
 assert.throws(()=>decode(malformed(e=>{e.negativeZeroPaths=[['toString']];})),{code:'FAILURE_OWN_PATH'});
 assert.throws(()=>decode(malformed(e=>{e.data.zero=1;})),{code:'FAILURE_ZERO_LEAF'});
 assert.throws(()=>decode(malformed(e=>{e.negativeZeroPaths.push(['zero']);e.negativeZeroPathCount=2;})),{code:'FAILURE_DUPLICATE_PATH'});
 assert.throws(()=>decode(malformed(e=>{e.negativeZeroPaths=[[0]];})),{code:'FAILURE_PATH'});
});
test('07 exact total2MiB and one byte over; omitted payload metadata stays explicit',()=>{
 const literal='{"format":"STACK_FAILURE_FINITE_JSON_V1","aliasIdentityRestored":false,"negativeZeroPathCount":0,"data":"","negativeZeroPaths":[]}\n';
 const value='x'.repeat(CAP-Buffer.byteLength(literal)),bytes=encode(value);assert.equal(bytes.length,CAP);assert.equal(decode(bytes).data,value);assert.throws(()=>encode(value+'x'));
 const shared={['k'.repeat(1024)]:-0};assert.throws(()=>encode(Array(2048).fill(shared)),{code:'FAILURE_PATH_BOUND'});
 const w=new Window('ALIGNED',16);w.hold(1);w.slots.get(1).received=frame(1);w.fail(1,'reference',Error('synthetic'));const capture=captureFailureWindow(w,1),first=w.firstObserved;
 assert.throws(()=>encode({failureWindow:capture,padding:value}));
 const metadata={status:'FAILURE_EVIDENCE_OMITTED',fullPayloadOmitted:true,selectedFramePersisted:false,firstObserved:first,failureWindow:failureWindowMetadata(capture)},saved=decode(encode(metadata));
 assert.equal(saved.data.fullPayloadOmitted,true);assert.equal(saved.data.selectedFramePersisted,false);assert.equal(saved.data.failureWindow.availabilityAtCapture[0].returned,true);assert.equal(Object.hasOwn(saved.data.failureWindow,'selectedFrame'),false);assert.equal(w.firstObserved,first);
});
test('08 finite plain-data and existing depth/node bounds refuse without getters',()=>{
 for(const value of [NaN,Infinity,-Infinity,1n,undefined,()=>{},[undefined],Object.create(null),Object.create({})])assert.throws(()=>encode(value));
 const cycle={};cycle.self=cycle;assert.throws(()=>encode(cycle),{code:'FAILURE_CYCLE'});
 const sparse=Array(1);assert.throws(()=>encode(sparse),{code:'FAILURE_DENSE_ARRAY'});
 let calls=0;const getter={};Object.defineProperty(getter,'x',{enumerable:true,get(){calls++;return -0;}});assert.throws(()=>encode(getter),{code:'FAILURE_ACCESSOR'});assert.equal(calls,0);
 const proxy=new Proxy({x:-0},{get(){calls++;return 0;}});assert.throws(()=>encode(proxy),{code:'FAILURE_DATA'});assert.equal(calls,0);
 let deep=0;for(let i=0;i<64;i++)deep={next:deep};assert.equal(decode(encode(deep)).negativeZeroPathCount,0);deep={next:deep};assert.throws(()=>encode(deep),{code:'FAILURE_GRAPH_BOUND'});
 let dag=0;for(let i=0;i<18;i++)dag={left:dag,right:dag};assert.throws(()=>encode(dag),{code:'FAILURE_GRAPH_BOUND'});
 assert.throws(()=>decode(Buffer.alloc(CAP+1)),{code:'FAILURE_TOTAL_BOUND'});assert.throws(()=>decode(Buffer.from('{')));
});
