import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// Admission/routing controls only. EVERY geometry/compiler/mass provider is
// replaced before importing the actual modeling module. The inert construction
// and measurement data below are deliberately not geometric evidence.
// CAD_MODEL_MASS_ENTRY names the actual src/modeling.ts or dist/modeling.js;
// default: emitted dist/modeling.js. CAD_MODEL_TEST_MODULE is deliberately
// ignored: a prebundled index has already erased the provider import boundary.
const entry = resolve(process.env.CAD_MODEL_MASS_ENTRY ?? fileURLToPath(new URL('../dist/modeling.js', import.meta.url)));
assert.match(basename(entry), /^modeling\.(?:ts|js)$/, 'Use an actual source or emitted modeling entry');
const mode = extname(entry) === '.ts' ? 'source' : 'emitted';
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? fileURLToPath(new URL('../../..', import.meta.url)), 'package.json'));
const { build } = require('esbuild');
const trapKey = Symbol.for('barocss.modeling-mass.admission-trap');
assert.equal(globalThis[trapKey], undefined, 'The isolated trap must not replace an existing run');
const providers = new Map([
  ['xy-arc', 'buildXYArc'], ['xy-circle-prism-shell', 'buildXYCirclePrismShell'], ['stored-circle-prism-solid', 'qualifyStoredCirclePrismSolid'],
  ['xy-affine-sketch', 'buildXYAffineSketch'], ['xy-affine-sketch-prism', 'buildXYAffineSketchPrism'],
  ['convex-planar-slab-subtraction', 'subtractConvexPlanarSlab'], ['convex-planar-solid-intersection', 'intersectConvexPlanarSolids'],
  ['convex-planar-solid-split', 'splitConvexPlanarSolid'], ['model-compiler', 'compileCadModel'],
  ['convex-planar-solid-chamfer', 'chamferConvexPlanarSolid'], ['axis-box-boolean', 'buildAxisBoxSolidBoolean'],
  ['orthogonal-solid-boolean', 'buildOrthogonalSolidBoolean'], ['modeling-box-internal', 'buildModelingBox'],
  ['modeling-translation-internal', 'buildModelingTranslation'],
  ['own-plate-circular-hole', 'buildOwnPlateCircularHole'], ['stored-plate-hole-solid', 'qualifyStoredPlateHoleSolid'],
  ['convex-planar-solid-mass', 'measureConvexPlanarSolidMass'], ['axis-box-solid-mass', 'measureAxisBoxSolidBooleanMass'],
]);
const pureModules = new Set(['modeling', 'cad-document', 'data-copy', 'xy-affine-prism-feature-document-internal',
  'modeling-regeneration-internal', 'modeling-dimension-internal']);
const replaced = new Set(), state = { phase: 'closed', unexpected: [], construction: [], mass: [], booleanEdit: null, massEdit: null, cause: undefined };
const clone = value => structuredClone(value);
const fraction = numerator => ({ numerator: String(numerator), denominator: '1' });
const matrix = entry => Array.from({ length: 3 }, (_, row) => Array.from({ length: 3 }, (_, column) => entry(row, column)));
const errorBound = () => ({ exact: fraction(0), upper: 0 });

