import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createMotionClip, createMotionRangeTimeline, createMotionTimeline, MotionTimelineError,
  parseMotionClipFile, parseMotionMarkerFile,
} from '../../packages/barocss-motion/dist/index.js';

const clip = parseMotionClipFile(readFileSync(new URL('./assets/two-parts.baromotion', import.meta.url), 'utf8'));
const sidecar = parseMotionMarkerFile(readFileSync(new URL('./assets/two-parts.baromarkers', import.meta.url), 'utf8'), clip);
const marker = (id, timeSeconds) => ({ contextId: clip.contextId, id, timeSeconds });
const markers = [...sidecar, marker('range-start', 1), marker('range-end', 3)];
const timeline = createMotionRangeTimeline(clip, { range: [1, 3], markers, mode: 'clamp' });
const signature = (state) => state.events.map(({ id, timeSeconds, iteration, markerIndex }) =>
  `${id}@${timeSeconds}:${iteration}:${markerIndex}`);
const initial = timeline.getState();
assert.equal(initial.timeSeconds, 1);
assert.deepEqual(initial.range, [1, 3]);
initial.range[0] = 99;
assert.deepEqual(timeline.getState().range, [1, 3]);
timeline.play();
const middle = timeline.advance(1);
assert.deepEqual(signature(middle), ['mid-a@2:0:1', 'mid-b@2:0:2']);
assert.equal(middle.timeSeconds, 2);
const clampEnd = timeline.advance(1);
assert.deepEqual(signature(clampEnd), ['range-end@3:0:5']);
assert.equal(clampEnd.timeSeconds, 3);
assert.equal(clampEnd.playing, false);
assert.equal(timeline.play().timeSeconds, 1);
timeline.setMode('repeat');
timeline.seek(2);
timeline.play();
const seam = timeline.advance(1);
assert.deepEqual(signature(seam), ['range-end@3:0:5', 'range-start@1:1:4']);
assert.equal(seam.timeSeconds, 1);
assert.equal(seam.iteration, 1);
timeline.seek(1);
timeline.play();
const accepted = timeline.getState();
function reject(run, code) {
  assert.throws(run, (error) => error instanceof MotionTimelineError && error.code === code);
  assert.deepEqual(timeline.getState(), accepted);
}
reject(() => timeline.advance(34), 'LIMIT_EXCEEDED');
reject(() => timeline.advance(-1), 'INVALID_INPUT');
reject(() => timeline.seek(0), 'INVALID_INPUT');
reject(() => createMotionRangeTimeline(clip, { range: [1, 1], markers, mode: 'clamp' }), 'INVALID_INPUT');
reject(() => createMotionRangeTimeline(clip, { range: [0, 5], markers, mode: 'clamp' }), 'INVALID_INPUT');
let getterCalls = 0;
const getterOptions = { range: [1, 3], markers, mode: 'clamp' };
Object.defineProperty(getterOptions, 'mode', { get() { getterCalls += 1; return 'clamp'; } });
reject(() => createMotionRangeTimeline(clip, getterOptions), 'INVALID_INPUT');
assert.equal(getterCalls, 0);

const full = createMotionRangeTimeline(clip, { range: [0, 4], markers: sidecar, mode: 'repeat' });
const old = createMotionTimeline(clip, { version: 0, markers: sidecar, mode: 'repeat' });
const comparable = (state) => {
  const { range, ...rest } = state;
  return rest;
};
assert.deepEqual(comparable(full.getState()), old.getState());
assert.deepEqual(comparable(full.play()), old.play());
assert.deepEqual(comparable(full.advance(2)), old.advance(2));
assert.deepEqual(comparable(full.advance(2)), old.advance(2));
assert.deepEqual(comparable(full.advance(4)), old.advance(4));
assert.deepEqual(comparable(full.seek(-0)), old.seek(-0));
assert.equal(Object.is(full.getState().timeSeconds, -0), true);
assert.deepEqual(comparable(full.setMode('clamp')), old.setMode('clamp'));
assert.deepEqual(comparable(full.play()), old.play());
assert.deepEqual(comparable(full.seek(4)), old.seek(4));
assert.deepEqual(comparable(full.advance(1)), old.advance(1));
full.dispose();
old.dispose();

const instantClip = createMotionClip({
  version: 0, contextId: 'instant', durationSeconds: 0,
  tracks: [{ targetId: 'part', property: 'translation', interpolation: 'STEP',
    keys: [{ timeSeconds: 0, value: [0, 0, 0] }] }],
});
const instant = createMotionRangeTimeline(instantClip, { range: [-0, 0], markers: [], mode: 'repeat' });
instant.play();
assert.deepEqual(instant.advance(1).events, []);
assert.equal(Object.is(instant.getState().timeSeconds, 0), true);
instant.dispose();
timeline.dispose();
timeline.dispose();
assert.throws(() => timeline.getState(), (error) => error instanceof MotionTimelineError && error.code === 'DISPOSED');

console.log(JSON.stringify({
  files: ['two-parts.baromotion', 'two-parts.baromarkers'], range: [1, 3],
  middle: signature(middle), clampEnd: signature(clampEnd), seam: signature(seam),
  fullRangeMatchesOld: true, getterCalls, refused: ['wraps', 'negative delta', 'seek outside',
    'zero span', 'outside clip', 'getter'], zeroDurationEvents: 0,
}));
