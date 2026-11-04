import {createPhysicsWorld} from '@barocss/physics';
import {createPhysicsRecorder} from '@barocss/physics/replay';
import {createScenario,PRESETS,MOVING_ID} from './scenario.mjs';
import {createImpactDisplay} from './display.mjs';
const $=id=>document.getElementById(id),fmt=a=>'['+a.map(v=>v.toFixed(8)).join(', ')+']';
let scenario,world,recorder,display=null,running=false,error=null,disposed=false,previousTime=null,accumulator=0,firstImpact=null;
function fail(e){running=false;error={name:e.name,message:e.message,code:e.code??null};$('notice').textContent=e.message;$('notice').classList.add('error');controls();}
function controls(){const ready=!!display&&!disposed&&!error,full=(recorder?.getState().stepIndex??0)>=512;
 $('play').disabled=!ready||full;$('step').disabled=!ready||full;for(const id of ['reset','preset','home'])$(id).disabled=!display||disposed;
 $('play').textContent=running?'일시정지':'재생';$('status').textContent=error?'오류':full?'기록 한도':running?'실행 중':'일시정지';}
function energy(state){return state.bodies.reduce((sum,b)=>sum+(scenario.model.bodies.find(m=>m.id===b.id).kind==='dynamic'?b.velocityMps.reduce((s,v)=>s+v*v,0):0),0);}
function render(){const state=recorder.getState(),body=state.bodies.find(b=>b.id===MOVING_ID);display?.present(state);
 $('time').textContent=state.timeSeconds.toFixed(6);$('step-count').textContent=state.stepIndex+' / 512 단계';$('contacts').textContent=String(state.contacts.length);
 $('speed').textContent=firstImpact?firstImpact.outgoingVelocityMps[1].toPrecision(12):'—';$('impulse').textContent=firstImpact?firstImpact.normalImpulseNs.toPrecision(12):'—';
 $('energy').textContent=energy(state).toPrecision(12);$('position').textContent=fmt(body.positionM);$('velocity').textContent=fmt(body.velocityMps);controls();}
function reset(id){running=false;previousTime=null;accumulator=0;const next=createScenario(id),nextWorld=createPhysicsWorld(next.model,next.options);let nextRecorder;
 try{nextRecorder=createPhysicsRecorder(nextWorld);display?.configure(next);display?.present(nextRecorder.getState());}catch(e){nextRecorder?.dispose();nextWorld.dispose();throw e;}
 recorder?.dispose();world?.dispose();scenario=next;world=nextWorld;recorder=nextRecorder;error=null;firstImpact=null;
 $('title').textContent=scenario.label;$('description').textContent=scenario.description;$('preset').value=id;$('input-speed').textContent=String(scenario.speed);$('materials').textContent=scenario.bodyE+' / '+scenario.otherE;
 $('notice').classList.remove('error');$('notice').textContent='일시정지 상태입니다. 한 단계로 충돌 후 값을 확인하세요.';render();}
function step(){if(recorder.getState().stepIndex>=512){running=false;return;}const after=recorder.step([]);
 if(after.stepIndex===1){const body=after.bodies.find(b=>b.id===MOVING_ID);firstImpact={outgoingVelocityMps:[...body.velocityMps],normalImpulseNs:after.contacts.reduce((s,c)=>s+c.normalImpulseNs,0),energyJ:energy(after),contacts:structuredClone(after.contacts)};}
 if(after.stepIndex>=512){running=false;$('notice').textContent='기록 한도 512단계에 도달했습니다.';}}
for(const[id,p]of Object.entries(PRESETS)){const o=document.createElement('option');o.value=id;o.textContent=p.label;$('preset').append(o);}
$('step').addEventListener('click',()=>{running=false;previousTime=null;accumulator=0;try{step();render();}catch(e){fail(e);}});
$('play').addEventListener('click',()=>{running=!running;previousTime=null;accumulator=0;controls();});
$('reset').addEventListener('click',()=>{try{reset(scenario.id);}catch(e){fail(e);}});
$('preset').addEventListener('change',()=>{try{reset($('preset').value);}catch(e){fail(e);}});
$('home').addEventListener('click',()=>display?.home());window.addEventListener('resize',()=>display?.resize());
 document.addEventListener('visibilitychange',()=>{if(document.hidden){running=false;previousTime=null;accumulator=0;controls();}});
Object.defineProperty(window,'persistentImpact',{value:Object.freeze({snapshot:()=>structuredClone({state:recorder?.getState()??null,model:scenario?.model??null,recording:recorder?.saveRecording()??null,viewer:display?.getState()??null,lastPresented:display?.lastPresented??null,scenario:scenario??null,firstImpact,run:{running,maxSteps:512,error,disposed}}),readPixels:()=>{if(!display)throw Error('Display not ready');return display.readPixels();}}),writable:false,configurable:false});
function tick(time){if(disposed)return;if(running){if(previousTime!==null)accumulator+=Math.min(.1,(time-previousTime)/1000);previousTime=time;try{let n=0;while(running&&accumulator>=scenario.options.fixedStepSeconds&&n++<12){step();accumulator-=scenario.options.fixedStepSeconds;}render();}catch(e){fail(e);}}requestAnimationFrame(tick);}
try{reset('minimum');display=await createImpactDisplay($('viewer'),{onError:fail});display.configure(scenario);render();requestAnimationFrame(tick);}catch(e){fail(e);}
window.addEventListener('pagehide',()=>{disposed=true;running=false;recorder?.dispose();world?.dispose();display?.dispose();},{once:true});
