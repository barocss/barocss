import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// ZERO-NATIVE admission/routing controls. Every native construction, solver,
// compiler and mass binding is replaced before importing the actual facade.
// Mock reports and bodies are deliberately NOT geometry or solver evidence.
// Use CAD_MODEL_CONSTRAINTS_ENTRY=.../src/modeling.ts or .../dist/modeling.js.
// A prebundled index cannot retain the provider boundary and is never admitted.
const entry = resolve(process.env.CAD_MODEL_CONSTRAINTS_ENTRY ?? fileURLToPath(new URL('../dist/modeling.js', import.meta.url)));
assert.match(basename(entry), /^modeling\.(?:ts|js)$/, 'Use the actual source or emitted modeling entry');
const mode = extname(entry) === '.ts' ? 'source' : 'emitted';
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? fileURLToPath(new URL('../../..', import.meta.url)), 'package.json'));
const { build } = require('esbuild');
const trapKey = Symbol.for('barocss.modeling-constraints.admission-trap');
assert.equal(globalThis[trapKey], undefined, 'Never replace another active trap');
const providers = new Map([
  ['xy-arc', 'buildXYArc'], ['xy-circle-prism-shell', 'buildXYCirclePrismShell'], ['stored-circle-prism-solid', 'qualifyStoredCirclePrismSolid'], ['modeling-profile-internal', 'runModelingProfile'],
  ['xy-affine-sketch', 'buildXYAffineSketch'], ['xy-affine-sketch-prism', 'buildXYAffineSketchPrism'],
  ['convex-planar-slab-subtraction', 'subtractConvexPlanarSlab'], ['convex-planar-solid-intersection', 'intersectConvexPlanarSolids'],
  ['convex-planar-solid-split', 'splitConvexPlanarSolid'], ['model-compiler', 'compileCadModel'],
  ['convex-planar-solid-chamfer', 'chamferConvexPlanarSolid'], ['axis-box-boolean', 'buildAxisBoxSolidBoolean'],
  ['orthogonal-solid-boolean', 'buildOrthogonalSolidBoolean'], ['modeling-box-internal', 'buildModelingBox'],
  ['modeling-translation-internal', 'buildModelingTranslation'], ['modeling-rotation-internal', 'buildModelingRotation'], ['modeling-mirror-internal', 'buildModelingMirror'], ['modeling-scale-internal', 'buildModelingScale'], ['modeling-linear-pattern-internal', 'buildModelingLinearPattern'], ['modeling-circular-pattern-internal', 'buildModelingCircularPattern'], ['modeling-stl-internal', 'buildModelingStl'],
  ['own-plate-circular-hole', 'buildOwnPlateCircularHole'], ['stored-plate-hole-solid', 'qualifyStoredPlateHoleSolid'],
  ['convex-planar-solid-mass', 'measureConvexPlanarSolidMass'], ['axis-box-solid-mass', 'measureAxisBoxSolidBooleanMass'],
]);
const pureModules = new Set(['barocss-error', 'modeling', 'cad-document', 'data-copy', 'xy-affine-prism-feature-document-internal',
  'modeling-regeneration-internal', 'modeling-dimension-internal']);
const replaced = new Set(), state = { phase: 'closed', calls: [], unexpected: [], sketchEdit: null, nativeError: undefined };
const clone = value => structuredClone(value);
const marker = 'INERT_CONSTRAINTS_CONTROL_NOT_GEOMETRY';
function inertSketch(document) {
  const coordinates = document.points.flatMap(point => ['x', 'y'].map(axis => ({ pointId: point.id, axis })));
  return { ok: true, controlOnly: marker, document: clone(document),
    solution: { points: clone(document.points), source: marker, sourceVersion: 0,
      model: { controlOnly: marker, objects: [] }, ir: { controlOnly: marker, schemaVersion: 1 } },
    report: { controlOnly: marker, rank: coordinates.length, degreesOfFreedom: 0, fullyConstrained: true,
      equationCount: document.constraints.reduce((count, constraint) => count + (constraint.kind === 'fixed' ? 2 : 1), 0),
      unknownCount: coordinates.length, redundantConstraintIds: [], pivotCoordinates: coordinates, freeCoordinates: [],
      rationalWork: { operations: 0, gcdSteps: 0, floatSearchSteps: 0, floatConversions: 0, maximumObservedBits: 0 },
      quality: { controlOnly: marker, topologyCertified: false, solid: false, manufacturingToleranceCertified: false },
      limits: { controlOnly: marker } } };
}
function dispatch(binding, args) {
  if (state.phase !== 'mock-native') {
    state.unexpected.push(binding); throw new Error('UNEXPECTED_PROVIDER_ATTEMPT: ' + binding);
  }
  const call = { binding, args }; state.calls.push(call);
  if (binding === 'buildXYAffineSketch') {
    if (state.nativeError !== undefined) throw state.nativeError;
    call.result = inertSketch(args[0]); state.sketchEdit?.(call.result); return call.result;
  }
  if (binding === 'buildXYAffineSketchPrism') {
    call.result = { controlOnly: marker, request: { sketch: args[0], options: clone(args[1]) },
      solid: { controlOnly: marker, authoredOptions: clone(args[1]) }, report: { controlOnly: marker }, lineage: { controlOnly: marker } };
    return call.result;
  }
  if (binding === 'buildXYArc') return call.result = { controlOnly: marker, curve: { id: args[0].id }, report: { centerMM: args[0].center, radiusMM: args[0].radius } };
  if (binding === 'buildXYCirclePrismShell' || binding === 'qualifyStoredCirclePrismSolid') return call.result = { controlOnly: marker };
  state.unexpected.push(binding); throw new Error('UNUSED_MOCK_PROVIDER: ' + binding);
}
globalThis[trapKey] = { dispatch };
const virtualEntry = `export * from ${JSON.stringify(entry)};
export { modelingGraphKey, modelingNodeParameters, modelingReusablePrefix } from './modeling-regeneration-internal.js';
export { signedJson } from './xy-affine-prism-feature-document-internal.js';`;
const bundle = await build({ stdin: { contents: virtualEntry, resolveDir: dirname(entry), sourcefile: 'constraints-test-entry.mjs', loader: 'js' },
  bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true,
  plugins: [{ name: 'modeling-constraints-zero-native-provider-trap', setup(build) {
    build.onResolve({ filter: /\.(?:ts|js)$/ }, args => {
      const key = basename(args.path, extname(args.path));
      if (providers.has(key)) { replaced.add(key); return { path: key, namespace: 'constraints-trap' }; }
      assert.ok(pureModules.has(key), 'Unreviewed implementation cannot enter zero-native bundle: ' + args.path);
    });
    build.onLoad({ filter: /.*/, namespace: 'constraints-trap' }, args => ({ loader: 'js', contents: `
      // INERT TEST BINDING: no original implementation is imported or called.
      export function ${providers.get(args.path)}(...args) {
        return globalThis[Symbol.for('barocss.modeling-constraints.admission-trap')].dispatch(${JSON.stringify(providers.get(args.path))}, args);
      }` }));
  } }] });
