/** #1375: complete native/material frame CPU preflight, not a renderer mount.
 * node examples/gpu-scene/primitive-frame-preflight-flow.mjs --output <fresh-directory>
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

assert.equal(Number(process.versions.node.split('.')[0]), 22, 'Actual Node22 required');
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), args = process.argv.slice(2), at = args.indexOf('--output');
assert(at >= 0 && args[at + 1] && !args[at + 1].startsWith('--'), '--output <fresh-directory> required');
const output = resolve(args[at + 1]); await mkdir(output, { recursive: false });
const hash = value => createHash('sha256').update(value).digest('hex');
function originalJSON(value) {
  if (typeof value === 'number') { assert(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(originalJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + originalJSON(child)).join(',') + '}';
}
const clone = value => JSON.parse(originalJSON(value));
const gpuRoot = resolve(repo, 'packages/barocss-gpu'), cadRoot = resolve(repo, 'packages/barocss-cad');
const gpuManifest = JSON.parse(await readFile(resolve(gpuRoot, 'package.json'), 'utf8'));
const cadManifest = JSON.parse(await readFile(resolve(cadRoot, 'package.json'), 'utf8'));
const published = gpuManifest.publishConfig.exports['.'];
assert.equal(published.import, './dist/index.js'); assert.equal(published.types, './dist/index.d.ts');
const ordinary = resolve(output, 'ordinary-gpu-source.mjs'), cadEntry = resolve(output, 'ordinary-cad-source.mjs');
const bundled = await build({ entryPoints: [resolve(gpuRoot, gpuManifest.exports['.'].import)], bundle: true,
  platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const graph = Object.keys(bundled.metafile.inputs);
for (const file of ['primitive-frame-preflight.ts', 'primitive-scene-renderer.ts', 'mesh-scene-transform.ts', 'mesh-material.ts'])
  assert(graph.some(path => path.endsWith('/src/' + file)), 'Actual own source dependency ' + file);
assert(!graph.some(path => /barocss-gpu\/dist\//.test(path)), 'No GPU emitted fallback in ordinary source');
const cadBundled = await build({ entryPoints: [resolve(cadRoot, cadManifest.exports['.'].import)], bundle: true,
  platform: 'node', format: 'esm', target: 'node22', outfile: cadEntry, metafile: true });
const cad = await import(pathToFileURL(cadEntry).href), emitted = resolve(gpuRoot, published.import);
assert.equal(typeof cad.compileCadModel, 'function'); assert.equal(typeof cad.tessellateSurface, 'function');
const providers = [['ordinary-source', await import(pathToFileURL(ordinary).href)], ['emitted-public', await import(pathToFileURL(emitted).href)]];
const namespace = Object.keys(providers[0][1]).sort(); assert.deepEqual(namespace, Object.keys(providers[1][1]).sort());
const declarationPath = resolve(gpuRoot, published.types), declaration = await readFile(declarationPath, 'utf8');
for (const name of ['preparePrimitiveSceneFrame', 'PrimitiveSceneFrameProfile', 'PrimitiveSceneCpuFrameV0', 'PreparedPrimitiveSceneFrameEntry', 'PreparedPrimitiveSceneFrame'])
  assert(new RegExp('\\b' + name + '\\b').test(declaration), 'Actual public DTS ' + name);
const leafDeclaration = await readFile(resolve(gpuRoot, 'dist/primitive-frame-preflight.d.ts'), 'utf8');
assert(/preparePrimitiveSceneFrame\(input:\s*unknown,\s*profile\?:\s*PrimitiveSceneFrameProfile\):\s*PreparedPrimitiveSceneFrame/.test(leafDeclaration));
const fixturePath = resolve(repo, 'examples/gpu-scene/fixtures/material-authoring.native.source0.css');
const fixtureBytes = await readFile(fixturePath), originalFixture = fixtureBytes.toString('utf8');
assert(originalFixture.includes('@model material_authoring_native {'));
const assets = [];
for (const suffix of ['a', 'b', 'c', 'd']) {
  const modelId = 'preflight_asset_' + suffix, source = originalFixture.replace('@model material_authoring_native {', '@model ' + modelId + ' {');
  const compiled = cad.compileCadModel(source, { sourceVersion: 0 }); assert.equal(compiled.ok, true, originalJSON(compiled));
  assert.equal(compiled.model.name, modelId); assert.equal(compiled.model.objects.length, 1);
  const surface = compiled.model.objects[0]; assert.equal(surface.id, 'original_rational_panel');
  assert.equal(surface.degreeU, 2); assert.equal(surface.degreeV, 2); assert.equal(surface.weights[1][1], 2);
  assert(Object.is(surface.controlPoints[0][0][1], -0));
  const packet = cad.tessellateSurface(surface, { countU: 5, countV: 5, revision: 0 }).packet;
  assert.equal(packet.surfaceId, surface.id); assert.equal(packet.positions.length, 75); assert.equal(packet.parameters.length, 50); assert.equal(packet.indices.length, 96);
  const path = resolve(output, modelId + '.source0.css'), nativePath = resolve(output, modelId + '.native.json');
  await writeFile(path, source); await writeFile(nativePath, originalJSON({ sourceVersion: 0, source, model: compiled.model, packet }) + '\n');
  assets.push({ source, model: compiled.model, packet, ref: { modelId, geometryId: surface.id }, path, nativePath });
}
const assetsBefore = originalJSON(assets.map(({ source, model, packet, ref }) => ({ source, model, packet, ref })));
const shaderSources = [
  '@shader #first { @uniform amount:float(0,1,.25); @fragment { color:mix(#123456,#ABCDEF,amount); } }',
  '@shader #second { @uniform amount:float(-1,1,-.5); @fragment { color:mix(#FEDCBA,#654321,clamp(amount,0,1)); } }',
];
const options = { mmToSceneUnit: .05, translate: [0, 0, 0], background: [.05, .07, .1],
  camera: { eye: [0, 1.3, 4], target: [0, .06, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 10 },
  lighting: { ambientStrength: .4, directionalStrength: .5, direction: [0, 2, 1] } };
function entry(asset, index) { return { kind: 'surface', packet: clone(asset.packet), ref: clone(asset.ref), color: [.7, .5, .3],
  transform: { translationMm: [index % 2 ? 20 : -20, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, index === 1 ? .5 : 1, 1] } }; }
const bufferHashes = primitives => primitives.map(p => Object.fromEntries(['positions', 'normals', 'indices'].filter(name => p[name]).map(name => {
  const view = p[name]; return [name, hash(Buffer.from(view.buffer, view.byteOffset, view.byteLength))];
})));
function frozen(value) {
  if (value && typeof value === 'object' && !ArrayBuffer.isView(value)) { assert(Object.isFrozen(value)); Object.values(value).forEach(frozen); }
}
function expectedArrays(p) {
  const packet = p.entry.packet, pose = p.entry.transform;
  const positions = packet.positions.map((n, i) => Math.fround((n * pose.scale[i % 3] + pose.translationMm[i % 3]) * .05));
  const normals = [];
  for (let i = 0; i < packet.normals.length; i += 3) {
    const local = packet.normals.slice(i, i + 3).map((n, axis) => n / pose.scale[axis]);
    // The independently declared identity rotation still executes three-term dot products.
    const v = [local[0] + 0 * local[1] + 0 * local[2],
      0 * local[0] + local[1] + 0 * local[2], 0 * local[0] + 0 * local[1] + local[2]], length = Math.hypot(...v);
    normals.push(...v.map(n => Math.fround(n / length)));
  }
  return { positions, normals, indices: packet.indices };
}
function bounds(positions) { return { min: [0, 1, 2].map(axis => Math.min(...positions.filter((_, i) => i % 3 === axis))),
  max: [0, 1, 2].map(axis => Math.max(...positions.filter((_, i) => i % 3 === axis))) }; }
function verify(result, input, profile = 'qualified-v2') {
  assert.deepEqual(Object.keys(result).sort(), ['format', 'version', 'profile', 'frame', 'primitives', 'bounds', 'bufferBytes'].sort());
  assert.equal(result.format, 'barocss-gpu-primitive-frame-preflight'); assert.equal(result.version, 0); assert.equal(result.profile, profile);
  assert.equal(result.frame.version, 0); assert.equal(result.frame.scene.version, 2); assert.equal(result.frame.particles, null);
  assert.deepEqual(result.frame.options, input.options); assert.notStrictEqual(result.frame.options, input.options);
  assert.deepEqual(result.frame.scene.entries, input.scene.entries); assert.equal(result.primitives.length, input.scene.entries.length);
  assert.deepEqual(result.frame.materials.map(m => m.ref), input.materials.map(m => m.ref));
  let bytes = 0;
  for (let i = 0; i < result.primitives.length; i++) {
    const p = result.primitives[i], original = input.scene.entries[i];
    assert.deepEqual(p.entry, original); assert.notStrictEqual(p.entry.packet.positions, original.packet.positions);
    const expected = expectedArrays(p); assert(p.positions instanceof Float32Array && p.normals instanceof Float32Array && p.indices instanceof Uint16Array);
    assert.deepEqual(Array.from(p.positions), expected.positions); assert.deepEqual(Array.from(p.normals), expected.normals); assert.deepEqual(Array.from(p.indices), expected.indices);
    assert.deepEqual(p.bounds, bounds(expected.positions));
    bytes += p.positions.byteLength + p.normals.byteLength + p.indices.byteLength;
    const binding = result.frame.materials.find(m => m.ref.modelId === p.entry.ref.modelId && m.ref.geometryId === p.entry.ref.geometryId);
    if (binding) assert.deepEqual(p.material, binding.binding); else assert(!Object.hasOwn(p, 'material'));
  }
  assert.equal(result.bufferBytes, bytes);
  if (!result.primitives.length) assert.equal(result.bounds, null);
  else assert.deepEqual(result.bounds, { min: [0, 1, 2].map(axis => Math.min(...result.primitives.map(p => p.bounds.min[axis]))),
    max: [0, 1, 2].map(axis => Math.max(...result.primitives.map(p => p.bounds.max[axis]))) });
  frozen(result);
}

let accepted = 0, refused = 0, getters = 0, reflections = 0, materialEnumeration = 0, domReads = 0;
const results = [], failures = [], domDescriptors = new Map();
for (const name of ['document', 'window', 'HTMLCanvasElement']) {
  domDescriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, get() { domReads++; throw new Error('CPU preflight must not read DOM global ' + name); } });
}
try {
  for (const [provider, gpu] of providers) {
    assert.equal(typeof gpu.preparePrimitiveSceneFrame, 'function');
    const materials = shaderSources.map(source => { const compiled = gpu.compileMeshMaterial(source); assert.equal(compiled.ok, true); return compiled.material; });
    const input = { version: 0, scene: { version: 2, entries: assets.slice(0, 2).map(entry) }, options: clone(options), particles: null,
      materials: [{ ref: clone(assets[1].ref), binding: { material: materials[1], uniforms: { amount: -0 } } },
        { ref: clone(assets[0].ref), binding: { material: materials[0], uniforms: {} } }] };
    const before = originalJSON(input), result = gpu.preparePrimitiveSceneFrame(input); verify(result, input);
    assert.equal(originalJSON(input), before); assert.equal(result.bufferBytes, 1584);
    assert.deepEqual(result.frame.materials[0].binding.uniforms, { amount: 0 }); assert(!Object.is(result.frame.materials[0].binding.uniforms.amount, -0));
    assert.deepEqual(result.frame.materials[1].binding.uniforms, { amount: .25 });
    assert.deepEqual(result.frame.options.lighting.direction, [0, 2, 1], 'Original admitted light direction is not silently normalized');
    for (let i = 0; i < 2; i++) { assert.deepEqual(result.primitives[i].entry.packet.parameters, assets[i].packet.parameters);
      assert.equal(result.primitives[i].entry.ref.modelId, assets[i].model.name); assert.equal(result.primitives[i].entry.ref.geometryId, assets[i].packet.surfaceId); }
    accepted++;
    const one = { ...clone(input), scene: { version: 2, entries: [clone(input.scene.entries[0])] }, materials: [clone(input.materials[1])] };
    verify(gpu.preparePrimitiveSceneFrame(one), one); accepted++;
    const four = { ...clone(input), scene: { version: 2, entries: assets.map(entry) } };
    const fourResult = gpu.preparePrimitiveSceneFrame(four); verify(fourResult, four); assert.equal(fourResult.bufferBytes, 3168); accepted++;
    const empty = { ...clone(input), scene: { version: 2, entries: [] }, materials: [] };
    verify(gpu.preparePrimitiveSceneFrame(empty, 'viewport-v2'), empty, 'viewport-v2'); accepted++;
    const optional = { ...clone(input), options: { mmToSceneUnit: .05, translate: [0, 0, 0], background: [.05, .07, .1] } };
    verify(gpu.preparePrimitiveSceneFrame(optional), optional); accepted++;
    const framePath = resolve(output, provider + '.canonical-frame.json'), inputPath = resolve(output, provider + '.original-frame.json');
    const materialsPath = resolve(output, provider + '.original-materials.json');
    await writeFile(inputPath, before + '\n'); await writeFile(framePath, originalJSON(result.frame) + '\n');
    await writeFile(materialsPath, originalJSON(shaderSources.map((source, i) => ({ source, material: materials[i] }))) + '\n');
    const oldFrame = originalJSON(result.frame), oldBuffers = bufferHashes(result.primitives);
    const repeated = gpu.preparePrimitiveSceneFrame(result.frame); verify(repeated, result.frame);
    for (let i = 0; i < result.primitives.length; i++) for (const [name, replacement] of [['positions', 99], ['normals', .125], ['indices', 7]]) {
      const view = result.primitives[i][name], value = view[0]; assert.notStrictEqual(view, repeated.primitives[i][name]);
      view[0] = replacement; assert.equal(view[0], replacement); assert.equal(originalJSON(result.frame), oldFrame);
      const reconstructed = gpu.preparePrimitiveSceneFrame(result.frame); assert.deepEqual(bufferHashes(reconstructed.primitives), oldBuffers);
      view[0] = value;
    }
    assert.deepEqual(bufferHashes(result.primitives), oldBuffers); accepted++;
    const mutatedCaller = clone(input), copied = gpu.preparePrimitiveSceneFrame(mutatedCaller);
    const copiedFrame = originalJSON(copied.frame); mutatedCaller.scene.entries[0].packet.positions[0] = 999;
    mutatedCaller.options.camera.eye[0] = 999; mutatedCaller.materials[0].binding.uniforms.amount = .75;
    assert.equal(originalJSON(copied.frame), copiedFrame); assert.notStrictEqual(copied.frame, result.frame); accepted++;
    const priorFiles = await Promise.all([inputPath, framePath, materialsPath, ...assets.flatMap(a => [a.path, a.nativePath])]
      .map(async path => ({ path, sha256: hash(await readFile(path)) })));
    const refusals = [];
    async function reject(name, change, expectedType = 'GPUError', profile, inspect) {
      const candidate = clone(input), value = typeof change === 'function' ? change(candidate) ?? candidate : change;
      let error; try { gpu.preparePrimitiveSceneFrame(value, profile); } catch (cause) { error = cause; }
      const ErrorType = expectedType === 'RangeError' ? RangeError : expectedType === 'Error' ? Error : gpu[expectedType];
      assert.equal(typeof ErrorType, 'function', name + ': expected error constructor');
      assert(error instanceof ErrorType, name + ': actual error family');
      inspect?.(error); assert.equal(originalJSON(result.frame), oldFrame); assert.deepEqual(bufferHashes(result.primitives), oldBuffers);
      assert.equal(originalJSON(input), before); for (const file of priorFiles) assert.equal(hash(await readFile(file.path)), file.sha256);
      refused++; refusals.push({ name, family: error.name, code: error.code ?? null, message: error.message,
        cause: error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message } : null });
    }
    await reject('empty qualified profile', empty);
    await reject('unknown profile', input, 'GPUError', 'unknown');
    await reject('five entries', f => { f.scene.entries = [...f.scene.entries, ...clone(four.scene.entries).slice(1)]; });
    await reject('duplicate native qualified identity', f => { f.scene.entries[1].ref = clone(f.scene.entries[0].ref); });
    await reject('geometry reference differs from native', f => { f.scene.entries[0].ref.geometryId = 'wrong'; });
    await reject('material outside candidate namespace', f => { f.materials[0].ref.modelId = 'missing'; });
    await reject('duplicate material reference', f => { f.materials.push(clone(f.materials[0])); });
    await reject('native packet nonfinite position', f => { f.scene.entries[0].packet.positions[0] = NaN; }, 'RangeError');
    await reject('native packet incorrect extrema', f => { f.scene.entries[0].packet.bounds.min[0] = -999; }, 'RangeError');
    await reject('invalid unit quaternion', f => { f.scene.entries[0].transform.rotationXYZW = [0, 0, 0, 0]; }, 'RangeError');
    await reject('invalid scale', f => { f.scene.entries[0].transform.scale[0] = 0; }, 'RangeError');
    await reject('invalid camera', f => { f.options.camera.near = -1; }, 'RangeError');
    await reject('invalid lighting', f => { f.options.lighting.direction = [0, 0, 0]; }, 'RangeError');
    await reject('uniform outside declared range', f => { f.materials[0].binding.uniforms.amount = 2; }, 'MeshMaterialError');
    await reject('source reconstructed material refused', f => { f.materials[0].binding.material.source += ' invalid'; }, 'MeshMaterialError');
    await reject('unknown root field', f => { f.unexpected = true; });
    await reject('wrong frame version', f => { f.version = 1; });
    await reject('wrong qualified scene version', f => { f.scene.version = 1; });
    await reject('particles outside CPU slice', f => { f.particles = {}; });
    await reject('cloth outside CPU slice', f => { f.cloth = null; });
    await reject('root getter never invoked', f => { Object.defineProperty(f, 'materials', { enumerable: true, get() { getters++; return []; } }); });
    const oversized = new Proxy(Array(5).fill(null), { ownKeys() { materialEnumeration++; throw new Error('Material budget must precede enumeration'); } });
    await reject('material budget before key enumeration', f => { f.materials = oversized; }); assert.equal(materialEnumeration, 0);
    const marker = new Error('Actual preflight reflection identity');
    await reject('actual reflection Error identity', () => new Proxy(clone(input), { getPrototypeOf() { reflections++; throw marker; } }), 'Error', undefined,
      error => assert.strictEqual(error, marker));
    const nonError = 'actual preflight reflection non-Error';
    await reject('actual reflection non-Error cause', () => new Proxy(clone(input), { getPrototypeOf() { reflections++; throw nonError; } }), 'GPUError', undefined,
      error => { assert.strictEqual(error.cause, nonError); assert.equal(Object.getOwnPropertyDescriptor(error, 'cause').enumerable, false); });
    assert.equal(getters, 0); assert.equal(domReads, 0);

    const childCode = `import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
      const cfg=JSON.parse(process.argv[1]);assert.equal(Number(process.versions.node.split('.')[0]),22);const cad=await import(pathToFileURL(cfg.cad).href);
      const hash=v=>createHash('sha256').update(v).digest('hex');
      for(const files of cfg.assets){const text=await readFile(files[0],'utf8'),saved=JSON.parse(await readFile(files[1],'utf8')),compiled=cad.compileCadModel(text,{sourceVersion:0});assert.equal(compiled.ok,true);assert.equal(text,saved.source);assert.deepEqual(compiled.model,saved.model);assert.deepEqual(cad.tessellateSurface(compiled.model.objects[0],{countU:5,countV:5,revision:0}).packet,saved.packet);}
      const input=JSON.parse(await readFile(cfg.input,'utf8')),frame=JSON.parse(await readFile(cfg.frame,'utf8')),materials=JSON.parse(await readFile(cfg.materials,'utf8')),out=[];
      for(const entry of cfg.entries){const gpu=await import(pathToFileURL(entry).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);
        for(const m of materials){const c=gpu.compileMeshMaterial(m.source);assert.equal(c.ok,true);assert.deepEqual(c.material,m.material);}
        const first=gpu.preparePrimitiveSceneFrame(input),cold=gpu.preparePrimitiveSceneFrame(frame);assert.deepEqual(first.frame,frame);assert.deepEqual(cold.frame,frame);
        out.push({bounds:cold.bounds,bufferBytes:cold.bufferBytes,hashes:cold.primitives.map(p=>Object.fromEntries(['positions','normals','indices'].map(k=>{const a=p[k];return[k,hash(Buffer.from(a.buffer,a.byteOffset,a.byteLength))]})))});}
      console.log(JSON.stringify({node:process.version,providers:out}));`;
    const cold = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', childCode,
      JSON.stringify({ cad: cadEntry, assets: assets.map(a => [a.path, a.nativePath]), input: inputPath, frame: framePath, materials: materialsPath,
        entries: [ordinary, emitted], namespace })], { encoding: 'utf8' }));
    for (const row of cold.providers) { assert.deepEqual(row.bounds, result.bounds); assert.equal(row.bufferBytes, 1584); assert.deepEqual(row.hashes, oldBuffers); }
    results.push({ provider, canonicalFrameSHA256: hash(oldFrame), bufferBytes: result.bufferBytes, bounds: result.bounds, buffers: oldBuffers,
      materialOrder: result.frame.materials.map(m => m.ref), canonicalUniforms: result.frame.materials.map(m => m.binding.uniforms),
      files: priorFiles, cold, refusals });
  }
  assert.deepEqual(results[0].buffers, results[1].buffers); assert.deepEqual(results[0].bounds, results[1].bounds);
  assert.equal(results[0].canonicalFrameSHA256, results[1].canonicalFrameSHA256);
  assert.equal(originalJSON(assets.map(({ source, model, packet, ref }) => ({ source, model, packet, ref }))), assetsBefore);
} catch (error) { failures.push(String(error.stack ?? error)); throw error; }
finally {
  for (const [name, descriptor] of domDescriptors) if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  const report = { issue: 1375, scope: 'CPU preflight only', parent: '9e00c357559cf47abee5c0b5bd0da7c95565a960',
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(), accepted, refused, getters, reflections,
    materialEnumeration, domReads, namespaceCount: namespace.length, results, failures, ordinarySourceGraph: graph,
    cadSourceGraph: Object.keys(cadBundled.metafile.inputs), fixture: { path: fixturePath, sha256: hash(fixtureBytes) },
    providers: { ordinary: { path: ordinary, sha256: hash(await readFile(ordinary)) }, emitted: { path: emitted, sha256: hash(await readFile(emitted)) },
      cadSource: { path: cadEntry, sha256: hash(await readFile(cadEntry)) }, declarations: { path: declarationPath, sha256: hash(declaration), leafSHA256: hash(leafDeclaration) } },
    actualGL: false, rendererMount: false, publicCodec: false, compiledCADCoverage: false,
    limits: ['Complete copied native/material frame CPU preflight, not first mount or rendered Open.',
      'Surface native Number coordinates/parameters/IDs/control source remain distinct from derived Float32 display positions/normals/Uint16.',
      'DOM getter poisoning observes no target access; it is not a fake context or rendering proof.',
      'Bounds cover actual Float32 display samples only; bytes count owned execution views, not physical driver memory.',
      'CAD source compile/tessellate is an actual provider composition; no all-published CAD API or old producer-suite claim.',
      'Cold evidence JSON is private and adds no public codec; currentRoot, consumer, graphics/lifetime and publication remain separate.'] };
  await writeFile(resolve(output, 'actual-result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ issue: 1375, accepted, refused, getters, reflections, materialEnumeration, domReads, namespaceCount: namespace.length, actualGL: false, failures }));
}
