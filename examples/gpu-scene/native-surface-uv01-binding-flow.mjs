/** #1439 joint source-native geometry/material/uniform CPU association.
 * Node22 examples/gpu-scene/native-surface-uv01-binding-flow.mjs --output ABS_FRESH
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

assert.equal(Number(process.versions.node.split('.')[0]), 22);
assert.equal(process.argv.length, 4); assert.equal(process.argv[2], '--output'); assert.ok(isAbsolute(process.argv[3]));
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), output = resolve(process.argv[3]);
await mkdir(output, { recursive: false });
const parent = '771ba2e1b7eef80bcb6dd31e8b075c91ce1ff989', pkg = resolve(repo, 'packages/barocss-gpu');
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const ordinary = resolve(output, 'ordinary-public.mjs');
const bundle = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const sourceGraph = Object.keys(bundle.metafile.inputs);
assert.ok(sourceGraph.some(p => p.endsWith('/src/native/uv01/native-surface-uv01-binding.ts')));
assert.ok(sourceGraph.some(p => p.includes('barocss-cad/src/'))); assert.ok(!sourceGraph.some(p => /barocss-(gpu|cad)\/dist\//.test(p)));
const providers = [{ label: 'ordinary-source', path: ordinary }, { label: 'emitted-public', path: resolve(pkg, manifest.publishConfig.exports['.'].import) }];
for (const p of providers) p.gpu = await import(pathToFileURL(p.path).href);
const namespace = Object.keys(providers[0].gpu).sort(); assert.deepEqual(Object.keys(providers[1].gpu).sort(), namespace);
const dtsPath = resolve(pkg, manifest.publishConfig.exports['.'].types), dts = await readFile(dtsPath, 'utf8');
const leafDtsPath = resolve(pkg, 'dist/native-surface-uv01-binding.d.ts'), leafDts = await readFile(leafDtsPath, 'utf8');
for (const name of ['prepareNativeSurfaceUV01MaterialBinding', 'NativeSurfaceUV01BindingError', 'NativeSurfaceUV01BindingRequest', 'PreparedNativeSurfaceUV01Binding', 'NativeSurfaceUV01BindingCode']) {
  assert.ok(new RegExp('\\b' + name + '\\b').test(dts)); assert.ok(new RegExp('\\b' + name + '\\b').test(leafDts));
}
const hash = v => createHash('sha256').update(v).digest('hex');
function signed(v) { if (typeof v === 'number') { assert.ok(Number.isFinite(v)); return Object.is(v, -0) ? '-0' : JSON.stringify(v); }
  if (v === null || typeof v !== 'object') return JSON.stringify(v); assert.ok(!ArrayBuffer.isView(v)); if (Array.isArray(v)) return '[' + v.map(signed).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + signed(v[k])).join(',') + '}'; }
const clone = v => JSON.parse(signed(v));
const originalData = r => ({ ...r, geometry: Object.fromEntries(Object.entries(r.geometry).filter(([name]) => name !== 'uv01')) });
const semanticDigest = r => hash(signed(originalData(r))), typedHash = v => hash(Buffer.from(v.buffer, v.byteOffset, v.byteLength));
function frozen(v) { if (v && typeof v === 'object' && !ArrayBuffer.isView(v)) { assert.ok(Object.isFrozen(v)); Object.values(v).forEach(frozen); } }
function refs(v, out = new Set()) { if (v && typeof v === 'object' && !out.has(v)) { out.add(v); Object.values(v).forEach(child => refs(child, out)); } return out; }
function independent(a, b) { const left = refs(a), right = refs(b); for (const object of left) assert.ok(!right.has(object), 'Owned trees are independent'); }
async function receipt(path) { const b = await readFile(path); return { path, bytes: b.length, sha256: hash(b) }; }
const doc = JSON.parse(await readFile(resolve(repo, 'examples/gpu-scene/fixtures/area-revision1.cad-document.json'), 'utf8'));
const geometrySource = doc.assets[0].source;
assert.equal(Buffer.byteLength(geometrySource), 238); assert.equal(hash(geometrySource), '56985f37e763f01325ac7e91ba2cf251accfa92efad9e5200b8619dc58545dc8');
const geometryRequest = source => ({ format: 'barocss-gpu-native-surface-uv01-request', version: 0, sourceVersion: 0, source, surfaceId: 'plane_nonunit', countU: 9, countV: 9, revision: 0 });
const sibling = '@curve #retained_sibling { type:nurbs; degree:1; knots:[-0,-0,1,1]; control-points:[[-0,0,-0],[1,0,-0]]; weights:[1,1]; }\n';
const editedGeometrySource = geometrySource.replace('knots-u:[-3,-3,7,7]', 'knots-u:[-5,-5,5,5]').replace('knots-v:[2,2,5,5]', 'knots-v:[-2,-2,4,4]')
  .replace('[[2,0,-0],[2,3,-0]]', '[[4,0,-0],[4,3,-0]]').replace('@surface', sibling + '@surface');
assert.notEqual(editedGeometrySource, geometrySource);
const materialSource = (axis, zero = false) => '// Original ' + axis + ' gradient é. Numeric source signs remain authored.\r\n@shader #uv_binding_' + axis + ' {\r\n @uniform amount:float(' + (zero ? '-0,1,-0' : '0,1,.25') + ');\r\n @let fade:float(surface_' + axis + '01*amount);\r\n @fragment { color:mix(#000,#fff,fade); }\r\n}\r\n';
const black = { kind: 'color', type: 'color', hex: '#000000', linear: [0, 0, 0] }, white = { kind: 'color', type: 'color', hex: '#FFFFFF', linear: [1, 1, 1] };
const knownExpression = (axis, uniformName = 'amount') => ({ kind: 'call', type: 'color', name: 'mix', args: [black, white,
  { kind: 'binary', type: 'float', operator: '*', left: { kind: 'input', type: 'float', name: 'surface_' + axis + '01' }, right: { kind: 'uniform', type: 'float', name: uniformName } }] });
const bt = 'vec3(0.0000000000000000,0.0000000000000000,0.0000000000000000)', wt = 'vec3(1.0000000000000000,1.0000000000000000,1.0000000000000000)';
const lowerText = axis => 'clamp(mix(' + bt + ',' + wt + ',clamp((v_native_surface_uv01.' + (axis === 'u' ? 'x' : 'y') + '*mat_u_0),0.0,1.0)),vec3(0.0),vec3(1.0))';
const U9 = [-3, -1.75, -.5, .75, 2, 3.25, 4.5, 5.75, 7], V9 = [2, 2.375, 2.75, 3.125, 3.5, 3.875, 4.25, 4.625, 5], N9 = [0, .125, .25, .375, .5, .625, .75, .875, 1];
let accepted = 0, refused = 0, bindingCalls = 0, getters = 0, reflections = 0;
const rows = [], coldCases = [];
for (const provider of providers) {
  const gpu = provider.gpu;
  for (const name of ['prepareNativeSurfaceUV01MaterialBinding', 'NativeSurfaceUV01BindingError', 'NativeSurfaceUV01GeometryError', 'MeshMaterialError',
    'compileNativeSurfaceUV01Material', 'compileMeshMaterial', 'compileEngineUVMaterial']) assert.equal(typeof gpu[name], 'function');
  const compile = source => { const r = gpu.compileNativeSurfaceUV01Material(source); assert.equal(r.ok, true, JSON.stringify(r.diagnostics)); return r.material; };
  const input = (geometry, material, uniforms) => ({ format: 'barocss-gpu-native-surface-uv01-binding-request', version: 0, geometry, material, uniforms });
  const uSource = materialSource('u'), vSource = materialSource('v', true), uIR = compile(uSource), vIR = compile(vSource);
  const protoIR = compile(uSource.replaceAll('amount', '__proto__'));
  assert.deepEqual(uIR.expression, knownExpression('u')); assert.deepEqual(vIR.expression, knownExpression('v'));
  const fixtures = [
    { label: 'U_default_original_nonunit', axis: 'u', input: input(geometryRequest(geometrySource), clone(uIR), {}), amount: .25, min: 0, default: .25, domain: { u: [-3, 7], v: [2, 5] }, selected: 0, objects: 1 },
    { label: 'U_explicit_uniform_update', axis: 'u', input: input(geometryRequest(geometrySource), clone(uIR), { amount: .75 }), amount: .75, min: 0, default: .25, domain: { u: [-3, 7], v: [2, 5] }, selected: 0, objects: 1 },
    { label: 'V_source_minus_zero_explicit_minus_zero', axis: 'v', input: input(geometryRequest(geometrySource), clone(vIR), { amount: -0 }), amount: 0, min: 0, default: 0, domain: { u: [-3, 7], v: [2, 5] }, selected: 0, objects: 1, signed: true },
    { label: 'same_ID_geometry_source_domain_edit', axis: 'u', input: input(geometryRequest(editedGeometrySource), clone(uIR), { amount: .75 }), amount: .75, min: 0, default: .25, domain: { u: [-5, 5], v: [-2, 4] }, selected: 1, objects: 2 },
    { label: 'declared_own_proto_uniform_is_data', axis: 'u', input: input(geometryRequest(geometrySource), clone(protoIR), Object.fromEntries([['__proto__', .5]])), uniformName: '__proto__', amount: .5, min: 0, default: .25, domain: { u: [-3, 7], v: [2, 5] }, selected: 0, objects: 1 },
  ];
  const prepare = value => { bindingCalls++; return gpu.prepareNativeSurfaceUV01MaterialBinding(value); }, previous = [], admissions = [], failures = [];
  function verify(result, fixture) {
    const req = fixture.input, g = result.geometry, packet = g.preview.packet, uniformName = fixture.uniformName ?? 'amount';
    assert.deepEqual(Object.keys(result).sort(), ['format', 'version', 'profile', 'geometry', 'material', 'uniforms', 'lowered'].sort());
    assert.equal(result.format, 'barocss-gpu-native-surface-uv01-binding'); assert.equal(result.version, 0); assert.equal(result.profile, 'source0-surface-opaque-uv01-binding-v0');
    assert.deepEqual(g.request, req.geometry); assert.equal(g.model.name, 'plane_original'); assert.equal(g.model.objects.length, fixture.objects); assert.equal(g.selectedObjectIndex, fixture.selected);
    const surface = g.model.objects[g.selectedObjectIndex]; assert.equal(surface.id, 'plane_nonunit'); assert.ok(Object.is(surface.controlPoints[0][0][2], -0));
    assert.deepEqual(g.domain, fixture.domain); assert.equal(packet.surfaceId, req.geometry.surfaceId); assert.equal(packet.revision, 0); assert.equal(packet.lengthUnit, 'mm');
    assert.equal(g.preview.report.vertexCount, 81); assert.equal(g.preview.report.triangleCount, 128); assert.equal(g.preview.report.certified, false);
    assert.equal(packet.parameters.length, 162); assert.equal(g.normalizedParameters.length, 162); assert.ok(g.uv01 instanceof Float32Array); assert.equal(g.uv01.byteLength, 648);
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) { const at = 2 * (i * 9 + j); assert.equal(g.normalizedParameters[at], N9[i]); assert.equal(g.normalizedParameters[at + 1], N9[j]);
      assert.equal(g.uv01[at], N9[i]); assert.equal(g.uv01[at + 1], N9[j]); if (fixture.selected === 0) { assert.equal(packet.parameters[at], U9[i]); assert.equal(packet.parameters[at + 1], V9[j]); } }
    assert.ok(Object.is(g.normalizedParameters[0], +0)); assert.ok(Object.is(g.uv01[0], +0));
    assert.equal(result.material.source, req.material.source); assert.equal(result.material.shaderId, 'uv_binding_' + fixture.axis); assert.equal(result.material.profile, 'native-surface-opaque-uv01-fragment-v0');
    assert.deepEqual(result.material.expression, knownExpression(fixture.axis, uniformName)); assert.deepEqual(result.material.uniforms, [{ name: uniformName, type: 'float', min: fixture.min, max: 1, default: fixture.default }]);
    assert.deepEqual(result.uniforms, Object.fromEntries([[uniformName, fixture.amount]])); assert.ok(Object.is(result.uniforms[uniformName], fixture.amount));
    assert.deepEqual(Object.keys(result.lowered).sort(), ['expression', 'uniformDeclarations', 'uniformLayout', 'inputDeclarations'].sort());
    assert.equal(result.lowered.inputDeclarations, 'in vec2 v_native_surface_uv01;'); assert.equal(result.lowered.expression, lowerText(fixture.axis)); assert.equal(result.lowered.uniformDeclarations, 'uniform float mat_u_0;');
    assert.deepEqual(result.lowered.uniformLayout, [{ name: uniformName, type: 'float', min: fixture.min, max: 1, default: fixture.default, glslName: 'mat_u_0' }]);
    independent(result, req); assert.notStrictEqual(result.material.uniforms[0], result.lowered.uniformLayout[0]); assert.notStrictEqual(packet.parameters, g.normalizedParameters); frozen(result);
    if (fixture.signed) { assert.ok(result.material.source.includes('-0,1,-0')); assert.ok(Object.is(req.uniforms.amount, -0)); assert.ok(Object.is(result.uniforms.amount, +0)); }
    if (fixture.selected === 1) { assert.equal(g.model.objects[0].id, 'retained_sibling'); assert.deepEqual(g.model.objects[0].controlPoints, [[-0, 0, -0], [1, 0, -0]]); }
    if (uniformName === '__proto__') { assert.equal(Object.getPrototypeOf(result.uniforms), Object.prototype); assert.equal(Object.hasOwn(result.uniforms, '__proto__'), true); assert.equal(result.uniforms.__proto__, .5); assert.equal(Object.getPrototypeOf(req.uniforms), Object.prototype); }
  }
  for (const fixture of fixtures) {
    const before = signed(fixture.input), result = prepare(fixture.input); verify(result, fixture); assert.equal(signed(fixture.input), before); assert.equal(Object.isFrozen(fixture.input), false);
    for (const earlier of previous) independent(result, earlier); previous.push(result);
    const prefix = resolve(output, provider.label + '.' + fixture.label), requestPath = prefix + '.binding-request.json', geometryPath = prefix + '.geometry.source0.css', materialPath = prefix + '.material.css', irPath = prefix + '.material-ir.json', dataPath = prefix + '.full-original.json', typedPath = prefix + '.uv01.bin';
    await writeFile(requestPath, before + '\n', { flag: 'wx' }); await writeFile(geometryPath, fixture.input.geometry.source, { flag: 'wx' }); await writeFile(materialPath, fixture.input.material.source, { flag: 'wx' });
    await writeFile(irPath, signed(fixture.input.material) + '\n', { flag: 'wx' }); await writeFile(dataPath, signed(originalData(result)) + '\n', { flag: 'wx' });
    await writeFile(typedPath, Buffer.from(result.geometry.uv01.buffer, result.geometry.uv01.byteOffset, result.geometry.uv01.byteLength), { flag: 'wx' });
    const paths = [requestPath, geometryPath, materialPath, irPath, dataPath, typedPath], files = await Promise.all(paths.map(receipt));
    coldCases.push({ provider: provider.label, label: fixture.label, requestPath, geometryPath, materialPath, irPath, dataPath, typedPath, files, semanticDigest: semanticDigest(result), typedSHA256: typedHash(result.geometry.uv01) });
    accepted++; admissions.push({ label: fixture.label, files, semanticDigest: semanticDigest(result), typedSHA256: typedHash(result.geometry.uv01), domain: result.geometry.domain, uniforms: result.uniforms, lowered: result.lowered });
  }
  assert.notEqual(previous[0].uniforms.amount, previous[1].uniforms.amount); assert.deepEqual(previous[0].geometry.preview.packet, previous[1].geometry.preview.packet);
  assert.equal(typedHash(previous[0].geometry.uv01), typedHash(previous[1].geometry.uv01)); assert.deepEqual(previous[0].lowered, previous[1].lowered);
  assert.notDeepEqual(previous[1].geometry.domain, previous[3].geometry.domain); assert.notDeepEqual(previous[1].geometry.preview.packet, previous[3].geometry.preview.packet);
  const first = previous[0], firstDigest = semanticDigest(first), firstTyped = typedHash(first.geometry.uv01), repeat = prepare(fixtures[0].input); independent(first, repeat);
  assert.equal(semanticDigest(repeat), firstDigest); first.geometry.uv01[0] = .9; assert.equal(repeat.geometry.uv01[0], 0); assert.equal(first.geometry.normalizedParameters[0], 0); assert.equal(semanticDigest(first), firstDigest);
  const rederived = prepare(fixtures[0].input); independent(first, rederived); assert.equal(rederived.geometry.uv01[0], 0); first.geometry.uv01[0] = 0; assert.equal(typedHash(first.geometry.uv01), firstTyped); accepted += 2;
  // Caller edits stay isolated; the frozen candidate is not a trusted prepared-input shortcut.
  const caller = clone(fixtures[0].input), owned = prepare(caller), ownedDigest = semanticDigest(owned); caller.geometry.source += '\n'; caller.material.shaderId = 'caller_changed'; caller.uniforms.amount = .8;
  assert.equal(semanticDigest(owned), ownedDigest); accepted++;
  const savedCases = coldCases.filter(c => c.provider === provider.label), beforeOrdinary = previous.map(semanticDigest), beforeTyped = previous.map(r => typedHash(r.geometry.uv01));
  async function retention() { assert.deepEqual(previous.map(semanticDigest), beforeOrdinary); assert.deepEqual(previous.map(r => typedHash(r.geometry.uv01)), beforeTyped); assert.equal(getters, 0);
    for (const c of savedCases) for (const f of c.files) assert.equal(hash(await readFile(f.path)), f.sha256); }
  const bad = (label, edit, code, causeCode = null) => { const value = clone(fixtures[0].input); edit(value); return { label, value, code, causeCode }; };
  const invalidMaterialSource = materialSource('u').replace('surface_u01', 'surface_unknown'), actualMaterialDiagnostic = gpu.compileNativeSurfaceUV01Material(invalidMaterialSource);
  assert.equal(actualMaterialDiagnostic.ok, false);
  const foreignLegacy = gpu.compileMeshMaterial('@shader #legacy { @fragment { color:#fff; } }'), foreignEngine = gpu.compileEngineUVMaterial('@shader #engine { @fragment { color:mix(#000,#fff,clamp(uv_u,0,1)); } }');
  assert.equal(foreignLegacy.ok, true); assert.equal(foreignEngine.ok, true);
  const collapsed = geometrySource.replace('[[[0,0,-0],[0,3,-0]],[[2,0,-0],[2,3,-0]]]', '[[[0,0,-0],[0,0,-0]],[[0,0,-0],[0,0,-0]]]'), huge = '1' + '0'.repeat(308);
  const overflowDomain = geometrySource.replace('knots-u:[-3,-3,7,7]', 'knots-u:[-' + huge + ',-' + huge + ',' + huge + ',' + huge + ']');
  const failuresToRun = [
    bad('wrong_wrapper_version', r => r.version = 1, 'INPUT'), bad('extra_wrapper_field', r => r.callback = null, 'INPUT'),
    bad('unknown_uniform_name', r => r.uniforms.unknown = .5, 'UNIFORM'), bad('uniform_outside_declared_range', r => r.uniforms.amount = 2, 'UNIFORM'),
    bad('nonfinite_uniform', r => r.uniforms.amount = Infinity, 'UNIFORM'), bad('non_number_uniform', r => r.uniforms.amount = '0.5', 'UNIFORM'),
    bad('uniform_getter0', r => Object.defineProperty(r.uniforms, 'amount', { enumerable: true, get() { getters++; return .5; } }), 'UNIFORM'),
    bad('wrapper_material_getter0', r => Object.defineProperty(r, 'material', { enumerable: true, get() { getters++; return uIR; } }), 'INPUT'),
    bad('IR_source_getter0', r => Object.defineProperty(r.material, 'source', { enumerable: true, get() { getters++; return uSource; } }), 'MATERIAL', 'INPUT'),
    bad('forged_native_IR_leaf', r => r.material.expression.args[2].left.name = 'uv_u', 'MATERIAL', 'IR'),
    bad('legacy_profile_is_foreign', r => r.material = clone(foreignLegacy.material), 'MATERIAL', 'IR'),
    bad('EngineUV_profile_is_foreign', r => r.material = clone(foreignEngine.material), 'MATERIAL', 'IR'),
    { ...bad('actual_invalid_material_source_diagnostic', r => r.material.source = invalidMaterialSource, 'MATERIAL', 'IR'), diagnostic: actualMaterialDiagnostic.diagnostics[0] },
    bad('prepared_geometry_is_not_request', r => r.geometry = first.geometry, 'GEOMETRY', 'INPUT'),
    bad('geometry_count_refusal', r => r.geometry.countU = 65, 'GEOMETRY', 'INPUT'),
    bad('geometry_missing_selector', r => r.geometry.surfaceId = 'missing_surface', 'GEOMETRY', 'SELECTOR'),
    { ...bad('actual_geometry_source_diagnostic', r => r.geometry.source = geometrySource.replace('degree-u:1', 'degree-u:unknown'), 'GEOMETRY', 'SOURCE'), sourceDiagnostic: true },
    { ...bad('actual_geometry_collapsed_preview', r => r.geometry.source = collapsed, 'GEOMETRY', 'NATIVE'), nativeCause: true },
    bad('actual_geometry_finite_width_overflow', r => r.geometry.source = overflowDomain, 'GEOMETRY', 'NORMALIZATION'),
    bad('uniform_refusal_precedes_bad_geometry', r => { r.uniforms.unknown = .5; r.geometry.source = 'invalid'; }, 'UNIFORM'),
    bad('material_refusal_precedes_bad_geometry', r => { r.material.profile = 'other'; r.geometry.source = 'invalid'; }, 'MATERIAL', 'IR'),
  ];
  const wrapperMarker = new Error('actual binding wrapper reflection marker'), uniformMarker = new Error('actual binding uniform reflection marker');
  failuresToRun.push({ label: 'wrapper_actual_reflection_cause', value: new Proxy(clone(fixtures[0].input), { ownKeys() { reflections++; throw wrapperMarker; } }), code: 'INPUT', exactCause: wrapperMarker });
  const uniformProxy = clone(fixtures[0].input); uniformProxy.uniforms = new Proxy({}, { ownKeys() { reflections++; throw uniformMarker; } });
  failuresToRun.push({ label: 'uniform_actual_reflection_cause', value: uniformProxy, code: 'UNIFORM', exactCause: uniformMarker });
  for (const f of failuresToRun) {
    let error; try { prepare(f.value); } catch (e) { error = e; }
    assert.ok(error instanceof gpu.NativeSurfaceUV01BindingError, f.label); assert.equal(error.code, f.code, f.label); assert.ok(error.message.length <= 1024);
    if (f.exactCause) assert.strictEqual(error.cause, f.exactCause);
    if (f.causeCode) { assert.ok(error.cause instanceof (f.code === 'MATERIAL' ? gpu.MeshMaterialError : gpu.NativeSurfaceUV01GeometryError), f.label); assert.equal(error.cause.code, f.causeCode); assert.equal(error.start, error.cause.start); assert.equal(error.end, error.cause.end); }
    if (f.diagnostic) { assert.deepEqual(error.cause.cause, f.diagnostic); assert.equal(error.start, f.diagnostic.start); assert.equal(error.end, f.diagnostic.end); }
    if (f.sourceDiagnostic) { assert.ok(Array.isArray(error.cause.cause)); frozen(error.cause.cause); const d = error.cause.cause[0]; assert.equal(error.start, d.range.start); assert.equal(error.end, d.range.end); }
    if (f.nativeCause) { assert.ok(error.cause.cause instanceof RangeError); assert.equal(error.cause.cause.message, 'Collapsed or nonfinite preview triangle'); }
    if (f.code === 'UNIFORM' && !f.exactCause) assert.equal(error.cause, undefined, 'Local uniform refusal has no fabricated cause');
    await retention(); refused++; failures.push({ label: f.label, code: error.code, message: error.message, start: error.start, end: error.end,
      cause: error.cause instanceof Error ? { name: error.cause.name, code: error.cause.code ?? null, message: error.cause.message,
        nested: error.cause.cause instanceof Error ? { name: error.cause.cause.name, message: error.cause.cause.message } : error.cause.cause ?? null } : null,
      priorFullSourcesNativeIRUniformsTypedViewsAndFilesRetained: true });
  }
  rows.push({ provider: provider.label, admissions, failures, mutableViewReconstructionAndCallerIsolation: true });
}
for (let i = 0; i < rows[0].admissions.length; i++) { assert.equal(rows[0].admissions[i].semanticDigest, rows[1].admissions[i].semanticDigest); assert.equal(rows[0].admissions[i].typedSHA256, rows[1].admissions[i].typedSHA256); }
const coldCode = String.raw`
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
assert.equal(Number(process.versions.node.split('.')[0]),22);const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')),hash=v=>createHash('sha256').update(v).digest('hex');
function signed(v){if(typeof v==='number'){assert(Number.isFinite(v));return Object.is(v,-0)?'-0':JSON.stringify(v);}if(v===null||typeof v!=='object')return JSON.stringify(v);assert(!ArrayBuffer.isView(v));if(Array.isArray(v))return '['+v.map(signed).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+signed(v[k])).join(',')+'}';}
function frozen(v){if(v&&typeof v==='object'&&!ArrayBuffer.isView(v)){assert(Object.isFrozen(v));Object.values(v).forEach(frozen);}}
const rows=[];for(const provider of cfg.providers){const gpu=await import(pathToFileURL(provider.path).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);
 for(const item of cfg.cases.filter(c=>c.provider===provider.label)){for(const f of item.files)assert.equal(hash(readFileSync(f.path)),f.sha256);
  const request=JSON.parse(readFileSync(item.requestPath,'utf8')),geometrySource=readFileSync(item.geometryPath,'utf8'),materialSource=readFileSync(item.materialPath,'utf8'),ir=JSON.parse(readFileSync(item.irPath,'utf8'));
  assert.equal(request.geometry.source,geometrySource);assert.equal(request.material.source,materialSource);assert.deepEqual(request.material,ir);const fresh=gpu.compileNativeSurfaceUV01Material(materialSource);assert.equal(fresh.ok,true);assert.deepEqual(fresh.material,ir);
  const before=signed(request),result=gpu.prepareNativeSurfaceUV01MaterialBinding(request);assert.equal(signed(request),before);const data={...result,geometry:Object.fromEntries(Object.entries(result.geometry).filter(([k])=>k!=='uv01'))};assert.equal(hash(signed(data)),item.semanticDigest);assert.deepEqual(data,JSON.parse(readFileSync(item.dataPath,'utf8')));frozen(result);
  const view=result.geometry.uv01,bytes=Buffer.from(view.buffer,view.byteOffset,view.byteLength);assert.equal(view.byteLength,648);assert.equal(hash(bytes),item.typedSHA256);assert.deepEqual(bytes,readFileSync(item.typedPath));
  rows.push({provider:provider.label,label:item.label,semanticDigest:item.semanticDigest,typedSHA256:item.typedSHA256,geometrySourceSHA256:hash(geometrySource),materialSourceSHA256:hash(materialSource),uniforms:result.uniforms,normalizedBytes:view.byteLength});
 }}assert.equal(rows.length,cfg.cases.length);console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,parentPreparedAuthority:false,actualGL:false}));
`;
const coldPath = resolve(output, 'cold-binding.mjs'), configPath = resolve(output, 'cold-config.json');
await writeFile(coldPath, coldCode, { flag: 'wx' }); await writeFile(configPath, JSON.stringify({ providers: providers.map(({ label, path }) => ({ label, path })), namespace, cases: coldCases }, null, 2) + '\n', { flag: 'wx' });
const stdout = execFileSync(process.execPath, [coldPath, configPath], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }); await writeFile(resolve(output, 'cold.stdout'), stdout, { flag: 'wx' });
const cold = JSON.parse(stdout); assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, coldCases.length);
for (const c of coldCases) for (const f of c.files) assert.equal(hash(await readFile(f.path)), f.sha256);
const report = { issue: 1439, stage: 'SOURCE_NATIVE_SURFACE_UV01_BINDING_CPU', parent, node: process.version, namespace, namespaceCount: namespace.length,
  accepted, refused, bindingCalls, getters, reflections, sourceGraph, ordinary: await receipt(ordinary), emitted: await receipt(providers[1].path), publicDTS: await receipt(dtsPath), leafDTS: await receipt(leafDtsPath),
  declarationCheck: 'Actual public and emitted leaf exports; no broad declaration compilation campaign.', rows, cold,
  documentedPerSuccessfulBindingWork: { materialValidate: 1, materialLower: 1, materialSnapshots: 2, materialSourceCompiles: 2, geometryProducer: 1,
    scope: 'Successful admission stages documented by the implementation, not instrumented kernel telemetry; refusals stop at their actual phase. Each cold row also performs one explicit public material compile to check the saved full source/IR.' },
  actualGL: false, publicEvaluatorUsed: false, nativeRendererBinding: false,
  support: 'Owned source-native geometry plus distinct normalized material IR, finite resolved uniforms and trusted lower layout only. Original native parameters/domain/source/signs and derived Number/F32 remain separate; no attribute/program/frame/TEN-context/pixels/lifetime/consumer/publication claim.' };
const resultPath = resolve(output, 'actual-result.json'); await writeFile(resultPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ issue: 1439, accepted, refused, bindingCalls, getters, reflections, coldRows: cold.rows.length, exports: namespace.length, result: await receipt(resultPath), actualGL: false }));