assert.deepEqual([...replaced].sort(), [...providers.keys()].sort(), 'Every native provider binding is replaced');
const inputPaths = Object.keys(bundle.metafile.inputs).filter(path => !path.startsWith('constraints-trap:') && !path.endsWith('constraints-test-entry.mjs')).sort();
assert.equal(inputPaths.length, pureModules.size);
for (const path of inputPaths) assert.ok(pureModules.has(basename(path, extname(path))), 'No native implementation in bundle: ' + path);
const { createCadModel, loadCadModel, CadModelError, CadModelLimits, modelingGraphKey, modelingNodeParameters, modelingReusablePrefix, signedJson }
  = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
let provenance;
if (process.env.EVIDENCE_DIR) {
  const directory = resolve(process.env.EVIDENCE_DIR, 'modeling-constraints-admission-' + mode);
  mkdirSync(dirname(directory), { recursive: true }); mkdirSync(directory);
  const save = (name, bytes) => { writeFileSync(resolve(directory, name), bytes, { flag: 'wx' }); return { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) }; };
  provenance = { directory, entry, mode, testSHA256: sha256(readFileSync(fileURLToPath(import.meta.url))),
    virtualEntry: save('entry.mjs', virtualEntry), bundle: save('bundle.mjs', bundle.outputFiles[0].text),
    metafile: save('bundle.metafile.json', JSON.stringify(bundle.metafile, null, 2) + '\n'),
    inputs: save('input-hashes.json', JSON.stringify(Object.fromEntries(inputPaths.map(path => [path, sha256(readFileSync(resolve(path)))])), null, 2) + '\n'),
    replacedProviderBindings: [...providers.values()].sort() };
}
after(() => {
  const counts = Object.fromEntries([...new Set(state.calls.map(call => call.binding))].sort().map(binding => [binding, state.calls.filter(call => call.binding === binding).length]));
  if (provenance) writeFileSync(resolve(provenance.directory, 'receipt.json'), JSON.stringify({ issue: 1862, inheritedAdmissionIssue: 1835,
    scope: 'Actual modeling facade and unchanged pure helpers; isolated inert providers; admission and routing only, no geometric or solver acceptance',
    realNativeGeometryCalls: 0, unexpectedProviderAttempts: state.unexpected, inertProviderCalls: counts,
    fullTransitiveNativeCoverage: 'NOT_MEASURED', provenance }, null, 2) + '\n', { flag: 'wx' });
  delete globalThis[trapKey]; assert.deepEqual(state.unexpected, []); assert.equal(state.phase, 'closed');
});
function mockNative(action, { edit = null, error = undefined } = {}) {
  assert.equal(state.phase, 'closed'); state.phase = 'mock-native'; state.sketchEdit = edit; state.nativeError = error;
  try { return action(); } finally { state.phase = 'closed'; state.sketchEdit = null; state.nativeError = undefined; }
}
function refuses(action, code, operation, noProvider = true) {
  const before = state.calls.length; let caught;
  assert.throws(action, error => {
    caught = error; assert.ok(error instanceof CadModelError, String(error));
    if (code) assert.ok((Array.isArray(code) ? code : [code]).includes(error.code), `Expected ${code}, received ${error.code}`);
    if (operation) assert.equal(error.operation, operation); return true;
  });
  if (noProvider) assert.equal(state.calls.length, before, 'Admission refusal must precede every provider');
  assert.deepEqual(state.unexpected, []); return caught;
}
function frozen(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value); assert.ok(Object.isFrozen(value)); for (const child of Object.values(value)) frozen(child, seen);
}
function retained(snapshot) {
  return { save: snapshot.save(), json: JSON.stringify(snapshot), identities: Object.fromEntries(
    ['bodies', 'parameters', 'suppression', 'features', 'evidence', 'recomputation'].map(key => [key, snapshot[key]])) };
}
function unchanged(snapshot, before) {
  assert.equal(snapshot.save(), before.save); assert.equal(JSON.stringify(snapshot), before.json);
  for (const [key, value] of Object.entries(before.identities)) assert.equal(snapshot[key], value);
  frozen(snapshot);
}
function four(builder, { width = 32, height = 24, seedY = 1, originX = -0, reverse = false, redundant = false } = {}) {
  const a = builder.point([originX, 0]), b = builder.point([width, seedY]), c = builder.point([width, height]), d = builder.point([1, height]);
  builder.fixed(a); builder.fixed(c);
  builder.horizontal(a, b); builder.vertical(b, c); builder.horizontal(c, d); builder.vertical(d, a);
  if (redundant) builder.fixed(b);
  return reverse ? [a, d, c, b] : [a, b, c, d];
}
function authored(options = {}) {
  const model = createCadModel();
  const width = model.parameter('width', 32), height = model.parameter('height', 24), seedY = model.parameter('seedY', 1), depth = model.parameter('depth', 8);
  const sketch = model.sketch.constrainedPolygon(builder => four(builder, { width, height, seedY, ...options }));
  const part = sketch.extrude(depth);
  return { model, part, snapshot: mockNative(() => model.build({ part })) };
}
function assertRecovered(model) {
  const a = model.sketch.rectangle({ width: 8, height: 6 }).extrude(2), b = model.sketch.rectangle({ width: 4, height: 3 }).extrude(1);
  const recovered = mockNative(() => model.build({ a, b }));
  assert.equal(JSON.parse(recovered.save()).nodes.length, 4, 'Failed staging consumes no sketch/node budget');
  assert.deepEqual(recovered.features.map(feature => feature.kind), ['sketch', 'extrude', 'sketch', 'extrude']);
  return recovered;
}

