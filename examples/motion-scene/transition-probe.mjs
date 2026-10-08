import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createMotionTransitionPlayer, MotionTransitionError, parseMotionClipFile,
  sampleMotionBlend, sampleMotionClip,
} from '../../packages/barocss-motion/dist/index.js';

const readClip = (name) => parseMotionClipFile(readFileSync(fileURLToPath(new URL(`./assets/${name}`, import.meta.url)), 'utf8'));
const source = readClip('two-parts.baromotion');
const target = readClip('two-parts-blend-target.baromotion');
const player = createMotionTransitionPlayer(source, { mode: 'clamp' });
const initial = player.getState();
assert.equal(initial.phase, 'idle');
assert.equal(initial.playing, false);
assert.ok(Object.is(initial.poses.find((pose) => pose.targetId === 'part-a').translation[1], -0));
assert.deepEqual(initial.poses, sampleMotionClip(source, 0).poses);
player.seek(1);
const start = player.transitionTo(target, { destinationTimeSeconds: 0, fadeDurationSeconds: 2 });
assert.equal(start.phase, 'fading');
assert.deepEqual(start.poses, sampleMotionBlend(source, 1, target, 0, 0).poses);
assert.deepEqual([start.sourceTimeSeconds, start.destinationTimeSeconds, start.fadeProgress, start.weight], [1, 0, 0, 0]);

function refuse(fn, code) {
  const before = player.getState();
  assert.throws(fn, (error) => error instanceof MotionTransitionError && error.code === code);
  assert.deepEqual(player.getState(), before);
}
refuse(() => player.seek(2), 'TRANSITION_ACTIVE');
refuse(() => player.transitionTo(target, { destinationTimeSeconds: 0, fadeDurationSeconds: 1 }), 'TRANSITION_ACTIVE');
refuse(() => player.advance(NaN), 'INVALID_INPUT');
assert.deepEqual(player.advance(1), start);
player.play();
const middle = player.advance(1);
assert.deepEqual([middle.sourceTimeSeconds, middle.destinationTimeSeconds, middle.fadeElapsedSeconds,
  middle.fadeProgress, middle.weight], [2, 1, 1, 0.5, 0.5]);
assert.deepEqual(middle.poses, sampleMotionBlend(source, 2, target, 1, 0.5).poses);
middle.poses[0].translation[0] = 999;
assert.deepEqual(player.getState().poses, sampleMotionBlend(source, 2, target, 1, 0.5).poses);
player.pause();
assert.equal(player.advance(1).destinationTimeSeconds, 1);
player.play();
const end = player.advance(1);
assert.equal(end.phase, 'adopted');
assert.deepEqual([end.sourceTimeSeconds, end.destinationTimeSeconds, end.fadeElapsedSeconds,
  end.fadeDurationSeconds, end.fadeProgress, end.weight], [2, null, 2, 2, 1, 1]);
assert.deepEqual(end.poses, sampleMotionClip(target, 2).poses);

refuse(() => player.transitionTo(readClip('wrong-context.baromotion'),
  { destinationTimeSeconds: 0, fadeDurationSeconds: 1 }), 'INCOMPATIBLE_CLIPS');
refuse(() => player.transitionTo(readClip('unknown-target.baromotion'),
  { destinationTimeSeconds: 0, fadeDurationSeconds: 1 }), 'INCOMPATIBLE_CLIPS');
refuse(() => player.transitionTo(source, { destinationTimeSeconds: 5, fadeDurationSeconds: 1 }), 'INVALID_INPUT');
refuse(() => player.transitionTo(source, { destinationTimeSeconds: 0, fadeDurationSeconds: Infinity }), 'INVALID_INPUT');
refuse(() => player.transitionTo(source, { destinationTimeSeconds: 0, fadeDurationSeconds: 1,
  timing: { kind: 'cubic-bezier', x1: 2, y1: 0, x2: 1, y2: 1 } }), 'INVALID_INPUT');
let getterCalls = 0;
refuse(() => player.transitionTo(source, { destinationTimeSeconds: 0, fadeDurationSeconds: 1,
  get timing() { getterCalls += 1; return null; } }), 'INVALID_INPUT');
assert.equal(getterCalls, 0);

const instant = player.transitionTo(source, { destinationTimeSeconds: 4, fadeDurationSeconds: 0 });
assert.equal(instant.phase, 'adopted');
assert.equal(instant.playing, false);
assert.deepEqual(instant.poses, sampleMotionClip(source, 4).poses);
assert.equal(player.play().sourceTimeSeconds, 0);
assert.equal(player.advance(4).sourceTimeSeconds, 4);
assert.equal(player.getState().playing, false);

const repeat = createMotionTransitionPlayer(source, { mode: 'repeat' });
repeat.seek(3);
repeat.transitionTo(target, { destinationTimeSeconds: 2, fadeDurationSeconds: 2,
  timing: { kind: 'cubic-bezier', x1: 0.42, y1: 0, x2: 1, y2: 1 } });
repeat.play();
const eased = repeat.advance(1);
assert.deepEqual([eased.sourceTimeSeconds, eased.destinationTimeSeconds, eased.fadeProgress], [0, 3, 0.5]);
assert.ok(eased.weight > 0 && eased.weight < 0.5);
assert.deepEqual(eased.poses, sampleMotionBlend(source, 0, target, 3, eased.weight).poses);
assert.equal(repeat.advance(1).sourceTimeSeconds, 0);
repeat.dispose();
repeat.dispose();
assert.throws(() => repeat.getState(), (error) => error instanceof MotionTransitionError && error.code === 'DISPOSED');
player.dispose();
assert.throws(() => player.advance(0), (error) => error instanceof MotionTransitionError && error.code === 'DISPOSED');

console.log(JSON.stringify({
  files: ['two-parts.baromotion', 'two-parts-blend-target.baromotion'],
  initialSignedZero: Object.is(initial.poses.find((pose) => pose.targetId === 'part-a').translation[1], -0),
  middle: [middle.sourceTimeSeconds, middle.destinationTimeSeconds, middle.weight],
  adoptedTime: end.sourceTimeSeconds,
  easedWeight: eased.weight,
  refused: ['active seek', 'active replacement', 'nonfinite delta', 'context', 'target', 'clock', 'duration', 'timing', 'getter', 'disposed'],
}));
