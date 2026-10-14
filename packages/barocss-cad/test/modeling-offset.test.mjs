import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { authoredDocument, signedData, exactData, deepFrozen, sha256 } from './modeling-offset-fixture.mjs';

// Normal source/emitted controls use invalid output sentinels for every load.
// Optional constructor audit replaces EVERY modeling provider import. Only that
// isolated audit may build/load a valid graph, using explicitly labelled inert
// shape-only stubs. It never imports a provider implementation through modeling.
const trap = process.env.CAD_MODEL_OFFSET_ADMISSION_TRAP === '1';
const trapKey = Symbol.for('barocss.modeling-offset.admission-trap');
let api, state;
if (trap) {
  assert.equal(process.env.CAD_MODEL_TEST_MODULE, undefined, 'isolated constructor audit uses the source modeling entry');
  const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? new URL('../../..', import.meta.url).pathname, 'package.json'));
  const { build } = require('esbuild');
  state = { unexpected: 0, expected: 0, stubs: [], allowStub: false, expectTrap: false, cause: new Error('EXPECTED_CONSTRUCTOR_TRAP') };
  globalThis[trapKey] = state;
  const imports = new Map([
    ['xy-arc', 'buildXYArc'], ['xy-circle-prism-shell', 'buildXYCirclePrismShell'], ['stored-circle-prism-solid', 'qualifyStoredCirclePrismSolid'],
    ['xy-affine-sketch', 'buildXYAffineSketch'], ['xy-affine-sketch-prism', 'buildXYAffineSketchPrism'],
    ['convex-planar-slab-subtraction', 'subtractConvexPlanarSlab'], ['convex-planar-solid-intersection', 'intersectConvexPlanarSolids'],
    ['convex-planar-solid-split', 'splitConvexPlanarSolid'], ['model-compiler', 'compileCadModel'],
    ['convex-planar-solid-chamfer', 'chamferConvexPlanarSolid'], ['axis-box-boolean', 'buildAxisBoxSolidBoolean'],
    ['orthogonal-solid-boolean', 'buildOrthogonalSolidBoolean'], ['modeling-box-internal', 'buildModelingBox'],
    ['modeling-translation-internal', 'buildModelingTranslation'], ['modeling-rotation-internal', 'buildModelingRotation'], ['modeling-mirror-internal', 'buildModelingMirror'], ['modeling-stl-internal', 'buildModelingStl'],
    ['own-plate-circular-hole', 'buildOwnPlateCircularHole'], ['stored-plate-hole-solid', 'qualifyStoredPlateHoleSolid'],
  ]);
  const source = new URL('../src/modeling.ts', import.meta.url).pathname, replaced = new Set();
  const output = await build({ entryPoints: [source], bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true,
    plugins: [{ name: 'modeling-offset-constructor-trap', setup(build) {
      build.onResolve({ filter: /^\.\/.*\.js$/ }, args => {
        const key = args.path.slice(2, -3); if (args.importer === source && imports.has(key)) { replaced.add(key); return { path: key, namespace: 'offset-trap' }; }
      });
      build.onLoad({ filter: /.*/, namespace: 'offset-trap' }, args => ({ loader: 'js', contents: `
        export function ${imports.get(args.path)}(...args) {
          const state = globalThis[Symbol.for('barocss.modeling-offset.admission-trap')];
          if (state.allowStub) {
            state.stubs.push(${JSON.stringify(imports.get(args.path))});
            if (${JSON.stringify(args.path)} === 'xy-affine-sketch') return { document: args[0], solution: { points: args[0].points } };
            if (${JSON.stringify(args.path)} === 'xy-affine-sketch-prism') return { request: { sketch: args[0], options: args[1] }, solid: { controlOnly: true }, report: {}, lineage: {} };
            if (${JSON.stringify(args.path)} === 'own-plate-circular-hole') return { bundle: { controlOnly: true } };
            if (${JSON.stringify(args.path)} === 'stored-plate-hole-solid') return { controlOnly: true };
          }
          if (state.expectTrap) state.expected++; else state.unexpected++;
          throw state.cause;
        }` }));
    } }] });
  assert.deepEqual([...replaced].sort(), [...imports.keys()].sort());
  let provenance;
  if (process.env.EVIDENCE_DIR) {
    const parent = resolve(process.env.EVIDENCE_DIR), directory = resolve(parent, 'modeling-offset-admission-trap');
    mkdirSync(parent, { recursive: true }); mkdirSync(directory); // Exclusive run-owned directory; never overwrite a prior audit.
    const save = (name, bytes) => { writeFileSync(resolve(directory, name), bytes, { flag: 'wx' }); return { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) }; };
    const inputHashes = Object.fromEntries(Object.keys(output.metafile.inputs).filter(path => !path.startsWith('offset-trap:')).sort()
      .map(path => [path, sha256(readFileSync(resolve(path)))]));
    provenance = { directory, bundle: save('bundle.mjs', output.outputFiles[0].text),
      metafile: save('bundle.metafile.json', JSON.stringify(output.metafile, null, 2) + '\n'),
      sourceInputs: save('source-inputs.json', signedData(inputHashes) + '\n'), replacedProviderBindings: [...imports.values()].sort() };
  }
  const module = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'));
  api = { ...module, cad: { model: module.createCadModel, load: module.loadCadModel } };
  after(() => {
    if (provenance) writeFileSync(resolve(provenance.directory, 'receipt.json'), signedData({ issue: 1724,
      scope: 'isolated source constructor boundary and explicitly inert shape-only stubs; no geometric acceptance',
      realNativeGeometryCalls: 0, unexpectedProviderAttempts: state.unexpected, expectedThrowingTrapCalls: state.expected,
      shapeOnlyStubCalls: state.stubs, provenance, fullTransitiveNativeCoverage: 'NOT_MEASURED' }) + '\n', { flag: 'wx' });
    assert.equal(state.unexpected, 0, 'all rejected admissions preceded every provider'); assert.equal(state.allowStub, false); delete globalThis[trapKey];
  });
} else api = await import(process.env.CAD_MODEL_TEST_MODULE ? pathToFileURL(resolve(process.env.CAD_MODEL_TEST_MODULE)).href : '../dist/index.js');
const { cad, CadModelError, CadModelLimits } = api;
const refuses = (action, code, operation) => assert.throws(action, error => {
  assert.ok(error instanceof CadModelError); assert.notEqual(error.code, 'NATIVE');
  assert.ok((Array.isArray(code) ? code : [code]).includes(error.code), error.message);
  if (operation) assert.equal(error.operation, operation); if (trap) assert.equal(state.unexpected, 0); return true;
});
const sketch = m => m.sketch.rectangle({ min: [-0, 0], max: [32, 24] });
function sentinelDocument() { const d = authoredDocument(); d.outputs.part.side = 'negative'; return d; }
function check(edit = () => {}, code = 'INPUT', operation) { const d = sentinelDocument(); edit(d); refuses(() => cad.load(signedData(d)), code, operation); }
function stubs(action) { assert.ok(trap); state.allowStub = true; try { return action(); } finally { state.allowStub = false; } }

