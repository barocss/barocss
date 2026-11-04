import {createPhysicsWorld} from '/physics/index.js';
import {createRenderer} from './renderer.mjs';
const $=id=>document.getElementById(id),errors=[];
let world=null,currentModel=null,models=null,renderer=null,running=false,scene='ALIGNED',worlds=0,calls=0,state=null,last=0,accumulator=0;
let trace=new Uint8Array(1201*936),frames=0;
function fail(error){const message=String(error?.message??error);errors.push(message);running=false;$('error').hidden=false;$('error').textContent=message;$('status').textContent='오류';$('play').disabled=true;}
function words(current){const bytes=new Uint8Array(936),view=new DataView(bytes.buffer);let at=0;
 for(const body of current.bodies)for(const [key,n]of [['positionM',3],['velocityMps',3],['orientationXYZW',4],['angularVelocityRadps',3]])for(let i=0;i<n;i++){view.setFloat64(at,body[key][i],true);at+=8;}
 if(at!==936)throw Error('Nine-body word frame required');return bytes;
}
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
function retain(){trace.set(words(state),frames++*936);}
function present(){renderer.present(state,currentModel);$('clock').textContent=state.timeSeconds.toFixed(3);$('frame').textContent=String(state.stepIndex);$('contacts').textContent='접촉 '+state.contacts.length;
 $('status').textContent=state.stepIndex===1200?'완료':running?'실행 중':'정지';$('step').disabled=running||state.stepIndex===1200;$('play').disabled=state.stepIndex===1200;$('play').textContent=running?'정지':'실행';}
function reset(){running=false;last=0;accumulator=0;world?.dispose();currentModel=structuredClone(models.models[scene]);world=createPhysicsWorld(currentModel,models.options);worlds++;calls=0;frames=0;trace=new Uint8Array(1201*936);state=world.getState();retain();present();}
function step(){if(state.stepIndex>=1200)return;state=world.step([]);calls++;retain();if(state.stepIndex===1200)running=false;}
try{
 models=await fetch('/models').then(r=>{if(!r.ok)throw Error('Model loading failed');return r.json();});
 renderer=await createRenderer($('canvas'),fail);reset();for(const id of ['step','play','reset','home'])$(id).disabled=false;
 $('step').onclick=()=>{try{step();present();}catch(error){fail(error);}};
 $('play').onclick=()=>{running=!running;last=0;accumulator=0;present();};
 $('reset').onclick=()=>{try{reset();}catch(error){fail(error);}};
 $('scene').onchange=()=>{scene=$('scene').value;try{reset();}catch(error){fail(error);}};
 $('home').onclick=()=>renderer.home();$('markers').onchange=()=>{renderer.setMarkers($('markers').checked);present();};
 function frame(t){try{if(running){if(last)accumulator+=Math.min(.1,(t-last)/1000);while(accumulator>=1/120&&running){step();accumulator-=1/120;}present();}last=t;renderer.draw();}catch(error){fail(error);}requestAnimationFrame(frame);}
 requestAnimationFrame(frame);
 window.stackLab={snapshot(){return {ready:true,scene,worlds,calls,running,frames,state:world.getState(),words:hex(words(state)),renderer:renderer.snapshot(),errors:[...errors]};},trace(){return hex(trace.subarray(0,frames*936));}};
 document.body.dataset.ready='true';
}catch(error){fail(error);document.body.dataset.ready='failed';}
