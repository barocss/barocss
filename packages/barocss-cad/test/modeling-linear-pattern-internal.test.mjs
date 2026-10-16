import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

// ZERO-NATIVE wrapper controls. Synthetic data below is deliberately NOT a
// qualified Solid, native Face, native translation or geometric lineage proof.
// Only validateConvexPlanarSolid and buildModelingTranslation are replaced.
// The actual occurrence ledger, comparison/error helpers and rational context
// remain in the bundle. Default execution checks source AND checked emit.
const root = fileURLToPath(new URL('../../..', import.meta.url));
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const { build } = require('esbuild');
const entries = process.env.CAD_MODEL_PATTERN_INTERNAL_ENTRY
  ? [resolve(process.env.CAD_MODEL_PATTERN_INTERNAL_ENTRY)]
  : ['../src/modeling-linear-pattern-internal.ts', '../dist/modeling-linear-pattern-internal.js'].map(path => fileURLToPath(new URL(path, import.meta.url)));
const allowed = new Set(['modeling-linear-pattern-internal', 'convex-planar-solid-proof-internal', 'section-rational-internal', 'numeric-policy']);
const providers = new Map([['convex-planar-solid', 'validateConvexPlanarSolid'], ['modeling-translation-internal', 'buildModelingTranslation']]);
const marker = 'INERT_PATTERN_WRAPPER_CONTROL_NOT_GEOMETRY';
const clone = value => structuredClone(value);
const keys = [];

// One synthetic triangle and one global edge/vertex are intentionally not a
// closed Solid. A validator trap admits it only to exercise wrapper decisions.
function inertParent(x = 0) {
  const points = [[x, -0, 0], [x + 1, -0, 0], [x, -0, 1]];
  const edges = points.map((point, i) => ({ kind: 'curve', id: 'c' + i, degree: 1, knots: [0, 0, 1, 1],
    controlPoints: [point, points[(i + 1) % points.length]], weights: [1, 1] }));
  const face = { plane: { kind: 'surface', id: 'surface', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1],
    controlPoints: [[points[0], points[1]], [points[2], points[0]]], weights: [[1, 1], [1, 1]] },
    loop: { id: 'loop', edges }, options: { faceId: 'face', evaluationId: 'model', resultIdPrefix: 'local', orientation: 'forward' },
    topology: { vertices: points.map((point, i) => ({ id: 'lv' + i, point })),
      edges: edges.map((edge, i) => ({ id: 'le' + i, curveId: edge.id, vertexIds: ['lv' + i, 'lv' + (i + 1) % points.length] })),
      loop: { uses: edges.map((edge, i) => ({ id: 'use' + i, edgeId: 'le' + i, curveId: edge.id, pcurveId: 'uv' + i,
        vertexIds: ['lv' + i, 'lv' + (i + 1) % points.length], sense: 'forward', interval: [0, 1] })) } },
    pcurves: edges.map((edge, i) => ({ id: 'uv' + i, curveId: edge.id, edgeId: 'le' + i })) };
  return { controlOnly: marker, request: { options: { solidId: 'parent_solid', resultIdPrefix: 'parent' },
    assets: [{ sourceId: 'source', face }], edgePairs: [] },
    graph: { edges: [{ id: 'global_edge' }], vertices: [{ id: 'global_vertex', pointMM: points[0] }] },
    certificate: { solid: false, controlOnly: marker }, report: { solid: true, controlOnly: marker } };
}
function inertChild(parent, offsetMM, prefix) {
  const facePrefix = prefix + '_f0', original = parent.request.assets[0].face;
  const point = source => source.map((value, axis) => offsetMM[axis] === 0 ? value : value + offsetMM[axis]);
  const edges = original.loop.edges.map((edge, i) => ({ ...clone(edge), id: facePrefix + '_curve_' + i, controlPoints: edge.controlPoints.map(point) }));
  const face = { plane: { ...clone(original.plane), id: facePrefix + '_surface', controlPoints: original.plane.controlPoints.map(row => row.map(point)) },
    loop: { id: facePrefix + '_loop', edges }, options: { faceId: facePrefix + '_face', evaluationId: facePrefix + '_model',
      resultIdPrefix: facePrefix, orientation: original.options.orientation },
    topology: { vertices: original.topology.vertices.map((vertex, i) => ({ id: facePrefix + '_v_' + i, point: point(vertex.point) })),
      edges: original.topology.edges.map((edge, i) => ({ id: facePrefix + '_e_' + i, curveId: edges[i].id,
        vertexIds: [facePrefix + '_v_' + i, facePrefix + '_v_' + (i + 1) % edges.length] })),
      loop: { uses: original.topology.loop.uses.map((use, i) => ({ ...clone(use), id: facePrefix + '_use_' + i,
        edgeId: facePrefix + '_e_' + i, curveId: edges[i].id, pcurveId: facePrefix + '_uv_' + i,
        vertexIds: [facePrefix + '_v_' + i, facePrefix + '_v_' + (i + 1) % edges.length] })) } },
    pcurves: original.pcurves.map((curve, i) => ({ id: facePrefix + '_uv_' + i, curveId: edges[i].id, edgeId: facePrefix + '_e_' + i })) };
  const targetReport = { solid: true, controlOnly: marker };
  return { controlOnly: marker, request: { parent: clone(parent), offsetMM: clone(offsetMM), prefix },
    solid: { controlOnly: marker, request: { options: { solidId: prefix + '_solid', resultIdPrefix: prefix + '_s' },
      assets: [{ sourceId: facePrefix + '_src', face }], edgePairs: [] },
      graph: { edges: parent.graph.edges.map((_, i) => ({ id: prefix + '_s_e_' + i })),
        vertices: parent.graph.vertices.map((vertex, i) => ({ id: prefix + '_s_v_' + i, pointMM: point(vertex.pointMM) })) },
      certificate: { solid: true, controlOnly: marker }, report: targetReport },
    lineage: Object.fromEntries(['faces', 'curves', 'pcurves', 'uses', 'localEdges', 'localVertices', 'edges', 'vertices'].map(key => [key, []])),
    report: { controlOnly: marker, parentValidation: clone(parent.report), targetQualification: targetReport,
      directCalls: { parentValidationCount: 1, initialFaceConstructionCount: 1, targetQualificationCount: 1, retries: 0 } } };
}

