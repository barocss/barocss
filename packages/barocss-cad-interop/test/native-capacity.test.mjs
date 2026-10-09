import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { compileCadModel, sampleCurveAdaptive, sampleCurveWideAdaptive, tessellateSurface } from '@barocss/cad';
import {
  BaroCadSourceError, baroCadSourceToGLB, loadBaroCadSource,
  parseBaroCadSource, validateBaroCadParseOptions,
} from '../dist/native.js';
import { parseBaroCadDocument, prepareBaroCadDocumentPrimitiveNativeRefsV2 } from '../dist/document.js';
import { loadBaroCadModelSet, prepareBaroCadModelSetPrimitiveNativeRefsV2 } from '../dist/model-set.js';

const base = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001 };
const capacity = { version: 1, maximumObjects: 16 };
const display = { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 };
const options = () => ({ ...base, nativeCapacity: { ...capacity }, curveDisplay: { ...display } });
const example = name => readFileSync(new URL(`../examples/${name}`, import.meta.url), 'utf8');
const curve = (id, index = 0) => `@curve #${id} {type:nurbs;degree:1;knots:[-2,-2,3,3];control-points:[[${index},-0,0],[${index + 1},1,0]];weights:[1,1];}`;
const surface = (id, index = 0) => `@surface #${id} {type:nurbs;degree-u:1;degree-v:1;knots-u:[-2,-2,3,3];knots-v:[5,5,9,9];control-points:[[[${index},-0,0],[${index},0,1]],[[${index + 1},0,0],[${index + 1},0,1]]];weights:[[1,1],[1,1]];}`;
const source = declarations => `@model capacity_input {version:0;length-unit:mm;${declarations.join('\n')}}`;
const generated = (count, kind) => source(Array.from({ length: count }, (_, index) =>
  kind === 'surface' || kind === 'mixed' && index % 2 === 0 ? surface(`surface_${index}`, index) : curve(`curve_${index}`, index)));
const fullFiveCurve = example('linear-geometry-pattern-babylon-data/five_quarter_x_copies.barocad');
const fullFiveSurface = example('linear-geometry-pattern-babylon-data/maximum16_by16_surface_five_instances.barocad');

function compareNativeAndBuffers(text, parsed, request) {
  const compiled = compileCadModel(text, { sourceVersion: 0 });
  assert.equal(compiled.ok, true);
  assert.equal(parsed.source, text);
  assert.deepEqual(parsed.model, compiled.model);
  assert.deepEqual(parsed.diagnostics, []);
  for (const preview of parsed.surfaces) {
    const native = compiled.model.objects.find(value => value.id === preview.surfaceId);
    const direct = tessellateSurface(native, { countU: request.countU, countV: request.countV, revision: 0 });
    assert.deepEqual(preview.packet, direct.packet);
    assert.deepEqual(preview.report, direct.report);
    assert.deepEqual(Array.from(preview.mesh.positions), Array.from(direct.packet.positions, value => Math.fround(value * request.unitsPerMillimeter)));
    assert.deepEqual(Array.from(preview.mesh.parameters), Array.from(direct.packet.parameters, Math.fround));
  }
  for (const preview of parsed.curves) {
    const index = compiled.model.objects.findIndex(value => value.id === preview.curveId);
    const native = compiled.model.objects[index];
    const wide = 'version' in request.curveDisplay;
    const direct = (wide ? sampleCurveWideAdaptive : sampleCurveAdaptive)(native, {
      chordToleranceMM: request.curveDisplay.chordToleranceMM,
      maxSegments: request.curveDisplay.maxSegments,
      maxDepth: request.curveDisplay.maxDepth,
      resultIdPrefix: `bcv${wide ? 1 : 0}c${index}`,
    });
    assert.deepEqual(preview.sample, direct);
    assert.deepEqual(Array.from(preview.positions), direct.pointsMM.flat().map(value => Math.fround(value * request.unitsPerMillimeter)));
  }
}

