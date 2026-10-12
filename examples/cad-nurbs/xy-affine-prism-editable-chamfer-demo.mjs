import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, statfsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { Session } from 'node:inspector';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const [mode, directory] = process.argv.slice(2);
assert.ok(['--source', '--emitted', '--cold'].includes(mode) && directory);
assert.equal(process.versions.node, '22.23.3'); assert.ok((process.env.NODE_OPTIONS ?? '').includes('--max-old-space-size=2048'));
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(directory); mkdirSync(output, { recursive: true });
const disk = statfsSync(output); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
const json = v => typeof v === 'number' && Object.is(v, -0) ? '-0' : Array.isArray(v) ? '[' + v.map(json).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + json(v[k])).join(',') + '}' : JSON.stringify(v);
let outputBytes = 0, outputFiles = 0;
function write(name, v) { const text = typeof v === 'string' ? v : json(v) + '\n', bytes = Buffer.byteLength(text); assert.ok(bytes <= 64 * 1024 * 1024 && (outputBytes += bytes) <= 128 * 1024 * 1024 && ++outputFiles <= 24); writeFileSync(resolve(output, name), text); }
const hash = v => createHash('sha256').update(json(v)).digest('hex');
let failureCoverage;
process.on('uncaughtException', async error => { write(mode.slice(2) + '-first-failure-' + process.pid + '.json', { message: error.message, stack: error.stack, stage: error.stage ?? null, code: error.code ?? null, cause: error.cause?.message ?? null }); if (failureCoverage) write(mode.slice(2) + '-failed-coverage-' + process.pid + '.json', await failureCoverage()); process.exitCode = 1; });
let api;
if (mode === '--source') {
  const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
  const bundle = await require('esbuild').build({ entryPoints: [resolve(repo, 'packages/barocss-cad/src/index.ts')], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
  assert.ok(Object.keys(bundle.metafile.inputs).every(p => !p.includes('/dist/'))); write('source-inputs.json', Object.keys(bundle.metafile.inputs));
  const file = resolve(output, 'editable-chamfer-source.mjs'); write('editable-chamfer-source.mjs', bundle.outputFiles[0].text); api = await import(pathToFileURL(file));
} else api = await import(pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')));
const inspector = new Session(); inspector.connect();
const post = (method, params = {}) => new Promise((ok, no) => inspector.post(method, params, (error, value) => error ? no(error) : ok(value)));
await post('Profiler.enable'); await post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
failureCoverage = async () => { const value = await post('Profiler.takePreciseCoverage'); await post('Profiler.stopPreciseCoverage'); inspector.disconnect(); return { completedIntervals: parts, finalInterval: value, milestones }; };
const names = ['splitConvexPlanarSolid', 'validateConvexPlanarSolid', 'qualifyConvexPlanarSolid', 'validateXYAffineSketchPrism', 'validateConvexPlanarSolidChamfer', 'evaluateXYAffinePrismFeatureDocumentV1', 'updateXYAffinePrismFeatureDocumentV1', 'validateXYAffinePrismFeatureDocumentV1', 'validateXYAffinePrismFeatureDocumentUpdateV1', 'serializeXYAffinePrismFeatureDocumentV1', 'parseXYAffinePrismFeatureDocumentV1', 'chamferConvexPlanarSolid', 'SectionRationalContext', 'ExactAffinePlane', 'admitConvexNativeLineLoop', 'buildConvexPlanarFaceWithHoles', 'booleanCoplanarFaces', 'clipCurveWithConvexLineLoop', 'work', 'evaluateXYAffinePrismFeatureDocument', 'updateXYAffinePrismFeatureDocument', 'validateXYAffinePrismFeatureDocument', 'validateXYAffinePrismFeatureDocumentUpdate', 'serializeXYAffinePrismFeatureDocument', 'parseXYAffinePrismFeatureDocument', 'buildXYAffineSketch', 'buildXYAffineSketchPrism', 'resolveXYAffineSketchPrismWall', 'subtractConvexPlanarSlab', 'compileCadModel', 'buildConvexPlanarFace', 'evaluateCurveD1', 'evaluateSurfaceD1'];
const count = coverage => Object.fromEntries(names.map(name => [name, coverage.result.flatMap(s => s.functions.filter(f => f.functionName === name)).reduce((n, f) => n + f.ranges[0].count, 0)]));
const parts = [], milestones = [], refusals = [];
async function mark(label, expectedWork) {
  const coverage = await post('Profiler.takePreciseCoverage'); parts.push(coverage); const counts = count(coverage); milestones.push({ label, counts, expectedWork: expectedWork ?? null });
  if (expectedWork) { assert.equal(counts.compileCadModel, expectedWork.sourceCompilations); assert.equal(counts.buildConvexPlanarFace, expectedWork.faceCompilations); assert.equal(counts.evaluateCurveD1 + counts.evaluateSurfaceD1, expectedWork.totalD1); }
}
function recipe(id, coordinates, origin, span) {
  const points = coordinates.map((position, i) => ({ id: 'p' + i, position })), segments = points.map((p, i) => ({ id: 's' + i, startPointId: p.id, endPointId: points[(i + 1) % points.length].id }));
  return [{ id: id + '_sketch_node', kind: 'sketch', sourceId: id + '_source', revision: 0, document: { format: 'barocss-xy-affine-sketch', version: 0, profile: 'exact-affine-binary64', id: id + '_sketch', lengthUnit: 'mm', points, segments, referenceLines: [], constraints: points.map(p => ({ id: 'fix_' + p.id, kind: 'fixed', pointId: p.id, target: [...p.position] })) } }, { id: id + '_prism_node', kind: 'prism', sketchNodeId: id + '_sketch_node', options: { orderedSegmentIds: segments.map(s => s.id), heightMM: 8, capChart: { originXY: origin, spanXY: span }, solidId: id + '_solid', resultIdPrefix: id } }];
}
function document() {
  const [a, p] = recipe('aa', [[-0, 0], [32, 0], [32, 16], [16, 32], [0, 32]], [0, 0], [32, 32]);
  const [b, t] = recipe('bb', [[8, -16], [16, -16], [16, 48], [8, 48]], [0, -16], [32, 64]);
  const component = (segmentId, solidId, resultIdPrefix) => ({ reference: { sourceId: b.sourceId, sketchId: b.document.id, sourceRevision: 0, segmentId }, solidId, resultIdPrefix });
  const parameter = (id, valueMM, points, axis) => ({ id, valueMM, unit: 'mm', bindings: points.map(i => ({ sketchNodeId: b.id, constraintId: 'fix_p' + i, axis })) });
  return { format: 'barocss-xy-affine-prism-feature-document', version: 0, id: 'part_document', revision: 0, lengthUnit: 'mm', nodes: [a, b, p, t, { id: 'subtraction_feature', kind: 'subtraction', parentPrismId: p.id, toolPrismId: t.id, operationId: 'remove_slab', first: component('s3', 'left_part', 'left'), second: component('s1', 'right_part', 'right') }], parameters: [parameter('lowerX', 8, [0, 3], 'x'), parameter('upperX', 16, [1, 2], 'x'), parameter('lowerY', -16, [0, 1], 'y'), parameter('upperY', 48, [2, 3], 'y')] };
}
const edits = (result, parameterId, valueMM) => ({ expectedRevision: result.document.revision, revision: result.document.revision + 1, parameterEdits: [{ parameterId, valueMM }] });
const sum = (a, b) => Object.fromEntries(Object.keys(a).map(k => [k, a[k] + b[k]]));
const volume = (result, left, right) => { assert.deepEqual(result.subtraction.report.volumeMM3.first, { numerator: String(left), denominator: '1' }); assert.deepEqual(result.subtraction.report.volumeMM3.second, { numerator: String(right), denominator: '1' }); assert.deepEqual(result.subtraction.report.volumeMM3.remaining, { numerator: String(left + right), denominator: '1' }); };
function reject(name, action, code) {
  assert.throws(action, error => { assert.ok(error instanceof api.XYAffinePrismFeatureError, String(error)); if (code) assert.equal(error.code, code); refusals.push({ name, code: error.code, stage: error.stage, nodeId: error.nodeId, cause: error.cause?.message ?? null, attempted: error.attempted }); return true; });
}

const V = api.evaluateXYAffinePrismFeatureDocumentV1, U = api.updateXYAffinePrismFeatureDocumentV1;
const value = (fraction, expected) => assert.deepEqual(fraction, { numerator: String(expected), denominator: '1' });
const detailVolumes = (r, parent, retained, wedge) => { value(r.prisms[0].solid.certificate.volumeMM3, parent); value(r.chamfer.split.negative.solid.certificate.volumeMM3, retained); value(r.chamfer.split.positive.solid.certificate.volumeMM3, wedge); value(r.chamfer.metric.removedVolumeMM3, wedge); };
function versionOne(seed) {
  const d = structuredClone(seed.document), prism = seed.prisms[0]; d.version = 1;
  for (const p of d.parameters) for (const b of p.bindings) b.kind = 'fixed-sketch-coordinate';
  const segment = prism.lineage.segments.find(s => s.segmentId === 's0'), edge = prism.solid.graph.edges.find(e => e.id === segment.topEdgeId);
  const refs = edge.uses.map(u => ({ sourceId: u.sourceId, faceId: u.faceId, surfaceId: u.surfaceId, loopId: u.loopId, useId: u.use.id, curveId: u.use.curveId, pcurveId: u.use.pcurveId }));
  d.nodes.push({ id: 'front_detail', kind: 'chamfer', parentPrismId: d.nodes[2].id, distanceMM: 2,
    reference: { sourceId: d.nodes[0].sourceId, sketchId: d.nodes[0].document.id, sourceRevision: 0, segmentId: 's0', role: 'top', a: refs[0], b: refs[1] },
    options: { operationId: 'front_chamfer', resultIdPrefix: 'ch', retainedSolidId: 'detailed_part', removedSolidId: 'front_wedge' } });
  d.parameters.push({ id: 'parentHeight', unit: 'mm', valueMM: 8, bindings: [{ kind: 'prism-height', prismNodeId: d.nodes[2].id }] },
    { id: 'setback', unit: 'mm', valueMM: 2, bindings: [{ kind: 'chamfer-distance', chamferNodeId: 'front_detail' }] },
    { id: 'rearX', unit: 'mm', valueMM: 16, bindings: [{ kind: 'fixed-sketch-coordinate', sketchNodeId: d.nodes[0].id, constraintId: 'fix_p3', axis: 'x' }] },
    { id: 'rightX', unit: 'mm', valueMM: 32, bindings: [1, 2].map(i => ({ kind: 'fixed-sketch-coordinate', sketchNodeId: d.nodes[0].id, constraintId: 'fix_p' + i, axis: 'x' })) },
    { id: 'shoulderY', unit: 'mm', valueMM: 16, bindings: [{ kind: 'fixed-sketch-coordinate', sketchNodeId: d.nodes[0].id, constraintId: 'fix_p2', axis: 'y' }] },
    { id: 'rearY', unit: 'mm', valueMM: 32, bindings: [3, 4].map(i => ({ kind: 'fixed-sketch-coordinate', sketchNodeId: d.nodes[0].id, constraintId: 'fix_p' + i, axis: 'y' })) },
    { id: 'frontY', unit: 'mm', valueMM: 0, bindings: [{ kind: 'fixed-sketch-coordinate', sketchNodeId: d.nodes[0].id, constraintId: 'fix_p1', axis: 'y' }] });
  return d;
}
const baseNames = ['sketchBuilds', 'prismBuilds', 'wallResolutions', 'subtractions'];
let initial, edited, text, seed;
if (mode === '--cold') {
  text = readFileSync(resolve(output, 'authored-v1.json'), 'utf8'); edited = api.parseXYAffinePrismFeatureDocumentV1(text);
  assert.equal(hash(edited), JSON.parse(readFileSync(resolve(output, 'expected-v1.json'), 'utf8')).editedHash); detailVolumes(edited, 7168, 7152, 16);
  await mark('cold_full_equality', edited.report.coldWork);
  const height = U(edited, edits(edited, 'parentHeight', 4)); detailVolumes(height.result, 3584, 3568, 16); volume(height.result, 1024, 1536);
  assert.deepEqual(height.transaction.report.actions.map(x => x.action), ['retained', 'retained', 'rebuilt', 'retained', 'rebuilt', 'rebuilt']);
  assert.deepEqual(height.result.sketches, edited.sketches); assert.equal(height.result.document.nodes[0].revision, 0); assert.equal(height.result.document.nodes[5].reference.sourceRevision, 0);
  assert.equal(height.transaction.report.noOp, false); await mark('cold_height_edit', sum(height.transaction.report.validation, height.transaction.report.candidate));
  write('cold-height-result.json', height.result); write('cold-height-update.json', height);
} else {
  seed = api.evaluateXYAffinePrismFeatureDocument(document());
  assert.equal(hash(seed), 'f083fa6020a97257abb123dd2797dd13156e6c20f0fc5a0a19d314e18bd4cf46'); await mark('v0_full_result_compatibility', seed.report.coldWork);
  const v0text = api.serializeXYAffinePrismFeatureDocument(seed.document); assert.equal(v0text, json(document()) + '\n');
  assert.equal(Object.hasOwn(seed.report.coldWork, 'chamfers'), false); assert.equal(Object.hasOwn(seed, 'chamfer'), false); await mark('v0_serialized_byte_compatibility', seed.report.coldWork);
  const doc = versionOne(seed), original = hash(doc); initial = V(doc); assert.equal(hash(doc), original); detailVolumes(initial, 7168, 7104, 64); volume(initial, 2048, 3072);
  assert.equal(initial.report.coldWork.sourceCompilations, 127); assert.equal(initial.report.coldWork.faceCompilations, 120); assert.equal(initial.report.coldWork.totalD1, 4428); assert.equal(initial.report.coldWork.rationalContexts, 20);
  await mark('v1_initial', initial.report.coldWork);
  const before = hash(initial), distance = U(initial, edits(initial, 'setback', 1)); edited = distance.result; detailVolumes(edited, 7168, 7152, 16);
  assert.equal(hash(initial), before); assert.equal(distance.transaction.report.noOp, false); assert.deepEqual(distance.transaction.report.actions.map(x => x.action), ['retained', 'retained', 'retained', 'retained', 'retained', 'rebuilt']);
  assert.equal(edited.document.revision, 1); assert.equal(edited.document.nodes[0].revision, 0); assert.deepEqual(edited.prisms, initial.prisms); assert.deepEqual(edited.subtraction, initial.subtraction);
  assert.deepEqual(baseNames.map(k => distance.transaction.report.candidate[k]), [0, 0, 0, 0]);
  assert.equal(distance.transaction.report.candidate.sourceCompilations, 34); assert.equal(distance.transaction.report.candidate.faceCompilations, 33); assert.equal(distance.transaction.report.candidate.totalD1, 1242); assert.equal(distance.transaction.report.candidate.rationalContexts, 5);
  await mark('distance_selective_edit', sum(distance.transaction.report.validation, distance.transaction.report.candidate));
  text = api.serializeXYAffinePrismFeatureDocumentV1(edited.document); assert.equal(text, json(edited.document) + '\n'); assert.ok(!text.includes('certificate') && !text.includes('coldWork')); assert.ok(Object.is(JSON.parse(text).nodes[0].document.points[0].position[0], -0)); await mark('source_only_save', edited.report.coldWork);
  if (mode === '--source') {
    write('authored-v1.json', text); write('expected-v1.json', { originalHash: hash(initial), editedHash: hash(edited) }); write('source-distance-update.json', distance); write('source-initial-result.json', initial); write('source-edited-result.json', edited);
    assert.deepEqual(api.validateXYAffinePrismFeatureDocumentUpdateV1(distance), distance.transaction.report); await mark('transaction_replay', sum(distance.transaction.report.validation, distance.transaction.report.candidate));
    assert.deepEqual(api.validateXYAffinePrismFeatureDocumentV1(edited), edited.report); await mark('direct_v1_validation', edited.report.coldWork);
    const noop = U(edited, edits(edited, 'setback', 1)); assert.equal(noop.transaction.report.noOp, true); assert.ok(Object.values(noop.transaction.report.candidate).every(n => n === 0)); await mark('equal_value_noop', edited.report.coldWork);
    const width = U(edited, edits(edited, 'upperX', 24)); volume(width.result, 2048, 1280); assert.deepEqual(width.result.chamfer, edited.chamfer); assert.equal(width.transaction.report.actions[5].action, 'retained'); assert.equal(width.result.document.nodes[1].revision, 1); assert.equal(width.result.document.nodes[0].revision, 0); await mark('tool_width_sibling_retained', sum(width.transaction.report.validation, width.transaction.report.candidate));
    const rear = U(edited, { expectedRevision: edited.document.revision, revision: edited.document.revision + 1, parameterEdits: [{ parameterId: 'rightX', valueMM: 16 }, { parameterId: 'rearX', valueMM: 8 }, { parameterId: 'shoulderY', valueMM: 8 }, { parameterId: 'rearY', valueMM: 16 }] }); detailVolumes(rear.result, 1792, 1784, 8); volume(rear.result, 1024, 0); assert.equal(rear.result.document.nodes[0].revision, 1); assert.equal(rear.result.document.nodes[5].reference.sourceRevision, 1); assert.equal(rear.result.document.nodes[5].reference.segmentId, 's0'); assert.deepEqual(rear.result.document.nodes[5].reference.a, edited.document.nodes[5].reference.a); assert.deepEqual(rear.result.document.nodes[5].reference.b, edited.document.nodes[5].reference.b); await mark('original_sketch_revision_advance', sum(rear.transaction.report.validation, rear.transaction.report.candidate)); write('source-sketch-edit-update.json', rear);
    for (const [name, parameter, v] of [['height_coverage_atomic', 'parentHeight', 10], ['height_nondyadic_atomic', 'parentHeight', 6], ['rear_nondyadic_atomic', 'rearX', 20], ['upstream_oblique_atomic', 'frontY', 2], ['invalid_distance_atomic', 'setback', 0]]) { const h = hash(edited); reject(name, () => U(edited, edits(edited, parameter, v))); assert.equal(hash(edited), h); await mark(name); }
    for (const [name, mutate] of [['forged_work', d => { d.report.coldWork.sourceCompilations++; }], ['forged_lineage', d => { d.prisms[0].lineage.segments[0].topEdgeId = 'forged'; }]]) { const bad = structuredClone(edited); mutate(bad); reject(name, () => U(bad, edits(edited, 'setback', 1)), 'OWNED'); await mark(name, edited.report.coldWork); }
    for (const side of ['a', 'b']) for (const field of ['sourceId', 'faceId', 'surfaceId', 'loopId', 'useId', 'curveId', 'pcurveId']) { const bad = structuredClone(doc); bad.nodes[5].reference[side][field] = 'wrong'; reject('wrong_' + side + '_' + field, () => V(bad), 'REFERENCE'); await mark('wrong_' + side + '_' + field, seed.report.coldWork); }
    const absent = structuredClone(doc); absent.nodes.pop(); absent.parameters = absent.parameters.filter(p => p.id !== 'setback'); const bare = V(absent); assert.equal(bare.chamfer, null); assert.equal(bare.report.coldWork.chamfers, 0); await mark('v1_without_optional_chamfer', bare.report.coldWork);
    for (const [name, mutate, code] of [
      ['stale_ref', d => { d.nodes[5].reference.sourceRevision++; }, 'REFERENCE'],
      ['wrong_segment', d => { d.nodes[5].reference.segmentId = 'missing'; }, 'REFERENCE'],
      ['wrong_kind', d => { d.nodes[5].parentPrismId = d.nodes[0].id; }, 'DEPENDENCY'],
      ['cycle', d => { d.nodes[5].parentPrismId = d.nodes[5].id; }, 'DEPENDENCY'],
      ['operation_source_collision', d => { d.nodes[5].options.operationId = 'aa_t'; }, 'IDENTITY'],
      ['output_source_collision', d => { d.nodes[5].options.retainedSolidId = 'left_f0'; }, 'IDENTITY'],
      ['source_context_collision', d => { d.nodes[0].sourceId = 'ch_cap_n'; d.nodes[5].reference.sourceId = 'ch_cap_n'; }, 'IDENTITY'],
      ['dimension_binding_wrong_kind', d => { d.parameters.find(p => p.id === 'parentHeight').bindings[0].prismNodeId = d.nodes[0].id; }, 'PARAMETER'],
      ['negative_zero_revision', d => { d.revision = -0; }, 'REVISION'],
      ['schema_budget', d => { d.parameters = Array.from({ length: 17 }, () => d.parameters[0]); }, 'BUDGET'],
    ]) { const bad = structuredClone(doc); mutate(bad); reject(name, () => V(bad), code); }
    const v0six = structuredClone(doc); v0six.version = 0; reject('v0_sixth_node', () => api.evaluateXYAffinePrismFeatureDocument(v0six), 'INPUT');
    reject('v0_parser_rejects_v1', () => api.parseXYAffinePrismFeatureDocument(text), 'VERSION');
    reject('v1_parser_rejects_v0', () => api.parseXYAffinePrismFeatureDocumentV1(v0text), 'VERSION');
    reject('duplicate_keys', () => api.parseXYAffinePrismFeatureDocumentV1('{"version":1,"version":1}'), 'CODEC');
    let getters = 0; const hostile = edits(edited, 'setback', 1); Object.defineProperty(hostile, 'revision', { enumerable: true, get() { getters++; return 2; } }); reject('getter_zero', () => U(edited, hostile), 'INPUT'); assert.equal(getters, 0);
    for (const binding of [null, 1, 'bad', { kind: 'prism-height', prismNodeId: 'aa_prism_node' }]) { const bad = document(); bad.parameters[0].bindings = [binding]; reject('v0_malformed_binding', () => api.evaluateXYAffinePrismFeatureDocument(bad), 'INPUT'); }
    reject('snapshot_budget', () => V({ ...doc, nodes: Array(4097).fill(null) }), 'BUDGET');
    const cov = await post('Profiler.takePreciseCoverage'); parts.push(cov); const counts = count(cov); assert.equal(counts.compileCadModel, 0); milestones.push({ label: 'pre_native_refusals', counts });
    assert.equal(hash(initial), before);
  } else {
    assert.equal(text, readFileSync(resolve(output, 'authored-v1.json'), 'utf8')); const hashes = JSON.parse(readFileSync(resolve(output, 'expected-v1.json'), 'utf8')); assert.equal(hash(initial), hashes.originalHash); assert.equal(hash(edited), hashes.editedHash); write('emitted-edited-result.json', edited);
  }
}
parts.push(await post('Profiler.takePreciseCoverage')); await post('Profiler.stopPreciseCoverage'); inspector.disconnect(); failureCoverage = null;
const counts = Object.fromEntries(names.map(name => [name, parts.reduce((n, part) => n + count(part)[name], 0)]));
// Entire predetermined campaign, including native refusals, uses this conservative aggregate reserve.
assert.equal(counts.validateXYAffineSketchPrism, 0); assert.equal(counts.validateConvexPlanarSolidChamfer, 0);
const phases = mode === '--source' ? 41 : mode === '--emitted' ? 6 : 3;
assert.ok(counts.compileCadModel <= phases * 204); assert.ok(counts.buildConvexPlanarFace <= phases * 197); assert.ok(counts.evaluateCurveD1 + counts.evaluateSurfaceD1 <= phases * 8910);
// Normalized-v0 producer requests do not create strict coordinate-span proof contexts.
// These campaigns use convex faces only; prove the helper subset rather than raising legacy caps.
assert.equal(counts.buildConvexPlanarFaceWithHoles + counts.booleanCoplanarFaces + counts.clipCurveWithConvexLineLoop, 0);
assert.equal(counts.ExactAffinePlane, counts.admitConvexNativeLineLoop);
assert.ok(counts.ExactAffinePlane <= counts.buildConvexPlanarFace);
const legacyRationalContexts = counts.SectionRationalContext - counts.ExactAffinePlane;
assert.ok(legacyRationalContexts >= 0);
assert.ok(legacyRationalContexts <= phases * 20); assert.ok(counts.work <= phases * 4000000);
write(mode.slice(2) + '-coverage.json', parts);
const summary = { status: 'passed', mode, pid: process.pid, counts, milestones, refusals, editedHash: hash(edited), authoredBytes: Buffer.byteLength(text), evidenceBytes: outputBytes, phases, limits: api.XYAffinePrismFeatureDocumentLimitsV1 };
write(mode.slice(2) + '-summary.json', summary); process.stdout.write(JSON.stringify({ status: summary.status, mode, pid: process.pid, counts, refusals: refusals.length }) + '\n');