// All tests below use only the actual facade plus immutable helper authority.
test('entry isolates all twenty-five providers; successful routing preserves the existing snapshot inventory', () => {
  const { snapshot } = authored();
  assert.equal(replaced.size, 25); assert.equal(inputPaths.length, pureModules.size);
  assert.deepEqual(Object.keys(snapshot).sort(), ['bodies', 'parameters', 'suppression', 'features', 'recomputation', 'evidence', 'withParameters', 'withSuppression', 'massProperties', 'exportStl', 'save'].sort());
  assert.equal(snapshot.bodies.part.family, 'convex-planar'); assert.equal(snapshot.bodies.part.native.controlOnly, marker);
  assert.deepEqual(snapshot.evidence.map(value => value.kind), ['sketch', 'extrude']);
  assert.deepEqual(snapshot.recomputation, { reusedFeatures: [], evaluatedFeatures: [0, 1] }); frozen(snapshot);
  assert.equal(CadModelLimits.nodes, 6); assert.equal(CadModelLimits.sketches, 2); assert.equal(CadModelLimits.extrusions, 2);
});

test('exact callback and builder arities reject missing and extra arguments before mutation', () => {
  const model = createCadModel(); let called = 0;
  for (const args of [[], [undefined], [null], [false], [0], [{}], [[], undefined], [() => { called++; }, undefined]])
    refuses(() => model.sketch.constrainedPolygon(...args), 'INPUT');
  assert.equal(called, 0);
  const sketch = model.sketch.constrainedPolygon(builder => {
    const a = builder.point([0, 0]), b = builder.point([8, 0]), c = builder.point([8, 6]), d = builder.point([0, 6]);
    for (const args of [[], [[0, 0], undefined], [[0, 0], 1, 2]]) refuses(() => builder.point(...args), 'INPUT');
    for (const args of [[], [a, undefined], [a, b]]) refuses(() => builder.fixed(...args), 'INPUT');
    for (const method of ['horizontal', 'vertical']) for (const args of [[], [a], [a, b, undefined], [a, b, c]]) refuses(() => builder[method](...args), 'INPUT');
    for (const point of [a, b, c, d]) builder.fixed(point); return [a, b, c, d];
  });
  const snapshot = mockNative(() => model.build({ part: sketch.extrude(2) }));
  assert.equal(JSON.parse(snapshot.save()).nodes[0].points.length, 4);
  assert.equal(JSON.parse(snapshot.save()).nodes[0].constraints.length, 4);
});

test('point coordinates reject sparse, exotic, accessor and extra-field arrays without invoking getters', () => {
  let reads = 0; const getter = [0, 0]; Object.defineProperty(getter, '0', { enumerable: true, get() { reads++; return 0; } });
  const hidden = [0, 0]; Object.defineProperty(hidden, 'extra', { value: 1 });
  const symbol = [0, 0]; symbol[Symbol('extra')] = 1;
  const inherited = [0, 0]; Object.setPrototypeOf(inherited, { 0: 0, 1: 0 });
  class PointArray extends Array { static get [Symbol.species]() { reads++; return Array; } }
  const invalid = [undefined, null, {}, [0], [0, 0, 0], new Array(2), getter, hidden, symbol, inherited, new PointArray(0, 0),
    [NaN, 0], [Infinity, 0], [10001, 0], ['0', 0], [{ parameter: 'width' }, 0], [{ kind: 'dimension-expression' }, 0]];
  for (const value of invalid) {
    const model = createCadModel(); refuses(() => model.sketch.constrainedPolygon(builder => { builder.point(value); return []; })); assertRecovered(model);
  }
  assert.equal(reads, 0);
});

test('opaque points are callback-local identities; copies, foreign models, previous callbacks and coordinate arrays refuse', () => {
  const first = createCadModel(); let stale;
  first.sketch.constrainedPolygon(builder => { const points = four(builder); stale = points[0]; return points; });
  assert.deepEqual(stale, { kind: 'sketch-point' }); assert.ok(Object.isFrozen(stale));
  const fakeGetter = { get kind() { throw new Error('HANDLE_GETTER_MUST_NOT_RUN'); } };
  for (const invalid of [stale, { ...stale }, { kind: 'sketch-point' }, Object.create(stale), fakeGetter, [0, 0], null, undefined]) {
    const model = createCadModel();
    refuses(() => model.sketch.constrainedPolygon(builder => { const points = four(builder); builder.fixed(invalid); return points; }), 'OWNERSHIP');
    assertRecovered(model);
  }
  refuses(() => first.sketch.constrainedPolygon(builder => { const points = four(builder); builder.horizontal(stale, points[1]); return points; }), 'OWNERSHIP');
  for (const method of ['fixed', 'horizontal', 'vertical']) {
    const model = createCadModel();
    refuses(() => model.sketch.constrainedPolygon(builder => { const points = four(builder); const copied = { ...points[0] }; builder[method](copied, ...(method === 'fixed' ? [] : [points[1]])); return points; }), 'OWNERSHIP');
  }
  const foreign = createCadModel().parameter('foreign', 4);
  refuses(() => createCadModel().sketch.constrainedPolygon(builder => { builder.point([foreign, 0]); return []; }), 'OWNERSHIP');
});

test('returned dense cycle must contain exactly all staged points once, from three through eight', () => {
  let reads = 0;
  const mutations = [points => points.slice(0, 2), points => [...points, points[0]], points => points.slice(0, 3),
    points => [...points.slice(0, 3), { ...points[3] }], points => { delete points[1]; return points; },
    points => { points.extra = 1; return points; }, points => { points[Symbol('extra')] = 1; return points; },
    points => Object.defineProperty(points, '0', { enumerable: true, get() { reads++; return null; } }),
    points => { Object.setPrototypeOf(points, { map() { reads++; return []; } }); return points; },
    () => undefined, () => null, () => ({}), () => 'points'];
  for (const mutate of mutations) {
    const model = createCadModel(); refuses(() => model.sketch.constrainedPolygon(builder => mutate(four(builder)))); assertRecovered(model);
  }
  const tooMany = createCadModel();
  refuses(() => tooMany.sketch.constrainedPolygon(builder => Array.from({ length: 9 }, (_, i) => builder.point([i, i % 2]))), 'BUDGET'); assertRecovered(tooMany);
  for (const count of [3, 8]) {
    const model = createCadModel(), profile = model.sketch.constrainedPolygon(builder => Array.from({ length: count }, (_, i) => {
      const point = builder.point([i, i % 2]); builder.fixed(point); return point;
    }));
    const snapshot = mockNative(() => model.build({ part: profile.extrude(1) }));
    assert.equal(JSON.parse(snapshot.save()).nodes[0].points.length, count, 'Admission boundary only; mock data establishes no convexity');
  }
  assert.equal(reads, 0);
});

