import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// ZERO-NATIVE admission/routing controls for #1994. Every construction, solver,
// compiler and mass binding is replaced before importing the actual facade.
// Deliberately inert bodies/reports below prove no geometry or native lineage.
// Use CAD_MODEL_ROTATION_PLACEMENT_ENTRY=.../src/modeling.ts or .../dist/modeling.js.
// A prebundled index has erased the provider boundary and is never admitted.
const entry = resolve(process.env.CAD_MODEL_ROTATION_PLACEMENT_ENTRY ?? fileURLToPath(new URL('../dist/modeling.js', import.meta.url)));
assert.match(basename(entry), /^modeling\.(?:ts|js)$/, 'Use the actual source or emitted modeling entry');
const mode = extname(entry) === '.ts' ? 'source' : 'emitted';
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? fileURLToPath(new URL('../../..', import.meta.url)), 'package.json'));
const { build } = require('esbuild');
const trapKey = Symbol.for('barocss.modeling-rotation-placement.admission-trap');
assert.equal(globalThis[trapKey], undefined, 'Never replace another active trap');
const providers = new Map([
  ['xy-arc', 'buildXYArc'], ['xy-circle-prism-shell', 'buildXYCirclePrismShell'], ['stored-circle-prism-solid', 'qualifyStoredCirclePrismSolid'],
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
const replaced = new Set(), state = { phase: 'closed', calls: [], unexpected: [], rotationError: undefined, translationError: undefined };
const clone = value => structuredClone(value);
const marker = 'INERT_ROTATION_PLACEMENT_CONTROL_NOT_GEOMETRY';
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
  if (binding === 'buildModelingRotation' || binding === 'buildModelingTranslation') {
    const error = binding === 'buildModelingRotation' ? state.rotationError : state.translationError;
    if (error !== undefined) throw error;
    const field = binding === 'buildModelingRotation' ? 'spec' : 'offsetMM';
    return call.result = { controlOnly: marker, request: { parent: clone(args[0]), [field]: clone(args[1]), prefix: args[2] },
      solid: { controlOnly: marker, solidId: args[2] + '_inert_solid', source: clone(args[0]), [field]: clone(args[1]) },
      report: { controlOnly: marker, nested: { sentinel: 'complete-inert-transform-report' } },
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
const bundle = await build({ stdin: { contents: virtualEntry, resolveDir: dirname(entry), sourcefile: 'rotation-placement-test-entry.mjs', loader: 'js' },
  bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true,
  plugins: [{ name: 'modeling-rotation-placement-zero-native-provider-trap', setup(build) {
    build.onResolve({ filter: /\.(?:ts|js)$/ }, args => {
      const key = basename(args.path, extname(args.path));
      if (providers.has(key)) { replaced.add(key); return { path: key, namespace: 'circular-pattern-trap' }; }
      assert.ok(pureModules.has(key), 'Unreviewed implementation cannot enter zero-native bundle: ' + args.path);
    });
    build.onLoad({ filter: /.*/, namespace: 'circular-pattern-trap' }, args => ({ loader: 'js', contents: `
      // INERT TEST BINDING: no original implementation is imported or called.
      export function ${providers.get(args.path)}(...args) {
        return globalThis[Symbol.for('barocss.modeling-rotation-placement.admission-trap')].dispatch(${JSON.stringify(providers.get(args.path))}, args);
      }` }));
  } }] });
assert.deepEqual([...replaced].sort(), [...providers.keys()].sort(), 'Every native provider binding is replaced');
const inputPaths = Object.keys(bundle.metafile.inputs).filter(path => !path.startsWith('circular-pattern-trap:') && !path.endsWith('rotation-placement-test-entry.mjs')).sort();
assert.equal(inputPaths.length, pureModules.size);
for (const path of inputPaths) assert.ok(pureModules.has(basename(path, extname(path))), 'No native implementation in bundle: ' + path);
const { createCadModel, loadCadModel, CadModelError, CadModelLimits, signedJson }
  = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
let provenance;
if (process.env.EVIDENCE_DIR) {
  const directory = resolve(process.env.EVIDENCE_DIR, 'modeling-rotation-placement-admission-' + mode);
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
  if (provenance) writeFileSync(resolve(provenance.directory, 'receipt.json'), JSON.stringify({ issue: 1994,
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

const options = (axis = 'x', angleDegrees = 90) => ({ axis, angleDegrees });
function part() {
  const model = createCadModel(), original = rectangle(model).extrude(8);
  return { model, original };
}
function placed({ axis = 'x', angleDegrees = 90, finishing = 0, profile = 'rectangle', from, sibling = false } = {}) {
  const model = createCadModel(), width = model.parameter('width', 32), offsetX = model.parameter('offsetX', 40);
  const sketch = profile === 'rectangle' ? model.sketch.rectangle({ width, height: 24 })
    : profile === 'polygon' ? model.sketch.polygon([[0, 0], [32, 0], [32, 24], [0, 24]]) : model.sketch.constrainedPolygon(fixedPolygon);
  let original = from === undefined ? sketch.extrude(8) : sketch.extrude(8, { from });
  let other;
  if (sibling) other = rectangle(model).extrude(4);
  if (finishing) original = original.chamfer(original.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), 1);
  if (finishing === 2) {
    const distance = model.parameter('backDistance', 2);
    original = original.chamfer(original.edges({ parallelTo: 'x', at: { y: 24, z: 'max' } }).one(), distance);
  }
  const middle = original.rotate(options(axis, angleDegrees)), output = middle.translate([offsetX, 16, -0]);
  const build = () => model.build({ original, middle, placed: output, ...(other ? { other } : {}) });
  const snapshot = finishing ? mockFinishing(build) : mockNative(build);
  return { model, original, middle, output, other, snapshot };
}
function document() {
  return { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [32, 24] },
    { kind: 'extrude', sketch: 0, height: 8 },
    { kind: 'rotate', parent: { node: 1, side: 'solid' }, axis: 'x', angleDegrees: 90 },
    { kind: 'translate', parent: { node: 2, side: 'solid' }, offset: [40, 16, -0] },
  ], outputs: { original: { node: 1, side: 'solid' }, middle: { node: 2, side: 'solid' }, placed: { node: 3, side: 'solid' } } };
}
function rejectDocument(edit, code) {
  const data = document(); edit(data); return refuses(() => loadCadModel(signedJson(data)), code);
}

test('all24 providers are trapped; one complete pair routes translation from the actual rotation result', () => {
  const start = state.calls.length, { snapshot } = placed(), calls = state.calls.slice(start);
  assert.equal(replaced.size, 24); assert.equal(inputPaths.length, pureModules.size);
  assert.deepEqual(calls.map(call => call.binding), ['buildXYAffineSketch', 'buildXYAffineSketchPrism', 'buildModelingRotation', 'buildModelingTranslation']);
  assert.equal(calls[2].args[0], snapshot.bodies.original.native);
  assert.equal(calls[3].args[0], calls[2].result.solid);
  assert.equal(snapshot.bodies.middle.native, calls[2].result.solid); assert.equal(snapshot.bodies.placed.native, calls[3].result.solid);
  assert.deepEqual(calls[2].args[1], { axis: 'x', degrees: 90 }); assert.deepEqual(calls[3].args[1], [40, 16, -0]);
  assert.deepEqual(snapshot.features, [{ kind: 'sketch', index: 0, dependencies: [] }, { kind: 'extrude', index: 1, dependencies: [0] },
    { kind: 'rotate', index: 2, dependencies: [1] }, { kind: 'translate', index: 3, dependencies: [2] }]);
  assert.deepEqual(snapshot.recomputation, { reusedFeatures: [], evaluatedFeatures: [0, 1, 2, 3] });
  assert.equal(CadModelLimits.nodes, 6); frozen(snapshot);
});
test('every cardinal axis and adopted signed angle routes its canonical rotation then exact authored offset', () => {
  for (const axis of ['x', 'y', 'z']) for (const angleDegrees of [90, 180, 270, -90, -180, -270]) {
    const { snapshot } = placed({ axis, angleDegrees }), rotation = snapshot.evidence[2].native, translation = snapshot.evidence[3].native;
    assert.deepEqual(rotation.request.spec, { axis, degrees: angleDegrees < 0 ? angleDegrees + 360 : angleDegrees });
    assert.deepEqual(translation.request.parent, rotation.solid); assert.deepEqual(translation.request.offsetMM, [40, 16, -0]);
    assert.deepEqual(JSON.parse(snapshot.save()).nodes.slice(-2), [{ kind: 'rotate', parent: { node: 1, side: 'solid' }, axis, angleDegrees },
      { kind: 'translate', parent: { node: 2, side: 'solid' }, offset: [{ parameter: 'offsetX' }, 16, -0] }]);
    assert.match(snapshot.save(), /-0/);
  }
});
test('strict save and cold load preserve the complete pair, outputs, reports and authored signed zero', () => {
  const { snapshot } = placed(), saved = snapshot.save(), cold = mockNative(() => loadCadModel(saved));
  assert.equal(cold.save(), saved); assert.deepEqual(cold.bodies, snapshot.bodies); assert.deepEqual(cold.evidence, snapshot.evidence);
  assert.deepEqual(Object.keys(cold.bodies).sort(), ['middle', 'original', 'placed']); frozen(cold);
  const data = document(); data.outputs = { final: { node: 3, side: 'solid' } };
  const final = mockNative(() => loadCadModel(signedJson(data))); assert.deepEqual(Object.keys(final.bodies), ['final']);
});
test('same exact last rotated receiver is required; original, detached and foreign receivers spend no node', () => {
  const { model, original } = part(), middle = original.rotate(options()), method = middle.translate;
  refuses(() => original.translate([1, 0, 0]), 'CAPABILITY');
  for (const receiver of [undefined, {}, { ...middle }, part().original]) refuses(() => method.call(receiver, [1, 0, 0]), 'OWNERSHIP', 'translate');
  refuses(() => method([1, 0, 0]), 'OWNERSHIP', 'translate');
  const foreign = part().model.parameter('offset', 40); refuses(() => middle.translate([foreign, 0, 0]), 'OWNERSHIP');
  const output = middle.translate([1, 0, 0]), snapshot = mockNative(() => model.build({ output }));
  assert.equal(snapshot.features.length, 4); assert.deepEqual(snapshot.features[3].dependencies, [2]);
});
test('malformed dense offsets, getters, symbols and extra arguments refuse before provider calls and append', () => {
  const { model, original } = part(), middle = original.rotate(options()); let reads = 0;
  const getter = [1, 0, 0]; Object.defineProperty(getter, '0', { enumerable: true, get() { reads++; return 1; } });
  const hidden = [1, 0, 0]; Object.defineProperty(hidden, 'hidden', { value: 1 });
  const symbol = [1, 0, 0]; symbol[Symbol('hidden')] = 1;
  const revoked = Proxy.revocable([1, 0, 0], {}); revoked.revoke();
  for (const args of [[], [undefined], [null], [[1, 0]], [[1, 0, 0, 0]], [[, 0, 0]], [getter], [hidden], [symbol], [[1, 0, 0], true]])
    refuses(() => middle.translate(...args));
  const calls = state.calls.length; assert.throws(() => middle.translate(revoked.proxy), TypeError); assert.equal(state.calls.length, calls);
  assert.equal(reads, 0); const output = middle.translate([1, -0, 0]);
  assert.equal(mockNative(() => model.build({ output })).features.length, 4);
});
test('same-model callback fences held rotated handles before argument reflection', () => {
  const { model, original } = part(), middle = original.rotate(options()); let reads = 0;
  const proxy = new Proxy([1, 0, 0], { ownKeys() { reads++; throw Error('must-not-read'); } });
  refuses(() => model.sketch.constrainedPolygon(builder => { middle.translate(proxy); return fixedPolygon(builder); }), 'OWNERSHIP');
  assert.equal(reads, 0); const output = middle.translate([1, 0, 0]);
  assert.equal(mockNative(() => model.build({ output })).features.length, 4);
});
test('all source profile variants and placement preserve the admitted source prefix', () => {
  for (const profile of ['rectangle', 'polygon', 'constrained']) {
    const { snapshot } = placed({ profile, from: 3 }); assert.equal(JSON.parse(snapshot.save()).nodes[1].from, 3);
    assert.deepEqual(snapshot.features.map(feature => feature.kind), ['sketch', 'extrude', 'rotate', 'translate']);
  }
  const { snapshot } = placed({ sibling: true }); assert.equal(snapshot.features.length, 6);
  assert.deepEqual(snapshot.features.slice(-2).map(feature => feature.dependencies), [[1], [4]]);
});
test('the entire owned one/two-chamfer chain precedes the terminal pair within six nodes', () => {
  for (const finishing of [1, 2]) {
    const { snapshot } = placed({ finishing });
    assert.deepEqual(snapshot.features.map(feature => feature.kind), ['sketch', 'extrude', ...Array(finishing).fill('chamfer'), 'rotate', 'translate']);
    const rotation = snapshot.evidence.at(-2).native, translation = snapshot.evidence.at(-1).native;
    assert.deepEqual(rotation.request.parent, snapshot.bodies.original.native); assert.deepEqual(translation.request.parent, snapshot.bodies.middle.native);
    assert.equal(snapshot.features.length, finishing + 4);
  }
});
test('all retained handles reject transforms, patterns and later authored features after the pair', () => {
  const { model, original } = part(), edge = original.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one();
  const middle = original.rotate(options()), output = middle.translate([1, 0, 0]);
  for (const shape of [original, middle, output]) {
    refuses(() => shape.translate([1, 0, 0]), 'CAPABILITY'); refuses(() => shape.rotate(options()), 'CAPABILITY');
    refuses(() => shape.mirror({ plane: 'xz' }), 'CAPABILITY'); refuses(() => shape.scale({ factor: 2 }), 'CAPABILITY');
    refuses(() => shape.linearPattern({ axis: 'x', spacing: 40, count: 3 }), 'CAPABILITY');
    refuses(() => shape.circularPattern({ axis: 'x', angleDegrees: 90, count: 4 }), 'CAPABILITY');
    refuses(() => shape.chamfer(edge, 1), ['CAPABILITY', 'OWNERSHIP']); refuses(() => shape.split({ axis: 'z', at: 4 }), 'CAPABILITY');
    refuses(() => shape.hole({ center: [8, 8], radius: 2 }), 'CAPABILITY');
  }
  refuses(() => model.sketch.rectangle({ width: 2, height: 2 }), 'CAPABILITY');
  assert.equal(mockNative(() => model.build({ original, middle, output })).features.length, 4);
});
test('strict codec rejects incomplete pair ancestry, wrong order, unrelated later nodes and forged body references before geometry', () => {
  for (const edit of [
    data => data.nodes[3].parent.node = 1, data => data.nodes[3].parent.node = 0,
    data => data.nodes[3].parent.side = 'instance1', data => data.nodes[3].parent.extra = 1,
    data => data.nodes[2].parent.side = 'negative', data => data.nodes[3].offset = [1, 0],
    data => data.nodes[3].offset = ['x', 0, 0], data => data.nodes[3].offset = [10001, 0, 0],
    data => data.nodes[3].axis = 'x', data => data.nodes[3].native = {}, data => data.nodes[3].copies = [],
    data => data.nodes.push({ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [2, 2] }),
    data => data.nodes.push({ kind: 'rotate', parent: { node: 3, side: 'solid' }, axis: 'y', angleDegrees: 90 }),
    data => data.nodes.push({ kind: 'translate', parent: { node: 3, side: 'solid' }, offset: [1, 0, 0] }),
    data => { data.nodes[2] = { kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [1, 0, 0] }; data.nodes[3] = { kind: 'rotate', parent: { node: 2, side: 'solid' }, axis: 'x', angleDegrees: 90 }; },
    data => data.outputs.placed.side = 'instance3', data => data.outputs.placed.extra = 1,
  ]) rejectDocument(edit);
  const duplicate = signedJson(document()).replace('"offset":', '"offset":[1,0,0],"offset":');
  refuses(() => loadCadModel(duplicate), 'FORMAT');
});
test('codec rejects a detached source sibling placement and preserves the complete pair parent requirement', () => {
  const { snapshot } = placed({ sibling: true }), data = JSON.parse(snapshot.save());
  data.nodes[5].parent = { node: 3, side: 'solid' }; refuses(() => loadCadModel(signedJson(data)), 'CAPABILITY');
  for (const source of [1, 2]) {
    const rail = JSON.parse(placed({ finishing: 2 }).snapshot.save()); rail.nodes[4].parent.node = source;
    refuses(() => loadCadModel(signedJson(rail)), 'CAPABILITY');
  }
});
test('offset-only edits reuse the exact accepted rotation prefix and rebuild translation alone', () => {
  const { snapshot } = placed({ finishing: 2 }), held = retained(snapshot), start = state.calls.length;
  const next = mockNative(() => snapshot.withParameters({ offsetX: 56 }));
  assert.deepEqual(state.calls.slice(start).map(call => call.binding), ['buildModelingTranslation']);
  assert.deepEqual(next.recomputation, { reusedFeatures: [0, 1, 2, 3, 4], evaluatedFeatures: [5] });
  assert.equal(next.bodies.original, snapshot.bodies.original); assert.equal(next.bodies.middle, snapshot.bodies.middle);
  assert.notEqual(next.bodies.placed, snapshot.bodies.placed); assert.deepEqual(next.evidence[5].native.request.offsetMM, [56, 16, -0]);
  for (let index = 0; index < 5; index++) assert.equal(next.evidence[index], snapshot.evidence[index]); unchanged(snapshot, held);
});
test('source edits rebuild rotation and placement while a semantic no-op spends no provider work', () => {
  const { snapshot } = placed(), held = retained(snapshot), start = state.calls.length;
  const next = mockNative(() => snapshot.withParameters({ width: 40 }));
  assert.deepEqual(state.calls.slice(start).map(call => call.binding), ['buildXYAffineSketch', 'buildXYAffineSketchPrism', 'buildModelingRotation', 'buildModelingTranslation']);
  assert.deepEqual(next.recomputation, { reusedFeatures: [], evaluatedFeatures: [0, 1, 2, 3] });
  for (const name of ['original', 'middle', 'placed']) assert.notEqual(next.bodies[name], snapshot.bodies[name]);
  const calls = state.calls.length, noop = next.withParameters({ width: 40 }); assert.equal(state.calls.length, calls);
  assert.deepEqual(noop.recomputation, { reusedFeatures: [0, 1, 2, 3], evaluatedFeatures: [] });
  for (const name of ['original', 'middle', 'placed']) assert.equal(noop.bodies[name], next.bodies[name]); unchanged(snapshot, held);
});
test('finishing source edits retain the first accepted finish then rebuild second finish and both transforms', () => {
  const { snapshot } = placed({ finishing: 2 }), held = retained(snapshot), start = state.calls.length;
  const next = mockFinishing(() => snapshot.withParameters({ backDistance: 3 }));
  assert.deepEqual(state.calls.slice(start).map(call => call.binding), ['chamferConvexPlanarSolid', 'buildModelingRotation', 'buildModelingTranslation']);
  assert.deepEqual(next.recomputation, { reusedFeatures: [0, 1, 2], evaluatedFeatures: [3, 4, 5] }); unchanged(snapshot, held);
});
test('exact rational placement refusal preserves its original full cause and accepted state without partial outputs', () => {
  const { snapshot } = placed(), held = retained(snapshot), cause = Object.assign(new Error('INERT representability refusal'),
    { name: 'ModelingTranslationError', code: 'REPRESENTABILITY', stage: 'geometry', entity: 'm3/curve',
      report: { parentValidation: { controlOnly: marker }, directCalls: { parentValidationCount: 1, initialFaceConstructionCount: 0 } } });
  const error = mockNative(() => refuses(() => snapshot.withParameters({ offsetX: 0.1 }), 'NATIVE', 'translate', false), cause);
  assert.equal(error.cause, cause); assert.equal(error.cause.report, cause.report);
  for (const key of ['bodies', 'solid', 'evidence', 'lineage']) assert.equal(Object.hasOwn(error, key), false); unchanged(snapshot, held);
  const recovery = mockNative(() => snapshot.withParameters({ offsetX: 56 })); assert.equal(recovery.bodies.middle, snapshot.bodies.middle);
});
test('dense signed-zero offsets and owned expressions preserve authored placement values', () => {
  for (const offset of [[-0, 0, -0], [0, -0, 0], [1, -2, 3]]) {
    const { model, original } = part(), middle = original.rotate(options()), output = middle.translate(offset);
    const snapshot = mockNative(() => model.build({ output })); assert.deepEqual(snapshot.evidence[3].native.request.offsetMM, offset);
    const cold = mockNative(() => loadCadModel(snapshot.save())); assert.equal(cold.save(), snapshot.save()); assert.deepEqual(cold.evidence, snapshot.evidence);
  }
  const { model, original } = part(), distance = model.parameter('distance', 40), middle = original.rotate(options());
  const output = middle.translate([model.dimension.add(model.dimension.scale(distance, 1), 0), 0, -0]);
  const snapshot = mockNative(() => model.build({ output })), next = mockNative(() => snapshot.withParameters({ distance: 48 }));
  assert.deepEqual(next.recomputation, { reusedFeatures: [0, 1, 2], evaluatedFeatures: [3] }); assert.deepEqual(next.evidence[3].native.request.offsetMM, [48, 0, -0]);
});
test('old standalone direct translation still admits later independent extrusion and legacy files', () => {
  const { model, original } = part(), translated = original.translate([40, -0, 0]);
  const other = rectangle(model).extrude(4), snapshot = mockNative(() => model.build({ original, translated, other }));
  assert.deepEqual(snapshot.features.map(feature => feature.kind), ['sketch', 'extrude', 'translate', 'sketch', 'extrude']);
  const cold = mockNative(() => loadCadModel(snapshot.save())); assert.equal(cold.save(), snapshot.save()); assert.deepEqual(cold.bodies, snapshot.bodies);
  refuses(() => translated.rotate(options()), 'CAPABILITY');
});


