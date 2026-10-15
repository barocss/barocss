import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// ZERO-NATIVE admission/routing controls for #2009. Every construction, solver,
// compiler and mass binding is replaced before importing the actual facade.
// Deliberately inert bodies/reports below prove no geometry or native lineage.
// Use CAD_MODEL_LINEAR_PATTERN_COUNTS_ENTRY=.../src/modeling.ts or .../dist/modeling.js.
// A prebundled index has erased the provider boundary and is never admitted.
const entry = resolve(process.env.CAD_MODEL_LINEAR_PATTERN_COUNTS_ENTRY ?? fileURLToPath(new URL('../dist/modeling.js', import.meta.url)));
assert.match(basename(entry), /^modeling\.(?:ts|js)$/, 'Use the actual source or emitted modeling entry');
const mode = extname(entry) === '.ts' ? 'source' : 'emitted';
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? fileURLToPath(new URL('../../..', import.meta.url)), 'package.json'));
const { build } = require('esbuild');
const trapKey = Symbol.for('barocss.modeling-linear-pattern-counts.admission-trap');
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
const pureModules = new Set(['modeling', 'cad-document', 'data-copy', 'xy-affine-prism-feature-document-internal',
  'modeling-regeneration-internal', 'modeling-dimension-internal']);
const replaced = new Set(), state = { phase: 'closed', calls: [], unexpected: [], patternError: undefined };
const clone = value => structuredClone(value);
const marker = 'INERT_LINEAR_PATTERN_CONTROL_NOT_GEOMETRY';
// Selector-routing data only. These four vertices/two edges are deliberately
// not a closed Solid and never establish native finishing/copy correctness.
function inertFinishedSolid(solidId) {
  const vertices = [[0, 0, 8], [32, 0, 8], [0, 24, 8], [32, 24, 8]].map((pointMM, i) => ({ id: 'v' + i, pointMM }));
  const edges = [[0, 1], [2, 3]].map((pair, i) => ({ id: 'e' + i, vertexIds: pair.map(j => 'v' + j),
    uses: [0, 1].map(j => ({ sourceId: solidId + '_src' + j, faceId: 'face' + j, surfaceId: 'surface' + j,
      loopId: 'loop' + j, use: { id: 'use' + i + j, curveId: 'curve' + i + j, pcurveId: 'uv' + i + j } })) }));
  return { controlOnly: marker, request: { options: { solidId } }, graph: { vertices, edges } };
}
function dispatch(binding, args) {
  if (state.phase !== 'mock-native') {
    state.unexpected.push(binding); throw new Error('UNEXPECTED_PROVIDER_ATTEMPT: ' + binding);
  }
  const call = { binding, args }; state.calls.push(call);
  if (binding === 'buildXYAffineSketch') return call.result = { controlOnly: marker, document: clone(args[0]),
    solution: { points: clone(args[0].points) }, report: { controlOnly: marker, fullyConstrained: true, degreesOfFreedom: 0 } };
  if (binding === 'buildXYAffineSketchPrism') return call.result = { controlOnly: marker,
    request: { sketch: clone(args[0]), options: clone(args[1]) },
    solid: state.finished ? inertFinishedSolid(args[1].solidId)
      : { controlOnly: marker, sourceId: args[1].sourceId, solidId: args[1].solidId, authoredOptions: clone(args[1]) },
    report: { controlOnly: marker }, lineage: { controlOnly: marker } };
  if (binding === 'chamferConvexPlanarSolid' && state.finished) {
    if (state.chamferError) throw state.chamferError;
    return call.result = { controlOnly: marker, request: { parent: args[0] },
      split: { negative: { kind: 'solid', solid: inertFinishedSolid(args[3].retainedSolidId) } } };
  }
  if (binding === 'buildModelingLinearPattern') {
    if (state.patternError !== undefined) throw state.patternError;
    const count = args.length === 3 ? 3 : args[3];
    const copies = Array.from({length:count-1},(_,index)=>index+1).map(instance => ({ controlOnly: marker,
      request: { parent: clone(args[0]), offsetMM: args[1].map(value => value * instance), prefix: args[2] + '_i' + instance },
      solid: { controlOnly: marker, solidId: args[2] + '_i' + instance + '_inert_solid', source: clone(args[0]),
        offsetMM: args[1].map(value => value * instance) },
      report: { controlOnly: marker, instance, nested: { sentinel: 'complete-inert-child-report' } },
      lineage: { controlOnly: marker, sentinel: ['not-a-geometric-correspondence'] } }));
    return call.result = { controlOnly: marker, request: { parent: clone(args[0]), stepMM: clone(args[1]), prefix: args[2], ...(count===3?{}:{count}) }, copies,
      report: { controlOnly: marker, childReports: copies.map(copy => copy.report), nested: { sentinel: 'complete-inert-pattern-report' } } };
  }
  // Legacy route stubs establish facade/file compatibility only.
  if (['buildModelingTranslation', 'buildModelingRotation', 'buildModelingMirror', 'buildModelingScale'].includes(binding))
    return call.result = { controlOnly: marker, solid: { controlOnly: marker, solidId: args[2] + '_legacy_inert_solid' },
      report: { controlOnly: marker }, lineage: { controlOnly: marker } };
  if (binding === 'buildXYArc') return call.result = { controlOnly: marker, curve: { id: args[0].id }, report: { centerMM: args[0].center, radiusMM: args[0].radius } };
  if (binding === 'buildXYCirclePrismShell' || binding === 'qualifyStoredCirclePrismSolid') return call.result = { controlOnly: marker };
  state.unexpected.push(binding); throw new Error('UNUSED_MOCK_PROVIDER: ' + binding);
}
globalThis[trapKey] = { dispatch };
const virtualEntry = `export * from ${JSON.stringify(entry)};
export { modelingGraphKey, modelingNodeParameters, modelingReusablePrefix } from './modeling-regeneration-internal.js';
export { signedJson } from './xy-affine-prism-feature-document-internal.js';`;
const bundle = await build({ stdin: { contents: virtualEntry, resolveDir: dirname(entry), sourcefile: 'linear-pattern-counts-test-entry.mjs', loader: 'js' },
  bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true,
  plugins: [{ name: 'modeling-linear-pattern-zero-native-provider-trap', setup(build) {
    build.onResolve({ filter: /\.(?:ts|js)$/ }, args => {
      const key = basename(args.path, extname(args.path));
      if (providers.has(key)) { replaced.add(key); return { path: key, namespace: 'linear-pattern-trap' }; }
      assert.ok(pureModules.has(key), 'Unreviewed implementation cannot enter zero-native bundle: ' + args.path);
    });
    build.onLoad({ filter: /.*/, namespace: 'linear-pattern-trap' }, args => ({ loader: 'js', contents: `
      // INERT TEST BINDING: no original implementation is imported or called.
      export function ${providers.get(args.path)}(...args) {
        return globalThis[Symbol.for('barocss.modeling-linear-pattern-counts.admission-trap')].dispatch(${JSON.stringify(providers.get(args.path))}, args);
      }` }));
  } }] });