function inertMeasure() {
  // Arbitrary fixed sentinels: matching them proves projection, never integration.
  return { controlOnly: 'INERT_MASS_MEASURE_NOT_GEOMETRY', volumeMM3: 19, massKG: 7,
    centroidMM: [2, -0, 5], inertiaCentroidKgM2: [[11, -2, 3], [-2, 13, -4], [3, -4, 17]],
    exact: { volumeMM3: fraction(19), massKG: fraction(7), centroidMM: [fraction(2), fraction(0), fraction(5)],
      inertiaCentroidKgM2: matrix((r, c) => fraction(r === c ? 23 : 0)), additionalNativeMoment: fraction(101) },
    conversionErrors: { massKG: errorBound(), centroidMM: [errorBound(), errorBound(), errorBound()],
      inertiaCentroidKgM2: matrix(errorBound), additionalNativeError: errorBound() },
    positiveDefinite: { controlOnly: 'INERT_WITNESS_NOT_A_CERTIFICATE' } };
}
function inertBoolean(schema, args) {
  const result = { controlOnly: 'INERT_BOOLEAN_SHAPE_NOT_GEOMETRY', options: clone(args[2]),
    report: { schema, empty: false, solid: true, bodyCount: 1, volumeMM3: 19 }, bodies: [{ id: 'inert-body', volumeMM3: 19 }] };
  if (schema === 'barocss-axis-box-solid-boolean') state.booleanEdit?.(result);
  return result;
}
function dispatch(binding, args) {
  const mass = binding === 'measureConvexPlanarSolidMass' || binding === 'measureAxisBoxSolidBooleanMass';
  if (state.phase !== (mass ? 'mass' : 'construction')) {
    state.unexpected.push(binding); throw new Error('UNEXPECTED_INERT_PROVIDER_ATTEMPT: ' + binding);
  }
  if (mass) {
    const call = { binding, args }; state.mass.push(call);
    if (state.cause !== undefined) throw state.cause;
    const measure = inertMeasure();
    const native = binding === 'measureConvexPlanarSolidMass'
      ? { solid: clone(args[0]), options: clone(args[1]), measure, report: { controlOnly: 'INERT_CONVEX_MASS_NOT_GEOMETRY' } }
      : { boolean: clone(args[0]), options: clone(args[1]), bodies: [clone(measure)], total: measure,
        report: { controlOnly: 'INERT_CELL_MASS_NOT_GEOMETRY', empty: false, bodyCount: 1 } };
    state.massEdit?.(native); call.result = native; return native;
  }
  state.construction.push({ binding, args });
  switch (binding) {
    case 'buildXYAffineSketch': return { document: args[0], solution: { points: args[0].points } };
    case 'buildXYAffineSketchPrism': return { request: { sketch: args[0], options: args[1] },
      solid: { controlOnly: 'INERT_CONVEX_SHAPE_NOT_GEOMETRY', authoredOptions: clone(args[1]) }, report: {}, lineage: {} };
    case 'buildModelingBox': return { controlOnly: 'INERT_BOX_NOT_GEOMETRY', origin: args[0], sides: args[1] };
    case 'buildAxisBoxSolidBoolean': return inertBoolean('barocss-axis-box-solid-boolean', args);
    case 'buildOrthogonalSolidBoolean': return inertBoolean('barocss-orthogonal-solid-boolean', args);
    case 'buildXYArc': return { curve: { id: args[0].id }, report: { centerMM: args[0].center, radiusMM: args[0].radius } };
    case 'buildXYCirclePrismShell': return { controlOnly: 'INERT_CIRCLE_SHELL_NOT_GEOMETRY' };
    case 'qualifyStoredCirclePrismSolid': return { controlOnly: 'INERT_CIRCLE_SOLID_NOT_GEOMETRY' };
    case 'buildOwnPlateCircularHole': return { bundle: { controlOnly: 'INERT_HOLE_BUNDLE_NOT_GEOMETRY' } };
    case 'qualifyStoredPlateHoleSolid': return { controlOnly: 'INERT_HOLE_SOLID_NOT_GEOMETRY' };
    default: state.unexpected.push(binding); throw new Error('UNUSED_CONSTRUCTION_PROVIDER: ' + binding);
  }
}
globalThis[trapKey] = { dispatch };
const bundle = await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true,
  plugins: [{ name: 'modeling-mass-zero-native-provider-trap', setup(build) {
    build.onResolve({ filter: /\.(?:ts|js)$/ }, args => {
      const key = basename(args.path, extname(args.path));
      if (providers.has(key)) { replaced.add(key); return { path: key, namespace: 'mass-trap' }; }
      assert.ok(pureModules.has(key), 'Unreviewed implementation cannot enter zero-native test: ' + args.path);
    });
    build.onLoad({ filter: /.*/, namespace: 'mass-trap' }, args => ({ loader: 'js', contents: `
      // INERT TEST BINDING: no original implementation is imported or called.
      export function ${providers.get(args.path)}(...args) {
        return globalThis[Symbol.for('barocss.modeling-mass.admission-trap')].dispatch(${JSON.stringify(providers.get(args.path))}, args);
      }` }));
  } }] });
