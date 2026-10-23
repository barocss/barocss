/** #1563 ONE complete native Surface UV01 WGSL program source/emitted/original-file/cold flow.
 * node examples/gpu-scene/native-surface-uv01-program-flow.mjs --output ABS_FRESH
 * No device, browser, fake GPU, actual pipeline/frame, prior producer or GLSL flow.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import ts from 'typescript';

assert.equal(Number(process.versions.node.split('.')[0]), 22);
assert.equal(process.argv.length, 4); assert.equal(process.argv[2], '--output'); assert.ok(isAbsolute(process.argv[3]));
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), output = resolve(process.argv[3]);
await mkdir(output, { recursive: false });
const parent = '21230c08b3b2d73881f1d28aa0800d752a4ee2ad', pkg = resolve(repo, 'packages/barocss-gpu');
const hash = value => createHash('sha256').update(value).digest('hex');
function signed(value) { if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); } if (value === null || typeof value !== 'object') return JSON.stringify(value); return Array.isArray(value) || ArrayBuffer.isView(value) ? '[' + Array.from(value, signed).join(',') + ']' : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + signed(value[key])).join(',') + '}'; }
const clone = value => JSON.parse(signed(value));
const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
function frozen(value) { if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } }
function refs(value, seen = new Set()) { if (value && typeof value === 'object' && !seen.has(value)) { seen.add(value); Object.values(value).forEach(child => refs(child, seen)); } return seen; }
function independent(left, right) { const other = refs(right); for (const value of refs(left)) assert.ok(!other.has(value), 'Independent original/lowered graphs'); }
const gitFile = path => execFileSync('git', ['show', parent + ':' + path], { cwd: repo, encoding: 'utf8' });
async function receipt(path) { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }
async function save(name, text) { const path = resolve(output, name); await writeFile(path, text, { flag: 'wx' }); return receipt(path); }
const owned = ['packages/barocss-gpu/src/native/uv01/native-surface-uv01-program-wgsl.ts', 'packages/barocss-gpu/src/index.ts', 'packages/barocss-gpu/README.md', 'examples/gpu-scene/native-surface-uv01-program-flow.mjs'];
const tracked = execFileSync('git', ['diff', '--name-only', parent], { cwd: repo, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: repo, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const delta = [...new Set([...tracked, ...untracked])].sort();
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const ordinary = resolve(output, 'ordinary-public.mjs'), cadAlias = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundled = await build({ absWorkingDir: repo, alias: { '@barocss/cad': cadAlias }, entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const sourceGraph = [], physicalRepo = await realpath(repo);
for (const path of Object.keys(bundled.metafile.inputs).sort()) {
  const absolute = resolve(repo, path), bytes = await readFile(absolute), start = path.indexOf('packages/barocss-'), packagePath = start < 0 ? null : path.slice(start).replaceAll('\\', '/');
  assert.ok(!/(?:^|\/)node_modules\/(?:@barocss|barocss-)/.test(path), 'No shared package provider');
  if (packagePath !== null) { assert.ok(!/(?:^|\/)dist\//.test(packagePath)); assert.equal(relative(repo, absolute).replaceAll('\\', '/'), packagePath); assert.ok((await realpath(absolute)).startsWith(physicalRepo + sep)); }
  sourceGraph.push({ path, packagePath, bytes: bytes.length, sha256: hash(bytes) });
}
for (const leaf of ['native-surface-uv01-program-wgsl.ts', 'native-surface-uv01-material-wgsl.ts', 'mesh-material.ts']) assert.ok(sourceGraph.some(row => (row.path.includes('/src/') && row.path.endsWith('/' + leaf))));
const parentBarrel = gitFile('packages/barocss-gpu/src/index.ts'), ast = ts.createSourceFile('parent.ts', parentBarrel, ts.ScriptTarget.Latest, true);
const parentRuntime = ast.statements.filter(node => ts.isExportDeclaration(node) && !node.isTypeOnly && node.exportClause && ts.isNamedExports(node.exportClause)).flatMap(node => node.exportClause.elements.filter(entry => !entry.isTypeOnly).map(entry => entry.name.text)).sort();

const providers = [{ label: 'ordinary-source', path: ordinary }, { label: 'emitted-public', path: resolve(pkg, manifest.publishConfig.exports['.'].import) }];
for (const provider of providers) provider.gpu = await import(pathToFileURL(provider.path).href);
assert.equal(parentRuntime.length, 162); const namespace = Object.keys(providers[0].gpu).sort(); assert.ok(['lowerNativeSurfaceUV01ProgramWGSL'].sort().every(x => namespace.includes(x))); assert.deepEqual(Object.keys(providers[1].gpu).sort(), namespace);
const dts = await readFile(resolve(pkg, manifest.publishConfig.exports['.'].types), 'utf8'), leafDTS = await readFile(resolve(pkg, 'dist/native-surface-uv01-program-wgsl.d.ts'), 'utf8');
for (const name of ['lowerNativeSurfaceUV01ProgramWGSL', 'LoweredNativeSurfaceUV01ProgramWGSL']) { assert.ok(new RegExp('\\b' + name + '\\b').test(dts)); assert.ok(new RegExp('\\b' + name + '\\b').test(leafDTS)); }

const expectedABI = {
  frame: { group: 0, binding: 0, byteLength: 160, fields: { view: { byteOffset: 0, type: 'mat4x4<f32>' }, projection: { byteOffset: 64, type: 'mat4x4<f32>' }, light: { byteOffset: 128, type: 'vec4<f32>' }, style: { byteOffset: 144, type: 'vec4<f32>' } } },
  material: { group: 0, binding: 1, byteLength: 64 }, draw: { group: 0, binding: 2, byteLength: 16, identity: { byteOffset: 0, type: 'u32', background: 0, minimum: 1, maximum: 4294967295 } },
  interpolation: { normal: { location: 0, type: 'vec3<f32>', mode: 'perspective', sampling: 'center', domain: 'world-scene-normal' }, nativeUV01: { location: 1, type: 'vec2<f32>', mode: 'perspective', sampling: 'center', domain: 'native-surface-normalized-uv01' } },
  conventions: { positions: 'once-prepared-world-scene-units', normals: 'once-prepared-world-inverse-transpose-normalized', clip: 'opengl-to-webgpu-z-once', nativeUV01: 'original-surface-uv01-derived-in-matching-native-vertex-order', color: 'native-gamma-2.2-lit-opaque' },
};
function expectedCompleteCode(expression) {
  return ('struct MaterialParams { slot: array<vec4<f32>,4>, }' +
    'struct FrameParams { view:mat4x4<f32>, projection:mat4x4<f32>, light:vec4<f32>, style:vec4<f32>, } struct DrawParams { identity:vec4<u32>, }' +
    '@group(0) @binding(0) var<uniform> frameParams:FrameParams; @group(0) @binding(1) var<uniform> materialParams:MaterialParams; @group(0) @binding(2) var<uniform> drawParams:DrawParams;' +
    'struct NativeSurfaceUV01VertexOutput { @builtin(position) position:vec4<f32>, @location(0) @interpolate(perspective,center) normal:vec3<f32>, @location(1) @interpolate(perspective,center) uv01:vec2<f32>, }' +
    '@vertex fn native_surface_uv01_vertex(@location(0) position:vec3<f32>, @location(1) normal:vec3<f32>, @location(2) uv01:vec2<f32>,)->NativeSurfaceUV01VertexOutput {' +
    'var output:NativeSurfaceUV01VertexOutput; let clip=frameParams.projection*frameParams.view*vec4<f32>(position,1.0); output.position=vec4<f32>(clip.xy,(clip.z+clip.w)*0.5,clip.w); output.normal=normal; output.uv01=uv01; return output; }' +
    'fn material_mix(a:vec3<f32>,b:vec3<f32>,ratio:f32)->vec3<f32>{let t=clamp(ratio,0.0,1.0);return a*(1.0-t)+b*t;}' +
    'struct NativeSurfaceUV01FragmentOutput{@location(0) color:vec4<f32>,@location(1) identity:u32,}' +
    '@fragment fn native_surface_uv01_fragment(input:NativeSurfaceUV01VertexOutput)->NativeSurfaceUV01FragmentOutput{' +
    'let native_surface_uv01=input.uv01; let base=' + expression + ';let light=frameParams.style.w+frameParams.light.w*max(dot(normalize(input.normal),frameParams.light.xyz),0.0);var output:NativeSurfaceUV01FragmentOutput;' +
    'output.color=vec4<f32>(pow(base*light,vec3<f32>(1.0/2.2)),1.0);output.identity=drawParams.identity.x;return output;}').replace(/\s+/g, '');
}
function assertProgram(result, expectedExpression) {
  keys(result, ['format', 'version', 'profile', 'lowered', 'code', 'entryPoints', 'vertexLayout', 'abi', 'targets']);
  assert.equal(result.format, 'barocss-gpu-native-surface-uv01-program-wgsl'); assert.equal(result.version, 0); assert.equal(result.profile, 'native-surface-opaque-uv01-program-wgsl-v0');
  assert.deepEqual(result.entryPoints, { vertex: 'native_surface_uv01_vertex', fragment: 'native_surface_uv01_fragment' });
  assert.deepEqual(result.vertexLayout, [{ slot: 0, shaderLocation: 0, format: 'float32x3', arrayStride: 12, stepMode: 'vertex' }, { slot: 1, shaderLocation: 1, format: 'float32x3', arrayStride: 12, stepMode: 'vertex' }, { slot: 2, shaderLocation: 2, format: 'float32x2', arrayStride: 8, stepMode: 'vertex' }]);
  assert.deepEqual(result.targets, [{ location: 0, format: 'rgba8unorm', type: 'vec4<f32>' }, { location: 1, format: 'r32uint', type: 'u32' }]); assert.deepEqual(result.abi, expectedABI);
  const code = result.code, compact = code.replace(/\s+/g, '');
  assert.equal(compact, expectedCompleteCode(expectedExpression), 'Complete selected trusted module, independent expression and ABI');
  for (const [binding, name, type] of [[0, 'frameParams', 'FrameParams'], [1, 'materialParams', 'MaterialParams'], [2, 'drawParams', 'DrawParams']]) assert.ok(compact.includes('@group(0)@binding(' + binding + ')var<uniform>' + name + ':' + type + ';'));
  assert.equal((code.match(/struct MaterialParams\b/g) ?? []).length, 1); assert.ok(code.includes(result.lowered.declarations)); assert.ok(code.includes(result.lowered.expression));
  assert.ok(compact.includes('structDrawParams{identity:vec4<u32>,'));
  assert.ok(compact.includes('@vertexfnnative_surface_uv01_vertex(')); assert.ok(compact.includes('@fragmentfnnative_surface_uv01_fragment('));
  assert.ok(compact.includes('@location(0)@interpolate(perspective,center)normal:vec3<f32>')); assert.ok(compact.includes('@location(1)@interpolate(perspective,center)uv01:vec2<f32>'));
  assert.ok(compact.includes('@location(2)uv01:vec2<f32>')); assert.ok(compact.includes('output.normal=normal;')); assert.ok(compact.includes('output.uv01=uv01;'));
  assert.ok(compact.includes('frameParams.projection*frameParams.view*vec4<f32>(position,1.0)'));
  assert.equal((compact.match(/\(clip\.z\+clip\.w\)\*0\.5/g) ?? []).length, 1);
  assert.ok(compact.includes('letnative_surface_uv01=input.uv01;'));
  assert.ok(compact.includes('frameParams.style.w+frameParams.light.w*max(dot(normalize(input.normal),frameParams.light.xyz),0.0)'));
  assert.ok(compact.includes('pow(base*light,vec3<f32>(1.0/2.2)),1.0')); assert.ok(compact.includes('output.identity=drawParams.identity.x;'));
  assert.ok(!/textureSample|sampler|worldMatrix|mmToScene|frameParams\.style\.xyz|engine_uv_encode|1\.0-input\.uv01/.test(code));
  assert.ok(code.length <= 65536 && new TextEncoder().encode(code).length <= 65536);
}

const nativeFixturePath = resolve(repo, 'examples/gpu-scene/fixtures/material-authoring.native.source0.css');
const nativeSource = await readFile(nativeFixturePath, 'utf8'); assert.equal(nativeSource, gitFile('examples/gpu-scene/fixtures/material-authoring.native.source0.css'));
const nativeSourceFile = await save('original.nonunit-surface.source0.css', nativeSource);
const nativeRequest = { format: 'barocss-gpu-native-surface-uv01-request', version: 0, sourceVersion: 0, source: nativeSource, surfaceId: 'original_rational_panel', countU: 5, countV: 5, revision: 0 };
const nativeRequestFile = await save('original.nonunit-surface.request.json', signed(nativeRequest) + '\n');
const expectedNativeUV = []; for (let u = 0; u < 5; u++) for (let v = 0; v < 5; v++) expectedNativeUV.push(u / 4, v / 4);
const nativeRecords = [];
for (const provider of providers) {
  const request = clone(nativeRequest), before = signed(request), geometry = provider.gpu.prepareNativeSurfaceUV01Geometry(request);
  assert.equal(signed(request), before); assert.equal(geometry.request.source, nativeSource); assert.equal(geometry.model.name, 'material_authoring_native'); assert.equal(geometry.selectedObjectIndex, 0); assert.equal(geometry.model.objects[0].weights[1][1], 2);
  assert.deepEqual(geometry.domain, { u: [-2, 6], v: [3, 11] }); assert.deepEqual(geometry.preview.packet.parameters.slice(0, 2), [-2, 3]); assert.deepEqual(geometry.preview.packet.parameters.slice(24, 26), [2, 7]); assert.deepEqual(geometry.preview.packet.parameters.slice(-2), [6, 11]);
  assert.deepEqual(geometry.normalizedParameters, expectedNativeUV); assert.deepEqual(Array.from(geometry.uv01), expectedNativeUV); assert.equal(geometry.preview.packet.positions.length, 75); assert.equal(geometry.preview.packet.normals.length, 75); assert.equal(geometry.preview.packet.indices.length, 96);
  const observationFile = await save(provider.label + '.native-geometry-observation.json', signed(geometry) + '\n'); nativeRecords.push({ provider: provider.label, requestFile: nativeRequestFile, sourceFile: nativeSourceFile, observationFile, signature: hash(signed(geometry)) });
}
assert.equal(nativeRecords[0].signature, nativeRecords[1].signature);

const literal = value => Math.fround(value).toExponential(8) + 'f';
const color = hex => 'vec3<f32>(' + [1, 3, 5].map(i => literal(Math.pow(parseInt(hex.slice(i, i + 2), 16) / 255, 2.2))).join(',') + ')';
const clipped = expression => 'clamp(' + expression + ',vec3<f32>(0.0),vec3<f32>(1.0))';
const fixtures = [
  { name: 'two_original_native_axes', source: '@shader #native_webgpu_gradient { @uniform amount:float(0,1,.25); @fragment { color:mix(#000,#fff,clamp(surface_u01*amount+surface_v01*.5,0,1)); } }',
    expected: clipped('material_mix(vec3<f32>(0.00000000e+0f,0.00000000e+0f,0.00000000e+0f),vec3<f32>(1.00000000e+0f,1.00000000e+0f,1.00000000e+0f),clamp(((native_surface_uv01.x*materialParams.slot[0].x)+(native_surface_uv01.y*5.00000000e-1f)),0.00000000e+0f,1.00000000e+0f))') },
  { name: 'original_constant_linear_coefficients', source: '// Complete original é😀\r\n@shader #native_constant { @fragment { color:#204080; } }\r\n', expected: clipped(color('#204080')) },
];
let accepted = 0, refused = 0, getters = 0, reflections = 0; const rows = [], coldCases = [];
for (const provider of providers) {
  const gpu = provider.gpu, records = [], retained = [], failures = [];
  for (const fixture of fixtures) {
    const compiled = gpu.compileNativeSurfaceUV01Material(fixture.source); assert.equal(compiled.ok, true, fixture.name);
    const original = compiled.material, caller = clone(original), before = signed(caller), result = gpu.lowerNativeSurfaceUV01ProgramWGSL(caller), again = gpu.lowerNativeSurfaceUV01ProgramWGSL(original);
    assertProgram(result, fixture.expected); keys(result.lowered, ['format', 'version', 'profile', 'material', 'expression', 'declarations', 'uniformLayout', 'uniformByteLength', 'input']);
    assert.equal(result.lowered.format, 'barocss-gpu-native-surface-uv01-material-wgsl'); assert.equal(result.lowered.version, 0); assert.equal(result.lowered.profile, 'native-surface-opaque-uv01-fragment-wgsl-v0'); assert.equal(result.lowered.uniformByteLength, 64);
    assert.deepEqual(result.lowered.input, { name: 'native_surface_uv01', type: 'vec2<f32>', domain: 'native-surface-normalized-uv01' }); assert.equal(result.lowered.expression, fixture.expected); assert.equal(result.lowered.declarations, 'struct MaterialParams {\n  slot: array<vec4<f32>, 4>,\n}\n');
    assert.equal(result.lowered.material.source, fixture.source); assert.deepEqual(result.lowered.material, original); assert.equal(signed(caller), before); assert.equal(Object.isFrozen(caller), false); independent(result, caller); independent(result, again); assert.deepEqual(result, again); frozen(result);
    assert.deepEqual(result.lowered.uniformLayout, original.uniforms.map((uniform, index) => ({ ...uniform, index, byteOffset: 4 * index, access: 'materialParams.slot[' + Math.floor(index / 4) + '].' + 'xyzw'[index % 4] })));
    assert.ok(!/uv_u|uv_v|material_uv|textureSample|@vertex|@fragment|@group|pow\(.*1\.0\//.test(result.lowered.expression + result.lowered.declarations));
    assert.ok(result.lowered.expression.length <= 65536 && new TextEncoder().encode(result.lowered.expression).length <= 65536); assert.ok(result.lowered.declarations.length <= 65536 && new TextEncoder().encode(result.lowered.declarations).length <= 65536); assert.ok(signed(result).length <= 2097152 && new TextEncoder().encode(signed(result)).length <= 2097152);
    if (fixture.name === 'two_original_native_axes') { assert.equal(result.lowered.uniformLayout.length, 1); assert.deepEqual(result.lowered.uniformLayout[0], { name: 'amount', type: 'float', min: 0, max: 1, default: .25, index: 0, byteOffset: 0, access: 'materialParams.slot[0].x' }); }
    else { assert.equal(result.lowered.uniformLayout.length, 0); const expectedLinear = [32, 64, 128].map(n => Math.pow(n / 255, 2.2)); assert.deepEqual(result.lowered.material.expression.linear, expectedLinear); assert.ok(expectedLinear.some(n => n !== Math.fround(n))); }
    const sourceFile = await save(provider.label + '.' + fixture.name + '.original.css', fixture.source), irFile = await save(provider.label + '.' + fixture.name + '.original-ir.json', signed(original) + '\n');
    const expressionFile = await save(provider.label + '.' + fixture.name + '.expression.wgsl', result.lowered.expression), declarationFile = await save(provider.label + '.' + fixture.name + '.declarations.wgsl', result.lowered.declarations), resultFile = await save(provider.label + '.' + fixture.name + '.wgsl-observation.json', signed(result) + '\n');
    const programFile = await save(provider.label + '.' + fixture.name + '.complete-program.wgsl', result.code); const record = { provider: provider.label, name: fixture.name, signature: hash(signed(result)), sourceFile, irFile, expressionFile, declarationFile, resultFile, programFile }; records.push(record); coldCases.push(record); retained.push({ result, record }); accepted++;
  }
  async function retention() { assert.equal(getters, 0); for (const file of [nativeSourceFile, nativeRequestFile, ...nativeRecords.map(row => row.observationFile)]) assert.equal(hash(await readFile(file.path)), file.sha256); for (const { result, record } of retained) { assert.equal(hash(signed(result)), record.signature); for (const file of [record.sourceFile, record.irFile, record.expressionFile, record.declarationFile, record.resultFile, record.programFile]) assert.equal(hash(await readFile(file.path)), file.sha256); } }
  async function reject(name, input, code, inspect) { let error; try { gpu.lowerNativeSurfaceUV01ProgramWGSL(input); } catch (caught) { error = caught; } assert.ok(error instanceof gpu.MeshMaterialError, name); assert.equal(error.code, code, name); assert.ok(error.message.length <= 1024); inspect?.(error); failures.push({ name, code: error.code, start: error.start, end: error.end, cause: error.cause instanceof Error ? { name: error.cause.name, code: error.cause.code ?? null } : null }); refused++; await retention(); }
  const material = retained[0].result.lowered.material;
  const legacy = gpu.compileMeshMaterial('@shader #legacy { @fragment { color:#fff; } }'); assert.equal(legacy.ok, true); await reject('legacy_IR_is_not_native_domain', legacy.material, 'IR');
  const generic = gpu.compileEngineUVMaterial('@shader #generic { @fragment { color:mix(#000,#fff,clamp(uv_u,0,1)); } }'); assert.equal(generic.ok, true); await reject('generic_UV_IR_is_not_native_domain', generic.material, 'IR');
  const forged = clone(material); forged.expression.args[2].args[0].left.left.name = 'uv_u'; await reject('forged_native_axis', forged, 'IR');
  const sourceMismatch = clone(material); sourceMismatch.source = sourceMismatch.source.replace('surface_v01*.5', 'surface_v01*.25'); await reject('full_source_IR_mismatch', sourceMismatch, 'IR');
  await reject('lowered_result_not_IR', retained[0].result, 'IR');
  const getter = clone(material); Object.defineProperty(getter, 'source', { enumerable: true, get() { getters++; return material.source; } }); await reject('own_source_getter0', getter, 'INPUT', error => assert.equal(Object.hasOwn(error, 'cause'), false));
  for (const kind of ['plain', 'branded']) { const marker = kind === 'plain' ? new Error('Actual native reflection marker') : new gpu.MeshMaterialError('UNIFORM', 'Actual native reflective cause', 19, 23); const proxy = new Proxy(clone(material), { getPrototypeOf() { reflections++; throw marker; } }); await reject('raw_reflection_' + kind, proxy, 'INPUT', error => { assert.notStrictEqual(error, marker); const cause = Object.getOwnPropertyDescriptor(error, 'cause'); assert.ok(cause && 'value' in cause); assert.strictEqual(cause.value, marker); assert.equal(error.start, 0); assert.equal(error.end, 0); }); }
  for (const [name, source] of [['literal', '@shader #tiny { @fragment { color:mix(#000,#fff,1e-50); } }'], ['default', '@shader #tiny { @uniform tiny:float(0,1,1e-50); @fragment { color:#fff; } }']]) { const compiled = gpu.compileNativeSurfaceUV01Material(source); assert.deepEqual([compiled.ok, compiled.diagnostics?.map(d => d.code)], [false, ['RANGE']], 'f32_underflow_' + name); }
  await retention(); rows.push({ provider: provider.label, records, failures });
}
for (let index = 0; index < fixtures.length; index++) assert.equal(rows[0].records[index].signature, rows[1].records[index].signature);
assert.equal(getters, 0); assert.equal(reflections, 4);
const coldCode = String.raw`
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';assert.equal(Number(process.versions.node.split('.')[0]),22);const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')),hash=v=>createHash('sha256').update(v).digest('hex');function signed(v){if(typeof v==='number'){assert.ok(Number.isFinite(v));return Object.is(v,-0)?'-0':JSON.stringify(v);}if(v===null||typeof v!=='object')return JSON.stringify(v);return Array.isArray(v)||ArrayBuffer.isView(v)?'['+Array.from(v,signed).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+signed(v[k])).join(',')+'}';}const rows=[],nativeRows=[];
for(const provider of cfg.providers){const gpu=await import(pathToFileURL(provider.path).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);const nativeRecord=cfg.nativeRecords.find(row=>row.provider===provider.label);for(const file of[nativeRecord.sourceFile,nativeRecord.requestFile,nativeRecord.observationFile])assert.equal(hash(readFileSync(file.path)),file.sha256);const request=JSON.parse(readFileSync(nativeRecord.requestFile.path,'utf8'));assert.equal(request.source,readFileSync(nativeRecord.sourceFile.path,'utf8'));const geometry=gpu.prepareNativeSurfaceUV01Geometry(request);assert.equal(hash(signed(geometry)),nativeRecord.signature);assert.deepEqual(geometry.domain,{u:[-2,6],v:[3,11]});assert.equal(signed(geometry),signed(JSON.parse(readFileSync(nativeRecord.observationFile.path,'utf8'))));nativeRows.push({provider:provider.label,signature:nativeRecord.signature,vertices:geometry.preview.packet.positions.length/3,nativeDomain:geometry.domain});for(const record of cfg.cases.filter(row=>row.provider===provider.label)){for(const file of[record.sourceFile,record.irFile,record.expressionFile,record.declarationFile,record.resultFile,record.programFile])assert.equal(hash(readFileSync(file.path)),file.sha256);const source=readFileSync(record.sourceFile.path,'utf8'),compiled=gpu.compileNativeSurfaceUV01Material(source);assert.equal(compiled.ok,true);assert.equal(compiled.material.source,source);assert.deepEqual(compiled.material,JSON.parse(readFileSync(record.irFile.path,'utf8')));const result=gpu.lowerNativeSurfaceUV01ProgramWGSL(compiled.material);assert.equal(hash(signed(result)),record.signature);assert.equal(result.lowered.expression,readFileSync(record.expressionFile.path,'utf8'));assert.equal(result.lowered.declarations,readFileSync(record.declarationFile.path,'utf8'));assert.equal(result.code,readFileSync(record.programFile.path,'utf8'));assert.deepEqual(result,JSON.parse(readFileSync(record.resultFile.path,'utf8')));rows.push({provider:provider.label,name:record.name,signature:record.signature});}}
console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,nativeRows,authority:'complete original native Surface source/request and CSS recompiled; IR/WGSL/result are retained observations',actualGPU:false,actualGL:false,fakeGPU:false}));`;
const coldScript = await save('cold-native-surface-uv01-program.mjs', coldCode), coldConfig = await save('cold-config.json', JSON.stringify({ namespace, providers: providers.map(({ label, path }) => ({ label, path })), cases: coldCases, nativeRecords }, null, 2) + '\n');
const stdout = execFileSync(process.execPath, [coldScript.path, coldConfig.path], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }); await save('cold.stdout', stdout); const cold = JSON.parse(stdout); assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, 4); assert.equal(cold.nativeRows.length, 2);
const report = { issue: 1563, parent, stage: 'NATIVE_SURFACE_UV01_COMPLETE_PROGRAM_SOURCE_API_FILE_COLD', node: process.version, accepted, refused, getters, reflections, namespaceCount: namespace.length, namespace, delta, sourceGraph, cadAlias, ordinary: await receipt(ordinary), emitted: await receipt(providers[1].path), rows, nativeRecords, nativeGeometryAdmissions: nativeRecords.length, nativeFixture: await receipt(nativeFixturePath), cold,
  actualGPU: false, actualGL: false, fakeGPU: false, completeProgramSource: true, frames: false, sampledPixels: false, producerFlowsReplayed: false, publication: false,
  support: 'Complete original native UV01 source/IR to trusted complete WGSL and exact typed160/64/16 ABI/interpolation/targets; original nonunit Surface source reconstructed through real geometry producer, independent text/literal/domain checks, ownership/errors/file retention and one genuine child/four program rows. No accepted frame/TEN/display join, actual shader-module/device/upload/render/pixel/identity/light/lifetime/consumer or publication qualification.', unforcedDefensiveCeilings: ['valid256VisitsDepth16', 'valid64KiBTexts', 'valid2MiBCompleteResult'] };
const result = await save('actual-result.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ issue: 1563, accepted, refused, getters, reflections, namespaceCount: namespace.length, freshChildCount: 1, coldRows: cold.rows.length, nativeColdRows: cold.nativeRows.length, actualGPU: false, result }));
