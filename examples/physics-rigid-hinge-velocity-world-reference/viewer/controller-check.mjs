import assert from 'node:assert/strict';
import {createRecordedController, errorDiagnostic} from './controller.mjs';
import {createPlaybackClock} from './clock.mjs';

// Fake presentation only. This file does not load recorded data or any provider.
const IDS = ['pairA0', 'pairB0', 'pairA1', 'pairB1'];
function scheduler() {
  let serial = 0;
  const pending = new Map();
  return {
    requestFrame(callback) { const id = serial++; pending.set(id, callback); return id; },
    cancelFrame(id) { pending.delete(id); },
    tick(time) { assert.equal(pending.size, 1); const [id, callback] = pending.entries().next().value; pending.delete(id); callback(time); },
    count: () => pending.size,
  };
}
function fixture() {
  const queue = scheduler(), sessions = [];
  let invalidFrame = null, staleSurface = false, submissionError = null;
  const frames = Array.from({length: 1201}, (_, stepIndex) => ({stepIndex, timeSeconds: stepIndex * (1 / 120), valid: true}));
  const recording = {dt: 1 / 120, frames, frameFor: index => structuredClone(frames[index])};
  const bindings = IDS.map(id => ({contextId: 'recorded', targetId: id, ref: {modelId: 'model_' + id, surfaceId: 'surface_' + id}}));
  const controller = createRecordedController({recording,
    requestFrame: callback => queue.requestFrame(callback), cancelFrame: id => queue.cancelFrame(id),
    validateFrame(frame) { if (frame.stepIndex === invalidFrame || !frame.valid) throw new RangeError('fake invalid frame'); },
    makeViewerFrame(frame) { return {contextId: 'recorded', timeSeconds: frame.timeSeconds, poses: IDS.map(targetId => ({targetId}))}; },
    createSession() {
      const entry = {submitted: [], disposals: 0, disposed: false};
      const viewer = {
        getState() { return {status: entry.disposed ? 'disposed' : 'ready', surfaces: bindings.map(binding => ({...binding.ref, surfaceId: staleSurface ? 'stale' : binding.ref.surfaceId}))}; },
        applyMotionFrame(motion, actualBindings, basis) {
          assert.equal(entry.disposed, false); assert.equal(actualBindings.length, 4); assert.equal(basis.basis, 'part-xyz-matches-rhyup');
          if (submissionError) throw submissionError;
          entry.submitted.push(motion.timeSeconds);
        },
        readPixels() { return new Uint8Array([1, 2, 3, 255]); },
        dispose() { entry.disposals++; entry.disposed = true; },
      };
      entry.viewer = viewer; sessions.push(entry); return {viewer, bindings};
    },
  });
  return {controller, queue, sessions,
    invalid(index) { invalidFrame = index; }, stale(value) { staleSurface = value; }, reject(error) { submissionError = error; }};
}
const receipts = [];
function check(name, run) { run(); receipts.push({name, passed: true}); }