test('H/V must join distinct adjacent returned-cycle points, including wraparound and reversed pair direction', () => {
  for (const method of ['horizontal', 'vertical']) for (const pair of [[0, 0], [0, 2]]) {
    const model = createCadModel(); refuses(() => model.sketch.constrainedPolygon(builder => { const points = four(builder); builder[method](points[pair[0]], points[pair[1]]); return points; })); assertRecovered(model);
  }
  const model = createCadModel(), sketch = model.sketch.constrainedPolygon(builder => {
    const points = four(builder); builder.horizontal(points[1], points[0]); builder.vertical(points[0], points[3]); return points;
  });
  const snapshot = mockNative(() => model.build({ part: sketch.extrude(1) }));
  const constraints = snapshot.evidence[0].native.document.constraints;
  assert.deepEqual(constraints.slice(-2), [{ id: 'c6', kind: 'horizontal', segmentId: 's0' }, { id: 'c7', kind: 'vertical', segmentId: 's3' }]);
  const changedCycle = createCadModel();
  refuses(() => changedCycle.sketch.constrainedPolygon(builder => { const points = four(builder); return [points[0], points[2], points[1], points[3]]; })); assertRecovered(changedCycle);
});

test('sixteen authored constraint records admit consistent duplicates; seventeenth refuses atomically', () => {
  const model = createCadModel(), sketch = model.sketch.constrainedPolygon(builder => {
    const points = four(builder); for (let i = 0; i < 10; i++) builder.fixed(points[0]); return points;
  });
  const snapshot = mockNative(() => model.build({ part: sketch.extrude(1) }), { edit(native) { native.report.redundantConstraintIds = ['c6', 'c15']; } });
  assert.equal(JSON.parse(snapshot.save()).nodes[0].constraints.length, 16);
  assert.deepEqual(snapshot.evidence[0].native.report.redundantConstraintIds, ['c6', 'c15'], 'Preserve mock diagnostic projection; no solver claim');
  const rejected = createCadModel();
  refuses(() => rejected.sketch.constrainedPolygon(builder => { const points = four(builder); for (let i = 0; i < 11; i++) builder.fixed(points[0]); return points; }), 'BUDGET'); assertRecovered(rejected);
});

test('builder seals in finally on success, caller throw and final cycle-admission failure', () => {
  for (const outcome of ['success', 'caller-error', 'bad-cycle']) {
    const model = createCadModel(); let leaked, points;
    const cause = new Error('ORIGINAL_CALLER_FAILURE');
    const action = () => model.sketch.constrainedPolygon(builder => {
      leaked = builder; points = four(builder); if (outcome === 'caller-error') throw cause;
      return outcome === 'bad-cycle' ? points.slice(0, 3) : points;
    });
    if (outcome === 'success') action();
    else { const error = refuses(action); if (outcome === 'caller-error') assert.equal(error.cause, cause); }
    for (const action of [() => leaked.point([2, 2]), () => leaked.fixed(points[0]), () => leaked.horizontal(points[0], points[1]), () => leaked.vertical(points[1], points[2]), () => leaked.parallelTo(points[0], points[1], [1, 3])]) refuses(action);
    if (outcome !== 'success') assertRecovered(model);
    else {
      const next = model.sketch.rectangle({ width: 4, height: 3 }).extrude(1);
      assert.equal(JSON.parse(mockNative(() => model.build({ next })).save()).nodes.length, 3);
    }
  }
});

test('a rejected final graph append seals its builder and leaves existing model state intact', () => {
  const model = createCadModel(), a = model.sketch.rectangle({ width: 8, height: 6 }).extrude(2), b = model.sketch.rectangle({ width: 4, height: 3 }).extrude(1);
  const accepted = mockNative(() => model.build({ a, b })), before = retained(accepted); let leaked, points;
  refuses(() => model.sketch.constrainedPolygon(builder => { leaked = builder; points = four(builder); return points; }), 'CAPABILITY');
  refuses(() => leaked.fixed(points[0]), 'OWNERSHIP');
  assert.equal(mockNative(() => model.build({ a, b })).save(), before.save); unchanged(accepted, before);
  const original = new CadModelError('PARAMETER', 'caller', 'Caller-owned typed refusal');
  const fresh = createCadModel(), error = refuses(() => fresh.sketch.constrainedPolygon(() => { throw original; }));
  assert.equal(error, original); assertRecovered(fresh);
});

test('async and thenable return admission never invokes then getters or adopts staged state', async () => {
  let reads = 0, adopted = 0;
  const factories = [points => Promise.resolve(points), points => ({ then(resolve) { adopted++; resolve(points); } }),
    () => ({ get then() { reads++; throw new Error('THEN_GETTER_MUST_NOT_RUN'); } }),
    points => Object.defineProperty(points, 'then', { get() { reads++; return () => { adopted++; }; } }),
    () => Object.create({ get then() { reads++; return () => { adopted++; }; } })];
  for (const factory of factories) {
    const model = createCadModel(); let leaked;
    refuses(() => model.sketch.constrainedPolygon(builder => { leaked = builder; return factory(four(builder)); }), 'INPUT');
    refuses(() => leaked.point([1, 1])); assertRecovered(model);
  }
  const model = createCadModel(); let leaked;
  refuses(() => model.sketch.constrainedPolygon(async builder => { leaked = builder; return four(builder); }), 'INPUT');
  if (leaked) refuses(() => leaked.point([1, 1])); assertRecovered(model);
  await Promise.resolve(); assert.equal(reads, 0); assert.equal(adopted, 0);
});

