import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// ZERO-NATIVE admission/routing controls for #1880. Every construction, solver,
// compiler and mass binding is replaced before importing the actual facade.
// Deliberately inert bodies/reports below prove no geometry or native lineage.
// Use CAD_MODEL_TRANSLATION_ENTRY=.../src/modeling.ts or .../dist/modeling.js.
// A prebundled index has erased the provider boundary and is never admitted.
const entry = resolve(process.env.CAD_MODEL_TRANSLATION_ENTRY ?? fileURLToPath(new URL('../dist/modeling.js', import.meta.url)));
assert.match(basename(entry), /^modeling\.(?:ts|js)$/, 'Use the actual source or emitted modeling entry');
const mode = extname(entry) === '.ts' ? 'source' : 'emitted';
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? fileURLToPath(new URL('../../..', import.meta.url)), 'package.json'));
const { build } = require('esbuild');
const trapKey = Symbol.for('barocss.modeling-translation.admission-trap');
assert.equal(globalThis[trapKey], undefined, 'Never replace another active trap');
const providers = new Map([
  ['xy-arc', 'buildXYArc'], ['xy-circle-prism-shell', 'buildXYCirclePrismShell'], ['stored-circle-prism-solid', 'qualifyStoredCirclePrismSolid'],
  ['xy-affine-sketch', 'buildXYAffineSketch'], ['xy-affine-sketch-prism', 'buildXYAffineSketchPrism'],
  ['convex-planar-slab-subtraction', 'subtractConvexPlanarSlab'], ['convex-planar-solid-intersection', 'intersectConvexPlanarSolids'],
  ['convex-planar-solid-split', 'splitConvexPlanarSolid'], ['model-compiler', 'compileCadModel'],
  ['convex-planar-solid-chamfer', 'chamferConvexPlanarSolid'], ['axis-box-boolean', 'buildAxisBoxSolidBoolean'],
  ['orthogonal-solid-boolean', 'buildOrthogonalSolidBoolean'], ['modeling-box-internal', 'buildModelingBox'],
  ['modeling-translation-internal', 'buildModelingTranslation'], ['modeling-rotation-internal', 'buildModelingRotation'], ['modeling-mirror-internal', 'buildModelingMirror'], ['modeling-scale-internal', 'buildModelingScale'], ['modeling-linear-pattern-internal', 'buildModelingLinearPattern'], ['modeling-stl-internal', 'buildModelingStl'],
  ['own-plate-circular-hole', 'buildOwnPlateCircularHole'], ['stored-plate-hole-solid', 'qualifyStoredPlateHoleSolid'],
  ['convex-planar-solid-mass', 'measureConvexPlanarSolidMass'], ['axis-box-solid-mass', 'measureAxisBoxSolidBooleanMass'],
]);
const pureModules = new Set(['modeling', 'cad-document', 'data-copy', 'xy-affine-prism-feature-document-internal',
  'modeling-regeneration-internal', 'modeling-dimension-internal']);
const replaced = new Set(), state = { phase: 'closed', calls: [], unexpected: [], translationError: undefined };
const clone = value => structuredClone(value);
const marker = 'INERT_TRANSLATION_CONTROL_NOT_GEOMETRY';
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
  if (binding === 'buildModelingTranslation') {
    if (state.translationError !== undefined) throw state.translationError;
    return call.result = { controlOnly: marker, parent: clone(args[0]), offsetMM: clone(args[1]),
      solid: { controlOnly: marker, sourceId: args[2] + '_inert_source', solidId: args[2] + '_inert_solid', offsetMM: clone(args[1]) },
      report: { controlOnly: marker, nested: { sentinel: 'complete-inert-report' } },
      lineage: { controlOnly: marker, sentinel: ['not-a-geometric-correspondence'] } };
  }
  if (binding === 'buildXYArc') return call.result = { controlOnly: marker, curve: { id: args[0].id }, report: { centerMM: args[0].center, radiusMM: args[0].radius } };
  if (binding === 'buildXYCirclePrismShell' || binding === 'qualifyStoredCirclePrismSolid') return call.result = { controlOnly: marker };
  state.unexpected.push(binding); throw new Error('UNUSED_MOCK_PROVIDER: ' + binding);
}
globalThis[trapKey] = { dispatch };
const virtualEntry = `export * from ${JSON.stringify(entry)};
export { modelingGraphKey, modelingNodeParameters, modelingReusablePrefix } from './modeling-regeneration-internal.js';
export { signedJson } from './xy-affine-prism-feature-document-internal.js';`;
const bundle = await build({ stdin: { contents: virtualEntry, resolveDir: dirname(entry), sourcefile: 'translation-test-entry.mjs', loader: 'js' },
  bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true,
  plugins: [{ name: 'modeling-translation-zero-native-provider-trap', setup(build) {
    build.onResolve({ filter: /\.(?:ts|js)$/ }, args => {
      const key = basename(args.path, extname(args.path));
      if (providers.has(key)) { replaced.add(key); return { path: key, namespace: 'translation-trap' }; }
      assert.ok(pureModules.has(key), 'Unreviewed implementation cannot enter zero-native bundle: ' + args.path);
    });
    build.onLoad({ filter: /.*/, namespace: 'translation-trap' }, args => ({ loader: 'js', contents: `
      // INERT TEST BINDING: no original implementation is imported or called.
      export function ${providers.get(args.path)}(...args) {
        return globalThis[Symbol.for('barocss.modeling-translation.admission-trap')].dispatch(${JSON.stringify(providers.get(args.path))}, args);
      }` }));
  } }] });
