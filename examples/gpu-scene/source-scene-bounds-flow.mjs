/** #1320: original Source1/2 Number-space primitive box bounds.
 * node examples/gpu-scene/source-scene-bounds-flow.mjs --output <fresh-directory>
 * CPU source/API/file only; no pixel/culling/framing/numerical enclosure certificate.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { controls } from './source-scene-bounds-controls.mjs';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const at = process.argv.indexOf('--output');
assert(at >= 0 && process.argv[at + 1], '--output <fresh-directory> is required');
const output = resolve(process.argv[at + 1]); await mkdir(output, { recursive: false });
const pkg = resolve(repo, 'packages/barocss-gpu');
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const published = manifest.publishConfig.exports['.'];
const ordinary = resolve(output, 'ordinary-source.mjs');
const built = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true,
  platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const graph = Object.keys(built.metafile.inputs);
assert(graph.some(p => p.endsWith('/src/source-scene-bounds.ts')));
assert(!graph.some(p => /barocss-(gpu|cad)\/dist\//.test(p)));
const ordinaryURL = pathToFileURL(ordinary).href, emittedURL = pathToFileURL(resolve(pkg, published.import)).href;
const providers = [['ordinary-source', await import(ordinaryURL), ordinaryURL],
  ['emitted-public', await import(emittedURL), emittedURL]];
assert.deepEqual(Object.keys(providers[0][1]).sort(), Object.keys(providers[1][1]).sort());
assert.equal(Object.keys(providers[0][1]).length, 102);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function receipt(path) { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }
const declarationPath = resolve(pkg, published.types), declaration = await readFile(declarationPath, 'utf8');
for (const name of ['SourceSceneBoundsRequest', 'SourceSceneBoundsBox', 'SourceSceneObjectBounds',
  'PreparedSourceSceneBounds', 'SourceSceneBoundsDiagnosticCode']) assert(new RegExp('\\b' + name + '\\b').test(declaration));
function json(value) {
  if (typeof value === 'number') { assert(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(json).join(',') + ']';
  return '{' + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, child]) => JSON.stringify(key) + ':' + json(child)).join(',') + '}';
}
const clone = value => JSON.parse(json(value));
function frozen(value) { if (value && typeof value === 'object') {
  assert(Object.isFrozen(value)); for (const child of Object.values(value)) frozen(child);
} }
function near(actual, expected, tolerance = 0) {
  assert(Number.isFinite(actual)); assert(Math.abs(actual - expected) <= tolerance,
    `actual ${actual}; expected ${expected}; tolerance ${tolerance}`);
}
function expectedBox(actual, expected, tolerance) {
  if (expected === null) { assert.equal(actual, null); return; }
  assert.deepEqual(Object.keys(actual).sort(), ['max', 'min']);
  for (const field of ['min', 'max']) { assert.equal(actual[field].length, 3);
    actual[field].forEach((n, i) => near(n, expected[field][i], tolerance)); }
}
let accepted = 0, refused = 0, getterCalls = 0, reflectionTraps = 0, oversizeOwnKeys = 0;
const results = [];
for (const [provider, gpu, entryURL] of providers) {
  const coldURL = new URL(entryURL); coldURL.searchParams.set('source_scene_bounds_cold', '1');
  const coldGpu = await import(coldURL.href);
  assert.notStrictEqual(coldGpu, gpu);
  assert.notStrictEqual(coldGpu.prepareSourceSceneBounds, gpu.prepareSourceSceneBounds);
  assert.deepEqual(Object.keys(coldGpu).sort(), Object.keys(gpu).sort());
  assert.equal(typeof gpu.prepareSourceSceneBounds, 'function'); assert.equal(typeof gpu.SourceSceneBoundsError, 'function');
  assert(Object.isFrozen(gpu.SourceSceneBoundsDiagnosticCode));
  assert.deepEqual(Object.keys(gpu.SourceSceneBoundsDiagnosticCode).sort(), ['INPUT', 'VERSION', 'BUDGET', 'SOURCE', 'SELECTION', 'NUMERICAL'].sort());
  const acceptance = [], refusals = [];
  function verify(input, result) {
    assert.deepEqual(Object.keys(result).sort(), ['format', 'version', 'profile', 'coordinateSystem', 'positionUnit',
      'numericPolicy', 'sourceVersion', 'source', 'scene', 'selection', 'objects', 'bounds'].sort());
    assert.equal(result.format, 'barocss-gpu-source-scene-bounds'); assert.equal(result.version, 0);
    assert.equal(result.profile, 'original-number-box-corners-v0');
    assert.equal(result.coordinateSystem, 'right-handed-y-up'); assert.equal(result.positionUnit, 'scene');
    assert.equal(result.numericPolicy, 'binary64-box-corners-no-padding');
    assert.equal(result.sourceVersion, input.sourceVersion); assert.equal(result.source, input.source);
    assert.deepEqual(result.selection, Object.hasOwn(input, 'objectIds') ? input.objectIds : null);
    if (Array.isArray(result.selection)) assert.notStrictEqual(result.selection, input.objectIds);
    assert.equal(result.scene.version, input.sourceVersion); frozen(result);
    const selected = result.scene.objects.filter(o => !Object.hasOwn(input, 'objectIds') || input.objectIds.includes(o.id));
    assert.deepEqual(result.objects.map(o => o.objectId), selected.map(o => o.id));
    for (const object of result.objects) assert.deepEqual(Object.keys(object).sort(), ['kind', 'localBounds', 'objectId', 'worldBounds']);
  }
  for (const control of controls) {
    const input = clone(control.request), before = json(input), result = gpu.prepareSourceSceneBounds(input);
    verify(input, result); assert.equal(json(input), before);
    assert.equal(result.objects.length, control.expected.objects.length);
    result.objects.forEach((object, i) => { const expected = control.expected.objects[i];
      assert.equal(object.objectId, expected.objectId); assert.equal(object.kind, expected.kind);
      expectedBox(object.localBounds, expected.localBounds, control.tolerance);
      expectedBox(object.worldBounds, expected.worldBounds, control.tolerance); });
    expectedBox(result.bounds, control.expected.bounds, control.tolerance);
    const requestPath = resolve(output, provider + '.' + control.name + '.request.json');
    const sourcePath = resolve(output, provider + '.' + control.name + '.source.css');
    const resultPath = resolve(output, provider + '.' + control.name + '.result.json');
    await writeFile(requestPath, json(input) + '\n'); await writeFile(sourcePath, input.source);
    await writeFile(resultPath, json(result) + '\n');
    const coldInput = JSON.parse(await readFile(requestPath, 'utf8'));
    assert.equal(coldInput.source, await readFile(sourcePath, 'utf8'));
    const cold = coldGpu.prepareSourceSceneBounds(coldInput); verify(coldInput, cold);
    assert.deepEqual(cold, result); assert.deepEqual(JSON.parse(await readFile(resultPath, 'utf8')), result);
    assert.notStrictEqual(cold.scene, result.scene); assert.notStrictEqual(cold.scene.objects, result.scene.objects);
    assert.notStrictEqual(cold.scene.background, result.scene.background);
    assert.notStrictEqual(cold.objects, result.objects);
    for (let i = 0; i < result.scene.objects.length; i++) {
      assert.notStrictEqual(cold.scene.objects[i], result.scene.objects[i]);
      for (const field of ['color', 'translate', 'size', 'rotateDegrees', ...(input.sourceVersion === 2 ? ['scaleXYZ'] : []), ...('start' in result.scene.objects[i] ? ['start', 'end'] : [])])
        assert.notStrictEqual(cold.scene.objects[i][field], result.scene.objects[i][field]);
    }
    for (let i = 0; i < result.objects.length; i++) {
      assert.notStrictEqual(cold.objects[i], result.objects[i]);
      for (const field of ['localBounds', 'worldBounds']) for (const edge of ['min', 'max'])
        assert.notStrictEqual(cold.objects[i][field][edge], result.objects[i][field][edge]);
    }
    if (Array.isArray(result.selection)) assert.notStrictEqual(cold.selection, result.selection);
    if (result.bounds) assert.notStrictEqual(cold.bounds.min, result.bounds.min);
    accepted++; acceptance.push({ name: control.name, sourceVersion: input.sourceVersion,
      selectedIds: result.objects.map(o => o.objectId), corners: result.objects.length * 8,
      expected: control.expected, bounds: result.bounds, resultSHA256: hash(json(result)),
      files: await Promise.all([requestPath, sourcePath, resultPath].map(receipt)) });
  }
  const basicSource = '// original 😀 source and signed -0\n@scene bounds { version:1; sphere #s; box #b; }\n#s { radius:1; translate:-0 0 0; } #b { size:2 4 6; translate:3 0 0; }';
  const basic = { sourceVersion: 1, source: basicSource, objectIds: ['b', 's'] };
  const previous = gpu.prepareSourceSceneBounds(basic); verify(basic, previous);
  assert.deepEqual(previous.objects.map(o => o.objectId), ['s', 'b']);
  assert.equal(previous.scene.objects[0].translate[0], 0); assert(!Object.is(previous.scene.objects[0].translate[0], -0));
  const nullProto = Object.assign(Object.create(null), basic);
  const nullResult = gpu.prepareSourceSceneBounds(nullProto); assert.deepEqual(nullResult, previous); accepted++;
  const caller = clone(basic), owned = gpu.prepareSourceSceneBounds(caller);
  caller.source = 'changed'; caller.objectIds[0] = 'changed'; assert.deepEqual(owned, previous);
  const file = resolve(output, provider + '.retained-request.json');
  await writeFile(file, json(basic) + '\n'); const saved = await readFile(file), retained = json(previous), original = json(basic);
  const failures = [];
  const add = (name, input, code, more = {}) => failures.push({ name, input, code, ...more });
  for (const value of [0, 3, '1', null]) add('version_' + String(value), { ...basic, sourceVersion: value }, 'VERSION');
  add('missing_source', { sourceVersion: 1 }, 'INPUT'); add('nonstring_source', { ...basic, source: {} }, 'INPUT');
  add('extra_field', { ...basic, extra: 1 }, 'INPUT'); add('foreign_root', Object.assign(Object.create({}), basic), 'INPUT');
  const hidden = { ...basic }; Object.defineProperty(hidden, 'extra', { value: 1 }); add('hidden_root', hidden, 'INPUT');
  add('symbol_root', { ...basic, [Symbol('extra')]: 1 }, 'INPUT');
  const accessor = { ...basic }; Object.defineProperty(accessor, 'source', { enumerable: true,
    get() { getterCalls++; return basicSource; } }); add('source_getter', accessor, 'INPUT');
  const idAccessor = { ...basic }; Object.defineProperty(idAccessor, 'objectIds', { enumerable: true,
    get() { getterCalls++; return ['s']; } }); add('selection_getter', idAccessor, 'INPUT');
  add('unknown_id', { ...basic, objectIds: ['missing'] }, 'SELECTION');
  add('duplicate_id', { ...basic, objectIds: ['s', 's'] }, 'SELECTION');
  for (const id of ['', 'bad id', 'a'.repeat(49), '#s', 1]) add('malformed_id_' + String(id), { ...basic, objectIds: [id] }, 'SELECTION');
  add('selection_typed', { ...basic, objectIds: new Uint8Array([1]) }, 'INPUT');
  add('selection_foreign', { ...basic, objectIds: Object.assign(Object.create({}), { 0: 's', length: 1 }) }, 'INPUT');
  add('selection_sparse', { ...basic, objectIds: new Array(1) }, 'INPUT');
  const hiddenArray = ['s']; Object.defineProperty(hiddenArray, 'extra', { value: 1 }); add('selection_hidden', { ...basic, objectIds: hiddenArray }, 'INPUT');
  const symbolArray = ['s']; symbolArray[Symbol('extra')] = 1; add('selection_symbol', { ...basic, objectIds: symbolArray }, 'INPUT');
  const arrayGetter = ['s']; Object.defineProperty(arrayGetter, '0', { enumerable: true,
    get() { getterCalls++; return 's'; } }); add('selection_element_getter', { ...basic, objectIds: arrayGetter }, 'INPUT');
  const oversized = new Proxy(new Array(33), { ownKeys() { oversizeOwnKeys++; throw new Error('Oversized selection must not enumerate'); } });
  add('selection33_before_keys', { ...basic, objectIds: oversized }, 'BUDGET');
  const trap = new Error('Actual original bounds reflection trap');
  add('actual_root_reflection', new Proxy(basic, { ownKeys() { reflectionTraps++; throw trap; } }), 'INPUT', { cause: trap });
  add('codeunit_budget', { ...basic, source: 'x'.repeat(65537) }, 'BUDGET');
  add('UTF8_budget', { ...basic, source: '// ' + '😀'.repeat(16384) }, 'BUDGET');
  const badRadius = basicSource.replace('radius:1;', 'radius:0;');
  add('actual_Source1_semantic_cause', { ...basic, source: badRadius }, 'SOURCE',
    { diagnosticSource: badRadius, span: '0', start: badRadius.indexOf('radius:0;') + 'radius:'.length, causeKind: 'list' });
  const badScale = '@scene bad { version:2; sphere #s; } #s { scale:0 1 1; }';
  add('actual_Source2_semantic_cause', { sourceVersion: 2, source: badScale }, 'SOURCE',
    { diagnosticSource: badScale, span: '0', start: badScale.indexOf('scale:0') + 'scale:'.length, causeKind: 'SceneError' });
  add('selected_version_header_mismatch', { ...basic, source: basicSource.replace('version:1;', 'version:0;') }, 'SOURCE');
  add('full_source_before_unknown_selection', { ...basic, source: badRadius, objectIds: ['missing'] }, 'SOURCE');
  for (const { name, input, code, cause, diagnosticSource, span, start, causeKind } of failures) {
    let error; try { gpu.prepareSourceSceneBounds(input); } catch (e) { error = e; }
    assert(error instanceof gpu.SourceSceneBoundsError, name + ' actual public error');
    assert.equal(error.code, code, name); assert.equal(error.name, 'SourceSceneBoundsError');
    assert(error.message.length <= 1024);
    if (cause) assert.strictEqual(error.cause, cause);
    let sourceDiagnostic = null;
    if (causeKind === 'list') { assert(Array.isArray(error.cause)); sourceDiagnostic = error.cause[0];
      assert.equal(sourceDiagnostic.range.start, start); assert.equal(sourceDiagnostic.range.end, start + span.length); }
    if (causeKind === 'SceneError') { assert(error.cause instanceof gpu.SceneError); sourceDiagnostic = error.cause.diagnostics[0];
      assert.equal(sourceDiagnostic.start, start); assert.equal(sourceDiagnostic.end, start + span.length); }
    if (diagnosticSource) {
      assert.equal(diagnosticSource.slice(start, start + span.length), span);
      const range = causeKind === 'list' ? sourceDiagnostic.range : sourceDiagnostic;
      const prefix = diagnosticSource.slice(0, start);
      assert.equal(range.line, prefix.split('\n').length);
      assert.equal(range.column, start - prefix.lastIndexOf('\n'));
    }
    assert.equal(getterCalls, 0); assert.equal(oversizeOwnKeys, 0);
    assert.equal(json(previous), retained); assert.equal(json(basic), original); assert.deepEqual(await readFile(file), saved);
    refused++; refusals.push({ name, code, message: error.message, sourceDiagnostic,
      actualCauseRetained: !!error.cause, previousResultAndSourceFileRetained: true });
  }
  results.push({ provider, exports: Object.keys(gpu).sort(), acceptance, refusals,
    coldModuleEntry: coldURL.href, independentColdPublicModule: true, coldModuleReentry: true,
    nullPrototypeRequestAccepted: true, retainedFile: await receipt(file), finalResultSHA256: hash(retained) });
}
assert.equal(results[0].finalResultSHA256, results[1].finalResultSHA256);
const report = { issue: 1320, stage: 'CPU-original-source-binary64-box-corners', accepted, refused,
  getterCalls, reflectionTraps, oversizeOwnKeys, actualGL: false, sourceGraph: graph,
  source: await receipt(resolve(pkg, 'src/source-scene-bounds.ts')), controls: await receipt(resolve(repo, 'examples/gpu-scene/source-scene-bounds-controls.mjs')),
  ordinary: await receipt(ordinary), emitted: await receipt(resolve(pkg, published.import)), declarations: await receipt(declarationPath), results,
  support: 'Actual Source1/2 full original reconstruction, Number local-box bounds and eight transformed corners, source-order selections and frozen copied results/files. Independent closed-form controls from the separate control module; source-provider causes and first failures preserved. No Float32/padding/certified rounding enclosure, ideal exact native extrema, camera framing, pixels, culling, animation, overflow fabrication, performance or publication proof.' };
const resultPath = resolve(output, 'actual-result.json'); await writeFile(resultPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ issue: 1320, accepted, refused, getterCalls, reflectionTraps, oversizeOwnKeys,
  exports: results[0].exports.length, resultSHA256: (await receipt(resultPath)).sha256, actualGL: false }));
