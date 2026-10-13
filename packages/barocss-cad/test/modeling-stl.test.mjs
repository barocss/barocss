import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// Admission/routing controls only. EVERY geometry/compiler/export provider is
// replaced before importing the actual modeling module. The inert construction
// and export data below are deliberately not geometric evidence.
// CAD_MODEL_STL_ENTRY names the actual src/modeling.ts or dist/modeling.js;
// default: emitted dist/modeling.js. CAD_MODEL_TEST_MODULE is deliberately
// ignored: a prebundled index has already erased the provider import boundary.
const entry = resolve(process.env.CAD_MODEL_STL_ENTRY ?? fileURLToPath(new URL('../dist/modeling.js', import.meta.url)));
assert.match(basename(entry), /^modeling\.(?:ts|js)$/, 'Use an actual source or emitted modeling entry');
const mode = extname(entry) === '.ts' ? 'source' : 'emitted';
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? fileURLToPath(new URL('../../..', import.meta.url)), 'package.json'));
const { build } = require('esbuild');
const trapKey = Symbol.for('barocss.modeling-stl.admission-trap');
assert.equal(globalThis[trapKey], undefined, 'The isolated trap must not replace an existing run');
const providers = new Map([
  ['xy-arc', 'buildXYArc'], ['xy-circle-prism-shell', 'buildXYCirclePrismShell'], ['stored-circle-prism-solid', 'qualifyStoredCirclePrismSolid'],
  ['xy-affine-sketch', 'buildXYAffineSketch'], ['xy-affine-sketch-prism', 'buildXYAffineSketchPrism'],
  ['convex-planar-slab-subtraction', 'subtractConvexPlanarSlab'], ['convex-planar-solid-intersection', 'intersectConvexPlanarSolids'],
  ['convex-planar-solid-split', 'splitConvexPlanarSolid'], ['model-compiler', 'compileCadModel'],
  ['convex-planar-solid-chamfer', 'chamferConvexPlanarSolid'], ['axis-box-boolean', 'buildAxisBoxSolidBoolean'],
  ['orthogonal-solid-boolean', 'buildOrthogonalSolidBoolean'], ['modeling-box-internal', 'buildModelingBox'],
  ['modeling-translation-internal', 'buildModelingTranslation'], ['modeling-stl-internal', 'buildModelingStl'],
  ['own-plate-circular-hole', 'buildOwnPlateCircularHole'], ['stored-plate-hole-solid', 'qualifyStoredPlateHoleSolid'],
  ['convex-planar-solid-mass', 'measureConvexPlanarSolidMass'], ['axis-box-solid-mass', 'measureAxisBoxSolidBooleanMass'],
]);
const pureModules = new Set(['modeling', 'cad-document', 'data-copy', 'xy-affine-prism-feature-document-internal',
  'modeling-regeneration-internal', 'modeling-dimension-internal']);
