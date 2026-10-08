import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createMotionClip, MotionBlendError, parseMotionClipFile,
  sampleMotionBlend, sampleMotionClip,
} from '../../packages/barocss-motion/dist/index.js';

const readClip = (name) => parseMotionClipFile(readFileSync(fileURLToPath(new URL(`./assets/${name}`, import.meta.url)), 'utf8'));
const fromClip = readClip('two-parts.baromotion');
const toClip = readClip('two-parts-blend-target.baromotion');
const pose = (sample, id) => sample.poses.find((item) => item.targetId === id);

const fromEndpoint = sampleMotionBlend(fromClip, -0, toClip, 4, -0);
assert.ok(Object.is(fromEndpoint.fromTimeSeconds, -0));
assert.ok(Object.is(fromEndpoint.weight, 0));
assert.ok(Object.is(pose(fromEndpoint, 'part-a').translation[1], -0));
assert.deepEqual(fromEndpoint.poses, sampleMotionClip(fromClip, -0).poses);

const toEndpoint = sampleMotionBlend(fromClip, 0, toClip, 0, 1);
assert.deepEqual(toEndpoint.poses.map((item) => item.targetId), ['part-a', 'part-b']);
assert.deepEqual(pose(toEndpoint, 'part-a').rotation, [0, 0, 0, -1]);
assert.deepEqual(pose(toEndpoint, 'part-a').translation, [65, 40, 0]);

const middle = sampleMotionBlend(fromClip, 2, toClip, 2, 0.5);
assert.deepEqual(middle.poses.map((item) => item.targetId), ['part-a', 'part-b']);
assert.deepEqual(pose(middle, 'part-a').translation, [-5, 25, 0]);
assert.deepEqual(pose(middle, 'part-a').scale, [1, 1, 1]);
assert.deepEqual(pose(middle, 'part-b').translation, [37.5, 15, 0]);
const sourceRotation = pose(sampleMotionClip(fromClip, 2), 'part-a').rotation;
const destinationRotation = pose(sampleMotionClip(toClip, 2), 'part-a').rotation;
assert.ok(sourceRotation.every((value, index) => Math.abs(value + destinationRotation[index]) < 1e-12));
assert.ok(pose(middle, 'part-a').rotation.every((value, index) => Math.abs(value - sourceRotation[index]) < 1e-12));
assert.ok(Math.abs(Math.hypot(...pose(middle, 'part-a').rotation) - 1) < 1e-12);

const independentTimes = sampleMotionBlend(fromClip, 1, toClip, 3, 0.5);
assert.equal(independentTimes.fromTimeSeconds, 1);
assert.equal(independentTimes.toTimeSeconds, 3);
assert.deepEqual(pose(independentTimes, 'part-a').translation, [-30, 22.5, 0]);

middle.poses[0].translation[0] = 999;
assert.deepEqual(pose(sampleMotionBlend(fromClip, 2, toClip, 2, 0.5), 'part-a').translation, [-5, 25, 0]);
assert.deepEqual(pose(sampleMotionClip(fromClip, 2), 'part-a').translation, [-25, 10, 0]);

const accepted = sampleMotionBlend(fromClip, 2, toClip, 2, 0.5);
const snapshot = structuredClone(accepted);
function refuse(fn, code) {
  assert.throws(fn, (error) => error instanceof MotionBlendError && error.code === code);
  assert.deepEqual(accepted, snapshot);
}
refuse(() => sampleMotionBlend(fromClip, 2, readClip('wrong-context.baromotion'), 2, 0.5), 'INCOMPATIBLE_CLIPS');
refuse(() => sampleMotionBlend(fromClip, 2, readClip('unknown-target.baromotion'), 2, 0.5), 'INCOMPATIBLE_CLIPS');
const missingScale = createMotionClip({
  version: 0, contextId: toClip.contextId, durationSeconds: toClip.durationSeconds,
  tracks: toClip.tracks.filter((track) => !(track.targetId === 'part-b' && track.property === 'scale'))
    .map((track) => ({ targetId: track.targetId, property: track.property, interpolation: track.interpolation,
      keys: track.keys.map((key) => ({ timeSeconds: key.timeSeconds, value: [...key.value] })) })),
});
refuse(() => sampleMotionBlend(fromClip, 2, missingScale, 2, 0.5), 'INCOMPATIBLE_CLIPS');
refuse(() => sampleMotionBlend(fromClip, 5, toClip, 2, 0.5), 'INVALID_INPUT');
refuse(() => sampleMotionBlend(fromClip, 2, toClip, 2, NaN), 'INVALID_INPUT');
let getterCalls = 0;
const getterClip = { get contextId() { getterCalls += 1; return 'sample-assembly'; } };
refuse(() => sampleMotionBlend(getterClip, 0, toClip, 2, 0.5), 'INVALID_INPUT');
assert.equal(getterCalls, 0);

console.log(JSON.stringify({
  files: ['two-parts.baromotion', 'two-parts-blend-target.baromotion'],
  sourceTargetOrder: accepted.poses.map((item) => item.targetId),
  endpointSignedZero: Object.is(pose(fromEndpoint, 'part-a').translation[1], -0),
  destinationQuaternionSign: pose(toEndpoint, 'part-a').rotation,
  midpoint: { partA: pose(accepted, 'part-a').translation, partB: pose(accepted, 'part-b').translation,
    fromTimeSeconds: accepted.fromTimeSeconds, toTimeSeconds: accepted.toTimeSeconds, weight: accepted.weight },
  independentTimes: [independentTimes.fromTimeSeconds, independentTimes.toTimeSeconds],
  refused: ['context', 'target', 'property', 'time', 'weight', 'getter'],
  getterCalls,
}));
