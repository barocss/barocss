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

test('packed own compiler/IR and writable execution buffers work without source or CAD', async () => {
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
import { parseScene, compileScene, mountScene, mountMesh, validatePreviewPacket, prepareMesh, compileGpu } from '@barocss/gpu';
const source = '@scene consumer { version: 0; sphere #orb; } sphere { color: #ff0000; radius: 1; }';
const scene = parseScene(source);
const shader = compileScene(scene);
assert.match(shader.vertex, /#version 300 es/);
assert.match(shader.fragment, /#version 300 es/);
const sdf = compileGpu({kind:'scene',source});assert(sdf.ok);assert.equal(sdf.ir.pipeline,'sdf');assert.deepEqual(sdf.execution.shaders,shader);assert.equal(sdf.ast.name.text,'consumer');
assert.equal(typeof mountScene, 'function');
assert.equal(typeof mountMesh, 'function');
const literal = ${JSON.stringify(literal)};
assert.deepEqual(validatePreviewPacket(literal), literal);
const options = { mmToSceneUnit: .25, translate: [-1.125,-1.5,-.5], color: [1,.2,.1], background: [.04,.08,.12] };
const converted = prepareMesh(literal, options);
assert.equal(converted.packet.revision, 7);
const compiledMesh=compileGpu({kind:'mesh',packet:literal,options});assert(compiledMesh.ok);assert.equal(compiledMesh.ast,null);assert.equal(compiledMesh.ir.pipeline,'indexed-mesh');assert.deepEqual(compiledMesh.execution.mesh.positions,converted.positions);compiledMesh.execution.mesh.positions[0]=999;assert.notEqual(compiledMesh.ir.draws[0].packet.positions[0],999);assert.equal(compileGpu({kind:'scene',source:'invalid'}).ok,false);
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
    if(process.env.BAROCSS_GPU_COMPILER_EVIDENCE){const retained=path.join(process.env.BAROCSS_GPU_COMPILER_EVIDENCE,'consumer');await mkdir(retained,{recursive:true});await writeFile(path.join(retained,'archive.tgz'),await readFile(path.join(scratch,archives[0])));await writeFile(path.join(retained,'compiler-index.js'),await readFile(path.join(installed,'dist/index.js')));await writeFile(path.join(retained,'compiler-index.d.ts'),await readFile(path.join(installed,'dist/index.d.ts')));await writeFile(path.join(retained,'consumer.mjs'),await readFile(path.join(scratch,'consumer.mjs')));}
    const run = await exec(process.execPath, ['consumer.mjs'], { cwd: scratch, timeout: 30_000 });
    assert.match(run.stdout, /Packed ESM consumer passed/);
    await writeFile(path.join(scratch, 'consumer.ts'), `
import { parseScene, compileScene, mountScene, mountMesh, validatePreviewPacket, prepareMesh, compileGpu } from '@barocss/gpu';
const scene = parseScene('@scene types { version: 0; }');
const compiled = compileGpu({kind:'scene',source:'@scene typed {version:0;}'});
if(compiled.ok){const version:1=compiled.ir.schemaVersion;void version;if(compiled.execution.kind==='sdf'){const fragment:string=compiled.execution.shaders.fragment;void fragment;}}
// @ts-expect-error Unsupported authored IR is not a compiler input
compileGpu({kind:'ir',ir:{}});
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
const cameraOptions = { ...options, camera: { eye: [4,3,6] as [number,number,number], target: [0,0,0] as [number,number,number], up: [0,1,0] as [number,number,number], fovYDegrees: 45, near: .01, far: 100 } };
mesh.update(packet, cameraOptions);
// @ts-expect-error camera optics must all be explicit
mesh.update(packet, { ...options, camera: { eye: [0,0,6] } });
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