assert.deepEqual([...replaced].sort(), [...providers.keys()].sort(), 'Every native provider binding is replaced');
const inputPaths = Object.keys(bundle.metafile.inputs).filter(path => !path.startsWith('translation-trap:') && !path.endsWith('translation-test-entry.mjs')).sort();
assert.equal(inputPaths.length, pureModules.size);
for (const path of inputPaths) assert.ok(pureModules.has(basename(path, extname(path))), 'No native implementation in bundle: ' + path);
const { createCadModel, loadCadModel, CadModelError, CadModelLimits, modelingGraphKey, modelingNodeParameters, modelingReusablePrefix, signedJson }
  = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
let provenance;
if (process.env.EVIDENCE_DIR) {
  const directory = resolve(process.env.EVIDENCE_DIR, 'modeling-translation-admission-' + mode);
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
  if (provenance) writeFileSync(resolve(provenance.directory, 'receipt.json'), JSON.stringify({ issue: 1880,
    scope: 'Actual modeling facade and unchanged pure helpers; isolated inert providers; admission and routing only, no geometric acceptance',
    realNativeGeometryCalls: 0, unexpectedProviderAttempts: state.unexpected, inertProviderCalls: counts,
    fullTransitiveNativeCoverage: 'NOT_MEASURED', provenance }, null, 2) + '\n', { flag: 'wx' });
  delete globalThis[trapKey]; assert.deepEqual(state.unexpected, []); assert.equal(state.phase, 'closed');
});
function mockNative(action, error) {
  assert.equal(state.phase, 'closed'); state.phase = 'mock-native'; state.translationError = error;
  try { return action(); } finally { state.phase = 'closed'; state.translationError = undefined; }
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
function authored({ expressions = false } = {}) {
  const model = createCadModel(), width = model.parameter('width', 32), depth = model.parameter('depth', 8);
  const spacing = model.parameter('spacing', 48), offsetY = model.parameter('offsetY', -0), offsetZ = model.parameter('offsetZ', 0);
  const parent = model.sketch.rectangle({ width, height: 24 }).extrude(depth);
  const offset = expressions ? [model.dimension.add(spacing, 0), model.dimension.scale(offsetY, 1), model.dimension.scale(offsetZ, 1)] : [spacing, offsetY, offsetZ];
  const right = parent.translate(offset), snapshot = mockNative(() => model.build({ left: parent, right }));
  return { model, parent, right, snapshot };
}
function document() {
  return { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { spacing: 48 }, nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [32, 24] },
    { kind: 'extrude', sketch: 0, height: 8 },
    { kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [{ parameter: 'spacing' }, -0, 0] },
  ], outputs: { left: { node: 1, side: 'solid' }, right: { node: 2, side: 'solid' } } };
}
const checkDocument = (edit, code, operation) => { const d = document(); edit(d); return refuses(() => loadCadModel(signedJson(d)), code, operation); };

// All successes below use facade routing and explicitly non-geometric stubs.
test('all twenty-three provider bindings are isolated; translate retains the existing convex wrapper and snapshot inventory', () => {
  const before = state.calls.length, { snapshot } = authored(), calls = state.calls.slice(before), translation = calls.at(-1);
  assert.equal(replaced.size, 23); assert.equal(inputPaths.length, pureModules.size);
  assert.deepEqual(calls.map(call => call.binding), ['buildXYAffineSketch', 'buildXYAffineSketchPrism', 'buildModelingTranslation']);
  assert.equal(translation.args.length, 3); assert.equal(translation.args[0], snapshot.bodies.left.native);
  assert.deepEqual(translation.args[1], [48, -0, 0]); assert.equal(translation.args[2], 'm2');
  assert.deepEqual(Object.keys(snapshot).sort(), ['bodies', 'parameters', 'suppression', 'features', 'recomputation', 'evidence', 'withParameters', 'withSuppression', 'massProperties', 'exportStl', 'save'].sort());
  assert.equal(snapshot.bodies.right.family, 'convex-planar'); assert.equal(snapshot.bodies.right.native, translation.result.solid);
  assert.equal(snapshot.evidence[2].kind, 'translate'); assert.equal(snapshot.evidence[2].native, translation.result);
  assert.deepEqual(snapshot.evidence[2].native.parent, snapshot.bodies.left.native);
  assert.notEqual(snapshot.evidence[2].native.parent, snapshot.bodies.left.native, 'Copied native parent has no caller-identity promise');
  assert.equal(snapshot.evidence[2].native.report.nested.sentinel, 'complete-inert-report');
  assert.deepEqual(snapshot.features, [{ kind: 'sketch', index: 0, dependencies: [] }, { kind: 'extrude', index: 1, dependencies: [0] }, { kind: 'translate', index: 2, dependencies: [1] }]);
  assert.deepEqual(snapshot.recomputation, { reusedFeatures: [], evaluatedFeatures: [0, 1, 2] }); frozen(snapshot);
  assert.equal(CadModelLimits.nodes, 6); assert.equal(CadModelLimits.sketches, 2); assert.equal(CadModelLimits.extrusions, 2);
});

test('one exact translate argument is required; missing and extra arguments consume no node or translation slot', () => {
  const model = createCadModel(), parent = rectangle(model).extrude(8);
  for (const args of [[], [undefined], [null], [[1, 0, 0], undefined], [[1, 0, 0], 1], [[1, 0, 0], 1, 2]])
    refuses(() => parent.translate(...args), 'INPUT', 'translate');
  const right = parent.translate([1, 0, 0]), snapshot = mockNative(() => model.build({ left: parent, right }));
  assert.deepEqual(JSON.parse(snapshot.save()).nodes.map(node => node.kind), ['sketch', 'extrude', 'translate']);
  refuses(() => parent.translate([2, 0, 0]), 'CAPABILITY', 'translate');
});

