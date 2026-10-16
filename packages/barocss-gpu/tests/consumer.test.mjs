import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(root, '../..');

test('packed ESM and declarations work in an independent consumer without source', async () => {
  const scratch = await mkdtemp(path.join(tmpdir(), 'barocss-gpu-consumer-'));
  try {
    await exec('pnpm', ['pack', '--pack-destination', scratch], { cwd: root, timeout: 30_000 });
    const archives = (await readdir(scratch)).filter((name) => name.endsWith('.tgz'));
    assert.equal(archives.length, 1);
    const installed = path.join(scratch, 'node_modules/@barocss/gpu');
    await mkdir(installed, { recursive: true });
    await exec('tar', ['-xzf', path.join(scratch, archives[0]), '--strip-components=1', '-C', installed], { timeout: 30_000 });
    assert(!(await readdir(installed)).includes('src'), 'Packed consumer must not contain source');
    const manifest = JSON.parse(await readFile(path.join(installed, 'package.json'), 'utf8'));
    assert.equal(manifest.private, true);
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
