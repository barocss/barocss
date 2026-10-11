/** #1512 ONE CPU source/emitted/native-file/cold qualifier after the GPU build.
 * node examples/gpu-scene/webgpu-primitive-vertical-flow.mjs --output ABS_FRESH
 * No browser, server, adapter, fake GPU or graphics acceptance is executed here.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import ts from 'typescript';

assert.equal(Number(process.versions.node.split('.')[0]), 22, 'Actual Node22 required');
assert.equal(process.argv.length, 4); assert.equal(process.argv[2], '--output'); assert.ok(isAbsolute(process.argv[3]));
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), output = resolve(process.argv[3]);
await mkdir(output, { recursive: false });
const parent = '1ce68ccd528df49d8fddd62ad2b499e3f520379c', gpuRoot = resolve(repo, 'packages/barocss-gpu'), cadRoot = resolve(repo, 'packages/barocss-cad');
const hash = value => createHash('sha256').update(value).digest('hex');
function signed(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (ArrayBuffer.isView(value)) return signed(Array.from(value));
  return Array.isArray(value) ? '[' + value.map(signed).join(',') + ']'
    : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + signed(value[key])).join(',') + '}';
}
const clone = value => JSON.parse(signed(value));
const gitFile = path => execFileSync('git', ['show', parent + ':' + path], { cwd: repo, encoding: 'utf8' });
const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
function frozen(value) { if (value && typeof value === 'object' && !ArrayBuffer.isView(value)) { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } }
function references(value, refs = new Set()) {
  if (value && typeof value === 'object' && !refs.has(value)) { refs.add(value); if (ArrayBuffer.isView(value)) refs.add(value.buffer); else Object.values(value).forEach(child => references(child, refs)); }
  return refs;
}
function independent(left, right) { const other = references(right); for (const value of references(left)) assert.ok(!other.has(value), 'Independent ownership'); }
async function receipt(path) { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }
async function save(name, content) { const path = resolve(output, name); await writeFile(path, content, { flag: 'wx' }); return receipt(path); }

const gpuManifest = JSON.parse(await readFile(resolve(gpuRoot, 'package.json'), 'utf8')), cadManifest = JSON.parse(await readFile(resolve(cadRoot, 'package.json'), 'utf8'));
assert.deepEqual(gpuManifest, JSON.parse(gitFile('packages/barocss-gpu/package.json')));
const ordinary = resolve(output, 'ordinary-public.mjs'), cadPath = resolve(output, 'ordinary-cad.mjs');
const gpuBundle = await build({ absWorkingDir: repo, entryPoints: [resolve(gpuRoot, gpuManifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const cadBundle = await build({ absWorkingDir: repo, entryPoints: [resolve(cadRoot, cadManifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: cadPath, metafile: true });
const graph = Object.keys(gpuBundle.metafile.inputs);
for (const leaf of ['mesh-material-wgsl.ts', 'webgpu-primitive-viewport.ts', 'primitive-frame-preflight.ts', 'mesh-material.ts']) assert.ok(graph.some(path => path.endsWith('/src/' + leaf)), leaf);
assert.ok(!graph.some(path => /barocss-(gpu|cad)\/dist\//.test(path)), 'Ordinary source cannot fall back to emitted GPU/CAD');
const sourceGraph = [];
for (const path of [...new Set([...graph, ...Object.keys(cadBundle.metafile.inputs)])].sort()) {
  const bytes = await readFile(resolve(repo, path)); sourceGraph.push({ path, bytes: bytes.length, sha256: hash(bytes) });
  if (path.startsWith('packages/') && !['packages/barocss-gpu/src/index.ts', 'packages/barocss-gpu/src/mesh-material-wgsl.ts', 'packages/barocss-gpu/src/webgpu-primitive-viewport.ts', 'packages/barocss-gpu/src/webgpu-platform.ts'].includes(path)) assert.equal(bytes.toString('utf8'), gitFile(path), 'Preserved dependency ' + path);
}
const cad = await import(pathToFileURL(cadPath).href);
assert.equal(typeof cad.compileCadModel, 'function'); assert.equal(typeof cad.tessellateSurface, 'function');
const emitted = resolve(gpuRoot, gpuManifest.publishConfig.exports['.'].import);
assert.equal(gpuManifest.publishConfig.exports['.'].import, './dist/index.js');
const providers = [{ label: 'ordinary-source', path: ordinary }, { label: 'emitted-public', path: emitted }];
for (const provider of providers) provider.gpu = await import(pathToFileURL(provider.path).href);
const oldBarrel = gitFile('packages/barocss-gpu/src/index.ts'), ast = ts.createSourceFile('parent.ts', oldBarrel, ts.ScriptTarget.Latest, true);
const oldRuntime = ast.statements.filter(node => ts.isExportDeclaration(node) && !node.isTypeOnly && node.exportClause && ts.isNamedExports(node.exportClause))
  .flatMap(node => node.exportClause.elements.filter(entry => !entry.isTypeOnly).map(entry => entry.name.text)).sort();
const additions = ['lowerMeshMaterialWGSL', 'prepareWebGPUPrimitiveFrame', 'mountPrimitiveBackendViewport', 'PrimitiveBackendError', 'PrimitiveBackendDiagnosticCode'];
const namespace = Object.keys(providers[0].gpu).sort(); assert.deepEqual(namespace, [...oldRuntime, ...additions].sort()); assert.deepEqual(Object.keys(providers[1].gpu).sort(), namespace);
assert.ok((await readFile(resolve(gpuRoot, 'src/index.ts'), 'utf8')).startsWith(oldBarrel));
const publicDTS = await readFile(resolve(gpuRoot, gpuManifest.publishConfig.exports['.'].types), 'utf8');
const publicTypes = ['LoweredMeshMaterialWGSL', 'PreparedWebGPUPrimitiveFrame', 'PrimitiveBackendMode', 'PrimitiveBackendOptions', 'PrimitiveBackendViewport', 'PrimitiveBackendStatus', 'PrimitiveBackendPick', 'PrimitiveBackendLimits', 'PrimitiveBackendDiagnosticCode'];
for (const name of [...additions, ...publicTypes]) assert.ok(new RegExp('\\b' + name + '\\b').test(publicDTS), name);
const viewportDTS = await readFile(resolve(gpuRoot, 'dist/webgpu-primitive-viewport.d.ts'), 'utf8');
for (const method of ['updateFrame', 'resize', 'readPixels', 'pick']) assert.ok(new RegExp(method + '\\([^;]+Promise<').test(viewportDTS), 'Actual asynchronous ' + method);
assert.ok(/readonly\s+wgsl:\s*string/.test(viewportDTS));
assert.ok(/export type PrimitiveBackendDiagnosticCode = keyof typeof PrimitiveBackendDiagnosticCode/.test(viewportDTS));

const fixturePath = resolve(repo, 'examples/gpu-scene/fixtures/material-authoring.native.source0.css'), nativeSource = await readFile(fixturePath, 'utf8');
assert.equal(nativeSource, gitFile('examples/gpu-scene/fixtures/material-authoring.native.source0.css'));
const editedSource = nativeSource.replace('[0,3,0]', '[0,4,0]'); assert.notEqual(editedSource, nativeSource);
const nativeAssets = [];
for (const [name, source, revision] of [['original', nativeSource, 0], ['edited', editedSource, 1]]) {
  const result = cad.compileCadModel(source, { sourceVersion: 0 }); assert.equal(result.ok, true, signed(result));
  assert.equal(result.model.name, 'material_authoring_native'); assert.equal(result.model.objects.length, 1);
  const surface = result.model.objects[0]; assert.equal(surface.id, 'original_rational_panel'); assert.equal(surface.degreeU, 2); assert.equal(surface.degreeV, 2);
  assert.deepEqual(surface.knotsU, [-2, -2, -2, 6, 6, 6]); assert.deepEqual(surface.knotsV, [3, 3, 3, 11, 11, 11]);
  assert.equal(surface.weights[1][1], 2); assert.ok(Object.is(surface.controlPoints[0][0][1], -0));
  const packet = cad.tessellateSurface(surface, { countU: 5, countV: 5, revision }).packet;
  assert.equal(packet.positions.length, 75); assert.equal(packet.normals.length, 75); assert.equal(packet.indices.length, 96); assert.equal(packet.parameters.length, 50);
  assert.deepEqual(packet.parameters.slice(0, 2), [-2, 3]); assert.deepEqual(packet.parameters.slice(24, 26), [2, 7]); assert.deepEqual(packet.parameters.slice(-2), [6, 11]);
  const ref = { modelId: result.model.name, geometryId: surface.id };
  const sourceFile = await save(name + '.native.source0.css', source), observed = await save(name + '.native-observation.json', signed({ source, model: result.model, packet }) + '\n');
  nativeAssets.push({ name, source, revision, model: result.model, packet, ref, sourceFile, observed });
}
assert.notDeepEqual(nativeAssets[0].packet.positions, nativeAssets[1].packet.positions);
const materialSource = '// Original material é😀\r\n@shader #webgpu_palette { @uniform amount:float(-0,1,.25); @uniform phase:float(-1,1,-.5); @fragment { color:mix(#000000,#FFFFFF,clamp(amount+sin(phase)*.1,0,1)); } }\r\n';
const materialFile = await save('original.material.css', materialSource);
const camera = { eye: [0, 1.3, 4], target: [0, .06, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 10 };
function frameFor(asset, material, edited = false) {
  return { version: 0, scene: { version: 2, entries: [{ kind: 'surface', packet: clone(asset.packet), ref: clone(asset.ref), color: [.6, .4, .8],
    transform: { translationMm: edited ? [2, -0, 0] : [-0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: edited ? [1, .75, 1] : [1, 1, 1] } }] },
    options: { mmToSceneUnit: .05, translate: [-0, 0, 0], background: [.05, .07, .1], camera: edited ? { ...clone(camera), eye: [.3, 1.4, 4], target: [0, .08, 0] } : clone(camera),
      ...(edited ? { lighting: { ambientStrength: .2, directionalStrength: .6, direction: [.4, 1, -.2] } } : {}) }, particles: null,
    materials: material === null ? [] : [{ ref: clone(asset.ref), binding: { material: clone(material), uniforms: edited ? { amount: .75, phase: .25 } : { amount: .25, phase: -0 } } }] };
}
function observation(prepared) {
  return { format: prepared.format, version: prepared.version, profile: prepared.profile, frame: prepared.frame,
    wgsl: prepared.wgsl, frameUniforms: Array.from(prepared.frameUniforms), materialUniforms: Array.from(prepared.materialUniforms) };
}
function normalized(v) { const scale = Math.max(...v.map(Math.abs)), scaled = v.map(n => n / scale), length = Math.hypot(...scaled); return scaled.map(n => n / length); }
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function expectedPacked(input, width, height) {
  const c = input.options.camera, backward = normalized(c.eye.map((n, i) => n - c.target[i])), right = normalized(cross(normalized(c.up), backward)), up = cross(backward, right);
  const focal = 1 / Math.tan(c.fovYDegrees * Math.PI / 360), range = c.far - c.near;
  const view = [right[0], up[0], backward[0], 0, right[1], up[1], backward[1], 0, right[2], up[2], backward[2], 0, -dot(right, c.eye), -dot(up, c.eye), -dot(backward, c.eye), 1];
  const projection = [focal / (width / height), 0, 0, 0, 0, focal, 0, 0, 0, 0, -(c.far + c.near) / range, -1, 0, 0, -2 * c.far * c.near / range, 0];
  const light = input.options.lighting ?? { direction: [-.6, .8, 1], ambientStrength: .35, directionalStrength: .65 };
  return Float32Array.from([...view, ...projection, ...normalized(light.direction), light.directionalStrength, ...input.scene.entries[0].color, light.ambientStrength]);
}
const declarations = 'struct MaterialParams {\n  slot: array<vec4<f32>, 4>,\n}\n';
const paletteExpression = 'clamp(material_mix(vec3<f32>(0.00000000e+0f,0.00000000e+0f,0.00000000e+0f),vec3<f32>(1.00000000e+0f,1.00000000e+0f,1.00000000e+0f),clamp((materialParams.slot[0].x+(sin(materialParams.slot[0].y)*1.00000001e-1f)),0.00000000e+0f,1.00000000e+0f)),vec3<f32>(0.0),vec3<f32>(1.0))';
let accepted = 0, refused = 0, getters = 0, reflections = 0, domReads = 0;
const rows = [], coldCases = [], sharedFiles = [materialFile, ...nativeAssets.flatMap(asset => [asset.sourceFile, asset.observed])];
const domDescriptors = new Map();
for (const name of ['document', 'window', 'navigator']) { domDescriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, { configurable: true, get() { domReads++; throw new Error('CPU preparation must not inspect ' + name); } }); }
try {
  for (const provider of providers) {
    const gpu = provider.gpu, compiled = gpu.compileMeshMaterial(materialSource); assert.equal(compiled.ok, true); const material = compiled.material;
    const lowered = gpu.lowerMeshMaterialWGSL(material);
    keys(lowered, ['format', 'version', 'profile', 'material', 'expression', 'declarations', 'uniformLayout', 'uniformByteLength']);
    assert.equal(lowered.format, 'barocss-gpu-mesh-material-wgsl'); assert.equal(lowered.version, 0); assert.equal(lowered.profile, 'mesh-opaque-fragment-wgsl-v0');
    assert.equal(lowered.uniformByteLength, 64); assert.equal(lowered.expression, paletteExpression); assert.equal(lowered.declarations, declarations); assert.deepEqual(lowered.material, material); independent(lowered.material, material); frozen(lowered);
    for (const [index, uniform] of lowered.uniformLayout.entries()) { keys(uniform, ['name', 'type', 'min', 'max', 'default', 'index', 'byteOffset', 'access']); assert.deepEqual(uniform, { ...material.uniforms[index], index, byteOffset: 4 * index, access: 'materialParams.slot[0].' + 'xyzw'[index] }); }
    accepted++;
    const maxSource = '@shader #slots {' + Array.from({ length: 16 }, (_, i) => '@uniform u' + i + ':float(0,1,.5);').join('') + '@fragment{color:mix(#000,#fff,u15);}}';
    const maxCompiled = gpu.compileMeshMaterial(maxSource); assert.equal(maxCompiled.ok, true); const maximum = gpu.lowerMeshMaterialWGSL(maxCompiled.material);
    assert.equal(maximum.uniformLayout.length, 16); assert.equal(maximum.uniformLayout[15].byteOffset, 60); assert.equal(maximum.uniformLayout[15].access, 'materialParams.slot[3].w'); assert.equal(maximum.uniformByteLength, 64); accepted++;
    const cases = [['unbound_original', nativeAssets[0], frameFor(nativeAssets[0], null)], ['bound_signed_uniform', nativeAssets[0], frameFor(nativeAssets[0], material)], ['edited_parameter_frame', nativeAssets[1], frameFor(nativeAssets[1], material, true)]];
    const records = [], failures = [];
    for (const [name, asset, input] of cases) {
      const before = signed(input), prepared = gpu.prepareWebGPUPrimitiveFrame(input, 320, 240);
      keys(prepared, ['format', 'version', 'profile', 'frame', 'wgsl', 'frameUniforms', 'materialUniforms']); assert.equal(prepared.format, 'barocss-gpu-webgpu-primitive-frame'); assert.equal(prepared.version, 0); assert.equal(prepared.profile, 'qualified-surface-v0');
      assert.equal(prepared.frame.profile, 'qualified-v2'); assert.equal(prepared.frame.primitives.length, 1); assert.equal(prepared.frame.bufferBytes, 792);
      assert.equal(prepared.frameUniforms.byteLength, 160); assert.equal(prepared.materialUniforms.byteLength, 64); assert.ok(prepared.frameUniforms instanceof Float32Array && prepared.materialUniforms instanceof Float32Array);
      assert.deepEqual(Array.from(prepared.frameUniforms), Array.from(expectedPacked(input, 320, 240)));
      const expectedMaterial = Array(16).fill(0); if (input.materials.length) { expectedMaterial[0] = Math.fround(input.materials[0].binding.uniforms.amount); expectedMaterial[1] = input.materials[0].binding.uniforms.phase === 0 ? 0 : Math.fround(input.materials[0].binding.uniforms.phase); }
      assert.deepEqual(Array.from(prepared.materialUniforms), expectedMaterial); assert.equal(signed(input), before); assert.equal(Object.isFrozen(input), false); independent(prepared, input); frozen(prepared);
      assert.deepEqual(prepared.frame.frame.scene.entries[0].packet, asset.packet); assert.deepEqual(prepared.frame.frame.scene.entries[0].ref, asset.ref);
      const pose = input.scene.entries[0].transform, expectedX = Math.fround((asset.packet.positions[0] * pose.scale[0] + pose.translationMm[0]) * .05);
      assert.equal(prepared.frame.primitives[0].positions[0], expectedX, 'Original mm maps once to the inherited prepared scene buffer');
      assert.ok(prepared.wgsl.includes('@vertex fn vertexMain') && prepared.wgsl.includes('@fragment fn fragmentMain')); assert.ok(prepared.wgsl.includes('(clip.z + clip.w) * 0.5'));
      assert.ok(prepared.wgsl.includes('@location(1) identity: u32') && prepared.wgsl.includes('output.identity = 1u')); assert.ok(prepared.wgsl.includes('a * (1.0 - t) + b * t'));
      assert.ok(prepared.wgsl.includes(input.materials.length ? paletteExpression : 'pow(frameParams.style.xyz, vec3<f32>(2.2))')); assert.ok(prepared.wgsl.length <= 65536);
      const inputFile = await save(provider.label + '.' + name + '.original-frame.json', before + '\n'), observedFile = await save(provider.label + '.' + name + '.prepared-observation.json', signed(observation(prepared)) + '\n');
      const wgslFile = await save(provider.label + '.' + name + '.wgsl', prepared.wgsl), signature = hash(signed(observation(prepared)));
      const again = gpu.prepareWebGPUPrimitiveFrame(input, 320, 240); independent(prepared, again); assert.equal(hash(signed(observation(again))), signature);
      const oldValue = prepared.frameUniforms[0]; prepared.frameUniforms[0] = 99; assert.equal(prepared.frameUniforms[0], 99); assert.equal(again.frameUniforms[0], oldValue); prepared.frameUniforms[0] = oldValue;
      const oldMaterialValue = prepared.materialUniforms[0]; prepared.materialUniforms[0] = .875; assert.notEqual(again.materialUniforms[0], .875); prepared.materialUniforms[0] = oldMaterialValue;
      assert.equal(hash(signed(observation(prepared))), signature); assert.equal(signed(input), before);
      const record = { provider: provider.label, name, inputFile, observedFile, wgslFile, nativeSource: asset.sourceFile, nativeObservation: asset.observed, revision: asset.revision, hasMaterial: input.materials.length === 1, signature };
      records.push(record); coldCases.push(record); accepted++;
    }
    const baseline = cases[1][2], retained = records.flatMap(record => [record.inputFile, record.observedFile, record.wgslFile]);
    async function retention() { for (const file of [...sharedFiles, ...retained]) assert.equal(hash(await readFile(file.path)), file.sha256); assert.equal(getters, 0); assert.equal(domReads, 0); }
    function refuse(name, candidate, code, width = 320, height = 240, inspect) {
      let error; try { gpu.prepareWebGPUPrimitiveFrame(candidate, width, height); } catch (caught) { error = caught; }
      assert.ok(error instanceof gpu.PrimitiveBackendError, name); assert.equal(error.code, code, name); assert.ok(error.message.length <= 1024); inspect?.(error);
      failures.push({ name, code: error.code, message: error.message, cause: error.cause instanceof Error ? { name: error.cause.name, code: error.cause.code ?? null } : null }); refused++;
    }
    refuse('zero_width', clone(baseline), 'BUDGET', 0); refuse('side_limit', clone(baseline), 'BUDGET', 1025); refuse('fractional_height', clone(baseline), 'BUDGET', 320, 1.5);
    const noCamera = clone(baseline); delete noCamera.options.camera; refuse('explicit_camera_required', noCamera, 'PROFILE');
    const empty = clone(baseline); empty.scene.entries = []; empty.materials = []; refuse('empty_qualified_scene', empty, 'INPUT');
    const particles = clone(baseline); particles.particles = {}; refuse('particles_not_admitted', particles, 'INPUT');
    const wrongVersion = clone(baseline); wrongVersion.version = 1; refuse('frame_version', wrongVersion, 'INPUT');
    const foreignMaterial = clone(baseline), uvCompiled = gpu.compileEngineUVMaterial(materialSource); assert.equal(uvCompiled.ok, true); foreignMaterial.materials[0].binding.material = uvCompiled.material; refuse('engine_uv_profile', foreignMaterial, 'INPUT');
    const tinyOverride = clone(baseline); tinyOverride.materials[0].binding.uniforms.amount = 1e-50; refuse('actual_uniform_f32_underflow', tinyOverride, 'PROFILE');
    const protoSource = '@shader #unsafe {@uniform __proto__:float(0,1,.5);@fragment{color:mix(#000,#fff,__proto__);}}';
    const protoCompiled = gpu.compileMeshMaterial(protoSource); assert.equal(protoCompiled.ok, true);
    const unsafe = clone(baseline); unsafe.materials[0].binding = { material: protoCompiled.material, uniforms: {} };
    await save(provider.label + '.refused.uniform-prototype.material.css', protoSource);
    refuse('actual_missing_own_resolved_uniform', unsafe, 'PROFILE');
    const accessor = clone(baseline); Object.defineProperty(accessor, 'materials', { enumerable: true, get() { getters++; return []; } }); refuse('own_accessor_getter0', accessor, 'INPUT');
    const marker = new Error('Actual caller frame reflection sentinel'); const proxy = new Proxy(clone(baseline), { getPrototypeOf() { reflections++; throw marker; } }); refuse('actual_inherited_reflection_cause', proxy, 'INPUT', 320, 240, error => assert.strictEqual(error.cause, marker));
    for (const [name, source] of [['literal_f32_underflow', '@shader #tiny {@fragment{color:mix(#000,#fff,1e-50);}}'], ['default_f32_underflow', '@shader #tiny {@uniform t:float(0,1,1e-50);@fragment{color:mix(#000,#fff,t);}}']]) {
      const tiny = gpu.compileMeshMaterial(source); assert.equal(tiny.ok, true); let error; try { gpu.lowerMeshMaterialWGSL(tiny.material); } catch (caught) { error = caught; } assert.ok(error instanceof gpu.MeshMaterialError); assert.equal(error.code, 'RANGE'); failures.push({ name, code: error.code }); refused++;
    }
    const forged = clone(material); forged.expression.args[2].args[0].left.name = 'missing'; let forgery; try { gpu.lowerMeshMaterialWGSL(forged); } catch (caught) { forgery = caught; } assert.ok(forgery instanceof gpu.MeshMaterialError); assert.equal(forgery.code, 'IR'); refused++;
    for (const target of [null, new Proxy({}, { get() { getters++; throw new Error('Untrusted target getter'); } })]) {
      await assert.rejects(gpu.mountPrimitiveBackendViewport(target, baseline, { backend: 'webgpu', fallbackCanvas: null }), error => error instanceof gpu.PrimitiveBackendError && error.code === 'INPUT'); refused++;
    }
    await retention(); rows.push({ provider: provider.label, records, failures });
  }
} finally { for (const [name, descriptor] of domDescriptors) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; } }
for (let i = 0; i < rows[0].records.length; i++) assert.equal(rows[0].records[i].signature, rows[1].records[i].signature);
assert.equal(getters, 0); assert.equal(domReads, 0); assert.equal(reflections, 2);

const coldCode = String.raw`
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
assert.equal(Number(process.versions.node.split('.')[0]),22);const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')),hash=v=>createHash('sha256').update(v).digest('hex');
function signed(v){if(typeof v==='number'){assert.ok(Number.isFinite(v));return Object.is(v,-0)?'-0':JSON.stringify(v);}if(v===null||typeof v!=='object')return JSON.stringify(v);if(ArrayBuffer.isView(v))return signed(Array.from(v));return Array.isArray(v)?'['+v.map(signed).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+signed(v[k])).join(',')+'}';}
function observe(p){return{format:p.format,version:p.version,profile:p.profile,frame:p.frame,wgsl:p.wgsl,frameUniforms:Array.from(p.frameUniforms),materialUniforms:Array.from(p.materialUniforms)};}
for(const file of cfg.shared)assert.equal(hash(readFileSync(file.path)),file.sha256);const cad=await import(pathToFileURL(cfg.cad).href),assets=new Map();
for(const asset of cfg.assets){const source=readFileSync(asset.sourceFile.path,'utf8'),native=cad.compileCadModel(source,{sourceVersion:0});assert.equal(native.ok,true);const packet=cad.tessellateSurface(native.model.objects[0],{countU:5,countV:5,revision:asset.revision}).packet,observed=JSON.parse(readFileSync(asset.observed.path,'utf8'));assert.equal(source,observed.source);assert.equal(signed(native.model),signed(observed.model));assert.equal(signed(packet),signed(observed.packet));assets.set(asset.sourceFile.path,{native,packet});}
const materialSource=readFileSync(cfg.material.path,'utf8'),rows=[];
for(const provider of cfg.providers){const gpu=await import(pathToFileURL(provider.path).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);const material=gpu.compileMeshMaterial(materialSource);assert.equal(material.ok,true);
for(const item of cfg.cases.filter(c=>c.provider===provider.label)){for(const file of[item.inputFile,item.observedFile,item.wgslFile])assert.equal(hash(readFileSync(file.path)),file.sha256);const input=JSON.parse(readFileSync(item.inputFile.path,'utf8')),asset=assets.get(item.nativeSource.path);input.scene.entries[0].packet=asset.packet;assert.equal(input.scene.entries[0].ref.modelId,asset.native.model.name);assert.equal(input.scene.entries[0].ref.geometryId,asset.packet.surfaceId);if(item.hasMaterial)input.materials[0].binding.material=material.material;const prepared=gpu.prepareWebGPUPrimitiveFrame(input,320,240);assert.equal(hash(signed(observe(prepared))),item.signature);assert.equal(prepared.wgsl,readFileSync(item.wgslFile.path,'utf8'));rows.push({provider:provider.label,name:item.name,signature:item.signature,frameBytes:prepared.frameUniforms.byteLength,materialBytes:prepared.materialUniforms.byteLength});}}
console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,authority:'complete original CAD and material source plus authored frame/overrides; saved native/prepared snapshots are observations',actualGPU:false,actualGL:false}));`;
const coldScript = await save('cold-webgpu-source.mjs', coldCode), coldConfig = await save('cold-config.json', JSON.stringify({ cad: cadPath, namespace, providers: providers.map(({ label, path }) => ({ label, path })), shared: sharedFiles, material: materialFile,
  assets: nativeAssets.map(({ sourceFile, observed, revision }) => ({ sourceFile, observed, revision })), cases: coldCases }, null, 2) + '\n');
const stdout = execFileSync(process.execPath, [coldScript.path, coldConfig.path], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }); await save('cold.stdout', stdout);
const cold = JSON.parse(stdout); assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, 6);
const report = { issue: 1512, parent, stage: 'WEBGPU_NATIVE_CODE_SOURCE_API_FILE_COLD_GRAPHICS_BLOCKED', node: process.version, accepted, refused, getters, reflections, domReads, namespace, namespaceCount: namespace.length, publicTypes,
  sourceGraph, ordinary: await receipt(ordinary), emitted: await receipt(emitted), fixture: await receipt(fixturePath), sharedFiles, rows, cold,
  actualGPU: false, actualGL: false, fakeGPU: false, backendDefaultChanged: false, graphicsQualification: 'UNRUN: preserved original52215 administrator-policy denial',
  support: 'One genuine rational Surface5x5 through original CAD source and common qualified frame, legacy material to WGSL,160/64-byte packed CPU execution data, source/emitted public admission and genuine cold reconstruction. No adapter/device/pipeline/link/submission/pixels/identity picking/lifetime/fallback/loss or integrated consumer qualification.',
  unforcedDefensiveGuards: ['validWGSL64KiB', 'validWGSLResult2MiB', 'actualDeviceLimits', 'GPUResourceCeilings', 'actualAsyncRecovery'], publication: false };
const result = await save('actual-result.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ issue: 1512, accepted, refused, getters, reflections, domReads, exports: namespace.length, coldRows: cold.rows.length, actualGPU: false, actualGL: false, result }));