test('extrude overload admits only one height or a height plus exact own from record; failures spend no slot', () => {
  const m = cad.model(), s = sketch(m); let reads = 0;
  const getter = { get from() { reads++; return 0; } }, hidden = Object.defineProperty({ from: 0 }, 'extra', { value: 1 });
  for (const options of [undefined, null, [], {}, { start: 0 }, { from: 0, extra: 1 }, Object.create({ from: 0 }), getter, hidden, { from: 0, [Symbol('extra')]: 1 }])
    refuses(() => s.extrude(3, options), 'INPUT', 'extrude');
  refuses(() => s.extrude(), 'INPUT', 'extrude'); refuses(() => s.extrude(undefined), 'OWNERSHIP');
  for (const args of [[3, undefined, 0], [3, { from: 0 }, 0], [3, { from: 0 }, undefined]]) refuses(() => s.extrude(...args), 'INPUT', 'extrude');
  assert.equal(reads, 0);
  assert.ok(Object.isFrozen(s.extrude(3))); assert.ok(Object.isFrozen(s.extrude(3, Object.assign(Object.create(null), { from: -0 }))));
  refuses(() => s.extrude(3, { from: 0 }), 'CAPABILITY');
  assert.equal(CadModelLimits.nodes, 6); assert.equal(CadModelLimits.sketches, 2); assert.equal(CadModelLimits.extrusions, 2);
});