test('offset requires a dense ordinary three-tuple with no accessors, symbols, inherited indices or extra fields', () => {
  const model = createCadModel(), parent = rectangle(model).extrude(8); let reads = 0;
  const getter = [0, 0, 0]; Object.defineProperty(getter, '1', { enumerable: true, get() { reads++; return 0; } });
  const hidden = [0, 0, 0]; Object.defineProperty(hidden, 'extra', { value: 1 });
  const symbol = [0, 0, 0]; symbol[Symbol('extra')] = 1;
  const inherited = [0, 0, 0]; Object.setPrototypeOf(inherited, { 0: 0, 1: 0, 2: 0 });
  const nonenumerable = [0, 0, 0]; Object.defineProperty(nonenumerable, '1', { value: 0, enumerable: false });
  class Vector extends Array { static get [Symbol.species]() { reads++; return Array; } }
  for (const offset of [{ x: 0, y: 0, z: 0 }, { 0: 0, 1: 0, 2: 0, length: 3 }, '0,0,0', new Float64Array(3),
    [], [0], [0, 0], [0, 0, 0, 0], new Array(3), [0, , 0], getter, hidden, symbol, inherited, nonenumerable, new Vector(0, 0, 0)])
    refuses(() => parent.translate(offset), ['INPUT', 'BUDGET']);
  assert.equal(reads, 0);
  const offset = [1, -0, 2], right = parent.translate(offset); offset[0] = 99; offset.push(3);
  const snapshot = mockNative(() => model.build({ right }));
  assert.deepEqual(JSON.parse(snapshot.save()).nodes[2].offset, [1, -0, 2]);
});

test('every vector component requires a finite bounded literal or this model’s original dimension identity', () => {
  for (const axis of [0, 1, 2]) {
    const model = createCadModel(), own = model.parameter('offset', 2), expression = model.dimension.scale(own, -1), foreign = createCadModel();
    const foreignParameter = foreign.parameter('offset', 2), foreignExpression = foreign.dimension.scale(foreignParameter, -1), parent = rectangle(model).extrude(8);
    for (const value of [foreignParameter, foreignExpression, { ...own }, { ...expression }, Object.create(own),
      { parameter: 'offset' }, { op: 'scale', value: own, factor: 1 }, null, undefined, true, '2', [], {}]) {
      const vector = [0, 0, 0]; vector[axis] = value; refuses(() => parent.translate(vector), 'OWNERSHIP');
    }
    for (const value of [NaN, Infinity, -Infinity, 10001, -10001]) {
      const vector = [0, 0, 0]; vector[axis] = value; refuses(() => parent.translate(vector), 'PARAMETER');
    }
    const vector = [0, 0, 0]; vector[axis] = expression;
    const right = parent.translate(vector), snapshot = mockNative(() => model.build({ right }));
    assert.equal(snapshot.evidence[2].native.offsetMM[axis], -2);
  }
});

test('copied, inherited and foreign shape receivers and output handles refuse before append', () => {
  const model = createCadModel(), parent = rectangle(model).extrude(8), foreign = rectangle(createCadModel()).extrude(8);
  for (const receiver of [{ ...parent }, Object.create(parent), foreign, {}, null, undefined])
    refuses(() => parent.translate.call(receiver, [1, 0, 0]), 'OWNERSHIP', 'translate');
  const right = parent.translate([1, 0, 0]);
  for (const invalid of [{ ...right }, Object.create(right), foreign, null, undefined]) refuses(() => model.build({ right: invalid }), 'OWNERSHIP');
  const other = createCadModel(); refuses(() => other.build({ right }), 'OWNERSHIP');
  assert.equal(JSON.parse(mockNative(() => model.build({ right })).save()).nodes.length, 3);
});

test('same-model translate is fenced during constrained callbacks, and the callback builder seals on every exit', () => {
  for (const outcome of ['success', 'throw', 'bad-cycle']) {
    const model = createCadModel(), parent = rectangle(model).extrude(8), cause = new Error('CALLER_CONTROL_FAILURE'); let leaked;
    const action = () => model.sketch.constrainedPolygon(builder => {
      leaked = builder; const points = fixedPolygon(builder);
      refuses(() => parent.translate([1, 0, 0]), 'OWNERSHIP', 'translate');
      if (outcome === 'throw') throw cause;
      return outcome === 'bad-cycle' ? points.slice(0, 3) : points;
    });
    if (outcome === 'success') action(); else { const error = refuses(action); if (outcome === 'throw') assert.equal(error.cause, cause); }
    refuses(() => leaked.point([1, 1]), 'OWNERSHIP');
    const right = parent.translate([1, 0, 0]), snapshot = mockNative(() => model.build({ right }));
    assert.equal(JSON.parse(snapshot.save()).nodes.length, outcome === 'success' ? 4 : 3);
  }
});