assert.deepEqual([...replaced].sort(), [...providers.keys()].sort(), 'Every native provider binding is replaced');
const inputPaths = Object.keys(bundle.metafile.inputs).filter(path => !path.startsWith('linear-pattern-trap:') && !path.endsWith('linear-pattern-counts-test-entry.mjs')).sort();
assert.equal(inputPaths.length, pureModules.size);
for (const path of inputPaths) assert.ok(pureModules.has(basename(path, extname(path))), 'No native implementation in bundle: ' + path);
const { createCadModel, loadCadModel, CadModelError, CadModelLimits, signedJson }
  = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
let provenance;
if (process.env.EVIDENCE_DIR) {
  const directory = resolve(process.env.EVIDENCE_DIR, 'modeling-linear-pattern-counts-admission-' + mode);
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
  if (provenance) writeFileSync(resolve(provenance.directory, 'receipt.json'), JSON.stringify({ issue: 2009,
    scope: 'Actual modeling facade and unchanged pure helpers; isolated inert providers; admission and routing only, no geometric acceptance',
    realNativeGeometryCalls: 0, unexpectedProviderAttempts: state.unexpected, inertProviderCalls: counts,
    fullTransitiveNativeCoverage: 'NOT_MEASURED', provenance }, null, 2) + '\n', { flag: 'wx' });
  delete globalThis[trapKey]; assert.deepEqual(state.unexpected, []); assert.equal(state.phase, 'closed');
});
function mockNative(action, error) {
  assert.equal(state.phase, 'closed'); state.phase = 'mock-native'; state.patternError = error;
  try { return action(); } finally { state.phase = 'closed'; state.patternError = undefined; }
}
function mockFinishing(action, chamferError) {
  assert.equal(state.finished, undefined); state.finished = true; state.chamferError = chamferError;
  try { return mockNative(action); } finally { delete state.finished; delete state.chamferError; }
}
function refuses(action, code, operation, noProvider = true) {
  const before = state.calls.length; let caught;
  assert.throws(action, error => {
    caught = error; assert.ok(error instanceof CadModelError, String(error));
    if (code) assert.ok((Array.isArray(code) ? code : [code]).includes(error.code), `Expected ${code}, received ${error.code}: ${error.message}`);
    else assert.notEqual(error.code, 'NATIVE');
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
const rectangle = model => model.sketch.rectangle({ width: 32, height: 24 });
function fixedPolygon(builder) {
  return [[0, 0], [32, 0], [32, 24], [0, 24]].map(value => { const point = builder.point(value); builder.fixed(point); return point; });
}

const options = (count = 4, spacing = 40, axis = 'x') => ({ axis, spacing, count });
const labels = count => ['original', ...Array.from({ length: count - 1 }, (_, i) => 'instance' + (i + 1))];
function part() { const model = createCadModel(), original = rectangle(model).extrude(8); return { model, original }; }
function patterned(count = 4, { axis = 'x', spacing = 40, finishing = false, expression = false } = {}) {
  const model = createCadModel(), distance = model.parameter('spacing', spacing), width = model.parameter('width', 32);
  let original = model.sketch.rectangle({ width, height: 24 }).extrude(8, { from: 3 });
  if (finishing) {
    original = original.chamfer(original.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), 1);
    original = original.chamfer(original.edges({ parallelTo: 'x', at: { y: 24, z: 'max' } }).one(), 2);
  }
  const tuple = original.linearPattern(options(count, expression ? model.dimension.add(model.dimension.scale(distance, 1), 0) : distance, axis));
  const build = () => model.build(Object.fromEntries(labels(count).map((name, i) => [name, tuple[i]])));
  const snapshot = finishing ? mockFinishing(build) : mockNative(build);
  return { model, original, tuple, snapshot };
}
function document(count = 4) {
  return { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [32, 24] }, { kind: 'extrude', sketch: 0, height: 8 },
    { kind: 'linear-pattern', parent: { node: 1, side: 'solid' }, axis: 'x', spacing: 40, count },
  ], outputs: Object.fromEntries(labels(count).map(name => [name, { node: name === 'original' ? 1 : 2, side: name === 'original' ? 'solid' : name }])) };
}
test('all25 providers are isolated; exact frozen tuple count and provider arity are preserved', () => {
  for (const count of [2, 3, 4]) {
    const start = state.calls.length, { original, tuple, snapshot } = patterned(count), calls = state.calls.slice(start), final = calls.at(-1);
    assert.equal(replaced.size, 25); assert.equal(inputPaths.length, pureModules.size);
    assert.equal(tuple.length, count); assert.ok(Object.isFrozen(tuple)); assert.equal(tuple[0], original); assert.equal(new Set(tuple).size, count);
    assert.deepEqual(calls.map(call => call.binding), ['buildXYAffineSketch', 'buildXYAffineSketchPrism', 'buildModelingLinearPattern']);
    assert.equal(final.args.length, count === 3 ? 3 : 4); if (count !== 3) assert.equal(final.args[3], count);
    assert.equal(final.args[0], snapshot.bodies.original.native); assert.equal(final.args[2], 'm2');
    assert.equal(final.result.copies.length, count - 1); assert.deepEqual(Object.keys(snapshot.bodies).sort(), labels(count).sort());
    for (let i = 1; i < count; i++) assert.equal(snapshot.bodies['instance' + i].native, final.result.copies[i - 1].solid);
    assert.equal(Object.hasOwn(final.result.request, 'count'), count !== 3); frozen(snapshot);
  }
});
test('all cardinal axes route independent copies from the same original and retain strict saved intent', () => {
  for (const count of [2, 4]) for (const [axis, component] of [['x', 0], ['y', 1], ['z', 2]]) {
    const { snapshot } = patterned(count, { axis }), native = snapshot.evidence[2].native, step = [0, 0, 0]; step[component] = 40;
    assert.deepEqual(native.request.stepMM, step); assert.equal(native.request.count, count);
    native.copies.forEach((copy, i) => { assert.deepEqual(copy.request.parent, snapshot.bodies.original.native); assert.deepEqual(copy.request.offsetMM, step.map(value => value * (i + 1))); });
    assert.deepEqual(JSON.parse(snapshot.save()).nodes[2], { kind: 'linear-pattern', parent: { node: 1, side: 'solid' }, axis, spacing: { parameter: 'spacing' }, count });
    assert.deepEqual(snapshot.features.map(feature => feature.dependencies), [[], [0], [1]]);
  }
});
test('count2 admits one large offset without a doubled-offset constraint', () => {
  for (const spacing of [5000.000000000001, 6000, 10000]) {
    const { snapshot } = patterned(2, { spacing }); assert.deepEqual(snapshot.evidence[2].native.copies.map(copy => copy.request.offsetMM), [[spacing, 0, 0]]);
  }
  for (const count of [3, 4]) { const { original } = part(); refuses(() => original.linearPattern(options(count, 6000)), 'PARAMETER', 'linearPattern'); }
});
test('count4 triple admission uses exact represented arithmetic and retains exact dyadic/subnormal cases', () => {
  for (const spacing of [.3, 1 / 3, .1, 3334]) { const { original } = part(); refuses(() => original.linearPattern(options(4, spacing)), 'PARAMETER', 'linearPattern'); }
  assert.equal((.3 * 3) / 3, .3); assert.equal(((1 / 3) * 3) / 3, 1 / 3);
  for (const spacing of [.5, 3333, Number.MIN_VALUE, Number.MIN_VALUE * 3, 2 ** -1022]) {
    const { original } = part(); assert.equal(original.linearPattern(options(4, spacing)).length, 4);
  }
  const { original } = part(); refuses(() => original.linearPattern(options(4, 10000 / 3)), 'PARAMETER', 'linearPattern');
});
test('unsupported counts, malformed records, receiver and callback ownership refuse before appending', () => {
  const { model, original } = part(); let reads = 0;
  for (const count of [0, 1, 5, 6, 2.1, '2', NaN, Infinity, undefined, model.parameter('count', 2)])
    refuses(() => original.linearPattern({ ...options(), count }), 'CAPABILITY', 'linearPattern');
  const getter = options(); Object.defineProperty(getter, 'count', { enumerable: true, get() { reads++; return 4; } });
  const symbol = options(); symbol[Symbol('extra')] = 1;
  for (const record of [getter, symbol, { ...options(), pivot: [0, 0, 0] }]) refuses(() => original.linearPattern(record), 'INPUT');
  const method = original.linearPattern; refuses(() => method(options()), 'OWNERSHIP'); refuses(() => method.call({ ...original }, options()), 'OWNERSHIP');
  const foreign = part().model.parameter('spacing', 40); refuses(() => original.linearPattern(options(4, foreign)), 'OWNERSHIP');
  model.sketch.constrainedPolygon(builder => { refuses(() => original.linearPattern(getter), 'OWNERSHIP'); return fixedPolygon(builder); });
  assert.equal(reads, 0); assert.equal(original.linearPattern(options()).length, 4);
});
test('strict codec limits instance references to the authored count before any geometry', () => {
  for (const count of [2, 3, 4]) {
    const data = document(count), snapshot = mockNative(() => loadCadModel(signedJson(data)));
    assert.equal(snapshot.save(), signedJson(data) + '\n'); assert.deepEqual(Object.keys(snapshot.bodies).sort(), labels(count).sort());
    for (const side of ['solid', 'negative', 'positive', 'instance0', 'instance4', ...(count === 2 ? ['instance2', 'instance3'] : count === 3 ? ['instance3'] : [])]) {
      const forged = structuredClone(data); forged.outputs.extra = { node: 2, side }; refuses(() => loadCadModel(signedJson(forged)), 'INPUT');
    }
    const extra = structuredClone(data); extra.outputs.extra = { node: 2, side: 'instance1', index: 1 }; refuses(() => loadCadModel(signedJson(extra)), 'INPUT');
    const cold = mockNative(() => loadCadModel(snapshot.save())); assert.equal(cold.save(), snapshot.save()); assert.deepEqual(cold.evidence, snapshot.evidence); frozen(cold);
  }
});
test('old count3 request, labels, tuple and save remain free of new optional slots', () => {
  const { snapshot, tuple } = patterned(3); assert.equal(tuple.length, 3);
  assert.deepEqual(Object.keys(snapshot.evidence[2].native.request), ['parent', 'stepMM', 'prefix']);
  assert.deepEqual(Object.keys(snapshot.bodies).sort(), ['instance1', 'instance2', 'original']);
  assert.equal(Object.hasOwn(snapshot.bodies, 'instance3'), false); assert.equal(snapshot.evidence[2].native.copies.length, 2);
});
test('one complete finishing chain stays a single terminal pattern feature with count2 or4', () => {
  for (const count of [2, 4]) {
    const { original, tuple, snapshot } = patterned(count, { finishing: true }); assert.equal(tuple[0], original);
    assert.deepEqual(snapshot.features.map(feature => feature.kind), ['sketch', 'extrude', 'chamfer', 'chamfer', 'linear-pattern']);
    assert.deepEqual(snapshot.features.at(-1).dependencies, [3]); assert.equal(snapshot.evidence[4].native.copies.length, count - 1);
  }
});
test('every copy and retained source remains terminal for selection, transforms and later features', () => {
  for (const count of [2, 4]) {
    const { model, tuple } = patterned(count);
    for (const shape of tuple) {
      refuses(() => shape.linearPattern(options()), 'CAPABILITY'); refuses(() => shape.translate([1, 0, 0]), 'CAPABILITY');
      refuses(() => shape.rotate({ axis: 'x', angleDegrees: 90 }), 'CAPABILITY'); refuses(() => shape.mirror({ plane: 'xz' }), 'CAPABILITY');
      refuses(() => shape.scale({ factor: 2 }), 'CAPABILITY'); refuses(() => shape.circularPattern({ axis: 'x', angleDegrees: 90, count: 4 }), 'CAPABILITY');
    }
    for (const shape of tuple.slice(1)) refuses(() => shape.edges({ parallelTo: 'x' }), 'CAPABILITY');
    refuses(() => rectangle(model), 'CAPABILITY');
  }
});
test('spacing dimensions and expressions reuse the complete source prefix and rebuild all requested copies', () => {
  for (const count of [2, 4]) for (const expression of [false, true]) {
    const { snapshot } = patterned(count, { expression }), held = retained(snapshot), start = state.calls.length;
    const next = mockNative(() => snapshot.withParameters({ spacing: 48 }));
    assert.deepEqual(state.calls.slice(start).map(call => call.binding), ['buildModelingLinearPattern']);
    assert.deepEqual(next.recomputation, { reusedFeatures: [0, 1], evaluatedFeatures: [2] }); assert.equal(next.bodies.original, snapshot.bodies.original);
    for (const name of labels(count).slice(1)) assert.notEqual(next.bodies[name], snapshot.bodies[name]); unchanged(snapshot, held);
    const calls = state.calls.length, noop = next.withParameters({ spacing: 48 }); assert.equal(state.calls.length, calls);
    assert.deepEqual(noop.recomputation, { reusedFeatures: [0, 1, 2], evaluatedFeatures: [] });
  }
});
test('invalid count4 spacing edits spend no provider work and retain accepted state', () => {
  const { snapshot } = patterned(4), held = retained(snapshot);
  for (const spacing of [.3, 1 / 3, 3334, 0, -0, -1]) refuses(() => snapshot.withParameters({ spacing }), 'PARAMETER', 'linearPattern');
  unchanged(snapshot, held);
});
test('native late-copy refusal preserves complete original cause without partial public outputs', () => {
  const { snapshot } = patterned(4), held = retained(snapshot), cause = Object.assign(new Error('INERT third copy refusal'),
    { name: 'ModelingLinearPatternError', code: 'BINDING', stage: 'copy-construction', report: { completedChildReports: [{ instance: 1 }, { instance: 2 }] } });
  const error = mockNative(() => refuses(() => snapshot.withParameters({ spacing: 48 }), 'NATIVE', 'linearPattern', false), cause);
  assert.equal(error.cause, cause); assert.equal(error.cause.report, cause.report); unchanged(snapshot, held);
  for (const field of ['copies', 'solid', 'bodies', 'evidence']) assert.equal(Object.hasOwn(error, field), false);
});