check('invalid frame and stale bindings retain last confirmed cursor', () => {
  const f = fixture(), c = f.controller;
  assert.equal(c.initialize(), true); assert.equal(c.seek(60), true);
  const presentations = c.getSnapshot().presentationCount;
  f.invalid(61); assert.equal(c.oneStep(), false);
  assert.equal(c.getSnapshot().cursor, 60); assert.equal(c.getSnapshot().displayKnown, true);
  assert.equal(c.getSnapshot().presentationCount, presentations);
  assert.equal(c.getSnapshot().errors.at(-1).diagnostic.message, 'fake invalid frame');
  f.invalid(null); f.stale(true); assert.equal(c.seek(197), false);
  assert.equal(c.getSnapshot().cursor, 60); assert.equal(c.getSnapshot().presentationCount, presentations);
  assert.equal(c.getSnapshot().errors.at(-1).diagnostic.message, 'Recorded binding is stale');
  c.dispose(); assert.equal(f.queue.count(), 0);
});
check('submission refusal preserves cursor and makes display unknown', () => {
  const f = fixture(), c = f.controller;
  c.initialize(); c.seek(1);
  const error = new Error('fake renderer failure'); error.code = 'FAKE_RENDERER'; f.reject(error);
  assert.equal(c.oneStep(), false); assert.equal(c.getSnapshot().cursor, 1);
  assert.equal(c.getSnapshot().displayedCursor, null); assert.equal(c.play(), false);
  assert.deepEqual(c.getSnapshot().errors.at(-1).diagnostic, {name: 'Error', code: 'FAKE_RENDERER', message: 'fake renderer failure'});
  f.reject(null); assert.equal(c.reset(), true); assert.equal(c.getSnapshot().cursor, 0);
  assert.equal(f.sessions[0].disposals, 1); assert.equal(c.getSnapshot().sessionSerial, 2); c.dispose();
});
check('context restore requires explicit reset and disposal is idempotent', () => {
  const f = fixture(), c = f.controller;
  c.initialize(); c.seek(60); c.play(); assert.equal(f.queue.count(), 1);
  c.contextLost(); assert.equal(f.queue.count(), 0); assert.equal(c.getSnapshot().cursor, 60);
  assert.equal(c.getSnapshot().displayKnown, false); assert.equal(c.reset(), false);
  c.contextRestored(); assert.equal(f.sessions.length, 1); assert.equal(c.play(), false);
  assert.equal(c.reset(), true); assert.equal(f.sessions.length, 2); assert.equal(c.getSnapshot().playing, false);
  c.play(); c.dispose(); c.dispose(); assert.equal(f.queue.count(), 0);
  assert.equal(f.sessions[0].disposals, 1); assert.equal(f.sessions[1].disposals, 1);
  const count = c.getSnapshot().presentationCount;
  assert.equal(c.oneStep(), false); assert.equal(c.seek(1), false); assert.equal(c.reset(), false); assert.equal(c.play(), false);
  assert.equal(c.getSnapshot().presentationCount, count); assert.equal(c.getSnapshot().cursor, 0);
  assert.equal(c.getViewerState().status, 'disposed'); assert.throws(() => c.readPixels(), /unavailable/);
});
check('catch-up presents all intermediate frames with a bound of eight', () => {
  const f = fixture(), c = f.controller;
  c.initialize(); c.play(); f.queue.tick(0); f.queue.tick(1000);
  assert.equal(c.getSnapshot().cursor, 8); assert.equal(c.getClockStats().advances, 8);
  assert.deepEqual(f.sessions[0].submitted, Array.from({length: 9}, (_, index) => index * (1 / 120)));
  c.pause(); assert.equal(f.queue.count(), 0); c.dispose();
});
check('natural end presents 1200 exactly once and cancels RAF', () => {
  const f = fixture(), c = f.controller;
  c.initialize(); c.play(); f.queue.tick(0);
  for (let index = 1; index <= 1200; index++) f.queue.tick(index * (1000 / 120));
  assert.equal(c.getSnapshot().cursor, 1200); assert.equal(c.getSnapshot().timeSeconds, 10);
  assert.equal(c.getSnapshot().presentationCount, 1201); assert.equal(c.getClockStats().advances, 1200);
  assert.equal(c.getClockStats().stopReason, 'end'); assert.equal(f.queue.count(), 0);
  assert.equal(c.oneStep(), false); assert.equal(c.play(), false); assert.equal(c.getSnapshot().presentationCount, 1201); c.dispose();
});
check('clock rejects failed advance and cancels handle zero', () => {
  const queue = scheduler(); let calls = 0;
  const clock = createPlaybackClock({dt: 1 / 120, lastIndex: 1200, advance() { calls++; return false; },
    requestFrame: callback => queue.requestFrame(callback), cancelFrame: id => queue.cancelFrame(id)});
  clock.play(); clock.pause(); assert.equal(queue.count(), 0);
  clock.play(); queue.tick(0); queue.tick(1000 / 120);
  assert.equal(calls, 1); assert.equal(clock.getStats().cursor, 0); assert.equal(clock.getStats().stopReason, 'error'); assert.equal(queue.count(), 0); clock.dispose();
});
check('unknown thrown payload is not serialized or read', () => {
  let traps = 0;
  const unknown = new Proxy({}, {get() { traps++; throw new Error('unexpected read'); }, getPrototypeOf() { traps++; throw new Error('unexpected prototype'); }});
  assert.deepEqual(errorDiagnostic(unknown), {name: 'UnknownThrown', code: null, message: 'Unknown thrown value'});
  assert.equal(traps, 1);
});
console.log(JSON.stringify({passed: true, scope: 'fake-controller-clock-only', physicsCalls: 0, publicViewerCalls: 0, checks: receipts}));
