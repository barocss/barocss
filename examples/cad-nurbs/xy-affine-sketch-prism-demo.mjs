import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const [mode, directory] = process.argv.slice(2);
assert.ok(['--source', '--emitted', '--cold'].includes(mode) && directory, 'Usage: node xy-affine-sketch-prism-demo.mjs --source|--emitted|--cold output-directory');
assert.equal(process.versions.node, '22.23.3');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(directory);
mkdirSync(output, { recursive: true });
const nativeJSON = value => typeof value === 'number' && Object.is(value, -0) ? '-0' : Array.isArray(value) ? '[' + value.map(nativeJSON).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.entries(value).map(([key, item]) => JSON.stringify(key) + ':' + nativeJSON(item)).join(',') + '}' : JSON.stringify(value);
const write = (name, value) => writeFileSync(resolve(output, name), nativeJSON(value) + '\n');
process.on('uncaughtException', error => { write(mode.slice(2) + '-first-failure.json', { message: error.message, stack: error.stack, cause: error.cause?.message ?? null }); process.exitCode = 1; });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json'));
let api;
if (mode === '--source') {
  const built = await require('esbuild').build({ entryPoints: [resolve(repo, 'packages/barocss-cad/src/index.ts')], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
  assert.ok(Object.keys(built.metafile.inputs).every(p => !p.includes('/dist/'))); write('source-inputs.json', Object.keys(built.metafile.inputs));
  const target = resolve(output, 'sketch-prism-source.mjs'); writeFileSync(target, built.outputFiles[0].text); api = await import(pathToFileURL(target));
} else api = await import(pathToFileURL(resolve(repo, 'packages/barocss-cad/dist/index.js')));
const { buildXYAffineSketch, buildXYAffineSketchPrism: build, validateXYAffineSketchPrism: validate, resolveXYAffineSketchPrismWall: lookup, XYAffineSketchPrismError } = api;
const options = { sourceId: 'authored_profile', sourceRevision: 0, orderedSegmentIds: ['floor', 'right', 'bevel', 'roof', 'left'], heightMM: 8, capChart: { originXY: [0, 0], spanXY: [64, 32] }, solidId: 'beveled_part', resultIdPrefix: 'part' };
const reference = { sourceId: options.sourceId, sketchId: 'footprint', sourceRevision: 0, segmentId: 'bevel' };
if (mode === '--cold') {
  const saved = JSON.parse(readFileSync(resolve(output, 'source-result.json'), 'utf8'));
  assert.deepEqual(validate(saved), saved.report);
  assert.deepEqual(build(saved.request.sketch, saved.request.options), saved);
  assert.deepEqual(lookup(saved, reference).targets, [saved.lineage.segments.find(s => s.segmentId === 'bevel').wall]);
  const edited = JSON.parse(readFileSync(resolve(output, 'source-edited.json'), 'utf8')); assert.deepEqual(validate(edited), edited.report);
  write('cold-summary.json', { status: 'passed', pid: process.pid, volume: saved.solid.certificate.volumeMM3, editedVolume: edited.solid.certificate.volumeMM3, native: saved.report.childNativeWork });
  process.stdout.write(JSON.stringify({ mode, status: 'passed', pid: process.pid }) + '\n'); process.exit(0);
}
function document(coordinates, names = options.orderedSegmentIds) {
  const points = coordinates.map((position, i) => ({ id: 'p' + i, position }));
  return { format: 'barocss-xy-affine-sketch', version: 0, profile: 'exact-affine-binary64', id: 'footprint', lengthUnit: 'mm', points,
    segments: points.map((p, i) => ({ id: names[i] ?? 'edge_' + i, startPointId: p.id, endPointId: points[(i + 1) % points.length].id })), referenceLines: [],
    constraints: points.map(p => ({ id: 'fix_' + p.id, kind: 'fixed', pointId: p.id, target: [...p.position] })) };
}
const authored = document([[0, 0], [40, 0], [40, 16], [36, 20], [0, 20]]), sketch = buildXYAffineSketch(authored), before = structuredClone(sketch), beforeOptions = structuredClone(options);
const result = build(sketch, options), saved = structuredClone(result);
assert.equal(result.solid.graph.faces.length, 7); assert.equal(result.solid.graph.edges.length, 15); assert.equal(result.solid.graph.vertices.length, 10);
assert.deepEqual(result.solid.certificate.volumeMM3, { numerator: '6336', denominator: '1' });
assert.deepEqual(result.report.childNativeWork, { sketchReconstructionCount: 1, initialFaceConstructionCount: 7, solidQualificationCount: 1, solidFaceReconstructionCount: 7, sourceCompilationCount: 15, bindingObservationCount: 180, totalD1Count: 540, retries: 0 });
assert.deepEqual(validate(result), result.report);
assert.deepEqual(result.request.sketch, sketch); assert.deepEqual(sketch, before); assert.deepEqual(options, beforeOptions);
assert.ok(result.solid.request.assets.every(a => a.face.report.solid === false));
const wall = lookup(result, reference); assert.equal(wall.status, 'preserved'); assert.equal(wall.targets.length, 1);
assert.deepEqual(wall.targets[0], result.lineage.segments.find(s => s.segmentId === 'bevel').wall);
// Edit the authored fixed dimensions; geometry is regenerated by the exact-affine sketch API.
const edit = structuredClone(authored); edit.constraints[2].target = [40, 18]; edit.constraints[3].target = [38, 20];
const editedSketch = buildXYAffineSketch(edit), editedOptions = { ...options, sourceRevision: 1, orderedSegmentIds: [...options.orderedSegmentIds.slice(2), ...options.orderedSegmentIds.slice(0, 2)] };
const edited = build(editedSketch, editedOptions);
assert.deepEqual(edited.solid.certificate.volumeMM3, { numerator: '6384', denominator: '1' });
assert.deepEqual(lookup(edited, reference), { reference, currentRevision: 1, status: 'stale', targets: [] });
const current = lookup(edited, { ...reference, sourceRevision: 1 }); assert.equal(current.status, 'preserved');
assert.deepEqual(current.targets[0], edited.lineage.segments.find(s => s.segmentId === 'bevel').wall);
assert.notEqual(current.targets[0].faceId, wall.targets[0].faceId, 'Cycle rotation changes ordinals; source-ID lookup must follow bevel');
assert.equal(lookup(result, { ...reference, segmentId: 'absent' }).status, 'deleted');
const failures = [];
function reject(name, action, stage) {
  assert.throws(action, error => { assert.ok(error instanceof XYAffineSketchPrismError, String(error)); if (stage) assert.equal(error.stage, stage); failures.push({ name, stage: error.stage, entityId: error.entityId, message: error.message }); return true; });
  assert.deepEqual(result, saved); assert.deepEqual(sketch, before); assert.deepEqual(options, beforeOptions);
}
reject('missing_cycle_segment', () => build(sketch, { ...options, orderedSegmentIds: options.orderedSegmentIds.slice(1) }), 'cycle');
reject('repeated_cycle_segment', () => build(sketch, { ...options, orderedSegmentIds: ['floor', 'right', 'bevel', 'roof', 'roof'] }), 'cycle');
reject('disconnected_cycle_order', () => build(sketch, { ...options, orderedSegmentIds: ['floor', 'bevel', 'right', 'roof', 'left'] }), 'cycle');
const open = structuredClone(authored); open.segments[4].endPointId = 'p1';
reject('open_native_loop', () => build(buildXYAffineSketch(open), options), 'cycle');
const repeatedIdentity = structuredClone(authored); repeatedIdentity.segments[2].endPointId = 'p1'; repeatedIdentity.segments[3].startPointId = 'p1';
reject('repeated_cycle_point_identity', () => build(buildXYAffineSketch(repeatedIdentity), options), 'cycle');
const forgedSketchReport = structuredClone(sketch); forgedSketchReport.report.rank++;
reject('forged_complete_sketch_report', () => build(forgedSketchReport, options), 'sketch');
const wrongLine = structuredClone(sketch); wrongLine.solution.model.objects[0].degree = 2;
reject('unsupported_native_curve', () => build(wrongLine, options), 'sketch');
const forgedSource = structuredClone(sketch); forgedSource.solution.source += ' ';
reject('stale_complete_source', () => build(forgedSource, options), 'sketch');
const forgedResult = structuredClone(result); forgedResult.lineage.segments[2].segmentId = 'wrong';
reject('forged_lineage', () => validate(forgedResult), 'result');
const forgedReport = structuredClone(result); forgedReport.report.sourceRevision++;
reject('forged_revision_report', () => validate(forgedReport), 'result');
reject('foreign_source_namespace', () => lookup(result, { ...reference, sourceId: 'other' }), 'reference');
reject('foreign_sketch_identity', () => lookup(result, { ...reference, sketchId: 'other' }), 'reference');
for (const [name, points] of [
  ['repeated_vertex', [[0, 0], [8, 0], [8, 8], [0, 0], [0, 8]]],
  ['collinear_vertex', [[0, 0], [4, 0], [8, 0], [8, 8], [0, 8]]],
  ['nonconvex_profile', [[0, 0], [8, 0], [4, 4], [8, 8], [0, 8]]],
  ['self_crossed_profile', [[0, 0], [8, 8], [0, 8], [8, 0], [4, 10]]],
]) reject(name, () => build(buildXYAffineSketch(document(points)), options), 'face');
reject('nonexact_stored_cap_lift', () => build(sketch, { ...options, capChart: { originXY: [0, 0], spanXY: [60, 32] } }), 'qualification');
reject('outside_cap_domain', () => build(sketch, { ...options, capChart: { originXY: [0, 0], spanXY: [32, 32] } }), 'face');
reject('unrepresentable_cap_corner', () => build(sketch, { ...options, capChart: { originXY: [.1, 0], spanXY: [64, 32] } }), 'chart');
reject('zero_height', () => build(sketch, { ...options, heightMM: 0 }), 'input');
reject('infinite_height', () => build(sketch, { ...options, heightMM: Infinity }), 'input');
reject('segment_budget', () => build(sketch, { ...options, orderedSegmentIds: Array.from({ length: 9 }, (_, i) => 's' + i) }), 'cycle');
reject('snapshot_array_budget', () => build(sketch, { ...options, orderedSegmentIds: Array(4097).fill('s') }), 'input');
let getterCalls = 0; const getter = { ...options }; Object.defineProperty(getter, 'heightMM', { enumerable: true, get() { getterCalls++; return 8; } });
reject('hostile_getter', () => build(sketch, getter), 'input'); assert.equal(getterCalls, 0);
const cyclic = { ...options }; cyclic.capChart = cyclic; reject('hostile_cycle', () => build(sketch, cyclic), 'input');
const controls = [];
for (const [name, coordinates] of [
  ['cw', [...authored.points.map(p => p.position)].reverse()],
  ['triangle', [[0, 0], [8, 0], [0, 8]]],
  ['eight_edges', [[4, 0], [12, 0], [16, 4], [16, 12], [12, 16], [4, 16], [0, 12], [0, 4]]],
]) {
  const doc = document(coordinates), value = build(buildXYAffineSketch(doc), { ...options, orderedSegmentIds: doc.segments.map(s => s.id) });
  assert.equal(value.solid.graph.faces.length, coordinates.length + 2);
  if (name === 'cw') { assert.equal(value.report.profileOrientation, 'cw'); assert.deepEqual(value.solid.certificate.volumeMM3, result.solid.certificate.volumeMM3); }
  if (name === 'triangle') assert.deepEqual(value.solid.certificate.volumeMM3, { numerator: '256', denominator: '1' });
  if (name === 'eight_edges') assert.deepEqual(value.solid.certificate.volumeMM3, { numerator: '1792', denominator: '1' });
  controls.push({ name, volume: value.solid.certificate.volumeMM3, native: value.report.childNativeWork });
}
write(mode.slice(2) + '-result.json', result); write(mode.slice(2) + '-edited.json', edited);
write(mode.slice(2) + '-summary.json', { status: 'passed', pid: process.pid, volume: result.solid.certificate.volumeMM3, editedVolume: edited.solid.certificate.volumeMM3, native: result.report.childNativeWork, controls, failures });
if (mode === '--emitted') {
  assert.deepEqual(result, JSON.parse(readFileSync(resolve(output, 'source-result.json'), 'utf8')));
  assert.deepEqual(edited, JSON.parse(readFileSync(resolve(output, 'source-edited.json'), 'utf8')));
}
process.stdout.write(JSON.stringify({ mode, status: 'passed', volume: result.solid.certificate.volumeMM3, controls: controls.length, refusals: failures.length }) + '\n');