test('omission preserves legacy Surface-only admission and unrendered native Curves', () => {
  assert.throws(() => validateBaroCadParseOptions({ ...base, unknown: 0 }), {
    name: 'TypeError', message: 'BaroCAD options require sourceVersion, countU, countV, unitsPerMillimeter and optional curveDisplay only',
  });
  const text = source([surface('panel'), ...Array.from({ length: 15 }, (_, index) => curve(`edge_${index}`, index))]);
  const legacy = parseBaroCadSource(text, base);
  const expanded = parseBaroCadSource(text, { ...base, nativeCapacity: capacity });
  assert.deepEqual(expanded, legacy);
  assert.equal(legacy.model.objects.length, 16);
  assert.equal(legacy.surfaces.length, 1);
  assert.equal(legacy.curves.length, 0);
  assert.equal(legacy.unrenderedCurveIds.length, 15);
  assert.throws(() => parseBaroCadSource(text, { ...base, curveDisplay: display }), /1\.\.4 total native objects/);
  assert.throws(() => parseBaroCadSource(fullFiveSurface, base), /1\.\.4 native surfaces/);
  assert.throws(() => parseBaroCadSource(fullFiveCurve, base), /1\.\.4 native surfaces/);
  assert.throws(() => parseBaroCadSource(fullFiveCurve, { ...base, nativeCapacity: capacity }), /Curve-only display requires curveDisplay/);
  const small = example('curve-display.barocad');
  for (const request of [base, { ...base, curveDisplay: display }, { ...base, curveDisplay: { chordToleranceMM: 0.1, maxSegments: 128, maxDepth: 16 } }]) {
    assert.deepEqual(parseBaroCadSource(small, request), parseBaroCadSource(small, { ...request, nativeCapacity: capacity }));
  }
});

test('capacity accepts plain or null-prototype own data and creates independent snapshots', () => {
  const input = options();
  const before = structuredClone(input);
  const result = validateBaroCadParseOptions(input);
  assert.deepEqual(input, before);
  assert.notEqual(result, input);
  assert.notEqual(result.nativeCapacity, input.nativeCapacity);
  assert.notEqual(result.curveDisplay, input.curveDisplay);
  input.nativeCapacity.version = 9;
  input.nativeCapacity.maximumObjects = 4;
  input.curveDisplay.maxSegments = 1;
  assert.deepEqual(result.nativeCapacity, capacity);
  assert.equal(result.curveDisplay.maxSegments, 512);
  const nullProfile = Object.assign(Object.create(null), capacity);
  assert.deepEqual(validateBaroCadParseOptions({ ...base, nativeCapacity: nullProfile }).nativeCapacity, capacity);
  const frozen = Object.freeze({ ...base, nativeCapacity: Object.freeze({ ...capacity }) });
  assert.deepEqual(validateBaroCadParseOptions(frozen).nativeCapacity, capacity);
});

test('capacity refuses malformed profiles without evaluating accessors', () => {
  let reads = 0;
  const getter = { maximumObjects: 16, get version() { reads++; return 1; } };
  const hidden = Object.defineProperty({ version: 1 }, 'maximumObjects', { value: 16 });
  const symbol = { ...capacity, [Symbol('extra')]: 0 };
  const bad = [null, undefined, [], new (class Profile { version = 1; maximumObjects = 16; })(),
    {}, { version: 1 }, { maximumObjects: 16 }, { ...capacity, extra: 0 }, hidden, symbol, getter,
    { version: 0, maximumObjects: 16 }, { version: 1, maximumObjects: 4 },
    { version: '1', maximumObjects: 16 }, { version: 1, maximumObjects: NaN },
    Object.create(capacity)];
  for (const value of bad) assert.throws(() => validateBaroCadParseOptions({ ...base, nativeCapacity: value }), /nativeCapacity/);
  const outer = { ...base, get nativeCapacity() { reads++; return capacity; } };
  assert.throws(() => validateBaroCadParseOptions(outer), /nativeCapacity must be data/);
  assert.equal(reads, 0);
});

