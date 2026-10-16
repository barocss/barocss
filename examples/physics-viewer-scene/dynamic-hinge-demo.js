import { createPhysicsWorld } from '../../packages/barocss-physics/dist/index.js';
import { createViewer } from '../../packages/barocss-viewer/dist/index.js';

const DT = 1 / 120;
const BODY_IDS = ['part:a', 'part:b'];
const $ = (id) => document.getElementById(id);
const viewer = await createViewer($('viewer'), { mmToSceneUnit: 0.001,
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
  { contextId, targetId: BODY_IDS[0], ref: ref('flat_panel') },
  { contextId, targetId: BODY_IDS[1], ref: ref('rational_panel') },
];
if (surfaces.length !== 2) throw new Error('Expected two original Surfaces');

function createWorld() {
  const shape = { kind: 'sphere', radiusM: 0.1 };
  return createPhysicsWorld({ fixedStepSeconds: DT, gravityMps2: [0, 0, 0],
    bodies: [
      { id: BODY_IDS[0], kind: 'dynamic', shape, positionM: [0, 0, 0],
        velocityMps: [0, 0, 0], massKg: 1, restitution: 0 },
      { id: BODY_IDS[1], kind: 'dynamic', shape, positionM: [0, 0, 0],
        velocityMps: [0, 0, 0], massKg: 1, restitution: 0 },
    ],
    joints: [{ id: 'joint:hinge', kind: 'hinge', aId: BODY_IDS[0], bId: BODY_IDS[1],
      anchorALocalM: [0, 0, 0], anchorBLocalM: [0, 0, 0],
      axisWorld: [0, 0, 1], limitRad: [-0.51, 0.51],
      motor: { targetSpeedRadps: 0.5, maxImpulseNms: 0.0001,
        maxReactionNms: 0.0005 } }] });
}

let world = createWorld();
let accepted = null;
let playing = false;
let lastTime = 0;
let carry = 0;
let errorMessage = '';

function admit(state) {
  if (state.bodies.length !== 2 || state.joints.length !== 1 ||
    state.bodies.some((body, index) => body.id !== BODY_IDS[index] ||
      body.kind !== 'dynamic' ||
      body.positionM.some((value) => !Number.isFinite(value) || Math.abs(value) > 10)) ||
    state.joints[0].id !== 'joint:hinge' || state.contacts.length !== 0) {
    throw new Error('Physics state left the admitted dynamic hinge fixture');
  }
  return state.bodies;
}

function show(state) {
  const [a, b] = admit(state);
  const frame = { contextId, timeSeconds: state.timeSeconds, poses: [
    { targetId: BODY_IDS[0], translation: [a.positionM[0] * 1000, a.positionM[1] * 1000, 0],
      rotation: a.orientation },
    { targetId: BODY_IDS[1], translation: [b.positionM[0] * 1000, b.positionM[1] * 1000, 0],
      rotation: b.orientation },
  ] };
  viewer.applyMotionFrame(frame, bindings, { basis: 'part-xyz-matches-rhyup' });
  accepted = state;
  $('step').textContent = String(state.stepIndex);
  $('angle').textContent = `${state.joints[0].angleRad.toFixed(6)} rad`;
  $('speeds').textContent = `${a.angularVelocityRadps[2].toFixed(3)} / ${b.angularVelocityRadps[2].toFixed(3)} rad/s`;
  $('motor').textContent = `${state.joints[0].motorImpulseNms.toFixed(6)} N·m·s`;
  $('reaction').textContent = `${state.joints[0].angularImpulseNms[2].toFixed(6)} N·m·s`;
  $('status').textContent = errorMessage || (playing ? 'Playing' : 'Paused');
  $('play').textContent = playing ? 'Pause' : 'Play';
}

function step() {
  if (world.getState().stepIndex >= 120) { playing = false; show(accepted); return; }
  try {
    show(world.step(DT));
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
$('stale').addEventListener('click', () => {
  playing = false;
  const before = JSON.stringify(viewer.getState().motion);
  const stale = bindings.map((binding, index) => index === 0
    ? { ...binding, ref: { ...binding.ref, modelId: 'old_model' } } : binding);
  let refused = false;
  try { viewer.applyMotionFrame(viewer.getState().motion.frame, stale,
    { basis: 'part-xyz-matches-rhyup' }); }
  catch { refused = true; }
  errorMessage = refused && JSON.stringify(viewer.getState().motion) === before
    ? 'Stale source refused; accepted pose retained' : 'Stale source changed the pose';
  show(accepted);
});
$('overload').addEventListener('click', () => {
  playing = false;
  if (world.getState().stepIndex !== 120) {
    errorMessage = 'Run to step 120 before overload'; show(accepted); return;
  }
  show(world.step(DT, [{ kind: 'angularImpulse', bodyId: BODY_IDS[1],
    angularImpulseNms: [0, 0, 0.01] }]));
  const before = JSON.stringify(viewer.getState().motion);
  try { world.step(DT); errorMessage = 'Unexpected overload acceptance'; }
  catch (error) {
    errorMessage = error?.code === 'NUMERIC_LIMIT' &&
      JSON.stringify(viewer.getState().motion) === before && world.getState().stepIndex === 121
      ? 'Overload refused; accepted pose retained' : 'Overload retention failed';
  }
  show(world.getState());
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
if (![0, 10, 120].includes(targetStep)) throw new Error('Supported capture steps: 0, 10, 120');
for (let count = 0; count < targetStep; count++) step();
window.__dynamicHingeDemo = { getState: () => world.getState(), getViewerState: () => viewer.getState(),
  step, reset, dispose: () => { world.dispose(); viewer.dispose(); } };
requestAnimationFrame(animate);
window.addEventListener('pagehide', () => { world.dispose(); viewer.dispose(); }, { once: true });