test('both height and from require this model’s original literal, parameter or expression identity', () => {
  for (const slot of ['height', 'from']) {
    const m = cad.model(), own = m.parameter('level', 2), expression = m.dimension.scale(own, -1), foreign = cad.model();
    const foreignParameter = foreign.parameter('level', 2), foreignExpression = foreign.dimension.scale(foreignParameter, -1), s = sketch(m);
    for (const bad of [foreignParameter, foreignExpression, { ...own }, { ...expression }, { parameter: 'level' },
      { op: 'scale', value: own, factor: -1 }, null, undefined, '2', true, [], {}])
      refuses(() => slot === 'height' ? s.extrude(bad, { from: 0 }) : s.extrude(3, { from: bad }), 'OWNERSHIP');
    assert.ok(Object.isFrozen(s.extrude(own, { from: expression }))); assert.ok(Object.isFrozen(s.extrude(own, { from: own })));
    refuses(() => s.extrude(3, { from: 0 }), 'CAPABILITY');
  }
});

test('finite bounded exact offset sums reject before append, including the specified decimal and top-bound cases', () => {
  const m = cad.model(), s = sketch(m);
  for (const from of [NaN, Infinity, -Infinity, -10001, 10001]) refuses(() => s.extrude(1, { from }), 'PARAMETER');
  for (const height of [NaN, Infinity, -Infinity, -1, -0, 0, 10001]) refuses(() => s.extrude(height, { from: 0 }), 'PARAMETER');
  for (const [from, height] of [[.1, .2], [9999, 2], [10000, 1], [-10000, .1], [1, Number.MIN_VALUE]])
    refuses(() => s.extrude(height, { from }), 'PARAMETER');
  const p = m.parameter('fraction', .1), offset = m.dimension.add(p, 0), h = m.dimension.scale(p, 2);
  refuses(() => s.extrude(h, { from: offset }), 'PARAMETER');
  const edge = m.parameter('edge', 9999); refuses(() => s.extrude(2, { from: m.dimension.add(edge, 0) }), 'PARAMETER');
  assert.ok(Object.isFrozen(s.extrude(3, { from: -2 }))); assert.ok(Object.isFrozen(s.extrude(10000, { from: -10000 })));
  refuses(() => s.extrude(1, { from: 0 }), 'CAPABILITY');
});

test('circle placement options always refuse and do not consume either existing extrusion slot', () => {
  const m = cad.model(), c = m.sketch.circle({ center: [0, 0], radius: 1 }), p = m.parameter('z', 0);
  for (const from of [0, -0, -2, p, m.dimension.scale(p, -1)]) refuses(() => c.extrude(3, { from }), 'CAPABILITY', 'extrude');
  for (const options of [undefined, null, {}, { from: 0, extra: true }]) refuses(() => c.extrude(3, options), 'INPUT', 'extrude');
  refuses(() => c.extrude(3, { from: 0 }, true), 'INPUT', 'extrude');
  assert.ok(c.extrude(3)); assert.ok(c.extrude(4)); refuses(() => c.extrude(5), 'CAPABILITY');
});

