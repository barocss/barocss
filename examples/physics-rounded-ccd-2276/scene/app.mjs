import { createPhysicsWorld } from '@barocss/physics';
import { createPhysicsRecorder } from '@barocss/physics/replay';
import { createScenario, PRESETS, BALL_ID } from './scenario.mjs';
import { createCcdDisplay } from './display.mjs';

const $ = id => document.getElementById(id);
const format = values => `[${values.map(value => value.toFixed(8)).join(', ')}]`;
let scenario, world, recorder, display = null, running = false, error = null, firstHit = null, firstResult = null, previousTime = null, accumulator = 0, disposed = false;
function rotate(q, v) {
  const [x,y,z,w] = q, [a,b,c] = v, t = [2*(y*c-z*b),2*(z*a-x*c),2*(x*b-y*a)];
  return [a+w*t[0]+y*t[2]-z*t[1],b+w*t[1]+z*t[0]-x*t[2],c+w*t[2]+x*t[1]-y*t[0]];
}
function hitMeasurement(before, hit) {
  const ball = before.bodies.find(body => body.id === BALL_ID), dt = scenario.options.fixedStepSeconds;
  const centerM = ball.positionM.map((value, i) => value + ball.velocityMps[i] * dt * hit.toiFraction);
  const q = scenario.orientationXYZW;
  const local = rotate([-q[0],-q[1],-q[2],q[3]], centerM.map((value, i) => value-scenario.boxPositionM[i]));
  const closest = local.map((value,i) => Math.max(-scenario.halfExtentsM[i],Math.min(scenario.halfExtentsM[i],value)));
  return { ...structuredClone(hit), stepIndex: before.stepIndex+1, timeSeconds: before.timeSeconds+dt*hit.toiFraction, centerM,
    centerToBoxDistanceM: Math.hypot(...local.map((value,i) => value-closest[i])), measurementKind: 'unbiased pre-impact center from accepted start and public TOI; model-space closest-point distance' };
}
function drawNormal() {
  const overlay=$('contact-overlay');
  if(!firstHit||!display){overlay.replaceChildren();overlay.dataset.hasHit='false';$('normal-note').hidden=true;return;}
  const camera=display.getState().camera,rect=$('viewer').getBoundingClientRect();
  const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const back=norm(sub(camera.eye,camera.target)),right=norm(cross(camera.up,back)),up=cross(back,right),f=1/Math.tan(camera.fovY*Math.PI/360),aspect=rect.width/rect.height;
  const project=p=>{const v=sub(p,camera.eye),depth=-dot(v,back);return[rect.width*(1+f*dot(v,right)/(aspect*depth))/2,rect.height*(1-f*dot(v,up)/depth)/2];};
  const n=firstHit.normalFixtureToBody,point=firstHit.centerM.map((v,i)=>v-n[i]*scenario.radiusM),end=point.map((v,i)=>v+n[i]*scenario.radiusM*1.7),a=project(point),b=project(end);
  overlay.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);overlay.dataset.hasHit='true';overlay.dataset.worldPoint=JSON.stringify(point);overlay.dataset.worldEnd=JSON.stringify(end);$('normal-note').hidden=false;
  overlay.innerHTML=`<defs><marker id="normal-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#335831"/></marker></defs><circle cx="${a[0]}" cy="${a[1]}" r="4" fill="#fbfcf6" stroke="#335831" stroke-width="1.5"/><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#335831" stroke-width="2" marker-end="url(#normal-arrow)"/><text x="${b[0]+5}" y="${b[1]-5}" font-size="12" fill="#335831">n</text>`;
}
function controls() {
  const ready = !!display && !disposed && !error, full = recorder?.getState().stepIndex >= 512;
  $('play').disabled = !ready || full; $('step').disabled = !ready || full;
  $('reset').disabled = !display || disposed; $('preset').disabled = !display || disposed; $('home').disabled = !display || disposed;
  $('play').textContent = running ? '일시정지' : '재생';
  $('status').textContent = error ? '오류' : full ? '기록 한도' : running ? '실행 중' : '일시정지';
}
function fail(failure) { error = { name: failure.name, message: failure.message, code: failure.code ?? null }; running = false; $('notice').textContent = failure.message; $('notice').classList.add('error'); controls(); }
function render() {
  const state = recorder.getState(), ball = state.bodies.find(body => body.id === BALL_ID);
  display?.present(state);
  $('time').textContent = state.timeSeconds.toFixed(6); $('step-count').textContent = `${state.stepIndex} / 512 단계`;
  $('result').textContent = firstResult ?? '미실행'; $('contacts').textContent = String(state.contacts.length);
  $('position').textContent = format(ball.positionM);
  $('toi').textContent = firstHit ? firstHit.toiFraction.toFixed(10) : '—';
  $('hit-time').textContent = firstHit ? firstHit.timeSeconds.toFixed(10) : '—';
  $('normal').textContent = firstHit ? format(firstHit.normalFixtureToBody) : '—';
  $('distance').textContent = firstHit ? firstHit.centerToBoxDistanceM.toFixed(10) : '—'; controls(); drawNormal();
}
function reset(id) {
  running = false; previousTime = null; accumulator = 0;
  const next = createScenario(id), nextWorld = createPhysicsWorld(next.model,next.options);
  let nextRecorder;
  try { nextRecorder = createPhysicsRecorder(nextWorld); display?.configure(next); display?.present(nextRecorder.getState()); }
  catch (failure) { nextRecorder?.dispose(); nextWorld.dispose(); throw failure; }
  recorder?.dispose(); world?.dispose(); scenario = next; world = nextWorld; recorder = nextRecorder; error = null; firstHit = null; firstResult = null;
  $('title').textContent = scenario.label; $('description').textContent = scenario.description; $('preset').value = id;
  $('radius').textContent = String(scenario.radiusM); $('half').textContent = format(scenario.halfExtentsM); $('velocity').textContent = format(scenario.velocityMps); $('orientation').textContent = format(scenario.orientationXYZW);
  $('notice').classList.remove('error'); $('notice').textContent = '일시정지 상태입니다. 한 단계에서 충돌 경계를 확인하세요.'; render();
}
function step() {
  if (recorder.getState().stepIndex >= 512) { running = false; return; }
  const before = recorder.getState(), after = recorder.step([]);
  if (after.stepIndex === 1) firstResult = after.ccdHits.length ? '충돌 (HIT)' : scenario.expectedClass==='INITIAL_DISCRETE_OWNED'?'초기 접촉 · 이산 경로':'통과 (MISS)';
  if (!firstHit && after.ccdHits.length) firstHit = hitMeasurement(before,after.ccdHits[0]);
  if (after.stepIndex >= 512) { running = false; $('notice').textContent = '기록 한도 512단계에 도달했습니다.'; }
}
for (const [id,preset] of Object.entries(PRESETS)) { const option = document.createElement('option'); option.value = id; option.textContent = preset.label; $('preset').append(option); }
$('step').addEventListener('click', () => { running = false; previousTime = null; accumulator = 0; try { step(); render(); } catch (failure) { fail(failure); } });
$('play').addEventListener('click', () => { running = !running; previousTime = null; accumulator = 0; controls(); });
$('reset').addEventListener('click', () => { try { reset(scenario.id); } catch (failure) { fail(failure); } });
$('preset').addEventListener('change', () => { try { reset($('preset').value); } catch (failure) { fail(failure); } });
$('home').addEventListener('click', () => { display?.home(); drawNormal(); });
window.addEventListener('resize', () => { display?.resize(); drawNormal(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { running = false; previousTime = null; accumulator = 0; controls(); } });
Object.defineProperty(window, 'roundedCcd', { value: Object.freeze({
  snapshot: () => structuredClone({ state: recorder?.getState() ?? null, model: scenario?.model ?? null, recording: recorder?.saveRecording() ?? null,
    viewer: display?.getState() ?? null, lastPresented: display?.lastPresented ?? null, scenario: scenario ?? null,
    run: { running, maxSteps: 512, firstHit, firstResult, error, disposed }, firstHit }),
  readPixels: () => { if (!display) throw new Error('Display is not ready'); return display.readPixels(); },
}), writable: false, configurable: false });
function tick(time) {
  if (disposed) return;
  if (running) {
    if (previousTime !== null) accumulator += Math.min(.1,(time-previousTime)/1000);
    previousTime = time;
    try { let count = 0; while (running && accumulator >= scenario.options.fixedStepSeconds && count++ < 6) { step(); accumulator -= scenario.options.fixedStepSeconds; } render(); } catch (failure) { fail(failure); }
  }
  requestAnimationFrame(tick);
}
try {
  reset('corner'); display = await createCcdDisplay($('viewer'), { onError: fail }); display.configure(scenario); render();
  for(const name of ['pointermove','wheel']) $('viewer').addEventListener(name,()=>requestAnimationFrame(drawNormal),{passive:true});
  requestAnimationFrame(tick);
} catch (failure) { fail(failure); }
window.addEventListener('pagehide', () => { disposed = true; running = false; recorder?.dispose(); world?.dispose(); display?.dispose(); }, { once: true });