assert.deepEqual([...replaced].sort(), [...providers.keys()].sort(), 'Every modeling provider binding is replaced');
const inputPaths = Object.keys(bundle.metafile.inputs).filter(path => !path.startsWith('mass-trap:')).sort();
assert.ok(inputPaths.length > 0);
for (const path of inputPaths) assert.ok(pureModules.has(basename(path, extname(path))), 'No native implementation in transitive bundle: ' + path);
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const { createCadModel, loadCadModel, CadModelError } = api;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
let provenance;
if (process.env.EVIDENCE_DIR) {
  const directory = resolve(process.env.EVIDENCE_DIR, 'modeling-mass-admission-' + mode);
  mkdirSync(dirname(directory), { recursive: true }); mkdirSync(directory); // Run-owned; never overwrite prior evidence.
  const save = (name, bytes) => { writeFileSync(resolve(directory, name), bytes, { flag: 'wx' }); return { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) }; };
  provenance = { directory, entry, mode, testSHA256: sha256(readFileSync(fileURLToPath(import.meta.url))),
    bundle: save('bundle.mjs', bundle.outputFiles[0].text), metafile: save('bundle.metafile.json', JSON.stringify(bundle.metafile, null, 2) + '\n'),
    inputs: save('input-hashes.json', JSON.stringify(Object.fromEntries(inputPaths.map(path => [path, sha256(readFileSync(resolve(path)))])), null, 2) + '\n'),
    replacedProviderBindings: [...providers.values()].sort() };
}
after(() => {
  const counts = calls => Object.fromEntries([...new Set(calls.map(call => call.binding))].sort().map(binding => [binding, calls.filter(call => call.binding === binding).length]));
  if (provenance) writeFileSync(resolve(provenance.directory, 'receipt.json'), JSON.stringify({ issue: 1790,
    scope: 'Actual modeling facade with isolated inert construction and mass stubs; admission and routing only; no geometric acceptance',
    realNativeGeometryCalls: 0, unexpectedProviderAttempts: state.unexpected, inertConstructionCalls: counts(state.construction),
    inertMassCalls: counts(state.mass), fullTransitiveNativeCoverage: 'NOT_MEASURED', provenance }, null, 2) + '\n', { flag: 'wx' });
  delete globalThis[trapKey]; assert.deepEqual(state.unexpected, []); assert.equal(state.phase, 'closed');
});
function phase(value, action) {
  assert.equal(state.phase, 'closed'); state.phase = value;
  try { return action(); } finally { state.phase = 'closed'; }
}
const construct = action => phase('construction', action);
const measure = (snapshot, outputName = 'part', options = { densityKgPerM3: 2700 }) => phase('mass', () => snapshot.massProperties(outputName, options));
function refusal(action, code, noProvider = true) {
  const before = [state.construction.length, state.mass.length];
  assert.throws(action, error => {
    assert.ok(error instanceof CadModelError, String(error)); assert.equal(error.code, code); assert.equal(error.operation, 'massProperties'); return true;
  });
  if (noProvider) assert.deepEqual([state.construction.length, state.mass.length], before);
  assert.deepEqual(state.unexpected, []);
}
function frozen(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value); assert.ok(Object.isFrozen(value)); for (const child of Object.values(value)) frozen(child, seen);
}
function retained(snapshot) {
  return { text: snapshot.save(), json: JSON.stringify(snapshot), identities: Object.fromEntries(
    ['bodies', 'parameters', 'suppression', 'features', 'evidence', 'recomputation'].map(key => [key, snapshot[key]])) };
}
function unchanged(snapshot, before) {
  assert.equal(snapshot.save(), before.text); assert.equal(JSON.stringify(snapshot), before.json);
  for (const [key, value] of Object.entries(before.identities)) assert.equal(snapshot[key], value, key + ' retains original identity');
  frozen(snapshot);
}
function convexSnapshot(names = ['part']) {
  return construct(() => {
    const model = createCadModel(), height = model.parameter('height', 8);
    const part = model.sketch.rectangle({ min: [-0, 0], max: [32, 24] }).extrude(height);
    return model.build(Object.fromEntries(names.map(name => [name, part])));
  });
}
function cellSnapshot(kind = 'difference') {
  return construct(() => {
    const model = createCadModel(), height = model.parameter('height', 8);
    const plate = model.sketch.rectangle({ width: 32, height: 24 }).extrude(height);
    const tool = model.sketch.rectangle({ min: [8, 8], max: [24, 16] }).extrude(4, { from: 4 });
    const part = kind === 'union' ? plate.union(tool) : plate.cut(tool);
    return model.build({ plate, tool, part });
  });
}
function unsupportedSnapshot(kind) {
  return construct(() => {
    const model = createCadModel(); let part;
    if (kind === 'circle') part = model.sketch.circle({ center: [8, 8], radius: 2 }).extrude(4);
    else if (kind === 'hole') part = model.sketch.rectangle({ width: 32, height: 24 }).extrude(8).hole({ center: [16, 12], radius: 2 });
    else {
      const a = model.sketch.rectangle({ width: 32, height: 8 }).extrude(8), b = model.sketch.rectangle({ width: 8, height: 24 }).extrude(8);
      const union = a.union(b), tool = model.sketch.rectangle({ min: [2, 2], max: [6, 6] }).extrude(8); part = union.cut(tool);
    }
    return model.build({ part });
  });
}