test('rectangle, polygon and constrained direct affine extrusions admit translation with omitted or explicit placement', () => {
  for (const profile of ['rectangle', 'polygon', 'constrained-polygon']) for (const placed of [false, true]) {
    const model = createCadModel(), sketch = profile === 'rectangle' ? rectangle(model)
      : profile === 'polygon' ? model.sketch.polygon([[0, 0], [32, 0], [0, 24]]) : model.sketch.constrainedPolygon(fixedPolygon);
    const parent = placed ? sketch.extrude(8, { from: -2 }) : sketch.extrude(8), right = parent.translate([-8, -0, 4]);
    const snapshot = mockNative(() => model.build({ left: parent, right }));
    assert.equal(snapshot.bodies.right.family, 'convex-planar'); assert.deepEqual(snapshot.evidence[2].native.offsetMM, [-8, -0, 4]);
    assert.equal(Object.hasOwn(snapshot.evidence[1].native.request.options, 'fromMM'), placed);
  }
});

test('circle refusals do not spend the slot; Boolean, split, hole and unrelated chamfer graphs refuse', () => {
  const model = createCadModel(), circle = model.sketch.circle({ center: [0, 0], radius: 2 }).extrude(8);
  refuses(() => circle.translate([1, 0, 0]), 'CAPABILITY', 'translate');
  const parent = rectangle(model).extrude(8), right = parent.translate([1, 0, 0]);
  assert.equal(JSON.parse(mockNative(() => model.build({ right })).save()).nodes.length, 5);
  const make = (kind, a, b) => kind === 'cut' ? a.cut(b, { axis: 'x' }).negative : kind === 'split' ? a.split({ axis: 'x', at: 1 }).negative
    : kind === 'hole' ? a.hole({ center: [16, 12], radius: 1 }) : kind === 'chamfer' ? a.chamfer(a.edges({ parallelTo: 'z', at: { x: 'min', y: 'min' } }).one(), 1)
      : kind === 'difference' ? a.cut(b) : a[kind](b);
  for (const kind of ['cut', 'split', 'hole', 'chamfer', 'difference', 'union', 'intersect']) {
    const m = createCadModel(), s = rectangle(m), a = s.extrude(8), b = s.extrude(4), result = make(kind, a, b);
    refuses(() => result.translate([1, 0, 0]), 'CAPABILITY', 'translate');
  }
});

const operations = [
  ['cut', (a, b) => a.cut(b, { axis: 'x' })], ['difference', (a, b) => a.cut(b)], ['union', (a, b) => a.union(b)], ['intersect', (a, b) => a.intersect(b)],
  ['split', a => a.split({ axis: 'x', at: 1 })], ['hole', a => a.hole({ center: [16, 12], radius: 1 })],
  ['chamfer', a => a.chamfer(a.edges({ parallelTo: 'z', at: { x: 'min', y: 'min' } }).one(), 1)],
];
test('a translation is terminal, including as either Boolean operand; refusals leave its named output unchanged', () => {
  const model = createCadModel(), sketch = rectangle(model), a = sketch.extrude(8), b = sketch.extrude(4), right = a.translate([1, 0, 0]);
  for (const [, operation] of operations) refuses(() => operation(right, b));
  for (const operation of [() => b.union(right), () => b.intersect(right), () => b.cut(right), () => b.cut(right, { axis: 'x' }),
    () => right.translate([2, 0, 0]), () => right.chamfer(a.edges({ parallelTo: 'z' }).one(), 1)]) refuses(operation);
  const snapshot = mockNative(() => model.build({ left: a, right }));
  assert.deepEqual(JSON.parse(snapshot.save()).nodes.map(node => node.kind), ['sketch', 'extrude', 'extrude', 'translate']);
  assert.equal(snapshot.bodies.right.native, snapshot.evidence[3].native.solid);
});

test('translation cannot coexist with Boolean or unrelated finishing nodes in either authoring order', () => {
  for (const [, operation] of operations) for (const translationFirst of [false, true]) {
    const model = createCadModel(), sketch = rectangle(model), a = sketch.extrude(8), b = sketch.extrude(4);
    if (translationFirst) {
      const right = a.translate([1, 0, 0]); refuses(() => operation(a, b), 'CAPABILITY');
      assert.equal(JSON.parse(mockNative(() => model.build({ right })).save()).nodes.length, 4);
    } else { operation(a, b); refuses(() => a.translate([1, 0, 0]), 'CAPABILITY', 'translate'); }
  }
});

test('one translation per graph and unchanged six-node envelope refuse atomically', () => {
  const model = createCadModel(), sketch = rectangle(model), a = sketch.extrude(8), b = sketch.extrude(4), right = a.translate([0, -0, 0]);
  refuses(() => b.translate([2, 0, 0]), 'CAPABILITY', 'translate');
  refuses(() => a.translate([3, 0, 0]), 'CAPABILITY', 'translate');
  refuses(() => right.translate([4, 0, 0]), 'CAPABILITY', 'translate');
  const second = model.sketch.polygon([[0, 0], [1, 0], [0, 1]]);
  refuses(() => second.extrude(1), 'CAPABILITY');
  refuses(() => model.sketch.rectangle({ width: 1, height: 1 }), 'CAPABILITY');
  const snapshot = mockNative(() => model.build({ left: a, other: b, right }));
  assert.equal(JSON.parse(snapshot.save()).nodes.length, 5); assert.equal(CadModelLimits.nodes, 6);
  checkDocument(d => { d.nodes.push(clone(d.nodes[2])); d.outputs.right.node = 3; }, 'CAPABILITY');
  checkDocument(d => { d.nodes.push(...Array.from({ length: 4 }, () => clone(d.nodes[2]))); }, 'BUDGET');
});