const replaced = new Set(), state = { phase: 'closed', unexpected: [], construction: [], exports: [], cause: undefined };
const clone = value => structuredClone(value);
function dispatch(binding, args) {
  const exporting = binding === 'buildModelingStl';
  if (state.phase !== (exporting ? 'export' : 'construction')) {
    state.unexpected.push(binding); throw new Error('UNEXPECTED_PROVIDER_ATTEMPT: ' + binding);
  }
  if (exporting) {
    const call = { binding, args }; state.exports.push(call);
    if (state.cause !== undefined) throw state.cause;
    return call.result = { native: { solid: clone(args[0]), mesh: { positionsMM: [-0, 2, 3] }, report: { triangleCount: 7, controlOnly: 'NOT_GEOMETRY' } },
      encoding: { bytes: [0, 17, 255], vertexLosses: [{ sourcePointMM: [-0, 2, 3] }], facets: [],
        maximumMeasuredDisplacementMM: .125, maximumSquaredDisplacementMM2: { numerator: '1', denominator: '64' } },
      report: { controlOnly: 'INERT_EXPORT_NOT_STL', geometryCertified: false } };
  }
  state.construction.push({ binding, args });
  switch (binding) {
    case 'buildXYAffineSketch': return { document: args[0], solution: { points: args[0].points } };
    case 'buildXYAffineSketchPrism': return { request: { sketch: args[0], options: args[1] },
      solid: { controlOnly: 'INERT_CONVEX_NOT_GEOMETRY', authoredOptions: clone(args[1]) }, report: {}, lineage: {} };
    case 'buildModelingBox': return { controlOnly: 'INERT_BOX', origin: args[0], sides: args[1] };
    case 'buildAxisBoxSolidBoolean': case 'buildOrthogonalSolidBoolean': return { report: { schema: binding === 'buildAxisBoxSolidBoolean' ? 'barocss-axis-box-solid-boolean' : 'barocss-orthogonal-solid-boolean', empty: false, solid: true, bodyCount: 1, volumeMM3: 19 }, bodies: [{ id: 'inert-cell', volumeMM3: 19 }], controlOnly: 'INERT_CELL' };
    case 'buildXYArc': return { curve: { id: args[0].id }, report: { centerMM: args[0].center, radiusMM: args[0].radius } };
    case 'buildXYCirclePrismShell': case 'qualifyStoredCirclePrismSolid': return { controlOnly: 'INERT_CIRCLE' };
    case 'buildOwnPlateCircularHole': return { bundle: { controlOnly: 'INERT_HOLE' } };
    case 'qualifyStoredPlateHoleSolid': return { controlOnly: 'INERT_HOLE' };
    default: state.unexpected.push(binding); throw new Error('UNUSED_PROVIDER: ' + binding);
  }
}
globalThis[trapKey] = { dispatch };
const bundle = await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true,
  plugins: [{ name: 'modeling-stl-zero-native', setup(build) {
    build.onResolve({ filter: /\.(?:ts|js)$/ }, args => {
      const key = basename(args.path, extname(args.path));
      if (providers.has(key)) { replaced.add(key); return { path: key, namespace: 'stl-trap' }; }
      assert.ok(pureModules.has(key), 'Unreviewed native implementation: ' + args.path);
    });
    build.onLoad({ filter: /.*/, namespace: 'stl-trap' }, args => ({ loader: 'js', contents:
      `export function ${providers.get(args.path)}(...args) { return globalThis[Symbol.for('barocss.modeling-stl.admission-trap')].dispatch(${JSON.stringify(providers.get(args.path))}, args); }` }));
  } }] });
