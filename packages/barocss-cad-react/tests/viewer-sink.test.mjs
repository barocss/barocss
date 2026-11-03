/** Controlled Viewer port only. No GPU or raster correctness claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSource} from './compile.mjs';
function viewer(){const pending=[],loads=[];let disposed=0,controls=0;return {
 pending,loads,get disposed(){return disposed;},get controls(){return controls;},
 attachPointerControls(){return{dispose(){controls++;}};},attachKeyboardControls(){return{dispose(){controls++;}};},
 loadDisplayMeshes(input){loads.push(input);},readPixels(){return new Promise(resolve=>pending.push(resolve));},getState(){return{status:'ready',camera:{},displayMeshes:loads.at(-1)};},dispose(){disposed++;}
};}
const owner=revision=>({hostEpoch:1,declaration:revision,evaluationRevision:revision,fingerprint:String(revision)});
const body={key:'b1',mesh:{positions:new Float64Array([0,0,0]),normals:new Float32Array([0,0,1]),indices:new Uint32Array()}};
test('late frame readback cannot claim a newer mounted native owner',async t=>{
 const {ExistingViewerHost}=await loadSource(t,'src/viewer.ts',{stubViewer:true}),v=viewer(),sink=new ExistingViewerHost(v),a=owner(1),b=owner(2);let current=a;
 const first=sink.show([body],a,()=>current===a);current=b;const second=sink.show([body],b,()=>current===b);
 v.pending[0](new Uint8Array([0,0,0,255]));await first;assert.equal(sink.snapshot().frameOwner,null);assert.equal(sink.snapshot().mountedOwner,b);
 v.pending[1](new Uint8Array([0,0,0,255,255,255,255,255]));await second;assert.equal(sink.snapshot().frameOwner,b);assert.equal(v.loads[1].revision,2);sink.dispose();assert.equal(v.controls,2);assert.equal(v.disposed,1);
});
test('disposal retires pending readback and releases owned controls and Viewer exactly once',async t=>{
 const {ExistingViewerHost}=await loadSource(t,'src/viewer.ts',{stubViewer:true}),v=viewer(),sink=new ExistingViewerHost(v),a=owner(1);
 const pending=sink.show([body],a,()=>true);sink.dispose();sink.dispose();v.pending[0](new Uint8Array([0,0,0,255]));await pending;
 assert.equal(sink.snapshot().frameOwner,null);assert.equal(v.controls,2);assert.equal(v.disposed,1);
});
test('partial control acquisition and throwing cleanup still release every acquired resource',async t=>{
 const {ExistingViewerHost}=await loadSource(t,'src/viewer.ts',{stubViewer:true}),v=viewer();v.attachKeyboardControls=()=>{throw new Error('controlled keyboard attachment failure');};assert.throws(()=>new ExistingViewerHost(v),/controlled keyboard attachment failure/);assert.equal(v.controls,1);assert.equal(v.disposed,1);
 const w=viewer();let second=0;w.attachPointerControls=()=>({dispose(){throw new Error('controlled pointer cleanup failure');}});w.attachKeyboardControls=()=>({dispose(){second++;}});const sink=new ExistingViewerHost(w);assert.throws(()=>sink.dispose(),AggregateError);assert.equal(second,1);assert.equal(w.disposed,1);sink.dispose();
});
