import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, statSync, statfsSync, writeFileSync } from 'node:fs';
import { Session } from 'node:inspector';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const [mode, directory] = process.argv.slice(2);
assert.ok(['--source', '--emitted', '--cold'].includes(mode) && directory);
assert.equal(process.versions.node, '22.23.3'); assert.ok((process.env.NODE_OPTIONS ?? '').includes('--max-old-space-size=2048'));
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(directory);
mkdirSync(output, { recursive: true });
const disk = statfsSync(output); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
let writtenBytes = 0;
const nativeJSON = value => typeof value === 'number' && Object.is(value, -0) ? '-0' : Array.isArray(value) ? '[' + value.map(nativeJSON).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.entries(value).map(([key, item]) => JSON.stringify(key) + ':' + nativeJSON(item)).join(',') + '}' : JSON.stringify(value);
const directoryBytes = () => readdirSync(output).reduce((sum, name) => sum + statSync(resolve(output, name)).size, 0);
const write = (name, value) => { const text = nativeJSON(value) + '\n', bytes = Buffer.byteLength(text); writtenBytes += bytes; assert.ok(bytes <= 32 * 1024 * 1024 && writtenBytes <= 128 * 1024 * 1024 && directoryBytes() + bytes <= 128 * 1024 * 1024, 'Whole-campaign evidence file budget'); writeFileSync(resolve(output, name), text); };
let failureCoverage;
process.on('uncaughtException', async error => { if (failureCoverage) await failureCoverage(); write('first-failure-' + mode.slice(2) + '-' + process.pid + '.json', { message: error.message, stack: error.stack, cause: error.cause?.message ?? null }); process.exitCode = 1; });
let api;
if (mode === '--source') {
  const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
  const built = await require('esbuild').build({ entryPoints: [resolve(repo, 'packages/barocss-cad/src/index.ts')], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
  assert.ok(Object.keys(built.metafile.inputs).every(p => !p.includes('/dist/'))); write('source-inputs.json', Object.keys(built.metafile.inputs));
  const target = resolve(output, 'chamfer-source.mjs'); assert.ok(built.outputFiles[0].contents.length <= 16 * 1024 * 1024); assert.ok(directoryBytes() + built.outputFiles[0].contents.length <= 128 * 1024 * 1024); writeFileSync(target, built.outputFiles[0].text); api = await import(pathToFileURL(target));
} else api = await import(pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')));
const inspector = new Session(); inspector.connect();
const post = (method, params = {}) => new Promise((ok, no) => inspector.post(method, params, (error, result) => error ? no(error) : ok(result)));
await post('Profiler.enable'); await post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
const names = ['buildXYAffineSketch', 'validateXYAffineSketch', 'buildXYAffineSketchPrism', 'compileCadModel', 'buildConvexPlanarFace', 'evaluateCurveD1', 'evaluateSurfaceD1', 'qualifyConvexPlanarSolid', 'validateConvexPlanarSolid', 'classifyConvexPlanarSolidPoints', 'splitConvexPlanarSolid', 'validateConvexPlanarSolidSplit', 'chamferConvexPlanarSolid', 'validateConvexPlanarSolidChamfer', 'SectionRationalContext', 'ExactAffinePlane', 'admitConvexNativeLineLoop', 'buildConvexPlanarFaceWithHoles', 'booleanCoplanarFaces', 'clipCurveWithConvexLineLoop', 'work'];
const parts = [], steps = [];
const count = coverage => Object.fromEntries(names.map(name => [name, coverage.result.flatMap(s => s.functions.filter(f => f.functionName === name)).reduce((sum, f) => sum + f.ranges[0].count, 0)]));
const checkpoint = async label => { const data = await post('Profiler.takePreciseCoverage'); parts.push(data); const counts = count(data); steps.push({ label, counts }); return counts; };
failureCoverage = async () => { await checkpoint('first-failure'); write(mode.slice(2) + '-failed-coverage-' + process.pid + '.json', parts); };
const frac = n => ({ numerator: String(n), denominator: '1' });
function recipe(id, coordinates, chart, segmentIds) {
  const points = coordinates.map((position, i) => ({ id: 'p' + i, position }));
  return { document: { format: 'barocss-xy-affine-sketch', version: 0, profile: 'exact-affine-binary64', id: id + '_sketch', lengthUnit: 'mm', points,
    segments: points.map((p, i) => ({ id: segmentIds[i], startPointId: p.id, endPointId: points[(i + 1) % points.length].id })), referenceLines: [], constraints: points.map(p => ({ id: 'fix_' + p.id, kind: 'fixed', pointId: p.id, target: [...p.position] })) },
    prismOptions: { sourceId: id + '_source', sourceRevision: 0, orderedSegmentIds: segmentIds, heightMM: 8, capChart: { originXY: [-0, 0], spanXY: chart }, solidId: id + '_solid', resultIdPrefix: id } };
}
const authored = mode === '--cold' ? JSON.parse(readFileSync(resolve(output, 'recipe.json'), 'utf8')) : { ...recipe('part', [[-0, 0], [32, 0], [32, 16], [16, 32], [0, 32]], [32, 32], ['front', 'right', 'slope', 'back', 'left']), options: { operationId: 'front_chamfer', resultIdPrefix: 'cham', retainedSolidId: 'finished_part', removedSolidId: 'removed_wedge' }, distanceMM: 2 };
const make = recipe => api.buildXYAffineSketchPrism(api.buildXYAffineSketch(recipe.document), recipe.prismOptions);
const prism = make(authored), parent = prism.solid, before = structuredClone(parent);
assert.deepEqual(parent.certificate.volumeMM3, frac(7168)); assert.deepEqual([parent.graph.vertices.length, parent.graph.edges.length, parent.graph.faces.length], [10, 15, 7]);
const reference = u => ({ sourceId: u.sourceId, faceId: u.faceId, surfaceId: u.surfaceId, loopId: u.loopId, useId: u.use.id, curveId: u.use.curveId, pcurveId: u.use.pcurveId });
const select = segmentId => { const lineage = prism.lineage.segments.find(s => s.segmentId === segmentId); assert.ok(lineage); const edge = parent.graph.edges.find(e => e.id === lineage.topEdgeId); assert.ok(edge); return { parentSolidId: parent.request.options.solidId, a: reference(edge.uses[0]), b: reference(edge.uses[1]) }; };
const selection = mode === '--cold' ? authored.selection : select('front'), beforeSelection = structuredClone(selection), options = authored.options;
assert.deepEqual(selection, select('front'));
await checkpoint('authored-pentagon-producer');
let attempts = 0, validations = 0;
const build = (p = parent, s = selection, d = 2, o = options) => { attempts++; return api.chamferConvexPlanarSolid(p, s, d, o); };
const validate = value => { validations++; return api.validateConvexPlanarSolidChamfer(value); };
const result = build(), mainCounts = await checkpoint('main-d2');
assert.equal(mainCounts.splitConvexPlanarSolid, 1); assert.equal(mainCounts.validateConvexPlanarSolid, 1); assert.equal(mainCounts.qualifyConvexPlanarSolid, 2);
assert.equal(mainCounts.buildConvexPlanarFace, 33); assert.equal(mainCounts.compileCadModel, 34); assert.equal(mainCounts.evaluateCurveD1 + mainCounts.evaluateSurfaceD1, 1242);
assert.equal(mainCounts.validateConvexPlanarSolidSplit, 0);
const edited = build(parent, selection, 1); await checkpoint('edit-d1');
function prove(value, d) {
  const split = value.split; assert.equal(split.negative.kind, 'solid'); assert.equal(split.positive.kind, 'solid');
  assert.deepEqual(split.negative.solid.certificate.volumeMM3, frac(7168 - 16 * d * d)); assert.deepEqual(split.positive.solid.certificate.volumeMM3, frac(16 * d * d));
  assert.deepEqual([split.negative.solid.graph.vertices.length, split.negative.solid.graph.edges.length, split.negative.solid.graph.faces.length], [12, 18, 8]);
  assert.deepEqual([split.positive.solid.graph.vertices.length, split.positive.solid.graph.edges.length, split.positive.solid.graph.faces.length], [6, 9, 5]);
  assert.deepEqual(split.section.nodes.map(n => n.pointMM).sort(), [[0, 0, 8 - d], [32, 0, 8 - d], [32, d, 8], [0, d, 8]].sort());
  assert.deepEqual(value.metric.removedVolumeMM3, frac(16 * d * d)); assert.deepEqual(value.metric.distanceMM, frac(d));
  const slope = prism.lineage.segments.find(s => s.segmentId === 'slope').wall;
  const slopeLineage = split.lineage.faces.find(f => f.side === 'negative' && f.parent?.sourceId === slope.sourceId && f.parent.faceId === slope.faceId);
  assert.equal(slopeLineage.role, 'retained');
  const slopeBefore = parent.request.assets.find(a => a.sourceId === slope.sourceId).face;
  const slopeAfter = split.negative.solid.request.assets.find(a => a.sourceId === slopeLineage.output.sourceId).face;
  assert.deepEqual(slopeAfter.plane, slopeBefore.plane); assert.deepEqual(slopeAfter.topology.vertices.map(v => v.point).sort(), slopeBefore.topology.vertices.map(v => v.point).sort());
  const negative = split.lineage.faces.filter(f => f.side === 'negative');
  assert.equal(negative.filter(f => f.role === 'cap').length, 1); assert.equal(value.lineage.setbackBoundaryKeys.length, 2);
  const cap = negative.find(f => f.key === value.lineage.chamferFaceKey); assert.equal(cap.role, 'cap');
  assert.ok(negative.every(f => f.edges.every(e => e.origin.kind !== 'parent-edge' || e.origin.parentEdgeId !== value.lineage.parentEdgeId)));
  let intervals = 0;
  for (const face of negative) for (const edge of face.edges) if (edge.origin.kind === 'parent-edge') {
    const origin = edge.origin, original = parent.graph.edges.find(e => e.id === origin.parentEdgeId).uses.find(u => u.sourceId === origin.sourceId && u.faceId === origin.faceId && u.use.id === origin.useId);
    assert.equal(original.use.curveId, origin.curveId); assert.equal(original.use.pcurveId, origin.pcurveId);
    assert.ok(origin.sourceInterval.every(f => Number(f.numerator) / Number(f.denominator) >= origin.domain[0] && Number(f.numerator) / Number(f.denominator) <= origin.domain[1])); intervals++;
  }
  assert.ok(intervals > 0); assert.deepEqual(value.split.request.parent, parent); assert.deepEqual(value.request.selection, selection);
}
prove(result, 2); prove(edited, 1);
assert.deepEqual(result.lineage, edited.lineage); assert.deepEqual(parent, before); assert.deepEqual(selection, beforeSelection);
const saved = structuredClone(result), failures = [];
if (mode === '--source') {
  assert.deepEqual(validate(result), result.report); await checkpoint('signed-zero-whole-result-validation');
  assert.ok(Object.is(result.split.request.parent.request.assets[0].face.plane.controlPoints[0][0][0], -0));
  const classification = api.classifyConvexPlanarSolidPoints(result.split.negative.solid, [[16, 8, 4], [16, 1, 7], [16, 0, 8]], { maximumHalfspacePredicates: 24 });
  assert.deepEqual(classification.points.map(p => p.classification), ['inside', 'boundary', 'outside']); await checkpoint('retained-point-classification');
  function reject(name, action, code) {
    assert.throws(action, error => { assert.ok(error instanceof api.ConvexPlanarSolidChamferError, String(error)); if (code) assert.equal(error.code, code); failures.push({ name, code: error.code, stage: error.stage, cause: error.cause?.message ?? null }); return true; });
    assert.deepEqual(result, saved); assert.deepEqual(parent, before); assert.deepEqual(selection, beforeSelection);
  }
  for (const d of [0, -1, 8, 16]) reject('distance-' + d, () => build(parent, selection, d), d <= 0 ? 'METRIC' : 'LOCALITY');
  for (const key of Object.keys(selection.a)) reject('complete-ref-' + key, () => build(parent, { ...selection, a: { ...selection.a, [key]: 'missing' } }), 'SELECTION');
  const other = parent.graph.edges.find(e => e.uses.every(u => u.sourceId !== selection.a.sourceId && u.sourceId !== selection.b.sourceId));
  reject('nonadjacent-pair', () => build(parent, { ...selection, b: reference(other.uses[0]) }), 'SELECTION');
  reject('noncardinal-support', () => build(parent, select('slope')), 'METRIC');
  reject('nonperpendicular-end-support', () => build(parent, select('right')), 'METRIC');
  reject('wrong-parent-identity', () => build(parent, { ...selection, parentSolidId: 'other' }), 'SELECTION');
  const forgedParent = structuredClone(parent); forgedParent.certificate.volumeMM3.numerator = '1'; reject('forged-parent-certificate', () => build(forgedParent), 'OWNED'); await checkpoint('forged-parent-certificate');
  const staleSource = structuredClone(parent); staleSource.request.assets[0].face.source += ' '; reject('forged-parent-source', () => build(staleSource), 'OWNED'); await checkpoint('forged-parent-source');
  const uvRecipe = recipe('uv', [[0, 0], [60, 0], [60, 32], [0, 32]], [60, 32], ['front', 'right', 'back', 'left']), uvPrism = make(uvRecipe);
  await checkpoint('nonexact-UV-rectangle-producer');
  const uvLineage = uvPrism.lineage.segments.find(s => s.segmentId === 'right'), uvEdge = uvPrism.solid.graph.edges.find(e => e.id === uvLineage.topEdgeId), uvSelection = { parentSolidId: uvPrism.solid.request.options.solidId, a: reference(uvEdge.uses[0]), b: reference(uvEdge.uses[1]) };
  reject('unchanged-chart-nonexact-UV-lift', () => build(uvPrism.solid, uvSelection), 'BINDING'); await checkpoint('nonexact-UV-refusal');
  let getters = 0; const hostile = { ...selection }; Object.defineProperty(hostile, 'a', { enumerable: true, get() { getters++; return selection.a; } }); reject('getter-zero', () => build(parent, hostile), 'INPUT'); assert.equal(getters, 0);
  reject('snapshot-array-budget', () => build(parent, { ...selection, extra: Array(4097).fill(0) }), 'BUDGET');
  const cycle = { ...selection }; cycle.a = cycle; reject('cycle', () => build(parent, cycle), 'INPUT');
  reject('sparse', () => build(parent, { ...selection, extra: Array(2) }), 'INPUT');
  reject('symbol', () => build(parent, { ...selection, [Symbol('hidden')]: 0 }), 'INPUT');
  reject('foreign', () => build(parent, Object.assign(Object.create({}), selection)), 'INPUT');
  for (const [name, mutate] of [
    ['metric', v => { v.metric.removedVolumeMM3.numerator = '65'; }],
    ['lineage', v => { v.lineage.parentEdgeId = 'missing'; }],
    ['cutter-source', v => { v.split.request.cutter.source += ' '; }],
    ['signed-zero', v => { const p = v.split.request.cutter.model.objects[0].controlPoints.flat().find(p => p.includes(0)); p[p.indexOf(0)] = -0; }],
  ]) { const value = structuredClone(result); mutate(value); reject('forged-result-' + name, () => validate(value), 'OWNED'); await checkpoint('forged-result-' + name); }
  assert.equal(attempts, 26); assert.equal(validations, 5);
  write('recipe.json', { ...authored, selection }); write('source-controls.json', { classification, failures });
} else {
  assert.deepEqual(result, JSON.parse(readFileSync(resolve(output, 'source-result.json'), 'utf8')));
  assert.deepEqual(edited, JSON.parse(readFileSync(resolve(output, 'source-edited.json'), 'utf8')));
  assert.equal(attempts, 2); assert.equal(validations, 0);
}
write(mode.slice(2) + '-result.json', result); write(mode.slice(2) + '-edited.json', edited);
await checkpoint('complete'); await post('Profiler.stopPreciseCoverage'); inspector.disconnect(); failureCoverage = null;
write(mode.slice(2) + '-coverage.json', parts);
const counts = Object.fromEntries(names.map(name => [name, steps.reduce((sum, s) => sum + s.counts[name], 0)]));
assert.equal(counts.chamferConvexPlanarSolid, attempts); assert.equal(counts.validateConvexPlanarSolidChamfer, validations); assert.equal(counts.validateConvexPlanarSolidSplit, 0);
assert.equal(counts.buildXYAffineSketchPrism, mode === '--source' ? 2 : 1);
assert.ok(counts.buildConvexPlanarFace <= (mode === '--source' ? 303 : 80)); assert.ok(counts.compileCadModel <= (mode === '--source' ? 315 : 84));
assert.ok(counts.evaluateCurveD1 + counts.evaluateSurfaceD1 <= (mode === '--source' ? 11385 : 3024));
assert.ok(counts.work > 0 && counts.work <= (mode === '--source' ? 11000000 : 2600000));
// Normalized-v0 producer requests do not create strict coordinate-span proof contexts.
// These campaigns use convex faces only; prove the helper subset rather than raising legacy caps.
assert.equal(counts.buildConvexPlanarFaceWithHoles + counts.booleanCoplanarFaces + counts.clipCurveWithConvexLineLoop, 0);
assert.equal(counts.ExactAffinePlane, counts.admitConvexNativeLineLoop);
assert.ok(counts.ExactAffinePlane <= counts.buildConvexPlanarFace);
const legacyRationalContexts = counts.SectionRationalContext - counts.ExactAffinePlane;
assert.ok(legacyRationalContexts >= 0);
assert.ok(legacyRationalContexts <= (mode === '--source' ? 55 : 13));
const summary = { status: 'passed', mode, pid: process.pid, counts, mainCounts, steps, attempts, validations, native: result.report.nativeWork, exact: result.report.exactWork, volume: result.split.report.volumeMM3, editedVolume: edited.split.report.volumeMM3, refusals: failures, evidenceWrittenBytes: writtenBytes, signedZeroPreserved: true };
write(mode.slice(2) + '-summary.json', summary); process.stdout.write(JSON.stringify({ status: summary.status, mode, pid: process.pid, counts, attempts, validations }) + '\n');
