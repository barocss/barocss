import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { packedConsumer } from './packed.mjs';

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(root, '../..');

test('packed ESM and declarations work in an independent consumer without source', async () => {
  const { scratch } = await packedConsumer('barocss-gpu-consumer-');
  try {
    await writeFile(path.join(scratch, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    await writeFile(path.join(scratch, 'consumer.mjs'), `
import assert from 'node:assert/strict';
import { parseScene, compileScene, createViewer, showScene } from '@barocss/gpu';
const source = '@scene consumer { version: 0; sphere #orb; } sphere { color: #ff0000; radius: 1; }';
const scene = parseScene(source);
const shader = compileScene(scene);
assert.match(shader.vertex, /#version 300 es/);
assert.match(shader.fragment, /#version 300 es/);
assert.equal(typeof createViewer, 'function');
assert.equal(typeof showScene, 'function');
assert.deepEqual(compileScene(parseScene(source)), shader);
assert.throws(() => parseScene('@scene broken { version: 0; sphere #orb; } #orb { radius: -1; }'));
// (One copy of each class across the entries: a refusal from one is an instance of another's class.)
const main = await import('@barocss/gpu'), viewerEntry = await import('@barocss/gpu/viewer'), apiEntry = await import('@barocss/gpu/api');
assert.equal(viewerEntry.ViewerError, main.ViewerError);
assert.equal(viewerEntry.Viewer, main.Viewer);
assert.equal(apiEntry.BarocssError, main.BarocssError);
assert.ok(new viewerEntry.ViewerError('DISPOSED', 'gone') instanceof main.BarocssError);
console.log('Packed ESM consumer passed');
`);
    const run = await exec(process.execPath, ['consumer.mjs'], { cwd: scratch, timeout: 30_000 });
    assert.match(run.stdout, /Packed ESM consumer passed/);
    await writeFile(path.join(scratch, 'consumer.ts'), `
import { parseScene, compileScene, createViewer, showScene } from '@barocss/gpu';
const scene = parseScene('@scene types { version: 0; }');
const shader: { vertex: string; fragment: string } = compileScene(scene);
declare const canvas: HTMLCanvasElement;
const viewer = await createViewer(canvas, { background: '#102030' });
const view = showScene(viewer, '@scene types { version: 0; }');
const result = view.update('@scene updated { version: 0; }');
if (!result.ok) { const diagnostics: unknown[] = result.diagnostics; void diagnostics; }
const shot: { width: number; height: number; data: Uint8Array } = await viewer.capture();
const bytes: Uint8Array = shot.data;
viewer.setSize(320, 240);
// @ts-expect-error source is a string, not executable arbitrary input
parseScene({ code: 'alert(1)' });
// @ts-expect-error canvas is required
createViewer('canvas');
view.dispose(); viewer.dispose();
void [shader, bytes];
`);
    await writeFile(path.join(scratch, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
      strict: true, noEmit: true, target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
      lib: ['ES2022', 'DOM'], types: [], skipLibCheck: false,
    }, include: ['consumer.ts'] }));
    const require = createRequire(path.join(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
    await exec(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', path.join(scratch, 'tsconfig.json')], { timeout: 30_000 });
  } finally { await rm(scratch, { recursive: true, force: true }); }
});
