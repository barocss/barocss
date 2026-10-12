/** #1579 bounded real-provider source/emitted/DTS/original-file/cold qualifier.
 * node examples/gpu-scene/native-directional-light-webgpu-flow.mjs --output ABS_FRESH
 * CPU bytes and deterministic software platform control flow are NOT genuine GPU evidence.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { resolve, dirname, isAbsolute, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { build } from 'esbuild';
import ts from 'typescript';
import { createSoftwarePlatform, assertNativeMountUploads, counters } from '../../packages/barocss-gpu/tests/native-directional-light-webgpu-viewport.test.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), pkg = resolve(repo, 'packages/barocss-gpu');
const base = '0b662981de31545b4fa42a9f78d5056f11f312bd';
const additions = ['mountNativeDirectionalLightWebGPUViewport', 'NativeDirectionalLightWebGPUError', 'NativeDirectionalLightWebGPUDiagnosticCode'];
const interfaces = ['NativeDirectionalLightWebGPURequest', 'NativeDirectionalLightWebGPUOptions', 'NativeDirectionalLightWebGPUViewport', 'NativeDirectionalLightWebGPUStatus', 'NativeDirectionalLightWebGPULimits', 'NativeDirectionalLightWebGPUResources', 'NativeDirectionalLightWebGPUPick', 'NativeDirectionalLightWebGPUFrameOptions'];
const owned = ['packages/barocss-gpu/src/native-directional-light-webgpu-frame.ts', 'packages/barocss-gpu/src/native-directional-light-webgpu-viewport.ts', 'packages/barocss-gpu/tests/native-directional-light-webgpu-viewport.test.mjs', 'examples/gpu-scene/native-directional-light-webgpu-flow.mjs', 'packages/barocss-gpu/src/index.ts', 'packages/barocss-gpu/README.md'];
const hash = value => createHash('sha256').update(value).digest('hex');
function signed(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  return Array.isArray(value) || ArrayBuffer.isView(value) ? '[' + Array.from(value, signed).join(',') + ']'
    : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + signed(value[key])).join(',') + '}';
}
const clone = value => JSON.parse(signed(value));
function frozen(value) { if (value && typeof value === 'object' && !ArrayBuffer.isView(value)) { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } }
function refs(value, set = new Set()) { if (value && typeof value === 'object' && !set.has(value)) { set.add(value); if (ArrayBuffer.isView(value)) set.add(value.buffer); else Object.values(value).forEach(child => refs(child, set)); } return set; }
function independent(a, b) { const right = refs(b); for (const value of refs(a)) assert.ok(!right.has(value)); }
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', timeout: 30000 }).trimEnd();
const baseFile = path => execFileSync('git', ['show', base + ':' + path], { cwd: repo, encoding: 'utf8' });
const f32 = values => { const bytes = new Uint8Array(values.length * 4), view = new DataView(bytes.buffer); values.forEach((value, i) => view.setFloat32(4 * i, value, true)); return bytes; };
const u16 = values => { const bytes = new Uint8Array(Math.ceil(values.length * 2 / 4) * 4), view = new DataView(bytes.buffer); values.forEach((value, i) => view.setUint16(2 * i, value, true)); return bytes; };
const viewExpected = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -0, -0, -6, 1];
function projectionExpected(width, height) { const focal = 1 / Math.tan(Math.PI / 6); return [focal / (width / height), 0, 0, 0, 0, focal, 0, 0, 0, 0, -(100 + .1) / (100 - .1), -1, 0, 0, -2 * 100 * .1 / (100 - .1), 0]; }
const sourceB = '@model tilted_original { version:0; length-unit:mm;\n@curve #retained_sibling { type:nurbs; degree:1; knots:[-0,-0,1,1]; control-points:[[-0,0,-0],[1,0,-0]]; weights:[1,1]; }\n@surface #plane_nonunit { type:nurbs; degree-u:1; degree-v:1; knots-u:[-2,-2,6,6]; knots-v:[3,3,11,11]; control-points:[[[0,0,0],[0,3,1]],[[2,0,1],[2,3,2]]]; weights:[[1,1],[1,1]]; }\n}\n';
const materialSource = '/* Complete original é😀 / signed -0 */\r\n@shader #palette { @uniform amount:float(-0,1,.25); @uniform alpha:float(-0,1,-0); @fragment {color:mix(#000,#fff,(amount+alpha)*.5);} }\r\n';
const transforms = [{ translationMm: [4, -2, 8], rotationXYZW: [0, 0, 1, 0], scale: [2, 3, 4] }, { translationMm: [-4, 2, -8], rotationXYZW: [1, 0, 0, 0], scale: [2, 3, 4] }];
function rebuild(cad, gpu, template, sources, css) {
  const request = clone(template);
  for (const entry of request.frame.scene.entries) {
    const index = entry.ref.modelId === 'asset_left' ? 0 : 1;
    const compiled = cad.compileCadModel(sources[index], { sourceVersion: 0 }); assert.equal(compiled.ok, true, JSON.stringify(compiled));
    const surface = compiled.model.objects.find(object => object.kind === 'surface' && object.id === entry.ref.geometryId); assert.ok(surface);
    const packet = cad.tessellateSurface(surface, { countU: 5, countV: 3, revision: 7 }).packet;
    if (entry.packet) assert.equal(signed(entry.packet), signed(packet), 'Saved packet is checked, never authoritative for cold reconstruction');
    entry.packet = clone(packet);
  }
  for (const item of request.frame.materials) {
    const compiled = gpu.compileMeshMaterial(css); assert.equal(compiled.ok, true, JSON.stringify(compiled));
    if (item.binding.material) assert.equal(signed(item.binding.material), signed(compiled.material));
    item.binding.material = clone(compiled.material);
  }
  return request;
}
function verify(result, input, width, height) {
  assert.equal(signed(result.request), signed(input)); frozen(result); independent(result, input);
  const N = input.frame.scene.entries.length, geometryBytes = N * (15 * 3 * 4 * 2 + 48 * 2);
  assert.deepEqual(result.resources, { geometryBytes, uniformBytes: 368 * N, colorIdentityBytes: 8 * width * height,
    depthTexels: width * height, depthBudgetBytes: 4 * width * height, chargedBytes: geometryBytes + 368 * N + 12 * width * height,
    readbackBytes: Math.ceil(4 * width / 256) * 256 * height, buffers: 7 * N, textures: 3, bindGroups: N, pipelines: N });
  assert.equal(result.draws.length, N);
  for (let i = 0; i < N; i++) {
    const draw = result.draws[i], entry = input.frame.scene.entries[i], originalIndex = entry.ref.modelId === 'asset_left' ? 0 : 1;
    assert.deepEqual(draw.ref, entry.ref); assert.equal(draw.identity, i + 1); assert.equal(draw.indexCount, 48);
    assert.deepEqual(draw.abi.bindings, [144, 64, 144, 16].map((byteLength, binding) => ({ group: 0, binding, byteLength, visibility: binding ? 'fragment' : 'vertex-fragment' })));
    assert.deepEqual(draw.abi.vertexBuffers, [0, 1].map(slot => ({ slot, shaderLocation: slot, arrayStride: 12, format: 'float32x3' })));
    assert.equal(draw.program.vertexEntryPoint, 'vertexMain'); assert.equal(draw.program.fragmentEntryPoint, 'fragmentMain');
    for (let binding = 0; binding < 4; binding++) assert.match(draw.program.code, new RegExp('@group\\(0\\) @binding\\(' + binding + '\\)'));
    assert.match(draw.program.code, /@builtin\(position\)/); assert.match(draw.program.code, /@location\(1\) identity: u32/);
    const expectedFrame = new Uint8Array(144); expectedFrame.set(f32(viewExpected)); expectedFrame.set(f32(projectionExpected(width, height)), 64); expectedFrame.set(f32(entry.color), 128);
    assert.deepEqual(draw.uniforms.frame, expectedFrame, 'Every frame coefficient and padding byte');
    const expectedDraw = new Uint8Array(16); new DataView(expectedDraw.buffer).setUint32(0, i + 1, true); assert.deepEqual(draw.uniforms.draw, expectedDraw);
    const material = input.frame.materials.find(item => signed(item.ref) === signed(entry.ref));
    const expectedMaterial = new Uint8Array(64), mv = new DataView(expectedMaterial.buffer);
    if (material) { mv.setFloat32(0, (material.binding.uniforms?.amount ?? .25) || 0, true); mv.setFloat32(4, (material.binding.uniforms?.alpha ?? -0) || 0, true); }
    assert.deepEqual(draw.uniforms.material, expectedMaterial, 'Complete program material bytes including zero padding');
    const expectedLights = new Uint8Array(144), lv = new DataView(expectedLights.buffer); lv.setFloat32(0, input.lights.ambientStrength, true);
    input.lights.lights.forEach((light, index) => {
      const scale = Math.max(...light.directionScene.map(Math.abs)), scaled = light.directionScene.map(x => x / scale), length = Math.hypot(...scaled);
      scaled.forEach((x, axis) => lv.setFloat32(16 + 32 * index + 4 * axis, x / length, true));
      lv.setFloat32(28 + 32 * index, light.enabled ? light.intensity : 0, true);
      light.colorLinearRGB.forEach((x, axis) => lv.setFloat32(32 + 32 * index + 4 * axis, x, true));
    }); assert.deepEqual(draw.uniforms.lights, expectedLights, 'Complete light ABI including disabled slots and padding');
    const points = [], normals = [], indices = [], rawNormals = originalIndex ? [-3 / 2, 2 / 3, -6 / 4] : [0, 0, 1], length = Math.hypot(...rawNormals);
    for (let u = 0; u < 5; u++) for (let v = 0; v < 3; v++) {
      const p = [2 * u / 4, 3 * v / 2, originalIndex ? u / 4 + v / 2 : 0];
      const rotated = originalIndex ? [p[0] * 2, -p[1] * 3, -p[2] * 4] : [-p[0] * 2, -p[1] * 3, p[2] * 4];
      points.push(...rotated.map((x, axis) => .125 * (x + transforms[originalIndex].translationMm[axis]) + input.frame.options.translate[axis]));
      normals.push(...rawNormals.map(x => x / length));
      if (u < 4 && v < 2) { const a = u * 3 + v, b = a + 3; indices.push(a, b, a + 1, b, b + 1, a + 1); }
    }
    const actualPoints = new DataView(draw.positions.buffer), actualNormals = new DataView(draw.normals.buffer);
    points.forEach((x, at) => assert.ok(Math.abs(actualPoints.getFloat32(at * 4, true) - Math.fround(x)) < 1e-6));
    normals.forEach((x, at) => assert.ok(Math.abs(actualNormals.getFloat32(at * 4, true) - Math.fround(x)) < 1e-6));
    assert.deepEqual(draw.indices, u16(indices));
  }
}

