/** #1441 native-only reflection provenance repair; no new API or graphics.
 * Node22 examples/gpu-scene/native-reflection-cause-flow.mjs --output ABS_FRESH
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
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), output = resolve(process.argv[3]); await mkdir(output, { recursive: false });
const parent = '771ba2e1b7eef80bcb6dd31e8b075c91ce1ff989', pkg = resolve(repo, 'packages/barocss-gpu'), manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const ordinary = resolve(output, 'ordinary-public.mjs'), built = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const sourceGraph = Object.keys(built.metafile.inputs); assert.ok(sourceGraph.some(p => p.endsWith('/src/mesh-material.ts'))); assert.ok(sourceGraph.some(p => p.endsWith('/src/native-surface-uv01-geometry.ts')));
assert.ok(sourceGraph.some(p => p.includes('barocss-cad/src/'))); assert.ok(!sourceGraph.some(p => /barocss-(gpu|cad)\/dist\//.test(p)));
const hash = v => createHash('sha256').update(v).digest('hex');
function signed(v) { if (typeof v === 'number') { assert.ok(Number.isFinite(v)); return Object.is(v, -0) ? '-0' : JSON.stringify(v); }
  if (v === null || typeof v !== 'object') return JSON.stringify(v); assert.ok(!ArrayBuffer.isView(v)); if (Array.isArray(v)) return '[' + v.map(signed).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + signed(v[k])).join(',') + '}'; }
const clone = v => JSON.parse(signed(v)), ordinaryGeometry = g => Object.fromEntries(Object.entries(g).filter(([k]) => k !== 'uv01'));
const typedHash = view => hash(Buffer.from(view.buffer, view.byteOffset, view.byteLength));
function frozen(v) { if (v && typeof v === 'object' && !ArrayBuffer.isView(v)) { assert.ok(Object.isFrozen(v)); Object.values(v).forEach(frozen); } }
async function receipt(path) { const b = await readFile(path); return { path, bytes: b.length, sha256: hash(b) }; }
const providers = [{ label: 'ordinary-source', path: ordinary }, { label: 'emitted-public', path: resolve(pkg, manifest.publishConfig.exports['.'].import) }];
for (const p of providers) p.gpu = await import(pathToFileURL(p.path).href);
const namespace = Object.keys(providers[0].gpu).sort(); assert.equal(namespace.length, 124); assert.deepEqual(Object.keys(providers[1].gpu).sort(), namespace);
assert.equal(namespace.includes('prepareNativeSurfaceUV01MaterialBinding'), false, 'No independent pending #1439 provider dependency');
// Immutable earlier outputs are declaration-byte controls only, never runtime substitutes.
const baselineBinding = resolve(repo, '../gpu-native-surface-uv01-binding/packages/barocss-gpu/dist');
const baselineGeometry = resolve(repo, '../gpu-native-surface-uv01-geometry/packages/barocss-gpu/dist');
const dtsPath = resolve(pkg, manifest.publishConfig.exports['.'].types), materialDtsPath = resolve(pkg, 'dist/mesh-material.d.ts'), geometryDtsPath = resolve(pkg, 'dist/native-surface-uv01-geometry.d.ts');
const baselineBarrelPath = resolve(baselineBinding, 'index.d.ts'), baselineBarrel = await readFile(baselineBarrelPath, 'utf8');
const bindingLines = baselineBarrel.split('\n').filter(line => line.includes("from './native-surface-uv01-binding.js'"));
assert.equal(bindingLines.length, 2, 'Exactly the two separate pending #1439 additive barrel lines');
const parentBarrel = baselineBarrel.split('\n').filter(line => !line.includes("from './native-surface-uv01-binding.js'")).join('\n');
assert.equal(await readFile(dtsPath, 'utf8'), parentBarrel, 'Unchanged accepted-parent124 declaration barrel');
for (const [actual, baseline] of [[materialDtsPath, resolve(baselineBinding, 'mesh-material.d.ts')], [geometryDtsPath, resolve(baselineGeometry, 'native-surface-uv01-geometry.d.ts')]])
  assert.deepEqual(await readFile(actual), await readFile(baseline), 'Exact unchanged emitted public declaration bytes');
const materialSource = '// Original é😀 source and UTF16 spans.\r\n@shader #reflection_native { @fragment { color:mix(#000,#fff,surface_u01); } }\r\n';
const doc = JSON.parse(await readFile(resolve(repo, 'examples/gpu-scene/fixtures/area-revision1.cad-document.json'), 'utf8')), geometrySource = doc.assets[0].source;
assert.equal(Buffer.byteLength(geometrySource), 238); assert.equal(hash(geometrySource), '56985f37e763f01325ac7e91ba2cf251accfa92efad9e5200b8619dc58545dc8');
const geometryRequest = { format: 'barocss-gpu-native-surface-uv01-request', version: 0, sourceVersion: 0, source: geometrySource, surfaceId: 'plane_nonunit', countU: 9, countV: 9, revision: 0 };
const expectedExpression = { kind: 'call', type: 'color', name: 'mix', args: [{ kind: 'color', type: 'color', hex: '#000000', linear: [0, 0, 0] },
  { kind: 'color', type: 'color', hex: '#FFFFFF', linear: [1, 1, 1] }, { kind: 'input', type: 'float', name: 'surface_u01' }] };
const expectedLower = 'clamp(mix(vec3(0.0000000000000000,0.0000000000000000,0.0000000000000000),vec3(1.0000000000000000,1.0000000000000000,1.0000000000000000),clamp(v_native_surface_uv01.x,0.0,1.0)),vec3(0.0),vec3(1.0))';
const U9 = [-3, -1.75, -.5, .75, 2, 3.25, 4.5, 5.75, 7], V9 = [2, 2.375, 2.75, 3.125, 3.5, 3.875, 4.25, 4.625, 5], N9 = [0, .125, .25, .375, .5, .625, .75, .875, 1];
let accepted = 0, refused = 0, getters = 0, reflections = 0;
const rows = [], coldCases = [];
for (const provider of providers) {
  const gpu = provider.gpu, compiled = gpu.compileNativeSurfaceUV01Material(materialSource); assert.equal(compiled.ok, true);
  const supplied = clone(compiled.material), suppliedBefore = signed(supplied), validated = gpu.validateNativeSurfaceUV01MaterialIR(supplied), lowered = gpu.lowerNativeSurfaceUV01Material(supplied);
  assert.equal(signed(supplied), suppliedBefore); assert.deepEqual(validated, compiled.material); assert.deepEqual(validated.expression, expectedExpression);
  assert.notStrictEqual(validated.expression, supplied.expression); assert.equal(validated.source, materialSource); assert.equal(lowered.expression, expectedLower);
  assert.equal(lowered.inputDeclarations, 'in vec2 v_native_surface_uv01;'); assert.equal(lowered.uniformDeclarations, ''); assert.deepEqual(lowered.uniformLayout, []); frozen(validated); frozen(lowered);
  const requestBefore = signed(geometryRequest), geometry = gpu.prepareNativeSurfaceUV01Geometry(geometryRequest); assert.equal(signed(geometryRequest), requestBefore);
  assert.deepEqual(geometry.domain, { u: [-3, 7], v: [2, 5] }); assert.equal(geometry.model.name, 'plane_original'); assert.equal(geometry.model.objects.length, 1); assert.equal(geometry.selectedObjectIndex, 0);
  assert.equal(geometry.model.objects[0].id, 'plane_nonunit'); assert.ok(Object.is(geometry.model.objects[0].controlPoints[0][0][2], -0));
  assert.equal(geometry.preview.report.vertexCount, 81); assert.equal(geometry.preview.report.triangleCount, 128); assert.equal(geometry.preview.report.certified, false);
  assert.equal(geometry.uv01.byteLength, 648); assert.ok(geometry.uv01 instanceof Float32Array); frozen(geometry);
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) { const at = 2 * (i * 9 + j); assert.ok(Object.is(geometry.preview.packet.parameters[at], U9[i])); assert.ok(Object.is(geometry.preview.packet.parameters[at + 1], V9[j]));
    assert.equal(geometry.normalizedParameters[at], N9[i]); assert.equal(geometry.normalizedParameters[at + 1], N9[j]); assert.equal(geometry.uv01[at], N9[i]); assert.equal(geometry.uv01[at + 1], N9[j]); }
  const repeated = gpu.prepareNativeSurfaceUV01Geometry(geometryRequest); assert.notStrictEqual(repeated.model, geometry.model); assert.notStrictEqual(repeated.preview.packet.parameters, geometry.preview.packet.parameters); assert.notStrictEqual(repeated.uv01.buffer, geometry.uv01.buffer);
  const geometryDigest = hash(signed(ordinaryGeometry(geometry))), uvSHA = typedHash(geometry.uv01); geometry.uv01[0] = .5; assert.equal(repeated.uv01[0], 0); assert.equal(geometry.normalizedParameters[0], 0); geometry.uv01[0] = 0;
  assert.equal(typedHash(geometry.uv01), uvSHA); accepted += 4;
  const prefix = resolve(output, provider.label), sourcePath = prefix + '.material.css', irPath = prefix + '.material-ir.json', geometrySourcePath = prefix + '.geometry.source0.css', requestPath = prefix + '.geometry-request.json', dataPath = prefix + '.full-original.json', typedPath = prefix + '.uv01.bin';
  await writeFile(sourcePath, materialSource, { flag: 'wx' }); await writeFile(irPath, signed(supplied) + '\n', { flag: 'wx' }); await writeFile(geometrySourcePath, geometrySource, { flag: 'wx' }); await writeFile(requestPath, requestBefore + '\n', { flag: 'wx' });
  const data = { material: validated, lowered, geometry: ordinaryGeometry(geometry) }; await writeFile(dataPath, signed(data) + '\n', { flag: 'wx' }); await writeFile(typedPath, Buffer.from(geometry.uv01.buffer), { flag: 'wx' });
  const files = await Promise.all([sourcePath, irPath, geometrySourcePath, requestPath, dataPath, typedPath].map(receipt));
  coldCases.push({ provider: provider.label, sourcePath, irPath, geometrySourcePath, requestPath, dataPath, typedPath, files, semanticDigest: hash(signed(data)), uvSHA });
  const retained = signed(data), failures = [];
  async function retention() { assert.equal(signed({ material: validated, lowered, geometry: ordinaryGeometry(geometry) }), retained); assert.equal(signed(supplied), suppliedBefore); assert.equal(signed(geometryRequest), requestBefore);
    assert.equal(hash(signed(ordinaryGeometry(geometry))), geometryDigest); assert.equal(typedHash(geometry.uv01), uvSHA); assert.equal(getters, 0); for (const f of files) assert.equal(hash(await readFile(f.path)), f.sha256); }
  function proxy(target, trap, raw) { return new Proxy(target, { [trap]() { reflections++; throw raw; } }); }
  async function wrapped(label, operation, ErrorClass, raw) {
    let error; try { operation(); } catch (e) { error = e; }
    assert.ok(error instanceof ErrorClass, label); assert.notStrictEqual(error, raw); assert.equal(error.code, 'INPUT', label); assert.strictEqual(error.cause, raw);
    assert.equal(error.start, 0); assert.equal(error.end, 0); assert.ok(error.message.length <= 1024); await retention(); refused++;
    failures.push({ label, code: error.code, message: error.message, start: error.start, end: error.end, exactCallerCauseIdentity: true,
      callerCause: { name: raw.name, code: raw.code ?? null, message: raw.message, start: raw.start ?? null, end: raw.end ?? null }, previousOriginalsAndFilesRetained: true });
  }
  for (const trap of ['ownKeys', 'getPrototypeOf', 'getOwnPropertyDescriptor']) {
    for (const method of ['validateNativeSurfaceUV01MaterialIR', 'lowerNativeSurfaceUV01Material']) {
      const raw = new gpu.MeshMaterialError('UNIFORM', 'caller material ' + trap + ' misleading error', 17, 29);
      await wrapped(method + '_' + trap + '_same_public_error', () => gpu[method](proxy(clone(supplied), trap, raw)), gpu.MeshMaterialError, raw);
    }
    const raw = new gpu.NativeSurfaceUV01GeometryError('SOURCE', 'caller geometry ' + trap + ' misleading error', 13, 27);
    await wrapped('geometry_' + trap + '_same_public_error', () => gpu.prepareNativeSurfaceUV01Geometry(proxy(clone(geometryRequest), trap, raw)), gpu.NativeSurfaceUV01GeometryError, raw);
  }
  const standardMaterial = new Error('actual standard material reflection exception');
  await wrapped('material_standard_Error', () => gpu.validateNativeSurfaceUV01MaterialIR(proxy(clone(supplied), 'ownKeys', standardMaterial)), gpu.MeshMaterialError, standardMaterial);
  const standardGeometry = new Error('actual standard geometry reflection exception');
  await wrapped('geometry_standard_Error', () => gpu.prepareNativeSurfaceUV01Geometry(proxy(clone(geometryRequest), 'ownKeys', standardGeometry)), gpu.NativeSurfaceUV01GeometryError, standardGeometry);
  const rawMaterialBudget = new gpu.MeshMaterialError('BUDGET', 'caller raw BUDGET is not local work refusal', 17, 29);
  await wrapped('material_caller_BUDGET_wrapped_INPUT', () => gpu.validateNativeSurfaceUV01MaterialIR(proxy(clone(supplied), 'ownKeys', rawMaterialBudget)), gpu.MeshMaterialError, rawMaterialBudget);
  const rawGeometryBudget = new gpu.NativeSurfaceUV01GeometryError('BUDGET', 'caller raw geometry BUDGET is not local quota refusal', 13, 27);
  await wrapped('geometry_caller_BUDGET_wrapped_INPUT', () => gpu.prepareNativeSurfaceUV01Geometry(proxy(clone(geometryRequest), 'ownKeys', rawGeometryBudget)), gpu.NativeSurfaceUV01GeometryError, rawGeometryBudget);
  const deep = clone(supplied); let expression = { kind: 'float', type: 'float', value: 0 }; for (let i = 0; i < 26; i++) expression = { kind: 'unary', type: 'float', operator: '+', value: expression }; deep.expression = expression;
  const getterIR = clone(supplied); Object.defineProperty(getterIR, 'source', { enumerable: true, get() { getters++; return materialSource; } });
  const getterRequest = clone(geometryRequest); Object.defineProperty(getterRequest, 'source', { enumerable: true, get() { getters++; return geometrySource; } });
  const localControls = [
    ['material_local_snapshot_BUDGET', () => gpu.validateNativeSurfaceUV01MaterialIR(deep), gpu.MeshMaterialError, 'BUDGET'],
    ['material_local_getter_INPUT', () => gpu.validateNativeSurfaceUV01MaterialIR(getterIR), gpu.MeshMaterialError, 'INPUT'],
    ['geometry_local_source_BUDGET', () => gpu.prepareNativeSurfaceUV01Geometry({ ...geometryRequest, source: 'x'.repeat(65537) }), gpu.NativeSurfaceUV01GeometryError, 'BUDGET'],
    ['geometry_local_count_INPUT', () => gpu.prepareNativeSurfaceUV01Geometry({ ...geometryRequest, countU: 65 }), gpu.NativeSurfaceUV01GeometryError, 'INPUT'],
    ['geometry_local_getter_INPUT', () => gpu.prepareNativeSurfaceUV01Geometry(getterRequest), gpu.NativeSurfaceUV01GeometryError, 'INPUT'],
  ];
  for (const [label, operation, ErrorClass, code] of localControls) { let error; try { operation(); } catch (e) { error = e; }
    assert.ok(error instanceof ErrorClass); assert.equal(error.code, code, label); assert.equal(error.cause, undefined, 'Local refusal has no invented reflection cause'); await retention(); refused++;
    failures.push({ label, code, message: error.message, cause: null, previousOriginalsAndFilesRetained: true }); }
  const invalidMaterial = materialSource.replace('surface_u01', 'surface_missing'), diagnostic = gpu.compileNativeSurfaceUV01Material(invalidMaterial); assert.equal(diagnostic.ok, false);
  for (const method of ['validateNativeSurfaceUV01MaterialIR', 'lowerNativeSurfaceUV01Material']) { let error; try { gpu[method]({ ...clone(supplied), source: invalidMaterial }); } catch (e) { error = e; }
    assert.ok(error instanceof gpu.MeshMaterialError); assert.equal(error.code, 'IR'); assert.deepEqual(error.cause, diagnostic.diagnostics[0]); frozen(error.cause); assert.equal(error.start, diagnostic.diagnostics[0].start); assert.equal(error.end, diagnostic.diagnostics[0].end);
    await retention(); refused++; failures.push({ label: method + '_actual_source_diagnostic', code: error.code, start: error.start, end: error.end, cause: error.cause, previousOriginalsAndFilesRetained: true }); }
  let sourceError; try { gpu.prepareNativeSurfaceUV01Geometry({ ...geometryRequest, source: geometrySource.replace('degree-u:1', 'degree-u:unknown') }); } catch (e) { sourceError = e; }
  assert.ok(sourceError instanceof gpu.NativeSurfaceUV01GeometryError); assert.equal(sourceError.code, 'SOURCE'); assert.ok(Array.isArray(sourceError.cause)); frozen(sourceError.cause);
  assert.equal(sourceError.start, sourceError.cause[0].range.start); assert.equal(sourceError.end, sourceError.cause[0].range.end); await retention(); refused++;
  failures.push({ label: 'geometry_actual_SOURCE_diagnostic_array', code: sourceError.code, start: sourceError.start, end: sourceError.end, cause: sourceError.cause, previousOriginalsAndFilesRetained: true });
  // Two narrow old-profile controls retain their historical caller-class escape.
  for (const method of ['validateMeshMaterialIR', 'validateEngineUVMaterialIR']) {
    const raw = new gpu.MeshMaterialError('UNIFORM', 'unchanged old profile caller reflection', 17, 29); let error;
    try { gpu[method](proxy(clone(supplied), 'ownKeys', raw)); } catch (e) { error = e; }
    assert.strictEqual(error, raw); assert.equal(error.code, 'UNIFORM'); assert.equal(error.start, 17); assert.equal(error.end, 29); assert.equal(error.cause, undefined);
    await retention(); refused++; failures.push({ label: method + '_old_reflection_unchanged', sameCallerErrorEscapes: true, code: error.code, start: error.start, end: error.end, previousOriginalsAndFilesRetained: true });
  }
  rows.push({ provider: provider.label, files, semanticDigest: hash(signed(data)), uvSHA, failures });
}
assert.equal(rows[0].semanticDigest, rows[1].semanticDigest); assert.equal(rows[0].uvSHA, rows[1].uvSHA);
const coldCode = String.raw`
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
assert.equal(Number(process.versions.node.split('.')[0]),22);const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')),hash=v=>createHash('sha256').update(v).digest('hex');
function signed(v){if(typeof v==='number'){assert(Number.isFinite(v));return Object.is(v,-0)?'-0':JSON.stringify(v);}if(v===null||typeof v!=='object')return JSON.stringify(v);assert(!ArrayBuffer.isView(v));if(Array.isArray(v))return '['+v.map(signed).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+signed(v[k])).join(',')+'}';}
function frozen(v){if(v&&typeof v==='object'&&!ArrayBuffer.isView(v)){assert(Object.isFrozen(v));Object.values(v).forEach(frozen);}}
const rows=[];for(const provider of cfg.providers){const gpu=await import(pathToFileURL(provider.path).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);const item=cfg.cases.find(c=>c.provider===provider.label);for(const f of item.files)assert.equal(hash(readFileSync(f.path)),f.sha256);
const materialSource=readFileSync(item.sourcePath,'utf8'),ir=JSON.parse(readFileSync(item.irPath,'utf8')),geometrySource=readFileSync(item.geometrySourcePath,'utf8'),request=JSON.parse(readFileSync(item.requestPath,'utf8'));
assert.equal(ir.source,materialSource);assert.equal(request.source,geometrySource);const beforeIR=signed(ir),beforeRequest=signed(request),compiled=gpu.compileNativeSurfaceUV01Material(materialSource);assert.equal(compiled.ok,true);assert.deepEqual(compiled.material,ir);
const material=gpu.validateNativeSurfaceUV01MaterialIR(ir),lowered=gpu.lowerNativeSurfaceUV01Material(ir),prepared=gpu.prepareNativeSurfaceUV01Geometry(request),geometry=Object.fromEntries(Object.entries(prepared).filter(([k])=>k!=='uv01')),data={material,lowered,geometry};assert.equal(signed(ir),beforeIR);assert.equal(signed(request),beforeRequest);assert.equal(hash(signed(data)),item.semanticDigest);assert.deepEqual(data,JSON.parse(readFileSync(item.dataPath,'utf8')));frozen(material);frozen(lowered);frozen(prepared);
const view=prepared.uv01,bytes=Buffer.from(view.buffer,view.byteOffset,view.byteLength);assert.equal(view.byteLength,648);assert.equal(hash(bytes),item.uvSHA);assert.deepEqual(bytes,readFileSync(item.typedPath));rows.push({provider:provider.label,semanticDigest:item.semanticDigest,uvSHA:item.uvSHA});}
assert.equal(rows.length,2);console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,parentPreparedAuthority:false,actualGL:false}));
`;
const coldPath = resolve(output, 'cold-native-source.mjs'), configPath = resolve(output, 'cold-config.json');
await writeFile(coldPath, coldCode, { flag: 'wx' }); await writeFile(configPath, JSON.stringify({ providers: providers.map(({ label, path }) => ({ label, path })), namespace, cases: coldCases }, null, 2) + '\n', { flag: 'wx' });
const stdout = execFileSync(process.execPath, [coldPath, configPath], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }); await writeFile(resolve(output, 'cold.stdout'), stdout, { flag: 'wx' }); const cold = JSON.parse(stdout);
assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, 2); for (const c of coldCases) for (const f of c.files) assert.equal(hash(await readFile(f.path)), f.sha256);
const report = { issue: 1441, stage: 'NATIVE_REFLECTION_CAUSE_CPU_REPAIR', parent, node: process.version, namespaceCount: namespace.length, namespace, accepted, refused, getters, reflections, sourceGraph,
  ordinary: await receipt(ordinary), emitted: await receipt(providers[1].path), declarationCompatibility: { publicBarrel: await receipt(dtsPath), baselineBindingBarrel: await receipt(baselineBarrelPath),
    acceptedParentBarrelDerivation: 'Remove exactly the two independently pending1439 binding export lines; all other bytes equal current124 barrel.', material: await receipt(materialDtsPath), baselineMaterial: await receipt(resolve(baselineBinding, 'mesh-material.d.ts')),
    geometry: await receipt(geometryDtsPath), baselineGeometry: await receipt(resolve(baselineGeometry, 'native-surface-uv01-geometry.d.ts')), exactLeafBytesUnchanged: true }, rows, cold,
  actualGL: false, APIAddition: false, oldProfileBehaviorChanged: false, support: 'Native material validate/lower and source-qualified geometry capture real reflection exceptions as fresh INPUT/exactcause/zero offsets. Genuine local guards and source diagnostic chains retain their original meaning. Old profile caller-class behavior, declaration bytes and public124 namespace unchanged; no binder/renderer/pixels/resource/consumer/publication proof.' };
const resultPath = resolve(output, 'actual-result.json'); await writeFile(resultPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ issue: 1441, accepted, refused, getters, reflections, exports: namespace.length, coldRows: cold.rows.length, result: await receipt(resultPath), actualGL: false }));
