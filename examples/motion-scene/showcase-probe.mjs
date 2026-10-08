import assert from 'node:assert/strict';
import { createMotionClip, createMotionTimeline, sampleMotionClip } from '../../packages/barocss-motion/dist/index.js';
import { showcaseScenarios } from './showcase-clips.mjs';

const source = structuredClone(showcaseScenarios);
const [transfer, inspection] = showcaseScenarios;
const transferClip = createMotionClip(transfer.clipInput);
const inspectionClip = createMotionClip(inspection.clipInput);
const pose = (frame, targetId) => frame.poses.find((item) => item.targetId === targetId);

assert.deepEqual(pose(sampleMotionClip(transferClip, 0), 'parcel').translation, [-105, 24, 0]);
assert.deepEqual(pose(sampleMotionClip(transferClip, 4.6), 'carriage').translation, [105, 145, 0]);
assert.deepEqual(pose(sampleMotionClip(transferClip, 4.6), 'parcel').translation, [105, 70, 0]);
assert.deepEqual(pose(sampleMotionClip(transferClip, 8), 'parcel').translation, [105, 24, 0]);
assert.deepEqual(pose(sampleMotionClip(inspectionClip, 3.5), 'carriage').translation, [0, 145, 0]);
assert.deepEqual(pose(sampleMotionClip(inspectionClip, 7), 'parcel').translation, [-105, 24, 0]);

let timeline = createMotionTimeline(transferClip, { version: 0, markers: transfer.markers, mode: 'clamp' });
timeline.play();
assert.deepEqual(timeline.advance(1.8).events.map((event) => event.id), ['grip']);
assert.equal(timeline.seek(4.6).events.length, 0);
assert.deepEqual(pose(timeline.getState(), 'parcel').translation, [105, 70, 0]);
timeline.dispose();
timeline = createMotionTimeline(inspectionClip, { version: 0, markers: inspection.markers, mode: 'clamp' });
assert.equal(timeline.getState().timeSeconds, 0);
timeline.play();
assert.deepEqual(timeline.advance(3.5).events.map((event) => event.id), ['grip', 'scan']);
timeline.pause();
timeline.dispose();
assert.deepEqual(showcaseScenarios, source);
console.log('showcase: two owned clips, visible poses, marker crossings, seek and clip replacement passed');
