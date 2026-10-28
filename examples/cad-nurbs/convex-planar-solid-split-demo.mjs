import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Session } from 'node:inspector';
const [mode, directory] = process.argv.slice(2);
assert.ok(['--source', '--emitted', '--cold'].includes(mode) && directory, 'Usage: node convex-planar-solid-split-demo.mjs --source|--emitted|--cold output-directory');
assert.equal(process.versions.node.split('.')[0], '22', `Node 22 required, got ${process.versions.node}`);
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(directory);
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
let api;
if (mode === '--source') {
  const built = await require('esbuild').build({ entryPoints: [resolve(repo, 'packages/barocss-cad/src/index.ts')], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
  assert.ok(Object.keys(built.metafile.inputs).every(p => !p.includes('/dist/')));
  const target = resolve(output, 'split-source.mjs'); writeFileSync(target, built.outputFiles[0].text); api = await import(pathToFileURL(target));
} else api = await import(pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')));
const { buildConvexPlanarFace, qualifyConvexPlanarSolid, splitConvexPlanarSolid: split, validateConvexPlanarSolidSplit: validate, ConvexPlanarSolidSplitError, compileCadModel } = api;
// Native APIs are not patched: precise V8 entry counts include failed calls and validator reconstruction.
const inspector = new Session(); inspector.connect();
const post = (method, params = {}) => new Promise((ok, no) => inspector.post(method, params, (error, result) => error ? no(error) : ok(result)));
await post('Profiler.enable'); await post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
const nativeJSON = value => typeof value === 'number' && Object.is(value, -0) ? '-0' : Array.isArray(value) ? '[' + value.map(nativeJSON).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.entries(value).map(([k, v]) => JSON.stringify(k) + ':' + nativeJSON(v)).join(',') + '}' : JSON.stringify(value);
const write = (name, data) => writeFileSync(resolve(output, name), nativeJSON(data) + '\n');
const plus = (a, b) => a.map((v, i) => v + b[i]);
function surface(id, origin, u, v) { return { kind: 'surface', id, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[origin, plus(origin, v)], [plus(origin, u), plus(plus(origin, u), v)]], weights: [[1, 1], [1, 1]] }; }
function authorBlock(recipe) {
  const { width: w, height: h, depth: d, chartX, chartY, chartZ } = recipe;
  const points = { A: [0, 0, 0], B: [w, 0, 0], C: [w, h, 0], D: [0, h, 0], E: [0, 0, d], F: [w, 0, d], G: [w, h, d], H: [0, h, d] };
  const rows = [
    ['bottom', [0, 0, 0], [chartX, 0, 0], [0, chartY, 0], ['A', 'D', 'C', 'B'], 'reverse'],
    ['front', [0, 0, 0], [chartX, 0, 0], [0, 0, chartZ], ['A', 'B', 'F', 'E'], 'forward'],
    ['back', [0, h, 0], [chartX, 0, 0], [0, 0, chartZ], ['D', 'H', 'G', 'C'], 'reverse'],
    ['top', [0, 0, d], [chartX, 0, 0], [0, chartY, 0], ['E', 'F', 'G', 'H'], 'forward'],
    ['left', [0, 0, 0], [0, chartY, 0], [0, 0, chartZ], ['A', 'E', 'H', 'D'], 'reverse'],
    ['right', [w, 0, 0], [0, chartY, 0], [0, 0, chartZ], ['B', 'C', 'G', 'F'], 'forward'],
  ];
  const assets = rows.map(([id, origin, u, v, names, orientation], i) => {
    const domain = i % 2 ? [-4, 8] : [2, 6], edges = names.map((n, j) => ({ kind: 'curve', id: id + '_c' + j, degree: 1, knots: [domain[0], domain[0], domain[1], domain[1]], controlPoints: [points[n], points[names[(j + 1) % names.length]]], weights: [1, 1] }));
    return { sourceId: id, face: buildConvexPlanarFace(surface(id + '_s', origin, u, v), { id: id + '_loop', edges }, { faceId: id + '_face', evaluationId: id + '_model', resultIdPrefix: id, orientation }) };
  });
  const uses = assets.flatMap((asset, i) => asset.face.topology.loop.uses.map(use => { const j = asset.face.loop.edges.findIndex(e => e.id === use.curveId), names = rows[i][4]; return { names: [names[j], names[(j + 1) % names.length]], ref: { sourceId: asset.sourceId, useId: use.id } }; }));
  const consumed = new Set(), pairs = [];
  for (let i = 0; i < uses.length; i++) if (!consumed.has(i)) { const a = uses[i], j = uses.findIndex((b, j) => j !== i && !consumed.has(j) && b.names.every(n => a.names.includes(n))); assert.ok(j >= 0); consumed.add(i); consumed.add(j); pairs.push({ a: a.ref, b: uses[j].ref }); }
  return qualifyConvexPlanarSolid(assets, pairs, { solidId: 'original_block', resultIdPrefix: 'block' });
}
function authorCutter(recipe) {
  const p = surface('cut_surface', recipe.origin, recipe.u, recipe.v), list = a => '[' + a.join(',') + ']';
  const source = '@model cutter_model { version:0; length-unit:mm; @surface #cut_surface { type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[0,0,1,1]; control-points:[' + p.controlPoints.map(row => '[' + row.map(list).join(',') + ']').join(',') + ']; weights:[[1,1],[1,1]]; } }\n';
  const compiled = compileCadModel(source, { sourceVersion: 0 }); assert.equal(compiled.ok, true); assert.deepEqual(compiled.model.objects, [p]);
  return { sourceId: 'authored_cutter', source, sourceVersion: 0, model: compiled.model, surfaceId: p.id };
}
const yz = sum => ({ origin: [0, sum - 10, 10], u: [64, 0, 0], v: [0, 8, -8] });
const x = value => ({ origin: [value, 0, 0], u: [0, 32, 0], v: [0, 0, 16] });
const options = { operationId: 'bevel_operation', resultIdPrefix: 'split', negativeSolidId: 'retained_part', positiveSolidId: 'removed_part' };
const recipes = mode === '--cold' ? JSON.parse(readFileSync(resolve(output, 'authoring.json'), 'utf8')) : { block: { width: 40, height: 20, depth: 10, chartX: 64, chartY: 32, chartZ: 16 }, cutter: yz(26), editedCutter: yz(28), secondCutter: x(16), options };
const parent = authorBlock(recipes.block), before = structuredClone(parent), cutter = authorCutter(recipes.cutter), cutterBefore = structuredClone(cutter);
const main = split(parent, cutter, recipes.options), accepted = structuredClone(main);
const volumes = result => [result.negative, result.positive].map(outcome => outcome.kind === 'empty' ? '0/1' : outcome.solid.certificate.volumeMM3.numerator + '/' + outcome.solid.certificate.volumeMM3.denominator);
assert.deepEqual(volumes(main), ['7680/1', '320/1']); assert.deepEqual(parent, before); assert.deepEqual(cutter, cutterBefore);
assert.equal(main.negative.solid.graph.faces.length, 7); assert.equal(main.negative.solid.graph.faces.filter(f => f.vertexIds.length === 5).length, 2);
assert.equal(main.section.cycleNodeKeys.length, 4); assert.equal(main.lineage.capUses.length, 4);
for (const child of [main.negative.solid, main.positive.solid]) for (const asset of child.request.assets.filter(a => before.request.assets.some(b => b.sourceId === a.sourceId))) assert.deepEqual(asset.face.plane, before.request.assets.find(b => b.sourceId === asset.sourceId).face.plane);
assert.deepEqual(validate(main), main.report);
const edited = split(parent, authorCutter(recipes.editedCutter), recipes.options); assert.deepEqual(volumes(edited), ['7920/1', '80/1']);
assert.deepEqual(main.lineage.nodes.filter(n => n.origin.kind === 'crossing').map(n => n.key), edited.lineage.nodes.filter(n => n.origin.kind === 'crossing').map(n => n.key));
const second = split(main.negative.solid, authorCutter(recipes.secondCutter), { ...recipes.options, operationId: 'second_operation', resultIdPrefix: 'second', negativeSolidId: 'left_part', positiveSolidId: 'right_part' });
assert.deepEqual(volumes(second), ['3072/1', '4608/1']);
const failures = [], controls = {};
function reject(name, action, code) {
  assert.throws(action, error => { assert.ok(error instanceof ConvexPlanarSolidSplitError, String(error)); assert.equal(error.code, code); failures.push({ name, code: error.code, stage: error.stage, entity: error.entity, message: error.message }); return true; });
  assert.deepEqual(main, accepted); assert.deepEqual(parent, before); assert.deepEqual(cutter, cutterBefore);
}
if (mode !== '--cold') {
  // This genuine geometric cut meets the original X edges at x=1/3, before native materialization.
  const third = authorCutter({ origin: [0, 1, 16], u: [1, -3, 0], v: [0, 0, -16] });
  reject('non-dyadic-crossing', () => split(parent, third, options), 'REPRESENTABILITY');
  // Source/model agree and native float admission passes, but exact binary64 affine coefficients do not:
  // 2.2 + 1.2 - 0.2 - 3.2 is exactly -1/2^54. Keep a genuine BINDING refusal in the original measured range.
  const nonexactCutter = authorCutter({ origin: [0.1, 0.2, 0.3], u: [1, 2, 0], v: [0, 1, 1] }), nonexactCutterBefore = structuredClone(nonexactCutter);
  const y = nonexactCutter.model.objects[0].controlPoints, coefficients = [y[0][0][1], y[1][0][1], y[0][1][1], y[1][1][1]];
  assert.deepEqual(coefficients, [0.2, 2.2, 1.2, 3.2]);
  // Scaling these four dyadic values by 2^54 is exact and integral; BigInt keeps their exact affine residual.
  assert.ok(coefficients.every(value => Number.isInteger(value * 2 ** 54)));
  const exactY = coefficients.map(value => BigInt(value * 2 ** 54));
  assert.equal(exactY[1] + exactY[2] - exactY[0] - exactY[3], -1n);
  reject('nonexact-cutter-coefficients', () => split(parent, nonexactCutter, options), 'BINDING');
  assert.equal(failures.at(-1).stage, 'split'); assert.equal(failures.at(-1).entity, 'request');
  assert.match(failures.at(-1).message, /Cutter coefficients are not exactly affine/); assert.deepEqual(nonexactCutter, nonexactCutterBefore);

  const contacts = [
    ['outside', x(-1), 'outside', -1], ['facet', x(0), 'tangent', 2],
    ['edge', { origin: [0, 0, 0], u: [32, -32, 0], v: [0, 0, 16] }, 'tangent', 1],
    ['vertex', { origin: [0, 0, 0], u: [32, -32, 0], v: [16, 0, -16] }, 'tangent', 0],
  ];
  for (const [name, recipe, status, dimension] of contacts) { const result = split(parent, authorCutter(recipe), options); controls[name] = result; assert.equal(result.report.status, status, name); assert.equal(result.section.dimension, dimension, name); assert.equal([result.negative, result.positive].filter(o => o.kind === 'empty').length, 1); assert.deepEqual([result.negative, result.positive].find(o => o.kind === 'solid').solid, parent); }
  const throughEdge = split(parent, authorCutter({ origin: [0, 10, 10], u: [64, 0, 0], v: [0, 16, -16] }), options);
  controls.throughEdge = throughEdge;
  assert.equal(throughEdge.report.status, 'split'); assert.ok(throughEdge.section.segments.some(s => s.parentEdgeId !== null)); assert.deepEqual(volumes(throughEdge), ['6000/1', '2000/1']);
  let getterCalls = 0; const getter = {}; Object.defineProperty(getter, 'operationId', { enumerable: true, get() { getterCalls++; return 'bad'; } });
  reject('descriptor-getter', () => split(parent, cutter, getter), 'INPUT'); assert.equal(getterCalls, 0);
  reject('oversized-inventory', () => split({ ...parent, graph: { ...parent.graph, vertices: Array(33).fill(parent.graph.vertices[0]) } }, cutter, options), 'BUDGET');
  const forged = structuredClone(main); forged.lineage.nodes[0].key += '_forged'; reject('forged-lineage', () => validate(forged), 'OWNED');
  const badSource = structuredClone(cutter); badSource.source = badSource.source.replace('cutter_model', 'different_model'); reject('source-mismatch', () => split(parent, badSource, options), 'OWNED');
  write('authoring.json', recipes);
}
assert.deepEqual(main, accepted); assert.deepEqual(parent, before);
const coverage = await post('Profiler.takePreciseCoverage'); await post('Profiler.stopPreciseCoverage');
const functions = ['compileCadModel', 'buildConvexPlanarFace', 'evaluateCurveD1', 'evaluateSurfaceD1', 'qualifyConvexPlanarSolid', 'validateConvexPlanarSolid', 'splitConvexPlanarSolid', 'validateConvexPlanarSolidSplit'];
const actual = Object.fromEntries(functions.map(name => [name, coverage.result.flatMap(script => script.functions.filter(f => f.functionName === name)).reduce((sum, f) => sum + f.ranges[0].count, 0)]));
assert.ok(actual.compileCadModel > 0 && actual.buildConvexPlanarFace > 0 && actual.evaluateCurveD1 > 0 && actual.evaluateSurfaceD1 > 0, 'Precise native entry coverage must be present');
assert.ok(actual.splitConvexPlanarSolid + actual.validateConvexPlanarSolidSplit <= (mode === '--cold' ? 5 : 15));
assert.ok(actual.compileCadModel <= (mode === '--cold' ? 5 : 15) * 61 + 56);
assert.ok(actual.evaluateCurveD1 + actual.evaluateSurfaceD1 <= (mode === '--cold' ? 5 : 15) * 2880 + 864);
// The original 3 mm chart is accepted by the existing one-rounding policy. Measure its additional work
// separately: the original main range and its unchanged 15/5-call ceilings above do not include these two calls.
if (mode !== '--cold') {
  await post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
  const thirdChartRecipe = { width: 3, height: 2, depth: 2, chartX: 3, chartY: 2, chartZ: 2 };
  const thirdChart = authorBlock(thirdChartRecipe), thirdChartBefore = structuredClone(thirdChart);
  const thirdCutter = authorCutter(x(1)), thirdCutterBefore = structuredClone(thirdCutter);
  const roundedChart = split(thirdChart, thirdCutter, options);
  assert.deepEqual(volumes(roundedChart), ['4/1', '8/1']);
  assert.deepEqual(validate(roundedChart), roundedChart.report);
  assert.equal(api.CadNumericPolicy.chartParameters, 'exact-or-one-rounding-certified-v1');
  // Orthogonal chart axes span at most 3 mm over [0,1]. This is the unchanged chart policy's bound,
  // with its existing margin, not a modeling tolerance. The actual deviation is independently 2^-54 mm.
  const chartBound = 3 * 2 ** -52 * (1 + 2 ** -40);
  for (const child of [roundedChart.negative.solid, roundedChart.positive.solid]) {
    assert.equal(child.report.pcurveLift.policy, 'exact-or-one-rounding-certified-v1');
    assert.equal(child.report.pcurveLift.certifiedPoles, 16);
    assert.equal(child.report.pcurveLift.maximumDeviationMM, 2 ** -54);
    assert.ok(child.report.pcurveLift.maximumDeviationMM <= chartBound);
    for (const asset of child.request.assets.filter(a => thirdChartBefore.request.assets.some(b => b.sourceId === a.sourceId))) assert.deepEqual(asset.face.plane, thirdChartBefore.request.assets.find(b => b.sourceId === asset.sourceId).face.plane);
  }
  assert.deepEqual(thirdChart, thirdChartBefore); assert.deepEqual(thirdCutter, thirdCutterBefore);
  assert.deepEqual(main, accepted); assert.deepEqual(parent, before); assert.deepEqual(cutter, cutterBefore);
  const chartCoverage = await post('Profiler.takePreciseCoverage'); await post('Profiler.stopPreciseCoverage');
  const chartActual = Object.fromEntries(functions.map(name => [name, chartCoverage.result.flatMap(script => script.functions.filter(f => f.functionName === name)).reduce((sum, f) => sum + f.ranges[0].count, 0)]));
  assert.equal(chartActual.splitConvexPlanarSolid, 1); assert.equal(chartActual.validateConvexPlanarSolidSplit, 1);
  assert.ok(chartActual.compileCadModel > 0 && chartActual.buildConvexPlanarFace > 0 && chartActual.evaluateCurveD1 > 0 && chartActual.evaluateSurfaceD1 > 0);
  assert.ok(chartActual.compileCadModel <= 2 * 61 + 56);
  assert.ok(chartActual.evaluateCurveD1 + chartActual.evaluateSurfaceD1 <= 2 * 2880 + 864);
  write(mode.slice(2) + '-rounded-chart.json', roundedChart);
  write(mode.slice(2) + '-rounded-chart-summary.json', { mode, scope: 'additional-one-rounding-positive-only', recipe: thirdChartRecipe, volumes: volumes(roundedChart), childLifts: [roundedChart.negative.solid.report.pcurveLift, roundedChart.positive.solid.report.pcurveLift], chartBoundMM: chartBound, parentUnchanged: true, cutterUnchanged: true, nativeEntryCounts: chartActual });
  if (mode === '--emitted') assert.deepEqual(JSON.parse(readFileSync(resolve(output, 'emitted-rounded-chart.json'), 'utf8')), JSON.parse(readFileSync(resolve(output, 'source-rounded-chart.json'), 'utf8')));
}
inspector.disconnect();
const stem = mode.slice(2); write(stem + '-controls.json', controls); write(stem + '-result.json', main); write(stem + '-edited.json', edited); write(stem + '-second.json', second);
write(stem + '-summary.json', { mode, pid: process.pid, versions: process.versions, volumes: volumes(main), edited: volumes(edited), second: volumes(second), failures, nativeEntryCounts: actual, work: main.report, sourceModelBitsPreserved: true, previousAcceptedResultPreserved: true });
if (mode !== '--source') for (const suffix of ['result', 'edited', 'second']) assert.deepEqual(JSON.parse(readFileSync(resolve(output, stem + '-' + suffix + '.json'), 'utf8')), JSON.parse(readFileSync(resolve(output, 'source-' + suffix + '.json'), 'utf8')));
process.stdout.write(JSON.stringify({ mode, status: 'passed', pid: process.pid, nativeEntryCounts: actual }) + '\n');
