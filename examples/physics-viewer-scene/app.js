import { createPhysicsWorld } from '../../packages/barocss-physics/src/index.ts';
import { createViewer } from '../../packages/barocss-viewer/dist/index.js';

const DT = 1 / 120;
const METRES_TO_MM = 1000;
const BODY_ID = 'part:ball';
const FIXTURE_ID = 'fixture:box';
const BASIS = { basis: 'part-xyz-matches-rhyup' };
const $ = (id) => document.getElementById(id);

const canvas = $('viewer');
const viewer = await createViewer(canvas, { mmToSceneUnit: 0.001, background: [0.035, 0.065, 0.105] });
const source = await (await fetch('/two-surfaces.barocad')).text();
viewer.loadNative(source, { sourceVersion: 0, countU: 12, countV: 12 });
const native = viewer.getState().native;
const contextId = native.model.name;
const surfaces = viewer.getState().surfaces;
const surface = (id) => {
  const matches = surfaces.filter((ref) => ref.modelId === contextId && ref.surfaceId === id);
  if (matches.length !== 1) throw new Error(`Expected one native Surface: ${id}`);
  return matches[0];
};
const bindings = [
  { contextId, targetId: BODY_ID, ref: surface('rational_panel') },
  { contextId, targetId: FIXTURE_ID, ref: surface('flat_panel') },
];
if (surfaces.length !== 2) throw new Error('This fixture needs exactly two native Surfaces');

function createWorld() {
  return createPhysicsWorld({
    fixedStepSeconds: DT,
    gravityMps2: [0, -9.81, 0],
    bodies: [
      { id: BODY_ID, kind: 'dynamic', shape: { kind: 'sphere', radiusM: 0.05 },
        positionM: [0.05, 0.28, 0.02], velocityMps: [0, 0, 0], massKg: 1, restitution: 0 },
      { id: FIXTURE_ID, kind: 'static', shape: { kind: 'box', halfExtentsM: [0.05, 0.02, 0.02] },
        positionM: [0.05, 0.05, 0.02], restitution: 0 },
    ],
  });
}

let world = createWorld();
let accepted = null;
let running = true;
let previousTime = 0;
let accumulator = 0;
let errorMessage = '';

function bodyFrom(state) {
  if (!state || !Number.isInteger(state.stepIndex) || state.stepIndex < 0 || state.stepIndex > 3600
    || !Number.isFinite(state.timeSeconds) || state.timeSeconds < 0 || state.timeSeconds > 30
    || !Array.isArray(state.bodies) || state.bodies.length !== 2
    || !Array.isArray(state.contacts) || state.contacts.some((contact) =>
      !contact || ![FIXTURE_ID, BODY_ID].includes(contact.aId)
      || ![FIXTURE_ID, BODY_ID].includes(contact.bId)
      || contact.aId === contact.bId || !Number.isFinite(contact.impulseNs))
    || new Set(state.bodies.map((body) => body.id)).size !== 2) {
    throw new Error('Invalid Physics state for this Viewer fixture');
  }
  const body = state.bodies.find((candidate) => candidate.id === BODY_ID);
  const fixture = state.bodies.find((candidate) => candidate.id === FIXTURE_ID);
  if (body?.kind !== 'dynamic' || body.shape?.kind !== 'sphere'
    || fixture?.kind !== 'static' || fixture.shape?.kind !== 'box'
    || !Array.isArray(body.positionM) || body.positionM.length !== 3
    || !body.positionM.every((value) => Number.isFinite(value) && Math.abs(value) <= 10)
    || !Array.isArray(body.velocityMps) || body.velocityMps.length !== 3
    || !body.velocityMps.every(Number.isFinite)
    || fixture.positionM?.join(',') !== '0.05,0.05,0.02') {
    throw new Error('Physics body or fixture differs from the admitted binding');
  }
  return body;
}