test('cold schema1 admits optional from and strictly rejects malformed dimensions or extrude fields before sentinel', () => {
  check(() => {}, 'INPUT', 'body');
  for (const from of [null, true, '4', [], {}, { parameter: 'depth', extra: 1 }, { op: 'scale', value: 4 },
    { op: 'scale', value: 4, factor: 1, extra: 0 }, { op: 'add', left: 4 }, { op: 'unknown', value: 4 }])
    check(d => { d.nodes[3].from = from; });
  check(d => { d.nodes[3].from = { parameter: 'missing' }; }, 'PARAMETER');
  for (const field of ['options', 'fromMM', 'placement', 'native', 'lineage']) check(d => { d.nodes[3][field] = 0; });
  for (const field of ['height', 'sketch']) check(d => { delete d.nodes[3][field]; });
  for (const reference of [-0, -1, 1, 3, 4, .5, null]) check(d => { d.nodes[3].sketch = reference; });
  for (const from of [0, -0, -2, { parameter: 'depth' }, { op: 'scale', value: { parameter: 'depth' }, factor: -1 }])
    check(d => { d.nodes[3].from = from; }, 'INPUT', 'body');
  check(d => { delete d.nodes[3].from; }, 'INPUT', 'body');
  for (const [from, height] of [[10001, 1], [-10001, 1], [9999, 2], [.1, .2], [0, 0], [0, -0], [0, -1], [0, 10001]])
    check(d => { d.nodes[3].from = from; d.nodes[3].height = height; }, 'PARAMETER');
  for (const from of [0, -0, -2, { parameter: 'depth' }]) check(d => {
    d.nodes[2] = { kind: 'sketch', profile: 'circle', center: [8, 8], radius: 2 }; d.nodes[3].from = from;
  }, 'CAPABILITY', 'extrude');
  for (const raw of ['1e309', '-1e309', 'NaN', 'Infinity']) {
    const text = signedData(sentinelDocument()).replace('"from":{', '"from":' + raw + ',"unreachable":{');
    refuses(() => cad.load(text), ['FORMAT', 'PARAMETER']);
  }
});

test('from codec preserves the existing dimension depth, occurrence and intermediate-value limits', () => {
  const scale = value => ({ op: 'scale', value, factor: 1 });
  let from = { parameter: 'depth' };
  for (let i = 0; i < CadModelLimits.dimensionDepth - 1; i++) from = scale(from);
  check(d => { d.nodes[3].from = from; }, 'INPUT', 'body');
  check(d => { d.nodes[3].from = scale(from); }, 'BUDGET');
  const tree = depth => depth === 0 ? 0 : { op: 'add', left: tree(depth - 1), right: tree(depth - 1) };
  check(d => { d.nodes[3].from = tree(4); }, 'INPUT', 'body');
  check(d => { d.nodes[3].from = tree(5); }, 'BUDGET');
  check(d => { d.nodes[3].from = { op: 'scale', value: { op: 'add', left: 9999, right: 2 }, factor: 0 }; }, 'PARAMETER');
});

test('displaced hole builder/cold admission refuses before geometry and rejected holes leave the sole slot available', () => {
  for (const from of [-2, 2]) {
    const m = cad.model(), s = sketch(m), moved = s.extrude(3, { from }), zero = s.extrude(3, { from: -0 });
    refuses(() => moved.hole({ center: [16, 12], radius: 1 }), 'CAPABILITY', 'hole'); assert.ok(zero.hole({ center: [16, 12], radius: 1 }));
  }
  const doc = from => ({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { from }, nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [32, 24] }, { kind: 'extrude', sketch: 0, height: 8, from: { parameter: 'from' } },
    { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [16, 12], radius: 1 },
  ], outputs: { part: { node: 2, side: 'negative' } } });
  for (const from of [-2, 2]) refuses(() => cad.load(signedData(doc(from))), 'CAPABILITY', 'hole');
  for (const from of [0, -0]) refuses(() => cad.load(signedData(doc(from))), 'INPUT', 'body');
});

test('isolated trap confirms valid build reaches exactly one trapped provider and retains its original cause', { skip: !trap }, () => {
  const m = cad.model(), part = sketch(m).extrude(3, { from: -2 }); state.expectTrap = true;
  try { assert.throws(() => m.build({ part }), error => error instanceof CadModelError && error.code === 'NATIVE' && error.cause === state.cause); }
  finally { state.expectTrap = false; }
  assert.equal(state.expected, 1); assert.equal(state.unexpected, 0);
});

