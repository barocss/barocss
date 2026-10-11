/** #1472 ONE authored directional catalog/API/file/cold CPU qualifier. Node22 after GPU build.
 * node examples/gpu-scene/native-directional-lights-flow.mjs --output ABS_FRESH
 * CPU normal response is an independent reference, never shader/pixel/frame/TEN proof.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
assert.equal(Number(process.versions.node.split('.')[0]), 22); assert.equal(process.argv.length, 4); assert.equal(process.argv[2], '--output'); assert.ok(isAbsolute(process.argv[3]));
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), output = resolve(process.argv[3]); await mkdir(output, { recursive: false });
const parent = '0a7b174a7ae2e0bb59aedfc550c2bf557c49e829', pkg = resolve(repo, 'packages/barocss-gpu'), manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const hash = v => createHash('sha256').update(v).digest('hex'), parentFile = name => execFileSync('git', ['show', parent + ':packages/barocss-gpu/' + name], { cwd: repo, encoding: 'utf8' });
const ordinary = resolve(output, 'ordinary-public.mjs'), bundle = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const sourceGraph = Object.keys(bundle.metafile.inputs); assert.ok(sourceGraph.some(p => p.endsWith('/src/native-directional-lights.ts'))); assert.ok(!sourceGraph.some(p => /barocss-(gpu|cad)\/dist\//.test(p)));
const providers = [{ label: 'ordinary-source', path: ordinary }, { label: 'emitted-public', path: resolve(pkg, manifest.publishConfig.exports['.'].import) }]; for (const p of providers) p.gpu = await import(pathToFileURL(p.path).href);
const namespace = Object.keys(providers[0].gpu).sort(), runtimeAdditions = ['prepareNativeDirectionalLights', 'NativeDirectionalLightsError', 'NativeDirectionalLightsDiagnosticCode'];
assert.equal(namespace.length, 134); assert.deepEqual(Object.keys(providers[1].gpu).sort(), namespace); assert.equal(namespace.filter(n => !runtimeAdditions.includes(n)).length, 131); assert.ok(runtimeAdditions.every(n => namespace.includes(n)));
for (const name of ['ownRecord', 'copyGpuData', 'freezeGpuData', 'normalized']) assert.ok(!namespace.includes(name));
assert.ok((await readFile(resolve(pkg, 'src/index.ts'), 'utf8')).startsWith(parentFile('src/index.ts'))); assert.deepEqual(manifest, JSON.parse(parentFile('package.json')));
for (const leaf of ['mesh-lighting.ts', 'mesh-shaders.ts']) assert.equal(await readFile(resolve(pkg, 'src/' + leaf), 'utf8'), parentFile('src/' + leaf));
const publicDTS = await readFile(resolve(pkg, manifest.publishConfig.exports['.'].types), 'utf8'), leafDTS = await readFile(resolve(pkg, 'dist/native-directional-lights.d.ts'), 'utf8');
const fourTypes = ['NativeDirectionalLightV0', 'NativeDirectionalLightsV0', 'NativeDirectionalLightExecution', 'PreparedNativeDirectionalLights'];
for (const name of [...runtimeAdditions, ...fourTypes]) { assert.ok(new RegExp('\\b' + name + '\\b').test(publicDTS)); assert.ok(new RegExp('\\b' + name + '\\b').test(leafDTS)); }
assert.ok(/type\s+NativeDirectionalLightsDiagnosticCode\b/.test(leafDTS));
function signed(v) { if (typeof v === 'number') { assert.ok(Number.isFinite(v)); return Object.is(v, -0) ? '-0' : JSON.stringify(v); } if (v === null || typeof v !== 'object') return JSON.stringify(v);
  return Array.isArray(v) ? '[' + v.map(signed).join(',') + ']' : '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + signed(v[k])).join(',') + '}'; }
const clone = v => JSON.parse(signed(v));
function frozen(v) { if (v && typeof v === 'object') { assert.ok(Object.isFrozen(v)); Object.values(v).forEach(frozen); } }
function refs(v, out = new Set()) { if (v && typeof v === 'object' && !out.has(v)) { out.add(v); Object.values(v).forEach(x => refs(x, out)); } return out; }
function independent(a, b) { const right = refs(b); for (const object of refs(a)) assert.ok(!right.has(object)); }
function keys(v, names) { assert.deepEqual(Object.keys(v).sort(), [...names].sort()); }
function near(actual, expected, tolerance = 1e-14) { assert.ok(Math.abs(actual - expected) <= tolerance, actual + ' differs from ' + expected); }
async function receipt(path) { const b = await readFile(path); return { path, bytes: b.length, sha256: hash(b) }; }
async function save(path, text) { await writeFile(path, text, { flag: 'wx' }); return receipt(path); }
const main = { format: 'barocss-gpu-native-directional-lights', version: 0, profile: 'native-world-directional-linear-v0', sourceId: 'native-material-study', revision: 0, ambientStrength: .1,
  lights: [{ nodeId: 'red-key', label: 'Key é😀', enabled: true, directionScene: [2, -0, 0], colorLinearRGB: [1, -0, 0], intensity: .5 },
    { nodeId: 'blue-fill', label: 'Fill\nBlue', enabled: true, directionScene: [0, -0, 4], colorLinearRGB: [-0, 0, 1], intensity: .25 }] };
const changed = clone(main); changed.revision = 1; changed.lights[0].intensity = .75;
const disabled = clone(changed); disabled.revision = 2; disabled.lights[0].enabled = false;
const removed = clone(disabled); removed.revision = 3; removed.lights.shift();
const empty = { ...clone(main), lights: [] };
const four = clone(main); four.ambientStrength = 1; four.lights.push({ nodeId: 'side-a', label: '', enabled: false, directionScene: [-1, 0, 0], colorLinearRGB: [1, 1, 1], intensity: 1 },
  { nodeId: 'side-b', label: 'Fourth', enabled: true, directionScene: [0, 1, 0], colorLinearRGB: [1, 1, 1], intensity: 1 });
const subnormal = { ...clone(main), lights: [{ nodeId: 'tiny', label: 'Original subnormal direction', enabled: true,
  directionScene: [Number.MIN_VALUE, -0, Number.MIN_VALUE], colorLinearRGB: [.2, .4, .6], intensity: 1 }] };
const nullRecords = Object.assign(Object.create(null), clone(main)); nullRecords.lights = nullRecords.lights.map(light => Object.assign(Object.create(null), light));
const normal = [1 / Math.sqrt(2), 0, 1 / Math.sqrt(2)];
// Independent ideal Number arithmetic reference. This function does not compile, execute or emulate a shader.
function normalResponse(result) { const out = [result.catalog.ambientStrength, result.catalog.ambientStrength, result.catalog.ambientStrength];
  for (const light of result.execution) if (light.enabled) { const dot = Math.max(0, light.unitDirection.reduce((sum, n, axis) => sum + n * normal[axis], 0));
    for (let axis = 0; axis < 3; axis++) out[axis] += light.colorLinearRGB[axis] * light.intensity * dot; } return out; }
const cases = [{ name: 'two_original_lights', request: main, response: [.1 + .5 / Math.sqrt(2), .1, .1 + .25 / Math.sqrt(2)] },
  { name: 'edit_stable_red_id', request: changed, response: [.1 + .75 / Math.sqrt(2), .1, .1 + .25 / Math.sqrt(2)] },
  { name: 'disable_retains_inventory', request: disabled, response: [.1, .1, .1 + .25 / Math.sqrt(2)] },
  { name: 'remove_retains_blue_identity', request: removed, response: [.1, .1, .1 + .25 / Math.sqrt(2)] },
  { name: 'zero_lights', request: empty, response: [.1, .1, .1] }, { name: 'four_including_disabled', request: four },
  { name: 'subnormal_original_direction', request: subnormal }, { name: 'own_null_prototype_records', request: nullRecords }];
let accepted = 0, refused = 0, getters = 0, reflections = 0, oversizedArrayEnumerations = 0;
const rows = [], coldCases = [];
for (const provider of providers) {
  const gpu = provider.gpu, records = [], failures = [], retained = [];
  assert.deepEqual(Object.keys(gpu.NativeDirectionalLightsDiagnosticCode).sort(), ['INPUT', 'VERSION', 'BUDGET', 'IDENTITY', 'NUMERICAL'].sort()); frozen(gpu.NativeDirectionalLightsDiagnosticCode);
  for (const c of cases) {
    const before = signed(c.request), result = gpu.prepareNativeDirectionalLights(c.request); assert.equal(signed(c.request), before); assert.equal(Object.isFrozen(c.request), false); independent(result, c.request);
    keys(result, ['catalog', 'execution']); keys(result.catalog, ['format', 'version', 'profile', 'sourceId', 'revision', 'ambientStrength', 'lights']); assert.deepEqual(result.catalog, clone(c.request));
    assert.equal(result.execution.length, c.request.lights.length); frozen(result); independent(result.catalog, result.execution); for (const earlier of retained) independent(result, earlier.result);
    for (let i = 0; i < c.request.lights.length; i++) { const source = c.request.lights[i], original = result.catalog.lights[i], execution = result.execution[i];
      keys(original, ['nodeId', 'label', 'enabled', 'directionScene', 'colorLinearRGB', 'intensity']); keys(execution, ['nodeId', 'enabled', 'unitDirection', 'colorLinearRGB', 'intensity']);
      assert.equal(execution.nodeId, source.nodeId); assert.equal(execution.enabled, source.enabled); assert.deepEqual(execution.colorLinearRGB, source.colorLinearRGB); assert.equal(execution.intensity, source.intensity); near(Math.hypot(...execution.unitDirection), 1);
      assert.notStrictEqual(original.directionScene, execution.unitDirection); assert.notStrictEqual(original.colorLinearRGB, execution.colorLinearRGB);
    }
    if (c.request === main || c.request === changed || c.request === disabled || c.request === nullRecords) { [1, 0, 0].forEach((n, axis) => near(result.execution[0].unitDirection[axis], n)); [0, 0, 1].forEach((n, axis) => near(result.execution[1].unitDirection[axis], n)); assert.ok(Object.is(result.catalog.lights[0].directionScene[1], -0)); assert.ok(Object.is(result.catalog.lights[0].colorLinearRGB[1], -0)); }
    if (c.request === disabled) assert.equal(result.catalog.lights.length, 2); if (c.request === removed) assert.deepEqual(result.execution.map(l => l.nodeId), ['blue-fill']);
    if (c.request === subnormal) { assert.equal(result.catalog.lights[0].directionScene[0], Number.MIN_VALUE); [1 / Math.sqrt(2), 0, 1 / Math.sqrt(2)].forEach((n, axis) => near(result.execution[0].unitDirection[axis], n)); }
    const response = normalResponse(result); if (c.response) c.response.forEach((n, axis) => near(response[axis], n));
    if (c.request === four) assert.ok(response[0] > 1, 'Catalog does not clamp aggregate Number reference response');
    const prefix = resolve(output, provider.label + '.' + c.name), requestPath = prefix + '.request.json', resultPath = prefix + '.result.json';
    const files = [await save(requestPath, before + '\n'), await save(resultPath, signed(result) + '\n')];
    const record = { provider: provider.label, name: c.name, requestPath, resultPath, files, digest: hash(signed(result)), response, inventory: result.execution.map(l => l.nodeId) };
    retained.push({ result, digest: record.digest, files }); records.push(record); coldCases.push(record); accepted++;
  }
  const mutateInput = clone(main), untouched = gpu.prepareNativeDirectionalLights(mutateInput); mutateInput.lights[0].directionScene[0] = 999; mutateInput.lights[0].colorLinearRGB[0] = .25;
  assert.equal(untouched.catalog.lights[0].directionScene[0], 2); assert.equal(untouched.execution[0].colorLinearRGB[0], 1); independent(untouched, retained[0].result); accepted++;
  const bad = (name, edit, code) => { const request = clone(main); edit(request); return { name, request, code }; };
  const checks = [bad('wrong_profile', r => r.profile = 'other', 'VERSION'), bad('extra_root_field', r => r.camera = {}, 'INPUT'),
    bad('wrong_light_kind', r => r.lights[0].kind = 'point', 'INPUT'), bad('duplicate_node_id', r => r.lights[1].nodeId = r.lights[0].nodeId, 'IDENTITY'),
    bad('invalid_source_id', r => r.sourceId = '!bad', 'IDENTITY'), bad('node_id49', r => r.lights[0].nodeId = 'n'.repeat(49), 'IDENTITY'),
    bad('label_UTF8_cap', r => r.lights[0].label = 'é'.repeat(65), 'BUDGET'), bad('wrong_enabled_type', r => r.lights[0].enabled = 1, 'INPUT'),
    bad('malformed_vector', r => r.lights[0].directionScene = [1, 0], 'INPUT'), bad('nonfinite_direction', r => r.lights[0].directionScene[0] = Infinity, 'NUMERICAL'),
    bad('zero_direction', r => r.lights[0].directionScene = [0, -0, 0], 'NUMERICAL'), bad('direction_range', r => r.lights[0].directionScene[0] = 1001, 'NUMERICAL'),
    bad('color_range', r => r.lights[0].colorLinearRGB[0] = 1.01, 'NUMERICAL'), bad('intensity_range', r => r.lights[0].intensity = 1.01, 'NUMERICAL'),
    bad('ambient_range', r => r.ambientStrength = -.1, 'NUMERICAL'), bad('revision_not_safe', r => r.revision = 9007199254740992, 'NUMERICAL'),
    bad('disabled_bad_direction', r => { r.lights[0].enabled = false; r.lights[0].directionScene = [0, 0, 0]; }, 'NUMERICAL'),
    bad('root_getter0', r => Object.defineProperty(r, 'lights', { enumerable: true, get() { getters++; return main.lights; } }), 'INPUT'),
    bad('light_getter0', r => Object.defineProperty(r.lights[0], 'intensity', { enumerable: true, get() { getters++; return .5; } }), 'INPUT'),
    bad('sparse_inventory', r => { r.lights.length = 3; }, 'INPUT')];
  const five = [...clone(main.lights), ...Array.from({ length: 3 }, (_, i) => ({ ...clone(main.lights[0]), nodeId: 'extra-' + i }))];
  checks.push({ name: 'count5_before_array_enumeration', request: { ...clone(main), lights: new Proxy(five, { ownKeys() { oversizedArrayEnumerations++; throw new Error('must not enumerate oversized inventory'); } }) }, code: 'BUDGET' });
  const marker = new Error('actual directional reflection marker');
  checks.push({ name: 'raw_root_reflection_cause', request: new Proxy(clone(main), { ownKeys() { reflections++; throw marker; } }), code: 'INPUT', exactCause: marker });
  async function retention() { assert.equal(getters, 0); assert.equal(oversizedArrayEnumerations, 0); for (const item of retained) { assert.equal(hash(signed(item.result)), item.digest); for (const file of item.files) assert.equal(hash(await readFile(file.path)), file.sha256); } }
  for (const c of checks) { let error; try { gpu.prepareNativeDirectionalLights(c.request); } catch (e) { error = e; } assert.ok(error instanceof gpu.NativeDirectionalLightsError, c.name); assert.equal(error.code, c.code, c.name); assert.ok(error.message.length <= 1024);
    if (c.exactCause) { assert.strictEqual(error.cause, c.exactCause); assert.ok(Object.hasOwn(error, 'cause')); }
    else { assert.equal(error.cause, undefined, 'No invented cause for ' + c.name); assert.equal(Object.hasOwn(error, 'cause'), false); }
    failures.push({ name: c.name, code: error.code, causeName: error.cause?.name ?? null, exactReflectionCause: Boolean(c.exactCause), priorFilesRetained: true }); refused++; await retention();
  }
  rows.push({ provider: provider.label, records, failures, noCallerFreeze: true, crossCatalogExecutionCopies: true });
}
for (let i = 0; i < cases.length; i++) assert.equal(rows[0].records[i].digest, rows[1].records[i].digest);
const coldCode = String.raw`
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
assert.equal(Number(process.versions.node.split('.')[0]),22);const cfg=JSON.parse(readFileSync(process.argv[2],'utf8')),hash=v=>createHash('sha256').update(v).digest('hex');
function signed(v){if(typeof v==='number')return Object.is(v,-0)?'-0':JSON.stringify(v);if(v===null||typeof v!=='object')return JSON.stringify(v);return Array.isArray(v)?'['+v.map(signed).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+signed(v[k])).join(',')+'}';}
const normal=[1/Math.sqrt(2),0,1/Math.sqrt(2)],rows=[];for(const provider of cfg.providers){const gpu=await import(pathToFileURL(provider.path).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);for(const c of cfg.cases.filter(c=>c.provider===provider.label)){for(const file of c.files)assert.equal(hash(readFileSync(file.path)),file.sha256);const request=JSON.parse(readFileSync(c.requestPath,'utf8')),before=signed(request),result=gpu.prepareNativeDirectionalLights(request);assert.equal(signed(request),before);assert.equal(hash(signed(result)),c.digest);assert.deepEqual(result,JSON.parse(readFileSync(c.resultPath,'utf8')));const response=[result.catalog.ambientStrength,result.catalog.ambientStrength,result.catalog.ambientStrength];for(const light of result.execution)if(light.enabled){const dot=Math.max(0,light.unitDirection.reduce((sum,n,axis)=>sum+n*normal[axis],0));for(let axis=0;axis<3;axis++)response[axis]+=light.colorLinearRGB[axis]*light.intensity*dot;}response.forEach((n,axis)=>assert.ok(Math.abs(n-c.response[axis])<=1e-14));rows.push({provider:provider.label,name:c.name,digest:c.digest,response});}}
console.log(JSON.stringify({node:process.version,pid:process.pid,ppid:process.ppid,rows,parentPreparedAuthority:false,CPUReferenceOnly:true,actualGL:false}));
`;
const coldPath = resolve(output, 'cold-complete-directional-requests.mjs'), configPath = resolve(output, 'cold-config.json'); await writeFile(coldPath, coldCode, { flag: 'wx' });
await writeFile(configPath, JSON.stringify({ providers: providers.map(({ label, path }) => ({ label, path })), namespace, cases: coldCases }, null, 2) + '\n', { flag: 'wx' });
const stdout = execFileSync(process.execPath, [coldPath, configPath], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }); await writeFile(resolve(output, 'cold.stdout'), stdout, { flag: 'wx' }); const cold = JSON.parse(stdout);
assert.notEqual(cold.pid, process.pid); assert.equal(cold.ppid, process.pid); assert.equal(cold.rows.length, cases.length * providers.length);
for (const c of coldCases) for (const file of c.files) assert.equal(hash(await readFile(file.path)), file.sha256);
const report = { issue: 1472, stage: 'NATIVE_DIRECTIONAL_LIGHT_CATALOG_CPU', parent, node: process.version, accepted, refused, getters, reflections, oversizedArrayEnumerations,
  namespaceCount: namespace.length, namespace, sourceGraph, rows, cold, ordinary: await receipt(ordinary), emitted: await receipt(providers[1].path),
  publicCompatibility: { oldRuntimeCount: 131, runtimeAdditions, fourTypes, diagnosticCodeTypeAlias: true, oldBarrelPrefixPreserved: true, manifestUnchanged: true, meshLightingAndShadersByteUnchanged: true },
  CPUReferenceOnly: true, finalSerializationOverflowForced: false, actualGL: false, frameAdmission: false, nativeTENJoin: false,
  support: 'Authored ordered light identities and original signed Number values versus copied frozen normalized execution, stable edits/disable/remove, zero/four/subnormal admission, complete signed-file fresh-process re-admission and retained refusals. No linked shader, light upload, photometry/clamping/pixels, Viewer/Render state or publication claim.' };
const resultPath = resolve(output, 'actual-result.json'); await writeFile(resultPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ issue: 1472, accepted, refused, getters, reflections, oversizedArrayEnumerations, exports: namespace.length, coldRows: cold.rows.length, result: await receipt(resultPath), actualGL: false }));
