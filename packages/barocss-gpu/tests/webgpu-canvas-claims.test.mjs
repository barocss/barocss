/** G3: every WebGPU viewport route shares one canvas custody set (structural guard). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

test('viewport routes claim canvases through the shared set, never a private one', async () => {
  const dir = new URL('../src/', import.meta.url), names = (await readdir(dir)).filter(n => /webgpu-viewport\.ts$/.test(n));
  assert.ok(names.length >= 3, names.join());
  for (const name of names) {
    const source = await readFile(new URL(name, dir), 'utf8');
    if (!/claims\.(has|add)\(canvas\)/.test(source)) continue;
    assert.match(source, /import \{ webgpuViewportCanvasClaims as claims \} from '\.\/webgpu-canvas-claims\.js';/, name);
    assert.doesNotMatch(source, /new WeakSet<HTMLCanvasElement>\(\)/, name);
  }
});