test('actual modeling entry is isolated from every native provider, including transitive compiler imports', () => {
  const snapshot = convexSnapshot();
  assert.equal(typeof snapshot.massProperties, 'function');
  assert.deepEqual(Object.keys(snapshot).sort(), ['bodies', 'parameters', 'suppression', 'features', 'recomputation', 'evidence', 'withParameters', 'withSuppression', 'massProperties', 'save'].sort());
  assert.equal(replaced.size, 18); assert.equal(inputPaths.length, pureModules.size);
});

test('exact two-argument admission refuses before any provider or value getter', () => {
  const snapshot = convexSnapshot(); let reads = 0;
  const options = { get densityKgPerM3() { reads++; throw new Error('GETTER_MUST_NOT_RUN'); } };
  for (const args of [[], ['part'], ['part', undefined], ['part', { densityKgPerM3: 2700 }, undefined], ['part', options, 1],
    ['part', { densityKgPerM3: 2700 }, 1, 2], [undefined, options]]) refusal(() => snapshot.massProperties(...args), 'INPUT');
  assert.equal(reads, 0);
});

test('names require bounded safe ASCII without coercion; valid unknown and inherited names are SELECTION', () => {
  const snapshot = convexSnapshot(); let reads = 0;
  const coercible = { toString() { reads++; return 'part'; }, valueOf() { reads++; return 'part'; } };
  for (const name of [undefined, null, false, 0, 1n, Symbol('part'), [], {}, new String('part'), coercible,
    '', '1part', 'part name', 'part.name', 'part/name', 'part\n', '\0part', '한글', 'a'.repeat(49), '__proto__', 'prototype', 'constructor'])
    refusal(() => snapshot.massProperties(name, { densityKgPerM3: 2700 }), 'INPUT');
  for (const name of ['missing', 'Part', 'toString', 'valueOf', 'hasOwnProperty'])
    refusal(() => snapshot.massProperties(name, { densityKgPerM3: 2700 }), 'SELECTION');
  assert.equal(reads, 0);
  const names = ['_', 'a-B_9', 'a'.repeat(48)], accepted = convexSnapshot(names);
  for (const name of names) assert.equal(measure(accepted, name).outputName, name);
});

test('options require exactly one enumerable own data field and read no getter', () => {
  const snapshot = convexSnapshot(); let reads = 0;
  const getter = { get densityKgPerM3() { reads++; return 2700; } };
  const extraGetter = { densityKgPerM3: 2700, get extra() { reads++; return 1; } };
  const inheritedGetter = Object.create({ get densityKgPerM3() { reads++; return 2700; } });
  const hidden = Object.defineProperty({}, 'densityKgPerM3', { value: 2700 });
  const hiddenExtra = Object.defineProperty({ densityKgPerM3: 2700 }, 'hidden', { value: 1 });
  const setter = { set densityKgPerM3(value) { reads++; } };
  for (const options of [undefined, null, true, 2700, 1n, Symbol('options'), '2700', [], () => {}, new Date(), {},
    Object.create({ densityKgPerM3: 2700 }), Object.assign(Object.create({}), { densityKgPerM3: 2700 }), getter, extraGetter, inheritedGetter,
    hidden, hiddenExtra, setter, { densityKgPerM3: 2700, extra: 1 }, { densityKgPerM3: 2700, [Symbol('extra')]: 1 },
    { densityKgPerM3: 2700, maximumCells: 27 }, { densityKgPerM3: 2700, maximumFanTriangles: 40 }, { density: 2700 }])
    refusal(() => snapshot.massProperties('part', options), 'INPUT');
  assert.equal(reads, 0);
  const options = Object.assign(Object.create(null), { densityKgPerM3: 2700 });
  assert.equal(measure(snapshot, 'part', options).densityKgPerM3, 2700); assert.equal(Object.isFrozen(options), false);
});