test('schema1 translate records require exact fields, solid side and an earlier direct affine extrusion reference', () => {
  const edits = [
    n => { delete n.parent; }, n => { delete n.offset; }, n => { n.native = {}; }, n => { n.lineage = {}; }, n => { n.transform = {}; },
    n => { n.matrix = []; }, n => { n.offsetMM = [0, 0, 0]; }, n => { n.kind = 'translation'; },
    n => { n.parent = null; }, n => { n.parent = 1; }, n => { n.parent = []; }, n => { n.parent = { node: 1 }; },
    n => { n.parent = { side: 'solid' }; }, n => { n.parent.extra = true; }, n => { n.parent.sourceId = 'caller'; },
  ];
  for (const edit of edits) checkDocument(d => edit(d.nodes[2]));
  for (const node of [-0, -1, 0, 2, 3, .5, null, '1', true]) checkDocument(d => { d.nodes[2].parent.node = node; }, 'INPUT');
  for (const side of ['negative', 'positive', 'left', '', 0, null]) checkDocument(d => { d.nodes[2].parent.side = side; }, 'INPUT');
  for (const side of ['negative', 'positive', '', null]) checkDocument(d => { d.outputs.right.side = side; }, 'INPUT');
  checkDocument(d => { d.nodes[0] = { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 2 }; }, 'CAPABILITY', 'translate');
  checkDocument(d => { d.nodes.push({ kind: 'translate', parent: { node: 2, side: 'solid' }, offset: [0, 0, 0] }); d.outputs.right.node = 3; }, 'CAPABILITY');
});

test('schema1 vector dimensions reject malformed tuples, unknown parameters and invented expression fields before providers', () => {
  for (const offset of [null, {}, '1,0,0', [], [0], [0, 0], [0, 0, 0, 0], { x: 1, y: 0, z: 0 }])
    checkDocument(d => { d.nodes[2].offset = offset; }, ['INPUT', 'BUDGET']);
  for (const axis of [0, 1, 2]) {
    for (const value of [null, true, '1', [], {}, { parameter: 'spacing', extra: 1 }, { op: 'scale', value: 1 },
      { op: 'add', left: 1 }, { op: 'rotate', value: 1 }, { op: 'scale', value: 1, factor: 1, extra: 0 }])
      checkDocument(d => { d.nodes[2].offset[axis] = value; }, 'INPUT');
    checkDocument(d => { d.nodes[2].offset[axis] = { parameter: 'missing' }; }, 'PARAMETER');
    for (const value of [10001, -10001]) checkDocument(d => { d.nodes[2].offset[axis] = value; }, 'PARAMETER');
    checkDocument(d => { d.nodes[2].offset[axis] = { op: 'scale', value: { op: 'add', left: 9999, right: 2 }, factor: 0 }; }, 'PARAMETER');
  }
  for (const [needle, replacement] of [
    ['"kind":"translate"', '"kind":"translate","kind":"translate"'],
    ['"node":1,"side":"solid"', '"node":1,"node":1,"side":"solid"'],
    ['"offset":[', '"offset":[0,0,0],"offset":['],
    ['"parameter":"spacing"', '"parameter":"spacing","parameter":"spacing"'],
    ['"offset":[{"parameter":"spacing"},-0,0]', '"offset":[1e309,0,0]'],
    ['"offset":[{"parameter":"spacing"},-0,0]', '"offset":[0,,0]'],
  ]) refuses(() => loadCadModel(signedJson(document()).replace(needle, replacement)), 'FORMAT');
});

test('cold translation graphs refuse terminal consumers and mixed operations before any construction', () => {
  const ref = node => ({ node, side: 'solid' });
  for (const kind of ['union', 'difference', 'intersect', 'cut', 'split', 'hole', 'chamfer']) for (const translatedParent of [false, true]) {
    const d = document(), parent = ref(translatedParent ? 2 : 1);
    d.nodes.splice(2, 0, { kind: 'extrude', sketch: 0, height: 4 }); d.nodes[3].parent = ref(1); d.outputs.right = ref(3);
    if (translatedParent) parent.node = 3;
    const node = kind === 'union' || kind === 'intersect' ? { kind, left: parent, right: ref(2) }
      : kind === 'difference' || kind === 'cut' ? { kind, parent, tool: ref(2), ...(kind === 'cut' ? { axis: 'x' } : {}) }
        : kind === 'split' ? { kind, parent, axis: 'x', at: 1 }
          : kind === 'hole' ? { kind, parent, center: [16, 12], radius: 1 }
            : { kind, parent, edge: { parallelTo: 'z', at: { x: 'min', y: 'min' } }, distance: 1 };
    d.nodes.push(node); refuses(() => loadCadModel(signedJson(d)), 'CAPABILITY');
    // Reverse graph order while leaving the translation's own direct parent valid.
    if (!translatedParent) {
      d.nodes.splice(3, 2, node, { kind: 'translate', parent: ref(1), offset: [1, 0, 0] }); d.outputs.right = ref(4);
      refuses(() => loadCadModel(signedJson(d)), 'CAPABILITY');
    }
  }
});

