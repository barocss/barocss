/** #1434 source-qualified native coordinate producer CPU acceptance.
 * Node22 examples/gpu-scene/native-surface-uv01-geometry-flow.mjs --output ABS_FRESH
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
const parent = '646ab8ee91a23cb762fb4d54f948cdde7c2c3585', pkg = resolve(repo, 'packages/barocss-gpu');
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8')), cadPkg = resolve(repo, 'packages/barocss-cad');
const cadManifest = JSON.parse(await readFile(resolve(cadPkg, 'package.json'), 'utf8'));
const ordinary = resolve(output, 'ordinary-public.mjs'), cadPath = resolve(output, 'cad-source-diagnostic-control.mjs');
const sourceBuild = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
await build({ entryPoints: [resolve(cadPkg, cadManifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: cadPath });
const sourceGraph = Object.keys(sourceBuild.metafile.inputs);
assert.ok(sourceGraph.some(p => p.endsWith('/src/native/uv01/native-surface-uv01-geometry.ts')));
assert.ok(sourceGraph.some(p => p.includes('barocss-cad/src/'))); assert.ok(!sourceGraph.some(p => /barocss-(gpu|cad)\/dist\//.test(p)));
const providers = [{ label: 'ordinary-source', path: ordinary }, { label: 'emitted-public', path: resolve(pkg, manifest.publishConfig.exports['.'].import) }];
for (const p of providers) p.gpu = await import(pathToFileURL(p.path).href);
const namespace = Object.keys(providers[0].gpu).sort(); assert.deepEqual(Object.keys(providers[1].gpu).sort(), namespace);

const dtsPath = resolve(pkg, manifest.publishConfig.exports['.'].types), dts = await readFile(dtsPath, 'utf8');
const leafDtsPath = resolve(pkg, 'dist/native-surface-uv01-geometry.d.ts'), leafDts = await readFile(leafDtsPath, 'utf8');
for (const name of ['prepareNativeSurfaceUV01Geometry', 'NativeSurfaceUV01GeometryError', 'NativeSurfaceUV01GeometryRequest', 'PreparedNativeSurfaceUV01Geometry', 'NativeSurfaceUV01GeometryCode']) {
  assert.ok(new RegExp('\\b' + name + '\\b').test(dts), 'Actual public DTS ' + name); assert.ok(new RegExp('\\b' + name + '\\b').test(leafDts));
}
const hash = b => createHash('sha256').update(b).digest('hex');
function signed(v) { if (typeof v === 'number') { assert.ok(Number.isFinite(v)); return Object.is(v, -0) ? '-0' : JSON.stringify(v); }
  if (v === null || typeof v !== 'object') return JSON.stringify(v); assert.ok(!ArrayBuffer.isView(v));
  if (Array.isArray(v)) return '[' + v.map(signed).join(',') + ']'; return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + signed(v[k])).join(',') + '}'; }
const clone = v => JSON.parse(signed(v));
const ordinaryResult = result => Object.fromEntries(Object.entries(result).filter(([name]) => name !== 'uv01'));
const semanticDigest = result => hash(signed(ordinaryResult(result)));
const typedHash = view => hash(Buffer.from(view.buffer, view.byteOffset, view.byteLength));
function frozen(v) { if (v && typeof v === 'object' && !ArrayBuffer.isView(v)) { assert.ok(Object.isFrozen(v)); Object.values(v).forEach(frozen); } }
function refs(v, out = new Set()) { if (v && typeof v === 'object' && !out.has(v)) { out.add(v); Object.values(v).forEach(child => refs(child, out)); } return out; }
function independent(a, b) { const left = refs(a), right = refs(b); for (const item of left) assert.ok(!right.has(item), 'No arrays/ordinary objects/typed views shared across admissions'); }
async function receipt(path) { const b = await readFile(path); return { path, bytes: b.length, sha256: hash(b) }; }
const document = JSON.parse(await readFile(resolve(repo, 'examples/gpu-scene/fixtures/area-revision1.cad-document.json'), 'utf8'));
const original = document.assets[0].source;
assert.equal(Buffer.byteLength(original), 238); assert.equal(hash(original), '56985f37e763f01325ac7e91ba2cf251accfa92efad9e5200b8619dc58545dc8');
const request = (source, countU = 9, countV = 9, revision = 0, surfaceId = 'plane_nonunit') => ({ format: 'barocss-gpu-native-surface-uv01-request', version: 0, sourceVersion: 0, source, surfaceId, countU, countV, revision });
const sibling = id => '@curve #' + id + ' { type:nurbs; degree:1; knots:[-0,-0,1,1]; control-points:[[-0,0,-0],[1,0,-0]]; weights:[1,1]; }\n';
const withSiblings = (source, n) => source.replace('@surface', Array.from({ length: n }, (_, i) => sibling('retained_' + i)).join('') + '@surface');
const edited = withSiblings(original.replace('knots-u:[-3,-3,7,7]', 'knots-u:[-0,-0,7,7]').replace('knots-v:[2,2,5,5]', 'knots-v:[-0,-0,5,5]')
  .replace('[[2,0,-0],[2,3,-0]]', '[[4,0,-0],[4,3,-0]]'), 1);
assert.notEqual(edited, original);
const fixtures = [
  { label: 'actual_area_rev1_nonunit', request: request(original), domain: { u: [-3, 7], v: [2, 5] }, selected: 0, objects: 1, sizeX: 2 },
  { label: 'same_ID_domain_geometry_edit_full_sibling', request: request(edited, 9, 9, -0), domain: { u: [-0, 7], v: [-0, 5] }, selected: 1, objects: 2, sizeX: 4, signed: true },
  { label: 'maximum64_by64_coordinate_buffer', request: request(original, 64, 64, 2147483647), domain: { u: [-3, 7], v: [2, 5] }, selected: 0, objects: 1, sizeX: 2 },
  { label: 'full16_native_Model_selector_boundary', request: request(withSiblings(original, 15), 2, 2), domain: { u: [-3, 7], v: [2, 5] }, selected: 15, objects: 16, sizeX: 2 },
];
const U9 = [-3, -1.75, -.5, .75, 2, 3.25, 4.5, 5.75, 7], V9 = [2, 2.375, 2.75, 3.125, 3.5, 3.875, 4.25, 4.625, 5], N9 = [0, .125, .25, .375, .5, .625, .75, .875, 1];
const near = (a, b, tolerance = 2e-14) => assert.ok(Math.abs(a - b) <= tolerance, 'Independent numeric expected ' + b + ', actual ' + a);
function verify(result, fixture) {
  const r = fixture.request, n = r.countU * r.countV, packet = result.preview.packet, report = result.preview.report;
  assert.deepEqual(Object.keys(result).sort(), ['format', 'version', 'profile', 'request', 'model', 'selectedObjectIndex', 'domain', 'preview', 'normalizedParameters', 'uv01'].sort());
  assert.equal(result.format, 'barocss-gpu-native-surface-uv01-geometry'); assert.equal(result.version, 0); assert.equal(result.profile, 'source0-surface-d0-uv01-v0');
  assert.deepEqual(result.request, { ...r, revision: r.revision === 0 ? +0 : r.revision }); assert.notStrictEqual(result.request, r); assert.equal(result.request.source, r.source);
  assert.equal(result.model.name, 'plane_original'); assert.equal(result.model.version, 0); assert.equal(result.model.lengthUnit, 'mm'); assert.equal(result.model.objects.length, fixture.objects);
  assert.equal(result.selectedObjectIndex, fixture.selected); const surface = result.model.objects[fixture.selected];
  assert.equal(surface.kind, 'surface'); assert.equal(surface.id, 'plane_nonunit'); assert.equal(surface.degreeU, 1); assert.equal(surface.degreeV, 1);
  assert.deepEqual(surface.weights, [[1, 1], [1, 1]]); assert.ok(Object.is(surface.controlPoints[0][0][2], -0), 'Original native control coefficient sign');
  assert.deepEqual(result.domain, fixture.domain); assert.equal(packet.surfaceId, r.surfaceId); assert.equal(packet.revision, r.revision === 0 ? 0 : r.revision);
  assert.equal(packet.lengthUnit, 'mm'); assert.equal(packet.coordinateSystem, 'right-handed-y-up'); assert.equal(packet.winding, 'ccw');
  assert.deepEqual(report.grid, { countU: r.countU, countV: r.countV }); assert.equal(report.vertexCount, n); assert.equal(report.triangleCount, 2 * (r.countU - 1) * (r.countV - 1));
  assert.equal(report.probeCount, 5 * (r.countU - 1) * (r.countV - 1)); assert.equal(report.certified, false); assert.equal(report.normalMethod, 'area-weighted-incident-triangle');
  assert.equal(packet.parameters.length, 2 * n); assert.equal(packet.positions.length, 3 * n); assert.equal(packet.normals.length, 3 * n); assert.equal(packet.indices.length, 3 * report.triangleCount);
  assert.equal(result.normalizedParameters.length, 2 * n); assert.ok(result.uv01 instanceof Float32Array); assert.equal(result.uv01.byteLength, 8 * n);
  for (let i = 0; i < r.countU; i++) for (let j = 0; j < r.countV; j++) {
    const pair = 2 * (i * r.countV + j), pu = i / (r.countU - 1), pv = j / (r.countV - 1);
    if (fixture.label === 'actual_area_rev1_nonunit') { assert.ok(Object.is(packet.parameters[pair], U9[i])); assert.ok(Object.is(packet.parameters[pair + 1], V9[j])); assert.equal(result.normalizedParameters[pair], N9[i]); assert.equal(result.normalizedParameters[pair + 1], N9[j]); }
    near(result.normalizedParameters[pair], pu); near(result.normalizedParameters[pair + 1], pv);
    assert.ok(Object.is(result.uv01[pair], Math.fround(result.normalizedParameters[pair]))); assert.ok(Object.is(result.uv01[pair + 1], Math.fround(result.normalizedParameters[pair + 1])));
    near(packet.positions[3 * (i * r.countV + j)], fixture.sizeX * pu); near(packet.positions[3 * (i * r.countV + j) + 1], 3 * pv); near(packet.positions[3 * (i * r.countV + j) + 2], 0);
  }
  assert.equal(result.normalizedParameters[0], 0); assert.equal(result.normalizedParameters.at(-1), 1); assert.ok(Object.is(result.normalizedParameters[0], +0)); assert.ok(Object.is(result.uv01[0], +0));
  if (fixture.signed) { assert.ok(Object.is(surface.knotsU[1], -0)); assert.ok(Object.is(surface.knotsV[1], -0)); assert.ok(Object.is(result.domain.u[0], -0)); assert.ok(Object.is(result.domain.v[0], -0));
    assert.ok(Object.is(packet.parameters[0], -0)); assert.ok(Object.is(packet.parameters[1], -0)); assert.ok(Object.is(result.request.revision, +0));
    const retained = result.model.objects[0]; assert.equal(retained.id, 'retained_0'); assert.equal(retained.kind, 'curve'); assert.deepEqual(retained.controlPoints, [[-0, 0, -0], [1, 0, -0]]); }
  frozen(result); assert.equal(Object.isFrozen(result.uv01), false); assert.notStrictEqual(packet.parameters, result.normalizedParameters);
}
const invalidSource = original.replace('degree-u:1', 'degree-u:unknown');
const cad = await import(pathToFileURL(cadPath).href), actualDiagnostic = cad.compileCadModel(invalidSource, { sourceVersion: 0 });
assert.equal(actualDiagnostic.ok, false, 'Actual CAD diagnostic oracle, not a constructed error');
const overfullSource = withSiblings(original, 16), overfullDiagnostic = cad.compileCadModel(overfullSource, { sourceVersion: 0 });
assert.equal(overfullDiagnostic.ok, false, 'Actual Source0 declaration ceiling precedes the producer Model guard');
assert.equal(overfullDiagnostic.diagnostics[0].code, 'LIMIT');
const collapsed = original.replace('[[[0,0,-0],[0,3,-0]],[[2,0,-0],[2,3,-0]]]', '[[[0,0,-0],[0,0,-0]],[[0,0,-0],[0,0,-0]]]'); assert.notEqual(collapsed, original);
// Source0 admits decimal literals, not exponent notation. These exact finite
// decimal endpoints represent ±1e308; their Number subtraction overflows.
const hugeDecimal = '1' + '0'.repeat(308);
const overflowDomain = original.replace('knots-u:[-3,-3,7,7]', 'knots-u:[-' + hugeDecimal + ',-' + hugeDecimal + ',' + hugeDecimal + ',' + hugeDecimal + ']'); assert.notEqual(overflowDomain, original);
let accepted = 0, refused = 0, getters = 0, reflections = 0, producerCalls = 0;
const rows = [], coldCases = [];
for (const provider of providers) {
  const gpu = provider.gpu; assert.equal(typeof gpu.prepareNativeSurfaceUV01Geometry, 'function'); assert.equal(typeof gpu.NativeSurfaceUV01GeometryError, 'function');
  const produce = value => { producerCalls++; return gpu.prepareNativeSurfaceUV01Geometry(value); }, admissions = [], failures = [], previous = [];
  for (const fixture of fixtures) {
    const before = signed(fixture.request), result = produce(fixture.request); verify(result, fixture); assert.equal(signed(fixture.request), before);
    for (const earlier of previous) independent(result, earlier); previous.push(result);
    const prefix = resolve(output, provider.label + '.' + fixture.label), requestPath = prefix + '.source-request.json', ordinaryPath = prefix + '.full-original.json', typedPath = prefix + '.uv01.bin';
    await writeFile(requestPath, before + '\n', { flag: 'wx' }); await writeFile(ordinaryPath, signed(ordinaryResult(result)) + '\n', { flag: 'wx' });
    await writeFile(typedPath, Buffer.from(result.uv01.buffer, result.uv01.byteOffset, result.uv01.byteLength), { flag: 'wx' });
    const files = await Promise.all([requestPath, ordinaryPath, typedPath].map(receipt));
    coldCases.push({ provider: provider.label, label: fixture.label, requestPath, ordinaryPath, typedPath, requestSHA256: files[0].sha256, ordinarySHA256: files[1].sha256,
      typedSHA256: files[2].sha256, semanticDigest: semanticDigest(result), uvBytes: result.uv01.byteLength });
    accepted++; admissions.push({ label: fixture.label, files, domain: result.domain, selectedObjectIndex: result.selectedObjectIndex, nativeObjects: result.model.objects.length,
      vertices: result.preview.report.vertexCount, triangles: result.preview.report.triangleCount, normalizedBytes: result.uv01.byteLength, semanticDigest: semanticDigest(result), typedSHA256: typedHash(result.uv01) });
  }
  const first = previous[0], retainedDigest = semanticDigest(first), retainedTyped = typedHash(first.uv01), repeat = produce(fixtures[0].request);
  independent(first, repeat); assert.equal(semanticDigest(repeat), retainedDigest); assert.equal(typedHash(repeat.uv01), retainedTyped);
  first.uv01[0] = .75; assert.equal(repeat.uv01[0], 0); assert.equal(first.normalizedParameters[0], 0); assert.equal(semanticDigest(first), retainedDigest);
  const reconstructed = produce(first.request); assert.equal(reconstructed.uv01[0], 0); independent(first, reconstructed); first.uv01[0] = 0;
  assert.equal(typedHash(first.uv01), retainedTyped); accepted += 2;
  assert.notEqual(previous[0].request.source, previous[1].request.source); assert.notDeepEqual(previous[0].domain, previous[1].domain);
  assert.notEqual(hash(signed(previous[0].preview.packet)), hash(signed(previous[1].preview.packet)), 'Same ID source edit cannot reuse old packet');
  const protectedFiles = coldCases.filter(c => c.provider === provider.label), beforeOrdinary = previous.map(semanticDigest), beforeTyped = previous.map(r => typedHash(r.uv01));
  async function retention() { assert.deepEqual(previous.map(semanticDigest), beforeOrdinary); assert.deepEqual(previous.map(r => typedHash(r.uv01)), beforeTyped); assert.equal(getters, 0);
    for (const f of protectedFiles) for (const [path, expected] of [[f.requestPath, f.requestSHA256], [f.ordinaryPath, f.ordinarySHA256], [f.typedPath, f.typedSHA256]]) assert.equal(hash(await readFile(path)), expected); }
  const bad = (label, edit, code = 'INPUT') => { const r = clone(fixtures[0].request); edit(r); return { label, request: r, code }; };
  const failuresToRun = [
    bad('countU_below2', r => r.countU = 1), bad('countV_above64', r => r.countV = 65), bad('fractional_count', r => r.countU = 2.5), bad('revision_upper_bound', r => r.revision = 2147483648),
    bad('wrong_version', r => r.version = 1), bad('wrong_sourceVersion', r => r.sourceVersion = 1), bad('nontext_source', r => r.source = []), bad('extra_packet_not_an_input', r => r.packet = first.preview.packet),
    bad('bad_selector_ASCII', r => r.surfaceId = 'a'.repeat(65)), bad('missing_selector', r => r.surfaceId = 'not_present', 'SELECTOR'),
    { label: 'wrong_kind_curve_selector', request: request(edited, 9, 9, 0, 'retained_0'), code: 'SELECTOR' },
    bad('UTF16_source_limit', r => r.source = 'x'.repeat(65537), 'BUDGET'), bad('UTF8_source_limit', r => r.source = 'é'.repeat(32769), 'BUDGET'),
    { label: 'actual_CAD_compile_diagnostic', request: request(invalidSource), code: 'SOURCE', diagnostic: actualDiagnostic.diagnostics },
    { label: 'actual_native_collapsed_preview', request: request(collapsed), code: 'NATIVE', nativeCause: true },
    { label: 'finite_native_endpoints_overflow_represented_width', request: request(overflowDomain), code: 'NORMALIZATION', localNormalization: true },
    { label: 'native_declaration17_SOURCE_before_full_Model_guard', request: request(overfullSource, 2, 2), code: 'SOURCE', diagnostic: overfullDiagnostic.diagnostics },
    bad('getter_source_not_invoked', r => Object.defineProperty(r, 'source', { enumerable: true, get() { getters++; return original; } })),
    { label: 'null_prototype_refused', request: Object.assign(Object.create(null), fixtures[0].request), code: 'INPUT' },
  ];
  const marker = new Error('actual native coordinate request reflection marker'); failuresToRun.push({ label: 'actual_reflection_cause', request: new Proxy(clone(fixtures[0].request), { ownKeys() { reflections++; throw marker; } }), code: 'INPUT', cause: marker });
  for (const f of failuresToRun) {
    let error; try { produce(f.request); } catch (e) { error = e; }
    assert.ok(error instanceof gpu.NativeSurfaceUV01GeometryError, f.label); assert.equal(error.code, f.code, f.label); assert.ok(error.message.length <= 1024);
    if (f.cause) assert.strictEqual(error.cause, f.cause);
    if (f.diagnostic) { assert.deepEqual(error.cause, f.diagnostic); frozen(error.cause); assert.equal(error.start, f.diagnostic[0].range.start); assert.equal(error.end, f.diagnostic[0].range.end); }
    if (f.nativeCause) { assert.ok(error.cause instanceof RangeError); assert.equal(error.cause.message, 'Collapsed or nonfinite preview triangle'); assert.equal(error.start, 0); assert.equal(error.end, 0); }
    if (f.localNormalization) { assert.equal(error.cause, undefined); assert.equal(error.message, '[NORMALIZATION] Native Surface UV01 domain requires finite positive represented widths'); assert.equal(error.start, 0); assert.equal(error.end, 0); }
    await retention(); refused++; failures.push({ label: f.label, code: error.code, message: error.message, start: error.start, end: error.end,
      cause: error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message } : error.cause ?? null, previousSourceNativeRawUVNormalizedBuffersAndFilesRetained: true });
  }
  rows.push({ provider: provider.label, admissions, failures, independentRepeatAndMutableViewReconstruction: true });
}
assert.equal(rows[0].admissions[0].semanticDigest, rows[1].admissions[0].semanticDigest);
const coldCode = String.raw`
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
assert.equal(Number(process.versions.node.split('.')[0]),22);const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')),hash=v=>createHash('sha256').update(v).digest('hex');
function signed(v){if(typeof v==='number'){assert(Number.isFinite(v));return Object.is(v,-0)?'-0':JSON.stringify(v);}if(v===null||typeof v!=='object')return JSON.stringify(v);assert(!ArrayBuffer.isView(v));if(Array.isArray(v))return '['+v.map(signed).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+signed(v[k])).join(',')+'}';}
function frozen(v){if(v&&typeof v==='object'&&!ArrayBuffer.isView(v)){assert(Object.isFrozen(v));Object.values(v).forEach(frozen);}}
const rows=[];for(const provider of cfg.providers){const gpu=await import(pathToFileURL(provider.path).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);
for(const item of cfg.cases.filter(x=>x.provider===provider.label)){const requestBytes=readFileSync(item.requestPath),ordinaryBytes=readFileSync(item.ordinaryPath),typedBytes=readFileSync(item.typedPath);assert.equal(hash(requestBytes),item.requestSHA256);assert.equal(hash(ordinaryBytes),item.ordinarySHA256);assert.equal(hash(typedBytes),item.typedSHA256);
const request=JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(requestBytes)),before=signed(request),result=gpu.prepareNativeSurfaceUV01Geometry(request);assert.equal(signed(request),before);const ordinary=Object.fromEntries(Object.entries(result).filter(([k])=>k!=='uv01'));assert.equal(hash(signed(ordinary)),item.semanticDigest);assert.deepEqual(ordinary,JSON.parse(ordinaryBytes.toString('utf8')));frozen(result);assert(result.uv01 instanceof Float32Array);assert.equal(result.uv01.byteLength,item.uvBytes);const bytes=Buffer.from(result.uv01.buffer,result.uv01.byteOffset,result.uv01.byteLength);assert.equal(hash(bytes),item.typedSHA256);assert.deepEqual(bytes,typedBytes);assert.equal(result.request.source,request.source);
rows.push({provider:provider.label,label:item.label,semanticDigest:item.semanticDigest,typedSHA256:item.typedSHA256,normalizedBytes:item.uvBytes,sourceSHA256:hash(request.source),nativeDomain:result.domain});}}
assert.equal(rows.length,cfg.cases.length);console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,parentPreparedAuthority:false,actualGL:false}));
`;
const coldPath = resolve(output, 'cold-producer.mjs'), configPath = resolve(output, 'cold-config.json');
await writeFile(coldPath, coldCode, { flag: 'wx' }); await writeFile(configPath, JSON.stringify({ providers: providers.map(({ label, path }) => ({ label, path })), namespace, cases: coldCases }, null, 2) + '\n', { flag: 'wx' });
const stdout = execFileSync(process.execPath, [coldPath, configPath], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
await writeFile(resolve(output, 'cold.stdout'), stdout, { flag: 'wx' }); const cold = JSON.parse(stdout); assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, fixtures.length * 2);
for (const item of coldCases) assert.equal(hash(await readFile(item.requestPath)), item.requestSHA256);
const report = { issue: 1434, stage: 'SOURCE_NATIVE_SURFACE_UV01_GEOMETRY_CPU', parent, node: process.version, namespaceCount: namespace.length, namespace, accepted, refused, producerCalls, getters, reflections,
  sourceGraph, ordinary: await receipt(ordinary), emitted: await receipt(providers[1].path), publicDTS: await receipt(dtsPath), leafDTS: await receipt(leafDtsPath),
  declarationCheck: 'Actual emitted public and leaf exports read; no broad declaration compilation campaign.', actualCADDiagnosticControl: { module: await receipt(cadPath), diagnostics: actualDiagnostic.diagnostics, declarationCeilingDiagnostics: overfullDiagnostic.diagnostics, scope: 'Two narrow failed public compiles for exact SOURCE causes: malformed field and original 16-declaration ceiling; not a producer campaign.' },
  rows, cold, actualGL: false, materialDependency: false, normalizationGuardScope: 'Real source reconstruction and sampled original-domain coordinates only. No forged packet/callback or forced unreachable diagnostic branch.',
  support: 'Original full Source0/Model/selected Surface/domain/D0 packet and independently derived normalized Number/F32 view. Original signed authority retained, F32 may merge interior values. No material binding, native-axis conversion, frame/attribute/linked shader/pixel/lifetime/consumer/publication claim.' };
const resultPath = resolve(output, 'actual-result.json'); await writeFile(resultPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ issue: 1434, accepted, refused, producerCalls, getters, reflections, coldRows: cold.rows.length, exports: namespace.length, result: await receipt(resultPath), actualGL: false }));
