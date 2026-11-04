import { createLabSession } from './session.mjs';
import { DEFAULT_CONFIG, rotate } from './model.mjs';
import { createLabDisplay } from './display.mjs';
import { compareReference } from './compare.mjs';
const $=id=>document.getElementById(id), copy=structuredClone, axes=['x','y','z'];
const reference=await fetch('/reference.json').then(r=>{if(!r.ok)throw new Error('Independent reference could not be loaded');return r.json();});
let session=createLabSession(),display=null,running=false,lastTime=null,accumulator=0,saved=null,pendingImpulse=null,raf=0,comparison=null,busy=false,disposed=false,latestError=null;
const number=id=>{const input=$(id);if(input.value.trim()===''||!Number.isFinite(input.valueAsNumber))throw new TypeError(`${input.getAttribute('aria-label')??id}: 유한한 숫자를 입력하세요.`);return input.valueAsNumber;};
const readVector=name=>axes.map(axis=>number(`${name}-${axis}`));
const writeVector=(name,value)=>axes.forEach((axis,i)=>{$(`${name}-${axis}`).value=String(value[i]);});
const sci=value=>Number.isFinite(value)?value===0?'0':value.toExponential(3):'—';
function notice(message,error=false){$('notice').textContent=message;$('notice').classList.toggle('error',error);}
function report(error){latestError={name:error.name,code:error.code??null,message:error.message};running=false;accumulator=0;lastTime=null;notice(`${error.code?error.code+' · ':''}${error.message} 마지막으로 수락한 상태와 기록을 유지합니다.`,true);updateControls();}
function updateControls(){
  const ready=Boolean(display)&&$('viewer').dataset.drawState==='accepted'&&!disposed;$('play').disabled=!ready||busy||session.horizonReached;$('step').disabled=!ready||busy||session.horizonReached;$('impulse').disabled=!ready||busy||session.horizonReached;
  $('play').textContent=running?'Ⅱ 일시정지':'▶ 재생';$('reset').disabled=!ready||busy;$('apply').disabled=!ready||busy;$('preset').disabled=!ready||busy;$('home').disabled=!ready;
  $('save').disabled=!ready||busy;$('restore').disabled=!ready||busy||!saved;$('compare').disabled=!ready||busy;
  $('play-status').classList.toggle('running',running);$('play-status').classList.toggle('failed',!!latestError);
  $('play-status-text').textContent=session.horizonReached?'기록 한도 도달':running?'실행 중':'일시정지';
}
function visibility(){const shape=$('shape').value;$('box-dimensions').hidden=shape!=='box';$('round-dimensions').hidden=shape==='box';$('half-length-field').hidden=shape!=='capsule';for(const input of $('box-dimensions').querySelectorAll('input'))input.disabled=shape!=='box';$('radius').disabled=shape==='box';$('half-length').disabled=shape!=='capsule';}
function fill(config){
  $('shape').value=config.shape;$('mass').value=config.massKg;$('radius').value=config.radiusM;$('half-length').value=config.halfLengthM;
  writeVector('half',config.halfExtentsM);writeVector('omega',config.angularVelocityRadps);writeVector('torque',config.torqueNm);
  $('torque-enabled').checked=true;$('hz').value=String(config.hz);$('orientation').value=config.orientationXYZW.every((v,i)=>v===[0,0,0,1][i])?'identity':'cyclic';visibility();
}
function configFromForm(){return {...session.config,shape:$('shape').value,massKg:number('mass'),halfExtentsM:readVector('half'),radiusM:number('radius'),halfLengthM:number('half-length'),angularVelocityRadps:readVector('omega'),hz:Number($('hz').value),orientationXYZW:$('orientation').value==='identity'?[0,0,0,1]:[.5,.5,.5,.5],torqueNm:$('torque-enabled').checked?readVector('torque'):[0,0,0]};}
function torque(){return $('torque-enabled').checked?readVector('torque'):[0,0,0];}
function describe(title){
  $('scene-title').textContent=title??({box:'상자 회전',sphere:'구 회전',capsule:'캡슐 회전'}[session.config.shape]);
  $('scene-description').textContent=session.config.shape==='capsule'?'균일 밀도 캡슐 · 중심 축은 로컬 Y':'질량·관성·외력으로 계산하는 강체 회전';
}
function stop(){running=false;lastTime=null;accumulator=0;updateControls();}
function drawAxes(){
  if(!display)return;const camera=display.getState().camera,b=body();if(!camera||!b)return;
  const sub=(a,b)=>a.map((v,i)=>v-b[i]),norm=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const back=norm(sub(camera.eye,camera.target)),right=norm(cross(camera.up,back)),up=cross(back,right),colors=['#c47c54','#658b58','#527cb1'];
  const line=[];for(let i=0;i<3;i++){const axis=[0,0,0];axis[i]=1;const v=rotate(b.orientationXYZW,axis),x=54+dot(v,right)*31,y=54-dot(v,up)*31;line.push(`<line x1="54" y1="54" x2="${x}" y2="${y}" stroke="${colors[i]}" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="3.3" fill="${colors[i]}"/><text x="${x+7}" y="${y+3}" font-size="9" fill="${colors[i]}" font-family="monospace">${axes[i].toUpperCase()}</text>`);}line.push('<circle cx="54" cy="54" r="2.5" fill="#9da694"/>');$('axis-lines').innerHTML=line.join('');
}
const body=()=>session.state.bodies[0];
function render({present=true}={}){
  const state=session.state,d=session.diagnostics,b=state.bodies[0];if(present&&display)display.present(state);
  $('time').textContent=state.timeSeconds.toFixed(3);$('step-count').textContent=`${state.stepIndex} / ${session.horizon} 단계`;
  $('energy').textContent=sci(d.energyJ);$('momentum-error').textContent=sci(d.angularMomentumErrorNms);$('energy-error').textContent=sci(d.energyResidualJ);
  $('norm-error').textContent=sci(Math.abs(b.orientationXYZW.reduce((s,x)=>s+x*x,0)-1));$('omega-value').textContent=`[ ${b.angularVelocityRadps.map(x=>x.toFixed(5)).join(', ')} ]`;
  const forced=d.energyReferenceKind.startsWith('approximate');$('energy-error-label').textContent=forced?'일–에너지 잔차 · 근사':'에너지 잔차';
  $('work-note').textContent=forced?'토크 일: 사다리꼴 근사 · 정확도 판정 아님':d.impulseEnergyJ!==0?'초기 에너지 + 각충격량이 한 일과 비교':'자유 회전: 초기 에너지와 비교';
  updateControls();drawAxes();
}
function advance(explicitImpulse){
  const impulse=explicitImpulse??pendingImpulse;const state=session.step({...(impulse?{angularImpulseNms:impulse}:{}),torqueNm:torque()});
  pendingImpulse=null;latestError=null;
  if(session.horizonReached){stop();notice('기록 한도 512단계에 도달했습니다. 기록을 저장하거나 초기화할 수 있습니다.');}
  return state;
}
function useConfig(config,{title,preset='custom',impulse=null}={}){
  stop();const old=session,next=createLabSession(config);
  try{display.configure(next.config);display.present(next.state);}catch(error){next.dispose();throw error;}
  session=next;old.dispose();pendingImpulse=impulse?copy(impulse):null;latestError=null;fill(session.config);$('preset').value=preset;describe(title);render({present:false});
  notice(impulse?'초기화했습니다. 첫 단계에서 기준 각충격량을 한 번 적용하고, 토크를 매 단계 적용합니다.':'초기화했습니다. 재생하거나 한 단계씩 실행하세요.');
}
$('shape').addEventListener('change',visibility);
$('preset').addEventListener('change',()=>{try{
  const preset=$('preset').value;
  if(preset==='torque'){useConfig({...DEFAULT_CONFIG,...reference.config},{title:'토크와 각충격량',preset,impulse:reference.impulseNms});writeVector('impulse',reference.impulseNms);}
  else if(preset==='capsule')useConfig({...DEFAULT_CONFIG,shape:'capsule',massKg:3.2,radiusM:.12,halfLengthM:.27},{title:'캡슐 자유 회전',preset});
  else if(preset==='symmetric')useConfig({...DEFAULT_CONFIG,massKg:2.7,halfExtentsM:[.23,.11,.11]},{title:'축대칭 자유 회전',preset});
  else useConfig(DEFAULT_CONFIG,{title:'자유 회전',preset});
}catch(error){report(error);}});
$('config-form').addEventListener('submit',event=>{event.preventDefault();try{useConfig(configFromForm(),{title:'사용자 설정'});}catch(error){report(error);}});
$('play').addEventListener('click',()=>{if(running){stop();notice('일시정지했습니다.');}else{running=true;latestError=null;lastTime=null;accumulator=0;notice('고정 시간 간격으로 실행 중입니다.');updateControls();}});
$('step').addEventListener('click',()=>{stop();try{advance();render();notice(session.horizonReached?'기록 한도에 도달했습니다.':'한 단계를 수락했습니다.');}catch(error){report(error);}});
$('impulse').addEventListener('click',()=>{stop();try{advance(readVector('impulse'));render();notice('각충격량을 한 번 적용하고 한 단계를 수락했습니다.');}catch(error){report(error);}});
$('reset').addEventListener('click',()=>{try{const impulse=$('preset').value==='torque'?reference.impulseNms:null;useConfig(session.config,{title:$('scene-title').textContent,preset:$('preset').value,impulse});}catch(error){report(error);}});
$('home').addEventListener('click',()=>{display.home();drawAxes();});
$('save').addEventListener('click',()=>{try{saved={packet:session.save(),controls:{torque:readVector('torque'),enabled:$('torque-enabled').checked,impulse:readVector('impulse'),pendingImpulse:copy(pendingImpulse),title:$('scene-title').textContent,preset:$('preset').value}};$('saved-label').textContent=`${session.state.stepIndex}단계 저장`;notice(`${session.state.stepIndex}단계의 상태와 명령 기록을 저장했습니다.`);updateControls();}catch(error){report(error);}});
$('restore').addEventListener('click',()=>{stop();let candidate;try{
  candidate=createLabSession(saved.packet.config);candidate.restore(saved.packet);display.configure(candidate.config);display.present(candidate.state);
  const old=session;session=candidate;candidate=null;old.dispose();pendingImpulse=copy(saved.controls.pendingImpulse);latestError=null;fill(session.config);writeVector('torque',saved.controls.torque);writeVector('impulse',saved.controls.impulse);$('torque-enabled').checked=saved.controls.enabled;$('preset').value=saved.controls.preset;describe(saved.controls.title);render({present:false});notice(`${session.state.stepIndex}단계로 복원했습니다. 같은 상태에서 계속 실행할 수 있습니다.`);
}catch(error){candidate?.dispose();report(error);}});
function plot(results){
  const width=680,height=190,left=48,top=20,plotW=width-left-15,plotH=height-top-30,colors=['#255aeb','#6f8d6d','#b89b75'];
  const pieces=[`<text x="${left}" y="11" fill="#8b9582" font-size="9">자세 행렬 오차 · log scale</text>`];
  for(const power of [-11,-13,-15,-17]){const y=top+(-11-power)/6*plotH;pieces.push(`<line x1="${left}" y1="${y}" x2="${left+plotW}" y2="${y}" stroke="#e0e5d9" stroke-dasharray="${power===-11?'3 3':'0'}"/><text x="${left-8}" y="${y+3}" text-anchor="end" font-size="9" fill="#94a087">1e${power}</text>`);}
  for(let index=0;index<results.length;index++){
    const row=results[index],points=row.matched.map(p=>[left+p.timeSeconds/.1*plotW,top+(-11-Math.log10(Math.max(1e-17,p.rotationError)))/6*plotH]);
    pieces.push(`<polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${colors[index]}" stroke-width="1.5"/>`);
    for(const p of points)pieces.push(`<circle cx="${p[0]}" cy="${p[1]}" r="2.8" fill="${colors[index]}"/>`);
    pieces.push(`<text x="${left+index*140}" y="${height-4}" fill="${colors[index]}" font-size="10">● 1/${row.hz} s</text>`);
  }pieces.push(`<text x="${left+plotW}" y="${height-4}" fill="#94a087" font-size="9" text-anchor="end">0.1 s</text>`);$('error-plot').innerHTML=pieces.join('');
}
$('compare').addEventListener('click',async()=>{stop();busy=true;updateControls();$('compare').textContent='비교 중…';try{
  comparison=await compareReference(reference);$('comparison-rows').replaceChildren();
  for(const row of comparison.results){const tr=document.createElement('tr');for(const [i,value]of [`1/${row.hz} s`,sci(row.maxRotationError),sci(row.maxOmegaError),sci(row.maxWorkResidualJ),row.pass?'통과':'실패'].entries()){const td=document.createElement('td');td.textContent=value;if(i===4)td.className=row.pass?'result-pass':'result-fail';tr.append(td);}$('comparison-rows').append(tr);}
  plot(comparison.results);$('comparison-note').textContent=comparison.pass?'고정 사례의 여섯 시점에서 기존 오차 기준을 통과했습니다. 모든 오차가 1e-11 아래라 수렴 차수는 판정하지 않습니다. 장시간 위상 정확도는 미검증입니다.':'고정 사례가 기존 오차 기준을 넘었습니다. 수치 결과와 실패를 보존해야 합니다.';
  notice(comparison.pass?'세 시간 간격 비교를 마쳤습니다. 현재 실험의 상태는 유지했습니다.':'독립 기준 비교가 실패했습니다.',!comparison.pass);
}catch(error){report(error);}finally{busy=false;$('compare').textContent='세 시간 간격 비교 ↗';updateControls();}});
function tick(time){
  if(disposed)return;
  if(running&&display&&!busy){
    if(lastTime!==null)accumulator+=Math.min(.125,(time-lastTime)/1000)*Number($('speed').value);
    let count=0;try{const dt=1/session.config.hz;while(accumulator>=dt&&count<8&&running){advance();accumulator-=dt;count++;}if(count)render();}catch(error){report(error);}
    lastTime=time;
  }else lastTime=null;
  drawAxes();raf=requestAnimationFrame(tick);
}
function dispose(){if(disposed)return;disposed=true;running=false;cancelAnimationFrame(raf);resizeObserver?.disconnect();display?.dispose();session.dispose();document.documentElement.dataset.labState='disposed';}
let resizeObserver;
fill(session.config);describe('자유 회전');updateControls();
try{
  display=await createLabDisplay($('viewer'),{onError:report});display.configure(session.config);render();$('gpu-message').hidden=true;
  resizeObserver=new ResizeObserver(()=>{try{display.resize();drawAxes();}catch(error){report(error);}});resizeObserver.observe($('viewport'));
  notice('준비됐습니다. 재생하거나 한 단계씩 실행하세요.');document.documentElement.dataset.labState='ready';raf=requestAnimationFrame(tick);
}catch(error){$('gpu-message').textContent=`WebGPU 화면을 시작할 수 없습니다. ${error.message}`;document.documentElement.dataset.labState='failed';report(error);}
window.addEventListener('pagehide',dispose,{once:true});
// Read-only observations for browser verification. Every mutation uses visible UI handlers.
Object.defineProperty(window,'physicsLab',{value:Object.freeze({
  snapshot:()=>({state:session.state,model:session.model,config:session.config,recording:session.recording,diagnostics:session.diagnostics,running,saved:saved?{stepIndex:saved.packet.recording.finalState.stepIndex}:null,lastError:copy(latestError),viewer:display?.getState(),presented:display?.lastPresented,comparison:copy(comparison)}),
  readPixels:()=>display.readPixels(),dispose,
}),writable:false,configurable:false});