test('same-model mutation and reentry is guarded even through already-held shapes, sketches and selections', () => {
  const actions = [
    ({ model }) => model.parameter('hidden', 5),
    ({ model }) => model.sketch.rectangle({ width: 2, height: 2 }),
    ({ model }) => model.sketch.polygon([[0, 0], [2, 0], [0, 2]]),
    ({ model }) => model.sketch.circle({ center: [0, 0], radius: 1 }),
    ({ model }) => model.sketch.constrainedPolygon(() => { throw new Error('NESTED_CALLBACK_MUST_NOT_RUN'); }),
    ({ heldSketch }) => heldSketch.extrude(1),
    ({ a }) => a.hole({ center: [2, 2], radius: 1 }),
    ({ a }) => a.split({ axis: 'x', at: 2 }),
    ({ a, b }) => a.union(b), ({ a, b }) => a.intersect(b), ({ a, b }) => a.cut(b), ({ a, b }) => a.cut(b, { axis: 'x' }),
    ({ a }) => a.edges({ parallelTo: 'z' }), ({ query }) => query.one(),
    ({ a, selection }) => a.chamfer(selection, 1),
    ({ model, a }) => model.build({ a }),
  ];
  for (const mutate of actions) {
    const model = createCadModel(), heldSketch = model.sketch.rectangle({ width: 8, height: 6 });
    const a = heldSketch.extrude(2), b = heldSketch.extrude(3), query = a.edges({ parallelTo: 'z', at: { x: 'min', y: 'min' } }), selection = query.one();
    model.sketch.constrainedPolygon(builder => { const points = four(builder); refuses(() => mutate({ model, heldSketch, a, b, query, selection }), 'OWNERSHIP'); return points; });
    model.parameter('hidden', 5); // A refused nested registration must not have happened.
    const snapshot = mockNative(() => model.build({ a })), document = JSON.parse(snapshot.save());
    assert.equal(document.nodes.length, 4); assert.deepEqual(document.nodes.map(node => node.kind), ['sketch', 'extrude', 'extrude', 'sketch']);
    assert.deepEqual(document.parameters, { hidden: 5 });
  }
});

test('immutable dimension expressions and independent models remain usable during staging', () => {
  const model = createCadModel(), other = createCadModel(), width = model.parameter('width', 8); let expression, independent;
  const sketch = model.sketch.constrainedPolygon(builder => {
    expression = model.dimension.add(model.dimension.scale(width, 2), 1); assert.ok(Object.isFrozen(expression));
    const own = other.parameter('own', 6); independent = other.sketch.rectangle({ width: own, height: 3 }).extrude(1);
    return four(builder, { width: expression });
  });
  const snapshot = mockNative(() => model.build({ part: sketch.extrude(2) }));
  assert.equal(snapshot.evidence[0].native.document.points[1].position[0], 17);
  assert.equal(mockNative(() => other.build({ independent })).parameters.own, 6);
  const point = JSON.parse(snapshot.save()).nodes[0].points[1][0];
  assert.deepEqual(point, { op: 'add', left: { op: 'scale', value: { parameter: 'width' }, factor: 2 }, right: 1 });
});

test('cycle order owns serialized indices and native p/s/c IDs, fixed targets and adjacent segment mapping', () => {
  for (const reverse of [false, true]) {
    const start = state.calls.length, { snapshot } = authored({ reverse }), document = JSON.parse(snapshot.save());
    const node = document.nodes[0], native = snapshot.evidence[0].native.document, count = node.points.length;
    assert.equal(node.profile, 'constrained-polygon'); assert.deepEqual(Object.keys(node).sort(), ['constraints', 'kind', 'points', 'profile']);
    assert.deepEqual(native.points.map(point => point.id), ['p0', 'p1', 'p2', 'p3']);
    assert.deepEqual(native.segments, Array.from({ length: count }, (_, i) => ({ id: 's' + i, startPointId: 'p' + i, endPointId: 'p' + ((i + 1) % count) })));
    assert.deepEqual(native.referenceLines, []);
    const expected = reverse
      ? [{ kind: 'fixed', point: 0 }, { kind: 'fixed', point: 2 }, { kind: 'horizontal', points: [0, 3] }, { kind: 'vertical', points: [3, 2] }, { kind: 'horizontal', points: [2, 1] }, { kind: 'vertical', points: [1, 0] }]
      : [{ kind: 'fixed', point: 0 }, { kind: 'fixed', point: 2 }, { kind: 'horizontal', points: [0, 1] }, { kind: 'vertical', points: [1, 2] }, { kind: 'horizontal', points: [2, 3] }, { kind: 'vertical', points: [3, 0] }];
    assert.deepEqual(node.constraints, expected);
    assert.deepEqual(native.constraints, expected.map((constraint, i) => constraint.kind === 'fixed'
      ? { id: 'c' + i, kind: 'fixed', pointId: 'p' + constraint.point, target: native.points[constraint.point].position }
      : { id: 'c' + i, kind: constraint.kind, segmentId: 's' + (reverse ? 5 - i : i - 2) }));
    assert.equal(native.format, 'barocss-xy-affine-sketch'); assert.equal(native.profile, 'exact-affine-binary64'); assert.equal(native.id, 'm0_sk');
    const calls = state.calls.slice(start); assert.deepEqual(calls.map(call => call.binding), ['buildXYAffineSketch', 'buildXYAffineSketchPrism']);
    assert.equal(calls[0].args.length, 1); assert.equal(calls[1].args[0], snapshot.evidence[0].native);
    assert.deepEqual(calls[1].args[1].orderedSegmentIds, ['s0', 's1', 's2', 's3']);
    assert.equal(Object.is(node.points[0][0], -0), true); assert.equal(Object.is(native.constraints[0].target[0], -0), true);
  }
});

test('all fixed seed dimensions are copied at authoring; caller array mutation cannot change accepted state', () => {
  const model = createCadModel(), seed = [-0, 0]; let points;
  const profile = model.sketch.constrainedPolygon(builder => {
    const a = builder.point(seed), b = builder.point([8, 0]), c = builder.point([8, 6]), d = builder.point([0, 6]);
    points = [a, b, c, d]; points.forEach(point => builder.fixed(point)); seed[0] = 99; return points;
  });
  points.reverse();
  const snapshot = mockNative(() => model.build({ part: profile.extrude(2, { from: -1 }) }));
  assert.ok(Object.is(JSON.parse(snapshot.save()).nodes[0].points[0][0], -0));
  assert.equal(snapshot.evidence[1].native.request.options.fromMM, -1);
  assert.deepEqual(snapshot.evidence[0].native.document.points.map(point => point.position), [[-0, 0], [8, 0], [8, 6], [0, 6]]);
});