test('literal and parameter negative-zero vectors survive canonical cold round trips without changing legacy node bytes', () => {
  for (const offset of [[0, -0, 0], [-0, -0, -0], [{ parameter: 'spacing' }, -0, 0]]) {
    const d = document(); d.nodes[2].offset = offset;
    const snapshot = mockNative(() => loadCadModel(signedJson(d))), text = snapshot.save(), before = retained(snapshot);
    assert.deepEqual(JSON.parse(text).nodes.slice(0, 2), d.nodes.slice(0, 2));
    assert.deepEqual(JSON.parse(text).nodes[2].offset, offset); assert.ok(text.includes('-0'));
    const reopened = mockNative(() => loadCadModel(text));
    assert.equal(reopened.save(), text); assert.deepEqual(reopened.evidence, snapshot.evidence); assert.deepEqual(reopened.bodies, snapshot.bodies);
    assert.deepEqual(reopened.recomputation, { reusedFeatures: [], evaluatedFeatures: [0, 1, 2] }); unchanged(snapshot, before);
  }
  const { snapshot } = authored(); assert.ok(snapshot.save().includes('"offsetY":-0'));
  assert.ok(Object.is(snapshot.evidence[2].native.offsetMM[1], -0));
});

test('generic unchanged regeneration helpers discover all vector dependencies and preserve signed-zero authority', () => {
  const { snapshot } = authored({ expressions: true }), d = JSON.parse(snapshot.save()), key = modelingGraphKey(d), names = d.nodes.map(modelingNodeParameters);
  assert.deepEqual(names, [['width'], ['depth'], ['offsetY', 'offsetZ', 'spacing']]); frozen(names[2]);
  assert.equal(modelingReusablePrefix(true, key, key, d.parameters, d.parameters, names), 3);
  for (const [parameter, value, expected] of [['width', 40, 0], ['depth', 12, 1], ['spacing', 64, 2], ['offsetY', 0, 2], ['offsetZ', -0, 2]])
    assert.equal(modelingReusablePrefix(true, key, key, { ...d.parameters, [parameter]: value }, d.parameters, names), expected);
  assert.equal(modelingReusablePrefix(false, key, key, d.parameters, d.parameters, names), 0);
  assert.equal(modelingReusablePrefix(true, key + 'different', key, d.parameters, d.parameters, names), 0);
  const values = clone(d); values.parameters.spacing = 64; assert.equal(modelingGraphKey(values), key);
  for (const mutate of [x => { x.nodes[2].offset[0] = 1; }, x => { x.nodes[2].offset.reverse(); }, x => { x.outputs.right.node = 1; }]) {
    const other = clone(d); mutate(other); assert.notEqual(modelingGraphKey(other), key);
  }
  const negative = document(), positive = clone(negative); positive.nodes[2].offset[1] = 0;
  assert.notEqual(modelingGraphKey(negative), modelingGraphKey(positive));
});

test('vector-only edits reuse original parent wrapper, native and evidence; geometry drivers invalidate their ordinary suffix', () => {
  for (const expressions of [false, true]) {
    const { snapshot } = authored({ expressions }), before = retained(snapshot);
    for (const edits of [{ spacing: 64 }, { offsetY: -8 }, { offsetZ: -4 }, { spacing: -48, offsetY: -8, offsetZ: -4 }]) {
      const calls = state.calls.length, next = mockNative(() => snapshot.withParameters(edits));
      assert.deepEqual(next.recomputation, { reusedFeatures: [0, 1], evaluatedFeatures: [2] });
      assert.deepEqual(state.calls.slice(calls).map(call => call.binding), ['buildModelingTranslation']);
      assert.equal(next.bodies.left, snapshot.bodies.left); assert.equal(next.bodies.left.native, snapshot.bodies.left.native);
      assert.equal(next.evidence[0], snapshot.evidence[0]); assert.equal(next.evidence[1], snapshot.evidence[1]);
      assert.notEqual(next.evidence[2], snapshot.evidence[2]); assert.notEqual(next.bodies.right, snapshot.bodies.right);
    }
    const depth = mockNative(() => snapshot.withParameters({ depth: 12 }));
    assert.deepEqual(depth.recomputation, { reusedFeatures: [0], evaluatedFeatures: [1, 2] });
    const width = mockNative(() => snapshot.withParameters({ width: 40, spacing: -48 }));
    assert.deepEqual(width.recomputation, { reusedFeatures: [], evaluatedFeatures: [0, 1, 2] }); unchanged(snapshot, before);
  }
});

test('no-op edits call no provider; signed-zero edits rebuild only translation and zero offset remains an independent named body', () => {
  const { snapshot } = authored(), before = retained(snapshot), calls = state.calls.length;
  for (const edits of [{}, { spacing: 48 }, { offsetY: -0, offsetZ: 0 }]) {
    const noop = snapshot.withParameters(edits);
    assert.deepEqual(noop.recomputation, { reusedFeatures: [0, 1, 2], evaluatedFeatures: [] });
    assert.equal(noop.bodies.left, snapshot.bodies.left); assert.equal(noop.bodies.right, snapshot.bodies.right);
    assert.equal(noop.evidence[2], snapshot.evidence[2]); assert.equal(noop.save(), snapshot.save());
  }
  assert.equal(state.calls.length, calls);
  const zero = mockNative(() => snapshot.withParameters({ spacing: 0, offsetY: 0 }));
  assert.deepEqual(zero.recomputation, { reusedFeatures: [0, 1], evaluatedFeatures: [2] });
  assert.deepEqual(zero.evidence[2].native.offsetMM, [0, 0, 0]);
  assert.notEqual(zero.bodies.left, zero.bodies.right); assert.notEqual(zero.bodies.left.native, zero.bodies.right.native);
  assert.notEqual(zero.bodies.left.native.sourceId, zero.bodies.right.native.sourceId); assert.notEqual(zero.bodies.left.native.solidId, zero.bodies.right.native.solidId);
  const flipped = mockNative(() => snapshot.withParameters({ offsetZ: -0 }));
  assert.deepEqual(flipped.recomputation, { reusedFeatures: [0, 1], evaluatedFeatures: [2] }); assert.ok(Object.is(flipped.evidence[2].native.offsetMM[2], -0));
  unchanged(snapshot, before);
});

