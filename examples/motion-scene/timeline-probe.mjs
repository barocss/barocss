import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createMotionClip, createMotionTimeline, MotionTimelineError, parseMotionClipFile,
} from '../../packages/barocss-motion/dist/index.js';

const asset = new URL('./assets/two-parts.baromotion', import.meta.url);
const clip = parseMotionClipFile(readFileSync(fileURLToPath(asset), 'utf8'));
const marker = (id, timeSeconds, extra = {}) => ({ contextId: clip.contextId, id, timeSeconds, ...extra });
const markers = [
  marker('start', 0, { label: 'Start' }),
  marker('mid-a', 2, { label: 'Midpoint A', targetId: 'part-a' }),
  marker('mid-b', 2, { label: 'Midpoint B', targetId: 'part-b' }),
  marker('end', 4, { label: 'End' }),
];
const timeline = createMotionTimeline(clip, { version: 0, markers, mode: 'clamp' });
const signature = (state) => state.events.map(({ id, iteration, markerIndex }) => `${id}:${iteration}:${markerIndex}`);
const reject = (fn, code, current = timeline) => {
  const prior = current.getState();
  assert.throws(fn, (error) => error instanceof MotionTimelineError && error.code === code);
  assert.deepEqual(current.getState(), prior);
};

assert.deepEqual(signature(timeline.play()), []);
const mid = timeline.advance(2);
assert.deepEqual(signature(mid), ['mid-a:0:1', 'mid-b:0:2']);
const midpointEvents = signature(mid);
assert.equal(mid.timeSeconds, 2);
assert.deepEqual(mid.poses.find((pose) => pose.targetId === 'part-a').translation, [-25, 10, 0]);
mid.events[0].id = 'caller-changed';
mid.poses[0].translation[0] = 999;
assert.equal(timeline.getState().poses[0].translation[0], -25);
assert.deepEqual(timeline.getState().events, []);

assert.deepEqual(signature(timeline.pause()), []);
assert.deepEqual(signature(timeline.advance(1)), []);
assert.equal(timeline.getState().timeSeconds, 2);
assert.deepEqual(signature(timeline.seek(2)), []);
assert.deepEqual(signature(timeline.play()), []);
const end = timeline.advance(2);
assert.deepEqual(signature(end), ['end:0:3']);
assert.equal(end.timeSeconds, 4);
assert.equal(end.playing, false);
assert.equal(timeline.play().timeSeconds, 0);
assert.deepEqual(signature(timeline.getState()), []);

timeline.setMode('repeat');
timeline.seek(2);
timeline.play();
const seam = timeline.advance(2);
assert.deepEqual(signature(seam), ['end:0:3', 'start:1:0']);
assert.equal(seam.timeSeconds, 0);
assert.equal(seam.iteration, 1);

timeline.seek(0);
timeline.play();
const multi = timeline.advance(8);
assert.deepEqual(signature(multi), [
  'mid-a:0:1', 'mid-b:0:2', 'end:0:3', 'start:1:0',
  'mid-a:1:1', 'mid-b:1:2', 'end:1:3', 'start:2:0',
]);
assert.equal(multi.timeSeconds, 0);
assert.equal(multi.iteration, 2);
reject(() => timeline.advance(68), 'LIMIT_EXCEEDED');
reject(() => timeline.advance(-1), 'INVALID_INPUT');

let getterCalls = 0;
const accessor = marker('bad', 1);
Object.defineProperty(accessor, 'label', { get() { getterCalls += 1; return 'unsafe'; } });
reject(() => createMotionTimeline(clip, { version: 0, markers: [accessor], mode: 'clamp' }), 'INVALID_INPUT');
assert.equal(getterCalls, 0);
reject(() => createMotionTimeline(clip, { version: 0, markers: [markers[1], markers[1]], mode: 'clamp' }), 'DUPLICATE_MARKER');
reject(() => createMotionTimeline(clip, { version: 0, markers: [marker('unknown', 1, { targetId: 'part-c' })], mode: 'clamp' }), 'UNKNOWN_TARGET');

const crowded = Array.from({ length: 256 }, (_, index) => marker(`m-${index}`, 1));
const eventLimited = createMotionTimeline(clip, { version: 0, markers: crowded, mode: 'repeat' });
eventLimited.play();
reject(() => eventLimited.advance(5), 'LIMIT_EXCEEDED', eventLimited);
eventLimited.dispose();

const zeroMarkers = createMotionTimeline(clip, { version: 0, markers: [], mode: 'repeat' });
zeroMarkers.play();
assert.deepEqual(zeroMarkers.advance(4).events, []);
assert.equal(zeroMarkers.getState().iteration, 1);
zeroMarkers.dispose();
const instantClip = createMotionClip({
  version: 0, contextId: 'instant', durationSeconds: 0,
  tracks: [{ targetId: 'part', property: 'translation', interpolation: 'STEP',
    keys: [{ timeSeconds: 0, value: [0, 0, 0] }] }],
});
const instant = createMotionTimeline(instantClip, { version: 0, mode: 'repeat', markers: [
  { contextId: 'instant', id: 'at-zero', timeSeconds: 0 },
] });
instant.play();
assert.deepEqual(instant.advance(1).events, []);
assert.equal(instant.getState().iteration, 0);
instant.dispose();
timeline.dispose();
timeline.dispose();
assert.throws(() => timeline.getState(), (error) => error instanceof MotionTimelineError && error.code === 'DISPOSED');

console.log(JSON.stringify({
  asset: fileURLToPath(asset),
  midpoint: { timeSeconds: mid.timeSeconds, events: midpointEvents },
  clampEnd: { timeSeconds: end.timeSeconds, events: signature(end), playing: end.playing },
  exactSeam: { timeSeconds: seam.timeSeconds, events: signature(seam), iteration: seam.iteration },
  twoPasses: { timeSeconds: multi.timeSeconds, events: signature(multi), iteration: multi.iteration },
  refused: ['LIMIT_EXCEEDED:seams', 'LIMIT_EXCEEDED:events', 'INVALID_INPUT:getter', 'DUPLICATE_MARKER', 'UNKNOWN_TARGET'],
  getterCalls,
  zeroDurationEvents: 0,
}));