for (const kind of ['surface', 'curve', 'mixed']) {
  test(`caller-authored saved ${kind} source retains all sixteen native objects`, () => {
    // These are authored capacity inputs, not CAD operation receipts.
    const directory = mkdtempSync(join(tmpdir(), 'barocad-capacity-'));
    try {
      const file = join(directory, `${kind}-sixteen.barocad`);
      writeFileSync(file, generated(16, kind));
      const text = readFileSync(file, 'utf8');
      const request = { ...options(), countU: 17, countV: 17 };
      const parsed = parseBaroCadSource(text, request);
      assert.equal(parsed.model.objects.length, 16);
      assert.equal(parsed.surfaces.length + parsed.curves.length, 16);
      assert.deepEqual(parsed.unrenderedCurveIds, []);
      compareNativeAndBuffers(text, parsed, request);
      const first = parsed.model.objects[0];
      assert.ok(Object.is(first.kind === 'surface' ? first.controlPoints[0][0][1] : first.controlPoints[0][1], -0));
      const totals = parsed.surfaces.reduce((sum, item) => ({ vertices: sum.vertices + item.report.vertexCount, triangles: sum.triangles + item.report.triangleCount, indices: sum.indices + item.mesh.indices.length }), { vertices: 0, triangles: 0, indices: 0 });
      if (kind === 'surface') assert.deepEqual(totals, { vertices: 4624, triangles: 8192, indices: 24576 });
      else assert.ok(totals.vertices <= 4624 && totals.triangles <= 8192 && totals.indices <= 24576);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
}

test('seventeen declarations preserve original compiler diagnostics', () => {
  const text = generated(17, 'surface');
  const compiled = compileCadModel(text, { sourceVersion: 0 });
  assert.equal(compiled.ok, false);
  assert.throws(() => parseBaroCadSource(text, options()), error => {
    assert.ok(error instanceof BaroCadSourceError);
    assert.deepEqual(error.diagnostics, compiled.diagnostics);
    assert.ok(error.diagnostics[0].range.line > 0);
    return true;
  });
});

test('source byte capacity preserves original compiler diagnostics', () => {
  const text = ' '.repeat(262145) + generated(1, 'surface');
  const compiled = compileCadModel(text, { sourceVersion: 0 });
  assert.equal(compiled.ok, false);
  assert.throws(() => parseBaroCadSource(text, options()), error => {
    assert.ok(error instanceof BaroCadSourceError);
    assert.deepEqual(error.diagnostics, compiled.diagnostics);
    return true;
  });
});

test('integrated linear and circular complete five-member files are admitted only explicitly', () => {
  const manifest = JSON.parse(example('native-capacity-data/manifest.json'));
  assert.equal(manifest.cases.length, 4);
  for (const item of manifest.cases) {
    const text = example(`native-capacity-data/${item.file}`);
    assert.equal(Buffer.byteLength(text), item.sourceBytes);
    assert.equal(createHash('sha256').update(text).digest('hex'), item.sourceSha256);
    assert.throws(() => parseBaroCadSource(text, { ...base, curveDisplay: display }), /1\.\.4 total native objects/);
    const request = options();
    const parsed = parseBaroCadSource(text, request);
    assert.equal(parsed.model.objects.length, 5);
    assert.deepEqual(parsed.model.objects.map(value => value.id), item.ids);
    assert.equal(item.kind === 'curve' ? parsed.curves.length : parsed.surfaces.length, 5);
    compareNativeAndBuffers(text, parsed, request);
  }
});

test('existing aggregate Curve capacity, source-index prefixes and Float32 refusals remain active', () => {
  const quarter = example('curve-only.barocad');
  const declaration = quarter.match(/@curve[\s\S]*?\n  }/)[0];
  const sixteen = source(Array.from({ length: 16 }, (_, index) => declaration.replace('#weighted_quarter', `#quarter_${index}`)));
  const request = { ...options(), curveDisplay: { ...display, chordToleranceMM: 0.0001, maxSegments: 4092 } };
  assert.throws(() => parseBaroCadSource(sixteen, request), /exceeds total sample capacity/);
  const colliding = generated(16, 'mixed').replace('#curve_15', '#bcv1c15_owned');
  assert.throws(() => parseBaroCadSource(colliding, options()), /prefix bcv1c15 conflicts/);
  const v0 = { ...options(), curveDisplay: { chordToleranceMM: 0.1, maxSegments: 128, maxDepth: 16 } };
  assert.throws(() => parseBaroCadSource(generated(16, 'curve').replace('#curve_15', '#bcv0c15'), v0), /prefix bcv0c15 conflicts/);
  for (const scale of [1e39, 1e-50]) assert.throws(() => parseBaroCadSource(generated(16, 'curve'), { ...options(), unitsPerMillimeter: scale }), /Float32/);
  const collapsed = source(['@curve #tiny {type:nurbs;degree:1;knots:[0,0,1,1];control-points:[[9999,0,0],[9999.000001,0,0]];weights:[1,1];}']);
  assert.throws(() => parseBaroCadSource(collapsed, options()), /collapsed Float32/);
});

test('neutral HTTP loading snapshots nested profile before fetch and refuses invalid profile before a request', async () => {
  let requests = 0;
  const server = createServer((request, response) => { requests++; response.writeHead(200, { 'content-type': 'text/plain' }).end(fullFiveCurve); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const url = `http://127.0.0.1:${server.address().port}/five.barocad`;
    const request = options();
    const pending = loadBaroCadSource(url, request);
    request.nativeCapacity.maximumObjects = 4;
    request.nativeCapacity.version = 9;
    request.curveDisplay.maxSegments = 1;
    const loaded = await pending;
    assert.equal(loaded.source, fullFiveCurve);
    assert.equal(loaded.model.objects.length, 5);
    assert.equal(loaded.curves.length, 5);
    assert.equal(requests, 1);
    await assert.rejects(loadBaroCadSource(url, { ...base, nativeCapacity: { version: 1, maximumObjects: 4 } }), /nativeCapacity/);
    assert.equal(requests, 1);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('GLB and independent document/model-set wrapper limits remain four', async () => {
  assert.throws(() => baroCadSourceToGLB(fullFiveCurve, options(), { includeSourceText: true }), /GLB requires 1\.\.4 total native objects/);
  const four = generated(4, 'curve');
  assert.ok(baroCadSourceToGLB(four, options(), { includeSourceText: false }).byteLength > 0);
  const document = JSON.parse(example('document-gpu-v2.cad-document.json'));
  document.assets = [{ ...document.assets[0], source: fullFiveCurve }];
  const ids = compileCadModel(fullFiveCurve, { sourceVersion: 0 }).model.objects.map(value => value.id);
  document.bodies = ids.map((geometryId, index) => ({ id: `body_${index}`, name: `Member ${index}`, kind: 'direct-geometry-object', assetId: document.assets[0].id, geometryId }));
  const parsed = parseBaroCadDocument(JSON.stringify(document));
  const wrapperOptions = { native: options(), basis: 'authored-xyz-matches-rhyup' };
  assert.throws(() => prepareBaroCadDocumentPrimitiveNativeRefsV2(parsed, wrapperOptions), /more than four bodies require explicit bodyIds/);
  assert.throws(() => prepareBaroCadDocumentPrimitiveNativeRefsV2(parsed, { ...wrapperOptions, bodyIds: document.bodies.map(value => value.id) }), /1\.\.4 IDs/);
  const selected = prepareBaroCadDocumentPrimitiveNativeRefsV2(parsed, { ...wrapperOptions, bodyIds: document.bodies.slice(0, 4).map(value => value.id) });
  assert.equal(selected.length, 4);
  assert.deepEqual(selected.map(value => value.ref.geometryId), ids.slice(0, 4));
  const entries = Array.from({ length: 5 }, (_, index) => ({ aliasId: `asset_${index}`, url: `https://example.invalid/${index}.barocad`, options: options() }));
  await assert.rejects(loadBaroCadModelSet({ format: 'barocad-model-set', version: 0, entries }), /1\.\.4 entries/);
  const set = { format: 'barocad-model-set', version: 0, totalLoadedBytes: Buffer.byteLength(fullFiveCurve), entries: [{ aliasId: 'asset_0', url: 'https://example.invalid/0.barocad', result: parseBaroCadSource(fullFiveCurve, options()) }] };
  assert.throws(() => prepareBaroCadModelSetPrimitiveNativeRefsV2(set), /at most four total native objects/);
});
