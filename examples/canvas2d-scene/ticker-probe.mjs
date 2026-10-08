import assert from 'node:assert/strict';
import { createTicker } from '../../packages/barocss-canvas2d/dist/index.js';

function fakeScheduler() {
  let nextToken = 1;
  let lastCallback = null;
  const pending = new Map();
  const canceled = [];
  return {
    requestFrame(callback) { const token = nextToken++; lastCallback = callback; pending.set(token, callback); return token; },
    cancelFrame(token) { canceled.push(token); pending.delete(token); },
    get size() { return pending.size; },
    get canceled() { return [...canceled]; },
    get lastCallback() { return lastCallback; },
    next(timestampMS) {
      const [token, callback] = pending.entries().next().value ?? [];
      assert.ok(callback, 'expected a scheduled frame');
      pending.delete(token);
      callback(timestampMS);
      return callback;
    },
  };
}
const asScheduler = clock => ({ requestFrame: clock.requestFrame, cancelFrame: clock.cancelFrame });
if (typeof globalThis.requestAnimationFrame !== 'function' ||
    typeof globalThis.cancelAnimationFrame !== 'function') {
  assert.throws(() => createTicker(), error => error.code === 'UNSUPPORTED_FEATURE');
}

const mutableClock = fakeScheduler();
const mutableMethods = asScheduler(mutableClock);
const snapshottedTicker = createTicker(mutableMethods);
mutableMethods.requestFrame = () => { throw new Error('changed scheduler method'); };
snapshottedTicker.start();
assert.equal(mutableClock.size, 1);
snapshottedTicker.dispose();

const scheduler = fakeScheduler();
const ticker = createTicker(asScheduler(scheduler));
const order = [];
const infos = [];
ticker.onTick(info => { order.push('normal1'); infos.push(info); });
ticker.onTick(() => order.push('high'), 10);
ticker.onTick(() => order.push('normal2'));
ticker.start(); ticker.start();
assert.equal(ticker.running, true);
assert.equal(scheduler.size, 1);
scheduler.next(1000);
assert.deepEqual(order, ['high', 'normal1', 'normal2']);
assert.deepEqual(infos[0], { frame: 1, timestampMS: 1000, elapsedMS: 0, deltaMS: 0 });
assert.equal(Object.isFrozen(infos[0]), true);
order.length = 0;
scheduler.next(1016);
assert.deepEqual(infos[1], { frame: 2, timestampMS: 1016, elapsedMS: 16, deltaMS: 16 });
assert.equal(scheduler.size, 1);
scheduler.next(1216);
assert.deepEqual(infos[2], { frame: 3, timestampMS: 1216, elapsedMS: 200, deltaMS: 100 });

const lateCallback = scheduler.lastCallback;
const pendingBeforeStop = scheduler.size;
ticker.stop(); ticker.stop();
assert.equal(pendingBeforeStop, 1);
assert.equal(ticker.running, false);
assert.equal(scheduler.size, 0);
assert.equal(scheduler.canceled.length, 1);
const oldFrame = infos.length;
lateCallback(1500);
assert.equal(infos.length, oldFrame);
ticker.start();
scheduler.next(5000);
assert.deepEqual(infos[3], { frame: 4, timestampMS: 5000, elapsedMS: 0, deltaMS: 0 });
assert.equal(infos.length, oldFrame + 1);
ticker.dispose(); ticker.dispose();
assert.equal(ticker.running, false);
assert.equal(scheduler.size, 0);
for (const action of [() => ticker.start(), () => ticker.stop(), () => ticker.onTick(() => {})]) {
  assert.throws(action, error => error.code === 'DISPOSED');
}

const mutationClock = fakeScheduler();
const mutationTicker = createTicker(asScheduler(mutationClock));
const mutations = [];
let offB = () => {};
let addedC = false;
mutationTicker.onTick(() => {
  mutations.push('A');
  offB();
  if (!addedC) { addedC = true; mutationTicker.onTick(() => mutations.push('C')); }
}, 1);
offB = mutationTicker.onTick(() => mutations.push('B'));
mutationTicker.start(); mutationClock.next(0);
assert.deepEqual(mutations, ['A', 'B']);
mutations.length = 0;
mutationClock.next(16);
assert.deepEqual(mutations, ['A', 'C']);
mutationTicker.dispose();

