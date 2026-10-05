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

test('packed additive mesh ESM and declarations work in an independent consumer without source', async () => {
  const literal = JSON.parse(await readFile(path.join(repo, 'examples/gpu-scene/mesh-flat-packet.json'), 'utf8'));
  const scratch = await mkdtemp(path.join(tmpdir(), 'barocss-gpu-mesh-consumer-'));
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
import { parseScene, compileScene, mountScene, mountMesh, validatePreviewPacket, prepareMesh } from '@barocss/gpu';
const source = '@scene consumer { version: 0; sphere #orb; } sphere { color: #ff0000; radius: 1; }';
const scene = parseScene(source);
const shader = compileScene(scene);
assert.match(shader.vertex, /#version 300 es/);
assert.match(shader.fragment, /#version 300 es/);
assert.equal(typeof mountScene, 'function');
assert.equal(typeof mountMesh, 'function');
const literal = ${JSON.stringify(literal)};
assert.deepEqual(validatePreviewPacket(literal), literal);
const options = { mmToSceneUnit: .25, translate: [-1.125,-1.5,-.5], color: [1,.2,.1], background: [.04,.08,.12] };
const converted = prepareMesh(literal, options);
assert.equal(converted.packet.revision, 7);
assert.equal(converted.packet.surfaceId, 'flat_patch');
literal.positions[0] = 999;
assert.equal(converted.packet.positions[0], 1);
assert.deepEqual(compileScene(parseScene(source)), shader);
assert.throws(() => parseScene('@scene broken { version: 0; sphere #orb; } #orb { radius: -1; }'));
console.log('Packed ESM consumer passed');
`);
    const run = await exec(process.execPath, ['consumer.mjs'], { cwd: scratch, timeout: 30_000 });
    assert.match(run.stdout, /Packed ESM consumer passed/);
    await writeFile(path.join(scratch, 'consumer.ts'), `
import { parseScene, compileScene, mountScene, mountMesh, validatePreviewPacket, prepareMesh } from '@barocss/gpu';
const scene = parseScene('@scene types { version: 0; }');
const shader: { vertex: string; fragment: string } = compileScene(scene);
declare const canvas: HTMLCanvasElement;
const renderer = mountScene(canvas, '@scene types { version: 0; }');
const result = renderer.update('@scene updated { version: 0; }');
if (!result.ok) { const failure: Error = result.error; void failure; }
const bytes: Uint8Array = renderer.readPixels();
renderer.resize(320, 240);
renderer.dispose();
// @ts-expect-error source is a string, not executable arbitrary input
parseScene({ code: 'alert(1)' });
// @ts-expect-error canvas is required
mountScene('canvas', 'scene');
const packet = { version: 0 as const, surfaceId: 'patch', revision: 0, lengthUnit: 'mm' as const, coordinateSystem: 'right-handed-y-up' as const, winding: 'ccw' as const, positions: [-1,-1,0,-1,1,0,1,-1,0,1,1,0], normals: [0,0,1,0,0,1,0,0,1,0,0,1], indices: [0,2,1,2,3,1], parameters: [0,0,0,1,1,0,1,1], bounds: { min: [-1,-1,0] as [number,number,number], max: [1,1,0] as [number,number,number] } };
const options = { mmToSceneUnit: 1, translate: [0,0,0] as [number,number,number], color: [1,0,0] as [number,number,number], background: [0,0,0] as [number,number,number] };
const mesh = mountMesh(canvas, packet, options);
const revision: number = mesh.revision;
const accepted = mesh.packet;
const updated = mesh.update(packet, options);
if (!updated.ok) { const error: Error = updated.error; void error; }
mesh.resize(64,64);
const pixels: Uint8Array = mesh.readPixels();
mesh.dispose();
// @ts-expect-error explicit scale and placement are required
mountMesh(canvas, packet);
void [shader, bytes, revision, accepted, pixels];
`);
    await writeFile(path.join(scratch, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
      strict: true, noEmit: true, target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
      lib: ['ES2022', 'DOM'], types: [], skipLibCheck: false,
    }, include: ['consumer.ts'] }));
    const require = createRequire(path.join(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
    await exec(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', path.join(scratch, 'tsconfig.json')], { timeout: 30_000 });
  } finally { await rm(scratch, { recursive: true, force: true }); }
});