test('density is an uncoerced finite positive number at most one million, including exact boundary values', () => {
  const snapshot = convexSnapshot(); let reads = 0;
  const coercible = { valueOf() { reads++; return 2700; } };
  for (const density of [undefined, null, false, true, '2700', 2700n, Symbol('density'), [], {}, new Number(2700), coercible,
    () => 2700, NaN, Infinity, -Infinity, -1, -Number.MIN_VALUE, -0, 0, 1000000.0000000001, Number.MAX_VALUE])
    refusal(() => snapshot.massProperties('part', { densityKgPerM3: density }), 'INPUT');
  assert.equal(reads, 0);
  for (const density of [Number.MIN_VALUE, 0.5, 2700, 1000000]) {
    assert.equal(measure(snapshot, 'part', { densityKgPerM3: density }).densityKgPerM3, density);
    assert.equal(state.mass.at(-1).args[1].densityKgPerM3, density);
  }
});

test('convex and both two-box operations dispatch exact original parents with fixed provider options, uncached', () => {
  for (const [snapshot, provider, limit] of [[convexSnapshot(), 'measureConvexPlanarSolidMass', { maximumFanTriangles: 40 }],
    [cellSnapshot(), 'measureAxisBoxSolidBooleanMass', { maximumCells: 27 }], [cellSnapshot('union'), 'measureAxisBoxSolidBooleanMass', { maximumCells: 27 }]]) {
    const before = retained(snapshot), calls = state.mass.length, constructors = state.construction.length, options = { densityKgPerM3: 2700 };
    const a = measure(snapshot, 'part', options), b = measure(snapshot, 'part', options);
    assert.equal(state.mass.length, calls + 2); assert.equal(state.construction.length, constructors); assert.notEqual(a, b); assert.notEqual(a.details.native, b.details.native);
    for (const call of state.mass.slice(calls)) {
      assert.equal(call.binding, provider); assert.equal(call.args.length, 2); assert.equal(call.args[0], snapshot.bodies.part.native);
      assert.deepEqual(call.args[1], { densityKgPerM3: 2700, ...limit }); assert.notEqual(call.args[1], options);
    }
    const parent = a.details.native.solid ?? a.details.native.boolean;
    assert.deepEqual(parent, snapshot.bodies.part.native); assert.notEqual(parent, snapshot.bodies.part.native, 'Independent native copies need no reference-identity promise');
    assert.equal(a.family, snapshot.bodies.part.family); unchanged(snapshot, before);
  }
});

test('public projection preserves native values and exact/error witnesses while deeply freezing the full result', () => {
  for (const snapshot of [convexSnapshot(), cellSnapshot()]) {
    const result = measure(snapshot), native = state.mass.at(-1).result, source = native.measure ?? native.total;
    assert.deepEqual(Object.keys(result).sort(), ['outputName', 'family', 'densityKgPerM3', 'volumeMM3', 'massKG', 'centroidMM', 'inertiaCentroidKgM2', 'details'].sort());
    assert.equal(result.details.native, native); assert.equal(result.outputName, 'part'); assert.equal(result.densityKgPerM3, 2700);
    for (const key of ['volumeMM3', 'massKG', 'centroidMM', 'inertiaCentroidKgM2']) assert.deepEqual(result[key], source[key]);
    assert.ok(Object.is(result.centroidMM[1], -0));
    assert.deepEqual(result.details.exact, Object.fromEntries(['volumeMM3', 'massKG', 'centroidMM', 'inertiaCentroidKgM2'].map(key => [key, source.exact[key]])));
    assert.deepEqual(result.details.conversionErrors, Object.fromEntries(['massKG', 'centroidMM', 'inertiaCentroidKgM2'].map(key => [key, source.conversionErrors[key]])));
    assert.ok(source.exact.additionalNativeMoment); assert.ok(source.conversionErrors.additionalNativeError); frozen(result);
    for (const mutate of [() => { result.massKG = 1; }, () => { result.centroidMM[0] = 1; }, () => { result.inertiaCentroidKgM2[0][1] = 1; },
      () => { result.details.exact.massKG.numerator = '0'; }, () => { result.details.conversionErrors.centroidMM[0].upper = 1; },
      () => { result.details.native.report.controlOnly = 'changed'; }]) assert.throws(mutate, TypeError);
  }
});

