import assert from 'node:assert/strict';
import { createMotionClip, createMotionPlayer, sampleMotionClip } from '../../packages/barocss-motion/dist/index.js';
import { clipInput } from './clip.mjs';

const clip = createMotionClip(clipInput);
const start = sampleMotionClip(clip, 0);
const midpoint = sampleMotionClip(clip, 2);
const end = sampleMotionClip(clip, 4);
assert.deepEqual(start.poses[0].translation, [-75, 0, 0]);
assert.deepEqual(midpoint.poses[0].translation, [-25, 10, 0]);
assert.deepEqual(end.poses[0].translation, [25, 20, 0]);
assert.deepEqual(midpoint.poses[1].scale, [0.825, 1.2, 0.825]);
assert.ok(Math.abs(midpoint.poses[0].rotation[2] - Math.SQRT1_2) < 1e-12);

const player = createMotionPlayer(clip, { mode: 'clamp' });
player.play();
player.advance(2);
assert.equal(player.getState().timeSeconds, 2);
player.pause();
player.advance(1);
assert.equal(player.getState().timeSeconds, 2);
player.seek(4);
assert.deepEqual(player.getState().poses[0].translation, [25, 20, 0]);
player.setMode('repeat');
player.play();
player.advance(1);
assert.equal(player.getState().timeSeconds, 1);

const prior = player.getState();
assert.throws(() => player.seek(5), /out of bounds/);
assert.deepEqual(player.getState(), prior);
const bad = structuredClone(clipInput);
bad.tracks[0].keys[1].timeSeconds = 0;
assert.throws(() => createMotionClip(bad), /strictly increase/);
assert.deepEqual(player.getState(), prior);

console.log(JSON.stringify({
  contextId: clip.contextId,
  start: start.poses,
  midpoint: midpoint.poses,
  end: end.poses,
  pausedSeekRepeatTimeSeconds: prior.timeSeconds,
  malformedRefusalRetained: true,
}, null, 2));
