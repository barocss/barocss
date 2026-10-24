/** #1184 ONE authored sampler/resource CPU join/source/emitted/file/cold qualifier.
 * node examples/gpu-scene/engine-uv-texture-material-bindings-flow.mjs --output ABS_FRESH
 * No DOM, fake GPU, decoded/sample RGB, browser, server or producer qualifier replay.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import ts from 'typescript';

assert.equal(Number(process.versions.node.split('.')[0]), 22); assert.equal(process.argv.length, 4); assert.equal(process.argv[2], '--output'); assert.ok(isAbsolute(process.argv[3]));
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), output = resolve(process.argv[3]); await mkdir(output, { recursive: false });
const parent = '1ce68ccd528df49d8fddd62ad2b499e3f520379c', pkg = resolve(repo, 'packages/barocss-gpu'), hash = value => createHash('sha256').update(value).digest('hex');
function signed(value) { if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); } if (value === null || typeof value !== 'object') return JSON.stringify(value); if (ArrayBuffer.isView(value)) return signed(Array.from(value)); return Array.isArray(value) ? '[' + value.map(signed).join(',') + ']' : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + signed(value[key])).join(',') + '}'; }
const clone = value => JSON.parse(signed(value)), keys = (value, fields) => assert.deepEqual(Object.keys(value).sort(), [...fields].sort());
function frozen(value) { if (value && typeof value === 'object' && !ArrayBuffer.isView(value)) { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } }
function refs(value, seen = new Set()) { if (value && typeof value === 'object' && !seen.has(value)) { seen.add(value); if (ArrayBuffer.isView(value)) seen.add(value.buffer); else Object.values(value).forEach(child => refs(child, seen)); } return seen; }
function independent(left, right) { const others = refs(right); for (const value of refs(left)) assert.ok(!others.has(value), 'Independent data ownership'); }
const gitFile = path => execFileSync('git', ['show', parent + ':' + path], { cwd: repo, encoding: 'utf8' });
async function receipt(path) { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }
async function save(name, content) { const path = resolve(output, name); await writeFile(path, content, { flag: 'wx' }); return receipt(path); }
const owned = ['packages/barocss-gpu/src/material/engine-uv-texture-material-bindings.ts', 'packages/barocss-gpu/src/index.ts', 'packages/barocss-gpu/README.md', 'examples/gpu-scene/engine-uv-texture-material-bindings-flow.mjs'];
const changed = execFileSync('git', ['diff', '--name-only', parent], { cwd: repo, encoding: 'utf8' }).trim().split('\n').filter(Boolean), untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: repo, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const delta = [...new Set([...changed, ...untracked])].sort();
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const cadAlias = resolve(repo, 'packages/barocss-cad/src/index.ts');
const ordinary = resolve(output, 'ordinary-public.mjs'), bundle = await build({ absWorkingDir: repo, alias: { '@barocss/cad': cadAlias }, entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const sourceGraph = [];
for (const path of Object.keys(bundle.metafile.inputs).sort()) {
  assert.ok(!/barocss-(gpu|cad)\/dist\//.test(path), 'No ordinary-source dist fallback');
  const bytes = await readFile(resolve(repo, path)), packageStart = path.indexOf('packages/barocss-');
  const packagePath = packageStart < 0 ? null : path.slice(packageStart);
  sourceGraph.push({ path, packagePath, bytes: bytes.length, sha256: hash(bytes) });
  if (packagePath !== null && !owned.includes(packagePath)) {
  }
}
for (const leaf of ['engine-uv-texture-material-bindings.ts', 'engine-texture-bindings.ts', 'mesh-material.ts', 'material-texture-shader-body.ts']) assert.ok(sourceGraph.some(row => (row.path.includes('/src/') && row.path.endsWith('/' + leaf))), leaf);
const oldBarrel = gitFile('packages/barocss-gpu/src/index.ts'), barrelAST = ts.createSourceFile('parent.ts', oldBarrel, ts.ScriptTarget.Latest, true);
const oldRuntime = barrelAST.statements.filter(node => ts.isExportDeclaration(node) && !node.isTypeOnly && node.exportClause && ts.isNamedExports(node.exportClause)).flatMap(node => node.exportClause.elements.filter(entry => !entry.isTypeOnly).map(entry => entry.name.text)).sort();
const additions = ['prepareEngineUVTextureMaterialBindings', 'EngineUVTextureMaterialBindingsError', 'EngineUVTextureMaterialBindingsDiagnosticCode'];
 assert.equal(manifest.publishConfig.exports['.'].import, './dist/index.js');
const providers = [{ label: 'ordinary-source', path: ordinary }, { label: 'emitted-public', path: resolve(pkg, manifest.publishConfig.exports['.'].import) }]; for (const provider of providers) provider.gpu = await import(pathToFileURL(provider.path).href);
const namespace = Object.keys(providers[0].gpu).sort(); assert.ok([...additions].sort().every(x => namespace.includes(x))); assert.deepEqual(Object.keys(providers[1].gpu).sort(), namespace);
const publicTypes = ['EngineUVTextureMaterialBindingsDiagnosticCode', 'EngineUVTextureMaterialBindingV0', 'EngineUVTextureMaterialBindingsV0', 'EngineUVTextureMaterialSamplerBinding', 'PreparedEngineUVTextureMaterialBindings'];
const declarations = await readFile(resolve(pkg, manifest.publishConfig.exports['.'].types), 'utf8'), leafDTS = await readFile(resolve(pkg, 'dist/engine-uv-texture-material-bindings.d.ts'), 'utf8');
for (const name of [...additions, ...publicTypes]) assert.ok(new RegExp('\\b' + name + '\\b').test(declarations)); for (const name of publicTypes) assert.ok(new RegExp('\\b' + name + '\\b').test(leafDTS));

function scene() { const node = (id, materialId, x) => ({ id, type: 'mesh', parentId: null, translation: [x, -0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1], visible: true, geometryId: 'original_quad', materialId }); return {
  format: 'barocss-gpu-engine-scene', version: 0, id: 'authored_texture_join', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', background: [-0, .1, .2], camera: { eye: [0, 0, 6], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 100 },
  geometries: [{ format: 'barocss-gpu-triangle-geometry', version: 0, id: 'original_quad', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', winding: 'ccw', positions: [-.75, -.75, -0, .75, -.75, 0, .75, .75, 0, -.75, .75, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], uvs: [-0, 0, 1, 0, 1, 1, 0, 1], indices: [-0, 1, 2, 0, 2, 3] }],
  materials: [{ id: 'left_tint', type: 'unlit', colorSpace: 'linear', color: [1, .5, .25] }, { id: 'right_tint', type: 'unlit', colorSpace: 'linear', color: [.25, .5, .75] }], nodes: [node('left_instance', 'left_tint', -1), node('right_instance', 'right_tint', 1)] }; }
function catalog() { return { format: 'barocss-gpu-engine-texture-bindings', version: 0, sceneId: 'authored_texture_join', textures: [{ id: 'checker_original', width: 2, height: 2, format: 'rgba8', colorSpace: 'srgb', rowOrigin: 'bottom-left', filter: 'nearest', wrapS: 'clamp-to-edge', wrapT: 'clamp-to-edge', pixels: [64, -0, 128, 255, 192, 96, 32, 255, 8, 144, 240, 255, 224, 176, 80, 255] }], bindings: [{ materialId: 'left_tint', textureId: 'checker_original' }, { materialId: 'right_tint', textureId: 'checker_original' }] }; }
const leftSource = '// Original left é😀\r\n@shader #join_palette {@uniform amount:float(-0,1,.25);@sampler image:sampler2d;@fragment{color:mix(sample(image,uv_u,uv_v),#204080,amount);}}\r\n';
const rightSource = '@shader #join_palette {@uniform gain:float(-1,1,-.5);@sampler albedo:sampler2d;@fragment{color:mix(sample(albedo,clamp(uv_u,0,1),clamp(uv_v,0,1)),#80C040,clamp(gain,0,1));}}';
function companion(gpu, authored) { return { format: 'barocss-gpu-engine-uv-texture-material-bindings', version: 0, sceneId: 'authored_texture_join', bindings: authored.map(({ materialId, source, uniforms }) => { const compiled = gpu.compileEngineUVTextureMaterial(source); assert.equal(compiled.ok, true, JSON.stringify(compiled)); return { materialId, material: clone(compiled.material), uniforms: clone(uniforms) }; }) }; }
function base(gpu) { const authored = [{ materialId: 'left_tint', source: leftSource, uniforms: {} }, { materialId: 'right_tint', source: rightSource, uniforms: { gain: -0 } }]; return { scene: scene(), catalog: catalog(), material: companion(gpu, authored), authored }; }
function observe(p) { return { scene: p.scene, textureBindings: p.textureBindings, materialBindings: p.materialBindings, resolvedBindings: p.resolvedBindings, loweredBindings: p.loweredBindings, samplerBindings: p.samplerBindings, textures: p.textures, pixelBytes: p.pixelBytes }; }
let accepted = 0, refused = 0, getters = 0, reflections = 0, budgetEnumeration = 0, statefulReads = 0;
const rows = [], coldCases = [];
for (const provider of providers) {
  const gpu = provider.gpu; assert.ok(Object.isFrozen(gpu.EngineUVTextureMaterialBindingsDiagnosticCode)); keys(gpu.EngineUVTextureMaterialBindingsDiagnosticCode, ['INPUT', 'VERSION', 'BUDGET', 'REFERENCE', 'UNIFORM', 'MATERIAL', 'TEXTURE', 'SCENE']);
  const records = [], retained = [];
  async function accept(name, request) {
    const before = signed({ scene: request.scene, catalog: request.catalog, material: request.material });
    const result = gpu.prepareEngineUVTextureMaterialBindings(request.scene, request.catalog, request.material);
    keys(result, ['scene', 'textureBindings', 'materialBindings', 'resolvedBindings', 'loweredBindings', 'samplerBindings', 'textures', 'pixelBytes']); frozen(result);
    assert.deepEqual(result.scene.scene, request.scene); assert.deepEqual(result.textureBindings, request.catalog); assert.deepEqual(result.materialBindings, request.material); assert.equal(result.pixelBytes, 16); assert.equal(result.textures.length, 1);
    assert.strictEqual(result.textures[0].texture, result.textureBindings.textures[0]); assert.ok(result.textures[0].pixels instanceof Uint8Array); assert.deepEqual(Array.from(result.textures[0].pixels), request.catalog.textures[0].pixels.map(n => n === 0 ? 0 : n));
    assert.ok(Object.is(result.textureBindings.textures[0].pixels[1], -0)); assert.ok(Object.is(result.scene.scene.geometries[0].uvs[0], -0)); assert.equal(result.scene.draws.length, 2); assert.strictEqual(result.scene.draws[0].geometry, result.scene.draws[1].geometry);
    for (let i = 0; i < request.material.bindings.length; i++) {
      const original = request.material.bindings[i], resolved = result.resolvedBindings[i], lowered = result.loweredBindings[i], mapped = result.samplerBindings[i], alias = original.material.samplers[0].name;
      keys(resolved, ['materialId', 'binding']); keys(resolved.binding, ['material', 'uniforms']); keys(lowered, ['materialId', 'lowered']); keys(mapped, ['materialId', 'name', 'textureId', 'glslName']);
      assert.deepEqual(mapped, { materialId: original.materialId, name: alias, textureId: 'checker_original', glslName: 'mat_s_0' }); assert.equal(resolved.materialId, original.materialId); assert.deepEqual(resolved.binding.material, original.material); independent(result.materialBindings.bindings[i].material, resolved.binding.material);
      for (const uniform of original.material.uniforms) { const expected = Object.hasOwn(original.uniforms, uniform.name) ? original.uniforms[uniform.name] : uniform.default; assert.ok(Object.hasOwn(resolved.binding.uniforms, uniform.name)); assert.strictEqual(resolved.binding.uniforms[uniform.name], expected === 0 ? 0 : expected); }
      assert.equal(lowered.materialId, original.materialId); assert.equal(lowered.lowered.samplerLayout[0].name, alias); assert.equal(lowered.lowered.samplerLayout[0].glslName, 'mat_s_0'); assert.equal(lowered.lowered.uniformLayout.length, original.material.uniforms.length);
    }
    assert.equal(signed({ scene: request.scene, catalog: request.catalog, material: request.material }), before); assert.equal(Object.isFrozen(request.scene), false); independent(result, request);
    const again = gpu.prepareEngineUVTextureMaterialBindings(request.scene, request.catalog, request.material); independent(result, again); assert.equal(signed(observe(result)), signed(observe(again)));
    const signature = hash(signed(observe(result))), sourceFiles = [];
    for (let i = 0; i < request.authored.length; i++) sourceFiles.push(await save(provider.label + '.' + name + '.' + i + '.material.css', request.authored[i].source));
    const sceneFile = await save(provider.label + '.' + name + '.original-scene.json', signed(request.scene) + '\n'), catalogFile = await save(provider.label + '.' + name + '.original-catalog.json', signed(request.catalog) + '\n');
    const authoredFile = await save(provider.label + '.' + name + '.original-authored.json', signed(request.authored.map((entry, i) => ({ materialId: entry.materialId, sourceFile: sourceFiles[i].path, uniforms: entry.uniforms }))) + '\n');
    const materialFile = await save(provider.label + '.' + name + '.original-material-input.json', signed(request.material) + '\n'), observationFile = await save(provider.label + '.' + name + '.prepared-observation.json', signed(observe(result)) + '\n');
    const previousByte = result.textures[0].pixels[0]; result.textures[0].pixels[0] = 17; assert.equal(again.textures[0].pixels[0], previousByte); assert.equal(result.textureBindings.textures[0].pixels[0], request.catalog.textures[0].pixels[0]); result.textures[0].pixels[0] = previousByte;
    const previousPosition = result.scene.geometries[0].positions[0]; result.scene.geometries[0].positions[0] = 99; assert.equal(again.scene.geometries[0].positions[0], previousPosition); assert.equal(result.scene.scene.geometries[0].positions[0], request.scene.geometries[0].positions[0]); result.scene.geometries[0].positions[0] = previousPosition;
    assert.equal(hash(signed(observe(result))), signature);
    const record = { provider: provider.label, name, signature, sceneFile, catalogFile, authoredFile, materialFile, observationFile, sourceFiles, samplerBindings: clone(result.samplerBindings), pixelBytes: result.pixelBytes, entryCount: result.materialBindings.bindings.length };
    records.push(record); coldCases.push(record); retained.push({ result, signature, files: [sceneFile, catalogFile, authoredFile, materialFile, observationFile, ...sourceFiles] }); accepted++; return result;
  }
  const main = base(gpu), original = await accept('shared_two_aliases', main);
  assert.equal(original.materialBindings.bindings[0].material.shaderId, original.materialBindings.bindings[1].material.shaderId); assert.notEqual(original.samplerBindings[0].name, original.samplerBindings[1].name);
  assert.equal(original.resolvedBindings[0].binding.uniforms.amount, .25); assert.ok(Object.is(original.materialBindings.bindings[1].uniforms.gain, -0)); assert.ok(!Object.is(original.resolvedBindings[1].binding.uniforms.gain, -0));
  const replacement = base(gpu); replacement.authored[0].source = replacement.authored[0].source.replace(/image/g, 'layer').replace('1,.25', '1,.5'); replacement.catalog.textures[0].pixels.splice(0, 4, 192, -0, 32, 255); replacement.material = companion(gpu, replacement.authored);
  const replaced = await accept('same_ids_new_source_and_pixels', replacement); assert.equal(replaced.samplerBindings[0].name, 'layer'); assert.equal(replaced.textures[0].texture.id, original.textures[0].texture.id); assert.equal(replaced.textures[0].pixels[0], 192); assert.equal(original.textures[0].pixels[0], 64); assert.equal(original.samplerBindings[0].name, 'image');
  const empty = base(gpu); empty.authored = []; empty.material = companion(gpu, []); await accept('zero_authored_entries', empty);
  const safe = base(gpu); safe.authored[0].source = '@shader #constructor_palette {@uniform constructor:float(0,1,.4);@sampler image:sampler2d;@fragment{color:mix(sample(image,uv_u,uv_v),#fff,constructor);}}'; safe.authored[0].uniforms = { constructor: .6 }; safe.material = companion(gpu, safe.authored); const safeResult = await accept('declared_constructor_is_own_number', safe); assert.equal(Object.getOwnPropertyDescriptor(safeResult.resolvedBindings[0].binding.uniforms, 'constructor').value, .6);
  const maximum = base(gpu); maximum.scene.materials = Array.from({ length: 8 }, (_, i) => ({ id: 'slotmat_' + i, type: 'unlit', colorSpace: 'linear', color: [1, 1, 1] })); maximum.scene.nodes[0].materialId = 'slotmat_0'; maximum.scene.nodes[1].materialId = 'slotmat_1'; maximum.catalog.bindings = maximum.scene.materials.map(material => ({ materialId: material.id, textureId: 'checker_original' }));
  maximum.authored = maximum.scene.materials.map((material, i) => ({ materialId: material.id, source: '@shader #slots {' + Array.from({ length: 16 }, (_, n) => '@uniform u' + n + ':float(0,1,.5);').join('') + '@sampler slot' + i + ':sampler2d;@fragment{color:mix(sample(slot' + i + ',uv_u,uv_v),#fff,u15);}}', uniforms: Object.fromEntries(Array.from({ length: 16 }, (_, n) => ['u' + n, n === 0 ? -0 : .5])) })); maximum.material = companion(gpu, maximum.authored);
  const maximal = await accept('eight_entries_128_declared_supplied_uniforms', maximum); assert.equal(maximal.resolvedBindings.reduce((sum, entry) => sum + Object.keys(entry.binding.uniforms).length, 0), 128);
  const caller = base(gpu), copied = gpu.prepareEngineUVTextureMaterialBindings(caller.scene, caller.catalog, caller.material), copiedSignature = hash(signed(observe(copied))); caller.scene.geometries[0].uvs[0] = .75; caller.catalog.textures[0].pixels[0] = 255; caller.material.bindings[1].uniforms.gain = .5; assert.equal(hash(signed(observe(copied))), copiedSignature); accepted++;

  const failures = [];
  async function retention() { assert.equal(getters, 0); for (const saved of retained) { assert.equal(hash(signed(observe(saved.result))), saved.signature); for (const file of saved.files) assert.equal(hash(await readFile(file.path)), file.sha256); } }
  async function refuse(name, edit, code, inspect) {
    const request = base(gpu); edit(request); let error; try { gpu.prepareEngineUVTextureMaterialBindings(request.scene, request.catalog, request.material); } catch (caught) { error = caught; }
    assert.ok(error instanceof gpu.EngineUVTextureMaterialBindingsError, name); assert.equal(error.code, code, name); assert.ok(error.message.startsWith(`[${code}] Engine UV texture material bindings: `)); assert.ok(error.message.length <= 1024); inspect?.(error);
    failures.push({ name, code: error.code, message: error.message, cause: error.cause instanceof Error ? { name: error.cause.name, code: error.cause.code ?? null, causeCode: error.cause.cause?.code ?? null } : null }); refused++; await retention();
  }
  const local = error => assert.equal(Object.hasOwn(error, 'cause'), false);
  await refuse('root_format', r => { r.material.format = 'numeric-materials'; }, 'VERSION', local);
  await refuse('root_extra_field', r => { r.material.extra = true; }, 'INPUT', local);
  await refuse('cross_scene_join', r => { r.material.sceneId = 'other_scene'; }, 'REFERENCE', local);
  await refuse('missing_scene_material', r => { r.material.bindings[0].materialId = 'absent'; }, 'REFERENCE', local);
  await refuse('duplicate_authored_material', r => { r.material.bindings[1] = clone(r.material.bindings[0]); }, 'REFERENCE', local);
  await refuse('unused_alias_still_requires_texture', r => { r.material.bindings[1].material = gpu.compileEngineUVTextureMaterial('@shader #unused {@sampler albedo:sampler2d;@fragment{color:#80C040;}}').material; r.material.bindings[1].uniforms = {}; r.catalog.bindings.pop(); }, 'REFERENCE', local);
  await refuse('unknown_override', r => { r.material.bindings[0].uniforms = { missing: .5 }; }, 'UNIFORM', local);
  await refuse('override_range', r => { r.material.bindings[0].uniforms = { amount: 2 }; }, 'UNIFORM', local);
  for (const [label, value] of [['NaN', NaN], ['Infinity', Infinity], ['undefined', undefined], ['function', () => .5], ['object', {}], ['symbol', Symbol('invalid')]]) await refuse('override_' + label, r => { r.material.bindings[0].uniforms = { amount: value }; }, 'UNIFORM', local);
  await refuse('own_proto_override', r => { r.material.bindings[0].uniforms = Object.fromEntries([['__proto__', .5]]); }, 'UNIFORM', local);
  await refuse('declared_proto_default', r => { const compiled = gpu.compileEngineUVTextureMaterial('@shader #unsafe {@uniform __proto__:float(0,1,.5);@sampler image:sampler2d;@fragment{color:mix(sample(image,uv_u,uv_v),#fff,__proto__);}}'); assert.equal(compiled.ok, true); r.material.bindings[0].material = compiled.material; r.material.bindings[0].uniforms = {}; }, 'UNIFORM', local);
  await refuse('unknown_constructor_not_declared', r => { r.material.bindings[0].uniforms = { constructor: .5 }; }, 'UNIFORM', local);
  await refuse('nine_before_binding_enumeration', r => { r.material.bindings = new Proxy(Array(9).fill(null), { ownKeys() { budgetEnumeration++; throw new Error('Budget must precede own-key enumeration'); } }); }, 'BUDGET', local); assert.equal(budgetEnumeration, 0);
  await refuse('seventeen_supplied_uniforms', r => { r.material.bindings[0].uniforms = Object.fromEntries(Array.from({ length: 17 }, (_, i) => ['u' + i, .5])); }, 'BUDGET', local);
  await refuse('aggregate_source_UTF16', r => { r.material.bindings[0].material.source = ' '.repeat(65536) + leftSource; }, 'BUDGET', local);
  await refuse('aggregate_source_UTF8', r => { for (const entry of r.material.bindings) entry.material.source = '//' + 'é'.repeat(16380) + '\n' + entry.material.source; }, 'BUDGET', local);
  await refuse('source_input_getter0', r => { Object.defineProperty(r.material.bindings[0].material, 'source', { enumerable: true, get() { getters++; return leftSource; } }); }, 'INPUT', local);
  await refuse('uniform_getter0', r => { Object.defineProperty(r.material.bindings[0].uniforms, 'amount', { enumerable: true, get() { getters++; return .5; } }); }, 'INPUT', local);
  await refuse('uniform_hidden_descriptor', r => { Object.defineProperty(r.material.bindings[0].uniforms, 'amount', { value: .5, enumerable: false }); }, 'INPUT', local);
  await refuse('stateful_uniform_snapshot_rechecked', r => { r.material.bindings[0].uniforms = new Proxy({ amount: .5 }, { getOwnPropertyDescriptor(target, key) { const descriptor = Reflect.getOwnPropertyDescriptor(target, key); if (key === 'amount') { statefulReads++; return { ...descriptor, value: statefulReads % 2 === 1 ? .5 : '.5' }; } return descriptor; } }); }, 'UNIFORM', local); assert.ok(statefulReads >= 2);
  await refuse('entry_cycle', r => { r.material.bindings[0].material.expression.loop = r.material.bindings[0].material.expression; }, 'INPUT', local);
  await refuse('forged_sampler_IR', r => { r.material.bindings[0].material.expression.args[0].sampler = 'missing'; }, 'MATERIAL', error => { assert.ok(error.cause instanceof gpu.MeshMaterialError); assert.equal(error.cause.code, 'IR'); });
  await refuse('original_source_compile_diagnostic_chain', r => { r.material.bindings[0].material.source = '@shader #bad {@sampler image:sampler2d;@fragment{color:sample(image,#fff,uv_v);}}'; }, 'MATERIAL', error => { assert.ok(error.cause instanceof gpu.MeshMaterialError); assert.equal(error.cause.code, 'IR'); assert.equal(error.cause.cause.code, 'TYPE'); frozen(error.cause.cause); });
  await refuse('actual_texture_alpha_cause', r => { r.catalog.textures[0].pixels[3] = 254; }, 'TEXTURE', error => { assert.ok(error.cause instanceof gpu.EngineTextureBindingsError); assert.equal(error.cause.code, 'TEXTURE'); });
  await refuse('actual_texture_count_budget', r => { r.catalog.textures = Array.from({ length: 9 }, (_, i) => ({ ...clone(r.catalog.textures[0]), id: 't_' + i })); }, 'BUDGET', error => { assert.ok(error.cause instanceof gpu.EngineTextureBindingsError); assert.equal(error.cause.code, 'BUDGET'); });
  await refuse('actual_texture_reference', r => { r.catalog.bindings[0].textureId = 'missing'; }, 'REFERENCE', error => { assert.ok(error.cause instanceof gpu.EngineTextureBindingsError); assert.equal(error.cause.code, 'REFERENCE'); });
  await refuse('actual_scene_provider_chain', r => { r.scene.nodes[0].geometryId = 'missing'; }, 'SCENE', error => { assert.ok(error.cause instanceof gpu.EngineTextureBindingsError); assert.equal(error.cause.code, 'SCENE'); assert.ok(error.cause.cause instanceof gpu.EngineSceneError); assert.equal(error.cause.cause.code, 'REFERENCE'); });
  for (const operation of ['getPrototypeOf', 'ownKeys', 'getOwnPropertyDescriptor']) for (const kind of ['branded', 'undefined']) {
    const marker = kind === 'undefined' ? undefined : new gpu.EngineUVTextureMaterialBindingsError('UNIFORM', 'Caller reflection sentinel');
    await refuse(operation + '_' + kind, r => { r.material = new Proxy(r.material, { [operation]() { reflections++; throw marker; } }); }, 'INPUT', error => { assert.notStrictEqual(error, marker); const descriptor = Object.getOwnPropertyDescriptor(error, 'cause'); assert.ok(descriptor && 'value' in descriptor); assert.strictEqual(descriptor.value, marker); });
  }
  await retention(); rows.push({ provider: provider.label, records, failures });
}
for (let i = 0; i < rows[0].records.length; i++) assert.equal(rows[0].records[i].signature, rows[1].records[i].signature); assert.equal(getters, 0); assert.equal(reflections, 12); assert.equal(budgetEnumeration, 0);

const coldCode = String.raw`
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';assert.equal(Number(process.versions.node.split('.')[0]),22);const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')),hash=v=>createHash('sha256').update(v).digest('hex');
function signed(v){if(typeof v==='number'){assert.ok(Number.isFinite(v));return Object.is(v,-0)?'-0':JSON.stringify(v);}if(v===null||typeof v!=='object')return JSON.stringify(v);if(ArrayBuffer.isView(v))return signed(Array.from(v));return Array.isArray(v)?'['+v.map(signed).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+signed(v[k])).join(',')+'}';}
const rows=[];for(const provider of cfg.providers){const gpu=await import(pathToFileURL(provider.path).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);for(const item of cfg.cases.filter(row=>row.provider===provider.label)){for(const file of[item.sceneFile,item.catalogFile,item.authoredFile,item.materialFile,item.observationFile,...item.sourceFiles])assert.equal(hash(readFileSync(file.path)),file.sha256);const scene=JSON.parse(readFileSync(item.sceneFile.path,'utf8')),catalog=JSON.parse(readFileSync(item.catalogFile.path,'utf8')),authored=JSON.parse(readFileSync(item.authoredFile.path,'utf8'));const material={format:'barocss-gpu-engine-uv-texture-material-bindings',version:0,sceneId:scene.id,bindings:authored.map(entry=>{const source=readFileSync(entry.sourceFile,'utf8'),compiled=gpu.compileEngineUVTextureMaterial(source);assert.equal(compiled.ok,true);assert.equal(compiled.material.source,source);return{materialId:entry.materialId,material:compiled.material,uniforms:entry.uniforms};})};assert.equal(signed(material),signed(JSON.parse(readFileSync(item.materialFile.path,'utf8'))));const result=gpu.prepareEngineUVTextureMaterialBindings(scene,catalog,material);assert.equal(hash(signed(result)),item.signature);assert.deepEqual(result.samplerBindings,item.samplerBindings);assert.equal(result.pixelBytes,16);rows.push({provider:provider.label,name:item.name,signature:item.signature,entries:result.materialBindings.bindings.length,pixelBytes:result.pixelBytes});}}
console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,authority:'full original material source files and authored overrides plus original scene/catalog; saved prepared and GLSL data are observations',sampledRGB:false,actualGPU:false,actualGL:false}));`;
const coldScript = await save('cold-authored-texture-bindings.mjs', coldCode), coldConfig = await save('cold-config.json', JSON.stringify({ namespace, providers: providers.map(({ label, path }) => ({ label, path })), cases: coldCases }, null, 2) + '\n');
const stdout = execFileSync(process.execPath, [coldScript.path, coldConfig.path], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }); await save('cold.stdout', stdout); const cold = JSON.parse(stdout); assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, 10);
const report = { issue: 1184, parent, stage: 'AUTHORED_ENGINE_UV_TEXTURE_RESOURCE_JOIN_CPU_SOURCE_FILE_COLD', node: process.version, accepted, refused, getters, reflections, budgetEnumeration, statefulReads, namespace, namespaceCount: namespace.length, publicTypes, delta,
  sourceGraph, cadAlias, ordinary: await receipt(ordinary), emitted: await receipt(providers[1].path), rows, cold, sampledRGB: false, actualGPU: false, actualGL: false, fakeGPU: false, publication: false,
  support: 'Complete original scene/catalog and source-qualified authored texture profile joined by actual materialId, mandatory local sampler reference, copied signed originals/defaulted numeric uniforms, trusted lowering and independent inherited CPU upload/geometry views. No device-unit assignment/image decoding/sample RGB/program/upload/frame/pixel/rollback/loss/disposal/UI or consumer qualification.',
  providerWork: 'One actual texture/scene preparation and two complete-source reconstructions per entry through explicit validator plus public lowerer, at most16. No prepared-input shortcut, old producer flow replay or cache.',
  allocationLimit: 'Inherited CPU texture upload allocation precedes outer joint-reference refusal; no universal preallocation guarantee.', unforcedDefensiveGuards: ['validOriginalCompanion2MiB', 'validAggregateLowered1MiB', 'validEntry8192Values', 'directMaterialProviderBUDGET'] };
const result = await save('actual-result.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ issue: 1184, accepted, refused, getters, reflections, exports: namespace.length, coldRows: cold.rows.length, sampledRGB: false, actualGL: false, result }));