test('hole, circle, composed orthogonal and unrecognized two-box schemas refuse before every provider', () => {
  for (const kind of ['hole', 'circle', 'composed']) {
    const snapshot = unsupportedSnapshot(kind), before = retained(snapshot);
    refusal(() => snapshot.massProperties('part', { densityKgPerM3: 2700 }), 'CAPABILITY'); unchanged(snapshot, before);
  }
  for (const schema of ['barocss-orthogonal-solid-boolean', 'barocss-axis-box-solid-boolean-v1', '', null, undefined]) {
    state.booleanEdit = result => { result.report.schema = schema; };
    let snapshot; try { snapshot = cellSnapshot(); } finally { state.booleanEdit = null; }
    refusal(() => snapshot.massProperties('part', { densityKgPerM3: 2700 }), 'CAPABILITY');
  }
});

test('two-box facade requires an admitted single nonempty parent before mass-provider work', () => {
  for (const edit of [result => { result.report.empty = true; }, result => { result.bodies = []; }, result => { result.bodies.push(clone(result.bodies[0])); }]) {
    state.booleanEdit = edit; let snapshot;
    try { snapshot = cellSnapshot(); } finally { state.booleanEdit = null; }
    const before = retained(snapshot); refusal(() => snapshot.massProperties('part', { densityKgPerM3: 2700 }), 'NATIVE'); unchanged(snapshot, before);
  }
});

test('invalid native body accounting and nonpositive or null measures refuse atomically after one inert mass attempt', () => {
  const commonEdits = [measure => { measure.volumeMM3 = 0; }, measure => { measure.volumeMM3 = -1; }, measure => { measure.massKG = 0; },
    measure => { measure.massKG = -1; }, measure => { measure.centroidMM = null; }, measure => { measure.inertiaCentroidKgM2 = null; },
    measure => { measure.exact.centroidMM = null; }, measure => { measure.exact.inertiaCentroidKgM2 = null; },
    measure => { measure.conversionErrors.centroidMM = null; }, measure => { measure.conversionErrors.inertiaCentroidKgM2 = null; }];
  for (const snapshot of [convexSnapshot(), cellSnapshot()]) {
    const before = retained(snapshot), edits = commonEdits.map(edit => native => {
      edit(native.measure ?? native.total);
      if (native.total) native.bodies[0].volumeMM3 = native.total.volumeMM3; // Reach the measure guard, not the separate accounting guard.
    });
    if (snapshot.bodies.part.family === 'orthogonal-cell') edits.push(native => { native.report.empty = true; }, native => { native.report.bodyCount = 0; },
      native => { native.report.bodyCount = 2; }, native => { native.bodies = []; }, native => { native.bodies.push(clone(native.bodies[0])); },
      native => { native.bodies[0].volumeMM3++; });
    for (const edit of edits) {
      const calls = state.mass.length; state.massEdit = edit;
      try { refusal(() => measure(snapshot), 'NATIVE', false); } finally { state.massEdit = null; }
      assert.equal(state.mass.length, calls + 1); unchanged(snapshot, before);
    }
    assert.equal(measure(snapshot).massKG, 7);
  }
});