function draw(state, body) {
  const y = 390 - body.positionM[1] * 1100;
  $('proxy-ball').setAttribute('cy', y.toFixed(3));
  $('proxy-center').setAttribute('y1', y.toFixed(3));
  $('proxy-center').setAttribute('y2', y.toFixed(3));
  const contact = state.contacts.find(({ aId, bId }) =>
    aId === FIXTURE_ID && bId === BODY_ID);
  $('proxy-ball').classList.toggle('touching', Boolean(contact));
  $('contact-indicator').classList.toggle('touching', Boolean(contact));
  $('height').textContent = body.positionM[1].toFixed(4);
  $('velocity').textContent = body.velocityMps[1].toFixed(4);
  $('step-index').textContent = String(state.stepIndex);
  $('sim-time').textContent = state.timeSeconds.toFixed(3);
  $('contact').textContent = contact
    ? `${contact.aId} ↔ ${contact.bId} · ${contact.impulseNs.toFixed(4)} N·s`
    : 'No contact in this step';
  $('mode').textContent = running ? 'RUNNING' : 'PAUSED';
  $('mode').classList.toggle('paused', !running);
  $('toggle').textContent = running ? 'Pause' : 'Continue';
  $('error').textContent = errorMessage;
  $('error').classList.toggle('ok', errorMessage.startsWith('Refused invalid binding'));
}

function applyState(state, candidateBindings = bindings) {
  const body = bodyFrom(state);
  const frame = {
    contextId,
    timeSeconds: state.timeSeconds,
    poses: [
      { targetId: BODY_ID, translation: [
        body.positionM[0] * METRES_TO_MM - 50,
        body.positionM[1] * METRES_TO_MM,
        body.positionM[2] * METRES_TO_MM - 20,
      ] },
      { targetId: FIXTURE_ID, translation: [0, 0, 0] },
    ],
  };
  viewer.applyMotionFrame(frame, candidateBindings, BASIS);
  accepted = state;
  draw(state, body);
}

function step() {
  if (world.getState().stepIndex >= 3600) { running = false; draw(accepted, bodyFrom(accepted)); return; }
  try {
    const state = world.step(DT);
    applyState(state);
  } catch (error) {
    running = false;
    errorMessage = error instanceof Error ? error.message : String(error);
    draw(accepted, bodyFrom(accepted));
  }
}

function reset() {
  world.dispose();
  world = createWorld();
  running = false;
  accumulator = 0;
  previousTime = 0;
  errorMessage = '';
  applyState(world.getState());
}

$('toggle').addEventListener('click', () => {
  running = !running;
  accumulator = 0;
  draw(accepted, bodyFrom(accepted));
});
$('step').addEventListener('click', () => { running = false; step(); });
$('reset').addEventListener('click', reset);
$('fit').addEventListener('click', () => viewer.fit());
$('reject').addEventListener('click', () => {
  running = false;
  const before = JSON.stringify(viewer.getState().motion);
  try {
    applyState(world.getState(), bindings.slice(0, 1));
    errorMessage = 'ERROR: invalid binding was accepted';
  } catch (error) {
    const unchanged = JSON.stringify(viewer.getState().motion) === before;
    errorMessage = unchanged
      ? `Refused invalid binding; accepted Viewer pose retained (${error.message})`
      : 'ERROR: invalid binding changed the Viewer pose';
  }
  draw(accepted, bodyFrom(accepted));
});

function frame(now) {
  if (previousTime && running) {
    // The host plays simulated time at one quarter of wall time to make the fall visible.
    accumulator += Math.min((now - previousTime) / 1000, 0.05) * 0.25;
    while (accumulator >= DT && running) {
      step();
      accumulator -= DT;
    }
  }
  previousTime = now;
  requestAnimationFrame(frame);
}

applyState(world.getState());
viewer.fit();
requestAnimationFrame(frame);
window.physicsViewerDemo = {
  viewer, source, contextId, bindings, basis: BASIS, applyState,
  getState: () => world.getState(), pause: () => { running = false; }, step, reset,
};
