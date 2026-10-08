import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createMotionTimeline, MotionMarkerFileError, parseMotionClipFile,
  parseMotionMarkerFile, serializeMotionMarkerFile,
} from '../../packages/barocss-motion/dist/index.js';

const clipPath = new URL('./assets/two-parts.baromotion', import.meta.url);
const markerPath = new URL('./assets/two-parts.baromarkers', import.meta.url);
const clip = parseMotionClipFile(readFileSync(clipPath, 'utf8'));
const marker = (id, timeSeconds, extra = {}) => ({ contextId: clip.contextId, id, timeSeconds, ...extra });
const authored = [
  marker('start', -0, { label: 'Start' }),
  marker('mid-a', 2, { label: 'Part A midpoint', targetId: 'part-a' }),
  marker('mid-b', 2, { label: 'Part B midpoint', targetId: 'part-b' }),
  marker('end', 4, { label: 'End' }),
];
const serialized = serializeMotionMarkerFile(clip, authored);
assert.match(serialized, /"timeSeconds":-0/);
writeFileSync(markerPath, serialized, 'utf8');
const reopened = parseMotionMarkerFile(readFileSync(markerPath, 'utf8'), clip);
assert.deepEqual(reopened.map(({ id }) => id), authored.map(({ id }) => id));
assert.equal(Object.is(reopened[0].timeSeconds, -0), true);
assert.equal(serializeMotionMarkerFile(clip, reopened), serialized);

const edgeText = serializeMotionMarkerFile(clip, [marker('edge', -0, { label: 'x'.repeat(256) })]);
const edgePath = join(mkdtempSync(join(tmpdir(), 'barocss-motion-marker-')), 'max-label.baromarkers');
writeFileSync(edgePath, edgeText, 'utf8');
const edge = parseMotionMarkerFile(readFileSync(edgePath, 'utf8'), clip)[0];
assert.equal(edge.label.length, 256);
assert.equal(Object.is(edge.timeSeconds, -0), true);

const timeline = createMotionTimeline(clip, { version: 0, markers: reopened, mode: 'repeat' });
const signature = (state) => state.events.map(({ id, iteration, markerIndex }) => `${id}:${iteration}:${markerIndex}`);
timeline.play();
const midpoint = timeline.advance(2);
assert.deepEqual(signature(midpoint), ['mid-a:0:1', 'mid-b:0:2']);
const seam = timeline.advance(2);
assert.deepEqual(signature(seam), ['end:0:3', 'start:1:0']);
const accepted = timeline.getState();

function reject(run, code) {
  assert.throws(run, (error) => error instanceof MotionMarkerFileError && error.code === code);
  assert.deepEqual(timeline.getState(), accepted);
}

let getterCalls = 0;
const accessor = marker('unsafe', 1);
Object.defineProperty(accessor, 'label', { get() { getterCalls += 1; return 'unsafe'; } });
reject(() => serializeMotionMarkerFile(clip, [accessor]), 'INVALID_MARKER');
assert.equal(getterCalls, 0);
reject(() => serializeMotionMarkerFile(clip, Array(1)), 'INVALID_MARKER');
reject(() => serializeMotionMarkerFile(clip, [Object.assign(Object.create({ inherited: true }), marker('foreign', 1))]), 'INVALID_MARKER');
const hidden = marker('hidden', 1);
Object.defineProperty(hidden, 'unsupported', { value: true });
reject(() => serializeMotionMarkerFile(clip, [hidden]), 'INVALID_MARKER');
const cycle = marker('cycle', 1);
cycle.label = cycle;
reject(() => serializeMotionMarkerFile(clip, [cycle]), 'INVALID_MARKER');
reject(() => parseMotionMarkerFile(serialized.replace('"sample-assembly"', '"other-context"'), clip), 'INCOMPATIBLE_CLIP');
reject(() => parseMotionMarkerFile(serialized.replace('"durationSeconds":4', '"durationSeconds":3'), clip), 'INCOMPATIBLE_CLIP');
reject(() => parseMotionMarkerFile(serialized.replace('"targetId":"part-a"', '"targetId":"other"'), clip), 'INVALID_MARKER');
reject(() => parseMotionMarkerFile(serialized.replace('"id":"start"', '"id":"start","\\u0069d":"other"'), clip), 'INVALID_JSON');
reject(() => parseMotionMarkerFile(serialized.replace('"version":0', '"version":1'), clip), 'UNSUPPORTED_FORMAT');
reject(() => parseMotionMarkerFile(serialized + ' ', { ...clip, contextId: 'foreign' }), 'INVALID_INPUT');
reject(() => parseMotionMarkerFile(' '.repeat(262_145), clip), 'FILE_LIMIT');
assert.equal(getterCalls, 0);
timeline.dispose();

console.log(JSON.stringify({
  clip: fileURLToPath(clipPath), markerFile: fileURLToPath(markerPath), edgeFile: edgePath,
  bytes: Buffer.byteLength(serialized),
  signedZero: Object.is(reopened[0].timeSeconds, -0), labelBytes: Buffer.byteLength(edge.label),
  midpoint: signature(midpoint), seam: signature(seam), getterCalls,
  refused: ['INVALID_MARKER:getter', 'INVALID_MARKER:sparse', 'INVALID_MARKER:foreign',
    'INVALID_MARKER:hidden', 'INVALID_MARKER:cycle', 'INCOMPATIBLE_CLIP:context',
    'INCOMPATIBLE_CLIP:duration', 'INVALID_MARKER:target', 'INVALID_JSON:duplicate',
    'UNSUPPORTED_FORMAT:version', 'INVALID_INPUT:clip', 'FILE_LIMIT:bytes'],
}));