test('original typed provider causes survive wrapping and failed queries preserve save, identities, and future edits', () => {
  class InertTypedNativeError extends Error { constructor(code) { super('INERT_PROVIDER_' + code); this.code = code; } }
  for (const snapshot of [convexSnapshot(), cellSnapshot()]) {
    const accepted = measure(snapshot), acceptedBytes = JSON.stringify(accepted), before = retained(snapshot);
    for (const code of ['BUDGET', 'REPRESENTABILITY']) {
      const cause = new InertTypedNativeError(code), calls = state.mass.length; state.cause = cause;
      try { assert.throws(() => measure(snapshot, 'part', { densityKgPerM3: Number.MIN_VALUE }), error => {
        assert.ok(error instanceof CadModelError); assert.equal(error.code, 'NATIVE'); assert.equal(error.operation, 'massProperties');
        assert.equal(error.cause, cause); assert.ok(error.cause instanceof InertTypedNativeError); assert.equal(error.cause.code, code); return true;
      }); } finally { state.cause = undefined; }
      assert.equal(state.mass.length, calls + 1); unchanged(snapshot, before); assert.equal(JSON.stringify(accepted), acceptedBytes);
    }
    const constructors = state.construction.length, noop = snapshot.withParameters({ height: 8 });
    assert.equal(state.construction.length, constructors); assert.equal(noop.bodies.part, snapshot.bodies.part);
    assert.deepEqual(noop.recomputation.evaluatedFeatures, []);
    const edited = construct(() => snapshot.withParameters({ height: 9 }));
    assert.deepEqual(edited.recomputation.reusedFeatures, [0]);
    assert.deepEqual(edited.recomputation.evaluatedFeatures, snapshot.features.slice(1).map(feature => feature.index));
    assert.equal(edited.parameters.height, 9); assert.notEqual(edited.bodies.part, snapshot.bodies.part); assert.equal(measure(edited).massKG, 7);
    unchanged(snapshot, before); assert.equal(JSON.stringify(accepted), acceptedBytes); frozen(accepted);
  }
});

test('copied, unbound and forged-this methods retain only their original owned output closure', () => {
  const original = convexSnapshot(), foreign = cellSnapshot(), parent = original.bodies.part.native, copied = original.massProperties;
  let reads = 0;
  const poisoned = { get bodies() { reads++; throw new Error('FORGED_THIS_MUST_NOT_BE_READ'); } };
  const counterfeit = { bodies: { part: { family: 'convex-planar', native: { forged: true } }, injected: foreign.bodies.part }, massProperties: copied };
  for (const receiver of [undefined, null, {}, poisoned, foreign, counterfeit]) {
    const result = phase('mass', () => copied.call(receiver, 'part', { densityKgPerM3: 2700 }));
    assert.equal(state.mass.at(-1).binding, 'measureConvexPlanarSolidMass'); assert.equal(state.mass.at(-1).args[0], parent);
    assert.equal(result.family, 'convex-planar'); assert.equal(result.outputName, 'part');
    refusal(() => copied.call(receiver, 'injected', { densityKgPerM3: 2700 }), 'SELECTION');
  }
  assert.equal(reads, 0);
  const spread = { ...original, bodies: foreign.bodies };
  phase('mass', () => spread.massProperties('part', { densityKgPerM3: 2700 })); assert.equal(state.mass.at(-1).args[0], parent);
});

test('cold authored reopening owns an independent closure and mass queries never alter the saved schema', () => {
  const source = cellSnapshot(), text = source.save(), before = retained(source), first = measure(source);
  const reopened = construct(() => loadCadModel(text)), cold = measure(reopened);
  assert.equal(reopened.save(), text); assert.notEqual(reopened.bodies.part.native, source.bodies.part.native);
  assert.equal(state.mass.at(-1).args[0], reopened.bodies.part.native); assert.deepEqual(cold, first);
  assert.deepEqual(Object.keys(JSON.parse(text)).sort(), ['format', 'schema', 'units', 'parameters', 'nodes', 'outputs'].sort());
  assert.equal(text.includes('densityKgPerM3'), false); assert.equal(text.includes('massProperties'), false);
  assert.deepEqual(reopened.recomputation.reusedFeatures, []); assert.deepEqual(reopened.recomputation.evaluatedFeatures, [0, 1, 2, 3, 4]);
  unchanged(source, before); frozen(cold);
});
