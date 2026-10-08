import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  createMotionClip, createMotionPlayer, MotionFileError,
  parseMotionClipFile, serializeMotionClipFile,
} from '../../packages/barocss-motion/dist/index.js';
import { clipInput } from './clip.mjs';

const exampleDir = dirname(fileURLToPath(import.meta.url));
const assetDir = join(exampleDir, 'assets');
const assetPath = join(assetDir, 'two-parts.baromotion');
mkdirSync(assetDir, { recursive: true });

const authored = structuredClone(clipInput);
authored.tracks[0].keys[0].value[1] = -0;
authored.tracks[4].keys[1].value = [-0, -Math.SQRT1_2, -0, -Math.SQRT1_2];
const clip = createMotionClip(authored);
const text = serializeMotionClipFile(clip);
assert.ok(text.includes('[-75,-0,0]'));
assert.ok(text.includes('[-0,-0.7071067811865476,-0,-0.7071067811865476]'));
writeFileSync(assetPath, text, 'utf8');

const cold = spawnSync(process.execPath, [join(exampleDir, 'clip-file-cold-consumer.mjs'), assetPath], { encoding: 'utf8' });
assert.equal(cold.status, 0, cold.stderr);
process.stdout.write(cold.stdout);

const player = createMotionPlayer(clip, { mode: 'repeat' });
player.seek(2);
const prior = player.getState();
function reject(source, code) {
  assert.throws(() => parseMotionClipFile(source), (caught) => caught instanceof MotionFileError && caught.code === code);
  assert.deepEqual(player.getState(), prior);
}
reject(text.replace('"version":0', '"version":1'), 'INVALID_ENVELOPE');
reject(text.replace('"lengthUnit":"mm"', '"lengthUnit":"m"'), 'INVALID_ENVELOPE');
reject(text.replace('"coordinateSystem":"part-xyz"', '"coordinateSystem":"world-y-up"'), 'INVALID_ENVELOPE');
reject(text.replace('{"format":', '{"\\u0066ormat":"barocss-motion","format":'), 'DUPLICATE_FIELD');
reject(text.replace('-75', '1e400'), 'INVALID_JSON');
reject(text + ' '.repeat(1_048_576), 'FILE_TOO_LARGE');
let getterCalls = 0;
const withGetter = structuredClone(authored);
Object.defineProperty(withGetter, 'version', { enumerable: true, get() { getterCalls += 1; return 0; } });
assert.throws(() => serializeMotionClipFile(withGetter), (caught) => caught instanceof MotionFileError && caught.code === 'INVALID_CLIP');
assert.equal(getterCalls, 0);
assert.deepEqual(player.getState(), prior);

const wrongContext = structuredClone(authored);
wrongContext.contextId = 'different-assembly';
writeFileSync(join(assetDir, 'wrong-context.baromotion'), serializeMotionClipFile(wrongContext), 'utf8');
const unknownTarget = structuredClone(authored);
unknownTarget.tracks[3].targetId = 'part-c';
unknownTarget.tracks[4].targetId = 'part-c';
unknownTarget.tracks[5].targetId = 'part-c';
writeFileSync(join(assetDir, 'unknown-target.baromotion'), serializeMotionClipFile(unknownTarget), 'utf8');
console.log(JSON.stringify({
  assetPath,
  bytes: Buffer.byteLength(text, 'utf8'),
  rejectionCodes: ['INVALID_ENVELOPE', 'DUPLICATE_FIELD', 'INVALID_JSON', 'FILE_TOO_LARGE', 'INVALID_CLIP'],
  getterCalls,
  priorPlayerRetained: true,
}));
