import test from 'node:test';
import assert from 'node:assert/strict';
import { orbitCamera, defaultOrbitCamera, bindMouseOrbit } from './orbit.mjs';
const radius=c=>Math.hypot(...c.eye.map((value,index)=>value-c.target[index]));
test('mouse orbit preserves target, radius, up, optics and owned camera data',()=>{
 const original=structuredClone(defaultOrbitCamera),turned=orbitCamera(original,128,0,512,384);
 assert(Math.abs(turned.eye[0]+6)<1e-10&&Math.abs(turned.eye[2])<1e-10);
 for(const key of ['target','up','fovYDegrees','near','far'])assert.deepEqual(turned[key],original[key]);
 assert(Math.abs(radius(turned)-6)<1e-10);assert.deepEqual(original,defaultOrbitCamera);
 const raised=orbitCamera(original,0,-96,512,384);assert(raised.eye[1]>0);
 for(const dy of [-1e6,1e6]){const bounded=orbitCamera(original,0,dy,512,384);assert(Math.abs(bounded.eye[2])>0.1);assert(Math.abs(radius(bounded)-6)<1e-9);}
 const rolled={...original,target:[2,3,4],eye:[2,3,10],up:[1,0,0]};assert(Math.abs(radius(orbitCamera(rolled,100,80,512,384))-6)<1e-9);
 assert.throws(()=>orbitCamera(original,NaN,0,512,384));assert.throws(()=>orbitCamera(original,1,0,0,384));
});
test('pointer capture orbit updates only accepted views and cancels cleanly',()=>{
 const listeners=new Map(),windowListeners=new Map(),classes=new Set();let captured;
 const canvas={ownerDocument:{defaultView:{addEventListener:(k,v)=>windowListeners.set(k,v),removeEventListener:k=>windowListeners.delete(k)}},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)},getBoundingClientRect:()=>({width:512,height:384}),addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k),setPointerCapture:id=>captured=id,hasPointerCapture:id=>captured===id,releasePointerCapture:()=>captured=undefined};
 let accepted={options:{},viewRevision:1},available=true,calls=0,reject=false;
 const host={get available(){return available;},snapshot:()=>structuredClone(accepted),setCamera(camera){calls++;if(reject)return{ok:false};accepted={options:{camera},viewRevision:accepted.viewRevision+1};return{ok:true};}};
 const orbit=bindMouseOrbit(canvas,host),event=(changes={})=>({pointerId:1,pointerType:'mouse',isPrimary:true,button:0,buttons:1,clientX:10,clientY:10,preventDefault(){},...changes});
 for(const changes of [{button:2},{pointerType:'touch'},{isPrimary:false}])listeners.get('pointerdown')(event(changes));assert.equal(captured,undefined);
 listeners.get('pointerdown')(event());assert.equal(captured,1);listeners.get('pointermove')(event({clientX:138}));assert.equal(calls,1);assert.equal(accepted.viewRevision,2);
 listeners.get('pointerup')(event());assert.equal(captured,undefined);assert(!classes.has('is-dragging'));listeners.get('pointermove')(event({clientX:150}));assert.equal(calls,1);
 listeners.get('pointerdown')(event());accepted.viewRevision++;listeners.get('pointermove')(event({clientX:100}));assert.equal(calls,1);assert.equal(captured,undefined);
 listeners.get('pointerdown')(event());listeners.get('pointermove')(event({buttons:0,clientX:100}));assert.equal(captured,undefined);assert.equal(calls,1);
 listeners.get('pointerdown')(event());windowListeners.get('blur')();assert.equal(captured,undefined);
 listeners.get('pointerdown')(event());reject=true;const saved=structuredClone(accepted);listeners.get('pointermove')(event({clientX:100}));assert.deepEqual(accepted,saved);assert.equal(captured,undefined);
 listeners.get('pointerdown')(event());available=false;listeners.get('webglcontextlost')();assert.equal(captured,undefined);orbit.dispose();orbit.dispose();assert.equal(listeners.size,0);assert.equal(windowListeners.size,0);
});
