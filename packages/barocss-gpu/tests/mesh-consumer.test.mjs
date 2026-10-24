import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { packedConsumer } from './packed.mjs';

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(root, '../..');

test('packed additive mesh ESM and declarations work in an independent consumer without source', async () => {
  const literal = JSON.parse(await readFile(path.join(repo, 'examples/gpu-scene/mesh-flat-packet.json'), 'utf8'));
  const { scratch } = await packedConsumer('barocss-gpu-mesh-consumer-');
  try {
    await writeFile(path.join(scratch, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    await writeFile(path.join(scratch, 'consumer.mjs'), `
import assert from 'node:assert/strict';
import { parseScene, compileScene, createViewer, showScene, validatePreviewPacket, prepareMesh } from '@barocss/gpu';
const source = '@scene consumer { version: 0; sphere #orb; } sphere { color: #ff0000; radius: 1; }';
const scene = parseScene(source);
const shader = compileScene(scene);
assert.match(shader.vertex, /#version 300 es/);
assert.match(shader.fragment, /#version 300 es/);
assert.equal(typeof createViewer, 'function');
assert.equal(typeof showScene, 'function');
const literal = ${JSON.stringify(literal)};
assert.deepEqual(validatePreviewPacket(literal), literal);
const options = { mmToSceneUnit: .25, translate: [-1.125,-1.5,-.5], color: [1,.2,.1], background: [.04,.08,.12] };
const converted = prepareMesh(literal, options);
assert.equal(converted.packet.revision, 7);
assert.equal(Object.hasOwn(converted.options, 'camera'), false);
const camera = { eye: [4,3,6], target: [0,0,0], up: [0,1,0], fovYDegrees: 45, near: .01, far: 100 };
const viewed = prepareMesh(literal, { ...options, camera });
assert.deepEqual(viewed.packet, converted.packet);
camera.eye[0] = 999;
assert.equal(viewed.options.camera.eye[0], 4);
assert.throws(() => prepareMesh(literal, { ...options, camera: { ...camera, near: 100, far: 1 } }));
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
import { parseScene, compileScene, createViewer, showScene, validatePreviewPacket, prepareMesh } from '@barocss/gpu';
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
const packet = { version: 0 as const, surfaceId: 'patch', revision: 0, lengthUnit: 'mm' as const, coordinateSystem: 'right-handed-z-up' as const, winding: 'ccw' as const, positions: [-1,-1,0,-1,1,0,1,-1,0,1,1,0], normals: [0,0,1,0,0,1,0,0,1,0,0,1], indices: [0,2,1,2,3,1], parameters: [0,0,0,1,1,0,1,1], bounds: { min: [-1,-1,0] as [number,number,number], max: [1,1,0] as [number,number,number] } };
const options = { mmToSceneUnit: 1, translate: [0,0,0] as [number,number,number], color: [1,0,0] as [number,number,number], background: [0,0,0] as [number,number,number] };
const prepared = prepareMesh(packet, options);
const mesh = viewer.add({ positions: prepared.positions, normals: prepared.normals, indices: prepared.indices }, { material: { color: options.color } });
mesh.remove();
// @ts-expect-error a geometry needs positions
viewer.add({ normals: [0, 0, 1] });
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
