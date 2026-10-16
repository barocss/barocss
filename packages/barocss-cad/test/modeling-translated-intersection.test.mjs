import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// ZERO-NATIVE admission/routing controls for #2002. Every construction, solver,
// compiler and mass binding is replaced before importing the actual facade.
// Deliberately inert bodies/reports below prove no geometry or native lineage.
// Use CAD_MODEL_TRANSLATED_INTERSECTION_ENTRY=.../src/modeling.ts or .../dist/modeling.js.
// A prebundled index has erased the provider boundary and is never admitted.
const entry = resolve(process.env.CAD_MODEL_TRANSLATED_INTERSECTION_ENTRY ?? fileURLToPath(new URL('../dist/modeling.js', import.meta.url)));
assert.match(basename(entry), /^modeling\.(?:ts|js)$/, 'Use the actual source or emitted modeling entry');
const mode = extname(entry) === '.ts' ? 'source' : 'emitted';
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? fileURLToPath(new URL('../../..', import.meta.url)), 'package.json'));
const { build } = require('esbuild');
const trapKey = Symbol.for('barocss.modeling-translated-intersection.admission-trap');
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
const replaced = new Set(), state = { phase: 'closed', calls: [], unexpected: [], intersectionError: undefined, translationError: undefined };
const clone = value => structuredClone(value);
const marker = 'INERT_TRANSLATED_INTERSECTION_CONTROL_NOT_GEOMETRY';
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
    const error = binding === 'buildModelingRotation' ? undefined : state.translationError;
    if (error !== undefined) throw error;
    const field = binding === 'buildModelingRotation' ? 'spec' : 'offsetMM';
    return call.result = { controlOnly: marker, request: { parent: clone(args[0]), [field]: clone(args[1]), prefix: args[2] },
      solid: { controlOnly: marker, solidId: args[2] + '_inert_solid', source: clone(args[0]), [field]: clone(args[1]) },
      report: { controlOnly: marker, nested: { sentinel: 'complete-inert-transform-report' } },
      lineage: { controlOnly: marker, sentinel: ['not-a-geometric-correspondence'] } };
  }
  if (binding === 'intersectConvexPlanarSolids') {
    if (state.intersectionError) throw state.intersectionError;
    return call.result = {controlOnly:marker,request:{a:clone(args[0]),b:clone(args[1]),options:clone(args[2])},
      outcome:state.emptyDimension===undefined?{kind:'solid',solid:{controlOnly:marker,solidId:args[2].solidId,parents:[clone(args[0]),clone(args[1])]}}:{kind:'empty'},
      contact:{dimension:state.emptyDimension},report:{controlOnly:marker,nested:{sentinel:'complete-inert-intersection-report'}},lineage:{controlOnly:marker}};
  }
  if (binding === 'buildXYArc') return call.result = { controlOnly: marker, curve: { id: args[0].id }, report: { centerMM: args[0].center, radiusMM: args[0].radius } };
  if (binding === 'buildXYCirclePrismShell' || binding === 'qualifyStoredCirclePrismSolid') return call.result = { controlOnly: marker };
  state.unexpected.push(binding); throw new Error('UNUSED_MOCK_PROVIDER: ' + binding);
}
globalThis[trapKey] = { dispatch };
const virtualEntry = `export * from ${JSON.stringify(entry)};
export { modelingGraphKey, modelingNodeParameters, modelingReusablePrefix } from './modeling-regeneration-internal.js';
export { signedJson } from './xy-affine-prism-feature-document-internal.js';`;
const bundle = await build({ stdin: { contents: virtualEntry, resolveDir: dirname(entry), sourcefile: 'translated-intersection-test-entry.mjs', loader: 'js' },
  bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true,
  plugins: [{ name: 'modeling-translated-intersection-zero-native-provider-trap', setup(build) {
    build.onResolve({ filter: /\.(?:ts|js)$/ }, args => {
      const key = basename(args.path, extname(args.path));
      if (providers.has(key)) { replaced.add(key); return { path: key, namespace: 'circular-pattern-trap' }; }
      assert.ok(pureModules.has(key), 'Unreviewed implementation cannot enter zero-native bundle: ' + args.path);
    });
    build.onLoad({ filter: /.*/, namespace: 'circular-pattern-trap' }, args => ({ loader: 'js', contents: `
      // INERT TEST BINDING: no original implementation is imported or called.
      export function ${providers.get(args.path)}(...args) {
        return globalThis[Symbol.for('barocss.modeling-translated-intersection.admission-trap')].dispatch(${JSON.stringify(providers.get(args.path))}, args);
      }` }));
  } }] });
