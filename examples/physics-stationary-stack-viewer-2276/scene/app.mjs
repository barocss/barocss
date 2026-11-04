import {createRenderer} from './renderer.mjs';
const $=id=>document.getElementById(id),errors=[];
const worker=new Worker('./worker.mjs',{type:'module'}),pending=new Map();
let sequence=0,runEpoch=0,currentModel=null,models=null,renderer=null,running=false,scene='ALIGNED',worlds=0,calls=0,state=null,activeStep=null,resetting=false;
let trace=new Uint8Array(1201*936),frames=0;
function fail(error){const message=String(error?.message??error);errors.push(message);running=false;$('error').hidden=false;$('error').textContent=message;$('status').textContent='오류';$('play').disabled=true;}
worker.onerror=event=>{const error=Error(event.message);for(const job of pending.values())job.reject(error);pending.clear();fail(error);};
worker.onmessage=event=>{const data=event.data,job=pending.get(data.id);if(!job){fail(Error('Unexpected physics reply'));return;}pending.delete(data.id);if(data.error)job.reject(Object.assign(Error(data.error.message),data.error));else job.resolve(data);};
function request(type,fields={}){if(pending.size)throw Error('Only one physics request may be outstanding');const id=++sequence;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});worker.postMessage({id,type,...fields});});}
function words(current){const bytes=new Uint8Array(936),view=new DataView(bytes.buffer);let at=0;
 for(const body of current.bodies)for(const [key,n]of [['positionM',3],['velocityMps',3],['orientationXYZW',4],['angularVelocityRadps',3]])for(let i=0;i<n;i++){view.setFloat64(at,body[key][i],true);at+=8;}
 if(at!==936)throw Error('Nine-body word frame required');return bytes;
}
const hex=bytes=>{const digits='0123456789abcdef',parts=[];for(let offset=0;offset<bytes.length;offset+=65536){let text='';for(let i=offset;i<Math.min(bytes.length,offset+65536);i++)text+=digits[bytes[i]>>4]+digits[bytes[i]&15];parts.push(text);}return parts.join('');};
function retain(){if(frames!==state.stepIndex)throw Error('Noncontiguous accepted frame');trace.set(words(state),frames++*936);}
function present(){renderer.present(state,currentModel);$('clock').textContent=state.timeSeconds.toFixed(3);$('frame').textContent=String(state.stepIndex);$('contacts').textContent='접촉 '+state.contacts.length;
 $('status').textContent=state.stepIndex===1200?'완료':running?'실행 중':'정지';$('step').disabled=running||!!activeStep||resetting||state.stepIndex===1200;$('play').disabled=resetting||state.stepIndex===1200;$('play').textContent=running?'정지':'실행';$('scene').disabled=resetting;$('reset').disabled=resetting;}
async function reset(){
 running=false;runEpoch++;resetting=true;if(state)present();
 try{if(activeStep)await activeStep;const nextScene=$('scene').value,nextModel=structuredClone(models.models[nextScene]);
  const response=await request('reset',{model:nextModel,options:models.options});
  scene=nextScene;currentModel=nextModel;worlds=response.worlds;calls=0;frames=0;trace=new Uint8Array(1201*936);state=response.state;retain();
 }finally{resetting=false;if(state)present();}
}
function performStep(){
 if(activeStep)return activeStep;if(state.stepIndex===1200)return Promise.resolve();
 activeStep=request('step').then(response=>{state=response.state;calls=response.calls;retain();if(state.stepIndex===1200)running=false;present();})
  .finally(()=>{activeStep=null;present();});present();return activeStep;
}
function pump(epoch){if(!running||epoch!==runEpoch)return;performStep().then(()=>{if(running&&epoch===runEpoch)requestAnimationFrame(()=>pump(epoch));}).catch(fail);}
try{
 models=await fetch('/models').then(r=>{if(!r.ok)throw Error('Model loading failed');return r.json();});
 renderer=await createRenderer($('canvas'),fail);await reset();for(const id of ['reset','home'])$(id).disabled=false;
 $('step').onclick=()=>performStep().catch(fail);
 $('play').onclick=()=>{running=!running;const epoch=++runEpoch;present();if(running)pump(epoch);};
 $('reset').onclick=()=>reset().catch(fail);$('scene').onchange=()=>reset().catch(fail);
 $('home').onclick=()=>renderer.home();$('markers').onchange=()=>{renderer.setMarkers($('markers').checked);present();};
 function frame(){try{renderer.draw();}catch(error){fail(error);}requestAnimationFrame(frame);}
 requestAnimationFrame(frame);
 window.stackLab={snapshot(){return {ready:true,scene,worlds,calls,running,busy:pending.size>0||resetting,frames,state:structuredClone(state),words:hex(words(state)),renderer:renderer.snapshot(),errors:[...errors]};},trace(){return hex(trace.subarray(0,frames*936));}};
 document.body.dataset.ready='true';
}catch(error){fail(error);document.body.dataset.ready='failed';}
window.addEventListener('pagehide',()=>worker.terminate(),{once:true});