test('underconstrained mock native success is CAPABILITY/sketch with the complete frozen original cause and no prism', () => {
  for (const report of [{ fullyConstrained: false, degreesOfFreedom: 2, rank: 6 }, { fullyConstrained: true, degreesOfFreedom: 2, rank: 6 }, { fullyConstrained: false, degreesOfFreedom: 0, rank: 8 }]) {
    const model = createCadModel(), profile = model.sketch.constrainedPolygon(builder => four(builder)), part = profile.extrude(8), before = state.calls.length;
    const error = mockNative(() => refuses(() => model.build({ part }), 'CAPABILITY', 'sketch', false), { edit(native) {
      Object.assign(native.report, report); native.report.freeCoordinates = [{ pointId: 'p1', axis: 'x' }, { pointId: 'p2', axis: 'y' }];
      native.report.pivotCoordinates = native.report.pivotCoordinates.slice(0, report.rank);
    } });
    assert.deepEqual(state.calls.slice(before).map(call => call.binding), ['buildXYAffineSketch']);
    const complete = state.calls.at(-1).result; assert.equal(error.cause, complete); assert.deepEqual(error.cause.report.freeCoordinates, complete.report.freeCoordinates);
    assert.equal(error.cause.solution.source, marker); assert.equal(error.cause.report.rank, report.rank); frozen(error.cause);
  }
});

test('original typed native refusal is retained unchanged and prevents prism construction', () => {
  const model = createCadModel(), part = model.sketch.constrainedPolygon(builder => four(builder)).extrude(8);
  class MockXYAffineSketchError extends Error {
    constructor() { super('INERT conflict, not an actual solver diagnostic'); this.name = 'XYAffineSketchError'; this.code = 'CONFLICT'; this.constraintIds = ['c0', 'c6']; this.path = '$.constraints[6]'; this.coordinate = null; this.exactFraction = null; }
  }
  const cause = new MockXYAffineSketchError(), before = state.calls.length;
  const error = mockNative(() => refuses(() => model.build({ part }), 'NATIVE', 'sketch', false), { error: cause });
  assert.equal(error.cause, cause); assert.equal(error.cause.constructor, MockXYAffineSketchError);
  assert.deepEqual(state.calls.slice(before).map(call => call.binding), ['buildXYAffineSketch']);
});

test('strict authored codec refuses extra fields, unsupported constraints, invalid local references and diagonal pairs before providers', () => {
  const original = JSON.parse(authored().snapshot.save());
  const edits = [
    node => { node.extra = true; }, node => { delete node.constraints; }, node => { node.profile = 'constrained'; },
    node => { node.native = { ok: true }; }, node => { node.constraints = {}; }, node => { node.constraints = Array.from({ length: 17 }, () => ({ kind: 'fixed', point: 0 })); },
    node => { node.constraints[0].target = [0, 0]; }, node => { node.constraints[0].id = 'caller'; },
    node => { node.constraints[0].points = [0, 1]; }, node => { delete node.constraints[0].point; },
    node => { node.constraints[0].kind = 'coincident'; }, node => { node.constraints[0] = null; },
    node => { node.constraints[0].point = -1; }, node => { node.constraints[0].point = -0; }, node => { node.constraints[0].point = 4; },
    node => { node.constraints[0].point = 0.5; }, node => { node.constraints[0].point = 'p0'; }, node => { node.constraints[0].point = { node: 0, point: 0 }; },
    node => { node.constraints[2].points = [0, 0]; }, node => { node.constraints[2].points = [0, 2]; },
    node => { node.constraints[2].points = [0, 4]; }, node => { node.constraints[2].points = [-0, 1]; },
    node => { node.constraints[2].points = [0]; }, node => { node.constraints[2].points = [0, 1, 2]; },
    node => { node.constraints[2].points = ['p0', 'p1']; }, node => { node.constraints[2].point = 0; },
    node => { node.constraints[2].segmentId = 's0'; }, node => { node.constraints[2].points = [null, 1]; },
    node => { node.points = node.points.slice(0, 2); }, node => { node.points.push(...Array.from({ length: 5 }, () => [0, 0])); },
    node => { node.points[0] = [0, 0, 0]; }, node => { node.points[0] = { x: 0, y: 0 }; },
    node => { node.points[0][0] = { parameter: 'missing' }; }, node => { node.points[0][0] = { parameter: 'width', extra: 1 }; },
  ];
  for (const edit of edits) { const document = clone(original); edit(document.nodes[0]); refuses(() => loadCadModel(signedJson(document))); }
  const duplicate = signedJson(original).replace('"kind":"fixed"', '"kind":"fixed","kind":"fixed"');
  refuses(() => loadCadModel(duplicate), 'FORMAT');
  const extraGraph = clone(original); extraGraph.evidence = [{ native: { ok: true } }]; refuses(() => loadCadModel(signedJson(extraGraph)), 'INPUT');
});

test('constrained authored files load cold with identical bytes and retain all seed dependencies', () => {
  const { snapshot } = authored(), before = retained(snapshot), calls = state.calls.length;
  const loaded = mockNative(() => loadCadModel(snapshot.save()));
  assert.equal(loaded.save(), snapshot.save()); assert.deepEqual(loaded.bodies, snapshot.bodies); assert.deepEqual(loaded.evidence, snapshot.evidence);
  assert.deepEqual(loaded.recomputation, { reusedFeatures: [], evaluatedFeatures: [0, 1] });
  assert.deepEqual(state.calls.slice(calls).map(call => call.binding), ['buildXYAffineSketch', 'buildXYAffineSketchPrism']);
  const wider = mockNative(() => snapshot.withParameters({ width: 40 }));
  assert.deepEqual(wider.evidence[0].native.document.constraints[1], { id: 'c1', kind: 'fixed', pointId: 'p2', target: [40, 24] });
  assert.deepEqual(wider.recomputation, { reusedFeatures: [], evaluatedFeatures: [0, 1] });
  const changed = mockNative(() => snapshot.withParameters({ seedY: 2 }));
  assert.deepEqual(changed.recomputation, { reusedFeatures: [], evaluatedFeatures: [0, 1] });
  assert.equal(changed.evidence[0].native.document.points[1].position[1], 2, 'Even a seed coordinate later determined by H/V is authored dependency');
  const depthOnly = mockNative(() => snapshot.withParameters({ depth: 9 }));
  assert.deepEqual(depthOnly.recomputation, { reusedFeatures: [0], evaluatedFeatures: [1] }); assert.equal(depthOnly.evidence[0], snapshot.evidence[0]);
  const noChangeCalls = state.calls.length, noChange = mockNative(() => snapshot.withParameters({ width: 32 }));
  assert.deepEqual(noChange.recomputation, { reusedFeatures: [0, 1], evaluatedFeatures: [] }); assert.equal(state.calls.length, noChangeCalls);
  unchanged(snapshot, before);
});