assert.deepEqual([...replaced].sort(), [...providers.keys()].sort());
const inputPaths = Object.keys(bundle.metafile.inputs).filter(path => !path.startsWith('stl-trap:')).sort();
assert.equal(inputPaths.length, pureModules.size);
for (const path of inputPaths) assert.ok(pureModules.has(basename(path, extname(path))));
const { createCadModel, loadCadModel, CadModelError } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
let provenance;
if (process.env.EVIDENCE_DIR) {
  const directory = resolve(process.env.EVIDENCE_DIR, 'modeling-stl-admission-' + mode);
  mkdirSync(dirname(directory), { recursive: true }); mkdirSync(directory);
  const save = (name, bytes) => { writeFileSync(resolve(directory, name), bytes, { flag: 'wx' }); return { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) }; };
  provenance = { directory, entry, mode, testSHA256: sha256(readFileSync(fileURLToPath(import.meta.url))),
    bundle: save('bundle.mjs', bundle.outputFiles[0].text), metafile: save('bundle.metafile.json', JSON.stringify(bundle.metafile, null, 2) + '\n'),
    inputs: save('input-hashes.json', JSON.stringify(Object.fromEntries(inputPaths.map(path => [path, sha256(readFileSync(resolve(path)))])), null, 2) + '\n'),
    replacedProviderBindings: [...providers.values()].sort() };
}
after(() => {
  if (provenance) writeFileSync(resolve(provenance.directory, 'receipt.json'), JSON.stringify({ issue: 1890,
    scope: 'Actual facade with all providers inert; API admission/projection, no geometry or STL proof',
    realNativeGeometryCalls: 0, unexpectedProviderAttempts: state.unexpected, inertExportCalls: state.exports.length,
    inertConstructionCalls: state.construction.length, provenance }, null, 2) + '\n', { flag: 'wx' });
  delete globalThis[trapKey]; assert.deepEqual(state.unexpected, []); assert.equal(state.phase, 'closed');
});
function phase(value, action) { assert.equal(state.phase, 'closed'); state.phase = value; try { return action(); } finally { state.phase = 'closed'; } }
const construct = action => phase('construction', action), exportStl = (snapshot, name = 'part') => phase('export', () => snapshot.exportStl(name));
function refusal(action, code) {
  const before = [state.construction.length, state.exports.length];
  assert.throws(action, e => e instanceof CadModelError && e.code === code && e.operation === 'exportStl');
  assert.deepEqual([state.construction.length, state.exports.length], before);
}
function frozen(value, seen = new Set()) { if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value); assert.ok(Object.isFrozen(value)); for (const child of Object.values(value)) frozen(child, seen); }
function snapshot(kind = 'convex') { return construct(() => {
  const m = createCadModel(), h = m.parameter('height', 8); let part;
  const base = () => m.sketch.rectangle({ width: 32, height: 24 }).extrude(h);
  if (kind === 'circle') part = m.sketch.circle({ center: [8, 8], radius: 2 }).extrude(h);
  else if (kind === 'hole') part = base().hole({ center: [16, 12], radius: 2 });
  else if (kind === 'cell') { const a = base(), b = m.sketch.rectangle({ width: 8, height: 32 }).extrude(h); return m.build({ part: a.union(b), supported: a }); }
  else part = base();
  return m.build({ part });
}); }
function unchanged(s, saved, bodies = s.bodies) { assert.equal(s.save(), saved); assert.equal(s.bodies, bodies); frozen(s); }

