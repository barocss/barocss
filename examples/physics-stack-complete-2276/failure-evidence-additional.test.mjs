// Fixed additional-slot regressions; no physics/provider/reference calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from './window.mjs';
import {wire} from '../physics-stack-library-2276/io.mjs';
import {captureFailureWindow,failureWindowMetadata,encodeFiniteFailure,decodeFiniteFailure} from './failure-evidence.mjs';
const encode=data=>encodeFiniteFailure(data,wire);
const frame=step=>({packet:{step,prior:[-0,0],prepared:{candidate:[0,-0]}}});
function race(){
 const w=new Window('ALIGNED',1200);
 for(let i=1;i<=1152;i++){w.hold(i);w.verified(i,{});w.beginArchive(i);w.archived(i);}
 for(let i=1153;i<=1155;i++)w.hold(i);
 const selected=frame(1153),other=frame(1154);
 w.slots.get(1153).received=selected;w.verified(1153,{});w.beginArchive(1153);
 w.slots.get(1154).received=other;w.phase(1154,'proof');
 w.fail(1155,'producer/structured-clone',Object.assign(Error('synthetic deadline'),{unresolved:true}));
 return {w,selected,other,capture:captureFailureWindow(w,1155)};
}
test('additional01 full03 race keeps other received alias after selected archive commit',()=>{
 const {w,selected,other,capture}=race(),first=w.firstObserved;
 assert.equal(capture.selectedStep,1153);assert.equal(capture.selectedFrame,selected);
 assert.equal(capture.selectionReason,'EARLIEST_RECEIVED_UNCOMMITTED');assert.equal(capture.firstCandidateMissing,true);
 assert.deepEqual(capture.additionalReceivedStepsAtCapture,[1154]);assert.equal(capture.additionalReceivedFrames[0].frame,other);
 delete w.slots.get(1153).received;w.archived(1153);delete w.slots.get(1154).received;
 assert.equal(w.contiguous,1153);assert.equal(w.firstObserved,first);assert.equal(w.failureSummary().earliestFailingStep,'UNKNOWN');
 assert.equal(capture.selectedFrame,selected);assert.equal(capture.additionalReceivedFrames[0].frame,other);
 const saved=decodeFiniteFailure(encode({failureWindow:capture})).data.failureWindow;
 assert.equal(saved.selectedFrame.packet.step,1153);assert.equal(saved.additionalReceivedFrames[0].frame.packet.step,1154);
 for(const f of [saved.selectedFrame,saved.additionalReceivedFrames[0].frame]){assert.ok(Object.is(f.packet.prior[0],-0));assert.ok(Object.is(f.packet.prepared.candidate[1],-0));}
 assert.ok(Object.is(selected.packet.prior[0],-0));assert.ok(Object.is(other.packet.prepared.candidate[1],-0));
 assert.equal(capture.availabilityAtCapture[2].returned,false);
 const metadata=failureWindowMetadata(capture);assert.equal(Object.hasOwn(metadata,'selectedFrame'),false);assert.equal(Object.hasOwn(metadata,'additionalReceivedFrames'),false);assert.deepEqual(metadata.additionalReceivedStepsAtCapture,[1154]);
});
test('additional02 at most three original aliases, never a fourth credit',()=>{
 const w=new Window('ALIGNED',16),frames=[frame(1),frame(2),frame(3)];
 for(let i=1;i<=3;i++){w.hold(i);w.slots.get(i).received=frames[i-1];}
 assert.throws(()=>w.hold(4));w.fail(2,'reference',Error('synthetic'));
 const c=captureFailureWindow(w,2);assert.equal(c.selectedFrame,frames[1]);assert.deepEqual(c.additionalReceivedStepsAtCapture,[1,3]);assert.equal(c.additionalReceivedFrames.length,2);
 assert.equal(c.additionalReceivedFrames[0].frame,frames[0]);assert.equal(c.additionalReceivedFrames[1].frame,frames[2]);
 const invalid={slots:new Map(Array.from({length:4},(_,i)=>[i,{step:i,received:frame(i)}]))};
 assert.throws(()=>captureFailureWindow(invalid,1),{code:'FAILURE_CREDIT_BOUND'});
});
test('additional03 oversized combined envelope falls back to graph-free capture metadata',()=>{
 const {capture,other}=race();other.packet.padding='x'.repeat(2**21);
 assert.throws(()=>encode({failureWindow:capture}));
 const metadata={status:'FAILURE_EVIDENCE_OMITTED',fullPayloadOmitted:true,selectedFramePersisted:false,additionalReceivedStepsPersisted:[],failureWindow:failureWindowMetadata(capture)};
 const saved=decodeFiniteFailure(encode(metadata)).data;
 assert.equal(saved.selectedFramePersisted,false);assert.deepEqual(saved.additionalReceivedStepsPersisted,[]);assert.deepEqual(saved.failureWindow.additionalReceivedStepsAtCapture,[1154]);
 assert.equal(Object.hasOwn(saved.failureWindow,'selectedFrame'),false);assert.equal(Object.hasOwn(saved.failureWindow,'additionalReceivedFrames'),false);
 assert.equal(JSON.stringify(saved).includes('padding'),false);assert.equal(JSON.stringify(saved).includes('prepared'),false);
});
