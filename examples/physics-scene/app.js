import { createPhysicsWorld } from '../../packages/barocss-physics/src/index.ts';

const dt = 1 / 120;
const start = () => createPhysicsWorld({
  fixedStepSeconds: dt,
  gravityMps2: [0, -9.81, 0],
  bodies: [
    { id: 'part:ball', kind: 'dynamic', shape: { kind: 'sphere', radiusM: 0.16 },
      positionM: [0, 2.2, 0], velocityMps: [0, 0, 0], massKg: 1, restitution: 0.24 },
    { id: 'fixture:box', kind: 'static', shape: { kind: 'box', halfExtentsM: [1.1, 0.2, 0.5] },
      positionM: [0, 0.2, 0], restitution: 0.24 },
  ],
});
const $ = (id) => document.getElementById(id);
const ball = $('ball');
const glint = $('ball-glint');
const label = $('ball-label');
const heightLine = $('height-line');
const flash = $('contact-flash');
let world = start();
let running = true;
let accumulator = 0;
let previousTime = 0;
let flashUntil = 0;
let lastContactStep = -1;

function render(state) {
  const body = state.bodies.find(({ id }) => id === 'part:ball');
  const y = 420 - body.positionM[1] * 150;
  ball.setAttribute('cy', y);
  glint.setAttribute('cy', y - 8);
  label.setAttribute('y', y - 2);
  heightLine.setAttribute('y1', y);
  $('height').textContent = body.positionM[1].toFixed(3);
  $('velocity').textContent = body.velocityMps[1].toFixed(3);
  $('time').textContent = state.timeSeconds.toFixed(3);
  $('step-index').textContent = String(state.stepIndex);
  const contact = state.contacts.find(({ aId, bId }) => aId === 'fixture:box' && bId === 'part:ball');
  document.querySelector('.contact-panel').classList.toggle('active', Boolean(contact));
  $('contact-state').textContent = contact ? '받침과 접촉' : '접촉 없음';
  $('contact-detail').textContent = contact
    ? `fixture:box ↔ part:ball · 충격량 ${contact.impulseNs.toFixed(3)} N·s`
    : '구와 받침 사이에 현재 접촉이 없습니다.';
  if (contact && lastContactStep !== state.stepIndex && contact.impulseNs > 0.2) flashUntil = performance.now() + 450;
  if (contact) lastContactStep = state.stepIndex;
  flash.classList.toggle('active', performance.now() < flashUntil);
  $('run-state').textContent = running ? 'RUNNING' : 'PAUSED';
  $('run-state').classList.toggle('paused', !running);
  $('toggle').textContent = running ? '일시 정지' : '다시 재생';
}
function reset() {
  world.dispose();
  world = start();
  accumulator = 0;
  previousTime = 0;
  flashUntil = 0;
  lastContactStep = -1;
  running = false;
  render(world.getState());
}
function singleStep() {
  running = false;
  if (world.getState().stepIndex < 3600) render(world.step(dt));
  else render(world.getState());
}
function toggle() { running = !running; accumulator = 0; render(world.getState()); }
$('toggle').addEventListener('click', toggle);
$('step').addEventListener('click', singleStep);
$('reset').addEventListener('click', reset);
window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLElement && /^(BUTTON|INPUT|TEXTAREA)$/.test(event.target.tagName)) return;
  if (event.code === 'Space') { event.preventDefault(); toggle(); }
  else if (event.code === 'ArrowRight') { event.preventDefault(); singleStep(); }
  else if (event.key.toLowerCase() === 'r') reset();
});
function frame(now) {
  if (previousTime && running) {
    accumulator += Math.min((now - previousTime) / 1000, 0.05);
    while (accumulator >= dt && running) {
      if (world.getState().stepIndex >= 3600) { running = false; break; }
      world.step(dt);
      accumulator -= dt;
    }
    render(world.getState());
  }
  previousTime = now;
  requestAnimationFrame(frame);
}
render(world.getState());
requestAnimationFrame(frame);