test('failed native and underconstraint edits preserve the entire prior snapshot and recover from that original', () => {
  const { snapshot } = authored(), before = retained(snapshot), cause = new Error('INERT edit conflict');
  const nativeError = mockNative(() => refuses(() => snapshot.withParameters({ width: 40 }), 'NATIVE', 'sketch', false), { error: cause });
  assert.equal(nativeError.cause, cause); unchanged(snapshot, before);
  mockNative(() => refuses(() => snapshot.withParameters({ width: 40 }), 'CAPABILITY', 'sketch', false), { edit(native) { native.report.fullyConstrained = false; native.report.degreesOfFreedom = 2; } });
  unchanged(snapshot, before);
  const recovered = mockNative(() => snapshot.withParameters({ height: 16 }));
  assert.equal(recovered.parameters.height, 16); assert.deepEqual(recovered.recomputation, { reusedFeatures: [], evaluatedFeatures: [0, 1] });
  const same = mockNative(() => snapshot.withParameters({})); assert.equal(same.evidence[0], snapshot.evidence[0]); assert.equal(same.bodies.part, snapshot.bodies.part);
  unchanged(snapshot, before);
});

test('unchanged pure helpers include every seed and constraint in structural keys and distinguish signed zero', () => {
  const document = JSON.parse(authored().snapshot.save()), node = document.nodes[0], key = modelingGraphKey(document);
  assert.deepEqual(modelingNodeParameters(node), ['height', 'seedY', 'width']); assert.ok(Object.isFrozen(modelingNodeParameters(node)));
  const nested = clone(node); nested.points[1][0] = { op: 'add', left: { parameter: 'width' }, right: { op: 'scale', value: { parameter: 'derivedOnly' }, factor: 2 } };
  assert.deepEqual(modelingNodeParameters(nested), ['derivedOnly', 'height', 'seedY', 'width']);
  for (const change of [doc => { doc.nodes[0].constraints.reverse(); }, doc => { doc.nodes[0].constraints[0].point = 1; },
    doc => { doc.nodes[0].constraints[2].points.reverse(); }, doc => { doc.nodes[0].constraints[2].kind = 'vertical'; },
    doc => { doc.nodes[0].points[0][0] = 0; }, doc => { doc.nodes[0].points[1][1] = 7; }]) {
    const other = clone(document); change(other); assert.notEqual(modelingGraphKey(other), key);
  }
  const valuesOnly = clone(document); valuesOnly.parameters.width = 99; assert.equal(modelingGraphKey(valuesOnly), key);
  const names = document.nodes.map(modelingNodeParameters), parameters = document.parameters;
  assert.equal(modelingReusablePrefix(true, key, key, { ...parameters, width: 40 }, parameters, names), 0);
  assert.equal(modelingReusablePrefix(true, key, key, { ...parameters, depth: 9 }, parameters, names), 1);
  assert.equal(modelingReusablePrefix(true, key, key, parameters, parameters, names), 2);
  assert.equal(modelingReusablePrefix(false, key, key, parameters, parameters, names), 0);
  assert.equal(modelingReusablePrefix(true, key + 'other', key, parameters, parameters, names), 0);
  assert.equal(modelingReusablePrefix(true, key, key, { ...parameters, seedY: -0 }, { ...parameters, seedY: 0 }, names), 0);
  const signed = authored({ originX: -0 }).snapshot, plus = authored({ originX: 0 }).snapshot;
  assert.notEqual(signed.save(), plus.save()); assert.ok(Object.is(JSON.parse(mockNative(() => loadCadModel(signed.save())).save()).nodes[0].points[0][0], -0));
});

test('old polygon, rectangle and circle bytes and native paths remain unchanged', () => {
  const documents = [
    { node: { kind: 'sketch', profile: 'polygon', points: [[-0, 0], [8, 0], [8, 6], [0, 6]] }, author: model => model.sketch.polygon([[-0, 0], [8, 0], [8, 6], [0, 6]]), bindings: ['buildXYAffineSketch', 'buildXYAffineSketchPrism'] },
    { node: { kind: 'sketch', profile: 'rectangle', min: [-0, 0], max: [8, 6] }, author: model => model.sketch.rectangle({ min: [-0, 0], max: [8, 6] }), bindings: ['buildXYAffineSketch', 'buildXYAffineSketchPrism'] },
    { node: { kind: 'sketch', profile: 'circle', center: [8, 6], radius: 2 }, author: model => model.sketch.circle({ center: [8, 6], radius: 2 }), bindings: ['buildXYArc', 'buildXYCirclePrismShell', 'qualifyStoredCirclePrismSolid'] },
  ];
  for (const { node, author, bindings } of documents) {
    const model = createCadModel(), part = author(model).extrude(2), calls = state.calls.length;
    const snapshot = mockNative(() => model.build({ part }));
    const expected = signedJson({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [node, { kind: 'extrude', sketch: 0, height: 2 }], outputs: { part: { node: 1, side: 'solid' } } }) + '\n';
    assert.equal(snapshot.save(), expected); assert.deepEqual(state.calls.slice(calls).map(call => call.binding), bindings);
    const loadStart = state.calls.length; assert.equal(mockNative(() => loadCadModel(expected)).save(), expected);
    assert.deepEqual(state.calls.slice(loadStart).map(call => call.binding), bindings);
    if (node.profile !== 'circle') assert.deepEqual(snapshot.evidence[0].native.document.constraints.map(constraint => constraint.id), ['fix0', 'fix1', 'fix2', 'fix3']);
  }
});

test('a constrained polygon never becomes an authored rectangle for integer-box or plate-hole shortcuts', () => {
  const model = createCadModel(), part = model.sketch.constrainedPolygon(builder => four(builder)).extrude(8);
  const box = model.sketch.rectangle({ width: 4, height: 4 }).extrude(8);
  refuses(() => part.hole({ center: [2, 2], radius: 1 }), 'CAPABILITY');
  refuses(() => part.union(box), 'CAPABILITY'); refuses(() => part.cut(box), 'CAPABILITY'); refuses(() => box.cut(part), 'CAPABILITY');
});