assert.equal(Number(process.versions.node.split('.')[0]), 22);
assert.equal(process.argv.length, 4); assert.equal(process.argv[2], '--output'); assert.ok(isAbsolute(process.argv[3]));
const output = resolve(process.argv[3]); await mkdir(output, { recursive: false });
async function save(name, bytes) { const path = resolve(output, name); await writeFile(path, bytes, { flag: 'wx' }); const data = await readFile(path); return { path, bytes: data.length, sha256: hash(data) }; }
const delta = [...new Set([...git('diff', '--name-only', base).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')].filter(Boolean))].sort();
assert.deepEqual(delta, [...owned].sort());
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8')); assert.deepEqual(manifest, JSON.parse(baseFile('packages/barocss-gpu/package.json')));
const parentBarrel = baseFile('packages/barocss-gpu/src/index.ts'); assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(parentBarrel));
const ast = ts.createSourceFile('parent.ts', parentBarrel, ts.ScriptTarget.Latest, true), oldNames = ast.statements.filter(node => ts.isExportDeclaration(node) && !node.isTypeOnly && node.exportClause && ts.isNamedExports(node.exportClause)).flatMap(node => node.exportClause.elements.filter(e => !e.isTypeOnly).map(e => e.name.text));
const namespace = [...oldNames, ...additions].sort(), sourceGraph = [];
async function bundle(entry, name) {
  const path = resolve(output, name), result = await build({ absWorkingDir: repo, entryPoints: [entry], alias: { '@barocss/cad': resolve(repo, 'packages/barocss-cad/src/index.ts') }, bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: path, metafile: true });
  const physical = await realpath(repo);
  for (const input of Object.keys(result.metafile.inputs)) {
    const absolute = resolve(repo, input); assert.ok((await realpath(absolute)).startsWith(physical + sep));
    const local = relative(repo, absolute).replaceAll('\\', '/');
    if (local.includes('/src/') && !owned.includes(local)) assert.equal((await readFile(absolute)).toString(), baseFile(local));
    sourceGraph.push({ path: local, sha256: hash(await readFile(absolute)) });
  }
  return path;
}
const publicSource = await bundle(resolve(pkg, 'src/index.ts'), 'source-public.mjs');
const privateSource = await bundle(resolve(pkg, 'src/native-directional-light-webgpu-frame.ts'), 'source-private.mjs');
const privateEmitted = await bundle(resolve(pkg, 'dist/native-directional-light-webgpu-frame.js'), 'emitted-private.mjs');
const cadPath = await bundle(resolve(repo, 'packages/barocss-cad/src/index.ts'), 'cad-source.mjs'), cad = await import(pathToFileURL(cadPath).href);
const providers = [{ label: 'source', path: publicSource, privatePath: privateSource }, { label: 'emitted', path: resolve(pkg, 'dist/index.js'), privatePath: privateEmitted }];
const dts = await readFile(resolve(pkg, 'dist/index.d.ts'), 'utf8'), leaf = await readFile(resolve(pkg, 'dist/native-directional-light-webgpu-frame.d.ts'), 'utf8');
assert.equal(/export.*PreparedNativeDirectionalLightWebGPUFrame/.test(dts), false);
assert.deepEqual([...leaf.matchAll(/export interface (NativeDirectionalLightWebGPU\w+)/g)].map(m => m[1]).sort(), [...interfaces].sort());
for (const name of [...interfaces, ...additions]) assert.match(dts, new RegExp('\\b' + name + '\\b'));
const typeFile = await save('public-types.mts', `import {mountNativeDirectionalLightWebGPUViewport,NativeDirectionalLightWebGPUError,NativeDirectionalLightWebGPUDiagnosticCode} from ${JSON.stringify(resolve(pkg, 'dist/index.js'))};\nimport type {${interfaces.join(',')}} from ${JSON.stringify(resolve(pkg, 'dist/index.js'))};\ndeclare const canvas:HTMLCanvasElement; declare const request:NativeDirectionalLightWebGPURequest; const options:NativeDirectionalLightWebGPUOptions={width:65,height:3}; const mounted:Promise<NativeDirectionalLightWebGPUViewport>=mountNativeDirectionalLightWebGPUViewport(canvas,request,options); void mounted;\nconst code:NativeDirectionalLightWebGPUDiagnosticCode='PROGRAM'; new NativeDirectionalLightWebGPUError(code,'reason',undefined);\ntype Observations=[NativeDirectionalLightWebGPUStatus,NativeDirectionalLightWebGPULimits,NativeDirectionalLightWebGPUResources,NativeDirectionalLightWebGPUPick,NativeDirectionalLightWebGPUFrameOptions];\n// @ts-expect-error no private preparation token in public namespace\nimport {prepareNativeDirectionalLightWebGPUFrame} from ${JSON.stringify(resolve(pkg, 'dist/index.js'))};\n`);
execFileSync(process.execPath, [resolve(repo, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', typeFile.path], { cwd: repo, timeout: 120000, stdio: 'pipe' });
const fixturePath = 'examples/gpu-scene/fixtures/area-revision1.cad-document.json', fixture = await readFile(resolve(repo, fixturePath), 'utf8'); assert.equal(fixture, baseFile(fixturePath));
const sources = [JSON.parse(fixture).assets[0].source, sourceB];
const sourceFiles = await Promise.all(sources.map((source, i) => save('original-' + i + '.source0.css', source))), cssFile = await save('original.material.css', materialSource);
const template = { format: 'barocss-gpu-native-directional-light-webgpu-request', version: 0, frame: { version: 0, scene: { version: 2,
  entries: sources.map((_, i) => ({ kind: 'surface', ref: { modelId: i ? 'asset_right' : 'asset_left', geometryId: 'plane_nonunit' }, color: i ? [.2, .4, .8] : [.8, .4, .2], transform: clone(transforms[i]) })) },
  options: { mmToSceneUnit: .125, translate: [1, -2, .5], background: [.1, .2, .3], camera: { eye: [0, 0, 6], target: [0, 0, 0], up: [0, 2, 0], fovYDegrees: 60, near: .1, far: 100 } }, particles: null,
  materials: sources.map((_, i) => ({ ref: { modelId: i ? 'asset_right' : 'asset_left', geometryId: 'plane_nonunit' }, binding: { uniforms: i ? { amount: -0, alpha: -0 } : {} } })) },
  lights: { format: 'barocss-gpu-native-directional-lights', version: 0, profile: 'native-world-directional-linear-v0', sourceId: 'authored_scene', revision: 7, ambientStrength: .125,
    lights: [{ nodeId: 'red', label: 'Original red +X', enabled: true, directionScene: [2, -0, 0], colorLinearRGB: [1, 0, 0], intensity: .75 }, { nodeId: 'blue', label: 'Original blue +Z', enabled: true, directionScene: [0, 0, 3], colorLinearRGB: [0, 0, 1], intensity: .5 }] } };
const width = 65, height = 3, records = [], refusals = [], runtimeRows = []; let getterCalls = 0;
for (const provider of providers) {
  const gpu = await import(pathToFileURL(provider.path).href), internal = await import(pathToFileURL(provider.privatePath).href), prepare = internal.prepareNativeDirectionalLightWebGPUFrame;
  assert.deepEqual(Object.keys(gpu).sort(), namespace);
  const input = rebuild(cad, gpu, template, sources, materialSource), h = createSoftwarePlatform(); let viewport;
  try {
    viewport = await gpu.mountNativeDirectionalLightWebGPUViewport(h.canvas, input, { width, height });
    assertNativeMountUploads(h, prepare(input, width, height));
    const cases = [['original', () => {}], ['zero_lights', r => r.lights.lights = []], ['four_lights_disabled', r => { r.lights.lights.push({ ...clone(r.lights.lights[0]), nodeId: 'green', colorLinearRGB: [0, 1, 0] }, { ...clone(r.lights.lights[1]), nodeId: 'disabled', enabled: false }); }], ['edit_direction_color_intensity', r => { r.lights.lights[0].directionScene = [-2, 3, 4]; r.lights.lights[0].colorLinearRGB = [.2, .5, .7]; r.lights.lights[0].intensity = .9; }], ['remove_reorder_lights', r => { r.lights.lights.reverse(); r.lights.lights.pop(); }], ['unbound', r => r.frame.materials = []], ['material_edit', r => r.frame.materials[0].binding.uniforms.amount = .75], ['surface_reorder', r => r.frame.scene.entries.reverse()], ['surface_remove', r => { r.frame.scene.entries.pop(); r.frame.materials.pop(); }]];
    for (const [variant, edit] of cases) {
      const request = clone(input); edit(request); const before = signed(request), prepared = prepare(request, width, height); verify(prepared, request, width, height);
      const at = counters(h); assert.deepEqual(await viewport.updateFrame(request), { ok: true }); assertNativeMountUploads(h, prepared, at);
      assert.equal(signed(request), before); assert.equal(signed(viewport.originals), before); frozen(viewport.originals); independent(viewport.originals, viewport.originals);
      const file = await save(provider.label + '.' + variant + '.raw-request.json', before + '\n'), files = [file];
      for (let i = 0; i < prepared.draws.length; i++) { const draw = prepared.draws[i]; files.push(await save(provider.label + '.' + variant + '.' + i + '.wgsl', draw.program.code)); for (const [name, bytes] of Object.entries({ positions: draw.positions, normals: draw.normals, indices: draw.indices, ...draw.uniforms })) files.push(await save(provider.label + '.' + variant + '.' + i + '.' + name + '.bin', bytes)); }
      records.push({ provider: provider.label, variant, request: file, files, signature: hash(signed(prepared)) });
      runtimeRows.push({ provider: provider.label, variant, generation: viewport.status.generation, resources: viewport.status.resources });
    }
    assert.deepEqual(await viewport.updateFrame(input), { ok: true }); assert.deepEqual(viewport.select(input.frame.scene.entries[1].ref), { ok: true });
    const stable = signed(viewport.originals), status = viewport.status, selection = viewport.selected, softwarePixels = h.canvas.presented.bytes.slice();
    async function refuse(label, request, code, inspect) {
      let error; try { prepare(request, width, height); } catch (cause) { error = cause; }
      assert.ok(error instanceof internal.NativeDirectionalLightWebGPUError, label); assert.equal(error.code, code, label); if (inspect) inspect(error);
      const events = h.records.events.length, result = await viewport.updateFrame(request); assert.equal(result.ok, false); assert.equal(result.error.code, code);
      assert.equal(signed(viewport.originals), stable); assert.deepEqual(viewport.status, status); assert.deepEqual(viewport.selected, selection); assert.deepEqual(h.canvas.presented.bytes, softwarePixels); assert.equal(h.records.events.length, events);
      refusals.push({ provider: provider.label, label, code, causeCode: error.cause?.code ?? null });
    }
    const bad = edit => { const r = clone(input); edit(r); return r; };
    for (const [label, edit, code] of [
      ['fifth_light', r => r.lights.lights = Array(5).fill(r.lights.lights[0]), 'BUDGET'], ['empty_surface', r => r.frame.scene.entries = [], 'BUDGET'],
      ['curve_kind', r => r.frame.scene.entries[0].kind = 'curve', 'PROFILE'], ['wrong_scene_profile', r => r.frame.scene.version = 1, 'PROFILE'],
      ['legacy_lighting_undefined', r => r.frame.options.lighting = undefined, 'PROFILE'], ['legacy_lighting_zero', r => r.frame.options.lighting = 0, 'PROFILE'],
      ['duplicate_pair', r => r.frame.scene.entries[1].ref = clone(r.frame.scene.entries[0].ref), 'FRAME'], ['unknown_material_target', r => r.frame.materials[0].ref.modelId = 'absent', 'FRAME'],
      ['material_source_ir_disagreement', r => r.frame.materials[0].binding.material.source += '!', 'FRAME'], ['camera_singular', r => r.frame.options.camera.target = [0, 0, 6], 'FRAME'],
      ['nonfinite', r => r.lights.lights[0].intensity = Infinity, 'INPUT'], ['local_f32_color_loss', r => r.frame.scene.entries[0].color[0] = 1e-50, 'REPRESENTATION'],
      ['program_f32_light_loss', r => r.lights.lights[0].colorLinearRGB[0] = 1e-50, 'PROGRAM'], ['nonfinite_symbol', r => r[Symbol('extra')] = 1, 'INPUT'],
      ['hidden', r => Object.defineProperty(r.frame, 'hidden', { value: 1 }), 'INPUT'], ['getter', r => Object.defineProperty(r.lights, 'ambientStrength', { enumerable: true, get() { getterCalls++; return .1; } }), 'INPUT'],
      ['sparse', r => delete r.frame.scene.entries[0], 'INPUT'], ['cycle', r => r.frame.scene.entries[0].extra = r, 'INPUT'], ['uv_extra', r => r.frame.scene.entries[0].uv01 = [0, 0], 'FRAME'],
      ['raw_string_limit', r => r.lights.sourceId = 'a'.repeat(65537), 'BUDGET'], ['record65', r => r.frame.scene.entries[0].extra = Object.fromEntries(Array.from({ length: 65 }, (_, i) => ['f' + i, i])), 'BUDGET'],
      ['nested_array24577', r => r.frame.scene.entries[0].extra = Array(24577).fill(0), 'BUDGET'],
    ]) await refuse(label, bad(edit), code);
    await refuse('foreign_root', vm.runInNewContext('(' + signed(input) + ')'), 'INPUT');
    await refuse('prepared_not_token', prepare(input, width, height), 'INPUT');
    for (const marker of [undefined, new Error('reflection marker'), new internal.NativeDirectionalLightWebGPUError('PROGRAM', 'marker')]) await refuse('proxy_exact_cause', new Proxy(input, { getPrototypeOf() { throw marker; } }), 'INPUT', error => { assert.ok(Object.hasOwn(error, 'cause')); assert.strictEqual(error.cause, marker); });
    const long = clone(input); const modelId = 'M'.repeat(128); long.frame.scene.entries[1].ref.modelId = modelId; long.frame.materials[1].ref.modelId = modelId;
    assert.deepEqual(await viewport.updateFrame(long), { ok: true }); assert.deepEqual(viewport.select(long.frame.scene.entries[1].ref), { ok: true });
    assert.equal(viewport.selected.modelId.length, 128);
    const resized = prepare(viewport.originals, 17, 9), at = counters(h); assert.deepEqual(await viewport.resize(17, 9), { ok: true }); assertNativeMountUploads(h, resized, at);
    assert.equal(signed(viewport.originals), signed(long));
    const rounding = clone(input); rounding.frame.scene.entries[0].color[0] = .1; assert.equal(prepare(rounding, width, height).draws[0].uniforms.frame.length, 144);
    for (const record of records) for (const file of record.files) assert.equal(hash(await readFile(file.path)), file.sha256);
  } finally { viewport?.dispose(); h.assertReleased(); h.restore(); }
}
assert.equal(getterCalls, 0);
for (const row of records.filter(row => row.provider === 'source')) assert.equal(row.signature, records.find(other => other.provider === 'emitted' && other.variant === row.variant).signature);
const coldCode = `import assert from 'node:assert/strict'; import {readFileSync} from 'node:fs'; import {pathToFileURL} from 'node:url'; import {createHash} from 'node:crypto';
const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')), hash=v=>createHash('sha256').update(v).digest('hex');
${signed.toString()}\n${rebuild.toString()}\nconst clone=v=>JSON.parse(signed(v));
const cad=await import(pathToFileURL(cfg.cadPath).href); const sources=cfg.sourceFiles.map(f=>readFileSync(f.path,'utf8')), css=readFileSync(cfg.cssFile.path,'utf8');
const {observeSoftwareRuntime}=await import(pathToFileURL(cfg.testModule).href); const rows=[];
for(const provider of cfg.providers){const publicAPI=await import(pathToFileURL(provider.path).href), internal=await import(pathToFileURL(provider.privatePath).href), gpu={...publicAPI,...internal};
for(const record of cfg.records.filter(r=>r.provider===provider.label)){for(const file of [...record.files,...cfg.sourceFiles,cfg.cssFile])assert.equal(hash(readFileSync(file.path)),file.sha256);
const saved=JSON.parse(readFileSync(record.request.path,'utf8')), request=rebuild(cad,gpu,saved,sources,css), result=internal.prepareNativeDirectionalLightWebGPUFrame(request,cfg.width,cfg.height); assert.equal(hash(signed(result)),record.signature);
const softwareRuntime=await observeSoftwareRuntime(gpu,request,cfg.width,cfg.height); rows.push({provider:provider.label,variant:record.variant,signature:record.signature,softwareRuntime});}}
console.log(JSON.stringify({pid:process.pid,ppid:process.ppid,rows,authority:'Saved complete original CAD and material files recompiled; raw catalog retained; packets rebuilt, never prepared-token authority',actualGPU:false}));`;
const coldScript = await save('cold.mjs', coldCode), config = await save('cold-config.json', JSON.stringify({ cadPath, providers, records, sourceFiles, cssFile, width, height, testModule: resolve(pkg, 'tests/native-directional-light-webgpu-viewport.test.mjs') }, null, 2));
const stdout = execFileSync(process.execPath, [coldScript.path, config.path], { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 }); const cold = JSON.parse(stdout); await save('cold.stdout', stdout); assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, records.length);
const report = { issue: 1579, base, head: git('rev-parse', 'HEAD'), delta, namespace, interfaces, sourceGraph, records, refusals, runtimeRows, cold,
  evidence: 'DETERMINISTIC SOFTWARE; SOFTWARE COMPLETE / GENUINE DEVICE ACCEPTANCE UNRUN', actualGPU: false,
  counts: 'Actual common provider once per preparation; N actual program calls and N catalog admissions; exactly3 material reconstructions per bound draw, unbound0',
  unforcedDefensiveCeilings: ['8MiB aggregate byte/visit/depth thresholds may be bounded earlier by real providers; no mocked provider ceiling claims', '32MiB candidate and64MiB overlap caps are defensive under current packet and1024x1024 caps'],
  remaining: ['Genuine WGSL device compilation and uploads', 'Independent directional pixels and shared depth', 'Physical identity picking', 'Original-file genuine-device remount', 'Driver cleanup', 'Editor/TEN/source/current-display join, history and Save/Open', 'Overall default readiness and publication'] };
const receipt = await save('software-result.json', JSON.stringify(report, null, 2) + '\n');
// eslint-disable-next-line no-console
console.log(JSON.stringify({ issue: 1579, cases: records.length, refusals: refusals.length, coldCases: cold.rows.length, actualGPU: false, receipt }));