assert.deepEqual([...replaced].sort(), [...providers.keys()].sort(), 'Every native provider binding is replaced');
const inputPaths = Object.keys(bundle.metafile.inputs).filter(path => !path.startsWith('circular-pattern-trap:') && !path.endsWith('translated-intersection-test-entry.mjs')).sort();
assert.equal(inputPaths.length, pureModules.size);
for (const path of inputPaths) assert.ok(pureModules.has(basename(path, extname(path))), 'No native implementation in bundle: ' + path);
const { createCadModel, loadCadModel, CadModelError, CadModelLimits, signedJson }
  = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
let provenance;
if (process.env.EVIDENCE_DIR) {
  const directory = resolve(process.env.EVIDENCE_DIR, 'modeling-translated-intersection-admission-' + mode);
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
  if (provenance) writeFileSync(resolve(provenance.directory, 'receipt.json'), JSON.stringify({ issue: 2002,
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

function part({ reverse = false, profile = 'rectangle', order = 'SESE', from = 3 } = {}) {
  const model = createCadModel(), offsetX = model.parameter('offsetX', 4), height = model.parameter('toolHeight', 8);
  const sketches = [], sources = [];
  const sourceSketch = () => profile === 'rectangle' ? model.sketch.rectangle({ width: 16, height: 16 })
    : profile === 'polygon' ? model.sketch.polygon([[0, 0], [32, 0], [32, 24], [0, 24]]) : model.sketch.constrainedPolygon(fixedPolygon);
  for (const action of order) {
    if (action === 'S') sketches.push(sketches.length ? model.sketch.rectangle({ min: [8, 0], max: [24, 16] }) : sourceSketch());
    else { const index = action === 'A' ? 0 : action === 'B' ? 1 : sources.length;
      sources.push(sketches[index].extrude(index ? height : 8, { from })); }
  }
  // Source identities are authored order, not inferred geometry. For SSBA,
  // the first emitted extrusion consumes sketch1 and the second consumes0.
  const source = order === 'SSBA' ? sources[1] : sources[0], other = order === 'SSBA' ? sources[0] : sources[1];
  const translated = source.translate([offsetX, 0, -0]), overlap = reverse ? other.intersect(translated) : translated.intersect(other);
  const snapshot = mockNative(() => model.build({ original: source, other, translated, overlap }));
  return { model, original: source, other, translated, overlap, snapshot };
}
function document(reverse = false) {
  return { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [16, 16] }, { kind: 'extrude', sketch: 0, height: 8 },
    { kind: 'sketch', profile: 'rectangle', min: [8, 0], max: [24, 16] }, { kind: 'extrude', sketch: 2, height: 8 },
    { kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [4, 0, -0] },
    { kind: 'intersect', left: { node: reverse ? 3 : 4, side: 'solid' }, right: { node: reverse ? 4 : 3, side: 'solid' } },
  ], outputs: { overlap: { node: 5, side: 'solid' } } };
}
function rejectDocument(edit, code) { const data = document(); edit(data); return refuses(() => loadCadModel(signedJson(data)), code); }
function refuseIntersection(snapshot, action, cause, dimension) {
  assert.equal(state.phase, 'closed'); state.intersectionError = cause; state.emptyDimension = dimension;
  try { return mockNative(action); } finally { delete state.intersectionError; delete state.emptyDimension; }
}

test('all25 providers are isolated and intersection consumes the actual translated Solid in either operand order', () => {
  for (const reverse of [false, true]) {
    const start = state.calls.length, { snapshot } = part({ reverse }), calls = state.calls.slice(start);
    assert.equal(replaced.size, 25); assert.equal(inputPaths.length, pureModules.size);
    assert.deepEqual(calls.map(call => call.binding), ['buildXYAffineSketch', 'buildXYAffineSketchPrism', 'buildXYAffineSketch',
      'buildXYAffineSketchPrism', 'buildModelingTranslation', 'intersectConvexPlanarSolids']);
    const final = calls.at(-1), operands = reverse ? [snapshot.bodies.other.native, snapshot.bodies.translated.native]
      : [snapshot.bodies.translated.native, snapshot.bodies.other.native];
    assert.equal(final.args[0], operands[0]); assert.equal(final.args[1], operands[1]);
    assert.equal(calls[4].args[0], snapshot.bodies.original.native); assert.deepEqual(calls[4].args[1], [4, 0, -0]);
    assert.deepEqual(final.args[2], { operationId: 'm5_intersect', solidId: 'm5_solid', resultIdPrefix: 'm5' });
    assert.equal(snapshot.bodies.overlap.native, final.result.outcome.solid); assert.equal(snapshot.evidence[5].native, final.result);
    assert.equal(snapshot.evidence[5].native.report.nested.sentinel, 'complete-inert-intersection-report');
    assert.deepEqual(snapshot.features.map(feature => feature.dependencies), [[], [0], [], [2], [1], reverse ? [3, 4] : [4, 3]]);
    assert.equal(CadModelLimits.nodes, 6); assert.equal(CadModelLimits.intersections, 1); frozen(snapshot);
  }
});
test('valid source orders consume two distinct affine sketches exactly once before translation', () => {
  for (const order of ['SESE', 'SSAB', 'SSBA']) for (const reverse of [false, true]) {
    const { snapshot } = part({ order, reverse }); assert.equal(snapshot.features.length, 6);
    const nodes = JSON.parse(snapshot.save()).nodes;
    assert.equal(nodes[4].kind, 'translate'); assert.equal(nodes[5].kind, 'intersect');
    assert.equal(new Set(nodes.filter(node => node.kind === 'extrude').map(node => node.sketch)).size, 2);
  }
  // Swap authored source identities in the alternating source order.
  for (const reverse of [false, true]) {
    const data = document(reverse); data.nodes[4].parent.node = 3;
    data.nodes[5][reverse ? 'left' : 'right'].node = 1;
    const snapshot = mockNative(() => loadCadModel(signedJson(data))); assert.equal(snapshot.features.length, 6);
  }
});
test('affine rectangle, polygon and constrained profile provenance retains extrusion placement', () => {
  for (const profile of ['rectangle', 'polygon', 'constrained']) {
    const { snapshot } = part({ profile }); assert.equal(JSON.parse(snapshot.save()).nodes[1].from, 3);
    assert.deepEqual(snapshot.features.map(feature => feature.kind), ['sketch', 'extrude', 'sketch', 'extrude', 'translate', 'intersect']);
  }
});
test('strict Save/Open preserves authored references and omits native state in either operand order', () => {
  for (const reverse of [false, true]) {
    const { snapshot } = part({ reverse }), saved = snapshot.save(), cold = mockNative(() => loadCadModel(saved));
    assert.equal(cold.save(), saved); assert.deepEqual(cold.bodies, snapshot.bodies); assert.deepEqual(cold.evidence, snapshot.evidence);
    assert.deepEqual(Object.keys(cold.bodies).sort(), ['original', 'other', 'overlap', 'translated']); frozen(cold);
    const data = JSON.parse(saved); assert.equal(Object.hasOwn(data.nodes[5], 'native'), false);
    assert.equal(Object.hasOwn(data.nodes[4], 'report'), false); assert.match(saved, /-0/);
  }
});
test('foreign, forged, same-parent and missing operands refuse without consuming the terminal intersection', () => {
  const model = createCadModel(), source = rectangle(model).extrude(8), other = rectangle(model).extrude(8);
  const translated = source.translate([4, 0, 0]), foreign = rectangle(createCadModel()).extrude(8);
  for (const operand of [foreign, { ...other }, {}, undefined]) refuses(() => translated.intersect(operand), 'OWNERSHIP');
  refuses(() => translated.intersect(source), 'CAPABILITY'); refuses(() => source.intersect(other), 'CAPABILITY');
  refuses(() => translated.intersect(translated), 'CAPABILITY');
  const overlap = translated.intersect(other), snapshot = mockNative(() => model.build({ overlap }));
  assert.equal(snapshot.features.length, 6);
});
test('new recipe requires the exact intersection receiver and one argument before appending', () => {
  const model = createCadModel(), source = rectangle(model).extrude(8), other = rectangle(model).extrude(8);
  const translated = source.translate([4, 0, 0]), method = translated.intersect;
  refuses(() => method(other), 'OWNERSHIP', 'intersect');
  for (const receiver of [{}, { ...translated }, source, other]) refuses(() => method.call(receiver, other), 'OWNERSHIP', 'intersect');
  refuses(() => translated.intersect(), 'OWNERSHIP', 'body'); refuses(() => translated.intersect(other, true), 'INPUT', 'intersect');
  const overlap = translated.intersect(other); assert.equal(mockNative(() => model.build({ overlap })).features.length, 6);
});
test('same-model callback ownership fence rejects held intersection operands before native work', () => {
  const model = createCadModel(), source = rectangle(model).extrude(8), other = rectangle(model).extrude(8), translated = source.translate([4, 0, 0]);
  let entered = false;
  refuses(() => model.sketch.constrainedPolygon(builder => { entered = true; translated.intersect(other); return fixedPolygon(builder); }), 'OWNERSHIP');
  assert.equal(entered, true); const overlap = translated.intersect(other);
  assert.equal(mockNative(() => model.build({ overlap })).features.length, 6);
});
test('six-node completed recipe is terminal through every retained handle', () => {
  const { model, original, other, translated, overlap } = part();
  for (const shape of [original, other, translated, overlap]) {
    refuses(() => shape.intersect(other), ['CAPABILITY', 'BUDGET']); refuses(() => shape.translate([1, 0, 0]), ['CAPABILITY', 'BUDGET']);
    refuses(() => shape.rotate({ axis: 'x', angleDegrees: 90 }), ['CAPABILITY', 'BUDGET']);
    refuses(() => shape.mirror({ plane: 'xz' }), ['CAPABILITY', 'BUDGET']); refuses(() => shape.scale({ factor: 2 }), ['CAPABILITY', 'BUDGET']);
    refuses(() => shape.linearPattern({ axis: 'x', spacing: 40, count: 3 }), ['CAPABILITY', 'BUDGET']);
    refuses(() => shape.circularPattern({ axis: 'x', angleDegrees: 90, count: 4 }), ['CAPABILITY', 'BUDGET']);
    refuses(() => shape.cut(other), ['CAPABILITY', 'BUDGET']); refuses(() => shape.split({ axis: 'z', at: 4 }), ['CAPABILITY', 'BUDGET']);
    refuses(() => shape.hole({ center: [8, 8], radius: 2 }), ['CAPABILITY', 'BUDGET']);
  }
  refuses(() => rectangle(model), ['CAPABILITY', 'BUDGET']);
});
test('strict codec refuses incorrect source consumption, translation ancestry and nonterminal mixed operations before providers', () => {
  for (const edit of [
    data => data.nodes[3].sketch = 0, data => data.nodes[4].parent.node = 0,
    data => data.nodes[4].parent.side = 'negative', data => data.nodes[5].right.node = 1,
    data => data.nodes[5].left.node = 1, data => data.nodes[5].right.node = 4,
    data => data.nodes[5].left.side = 'instance1', data => data.nodes[5].right.extra = 1,
    data => data.nodes[5].left.node = 5, data => data.nodes[5].native = {}, data => data.nodes[4].offset = [1, 0],
    data => data.nodes[4].offset = [{ parameter: 'missing' }, 0, 0], data => data.nodes[4].offset = [10001, 0, 0],
    data => data.nodes[4] = { kind: 'rotate', parent: { node: 1, side: 'solid' }, axis: 'x', angleDegrees: 90 },
    data => data.nodes[4] = { kind: 'mirror', parent: { node: 1, side: 'solid' }, plane: 'xz' },
    data => data.nodes[4] = { kind: 'scale', parent: { node: 1, side: 'solid' }, factor: 2 },
    data => data.nodes[4] = { kind: 'linear-pattern', parent: { node: 1, side: 'solid' }, axis: 'x', spacing: 40, count: 3 },
    data => data.nodes[4] = { kind: 'circular-pattern', parent: { node: 1, side: 'solid' }, axis: 'x', angleDegrees: 90, count: 4 },
    data => data.nodes.push({ kind: 'translate', parent: { node: 5, side: 'solid' }, offset: [1, 0, 0] }),
    data => data.nodes.push({ kind: 'intersect', left: { node: 4, side: 'solid' }, right: { node: 3, side: 'solid' } }),
    data => data.outputs.overlap.side = 'negative', data => data.outputs.overlap.extra = 1,
  ]) rejectDocument(edit);
  const duplicate = signedJson(document()).replace('"right":', '"right":{},"right":'); refuses(() => loadCadModel(duplicate), 'FORMAT');
});
test('codec excludes shared-sketch and translation-before-complete-source recipes', () => {
  const shared = document(); shared.nodes.splice(2, 1); shared.nodes[2].sketch = 0;
  shared.nodes[3].parent.node = 1; shared.nodes[4].left.node = 3; shared.nodes[4].right.node = 2; shared.outputs.overlap.node = 4;
  refuses(() => loadCadModel(signedJson(shared)), 'CAPABILITY');
  const early = document(); early.nodes.splice(2, 0, early.nodes.splice(4, 1)[0]);
  early.nodes[4].sketch = 3; early.nodes[5].left.node = 2; early.nodes[5].right.node = 4;
  refuses(() => loadCadModel(signedJson(early)), 'CAPABILITY');
});
test('offset edit reuses four-source prefix and rebuilds translation plus intersection only', () => {
  const { snapshot } = part(), held = retained(snapshot), start = state.calls.length;
  const next = mockNative(() => snapshot.withParameters({ offsetX: 8 }));
  assert.deepEqual(state.calls.slice(start).map(call => call.binding), ['buildModelingTranslation', 'intersectConvexPlanarSolids']);
  assert.deepEqual(next.recomputation, { reusedFeatures: [0, 1, 2, 3], evaluatedFeatures: [4, 5] });
  assert.equal(next.bodies.original, snapshot.bodies.original); assert.equal(next.bodies.other, snapshot.bodies.other);
  assert.notEqual(next.bodies.translated, snapshot.bodies.translated); assert.notEqual(next.bodies.overlap, snapshot.bodies.overlap);
  for (let index = 0; index < 4; index++) assert.equal(next.evidence[index], snapshot.evidence[index]); unchanged(snapshot, held);
  const calls = state.calls.length, noop = next.withParameters({ offsetX: 8 }); assert.equal(state.calls.length, calls);
  assert.deepEqual(noop.recomputation, { reusedFeatures: [0, 1, 2, 3, 4, 5], evaluatedFeatures: [] });
});
test('other-source height edit retains accepted translation input and rebuilds the dirty prefix dependencies', () => {
  const { snapshot } = part(), held = retained(snapshot), start = state.calls.length;
  const next = mockNative(() => snapshot.withParameters({ toolHeight: 12 }));
  assert.deepEqual(next.recomputation, { reusedFeatures: [0, 1, 2], evaluatedFeatures: [3, 4, 5] });
  assert.deepEqual(state.calls.slice(start).map(call => call.binding), ['buildXYAffineSketchPrism', 'buildModelingTranslation', 'intersectConvexPlanarSolids']);
  assert.equal(next.bodies.original, snapshot.bodies.original); unchanged(snapshot, held);
});
test('empty and touching outcomes preserve actual contact dimension and all accepted state', () => {
  const { snapshot } = part(), held = retained(snapshot);
  for (const dimension of [-1, 0, 1, 2]) {
    const error = refuseIntersection(snapshot, () => refuses(() => snapshot.withParameters({ offsetX: 12 }), 'SELECTION', 'intersect', false), undefined, dimension);
    assert.equal(error.cause.contactDimension, dimension); assert.ok(Object.isFrozen(error.cause)); unchanged(snapshot, held);
  }
  const recovery = mockNative(() => snapshot.withParameters({ offsetX: 8 })); assert.equal(recovery.bodies.original, snapshot.bodies.original);
});
test('native intersection failure keeps its original typed cause and produces no partial overlap', () => {
  const { snapshot } = part(), held = retained(snapshot), cause = Object.assign(new Error('INERT native intersection refusal'),
    { name: 'ConvexPlanarSolidIntersectionError', code: 'REPRESENTABILITY', stage: 'final-representability', report: { controlOnly: marker } });
  const error = refuseIntersection(snapshot, () => refuses(() => snapshot.withParameters({ offsetX: 12 }), 'NATIVE', 'intersect', false), cause);
  assert.equal(error.cause, cause); assert.equal(error.cause.report, cause.report);
  for (const key of ['bodies', 'solid', 'lineage', 'evidence']) assert.equal(Object.hasOwn(error, key), false); unchanged(snapshot, held);
});

// Execute the two unchanged historical intersection controls against this same
// trapped facade. No original index/provider implementation is imported.
const legacyPath = fileURLToPath(new URL('./modeling-intersection.test.mjs', import.meta.url)), legacyBytes = readFileSync(legacyPath, 'utf8');
const legacyKey = Symbol.for('barocss.translated-intersection.legacy-controls');
globalThis[legacyKey] = { cad: { model: createCadModel, load: loadCadModel }, CadModelError, CadModelLimits };
const legacyEntry = legacyBytes.replace(/^const \{ cad, CadModelError, CadModelLimits \} = await import\([^\n]*\);$/m,
  "const { cad, CadModelError, CadModelLimits } = globalThis[Symbol.for('barocss.translated-intersection.legacy-controls')];");
assert.notEqual(legacyEntry, legacyBytes);
if (provenance) {
  for (const [name, bytes] of [['legacy-intersection-original.mjs', legacyBytes], ['legacy-intersection-entry.mjs', legacyEntry]])
    writeFileSync(resolve(provenance.directory, name), bytes, { flag: 'wx' });
  provenance.legacyIntersection = { originalSHA256: sha256(legacyBytes), entrySHA256: sha256(legacyEntry), scope: 'unchanged two control bodies; only provider entry replaced by trapped actual facade' };
}
await import('data:text/javascript;base64,' + Buffer.from(legacyEntry).toString('base64'));
delete globalThis[legacyKey];