test('invalid edits and accessor records preserve prior snapshots and future reuse before any provider attempt', () => {
  const { snapshot } = authored({ expressions: true }), before = retained(snapshot), calls = state.calls.length; let reads = 0;
  for (const edits of [{ missing: 1 }, { spacing: Infinity }, { spacing: NaN }, { offsetY: 10001 }, { offsetZ: -10001 }])
    refuses(() => snapshot.withParameters(edits), 'PARAMETER');
  for (const edits of [Object.create({ spacing: 64 }), { get spacing() { reads++; return 64; } },
    Object.defineProperty({ spacing: 64 }, 'extra', { value: 1 }), { spacing: 64, [Symbol('extra')]: 1 }])
    refuses(() => snapshot.withParameters(edits), 'INPUT');
  assert.equal(reads, 0); assert.equal(state.calls.length, calls); unchanged(snapshot, before);
  const noop = snapshot.withParameters({ spacing: 48 }); assert.equal(noop.bodies.right, snapshot.bodies.right); assert.equal(state.calls.length, calls);
  const next = mockNative(() => snapshot.withParameters({ spacing: 64 }));
  assert.deepEqual(next.recomputation, { reusedFeatures: [0, 1], evaluatedFeatures: [2] }); unchanged(snapshot, before);
});

test('native translation refusals preserve original cause, stage and entity context plus all accepted snapshot identities', () => {
  const { snapshot } = authored(), before = retained(snapshot), calls = state.calls.length;
  const cause = Object.assign(new Error('INERT representability refusal, not an actual coordinate experiment'),
    { code: 'REPRESENTABILITY', stage: 'target-coefficients', entity: { sourceId: 'inert', surfaceId: 'inert-face', controlPoint: [0, 0] } });
  const error = mockNative(() => refuses(() => snapshot.withParameters({ spacing: .1 }), 'NATIVE', 'translate', false), cause);
  assert.equal(error.cause, cause); assert.equal(error.cause.stage, 'target-coefficients'); assert.equal(error.cause.entity, cause.entity);
  assert.deepEqual(state.calls.slice(calls).map(call => call.binding), ['buildModelingTranslation']); unchanged(snapshot, before);
  const recovered = mockNative(() => snapshot.withParameters({ spacing: 64 }));
  assert.deepEqual(recovered.recomputation, { reusedFeatures: [0, 1], evaluatedFeatures: [2] });
  assert.equal(recovered.bodies.left, snapshot.bodies.left); unchanged(snapshot, before);
});

// #1919 extends ancestry admission only. Every provider below remains trapped.
function finishedRail({ two = true, named = false } = {}) {
  const model = createCadModel(), frontDistance = model.parameter('frontDistance', 1), backDistance = model.parameter('backDistance', 2);
  const spacing = model.parameter('spacing', 48), sketch = rectangle(model), blank = sketch.extrude(8);
  const front = blank.chamfer(blank.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), frontDistance,
    ...(named ? [{ name: 'front' }] : []));
  const left = two ? front.chamfer(front.edges({ parallelTo: 'x', at: { y: 24, z: 'max' } }).one(), backDistance,
    ...(named ? [{ name: 'back' }] : [])) : front;
  return { model, sketch, blank, front, left, spacing };
}
function finishedSnapshot(options) {
  const f = finishedRail(options), right = f.left.translate([f.model.dimension.add(f.spacing, 0), -0, 0]);
  return { ...f, right, snapshot: mockFinishing(() => f.model.build({ left: f.left, right })) };
}

test('finished copy admits one or two exact sequential chamfers without changing node or native bounds', () => {
  for (const two of [false, true]) {
    const before = state.calls.length, { snapshot } = finishedSnapshot({ two });
    const index = two ? 4 : 3, calls = state.calls.slice(before), request = calls.at(-1);
    assert.deepEqual(snapshot.features.map(f => f.kind), ['sketch', 'extrude', 'chamfer', ...(two ? ['chamfer'] : []), 'translate']);
    assert.equal(request.binding, 'buildModelingTranslation'); assert.equal(request.args[0], snapshot.bodies.left.native);
    assert.equal(snapshot.bodies.left.native, snapshot.evidence[index - 1].native.split.negative.solid);
    assert.equal(snapshot.bodies.right.native, snapshot.evidence[index].native.solid);
    assert.ok(Object.is(request.args[1][1], -0)); assert.deepEqual(snapshot.recomputation.evaluatedFeatures, Array.from({ length: index + 1 }, (_, i) => i));
    assert.equal(CadModelLimits.nodes, 6); assert.equal(CadModelLimits.chamfers, 2); frozen(snapshot);
    const loaded = mockFinishing(() => loadCadModel(snapshot.save())); assert.equal(loaded.save(), snapshot.save());
    assert.deepEqual(loaded.features, snapshot.features);
  }
});