function gussetControl(direction = [1, 3], reverse = false) {
  const model = createCadModel(), width = model.parameter('width', 40), height = model.parameter('height', 24);
  const profile = model.sketch.constrainedPolygon(s => {
    const a = s.point([-0, 0]), b = s.point([width, 0]), c = s.point([width, height]), d = s.point([1, height]);
    s.fixed(a); s.fixed(b); s.fixed(c); s.horizontal(c, d); s.parallelTo(...(reverse ? [a, d] : [d, a]), direction);
    return [a, b, c, d];
  });
  return { model, snapshot: mockNative(() => model.build({ gusset: profile.extrude(8) })) };
}
test('parallelTo rejects invalid arity, ownership and dimensionless data without consuming constraints', () => {
  const model = createCadModel(), length = model.parameter('length', 3), expression = model.dimension.scale(length, 2);
  let stale, leaked;
  createCadModel().sketch.constrainedPolygon(s => { const points = four(s); stale = points[0]; return points; });
  const profile = model.sketch.constrainedPolygon(s => {
    leaked = s; const points = four(s), [a, b] = points;
    for (const args of [[], [a], [a, b], [a, b, [1, 3], undefined]]) refuses(() => s.parallelTo(...args), 'INPUT');
    for (const invalid of [stale, { ...a }, {}, null]) refuses(() => s.parallelTo(invalid, b, [1, 3]), 'OWNERSHIP');
    refuses(() => s.parallelTo(a, a, [1, 3]), 'INPUT');
    for (const invalid of [[0, -0], [Infinity, 1], [NaN, 1], [10001, 1], [1, -10001], [length, 1], [1, expression], ['1', 3], null, {}, [], [1], [1, 2, 3]])
      refuses(() => s.parallelTo(a, b, invalid));
    s.parallelTo(a, b, [10000, -10000]); return points;
  });
  refuses(() => leaked.parallelTo(stale, stale, [1, 3]), 'OWNERSHIP');
  const snapshot = mockNative(() => model.build({ part: profile.extrude(1) }));
  assert.equal(JSON.parse(snapshot.save()).nodes[0].constraints.length, 7);
  assert.equal(snapshot.evidence[0].native.document.referenceLines.length, 1);
  const diagonal = createCadModel();
  refuses(() => diagonal.sketch.constrainedPolygon(s => { const points = four(s); s.parallelTo(points[0], points[2], [1, 3]); return points; }), 'INPUT'); assertRecovered(diagonal);
});
test('parallel directions are exact copied own tuples with stable native IDs, endpoint mapping and signed keys', () => {
  for (const reverse of [false, true]) for (const direction of [[1, 3], [-1, -3], [-0, 1], [0, -1]]) {
    const original = [...direction], { snapshot } = gussetControl(direction, reverse); direction[0] = 999;
    const doc = JSON.parse(snapshot.save()), constraint = doc.nodes[0].constraints[4], native = snapshot.evidence[0].native.document;
    assert.deepEqual(constraint, { kind: 'parallel-to-direction', points: reverse ? [0, 3] : [3, 0], direction: original });
    assert.deepEqual(native.referenceLines, [{ id: 'dir4', anchor: [0, 0], direction: original }]);
    assert.deepEqual(native.constraints[4], { id: 'c4', kind: 'segment-parallel-to-fixed-direction', segmentId: 's3', referenceLineId: 'dir4' });
    assert.equal(mockNative(() => loadCadModel(snapshot.save())).save(), snapshot.save());
    assert.deepEqual(modelingNodeParameters(doc.nodes[0]), ['height', 'width']);
    const key = modelingGraphKey(doc), changed = clone(doc); changed.nodes[0].constraints[4].direction.reverse();
    assert.notEqual(modelingGraphKey(changed), key);
  }
  assert.notEqual(modelingGraphKey(JSON.parse(gussetControl([-0, 1]).snapshot.save())), modelingGraphKey(JSON.parse(gussetControl([0, 1]).snapshot.save())));
  let reads = 0;
  const accessor = [1, 3]; Object.defineProperty(accessor, '0', { enumerable: true, get() { reads++; throw Error('No getter'); } });
  const symbol = [1, 3]; symbol[Symbol('extra')] = 1;
  const extra = [1, 3]; extra.extra = 1;
  for (const direction of [accessor, symbol, extra, Object.assign(Object.create(null), { 0: 1, 1: 3, length: 2 })]) {
    const model = createCadModel(); refuses(() => model.sketch.constrainedPolygon(s => { const p = four(s); s.parallelTo(p[0], p[1], direction); return p; })); assertRecovered(model);
  }
  assert.equal(reads, 0);
});
test('parallel reference budget is eight, rejects a ninth atomically, and codec checks exact local intent', () => {
  const model = createCadModel(), profile = model.sketch.constrainedPolygon(s => {
    const p = [[0, 0], [8, 0], [8, 6], [0, 6]].map(v => s.point(v)); p.forEach(v => s.fixed(v));
    for (let i = 0; i < 8; i++) s.parallelTo(p[0], p[1], [1, i]);
    refuses(() => s.parallelTo(p[0], p[1], [1, 9]), 'BUDGET'); return p;
  });
  const snapshot = mockNative(() => model.build({ part: profile.extrude(1) })), text = snapshot.save(), document = JSON.parse(text);
  assert.equal(snapshot.evidence[0].native.document.referenceLines.length, 8);
  assert.equal(document.nodes[0].constraints.length, 12); assert.equal(mockNative(() => loadCadModel(text)).save(), text);
  for (const mutate of [c => { delete c.direction; }, c => { c.extra = 1; }, c => { c.direction = [0, 0]; }, c => { c.direction = [{ parameter: 'width' }, 1]; },
    c => { c.direction = [1, 3, 4]; }, c => { c.points = [0, 2]; }, c => { c.points = [0, 9]; }, c => { c.points = [-0, 1]; }, c => { c.points = [0, 0]; }]) {
    const broken = clone(document); mutate(broken.nodes[0].constraints[4]); refuses(() => loadCadModel(signedJson(broken)));
  }
  const excessive = clone(document); excessive.nodes[0].constraints.push(clone(excessive.nodes[0].constraints[4]));
  refuses(() => loadCadModel(signedJson(excessive)), 'BUDGET'); assert.equal(snapshot.save(), text);
});
