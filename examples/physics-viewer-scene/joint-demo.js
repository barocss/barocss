import { createPhysicsWorld } from '../../packages/barocss-physics/dist/index.js';
import { createViewer } from '../../packages/barocss-viewer/dist/index.js';

const DT = 1 / 120;
const BODY_IDS = ['part:a', 'part:b'];
const $ = (id) => document.getElementById(id);
const viewer = createViewer($('viewer'), { mmToSceneUnit: 0.001,
  background: [0.035, 0.065, 0.105] });
const source = await (await fetch('/two-surfaces.barocad')).text();
viewer.loadNative(source, { sourceVersion: 0, countU: 12, countV: 12 });
const contextId = viewer.getState().native.model.name;
const surfaces = viewer.getState().surfaces;
const ref = (surfaceId) => {
  const matches = surfaces.filter((item) => item.modelId === contextId && item.surfaceId === surfaceId);
  if (matches.length !== 1) throw new Error(`Expected original Surface: ${surfaceId}`);
  return matches[0];
};
const bindings = [
  { contextId, targetId: BODY_IDS[0], ref: ref('rational_panel') },
  { contextId, targetId: BODY_IDS[1], ref: ref('flat_panel') },
];
if (surfaces.length !== 2) throw new Error('Expected two original Surfaces');

function createWorld() {
  const body = (id, x) => ({ id, kind: 'dynamic', shape: { kind: 'sphere', radiusM: 0.05 },
    positionM: [x, 0.3, 0], velocityMps: [0, 0, 0], massKg: 1, restitution: 0 });
  return createPhysicsWorld({ fixedStepSeconds: DT, gravityMps2: [0, 0, 0],
    bodies: [body(BODY_IDS[0], 0), body(BODY_IDS[1], 0.2)],
    joints: [{ id: 'joint:pair', kind: 'fixed', aId: BODY_IDS[0], bId: BODY_IDS[1],
      anchorALocalM: [0.1, 0, 0], anchorBLocalM: [-0.1, 0, 0] }] });
}

let world = createWorld();
let accepted = null;
let playing = false;
let lastTime = 0;
let carry = 0;
let errorMessage = '';

function admit(state) {
  if (state.bodies.length !== 2 || state.joints.length !== 1 ||
    state.bodies.some((body, index) => body.id !== BODY_IDS[index] || body.kind !== 'dynamic' ||
      body.positionM.some((value) => !Number.isFinite(value) || Math.abs(value) > 10)) ||
    state.joints[0].id !== 'joint:pair' || state.contacts.length !== 0) {
    throw new Error('Physics state left the admitted two-body fixture');
  }
  return state.bodies;
}

function show(state) {
  const [a, b] = admit(state);
  const frame = { contextId, timeSeconds: state.timeSeconds, poses: [
    { targetId: BODY_IDS[0], translation: [a.positionM[0] * 1000, a.positionM[1] * 1000, 0] },
    { targetId: BODY_IDS[1], translation: [b.positionM[0] * 1000, b.positionM[1] * 1000 - 70, 0] },
  ] };
  viewer.applyMotionFrame(frame, bindings, { basis: 'part-xyz-matches-rhyup' });
  accepted = state;
  $('step').textContent = String(state.stepIndex);
  $('centres').textContent = `${a.positionM[0].toFixed(4)} m / ${b.positionM[0].toFixed(4)} m`;
  $('reaction').textContent = `${state.joints[0].linearImpulseNs[0].toFixed(6)} N·s`;
  $('status').textContent = errorMessage || (playing ? 'Playing' : 'Paused');
  $('play').textContent = playing ? 'Pause' : 'Play';
}

function step() {
  if (world.getState().stepIndex >= 120) { playing = false; show(accepted); return; }
  try {
    const initial = world.getState().stepIndex === 0;
    show(world.step(DT, initial ? [{ kind: 'impulse', bodyId: BODY_IDS[1],
      impulseNs: [0.2, 0, 0] }] : []));
  } catch (error) {
    playing = false;
    errorMessage = error instanceof Error ? error.message : String(error);
    show(accepted);
  }
}

function reset() {
  world.dispose();
  world = createWorld();
  playing = false;
  lastTime = 0;
  carry = 0;
  errorMessage = '';
  show(world.getState());
  viewer.fit();
}

$('play').addEventListener('click', () => { playing = !playing; lastTime = 0; show(accepted); });
$('one-step').addEventListener('click', () => { playing = false; step(); });
$('reset').addEventListener('click', reset);
$('fit').addEventListener('click', () => viewer.fit());
$('reject').addEventListener('click', () => {
  playing = false;
  const before = JSON.stringify(viewer.getState().motion);
  let refused = false;
  try { viewer.applyMotionFrame({ contextId, timeSeconds: accepted.timeSeconds,
    poses: [{ targetId: BODY_IDS[0], translation: [0, 0, 0] }] },
  bindings, { basis: 'part-xyz-matches-rhyup' }); }
  catch { refused = true; }
  errorMessage = refused && JSON.stringify(viewer.getState().motion) === before
    ? 'Invalid binding refused; accepted pose retained' : 'Invalid binding changed the pose';
  show(accepted);
});

function animate(time) {
  if (playing) {
    if (lastTime) carry += Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    for (let count = 0; carry >= DT && count < 6 && playing; count++, carry -= DT) step();
  }
  requestAnimationFrame(animate);
}
reset();
const targetStep = Number(new URL(location.href).searchParams.get('step') ?? 0);
if (![0, 30, 120].includes(targetStep)) throw new Error('Supported capture steps: 0, 30, 120');
for (let count = 0; count < targetStep; count++) step();
window.__jointDemo = { getState: () => world.getState(), getViewerState: () => viewer.getState(),
  step, reset, dispose: () => { world.dispose(); viewer.dispose(); } };
requestAnimationFrame(animate);
window.addEventListener('pagehide', () => { world.dispose(); viewer.dispose(); }, { once: true });