test('finished copy owns its handle/dimensions and rejects malformed requests before append', () => {
  const f = finishedRail(), other = createCadModel().parameter('foreign', 1);
  for (const offset of [[other, 0, 0], [{ ...f.spacing }, 0, 0]]) refuses(() => f.left.translate(offset), 'OWNERSHIP');
  for (const receiver of [{ ...f.left }, f.front, null]) refuses(() => f.left.translate.call(receiver, [1, 0, 0]), 'OWNERSHIP');
  for (const vector of [[], [0, 0], [0, 0, 0, 0], { x: 0, y: 0, z: 0 }]) refuses(() => f.left.translate(vector), ['INPUT', 'BUDGET']);
  refuses(() => f.front.translate([1, 0, 0]), 'CAPABILITY');
  const right = f.left.translate([f.spacing, -0, 0]), snapshot = mockFinishing(() => f.model.build({ left: f.left, right }));
  assert.equal(snapshot.features.length, 5); assert.equal(snapshot.features[4].dependencies[0], 3);
});

test('finished copy is final and all rejected new operations leave the accepted graph reusable', () => {
  const f = finishedRail(), edge = f.left.edges({ parallelTo: 'x' }).one(), right = f.left.translate([f.spacing, 0, 0]);
  const snapshot = mockFinishing(() => f.model.build({ left: f.left, right })), before = retained(snapshot);
  for (const action of [() => f.sketch.extrude(2), () => f.model.sketch.rectangle({ width: 1, height: 1 }),
    () => f.left.translate([1, 0, 0]), () => right.translate([1, 0, 0]), () => f.left.chamfer(edge, 1),
    () => f.left.split({ axis: 'x', at: 16 }), () => right.edges({ parallelTo: 'x' }),
    () => f.blank.union(right), () => f.blank.cut(right), () => right.intersect(f.blank)]) refuses(action, 'CAPABILITY');
  unchanged(snapshot, before);
  const after = mockFinishing(() => f.model.build({ left: f.left, right })); assert.equal(after.save(), snapshot.save());
});

test('strict finished-copy codec refuses branches, skipped finishes, extra nodes and native claims before providers', () => {
  const { snapshot } = finishedSnapshot();
  const edits = [
    d => { d.nodes[4].parent.node = 2; }, d => { d.nodes[4].parent.node = 1; },
    d => { d.nodes[3].parent.node = 1; }, d => { d.nodes[4].parent.side = 'negative'; },
    d => { d.nodes[4].native = {}; }, d => { d.nodes[4].lineage = {}; },
    d => { d.nodes.push({ kind: 'extrude', sketch: 0, height: 1 }); },
    d => { d.nodes.push({ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [1, 1] }); },
    d => { d.nodes[0] = { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 2 }; },
    d => { d.nodes[2].parent.side = 'positive'; },
  ];
  for (const edit of edits) { const d = JSON.parse(snapshot.save()); edit(d); refuses(() => loadCadModel(signedJson(d)), ['CAPABILITY', 'INPUT']); }
  const d = JSON.parse(snapshot.save());
  d.nodes.splice(2, 0, { kind: 'extrude', sketch: 0, height: 1 }); d.nodes[4].parent.node = 3; d.nodes[5].parent.node = 4;
  d.outputs.left.node = 4; d.outputs.right.node = 5;
  refuses(() => loadCadModel(signedJson(d)), 'CAPABILITY');
});

test('finishing configuration still validates both candidates and translates the actual selected parent', () => {
  const { snapshot } = finishedSnapshot({ named: true });
  for (const suppression of [{ back: true }, { front: true, back: true }]) {
    const before = state.calls.length, next = mockFinishing(() => snapshot.withSuppression(suppression)), calls = state.calls.slice(before);
    assert.equal(calls.filter(c => c.binding === 'chamferConvexPlanarSolid').length, 2);
    const expected = suppression.front ? next.evidence[1].native.solid : next.evidence[2].native.split.negative.solid;
    assert.equal(next.bodies.left.native, expected); assert.equal(calls.at(-1).args[0], expected);
    assert.notEqual(calls.at(-1).args[0], next.evidence[3].native.split.negative.solid);
    assert.equal(next.evidence[3].configuration.output, 'parent'); frozen(next);
  }
  const cause = new Error('INERT invalid finishing geometry, no native geometry proof'), before = state.calls.length;
  const failure = mockFinishing(() => refuses(() => snapshot.withSuppression({ front: true, back: true }), 'NATIVE', 'chamfer', false), cause);
  assert.equal(failure.cause, cause); assert.equal(state.calls.slice(before).some(c => c.binding === 'buildModelingTranslation'), false);
});

test('finished-copy driver edits reuse only the accepted prefix and no-op changes preserve output identity', () => {
  const { snapshot } = finishedSnapshot(), before = retained(snapshot), count = state.calls.length;
  const noOp = snapshot.withParameters({ spacing: 48 }); assert.equal(state.calls.length, count);
  assert.equal(noOp.bodies.left, snapshot.bodies.left); assert.equal(noOp.bodies.right, snapshot.bodies.right);
  const wider = mockFinishing(() => snapshot.withParameters({ spacing: 64 }));
  assert.deepEqual(wider.recomputation, { reusedFeatures: [0, 1, 2, 3], evaluatedFeatures: [4] });
  assert.equal(wider.bodies.left, snapshot.bodies.left);
  const back = mockFinishing(() => wider.withParameters({ backDistance: 3 }));
  assert.deepEqual(back.recomputation, { reusedFeatures: [0, 1, 2], evaluatedFeatures: [3, 4] });
  const front = mockFinishing(() => back.withParameters({ frontDistance: 2 }));
  assert.deepEqual(front.recomputation, { reusedFeatures: [0, 1], evaluatedFeatures: [2, 3, 4] });
  const d = JSON.parse(snapshot.save()); assert.deepEqual(modelingNodeParameters(d.nodes[4]), ['spacing']);
  unchanged(snapshot, before);
});