const stopClock = fakeScheduler();
const stopTicker = createTicker(asScheduler(stopClock));
const stopped = [];
stopTicker.onTick(() => { stopped.push('first'); stopTicker.stop(); });
stopTicker.onTick(() => stopped.push('second'));
stopTicker.start(); stopClock.next(1);
assert.deepEqual(stopped, ['first', 'second']);
assert.equal(stopClock.size, 0);
stopTicker.dispose();

const restartClock = fakeScheduler();
const restartTicker = createTicker(asScheduler(restartClock));
let restarted = false;
restartTicker.onTick(() => {
  if (restarted) return;
  restarted = true;
  restartTicker.stop();
  restartTicker.start();
});
restartTicker.start(); restartClock.next(1);
assert.equal(restartClock.size, 1);
restartClock.next(2);
assert.equal(restartClock.size, 1);
restartTicker.dispose();

const disposeClock = fakeScheduler();
const disposeTicker = createTicker(asScheduler(disposeClock));
const disposed = [];
disposeTicker.onTick(() => { disposed.push('first'); disposeTicker.dispose(); });
disposeTicker.onTick(() => disposed.push('second'));
disposeTicker.start(); disposeClock.next(1);
assert.deepEqual(disposed, ['first']);

for (const badTime of [-1, NaN, Infinity]) {
  const badClock = fakeScheduler();
  const badTicker = createTicker(asScheduler(badClock));
  let called = 0;
  badTicker.onTick(() => called++);
  badTicker.start();
  assert.throws(() => badClock.next(badTime), error => error.code === 'INVALID_SCENE');
  assert.equal(called, 0);
  assert.equal(badTicker.running, false);
  badTicker.dispose();
}
const backwardClock = fakeScheduler();
const backwardTicker = createTicker(asScheduler(backwardClock));
let backwardCalls = 0;
backwardTicker.onTick(() => backwardCalls++);
backwardTicker.start(); backwardClock.next(20);
assert.throws(() => backwardClock.next(19), error => error.code === 'INVALID_SCENE');
assert.equal(backwardCalls, 1);
assert.equal(backwardTicker.running, false);
backwardTicker.dispose();

const duplicateClock = fakeScheduler();
const duplicateTicker = createTicker(asScheduler(duplicateClock));
let duplicateCalls = 0;
const duplicate = () => { duplicateCalls++; };
const offFirst = duplicateTicker.onTick(duplicate);
const offSecond = duplicateTicker.onTick(duplicate);
offFirst(); offFirst();
duplicateTicker.start(); duplicateClock.next(0);
assert.equal(duplicateCalls, 1);
offSecond(); duplicateTicker.dispose();

const limitTicker = createTicker(asScheduler(fakeScheduler()));
const offLimit = Array.from({ length: 128 }, () => limitTicker.onTick(() => {}));
assert.throws(() => limitTicker.onTick(() => {}), error => error.code === 'SCENE_LIMIT');
offLimit.forEach(off => off());
limitTicker.onTick(() => {})();
for (const bad of [() => limitTicker.onTick(null), () => limitTicker.onTick(() => {}, 1.5),
  () => limitTicker.onTick(() => {}, 101), () => createTicker({ requestFrame() {} }),
  () => createTicker({ requestFrame(callback) { callback(0); return 1; }, cancelFrame() {} }).start()]) {
  assert.throws(bad, error => error.code === 'INVALID_SCENE');
}
limitTicker.dispose();

const errorClock = fakeScheduler();
const errorTicker = createTicker(asScheduler(errorClock));
errorTicker.onTick(() => { throw new Error('listener fault'); });
errorTicker.start();
assert.throws(() => errorClock.next(0), /listener fault/);
assert.equal(errorTicker.running, false);
assert.equal(errorClock.size, 0);
errorTicker.dispose();

console.log(JSON.stringify({ result: 'ok', frames: infos.length, cappedDeltaMS: infos[2].deltaMS,
  priorities: ['high', 'normal1', 'normal2'], listenerLimit: 128 }));