test('one exact output name and no format/options overload are admitted', () => {
  const s = snapshot();
  for (const args of [[], [undefined], [null], [1], ['part', undefined], ['part', {}], ['part', {}, 1]]) refusal(() => s.exportStl(...args), 'INPUT');
  for (const name of ['', 'bad name', Symbol('part'), ['part'], {}, 'x'.repeat(49), 'constructor', '__proto__', 'prototype']) refusal(() => s.exportStl(name), 'INPUT');
  for (const name of ['missing', 'toString']) refusal(() => s.exportStl(name), 'SELECTION');
});
test('the exact snapshot method inventory includes exportStl', () => {
  assert.deepEqual(Object.keys(snapshot()).sort(), ['bodies', 'parameters', 'suppression', 'features', 'recomputation', 'evidence', 'withParameters', 'withSuppression', 'massProperties', 'exportStl', 'save'].sort());
});
test('the same named convex body is passed once to the private constructor without extra model work', () => {
  const s = snapshot(), saved = s.save(), before = state.construction.length, count = state.exports.length;
  const result = exportStl(s); assert.equal(state.exports.length, count + 1); assert.equal(state.construction.length, before);
  assert.deepEqual(state.exports.at(-1).args, [s.bodies.part.native]); assert.equal(state.exports.at(-1).args[0], s.bodies.part.native);
  assert.equal(result.details, state.exports.at(-1).result); unchanged(s, saved);
});
test('public return fields project native and encoding values without dropping proof', () => {
  const r = exportStl(snapshot());
  assert.deepEqual(Object.keys(r).sort(), ['outputName', 'family', 'format', 'lengthUnit', 'bytes', 'byteLength', 'triangleCount', 'maximumVertexDisplacementMM', 'details'].sort());
  assert.equal(r.outputName, 'part'); assert.equal(r.family, 'convex-planar'); assert.equal(r.format, 'binary-stl'); assert.equal(r.lengthUnit, 'mm');
  assert.equal(r.bytes, r.details.encoding.bytes); assert.deepEqual(r.bytes, [0, 17, 255]); assert.equal(r.byteLength, 3);
  assert.equal(r.triangleCount, 7); assert.equal(r.maximumVertexDisplacementMM, .125); assert.ok(Object.is(r.details.native.mesh.positionsMM[0], -0));
});
test('result data is deeply frozen and independent across calls', () => {
  const s = snapshot(), a = exportStl(s), b = exportStl(s); frozen(a); frozen(b);
  assert.notEqual(a, b); assert.notEqual(a.bytes, b.bytes); assert.deepEqual(a.bytes, b.bytes);
  for (const mutate of [() => { a.bytes[0] = 3; }, () => { a.details.native.mesh.positionsMM[0] = 1; }, () => { a.details.encoding.vertexLosses[0].sourcePointMM[0] = 1; }]) assert.throws(mutate, TypeError);
});
test('all unsupported families refuse before the private export provider', () => {
  for (const kind of ['circle', 'hole', 'cell']) { const s = snapshot(kind), saved = s.save(); refusal(() => s.exportStl('part'), 'CAPABILITY'); unchanged(s, saved); }
});
test('a supported named body in a mixed snapshot is exported independently', () => {
  const s = snapshot('cell'), result = exportStl(s, 'supported'); assert.equal(result.outputName, 'supported');
  assert.equal(state.exports.at(-1).args[0], s.bodies.supported.native); refusal(() => s.exportStl('part'), 'CAPABILITY');
});
test('detached and forged-this calls retain their original closure-owned bodies', () => {
  const s = snapshot(), foreign = snapshot(), f = s.exportStl;
  for (const action of [() => f('part'), () => f.call({ bodies: foreign.bodies }, 'part'), () => ({ ...s, bodies: foreign.bodies }).exportStl('part')]) {
    phase('export', action); assert.equal(state.exports.at(-1).args[0], s.bodies.part.native);
  }
});
test('actual original provider error causes survive and accepted bytes remain reusable', () => {
  const s = snapshot(), saved = s.save(), prior = exportStl(s), priorBytes = [...prior.bytes];
  const cause = Object.freeze({ code: 'COLLAPSE', stage: 'facet', progress: { bytes: null }, sentinel: 'INERT_ORIGINAL_CAUSE' });
  state.cause = cause;
  try { assert.throws(() => exportStl(s), e => e instanceof CadModelError && e.code === 'NATIVE' && e.operation === 'exportStl' && e.cause === cause); }
  finally { state.cause = undefined; }
  unchanged(s, saved); assert.deepEqual(prior.bytes, priorBytes); assert.deepEqual(exportStl(s).bytes, priorBytes);
});
test('export leaves authored save and prefix reuse independent of query results', () => {
  const s = snapshot(), saved = s.save(), bodies = s.bodies; exportStl(s); unchanged(s, saved, bodies);
  const noOp = construct(() => s.withParameters({ height: 8 })); assert.equal(noOp.bodies.part, s.bodies.part); assert.deepEqual(noOp.recomputation.reusedFeatures, [0, 1]);
  const cold = construct(() => loadCadModel(saved)); assert.equal(cold.save(), saved); assert.notEqual(cold.bodies.part, s.bodies.part);
  assert.equal(saved.includes('exportStl'), false); assert.equal(saved.includes('INERT_EXPORT'), false);
});

// Synthetic geometry-only encoder controls. This actual private code performs
// no native construction, validation or queries, and establishes no Solid.
const encoderPath = resolve(dirname(entry), 'qualified-strip-binary-stl-encoding-internal' + extname(entry));
const rationalPath = resolve(dirname(entry), 'section-rational-internal' + extname(entry));
const encodingBundle = await build({ stdin: { contents: `export { encodeQualifiedStripBinaryStlTrusted as encode } from ${JSON.stringify(encoderPath)};
export { SectionRationalContext } from ${JSON.stringify(rationalPath)};`, resolveDir: dirname(entry), sourcefile: 'stl-encoding-controls.mjs', loader: 'js' },
  bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true });