test('shape-only trapped snapshots prove rejected-node atomicity and explicit versus omitted signed encoding', { skip: !trap }, () => {
  const m = cad.model(), s = sketch(m);
  refuses(() => s.extrude(.2, { from: .1 }), 'PARAMETER'); refuses(() => s.extrude(3, undefined), 'INPUT');
  const omitted = s.extrude(3), explicit = s.extrude(3, { from: -0 });
  const snapshot = stubs(() => m.build({ omitted, explicit })), text = snapshot.save(), d = JSON.parse(text);
  exactData(d.nodes.slice(1), [{ kind: 'extrude', sketch: 0, height: 3 }, { kind: 'extrude', sketch: 0, height: 3, from: -0 }]);
  assert.equal(Object.hasOwn(snapshot.evidence[1].native.request.options, 'fromMM'), false);
  assert.ok(Object.is(snapshot.evidence[2].native.request.options.fromMM, -0)); assert.ok(text.includes('"from":-0'));
  const reopened = stubs(() => cad.load(text)); assert.equal(reopened.save(), text); exactData(reopened.evidence, snapshot.evidence);
});

test('shape-only trapped parameter/expression negative zero survives save and exact no-op invalidation', { skip: !trap }, () => {
  for (const kind of ['parameter', 'expression']) {
    const model = cad.model(), z = model.parameter('z', -0), from = kind === 'parameter' ? z : model.dimension.scale(z, 1);
    const part = sketch(model).extrude(3, { from }), accepted = stubs(() => model.build({ part }));
    assert.ok(Object.is(accepted.evidence[1].native.request.options.fromMM, -0)); assert.ok(accepted.save().includes('"z":-0'));
    const reopened = stubs(() => cad.load(accepted.save())); assert.equal(reopened.save(), accepted.save()); exactData(reopened.evidence, accepted.evidence);
    const old = accepted.save(), body = accepted.bodies.part, before = state.stubs.length;
    const noop = accepted.withParameters({ z: -0 }); assert.equal(state.stubs.length, before);
    assert.equal(noop.bodies.part, body); exactData(noop.recomputation, { reusedFeatures: [0, 1], evaluatedFeatures: [] });
    const changed = stubs(() => accepted.withParameters({ z: 0 }));
    exactData(changed.recomputation, { reusedFeatures: [0], evaluatedFeatures: [1] });
    assert.ok(Object.is(changed.evidence[1].native.request.options.fromMM, 0)); assert.notEqual(changed.evidence[1], accepted.evidence[1]);
    assert.equal(accepted.save(), old); assert.equal(accepted.bodies.part, body); deepFrozen(accepted);
  }
});

test('shape-only trapped accepted snapshots keep failed offset and displaced-hole edits atomic without native calls', { skip: !trap }, () => {
  for (const hole of [false, true]) {
    const m = cad.model(), z = m.parameter('z', 0), height = m.parameter('height', 8), base = sketch(m).extrude(height, { from: z });
    const part = hole ? base.hole({ center: [16, 12], radius: 1 }) : base, accepted = stubs(() => m.build({ part }));
    const text = accepted.save(), bodies = accepted.bodies, evidence = accepted.evidence, before = state.stubs.length;
    for (const edits of [{ z: 9999, height: 2 }, { z: .1, height: .2 }, { height: 0 }, { z: Infinity }]) refuses(() => accepted.withParameters(edits), 'PARAMETER');
    if (hole) for (const z of [-2, 2]) refuses(() => accepted.withParameters({ z }), 'CAPABILITY', 'hole');
    assert.equal(state.stubs.length, before); assert.equal(accepted.save(), text); assert.equal(accepted.bodies, bodies); assert.equal(accepted.evidence, evidence); deepFrozen(accepted);
    const noop = accepted.withParameters({ z: 0 }); assert.equal(noop.bodies.part, bodies.part); assert.equal(state.stubs.length, before);
  }
});
