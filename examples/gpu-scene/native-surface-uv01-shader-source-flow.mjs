/** #1449 trusted shader-source preparation only; no compile/link/draw.
 * Node22 examples/gpu-scene/native-surface-uv01-shader-source-flow.mjs --output ABS_FRESH
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

assert.equal(Number(process.versions.node.split('.')[0]), 22); assert.equal(process.argv.length, 4);
assert.equal(process.argv[2], '--output'); assert.ok(isAbsolute(process.argv[3]));
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), output = resolve(process.argv[3]); await mkdir(output, { recursive: false });
const parent = '3d73185e2d2adddc22bbed60afaf2a1d278af6a5', pkg = resolve(repo, 'packages/barocss-gpu'), manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const ordinary = resolve(output, 'ordinary-public.mjs'), bundle = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const sourceGraph = Object.keys(bundle.metafile.inputs); assert.ok(sourceGraph.some(p => p.endsWith('/src/native-surface-uv01-shader-source.ts')));
assert.ok(sourceGraph.some(p => p.includes('barocss-cad/src/'))); assert.ok(!sourceGraph.some(p => /barocss-(gpu|cad)\/dist\//.test(p)));
// Explicitly INTERNAL old shader control, not a new public API or runtime fallback.
const internalSource = resolve(output, 'internal-legacy-source.mjs'), internalEmitted = resolve(output, 'internal-legacy-emitted.mjs');
const legacyEntry = folder => 'export {MESH_SHADERS,meshLightingShaders,materialMeshShaders} from ' + JSON.stringify(resolve(pkg, folder + '/mesh-shaders.' + (folder === 'src' ? 'ts' : 'js'))) + ';\nexport {compileMeshMaterial,MeshMaterialError} from ' + JSON.stringify(resolve(pkg, folder + '/mesh-material.' + (folder === 'src' ? 'ts' : 'js'))) + ';';
const internalGraphs = {};
for (const [folder, path] of [['src', internalSource], ['dist', internalEmitted]]) { const built = await build({ stdin: { contents: legacyEntry(folder), resolveDir: repo, sourcefile: 'explicit-internal-legacy-control.mjs' }, bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: path, metafile: true });
  internalGraphs[folder] = Object.keys(built.metafile.inputs); assert.ok(!internalGraphs[folder].some(p => p.includes('/' + (folder === 'src' ? 'dist' : 'src') + '/'))); }
const providers = [{ label: 'ordinary-source', path: ordinary, internalPath: internalSource }, { label: 'emitted-public', path: resolve(pkg, manifest.publishConfig.exports['.'].import), internalPath: internalEmitted }];
for (const p of providers) { p.gpu = await import(pathToFileURL(p.path).href); p.legacy = await import(pathToFileURL(p.internalPath).href); }
const namespace = Object.keys(providers[0].gpu).sort(); assert.equal(namespace.length, 128); assert.deepEqual(Object.keys(providers[1].gpu).sort(), namespace);
const dtsPath = resolve(pkg, manifest.publishConfig.exports['.'].types), dts = await readFile(dtsPath, 'utf8'), leafDtsPath = resolve(pkg, 'dist/native-surface-uv01-shader-source.d.ts'), leafDts = await readFile(leafDtsPath, 'utf8');
for (const name of ['prepareNativeSurfaceUV01ShaderSource', 'NativeSurfaceUV01ShaderSourceError', 'NativeSurfaceUV01ShaderSourceRequest', 'PreparedNativeSurfaceUV01ShaderSource', 'NativeSurfaceUV01ShaderSourceCode']) { assert.ok(new RegExp('\\b' + name + '\\b').test(dts)); assert.ok(new RegExp('\\b' + name + '\\b').test(leafDts)); }
const hash = v => createHash('sha256').update(v).digest('hex');
function signed(v) { if (typeof v === 'number') { assert.ok(Number.isFinite(v)); return Object.is(v, -0) ? '-0' : JSON.stringify(v); } if (v === null || typeof v !== 'object') return JSON.stringify(v);
  assert.ok(!ArrayBuffer.isView(v)); if (Array.isArray(v)) return '[' + v.map(signed).join(',') + ']'; return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + signed(v[k])).join(',') + '}'; }
const clone = v => JSON.parse(signed(v));
const originalData = r => ({ ...r, binding: { ...r.binding, geometry: Object.fromEntries(Object.entries(r.binding.geometry).filter(([k]) => k !== 'uv01')) } });
const digest = r => hash(signed(originalData(r))), typedHash = v => hash(Buffer.from(v.buffer, v.byteOffset, v.byteLength));
function frozen(v) { if (v && typeof v === 'object' && !ArrayBuffer.isView(v)) { assert.ok(Object.isFrozen(v)); Object.values(v).forEach(frozen); } }
function refs(v, out = new Set()) { if (v && typeof v === 'object' && !out.has(v)) { out.add(v); Object.values(v).forEach(child => refs(child, out)); } return out; }
function independent(a, b) { const left = refs(a), right = refs(b); for (const o of left) assert.ok(!right.has(o)); }
async function receipt(path) { const b = await readFile(path); return { path, bytes: b.length, sha256: hash(b) }; }
// Independent complete old template oracle. Do not derive it from generated output.
const oldVertex = `#version 300 es
precision highp float;
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
uniform float aspect;
uniform bool defaultCamera;
uniform mat4 view;
uniform mat4 projection;
out vec3 worldNormal;
void main(){
 if(defaultCamera){
  vec3 p=position-vec3(0.0,0.0,6.0);
  float f=2.414213562373095;
  gl_Position=vec4(p.x*f/aspect,p.y*f,-1.000200020002*p.z-0.02000200020002,-p.z);
 }else{
  gl_Position=projection*view*vec4(position,1.0);
 }
 worldNormal=normal;
}`;
const fixedFragment = `#version 300 es
precision highp float;
in vec3 worldNormal;
uniform vec3 color;
out vec4 outputColor;
void main(){
 float light=0.35+0.65*max(dot(normalize(worldNormal),normalize(vec3(-0.6,0.8,1.0))),0.0);
 outputColor=vec4(pow(pow(color,vec3(2.2))*light,vec3(1.0/2.2)),1.0);
}`;
const litFragment = `#version 300 es
precision highp float;
in vec3 worldNormal;
uniform vec3 color;
uniform float ambientStrength;
uniform float directionalStrength;
uniform vec3 lightDirection;
out vec4 outputColor;
void main(){
 float light=ambientStrength+directionalStrength*max(dot(normalize(worldNormal),normalize(lightDirection)),0.0);
 outputColor=vec4(pow(pow(color,vec3(2.2))*light,vec3(1.0/2.2)),1.0);
}`;
const vertexInput = 'layout(location=2) in vec2 native_surface_uv01;', vertexOutput = 'out vec2 v_native_surface_uv01;', assignment = 'v_native_surface_uv01=native_surface_uv01;';
const expectedVertex = oldVertex.replace('layout(location=1) in vec3 normal;', 'layout(location=1) in vec3 normal;\n' + vertexInput)
  .replace('out vec3 worldNormal;', 'out vec3 worldNormal;\n' + vertexOutput).replace('worldNormal=normal;', 'worldNormal=normal;\n ' + assignment);
const bt = 'vec3(0.0000000000000000,0.0000000000000000,0.0000000000000000)', wt = 'vec3(1.0000000000000000,1.0000000000000000,1.0000000000000000)';
const lowerText = axis => 'clamp(mix(' + bt + ',' + wt + ',clamp((v_native_surface_uv01.' + (axis === 'u' ? 'x' : 'y') + '*mat_u_0),0.0,1.0)),vec3(0.0),vec3(1.0))';
const expectedFragment = (axis, lighting) => (lighting === null ? fixedFragment : litFragment).replace('in vec3 worldNormal;', 'in vec3 worldNormal;\nin vec2 v_native_surface_uv01;')
  .replace('uniform vec3 color;', 'uniform vec3 color;\nuniform float mat_u_0;').replace('pow(color,vec3(2.2))', '(' + lowerText(axis) + ')');
const doc = JSON.parse(await readFile(resolve(repo, 'examples/gpu-scene/fixtures/area-revision1.cad-document.json'), 'utf8')), geometrySource = doc.assets[0].source;
assert.equal(Buffer.byteLength(geometrySource), 238); assert.equal(hash(geometrySource), '56985f37e763f01325ac7e91ba2cf251accfa92efad9e5200b8619dc58545dc8');
const geometryRequest = { format: 'barocss-gpu-native-surface-uv01-request', version: 0, sourceVersion: 0, source: geometrySource, surfaceId: 'plane_nonunit', countU: 9, countV: 9, revision: 0 };
const materialSource = axis => '// Original ' + axis + ' gradient é😀 retained.\r\n@shader #shader_' + axis + ' { @uniform amount:float(' + (axis === 'v' ? '-0,1,-0' : '0,1,.25') + '); @let fade:float(surface_' + axis + '01*amount); @fragment { color:mix(#000,#fff,fade); } }\r\n';
const lighting = { ambientStrength: .2, directionalStrength: .6, direction: [-0, 0, 2] };
const U9 = [-3, -1.75, -.5, .75, 2, 3.25, 4.5, 5.75, 7], V9 = [2, 2.375, 2.75, 3.125, 3.5, 3.875, 4.25, 4.625, 5], N9 = [0, .125, .25, .375, .5, .625, .75, .875, 1];
let accepted = 0, refused = 0, getters = 0, reflections = 0, sourceCalls = 0;
const rows = [], coldCases = [];
for (const provider of providers) {
  const gpu = provider.gpu, legacy = provider.legacy;
  for (const name of ['prepareNativeSurfaceUV01ShaderSource', 'NativeSurfaceUV01ShaderSourceError', 'NativeSurfaceUV01BindingError', 'NativeSurfaceUV01GeometryError', 'MeshMaterialError']) assert.equal(typeof gpu[name], 'function');
  const compile = source => { const r = gpu.compileNativeSurfaceUV01Material(source); assert.equal(r.ok, true); return r.material; };
  const uIR = compile(materialSource('u')), vIR = compile(materialSource('v'));
  const binding = (material, uniforms) => ({ format: 'barocss-gpu-native-surface-uv01-binding-request', version: 0, geometry: clone(geometryRequest), material: clone(material), uniforms });
  const request = (b, l) => ({ format: 'barocss-gpu-native-surface-uv01-shader-request', version: 0, binding: b, lighting: l });
  const fixtures = [
    { label: 'U_fixed_default', axis: 'u', input: request(binding(uIR, {}), null), amount: .25 },
    { label: 'U_fixed_explicit_update', axis: 'u', input: request(binding(uIR, { amount: .75 }), null), amount: .75 },
    { label: 'V_explicit_lighting', axis: 'v', input: request(binding(vIR, { amount: .5 }), clone(lighting)), amount: .5 },
  ];
  const prepare = value => { sourceCalls++; return gpu.prepareNativeSurfaceUV01ShaderSource(value); }, previous = [], admissions = [], failures = [];
  for (const fixture of fixtures) {
    const before = signed(fixture.input), result = prepare(fixture.input), g = result.binding.geometry;
    assert.equal(signed(fixture.input), before); assert.equal(Object.isFrozen(fixture.input), false); independent(result, fixture.input); for (const old of previous) independent(result, old); previous.push(result);
    assert.deepEqual(Object.keys(result).sort(), ['format', 'version', 'profile', 'request', 'binding', 'shaders'].sort());
    assert.equal(result.format, 'barocss-gpu-native-surface-uv01-shader-source'); assert.equal(result.version, 0); assert.equal(result.profile, 'source0-native-opaque-uv01-shader-source-v0');
    assert.deepEqual(result.request, { ...fixture.input, binding: { ...fixture.input.binding, geometry: g.request, material: result.binding.material, uniforms: { amount: fixture.amount } } });
    assert.deepEqual(result.binding.uniforms, { amount: fixture.amount }); assert.equal(result.binding.material.source, fixture.input.binding.material.source);
    assert.equal(result.binding.material.format, 'barocss-gpu-native-surface-uv01-material'); assert.equal(result.binding.material.profile, 'native-surface-opaque-uv01-fragment-v0');
    assert.deepEqual(result.binding.material.expression, { kind: 'call', type: 'color', name: 'mix', args: [
      { kind: 'color', type: 'color', hex: '#000000', linear: [0, 0, 0] }, { kind: 'color', type: 'color', hex: '#FFFFFF', linear: [1, 1, 1] },
      { kind: 'binary', type: 'float', operator: '*', left: { kind: 'input', type: 'float', name: 'surface_' + fixture.axis + '01' }, right: { kind: 'uniform', type: 'float', name: 'amount' } },
    ] });
    assert.equal(result.binding.lowered.expression, lowerText(fixture.axis)); assert.equal(result.binding.lowered.uniformDeclarations, 'uniform float mat_u_0;');
    assert.deepEqual(result.binding.lowered.uniformLayout, [{ name: 'amount', type: 'float', min: 0, max: 1, default: fixture.axis === 'v' ? 0 : .25, glslName: 'mat_u_0' }]);
    if (fixture.axis === 'v') { assert.ok(result.binding.material.source.includes('-0,1,-0')); assert.ok(Object.is(result.binding.material.uniforms[0].min, +0)); assert.ok(Object.is(result.binding.material.uniforms[0].default, +0)); }
    assert.equal(g.request.source, geometrySource); assert.deepEqual(g.domain, { u: [-3, 7], v: [2, 5] }); assert.equal(g.model.name, 'plane_original'); assert.equal(g.model.objects.length, 1);
    assert.equal(g.model.objects[g.selectedObjectIndex].id, 'plane_nonunit'); assert.ok(Object.is(g.model.objects[0].controlPoints[0][0][2], -0));
    assert.equal(g.preview.report.vertexCount, 81); assert.equal(g.preview.report.triangleCount, 128); assert.equal(g.preview.report.certified, false); assert.equal(g.uv01.byteLength, 648);
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) { const at = 2 * (i * 9 + j); assert.equal(g.preview.packet.parameters[at], U9[i]); assert.equal(g.preview.packet.parameters[at + 1], V9[j]);
      assert.equal(g.normalizedParameters[at], N9[i]); assert.equal(g.normalizedParameters[at + 1], N9[j]); assert.equal(g.uv01[at], N9[i]); assert.equal(g.uv01[at + 1], N9[j]); }
    assert.deepEqual(Object.keys(result.shaders).sort(), ['fragment', 'vertex']); assert.equal(result.shaders.vertex, expectedVertex); assert.equal(result.shaders.fragment, expectedFragment(fixture.axis, fixture.input.lighting));
    assert.equal(result.shaders.vertex.replace(vertexInput + '\n', '').replace(vertexOutput + '\n', '').replace('\n ' + assignment, ''), oldVertex, 'Deleting only native ABI insertions restores old camera/position/normal template');
    assert.equal(result.shaders.fragment.includes('pow(color,vec3(2.2))'), false); assert.ok(result.shaders.fragment.includes('*light,vec3(1.0/2.2)),1.0)'));
    for (const source of Object.values(result.shaders)) { assert.ok(source.length <= 65536); assert.ok(Buffer.byteLength(source) <= 65536); assert.ok(source.startsWith('#version 300 es\nprecision highp float;')); }
    frozen(result); if (fixture.input.lighting !== null) { assert.deepEqual(result.request.lighting, fixture.input.lighting); assert.ok(Object.is(result.request.lighting.direction[0], -0)); }
    const prefix = resolve(output, provider.label + '.' + fixture.label), effectivePath = prefix + '.effective-request.json', sourcePath = prefix + '.geometry.source0.css', materialPath = prefix + '.material.css', irPath = prefix + '.material-ir.json', dataPath = prefix + '.full-original.json', vertexPath = prefix + '.vertex.glsl', fragmentPath = prefix + '.fragment.glsl', typedPath = prefix + '.uv01.bin';
    await writeFile(effectivePath, signed(result.request) + '\n', { flag: 'wx' }); await writeFile(sourcePath, geometrySource, { flag: 'wx' }); await writeFile(materialPath, result.binding.material.source, { flag: 'wx' }); await writeFile(irPath, signed(result.binding.material) + '\n', { flag: 'wx' });
    await writeFile(dataPath, signed(originalData(result)) + '\n', { flag: 'wx' }); await writeFile(vertexPath, result.shaders.vertex, { flag: 'wx' }); await writeFile(fragmentPath, result.shaders.fragment, { flag: 'wx' });
    await writeFile(typedPath, Buffer.from(g.uv01.buffer, g.uv01.byteOffset, g.uv01.byteLength), { flag: 'wx' });
    const files = await Promise.all([effectivePath, sourcePath, materialPath, irPath, dataPath, vertexPath, fragmentPath, typedPath].map(receipt));
    coldCases.push({ provider: provider.label, label: fixture.label, effectivePath, sourcePath, materialPath, irPath, dataPath, vertexPath, fragmentPath, typedPath, files, semanticDigest: digest(result), uvSHA: typedHash(g.uv01) });
    accepted++; admissions.push({ label: fixture.label, files, semanticDigest: digest(result), uvSHA: typedHash(g.uv01), uniforms: result.binding.uniforms, lighting: result.request.lighting,
      shaderLengths: Object.fromEntries(Object.entries(result.shaders).map(([k, v]) => [k, { UTF16: v.length, UTF8: Buffer.byteLength(v) }])) });
  }
  assert.deepEqual(previous[0].shaders, previous[1].shaders); assert.equal(previous[0].binding.uniforms.amount, .25); assert.equal(previous[1].binding.uniforms.amount, .75);
  const first = previous[0], beforeFirst = digest(first), uvBefore = typedHash(first.binding.geometry.uv01), rebuilt = prepare(first.request); independent(first, rebuilt); assert.equal(digest(rebuilt), beforeFirst);
  first.binding.geometry.uv01[0] = .5; assert.equal(rebuilt.binding.geometry.uv01[0], 0); assert.equal(first.binding.geometry.normalizedParameters[0], 0);
  const recovered = prepare(first.request); assert.equal(recovered.binding.geometry.uv01[0], 0); first.binding.geometry.uv01[0] = 0; assert.equal(typedHash(first.binding.geometry.uv01), uvBefore); accepted += 2;
  const savedCases = coldCases.filter(c => c.provider === provider.label), beforeData = previous.map(digest), beforeTyped = previous.map(r => typedHash(r.binding.geometry.uv01));
  async function retention() { assert.deepEqual(previous.map(digest), beforeData); assert.deepEqual(previous.map(r => typedHash(r.binding.geometry.uv01)), beforeTyped); assert.equal(getters, 0); for (const c of savedCases) for (const f of c.files) assert.equal(hash(await readFile(f.path)), f.sha256); }
  const bad = (label, edit, code, bindingCode = null, nestedCode = null) => { const value = clone(fixtures[0].input); edit(value); return { label, value, code, bindingCode, nestedCode }; };
  const invalidMaterialSource = materialSource('u').replace('surface_u01', 'surface_missing'), actualDiagnostic = gpu.compileNativeSurfaceUV01Material(invalidMaterialSource); assert.equal(actualDiagnostic.ok, false);
  const checks = [
    bad('wrong_wrapper_format', r => r.format = 'other', 'INPUT'), bad('extra_wrapper_field', r => r.fragment = 'caller GLSL', 'INPUT'),
    bad('wrapper_binding_getter0', r => Object.defineProperty(r, 'binding', { enumerable: true, get() { getters++; return fixtures[0].input.binding; } }), 'INPUT'),
    bad('prepared_binding_is_not_request', r => r.binding = first.binding, 'BINDING', 'INPUT'),
    bad('prepared_geometry_is_not_request', r => r.binding.geometry = first.binding.geometry, 'BINDING', 'GEOMETRY', 'INPUT'),
    bad('invalid_lighting_strength', r => r.lighting = { ambientStrength: .8, directionalStrength: .8, direction: [0, 0, 1] }, 'LIGHTING'),
    bad('zero_lighting_direction', r => r.lighting = { ambientStrength: .2, directionalStrength: .6, direction: [0, 0, 0] }, 'LIGHTING'),
    bad('lighting_getter0', r => { r.lighting = clone(lighting); Object.defineProperty(r.lighting, 'ambientStrength', { enumerable: true, get() { getters++; return .2; } }); }, 'LIGHTING'),
    bad('lighting_refusal_before_bad_binding', r => { r.lighting = { ambientStrength: .8, directionalStrength: .8, direction: [0, 0, 1] }; r.binding = {}; }, 'LIGHTING'),
    bad('forged_material_profile', r => r.binding.material.profile = 'mesh-opaque-fragment-v0', 'BINDING', 'MATERIAL', 'IR'),
    { ...bad('actual_material_source_diagnostic', r => r.binding.material.source = invalidMaterialSource, 'BINDING', 'MATERIAL', 'IR'), diagnostic: actualDiagnostic.diagnostics[0] },
    bad('unknown_uniform', r => r.binding.uniforms.extra = .5, 'BINDING', 'UNIFORM'), bad('uniform_range', r => r.binding.uniforms.amount = 2, 'BINDING', 'UNIFORM'),
    bad('geometry_count', r => r.binding.geometry.countU = 65, 'BINDING', 'GEOMETRY', 'INPUT'),
    { ...bad('actual_geometry_source_diagnostic', r => r.binding.geometry.source = geometrySource.replace('degree-u:1', 'degree-u:unknown'), 'BINDING', 'GEOMETRY', 'SOURCE'), sourceDiagnostic: true },
  ];
  const marker = new gpu.NativeSurfaceUV01ShaderSourceError('BINDING', 'actual caller same-class reflection', 17, 29);
  checks.push({ label: 'actual_same_class_wrapper_reflection', value: new Proxy(clone(fixtures[0].input), { ownKeys() { reflections++; throw marker; } }), code: 'INPUT', exactCause: marker });
  for (const c of checks) {
    let error; try { prepare(c.value); } catch (e) { error = e; }
    assert.ok(error instanceof gpu.NativeSurfaceUV01ShaderSourceError, c.label); assert.equal(error.code, c.code, c.label); assert.ok(error.message.length <= 1024);
    if (c.exactCause) { assert.notStrictEqual(error, marker); assert.strictEqual(error.cause, marker); assert.equal(error.start, 0); assert.equal(error.end, 0); }
    if (c.code === 'LIGHTING') assert.ok(error.cause instanceof RangeError, 'Actual existing lighting guard cause');
    if (c.bindingCode) { assert.ok(error.cause instanceof gpu.NativeSurfaceUV01BindingError); assert.equal(error.cause.code, c.bindingCode); assert.equal(error.start, error.cause.start); assert.equal(error.end, error.cause.end); }
    if (c.nestedCode) { assert.ok(error.cause.cause instanceof (c.bindingCode === 'MATERIAL' ? gpu.MeshMaterialError : gpu.NativeSurfaceUV01GeometryError)); assert.equal(error.cause.cause.code, c.nestedCode); }
    if (c.diagnostic) { assert.deepEqual(error.cause.cause.cause, c.diagnostic); assert.equal(error.start, c.diagnostic.start); assert.equal(error.end, c.diagnostic.end); }
    if (c.sourceDiagnostic) { assert.ok(Array.isArray(error.cause.cause.cause)); frozen(error.cause.cause.cause); assert.equal(error.start, error.cause.cause.cause[0].range.start); assert.equal(error.end, error.cause.cause.cause[0].range.end); }
    await retention(); refused++; failures.push({ label: c.label, code: error.code, message: error.message, start: error.start, end: error.end,
      causeName: error.cause?.name ?? null, bindingCode: error.cause?.code ?? null, nestedCode: error.cause?.cause?.code ?? null, exactReflectionCause: Boolean(c.exactCause), priorSourceNativeUniformViewShaderFilesRetained: true });
  }
  assert.deepEqual(legacy.MESH_SHADERS, { vertex: oldVertex, fragment: fixedFragment }); assert.deepEqual(legacy.meshLightingShaders(undefined), { vertex: oldVertex, fragment: fixedFragment });
  const oldIR = legacy.compileMeshMaterial('@shader #legacy_constant { @fragment { color:#fff; } }'); assert.equal(oldIR.ok, true);
  const oldLinear = 'clamp(' + wt + ',vec3(0.0),vec3(1.0))', expectedOldFragment = fixedFragment.replace('uniform vec3 color;', 'uniform vec3 color;\n').replace('pow(color,vec3(2.2))', '(' + oldLinear + ')');
  assert.deepEqual(legacy.materialMeshShaders(undefined, { material: oldIR.material, uniforms: {} }), { vertex: oldVertex, fragment: expectedOldFragment });
  assert.throws(() => legacy.materialMeshShaders(undefined, { material: uIR, uniforms: { amount: .25 } }), e => e instanceof legacy.MeshMaterialError && e.code === 'IR');
  await retention(); refused++; failures.push({ label: 'explicit_internal_legacy_shader_refuses_native_IR', code: 'IR', publicExport: false, priorSourceNativeUniformViewShaderFilesRetained: true });
  rows.push({ provider: provider.label, admissions, failures, internalLegacyControl: await receipt(provider.internalPath) });
}
for (let i = 0; i < 3; i++) assert.equal(rows[0].admissions[i].semanticDigest, rows[1].admissions[i].semanticDigest);
const coldCode = String.raw`
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
assert.equal(Number(process.versions.node.split('.')[0]),22);const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')),hash=v=>createHash('sha256').update(v).digest('hex');
function signed(v){if(typeof v==='number'){assert(Number.isFinite(v));return Object.is(v,-0)?'-0':JSON.stringify(v);}if(v===null||typeof v!=='object')return JSON.stringify(v);assert(!ArrayBuffer.isView(v));if(Array.isArray(v))return '['+v.map(signed).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+signed(v[k])).join(',')+'}';}
function frozen(v){if(v&&typeof v==='object'&&!ArrayBuffer.isView(v)){assert(Object.isFrozen(v));Object.values(v).forEach(frozen);}}
const rows=[];for(const provider of cfg.providers){const gpu=await import(pathToFileURL(provider.path).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);
for(const item of cfg.cases.filter(c=>c.provider===provider.label)){for(const f of item.files)assert.equal(hash(readFileSync(f.path)),f.sha256);const request=JSON.parse(readFileSync(item.effectivePath,'utf8')),geometrySource=readFileSync(item.sourcePath,'utf8'),materialSource=readFileSync(item.materialPath,'utf8'),ir=JSON.parse(readFileSync(item.irPath,'utf8'));
assert.equal(request.binding.geometry.source,geometrySource);assert.equal(request.binding.material.source,materialSource);assert.deepEqual(request.binding.material,ir);const before=signed(request),result=gpu.prepareNativeSurfaceUV01ShaderSource(request);assert.equal(signed(request),before);assert.deepEqual(result.request,request);frozen(result);
assert.equal(result.shaders.vertex,readFileSync(item.vertexPath,'utf8'));assert.equal(result.shaders.fragment,readFileSync(item.fragmentPath,'utf8'));const data={...result,binding:{...result.binding,geometry:Object.fromEntries(Object.entries(result.binding.geometry).filter(([k])=>k!=='uv01'))}};assert.equal(hash(signed(data)),item.semanticDigest);assert.deepEqual(data,JSON.parse(readFileSync(item.dataPath,'utf8')));
const view=result.binding.geometry.uv01,bytes=Buffer.from(view.buffer,view.byteOffset,view.byteLength);assert.equal(view.byteLength,648);assert.equal(hash(bytes),item.uvSHA);assert.deepEqual(bytes,readFileSync(item.typedPath));rows.push({provider:provider.label,label:item.label,semanticDigest:item.semanticDigest,uvSHA:item.uvSHA,vertexSHA:hash(result.shaders.vertex),fragmentSHA:hash(result.shaders.fragment)});}}
assert.equal(rows.length,cfg.cases.length);console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,parentPreparedAuthority:false,actualGL:false}));
`;
const coldPath = resolve(output, 'cold-shader-source.mjs'), configPath = resolve(output, 'cold-config.json'); await writeFile(coldPath, coldCode, { flag: 'wx' });
await writeFile(configPath, JSON.stringify({ providers: providers.map(({ label, path }) => ({ label, path })), namespace, cases: coldCases }, null, 2) + '\n', { flag: 'wx' });
const stdout = execFileSync(process.execPath, [coldPath, configPath], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }); await writeFile(resolve(output, 'cold.stdout'), stdout, { flag: 'wx' }); const cold = JSON.parse(stdout);
assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, 6); for (const c of coldCases) for (const f of c.files) assert.equal(hash(await readFile(f.path)), f.sha256);
const report = { issue: 1449, stage: 'NATIVE_SURFACE_UV01_SHADER_SOURCE_CPU', parent, node: process.version, namespaceCount: namespace.length, namespace, accepted, refused, sourceCalls, getters, reflections, sourceGraph, internalGraphs,
  ordinary: await receipt(ordinary), emitted: await receipt(providers[1].path), publicDTS: await receipt(dtsPath), leafDTS: await receipt(leafDtsPath), rows, cold,
  documentedSuccessfulWork: 'One actual native material binding (two material snapshots/compiles plus one original source geometry producer); shader text uses trusted returned lower without another lowering call. Stages are source-inspected, not instrumented kernel telemetry.',
  generatedTextCaps: { UTF16: 65536, UTF8: 65536 }, forcedTemplateAnchorOrBudgetBranches: false, linkedShader: false, actualGL: false, evaluator: false,
  support: 'Exact trusted location2/varying source additions, preserved camera/position/normal and fixed/runtime global lighting/gamma/opaque ABI, effective resolved source request and independent original/derived CPU data. No attribute upload, link, device/frame/TEN context, pixels, lifetime, consumer or publication proof.' };
const resultPath = resolve(output, 'actual-result.json'); await writeFile(resultPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ issue: 1449, accepted, refused, sourceCalls, getters, reflections, exports: namespace.length, coldRows: cold.rows.length, result: await receipt(resultPath), actualGL: false }));
