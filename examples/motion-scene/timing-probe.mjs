import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createMotionClip, evaluateMotionTiming, MotionTimingError, parseMotionClipFile,
  sampleMotionClip, sampleMotionClipWithTiming,
} from '../../packages/barocss-motion/dist/index.js';

const clip = parseMotionClipFile(readFileSync(new URL('./assets/two-parts.baromotion', import.meta.url), 'utf8'));
const identity = { kind: 'cubic-bezier', x1: 0, y1: 0, x2: 1, y2: 1 };
const ease = { kind: 'cubic-bezier', x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 };
const flatX = { kind: 'cubic-bezier', x1: 0, y1: 0, x2: 0, y2: 1 };

for (const time of [-0, 0, clip.durationSeconds]) {
  const timed = sampleMotionClipWithTiming(clip, time, ease);
  const direct = sampleMotionClip(clip, time);
  assert.equal(Object.is(timed.inputTimeSeconds, time), true);
  assert.equal(Object.is(timed.sampledTimeSeconds, time), true);
  assert.deepEqual(timed.poses, direct.poses);
}
const negativeZero = evaluateMotionTiming(-0, ease);
assert.equal(Object.is(negativeZero.progress, -0), true);
assert.equal(Object.is(negativeZero.easedProgress, 0), true);
assert.deepEqual(evaluateMotionTiming(1, ease), {
  progress: 1, easedProgress: 1, parameter: 1, iterations: 0, xResidual: 0,
});

const middleIdentity = sampleMotionClipWithTiming(clip, 2, identity);
assert.equal(middleIdentity.sampledTimeSeconds, 2);
assert.deepEqual(middleIdentity.poses, sampleMotionClip(clip, 2).poses);
const eased = sampleMotionClipWithTiming(clip, 2, ease);
assert.ok(eased.sampledTimeSeconds > 2 && eased.sampledTimeSeconds < 4);
assert.deepEqual(eased.poses, sampleMotionClip(clip, eased.sampledTimeSeconds).poses);
const evaluation = evaluateMotionTiming(0.5, ease);
assert.ok(evaluation.iterations <= 64 && evaluation.xResidual <= 1e-9);
assert.equal(evaluation.easedProgress * clip.durationSeconds, eased.sampledTimeSeconds);

const flat = evaluateMotionTiming(0.125, flatX);
assert.ok(Math.abs(flat.parameter - 0.5) < 1e-6);
assert.ok(Math.abs(flat.easedProgress - 0.5) < 1e-6);
assert.ok(flat.iterations <= 64 && flat.xResidual <= 1e-9);

const instant = createMotionClip({
  version: 0, contextId: 'instant', durationSeconds: 0,
  tracks: [{ targetId: 'part', property: 'translation', interpolation: 'STEP',
    keys: [{ timeSeconds: 0, value: [0, 0, 0] }] }],
});
assert.equal(Object.is(sampleMotionClipWithTiming(instant, -0, ease).sampledTimeSeconds, -0), true);

const accepted = structuredClone(eased);
function reject(run, code) {
  assert.throws(run, (error) => error instanceof MotionTimingError && error.code === code);
  assert.deepEqual(eased, accepted);
}
let getterCalls = 0;
const getterCurve = { ...ease };
Object.defineProperty(getterCurve, 'y1', { get() { getterCalls += 1; return 0.1; } });
reject(() => evaluateMotionTiming(0.5, getterCurve), 'INVALID_INPUT');
reject(() => evaluateMotionTiming(-0.1, ease), 'INVALID_INPUT');
reject(() => evaluateMotionTiming(0.5, { ...ease, x1: 2 }), 'INVALID_INPUT');
reject(() => evaluateMotionTiming(0.5, { ...ease, extra: 1 }), 'INVALID_INPUT');
reject(() => sampleMotionClipWithTiming(clip, 5, ease), 'INVALID_INPUT');
reject(() => sampleMotionClipWithTiming({ ...clip }, 2, ease), 'INVALID_INPUT');
assert.equal(getterCalls, 0);
eased.poses[0].translation[0] = 999;
assert.notDeepEqual(eased, accepted);
assert.deepEqual(sampleMotionClipWithTiming(clip, 2, ease), accepted);

console.log(JSON.stringify({
  clip: 'assets/two-parts.baromotion', identityTime: middleIdentity.sampledTimeSeconds,
  easedTime: accepted.sampledTimeSeconds,
  ease: evaluation, flat, getterCalls,
  refused: ['getter', 'progress', 'control', 'extra', 'time', 'unvalidated clip'],
  endpointBitsRetained: true, independentResults: true,
}));
