import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMotionClipFile, sampleMotionClip, serializeMotionClipFile } from '../../packages/barocss-motion/dist/index.js';

const filePath = process.argv[2];
if (!filePath) throw new Error('Expected a .baromotion path');
const text = readFileSync(filePath, 'utf8');
const clip = parseMotionClipFile(text);
assert.equal(serializeMotionClipFile(clip), text);
assert.deepEqual(clip.tracks.map((track) => `${track.targetId}:${track.property}`), [
  'part-a:translation', 'part-a:rotation', 'part-a:scale',
  'part-b:translation', 'part-b:rotation', 'part-b:scale',
]);
const start = sampleMotionClip(clip, 0);
const midpoint = sampleMotionClip(clip, 2);
const end = sampleMotionClip(clip, 4);
assert.deepEqual(start.poses.map((pose) => pose.targetId), ['part-a', 'part-b']);
assert.ok(Object.is(start.poses[0].translation[1], -0));
assert.deepEqual(midpoint.poses[0].translation, [-25, 10, 0]);
assert.deepEqual(midpoint.poses[1].scale, [0.825, 1.2, 0.825]);
assert.deepEqual(end.poses[0].translation, [25, 20, 0]);
assert.ok(Object.is(end.poses[1].rotation[1], -Math.SQRT1_2));
assert.ok(Object.is(end.poses[1].rotation[3], -Math.SQRT1_2));
console.log(JSON.stringify({
  coldRead: true,
  contextId: clip.contextId,
  trackCount: clip.tracks.length,
  targetIds: start.poses.map((pose) => pose.targetId),
  startPartATranslationYIsNegativeZero: Object.is(start.poses[0].translation[1], -0),
  midpointPartATranslation: midpoint.poses[0].translation,
  midpointPartBScale: midpoint.poses[1].scale,
  endPartBQuaternionNegativeSign: Object.is(end.poses[1].rotation[1], -Math.SQRT1_2),
}));
