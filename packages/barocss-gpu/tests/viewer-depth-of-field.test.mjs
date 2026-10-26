import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'viewer-focus-'));
let packOutput, Viewer;
try {
  const path = join(dir, 'source.mjs');
  await build({ stdin: { contents: "export {packOutput} from './lights.ts'; export {Viewer} from './viewer.ts';", resolveDir: fileURLToPath(new URL('../src/viewer/', import.meta.url)), loader: 'ts' }, outfile: path, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
  ({ packOutput, Viewer } = await import(pathToFileURL(path).href));
} finally { await rm(dir, { recursive: true, force: true }); }

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
test('depth of field preserves an exact disabled output block and scales only the pixel radius', () => {
  const frame = { inverseProjection: identity, pixelRatio: 2 }, base = packOutput({});
  for (const cfg of [false, { focus: 30, blur: 0 }, { focus: NaN, blur: 12 }, { focus: -1, blur: 12 }, { focus: 30, blur: Infinity }]) {
    assert.deepEqual(packOutput({ depthOfField: cfg }, [], 2, null, null, null, null, null, frame), base);
  }
  const block = new Float32Array(packOutput({ depthOfField: { focus: 30, blur: 12 } }, [], 2, null, null, null, null, null, frame));
  assert.deepEqual([...block.slice(-4)], [30, 24, 0, 0]);
  assert.deepEqual([...block.slice(44, 60)], identity, 'depth reconstruction uses the camera inverse projection even without AO');
});

test('depth of field releases its half-resolution resources once and restores the default state', () => {
  const destroyed = [], viewer = Object.assign(Object.create(Viewer.prototype), { focusPass: { color: { destroy() { destroyed.push('color'); } }, params: { destroy() { destroyed.push('params'); } } } });
  viewer.releaseFocus(); viewer.releaseFocus();
  assert.deepEqual(destroyed, ['color', 'params']);
  assert.equal(viewer.focusPass, null);
});