const encoderInputs = Object.keys(encodingBundle.metafile.inputs).filter(p => !p.endsWith('stl-encoding-controls.mjs'));
assert.deepEqual(encoderInputs.map(p => basename(p, extname(p))).sort(), ['qualified-strip-binary-stl-encoding-internal', 'section-rational-internal']);
const { encode, SectionRationalContext } = await import('data:text/javascript;base64,' + Buffer.from(encodingBundle.outputFiles[0].text).toString('base64'));
if (provenance) {
  writeFileSync(resolve(provenance.directory, 'encoder-bundle.mjs'), encodingBundle.outputFiles[0].text, { flag: 'wx' });
  writeFileSync(resolve(provenance.directory, 'encoder-metafile.json'), JSON.stringify(encodingBundle.metafile, null, 2) + '\n', { flag: 'wx' });
  writeFileSync(resolve(provenance.directory, 'encoder-input-hashes.json'), JSON.stringify(Object.fromEntries(encoderInputs.map(p => [p, sha256(readFileSync(resolve(p)))])), null, 2) + '\n', { flag: 'wx' });
}
function encodingCounts() { return Object.fromEntries(['meshValidationCount', 'vertexCount', 'coordinateFloat32RoundCount', 'triangleCount', 'normalFloat32RoundCount', 'exactCrossCount', 'normalAlignmentCount', 'encodedFloat32Count', 'encodedAttributeCount', 'encodedByteCount', 'curveD0Count', 'curveD1Count', 'surfaceD0Count', 'surfaceD1Count', 'sourceCompilationCount', 'rootSolveCount', 'rationalFloatConversionCount', 'fileWriteCount', 'fileReadCount'].map(k => [k, 0])); }
function triangle(points) { return { positionsMM: points.flat(), indices: [0, 1, 2], vertices: points.map((point, index) => ({ index, point: [...point] })), triangles: [{ index: 0, faceId: 'synthetic', vertexIndices: [0, 1, 2] }] }; }
function syntheticEncode(packet, counts) {
  const fail = (code, detail) => { throw Object.assign(new Error(detail), { code }); };
  return encode(packet, new SectionRationalContext(fail), counts, { beginVertex() {}, beginTriangle() {}, beginEncoding() {}, retainPhase() {}, fail });
}
test('pure encoder measures nonzero Float32 loss without changing the source geometry view', () => {
  const p = triangle([[.1, 0, 0], [1, 0, 0], [.1, 1, 0]]), before = clone(p), counts = encodingCounts(), r = syntheticEncode(p, counts);
  assert.deepEqual(p, before); assert.equal(r.bytes.length, 134); assert.ok(r.maximumMeasuredDisplacementMM > 0);
  assert.notEqual(r.maximumSquaredDisplacementMM2.numerator, '0'); assert.equal(counts.sourceCompilationCount, 0);
  assert.equal(counts.coordinateFloat32RoundCount, 9); assert.equal(counts.encodedByteCount, 134);
  const view = new DataView(Uint8Array.from(r.bytes).buffer); assert.equal(view.getUint32(80, true), 1);
  assert.equal(view.getFloat32(96, true), Math.fround(.1)); assert.equal(view.getUint16(132, true), 0);
});
test('pure encoder quantized collapse refuses before any binary byte allocation/write', () => {
  const counts = encodingCounts(), p = triangle([[0, 0, 9999], [2, 0, 9999], [0, 0, 9999 + 1/4096]]);
  assert.throws(() => syntheticEncode(p, counts), e => e.code === 'COLLAPSE');
  assert.equal(counts.vertexCount, 3); assert.equal(counts.exactCrossCount, 1); assert.equal(counts.encodedByteCount, 0);
});
test('pure encoder requires exact original index mapping before encoding', () => {
  const counts = encodingCounts(), p = triangle([[0, 0, 0], [2, 0, 0], [0, 2, 0]]); p.indices[1] = 2;
  assert.throws(() => syntheticEncode(p, counts), e => e.code === 'BINDING'); assert.equal(counts.encodedByteCount, 0);
});