async function harness(entry) {
  assert.ok(existsSync(entry), 'Checked source/emitted leaf must exist: ' + entry);
  assert.match(basename(entry), /^modeling-linear-pattern-internal\.(?:ts|js)$/);
  const mode = extname(entry) === '.ts' ? 'source' : 'emitted';
  const trapKey = Symbol.for('barocss.pattern-internal.zero-native.' + mode);
  assert.equal(globalThis[trapKey], undefined, 'Never replace another active trap'); keys.push(trapKey);
  const state = { open: false, calls: [], unexpected: [], validatorError: undefined, secondError: undefined, alterChild: undefined };
  const dispatch = (binding, args) => {
    if (!state.open) { state.unexpected.push(binding); throw new Error('UNEXPECTED_PROVIDER_ATTEMPT: ' + binding); }
    const call = { binding, args }; state.calls.push(call);
    if (binding === 'validateConvexPlanarSolid') {
      if (state.validatorError) throw state.validatorError;
      return call.result = clone(args[0].report);
    }
    if (binding === 'buildModelingTranslation') {
      const instance = state.calls.filter(call => call.binding === binding).length;
      if (instance === 2 && state.secondError) throw state.secondError;
      call.result = inertChild(...args);
      if (state.alterChild) state.alterChild(call.result, instance);
      return call.result;
    }
    state.unexpected.push(binding); throw new Error('UNKNOWN_PROVIDER_ATTEMPT: ' + binding);
  };
  globalThis[trapKey] = { dispatch };
  const replaced = new Set();
  const bundle = await build({ stdin: { contents: `export * from ${JSON.stringify(entry)};
    export {SolidSnapshotLedger,ConvexPlanarSolidError} from './convex-planar-solid-proof-internal.js';
    export {SectionRationalContext} from './section-rational-internal.js';`, resolveDir: dirname(entry), loader: 'js' },
    bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true,
    plugins: [{ name: 'pattern-wrapper-native-traps', setup(build) {
      build.onResolve({ filter: /\.(?:ts|js)$/ }, args => {
        const key = basename(args.path, extname(args.path));
        if (providers.has(key)) { replaced.add(key); return { path: key, namespace: 'pattern-trap' }; }
        assert.ok(allowed.has(key), 'Unreviewed implementation cannot enter wrapper control: ' + args.path);
      });
      build.onLoad({ filter: /.*/, namespace: 'pattern-trap' }, args => ({ contents:
        `export function ${providers.get(args.path)}(...args){return globalThis[Symbol.for(${JSON.stringify(Symbol.keyFor(trapKey))})].dispatch(${JSON.stringify(providers.get(args.path))},args);}`, loader: 'js' }));
    } }] });
  assert.deepEqual([...replaced].sort(), [...providers.keys()].sort());
  const actual = Object.keys(bundle.metafile.inputs).filter(path => !path.startsWith('pattern-trap:') && path !== '<stdin>')
    .map(path => basename(path, extname(path))).sort();
  assert.deepEqual(actual, [...allowed].sort(), 'Only actual leaf, ledger/proof and rational implementations remain');
  const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  return { mode, state, api, run(action, options = {}) {
    state.calls = []; state.validatorError = options.validatorError; state.secondError = options.secondError; state.alterChild = options.alterChild;
    state.open = true;
    try { return action(api.buildModelingLinearPattern); } finally { state.open = false; }
  } };
}
function refusal(action, code, stage) {
  let error;
  try { action(); } catch (cause) { error = cause; }
  assert.equal(error?.name, 'ModelingLinearPatternError'); assert.equal(error.code, code);
  if (stage) assert.equal(error.stage, stage);
  assert.equal(Object.hasOwn(error, 'copies'), false, 'No partially accepted pattern');
  assert.ok(Object.isFrozen(error.report)); assert.ok(Object.isFrozen(error.report.completedChildReports));
  return error;
}
const controls = await Promise.all(entries.map(harness));
for (const control of controls) {
  const { mode, state, api, run } = control;
  const calls = binding => state.calls.filter(call => call.binding === binding);
  const noChildren = () => { assert.equal(calls('validateConvexPlanarSolid').length, 1); assert.equal(calls('buildModelingTranslation').length, 0); };
  test(mode + ': first copy fits but second copy overflows before either child', () => {
    const parent = inertParent(32), before = clone(parent);
    const error = refusal(() => run(build => build(parent, [4992, 0, 0], 'p')), 'REPRESENTABILITY', 'stage-coefficients');
    assert.match(error.entity, /^p_i2\//); noChildren(); assert.equal(error.report.directCalls.translationCount, 0);
    assert.deepEqual(parent, before); assert.equal(Object.isFrozen(parent), false);
  });
  test(mode + ': rounded exact addition refuses using actual rational arithmetic', () => {
    const error = refusal(() => run(build => build(inertParent(1), [Number.MIN_VALUE, 0, 0], 'p')), 'REPRESENTABILITY', 'stage-coefficients');
    noChildren(); assert.ok(error.report.exactWork.maximumObservedBits >= 1074); assert.equal(error.report.exactWork.floatConversions, 0);
  });
  test(mode + ': signed-zero copying, positive cancellation and same original parent routing', () => {
    const parent = inertParent(-1), before = clone(parent), result = run(build => build(parent, [1, -0, 0], 'p'));
    assert.equal(calls('validateConvexPlanarSolid').length, 1); const children = calls('buildModelingTranslation'); assert.equal(children.length, 2);
    assert.equal(children[0].args[0], children[1].args[0]); assert.notEqual(children[0].args[0], parent);
    assert.ok(Object.isFrozen(children[0].args[0])); assert.deepEqual(children.map(call => call.args[1]), [[1, -0, 0], [2, -0, 0]]);
    assert.deepEqual(children.map(call => call.args[2]), ['p_i1', 'p_i2']);
    const p = result.copies[0].solid.request.assets[0].face.plane.controlPoints[0][0]; assert.ok(Object.is(p[0], 0)); assert.ok(Object.is(p[1], -0));
    assert.deepEqual(result.report.directCalls, { parentValidationCount: 1, translationCount: 2, retries: 0 });
    assert.deepEqual(result.report.totalNativeCalls, { parentValidationCount: 3, initialFaceConstructionCount: 2, targetQualificationCount: 2, retries: 0 });
    assert.deepEqual(result.report.preflight, { copyCount: 2, faceCount: 2, surfaceCoordinateCount: 24, curveCoordinateCount: 36 });
    assert.deepEqual(parent, before); assert.equal(Object.isFrozen(parent), false); assert.equal(result.copies[0].controlOnly, marker);
  });
  test(mode + ': full global and local namespace collisions refuse before children', () => {
    for (const alter of [parent => { parent.graph.edges[0].id = 'p_i2_s_e_0'; }, parent => { parent.request.assets[0].face.pcurves[0].id = 'p_i1_f0_uv_0'; }]) {
      const parent = inertParent(); alter(parent);
      refusal(() => run(build => build(parent, [1, 0, 0], 'p')), 'IDENTITY', 'identity'); noChildren();
    }
  });
  test(mode + ': own parent and step getters are refused without execution', () => {
    let reads = 0; const parent = inertParent(); Object.defineProperty(parent, 'report', { enumerable: true, get() { reads++; return {}; } });
    refusal(() => run(build => build(parent, [1, 0, 0], 'p')), 'INPUT', 'snapshot');
    assert.equal(state.calls.length, 0); assert.equal(reads, 0);
    const step = [1, 0, 0]; Object.defineProperty(step, '0', { enumerable: true, get() { reads++; return 1; } });
    refusal(() => run(build => build(inertParent(), step, 'p')), 'INPUT', 'snapshot');
    assert.equal(state.calls.length, 0); assert.equal(reads, 0);
  });
  test(mode + ': second child failure preserves the first report and original cause', () => {
    const originalProgress = { directCalls: { parentValidationCount: 1, initialFaceConstructionCount: 0, targetQualificationCount: 0, retries: 0 } };
    const cause = Object.assign(new Error('inert second child native refusal'), { code: 'OWNED', report: originalProgress });
    const parent = inertParent(), before = clone(parent);
    const error = refusal(() => run(build => build(parent, [1, 0, 0], 'p'), { secondError: cause }), 'OWNED', 'copy-construction');
    assert.equal(error.cause, cause); assert.equal(cause.report, originalProgress); assert.equal(Object.isFrozen(originalProgress), false);
    const children = calls('buildModelingTranslation'); assert.equal(children.length, 2); assert.equal(error.report.directCalls.translationCount, 2);
    assert.equal(error.report.completedChildReports.length, 1); assert.equal(error.report.completedChildReports[0], children[0].result.report);
    assert.ok(Object.isFrozen(error.report.completedChildReports[0])); assert.equal(error.entity, 'p_i2'); assert.deepEqual(parent, before);
  });
  test(mode + ': both actual child coefficient sets must match the preflight', () => {
    const error = refusal(() => run(build => build(inertParent(), [1, 0, 0], 'p'), { alterChild(child, instance) {
      if (instance === 2) child.solid.request.assets[0].face.plane.controlPoints[0][0][0] += 1;
    } }), 'BINDING', 'copy-binding');
    assert.equal(error.report.directCalls.translationCount, 2); assert.equal(error.report.completedChildReports.length, 2);
  });
  test(mode + ': inventory and occurrence budgets remain real ledger refusals', () => {
    const parent = inertParent(); parent.request.assets = Array.from({ length: 11 }, () => parent.request.assets[0]);
    refusal(() => run(build => build(parent, [1, 0, 0], 'p')), 'BUDGET', 'admission'); noChildren();
    const excessive = inertParent(); excessive.extra = 'x'.repeat(262145);
    refusal(() => run(build => build(excessive, [1, 0, 0], 'p')), 'BUDGET', 'snapshot'); assert.equal(state.calls.length, 0);
    const ledger = new api.SolidSnapshotLedger(), aliases = ['q'.repeat(262144), 'q'.repeat(262144)];
    ledger.copy(aliases, true, true); assert.ok(ledger.bytes > 524288); assert.equal(ledger.retainedBytes, 0);
  });
  test(mode + ': parent validator cause and completion boundary remain unchanged', () => {
    const cause = new api.ConvexPlanarSolidError('CONVEXITY', 'inert parent validator refusal');
    const error = refusal(() => run(build => build(inertParent(), [1, 0, 0], 'p'), { validatorError: cause }), 'CONVEXITY', 'parent-validation');
    noChildren(); assert.equal(error.cause, cause); assert.equal(error.report.parentValidation, null);
    assert.deepEqual(error.report.completedChildReports, []); assert.equal(error.report.exactWork.operations, 0);
  });
  test(mode + ': malformed steps and long prefixes refuse before parent validation', () => {
    for (const step of [[0, 0, 0], [-1, 0, 0], [1, 2, 0], [1, 0]]) {
      refusal(() => run(build => build(inertParent(), step, 'p')), 'INPUT', 'admission'); assert.equal(state.calls.length, 0);
    }
    refusal(() => run(build => build(inertParent(), [1, 0, 0], 'abcdefghijklmn')), 'IDENTITY', 'admission'); assert.equal(state.calls.length, 0);
  });
}
after(() => {
  for (const { state } of controls) { assert.deepEqual(state.unexpected, []); assert.equal(state.open, false); }
  for (const key of keys) delete globalThis[key];
});
