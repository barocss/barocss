import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, statfsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Session } from 'node:inspector';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const [mode, directory] = process.argv.slice(2);
assert.ok(['--source', '--emitted', '--cold'].includes(mode) && directory);
assert.equal(process.versions.node, '22.23.3'); assert.ok((process.env.NODE_OPTIONS ?? '').includes('--max-old-space-size=2048'));
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(directory); mkdirSync(output, { recursive: true });
const disk = statfsSync(output); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
const json = v => typeof v === 'number' && Object.is(v, -0) ? '-0' : Array.isArray(v) ? '[' + v.map(json).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ':' + json(x)).join(',') + '}' : JSON.stringify(v);
const write = (name, value) => writeFileSync(resolve(output, name), json(value) + '\n');
let failureCoverage;
process.on('uncaughtException', async error => { write(mode.slice(2) + '-first-failure-' + process.pid + '.json', { message: error.message, stack: error.stack, stage: error.stage ?? null, code: error.code ?? null, cause: error.cause?.message ?? null }); if (failureCoverage) write(mode.slice(2) + '-failed-coverage-' + process.pid + '.json', await failureCoverage()); process.exitCode = 1; });
let api;
if (mode === '--source') {
  const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
  const bundle = await require('esbuild').build({ entryPoints: [resolve(repo, 'packages/barocss-cad/src/index.ts')], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
  assert.ok(Object.keys(bundle.metafile.inputs).every(p => !p.includes('/dist/'))); write('source-inputs.json', Object.keys(bundle.metafile.inputs));
  const file = resolve(output, 'slab-source.mjs'); writeFileSync(file, bundle.outputFiles[0].text); api = await import(pathToFileURL(file));
} else api = await import(pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')));
const inspector = new Session(); inspector.connect();
const post = (method, params = {}) => new Promise((ok, no) => inspector.post(method, params, (error, value) => error ? no(error) : ok(value)));
await post('Profiler.enable'); await post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
failureCoverage = async () => { const value = await post('Profiler.takePreciseCoverage'); await post('Profiler.stopPreciseCoverage'); inspector.disconnect(); return value; };
function recipe(id, coordinates, height, origin, span) {
  const points = coordinates.map((position, i) => ({ id: 'p' + i, position })), segments = points.map((p, i) => ({ id: 's' + i, startPointId: p.id, endPointId: points[(i + 1) % points.length].id }));
  return { document: { format: 'barocss-xy-affine-sketch', version: 0, profile: 'exact-affine-binary64', id: id + '_sketch', lengthUnit: 'mm', points, segments, referenceLines: [], constraints: points.map(p => ({ id: 'fix_' + p.id, kind: 'fixed', pointId: p.id, target: [...p.position] })) }, options: { sourceId: id + '_profile', sourceRevision: 0, orderedSegmentIds: segments.map(s => s.id), heightMM: height, capChart: { originXY: origin, spanXY: span }, solidId: id + '_solid', resultIdPrefix: id } };
}
const make = r => api.buildXYAffineSketchPrism(api.buildXYAffineSketch(r.document), r.options).solid;
const aRecipe = recipe('aa', [[0, 0], [32, 0], [32, 16], [16, 32], [0, 32]], 8, [0, 0], [32, 32]);
const bRecipe = recipe('bb', [[8, -16], [16, -16], [16, 48], [8, 48]], 8, [0, -16], [32, 64]);
const editedRecipe = structuredClone(bRecipe); editedRecipe.document.constraints.filter(c => c.target[0] === 16).forEach(c => { c.target[0] = 24; }); editedRecipe.options.sourceRevision++;
const ref = (solid, predicate) => { const faces = solid.graph.faces.filter(f => f.vertexIds.every(id => predicate(solid.graph.vertices.find(v => v.id === id).pointMM))); assert.equal(faces.length, 1); return { sourceId: faces[0].sourceId, faceId: faces[0].faceId }; };
const settings = (solid, x0, x1) => ({ operationId: 'remove_slab', first: { toolFace: ref(solid, p => p[0] === x0), solidId: 'left_part', resultIdPrefix: 'left' }, second: { toolFace: ref(solid, p => p[0] === x1), solidId: 'right_part', resultIdPrefix: 'right' } });
const fraction = n => ({ numerator: String(n), denominator: '1' });
const volume = (result, first, second) => { assert.deepEqual(result.report.volumeMM3.first, fraction(first)); assert.deepEqual(result.report.volumeMM3.second, fraction(second)); assert.equal(result.report.componentCount, Number(first > 0) + Number(second > 0)); for (const [role, n] of [['first', first], ['second', second]]) { assert.equal(result[role].outcome.kind, n > 0 ? 'solid' : 'empty'); if (n > 0) assert.deepEqual(result[role].outcome.solid.certificate.volumeMM3, fraction(n)); } };
let attempts = 0, validations = 0;
const subtract = (a, b, options) => { attempts++; return api.subtractConvexPlanarSlab(a, b, options); };
const validate = result => { validations++; return api.validateConvexPlanarSlabSubtraction(result); };
const controls = [], failures = [], coverageParts = [];
const names = ['buildXYAffineSketch', 'validateXYAffineSketch', 'buildXYAffineSketchPrism', 'compileCadModel', 'buildConvexPlanarFace', 'evaluateCurveD1', 'evaluateSurfaceD1', 'qualifyConvexPlanarSolid', 'validateConvexPlanarSolid', 'subtractConvexPlanarSlab', 'validateConvexPlanarSlabSubtraction'];
const count = coverage => Object.fromEntries(names.map(name => [name, coverage.result.flatMap(s => s.functions.filter(f => f.functionName === name)).reduce((n, f) => n + f.ranges[0].count, 0)]));
let result, edited, mainCounts;
if (mode === '--cold') {
  const saved = JSON.parse(readFileSync(resolve(output, 'recipes.json'), 'utf8'));
  const a = make(saved.parent), b = make(saved.tool); result = subtract(a, b, saved.operation); volume(result, 2048, 3072);
  edited = subtract(a, make(saved.editedTool), saved.operation); volume(edited, 2048, 1280);
  assert.deepEqual(result, JSON.parse(readFileSync(resolve(output, 'source-result.json'), 'utf8')));
  assert.deepEqual(edited, JSON.parse(readFileSync(resolve(output, 'source-edited.json'), 'utf8')));
} else {
  const a = make(aRecipe), b = make(bRecipe), options = settings(b, 8, 16), beforeA = structuredClone(a), beforeB = structuredClone(b);
  assert.deepEqual(a.certificate.volumeMM3, fraction(7168));
  coverageParts.push(await post('Profiler.takePreciseCoverage'));
  result = subtract(a, b, options); volume(result, 2048, 3072); const saved = structuredClone(result);
  const mainCoverage = await post('Profiler.takePreciseCoverage'); coverageParts.push(mainCoverage); mainCounts = count(mainCoverage);
  assert.equal(mainCounts.buildConvexPlanarFace, 37); assert.equal(mainCounts.compileCadModel, 37); assert.equal(mainCounts.evaluateCurveD1 + mainCounts.evaluateSurfaceD1, 1350);
  assert.equal(result.report.nativeWork.faceCompilations, 37); assert.equal(result.report.nativeWork.totalD1, 1350);
  assert.deepEqual(result.report.volumeMM3.remaining, fraction(5120)); assert.deepEqual(result.report.volumeMM3.removed, fraction(2048));
  assert.deepEqual(validate(result), result.report);
  for (const component of [result.first, result.second]) {
    assert.deepEqual([component.outcome.solid.graph.faces.length, component.outcome.solid.graph.edges.length, component.outcome.solid.graph.vertices.length], [6, 12, 8]);
    for (const face of component.lineage.faces) {
      const source = face.sources[0], input = source.operand === 'parent' ? a : b, original = input.request.assets.find(x => x.sourceId === source.sourceId).face, output = component.outcome.solid.request.assets.find(x => x.sourceId === face.output.sourceId).face;
      assert.deepEqual(output.plane, original.plane);
      assert.equal(output.options.orientation, source.operand === 'parent' ? original.options.orientation : original.options.orientation === 'forward' ? 'reverse' : 'forward');
    }
  }
  assert.ok(result.second.outcome.solid.graph.faces.some(f => f.vertexIds.every(id => { const p = result.second.outcome.solid.graph.vertices.find(v => v.id === id).pointMM; return p[0] + p[1] === 48; })));
  const editTool = make(editedRecipe); edited = subtract(a, editTool, options); volume(edited, 2048, 1280); assert.deepEqual(edited.report.volumeMM3.removed, fraction(3840));
  assert.deepEqual(edited.materialProof.selected, result.materialProof.selected);
  volume(subtract(a, b, { ...options, first: options.second, second: options.first }), 3072, 2048);
  const box = (id, x0, x1, y0 = -16, y1 = 48, origin = [x0, y0], span = [64, 64]) => make(recipe(id, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], 8, origin, span));
  for (const [name, tool, x0, x1, left, right] of [
    ['disjoint', box('apart', 40, 48), 40, 48, 7168, 0],
    ['tangent', box('tangent', 32, 40), 32, 40, 7168, 0],
    ['full_removal', box('cover', -8, 40), -8, 40, 0, 0],
    ['one_component', box('one', -8, 16), -8, 16, 0, 3072],
  ]) { const value = subtract(a, tool, settings(tool, x0, x1)); volume(value, left, right); controls.push({ name, result: value }); }
  function reject(name, action, code, stage) {
    assert.throws(action, error => { assert.ok(error instanceof api.ConvexPlanarSlabSubtractionError, String(error)); if (code) assert.equal(error.code, code); if (stage) assert.equal(error.stage, stage); failures.push({ name, code: error.code, stage: error.stage, entity: error.entity, cause: error.cause?.message ?? null }); return true; });
    assert.deepEqual(result, saved); assert.deepEqual(a, beforeA); assert.deepEqual(b, beforeB);
  }
  const incomplete = box('short', 8, 16, 0, 16); reject('incomplete_tool_coverage', () => subtract(a, incomplete, settings(incomplete, 8, 16)), 'SLAB');
  reject('nonparallel_selection', () => subtract(a, b, { ...options, second: { ...options.second, toolFace: ref(b, p => p[2] === 0) } }), 'SLAB');
  const skew = make(recipe('skew', [[8, -16], [16, -16], [48, 48], [40, 48]], 8, [0, -16], [64, 64]));
  const skewOptions = { ...options, first: { ...options.first, toolFace: ref(skew, p => 2 * p[0] - p[1] === 32) }, second: { ...options.second, toolFace: ref(skew, p => 2 * p[0] - p[1] === 48) } };
  reject('final_non_dyadic_xyz', () => subtract(a, skew, skewOptions), 'REPRESENTABILITY', 'final-representability');
  const uv = box('uv', 0, 60, 0, 32, [0, 0], [60, 32]); reject('final_nonexact_uv_lift', () => subtract(uv, b, options), 'BINDING', 'output-qualification');
  const stale = structuredClone(a); stale.request.assets[0].face.source += ' '; reject('stale_source', () => subtract(stale, b, options), 'OWNED', 'parent-reconstruction');
  const forged = structuredClone(a); forged.certificate.volumeMM3.numerator = '1'; reject('forged_certificate', () => subtract(forged, b, options), 'OWNED', 'parent-reconstruction');
  reject('identity_collision', () => subtract(a, b, { ...options, second: { ...options.second, solidId: options.first.solidId } }), 'IDENTITY');
  let getters = 0; const hostile = { ...options }; Object.defineProperty(hostile, 'operationId', { enumerable: true, get() { getters++; return 'bad'; } }); reject('hostile_descriptor', () => subtract(a, b, hostile), 'INPUT'); assert.equal(getters, 0);
  reject('snapshot_budget', () => subtract(a, b, { ...options, extra: Array(4097).fill(0) }), 'BUDGET');
  const forgedResult = structuredClone(result); forgedResult.first.lineage.faces[0].sources[0].sourceId = 'forged'; reject('forged_result_lineage', () => validate(forgedResult), 'OWNED');
  assert.equal(attempts, 16); assert.equal(validations, 2);
  write(mode.slice(2) + '-result.json', result); write(mode.slice(2) + '-edited.json', edited); write(mode.slice(2) + '-controls.json', { controls, failures });
  if (mode === '--source') write('recipes.json', { parent: aRecipe, tool: bRecipe, editedTool: editedRecipe, operation: options });
  else { assert.deepEqual(result, JSON.parse(readFileSync(resolve(output, 'source-result.json'), 'utf8'))); assert.deepEqual(edited, JSON.parse(readFileSync(resolve(output, 'source-edited.json'), 'utf8'))); }
}
coverageParts.push(await post('Profiler.takePreciseCoverage')); await post('Profiler.stopPreciseCoverage'); inspector.disconnect(); failureCoverage = null;
write(mode.slice(2) + '-coverage.json', coverageParts);
const counts = Object.fromEntries(names.map(name => [name, coverageParts.reduce((n, part) => n + count(part)[name], 0)]));
assert.equal(counts.subtractConvexPlanarSlab, mode === '--cold' ? 2 : 16); assert.equal(counts.validateConvexPlanarSlabSubtraction, mode === '--cold' ? 0 : 2);
assert.equal(counts.buildXYAffineSketchPrism, mode === '--cold' ? 3 : 10); assert.equal(counts.buildXYAffineSketch, mode === '--cold' ? 6 : 20); assert.equal(counts.validateXYAffineSketch, mode === '--cold' ? 3 : 10);
// Fixture producer work includes initial sketch compilation AND prism's complete sketch validation.
assert.ok(counts.buildConvexPlanarFace <= (mode === '--cold' ? 182 : 1418)); assert.ok(counts.compileCadModel <= (mode === '--cold' ? 188 : 1438)); assert.ok(counts.evaluateCurveD1 + counts.evaluateSurfaceD1 <= (mode === '--cold' ? 8316 : 66636));
const summary = { status: 'passed', mode, pid: process.pid, counts, attempts, validations, mainCounts: mainCounts ?? null, volume: result.report.volumeMM3, editedVolume: edited.report.volumeMM3, native: result.report.nativeWork, exact: result.report.exactWork, clip: result.report.clipWork, controls: controls.map(c => c.name), refusals: failures.map(f => f.name) };
write(mode.slice(2) + '-summary.json', summary); process.stdout.write(JSON.stringify(summary) + '\n');
