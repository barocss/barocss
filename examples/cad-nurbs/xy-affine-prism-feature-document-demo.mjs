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
function write(name, v) { const text = typeof v === 'string' ? v : json(v) + '\n', bytes = Buffer.byteLength(text); assert.ok(bytes <= 64 * 1024 * 1024 && (outputBytes += bytes) <= 256 * 1024 * 1024 && ++outputFiles <= 16); writeFileSync(resolve(output, name), text); }
const hash = v => createHash('sha256').update(json(v)).digest('hex');
let failureCoverage;
process.on('uncaughtException', async error => { write(mode.slice(2) + '-first-failure-' + process.pid + '.json', { message: error.message, stack: error.stack, stage: error.stage ?? null, code: error.code ?? null, cause: error.cause?.message ?? null }); if (failureCoverage) write(mode.slice(2) + '-failed-coverage-' + process.pid + '.json', await failureCoverage()); process.exitCode = 1; });
let api;
if (mode === '--source') {
  const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
  const bundle = await require('esbuild').build({ entryPoints: [resolve(repo, 'packages/barocss-cad/src/index.ts')], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
  assert.ok(Object.keys(bundle.metafile.inputs).every(p => !p.includes('/dist/'))); write('source-inputs.json', Object.keys(bundle.metafile.inputs));
  const file = resolve(output, 'features-source.mjs'); write('features-source.mjs', bundle.outputFiles[0].text); api = await import(pathToFileURL(file));
} else api = await import(pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')));
const inspector = new Session(); inspector.connect();
const post = (method, params = {}) => new Promise((ok, no) => inspector.post(method, params, (error, value) => error ? no(error) : ok(value)));
await post('Profiler.enable'); await post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
failureCoverage = async () => { const value = await post('Profiler.takePreciseCoverage'); await post('Profiler.stopPreciseCoverage'); inspector.disconnect(); return value; };
const names = ['evaluateXYAffinePrismFeatureDocument', 'updateXYAffinePrismFeatureDocument', 'validateXYAffinePrismFeatureDocument', 'validateXYAffinePrismFeatureDocumentUpdate', 'serializeXYAffinePrismFeatureDocument', 'parseXYAffinePrismFeatureDocument', 'buildXYAffineSketch', 'buildXYAffineSketchPrism', 'resolveXYAffineSketchPrismWall', 'subtractConvexPlanarSlab', 'compileCadModel', 'buildConvexPlanarFace', 'evaluateCurveD1', 'evaluateSurfaceD1'];
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
let result, update, text;
if (mode === '--cold') {
  text = readFileSync(resolve(output, 'authored.json'), 'utf8'); result = api.parseXYAffinePrismFeatureDocument(text); volume(result, 2048, 1280); assert.ok(Object.is(result.document.nodes[0].document.points[0].position[0], -0)); assert.ok(Object.is(result.document.nodes[0].document.constraints[0].target[0], -0));
  assert.equal(hash(result), JSON.parse(readFileSync(resolve(output, 'expected.json'), 'utf8')).editedHash); await mark('fresh_process_parse', result.report.coldWork);
  update = api.updateXYAffinePrismFeatureDocument(result, edits(result, 'upperX', 16)); volume(update.result, 2048, 3072); assert.equal(update.result.document.revision, 2); assert.deepEqual(update.result.prisms[0], result.prisms[0]);
  await mark('second_edit', sum(update.transaction.report.validation, update.transaction.report.candidate));
  assert.deepEqual(api.validateXYAffinePrismFeatureDocument(update.result), update.result.report); await mark('second_edit_cold_validation', update.result.report.coldWork);
} else {
  const doc = document(), original = structuredClone(doc); result = api.evaluateXYAffinePrismFeatureDocument(doc); volume(result, 2048, 3072); assert.deepEqual(doc, original);
  assert.deepEqual(result.report.coldWork.sourceCompilations, 93); await mark('initial_document', result.report.coldWork);
  const before = hash(result); update = api.updateXYAffinePrismFeatureDocument(result, edits(result, 'upperX', 24)); volume(update.result, 2048, 1280);
  assert.equal(hash(result), before); assert.deepEqual(update.result.sketches[0], result.sketches[0]); assert.deepEqual(update.result.prisms[0], result.prisms[0]);
  assert.deepEqual(update.transaction.report.actions.map(a => a.action), ['retained', 'rebuilt', 'retained', 'rebuilt', 'rebuilt']);
  assert.deepEqual([update.transaction.report.candidate.sketchBuilds, update.transaction.report.candidate.prismBuilds, update.transaction.report.candidate.wallResolutions, update.transaction.report.candidate.subtractions], [1, 1, 2, 1]);
  assert.equal(update.result.walls[0].reference.segmentId, 's3'); assert.equal(update.result.walls[1].reference.segmentId, 's1'); assert.equal(update.result.walls[0].reference.sourceRevision, 1);
  await mark('tool_width_edit', sum(update.transaction.report.validation, update.transaction.report.candidate));
  text = api.serializeXYAffinePrismFeatureDocument(update.result.document); assert.ok(text.endsWith('\n') && !text.endsWith('\n\n')); assert.ok(text.length < 16384 && !text.includes('certificate') && !text.includes('solution'));
  assert.deepEqual(JSON.parse(text), update.result.document); assert.ok(Object.is(JSON.parse(text).nodes[0].document.points[0].position[0], -0)); assert.ok(Object.is(JSON.parse(text).nodes[0].document.constraints[0].target[0], -0)); await mark('authored_serialize', update.result.report.coldWork);
  if (mode === '--source') {
    write('authored.json', text); write('expected.json', { originalHash: hash(result), editedHash: hash(update.result) });
    assert.deepEqual(api.validateXYAffinePrismFeatureDocumentUpdate(update), update.transaction.report); await mark('whole_transaction_validation', sum(update.transaction.report.validation, update.transaction.report.candidate));
    const noop = api.updateXYAffinePrismFeatureDocument(update.result, edits(update.result, 'upperX', 24)); assert.ok(noop.transaction.report.noOp); assert.ok(Object.values(noop.transaction.report.candidate).every(n => n === 0)); assert.deepEqual(noop.result.prisms, update.result.prisms); await mark('equal_value_noop', update.result.report.coldWork);
    reject('stale_revision', () => api.updateXYAffinePrismFeatureDocument(result, { ...edits(result, 'upperX', 24), expectedRevision: 9 }), 'REVISION'); await mark('stale_revision', result.report.coldWork);
    const forged = structuredClone(result); forged.prisms[0].solid.certificate.volumeMM3.numerator = '1'; reject('forged_retained_parent', () => api.updateXYAffinePrismFeatureDocument(forged, edits(result, 'upperX', 24)), 'OWNED'); await mark('forged_retained_parent', result.report.coldWork);
    for (const [name, mutate, code] of [
      ['missing_dependency', d => { d.nodes[2].sketchNodeId = 'missing'; }, 'DEPENDENCY'],
      ['wrong_kind_dependency', d => { d.nodes[3].sketchNodeId = d.nodes[2].id; }, 'DEPENDENCY'],
      ['cyclic_dependency', d => { d.nodes[2].sketchNodeId = d.nodes[4].id; }, 'DEPENDENCY'],
      ['stale_selected_segment', d => { d.nodes[4].first.reference.sourceRevision = 2; }, 'REFERENCE'],
      ['missing_selected_segment', d => { d.nodes[4].first.reference.segmentId = 'missing'; }, 'REFERENCE'],
    ]) { const bad = document(); mutate(bad); reject(name, () => api.evaluateXYAffinePrismFeatureDocument(bad), code); }
    let getters = 0; const hostileEdits = edits(result, 'upperX', 24); Object.defineProperty(hostileEdits, 'revision', { enumerable: true, get() { getters++; return 1; } }); reject('hostile_edit_before_native', () => api.updateXYAffinePrismFeatureDocument(result, hostileEdits), 'INPUT'); assert.equal(getters, 0);
    reject('duplicate_json_keys', () => api.parseXYAffinePrismFeatureDocument('{"version":0,"version":0}'), 'CODEC');
    const preflight = await post('Profiler.takePreciseCoverage'); parts.push(preflight); assert.equal(count(preflight).compileCadModel, 0); milestones.push({ label: 'pre_native_refusals', counts: count(preflight) });
    const nonconvex = document(); nonconvex.nodes[0].document.constraints[2].target = [8, 8]; reject('nonconvex_parent', () => api.evaluateXYAffinePrismFeatureDocument(nonconvex)); await mark('nonconvex_parent');
    reject('inadequate_tool_coverage_atomic', () => api.updateXYAffinePrismFeatureDocument(result, edits(result, 'upperY', 16))); assert.equal(hash(result), before); await mark('inadequate_tool_coverage_atomic');
    const emptyDoc = document(); emptyDoc.nodes[3].options.capChart = { originXY: [-16, -16], spanXY: [64, 64] }; emptyDoc.parameters[0].valueMM = -8; for (const i of [0, 3]) emptyDoc.nodes[1].document.constraints[i].target[0] = -8;
    const empty = api.evaluateXYAffinePrismFeatureDocument(emptyDoc); volume(empty, 0, 3072); assert.deepEqual(empty.report.componentRoles[0], { role: 'first', solidId: 'left_part', status: 'empty' }); await mark('fixed_empty_role', empty.report.coldWork);
    const emptyEdit = api.updateXYAffinePrismFeatureDocument(empty, edits(empty, 'upperX', 24)); volume(emptyEdit.result, 0, 1280); assert.deepEqual(emptyEdit.result.report.componentRoles[0], empty.report.componentRoles[0]); await mark('fixed_empty_role_after_edit', sum(emptyEdit.transaction.report.validation, emptyEdit.transaction.report.candidate));
    assert.equal(hash(result), before); assert.equal(refusals.length, 11);
  } else { assert.equal(text, readFileSync(resolve(output, 'authored.json'), 'utf8')); assert.equal(hash(update.result), JSON.parse(readFileSync(resolve(output, 'expected.json'), 'utf8')).editedHash); }
}
parts.push(await post('Profiler.takePreciseCoverage')); await post('Profiler.stopPreciseCoverage'); inspector.disconnect(); failureCoverage = null;
const counts = Object.fromEntries(names.map(name => [name, parts.reduce((n, part) => n + count(part)[name], 0)])), phases = mode === '--source' ? 15 : 4;
assert.ok(counts.compileCadModel <= phases * 158); assert.ok(counts.buildConvexPlanarFace <= phases * 152); assert.ok(counts.evaluateCurveD1 + counts.evaluateSurfaceD1 <= phases * 6912);
assert.ok(counts.buildXYAffineSketch <= phases * 6 && counts.buildXYAffineSketchPrism <= phases * 2 && counts.resolveXYAffineSketchPrismWall <= phases * 2 && counts.subtractConvexPlanarSlab <= phases);
const top = mode === '--source' ? [8, 7, 0, 1, 1, 1] : mode === '--emitted' ? [1, 1, 0, 0, 1, 0] : [0, 1, 1, 0, 0, 1];
for (let i = 0; i < 6; i++) assert.equal(counts[names[i]], top[i], names[i]);
write(mode.slice(2) + '-coverage.json', parts);
const summary = { status: 'passed', mode, pid: process.pid, counts, milestones, refusals, originalOrReopened: result.subtraction.report.volumeMM3, edited: update.result.subtraction.report.volumeMM3, transaction: update.transaction.report, authoredBytes: Buffer.byteLength(text), authoredHash: createHash('sha256').update(text).digest('hex'), resultHash: hash(update.result), limits: api.XYAffinePrismFeatureDocumentLimits };
write(mode.slice(2) + '-summary.json', summary); process.stdout.write(JSON.stringify(summary) + '\n');
